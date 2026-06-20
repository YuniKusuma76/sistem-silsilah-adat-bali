import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan, 
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  RiwayatPeranAdat, 
  Keluarga
} from "../models/associations.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";
import { hitungTanggalKeluarAnak } from "../helpers/tanggal-keluar.helper.js";

export const buatAnakKandung = async ({
  anak_id,
  perkawinan_id,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa
}, passedTransaction = null) => {
  // Mulai transaksi database yang dilewatkan
  const t = passedTransaction || await db.transaction();

  try {
    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id,{
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

    const relasi = await RelasiKrama.create({
      anak_id,
      ayah_id: suami_id,
      ibu_id: istri_id,
      status_hubungan: "Anak Kandung",
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

    // Logika Chronological Stitching dan Urutan Lahir
    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, anak.tanggal_lahir, t);

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
      // Mencari keluarga pihak suami
      const riwayatSuami = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: suami_id, 
          akhir_masuk: null 
        },
        transaction: t
      });

      // Mencari keluarga pihak istri
      const riwayatIstri = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: istri_id, 
          akhir_masuk: null 
        },
        transaction: t
      });

      if (!riwayatSuami || !riwayatIstri) {
        throw new Error("Pelacakan keluarga aktif Pade Gelahang gagal. Riwayat aktif orang tua tidak ditemukan.");
      }

      keluargaSuamiTarget = { id: riwayatSuami.keluarga_id };
      keluargaIstriTarget = { id: riwayatIstri.keluarga_id };

      // Masuk ke silsilah keluarga pihak ayah
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama ini dicatat sebagai anak kandung dalam keluarga pihak ayah karena perkawinan pade gelahang orang tuanya.",
        event_date: anak.tanggal_lahir,
        allow_multiple: true,
        akhir_masuk: tanggal_keluar
      }, t);

      // Masuk ke silsilah keluarga pihak ibu
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama ini dicatat sebagai anak kandung dalam keluarga pihak ibu karena perkawinan pade gelahang orang tuanya.",
        event_date: anak.tanggal_lahir,
        allow_multiple: true,
        akhir_masuk: tanggal_keluar 
      }, t);
    } else {
      // PERKAWINAN BIASA ATAU NYENTANA
      const purusaId = jenis_perkawinan === "Nyentana" ? istri_id : suami_id;
      const predanaId = jenis_perkawinan === "Nyentana" ? suami_id : istri_id;

      let riwayatWadah = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: purusaId, 
          akhir_masuk: null 
        },
        transaction: t
      });

      // Mencari riwayat keluarga aktif melalui istri
      if (!riwayatWadah) {
        riwayatWadah = await RiwayatKeluarga.findOne({
          where: { 
            krama_id: predanaId, 
            akhir_masuk: null 
          },
          transaction: t
        });
      }

      if (!riwayatWadah) {
        throw new Error("Riwayat keluarga aktif tidak ditemukan.");
      }

      const wadahKeluargaId = riwayatWadah.keluarga_id;
      if (jenis_perkawinan === "Nyentana") {
        keluargaIstriTarget = { id: wadahKeluargaId };
      } else {
        keluargaSuamiTarget = { id: wadahKeluargaId };
      }

      // Simpan riwayat anak ke dalam wadah KK perkawinan orang tua yang berhasil dilacak
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: wadahKeluargaId,
        kedudukan: "Anggota", 
        dasar_keputusan: `Kedudukan sebagai anggota diberikan karena krama ini merupakan anak kandung hasil perkawinan orang tuanya (${jenis_perkawinan}).`,
        event_date: anak.tanggal_lahir,
        akhir_masuk: tanggal_keluar, 
        allow_multiple: tanggal_keluar ? true : false 
      }, t);
    }

    // ==============================================================
    // LOGIKA REKONSILIASI DATA MANDIRI
    // ==============================================================
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga", 
        awal_masuk: { [Op.gte]: tanggal_keluar || anak.tanggal_lahir }, 
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
          dasar_keputusan: "Krama dikembalikan ke keluarga kandung pihak ayah setelah data perkawinan ditemukan."
        }, { 
          transaction: t 
        });
        await simpanRiwayatKeluarga({
          krama_id: anak_id,
          keluarga_id: keluargaIstriTarget.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Krama dikembalikan ke keluarga kandung pihak ibu setelah data perkawinan ditemukan.",
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
            dasar_keputusan: "Krama dikembalikan ke keluarga perkawinan kandung orang tuanya."
          }, { 
            transaction: t 
          });
        }
      }

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