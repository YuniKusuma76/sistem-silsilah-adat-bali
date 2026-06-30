import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  Keluarga
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

    const isTanggalAngkatKosong = !tanggal_pengangkatan || tanggal_pengangkatan === anak.tanggal_lahir;

    let finalTanggalAngkat;
    let infoTambahanDasar = "";

    const jamSekarang = new Date().toTimeString().split(' ')[0];

    if (isTanggalAngkatKosong) {
      const hariIni = new Date().toISOString().split('T')[0];

      if (hariIni === anak.tanggal_lahir) {
        const besok = new Date();
        besok.setDate(besok.getDate() + 1);
        finalTanggalAngkat = new Date(`${besok.toISOString().split('T')[0]} ${jamSekarang}`);
        infoTambahanDasar = " (Tanggal riwayat bergeser 1 hari karena tanggal pengangkatan kosong dan sama dengan tanggal lahir).";
      } else {
        finalTanggalAngkat = new Date();
        infoTambahanDasar = " (Tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal pengangkatan kosong).";
      }
    } else {
      const stringDateOnly = tanggal_pengangkatan.includes('T') 
        ? tanggal_pengangkatan.split('T')[0] 
        : tanggal_pengangkatan.split(' ')[0];

      if (stringDateOnly === anak.tanggal_lahir) {
        const dt = new Date(stringDateOnly);
        dt.setDate(dt.getDate() + 1);
        finalTanggalAngkat = new Date(`${dt.toISOString().split('T')[0]} ${jamSekarang}`);
        infoTambahanDasar = " (Tanggal riwayat otomatis bergeser 1 hari setelah tanggal lahir untuk linimasa riwayat).";
      } else {
        finalTanggalAngkat = new Date(`${stringDateOnly} ${jamSekarang}`);
      }
    }

    let tglAngkatDateOnly = finalTanggalAngkat.toISOString().split('T')[0];
    let tglAngkatTimestamp = finalTanggalAngkat.toISOString();

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
      const tglAwalAktifStr = riwayatAktif.awal_masuk;

      if (new Date(tglAngkatTimestamp) <= new Date(tglAwalAktifStr)) {
        const d = new Date(tglAwalAktifStr);
        d.setDate(d.getDate() + 1);

        const tanggalBaruStr = d.toISOString().split('T')[0];
        tglAngkatTimestamp = new Date(`${tanggalBaruStr} ${jamSekarang}`).toISOString();
        tglAngkatDateOnly = tanggalBaruStr;
      }
    }

    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tglAngkatTimestamp, t);

    let akhirMasukAnakAngkat = tanggal_keluar 
      ? new Date(`${tanggal_keluar} ${jamSekarang}`).toISOString()
      : null;

    if (riwayatAktif) {
      const tglAwalAktif = new Date(riwayatAktif.awal_masuk);
      const tglAngkatBaru = new Date(tglAngkatTimestamp);

      if (tglAwalAktif > tglAngkatBaru) {
        akhirMasukAnakAngkat = riwayatAktif.awal_masuk; 
      } 
    }

    let relasi;

    // Manajemen Pencatatan Relasi Krama
    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id, 
        ayah_id, 
        ibu_id, 
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
        await relasi.update({
          status_verifikasi: "Disetujui",
          catatan_admin_desa,
          tanggal_pengangkatan: tglAngkatDateOnly
        }, { transaction: t });
      }
    }

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // Logika Chronological Stitching dan Backward Stitching
    if (riwayatAktif && new Date(tglAngkatTimestamp) > new Date(riwayatAktif.awal_masuk)) {
      await RiwayatKeluarga.update(
        { akhir_masuk: tglAngkatTimestamp },
        { where: {
            krama_id: anak_id,
            awal_masuk: { [Op.lt]: tglAngkatTimestamp },
            akhir_masuk: null
          },
          transaction: t
        }
      );
    }

    await hitungUrutanLahir({
      mode: "ANGKAT", 
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
      tanggal_pengangkatan: tglAngkatTimestamp,
      akhir_masuk_anak: akhirMasukAnakAngkat
    }, t);

    await simpanRiwayatPeranAdat({
      krama_id: kepala_keluarga_id,
      status_peran_adat: keputusan.status_peran_adat,
      garis_keturunan: keputusan.garis_keturunan,
      dasar_keputusan: keputusan.dasar_keputusan + infoTambahanDasar,
      kategori_event: "PENGANGKATAN",
      bobot_event: BOBOT_EVENT["PENGANGKATAN"],
      event_date: new Date(tglAngkatTimestamp)
    }, t);

    // LOGIKA REKONSILIASI DATA MANDIRI
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga",
        awal_masuk: { [Op.gte]: akhirMasukAnakAngkat || tglAngkatTimestamp }, 
        akhir_masuk: null
      },
      include: [{ 
        association: "detail_keluarga", 
        required: false
      }],
      transaction: t
    });

    if (riwayatMandiriDarurat) {
      const idKeluargaLama = riwayatMandiriDarurat.keluarga_id;
      
      const keluargaAngkatBaru = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: anak_id, 
          awal_masuk: tglAngkatTimestamp 
        },
        transaction: t
      });

      if (keluargaAngkatBaru) {
        await riwayatMandiriDarurat.update({
          keluarga_id: keluargaAngkatBaru.keluarga_id,
          kedudukan: "Anggota",
          kategori_event: "PENGANGKATAN",
          bobot_event: BOBOT_EVENT["PENGANGKATAN"],
          dasar_keputusan: "Krama dialihkan kembali ke keluarga angkat setelah data pengangkatan ditemukan secara sah."
        }, { transaction: t });

        await Keluarga.update(
          { status_keluarga: "Non-Aktif" },
          { 
            where: { id: idKeluargaLama }, 
            transaction: t
          }
        );
      }
    }

    // MUTASI PENGANGKATAN ANAK LINTAS DESA
    if (ortuAngkat.desa_adat_id) {
      await KramaBali.update(
        { desa_adat_id: ortuAngkat.desa_adat_id },
        { where: { id: anak_id }, transaction: t }
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