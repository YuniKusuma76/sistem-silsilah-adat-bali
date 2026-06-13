// relasi-bersih.helper.js
import { Op } from "sequelize";
import {
  RiwayatKeluarga,
  RiwayatPeranAdat
} from "../models/associations.js";

export const bersihkanDampakRelasi = async (relasi, t) => {
  const { 
    anak_id, 
    ayah_id, 
    ibu_id, 
    tanggal_pengangkatan, 
    status_hubungan, 
    anak
  } = relasi;

  // Lewati pembersihan jika tipe data leluhur
  if (anak?.tipe_data === "Leluhur") {
    return;
  }

  // ====================================================================
  // A. PEMBERSIHAN RIWAYAT KELUARGA (UNTUK ANAK LAMA)
  // ====================================================================
  const tanggalAwalLama = status_hubungan === "Anak Angkat" 
    ? tanggal_pengangkatan 
    : anak?.tanggal_lahir;

  if (tanggalAwalLama) {
    await RiwayatKeluarga.destroy({
      where: {
        krama_id: anak_id,
        awal_masuk: tanggalAwalLama
      },
      transaction: t
    });

    if (status_hubungan === "Anak Angkat") {
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
    }
  }

  // ====================================================================
  // B. PEMBERSIHAN RIWAYAT PERAN ADAT (UNTUK ORANG TUA LAMA)
  // ====================================================================
  // PERBAIKAN: Menggabungkan ID Ayah dan Ibu lama ke dalam array secara bersih
  const listOrangTuaLamaId = [ayah_id, ibu_id].filter(Boolean);

  if (listOrangTuaLamaId.length > 0) {
    if (status_hubungan === "Anak Angkat" && tanggal_pengangkatan) {
      await RiwayatPeranAdat.destroy({
        where: {
          krama_id: { [Op.in]: listOrangTuaLamaId },
          mulai_tanggal: tanggal_pengangkatan
        },
        transaction: t
      });
    } else if (status_hubungan === "Anak Kandung" && anak?.tanggal_lahir) {
      await RiwayatPeranAdat.destroy({
        where: {
          krama_id: { [Op.in]: listOrangTuaLamaId },
          mulai_tanggal: anak.tanggal_lahir
        },
        transaction: t
      });
    }
  }
};