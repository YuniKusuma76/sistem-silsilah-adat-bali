import { Op } from "sequelize";
import { Perkawinan, RiwayatKeluarga } from "../models/associations.js";

// HELPER: Menghitung tanggal keluar anak berdasarkan kronologi peristiwa di masa depan terdekat
export const hitungTanggalKeluarAnak = async (anak_id, tanggal_jangkar, t) => {
  if (!tanggal_jangkar) return null;

  const jangkarDateOnly = tanggal_jangkar.includes('T') 
    ? tanggal_jangkar.split('T')[0] 
    : tanggal_jangkar.split(' ')[0];

  const targetJangkarTime = new Date(`${jangkarDateOnly}T00:00:00.000Z`).getTime();

  // mengambil seluruh perkawinan sah krama 
  const daftarPerkawinan = await Perkawinan.findAll({
    where: {
      [Op.or]: [
        { suami_id: anak_id }, 
        { istri_id: anak_id }
      ],
      status_verifikasi: "Disetujui"
    },
    attributes: ["tanggal_perkawinan"],
    order: [["tanggal_perkawinan", "ASC"]],
    transaction: t
  });

  // mengambil seluruh riwayat perpindahan keluarga
  const daftarRiwayatLain = await RiwayatKeluarga.findAll({
    where: {
      krama_id: anak_id,
      kategori_event: { [Op.in]: ["PENGANGKATAN", "CERAI"] } 
    },
    attributes: ["id", "awal_masuk", "kategori_event"],
    order: [["awal_masuk", "ASC"]],
    transaction: t
  });

  const dapatkanAwalHariTime = (inputData) => {
    if (!inputData) return 0;
    const str = inputData instanceof Date 
      ? inputData.toISOString().split('T')[0]
      : inputData.split('T')[0].split(' ')[0];
    return new Date(`${str}T00:00:00.000Z`).getTime();
  };

  const dapatkanStringTanggalMurni = (inputData) => {
    if (!inputData) return null;
    return inputData instanceof Date 
      ? inputData.toISOString().split('T')[0]
      : inputData.split('T')[0].split(' ')[0];
  };

  // SKENARIO 1: DETEKSI STRUKTURAL PENGANGKATAN
  const riwayatPengangkatan = daftarRiwayatLain.find(r => r.kategori_event === "PENGANGKATAN");

  if (riwayatPengangkatan && riwayatPengangkatan.awal_masuk) {
    const timeAngkat = dapatkanAwalHariTime(riwayatPengangkatan.awal_masuk);
    const tglAngkatBersihStr = dapatkanStringTanggalMurni(riwayatPengangkatan.awal_masuk);

    const riwayatLahirEksisting = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kategori_event: "LAHIR"
      },
      transaction: t
    });

    if (riwayatLahirEksisting && timeAngkat > targetJangkarTime) {
      const limitAkhirTepatHariH = `${tglAngkatBersihStr}T23:59:59.999Z`;
      if (riwayatLahirEksisting.akhir_masuk !== limitAkhirTepatHariH) {
        await RiwayatKeluarga.update({ 
          akhir_masuk: limitAkhirTepatHariH 
        },{ 
          where: { id: riwayatLahirEksisting.id }, 
          transaction: t 
        });
      }
    }

    if (timeAngkat > targetJangkarTime) {
      return tglAngkatBersihStr;
    }
  }

  let timeTerdekatMasaDepan = null;
  let tglTerdekatMasaDepanStr = null;
  let rentangWaktuTerkecil = Infinity;

  // SKENARIO 2: DETEKSI PERISTIWA BERIKUTNYA DI MASA DEPAN (FORWARD STITCHING)
  for (const perkawinan of daftarPerkawinan) {
    if (!perkawinan.tanggal_perkawinan) continue;
    
    const timeKawin = dapatkanAwalHariTime(perkawinan.tanggal_perkawinan);
    
    if (timeKawin >= targetJangkarTime) {
      const selisih = timeKawin - targetJangkarTime;
      if (selisih < rentangWaktuTerkecil) {
        rentangWaktuTerkecil = selisih;
        timeTerdekatMasaDepan = timeKawin;
        tglTerdekatMasaDepanStr = dapatkanStringTanggalMurni(perkawinan.tanggal_perkawinan);
      }
    }
  }

  for (const riwayat of daftarRiwayatLain) {
    if (!riwayat.awal_masuk) continue;
    
    const timeMutasi = dapatkanAwalHariTime(riwayat.awal_masuk);
    
    if (timeMutasi >= targetJangkarTime) {
      const selisih = timeMutasi - targetJangkarTime;
      if (selisih < rentangWaktuTerkecil) {
        rentangWaktuTerkecil = selisih;
        timeTerdekatMasaDepan = timeMutasi;
        tglTerdekatMasaDepanStr = dapatkanStringTanggalMurni(riwayat.awal_masuk);
      }
    }
  }

  if (timeTerdekatMasaDepan !== null) {
    return tglTerdekatMasaDepanStr;
  }

  // SKENARIO 3: FALLBACK ANOMALI STRUKTURAL (BACKWARD STITCHING)
  // ===================================================================
  // Jika TIDAK ADA event di masa depan, namun krama ini TERNYATA memiliki 
  // event perkawinan masa lalu (misal lahir disetel 1980 tapi kawin terdaftar 1972),
  // potong akhir masuk riwayat lahir tepat pada tanggal perkawinan masa lalu tersebut.
  if (daftarPerkawinan.length > 0) {
    const perkawinanTerakhirLalu = daftarPerkawinan[daftarPerkawinan.length - 1];
    return dapatkanStringTanggalMurni(perkawinanTerakhirLalu.tanggal_perkawinan);
  }

  return null;
};