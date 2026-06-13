import {
  AturanAdatBali,
  User
} from "../models/associations.js";

// Validasi Input Valid
const VALID_STATUS_PERAN_ADAT = [
  "Purusa", 
  "Predana", 
  "Tidak Memiliki Status Peran Adat"
];

const VALID_GARIS_KETURUNAN = [
  "Purusa", 
  "Purusa Nyentana", 
  "Purusa Pade Gelahang", 
  "Predana", 
  "Tidak Memiliki Garis Keturunan"
];

const VALID_KATEGORI = [
  "LAHIR", 
  "PENGANGKATAN", 
  "KAWIN", 
  "CERAI"
];

export const getAllAturanAdat = async (req, res) => {
  try {
    const daftarAturan = await AturanAdatBali.findAll({
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    res.status(200).json({
      message: "Berhasil mengambil data aturan adat bali yang terdaftar!",
      data: daftarAturan
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getAturanAdatById = async (req, res) => {
  try {
    const dataAturan = await AturanAdatBali.findOne({
      where: { id: req.params.id },
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    if (!dataAturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    res.status(200).json({
      message: "Berhasil mengambil data aturan adat bali yang terdaftar!",
      data: dataAturan
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const createAturanAdat = async (req, res) => {
  const {
    nama_aturan,
    kategori,
    kriteria_kondisi,
    status_peran_adat,
    garis_keturunan,
    dasar_keputusan
  } = req.body;

  // Validasi input dasar
  if (!nama_aturan || !kategori || !status_peran_adat || !garis_keturunan || !dasar_keputusan) {
    return res.status(400).json({
      message: "Semua kolom wajib diisi!"
    });
  }

  // Validasi kriteria kondisi json
  if (!kriteria_kondisi || typeof kriteria_kondisi !== 'object' || Object.keys(kriteria_kondisi).length === 0) {
    return res.status(400).json({
      message: "Kriteria kondisi wajib diisi dalam format JSON dan tidak boleh kosong!"
    });
  }

  // Validasi whitelist
  if (!VALID_KATEGORI.includes(kategori)) {
    return res.status(400).json({ 
      message: "Kategori aturan adat tidak valid!" 
    });
  }
  if (!VALID_STATUS_PERAN_ADAT.includes(status_peran_adat)) {
    return res.status(400).json({ 
      message: "Status peran adat tidak valid!" 
    });
  }
  if (!VALID_GARIS_KETURUNAN.includes(garis_keturunan)) {
    return res.status(400).json({ 
      message: "Garis keturunan tidak valid!" 
    });
  }
  
  try {
    const aturanBaru = await AturanAdatBali.create({
      nama_aturan,
      kategori,
      kriteria_kondisi,
      status_peran_adat,
      garis_keturunan,
      dasar_keputusan,
      status_aturan: "Aktif",
      dibuat_oleh: req.userId
    });

    res.status(201).json({
      message: "Data aturan adat bali berhasil ditambahkan!",
      data: aturanBaru
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const updateAturanAdat = async (req, res) => {
  try {
    const aturan = await AturanAdatBali.findOne({
      where: { id: req.params.id }
    });

    if (!aturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    const {
      nama_aturan,
      kategori,
      kriteria_kondisi,
      status_peran_adat,
      garis_keturunan,
      dasar_keputusan,
      status_aturan
    } = req.body;

    // Validasi input dasar
    if (!nama_aturan || !kategori || !status_peran_adat || !garis_keturunan || !dasar_keputusan) {
      return res.status(400).json({
        message: "Semua kolom wajib diisi!"
      });
    }

    // Validasi kriteria kondisi json
    if (!kriteria_kondisi || typeof kriteria_kondisi !== 'object' || Object.keys(kriteria_kondisi).length === 0) {
      return res.status(400).json({
        message: "Kriteria kondisi wajib diisi dalam format JSON dan tidak boleh kosong!"
      });
    }

    // Validasi whitelist
    if (!VALID_KATEGORI.includes(kategori)) {
      return res.status(400).json({ 
        message: "Kategori aturan adat tidak valid!" 
      });
    }
    if (!VALID_STATUS_PERAN_ADAT.includes(status_peran_adat)) {
      return res.status(400).json({ 
        message: "Status peran adat tidak valid!" 
      });
    }
    if (!VALID_GARIS_KETURUNAN.includes(garis_keturunan)) {
      return res.status(400).json({ 
        message: "Garis keturunan tidak valid!" 
      });
    }

    await AturanAdatBali.update({
      nama_aturan,
      kategori,
      kriteria_kondisi,
      status_peran_adat,
      garis_keturunan,
      dasar_keputusan,
      status_aturan
    }, {
      where: { id: aturan.id }
    });

    const updateAturan = await AturanAdatBali.findByPk(aturan.id, {
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    res.status(200).json({
      message: "Data aturan adat bali berhasil diperbarui!",
      data: updateAturan
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const deleteAturanAdat = async (req, res) => {
  const aturan = await AturanAdatBali.findOne({
    where: { id: req.params.id }
  });

  if (!aturan) {
    return res.status(404).json({
      message: "Aturan adat bali tidak ditemukan."
    });
  }

  if (aturan.status_aturan === "Non-Aktif") {
    return res.status(400).json({
      message: "Aturan adat bali ini sudah dalam status non-aktif."
    });
  }

  try {
    await AturanAdatBali.update({
      status_aturan: "Non-Aktif",
      dibuat_oleh: req.userId
    }, {
      where: { id: aturan.id}
    });

    res.status(200).json({
      message: "Berhasil menonaktifkan aturan adat bali!",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};