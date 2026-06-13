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
  // Mulai transaksi database
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
    const riwayatLama = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: anak_id, 
        akhir_masuk: null 
      },
      transaction: t
    });

    if (riwayatLama && new Date(riwayatLama.awal_masuk) >= new Date(tanggal_pengangkatan)) {
      throw new Error("Tanggal pengangkatan tidak boleh lebih awal dari tanggal masuk keluarga sebelumnya.");
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
          status_verifikasi: "Disetujui" 
        },
        transaction: t
      });
    }

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // Logika Chronological Stitching dan Backward Stitching
    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tanggal_pengangkatan, t);

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
        akhir_masuk: tanggal_keluar
      }, t);

      // Masuk ke silsilah keluarga pihak ibu angkat
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ibu melalui ikatan perkawinan Pade Gelahang orang tua angkatnya.",
        event_date: tanggal_pengangkatan,
        allow_multiple: true,
        akhir_masuk: tanggal_keluar
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
        akhir_masuk: tanggal_keluar,
        allow_multiple: tanggal_keluar ? true : false
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
        awal_masuk: { [Op.gte]: tanggal_keluar || tanggal_pengangkatan }, 
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
    if (!passedTransaction) {
      await t.commit();
    }
    return relasi;
  } catch (error) {
    if (!passedTransaction && t) {
      await t.rollback();
    }
    throw error;
  }
};

export const updateAnakAngkatPasangan = async (relasiId, {
  anak_id,
  perkawinan_id,
  tanggal_pengangkatan,
  status_hubungan,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false
}, passedTransaction = null) => {
  // Mulai transaksi database
  const t = passedTransaction || await db.transaction();

  try {
    if (!relasiId) {
      throw new Error("ID Relasi yang akan diupdate wajib disertakan.");
    }

    if (!tanggal_pengangkatan) {
      throw new Error("Tanggal pengangkatan wajib diisi!");
    }

    // Mengambil data relasi silsilah LAMA sebelum diperbarui
    const relasiLama = await RelasiKrama.findByPk(relasiId, {
      include: [{ model: KramaBali, as: "anak" }],
      transaction: t
    });

    if (!relasiLama) {
      throw new Error("Data relasi krama lama tidak ditemukan.");
    }

    const idAnakLama = relasiLama.anak_id;
    const idAyahLama = relasiLama.ayah_id;
    const idIbuLama = relasiLama.ibu_id;
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

    // Menghapus riwayat keluarga dan peran adat lama
    console.log("✏️ Teardown Koreksi Anak Angkat Pasangan: Menghapus log riwayat lama...");
    
    await RiwayatKeluarga.destroy({
      where: { krama_id: idAnakLama },
      transaction: t
    });

    const listOrangTuaLama = [idAyahLama, idIbuLama].filter(Boolean);
    if (statusHubunganLama === "Anak Angkat" && listOrangTuaLama.length > 0) {
      await RiwayatPeranAdat.destroy({
        where: {
          krama_id: { [Op.in]: listOrangTuaLama }
        },
        transaction: t
      });
    }

    await relasiLama.update({
      anak_id,
      ayah_id: suami_id,
      ibu_id: istri_id,
      status_hubungan,
      tanggal_pengangkatan,
      perkawinan_id,
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
      return relasiLama;
    }

    // Logika Chronological Stitching dan Backward Stitching
    console.log("🌱 Rebuild: Membangun kembali riwayat yang valid untuk pasangan baru...");

    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tanggal_pengangkatan, t);

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
      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        kedudukan: "Anggota",
        awal_masuk: tanggal_pengangkatan,
        akhir_masuk: tanggal_keluar,
        keterangan: "Krama diangkat sebagai anak ke dalam keluarga pihak ayah melalui ikatan perkawinan Pade Gelahang orang tua angkatnya. (Koreksi Data)"
      }, { 
        transaction: t 
      });

      // Masuk ke silsilah keluarga pihak ibu angkat
      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        awal_masuk: tanggal_pengangkatan,
        akhir_masuk: tanggal_keluar,
        keterangan: "Krama diangkat sebagai anak ke dalam keluarga pihak ibu melalui ikatan perkawinan Pade Gelahang orang tua angkatnya. (Koreksi Data)"
      }, { 
        transaction: t 
      });
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

      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        kedudukan: "Anggota",
        awal_masuk: tanggal_pengangkatan,
        akhir_masuk: tanggal_keluar,
        keterangan: "Kedudukan sebagai anggota keluarga diberikan karena krama ini di angkat sebagai anak oleh pasangan suami istri perkawinan nyentana yang sah. (Koreksi Data)"
      }, { 
        transaction: t 
      });
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

      await RiwayatKeluarga.create({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        kedudukan: "Anggota",
        awal_masuk: tanggal_pengangkatan,
        akhir_masuk: tanggal_keluar,
        keterangan: "Kedudukan sebagai anggota keluarga diberikan karena krama ini di angkat sebagai anak oleh pasangan suami istri perkawinan biasa yang sah. (Koreksi Data)"
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
        awal_masuk: { [Op.gte]: tanggal_keluar || tanggal_pengangkatan }, 
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
          dasar_keputusan: "Krama dikembalikan ke keluarga angkat pihak ayah setelah data orang tua angkat ditemukan dalam perkawinan pade gelahang."
        }, { transaction: t });

        await RiwayatKeluarga.create({
          krama_id: anak_id,
          keluarga_id: keluargaIstriTarget.id,
          kedudukan: "Anggota",
          awal_masuk: riwayatMandiriDarurat.awal_masuk,
          akhir_masuk: riwayatMandiriDarurat.akhir_masuk,
          keterangan: "Krama dikembalikan ke keluarga angkat pihak ibu setelah data orang tua angkat ditemukan dalam perkawinan pade gelahang. (Koreksi)"
        }, { transaction: t });

      } else {
        const keluargaTujuanId = keluargaSuamiTarget?.id || keluargaIstriTarget?.id;

        if (keluargaTujuanId) {
          await riwayatMandiriDarurat.update({
            keluarga_id: keluargaTujuanId,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga angkat sah setelah data orang tua angkat ditemukan."
          }, { transaction: t });
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
    if (!passedTransaction && t) {
      await t.rollback();
    }
    throw error;
  }
};