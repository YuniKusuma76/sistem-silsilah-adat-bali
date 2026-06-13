import { Op } from "sequelize";
import { 
  Perkawinan, 
  RiwayatKeluarga 
} from "../models/associations.js";

// HALPER: Menghitung tanggal keluar anak berdasarkan kronologi peristiwa
export const hitungTanggalKeluarAnak = async (
  anak_id, 
  tanggal_jangkar, // Tanggal Lahir (anak kandung) atau Tanggal Pengangkatan (anak angkat)
  t
) => {
  const [perkawinanAnak, riwayatLain] = await Promise.all([
    // CASE 1: Mencari apakah anak ini pernah kawin setelah tanggal jangkar
    Perkawinan.findOne({
      where: {
        [Op.or]: [
          { suami_id: anak_id }, 
          { istri_id: anak_id }
        ],
        tanggal_perkawinan: { [Op.gt]: tanggal_jangkar }
      },
      attributes: ["tanggal_perkawinan"],
      order: [["tanggal_perkawinan", "ASC"]],
      transaction: t
    }),
    RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        awal_masuk: { [Op.gt]: tanggal_jangkar }
      },
      attributes: ["awal_masuk"],
      order: [["awal_masuk", "ASC"]],
      transaction: t
    })
  ]);
  
  // Membandingkan tanggal peristiwa yang terjadi terlebih dahulu untuk diurutkan
  const tanggalKawin = perkawinanAnak ? new Date(perkawinanAnak.tanggal_perkawinan) : null;
  const tanggalAngkat = riwayatLain ? new Date(riwayatLain.awal_masuk) : null;

  if (tanggalKawin && tanggalAngkat) {
    return tanggalKawin < tanggalAngkat 
      ? perkawinanAnak.tanggal_perkawinan 
      : riwayatLain.awal_masuk;
  } else if (tanggalKawin) {
    return perkawinanAnak.tanggal_perkawinan;
  } else if (tanggalAngkat) {
    return riwayatLain.awal_masuk;
  }

  return null;
};