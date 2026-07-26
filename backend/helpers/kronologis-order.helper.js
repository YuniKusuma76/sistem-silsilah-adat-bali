import { RiwayatKeluarga } from "../models/associations.js";

export const rekonsiliasiKronologiKeluarga = async (anak_id, t) => {
  const daftarRiwayat = await RiwayatKeluarga.findAll({
    where: { krama_id: anak_id },
    order: [
      ["bobot_event", "ASC"],
      ["awal_masuk", "ASC"],
      ["id", "ASC"]
    ],
    transaction: t
  });

  if (!daftarRiwayat || daftarRiwayat.length <= 1) return;

  const dapatkanDateOnlyStr = (inputData) => {
    if (!inputData) return null;
    return inputData instanceof Date 
      ? inputData.toISOString().split('T')[0] 
      : String(inputData).split('T')[0].split(' ')[0];
  };

  for (let i = 0; i < daftarRiwayat.length; i++) {
    const riwayatSaatIni = daftarRiwayat[i];
    const riwayatBerikutnya = daftarRiwayat[i + 1];

    if (riwayatBerikutnya) {
      const tglBerikutnyaStr = dapatkanDateOnlyStr(riwayatBerikutnya.awal_masuk);
      const targetAkhirMasukObj = new Date(`${tglBerikutnyaStr}T00:00:00.000Z`);
      const tglAkhirSaatIniStr = dapatkanDateOnlyStr(riwayatSaatIni.akhir_masuk);

      if (tglAkhirSaatIniStr !== tglBerikutnyaStr) {
        await riwayatSaatIni.update({ 
          akhir_masuk: targetAkhirMasukObj 
        }, { transaction: t });
      }
    } else {
      if (riwayatSaatIni.akhir_masuk !== null) {
        await riwayatSaatIni.update({ 
          akhir_masuk: null 
        }, { transaction: t });
      }
    }
  }
};