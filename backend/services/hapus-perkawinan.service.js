import db from "../config/db.config.js";
import { Perkawinan } from "../models/associations.js";

export const menghapusPerkawinanDraft = async (perkawinan_id) => {
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

    const ALLOWED_STATUS_DELETE = ["Draft", "Ditolak"];
    if (!ALLOWED_STATUS_DELETE.includes(perkawinan.status_verifikasi)) {
      throw new Error("Proses menghapus dihentikan! Data perkawinan ini telah diverifikasi dan disetujui.");
    }

    await perkawinan.destroy({ transaction: t });

    await t.commit();
    return { status_terakhir: perkawinan.status_verifikasi };
  } catch (error) {
    await t.rollback();
    throw error;
  }
}