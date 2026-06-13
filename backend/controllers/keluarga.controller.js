import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Keluarga,
  KramaBali,
  RiwayatKeluarga
} from "../models/associations.js";

// Validasi Input Valid
const VALID_JENIS_KELUARGA = [
  "Keluarga Asal", 
  "Biasa", 
  "Nyentana", 
  "Pade Gelahang", 
  "Keluarga Angkat", 
  "Leluhur"
];

const VALID_STATUS_KELUARGA = [
  "Aktif", 
  "Non-Aktif", 
  "History"
];

// Data Keluarga Include
const KELUARGA_INCLUDE = [
  {
    model: KramaBali,
    as: "kepala_keluarga",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data"]
  },{
    model: RiwayatKeluarga,
    as: "riwayat_anggota_keluarga",
    include: [
      {
        model: KramaBali,
        as: "krama_adat",
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data"]
      }
    ]
  }
]

export const getAllKeluarga = async (req, res) => {
  try {
    const keluargaList = await Keluarga.findAll({
      include: KELUARGA_INCLUDE
    });

    res.status(200).json({
      message: "Berhasil mengambil data keluarga!",
      data: keluargaList
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getKeluargaById = async (req, res) => {
  try {
    const dataKeluarga = await Keluarga.findByPk(req.params.id, {
      include: KELUARGA_INCLUDE
    });

    if (!dataKeluarga) {
      return res.status(404).json({
        message: "Data keluarga tidak ditemukan."
      });
    }
    
    res.status(200).json({
      message: "Berhasil mengambil data keluarga!",
      data: dataKeluarga
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};