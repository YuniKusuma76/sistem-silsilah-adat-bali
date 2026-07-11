import { Op } from "sequelize";
import {
  Perkawinan,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Keluarga,
  RelasiKrama
} from "../models/associations.js";

// Helper: Membuat rentang waktu dalam satu hari
const dapatkanRentangHari = (stringTanggal) => {
  if (!stringTanggal) return null;
  const tglMurni = stringTanggal.split(" ")[0].split("T")[0];
  return {
    [Op.between]: [`${tglMurni} 00:00:00`, `${tglMurni} 23:59:59`]
  };
};

export const eksekusiRollbackPerkawinan = async (perkawinan, tipe_rollback, t) => {
  const {
    id: perkawinan_id,
    suami_id,
    istri_id,
    jenis_perkawinan,
    tanggal_perkawinan,
    tanggal_cerai
  } = perkawinan;

  const isNyentana = jenis_perkawinan === "Nyentana";
  const purusaId = isNyentana ? istri_id : suami_id;
  const pradanaId = isNyentana ? suami_id : istri_id;

  // =====================================================================
  // SKENARIO 1: ROLLBACK DAMPAK PERCERAIAN 
  // =====================================================================
  if (tipe_rollback === "PERCERAIAN") {
    if (!tanggal_cerai) {
      throw new Error("Tanggal perceraian tidak ditemukan.");
    }

    const rentangHariCerai = dapatkanRentangHari(tanggal_cerai);

    await RiwayatKeluarga.update(
      { akhir_masuk: null },
      {
        where: {
          perkawinan_id: perkawinan_id,
          akhir_masuk: rentangHariCerai
        },
        transaction: t
      }
    );

    await RiwayatPeranAdat.update(
      { selesai_tanggal: null },
      {
        where: {
          perkawinan_id: perkawinan_id,
          kategori_event: "KAWIN",
          selesai_tanggal: rentangHariCerai
        },
        transaction: t
      }
    );

    return { 
      message: "Rollback dampak perceraian berhasil dieksekusi." 
    };
  }

  // =====================================================================
  // SKENARIO 2: ROLLBACK DAMPAK PERKAWINAN 
  // =====================================================================
  if (tipe_rollback === "PERKAWINAN") {
    if (!tanggal_perkawinan) {
      throw new Error("Tanggal perkawinan tidak ditemukan.");
    }

    const rentangHariKawin = dapatkanRentangHari(tanggal_perkawinan);

    // mengamankan relasi anak agar tidak hilang
    await RelasiKrama.update(
      { catatan_admin_desa: `Relasi anak diamankan sementara karena ada proses perubahan data perkawinan orang tua.` },
      {
        where: { 
          ayah_id: suami_id,
          ibu_id: istri_id
        },
        transaction: t
      }
    );

    // menghapus riwayat keluarga yang terbentuk karena perkawinan ini
    await RiwayatKeluarga.destroy({
      where: {
        perkawinan_id: perkawinan_id,
        awal_masuk: rentangHariKawin
      },
      transaction: t
    });

    // membuka kembali linimasa keluarga lama
    await RiwayatKeluarga.update(
      { akhir_masuk: null },
      {
        where: {
          krama_id: [suami_id, istri_id],
          akhir_masuk: rentangHariKawin
        },
        transaction: t
      }
    );

    await RiwayatPeranAdat.destroy({
      where: {
        perkawinan_id: perkawinan_id,
        mulai_tanggal: rentangHariKawin,
        kategori_event: "KAWIN"
      },
      transaction: t
    });

    // membuka kembali riwayat peran adat sebelumnya
    await RiwayatPeranAdat.update(
      { selesai_tanggal: null },
      {
        where: {
          krama_id: [suami_id, istri_id],
          selesai_tanggal: rentangHariKawin
        },
        transaction: t
      }
    );

    // menghapus keluarga yang terbentuk karena perkawinan ini
    const keluargaTerbentuk = await Keluarga.findOne({
      where: {
        kepala_keluarga_id: purusaId
      },
      transaction: t
    });

    if (keluargaTerbentuk) {
      const sisaAnggotaKeluarga = await RiwayatKeluarga.count({
        where: {
          keluarga_id: keluargaTerbentuk.id,
          akhir_masuk: null
        },
        transaction: t
      });

      if (sisaAnggotaKeluarga === 0) {
        await keluargaTerbentuk.destroy({ transaction: t });
      }
    }

    return { 
      message: "Rollback dampak perkawinan lama berhasil dieksekusi bersih." 
    };
  }
};