import db from "../config/db.config.js";
import { Op } from "sequelize";
import { 
  PermohonanRole,
  User,
  DesaAdat,
  Kecamatan,
  Kabupaten,
  Provinsi
} from "../models/associations.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";
import { supabase } from "../config/supabase.config.js";

const VALID_ROLES_PENGAJUAN = [
  "Admin Desa", 
  "Pakar"
];

const VALID_STATUS_PERMOHONAN = [
  "Menunggu", 
  "Disetujui", 
  "Ditolak", 
  "Dibatalkan"
];

const DESA_ADAT_INCLUDE = [
  {
    model: Kecamatan,
    as: "kecamatan",
    include: [
      {
        model: Kabupaten,
        as: "kabupaten",
        include: [
          {
            model: Provinsi,
            as: "provinsi"
          }
        ]
      }
    ]
  }
];

const PERMOHONAN_ROLE_INCLUDE = [
  {
    model: User,
    as: "pemohon",
    attributes: ["id", "full_name", "display_name", "email", "role"]
  },
  {
    model: User,
    as: "verifikator",
    attributes: ["id", "full_name", "display_name", "email"]
  },
  {
    model: DesaAdat,
    as: "desa_tujuan",
    include: DESA_ADAT_INCLUDE
  }
];

export const ajukanPermohonan = async (req, res) => {
  const file = req.file;
  let filePath = null;

  try {
    if (req.role === "Super Admin") {
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    const { 
      role_yang_diminta, 
      alasan_permohonan, 
      desa_adat_id_tujuan 
    } = req.body;

    if (!role_yang_diminta || !alasan_permohonan || !file) {
      return res.status(400).json({ 
        message: "Kolom role yang diminta, alasan permohonan, dan dokumen pendukung wajib diisi!" 
      });
    }

    if (req.role === role_yang_diminta) {
      return res.status(400).json({
        message: `Proses permohonan dihentikan! Anda telah memegang peran sebagai ${req.role}.`
      });
    }

    if (!VALID_ROLES_PENGAJUAN.includes(role_yang_diminta)) {
      return res.status(400).json({ 
        message: "Pilihan role tidak valid!" 
      });
    }

    if (role_yang_diminta === "Admin Desa") {
      if (!desa_adat_id_tujuan || desa_adat_id_tujuan.toString().trim() === "") {
        return res.status(400).json({
          message: "Kolom wilayah desa adat wajib diisi!"
        });
      }

      if (req.role === "Krama" || req.role === "Viewer") {
        if (parseInt(desa_adat_id_tujuan) !== req.desaAdatId) {
          return res.status(400).json({
            message: "Proses permohonan dihentikan! Wilayah desa adat Anda tidak cocok dengan desa adat tujuan."
          });
        }
      }
    }

    const existingPermohonan = await PermohonanRole.findOne({
      where: { 
        user_id: req.userId, 
        status_permohonan: "Menunggu" 
      }
    });

    if (existingPermohonan) {
      return res.status(400).json({ 
        message: "Anda masih memiliki permohonan aktif yang sedang ditinjau." 
      });
    }

    // Proses Upload File ke Bucket Privat Supabase
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${Date.now()}-permohonan.${fileExt}`; 

    filePath = `permohonan-role/${fileName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('dokumen-pendukung')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Gagal mengunggah berkas ke Cloud Storage: ${uploadError.message}`);
    }

    const permohonan = await PermohonanRole.create({
      user_id: req.userId,
      role_yang_diminta,
      alasan_permohonan,
      dokumen_pendukung: filePath,
      desa_adat_id_tujuan: role_yang_diminta === "Admin Desa" ? desa_adat_id_tujuan : null,
      status_permohonan: "Menunggu"
    });

    await kirimNotifikasiSistem(req, {
      judul: "Verifikasi Pengajuan Perubahan Role",
      deskripsi: `Adanya pengajuan perubahan role dari ${req.role} menjadi ${permohonan.role_yang_diminta}. Menunggu verifikasi dari Admin Validator.`,
      kategori: "VERIFIKASI",
      tautan_fitur: "/verifikasi-data/pengajuan-role",
      desa_adat_id: null,
      sender_id: permohonan.user_id,
      kontak_pesan_id: null,
      user_id: null
    });

    return res.status(201).json({
      message: "Berkas permohonan pergantian role berhasil diajukan!",
      data: permohonan
    });
  } catch (error) {
    if (filePath) {
      await supabase.storage.from('dokumen-pendukung').remove([filePath]);
    }
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const verifikasiPermohonan = async (req, res) => {
  const { status_permohonan, catatan_super_admin } = req.body;
  
  // Memulai transaksi database
  const t = await db.transaction();
  
  try {
    const VALID_STATUS_VERIFIKASI = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS_VERIFIKASI.includes(status_permohonan)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Status verifikasi permohonan tidak valid!" 
      });
    }

    if (status_permohonan === "Ditolak" && (!catatan_super_admin || catatan_super_admin.trim() === "")) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Kolom catatan wajib diisi jika permohonan ditolak!" 
      });
    }

    const berkasPermohonan = await PermohonanRole.findByPk(req.params.id, { 
      transaction: t 
    });
    
    if (!berkasPermohonan) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    if (berkasPermohonan.status_permohonan !== "Menunggu") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Berkas permohonan ini telah diverifikasi sebelumnya." 
      });
    }

    const catatanFinal = status_permohonan === "Disetujui" 
      ? (catatan_super_admin || "Permohonan pergantian role diverifikasi dan disetujui oleh Super Admin.")
      : catatan_super_admin;

    // Logika Sinkronisasi Otomatis ke Tabel User
    if (status_permohonan === "Disetujui") {
      const payloadUpdateUser = {
        role: berkasPermohonan.role_yang_diminta
      };

      if (berkasPermohonan.role_yang_diminta === "Admin Desa") {
        payloadUpdateUser.desa_adat_id = berkasPermohonan.desa_adat_id_tujuan;
      } else if (berkasPermohonan.role_yang_diminta === "Pakar") {
        payloadUpdateUser.desa_adat_id = null;
      }

      await User.update(payloadUpdateUser, {
        where: { id: berkasPermohonan.user_id },
        transaction: t
      });
    }

    await PermohonanRole.update({
      status_permohonan,
      catatan_super_admin: catatanFinal,
      diverifikasi_oleh: req.userId,
      tanggal_verifikasi: new Date()
    }, {
      where: { id: berkasPermohonan.id },
      transaction: t
    });

    await t.commit();

    await kirimNotifikasiSistem(req, {
      judul: "Keputusan Permohonan Perubahan Role",
      deskripsi: `Pengajuan permohonan perubahan role menjadi ${berkasPermohonan.role_yang_diminta} telah diverifikasi dengan status: ${status_permohonan.toUpperCase()}.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: "/pengajuan-role/my-data",
      desa_adat_id: null,
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: berkasPermohonan.user_id
    });

    return res.status(200).json({ 
      message: `Berkas permohonan berhasil diverifikasi dengan keputusan: ${status_permohonan}.` 
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

export const batalkanPermohonan = async (req, res) => {
  // Memulai transaksi database
  const t = await db.transaction();

  try {
    const permohonan = await PermohonanRole.findOne({
      where: { 
        id: req.params.id, 
        user_id: req.userId 
      },
      transaction: t
    });

    if (!permohonan) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    if (permohonan.status_permohonan !== "Menunggu") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Berkas permohonan ini tidak dapat dibatalkan karena telah diverifikasi." 
      });
    }

    await PermohonanRole.update({
      status_permohonan: "Dibatalkan",
      catatan_super_admin: "Permohonan telah dibatalkan secara mandiri oleh pihak pemohon.",
      tanggal_verifikasi: new Date()
    }, {
      where: { id: permohonan.id },
      transaction: t
    });

    await t.commit();

    await kirimNotifikasiSistem(req, {
      judul: "Pembatalan Permohonan Perubahan Role",
      deskripsi: `Pengajuan permohonan perubahan role menjadi ${permohonan.role_yang_diminta} telah dibatalkan oleh Pihak Pemohon.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: "/verifikasi-data/pengajuan-role",
      desa_adat_id: null, 
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: null 
    });

    return res.status(200).json({ 
      message: "Berkas permohonan berhasil dibatalkan." 
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

export const hapusRiwayatPermohonan = async (req, res) => {
  // Memulai transaksi database
  const t = await db.transaction();

  try {
    const permohonan = await PermohonanRole.findOne({
      where: { 
        id: req.params.id,
        user_id: req.userId
      },
      transaction: t
    });

    if (!permohonan) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Riwayat permohonan tidak ditemukan." 
      });
    }

    const ALLOWED_STATUS_TO_DELETE = ["Ditolak", "Dibatalkan"];
    if (!ALLOWED_STATUS_TO_DELETE.includes(permohonan.status_permohonan)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Proses menghapus data dihentikan! Hanya riwayat permohonan yang ditolak atau dibatalkan yang dapat dihapus." 
      });
    }

    const filePathHapus = permohonan.dokumen_pendukung;

    await PermohonanRole.destroy({
      where: { id: permohonan.id },
      transaction: t
    });

    await t.commit();

    if (filePathHapus) {
      const { error: storageError } = await supabase.storage.from('dokumen-pendukung').remove([filePathHapus]);
      if (storageError) {
        console.error(`Gagal menghapus berkas di Supabase Storage: ${storageError.message}`);
      }
    }

    return res.status(200).json({ 
      message: "Riwayat permohonan dan dokumen pendukungnya berhasil dihapus secara permanen." 
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

export const getDokumenPendukung = async (req, res) => {
  try {
    const { id } = req.params;
    const berkasPermohonan = await PermohonanRole.findByPk(id);

    if (!berkasPermohonan) {
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    if (berkasPermohonan.user_id !== req.userId && req.role !== "Super Admin") {
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    if (!berkasPermohonan.dokumen_pendukung) {
      return res.status(404).json({ 
        message: "Dokumen pendukung tidak tersedia."
      });
    }

    // Generate Signed URL dari Supabase Storage (Bucket Private)
    const expiresInSeconds = 120; 

    const { data, error: storageError } = await supabase.storage
      .from('dokumen-pendukung')
      .createSignedUrl(berkasPermohonan.dokumen_pendukung, expiresInSeconds);

    if (storageError || !data) {
      throw new Error(`Gagal membuat akses tautan cloud storage: ${storageError?.message || "Data kosong"}`);
    }

    return res.status(200).json({
      message: "Tautan akses dokumen berhasil digenerate!",
      url: data.signedUrl
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getAllPermohonan = async (req, res) => {
  try {
    const dataPermohonan = await PermohonanRole.findAll({
      where: { 
        status_permohonan: "Menunggu" 
      },
      include: PERMOHONAN_ROLE_INCLUDE,
      order: [["createdAt", "DESC"]]
    });

    return res.status(200).json({ 
      message: "Berhasil mengambil data permohonan role!", 
      data: dataPermohonan
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getPermohonanSaya = async (req, res) => {
  try {
    const permohonanSaya = await PermohonanRole.findAll({
      where: { 
        user_id: req.userId 
      },
      include: [{
        model: DesaAdat,
        as: "desa_tujuan",
        include: DESA_ADAT_INCLUDE
      }],
      order: [["createdAt", "DESC"]]
    });

    return res.status(200).json({ 
      message: "Berhasil mengambil histori permohonan role Anda!", 
      data: permohonanSaya
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getDetailPermohonan = async (req, res) => {
  try {
    const { id } = req.params;
    let whereClause = { id: id };
    
    if (req.role !== "Super Admin") {
      whereClause.user_id = req.userId;
    }

    const permohonan = await PermohonanRole.findOne({
      where: whereClause,
      include: PERMOHONAN_ROLE_INCLUDE
    });

    if (!permohonan) {
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    return res.status(200).json({ 
      message: "Berhasil mengambil data permohonan role!",
      data: permohonan 
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};