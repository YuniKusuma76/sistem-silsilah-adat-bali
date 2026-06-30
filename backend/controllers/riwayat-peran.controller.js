import { Op } from "sequelize";
import {
  RiwayatPeranAdat,
  KramaBali
} from "../models/associations.js";

// Validasi Input Valid
const VALID_STATUS_PERAN_ADAT = [
  "Tidak Memiliki Status Peran Adat", 
  "Purusa", 
  "Predana"
];

const VALID_JENIS_PERKAWINAN = [
  "Biasa", 
  "Nyentana", 
  "Pade Gelahang", 
  "Tidak Diketahui"
];

const VALID_GARIS_KETURUNAN = [
  "Tidak Memiliki Garis Keturunan", 
  "Purusa", 
  "Purusa Nyentana", 
  "Purusa Pade Gelehang", 
  "Predana"
];

// Data Riwayat Peran Adat Include
const RIWAYAT_PERAN_INCLUDE = [
  {
    model: KramaBali,
    as: "krama_adat",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data"]
  }
];

export const getAllRiwayatPeranAdat = async (req, res) => {
  try {
    const riwayatPeranAdatList = await RiwayatPeranAdat.findAll({
      include: RIWAYAT_PERAN_INCLUDE,
      order: [["id", "DESC"]]
    });

    return res.status(200).json({
      message: "Berhasil mengambil data riwayat peran adat!",
      data: riwayatPeranAdatList
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getRiwayatPeranAdatById = async (req, res) => {
  try {
    const dataRiwayatPeranAdat = await RiwayatPeranAdat.findByPk(req.params.id, {
      include: RIWAYAT_PERAN_INCLUDE
    });

    if (!dataRiwayatPeranAdat) {
      return res.status(404).json({
        message: "Data riwayat peran adat tidak ditemukan."
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil data riwayat peran adat!",
      data: dataRiwayatPeranAdat
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};