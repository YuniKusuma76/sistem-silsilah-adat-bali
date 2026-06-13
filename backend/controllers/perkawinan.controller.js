import { Op, where } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  Keluarga,
  DesaAdat,
  RiwayatPeranAdat,
  RiwayatKeluarga,
  User
} from "../models/associations.js";
import { buatPerkawinanBali } from "../services/perkawinan.service.js";
import { prosesPerceraianBali } from "../services/perceraian.service.js";
import { integrasiPerkawinanLeluhur } from "../services/perkawinan-leluhur.service.js";
import { batalkanPerceraian } from "../services/batal-perceraian.service.js";
import { menghapusPerkawinanDraft } from "../services/hapus-perkawinan.service.js";
import { eksekusiVerifikasiPerkawinan } from "../services/verifikasi-perkawinan.service.js";
import { eksekusiVerifikasiPerceraian } from "../services/verifikasi-perceraian.service.js";

// Validasi Input Valid
const VALID_STATUS_PERKAWINAN = [
  "Kawin", 
  "Cerai Hidup", 
  "Cerai Mati", 
  "Tidak Diketahui"
];

const VALID_JENIS_PERKAWINAN = [
  "Biasa", 
  "Nyentana", 
  "Pade Gelahang", 
  "Tidak Diketahui"
];

const VALID_PIHAK_MENINGGAL = [
  "Purusa", 
  "Predana", 
  "Suami", 
  "Istri"
];

const VALID_KETETAPAN_SILSILAH = [
  "Tetap", 
  "Kembali ke Asal", 
  "Tidak Ada"
];

const VALID_STATUS_VERIFIKASI = [
  "Draft",
  "Disetujui",
  "Ditolak"
];

// Data Perkawinan Include
const PERKAWINAN_INCLUDE = [
  {
    model: KramaBali,
    as: "suami",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi"]
  },{
    model: KramaBali,
    as: "istri",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi"]
  },{
    model: Keluarga,
    as: "keluarga_baru"
  }
];

