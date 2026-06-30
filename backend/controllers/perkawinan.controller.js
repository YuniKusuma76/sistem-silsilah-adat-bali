import { Op, where } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  DesaAdat,
  Keluarga,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  User
} from "../models/associations.js";
import { buatPerkawinanBali } from "../services/perkawinan.service.js";
import { integrasiPerkawinanLeluhur } from "../services/perkawinan-leluhur.service.js";
import { prosesPerceraianBali } from "../services/perceraian.service.js";
import { eksekusiVerifikasiPerkawinan } from "../services/verifikasi-perkawinan.service.js";
import { eksekusiVerifikasiPerceraian } from "../services/verifikasi-perceraian.service.js";
import { updateDataPerkawinan } from "../services/update-perkawinan.service.js";
import { verifikasiUpdateDataPerkawinan } from "../services/verifikasi-update-perkawinan.service.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

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
    const { mode, krama_id } = req.query;
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    let whereCondition = {};
    let territorialCondition = [];
    let isVerificationMode = mode === "verification";

    const isEagerLoadingRequired = isVerificationMode && userRole === "Admin Desa";

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
        throw {
          status: 403,
          message: "Otoritas mengakses data ditolak!"
        };
      }
      if (krama_id) {
        whereCondition[Op.and] = [
          {
            [Op.or]: [
              { status_verifikasi: "Draft" },
              { status_verifikasi: "Disetujui" }
            ]
          },
          {
            [Op.or]: [
              { suami_id: krama_id },
              { istri_id: krama_id }
            ]
          }
        ];
      } else {
        whereCondition[Op.or] = [
          { status_verifikasi: "Draft" },
          { status_verifikasi: "Disetujui", is_pending_update: true }
        ];
      }
      if (userRole === "Admin Desa") {
        territorialCondition = [
          { "$suami.desa_adat_id$": userDesaId },
          { "$istri.desa_adat_id$": userDesaId }
        ];
      }
    }

    const finalWhere = territorialCondition.length > 0
      ? { [Op.and]: [whereCondition, { [Op.or]: territorialCondition }] }
      : whereCondition;

    const PERKAWINAN_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "suami",
        required: isEagerLoadingRequired || mode === "public",
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },
      {
        model: KramaBali,
        as: "istri",
        required: isEagerLoadingRequired || mode === "public",
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },
      {
        model: User,
        as: "pembuat_perkawinan",
        attributes: ["id", "full_name", "email", "role"]
      }
    ];

    const perkawinanList = await Perkawinan.findAll({
      where: finalWhere,
      include: PERKAWINAN_INCLUDE_KHUSUS,
      order: [["id", "DESC"]]
    });

    // Mapping Data Keluarga Aktif
    const kepalaKeluargaIds = [];

    perkawinanList.forEach((item) => {
      if (item.jenis_perkawinan === "Pade Gelahang") {
        if (item.suami_id) {
          kepalaKeluargaIds.push(item.suami_id);
        }
        if (item.istri_id) {
          kepalaKeluargaIds.push(item.istri_id);
        }
      } else {
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
          kepala_keluarga_id: { [Op.in]: [...new Set(kepalaKeluargaIds)] }, 
          status_keluarga: "Aktif"
        }
      });
      keluargaTerbaca.forEach(k => {mapKeluargaAktif.set(k.kepala_keluarga_id, k);});
    }

    // Pemetaan data keluarga sebagai struktur data response akhir
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

    return res.status(200).json({
      message: "Berhasil mengambil data perkawinan!",
      count: datakawin.length,
      data: datakawin
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat mengambil data perkawinan."
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
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id", "user_id"]
      },
      {
        model: KramaBali,
        as: "istri",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id", "user_id"]
      },
      {
        model: User,
        as: "pembuat_perkawinan",
        attributes: ["id", "full_name", "email", "role"]
      }
    ];

    const dataKawin = await Perkawinan.findByPk(id, {
      include: PERKAWINAN_INCLUDE_KHUSUS
    });

    if (!dataKawin) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    const data = dataKawin.get({ clone: true });

    // Validasi Otoritas Hak Akses Data
    const isDraft = data.status_verifikasi === "Draft" || data.status_verifikasi === "Ditolak";
    const isPending = data.is_pending_update === true;

    if (isDraft || isPending) {
      const isOwner = data.user_id === req.userId || data.suami?.user_id === req.userId || data.istri?.user_id === req.userId;
      const isSuperAdmin = req.role === "Super Admin";
      const isAdminDesaLokal = req.role === "Admin Desa" && (data.suami?.desa_adat_id === req.desaAdatId || data.istri?.desa_adat_id === req.desaAdatId);

      if (!isOwner && !isAdminDesaLokal && !isSuperAdmin) {
        throw {
          status: 403,
          message: "Otoritas mengakses data ditolak!"
        };
      }
    }

    // Mapping Keluarga Aktif
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
        const purusaId = data.jenis_perkawinan === "Nyentana" ? data.istri_id : data.suami_id;
        data.keluarga_baru = purusaId ? await Keluarga.findOne({ 
          where: { 
            kepala_keluarga_id: purusaId, 
            status_keluarga: "Aktif" 
          } 
        }): null;
      }
    } else {
      if (data.jenis_perkawinan === "Pade Gelahang") {
        data.keluarga_suami = null;
        data.keluarga_istri = null;
      } else {
        data.keluarga_baru = null;
      }
    }

    return res.status(200).json({
      message: "Berhasil mengambil data detail perkawinan!",
      data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat mengambil detail data perkawinan."
    });
  }
};

