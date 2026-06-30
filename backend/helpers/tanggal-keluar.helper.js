import { Op } from "sequelize";
import { Perkawinan, RiwayatKeluarga } from "../models/associations.js";

// HALPER: Menghitung tanggal keluar anak berdasarkan kronologi peristiwa
export const hitungTanggalKeluarAnak = async (anak_id, tanggal_jangkar, t) => {
  if (!tanggal_jangkar) return null;

  const jamSekarang = new Date().toTimeString().split(' ')[0];
  const jangkarDateOnly = tanggal_jangkar.includes('T') 
    ? tanggal_jangkar.split('T')[0] 
    : tanggal_jangkar.split(' ')[0];

  const [perkawinanAnak, riwayatLain] = await Promise.all([
    Perkawinan.findOne({
      where: {
        [Op.or]: [
          { suami_id: anak_id }, 
          { istri_id: anak_id }
        ],
        tanggal_perkawinan: { [Op.gt]: jangkarDateOnly },
        status_verifikasi: "Disetujui"
      },
      attributes: ["tanggal_perkawinan"],
      order: [["tanggal_perkawinan", "ASC"]],
      transaction: t
    }),
    RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        awal_masuk: { [Op.gt]: new Date(`${jangkarDateOnly} ${jamSekarang}`) },
        kategori_event: { [Op.in]: ["PENGANGKATAN", "CERAI"] } 
      },
      attributes: ["awal_masuk"],
      order: [["awal_masuk", "ASC"]],
      transaction: t
    })
  ]);
  
  // Membandingkan tanggal peristiwa yang terjadi terlebih dahulu untuk diurutkan
  const tanggalKawin = perkawinanAnak ? new Date(perkawinanAnak.tanggal_perkawinan) : null;
  const tanggalAngkat = riwayatLain ? new Date(new Date(riwayatLain.awal_masuk).toISOString().split('T')[0]) : null;

  let tanggalTerdekat = null;

  if (tanggalKawin && tanggalAngkat) {
    tanggalTerdekat = tanggalKawin < tanggalAngkat ? tanggalKawin : tanggalAngkat;
  } else if (tanggalKawin) {
    tanggalTerdekat = tanggalKawin;
  } else if (tanggalAngkat) {
    tanggalTerdekat = tanggalAngkat;
  }

  if (tanggalTerdekat) {
    return tanggalTerdekat.toISOString().split('T')[0];
  }

  return null;
};