import { Op } from "sequelize";
import { RiwayatPeranAdat } from "../models/associations.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

// Menutup riwayat peran adat aktif sebelumnya
export const tutupRiwayatPeranAdat = async ({ krama_id, event_date, bobot_baru, t = null }) => {
  try {
    await RiwayatPeranAdat.update(
      { selesai_tanggal : event_date },
      {
        where: {
          krama_id: parseInt(krama_id),
          mulai_tanggal: { [Op.lte]: event_date }, 
          selesai_tanggal: null,
          [Op.or]: [
            { mulai_tanggal: { [Op.lt]: event_date } },
            { 
              [Op.and]: [
                { mulai_tanggal: event_date },
                { bobot_event: { [Op.lt]: parseInt(bobot_baru) } }
              ]
            }
          ]
        },
        transaction: t
      }
    );
  } catch (error) {
    console.error("Error pada tutupRiwayatPeranAdat:", error.message);
    throw error;
  }
};

// Menyimpan riwayat peran adat yang baru hasil decision tree
export const simpanRiwayatPeranAdat = async ({
  krama_id,
  perkawinan_id,
  status_peran_adat,
  jenis_perkawinan,
  garis_keturunan,
  dasar_keputusan,
  kategori_event,
  bobot_event,
  event_date
}, t = null) => {
  const finalEventDate = event_date || new Date().toISOString().split('T')[0];
  const finalBobot = bobot_event || BOBOT_EVENT[kategori_event] || 1;

  console.log("=== [SERVICE] SIMPAN RIWAYAT PERAN ADAT ===");
  console.log("ID Krama         :", krama_id);
  console.log("Perkawinan ID    :", perkawinan_id);
  console.log("Status Peran     :", status_peran_adat);
  console.log("Garis Keturunan  :", garis_keturunan);
  console.log("Dasar Keputusan  :", dasar_keputusan);
  console.log("Tanggal Peristiwa:", finalEventDate);
  console.log("============================================");

  if (!krama_id || !status_peran_adat || !garis_keturunan || !dasar_keputusan || !kategori_event) {
    throw new Error("Gagal menyimpan riwayat peran adat! Parameter silsilah adat tidak lengkap.");
  }

  try {
    await tutupRiwayatPeranAdat({
      krama_id,
      event_date: finalEventDate,
      bobot_baru: finalBobot,
      t
    });

    return await RiwayatPeranAdat.create({
      krama_id: parseInt(krama_id),
      perkawinan_id: perkawinan_id || null,
      status_peran_adat,
      jenis_perkawinan: jenis_perkawinan || null,
      garis_keturunan,
      dasar_keputusan,
      kategori_event,
      bobot_event: finalBobot,
      mulai_tanggal: finalEventDate,
      selesai_tanggal: null
    }, { transaction: t });
  } catch (error) {
    console.error("Error pada simpanRiwayatPeranAdat:", error.message);
    throw error;
  }
};

// Mengambil riwayat peran adat yang aktif terakhir
export const ambilPeranAdatTerakhir = async (krama_id, t = null) => {
  try {
    return await RiwayatPeranAdat.findOne({
      where: { krama_id: parseInt(krama_id) },
      order: [
        ["mulai_tanggal", "DESC"],
        ["bobot_event", "DESC"]
      ],
      transaction: t
    });
    return riwayatTerakhir ?? null;
  } catch (error) {
    console.error("Error pada ambilPeranAdatTerakhir:", error.message);
    throw error;
  }
};