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
  // Mulai transaksi database
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

    // Membuat draft data relasi krama
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
      if (!passedTransaction) {
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

      // 1. Lacak wadah KK lewat riwayat aktif pihak Purusa (Suami pada perkawinan biasa)
      let riwayatWadah = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: purusaId, 
          akhir_masuk: null // Menyatakan krama masih aktif bernaung di KK tersebut
        },
        transaction: t
      });

      // 2. FALLBACK ADAT (Kasus Cerai Mati / Suami Purusa Meninggal Dunia):
      // Jika riwayat aktif suami sudah ditutup (akhir_masuk terisi tanggal wafat),
      // temukan wadah keluarga perkawinan tempat keturunan bernaung melalui riwayat aktif sang istri (Predana)
      if (!riwayatWadah) {
        riwayatWadah = await RiwayatKeluarga.findOne({
          where: { 
            krama_id: predanaId,
            akhir_masuk: null // Istri masih aktif menetap di KK perkawinan tersebut
          },
          transaction: t
        });
      }

      if (!riwayatWadah) {
        throw new Error("Wadah keluarga aktif tempat keturunan ditampung tidak ditemukan.");
      }

      const wadahKeluargaId = riwayatWadah.keluarga_id;

      // Memasok objek target untuk kebutuhan sinkronisasi blok rekonsiliasi darurat di bawah
      if (jenis_perkawinan === "Nyentana") {
        keluargaIstriTarget = { id: wadahKeluargaId };
      } else {
        keluargaSuamiTarget = { id: wadahKeluargaId };
      }

      // Simpan riwayat anak ke dalam wadah KK perkawinan orang tua yang berhasil dilacak
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: wadahKeluargaId,
        kedudukan: "Anggota", // Sesuai kolom model: kedudukan
        dasar_keputusan: `Kedudukan sebagai anggota diberikan karena krama ini merupakan anak kandung hasil perkawinan orang tuanya (${jenis_perkawinan}).`,
        event_date: anak.tanggal_lahir,
        akhir_masuk: tanggal_keluar, // Sesuai kolom model: akhir_masuk
        allow_multiple: tanggal_keluar ? true : false 
      }, t);
    }

    // ==============================================================
    // LOGIKA REKONSILIASI DATA MANDIRI
    // ==============================================================
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga", // Sesuai kolom model: kedudukan
        awal_masuk: { [Op.gte]: tanggal_keluar || anak.tanggal_lahir }, // Sesuai kolom model: awal_masuk
        akhir_masuk: null // Sesuai kolom model: akhir_masuk
      },
      include: [{ 
        association: "detail_keluarga", 
        where: { jenis_keluarga: "Keluarga Asal" } 
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
        }, { transaction: t });

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
            dasar_keputusan: "Krama dikembalikan ke wadah keluarga perkawinan kandung orang tuanya."
          }, { transaction: t });
        }
      }

      const idKeluargaBaruSuami = keluargaSuamiTarget?.id;
      const idKeluargaBaruIstri = keluargaIstriTarget?.id;

      if (idKeluargaLama && idKeluargaLama !== idKeluargaBaruSuami && idKeluargaLama !== idKeluargaBaruIstri) {
        await Keluarga.update(
          { status_keluarga: "Non-Aktif" },
          { where: { id: idKeluargaLama }, transaction: t }
        );
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

export const updateAnakKandung = async (relasiId, {
  anak_id,
  perkawinan_id,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa
}, passedTransaction = null) => {
  // Mulai transaksi database
  const t = passedTransaction || await db.transaction();

  try {
    if (!relasiId) {
      throw new Error("ID Relasi yang akan diupdate wajib disertakan.");
    }

    // Mengambil data relasi krama yang lama
    const relasiLama = await RelasiKrama.findByPk(relasiId, {
      include: [{ model: KramaBali, as: "anak" }],
      transaction: t
    });

    if (!relasiLama) {
      throw new Error("Data relasi krama lama tidak ditemukan.");
    }

    const idAnakLama = relasiLama.anak_id;
    const statusHubunganLama = relasiLama.status_hubungan;

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

    // Membersihkan riwayat keluarga dan peran lama
    await RiwayatKeluarga.destroy({
      where: { krama_id: idAnakLama },
      transaction: t
    });

    if (statusHubunganLama === "Anak Angkat") {
      const listOrangTuaLama = [relasiLama.ayah_id, relasiLama.ibu_id].filter(Boolean);
      if (listOrangTuaLama.length > 0) {
        await RiwayatPeranAdat.destroy({
          where: { 
            krama_id: { [Op.in]: listOrangTuaLama } 
          },
          transaction: t
        });
      }
    }

    await relasiLama.update({
      anak_id,
      ayah_id: suami_id,
      ibu_id: istri_id,
      status_hubungan: "Anak Kandung",
      tanggal_pengangkatan: null,
      perkawinan_id,
      user_id,             
      status_verifikasi,   
      catatan_admin_desa
    }, { transaction: t });

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasiLama;
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

      // Masuk ke silsilah keluarga pihak ayah
      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        kedudukan: "Anggota",
        awal_masuk: anak.tanggal_lahir,
        akhir_masuk: tanggal_keluar,
        dasar_keputusan: "Krama dicatat sebagai anak kandung dalam keluarga pihak ayah karena perkawinan Pade Gelahang orang tuanya. (Koreksi Data)"
      }, { 
        transaction: t 
      });

      // Masuk ke silsilah keluarga pihak ibu
      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        awal_masuk: anak.tanggal_lahir,
        akhir_masuk: tanggal_keluar,
        dasar_keputusan: "Krama dicatat sebagai anak kandung dalam keluarga pihak ibu karena perkawinan Pade Gelahang orang tuanya. (Koreksi Data)"
      }, { 
        transaction: t 
      });
    } else {
      // PERKAWINAN BIASA ATAU NYENTANA
      const purusaId = jenis_perkawinan === "Nyentana" ? istri_id : suami_id;
      const predanaId = jenis_perkawinan === "Nyentana" ? suami_id : istri_id;

      // Mencari data keluarga yang dipicu karena perkawinan
      let riwayatWadah = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: purusaId, 
          akhir_masuk: null 
        },
        transaction: t
      });

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
        throw new Error("Keluarga tidak ditemukan.");
      }

      const wadahKeluargaId = riwayatWadah.keluarga_id;

      if (jenis_perkawinan === "Nyentana") {
        keluargaIstriTarget = { id: wadahKeluargaId };
      } else {
        keluargaSuamiTarget = { id: wadahKeluargaId };
      }

      // Simpan riwayat anak ke dalam wadah KK perkawinan orang tua yang berhasil dilacak
      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: wadahKeluargaId,
        kedudukan: "Anggota",
        awal_masuk: anak.tanggal_lahir,
        akhir_masuk: tanggal_keluar,
        dasar_keputusan: `Kedudukan sebagai anggota diberikan karena krama merupakan anak kandung hasil perkawinan orang tua (${jenis_perkawinan}). (Koreksi Data)`
      }, { 
        transaction: t 
      });
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
        where: { jenis_keluarga: "Keluarga Asal" } 
      }],
      transaction: t
    });

    if (riwayatMandiriDarurat) {
      const idKeluargaLama = riwayatMandiriDarurat.keluarga_id;

      if (jenis_perkawinan === "Pade Gelahang") {
        await riwayatMandiriDarurat.update({
          keluarga_id: keluargaSuamiTarget.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Krama dikembalikan ke keluarga kandung pihak ayah setelah silsilah dikoreksi."
        }, { 
          transaction: t 
        });

        await RiwayatKeluarga.create({
          krama_id: anak_id,
          keluarga_id: keluargaIstriTarget.id,
          kedudukan: "Anggota",
          awal_masuk: riwayatMandiriDarurat.awal_masuk,
          akhir_masuk: riwayatMandiriDarurat.akhir_masuk,
          dasar_keputusan: "Krama dikembalikan ke keluarga kandung pihak ibu setelah silsilah dikoreksi."
        }, { 
          transaction: t 
        });

      } else {
        const keluargaTujuanId = keluargaSuamiTarget?.id || keluargaIstriTarget?.id;

        if (keluargaTujuanId) {
          await riwayatMandiriDarurat.update({
            keluarga_id: keluargaTujuanId,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke wadah keluarga perkawinan kandung orang tuanya."
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

    if (!passedTransaction) {
      await t.commit();
    }
    return relasiLama;
  } catch (error) {
    if (!passedTransaction) {
      await t.rollback();
    }
    throw error;
  }
};