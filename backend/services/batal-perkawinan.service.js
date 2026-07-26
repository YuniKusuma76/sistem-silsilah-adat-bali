import { Op } from "sequelize";
import {
  Perkawinan,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  KramaBali,
  Keluarga,
  RelasiKrama
} from "../models/associations.js";

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
    tanggal_cerai,
    status_perkawinan,
    pihak_meninggal
  } = perkawinan;

  const isNyentana = jenis_perkawinan === "Nyentana";
  const purusaId = isNyentana ? istri_id : suami_id;
  const predanaId = isNyentana ? suami_id : istri_id;

  // =====================================================================
  // SKENARIO 1: ROLLBACK DAMPAK PERCERAIAN 
  // =====================================================================
  if (tipe_rollback === "PERCERAIAN") {
    if (!tanggal_cerai) {
      throw new Error("Tanggal perceraian tidak ditemukan.");
    }

    const rentangHariCerai = dapatkanRentangHari(tanggal_cerai);

    await RiwayatKeluarga.update({ 
      akhir_masuk: null 
    },{
      where: {
        perkawinan_id: perkawinan_id,
        akhir_masuk: rentangHariCerai
      },
      transaction: t
    });

    await RiwayatKeluarga.destroy({
      where: {
        perkawinan_id: perkawinan_id,
        kategori_event: "CERAI"
      },
      transaction: t
    });

    await RiwayatPeranAdat.update({ 
      selesai_tanggal: null 
    },{
      where: {
        perkawinan_id: perkawinan_id,
        selesai_tanggal: rentangHariCerai
      },
      transaction: t
    });

    await RiwayatPeranAdat.destroy({
      where: {
        perkawinan_id: perkawinan_id,
        kategori_event: "CERAI"
      },
      transaction: t
    });

    if (status_perkawinan === "Cerai Mati" && pihak_meninggal) {
      let targetKramaId = null;

      if (pihak_meninggal === "Suami") {
        targetKramaId = suami_id;
      } else if (pihak_meninggal === "Istri") {
        targetKramaId = istri_id;
      } else if (pihak_meninggal === "Purusa") {
        targetKramaId = purusaId;
      } else if (pihak_meninggal === "Predana") {
        targetKramaId = predanaId;
      }

      if (targetKramaId) {
        await KramaBali.update({ 
          status_hidup: "Hidup" 
        },{ 
          where: { id: targetKramaId }, 
          transaction: t 
        });
      }
    }

    await perkawinan.update({
      status_perkawinan: "Kawin",
      tanggal_cerai: null,
      pihak_meninggal: null,
      ketetapan_silsilah_suami: null,
      ketetapan_silsilah_istri: null
    },{ transaction: t });

    return { 
      message: "Dampak perceraian berhasil dibatalkan. Status perkawinan kembali menjadi Kawin." 
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

    await RelasiKrama.update({ 
      catatan_admin_desa: `Relasi anak diamankan sementara karena ada proses pembatalan/penghapusan data perkawinan orang tua.` 
    },{
      where: { 
        ayah_id: suami_id,
        ibu_id: istri_id
      },
      transaction: t
    });

    await RiwayatKeluarga.update({ 
      akhir_masuk: null 
    },{
      where: {
        krama_id: [suami_id, istri_id],
        akhir_masuk: rentangHariKawin
      },
      transaction: t
    });

    await RiwayatKeluarga.destroy({
      where: {
        perkawinan_id: perkawinan_id,
        awal_masuk: rentangHariKawin
      },
      transaction: t
    });

    await RiwayatPeranAdat.update({ 
      selesai_tanggal: null 
    },{
      where: {
        krama_id: [suami_id, istri_id],
        selesai_tanggal: rentangHariKawin
      },
      transaction: t
    });

    await RiwayatPeranAdat.destroy({
      where: {
        perkawinan_id: perkawinan_id,
        mulai_tanggal: rentangHariKawin,
        kategori_event: "KAWIN"
      },
      transaction: t
    });

    const keluargaTerbentuk = await Keluarga.findOne({
      where: { kepala_keluarga_id: purusaId },
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