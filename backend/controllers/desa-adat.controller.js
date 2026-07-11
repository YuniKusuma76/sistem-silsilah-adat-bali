import { Op } from "sequelize";
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
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

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

    return res.status(200).json({
      message: "Berhasil mengambil data desa adat!",
      data: dataDesa
    });
  } catch (error) {
    return res.status(500).json({
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

    return res.status(200).json({
      message: "Berhasil mengambil data desa adat!",
      data: dataDesa
    });
  } catch (error) {
    return res.status(500).json({
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

    const formattedName = nama_desa_adat.trim().toUpperCase();
    const newDesa = await DesaAdat.create({
      nama_desa_adat: formattedName,
      kecamatan_id
    });

    const senderId = req.user?.id || null;

    return res.status(201).json({
      message: "Data desa adat berhasil ditambahkan!",
      data: newDesa
    });
  } catch (error) {
    return res.status(500).json({
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

    const formattedName = nama_desa_adat.trim().toUpperCase();
    await DesaAdat.update({
      nama_desa_adat: formattedName,
      kecamatan_id
    }, { where: { id: desaAdat.id } });

    const updateDesa = await DesaAdat.findByPk(desaAdat.id);
    const senderId = req.user?.id || null;

    await kirimNotifikasiSistem(req, {
      judul: "Pembaruan Wilayah Desa Adat",
      deskripsi: `Data Desa Adat telah diperbarui menjadi ${formattedName}.`,
      kategori: "INFORMASI",
      tautan_fitur: null,
      desa_adat_id: desaAdat.id,
      sender_id: senderId,
      kontak_pesan_id: null,
      user_id: null
    });

    return res.status(200).json({
      message: "Data desa adat berhasil diperbarui!",
      data: updateDesa
    });
  } catch (error) {
    return res.status(500).json({
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

    return res.status(200).json({
      message: "Data desa adat berhasil dihapus!"
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};