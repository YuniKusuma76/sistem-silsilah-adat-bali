import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  KramaBali,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  User
} from "../models/associations.js";
import { 
  buatAnakAngkat, 
  updateAnakAngkat 
} from "../services/anak-angkat.service.js";
import { 
  buatAnakKandung, 
  updateAnakKandung 
} from "../services/anak-kandung.service.js";
import { 
  anakAngkatPasangan,
  updateAnakAngkatPasangan 
} from "../services/anak-angkat-perkawinan.service.js";
import { integrasiRelasiLeluhur } from "../services/relasi-leluhur.service.js";
import { bersihkanDampakRelasi } from "../helpers/relasi-bersih.helper.js";
import { hitungUrutanLahir } from "../services/urutan-lahir.service.js";

// Validasi Input Valid
const VALID_STATUS_HUBUNGAN = [
  "Anak Kandung", 
  "Anak Angkat"
];

const VALID_STATUS_VERIFIKASI = [
  "Draft",
  "Disetujui",
  "Ditolak"
];

// Data Relasi Include
const RELASI_INCLUDE = [
  {
    model: KramaBali,
    as: "anak",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
  },{
    model: User,
    as: "pembuat_relasi",
    attributes: ["id", "full_name", "email", "role"]
  },{
    model: KramaBali,
    as: "ayah",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
  },{
    model: KramaBali,
    as: "ibu",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
  }
];

