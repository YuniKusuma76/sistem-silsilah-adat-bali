import db from "../config/db.config.js";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import {
  PermohonanRole,
  User,
  DesaAdat,
  Kecamatan,
  Kabupaten,
  Provinsi
} from "../models/associations.js";

// Halper untuk menghapus file upload jika verifikasi gagal
const hapusFileUploaded = (filename) => {
  if (!filename) return;
  const filePath = path.join("public/uploads/dokumen", filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Validasi Input Valid
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

// Data Desa Adat Include
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

// Data Permohonan Role Include
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
  // Mengambil nama file dari multer di middleware
  const dokumen_pendukung = req.file ? req.file.filename : null;

  try {
    // Otoritas mengakses permohonan role
    if (req.role === "Super Admin") {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    const { 
      role_yang_diminta, 
      alasan_permohonan, 
      desa_adat_id_tujuan 
    } = req.body;

    // Validasi meminta role yang sama dengan role sekarang
    if (req.role === role_yang_diminta) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({
        message: `Proses permohonan dihentikan! Anda telah memegang peran sebagai ${req.role}.`
      });
    }

    // Validasi input dasar
    if (!role_yang_diminta || !alasan_permohonan || !dokumen_pendukung) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({ 
        message: "Kolom role yang diminta, alasan permohonan, dan dokumen pendukung wajib diisi!" 
      });
    }

    // Validasi input role pengajuan
    if (!VALID_ROLES_PENGAJUAN.includes(role_yang_diminta)) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({ 
        message: "Pilihan role tidak valid!" 
      });
    }

    // Validasi kondisional
    if (role_yang_diminta === "Admin Desa") {
      if (!desa_adat_id_tujuan || desa_adat_id_tujuan.toString().trim() === "") {
        hapusFileUploaded(dokumen_pendukung);
        return res.status(400).json({
          message: "Kolom wilayah desa adat wajib diisi!"
        });
      }

      if (req.role === "Krama" || req.role === "Viewer") {
        if (parseInt(desa_adat_id_tujuan) !== req.desaAdatId) {
          hapusFileUploaded(dokumen_pendukung);
          return res.status(400).json({
            message: "Proses permohonan dihentikan! Wilayah desa adat Anda tidak cocok dengan desa adat tujuan."
          });
        }
      }
    }

    // Validasi permohonan ganda
    const existingPermohonan = await PermohonanRole.findOne({
      where: { 
        user_id: req.userId, 
        status_permohonan: "Menunggu" 
      }
    });

    if (existingPermohonan) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({ 
        message: "Anda masih memiliki permohonan aktif yang sedang diproses." 
      });
    }

    // Eksekusi pembuatan data permohonan
    const permohonan = await PermohonanRole.create({
      user_id: req.userId,
      role_yang_diminta,
      alasan_permohonan,
      dokumen_pendukung,
      desa_adat_id_tujuan: role_yang_diminta === "Admin Desa" ? desa_adat_id_tujuan : null,
      status_permohonan: "Menunggu"
    });

    res.status(201).json({
      message: "Berkas permohonan pergantian role berhasil diajukan!",
      data: permohonan
    });
  } catch (error) {
    hapusFileUploaded(dokumen_pendukung);
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const verifikasiPermohonan = async (req, res) => {
  // Deklarasi kolom input
  const { 
    status_permohonan, 
    catatan_super_admin 
  } = req.body;
  
  // Memulai transaksi database
  const t = await db.transaction();
  
  try {
    // Validasi input status permohonan
    const VALID_STATUS_VERIFIKASI = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS_VERIFIKASI.includes(status_permohonan)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Status verifikasi permohonan tidak valid!" 
      });
    }

    // Validasi input catatan super admin
    if (status_permohonan === "Ditolak" && (!catatan_super_admin || catatan_super_admin.trim() === "")) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Kolom catatan wajib diisi jika permohonan ditolak!" 
      });
    }

    // Lock row permohonan agar tidak diedit bersamaan
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

    // Menentukan catatan admin secara adaptif jika dikosongkan saat menyetujui
    const catatanFinal = status_permohonan === "Disetujui" 
      ? (catatan_super_admin || "Permohonan pergantian role disetujui oleh Super Admin.")
      : catatan_super_admin;

    // Logika sinkronisasi otomatis ke database
    if (status_permohonan === "Disetujui") {
      const payloadUpdateUser = {
        role: berkasPermohonan.role_yang_diminta
      };

      if (berkasPermohonan.role_yang_diminta === "Admin Desa") {
        payloadUpdateUser.desa_adat_id = berkasPermohonan.desa_adat_id_tujuan
      } else if (berkasPermohonan.role_yang_diminta === "Pakar") {
        payloadUpdateUser.desa_adat_id = null;
      }

      await User.update(payloadUpdateUser, {
        where: {
          id: berkasPermohonan.user_id
        },
        transaction: t
      });
    }

    // Update berkas dokumen permohonan
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

    res.status(200).json({ 
      message: `Berkas permohonan berhasil diverifikasi dengan keputusan: ${status_permohonan}.` 
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const batalkanPermohonan = async (req, res) => {
  try {
    const permohonan = await PermohonanRole.findOne({
      where: { 
        id: req.params.id, 
        user_id: req.userId 
      }
    });

    if (!permohonan) {
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    if (permohonan.status_permohonan !== "Menunggu") {
      return res.status(400).json({ 
        message: "Berkas permohonan ini tidak dapat dibatalkan karena telah diverifikasi." 
      });
    }

    // Mengubah status permohonan
    await PermohonanRole.update({
      status_permohonan: "Dibatalkan",
      catatan_super_admin: "Permohonan telah dibatalkan secara mandiri oleh pihak pemohon.",
      tanggal_verifikasi: new Date()
    }, {
      where: { id: permohonan.id }
    });

    res.status(200).json({ 
      message: "Berkas permohonan berhasil dibatalkan." 
    });
  } catch (error) {
    res.status(500).json({ 
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

    // Hak akses dokumen pendukung berdasarkan operator
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

    // Debug download dokumen pendukung
    const rootDir = process.cwd(); 
    const filePath = path.join(rootDir, "public/uploads/dokumen", berkasPermohonan.dokumen_pendukung);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ 
        message: "Berkas fisik dokumen tidak ditemukan." 
      });
    }

    const ext = path.extname(filePath).toLowerCase();
    
    // Set header konten sesuai ekstensi
    if (ext === '.pdf') {
      res.setHeader('Content-Type', 'application/pdf');
    } else if (ext === '.jpg' || ext === '.jpeg') {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (ext === '.png') {
      res.setHeader('Content-Type', 'image/png');
    }

    res.sendFile(filePath);

  } catch (error) {
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getAllPermohonan = async (req, res) => {
  try {
    const dataPermohonan = await PermohonanRole.findAll({
      where: {
        status_permohonan: { [Op.ne]: "Dibatalkan" }
      },
      include: PERMOHONAN_ROLE_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });

    res.status(200).json({ 
      message: "Berhasil mengambil data permohonan role!", 
      data: dataPermohonan
    });
  } catch (error) {
    res.status(500).json({ 
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
      order: [["tanggal_pengajuan", "DESC"]]
    });

    res.status(200).json({ 
      message: "Berhasil mengambil histori permohonan role Anda!", 
      data: permohonanSaya
    });
  } catch (error) {
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getDetailPermohonan = async (req, res) => {
  try {
    const { id } = req.params;
    let whereClause = { id: id };
    
    // Validasi hak akses data
    if (req.role !== "Super Admin") {
      whereClause.user_id = req.userId;
    }

    // Mengambil detail permohonan
    const permohonan = await PermohonanRole.findOne({
      where: whereClause,
      include: PERMOHONAN_ROLE_INCLUDE
    });

    if (!permohonan) {
      return res.status(404).json({ 
      message: "Berkas permohonan tidak ditemukan." 
    });
    }

    res.status(200).json({ 
      message: "Berhasil mengambil data permohonan role!",
      data: permohonan 
    });
  } catch (error) {
    res.status(500).json({ 
      message: error.message 
    });
  }
};