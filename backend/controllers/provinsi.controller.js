import {
  Provinsi,
  Kabupaten
} from "../models/associations.js";

export const getAllProvinsi = async (req, res) => {
  try {
    const dataProv = await Provinsi.findAll({
      include: [{
        model: Kabupaten,
        as: "kabupaten_di_provinsi"
      }]
    });

    return res.status(200).json({
      message: "Berhasil mengambil data provinsi!",
      data: dataProv
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getProvinsiById = async (req, res) => {
  try {
    const dataProv = await Provinsi.findByPk(req.params.id, {
      include: [{
        model: Kabupaten,
        as: "kabupaten_di_provinsi"
      }]
    });

    if (!dataProv) {
      return res.status(404).json({
        message: "Data provinsi tidak ditemukan."
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil data provinsi!",
      data: dataProv
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createProvinsi = async (req, res) => {
  try {
    const { nama_provinsi } = req.body;

    // Validasi input dasar
    if (!nama_provinsi || typeof nama_provinsi !== 'string' || nama_provinsi.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama provinsi wajib diisi dengan teks yang valid!"
      });
    }

    const newProv = await Provinsi.create({
      nama_provinsi: nama_provinsi.trim().toUpperCase()
    });

    return res.status(201).json({
      message: "Data provinsi berhasil ditambahkan!",
      data: newProv
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const updateProvinsi = async (req, res) => {
  try {
    const { nama_provinsi } = req.body;

    // Validasi input dasar
    if (!nama_provinsi || typeof nama_provinsi !== 'string' || nama_provinsi.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama provinsi wajib diisi dengan teks yang valid!"
      });
    }

    const provinsi = await Provinsi.findByPk(req.params.id);

    if (!provinsi) {
      return res.status(404).json({
        message: "Data provinsi tidak ditemukan."
      });
    }

    await Provinsi.update({
      nama_provinsi: nama_provinsi.trim().toUpperCase()
    }, { where: { id: provinsi.id } });

    const updateProv = await Provinsi.findByPk(provinsi.id);

    return res.status(200).json({
      message: "Data provinsi berhasil diperbarui!",
      data: updateProv
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const deleteProvinsi = async (req, res) => {
  try {
    const { id } = req.params;

    const provinsi = await Provinsi.findByPk(id);
    if (!provinsi) {
      return res.status(404).json({
        message: "Data provinsi tidak ditemukan."
      });
    }

    // Validasi relasi data
    const relasiData = await Kabupaten.findOne({
      where: { provinsi_id: id }
    });

    if (relasiData) {
      return res.status(400).json({
        message: "Data provinsi tidak dapat dihapus! Terdapat data Kabupaten yang menginduk ke provinsi ini."
      });
    }

    await provinsi.destroy();

    return res.status(200).json({
      message: "Data provinsi berhasil dihapus!"
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};