export const getAllPerkawinan = async (req, res) => {
  try {
    const { mode } = req.query;
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    let whereCondition = {};
    let territorialCondition = [];
    let isVerificationMode = mode === "verification";

    // ============================================================
    // LOGIKA FILTERING BERDASARKAN MODE 
    // ============================================================
    
    // Kondisi 1: Mengambil semua data orang lain yang telah disetujui
    if (mode === "public") {
      whereCondition.status_verifikasi = "Disetujui";
    } 
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (mode === "personal") {
      whereCondition.user_id = currentUserId;
    }
    // Kondisi 3: Mengambil data dengan status draft
    else if (isVerificationMode) {
      if (userRole !== "Admin Desa" && userRole !== "Super Admin") {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Hak verifikasi murni wewenang Admin."
        });
      }
      // menampilkan atrean draft baru
      whereCondition[Op.or] = [
        { status_verifikasi: "Draft" },
        { status_verifikasi: "Disetujui", is_pending_update: true }
      ];
      // Validasi batasan wilayah desa adat untuk Admin Desa
      if (userRole === "Admin Desa") {
        territorialCondition = [
          { "$suami.desa_adat_id$": userDesaId },
          { "$istri.desa_adat_id$": userDesaId }
        ];
      }
    }

    // Menggabungkan filter jika diakses Admin Desa saat verifikasi
    const finalWhere = territorialCondition.length > 0
      ? { [Op.and]: [whereCondition, { [Op.or]: territorialCondition }] }
      : whereCondition;

    const PERKAWINAN_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "suami",
        required: isVerificationMode,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },{
        model: KramaBali,
        as: "istri",
        required: isVerificationMode,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },{
        model: User,
        as: "pembuat_perkawinan",
        attributes: ["id", "full_name", "email", "role"]
      }
    ];

    const perkawinanList = await Perkawinan.findAll({
      where: finalWhere,
      include: PERKAWINAN_INCLUDE_KHUSUS,
      order: [
        ["tanggal_perkawinan", "DESC"],
        ["id", "DESC"]
      ]
    });

    // Menampilkan data keluarga
    const kepalaKeluargaIds = [];

    perkawinanList.forEach((item) => {
      if (item.jenis_perkawinan === "Pade Gelahang") {
        if (item.suami_id) {
          kepalaKeluargaIds.push(item.suami_id);
        }
        if (item.istri_id) {
          kepalaKeluargaIds.push(item.istri_id);
        }
      } else if (item.status_verifikasi === "Disetujui") {
        const purusaId = item.jenis_perkawinan === "Nyentana" ? item.istri_id : item.suami_id;
        if (purusaId) {
          kepalaKeluargaIds.push(purusaId);
        }
      }
    });

    let mapKeluargaAktif = new Map();
    
    if (kepalaKeluargaIds.length > 0) {
      const keluargaTerbaca = await Keluarga.findAll({
        where: {
          kepala_keluarga_id: { [Op.in]: kepalaKeluargaIds },
          status_keluarga: "Aktif"
        }
      });
      keluargaTerbaca.forEach(k => {
        mapKeluargaAktif.set(k.kepala_keluarga_id, k);
      });
    }

    // Pemetaan data keluarga sebagai response akhir
    const datakawin = perkawinanList.map((item) => {
      const data = item.get({ clone: true });
      if (data.jenis_perkawinan === "Pade Gelahang") {
        data.keluarga_suami = mapKeluargaAktif.get(data.suami_id) || null;
        data.keluarga_istri = mapKeluargaAktif.get(data.istri_id) || null;
      } else {
        const purusaId = data.jenis_perkawinan === "Nyentana" ? data.istri_id : data.suami_id;
        data.keluarga_baru = mapKeluargaAktif.get(purusaId) || null;
      }
      return data;
    });

    res.status(200).json({
      message: "Berhasil mengambil data perkawinan!",
      count: datakawin.length,
      data: datakawin
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getPerkawinanById = async (req, res) => {
  try {
    const { id } = req.params;

    const PERKAWINAN_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "suami",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },
      {
        model: KramaBali,
        as: "istri",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },{
        model: User,
        as: "pembuat_perkawinan",
        attributes: ["id", "full_name", "email", "role"]
      }
    ];

    const dataKawin = await Perkawinan.findByPk(id, {
      include: PERKAWINAN_INCLUDE_KHUSUS
    });

    if (!dataKawin) {
      return res.status(404).json({
        message: "Data perkawinan tidak ditemukan."
      });
    }

    const data = dataKawin.get({ clone: true });

    // Validasi hak akses ruang lingkup data
    const isDraft = data.status_verifikasi === "Draft" || 
      data.status_verifikasi === "Ditolak";
    const isPending = data.is_pending_update === true;

    if (isDraft || isPending) {
      const isOwner = data.user_id === req.userId || 
        data.suami?.user_id === req.userId || 
        data.istri?.user_id === req.userId;
      const isSuperAdmin = req.role === "Super Admin";
      const isAdminDesaLokal = req.role === "Admin Desa" && (
        data.suami?.desa_adat_id === req.desaAdatId || data.istri?.desa_adat_id === req.desaAdatId
      );
      if (!isOwner && !isAdminDesaLokal && !isSuperAdmin) {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak akses untuk melihat draf usulan ini."
        });
      }
    }

    // Menampilkan data keluarga 
    if (data.status_verifikasi === "Disetujui") {
      // KONDISI 1: Skenario perkawinan pade gelahang
      if (data.jenis_perkawinan === "Pade Gelahang") {
        const [keluargaSuami, keluargaIstri] = await Promise.all([
          Keluarga.findOne({ 
            where: { 
              kepala_keluarga_id: data.suami_id, 
              status_keluarga: "Aktif" 
            } 
          }),
          Keluarga.findOne({ 
            where: { 
              kepala_keluarga_id: data.istri_id, 
              status_keluarga: "Aktif" 
            } 
          })
        ]);
        data.keluarga_suami = keluargaSuami;
        data.keluarga_istri = keluargaIstri;
      }
      // KONDISI 2: Skenario perkawinan nyentana/biasa
      else {
        const purusaId = data.jenis_perkawinan === "Nyentana" 
          ? data.istri_id 
          : data.suami_id;
        if (purusaId) {
          data.keluarga_baru = await Keluarga.findOne({
            where: { 
              kepala_keluarga_id: purusaId, 
              status_keluarga: "Aktif" 
            }
          });
        } else {
          data.keluarga_baru = null;
        }
      }
    } else {
      if (data.jenis_perkawinan === "Pade Gelahang") {
        data.keluarga_suami = null;
        data.keluarga_istri = null;
      } else {
        data.keluarga_baru = null;
      }
    }

    res.status(200).json({
      message: "Berhasil mengambil data detail perkawinan!",
      data
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const createPerkawinan = async (req, res) => {
  // Deklarasi t di luar untuk scope blok catch jika digunakan pada Jalur Leluhur
  let t;
  
  try {
    const {
      suami_id,
      istri_id,
      status_perkawinan,
      jenis_perkawinan,
      tanggal_perkawinan
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(suami_id),
      KramaBali.findByPk(istri_id)
    ]);

    if (!suami || !istri) {
      return res.status(404).json({
        message: "Data suami atau istri tidak ditemukan."
      });
    }

    // Menentukan jalur relasi perkawinan
    const isLeluhurPath = suami.tipe_data === "Leluhur" || istri.tipe_data === "Leluhur";

    // Validasi Kedaulatan Desa untuk Input Data
    if (!isLeluhurPath && (user_role === "Krama" || user_role === "Admin Desa")) {
      // Kondisi 1: Kawin Biasa atau Poligami (Purusa = Suami)
      if (jenis_perkawinan === "Biasa") {
        if (suami.desa_adat_id !== user_desa_id) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang boleh mendaftarkan perkawinan ini."
          });
        }
      }

      // Kondisi 2: Kawin Nyentana (Purusa = Istri)
      if (jenis_perkawinan === "Nyentana") {
        if (istri.desa_adat_id !== user_desa_id) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang boleh mendaftarkan perkawinan ini."
          });
        }
      }

      // Kondisi 3: Kawin Pade Gelahang (Kedua desa berdaulat)
      if (jenis_perkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id !== user_desa_id && istri.desa_adat_id !== user_desa_id) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Hanya salah satu desa adat pasangan yang boleh mendaftarkan perkawinan ini."
          });
        }
      }
    }

    let finalData;

    // ============================================================
    // CASE 1: Jalur integrasi data Leluhur
    // ============================================================
    if (isLeluhurPath) {
      // mengambil nama desa untuk catatan verifikasi
      let namaDesa = null;
      if (user_role === "Admin Desa" && user_desa_id) {
        const desa = await DesaAdat.findByPk(user_desa_id);
        if (desa) {
          namaDesa = desa.nama_desa_adat;
        }
      }

      // Mulai transaksi database
      t = await db.transaction();

      const resultLeluhur = await integrasiPerkawinanLeluhur({
        suami_id,
        istri_id,
        status_perkawinan: status_perkawinan || "Kawin",
        jenis_perkawinan: jenis_perkawinan || "Biasa",
        tanggal_perkawinan,
        user_id,
        user_role,
        user_desa_id,
        nama_desa_operator: namaDesa
      }, t);

      await t.commit();
      t = null; 
      finalData = resultLeluhur;
    }

    // ============================================================
    // CASE 2: Jalur integrasi data Keturunan
    // ============================================================
    else {
      // Validasi jenis perkawinan
      if (jenis_perkawinan && !VALID_JENIS_PERKAWINAN.includes(jenis_perkawinan)) {
        return res.status(400).json({ 
          message: "Jenis perkawinan tidak valid!" 
        });
      }
      
      const perkawinanBaru = await buatPerkawinanBali({
        suami_id, 
        istri_id, 
        status_perkawinan: status_perkawinan || "Kawin", 
        jenis_perkawinan, 
        tanggal_perkawinan,
        user_id,
        user_role,
        user_desa_id
      });

      finalData = perkawinanBaru;
    }

    res.status(201).json({
      message: finalData?.perkawinan?.status_verifikasi === "Draft"
        ? "Data perkawinan berhasil diajukan! Menunggu verifikasi Admin Desa."
        : "Data perkawinan berhasil disimpan!",
      data: finalData
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }
    res.status(400).json({
      message: error.message
    });
  }
};

