import {
  DesaAdat,
  Kecamatan,
  Kabupaten,
  Provinsi,
  User,
  PermohonanRole,
  PermohonanDesa,
  KramaBali
} from "../models/associations.js";

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

export const getAllDesaAdat = async (req, res) => {
  try {
    const dataDesa = await DesaAdat.findAll({
      include: DESA_ADAT_INCLUDE
    });

    res.status(200).json({
      message: "Berhasil mengambil data desa adat!",
      data: dataDesa
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getDesaAdatById = async (req, res) => {
  try {
    const dataDesa = await DesaAdat.findByPk(req.params.id, {
      include: DESA_ADAT_INCLUDE
    });

    if (!dataDesa) {
      return res.status(404).json({
        message: "Data desa adat tidak ditemukan."
      });
    }

    res.status(200).json({
      message: "Berhasil mengambil data desa adat!",
      data: dataDesa
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const createDesaAdat = async (req, res) => {
  try {
    const { 
      nama_desa_adat,
      kecamatan_id 
    } = req.body;

    // Validasi input dasar
    if (!nama_desa_adat || typeof nama_desa_adat !== 'string' || nama_desa_adat.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama desa adat wajib diisi dengan teks yang valid!"
      });
    }

    // Validasi input kecamatan id
    const dataKecamatan = await Kecamatan.findByPk(kecamatan_id);
    if (!dataKecamatan) {
      return res.status(404).json({
        message: "Proses menambahkan data dihentikan! Kecamatan induk tidak ditemukan."
      });
    }

    const newDesa = await DesaAdat.create({
      nama_desa_adat: nama_desa_adat.trim().toUpperCase(),
      kecamatan_id
    });

    res.status(201).json({
      message: "Data desa adat berhasil ditambahkan!",
      data: newDesa
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

export const updateDesaAdat = async (req, res) => {
  try {
    const { 
      nama_desa_adat,
      kecamatan_id
    } = req.body;

    // Validasi input dasar
    if (!nama_desa_adat || typeof nama_desa_adat !== 'string' || nama_desa_adat.trim() === "") {
      return res.status(400).json({
        message: "Kolom nama desa adat wajib diisi dengan teks yang valid!"
      });
    }

    const desaAdat = await DesaAdat.findByPk(req.params.id);
    if (!desaAdat) {
      return res.status(404).json({
        message: "Data desa adat tidak ditemukan."
      });
    }

    // Validasi input kecamatan id
    if (kecamatan_id) {
      const dataKecamatan = await Kecamatan.findByPk(kecamatan_id);
      if (!dataKecamatan) {
        return res.status(404).json({
          message: "Proses memperbarui data dihentikan! Kecamatan induk tidak valid."
        });
      }
    }

    await DesaAdat.update({
      nama_desa_adat: nama_desa_adat.trim().toUpperCase(),
      kecamatan_id
    }, {
      where: { id: desaAdat.id }
    });

    const updateDesa = await DesaAdat.findByPk(desaAdat.id);

    res.status(200).json({
      message: "Data desa adat berhasil diperbarui!",
      data: updateDesa
    });
  } catch (error) {
    res.status(400).json({
      message: error.message
    });
  }
};

export const deleteDesaAdat = async (req, res) => {
  try {
    const { id } = req.params;

    const desaAdat = await DesaAdat.findByPk(id);
    if (!desaAdat) {
      return res.status(404).json({
        message: "Data desa adat tidak ditemukan."
      });
    }

    // Validasi relasi data
    const dataUser = await User.findOne({
      where: { desa_adat_id: id }
    });
    if (dataUser) {
      return res.status(400).json({
        message: "Data desa adat tidak dapat dihapus! Terdapat data User yang terdaftar aktif di desa adat ini."
      });
    }

    const dataMutasiDesa = await PermohonanDesa.findOne({
      where: {
        [Op.or]: [
          { desa_adat_id_asal: id },
          { desa_adat_id_tujuan: id }
        ]
      }
    });
    if (dataMutasiDesa) {
      return res.status(400).json({
        message: "Data desa adat tidak dapat dihapus! Wilayah desa adat ini masih tercatat dalam riwayat berkas permohonan mutasi desa."
      });
    }

    const dataMutasiRole = await PermohonanRole.findOne({
      where: { desa_adat_id_tujuan: id }
    });
    if (dataMutasiRole) {
      return res.status(400).json({
        message: "Data desa adat tidak dapat dihapus! Wilayah desa adat ini masih tercatat dalam riwayat berkas permohonan mutasi role."
      });
    }

    const dataKrama = await KramaBali.findOne({
      where: { desa_adat_id: id }
    });
    if (dataKrama) {
      return res.status(400).json({
        message: "Data desa adat tidak dapat dihapus! Terdapat data Krama yang terdaftar aktif di desa adat ini."
      });
    }

    await desaAdat.destroy();

    res.status(200).json({
      message: "Data desa adat berhasil dihapus!"
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};