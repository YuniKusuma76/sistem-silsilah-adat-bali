import { Op, Sequelize } from "sequelize";
import RelasiKrama from "../models/relasi.model.js";
import KramaBali from "../models/krama.model.js";

// HELPER: Mengambil relasi anak dengan orang tua yang sama
export const ambilRelasiAnak = async ({
  mode,
  ayah_id = null,
  ibu_id = null,
  kepala_keluarga_id = null,
  sertakanDraft = false
}, t = null) => {
  const queryOptions = {
    include: {
      model: KramaBali,
      as: "anak",
      attributes: ["id", "nama_lengkap", "tanggal_lahir"]
    },
    order: [
      [Sequelize.literal('CASE WHEN "urutan_lahir" IS NOT NULL THEN 0 ELSE 1 END'), "ASC"],
      ["urutan_lahir", "ASC"],
      [Sequelize.literal('CASE WHEN "anak"."tanggal_lahir" IS NOT NULL THEN 0 ELSE 1 END'), "ASC"],
      [{ model: KramaBali, as: "anak" }, "tanggal_lahir", "ASC"],
      ["id", "ASC"]
    ],
    transaction: t
  };

  const filterVerifikasi = sertakanDraft 
    ? { status_verifikasi: { [Op.in]: ["Disetujui", "Draft"] } }
    : { status_verifikasi: "Disetujui" };

  if (mode === "ANGKAT") {
    if (!kepala_keluarga_id) return [];

    return RelasiKrama.findAll({
      ...queryOptions,
      where: {
        status_hubungan: "Anak Angkat",
        ...filterVerifikasi,
        [Op.or]: [
          { ayah_id: kepala_keluarga_id },
          { ibu_id: kepala_keluarga_id }
        ]
      }
    });
  }

  if (mode === "CAMPUR") {
    const kondisiOr = [];

    if (ayah_id && ibu_id) {
      kondisiOr.push(
        { ayah_id, ibu_id },
        { ayah_id, ibu_id: null },
        { ayah_id: null, ibu_id }
      );
    } else {
      if (ayah_id) kondisiOr.push({ ayah_id });
      if (ibu_id) kondisiOr.push({ ibu_id });
    }

    if (kondisiOr.length === 0) return [];

    return RelasiKrama.findAll({
      ...queryOptions,
      where: {
        ...filterVerifikasi,
        status_hubungan: {
          [Op.in]: ["Anak Kandung", "Anak Angkat"]
        },
        [Op.or]: kondisiOr
      }
    });
  }

  return [];
};