export const getAllRelasiKrama = async (req, res) => {
  try {
    const {
      mode,
      ayah_id,
      ibu_id,
      anak_id
    } = req.query;

    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    let whereCondition = {};
    let territorialCondition = null;

    // Logika filter relasi berdasarkan parameter silsilah
    if (ayah_id && ayah_id !== "undefined" && ayah_id !== "null") {
      whereCondition.ayah_id = ayah_id;
    }
    if (ibu_id && ibu_id !== "undefined" && ibu_id !== "null") {
      whereCondition.ibu_id = ibu_id;
    }
    if (anak_id && anak_id !== "undefined" && anak_id !== "null") {
      whereCondition.anak_id = anak_id;
    }

    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";

    // ============================================================
    // LOGIKA FILTERING BERDASARKAN MODE 
    // ============================================================
    
    // Kondisi 1: Mengambil data dengan status draft
    if (mode === "verification") {
      if (!isAdmin) {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak!"
        });
      }
      whereCondition[Op.or] = [
        { status_verifikasi: "Draft" },
        { status_verifikasi: "Disetujui", is_pending_update: true }
      ];
      if (userRole === "Admin Desa") {
        territorialCondition = { "$anak.desa_adat_id$": userDesaId };
      }
    }
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (mode === "personal") {
      whereCondition.user_id = currentUserId;
    }
    // Kondisi 3: Mengambil semua data orang lain yang telah disetujui
    else {
      whereCondition.status_verifikasi = "Disetujui";
    }

    // Menggabungkan filter jika diakses Admin Desa saat verifikasi
    const finalWhere = territorialCondition 
      ? { [Op.and]: [whereCondition, territorialCondition] }
      : whereCondition;

    const RELASI_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "anak",
        required: true,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: User,
        as: "pembuat_relasi",
        required: false,
        attributes: ["id", "full_name", "email", "role"]
      },{
        model: KramaBali,
        as: "ayah",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: KramaBali,
        as: "ibu",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      }
    ];

    const relasiList = await RelasiKrama.findAll({
      where: finalWhere,
      include: RELASI_INCLUDE_KHUSUS,
      order: [
        ["urutan_lahir", "ASC"],
        ["id", "ASC"]
      ]
    });
    
    return res.status(200).json({
      message: "Berhasil mengambil data relasi krama!",
      count: relasiList.length,
      data: relasiList
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getRelasiKramaById = async (req, res) => {
  try {
    const { id } = req.params;

    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    const RELASI_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "anak",
        required: true,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: User,
        as: "pembuat_relasi",
        required: false,
        attributes: ["id", "full_name", "email", "role"]
      },{
        model: KramaBali,
        as: "ayah",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: KramaBali,
        as: "ibu",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      }
    ];

    const dataRelasi = await RelasiKrama.findByPk(id, {
      include: RELASI_INCLUDE_KHUSUS
    });

    if (!dataRelasi) {
      return res.status(404).json({
        message: "Data relasi krama tidak ditemukan."
      });
    }

    // ============================================================
    // LOGIKA PROTEKSI HAK AKSES DATA (SENSITIVITY CHECK)
    // ============================================================
    const isOwner = dataRelasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";
    const isAdminDesaSewilayah = userRole === "Admin Desa" && String(dataRelasi.anak?.desa_adat_id) === String(userDesaId);

    if (dataRelasi.status_verifikasi !== "Disetujui") {
      if (!isOwner && !isAdminDesaSewilayah && !isSuperAdmin) {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Data relasi ini masih dalam status draft usulan dan belum disahkan oleh Admin Desa terkait."
        });
      }
    }

    // Validasi hak akses data perubahan agar tidak bocor ke publik
    const result = dataRelasi.toJSON();

    if (!isOwner && !isAdminDesaSewilayah && !isSuperAdmin) {
      delete result.data_perubahan;
      delete result.status_sebelum_draft;
    }

    return res.status(200).json({
      message: "Berhasil mengambil detail data relasi krama!",
      data: result
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createRelasiKrama = async (req, res) => {
  // Mulai transaksi database untuk validasi awal
  const t = await db.transaction();

  try {
    const {
      anak_id,
      ayah_id,
      ibu_id,
      status_hubungan,
      tanggal_pengangkatan,
      perkawinan_id,
      urutan_lahir
    } = req.body;

    const currentUserId = req.userId;
    const userRole = req.role;

    // Validasi untuk mencegah loop silsilah
    if (anak_id === ayah_id || anak_id === ibu_id) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Identitas anak tidak boleh sama dengan ayah atau ibu!" 
      });
    }

    // Validasi duplikasi relasi krama aktif
    const existingRelasi = await RelasiKrama.findOne({
      where: {
        anak_id,
        status_hubungan,
        status_verifikasi: { [Op.ne]: "Ditolak" }
      },
      transaction: t
    });

    if (existingRelasi) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Relasi sebagai ${status_hubungan} sudah terdaftar atau sedang ditinjau dalam sistem.` 
      });
    }

    // Validasi ketersediaan data anak, ayah, dan ibu
    const [anak, ayah, ibu] = await Promise.all([
      KramaBali.findByPk(anak_id, { 
        transaction: t 
      }),
      ayah_id ? KramaBali.findByPk(ayah_id, { 
        transaction: t 
      }) : null,
      ibu_id ? KramaBali.findByPk(ibu_id, { 
        transaction: t 
      }) : null
    ]);

    if (!anak) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data anak tidak ditemukan." 
      });
    }

    // Logika auto-approval berdasarkan operator
    let statusVerifAwal = "Draft";
    let catatanAdminDesa = "Menunggu verifikasi oleh Admin Desa.";

    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
    if (isAdmin) {
      statusVerifAwal = "Disetujui";
      catatanAdminDesa = `Data diverifikasi otomatis oleh sistem (Input by ${userRole}).`;
    }

    const commonParams = {
      user_id: currentUserId,
      status_verifikasi: statusVerifAwal,
      catatan_admin_desa: catatanAdminDesa,
      is_pending_update: false,
      data_perubahan: null
    };

    let relasiBaru;
    
    // ============================================================
    // LOGIKA EKSEKUSI (BAYPASS SERVICE JIKA DRAFT)
    // ============================================================
    if (!isAdmin) {
      relasiBaru = await RelasiKrama.create({
        anak_id,
        ayah_id: ayah_id || null,
        ibu_id: ibu_id || null,
        status_hubungan,
        tanggal_pengangkatan: status_hubungan === "Anak Angkat" ? tanggal_pengangkatan : null,
        perkawinan_id: perkawinan_id || null,
        urutan_lahir: urutan_lahir || null,
        ...commonParams
      }, { 
        transaction: t 
      });
    } else {
      const isLeluhurMode = anak.tipe_data === "Leluhur" || ayah?.tipe_data === "Leluhur" || ibu?.tipe_data === "Leluhur";
      if (isLeluhurMode) {
        relasiBaru = await integrasiRelasiLeluhur({
          anak_id,
          ayah_id,
          ibu_id,
          status_hubungan,
          urutan_lahir,
          tanggal_pengangkatan,
          ayah,
          ibu,
          anak,
          ...commonParams
        }, t);
      } else {
        const servicePayload = { 
          anak_id, 
          perkawinan_id, 
          ayah_id, 
          ibu_id, 
          status_hubungan, 
          tanggal_pengangkatan, 
          ...commonParams 
        };

        // Case Keturunan 1: Logika service anak kandung
        if (status_hubungan === "Anak Kandung") {
          if (!perkawinan_id) {
            await t.rollback();
            return res.status(400).json({
              message: "Pencatatan anak kandung warga aktif wajib menyertakan ID perkawinan orang tua!"
            });
          }
          relasiBaru = await buatAnakKandung(servicePayload, t);
        }
        // Case Keturunan 2: Logika service anak angkat
        else if (status_hubungan === "Anak Angkat") {
          // Kondisi 1: Diangkat oleh Pasangan Suami-Istri
          if (perkawinan_id) {
            relasiBaru = await anakAngkatPasangan(servicePayload, t);
          } 
          // Kondisi 2: Diangkat oleh Single Parent (Belum/Tidak Kawin)
          else {
            relasiBaru = await buatAnakAngkat(servicePayload, t);
          }
        }
      }
    }

    await t.commit();

    return res.status(201).json({
      message: isAdmin
        ? "Data relasi silsilah krama berhasil diproses dan diperbarui!"
        : "Data relasi silsilah krama berhasil diajukan! Struktur pohon keluarga akan diperbarui setelah diverifikasi oleh Admin Desa.",
      data: relasiBaru
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(400).json({
      message: error.message
    });
  }
};

export const verifikasiRelasiKrama = async (req, res) => {
  const { id } = req.params;
  const userRole = req.role;
  const userDesaId = req.desaAdatId;

  const { 
    status_verifikasi, 
    catatan_admin_desa 
  } = req.body;
  
  // Validasi status verifikasi
  const VALID_STATUS = ["Disetujui", "Ditolak"];
  if (!VALID_STATUS.includes(status_verifikasi)) {
    return res.status(400).json({
      message: "Status verifikasi tidak valid!"
    });
  }

  // Mulai transaksi database untuk validasi awal
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(id, { 
      include: [
        { model: KramaBali, as: "anak" },
        { model: KramaBali, as: "ayah" },
        { model: KramaBali, as: "ibu" }
      ],
      transaction: t
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data relasi krama tidak ditemukan." 
      });
    }

    const [anak, ayah, ibu] = [relasi.anak, relasi.ayah, relasi.ibu];

    if (!anak) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data anak tidak ditemukan." 
      });
    }

    // Validasi batasan wilayah desa adat Admin Desa
    if (userRole === "Admin Desa") {
      const targetDesaId = relasi.anak?.desa_adat_id || relasi.ayah?.desa_adat_id || relasi.ibu?.desa_adat_id;
      if (String(targetDesaId) !== String(userDesaId)) {
        await t.rollback();
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda.",
        });
      }
    }

    // Validasi verifikasi ganda
    if (relasi.status_verifikasi !== "Draft" && !relasi.is_pending_update) {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi dihentikan! Data ini tidak berada dalam antrean pengajuan baru atau usulan perubahan."
      });
    }

    // Validasi status verifikasi data krama
    if (anak.status_verifikasi === "Draft") {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi ditolak! Data profil ANAK masih berstatus Draft. Mohon verifikasi data krama anak terlebih dahulu."
      });
    }

    if (ayah && ayah.status_verifikasi === "Draft") {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi ditolak! Data profil AYAH masih berstatus Draft. Mohon verifikasi data krama ayah terlebih dahulu."
      });
    }

    if (ibu && ibu.status_verifikasi === "Draft") {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi ditolak! Data profil IBU masih berstatus Draft. Mohon verifikasi data krama ibu terlebih dahulu."
      });
    }

    // ============================================================
    // CASE 1: VERIFIKASI DITOLAK
    // ============================================================
    if (status_verifikasi === "Ditolak") {
      // Validasi input catatan oleh admin desa
      if (!catatan_admin_desa) {
        await t.rollback();
        return res.status(400).json({
          message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
        });
      }

      await relasi.update({
        status_verifikasi: relasi.status_sebelum_draft || "Ditolak",
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null,
        catatan_admin_desa: catatan_admin_desa,
      }, { 
        transaction: t 
      });

      await t.commit();
      return res.status(200).json({ 
        message: `Pangajuan relasi krama ditolak oleh ${userRole}.` 
      });
    }

    // ============================================================
    // CASE 2: VERIFIKASI DISETUJUI
    // ============================================================
    if (status_verifikasi === "Disetujui") {
      // Menyimpan data lama orang tua untuk kalibrasi urutan lahir
      const idAyahLama = relasi.ayah_id;
      const idIbuLama = relasi.ibu_id;

      let finalUpdateData = {
        status_verifikasi: "Disetujui",
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null,
        catatan_admin_desa: catatan_admin_desa || `Pangajuan relasi krama disetujui oleh ${userRole}.`,
      };

      // BONGKAR JSONB: jika ada data di buffer, pindahkan ke kolom utama
      if (relasi.is_pending_update && relasi.data_perubahan) {
        finalUpdateData = { 
          ...finalUpdateData, 
          ...relasi.data_perubahan 
        };
      }
      
      // Membersihkan dampak silsilah dari data lama sebelum dieksekusi
      await bersihkanDampakRelasi(relasi, t);

      await relasi.update(finalUpdateData, { 
        transaction: t 
      });

      // Refresh instance data untuk memastikan service mendapatkan data terbaru
      await relasi.reload({ 
        include: [
          { model: KramaBali, as: "anak" },
          { model: KramaBali, as: "ayah" },
          { model: KramaBali, as: "ibu" }
        ],
        transaction: t 
      });

      const serviceParam = { 
        ...relasi.get(), 
        user_id: req.userId, 
        status_verifikasi: "Disetujui" 
      };

      // Seleksi Rute Service Berdasarkan Tipe Data
      const isLeluhurMode = relasi.anak?.tipe_data === "Leluhur" || 
        relasi.ayah?.tipe_data === "Leluhur" || 
        relasi.ibu?.tipe_data === "Leluhur";

      if (isLeluhurMode) {
        await integrasiRelasiLeluhur({
          ...serviceParam,
          ayah: relasi.ayah,
          ibu: relasi.ibu,
          anak: relasi.anak
        }, t);
      } else {
        // Memanggil service sesuai dengan status hubungan
        if (relasi.status_hubungan === "Anak Kandung") {
          await buatAnakKandung(serviceParam, t);
        } else if (relasi.status_hubungan === "Anak Angkat") {
          if (relasi.perkawinan_id) {
            await anakAngkatPasangan(serviceParam, t);
          } else {
            await buatAnakAngkat(serviceParam, t);
          }
        }
      }

      // Kalibrasi ulang urutan lahir keluarga lama.
      if (idAyahLama || idIbuLama) {
        await hitungUrutanLahir({ 
          mode: "CAMPUR", 
          ayah_id: idAyahLama, 
          ibu_id: idIbuLama 
        }, t);
      }

      await t.commit();

      const updatedData = await RelasiKrama.findByPk(id, {
        include: RELASI_INCLUDE
      });

      return res.status(200).json({
        message: `Data relasi krama berhasil diverifikasi dengan status ${status_verifikasi}.`,
        data: updatedData
      });
    }
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(400).json({ 
      message: error.message 
    });
  }
};

export const updateRelasiKramaById = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.userId;
  const userRole = req.role;
  const dataUpdate = req.body;

  // Mulai transaksi database (ACID)
  const t = await db.transaction();

  try {
    // 1. Ambil data relasi LAMA sebelum diubah
    const relasi = await RelasiKrama.findByPk(id, { 
      include: [
        { model: KramaBali, as: "anak" },
        { model: KramaBali, as: "ayah" },
        { model: KramaBali, as: "ibu" }
      ],
      transaction: t
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({ message: "Data relasi krama tidak ditemukan." });
    }

    // Mengamankan data log LAMA untuk deteksi perubahan silsilah/tanggal
    const idAnakLama = relasi.anak_id;
    const idAyahLama = relasi.ayah_id;
    const idIbuLama = relasi.ibu_id;
    const statusHubunganLama = relasi.status_hubungan;
    const tanggalPengangkatanLama = relasi.tanggal_pengangkatan;

    // Amankan input dataUpdate (ubah string kosong "" menjadi null)
    const cleanedDataUpdate = { ...dataUpdate };
    Object.keys(cleanedDataUpdate).forEach(key => {
      if (cleanedDataUpdate[key] === "") cleanedDataUpdate[key] = null;
    });

    // Tentukan nilai ID & parameter final yang diusulkan
    const finalAnakId = cleanedDataUpdate.anak_id !== undefined ? cleanedDataUpdate.anak_id : idAnakLama;
    const finalAyahId = cleanedDataUpdate.ayah_id !== undefined ? cleanedDataUpdate.ayah_id : idAyahLama;
    const finalIbuId = cleanedDataUpdate.ibu_id !== undefined ? cleanedDataUpdate.ibu_id : idIbuLama;
    const statusHubunganBaru = cleanedDataUpdate.status_hubungan || statusHubunganLama;
    const tanggalPengangkatanBaru = statusHubunganBaru === "Anak Angkat" ? cleanedDataUpdate.tanggal_pengangkatan : null;

    // Jalankan proteksi looping silsilah
    if (finalAnakId === finalAyahId || finalAnakId === finalIbuId) {
      await t.rollback();
      return res.status(400).json({
        message: "Identitas anak tidak boleh sama dengan ayah atau ibu dalam struktur silsilah!"
      });
    }

    // 2. Validasi Hak Akses & Manajemen Draft untuk Non-Admin
    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
    if (!isAdmin) {
      const statusSaatIni = relasi.status_verifikasi;
      const statusBaru = statusSaatIni === "Disetujui" ? "Disetujui" : "Draft";

      await relasi.update({
        status_sebelum_draft: statusSaatIni,
        is_pending_update: true,
        data_perubahan: cleanedDataUpdate,
        status_verifikasi: statusBaru,
        catatan_admin_desa: "Adanya usulan perubahan data relasi oleh pengguna! Menunggu verifikasi..."
      }, { transaction: t });

      await t.commit();
      return res.status(200).json({ 
        message: "Usulan perubahan berhasil diajukan!" 
      });
    }

    // ====================================================================
    // 🔒 GERBANG VALIDASI: DETEKSI PERUBAHAN AKTOR ATAU PERGESERAN TANGGAL
    // ====================================================================
    const apakahLogikaRiwayatBerubah = 
      String(idAyahLama) !== String(finalAyahId) ||
      String(idIbuLama) !== String(finalIbuId) ||
      String(idAnakLama) !== String(finalAnakId) ||
      String(statusHubunganLama) !== String(statusHubunganBaru) ||
      String(tanggalPengangkatanLama) !== String(tanggalPengangkatanBaru);

    // ====================================================================
    // FASE 2: UPDATE TABEL UTAMA SILSILAH (IN-PLACE UPDATE)
    // ====================================================================
    await relasi.update({
      ayah_id: finalAyahId,
      ibu_id: finalIbuId,
      anak_id: finalAnakId,
      status_hubungan: statusHubunganBaru,
      tanggal_pengangkatan: tanggalPengangkatanBaru,
      perkawinan_id: cleanedDataUpdate.perkawinan_id !== undefined ? cleanedDataUpdate.perkawinan_id : relasi.perkawinan_id,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null,
      status_verifikasi: "Disetujui",
      catatan_admin_desa: `Data relasi krama diperbarui secara resmi oleh ${userRole}.`
    }, { transaction: t });

    // Reload data utama agar memuat asosiasi data krama terbaru pasca-update
    await relasi.reload({ 
      include: [
        { model: KramaBali, as: "anak" },
        { model: KramaBali, as: "ayah" },
        { model: KramaBali, as: "ibu" }
      ],
      transaction: t 
    });

    // ====================================================================
    // FASE 3: REBUILD VIA SERVICE UPDATE (SINKRONISASI SKENARIO)
    // ====================================================================
    if (apakahLogikaRiwayatBerubah) {
      console.log("🌱 Memicu rekonstruksi log riwayat via Service Update...");

      const servicePayload = { 
        ...relasi.get(), 
        user_id: currentUserId,
        status_verifikasi: "Disetujui"
      };

      const isLeluhurMode = relasi.anak?.tipe_data === "Leluhur" || 
        relasi.ayah?.tipe_data === "Leluhur" || 
        relasi.ibu?.tipe_data === "Leluhur";

      if (isLeluhurMode) {
        await integrasiRelasiLeluhur({ ...servicePayload, ayah: relasi.ayah, ibu: relasi.ibu, anak: relasi.anak }, t);
      } else {
        if (relasi.status_hubungan === "Anak Kandung") {
          await updateAnakKandung(id, servicePayload, t);
        } else {
          // KOREKSI RUTER: Pastikan fungsi memanggil target skenario yang tepat
          if (relasi.perkawinan_id) {
            // Skenario Orang Tua Pasangan (Kawin)
            await updateAnakAngkatPasangan(id, servicePayload, t);
          } else {
            // Skenario Orang Tua Tunggal
            await updateAnakAngkat(id, servicePayload, t);
          }
        }
      }
    }

    // ====================================================================
    // FASE 4: RE-KALIBRASI URUTAN LAHIR KELUARGA (HANYA JIKA STRUKTUR BERUBAH)
    // ====================================================================
    if (apakahLogikaRiwayatBerubah) {
      if (idAyahLama || idIbuLama) {
        await hitungUrutanLahir({ mode: "CAMPUR", ayah_id: idAyahLama, ibu_id: idIbuLama }, t);
      }
      if (relasi.ayah_id || relasi.ibu_id) {
        await hitungUrutanLahir({ mode: "CAMPUR", ayah_id: relasi.ayah_id, ibu_id: relasi.ibu_id }, t);
      }
    }

    // Komit seluruh rangkaian transaksi database
    await t.commit();

    // Ambil data final yang bersih untuk dikembalikan ke client
    const dataFinal = await RelasiKrama.findByPk(id, {
      include: [
        { model: KramaBali, as: "anak" },
        { model: KramaBali, as: "ayah" },
        { model: KramaBali, as: "ibu" }
      ]
    });

    return res.status(200).json({ 
      message: "Data relasi krama dan seluruh log riwayat berhasil disesuaikan!",
      data: dataFinal 
    });

  } catch (error) {
    if (t && !t.finished) await t.rollback();
    console.error("Error pada fungsi updateRelasiKramaById:", error);
    return res.status(400).json({ message: error.message || "Terjadi kesalahan pada server." });
  }
};

export const cancelUpdateRelasi = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.userId;
  const userRole = req.role;

  // Mulai transaksi database untuk validasi awal
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(id, { 
      transaction: t 
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data pengajuan relasi krama tidak ditemukan." 
      });
    }

    // Validasi hanya pemilik data yang boleh membatalkan usulan
    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
    if (!isAdmin && relasi.user_id !== currentUserId) {
      await t.rollback();
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    // Validasi adanya content yang dibatalkan
    if (!relasi.is_pending_update) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Tidak ada usulan perubahan yang aktif pada data ini." 
      });
    }

    // =========================================================
    // LOGIKA PEMULIHAN DATA
    // =========================================================
    const statusPulih = relasi.status_sebelum_draft || "Draft";

    let catatanBaru = `Usulan perubahan data dibatalkan oleh ${userRole}.`;
    if (statusPulih === "Ditolak") {
      catatanBaru = "Usulan perbaikan data dibatalkan! Status penolakan sebelumnya dipulihkan.";
    } else if (statusPulih === "Disetujui") {
      catatanBaru = "Usulan perubahan dibatalkan! Struktur silsilah aktif kembali menggunakan data sah yang lama.";
    }

    await relasi.update({
      status_verifikasi: statusPulih,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null,
      catatan_admin_desa: catatanBaru
    }, { 
      transaction: t 
    });

    await t.commit();

    return res.status(200).json({ 
      message: `Berhasil membatalkan usulan perubahan data. Status verifikasi dipulihkan menjadi: ${statusPulih}.` 
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const deleteRelasiKramaById = async (req, res) => {
  // Mulai transaksi database untuk validasi awal
  const t = await db.transaction();

  try {
    const relasiId = parseInt(req.params.id);
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    
    // Validasi format ID
    if (isNaN(relasiId)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "ID Relasi tidak valid." 
      });
    }

    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(relasiId, {
      include: [
        { 
          model: KramaBali, 
          as: "anak", 
          attributes: ["id", "desa_adat_id"] 
        }
      ],
      transaction: t
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({
        message: "Data relasi krama tidak ditemukan."
      });
    }

    // Validasi status verifikasi data yang tidak boleh dihapus
    if (relasi.status_verifikasi === "Disetujui" || relasi.is_pending_update) {
      await t.rollback();
      return res.status(400).json({
        message: "Proses menghapus data dihentikan! Data relasi ini telah disetujui secara adat atau sedang memiliki usulan perubahan yang aktif."
      });
    }

    // Validasi hak akses edit ruang lingkup data
    const isOwner = relasi.user_id === currentUserId;
    const isAdminDesa = userRole === "Admin Desa";
    const isSuperAdmin = userRole === "Super Admin";

    if (isAdminDesa) {
      const targetDesaId = relasi.anak?.desa_adat_id;
      if (String(targetDesaId) !== String(userDesaId)) {
        await t.rollback();
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
        });
      }
    } else if (!isOwner && !isSuperAdmin) {
      await t.rollback();
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak!"
      });
    }

    await relasi.destroy({ transaction: t });
    await t.commit();

    return res.status(200).json({
      message: "Data draf pengajuan relasi krama berhasil dihapus secara permanen dari sistem."
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(400).json({
      message: error.message
    });
  }
};