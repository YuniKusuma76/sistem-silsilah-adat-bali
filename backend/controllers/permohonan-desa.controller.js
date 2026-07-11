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
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

// Halper untuk menghapus file upload jika verifikasi gagal
const hapusFileUploaded = (filename) => {
  if (!filename) return;
  const filePath = path.join("public/uploads/dokumen", filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

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
    if (req.role === "Super Admin" || req.role === "Admin Desa" || req.role === "Pakar") {
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    const { desa_adat_id_tujuan, alasan_pindah } = req.body;

    if (!desa_adat_id_tujuan || !alasan_pindah || !dokumen_pendukung) {
      return res.status(400).json({ 
        message: "Kolom wilayah desa adat tujuan, alasan permohonan, dan dokumen pendukung wajib diisi!" 
      });
    }

    if (req.desaAdatId && parseInt(desa_adat_id_tujuan) === req.desaAdatId) {
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

    await kirimNotifikasiSistem(req, {
      judul: "Verifikasi Pengajuan Mutasi Desa Adat",
      deskripsi: `Adanya pengajuan mutasi desa adat masuk dari ${req.role}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
      kategori: "VERIFIKASI",
      tautan_fitur: "/verifikasi-data/pengajuan-desa-adat",
      desa_adat_id: permohonan.desa_adat_id_tujuan,
      sender_id: permohonan.user_id,
      kontak_pesan_id: null,
      user_id: null
    });

    return res.status(201).json({
      message: "Berkas permohonan desa adat berhasil diajukan!",
      data: permohonan
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  } finally {
    if (res.statusCode !== 201) {
      hapusFileUploaded(dokumen_pendukung);
    }
  }
};

export const validasiBerkas = async (req, res) => {
  const { status_validasi_berkas, catatan_validasi } = req.body;

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
        message: "Kolom catatan validasi wajib diisi jika berkas permohonan dinyatakan tidak valid!" 
      });
    }

    const catatanValidasiFinal = status_validasi_berkas === "Berkas Valid" 
      ? (catatan_validasi || "Berkas permohonan mutasi desa adat dinyatakan valid oleh Admin Desa Tujuan.")
      : catatan_validasi;
    
    const statusPermohonanFinal = status_validasi_berkas === "Berkas Tidak Valid" 
      ? "Ditolak" 
      : berkas.status_permohonan;
    
    const catatanVerifikasiFinal = status_validasi_berkas === "Berkas Tidak Valid"
      ? `[BERKAS TIDAK VALID]: ${catatanValidasiFinal}`
      : berkas.catatan_verifikasi;

    await PermohonanDesa.update({
      status_validasi_berkas,
      status_permohonan: statusPermohonanFinal,
      catatan_validasi: catatanValidasiFinal,
      catatan_verifikasi: catatanVerifikasiFinal,
      divalidasi_oleh: req.userId,
      tanggal_validasi: new Date(),
      ...(status_validasi_berkas === "Berkas Tidak Valid" && { 
        diverifikasi_oleh: req.userId, 
        tanggal_verifikasi: new Date() 
      })
    }, {
      where: { id: berkas.id },
      transaction: t
    });

    await t.commit();

    if (status_validasi_berkas === "Berkas Tidak Valid") {
      Promise.all([
        kirimNotifikasiSistem(req, {
          judul: "Pengajuan Mutasi Desa Adat Ditolak",
          deskripsi: `Permohonan mutasi desa adat Anda ditolak oleh Admin Desa Tujuan karena berkas dinyatakan tidak valid: ${catatanValidasiFinal}`,
          kategori: "PERINGATAN",
          tautan_fitur: "/pengajuan-desa-adat/my-data",
          desa_adat_id: berkas.desa_adat_id_tujuan, 
          sender_id: req.userId,
          kontak_pesan_id: null,
          user_id: berkas.user_id 
        }),
        kirimNotifikasiSistem(req, {
          judul: "Pengajuan Mutasi Desa Adat Ditolak",
          deskripsi: "Permohonan mutasi desa adat telah ditolak oleh Admin Desa Tujuan karena berkas dinyatakan tidak valid.",
          kategori: "LOG_SISTEM",
          tautan_fitur: null,
          desa_adat_id: null, 
          sender_id: req.userId,
          kontak_pesan_id: null,
          user_id: null 
        })
      ]).catch(err => {
        console.error("Gagal mengirim notifikasi saat validasi berkas mutasi desa adat:", err);
      });
    } else {
      kirimNotifikasiSistem(req, {
        judul: "Verifikasi Pengajuan Mutasi Desa Adat",
        deskripsi: "Berkas pengajuan mutasi desa adat dinyatakan valid. Menunggu verifikasi final dari Admin Verifikator.",
        kategori: "VERIFIKASI",
        tautan_fitur: "/verifikasi-data/pengajuan-desa-adat",
        desa_adat_id: null, 
        sender_id: req.userId,
        kontak_pesan_id: null,
        user_id: null 
      }). catch(err => {
        console.error("Gagal mengirim notifikasi saat validasi berkas mutasi desa adat:", err);
      });
    }

    return res.status(200).json({ 
      message: `Berkas permohonan desa berhasil ditandai sebagai ${status_validasi_berkas}.` 
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const verifikasiPermohonanDesa = async (req, res) => {
  const { status_permohonan, catatan_verifikasi } = req.body;

  // Validasi status verifikasi
  const VALID_KEPUTUSAN_VERIFIKASI = ["Disetujui", "Ditolak"];
  if (!VALID_KEPUTUSAN_VERIFIKASI.includes(status_permohonan)) {
    return res.status(400).json({ 
      message: "Status verifikasi permohonan tidak valid!" 
    });
  }

  if (status_permohonan === "Ditolak" && (!catatan_verifikasi || catatan_verifikasi.trim() === "")) {
    return res.status(400).json({ 
      message: "Kolom catatan verifikasi wajib diisi jika permohonan ditolak!" 
    });
  }
  
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

    if (berkas.status_permohonan !== "Menunggu Verifikasi") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Permohonan ini telah diverifikasi sebelumnya." 
      });
    }

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

    // Menentukan catatan verifikasi secara adaptif jika dikosongkan saat menyetujui
    const catatanVerifikasiFinal = status_permohonan === "Disetujui" 
      ? (catatan_verifikasi || "Permohonan mutasi desa adat resmi disetujui oleh Super Admin.")
      : catatan_verifikasi;
    
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

    Promise.all([
      kirimNotifikasiSistem(req, {
        judul: "Permohonan Mutasi Desa Adat",
        deskripsi: `Permohonan mutasi desa adat telah diverifikasi dengan status: ${status_permohonan.toUpperCase()}.`,
        kategori: "INFORMASI",
        tautan_fitur: null,
        desa_adat_id: berkas.desa_adat_id_tujuan, 
        sender_id: req.userId,
        kontak_pesan_id: null,
        user_id: null 
      }),
      kirimNotifikasiSistem(req, {
        judul: "Permohonan Mutasi Desa Adat",
        deskripsi: "Permohonan mutasi desa adat telah diverifikasi dan disetujui oleh Admin Desa Tujuan dan Admin Verifikator.",
        kategori: "LOG_SISTEM",
        tautan_fitur: "/pengajuan-desa-adat/my-data",
        desa_adat_id: null, 
        sender_id: req.userId,
        kontak_pesan_id: null,
        user_id: berkas.user_id 
      })
    ]).catch(err => {
      console.error("Gagal mengirim notifikasi saat verifikasi final mutasi desa adat:", err);
    });

    return res.status(200).json({ 
      message: `Berkas permohonan berhasil diverifikasi dengan keputusan: ${status_permohonan}.` 
    });
  } catch (error) {
    if (!t.finished) {
      await t.rollback();
    }
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const batalkanPermohonanDesa = async (req, res) => {
  // Memulai transaksi database
  const t = await db.transaction();

  try {
    const berkas = await PermohonanDesa.findOne({
      where: {
        id: req.params.id, 
        user_id: req.userId 
      },
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!berkas) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Berkas permohonan tidak ditemukan." 
      });
    }

    const statusValidasiDB = (berkas.status_validasi_berkas || "").trim().toLowerCase();
    const statusPermohonanDB = (berkas.status_permohonan || "").trim().toLowerCase();
    if (statusValidasiDB !== "menunggu validasi berkas" || statusPermohonanDB !== "menunggu verifikasi") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Berkas permohonan ini tidak dapat dibatalkan karena telah masuk ke dalam tahap pemeriksaan atau selesai diproses."
      });
    }

    await PermohonanDesa.update({
      status_validasi_berkas: "Dibatalkan",
      status_permohonan: "Dibatalkan",
      catatan_validasi: "Permohonan desa telah dibatalkan secara mandiri oleh pihak pemohon.",
      catatan_verifikasi: "Permohonan desa telah dibatalkan secara mandiri oleh pihak pemohon.",
      tanggal_validasi: new Date(),
      tanggal_verifikasi: new Date()
    }, {
      where: { id: berkas.id },
      transaction: t
    });

    await t.commit();

    Promise.all([
      kirimNotifikasiSistem(req, {
        judul: "Pembatalan Permohonan Mutasi Desa Adat",
        deskripsi: `Pengajuan permohonan mutasi desa adat telah dibatalkan oleh Pihak Pemohon.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/verifikasi-data/pengajuan-desa-adat",
        desa_adat_id: berkas.desa_adat_id_tujuan, 
        sender_id: req.userId,
        kontak_pesan_id: null,
        user_id: null 
      }),
      kirimNotifikasiSistem(req, {
        judul: "Permohonan Mutasi Desa Adat Dibatalkan",
        deskripsi: `Permohonan mutasi desa adat Anda telah Anda batalkan dan ditarik dari antrean verifikasi.`,
        kategori: "PERINGATAN",
        tautan_fitur: "/pengajuan-desa-adat/my-data",
        desa_adat_id: null, 
        sender_id: req.userId,
        kontak_pesan_id: null,
        user_id: berkas.user_id 
      })
    ]).catch(err => {
      console.error("Gagal mengirim notifikasi saat pembatalan permohonan role mutasi desa adat:", err);
    });

    return res.status(200).json({ 
      message: "Berkas permohonan desa berhasil dibatalkan." 
    });
  } catch (error) {
    if (!t.finished) {
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
        status_validasi_berkas: "Menunggu Validasi Berkas"
      },
      include: PERMOHONAN_DESA_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });

    return res.status(200).json({ 
      message: "Berhasil mengambil data permohonan desa!", 
      data: dataPermohonan
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getPermohonanSuperAdmin = async (req, res) => {
  try {
    const dataPermohonan = await PermohonanDesa.findAll({
      where: {
        status_validasi_berkas: "Berkas Valid",
        status_permohonan: "Menunggu Verifikasi"
      },
      include: PERMOHONAN_DESA_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });

    return res.status(200).json({ 
      message: "Berhasil mengambil data permohonan desa!", 
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
    const dataPermohonan = await PermohonanDesa.findAll({
      where: { user_id: req.userId },
      include: PERMOHONAN_DESA_INCLUDE,
      order: [["tanggal_pengajuan", "DESC"]]
    });
    return res.status(200).json({ 
      message: "Berhasil mengambil data permohonan desa!", 
      data: dataPermohonan
    });
  } catch (error) {
    return res.status(500).json({ 
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

    return res.status(200).json({
      message: "Berhasil mengambil data permohonan desa!",
      data: berkas
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};