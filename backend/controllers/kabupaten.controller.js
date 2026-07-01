import {
  Kabupaten,
  Provinsi,
  Kecamatan
} from "../models/associations.js";

export const getAllKabupaten = async (req, res) => {
  try {
    const dataKab = await Kabupaten.findAll({
      include: [{
        model: Provinsi,
        as: "provinsi"
      }]
    });

    return res.status(200).json({
      message: "Berhasil mengambil data kabupaten!",
      data: dataKab
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getKabupatenById = async (req, res) => {
  try {
    const dataKab = await Kabupaten.findByPk(req.params.id, {
      include: [{
        model: Provinsi,
        as: "provinsi"
      }]
    });

    if (!dataKab) {
      return res.status(404).json({
        message: "Data kabupaten tidak ditemukan."
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil data kabupaten!",
      data: dataKab
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createKabupaten = async (req, res) => {
  try {
    const { 
      nama_kabupaten,
      provinsi_id
    } = req.body;

    // Validasi input dasar
    if (!nama_kabupaten || typeof nama_kabupaten !== 'string' || nama_kabupaten.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama kabupaten wajib diisi dengan teks yang valid!"
      });
    }

    // Validasi input provinsi id
    const dataProvinsi = await Provinsi.findByPk(provinsi_id);
    if (!dataProvinsi) {
      return res.status(404).json({
        message: "Proses menambahkan data dihentikan! Provinsi induk tidak ditemukan."
      });
    }

    const newKab = await Kabupaten.create({
      nama_kabupaten: nama_kabupaten.trim().toUpperCase(),
      provinsi_id
    });

    return res.status(201).json({
      message: "Data kabupaten berhasil ditambahkan!",
      data: newKab
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const updateKabupaten = async (req, res) => {
  try {
    const { 
      nama_kabupaten,
      provinsi_id 
    } = req.body;

    // Validasi input dasar
    if (!nama_kabupaten || typeof nama_kabupaten !== 'string' || nama_kabupaten.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama kabupaten wajib diisi dengan teks yang valid!"
      });
    }

    const kabupaten = await Kabupaten.findByPk(req.params.id);
    if (!kabupaten) {
      return res.status(404).json({
        message: "Data kabupaten tidak ditemukan."
      });
    }

    // Validasi input provinsi id
    if (provinsi_id) {
      const dataProvinsi = await Provinsi.findByPk(provinsi_id);
      if (!dataProvinsi) {
        return res.status(404).json({
          message: "Proses memperbarui data dihentikan! Provinsi induk tidak valid."
        });
      }
    }

    await Kabupaten.update({
      nama_kabupaten: nama_kabupaten.trim().toUpperCase(),
      provinsi_id
    }, { where: { id: kabupaten.id } });

    const updateKab = await Kabupaten.findByPk(kabupaten.id);

    return res.status(200).json({
      message: "Data kabupaten berhasil diperbarui!",
      data: updateKab
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const deleteKabupaten = async (req, res) => {
  try {
    const { id } = req.params;

    const kabupaten = await Kabupaten.findByPk(id);
    if (!kabupaten) {
      return res.status(404).json({
        message: "Data kabupaten tidak ditemukan."
      });
    }

    // Validasi relasi data
    const relasiData = await Kecamatan.findOne({
      where: { kabupaten_id: id } 
    });

    if (relasiData) {
      return res.status(400).json({
        message: "Data kabupaten tidak dapat dihapus! Terdapat data Kecamatan yang menginduk ke kabupaten ini."
      });
    }

    await kabupaten.destroy();

    return res.status(200).json({
      message: "Data kabupaten berhasil dihapus!"
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};