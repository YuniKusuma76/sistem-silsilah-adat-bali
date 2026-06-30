import { Op } from "sequelize";
import RelasiKrama from "../models/relasi.model.js";

// HELPER: Menghitung jumlah orang tua yang sama dalam mengangkat anak
export const hitungJumlahPengangkatan = async (kepala_keluarga_id,t = null) => {
  return RelasiKrama.count({
    where: {
      status_hubungan: "Anak Angkat",
      status_verifikasi: "Disetujui",
      [Op.or]: [
        { ayah_id: kepala_keluarga_id },
        { ibu_id: kepala_keluarga_id }
      ]
    },
    transaction: t
  });
};