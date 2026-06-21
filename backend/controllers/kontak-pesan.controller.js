import { Op } from "sequelize";
import {
  KontakPesan,
  User,
  DesaAdat
} from "../models/associations.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

// Validasi Input Valid
const VALID_STATUS_PESAN = [
  "Menunggu", 
  "Dibaca", 
  "Selesai"
];

const VALID_KATEGORI_PESAN = [
  "Umum",
  "Korelasi Aturan Adat Bali",
  "Pusat Bantuan Akun Pengguna",
  "Pengaduan & Kendala Sistem",
  "Pusat Bantuan Krama Adat"
];

export const getAllPesan = async (req, res) => {
  try {
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    const currentUserId = req.userId;

    let filterCondition = {};

    // Hak Akses Manajemen Wilayah Adat
    if (userRole === "Admin Desa") {
      filterCondition = { 
        desa_adat_id: userDesaId,
        [Op.or]: [
          { user_id: { [Op.ne]: currentUserId } },
          { user_id: null }
        ]
      };
    } else if (userRole === "Super Admin") {
      filterCondition = {
        [Op.or]: [
          { user_id: { [Op.ne]: currentUserId } },
          { user_id: null }
        ]
      };
    } else {
      return res.status(403).json({ 
        message: "Otoritas mengakses pesan ditolak!" 
      });
    }

    const response = await KontakPesan.findAll({
      where: filterCondition,
      include: [
        {
          model: User,
          as: "user_pengirim",
          attributes: ["id", "full_name", "display_name", "email", "role"]
        }, {
          model: DesaAdat,
          as: "asal_pesan",
          attributes: ["id", "nama_desa_adat"]
        }
      ],
      order: [['createdAt','DESC']]
    });

    return res.status(200).json({
      message: "Berhasil mengambil semua data pesan masuk!",
      data: response
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getPesanById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    const currentUserId = req.userId;

    const kontak = await KontakPesan.findOne({
      where: { id: id },
      include: [
        {
          model: User,
          as: "user_pengirim",
          attributes: ["id", "full_name", "display_name", "email", "role"]
        }, {
          model: DesaAdat,
          as: "asal_pesan",
          attributes: ["id", "nama_desa_adat"]
        }
      ]
    });

    if (!kontak) {
      return res.status(404).json({
        message: "Pesan tidak ditemukan."
      });
    }

    if (kontak.user_id === currentUserId) {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak! Anda tidak dapat memproses pesan yang Anda kirimkan sendiri."
      });
    }

    // Validasi hak akses admin desa
    if (userRole === "Admin Desa" && kontak.desa_adat_id !== userDesaId) {
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak! Pesan ini milik wilayah desa adat lain." 
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil detail data pesan masuk!",
      data: kontak
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createPesan = async (req, res) => {
  let {
    nama_pengirim,
    email_address,
    kategori_pesan,
    pesan,
    desa_adat_id
  } = req.body;

  let finalUserId = null;
  let targetDesaId = null;

  try {
    // Overwrite otomatis data pengirim
    if (req.userId) {
      const user = await User.findByPk(req.userId);
      if (user) {
        nama_pengirim = user.display_name;
        email_address = user.email;
        finalUserId = user.id;
      }
    }

    // Validasi semua kolom input
    if (!nama_pengirim || !email_address || !pesan || !kategori_pesan) {
      return res.status(400).json({
        message: "Kolom nama pengirim, email, kategori pesan, dan pesan wajib diisi!"
      });
    }

    if (!VALID_KATEGORI_PESAN.includes(kategori_pesan)) {
      return res.status(400).json({ 
        message: "Kategori pesan tidak valid!" 
      });
    }

    if (kategori_pesan === "Pusat Bantuan Krama Adat" && !desa_adat_id) {
      return res.status(400).json({ 
        message: "Kategori pesan ini wajib menyertakan tujuan Desa Adat!" 
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      return res.status(400).json({ 
        message: "Format email tidak valid!" 
      });
    }

    // Setting routing penerima notifikasi
    if (kategori_pesan === "Pusat Bantuan Krama Adat" && desa_adat_id) {
      targetDesaId = desa_adat_id;
    } else {
      if (req.role === "Admin Desa" && kategori_pesan === "Pusat Bantuan Krama Adat") {
        targetDesaId = req.desaAdatId;
      }
    }

    const pesanLaporan = await KontakPesan.create({
      nama_pengirim,
      email_address,
      kategori_pesan,
      pesan,
      status_pesan: "Menunggu",
      desa_adat_id: targetDesaId,
      user_id: finalUserId
    });

    // Setting notifikasi
    await kirimNotifikasiSistem(req, {
      judul: `Laporan Baru: ${kategori_pesan}`,
      deskripsi: `Pesan dari ${nama_pengirim}: "${pesan.substring(0, 50)}..."`,
      kategori: "KONTAK",
      tautan_fitur: "/laporan-masuk",
      desa_adat_id: targetDesaId,
      sender_id: finalUserId,
      kontak_pesan_id: pesanLaporan.id
    });

    return res.status(201).json({
      message: "Pesan Anda berhasil dikirim!",
      data: pesanLaporan
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const updateStatusPesan = async (req, res) => {
  const { id } = req.params;
  const { status_pesan } = req.body;

  try {
    const kontak = await KontakPesan.findByPk(id);
    if (!kontak) {
      return res.status(404).json({
        message: "Pesan tidak ditemukan."
      });
    }

    if (status_pesan && !VALID_STATUS_PESAN.includes(status_pesan)) {
      return res.status(400).json({ 
        message: "Status pesan tidak valid!" 
      });
    }

    const statusLama = kontak.status_pesan;

    kontak.status_pesan = status_pesan;
    await kontak.save();

    if (status_pesan === "Selesai" && statusLama !== "Selesai" && kontak.user_id) {
      await kirimNotifikasiSistem(req, {
        judul: "Laporan Anda Selesai Ditinjau",
        deskripsi: `Pesan laporan mengenai "${kontak.kategori_pesan}" dinyatakan selesai.`,
        kategori: "KONTAK",
        tautan_fitur: "/pusat-bantuan",
        desa_adat_id: kontak.desa_adat_id,   
        sender_id: req.userId,                
        kontak_pesan_id: kontak.id 
      });
      
    }

    return res.status(200).json({
      message: "Status pesan berhasil diperbarui!",
      data: kontak
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const deletePesan = async (req, res) => {
  try {
    const { id } = req.params;
    const kontak = await KontakPesan.findByPk(id);

    if (!kontak) {
      return res.status(404).json({ 
        message: "Pesan tidak ditemukan." 
      });
    }

    await kontak.destroy();

    return res.status(200).json({
      message: "Pesan berhasil dihapus!"
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};