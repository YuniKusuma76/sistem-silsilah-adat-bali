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

export const integrasiRelasiLeluhur = async ({
  anak_id,
  ayah_id,
  ibu_id,
  status_hubungan,
  urutan_lahir,
  tanggal_pengangkatan,
  ayah,
  ibu,
  anak,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa
}, passedTransaction = null) => {
  // Mulai transaksi database yang dilewatkan
  const t = passedTransaction || await db.transaction();

  try {
    const relasi = await RelasiKrama.create({
      anak_id,
      ayah_id: ayah_id || null,
      ibu_id: ibu_id || null,
      status_hubungan: status_hubungan || "Anak Kandung",
      urutan_lahir: urutan_lahir || null,
      tanggal_pengangkatan: status_hubungan === "Anak Angkat" ? tanggal_pengangkatan : null,
      user_id,             
      status_verifikasi,   
      catatan_admin_desa
    }, {
      transaction: t
    });

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction && !t.finished) {
        await t.commit();
      }
      return relasi;
    }

    // ===========================================================
    // LOGIKA OTOMATISASI STATUS PERKAWINAN LELUHUR
    // ===========================================================
    if (ayah_id && ibu_id && relasi.status_hubungan === "Anak Kandung") {
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
          }, { 
            transaction: t 
          });
        }
      }
    }

    // LOGIKA PEMBENTUKAN KELUARGA LELUHUR
    let keluargaId = null;
    const kepalaKeluargaId = ayah_id || ibu_id;

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
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan karena krama ini merupakan kepala di dalam silsilah keluarga leluhur.",
          event_date: null,
          allow_multiple: true
        }, t);
      }
      keluargaId = keluargaLeluhur.id;
    }
    // MENCATAT RIWAYAT KELUARGA UNTUK ANAK LELUHUR
    if (keluargaId) {
      // Memastikan anak belum terdaftar di keluarga leluhur yang sama
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
          kedudukan: "Anggota",
          dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini merupakan keturunan di dalam silsilah keluarga leluhur.",
          event_date: null,
          allow_multiple: true
        }, t);
      }
    }

    if (!passedTransaction && !t.finished) {
      await t.commit();
    }
    return relasi;
  } catch (error) {
    if (t && !passedTransaction && !t.finished) {
      await t.rollback();
    }
    throw error;
  }
};