export const verifikasiPerkawinan = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      return res.status(400).json({ 
        message: "ID Perkawinan tidak valid!" 
      });
    }

    const { 
      status_verifikasi, 
      catatan_admin
    } = req.body;

    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      return res.status(400).json({
        message: "Status verifikasi tidak valid!"
      });
    }

    if (status_verifikasi === "Ditolak" && (!catatan_admin || catatan_admin.trim() === "")) {
      return res.status(400).json({
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
      });
    }

    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan || perkawinan.status_verifikasi !== "Draft") {
      return res.status(400).json({
        message: "Proses verifikasi dihentikan! Data ini tidak berada dalam antrean pengajuan data."
      });
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      return res.status(404).json({ 
        message: "Data krama suami atau istri tidak ditemukan." 
      });
    }

    let targetSisi = null;

    // Validasi hak akses ruang lingkup data
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang dapat mendaftarkan/mengelola data verifikasi ini." 
          });
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang dapat mendaftarkan/mengelola data verifikasi ini." 
          });
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat Anda tidak terikat dengan kedua mempelai." 
          });
        }
        targetSisi = isDesaSuami ? "suami" : "istri";
      }
    } else if (user_role === "Super Admin") {
      targetSisi = "super_admin";
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa 
        ? `Admin Desa ${desa.nama_desa_adat}` 
        : `Admin Desa ${user_desa_id}`;
    }

    // Eksekusi Service
    const hasilVerifikasi = await eksekusiVerifikasiPerkawinan({
      perkawinan_id,
      status_verifikasi,
      catatan_admin,
      user_role,
      user_desa_id,
      target_sisi: targetSisi,
      nama_desa_operator: namaOperator
    });

    const responseMessages = {
      PENOLAKAN: "Pengajuan data perkawinan telah diverifikasi dengan status: Ditolak.",
      PADE_GELAHANG_PARSIAL: `Data perkawinan Pade Gelahang berhasil diverifikasi oleh ${namaOperator}. Menunggu verifikasi persetujuan dari pihak desa pasangan.`,
      PERKAWINAN_LELUHUR: "Data perkawinan leluhur telah diverifikasi penuh dan berhasil dicatat dalam Trah Bali.",
      PERKAWINAN_AKTIF: "Data perkawinan berhasil diverifikasi dengan status: Disetujui (Aktif).",
      PERKAWINAN_PADE_GELAHANG: "Data perkawinan Pade Gelahang telah diverifikasi secara penuh oleh kedua belah pihak desa! Entitas keluarga mandiri resmi diaktifkan.",
      default: "Data perkawinan berhasil diverifikasi dan dicatat!"
    };

    res.status(200).json({
      message: responseMessages[hasilVerifikasi.type] || responseMessages.default,
      data: hasilVerifikasi.data
    });
  } catch (error) {
    res.status(400).json({ 
      message: error.message 
    });
  }
};

