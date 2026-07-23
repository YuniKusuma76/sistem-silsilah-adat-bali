import { Op, Sequelize } from "sequelize";
import { KramaBali } from "../models/associations.js";

export const checkDuplicateKramaBali = async (kramaData, threshold = 0.4) => {
  const { 
    id, 
    nama_lengkap, 
    jenis_kelamin, 
    desa_adat_id 
  } = kramaData;

  if (!nama_lengkap || !jenis_kelamin || !desa_adat_id) {
    return [];
  }

  const potensiDuplikat = await KramaBali.findAll({
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "desa_adat_id", "status_verifikasi",
      [
        Sequelize.fn("similarity", Sequelize.col("nama_lengkap"), nama_lengkap),
        "skor_kemiripan"
      ]
    ],
    where: {
      ...(id && { id: { [Op.ne]: id } }),
      jenis_kelamin: jenis_kelamin,
      desa_adat_id: desa_adat_id,
      status_verifikasi: "Disetujui",
      [Op.and]: Sequelize.literal(`similarity("nama_lengkap", :nama) >= ${threshold}`)
    },
    replacements: { nama: nama_lengkap },
    order: [[Sequelize.literal("skor_kemiripan"), "DESC"]]
  });

  return potensiDuplikat;
};