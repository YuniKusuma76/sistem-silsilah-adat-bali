import { Op } from "sequelize";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan,
  RiwayatPeranAdat
} from "../models/associations.js";

const getVerifikasiFilter = (user) => {
  if (!user || !user.role) {
    return { status_verifikasi: "Disetujui" };
  }

  const allowedRoles = ["Super Admin", "Admin Desa", "Krama"];

  if (allowedRoles.includes(user.role)) {
    return {};
  }

  return { status_verifikasi: "Disetujui" };
};

// Helper: mengambil riwayat peran adat terakhir
const getLatestPeranAdat = async (krama_id) => {
  const peran = await RiwayatPeranAdat.findOne({
    where: { krama_id },
    order: [["mulai_tanggal", "DESC"]],
    attributes: ["status_peran_adat"] 
  });
  return peran ? peran.status_peran_adat : "Tidak Memiliki Status Peran Adat";
};

// Helper: mengambil data pasangan beserta jenis perkawinannya
const getPasangan = async (krama_id, jenis_kelamin, verifikasiFilter) => {
  const isLaki = jenis_kelamin === "Laki-laki" || jenis_kelamin === "L";
  const perkawinan = await Perkawinan.findAll({
    where: {
      [isLaki ? "suami_id" : "istri_id"]: krama_id,
      ...verifikasiFilter
    },
    include: [{
      model: KramaBali,
      as: isLaki ? "istri" : "suami",
      where: verifikasiFilter,
      attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id"]
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

    const peranAdat = await getLatestPeranAdat(targetPasangan.id);
    
    return {
      ...targetPasangan.toJSON(),
      tipe_data: "Pasangan",
      status_peran_adat: peranAdat,
      status_verifikasi: p.status_verifikasi,
      status_perkawinan: p.status_perkawinan, 
      jenis_perkawinan: p.jenis_perkawinan  
    };
  })).then(results => results.filter(Boolean));
};

const isPerempuanPurusa = async (krama_id, verifikasiFilter) => {
  const perkawinanNyentana = await Perkawinan.findOne({
    where: {
      istri_id: krama_id,
      jenis_perkawinan: { [Op.or]: ["Nyentana", "Pade Gelahang"] },
      ...verifikasiFilter
    }
  });

  if (perkawinanNyentana) return true;

  const punyaAnak = await RelasiKrama.findOne({
    where: {
      ibu_id: krama_id,
      ...verifikasiFilter
    }
  });

  return !!punyaAnak;
};

const isPredana = async (krama_id, jenis_kelamin, verifikasiFilter) => {
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";
  if (!isPerempuan) return false;

  const perkawinanBiasa = await Perkawinan.findOne({
    where: {
      istri_id: krama_id,
      jenis_perkawinan: { [Op.notIn]: ["Nyentana", "Pade Gelahang"] },
      ...verifikasiFilter
    }
  });

  return !!perkawinanBiasa;
};

// Helper: mengambil relasi anak berdasarkan garis keturunan purusa
const getAnakPurusaRelasi = async (krama_id, jenis_kelamin, verifikasiFilter) => {
  let whereClause = { ...verifikasiFilter };

  if (jenis_kelamin === "Laki-laki" || jenis_kelamin === "L") {
    whereClause.ayah_id = krama_id;
  } else {
    const isPurusa = await isPerempuanPurusa(krama_id, verifikasiFilter);
    if (!isPurusa) return [];
    whereClause.ibu_id = krama_id;
  }

  const listRelasi = await RelasiKrama.findAll({
    where: whereClause,
    attributes: ["anak_id", "status_hubungan", "status_verifikasi"], 
    order: [["urutan_lahir", "ASC"]]
  });

  return listRelasi;
};

// Helper: mencari leluhur purusa tertinggi dalam silsilah
const findLeluhurPurusa = async (krama_id, verifikasiFilter) => {
  let currentKramaId = krama_id;

  while (true) {
    const relasi = await RelasiKrama.findOne({ 
      where: { 
        anak_id: currentKramaId,
        ...verifikasiFilter
      } 
    });

    if (!relasi) break;

    if (relasi.ayah_id) {
      currentKramaId = relasi.ayah_id;
    } else if (relasi.ibu_id) {
      const isPurusa = await isPerempuanPurusa(relasi.ibu_id, verifikasiFilter);
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

// Helper: membangun pohon silsilah keluarga
const buildPohonSilsilah = async (krama_id, target_highlight_id, verifikasiFilter, depth = 1, maxDepth = 4, statusHubunganCurrent = "Anak Kandung") => {
  const krama = await KramaBali.findOne({
    where: {
      id: krama_id,
      ...verifikasiFilter
    },
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id"]
  });

  if (!krama) return null;
  const predanaStatus = await isPredana(krama.id, krama.jenis_kelamin, verifikasiFilter);

  const [peranAdat, infoKawin, pasangan, relasiAnakList] = await Promise.all([
    getLatestPeranAdat(krama_id),
    Perkawinan.findOne({
      where: { 
        [Op.or]: [
          { suami_id: krama_id }, 
          { istri_id: krama_id }
        ],
        ...verifikasiFilter
      },
      order: [["tanggal_perkawinan", "DESC"]]
    }),
    getPasangan(krama_id, krama.jenis_kelamin, verifikasiFilter),
    (depth < maxDepth && !predanaStatus) 
      ? getAnakPurusaRelasi(krama_id, krama.jenis_kelamin, verifikasiFilter) 
      : Promise.resolve([])
  ]);

  let childrenNodes = [];

  if (depth < maxDepth && relasiAnakList.length > 0 && !predanaStatus) {
    childrenNodes = await Promise.all(
      relasiAnakList.map((relasi) => {
        const statusRelasiRaw = relasi.status_hubungan ? String(relasi.status_hubungan).trim() : "Anak Kandung";
        
        return buildPohonSilsilah(
          relasi.anak_id, 
          target_highlight_id, 
          verifikasiFilter, 
          depth + 1, 
          maxDepth, 
          statusRelasiRaw
        );
      })
    );
  }

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
    status_peran_adat: peranAdat,
    status_perkawinan: infoKawin ? infoKawin.status_perkawinan : "Belum Kawin",
    jenis_perkawinan: infoKawin ? infoKawin.jenis_perkawinan : "-",
    is_target: String(krama.id) === String(target_highlight_id),
    generasi_ke: depth,
    pasangan: pasangan, 
    children: childrenNodes.filter(Boolean),
  };
};

export const getSilsilahPurusaTree = async (krama_id, user = null, maxDepth = 4) => {
  if (!krama_id) {
    throw new Error("ID Krama wajib diisi");
  }

  const verifikasiFilter = getVerifikasiFilter(user);

  const targetCek = await KramaBali.findOne({
    where: { 
      id: krama_id, 
      ...verifikasiFilter
    }
  });

  if (!targetCek) {
    throw new Error("Data Krama tidak ditemukan.");
  }

  const rootId = await findLeluhurPurusa(krama_id, verifikasiFilter);
  const silsilahTree = await buildPohonSilsilah(rootId, krama_id, verifikasiFilter, 1, maxDepth);
  return silsilahTree; 
};