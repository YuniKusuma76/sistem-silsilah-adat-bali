import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan, 
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  Keluarga
} from "../models/associations.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";
import { hitungTanggalKeluarAnak } from "../helpers/tanggal-keluar.helper.js";

export const anakAngkatPasangan = async ({
  anak_id,
  perkawinan_id,
  tanggal_pengangkatan,
  status_hubungan,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false
}, passedTransaction = null) => {
  // Mulai transaksi database yang dilewatkan
  const t = passedTransaction || await db.transaction();

  try {
    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, {
      transaction: t
    });

    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan.");
    }

    const { 
      suami_id, 
      istri_id, 
      jenis_perkawinan 
    } = perkawinan;

    // Validasi ketersediaan data anak
    const anak = await KramaBali.findByPk(anak_id, {
      transaction: t
    });

    if (!anak) {
      throw new Error("Data anak tidak ditemukan.");
    }

    if (!tanggal_pengangkatan) {
      throw new Error("Tanggal pengangkatan wajib diisi!");
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
        ayah_id: suami_id,
        ibu_id: istri_id,
        status_hubungan,
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
          ayah_id: suami_id, 
          ibu_id: istri_id, 
          status_hubungan, 
          status_verifikasi: "Draft" 
        },
        transaction: t
      });

      if (relasi) {
        await relasi.update({
          status_verifikasi: "Disetujui",
          catatan_admin_desa
        }, { 
          transaction: t 
        });
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
      ayah_id: suami_id,
      ibu_id: istri_id,
      mode: "CAMPUR"
    }, t);

    let keluargaSuamiTarget = null;
    let keluargaIstriTarget = null;

    // =============================================================
    // MENCARI KELUARGA AKTIF BERDASARKAN JENIS PERKAWINAN
    // =============================================================
    if (jenis_perkawinan === "Pade Gelahang") {
      [keluargaSuamiTarget, keluargaIstriTarget] = await Promise.all([
        Keluarga.findOne({
          where: { 
            kepala_keluarga_id: suami_id, 
            jenis_keluarga: "Pade Gelahang", 
            status_keluarga: "Aktif" 
          },
          transaction: t
        }),
        Keluarga.findOne({
          where: { 
            kepala_keluarga_id: istri_id, 
            jenis_keluarga: "Pade Gelahang", 
            status_keluarga: "Aktif" 
          },
          transaction: t
        })
      ]);

      if (!keluargaSuamiTarget || !keluargaIstriTarget) {
        throw new Error("Keluarga Pade Gelahang dari salah satu atau kedua orang tua tidak ditemukan.");
      }

      // Masuk ke silsilah keluarga pihak ayah angkat
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ayah melalui ikatan perkawinan Pade Gelahang orang tua angkatnya.",
        event_date: tanggal_pengangkatan,
        allow_multiple: true,
        akhir_masuk: akhirMasukAnakAngkat
      }, t);

      // Masuk ke silsilah keluarga pihak ibu angkat
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ibu melalui ikatan perkawinan Pade Gelahang orang tua angkatnya.",
        event_date: tanggal_pengangkatan,
        allow_multiple: true,
        akhir_masuk: akhirMasukAnakAngkat
      }, t);
    } else if (jenis_perkawinan === "Nyentana") {
      keluargaIstriTarget = await Keluarga.findOne({
        where: { 
          kepala_keluarga_id: istri_id, 
          status_keluarga: "Aktif" 
        },
        transaction: t
      });

      if (!keluargaIstriTarget) {
        throw new Error("Keluarga aktif dari pihak istri (Purusa Nyentana) tidak ditemukan.");
      }

      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Kedudukan sebagai anggota keluarga diberikan karena krama ini di angkat sebagai anak oleh pasangan suami istri perkawinan nyentana yang sah.",
        event_date: tanggal_pengangkatan,
        akhir_masuk: akhirMasukAnakAngkat,
        allow_multiple: akhirMasukAnakAngkat ? true : false
      }, t);
    } else {
      keluargaSuamiTarget = await Keluarga.findOne({
        where: { 
          kepala_keluarga_id: suami_id, 
          status_keluarga: "Aktif" 
        },
        transaction: t
      });

      if (!keluargaSuamiTarget) {
        throw new Error("Keluarga aktif dari pihak suami (Purusa) tidak ditemukan.");
      }

      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Kedudukan sebagai anggota keluarga diberikan karena krama ini di angkat sebagai anak oleh pasangan suami istri perkawinan biasa yang sah.",
        event_date: tanggal_pengangkatan,
        akhir_masuk: akhirMasukAnakAngkat,
        allow_multiple: akhirMasukAnakAngkat ? true : false
      }, t);
    }

    // ==============================================================
    // LOGIKA REKONSILIASI DATA MANDIRI
    // ==============================================================
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

      if (jenis_perkawinan === "Pade Gelahang") {
        await riwayatMandiriDarurat.update({
          keluarga_id: keluargaSuamiTarget.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Krama dikembalikan ke keluarga angakt pihak ayah setelah data orang tua angkat ditemukan dalam perkawinan pade gelahang."
        }, { 
          transaction: t 
        });
        await simpanRiwayatKeluarga({
          krama_id: anak_id,
          keluarga_id: keluargaIstriTarget.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Krama dikembalikan ke keluarga angkat pihak ibu setelah data orang tua angkat ditemukan dalam perkawinan pade gelahang.",
          event_date: riwayatMandiriDarurat.awal_masuk,
          akhir_masuk: riwayatMandiriDarurat.akhir_masuk,
          allow_multiple: true
        }, t);
      } else {
        const keluargaTujuanId = keluargaSuamiTarget?.id || keluargaIstriTarget?.id;

        if (keluargaTujuanId) {
          await riwayatMandiriDarurat.update({
            keluarga_id: keluargaTujuanId,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga angkat sah setelah data orang tua angkat ditemukan."
          }, { 
            transaction: t 
          });
        }
      }
      // Nonaktifkan keluarga mandiri darurat lama agar tidak menggantung
      const idKeluargaBaruSuami = keluargaSuamiTarget?.id;
      const idKeluargaBaruIstri = keluargaIstriTarget?.id;

      if (idKeluargaLama && idKeluargaLama !== idKeluargaBaruSuami && idKeluargaLama !== idKeluargaBaruIstri) {
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
    return relasi;
  } catch (error) {
    if (t && !passedTransaction && !t.finished) {
      await t.rollback();
    }
    throw error;
  }
};