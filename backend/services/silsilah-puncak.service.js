import { Op } from "sequelize";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan,
  RiwayatPeranAdat,
  DesaAdat
} from "../models/associations.js";

// Halper: Mengambil status peran adat terakhir
const getLatestPeranAdat = async (krama_id) => {
  const peran = await RiwayatPeranAdat.findOne({
    where: { krama_id },
    order: [["mulai_tanggal", "DESC"]],
    attributes: ["status_peran_adat"] 
  });
  return peran 
    ? peran.status_peran_adat 
    : "Tidak Memiliki Status Peran Adat";
};

// Helper: Mengambil detail pasangan (Istri/Suami)
const getPasanganDetail = async (krama_id, target_id) => {
  const perkawinan = await Perkawinan.findAll({
    where: {
      [Op.or]: [
        { suami_id: krama_id }, 
        { istri_id: krama_id }
      ],
      status_verifikasi: "Disetujui"
    },
    include: [
      {
        model: KramaBali,
        as: "suami",
        where: { status_verifikasi: "Disetujui" },
        attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id", "tempat_asal_khusus", "alamat_luar"]
      },
      {
        model: KramaBali,
        as: "istri",
        where: { status_verifikasi: "Disetujui" },
        attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id", "tempat_asal_khusus", "alamat_luar"]
      }
    ],
    order: [["tanggal_perkawinan", "ASC"]]
  });

  return Promise.all(perkawinan.map(async (p) => {
    const pasanganObj = p.suami_id.toString() === krama_id.toString() 
    ? p.istri 
    : p.suami;

    if (!pasanganObj) {
      return null;
    }

    const peranAdat = await getLatestPeranAdat(pasanganObj.id);
    
    return {
      id: pasanganObj.id,
      nama_lengkap: pasanganObj.nama_lengkap,
      nama_panggilan: pasanganObj.nama_panggilan || "-",
      tipe_data: "Pasangan",
      isTarget: target_id ? pasanganObj.id.toString() === target_id.toString() : false,
      attributes: {
        jenis_kelamin: pasanganObj.jenis_kelamin,
        status_peran_adat: peranAdat,
        status_perkawinan: p.status_perkawinan,
        jenis_perkawinan: p.jenis_perkawinan
      }
    };
  }));
};

// Helper: Mencari daftar anak (Logika Purusha/Patrilineal)
const getAnakIds = async (krama_id, jenis_kelamin) => {
  if (jenis_kelamin !== 'Laki-laki' && jenis_kelamin !== 'l') {
    return [];
  }
  const relasi = await RelasiKrama.findAll({
    where: { 
      ayah_id: krama_id, 
      status_verifikasi: "Disetujui" 
    },
    attributes: ["anak_id"],
    order: [
      ["urutan_lahir", "ASC"], 
      ["id", "ASC"]
    ]
  });
  return relasi.map(r => r.anak_id);
};

// Rekursi: Membangun struktur pohon ke bawah (Downstream)
const buildPohonRekursif = async (krama_id, target_id, currentDepth = 1, maxDepth = 10) => {
  if (currentDepth > maxDepth) {
    return null;
  }
  const krama = await KramaBali.findOne({
    where: { 
      id: krama_id, 
      status_verifikasi: "Disetujui" 
    },
    attributes: ["id", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id", "tempat_asal_khusus", "alamat_luar"],
    include: [{ 
      model: DesaAdat, 
      as: "wilayah_adat", 
      attributes: ["nama_desa_adat"] 
    }]
  });

  if (!krama) {
    return null;
  }

  const [peranAdat, pasanganRaw, anakIds] = await Promise.all([
    getLatestPeranAdat(krama_id),
    getPasanganDetail(krama_id, target_id),
    getAnakIds(krama_id, krama.jenis_kelamin)
  ]);

  const pasangan = pasanganRaw.filter(p => p !== null);
  const children = await Promise.all(
    anakIds.map(id => buildPohonRekursif(id, target_id, currentDepth + 1, maxDepth))
  );

  return {
    id: krama.id,
    nama_lengkap: krama.nama_lengkap,
    nama_panggilan: krama.nama_panggilan || "-",
    tipe_data: krama.tipe_data,
    isTarget: target_id ? krama.id.toString() === target_id.toString() : false,
    desa_adat_id: krama.wilayah_adat?.nama_desa_adat || "-",
    attributes: {
      jenis_kelamin: krama.jenis_kelamin,
      status_peran_adat: peranAdat,
      status_hidup: krama.status_hidup,
      pasangan: pasangan.length > 0 ? pasangan.map(p => p.nama_lengkap).join(", ") : "-"
    },
    pasangan: pasangan,
    children: children.filter(Boolean)
  };
};

// Service Utama
export const getPuncakSilsilahService = async (krama_id, maxDepth = 10) => {
  let rootId = krama_id;
  let finalTargetId = krama_id;

  if (!rootId || rootId === "akar") {
    const relasiAnak = await RelasiKrama.findAll({ 
      attributes: ["anak_id"], 
      raw: true 
    });

    const listIdAnak = relasiAnak.map(r => r.anak_id);

    const akarGlobal = await KramaBali.findOne({
      where: {
        tipe_data: "Leluhur",
        status_verifikasi: "Disetujui",
        ...(listIdAnak.length > 0 && { 
          id: { [Op.notIn]: listIdAnak } 
        })
      },
      attributes: ["id"],
      order: [["id", "ASC"]]
    });
    rootId = akarGlobal ? akarGlobal.id : null;
    finalTargetId = rootId;
  }
  if (!rootId) {
    return null;
  }
  return await buildPohonRekursif(rootId, finalTargetId, 1, maxDepth);
};