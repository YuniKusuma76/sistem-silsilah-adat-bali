import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  Keluarga,
  Perkawinan,
  RiwayatKeluarga
} from "../models/associations.js";
import { buatKeluargaLeluhur } from "./keluarga.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const integrasiRelasiLeluhur = async ({
  anak_id,
  ayah_id,
  ibu_id,
  status_hubungan = "Anak Kandung",
  urutan_lahir,
  tanggal_pengangkatan,
  ayah,
  ibu,
  anak,
  perkawinan_id,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    const tglAngkatFinal = status_hubungan === "Anak Angkat" 
      ? (tanggal_pengangkatan || anak?.tanggal_lahir || null)
      : null;

    const relasi = await RelasiKrama.create({
      anak_id,
      ayah_id: ayah_id || null,
      ibu_id: ibu_id || null,
      status_hubungan,
      urutan_lahir: urutan_lahir || null,
      tanggal_pengangkatan: tglAngkatFinal,
      user_id,             
      status_verifikasi,   
      catatan_admin_desa
    }, { transaction: t });

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // ===========================================================
    // LOGIKA OTOMATISASI STATUS PERKAWINAN LELUHUR
    // ===========================================================
    if (ayah_id && ibu_id && status_hubungan === "Anak Kandung") {
      if (ayah && ayah.tipe_data === "Leluhur") {
        const perkawinanLeluhur = await Perkawinan.findOne({
          where: {
            suami_id: ayah_id,
            istri_id: ibu_id
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });
        
        if (perkawinanLeluhur && perkawinanLeluhur.status_perkawinan === "Kawin") {
          await perkawinanLeluhur.update({
            status_perkawinan: "Tidak Diketahui"
          }, { transaction: t });
        }
      }
    }

    // LOGIKA PEMBENTUKAN KELUARGA LELUHUR
    let keluargaId = null;
    const kepalaKeluargaId = ayah_id || ibu_id;

    const kategoriEventFinal = status_hubungan === "Anak Angkat" ? "PENGANGKATAN" : "LAHIR";
    const bobotEventFinal = BOBOT_EVENT[kategoriEventFinal];
    const jangkarTanggalAnak = anak?.tanggal_lahir || null;

    if (kepalaKeluargaId) {
      // memastikan data keluarga leluhur yang sama sudah terbentuk
      let keluargaLeluhur = await Keluarga.findOne({
        where: {
          kepala_keluarga_id: kepalaKeluargaId,
          jenis_keluarga: "Leluhur"
        },
        transaction: t,
        lock: t.LOCK.UPDATE 
      });

      // membuat data keluarga leluhur jika belum ada
      if (!keluargaLeluhur) {
        keluargaLeluhur = await buatKeluargaLeluhur({
          kepala_keluarga_id: kepalaKeluargaId
        }, t);

        await simpanRiwayatKeluarga({
          krama_id: kepalaKeluargaId,
          keluarga_id: keluargaLeluhur.id,
          perkawinan_id: perkawinan_id || null,
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan karena krama ini merupakan kepala di dalam silsilah keluarga leluhur.",
          event_date: null,
          kategori_event: "LAHIR",
          bobot_event: BOBOT_EVENT["LAHIR"],
          allow_multiple: true
        }, t);
      }
      keluargaId = keluargaLeluhur.id;
    }
    
    if (keluargaId) {
      // memastikan anak belum terdaftar di keluarga leluhur yang sama
      const sudahTerdaftar = await RiwayatKeluarga.findOne({
        where: {
          krama_id: anak_id,
          keluarga_id: keluargaId,
          kedudukan: "Anggota"
        },
        transaction: t
      });

      if (!sudahTerdaftar) {
        await simpanRiwayatKeluarga({
          krama_id: anak_id,
          keluarga_id: keluargaId,
          perkawinan_id: perkawinan_id || null,
          kedudukan: "Anggota",
          dasar_keputusan: `Kedudukan sebagai anggota diberikan karena krama ini merupakan keturunan (${status_hubungan}) di dalam silsilah keluarga leluhur.`,
          event_date: status_hubungan === "Anak Angkat" ? tglAngkatFinal : jangkarTanggalAnak,
          kategori_event: kategoriEventFinal,
          bobot_event: bobotEventFinal,
          allow_multiple: true 
        }, t);
      }
    }

    if (!passedTransaction) {
      await t.commit();
    }
    return relasi;
  } catch (error) {
    if (!passedTransaction) {
      await t.rollback();
    }
    throw error;
  }
};