export const createPerkawinan = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses jika digunakan pada Jalur Leluhur
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
      throw { 
        status: 404, 
        message: "Data suami atau istri tidak ditemukan." 
      };
    }

    const isLeluhurPath = suami.tipe_data === "Leluhur" || istri.tipe_data === "Leluhur";

    // VALIDASI KEDAULATAN DESA ADAT UNTUK INPUT DATA
    if (!isLeluhurPath && (user_role === "Krama" || user_role === "Admin Desa")) {
      // Kondisi A: Perkawinan Biasa atau Poligami (Purusa = Suami)
      if (jenis_perkawinan === "Biasa") {
        if (suami.desa_adat_id !== user_desa_id) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang boleh mendaftarkan perkawinan ini." 
          };
        }
      }
      // Kondisi B: Perkawinan Nyentana (Purusa = Istri)
      if (jenis_perkawinan === "Nyentana") {
        if (istri.desa_adat_id !== user_desa_id) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang boleh mendaftarkan perkawinan ini." 
          };
        }
      }
      // Kondisi C: Perkawinan Pade Gelahang (Kedua desa berdaulat)
      if (jenis_perkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id !== user_desa_id && istri.desa_adat_id !== user_desa_id) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya salah satu desa adat pasangan yang boleh mendaftarkan perkawinan ini." 
          };
        }
      }
    }

    let finalData;

    // ============================================================
    // CASE 1: JALUR INTEGRASI PERKAWINAN LELUHUR
    // ============================================================
    if (isLeluhurPath) {
      let namaDesaAdat = null;

      if (user_role === "Admin Desa" && user_desa_id) {
        const desaAdat = await DesaAdat.findByPk(user_desa_id);
        if (desaAdat) {
          namaDesaAdat = desaAdat.nama_desa_adat;
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
        nama_desa_operator: namaDesaAdat
      }, t);

      await t.commit();
      t = null; 
      finalData = resultLeluhur;
    }

    // ============================================================
    // CASE 2: JALUR INTEGRASI PERKAWINAN KETURUNAN
    // ============================================================
    else {
      if (!VALID_JENIS_PERKAWINAN.includes(jenis_perkawinan)) {
        throw { 
          status: 400, 
          message: "Jenis perkawinan tidak valid!" 
        };
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

    const isDraft = finalData?.perkawinan?.status_verifikasi === "Draft";

    try {
      if (!isDraft) {
        await kirimNotifikasiSistem(req, {
          judul: "Pendaftaran Perkawinan",
          deskripsi: `Perkawinan baru antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah didaftarkan dan diverifikasi otomatis oleh sistem (Input by ${user_role}).`,
          kategori: "LOG_SISTEM",
          tautan_fitur: "/krama-bali",
          desa_adat_id: user_desa_id || suami.desa_adat_id || istri.desa_adat_id,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: null
        }, null);
      } else {
        let targetDesaNotif = user_desa_id || suami.desa_adat_id;

        if (jenis_perkawinan === "Pade Gelahang") {
          targetDesaNotif = suami.desa_adat_id === user_desa_id ? (istri.desa_adat_id || user_desa_id) : suami.desa_adat_id;
        } else {
          targetDesaNotif = istri.desa_adat_id || user_desa_id || suami.desa_adat_id;
        }

        await kirimNotifikasiSistem(req, {
          judul: "Antrean Data Perkawinan",
          deskripsi: `Adanya pendaftaran perkawinan baru antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} oleh ${user_role}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
          kategori: "VERIFIKASI",
          tautan_fitur: "/verifikasi-data/perkawinan",
          desa_adat_id: targetDesaNotif,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: null
        }, null);
      }
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas:", error.message);
    }

    return res.status(201).json({
      message: isDraft
        ? "Data perkawinan berhasil diajukan! Menunggu verifikasi dari Admin Desa."
        : "Data perkawinan berhasil disimpan dan disetujui oleh sistem!",
      data: finalData
    });
  } catch (error) {
    if (t) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membuat data perkawinan."
    });
  }
};

export const verifikasiPerkawinan = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const { 
      status_verifikasi, 
      catatan_admin
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      throw { 
        status: 400, 
        message: "Status verifikasi tidak valid!" 
      };
    }

    if (status_verifikasi === "Ditolak" && (!catatan_admin || catatan_admin.trim() === "")) {
      throw { 
        status: 400, 
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!" 
      };
    }

    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan || perkawinan.status_verifikasi !== "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ini tidak berada dalam antrean pengajuan data." 
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data krama suami atau istri tidak ditemukan." 
      };
    }

    let targetSisi = null;

    // Validasi hak akses ruang lingkup data
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang dapat mendaftarkan/mengelola data verifikasi ini." 
          };
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang dapat mendaftarkan/mengelola data verifikasi ini." 
          };
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat Anda tidak terikat dengan kedua mempelai." 
          };
        }
        targetSisi = isDesaSuami ? "suami" : "istri";
      }
    } else if (user_role === "Super Admin") {
      targetSisi = "super_admin";
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    // Eksekusi Service Verifikasi
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

    try {
      let deskripsiNotif = "";

      if (status_verifikasi === "Ditolak") {
        deskripsiNotif = `Pengajuan pendaftaran perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah ditolak oleh ${user_role}.`;
      } else if (hasilVerifikasi.type === "PADE_GELAHANG_PARSIAL") {
        deskripsiNotif = `Pendaftaran perkawinan Pade Gelahang antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} disetujui oleh ${namaOperator}. Menunggu verifikasi dari Admin Desa Pasangan.`;
      } else {
        deskripsiNotif = `Pengajuan pendaftaran perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah disetujui dan disahkan ke dalam silsilah oleh ${user_role}.`;
      }

      await kirimNotifikasiSistem(req, {
        judul: "Hasil Verifikasi Perkawinan",
        deskripsi: deskripsiNotif,
        kategori: status_verifikasi === "Ditolak" ? "PERINGATAN" : "LOG_SISTEM",
        tautan_fitur: "/krama-bali/my-data",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id 
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas verifikasi:", error.message);
    }

    return res.status(200).json({
      message: responseMessages[hasilVerifikasi.type] || responseMessages.default,
      data: hasilVerifikasi.data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kesalahan pada server saat memverifikasi data perkawinan."
    });
  }
};

export const createPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const {
      status_perkawinan,
      tanggal_cerai,
      pihak_meninggal,
      pilihan_predana
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi status perkawinan
    if (!status_perkawinan) {
      throw { 
        status: 400, 
        message: "Status perkawinan wajib diisi!" 
      };
    }

    if (!VALID_STATUS_PERKAWINAN.includes(status_perkawinan)) {
      throw { 
        status: 400, 
        message: "Status perkawinan tidak valid!" 
      };
    }

    // Validasi kondisional untuk skenario cerai mati
    if (status_perkawinan === "Cerai Mati") {
      if (!pihak_meninggal) {
        throw { 
          status: 400, 
          message: "Pihak yang meninggal wajib ditentukan untuk status cerai mati!" 
        };
      }
      if (!VALID_PIHAK_MENINGGAL.includes(pihak_meninggal)) {
        throw { 
          status: 400, 
          message: "Pilihan pihak meninggal tidak valid!" 
        };
      }
    }

    const perkawinanAsal = await Perkawinan.findByPk(perkawinan_id);

    if (!perkawinanAsal) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    if (perkawinanAsal.status_perkawinan !== "Kawin") {
      throw {
        status: 400,
        message: "Proses perceraian ditolak! Perkawinan ini sudah berada dalam status cerai."
      };
    }

    // Validasi urutan linimasa untuk tanggal kawin dan tanggal cerai
    const finalTanggalCerai = tanggal_cerai || new Date().toISOString().split('T')[0];

    if (new Date(finalTanggalCerai) < new Date(perkawinanAsal.tanggal_perkawinan)) {
      throw { 
        status: 400, 
        message: "Tanggal perceraian tidak boleh lebih lampau dari tanggal perkawinan!" 
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinanAsal.suami_id),
      KramaBali.findByPk(perkawinanAsal.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data suami atau istri dari perkawinan ini tidak ditemukan." 
      };
    }

    // VALIDASI KEDAULATAN DESA ADAT UNTUK INPUT DATA
    if (user_role === "Krama" || user_role === "Admin Desa") {
      const jenisKawin = perkawinanAsal.jenis_perkawinan;
      let authorized = false;

      // Kondisi A: Perkawinan Biasa atau Poligami (Purusa = Suami)
      if (jenisKawin === "Biasa" || !jenisKawin || jenisKawin === "Tidak Diketahui") {
        authorized = suami.desa_adat_id === user_desa_id;
      }
      // Kondisi B: Perkawinan Nyentana (Purusa = Istri)
      else if (jenisKawin === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      }
      // Kondisi C: Perkawinan Pade Gelahang (Kedua desa berdaulat)
      else if (jenisKawin === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }

      if (!authorized) {
        throw { 
          status: 403, 
          message: "Otoritas untuk mengelola data perceraian perkawinan ini ditolak!" 
        };
      }
    }

    const hasilCerai = await prosesPerceraianBali({
      perkawinan_id, 
      status_perkawinan, 
      tanggal_cerai: finalTanggalCerai, 
      pihak_meninggal, 
      pilihan_predana,
      user_id,
      user_role,
      user_desa_id
    });

    const isDraftCerai = hasilCerai.is_pending_update;

    try {
      const jenisMutasiText = status_perkawinan === "Cerai Mati" ? "Perceraian (Cerai Mati)" : "Perceraian (Cerai Hidup)";
      if (!isDraftCerai) {
        await kirimNotifikasiSistem(req, {
          judul: "Pendaftaran Perceraian",
          deskripsi: `Perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah didaftarkan dan diverifikasi otomatis oleh sistem (Input by ${user_role}).`,
          kategori: "LOG_SISTEM",
          tautan_fitur: "/krama-bali",
          desa_adat_id: user_desa_id || suami.desa_adat_id,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: null
        }, null);
      } else {
        await kirimNotifikasiSistem(req, {
          judul: `Antrean Usulan ${jenisMutasiText}`,
          deskripsi: `Adanya usulan ${status_perkawinan.toLowerCase()} antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} oleh ${user_role}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
          kategori: "VERIFIKASI",
          tautan_fitur: "/verifikasi-data/perkawinan",
          desa_adat_id: perkawinanAsal.jenis_perkawinan === "Pade Gelahang" && user_role === "Admin Desa"
            ? (suami.desa_adat_id === user_desa_id ? istri.desa_adat_id : suami.desa_adat_id)
            : (perkawinanAsal.jenis_perkawinan === "Nyentana" ? istri.desa_adat_id : suami.desa_adat_id),
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: null
        }, null);
      }
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas perceraian:", error.message);
    }

    return res.status(200).json({
      message: isDraftCerai
        ? "Usulan perceraian berhasil diajukan! Menunggu verifikasi dari Admin Desa." 
        : "Data perceraian berhasil diproses dan struktur silsilah keluarga telah diperbarui secara langsung!",
      data: hasilCerai.data_perkawinan || hasilCerai
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membuat data perceraian."
    });
  }
};

