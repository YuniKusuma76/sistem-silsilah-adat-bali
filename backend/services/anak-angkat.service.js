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
  // Mulai transaksi database yang dilewatkan
  const t = passedTransaction || await db.transaction();

  try {
    if (!ayah_id && !ibu_id) {
      throw new Error("Minimal satu data orang tua angkat wajib terdaftar!");
    }

    if (!tanggal_pengangkatan) {
      throw new Error("Tanggal pengangkatan wajib diisi!");
    }

    const kepala_keluarga_id = ayah_id || ibu_id;

    // Validasi ketersediaan data anak
    const anak = await KramaBali.findByPk(anak_id, {
      transaction: t
    });

    if (!anak) {
      throw new Error("Data anak angkat tidak ditemukan.");
    }

    // Validasi Chronological Rentang Waktu Tanggal
    const riwayatAktif = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: anak_id, 
        akhir_masuk: null 
      },
      transaction: t
    });

    let akhirMasukAnakAngkat = await hitungTanggalKeluarAnak(anak_id, tanggal_pengangkatan, t); 

    if (riwayatAktif) {
      const tglAwalAktif = new Date(riwayatAktif.awal_masuk);
      const tglAngkatBaru = new Date(tanggal_pengangkatan);

      if (tglAwalAktif > tglAngkatBaru) {
        akhirMasukAnakAngkat = riwayatAktif.awal_masuk; 
      } 
      else if (tglAwalAktif.getTime() === tglAngkatBaru.getTime()) {
        throw new Error("Tanggal pengangkatan tidak boleh sama persis dengan tanggal masuk keluarga aktif saat ini.");
      }
    }

    let relasi;

    // Manajemen Pencatatan Relasi
    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id, 
        ayah_id, 
        ibu_id, 
        status_hubungan: "Anak Angkat", 
        tanggal_pengangkatan,
        user_id,             
        status_verifikasi,   
        catatan_admin_desa
      }, { 
        transaction: t
      });
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
          catatan_admin_desa
        }, { transaction: t });
      }
    }

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction && !t.finished) {
        await t.commit();
      }
      return relasi;
    }

    // Logika Chronological Stitching dan Backward Stitching
    if (riwayatAktif && new Date(tanggal_pengangkatan) > new Date(riwayatAktif.awal_masuk)) {
      await RiwayatKeluarga.update(
        { akhir_masuk: tanggal_pengangkatan },
        {
          where: {
            krama_id: anak_id,
            awal_masuk: { [Op.lt]: tanggal_pengangkatan },
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

    await simpanRiwayatPeranAdat({
      krama_id: kepala_keluarga_id,
      status_peran_adat: keputusan.status_peran_adat,
      garis_keturunan: keputusan.garis_keturunan,
      dasar_keputusan: keputusan.dasar_keputusan,
      event_date: tanggal_pengangkatan
    }, t);

    await bentukKeluargaAngkat({
      kepala_keluarga_id,
      anak_id,
      dasar_keputusan: keputusan.dasar_keputusan,
      tanggal_pengangkatan,
      akhir_masuk_anak: akhirMasukAnakAngkat
    }, t);

    // LOGIKA REKONSILIASI DATA MANDIRI
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga",
        awal_masuk: { [Op.gte]: akhirMasukAnakAngkat || tanggal_pengangkatan }, 
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
          awal_masuk: tanggal_pengangkatan 
        },
        transaction: t
      });

      if (keluargaAngkatBaru) {
        await riwayatMandiriDarurat.update({
          keluarga_id: keluargaAngkatBaru.keluarga_id,
          kedudukan: "Anggota",
          dasar_keputusan: "Krama dialihkan kembali ke keluarga angkat setelah data pengangkatan ditemukan secara sah."
        }, { 
          transaction: t 
        });
        await Keluarga.update(
          { status_keluarga: "Non-Aktif" },
          { 
            where: { id: idKeluargaLama }, 
            transaction: t 
          }
        );
      }
    }

    if (!passedTransaction && !t.finished) {
      await t.commit();
    }
    return relasi || true;
  } catch (error) {
    if (t && !passedTransaction && !t.finished) {
      await t.rollback();
    }
    throw error;
  }
};