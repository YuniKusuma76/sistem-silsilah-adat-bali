import db from "../config/db.config.js";
import fs from "fs";
import path from "path";
import { Op } from "sequelize";
import {
  PermohonanDesa,
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
const VALID_STATUS_VALIDASI = [
  "Menunggu Validasi Berkas", 
  "Berkas Valid", 
  "Berkas Tidak Valid", 
  "Dibatalkan"
];

const VALID_STATUS_PERMOHONAN = [
  "Menunggu Verifikasi", 
  "Disetujui", 
  "Ditolak", 
  "Dibatalkan"
];

// Data Permohonan Desa Include
const PERMOHONAN_DESA_INCLUDE = [
  { 
    model: User, 
    as: "pemohon_mutasi", 
    attributes: ["id", "full_name", "display_name", "email", "role"]
  },{ 
    model: User, 
    as: "validator_berkas", 
    attributes: ["id", "full_name", "display_name", "email", "role"]
  },{ 
    model: User, 
    as: "verifikator_keputusan", 
    attributes: ["id", "full_name", "display_name", "email", "role"]
  },{ 
    model: DesaAdat,
    as: "desa_asal_pemohon", 
    include: [
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
    ]
  },{ 
    model: DesaAdat, 
    as: "desa_tujuan_pemohon", 
    include: [
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
    ]
  }
];

export const ajukanPermohonanDesa = async (req, res) => {
  // Mengambil nama file dari multer di middleware
  const dokumen_pendukung = req.file ? req.file.filename : null;

  try {
    // Validasi hak akses berdasarkan operator
    if (req.role === "Super Admin" || req.role === "Admin Desa" || req.role === "Pakar") {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    const { 
      desa_adat_id_tujuan, 
      alasan_pindah 
    } = req.body;

    // Validasi input dasar
    if (!desa_adat_id_tujuan || !alasan_pindah || !dokumen_pendukung) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({ 
        message: "Kolom wilayah desa adat tujuan, alasan permohonan, dan dokumen pendukung wajib diisi!" 
      });
    }

    // Validasi mengajukan permohonan ke desa adat saat ini
    if (req.desaAdatId && parseInt(desa_adat_id_tujuan) === req.desaAdatId) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({
        message: "Proses permohonan dihentikan! Anda saat ini sudah terdaftar aktif di desa adat tujuan tersebut."
      });
    }

    // Validasi permohonan ganda
    const berkasAktif = await PermohonanDesa.findOne({
      where: {
        user_id: req.userId,
        status_permohonan: "Menunggu Verifikasi"
      }
    });

    if (berkasAktif) {
      hapusFileUploaded(dokumen_pendukung);
      return res.status(400).json({ 
        message: "Proses permohonan dihentikan! Anda masih memiliki berkas permohonan desa yang sedang diverifikasi." 
      });
    }

    const permohonan = await PermohonanDesa.create({
      user_id: req.userId,
      desa_adat_id_asal: req.desaAdatId || null,
      desa_adat_id_tujuan,
      alasan_pindah,
      dokumen_pendukung,
      status_validasi_berkas: "Menunggu Validasi Berkas",
      status_permohonan: "Menunggu Verifikasi"
    });

    res.status(201).json({
      message: "Berkas permohonan desa adat berhasil diajukan!",
      data: permohonan
    });
  } catch (error) {
    hapusFileUploaded(dokumen_pendukung);
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const validasiBerkas = async (req, res) => {
  // Deklarasi kolom input
  const { 
    status_validasi_berkas, 
    catatan_validasi 
  } = req.body;

  // Memulai transaksi database
  const t = await db.transaction();

  try {
    const berkas = await PermohonanDesa.findByPk(req.params.id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!berkas) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Berkas permohonan desa tidak ditemukan." 
      });
    }

    if (berkas.status_validasi_berkas !== "Menunggu Validasi Berkas") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Permohonan ini sudah melewati tahap validasi berkas dari otoritas wilayah desa adat." 
      });
    }

    // Validasi hak akses berkas
    if (berkas.desa_adat_id_tujuan !== req.desaAdatId) {
      await t.rollback();
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda dengan wilayah desa adat tujuan." 
      });
    }

    // Validasi status validasi berkas
    const VALID_KEPUTUSAN_VALIDASI = ["Berkas Valid", "Berkas Tidak Valid"];
    if (!VALID_KEPUTUSAN_VALIDASI.includes(status_validasi_berkas)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Status validasi berkas permohonan tidak valid!" 
      });
    }

    // Validasi input catatan admin desa
    if (status_validasi_berkas === "Berkas Tidak Valid" && (!catatan_validasi || catatan_validasi.trim() === "")) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Kolom catatan validasi wajib diisi jika berkas permohonan dinyatakan Tidak Valid!" 
      });
    }

    // Menentukan catatan validasi secara adaptif jika dikosongkan saat berkas valid
    const catatanValidasiFinal = status_validasi_berkas === "Berkas Valid" 
      ? (catatan_validasi || "Berkas permohonan dinyatakan valid oleh Admin Desa Tujuan.")
      : catatan_validasi;

    // Update status validasi berkas
    await PermohonanDesa.update({
      status_validasi_berkas,
      catatan_validasi: catatanValidasiFinal,
      divalidasi_oleh: req.userId,
      tanggal_validasi: new Date()
    }, {
      where: { id: berkas.id },
      transaction: t
    });

    await t.commit();

    res.status(200).json({ 
      message: `Berkas permohonan desa berhasil ditandai sebagai ${status_validasi_berkas}.` 
    });
  } catch (error) {
    await t.rollback();
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const verifikasiPermohonanDesa = async (req, res) => {
  // Deklarasi kolom input
  const { 
    status_permohonan, 
    catatan_verifikasi 
  } = req.body;
  
  // Memulai transaksi database
  const t = await db.transaction();

  try {
    // Lock row permohonan agar tidak diedit bersamaan
    const berkas = await PermohonanDesa.findByPk(req.params.id, { 
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!berkas) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Berkas permohonan desa tidak ditemukan." 
      });
    }

    if (berkas.status_permohonan !== "Menunggu Verifikasi") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Permohonan ini telah diverifikasi sebelumnya." 
      });
    }

    // Validasi status validasi berkas
    const VALID_KEPUTUSAN_VERIFIKASI = ["Disetujui", "Ditolak"];
    if (!VALID_KEPUTUSAN_VERIFIKASI.includes(status_permohonan)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Status verifikasi permohonan tidak valid!" 
      });
    }

    // Logika jika berkas permohonan belum di validasi
    if (berkas.status_validasi_berkas === "Menunggu Validasi Berkas") {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi dihentikan! Permohonan ini masih berada dalam tahap validasi dokumen oleh Admin Desa Tujuan."
      });
    }

    // Logika eksekusi permohonan tergantung pada validasi berkas
    if (status_permohonan === "Disetujui") {
      if (berkas.status_validasi_berkas !== "Berkas Valid") {
        await t.rollback();
        return res.status(400).json({ 
          message: `Proses verifikasi dihentikan! Berkas permohonan dinyatakan sebagai ${berkas.status_validasi_berkas}.`
        });
      }

      // Logika sinkronisasi otomatis ke database
      await User.update({ 
        desa_adat_id: berkas.desa_adat_id_tujuan 
      }, {
        where: { id: berkas.user_id },
        transaction: t
      });
    } else if (status_permohonan === "Ditolak") {
      if (berkas.status_validasi_berkas !== "Berkas Tidak Valid") {
        await t.rollback();
        return res.status(400).json({ 
          message: `Proses verifikasi dihentikan! Berkas permohonan dinyatakan sebagai ${berkas.status_validasi_berkas}.` 
        });
      }
    }

    // Validasi input catatan super admin
    if (status_permohonan === "Ditolak" && (!catatan_verifikasi || catatan_verifikasi.trim() === "")) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Kolom catatan verifikasi wajib diisi jika permohonan ditolak!" 
      });
    }

    // Menentukan catatan verifikasi secara adaptif jika dikosongkan saat menyetujui
    const catatanVerifikasiFinal = status_permohonan === "Disetujui" 
      ? (catatan_verifikasi || "Permohonan pergantian desa adat resmi disetujui oleh Super Admin.")
      : catatan_verifikasi;
    
    // Update status permohonan
    await PermohonanDesa.update({
      status_permohonan,
      catatan_verifikasi: catatanVerifikasiFinal,
      diverifikasi_oleh: req.userId,
      tanggal_verifikasi: new Date()
    }, {
      where: { id: berkas.id },
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

export const batalkanPermohonanDesa = async (req, res) => {
  try {
    const berkas = await PermohonanDesa.findOne({
      where: {
        id: req.params.id, 
        user_id: req.userId 
      }
    });

    if (!berkas) {
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    if (berkas.status_validasi_berkas !== "Menunggu Validasi Berkas" && berkas.status_permohonan !== "Menunggu Verifikasi") {
      return res.status(400).json({ 
        message: "Berkas permohonan ini tidak dapat dibatalkan karena telah masuk ke dalam tahap pemeriksaan."
      });
    }

    // Mengubah status permohonan
    await PermohonanDesa.update({
      status_validasi_berkas: "Dibatalkan",
      status_permohonan: "Dibatalkan",
      catatan_validasi: "Permohonan desa telah dibatalkan secara mandiri oleh pihak pemohon.",
      catatan_verifikasi: "Permohonan desa telah dibatalkan secara mandiri oleh pihak pemohon.",
      tanggal_validasi: new Date(),
      tanggal_verifikasi: new Date()
    }, {
      where: { id: berkas.id }
    });

    res.status(200).json({ 
      message: "Berkas permohonan desa berhasil dibatalkan." 
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
    const berkas = await PermohonanDesa.findByPk(id);

    if (!berkas) {
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    // Hak akses dokumen pendukung berdasarkan operator
    const isPemilik = berkas.user_id === req.userId;
    const isOtoritasPusat = req.role === "Super Admin";
    const isOtoritasDesa = req.role === "Admin Desa";

    if (!isPemilik && !isOtoritasPusat && !isOtoritasDesa) {
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    if (!berkas.dokumen_pendukung) {
      return res.status(404).json({ 
        message: "Dokumen pendukung tidak tersedia."
      });
    }

    // Debug download dokumen pendukung
    const rootDir = process.cwd(); 
    const filePath = path.join(rootDir, "public/uploads/dokumen", berkas.dokumen_pendukung);
    
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

    return res.sendFile(filePath);

  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getPermohonanAdminDesa = async (req, res) => {
  try {
    const dataPermohonan = await PermohonanDesa.findAll({
      where: { 
        desa_adat_id_tujuan: req.desaAdatId,
        status_validasi_berkas: { [Op.ne]: "Dibatalkan" }
      },
      include: PERMOHONAN_DESA_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });

    res.status(200).json({ 
      message: "Berhasil mengambil data permohonan desa!", 
      data: dataPermohonan
    });
  } catch (error) {
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getPermohonanSuperAdmin = async (req, res) => {
  try {
    const dataPermohonan = await PermohonanDesa.findAll({
      where: {
        status_validasi_berkas: { 
          [Op.or]: ["Berkas Valid", "Berkas Tidak Valid"] 
        }
      },
      include: PERMOHONAN_DESA_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });

    res.status(200).json({ 
      message: "Berhasil mengambil data permohonan desa!", 
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
    const dataPermohonan = await PermohonanDesa.findAll({
      where: { user_id: req.userId },
      include: PERMOHONAN_DESA_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });
    res.status(200).json({ 
      message: "Berhasil mengambil data permohonan desa!", 
      data: dataPermohonan
    });
  } catch (error) {
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getDetailPermohonanDesa = async (req, res) => {
  try {
    const { id } = req.params;

    const berkas = await PermohonanDesa.findByPk(id, {
      include: PERMOHONAN_DESA_INCLUDE
    });

    if (!berkas) {
      return res.status(404).json({ 
        message: "Berkas permohonan desa tidak ditemukan." 
      });
    }

    // Hak akses operator
    if (req.role !== "Super Admin") {
      if (req.role === "Admin Desa") {
        if (berkas.desa_adat_id_tujuan !== req.desaAdatId) {
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          });
        }
      } else {
        const isBerkas = req.userId === berkas.user_id;
        if (!isBerkas) {
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak!" 
          });
        }
      }
    }

    res.status(200).json({
      message: "Berhasil mengambil data permohonan desa!",
      data: berkas
    });
  } catch (error) {
    res.status(500).json({ 
      message: error.message 
    });
  }
};