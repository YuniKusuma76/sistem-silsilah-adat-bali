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

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const anakAngkatPasangan = async ({
  anak_id,
  perkawinan_id,
  tanggal_pengangkatan,
  status_hubungan = "Anak Angkat",
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
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

    // Validasi ketersediaan data anak dan orang tua
    const anak = await KramaBali.findByPk(anak_id, { 
      transaction: t 
    });

    if (!anak) {
      throw new Error("Data anak tidak ditemukan.");
    }

    const [suamiData, istriData] = await Promise.all([
      KramaBali.findByPk(suami_id, { 
        attributes: ["desa_adat_id"], 
        transaction: t 
      }),
      KramaBali.findByPk(istri_id, { 
        attributes: ["desa_adat_id"], 
        transaction: t 
      })
    ]);

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
    const desaAdatTujuanId = jenis_perkawinan === "Nyentana" 
      ? istriData?.desa_adat_id 
      : suamiData?.desa_adat_id;

    // Manajemen Pencatatan Relasi Krama
    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id,
        ayah_id: suami_id,
        ibu_id: istri_id,
        status_hubungan,
        tanggal_pengangkatan: tglAngkatDateOnly,
        user_id,             
        status_verifikasi,   
        catatan_admin_desa,
        desa_adat_id_tujuan: desaAdatTujuanId
      }, { transaction: t });
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
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ayah melalui ikatan perkawinan Pade Gelahang orang tua angkatnya." + infoTambahanDasar,
        event_date: tglAngkatTimestamp,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
        allow_multiple: true,
        akhir_masuk: akhirMasukAnakAngkat
      }, t);

      // Masuk ke silsilah keluarga pihak ibu angkat
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ibu melalui ikatan perkawinan Pade Gelahang orang tua angkatnya." + infoTambahanDasar,
        event_date: tglAngkatTimestamp,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
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
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: `Kedudukan sebagai anggota keluarga diberikan karena krama ini diangkat sebagai anak (${status_hubungan}) oleh pasangan suami istri perkawinan nyentana yang sah.` + infoTambahanDasar,
        event_date: tglAngkatTimestamp,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
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
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: `Kedudukan sebagai anggota keluarga diberikan karena krama ini diangkat sebagai anak (${status_hubungan}) oleh pasangan suami istri perkawinan biasa yang sah.` + infoTambahanDasar,
        event_date: tglAngkatTimestamp,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
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

      if (jenis_perkawinan === "Pade Gelahang") {
        await riwayatMandiriDarurat.update({
          keluarga_id: keluargaSuamiTarget.id,
          perkawinan_id: perkawinan_id,
          kedudukan: "Anggota",
          kategori_event: "PENGANGKATAN",
          bobot_event: BOBOT_EVENT["PENGANGKATAN"],
          dasar_keputusan: "Krama dikembalikan ke keluarga angkat pihak ayah setelah data orang tua angkat ditemukan dalam perkawinan pade gelahang."
        }, { transaction: t });

        await simpanRiwayatKeluarga({
          krama_id: anak_id,
          keluarga_id: keluargaIstriTarget.id,
          perkawinan_id: perkawinan_id,
          kedudukan: "Anggota",
          dasar_keputusan: "Krama dikembalikan ke keluarga angkat pihak ibu setelah data orang tua angkat ditemukan dalam perkawinan pade gelahang.",
          event_date: riwayatMandiriDarurat.awal_masuk,
          kategori_event: "PENGANGKATAN",
          bobot_event: BOBOT_EVENT["PENGANGKATAN"],
          akhir_masuk: riwayatMandiriDarurat.akhir_masuk,
          allow_multiple: true
        }, t);
      } else {
        const keluargaTujuanId = keluargaSuamiTarget?.id || keluargaIstriTarget?.id;

        if (keluargaTujuanId) {
          await riwayatMandiriDarurat.update({
            keluarga_id: keluargaTujuanId,
            perkawinan_id: perkawinan_id,
            kedudukan: "Anggota",
            kategori_event: "PENGANGKATAN",
            bobot_event: BOBOT_EVENT["PENGANGKATAN"],
            dasar_keputusan: "Krama dikembalikan ke keluarga angkat sah setelah data orang tua angkat ditemukan."
          }, { transaction: t });
        }
      }
      // Nonaktifkan keluarga mandiri darurat lama agar tidak menggantung
      const idKeluargaBaruSuami = keluargaSuamiTarget?.id;
      const idKeluargaBaruIstri = keluargaIstriTarget?.id;

      if (idKeluargaLama && idKeluargaLama !== idKeluargaBaruSuami && idKeluargaLama !== idKeluargaBaruIstri) {
        await Keluarga.update(
          { status_keluarga: "Non-Aktif" },
          { where: { id: idKeluargaLama }, transaction: t }
        );
      }
    }

    // MUTASI PENGANGKATAN ANAK LINTAS DESA
    if (desaAdatTujuanId) {
      await KramaBali.update(
        { desa_adat_id: desaAdatTujuanId },
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