export const ceraiPerkawinan = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      return res.status(400).json({
        message: "ID Perkawinan tidak valid!"
      });
    }

    const {
      status_perkawinan,
      tanggal_cerai,
      pihak_meninggal,
      pilihan_predana,
      is_koreksi
    } = req.body;

    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    if (!status_perkawinan || !tanggal_cerai) {
      return res.status(400).json({
        message: "Status perkawinan dan tanggal cerai wajib diisi!"
      });
    }

    // Validasi status perkawinan
    if (!VALID_STATUS_PERKAWINAN.includes(status_perkawinan)) {
      return res.status(400).json({ 
        message: "Status perkawinan tidak valid!" 
      });
    }

    // Validasi khusus untuk pihak meninggal
    if (status_perkawinan === "Cerai Mati") {
      if (!pihak_meninggal) {
        return res.status(400).json({ 
          message: "Pihak meninggal wajib diisi untuk cerai mati!" 
        });
      }
      if (!VALID_PIHAK_MENINGGAL.includes(pihak_meninggal)) {
        return res.status(400).json({ 
          message: "Pihak meninggal tidak valid!" 
        });
      }
    }

    const perkawinanAsal = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinanAsal) {
      return res.status(404).json({
        message: "Data perkawinan tidak ditemukan."
      });
    }

    // Validasi urutan kronologis tanggal kawin dan tanggal cerai
    if (new Date(tanggal_cerai) < new Date(perkawinanAsal.tanggal_perkawinan)) {
      return res.status(400).json({
        message: "Tanggal perceraian tidak boleh lebih lampau dari tanggal perkawinan."
      });
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinanAsal.suami_id),
      KramaBali.findByPk(perkawinanAsal.istri_id)
    ]);

    if (!suami || !istri) {
      return res.status(404).json({
        message: "Data krama suami atau istri tidak ditemukan."
      });
    }

    // Validasi Kedaulatan Desa untuk Input Data
    if (user_role === "Krama" || user_role === "Admin Desa") {
      const jenisKawin = perkawinanAsal.jenis_perkawinan;
      let authorized = false;

      // Kondisi 1: Kawin Biasa atau Poligami (Purusa = Suami)
      if (jenisKawin === "Biasa" || !jenisKawin || jenisKawin === "Tidak Diketahui") {
        authorized = suami.desa_adat_id === user_desa_id;
      }
      // Kondisi 2: Kawin Nyentana (Purusa = Istri)
      else if (jenisKawin === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      }
      // Kondisi 3: Kawin Pade Gelahang (Kedua desa berdaulat)
      else if (jenisKawin === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }

      if (!authorized) {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Hanya desa adat pihak purusa yang berwenang memproses/mengajukan perceraian ini."
        });
      }
    }

    // Menentukan flag eksekusi langsung berdasarkan operator
    const isDirectExecution = (user_role === "Super Admin" || user_role === "Admin Desa") && !is_koreksi;

    const hasilCerai = await prosesPerceraianBali({
      perkawinan_id, 
      status_perkawinan, 
      tanggal_cerai, 
      pihak_meninggal, 
      pilihan_predana,
      is_admin_direct: isDirectExecution,
      user_role,
      user_desa_id
    });

    res.status(200).json({
      message: hasilCerai.is_pending_update 
        ? "Usulan perceraian berhasil diajukan! Menunggu verifikasi Admin Desa." 
        : "Data perceraian berhasil diproses dan struktur silsilah keluarga telah diperbarui secara langsung!",
      data: hasilCerai
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

export const verifikasiPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      return res.status(400).json({ 
        message: "ID Perkawinan tidak valid!" 
      });
    }

    const { 
      status_verifikasi, 
      catatan_admin 
    } = req.body;

    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      return res.status(400).json({
        message: "Status verifikasi tidak valid!"
      });
    }

    if (status_verifikasi === "Ditolak" && (!catatan_admin || catatan_admin.trim() === "")) {
      return res.status(400).json({
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
      });
    }

    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      return res.status(404).json({ 
        message: "Data perkawinan tidak ditemukan." 
      });
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.PERCERAIAN) {
      return res.status(400).json({
        message: "Proses verifikasi dihentikan! Data perkawinan ini tidak memiliki usulan draf perceraian yang aktif dalam antrean."
      });
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      return res.status(404).json({ 
        message: "Data suami atau istri tidak ditemukan." 
      });
    }

    let targetSisi = null;

    // Validasi hak akses ruang lingkup data
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang dapat mengelola dan memverifikasi perceraian ini."
          });
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang dapat mengelola dan memverifikasi perceraian ini."
          });
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Wilayah desa adat Anda tidak terikat dengan kedua belah pihak krama."
          });
        }
        targetSisi = isDesaSuami ? "suami" : "istri";
      }
    } else if (user_role === "Super Admin") {
      targetSisi = "super_admin";
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa 
        ? `Admin Desa ${desa.nama_desa_adat}` 
        : `Admin Desa ID ${user_desa_id}`;
    }

    // Eksekusi Service
    const hasilVerifikasi = await eksekusiVerifikasiPerceraian({
      perkawinan_id,
      status_verifikasi,
      catatan_admin,
      user_role,
      user_desa_id,
      target_sisi: targetSisi,
      nama_desa_operator: namaOperator
    });

    const responseMessages = {
      PENOLAKAN_CERAI: "Pengajuan usulan draf perceraian telah diverifikasi dengan status: Ditolak",
      PERSETUJUAN_CERAI_PARSIAL: `Usulan perceraian Pade Gelahang berhasil disetujui oleh ${namaOperator}. Menunggu verifikasi persetujuan dari pihak desa pasangan agar mutasi silsilah dapat dieksekusi.`,
      PERSETUJUAN_CERAI_PENUH: "Data perceraian krama telah disetujui secara penuh! Struktur silsilah keluarga dan penyesuaian peran adat krama resmi diperbarui.",
      default: "Data perceraian berhasil diverifikasi dan dicatat!"
    };

    res.status(200).json({
      message: responseMessages[hasilVerifikasi.type] || responseMessages.default,
      data: hasilVerifikasi.data
    });
  } catch (error) {
    res.status(400).json({ 
      message: error.message 
    });
  }
};

