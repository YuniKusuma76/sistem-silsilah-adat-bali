import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  Keluarga,
  RiwayatPeranAdat
} from "../models/associations.js";
import { mappingAturanAdatBali } from "./decision-tree.service.js";
import { simpanRiwayatPeranAdat } from "./riwayat-peran-adat.service.js";
import { bentukKeluargaAngkat } from "./keluarga-angkat.service.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";
import { hitungJumlahPengangkatan } from "../helpers/pengangkatan.helper.js";
import { hitungTanggalKeluarAnak } from "../helpers/tanggal-keluar.helper.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const buatAnakAngkat = async ({
  anak_id,
  ayah_id,
  ibu_id,
  tanggal_pengangkatan,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    if (!ayah_id && !ibu_id) {
      throw new Error("Minimal satu data orang tua angkat wajib terdaftar!");
    }

    const kepala_keluarga_id = ayah_id || ibu_id;

    // Validasi ketersediaan data anak dan orang tua
    const anak = await KramaBali.findByPk(anak_id, { 
      transaction: t 
    });

    if (!anak) {
      throw new Error("Data anak angkat tidak ditemukan.");
    }

    let tglAngkatDateOnly;
    let infoTambahanDasar = "";
    const isTanggalAngkatKosong = !tanggal_pengangkatan || tanggal_pengangkatan === "";

    if (isTanggalAngkatKosong) {
      const tanggalLahirAcuan = anak.tanggal_lahir 
        ? (anak.tanggal_lahir.includes('T') ? anak.tanggal_lahir.split('T')[0] : anak.tanggal_lahir.split(' ')[0])
        : new Date().toISOString().split('T')[0];

      const dt = new Date(`${tanggalLahirAcuan}T00:00:00.000Z`);
      dt.setDate(dt.getDate() + 1);

      tglAngkatDateOnly = dt.toISOString().split('T')[0];
      infoTambahanDasar = " (Tanggal riwayat otomatis ditetapkan 1 hari setelah tanggal lahir anak karena tanggal pengangkatan kosong).";
    } else {
      tglAngkatDateOnly = tanggal_pengangkatan.includes('T') 
        ? tanggal_pengangkatan.split('T')[0] 
        : tanggal_pengangkatan.split(' ')[0];
    }

    let tglAngkatTimestamp = `${tglAngkatDateOnly}T00:00:00.000Z`;

    const ortuAngkat = await KramaBali.findByPk(kepala_keluarga_id, {
      attributes: ["desa_adat_id"],
      transaction: t
    });

    if (!ortuAngkat) {
      throw new Error("Data orang tua angkat tidak ditemukan.");
    }

    // Validasi Rentang Waktu Kronologis
    const riwayatAktif = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: anak_id, 
        akhir_masuk: null 
      },
      transaction: t
    });

    if (riwayatAktif) {
      const tglAwalAktifStr = riwayatAktif.awal_masuk instanceof Date 
        ? riwayatAktif.awal_masuk.toISOString().split('T')[0]
        : riwayatAktif.awal_masuk.split('T')[0];

      if (new Date(tglAngkatTimestamp) <= new Date(riwayatAktif.awal_masuk)) {
        const d = new Date(`${tglAwalAktifStr}T00:00:00.000Z`);
        d.setDate(d.getDate() + 1);
        tglAngkatDateOnly = d.toISOString().split('T')[0];
        tglAngkatTimestamp = `${tglAngkatDateOnly}T00:00:00.000Z`;
      }
    }

    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tglAngkatDateOnly, t);

    let akhirMasukAnakAngkat = tanggal_keluar 
      ? new Date(`${tanggal_keluar}T00:00:00.000Z`)
      : null;

    const objekWaktuEfektif = new Date(tglAngkatTimestamp);

    if (riwayatAktif) {
      const tglAwalAktif = new Date(riwayatAktif.awal_masuk);
      if (tglAwalAktif > objekWaktuEfektif) {
        akhirMasukAnakAngkat = riwayatAktif.awal_masuk; 
      } 
    }

    let relasi;

    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id, 
        ayah_id: ayah_id || null, 
        ibu_id: ibu_id || null, 
        status_hubungan: "Anak Angkat", 
        tanggal_pengangkatan: tglAngkatDateOnly,
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
        const tglFix = tanggal_pengangkatan || relasi.tanggal_pengangkatan;
        const tglFixClean = tglFix.includes('T') ? tglFix.split('T')[0] : tglFix.split(' ')[0];

        await relasi.update({
          status_verifikasi: "Disetujui",
          catatan_admin_desa,
          tanggal_pengangkatan: tglFixClean
        }, { transaction: t });

        tglAngkatDateOnly = tglFixClean;
        tglAngkatTimestamp = `${tglFixClean}T00:00:00.000Z`;
      }
    }

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // ===================================================================
    // Logika Chronological Stitching dan Backward Stitching
    // ===================================================================
    if (riwayatAktif && objekWaktuEfektif > new Date(riwayatAktif.awal_masuk)) {
      await RiwayatKeluarga.update(
        { akhir_masuk: objekWaktuEfektif },
        { 
          where: {
            krama_id: anak_id,
            akhir_masuk: null
          },
          transaction: t
        }
      );
    }

    await hitungUrutanLahir({
      mode: "ANGKAT", 
      ayah_id: ayah_id || null,
      ibu_id: ibu_id || null,
      kepala_keluarga_id: kepala_keluarga_id
    }, t);

    const totalAnakAngkat = await hitungJumlahPengangkatan(kepala_keluarga_id, t);

    // Mapping Status Peran Adat untuk Orang Tua Angkat
    const keputusan = await mappingAturanAdatBali("PENGANGKATAN", {
      jumlah_anak_angkat: totalAnakAngkat
    }, t);

    await bentukKeluargaAngkat({
      kepala_keluarga_id,
      anak_id,
      dasar_keputusan: keputusan.dasar_keputusan + infoTambahanDasar,
      tanggal_pengangkatan: objekWaktuEfektif,
      akhir_masuk_anak: akhirMasukAnakAngkat ? new Date(akhirMasukAnakAngkat) : null
    }, t);

    await RiwayatPeranAdat.update(
      { selesai_tanggal: objekWaktuEfektif },
      {
        where: {
          krama_id: parseInt(kepala_keluarga_id),
          selesai_tanggal: null
        },
        transaction: t
      }
    );

    await simpanRiwayatPeranAdat({
      krama_id: parseInt(kepala_keluarga_id),
      status_peran_adat: keputusan?.status_peran_adat,
      garis_keturunan: keputusan?.garis_keturunan,
      dasar_keputusan: keputusan?.dasar_keputusan + `[Pengangkatan ke-${totalAnakAngkat}]` + infoTambahanDasar,
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

      // memastikan riwayat perkawinan ditutup sesuai tanggal cerai
      await RiwayatKeluarga.update(
        { akhir_masuk: tanggalMasukAsal },
        {
          where: {
            krama_id: parseInt(anak_id),
            kategori_event: "KAWIN",
            akhir_masuk: null
          },
          transaction: t
        }
      );

      const keluargaAngkatAktif = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: parseInt(anak_id), 
          kategori_event: "PENGANGKATAN",
          akhir_masuk: null 
        },
        transaction: t
      });

      if (keluargaAngkatAktif) {
        const keluargaTujuanId = keluargaAngkatAktif.keluarga_id;

        await keluargaAngkatAktif.update({
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          awal_masuk: tanggalMasukAsal,
          akhir_masuk: null,
          dasar_keputusan: "Krama dikembalikan ke keluarga angkat dari orang tuanya setelah data relasi orang tua berhasil disinkronisasikan ke dalam sistem.",
        }, { transaction: t });

        await riwayatMandiriDarurat.destroy({ transaction: t });
      }

      // nonaktifkan riwayat keluarga asal
      if (idKeluargaLamaDarurat) {
        await Keluarga.update(
          { status_keluarga: "Non-Aktif" },
          { 
            where: { id: idKeluargaLamaDarurat }, 
            transaction: t 
          }
        );
      }
    }

    // MUTASI PENGANGKATAN ANAK LINTAS DESA
    if (ortuAngkat.desa_adat_id) {
      await KramaBali.update(
        { desa_adat_id: ortuAngkat.desa_adat_id },
        { 
          where: { id: anak_id }, 
          transaction: t 
        }
      );
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