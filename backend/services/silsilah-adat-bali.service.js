import { Op } from "sequelize";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan,
  RiwayatPeranAdat
} from "../models/associations.js";

// Helper: Mengambil riwayat peran adat terakhir
const getLatestPeranAdat = async (krama_id) => {
  const peran = await RiwayatPeranAdat.findOne({
    where: { 
      krama_id 
    },
    order: [["mulai_tanggal", "DESC"]],
    attributes: ["status_peran_adat"] 
  });
  return peran ? peran.status_peran_adat : "Tidak Memiliki Status Peran Adat";
};

// Helper: Mengambil data pasangan
const getPasangan = async (krama_id, jenis_kelamin) => {
  const isLaki = jenis_kelamin === "Laki-laki";
  const perkawinan = await Perkawinan.findAll({
    where: {
      [isLaki ? "suami_id" : "istri_id"]: krama_id,
      status_verifikasi: "Disetujui"
    },
    include: [{
      model: KramaBali,
      as: isLaki ? "istri" : "suami",
      where: { status_verifikasi: "Disetujui" },
      attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data"]
    }],
    order: [["tanggal_perkawinan", "DESC"]],
  });

  return Promise.all(perkawinan.map(async (p) => {
    const targetPasangan = isLaki ? p.istri : p.suami;
    if (!targetPasangan) return null;
    const peranAdat = await getLatestPeranAdat(targetPasangan.id);
    return {
      ...targetPasangan.toJSON(),
      tipe_data: "Pasangan",
      status_peran_adat: peranAdat,
      status_perkawinan: p.status_perkawinan, 
      jenis_perkawinan: p.jenis_perkawinan  
    };
  })).then(results => results.filter(Boolean));
};

// Helper: Mengambil relasi anak berdasarkan ayah
const getAnakPurusa = async (ayah_id) => {
  const relasi = await RelasiKrama.findAll({
    where: { 
      ayah_id,
      status_verifikasi: "Disetujui" 
    },
    order: [["urutan_lahir", "ASC"]]
  });
  return relasi.map(r => r.anak_id);
};

// Helper: Mencari relasi krama paling tertingga pada silsilah
const findLeluhurPurusa = async (krama_id) => {
  let currentKramaId = krama_id;
  while (true) {
    const relasi = await RelasiKrama.findOne({ 
      where: { 
        anak_id: currentKramaId,
        status_verifikasi: "Disetujui" 
      } 
    });
    if (!relasi || !relasi.ayah_id) break; 
    currentKramaId = relasi.ayah_id;
  }
  return currentKramaId;
};

// Helper: Membangun pohon silsilah keluarga
const buildPohonSilsilah = async (krama_id, target_highlight_id) => {
  const krama = await KramaBali.findOne({
    where: {
      id: krama_id,
      status_verifikasi: "Disetujui"
    },
    attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data"]
  });

  if (!krama) return null;

  // Mengambil data pendukung
  const [peranAdat, infoKawin, pasangan, anakIds] = await Promise.all([
    getLatestPeranAdat(krama_id),
    Perkawinan.findOne({
      where: { 
        [Op.or]: [
          { suami_id: krama_id }, 
          { istri_id: krama_id }
        ],
        status_verifikasi: "Disetujui" 
      },
      order: [["tanggal_perkawinan", "DESC"]]
    }),
    getPasangan(krama_id, krama.jenis_kelamin),
    getAnakPurusa(krama_id)
  ]);

  const childrenNodes = await Promise.all(
    anakIds.map((id) => buildPohonSilsilah(id, target_highlight_id))
  );

  return {
    id: krama.id,
    nama_lengkap: krama.nama_lengkap,
    nama_panggilan: krama.nama_panggilan || krama.nama_lengkap.split(' ')[0], 
    jenis_kelamin: krama.jenis_kelamin,
    status_hidup: krama.status_hidup,
    tipe_data: krama.tipe_data,
    status_peran_adat: peranAdat,
    status_perkawinan: infoKawin ? infoKawin.status_perkawinan : "Belum Kawin",
    jenis_perkawinan: infoKawin ? infoKawin.jenis_perkawinan : "-",
    is_target: krama.id === parseInt(target_highlight_id),
    pasangan: pasangan, 
    children: childrenNodes.filter(Boolean),
  };
};

export const getSilsilahPurusaTree = async (krama_id) => {
  if (!krama_id) {
    throw new Error("ID Krama wajib diisi");
  }
  // Validasi ketersediaan data krama
  const targetCek = await KramaBali.findOne({
    where: { 
      id: krama_id, 
      status_verifikasi: "Disetujui" 
    }
  });
  if (!targetCek) {
    throw new Error("Data Krama tidak ditemukan.");
  }
  const rootId = await findLeluhurPurusa(krama_id);
  const silsilahTree = await buildPohonSilsilah(rootId, krama_id);
  return silsilahTree; 
};