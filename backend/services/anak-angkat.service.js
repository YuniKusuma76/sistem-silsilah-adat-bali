import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  RiwayatPeranAdat, 
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
  // Mulai transaksi database
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
      akhir_masuk_anak: tanggal_keluar
    }, t);

    // LOGIKA REKONSILIASI DATA MANDIRI
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga",
        awal_masuk: { [Op.gte]: tanggal_keluar || tanggal_pengangkatan }, 
        akhir_masuk: null
      },
      include: [{ 
        association: "detail_keluarga", 
        where: { 
          jenis_keluarga: "Keluarga Asal" 
        } 
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
    if (!passedTransaction) {
      await t.commit();
    }
    return relasi || true;
  } catch (error) {
    if (!passedTransaction && t) {
      await t.rollback();
    }
    throw error;
  }
};

export const updateAnakAngkat = async (relasiId, {
  anak_id,
  ayah_id,
  ibu_id,
  tanggal_pengangkatan,
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

    if (!ayah_id && !ibu_id) {
      throw new Error("Minimal satu data orang tua angkat wajib terdaftar!");
    }

    if (!tanggal_pengangkatan) {
      throw new Error("Tanggal pengangkatan wajib diisi!");
    }

    // Mengambil data relasi krama lama yang tersimpan di database
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

    const kepala_keluarga_id = ayah_id || ibu_id;

    // Validasi ketersediaan data anak
    const anak = await KramaBali.findByPk(anak_id, {
      transaction: t
    });

    if (!anak) {
      throw new Error("Data anak angkat tidak ditemukan.");
    }

    // Menghapus riwayat keluarga dan peran adat lamat
    console.log("✏️ Teardown Koreksi Anak Angkat: Menghapus log riwayat lama yang salah...");
    
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
      ayah_id,
      ibu_id,
      status_hubungan: "Anak Angkat",
      tanggal_pengangkatan,
      perkawinan_id: null,
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


    // Logika Chronological Stitching dan Backward Stitching
    console.log("🌱 Rebuild: Membangun log riwayat baru untuk aktor baru...");
    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tanggal_pengangkatan, t);

    await hitungUrutanLahir({
      mode: "ANGKAT", 
      kepala_keluarga_id: kepala_keluarga_id
    }, t);

    const totalAnakAngkat = await hitungJumlahPengangkatan(kepala_keluarga_id, t);

    // Mapping Status Peran Adat untuk Orang Tua Angkat
    const keputusan = await mappingAturanAdatBali("PENGANGKATAN", {
      jumlah_anak_angkat: totalAnakAngkat
    }, t);

    await RiwayatPeranAdat.create({
      krama_id: kepala_keluarga_id,
      status_peran_adat: keputusan.status_peran_adat,
      garis_keturunan: keputusan.garis_keturunan,
      dasar_keputusan: keputusan.dasar_keputusan,
      mulai_tanggal: tanggal_pengangkatan,
      selesai_tanggal: null
    }, { 
      transaction: t 
    });

    // Membentuk riwayat keluarga
    let keluargaAngkat = await Keluarga.findOne({
      where: {
        kepala_keluarga_id: kepala_keluarga_id,
        jenis_keluarga: "Keluarga Angkat",
        status_keluarga: "Aktif"
      },
      transaction: t
    });

    if (!keluargaAngkat) {
      keluargaAngkat = await Keluarga.create({
        kepala_keluarga_id: kepala_keluarga_id,
        jenis_keluarga: "Keluarga Angkat",
        status_keluarga: "Aktif"
      }, { 
        transaction: t 
      });
    }

    await RiwayatKeluarga.create({
      krama_id: anak_id,
      keluarga_id: keluargaAngkat.id,
      kedudukan: "Anggota",
      awal_masuk: tanggal_pengangkatan, 
      akhir_masuk: tanggal_keluar,
      dasar_keputusan: keputusan.dasar_keputusan
    }, { 
      transaction: t 
    });

    // LOGIKA REKONSILIASI DATA MANDIRI
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga",
        awal_masuk: { [Op.gte]: tanggal_keluar || tanggal_pengangkatan }, 
        akhir_masuk: null
      },
      include: [{ 
        association: "detail_keluarga", 
        where: { 
          jenis_keluarga: "Keluarga Asal" 
        } 
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