export const verifikasiPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const { 
      status_verifikasi, 
      catatan_admin 
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      throw {
        status: 400,
        message: "Status verifikasi tidak valid!"
      };
    }

    if (status_verifikasi === "Ditolak" && (!catatan_admin || catatan_admin.trim() === "")) {
      throw {
        status: 400,
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
      };
    }

    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.PERCERAIAN) {
      throw {
        status: 400,
        message: "Proses verifikasi dihentikan! Data perkawinan ini tidak memiliki usulan draf perceraian yang aktif dalam antrean."
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data suami atau istri tidak ditemukan." 
      };
    }

    let targetSisi = null;

    // Validasi hak akses ruang lingkup data
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          throw {
            status: 403,
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang dapat mengelola dan memverifikasi perceraian ini."
          };
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          throw {
            status: 403,
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang dapat mengelola dan memverifikasi perceraian ini."
          };
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          throw {
            status: 403,
            message: "Otoritas mengakses data ditolak! Wilayah desa adat Anda tidak terikat dengan kedua belah pihak krama."
          };
        }
        targetSisi = isDesaSuami ? "suami" : "istri";
      }
    } else if (user_role === "Super Admin") {
      targetSisi = "super_admin";
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ID ${user_desa_id}`;
    }

    // Eksekusi Service
    const hasilVerifikasi = await eksekusiVerifikasiPerceraian({
      perkawinan_id,
      status_verifikasi,
      catatan_admin,
      user_id,
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

    try {
      let deskripsiNotif = "";

      if (status_verifikasi === "Ditolak") {
        deskripsiNotif = `Pengajuan draft perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah ditolak oleh ${user_role}.`;
      } else if (hasilVerifikasi.type === "PERSETUJUAN_CERAI_PARSIAL") {
        deskripsiNotif = `Usulan perceraian Pade Gelahang antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} disetujui oleh ${namaOperator}. Menunggu verifikasi dari Admin Desa Pasangan.`;
      } else {
        deskripsiNotif = `Pengajuan usulan perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah disetujui dan disahkan oleh ${user_role}.`;
      }

      await kirimNotifikasiSistem(req, {
        judul: "Hasil Verifikasi Perceraian",
        deskripsi: deskripsiNotif,
        kategori: status_verifikasi === "Ditolak" ? "PERINGATAN" : "LOG_SISTEM",
        tautan_fitur: "/krama-bali/my-data",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id 
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas verifikasi perceraian:", error.message);
    }

    return res.status(200).json({
      message: responseMessages[hasilVerifikasi.type] || responseMessages.default,
      data: hasilVerifikasi.data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kesalahan pada server saat memverifikasi data perceraian."
    });
  }
};

export const cancelPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Mengambil data perkawinan dan krama untuk validasi otoritas wilayah
    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.PERCERAIAN) {
      throw {
        status: 400,
        message: "Proses pembatalan dihentikan! Data perkawinan ini tidak memiliki usulan draf perceraian aktif yang bisa dibatalkan."
      };
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw {
        status: 404,
        message: "Data krama suami atau istri tidak ditemukan."
      };
    }

    // Validasi Kedaulatan Wilayah Desa Adat
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      let authorized = false;
      // Skenario 1: Perkawinan Biasa (Purusa = Suami)
      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        authorized = suami.desa_adat_id === user_desa_id;
      } 
      // Skenario 2: Perkawinan Nyentana (Purusa = Istri)
      else if (jenisPerkawinan === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      } 
      // Skenario 3: Perkawinan Pade Gelahang (Kedua desa berwenang)
      else if (jenisPerkawinan === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }
      if (!authorized) {
        throw {
          status: 403,
          message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
        };
      }
    } else if (user_role !== "Super Admin") {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak!"
      };
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ID ${user_desa_id}`;
    }

    // Membersihkan draft perubahan data
    const existingChanges = perkawinan.data_perubahan || {};
    const { PERCERAIAN, ...restChanges } = existingChanges;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    newCatatanAdmin.status_verifikasi_perceraian = `Usulan draft perceraian telah dibatalkan dan ditarik dari antrean oleh ${user_role}.`;
    newCatatanAdmin.tanggal_pembatalan = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = namaOperator;

    const perkawinanPulih = await perkawinan.update({
      is_pending_update: false,
      status_sebelum_draft: null,
      data_perubahan: Object.keys(restChanges).length > 0 ? restChanges : null,
      catatan_admin_desa: newCatatanAdmin
    });

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Pembatalan Draft Perceraian",
        deskripsi: `Draft usulan perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah dibatalkan dan ditarik dari antrean oleh ${namaOperator}.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id 
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas pembatalan cerai:", error.message);
    }

    return res.status(200).json({
      message: "Proses pembatalan sukses! Draft usulan perceraian berhasil dibersihkan dari antrean.",
      data: perkawinanPulih
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draf perceraian."
    });
  }
};

export const deletePerkawinan = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_role = req.role;
    const user_id = req.userId;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    // Validasi status verifikasi
    const statusTerakhir = perkawinan.status_verifikasi;
    if (statusTerakhir !== "Draft" && statusTerakhir !== "Ditolak") {
      throw {
        status: 400,
        message: `Proses menghapus data ditolak! Data perkawinan ini sudah berstatus '${statusTerakhir}' dan telah terikat dalam silsilah aktif.`
      };
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data krama suami atau istri tidak ditemukan." 
      };
    }

    // Validasi Otoritas Hak Menghapus Data
    const isOwner = perkawinan.user_id === user_id;
    let authorized = isOwner || user_role === "Super Admin";

    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      // Skenario 1: Perkawinan Biasa (Purusa = Pihak Suami)
      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        authorized = suami.desa_adat_id === user_desa_id;
      } 
      // Skenario 2: Perkawinan Nyentana (Purusa = Pihak Istri)
      else if (jenisPerkawinan === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      } 
      // Skenario 3: Perkawinan Pade Gelahang (Kedua desa memiliki wewenang)
      else if (jenisPerkawinan === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }
    }

    if (!authorized) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
      };
    }

    await perkawinan.destroy();

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Penghapusan Data Perkawinan",
        deskripsi: `Data pendaftaran perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} yang berstatus [${statusTerakhir}] resmi dihapus permanen oleh ${user_role}.`,
        kategori: "PERINGATAN",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas hapus draft:", error.message);
    }

    return res.status(200).json({
      message: `Data pendaftaran perkawinan yang berstatus '${statusTerakhir}' berhasil dihapus secara permanen dari sistem.`
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat menghapus draft perkawinan."
    });
  }
};

export const updatePerkawinanById = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      tipe_update,
      suami_id,
      istri_id,
      jenis_perkawinan,
      tanggal_event,
      status_perkawinan,
      pihak_meninggal,
      pilihan_predana,
      catatan_update
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    if (!tipe_update) {
      throw { 
        status: 400, 
        message: "Tipe update wajib ditentukan!" 
      };
    }

    // Validasi ketersediaan data perkawinan
    const perkawinanLama = await Perkawinan.findByPk(id);
    if (!perkawinanLama) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    const targetSuamiId = suami_id || perkawinanLama.suami_id;
    const targetIstriId = istri_id || perkawinanLama.istri_id;

    if (targetSuamiId === targetIstriId) {
      throw {
        status: 400,
        message: "Proses memperbarui dibatalkan! Identitas suami dan istri tidak boleh krama yang sama."
      };
    }

    const resultUpdate = await updateDataPerkawinan({
      perkawinan_id: id,
      tipe_update,
      suami_id,
      istri_id,
      jenis_perkawinan,
      tanggal_event,
      status_perkawinan,
      pihak_meninggal,
      pilihan_predana,
      catatan_update,
      user_id,
      user_role,
      user_desa_id
    });

    const isAutoApproved = resultUpdate.type === "AUTO_APPROVED_SUKSES";
    const labelTipe = tipe_update.toLowerCase();

    try {
      if (isAutoApproved) {
        const dataPerkawinanTerbaru = resultUpdate.data?.perkawinan || resultUpdate.data;

        const [suamiBaru, istriBaru] = await Promise.all([
          KramaBali.findByPk(dataPerkawinanTerbaru.suami_id),
          KramaBali.findByPk(dataPerkawinanTerbaru.istri_id)
        ]);

        await kirimNotifikasiSistem(req, {
          judul: `Update Data ${tipe_update}`,
          deskripsi: `Data ${labelTipe} antara ${suamiBaru?.nama_lengkap} dan ${istriBaru?.nama_lengkap} telah berhasil diperbarui langsung oleh ${user_role}.`,
          kategori: "LOG_SISTEM",
          tautan_fitur: "/krama-bali",
          desa_adat_id: user_desa_id || suamiBaru?.desa_adat_id,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: perkawinanLama.user_id
        }, null);
      } else {
        const [suamiTarget, istriTarget] = await Promise.all([
          KramaBali.findByPk(targetSuamiId),
          KramaBali.findByPk(targetIstriId)
        ]);

        const jenisPerkawinanTarget = jenis_perkawinan || perkawinanLama.jenis_perkawinan;
        let desaTujuanNotifikasi = suamiTarget?.desa_adat_id;

        if (jenisPerkawinanTarget === "Pade Gelahang") {
          desaTujuanNotifikasi = parseInt(suamiTarget?.desa_adat_id) === parseInt(user_desa_id)
            ? istriTarget?.desa_adat_id
            : suamiTarget?.desa_adat_id;
        } else if (jenisPerkawinanTarget === "Nyentana") {
          desaTujuanNotifikasi = istriTarget?.desa_adat_id;
        }

        await kirimNotifikasiSistem(req, {
          judul: `Usulan Perubahan ${tipe_update}`,
          deskripsi: `Adanya pengajuan draft perubahan data ${labelTipe} antara ${suamiTarget?.nama_lengkap} dan ${istriTarget?.nama_lengkap} oleh ${user_role}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
          kategori: "VERIFIKASI",
          tautan_fitur: "/verifikasi-data/perkawinan",
          desa_adat_id: desaTujuanNotifikasi,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: null
        }, null);
      }
    } catch (notifError) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas update:", notifError.message);
    }
    
    return res.status(200).json({
      message: isAutoApproved
        ? `Perubahan data ${labelTipe} berhasil diterapkan dan disetujui langsung oleh sistem!`
        : `Usulan perubahan data ${labelTipe} berhasil disimpan! Menunggu verifikasi dari Admin Desa Bersangkutan.`,
      data: resultUpdate.data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat memperbarui data perkawinan/perceraian."
    });
  }
};

