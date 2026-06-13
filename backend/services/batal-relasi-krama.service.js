import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Keluarga,
  KramaBali
} from "../models/associations.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";

export const batalkanRelasiKrama = async (relasiId) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(relasiId, {
      transaction: t
    });

    if (!relasi) {
      throw new Error("Data relasi krama tidak ditemukan.");
    }

    const { 
      anak_id, 
      ayah_id, 
      ibu_id, 
      status_hubungan, 
      tanggal_pengangkatan 
    } = relasi;

    // Validasi ketersediaan data anak
    const anak = await KramaBali.findByPk(anak_id, {
      transaction: t
    });

    if (!anak) {
      throw new Error("Data anak tidak ditemukan.");
    }

    // ==========================================
    // KONDISI 1: BATAL RELASI ANAK KANDUNG
    // ==========================================
    if (status_hubungan === "Anak Kandung") {
      await RiwayatKeluarga.destroy({
        where: {
          krama_id: anak_id,
          awal_masuk: anak.tanggal_lahir,
        },
        transaction: t
      });

      await relasi.destroy({ transaction: t });

      await hitungUrutanLahir({
        ayah_id,
        ibu_id,
        mode: "CAMPUR"
      }, t);

      await t.commit();
    }

    // ==========================================
    // KONDISI 2: BATAL RELASI ANAK ANGKAT
    // ==========================================
    if (status_hubungan === "Anak Angkat") {
      if (!tanggal_pengangkatan) {
        throw new Error("Tanggal pengangkatan tidak ditemukan.");
      }

      const kepala_keluarga_id = ayah_id || ibu_id;

      // Menghapus riwayat keluarga baru
      await RiwayatKeluarga.destroy({
        where: {
          krama_id: anak_id,
          awal_masuk: tanggal_pengangkatan
        },
        transaction: t
      });

      // Membuka kembali riwayat keluarga lama
      await RiwayatKeluarga.update(
        { akhir_masuk: null }, 
        {
          where: {
            krama_id: anak_id,
            akhir_masuk: tanggal_pengangkatan
          },
          transaction: t
        }
      );

      await relasi.destroy({ transaction: t });

      const sisaAnakAngkat = await RelasiKrama.count({
        where: {
          status_hubungan: "Anak Angkat",
          [Op.or]: [
            { ayah_id: kepala_keluarga_id },
            { ibu_id: kepala_keluarga_id }
          ]
        },
        transaction: t
      });

      // Rollback status peran adat orang tua karena pengangkatan ini
      if (kepala_keluarga_id) {
        await RiwayatPeranAdat.destroy({
          where: {
            krama_id: kepala_keluarga_id,
            mulai_tanggal: tanggal_pengangkatan
          },
          transaction: t
        });

        // Mengaktifkan kembali status peran adat sebelumnya
        await RiwayatPeranAdat.update(
          { selesai_tanggal: null },
          {
            where: {
              krama_id: kepala_keluarga_id,
              selesai_tanggal: tanggal_pengangkatan
            },
            transaction: t
          }
        );
      }

      // Cleanup keluarga angkat, jika anak terakhir dibatalkan
      if (sisaAnakAngkat === 0) {
        const keluargaAngkat = await Keluarga.findOne({
          where: {
            kepala_keluarga_id: kepala_keluarga_id,
            jenis_keluarga: "Keluarga Angkat"
          },
          transaction: t
        });

        if (keluargaAngkat) {
          await RiwayatKeluarga.destroy({
            where: {
              krama_id: kepala_keluarga_id,
              keluarga_id: keluargaAngkat.id
            },
            transaction: t
          });

          await keluargaAngkat.destroy({ transaction: t });
        }
      }

      // Menghitung ulang urutan lahir anak
      if (sisaAnakAngkat > 0) {
        await hitungUrutanLahir({
          ayah_id,
          ibu_id,
          kepala_keluarga_id, 
          mode: "ANGKAT"
        }, t);
      }

      await t.commit();
    }
  } catch (error) {
    await t.rollback();
    throw error;
  }
};