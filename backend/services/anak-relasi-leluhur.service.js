import { Op } from "sequelize";
import db from "../config/db.config.js";
import path from "path";
import {
  RelasiKrama,
  Keluarga,
  Perkawinan,
  RiwayatKeluarga
} from "../models/associations.js";
import { supabase } from "../config/supabase.config.js";
import { buatKeluargaLeluhur } from "./keluarga.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";
import { rekonsiliasiKronologiKeluarga } from "../helpers/kronologis-order.helper.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

// Helper: upload berkas ke Storage Supabase
const uploadBerkasPengangkatan = async (file, bucketName = "berkas-pengangkatan") => {
  if (!file) return null;

  const fileExtension = path.extname(file.originalname).toLowerCase();
  const fileName = `pengangkatan_${Date.now()}_${Math.round(Math.random() * 1e9)}${fileExtension}`;
  const filePath = `relasi-krama-angkat/${fileName}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, file.buffer, {
      contentType: file.mimetype,
      upsert: false
    });

  if (error) {
    throw new Error(`Gagal mengunggah berkas ke Cloud Storage: ${error.message}`);
  }

  return data.path;
};

export const integrasiRelasiLeluhur = async ({
  anak_id,
  ayah_id,
  ibu_id,
  status_hubungan = "Anak Kandung",
  urutan_lahir,
  tanggal_pengangkatan,
  berkas_pengangkatan = null,
  ayah,
  ibu,
  anak,
  perkawinan_id,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false,
  file = null
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    const tanggalHariIniDateOnly = new Date().toISOString().split('T')[0];
    const fallbackTimestampISO = `${tanggalHariIniDateOnly}T00:00:00.000Z`;

    // STANDARDISASI TANGGAL KRONOLOGIS LELUHUR
    let dbTanggalPengangkatan = null;
    let tglRiwayatDateOnly = null;
    let tglAngkatTimestamp = null;

    if (status_hubungan === "Anak Angkat") {
      const isTanggalAngkatKosong = !tanggal_pengangkatan || String(tanggal_pengangkatan).trim() === "";

      if (isTanggalAngkatKosong) {
        dbTanggalPengangkatan = null;
        tglRiwayatDateOnly = tanggalHariIniDateOnly;
        tglAngkatTimestamp = fallbackTimestampISO;
      } else {
        const stringDateOnly = tanggal_pengangkatan.includes('T') 
          ? tanggal_pengangkatan.split('T')[0] 
          : tanggal_pengangkatan.split(' ')[0];
        dbTanggalPengangkatan = stringDateOnly;
        tglRiwayatDateOnly = stringDateOnly;
        tglAngkatTimestamp = `${stringDateOnly}T00:00:00.000Z`;
      }
    }

    let jangkarTanggalAnakTimestamp = null;

    if (anak?.tanggal_lahir) {
      const cleanDate = anak.tanggal_lahir.includes('T') 
        ? anak.tanggal_lahir.split('T')[0] 
        : anak.tanggal_lahir.split(' ')[0];
      jangkarTanggalAnakTimestamp = `${cleanDate}T00:00:00.000Z`;
    }

    let berkasPath = berkas_pengangkatan;

    if (file) {
      const pathUploaded = await uploadBerkasPengangkatan(file);
      if (pathUploaded) {
        berkasPath = pathUploaded;
      }
    }

    let relasi;

    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id,
        ayah_id: ayah_id || null,
        ibu_id: ibu_id || null,
        status_hubungan,
        urutan_lahir: urutan_lahir || null,
        tanggal_pengangkatan: dbTanggalPengangkatan,
        berkas_pengangkatan: berkasPath,
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
        const tglInputFix = tanggal_pengangkatan || relasi.tanggal_pengangkatan;
        let tglFixClean = null;

        if (tglInputFix) {
          tglFixClean = tglInputFix.includes('T') ? tglInputFix.split('T')[0] : tglInputFix.split(' ')[0];
          tglRiwayatDateOnly = tglFixClean;
        } else {
          tglRiwayatDateOnly = tanggalHariIniDateOnly;
        }

        const updatePayload = {
          status_verifikasi: "Disetujui",
          catatan_admin_desa,
          tanggal_pengangkatan: status_hubungan === "Anak Angkat" ? tglFixClean : null,
          urutan_lahir: urutan_lahir || relasi.urutan_lahir
        };

        if (berkasPath) {
          updatePayload.berkas_pengangkatan = berkasPath;
        }

        await relasi.update(updatePayload, { transaction: t });
        if (status_hubungan === "Anak Angkat") {
          tglAngkatTimestamp = `${tglRiwayatDateOnly}T00:00:00.000Z`;
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
    let finalPerkawinanId = perkawinan_id || null;

    if (ayah_id && ibu_id && status_hubungan === "Anak Kandung") {
      if (ayah?.tipe_data === "Leluhur" || ibu?.tipe_data === "Leluhur") {
        let perkawinanLeluhur = await Perkawinan.findOne({
          where: {
            suami_id: ayah_id,
            istri_id: ibu_id
          },
          transaction: t,
          lock: t.LOCK.UPDATE
        });

        if (perkawinanLeluhur) {
          finalPerkawinanId = perkawinanLeluhur.id;
        } else {
          const perkawinanBaru = await Perkawinan.create({
            suami_id: ayah_id,
            istri_id: ibu_id,
            jenis_perkawinan: "Biasa",
            status_perkawinan: "Tidak Diketahui",
            status_verifikasi: "Disetujui",
            tanggal_perkawinan: tanggalHariIniDateOnly,
            catatan_admin_desa: {
              catatan_desa_suami: "Data perkawinan leluhur dibuat otomatis oleh sistem silsilah Adat Bali.",
              catatan_desa_istri: "Data perkawinan leluhur dibuat otomatis oleh sistem silsilah Adat Bali.",
              last_updated_by: "Sistem (Integrasi Leluhur)"
            }
          }, { transaction: t });

          finalPerkawinanId = perkawinanBaru.id;
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
          perkawinan_id: finalPerkawinanId,
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
          perkawinan_id: finalPerkawinanId,
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

    await rekonsiliasiKronologiKeluarga(anak_id, t);
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