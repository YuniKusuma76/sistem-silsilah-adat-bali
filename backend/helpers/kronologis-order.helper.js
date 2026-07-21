import { RiwayatKeluarga } from "../models/associations.js";

export const rekonsiliasiKronologiKeluarga = async (anak_id, t) => {
  const daftarRiwayat = await RiwayatKeluarga.findAll({
    where: { krama_id: anak_id },
    order: [
      ["bobot_event", "ASC"],
      ["awal_masuk", "ASC"]
    ],
    transaction: t
  });

  if (daftarRiwayat.length <= 1) return;

  const dapatkanDateOnlyStr = (inputData) => {
    if (!inputData) return null;
    return inputData instanceof Date 
      ? inputData.toISOString().split('T')[0] 
      : inputData.split('T')[0].split(' ')[0];
  };

  for (let i = 0; i < daftarRiwayat.length; i++) {
    const riwayatSaatIni = daftarRiwayat[i];
    const riwayatBerikutnya = daftarRiwayat[i + 1];

    if (riwayatBerikutnya) {
      const tglBerikutnyaStr = dapatkanDateOnlyStr(riwayatBerikutnya.awal_masuk);
      const targetAkhirMasukTimestamp = `${tglBerikutnyaStr}T00:00:00.000Z`;

      if (riwayatSaatIni.akhir_masuk !== targetAkhirMasukTimestamp) {
        await RiwayatKeluarga.update({ 
          akhir_masuk: new Date(targetAkhirMasukTimestamp) 
        },{ 
          where: { id: riwayatSaatIni.id }, 
          transaction: t 
        });
      }
    } else {
      if (riwayatSaatIni.akhir_masuk !== null) {
        await RiwayatKeluarga.update({ 
          akhir_masuk: null 
        },{ 
          where: { id: riwayatSaatIni.id }, 
          transaction: t 
        });
      }
    }
  }
};