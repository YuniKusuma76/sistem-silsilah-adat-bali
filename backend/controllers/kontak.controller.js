import {
  Kontak,
  User
} from "../models/associations.js";

// Validasi Input Valid
const VALID_STATUS_PESAN = ["Menunggu", "Proses", "Selesai"];

export const getKontak = async (req, res) => {
  try {
    const response = await Kontak.findAll({
      include: [{
        model: User,
        as: "user_pengirim",
        attributes: ['id','name','email','role']
      }],
      order: [['createdAt','DESC']]
    });

    res.status(200).json({
      message: "Berhasil mengambil semua data kontak!",
      data: response
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getKontakById = async (req, res) => {
  try {
    const { id } = req.params;

    const kontak = await Kontak.findOne({
      where: { 
        id: id 
      },
      include: [{
        model: User,
        as: "user_pengirim",
        attributes: ['id', 'name', 'email', 'role']
      }]
    });

    if (!kontak) {
      return res.status(404).json({
        message: "Pesan tidak ditemukan!"
      });
    }

    res.status(200).json({
      message: "Berhasil mengambil detail data kontak!",
      data: kontak
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const createKontak = async (req, res) => {
  // Validasi admin mengirim pesan
  if (req.role === "Admin") {
    return res.status(403).json({
      message: "Admin tidak diperbolehkan mengirim pesan disini!"
    });
  }

  let {
    nama_pengirim,
    email_address,
    pesan
  } = req.body;

  let finalUserId = null;

  try {
    if (req.userId) {
      const user = await User.findByPk(req.userId);

      if (user) {
        nama_pengirim = user.name;
        email_address = user.email;
        finalUserId = user.id;
      }
    }

    // Validasi input
    if (!nama_pengirim || !email_address || !pesan) {
      return res.status(400).json({
        message: "Nama, Email, dan Pesan wajib diisi!"
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      return res.status(400).json({
        message: "Format email tidak valid!"
      });
    }

    const newKontak = await Kontak.create({
      nama_pengirim: nama_pengirim,
      email_address: email_address,
      pesan: pesan,
      user_id: finalUserId
    });

    res.status(201).json({
      message: "Pesan berhasil dikirim!",
      data: newKontak
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const updateStatusKontak = async (req, res) => {
  const { id } = req.params;
  const { status_pesan } = req.body;

  try {
    const kontak = await Kontak.findByPk(id);

    if (!kontak) {
      return res.status(404).json({
        message: "Pesan tidak ditemukan!"
      });
    }

    if (status_pesan && !VALID_STATUS_PESAN.includes(status_pesan)) {
      return res.status(400).json({ 
        message: "Status pesan tidak valid!" 
      });
    }

    kontak.status_pesan = status_pesan;
    await kontak.save();

    res.status(200).json({
      message: "Status pesan berhasil diperbarui!",
      data: kontak
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const deleteKontak = async (req, res) => {
  try {
    const { id } = req.params;
    const kontak = await Kontak.findByPk(id);

    if (!kontak) {
      return res.status(404).json({
        message: "Data pesan tidak ditemukan!"
      });
    }

    await kontak.destroy();

    res.status(200).json({
      message: "Pesan berhasil dihapus!"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};