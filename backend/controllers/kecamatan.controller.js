import {
  Kecamatan,
  Kabupaten,
  Provinsi,
  DesaAdat
} from "../models/associations.js";

// Data Kecamatan Include
const KECAMATAN_INCLUDE = [
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
];

export const getAllKecamatan = async (req, res) => {
  try {
    const dataKec = await Kecamatan.findAll({
      include: KECAMATAN_INCLUDE
    });

    res.status(200).json({
      message: "Berhasil mengambil data kecamatan!",
      data: dataKec
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getKecamatanById = async (req, res) => {
  try {
    const dataKec = await Kecamatan.findByPk(req.params.id, {
      include: KECAMATAN_INCLUDE
    });

    if (!dataKec) {
      return res.status(404).json({
        message: "Data kecamatan tidak ditemukan."
      });
    }

    res.status(200).json({
      message: "Berhasil mengambil data kecamatan!",
      data: dataKec
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const createKecamatan = async (req, res) => {
  try {
    const { 
      nama_kecamatan,
      kabupaten_id 
    } = req.body;

    // Validasi input dasar
    if (!nama_kecamatan || typeof nama_kecamatan !== 'string' || nama_kecamatan.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama kecamatan wajib diisi dengan teks yang valid!"
      });
    }

    // Validasi input kabupaten id
    const dataKabupaten = await Kabupaten.findByPk(kabupaten_id);
    if (!dataKabupaten) {
      return res.status(404).json({
        message: "Proses menambahkan data dihentikan! Kabupaten induk tidak ditemukan."
      });
    }

    const newKec = await Kecamatan.create({
      nama_kecamatan: nama_kecamatan.trim().toUpperCase(),
      kabupaten_id
    });

    res.status(201).json({
      message: "Data kecamatan berhasil ditambahkan!",
      data: newKec
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

export const updateKecamatan = async (req, res) => {
  try {
    const { 
      nama_kecamatan,
      kabupaten_id
    } = req.body;

    // Validasi input dasar
    if (!nama_kecamatan || typeof nama_kecamatan !== 'string' || nama_kecamatan.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama kecamatan wajib diisi dengan teks yang valid!"
      });
    }

    const kecamatan = await Kecamatan.findByPk(req.params.id);
    if (!kecamatan) {
      return res.status(404).json({
        message: "Data kecamatan tidak ditemukan."
      });
    }

    // Validasi input kabupaten id
    if (kabupaten_id) {
      const dataKabupaten = await Kabupaten.findByPk(kabupaten_id);
      if (!dataKabupaten) {
        return res.status(404).json({
          message: "Proses memperbarui data dihentikan! Kabupaten induk idak valid."
        });
      }
    }

    await Kecamatan.update({
      nama_kecamatan: nama_kecamatan.trim().toUpperCase(),
      kabupaten_id
    }, {
      where: { id: kecamatan.id }
    });

    const updateKec = await Kecamatan.findByPk(kecamatan.id);

    res.status(200).json({
      message: "Data kecamatan berhasil diperbarui!",
      data: updateKec
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

export const deleteKecamatan = async (req, res) => {
  try {
    const { id } = req.params;

    const kecamatan = await Kecamatan.findByPk(id);
    if (!kecamatan) {
      return res.status(404).json({
        message: "Data kecamatan tidak ditemukan."
      });
    }

    // Validasi relasi data
    const relasiData = await DesaAdat.findOne({
      where: { kecamatan_id: id }
    });

    if (relasiData) {
      return res.status(400).json({
        message: "Data kecamatan tidak dapat dihapus! terdapat data Desa Adat yang menginduk ke kecamatan ini."
      });
    }

    await kecamatan.destroy();

    res.status(200).json({
      message: "Data kecamatan berhasil dihapus!"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};