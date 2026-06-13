import { Op } from "sequelize";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan
} from "../models/associations.js";

// Halper: Mengambil pasangan leluhur
const getPasanganLeluhur = async (krama_id) => {
  const perkawinan = await Perkawinan.findAll({
    where: {
      suami_id: krama_id,
      status_verifikasi: "Disetujui"
    },
    include: [{
      model: KramaBali,
      as: "istri",
      attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "desa_adat_id", "tempat_asal_khusus", "tipe_data"]
    }]
  });

  return perkawinan.map((p) => ({
    id: p.istri.id,
    nama_lengkap: p.istri.nama_lengkap,
    jenis_kelamin: p.istri.jenis_kelamin,
    tempat_asal_khusus: p.istri.tempat_asal_khusus,
    tipe_data: p.istri.tipe_data,
  }));
};

// Halper: Mengambil anak leluhur
const getAnakLeluhurIds = async (ayah_id) => {
  const relasi = await RelasiKrama.findAll({
    where: {
      ayah_id,
      status_verifikasi: "Disetujui"
    },
    attributes: ["anak_id"],
    order: [["id", "ASC"]]
  });
  return relasi.map(r => r.anak_id);
};

// Fungsi rekursif membangun pohon treh leluhur
const trehLeluhur = async (
  krama_id, 
  targetId, 
  currentDepth = 1, 
  maxDepth = 3
) => {
  // Validasi apakah banyak leluhur sudah melebihi batas maksimum
  if (currentDepth > maxDepth) {
    return null;
  }

  const krama = await KramaBali.findOne({
    where: {
      id: krama_id,
      tipe_data: "Leluhur",
      status_verifikasi: "Disetujui"
    },
    attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "desa_adat_id", "tempat_asal_khusus", "tipe_data"]
  });

  if (!krama) {
    return null;
  }

  const pasangan = await getPasanganLeluhur(krama_id);
  const anakIds = await getAnakLeluhurIds(krama_id);

  const nodesAnak = await Promise.all(
    anakIds.map((id) => trehLeluhur(id, targetId, currentDepth + 1, maxDepth))
  );

  return {
    id: krama.id,
    nama_lengkap: krama.nama_lengkap,
    nama_panggilan: krama.nama_panggilan || "-",
    desa_adat_id: krama.desa_adat_id || "-",
    tempat_asal_khusus: krama.tempat_asal_khusus || "-",
    isTarget: krama.id.toString() === targetId.toString(),
    tipe_data: krama.tipe_data,
    attributes: {
      jenis_kelamin: krama.jenis_kelamin,
      pasangan: pasangan.map(p => p.nama_lengkap).join(", ") || "-"
    },
    children: nodesAnak.filter(node => node !== null),
  };
};

// Helper: Mencari ID Leluhur paling atas
export const findAkarLeluhurId = async () => {
  const relasiAnak = await RelasiKrama.findAll({
    where : { status_verifikasi: "Disetujui" },
    attributes: ["anak_id"],
    raw: true
  });
  
  // Mengekstrak ID anak menjadi array numerik biasa
  const listIdAnak = relasiAnak.map(r => r.anak_id);

  const akarLeluhur = await KramaBali.findOne({
    where: {
      tipe_data: "Leluhur",
      status_verifikasi: "Disetujui",
      ...(listIdAnak.length > 0 && {
        id: {
          [Op.notIn]: listIdAnak 
        }
      })
    },
    attributes: ["id"],
    order: [["id", "ASC"]] 
  });

  if (!akarLeluhur) {
    const fallbackLeluhur = await KramaBali.findOne({
      where: { 
        tipe_data: "Leluhur",
        status_verifikasi: "Disetujui"
      },
      attributes: ["id"],
      order: [["id", "ASC"]]
    });
    return fallbackLeluhur ? fallbackLeluhur.id : null;
  }

  return akarLeluhur.id;
};

export const getTrehLeluhur = async (root_id, maxDepth = 3) => {
  let targetId = root_id;

  if (root_id === "akar") {
    targetId = await findAkarLeluhurId();
  }
  if (!targetId) {
    return null;
  }
  
  return await trehLeluhur(targetId, targetId, 1, maxDepth);
};