export const cancelPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      return res.status(400).json({ 
        message: "ID Perkawinan tidak valid!" 
      });
    }

    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Mengambil data perkawinan dan krama untuk validasi otoritas wilayah
    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      return res.status(404).json({
        message: "Data perkawinan tidak ditemukan."
      });
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      return res.status(404).json({
        message: "Data krama suami atau istri tidak ditemukan."
      });
    }

    // Validasi Kedaulatan Desa Adat
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      let authorized = false;

      // Skenario Perkawinan Biasa (pihak suami)
      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        authorized = suami.desa_adat_id === user_desa_id;
      } 
      // Skenario Perkawinan Nyentana (pihak istri)
      else if (jenisPerkawinan === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      } 
      // Skenario Perkawinan Pade Gelahang (keduanya)
      else if (jenisPerkawinan === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }

      if (!authorized) {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Anda tidak memiliki wewenang wilayah desa adat untuk membatalkan perceraian pada data perkawinan ini."
        });
      }
    } else if (user_role !== "Super Admin" && user_role !== "Admin Desa") {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak!"
      });
    }

    let namaOperator = "Super Admin";
    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa 
        ? `Admin Desa ${desa.nama_desa_adat}` 
        : `Admin Desa ID ${user_desa_id}`;
    }

    const result = await batalkanPerceraian({
      perkawinan_id,
      user_role,
      nama_desa_operator: namaOperator
    });

    res.status(200).json({
      message: "Proses pembatalan sukses! Status hubungan krama berhasil dipulihkan.",
      data: result
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

export const deletePerkawinan = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      return res.status(400).json({ 
        message: "ID Perkawinan tidak valid!" 
      });
    }

    const user_role = req.role;
    const user_id = req.userId;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data
    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      return res.status(404).json({ 
        message: "Data perkawinan tidak ditemukan." 
      });
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      return res.status(404).json({ 
        message: "Data krama suami atau istri tidak ditemukan." 
      });
    }

    // Validasi hak akses menghapus data
    const isOwner = perkawinan.user_id === user_id;
    let authorized = isOwner || user_role === "Super Admin";

    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;

      // Skenario Perkawinan Biasa  (pihak suami)
      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        authorized = suami.desa_adat_id === user_desa_id;
      } 
      // Skenario Perkawinan Nyentana (pihak istri)
      else if (jenisPerkawinan === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      } 
      // Skenario Perkawinan Pade Gelahang (keduanya)
      else if (jenisPerkawinan === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }
    }

    if (!authorized) {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak! Wilayah desa adat Anda tidak memiliki wewenang atas data perkawinan ini."
      });
    }

    const hasilHapus = await menghapusPerkawinanDraft(perkawinan_id);

    res.status(200).json({
      message: `Data usulan perkawinan yang berstatus ${hasilHapus.status_terakhir} berhasil dihapus secara permanen dari sistem.`
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};