import { Op } from "sequelize";
import RelasiKrama from "../models/relasi.model.js";
import KramaBali from "../models/krama.model.js";

// HELPER: Mengambil relasi anak dengan orang tua yang sama
export const ambilRelasiAnak = async ({
  mode,
  ayah_id = null,
  ibu_id = null,
  kepala_keluarga_id = null
}, t = null) => {
  // Menentukan opsi dasar query
  const queryOptions = {
    include: {
      model: KramaBali,
      as: "anak",
      attributes: ["id", "tanggal_lahir"]
    },
    order: [
      [{
        model: KramaBali,
        as: "anak"
      }, "tanggal_lahir", "ASC"]
    ],
    transaction: t
  };

  // Mengambil relasi anak angkat ketika orang tua belum kawin
  if (mode === "ANGKAT") {
    return RelasiKrama.findAll({
      ...queryOptions,
      where: {
        status_hubungan: "Anak Angkat",
        [Op.or]: [
          { ayah_id: kepala_keluarga_id },
          { ibu_id: kepala_keluarga_id }
        ]
      }
    });
  }

  // Mengambil relasi anak angkat atau anak kandung ketika orang tua telah kawin
  if (mode === "CAMPUR") {
    return RelasiKrama.findAll({
      ...queryOptions,
      where: {
        ayah_id,
        ibu_id,
        status_hubungan: {
          [Op.in]: ["Anak Kandung", "Anak Angkat"]
        }
      }
    });
  }
  return [];
};