export const verifikasiUpdatePerkawinan = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      tipe_update,
      status_verifikasi,
      catatan_admin
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      throw { 
        status: 400, 
        message: "Status verifikasi tidak valid!" 
      };
    }

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(id);
    if (!perkawinan) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data krama pasangan tidak ditemukan." 
      };
    }

    // OTORITAS KEADULATAN DESA ADAT
    let targetSisi = "super_admin";

    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          throw { 
            status: 403, 
            message: "Proses verifikasi dihentikan! Otoritas mengesahkan perubahan data hanya milik desa adat pihak suami." };
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          throw { 
            status: 403, 
            message: "Proses verifikasi dihentikan! Otoritas mengesahkan perubahan data hanya milik desa adat pihak istri." };
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          throw { 
            status: 403,
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          };
        }
        targetSisi = isDesaSuami ? "suami" : "istri";
      }
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ID ${user_desa_id}`;
    }

    const resultVerifikasi = await verifikasiUpdateDataPerkawinan({
      perkawinan_id: id,
      tipe_update,
      status_verifikasi,
      catatan_admin,
      user_id,
      user_role,
      user_desa_id,
      target_sisi: targetSisi,
      nama_desa_operator: namaOperator
    });

    try {
      let judulNotif = `Verifikasi Perubahan ${tipe_update}`;
      let deskripsiNotif = "";

      if (status_verifikasi === "Ditolak") {
        deskripsiNotif = `Usulan draft perubahan data ${tipe_update.toLowerCase()} antara ${suami?.nama_lengkap} dan ${istri?.nama_lengkap} ditolak oleh ${user_role}.`;
      } else if (resultVerifikasi.type === "PERSETUJUAN_UPDATE_PENUH") {
        deskripsiNotif = `Usulan draft perubahan data ${tipe_update.toLowerCase()} antara ${suami?.nama_lengkap} dan ${istri?.nama_lengkap} telah disetujui dan disahkan oleh ${user_role}.`;
      } else {
        deskripsiNotif = `Usulan draft perubahan data ${tipe_update.toLowerCase()} telah disetujui secara parsial oleh ${namaOperator}. Menunggu verifikasi dari Admin Desa Pasangannya.`;
      }

      await kirimNotifikasiSistem(req, {
        judul: judulNotif,
        deskripsi: deskripsiNotif,
        kategori: status_verifikasi === "Ditolak" ? "PERINGATAN" : "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami?.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id
      }, null);
    } catch (notifError) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas verifikasi update:", notifError.message);
    }

    return res.status(200).json({
      message: status_verifikasi === "Ditolak"
        ? `Usulan perubahan data ${tipe_update.toLowerCase()} berhasil ditolak.`
        : (resultVerifikasi.type === "PERSETUJUAN_UPDATE_PENUH" 
            ? `Verifikasi selesai. Perubahan data ${tipe_update.toLowerCase()} resmi disahkan ke dalam silsilah!` 
            : `Persetujuan parsial berhasil direkam. Menunggu verifikasi dari Admin Desa Pasangan.`),
      data: resultVerifikasi.data
    });

  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat melakukan verifikasi koreksi data."
    });
  }
};

export const cancelUpdatePerkawinanById = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.UPDATE_PERKAWINAN) {
      throw {
        status: 400,
        message: "Proses pembatalan dihentikan! Data perkawinan ini tidak memiliki usulan draft perubahan data perkawinan aktif."
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id, { 
        transaction: t 
      }),
      KramaBali.findByPk(perkawinan.istri_id, { 
        transaction: t 
      })
    ]);

    if (!suami || !istri) {
      throw {
        status: 404,
        message: "Data krama suami atau istri tidak ditemukan."
      };
    }

    // Validasi Otoritas Hak Akses Membatalkan Perubahan Data
    let isHakAkses = false;

    if (user_role === "Super Admin") {
      isHakAkses = true;
    } else if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      if (jenisPerkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else if (jenisPerkawinan === "Nyentana") {
        if (istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else {
        if (suami.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      }
    } else {
      if (perkawinan.user_id === user_id) {
        isHakAkses = true;
      }
    }

    if (!isHakAkses) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak akses untuk membatalkan draft perubahan di wilayah desa adat ini."
      };
    }

    let namaOperator = user_role;

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id, { 
        transaction: t 
      });
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    const existingChanges = perkawinan.data_perubahan || {};
    const { UPDATE_PERKAWINAN, ...restChanges } = existingChanges;
    const isOtherDraft = Object.keys(restChanges).length > 0;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    newCatatanAdmin.status_verifikasi_update = `Usulan draft perubahan data perkawinan telah dibatalkan dan ditarik dari antrean oleh ${user_role}.`;
    newCatatanAdmin.tanggal_pembatalan_update = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = namaOperator;

    const perkawinanPulih = await perkawinan.update({
      is_pending_update: isOtherDraft,
      status_verifikasi: isOtherDraft 
        ? perkawinan.status_verifikasi 
        : (perkawinan.status_sebelum_draft || perkawinan.status_verifikasi),
      status_sebelum_draft: isOtherDraft ? perkawinan.status_sebelum_draft : null,
      data_perubahan: isOtherDraft ? restChanges : null,
      catatan_admin_desa: newCatatanAdmin
    }, { transaction: t });

    await t.commit();

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Pembatalan Draft Perubahan Perkawinan",
        deskripsi: `Draft usulan perubahan data perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah dibatalkan dan ditarik dari antrean oleh ${namaOperator}.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id 
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas pembatalan update perkawinan:", error.message);
    }
    
    return res.status(200).json({
      message: "Proses pembatalan berhasil! Draft usulan perubahan data perkawinan berhasil dibersihkan dari antrean.",
      data: perkawinanPulih
    });
  } catch (error) {
    await t.rollback();
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draf data perkawinan."
    });
  }
};

