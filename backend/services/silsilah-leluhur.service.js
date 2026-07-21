import { Op } from "sequelize";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan
} from "../models/associations.js";

const VERIFIKASI_APPROVED = { status_verifikasi: "Disetujui" };

const isPerempuanPurusa = async (krama_id) => {
  const perkawinanNyentana = await Perkawinan.findOne({
    where: {
      istri_id: krama_id,
      jenis_perkawinan: { [Op.or]: ["Nyentana", "Pade Gelahang"] },
      ...VERIFIKASI_APPROVED
    }
  });

  if (perkawinanNyentana) return true;

  const punyaAnak = await RelasiKrama.findOne({
    where: {
      ibu_id: krama_id,
      ...VERIFIKASI_APPROVED
    }
  });

  return !!punyaAnak;
};

const isPredana = async (krama_id, jenis_kelamin) => {
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";
  if (!isPerempuan) return false;

  const perkawinanBiasa = await Perkawinan.findOne({
    where: {
      istri_id: krama_id,
      jenis_perkawinan: { [Op.notIn]: ["Nyentana", "Pade Gelahang"] },
      ...VERIFIKASI_APPROVED
    }
  });

  return !!perkawinanBiasa;
};

// Helper: mengambil data pasangan beserta jenis perkawinannya
const getPasangan = async (krama_id, jenis_kelamin) => {
  const isLaki = jenis_kelamin === "Laki-laki" || jenis_kelamin === "L";
  const perkawinan = await Perkawinan.findAll({
    where: {
      [isLaki ? "suami_id" : "istri_id"]: krama_id,
      ...VERIFIKASI_APPROVED
    },
    include: [{
      model: KramaBali,
      as: isLaki ? "istri" : "suami",
      where: VERIFIKASI_APPROVED,
      attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "foto_profile", "tempat_asal_khusus", "status_verifikasi", "tipe_data", "user_id"]
    }],
    order: [["tanggal_perkawinan", "DESC"]],
  });

  return Promise.all(perkawinan.map(async (p) => {
    const targetPasangan = isLaki ? p.istri : p.suami;
    if (!targetPasangan) return null;

    const ketetapanPasangan = isLaki 
      ? p.ketetapan_silsilah_istri 
      : p.ketetapan_silsilah_suami;

    if (ketetapanPasangan === "Kembali ke Asal") {
      return null;
    }
    
    return {
      ...targetPasangan.toJSON(),
      tipe_data: "Pasangan",
      status_verifikasi: p.status_verifikasi,
      status_perkawinan: p.status_perkawinan, 
      jenis_perkawinan: p.jenis_perkawinan  
    };
  })).then(results => results.filter(Boolean));
};

// Helper: mengambil relasi anak berdasarkan garis keturunan purusa
const getAnakRelasi = async (krama_id) => {
  let listRelasi = await RelasiKrama.findAll({
    where: {
      ayah_id: krama_id,
      ...VERIFIKASI_APPROVED
    },
    attributes: ["anak_id", "status_hubungan", "status_verifikasi"], 
    order: [
      ["urutan_lahir", "ASC"],
      ["id", "ASC"]
    ]
  });

  if (listRelasi.length === 0) {
    listRelasi = await RelasiKrama.findAll({
      where: {
        ibu_id: krama_id,
        ...VERIFIKASI_APPROVED
      },
      attributes: ["anak_id", "status_hubungan", "status_verifikasi"], 
      order: [
        ["urutan_lahir", "ASC"],
        ["id", "ASC"]
      ]
    });
  }

  return listRelasi;
};

// Helper: mencari leluhur purusa tertinggi dalam silsilah
const findLeluhurPurusa = async (krama_id) => {
  let currentKramaId = krama_id;

  while (true) {
    const relasi = await RelasiKrama.findOne({ 
      where: { 
        anak_id: currentKramaId,
        ...VERIFIKASI_APPROVED
      } 
    });

    if (!relasi) break;

    if (relasi.ayah_id) {
      currentKramaId = relasi.ayah_id;
    } else if (relasi.ibu_id) {
      const isPurusa = await isPerempuanPurusa(relasi.ibu_id);
      if (isPurusa) {
        currentKramaId = relasi.ibu_id;
      } else {
        break;
      }
    } else {
      break;
    }
  }

  return currentKramaId;
};

