import { Keluarga } from "../models/associations.js";

// Mencari keluarga aktif berdasarkan id kepala keluarga yang sama
export const cariKeluargaAktif = async ({ kepala_keluarga_id, t = null }) => {
  return Keluarga.findOne({
    where: {
      kepala_keluarga_id: parseInt(kepala_keluarga_id),
      status_keluarga: "Aktif"
    },
    transaction: t
  });
};

// Menutup keluarga aktif sebelumnya
export const tutupKeluargaAktif = async ({ kepala_keluarga_id, event_date = null, t = null }) => {
  return Keluarga.update(
    { status_keluarga: "Non-Aktif" },
    {
      where: {
        kepala_keluarga_id: parseInt(kepala_keluarga_id),
        status_keluarga: "Aktif"
      },
      transaction: t
    }
  );
};

// Membuat keluarga baru ketika kawin
export const buatKeluargaBali = async ({ kepala_keluarga_id, jenis_keluarga }, t = null) => {
  return Keluarga.create({
    kepala_keluarga_id: parseInt(kepala_keluarga_id),
    jenis_keluarga,
    status_keluarga: "Aktif"
  }, { transaction: t });
};

// Membuat keluarga leluhur
export const buatKeluargaLeluhur = async ({ kepala_keluarga_id }, t = null) => {
  return Keluarga.create({
    kepala_keluarga_id: parseInt(kepala_keluarga_id),
    jenis_keluarga: "Leluhur",
    status_keluarga: "History"
  }, { transaction: t });
};