export const cancelUpdatePerceraianById = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.UPDATE_PERCERAIAN) {
      throw {
        status: 400,
        message: "Proses pembatalan dihentikan! Data perkawinan ini tidak memiliki usulan draft perubahan data perceraian aktif."
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id, { 
        transaction: t 
      }),
      KramaBali.findByPk(perkawinan.istri_id, { 
        transaction: t 
      })
    ]);

    if (!suami || !istri) {
      throw {
        status: 404,
        message: "Data krama suami atau istri tidak ditemukan."
      };
    }

    // Validasi Otoritas Hak Akses Membatalkan Perubahan Data
    let isHakAkses = false;

    if (user_role === "Super Admin") {
      isHakAkses = true;
    } else if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      if (jenisPerkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else if (jenisPerkawinan === "Nyentana") {
        if (istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else {
        if (suami.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      }
    } else {
      if (perkawinan.user_id === user_id) {
        isHakAkses = true;
      }
    }

    if (!isHakAkses) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak akses untuk membatalkan draft perubahan di wilayah desa adat ini."
      };
    }

    let namaOperator = user_role;

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id, { 
        transaction: t 
      });
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    const existingChanges = perkawinan.data_perubahan || {};
    const { UPDATE_PERCERAIAN, ...restChanges } = existingChanges;
    const isOtherDraft = Object.keys(restChanges).length > 0;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    newCatatanAdmin.status_verifikasi_update = `Usulan draft perubahan data perceraian telah dibatalkan dan ditarik dari antrean oleh ${user_role}.`;
    newCatatanAdmin.tanggal_pembatalan_update = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = namaOperator;

    const perkawinanPulih = await perkawinan.update({
      is_pending_update: isOtherDraft,
      status_verifikasi: isOtherDraft 
        ? perkawinan.status_verifikasi 
        : (perkawinan.status_sebelum_draft || perkawinan.status_verifikasi),
      status_sebelum_draft: isOtherDraft ? perkawinan.status_sebelum_draft : null,
      data_perubahan: isOtherDraft ? restChanges : null,
      catatan_admin_desa: newCatatanAdmin
    }, { transaction: t });

    await t.commit();

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Pembatalan Draft Perubahan Perceraian",
        deskripsi: `Draft usulan perubahan data perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah dibatalkan dan ditarik dari antrean oleh ${namaOperator}.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id 
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas pembatalan update perceraian:", error.message);
    }

    return res.status(200).json({
      message: "Proses pembatalan berhasil! Draft usulan perubahan data perceraian berhasil dibersihkan dari antrean.",
      data: perkawinanPulih
    });
  } catch (error) {
    await t.rollback();
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draf data perkawinan."
    });
  }
};