import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan,
  RelasiKrama,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Keluarga
} from "../models/associations.js";

export const batalkanPerkawinan = async (perkawinan_id) => {
  // Mulai transaksi database
  const t = await db.transaction();

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
      keluarga_baru_id, 
      tanggal_perkawinan,
      status_perkawinan,
      jenis_perkawinan
    } = perkawinan;

    if (status_perkawinan !== "Kawin") {
      throw new Error("Perkawinan ini sudah dalam status cerai.");
    }

    // Validasi adanya relasi dengan anak
    const cekAnak = await RelasiKrama.findOne({
      where: {
        [Op.or]: [
          { ayah_id: suami_id },
          { ibu_id: istri_id }
        ],
        tanggal_pengangkatan: { 
          [Op.or]: [
            null, 
            { [Op.gte]: tanggal_perkawinan }
          ] 
        }
      },
      transaction: t
    });

    if (cekAnak) {
      throw new Error("Tidak dapat membatalkan perkawinan! Pasangan ini telah memiliki anak yang terdaftar.");
    }

    // ==========================================
    // STEP 1: ROLLBACK RIWAYAT KELUARGA
    // ==========================================
    if (keluarga_baru_id) {
      await RiwayatKeluarga.destroy({
        where: {
          keluarga_id: keluarga_baru_id,
          krama_id: { [Op.or]: [suami_id, istri_id] },
        },
        transaction: t
      });
    }

    if (jenis_perkawinan === "Pade Gelahang") {
      await RiwayatKeluarga.destroy({
        where: {
          awal_masuk: tanggal_perkawinan,
          krama_id: { [Op.or]: [suami_id, istri_id] }
        },
        transaction: t
      });
    }

    // Membuka kembali riwayat keluarga lama
    await RiwayatKeluarga.update(
      { akhir_masuk: null },
      {
        where: {
          krama_id: { [Op.or]: [suami_id, istri_id] },
          akhir_masuk: tanggal_perkawinan
        },
        transaction: t
      }
    );

    const keluargaLamaAktif = await RiwayatKeluarga.findAll({
      where: {
        krama_id: { [Op.or]: [suami_id, istri_id] },
        akhir_masuk: null 
      },
      transaction: t
    });

    const idsKeluargaLama = [...new Set(keluargaLamaAktif.map(r => r.keluarga_id))];
    if (idsKeluargaLama.length > 0) {
      await Keluarga.update(
        { status_keluarga: "Aktif" },
        { 
          where: { 
            id: { [Op.in]: idsKeluargaLama } 
          }, 
          transaction: t 
        }
      );
    }

    // ==========================================
    // STEP 2: ROLLBACK RIWAYAT PERAN ADAT
    // ==========================================
    await RiwayatPeranAdat.destroy({
      where: {
        krama_id: { [Op.or]: [suami_id, istri_id] },
        mulai_tanggal: tanggal_perkawinan
      },
      transaction: t
    });

    // Membuka kembali status peran adat sebelumnya
    await RiwayatPeranAdat.update(
      { selesai_tanggal: null },
      {
        where: {
          krama_id: { [Op.or]: [suami_id, istri_id] },
          selesai_tanggal: tanggal_perkawinan
        },
        transaction: t
      }
    );

    // ========================================
    // STEP 3: CLEANUP KELUARGA & MASTER DATA 
    // ========================================
    if (jenis_perkawinan === "Pade Gelahang") {
      const keluargaPadeGelahang = await Keluarga.findAll({
        where: {
          kepala_keluarga_id: { [Op.in]: [suami_id, istri_id] },
          jenis_keluarga: "Pade Gelahang"
        },
        transaction: t
      });

      for (const keluarga of keluargaPadeGelahang) {
        const sisaAnggota = await RiwayatKeluarga.count({ 
          where: { 
            keluarga_id: keluarga.id 
          }, 
          transaction: t 
        });

        if (sisaAnggota === 0) {
          await keluarga.destroy({ transaction: t });
        }
      }
    }

    // Logika untuk perkawinan biasa dan nyentana
    if (keluarga_baru_id) {
      const sisaAnggota = await RiwayatKeluarga.count({
        where: { 
          keluarga_id: keluarga_baru_id 
        },
        transaction: t
      });

      if (sisaAnggota === 0) {
        await Keluarga.destroy({
          where: { 
            id: keluarga_baru_id 
          },
          transaction: t
        });
      }
    }

    await perkawinan.destroy({ transaction: t });
    await t.commit();
  } catch (error) {
    if (t) {
      await t.rollback();
    }
    throw error;
  }
};