import { Op } from "sequelize";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan,
  RiwayatPeranAdat
} from "../models/associations.js";

const VERIFIKASI_APPROVED = { status_verifikasi: "Disetujui" };

export const getListLeluhurPuncak = async () => {
  const listLeluhur = await KramaBali.findAll({
    where: {
      tipe_data: "Leluhur",
      ...VERIFIKASI_APPROVED
    },
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "foto_profile", "tipe_data"],
    order: [["nama_lengkap", "ASC"]]
  });

  return listLeluhur;
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
const getPasangan = async (krama_id, jenis_kelamin) => {
  const isLaki = jenis_kelamin === "Laki-laki" || jenis_kelamin === "L";
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";

  let wherePerkawinan = { ...VERIFIKASI_APPROVED };

  if (isLaki) {
    wherePerkawinan.suami_id = krama_id;
  } else if (isPerempuan) {
    wherePerkawinan.istri_id = krama_id;
  } else {
    wherePerkawinan[Op.or] = [
      { suami_id: krama_id }, 
      { istri_id: krama_id }
    ];
  }

  const listPerkawinan = await Perkawinan.findAll({
    where: wherePerkawinan,
    include: [
      {
        model: KramaBali,
        as: "istri",
        where: VERIFIKASI_APPROVED,
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id"]
      },{
        model: KramaBali,
        as: "suami",
        where: VERIFIKASI_APPROVED,
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id"]
      }
    ],
    order: [["tanggal_perkawinan", "DESC"]],
  });

  if (!listPerkawinan || listPerkawinan.length === 0) {
    return [];
  }

  return Promise.all(listPerkawinan.map(async (p) => {
    const isSuami = String(p.suami_id) === String(krama_id);
    const targetPasangan = isSuami ? p.istri : p.suami;

    if (!targetPasangan) return null;

    const ketetapanPasangan = isSuami 
      ? p.ketetapan_silsilah_istri 
      : p.ketetapan_silsilah_suami;

    if (ketetapanPasangan === "Kembali ke Asal") return null;
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

// Helper: mengambil relasi anak berdasarkan garis keturunan purusa
const getAnakRelasi = async (krama_id, jenis_kelamin) => {
  let whereClause = { ...VERIFIKASI_APPROVED };
  const isLaki = jenis_kelamin === "Laki-laki" || jenis_kelamin === "L";
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";

  if (isLaki) {
    whereClause.ayah_id = krama_id;
  } else if (isPerempuan) {
    const isPurusa = await isPerempuanPurusa(krama_id);
    if (!isPurusa) return [];
    whereClause.ibu_id = krama_id;
  } else {
    whereClause[Op.or] = [
      { ayah_id: krama_id },
      { ibu_id: krama_id }
    ];
  }

  const perkawinanList = await Perkawinan.findAll({
    where: {
      [Op.or]: [{ suami_id: krama_id }, { istri_id: krama_id }],
      ...VERIFIKASI_APPROVED
    },
    attributes: ["suami_id", "istri_id"]
  });

  const pasanganIds = perkawinanList.map(p => 
    String(p.suami_id) === String(krama_id) ? p.istri_id : p.suami_id
  ).filter(Boolean);

  whereClause.anak_id = {
    [Op.and]: [
      { [Op.ne]: krama_id },
      ...(pasanganIds.length > 0 ? [{ [Op.notIn]: pasanganIds }] : [])
    ]
  };

  const listRelasi = await RelasiKrama.findAll({
    where: whereClause,
    attributes: ["anak_id", "status_hubungan", "status_verifikasi"], 
    order: [
      ["urutan_lahir", "ASC"],
      ["id", "ASC"]
    ]
  });

  return listRelasi;
};

// Helper: mengukur panjang silsilah di bawah target
const countMaxDownSteps = async (krama_id, jenis_kelamin, limitMax, currentDepth = 0) => {
  if (currentDepth >= limitMax) return currentDepth;

  const anakList = await getAnakRelasi(krama_id, jenis_kelamin);
  if (!anakList || anakList.length === 0) return currentDepth;

  let maxSubDepth = currentDepth;

  for (const anakRelasi of anakList) {
    const child = await KramaBali.findByPk(anakRelasi.anak_id, { 
      attributes: ["id", "jenis_kelamin"] 
    });

    if (child) {
      const predana = await isPredana(child.id, child.jenis_kelamin);
      
      if (!predana) {
        const subDepth = await countMaxDownSteps(
          child.id, 
          child.jenis_kelamin, 
          limitMax, 
          currentDepth + 1
        );

        if (subDepth > maxSubDepth) {
          maxSubDepth = subDepth;
        }
      } else {
        if (currentDepth + 1 > maxSubDepth) {
          maxSubDepth = currentDepth + 1;
        }
      }
    }
  }
  return maxSubDepth;
};

// Helper: mencari leluhur purusa tertinggi dalam silsilah
const findLeluhurPurusa = async (krama_id, maxUpSteps) => {
  let currentKramaId = krama_id;
  let steps = 0;

  while (steps < maxUpSteps) {
    const relasi = await RelasiKrama.findOne({ 
      where: { 
        anak_id: currentKramaId,
        ...VERIFIKASI_APPROVED
      } 
    });

    if (!relasi) break;
    let nextParentId = null;

    if (relasi.ayah_id) {
      nextParentId = relasi.ayah_id;
    } else if (relasi.ibu_id) {
      const isPurusa = await isPerempuanPurusa(relasi.ibu_id);
      if (isPurusa) {
        nextParentId = relasi.ibu_id;
      }
    }

    if (!nextParentId) break;
    currentKramaId = nextParentId;
    steps++;
  }

  return { 
    rootId: currentKramaId, 
    targetDepth: steps + 1 
  };
};

// Helper: membangun pohon silsilah keluarga
const buildPohonSilsilah = async (
  krama_id, 
  target_highlight_id, 
  depth = 1, 
  targetDepth = 1,
  maxDepth = 2, 
  statusHubunganCurrent = "Anak Kandung"
) => {
  const krama = await KramaBali.findOne({
    where: {
      id: krama_id,
      ...VERIFIKASI_APPROVED
    },
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id"]
  });

  if (!krama) return null;

  const predanaStatus = await isPredana(krama.id, krama.jenis_kelamin);
  const relativeDepth = depth - targetDepth;
  const maxDownSteps = maxDepth - targetDepth; 
  const canFetchChildren = relativeDepth < maxDownSteps;

  const [peranAdat, infoKawin, pasangan, relasiAnakList] = await Promise.all([
    getLatestPeranAdat(krama_id),
    Perkawinan.findOne({
      where: { 
        [Op.or]: [
          { suami_id: krama_id }, 
          { istri_id: krama_id }
        ],
        ...VERIFIKASI_APPROVED
      },
      order: [["tanggal_perkawinan", "DESC"]]
    }),
    getPasangan(krama_id, krama.jenis_kelamin),
    (canFetchChildren && !predanaStatus) ? getAnakRelasi(krama_id, krama.jenis_kelamin) : Promise.resolve([])
  ]);

  let childrenNodes = [];

  if (canFetchChildren && relasiAnakList.length > 0 && !predanaStatus) {
    childrenNodes = await Promise.all(
      relasiAnakList.map((relasi) => {
        const statusRelasiRaw = relasi.status_hubungan ? String(relasi.status_hubungan).trim() : "Anak Kandung";
        
        return buildPohonSilsilah(
          relasi.anak_id, 
          target_highlight_id, 
          depth + 1, 
          targetDepth,
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
    jenis_kelamin: krama.jenis_kelamin || "Tidak Diketahui",
    status_hidup: krama.status_hidup,
    tipe_data: krama.tipe_data,
    foto_profile: krama.foto_profile || null,
    status_verifikasi: krama.status_verifikasi,
    user_id: krama.user_id,
    status_hubungan: statusHubunganCurrent, 
    status_anak: statusHubunganCurrent,
    status_peran_adat: peranAdat,
    status_perkawinan: infoKawin ? infoKawin.status_perkawinan : "Tidak Diketahui",
    jenis_perkawinan: infoKawin ? infoKawin.jenis_perkawinan : "-",
    is_target: String(krama.id) === String(target_highlight_id),
    generasi_ke: depth,
    pasangan: pasangan || [], 
    children: childrenNodes.filter(Boolean),
  };
};

export const getPuncakSilsilahService = async (krama_id, maxDepth = 2) => {
  let rootId = krama_id;
  let finalTargetId = krama_id;

  if (!rootId || rootId === "akar") {
    const relasiAnak = await RelasiKrama.findAll({ 
      where: VERIFIKASI_APPROVED,
      attributes: ["anak_id"], 
      raw: true 
    });

    const listIdAnak = relasiAnak.map(r => r.anak_id);

    const akarGlobal = await KramaBali.findOne({
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
    
    rootId = akarGlobal ? akarGlobal.id : null;
    finalTargetId = rootId;
  }

  if (!rootId) {
    return null;
  }

  const targetCek = await KramaBali.findOne({
    where: { 
      id: finalTargetId, 
      ...VERIFIKASI_APPROVED 
    },
    attributes: ["id", "jenis_kelamin"]
  });

  if (!targetCek) {
    return null;
  }

  const isTargetPredana = await isPredana(targetCek.id, targetCek.jenis_kelamin);
  const maxDownStepsAllowed = maxDepth - 1;
  const actualDownSteps = await countMaxDownSteps(finalTargetId, targetCek.jenis_kelamin, maxDownStepsAllowed);

  let maxUpSteps = maxDownStepsAllowed - actualDownSteps;

  if (isTargetPredana && maxUpSteps < 1) {
    maxUpSteps = 1;
  }

  if (maxUpSteps < 0) maxUpSteps = 0;

  const { rootId: newRootId, targetDepth } = await findLeluhurPurusa(finalTargetId, maxUpSteps);
  const silsilahTree = await buildPohonSilsilah(newRootId, finalTargetId, 1, targetDepth, maxDepth);
  return silsilahTree; 
};