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
  catatan_admin_desa,
  is_verifikasi = false
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    const tanggalHariIniDateOnly = new Date().toISOString().split('T')[0];
    const fallbackTimestampISO = `${tanggalHariIniDateOnly}T00:00:00.000Z`;

    let tglAngkatDateOnly = null;
    let tglAngkatTimestamp = null;

    // STANDARDISASI TANGGAL KRONOLOGIS LELUHUR
    if (status_hubungan === "Anak Angkat") {
      const targetTanggal = tanggal_pengangkatan || anak?.tanggal_lahir;
      if (targetTanggal) {
        const stringDateOnly = targetTanggal.includes('T') 
          ? targetTanggal.split('T')[0] 
          : targetTanggal.split(' ')[0];

        tglAngkatDateOnly = stringDateOnly;
        tglAngkatTimestamp = `${stringDateOnly}T00:00:00.000Z`;
      } else {
        tglAngkatDateOnly = tanggalHariIniDateOnly;
        tglAngkatTimestamp = fallbackTimestampISO;
      }
    }

    let jangkarTanggalAnakTimestamp = null;

    if (anak?.tanggal_lahir) {
      const cleanDate = anak.tanggal_lahir.includes('T') 
        ? anak.tanggal_lahir.split('T')[0] 
        : anak.tanggal_lahir.split(' ')[0];

      jangkarTanggalAnakTimestamp = `${cleanDate}T00:00:00.000Z`;
    }

    let relasi;

    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id,
        ayah_id: ayah_id || null,
        ibu_id: ibu_id || null,
        status_hubungan,
        urutan_lahir: urutan_lahir || null,
        tanggal_pengangkatan: tglAngkatDateOnly,
        user_id,             
        status_verifikasi,   
        catatan_admin_desa
      }, { transaction: t });
    } else {
      relasi = await RelasiKrama.findOne({
        where: {
          anak_id,
          status_hubungan,
          status_verifikasi: "Draft"
        },
        transaction: t
      });

      if (relasi) {
        const tglFix = tanggal_pengangkatan || relasi.tanggal_pengangkatan;
        const tglFixClean = tglFix ? (tglFix.includes('T') ? tglFix.split('T')[0] : tglFix.split(' ')[0]) : tanggalHariIniDateOnly;

        await relasi.update({
          status_verifikasi: "Disetujui",
          catatan_admin_desa,
          tanggal_pengangkatan: status_hubungan === "Anak Angkat" ? tglFixClean : null,
          urutan_lahir: urutan_lahir || relasi.urutan_lahir
        }, { transaction: t });

        if (status_hubungan === "Anak Angkat") {
          tglAngkatDateOnly = tglFixClean;
          tglAngkatTimestamp = `${tglFixClean}T00:00:00.000Z`;
        }
      }
    }

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

    if (kepalaKeluargaId) {
      let keluargaLeluhur = await Keluarga.findOne({
        where: {
          kepala_keluarga_id: kepalaKeluargaId,
          jenis_keluarga: "Leluhur"
        },
        transaction: t,
        lock: t.LOCK.UPDATE 
      });

      if (!keluargaLeluhur) {
        keluargaLeluhur = await buatKeluargaLeluhur({
          kepala_keluarga_id: kepalaKeluargaId
        }, t);

        const tglLahirKepala = ayah?.tanggal_lahir || ibu?.tanggal_lahir;
        const cleanTglKepala = tglLahirKepala 
          ? `${tglLahirKepala.includes('T') ? tglLahirKepala.split('T')[0] : tglLahirKepala.split(' ')[0]}T00:00:00.000Z`
          : fallbackTimestampISO;

        const objekWaktuKepala = new Date(cleanTglKepala);

        const riwayatAktifKepalaLeluhur = await RiwayatKeluarga.findOne({
          where: {
            krama_id: kepalaKeluargaId,
            akhir_masuk: null
          },
          include: [{
            model: Keluarga,
            as: "detail_keluarga",
            where: { jenis_keluarga: "Leluhur" }
          }],
          transaction: t
        });

        if (riwayatAktifKepalaLeluhur) {
          await riwayatAktifKepalaLeluhur.update({ 
            akhir_masuk: objekWaktuKepala 
          }, { transaction: t });
        }

        await simpanRiwayatKeluarga({
          krama_id: kepalaKeluargaId,
          keluarga_id: keluargaLeluhur.id,
          perkawinan_id: perkawinan_id || null,
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan karena krama ini merupakan puncak treh di dalam silsilah keluarga leluhur.",
          event_date: objekWaktuKepala,
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          allow_multiple: true
        }, t);
      }
      keluargaId = keluargaLeluhur.id;
    }
    
    if (keluargaId) {
      const sudahTerdaftar = await RiwayatKeluarga.findOne({
        where: {
          krama_id: anak_id,
          keluarga_id: keluargaId,
          kedudukan: "Anggota"
        },
        transaction: t
      });

      if (!sudahTerdaftar) {
        const finalEventDateTimestamp = status_hubungan === "Anak Angkat" 
          ? tglAngkatTimestamp 
          : jangkarTanggalAnakTimestamp;
        
        const objekWaktuJangkar = finalEventDateTimestamp 
          ? new Date(finalEventDateTimestamp) 
          : new Date(fallbackTimestampISO);

        const riwayatBentukKepalaEksisting = await RiwayatKeluarga.findOne({
          where: {
            krama_id: anak_id,
            kedudukan: "Kepala Keluarga"
          },
          include: [{
            model: Keluarga,
            as: "detail_keluarga",
            where: { jenis_keluarga: "Leluhur" }
          }],
          transaction: t
        });

        let objekWaktuMulaiAnggota = objekWaktuJangkar;
        let objekWaktuAkhirAnggota = null;

        if (riwayatBentukKepalaEksisting) {
          const tglMulaiKepalaTime = new Date(riwayatBentukKepalaEksisting.awal_masuk).getTime();
          objekWaktuAkhirAnggota = new Date(tglMulaiKepalaTime - 1);
        } else {
          const riwayatAktifAnakLeluhur = await RiwayatKeluarga.findOne({
            where: {
              krama_id: anak_id,
              akhir_masuk: null
            },
            include: [{
              model: Keluarga,
              as: "detail_keluarga",
              where: { jenis_keluarga: "Leluhur" }
            }],
            transaction: t
          });

          if (riwayatAktifAnakLeluhur) {
            await riwayatAktifAnakLeluhur.update({ 
              akhir_masuk: objekWaktuJangkar 
            }, { transaction: t });
          }
        }

        await simpanRiwayatKeluarga({
          krama_id: anak_id,
          keluarga_id: keluargaId,
          perkawinan_id: perkawinan_id || null,
          kedudukan: "Anggota",
          dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini merupakan keturunan di dalam silsilah keluarga leluhur.",
          event_date: objekWaktuMulaiAnggota,
          kategori_event: kategoriEventFinal,
          bobot_event: bobotEventFinal,
          allow_multiple: true 
        }, t);

        if (objekWaktuAkhirAnggota) {
          await RiwayatKeluarga.update({
            akhir_masuk: objekWaktuAkhirAnggota
          }, {
            where: {
              krama_id: anak_id,
              keluarga_id: keluargaId,
              kedudukan: "Anggota",
              akhir_masuk: null
            },
            transaction: t
          });

          await Keluarga.update({
            status_keluarga: "Aktif"
          }, {
            where: { id: riwayatBentukKepalaEksisting.keluarga_id },
            transaction: t
          });
        }
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