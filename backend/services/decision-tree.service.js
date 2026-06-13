import AturanAdatBali from "../models/aturan-adat.model.js";

/**
 * CORE ENGINE: Mencocokkan input krama dengan aturan adat di database secara dinamis (Decision Tree)
 * @param {string} kategori - Kategori pohon (LAHIR, PENGANGKATAN, KAWIN, CERAI)
 * @param {Object} inputKrama - Input parameter riil dari krama (misal: { jenis_perkawinan: 'Biasa', posisi: 'suami' })
 * @param {Object} t - Sequelize Transaction
 */

export const mappingAturanAdatBali = async (
  kategori,
  inputKrama,
  t = null
) => {
  // Mengambil daftar semua aturan adat bali yang aktif
  const daftarAturanAdat = await AturanAdatBali.findAll({
    where: {
      kategori: kategori,
      status_aturan: "Aktif"
    },
    transaction: t
  });

  // Mencari aturan yang kriteria kondisi di file JSON cocok dengan inputKrama
  const matchAturanAdat = daftarAturanAdat.find(aturan => {
    const kriteria = typeof aturan.kriteria_kondisi === 'string' 
      ? JSON.parse(aturan.kriteria_kondisi) 
      : aturan.kriteria_kondisi

    if (!kriteria || Object.keys(kriteria).length === 0) {
      return false;
    }

    return Object.keys(kriteria).every(key => {
      // 1. Menangani Logika Angka (e.g., ">1")
      if (typeof kriteria[key] === 'string' && kriteria[key].startsWith('>')) {
        const angkaBatas = parseInt(kriteria[key].replace('>', ''), 10);
        return parseInt(inputKrama[key], 10) > angkaBatas;
      }

      // 2. Pencocokkan Standar agar "1" cocok dengan 1
      return String(kriteria[key]) === String(inputKrama[key]);
    });
  });

  if (!matchAturanAdat) {
    throw new Error(`Tidak ada aturan adat yang cocok dengan kondisi kategori ${kategori} ini. Silakan hubungi Pakar!`);
  }

  return {
    status_peran_adat: matchAturanAdat.status_peran_adat,
    garis_keturunan: matchAturanAdat.garis_keturunan,
    dasar_keputusan: matchAturanAdat.dasar_keputusan
  };
};