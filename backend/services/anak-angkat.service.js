import { Op } from "sequelize";
import db from "../config/db.config.js";
import path from "path";
import {
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  Keluarga,
  RiwayatPeranAdat
} from "../models/associations.js";
import { supabase } from "../config/supabase.config.js";
import { mappingAturanAdatBali } from "./decision-tree.service.js";
import { simpanRiwayatPeranAdat } from "./riwayat-peran-adat.service.js";
import { bentukKeluargaAngkat } from "./keluarga-angkat.service.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";
import { hitungJumlahPengangkatan } from "../helpers/pengangkatan.helper.js";
import { hitungTanggalKeluarAnak } from "../helpers/tanggal-keluar.helper.js";
import { rekonsiliasiKronologiKeluarga } from "../helpers/kronologis-order.helper.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

// Helper: upload berkas ke Storage Supabase
const uploadBerkasPengangkatan = async (file, bucketName = "berkas-kelengkapan") => {
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

export const buatAnakAngkat = async ({
  anak_id,
  ayah_id,
  ibu_id,
  tanggal_pengangkatan,
  berkas_kelengkapan = null,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false,
  file = null
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    if (!ayah_id && !ibu_id) {
      throw new Error("Minimal satu data orang tua angkat wajib terdaftar!");
    }

    const kepala_keluarga_id = ayah_id || ibu_id;

    const anak = await KramaBali.findByPk(anak_id, { 
      transaction: t 
    });

    if (!anak) {
      throw new Error("Data anak angkat tidak ditemukan.");
    }

    // LOGIKA MENENTUKAN TANGGAL RIWAYAT
    const isTanggalAngkatKosong = !tanggal_pengangkatan || String(tanggal_pengangkatan).trim() === "";
    let dbTanggalPengangkatan = null;

    let tglRiwayatDateOnly = "";
    let infoTambahanDasar = "";


    if (isTanggalAngkatKosong) {
      tglRiwayatDateOnly = new Date().toISOString().split('T')[0];
      infoTambahanDasar = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal pengangkatan kosong).";
      dbTanggalPengangkatan = null;
    } else {
      tglRiwayatDateOnly = tanggal_pengangkatan.includes('T') 
        ? tanggal_pengangkatan.split('T')[0] 
        : tanggal_pengangkatan.split(' ')[0];
      dbTanggalPengangkatan = tglRiwayatDateOnly;
    }

    let tglAngkatTimestamp = `${tglRiwayatDateOnly}T00:00:00.000Z`;

    const ortuAngkat = await KramaBali.findByPk(kepala_keluarga_id, {
      attributes: ["desa_adat_id"],
      transaction: t
    });

    if (!ortuAngkat) {
      throw new Error("Data orang tua angkat tidak ditemukan.");
    }

    const riwayatAktif = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: anak_id, 
        akhir_masuk: null 
      },
      transaction: t
    });

    // VALIDASI PENCEGAHAN WAKTU MUNDUR KETIKA FALLBACK OTOMATIS
    if (riwayatAktif && isTanggalAngkatKosong) {
      const tglAwalAktifStr = riwayatAktif.awal_masuk instanceof Date 
        ? riwayatAktif.awal_masuk.toISOString().split('T')[0]
        : riwayatAktif.awal_masuk.split('T')[0];

      if (new Date(tglAngkatTimestamp) <= new Date(riwayatAktif.awal_masuk)) {
        const d = new Date(`${tglAwalAktifStr}T00:00:00.000Z`);
        d.setDate(d.getDate() + 1);
        tglRiwayatDateOnly = d.toISOString().split('T')[0];
        tglAngkatTimestamp = `${tglRiwayatDateOnly}T00:00:00.000Z`;
      }
    }

    let berkasPath = berkas_kelengkapan;

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
        status_hubungan: "Anak Angkat", 
        tanggal_pengangkatan: dbTanggalPengangkatan,
        berkas_kelengkapan: berkasPath,
        user_id,             
        status_verifikasi,   
        catatan_admin_desa,
        desa_adat_id_tujuan: ortuAngkat.desa_adat_id 
      }, { transaction: t });
    } else {
      relasi = await RelasiKrama.findOne({
        where: { 
          anak_id, 
          status_hubungan: "Anak Angkat", 
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
          tglRiwayatDateOnly = new Date().toISOString().split('T')[0];
        }

        const updatePayload = {
          status_verifikasi: "Disetujui",
          catatan_admin_desa,
          tanggal_pengangkatan: tglFixClean
        };

        if (berkasPath) {
          updatePayload.berkas_kelengkapan = berkasPath;
        }

        await relasi.update(updatePayload, { transaction: t });
        tglAngkatTimestamp = `${tglRiwayatDateOnly}T00:00:00.000Z`;
      }
    }

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // EKSEKUSI RELASI KRAMA
    const objekWaktuEfektif = new Date(tglAngkatTimestamp);
    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tglRiwayatDateOnly, t);

    let akhirMasukAnakAngkat = tanggal_keluar 
      ? new Date(`${tanggal_keluar}T00:00:00.000Z`)
      : null;

    if (riwayatAktif) {
      const tglAwalAktif = new Date(riwayatAktif.awal_masuk);
      if (tglAwalAktif > objekWaktuEfektif) {
        akhirMasukAnakAngkat = riwayatAktif.awal_masuk; 
      } 
    }

    // Logika Chronological Stitching dan Backward Stitching
    if (riwayatAktif && objekWaktuEfektif > new Date(riwayatAktif.awal_masuk)) {
      await RiwayatKeluarga.update({ 
        akhir_masuk: objekWaktuEfektif 
      },{ 
        where: {
          krama_id: anak_id,
          akhir_masuk: null
        },
        transaction: t
      });
    }

    await hitungUrutanLahir({
      mode: "ANGKAT", 
      ayah_id: ayah_id || null,
      ibu_id: ibu_id || null,
      kepala_keluarga_id: kepala_keluarga_id
    }, t);

    const totalAnakAngkat = await hitungJumlahPengangkatan(kepala_keluarga_id, t);

    // mapping status peran adat untuk orang tua angkat
    const keputusan = await mappingAturanAdatBali("PENGANGKATAN", {
      jumlah_anak_angkat: totalAnakAngkat
    }, t);

    await bentukKeluargaAngkat({
      kepala_keluarga_id,
      anak_id,
      dasar_keputusan: keputusan.dasar_keputusan + ` [Pengangkatan ke-${totalAnakAngkat}]` + infoTambahanDasar,
      tanggal_pengangkatan: objekWaktuEfektif,
      akhir_masuk_anak: akhirMasukAnakAngkat ? new Date(akhirMasukAnakAngkat) : null
    }, t);

    await RiwayatPeranAdat.update({ 
      selesai_tanggal: objekWaktuEfektif 
    },{
      where: {
        krama_id: parseInt(kepala_keluarga_id),
        selesai_tanggal: null
      },
      transaction: t
    });

    await simpanRiwayatPeranAdat({
      krama_id: parseInt(kepala_keluarga_id),
      status_peran_adat: keputusan?.status_peran_adat,
      garis_keturunan: keputusan?.garis_keturunan,
      dasar_keputusan: keputusan?.dasar_keputusan + ` [Pengangkatan ke-${totalAnakAngkat}]` + infoTambahanDasar,
      kategori_event: "PENGANGKATAN",
      bobot_event: BOBOT_EVENT["PENGANGKATAN"],
      event_date: objekWaktuEfektif
    }, t);

    // ==============================================================
    // LOGIKA REKONSILIASI DATA MANDIRI
    // ==============================================================
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: parseInt(anak_id),
        kedudukan: "Kepala Keluarga", 
        [Op.or]: [
          { dasar_keputusan: { [Op.like]: "%kembali ke keluarga asal%" } },
          { dasar_keputusan: { [Op.like]: "%setelah perceraian%" } },
          { dasar_keputusan: { [Op.like]: "%keluarga asal setelah%" } },
          { dasar_keputusan: { [Op.like]: "%dikembalikan ke keluarga%" } }
        ]
      },
      transaction: t
    });

    if (riwayatMandiriDarurat) {
      const idKeluargaLamaDarurat = riwayatMandiriDarurat.keluarga_id;
      const tanggalMasukAsal = new Date(riwayatMandiriDarurat.awal_masuk);
      const perkawinanIdDarurat = riwayatMandiriDarurat.perkawinan_id;

      await RiwayatKeluarga.update({ 
        akhir_masuk: tanggalMasukAsal 
      },{
        where: {
          krama_id: parseInt(anak_id),
          kategori_event: "KAWIN",
          akhir_masuk: null
        },
        transaction: t
      });

      const keluargaAngkatAktif = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: parseInt(anak_id), 
          kategori_event: "PENGANGKATAN",
          akhir_masuk: null 
        },
        transaction: t
      });

      if (keluargaAngkatAktif) {
        await keluargaAngkatAktif.update({
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          awal_masuk: tanggalMasukAsal,
          akhir_masuk: null,
          perkawinan_id: perkawinanIdDarurat,
          dasar_keputusan: "Krama dikembalikan ke keluarga angkat dari orang tua angkatnya setelah data relasi orang tua berhasil terdaftar ke dalam sistem.",
        }, { transaction: t });

        await riwayatMandiriDarurat.destroy({ 
          transaction: t 
        });
      }

      // nonaktifkan riwayat keluarga asal
      if (idKeluargaLamaDarurat) {
        await Keluarga.update({ 
          status_keluarga: "Non-Aktif" 
        },{ 
          where: { id: idKeluargaLamaDarurat }, 
          transaction: t 
        });
      }
    }

    // MUTASI PENGANGKATAN ANAK LINTAS DESA
    if (ortuAngkat.desa_adat_id) {
      await KramaBali.update({ 
        desa_adat_id: ortuAngkat.desa_adat_id 
      },{ 
        where: { id: anak_id }, 
        transaction: t 
      });
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