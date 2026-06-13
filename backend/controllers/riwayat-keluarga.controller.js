import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RiwayatKeluarga,
  KramaBali,
  Keluarga
} from "../models/associations.js"

// Validasi Input Valid
const VALID_KEDUDUKAN = [
  "Kepala Keluarga", 
  "Anggota"
];

// Data Riwayat Keluarga Include
const RIWAYAT_KELUARGA_INCLUDE = [
  {
    model: KramaBali,
    as: "krama_adat",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data"]
  },{
    model: Keluarga,
    as: "detail_keluarga",
  }
]

export const getAllRiwayatKeluarga = async (req, res) => {
  try {
    const riwayatList = await RiwayatKeluarga.findAll({
      include: RIWAYAT_KELUARGA_INCLUDE,
      order: [["awal_masuk", "DESC"]]
    });
    
    res.status(200).json({
      message: "Berhasil mengambil data riwayat keluarga!",
      data: riwayatList
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getRiwayatKeluargaById = async (req, res) => {
  try {
    const dataRiwayat = await RiwayatKeluarga.findByPk(req.params.id, {
      include: RIWAYAT_KELUARGA_INCLUDE
    });
    
    if (!dataRiwayat) {
      return res.status(404).json({
        message: "Data riwayat keluarga tidak ditemukan."
      });
    }

    res.status(200).json({
      message: "Berhasil mengambil data riwayat keluarga!",
      data: dataRiwayat
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};