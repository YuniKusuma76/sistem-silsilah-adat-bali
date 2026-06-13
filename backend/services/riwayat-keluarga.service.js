import { Op } from "sequelize";
import { RiwayatKeluarga } from "../models/associations.js";

// Menutup riwayat keluarga aktif sebelumnya
export const tutupRiwayatKeluarga = async (
  krama_id, 
  event_date,
  t = null
) => {
  // memastikan data krama target tersedia
  if (!krama_id) return;

  await RiwayatKeluarga.update(
    { akhir_masuk: event_date },
    {
      where: {
        krama_id,
        awal_masuk: { [Op.lt]: event_date },
        [Op.or]: [
          { akhir_masuk: null },
          { akhir_masuk: { [Op.ne]: event_date } }
        ]
      },
      transaction: t
    }
  );
};

/**
 * Menyimpan riwayat keluarga yang baru
 * @param allow_multiple - Jika false, akan menutup riwayat aktif sebelumnya
 */
export const simpanRiwayatKeluarga = async ({
  krama_id,
  keluarga_id,
  kedudukan,
  dasar_keputusan,
  event_date = null,
  allow_multiple = false,
  akhir_masuk = null 
}, t = null) => {
  // Validasi keluarga dapat aktif bersamaan
  if (!allow_multiple) {
    const closeDate = event_date || new Date();
    await tutupRiwayatKeluarga(krama_id, closeDate, t);
  }

  // Validasi event date riwayat keluarga sudah sesuai
  const existing = await RiwayatKeluarga.findOne({
    where: {
      krama_id,
      keluarga_id,
      awal_masuk: event_date
    },
    transaction: t
  });

  if (existing) {
    return await existing.update({
      kedudukan,
      dasar_keputusan,
      akhir_masuk
    }, { 
      transaction: t 
    });
  }

  return RiwayatKeluarga.create({
    krama_id,
    keluarga_id,
    kedudukan,
    dasar_keputusan,
    awal_masuk: event_date,
    akhir_masuk: akhir_masuk 
  }, { 
    transaction: t 
  });
};