// Helper: membangun pohon silsilah leluhur
const trehLeluhur = async (
  krama_id, 
  target_highlight_id, 
  depth = 1, 
  maxDepth = 10, 
  statusHubunganCurrent = "Anak Kandung"
) => {
  if (depth > maxDepth) return null;

  const krama = await KramaBali.findOne({
    where: {
      id: krama_id,
      tipe_data: "Leluhur",
      ...VERIFIKASI_APPROVED
    },
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "foto_profile", "status_verifikasi", "tipe_data", "user_id"]
  });

  if (!krama) return null;
  const predanaStatus = await isPredana(krama.id, krama.jenis_kelamin);
  
  const [pasangan, listRelasiAnak] = await Promise.all([
    getPasangan(krama_id, krama.jenis_kelamin),
    (depth < maxDepth && !predanaStatus) ? getAnakRelasi(krama_id) : Promise.resolve([])
  ]);

  const nodesAnak = await Promise.all(
    listRelasiAnak.map((relasi) => {
      const statusRelasiRaw = relasi.status_hubungan ? String(relasi.status_hubungan).trim() : "Anak Kandung";
      
      return trehLeluhur(
        relasi.anak_id, 
        target_highlight_id, 
        depth + 1, 
        maxDepth, 
        statusRelasiRaw
      );
    })
  );

  return {
    id: krama.id,
    nomor_pendaftaran: krama.nomor_pendaftaran,
    nama_lengkap: krama.nama_lengkap,
    nama_panggilan: krama.nama_panggilan || null, 
    jenis_kelamin: krama.jenis_kelamin,
    status_hidup: krama.status_hidup,
    tipe_data: krama.tipe_data,
    foto_profile: krama.foto_profile || null,
    status_verifikasi: krama.status_verifikasi,
    user_id: krama.user_id,
    status_hubungan: statusHubunganCurrent, 
    status_anak: statusHubunganCurrent,
    status_peran_adat: "-",
    is_target: String(krama.id) === String(target_highlight_id),
    generasi_ke: depth,
    pasangan: pasangan, 
    children: nodesAnak.filter(Boolean),
  };
};

// Helper: mencari ID leluhur paling atas
export const findAkarLeluhurId = async () => {
  const relasiAnak = await RelasiKrama.findAll({
    where: VERIFIKASI_APPROVED,
    attributes: ["anak_id"],
    raw: true
  });
  
  const listIdAnak = relasiAnak.map(r => r.anak_id);

  const akarLeluhur = await KramaBali.findOne({
    where: {
      tipe_data: "Leluhur",
      ...VERIFIKASI_APPROVED,
      ...(listIdAnak.length > 0 && {
        id: { [Op.notIn]: listIdAnak }
      })
    },
    attributes: ["id"],
    order: [["id", "ASC"]] 
  });

  if (!akarLeluhur) {
    const fallbackLeluhur = await KramaBali.findOne({
      where: { 
        tipe_data: "Leluhur",
        ...VERIFIKASI_APPROVED
      },
      attributes: ["id"],
      order: [["id", "ASC"]]
    });
    return fallbackLeluhur ? fallbackLeluhur.id : null;
  }

  return akarLeluhur.id;
};

export const getTrehLeluhur = async (root_id, maxDepth = 10) => {
  let rootId = root_id;
  let finalTargetId = root_id;

  if (!rootId || rootId === "akar") {
    rootId = await findAkarLeluhurId();
    finalTargetId = rootId;
  } else {
    rootId = await findLeluhurPurusa(finalTargetId);
  }

  if (!rootId) {
    return null;
  }
  
  return await trehLeluhur(rootId, finalTargetId, 1, maxDepth);
};