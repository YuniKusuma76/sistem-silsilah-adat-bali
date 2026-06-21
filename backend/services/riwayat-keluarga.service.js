import { Op } from "sequelize";
import { RiwayatKeluarga } from "../models/associations.js";

const BOBOT_KATEGORI_MASUK = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

// Menutup riwayat keluarga aktif sebelumnya
export const tutupRiwayatKeluarga = async (
  krama_id, 
  event_date, 
  kategori_baru, 
  t = null
) => {
  if (!krama_id) return;

  try {
    await RiwayatKeluarga.update(
      { akhir_masuk: event_date },
      {
        where: {
          krama_id,
          akhir_masuk: null,
          awal_masuk: { [Op.lte]: event_date },
          [Op.or]: [
            { awal_masuk: { [Op.lt]: event_date } },
            {
              [Op.and]: [
                { awal_masuk: event_date },
                { kategori_masuk: { [Op.ne]: kategori_baru } }
              ]
            }
          ]
        },
        transaction: t
      }
    );
  } catch (error) {
    console.error("Error pada tutupRiwayatKeluarga:", error.message);
    throw error;
  }
};

/**
 * Menyimpan riwayat hubungan keluarga yang baru hasil sinkronisasi adat/kependudukan
 * @param allow_multiple - Jika false, otomatis akan menutup hubungan keluarga aktif sebelumnya (misal saat kawin keluar KK)
 */
export const simpanRiwayatKeluarga = async ({
  krama_id,
  keluarga_id,
  kedudukan,
  kategori_masuk,
  dasar_keputusan,
  event_date = null,
  allow_multiple = false,
  akhir_masuk = null 
}, t = null) => {
  // Validasi internal kolom wajib
  if (!krama_id || !keluarga_id || !kedudukan || !kategori_masuk || !dasar_keputusan) {
    throw new Error("Gagal menyimpan riwayat keluarga! Parameter data  tidak lengkap.");
  }

  const finalEventDate = event_date || new Date();

  try {
    if (!allow_multiple) {
      await tutupRiwayatKeluarga(krama_id, finalEventDate, kategori_masuk, t);
    }
  
    const existing = await RiwayatKeluarga.findOne({
      where: {
        krama_id,
        keluarga_id,
        kategori_masuk,
        awal_masuk: finalEventDate
      },
      transaction: t
    });

    if (existing) {
      return await existing.update({
        kedudukan,
        dasar_keputusan,
        akhir_masuk: akhir_masuk || existing.akhir_masuk
      }, { transaction: t });
    }

    return await RiwayatKeluarga.create({
      krama_id,
      keluarga_id,
      kedudukan,
      kategori_masuk,
      dasar_keputusan,
      awal_masuk: finalEventDate,
      akhir_masuk: akhir_masuk || null 
    }, { transaction: t });
  } catch (error) {
    console.error("Error pada simpanRiwayatKeluarga:", error.message);
    throw error;
  }
};