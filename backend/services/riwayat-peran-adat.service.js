import { Op } from "sequelize";
import { RiwayatPeranAdat } from "../models/associations.js";

// Menutup riwayat peran adat aktif sebelumnya
export const tutupRiwayatPeranAdat = async (
  krama_id, 
  event_date, 
  t = null
) => {
  try {
    const targetDate = new Date(event_date);

    await RiwayatPeranAdat.update(
      { selesai_tanggal : event_date },
      {
        where: {
          krama_id,
          mulai_tanggal: { [Op.lte]: event_date },
          [Op.or]: [
            { selesai_tanggal: null },
            { selesai_tanggal: { [Op.gt]: event_date } }
          ]
        },
        transaction: t
      }
    );
  } catch (error) {
    console.error(error.message);
    throw error;
  }
};

// Menyimpan riwayat peran adat yang baru hasil decision tree
export const simpanRiwayatPeranAdat = async ({
  krama_id,
  status_peran_adat,
  jenis_perkawinan,
  garis_keturunan,
  dasar_keputusan,
  event_date
}, t = null) => {
  // ============================================================
  // LOGGING DEBUG (Monitor pergerakan status di terminal)
  // ============================================================
  console.log("=== [SERVICE] SIMPAN RIWAYAT PERAN ADAT ===");
  console.log("ID Krama         :", krama_id);
  console.log("Status Peran     :", status_peran_adat);
  console.log("Garis Keturunan  :", garis_keturunan);
  console.log("Dasar Keputusan  :", dasar_keputusan);
  console.log("Tanggal Peristiwa:", event_date);
  console.log("============================================");

  // Validasi internal untuk mencegah error 'NotNull Violation'
  if (!krama_id || !status_peran_adat || !garis_keturunan || !dasar_keputusan) {
    const missingFields = [];

    if (!krama_id) {
      missingFields.push("krama_id");
    }
    if (!status_peran_adat) {
      missingFields.push("status_peran_adat");
    }
    if (!garis_keturunan) {
      missingFields.push("garis_keturunan");
    }
    if (!dasar_keputusan) {
      missingFields.push("dasar_keputusan");
    }

    throw new Error(
      `Gagal menyimpan riwayat peran adat! Kolom ${missingFields.join(", ")} tidak boleh kosong. ` +
      `Periksa apakah Decision Tree sudah mengembalikan data yang sesuai.`
    );
  }
  
  // Eksekusi hasil decision tree
  try {
    await tutupRiwayatPeranAdat(krama_id, event_date, t);

    return RiwayatPeranAdat.create({
      krama_id,
      status_peran_adat,
      jenis_perkawinan: jenis_perkawinan || null,
      garis_keturunan,
      dasar_keputusan,
      mulai_tanggal: event_date,
      selesai_tanggal: null
    }, { 
      transaction: t 
    });
  } catch (error) {
    console.error(error.message);
    throw error;
  }
};

// Mengambil riwayat peran adat yang aktif terakhir
export const ambilPeranAdatTerakhir = async (
  krama_id, 
  t = null
) => {
  try {
    const kondisiData = {
      where: { krama_id },
      order: [["mulai_tanggal", "DESC"]],
      transaction: t
    };

    const riwayatTerakhir = await RiwayatPeranAdat.findOne(kondisiData);
    return riwayatTerakhir ?? null;
  } catch (error) {
    console.error(error.message);
    throw error;
  }
};