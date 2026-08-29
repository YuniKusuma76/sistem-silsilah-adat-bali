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

// Helper: menggabungkan draft data utama dengan draft perubahan data
const applyDataPerubahan = (entity) => {
  if (!entity) return null;
  const rawData = typeof entity.toJSON === "function" ? entity.toJSON() : { ...entity };

  if (rawData.data_perubahan) {
    let parsed = rawData.data_perubahan;
    if (typeof parsed === "string") {
      try {
        parsed = JSON.parse(parsed);
      } catch (e) {
        parsed = {};
      }
    }

    const draftPerceraian = parsed.PERCERAIAN;
    const draftUpdateKawin = parsed.UPDATE_PERKAWINAN;
    const draftUpdateCerai = parsed.UPDATE_PERCERAIAN;

    const activeDraft = draftPerceraian || draftUpdateKawin || draftUpdateCerai || parsed.payload || parsed;
    const tipePerubahan = draftPerceraian 
      ? "PERCERAIAN" 
      : (draftUpdateKawin ? "UPDATE_PERKAWINAN" : (draftUpdateCerai ? "UPDATE_PERCERAIAN" : null));
    
    if (activeDraft && typeof activeDraft === 'object') {
      let ketetapanSuami = rawData.ketetapan_silsilah_suami;
      let ketetapanIstri = rawData.ketetapan_silsilah_istri;

      if (tipePerubahan === "PERCERAIAN" || tipePerubahan === "UPDATE_PERCERAIAN") {
        const pilihanPredana = activeDraft.pilihan_predana;
        const jenisKawin = activeDraft.jenis_perkawinan || rawData.jenis_perkawinan;

        if (pilihanPredana === "Kembali ke Asal") {
          if (jenisKawin === "Nyentana") {
            ketetapanSuami = "Kembali ke Asal";
          } else {
            ketetapanIstri = "Kembali ke Asal";
          }
        }
      }
      const overrideData = {
        ...activeDraft,
        suami_id: activeDraft.suami_id ? Number(activeDraft.suami_id) : rawData.suami_id,
        istri_id: activeDraft.istri_id ? Number(activeDraft.istri_id) : rawData.istri_id,
        status_perkawinan: activeDraft.status_perkawinan || rawData.status_perkawinan,
        jenis_perkawinan: activeDraft.jenis_perkawinan || rawData.jenis_perkawinan,
        tanggal_perkawinan: activeDraft.tanggal_perkawinan || rawData.tanggal_perkawinan,
        tanggal_cerai: activeDraft.tanggal_cerai || rawData.tanggal_cerai,
        pihak_meninggal: activeDraft.pihak_meninggal || rawData.pihak_meninggal,
        ketetapan_silsilah_suami: ketetapanSuami,
        ketetapan_silsilah_istri: ketetapanIstri,
        ayah_id: activeDraft.ayah_id !== undefined ? (activeDraft.ayah_id ? Number(activeDraft.ayah_id) : null) : rawData.ayah_id,
        ibu_id: activeDraft.ibu_id !== undefined ? (activeDraft.ibu_id ? Number(activeDraft.ibu_id) : null) : rawData.ibu_id,
        anak_id: activeDraft.anak_id !== undefined ? (activeDraft.anak_id ? Number(activeDraft.anak_id) : null) : rawData.anak_id,
        status_hubungan: activeDraft.status_hubungan || rawData.status_hubungan,
      };

      return {
        ...rawData,
        ...overrideData,
        tipe_perubahan: tipePerubahan,
        is_draft: true
      };
    }
  }

  return {
    ...rawData,
    is_draft: false
  };
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
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";

  let wherePerkawinan = {};

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

  const listPerkawinanRaw = await Perkawinan.findAll({
    where: wherePerkawinan,
    include: [
      {
        model: KramaBali,
        as: "istri",
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id", "data_perubahan"]
      },
      {
        model: KramaBali,
        as: "suami",
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id", "data_perubahan"]
      }
    ],
    order: [["tanggal_perkawinan", "DESC"]],
  });

  if (!listPerkawinanRaw || listPerkawinanRaw.length === 0) {
    return [];
  }

  const results = await Promise.all(listPerkawinanRaw.map(async (rawP) => {
    const p = applyDataPerubahan(rawP);
    const isSuami = String(p.suami_id) === String(krama_id);
    const targetPasanganId = isSuami ? p.istri_id : p.suami_id;

    if (!targetPasanganId) return null;
    let targetPasanganRaw = null;

    if (isSuami && rawP.istri && String(rawP.istri.id) === String(targetPasanganId)) {
      targetPasanganRaw = rawP.istri;
    } else if (!isSuami && rawP.suami && String(rawP.suami.id) === String(targetPasanganId)) {
      targetPasanganRaw = rawP.suami;
    }

    if (!targetPasanganRaw) {
      targetPasanganRaw = await KramaBali.findByPk(targetPasanganId, {
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id", "data_perubahan"]
      });
    }

    if (!targetPasanganRaw) return null;
    const targetPasangan = applyDataPerubahan(targetPasanganRaw);

    const ketetapanPasangan = isSuami 
      ? p.ketetapan_silsilah_istri 
      : p.ketetapan_silsilah_suami;

    if (ketetapanPasangan === "Kembali ke Asal") return null;
    const peranAdat = await getLatestPeranAdat(targetPasangan.id);

    return {
      ...targetPasangan,
      tipe_data: "Pasangan",
      status_peran_adat: peranAdat,
      status_verifikasi: p.status_verifikasi,
      status_perkawinan: p.status_perkawinan, 
      jenis_perkawinan: p.jenis_perkawinan,
      tanggal_perkawinan: p.tanggal_perkawinan,
      tanggal_cerai: p.tanggal_cerai || null,
      tipe_perubahan: p.tipe_perubahan || targetPasangan.tipe_perubahan || null,
      is_draft: true
    };
  }));

  return results.filter(Boolean);
};

const isPerempuanPurusa = async (krama_id, verifikasiFilter) => {
  const listPerkawinanRaw = await Perkawinan.findAll({
    where: {
      istri_id: krama_id,
      ...verifikasiFilter
    }
  });

  const processedPerkawinan = listPerkawinanRaw.map(p => applyDataPerubahan(p));
  const perkawinanNyentana = processedPerkawinan.find(p => ["Nyentana", "Pade Gelahang"].includes(p.jenis_perkawinan));
  if (perkawinanNyentana) return true;

  const listRelasiRaw = await RelasiKrama.findAll({
    where: {
      ibu_id: krama_id,
      ...verifikasiFilter
    }
  });

  const processedRelasi = listRelasiRaw.map(r => applyDataPerubahan(r));
  return processedRelasi.length > 0;
};

const isPredana = async (krama_id, jenis_kelamin, verifikasiFilter) => {
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";
  if (!isPerempuan) return false;

  const listPerkawinanRaw = await Perkawinan.findAll({
    where: {
      istri_id: krama_id,
      ...verifikasiFilter
    }
  });

  const processedPerkawinan = listPerkawinanRaw.map(p => applyDataPerubahan(p));
  const perkawinanBiasa = processedPerkawinan.find(p => !["Nyentana", "Pade Gelahang"].includes(p.jenis_perkawinan));
  return !!perkawinanBiasa;
};

// Helper: mengambil relasi anak berdasarkan garis keturunan purusa
const getAnakPurusaRelasi = async (krama_id, jenis_kelamin, verifikasiFilter) => {
  const isLaki = jenis_kelamin === "Laki-laki" || jenis_kelamin === "L";
  const isPerempuan = jenis_kelamin === "Perempuan" || jenis_kelamin === "P";

  const allRelasiRaw = await RelasiKrama.findAll({
    where: verifikasiFilter,
    attributes: ["id", "anak_id", "ayah_id", "ibu_id", "status_hubungan", "status_verifikasi", "urutan_lahir", "data_perubahan"], 
    order: [["urutan_lahir", "ASC"]]
  });

  const processedRelasiList = allRelasiRaw.map(r => applyDataPerubahan(r));
  let filteredRelasi = processedRelasiList.filter(relasi => {
    if (isLaki) {
      return String(relasi.ayah_id) === String(krama_id);
    } else if (isPerempuan) {
      return String(relasi.ibu_id) === String(krama_id);
    } else {
      return String(relasi.ayah_id) === String(krama_id) || String(relasi.ibu_id) === String(krama_id);
    }
  });

  if (isPerempuan) {
    const isPurusa = await isPerempuanPurusa(krama_id, verifikasiFilter);
    if (!isPurusa) return [];
  }

  const perkawinanListRaw = await Perkawinan.findAll({
    where: {
      [Op.or]: [{ suami_id: krama_id }, { istri_id: krama_id }],
      ...verifikasiFilter
    },
    attributes: ["suami_id", "istri_id", "status_verifikasi", "data_perubahan"]
  });

  const perkawinanList = perkawinanListRaw.map(p => applyDataPerubahan(p));
  const pasanganIds = perkawinanList.map(p => String(p.suami_id) === String(krama_id) ? String(p.istri_id) : String(p.suami_id)).filter(Boolean);
  filteredRelasi = filteredRelasi.filter(r => String(r.anak_id) !== String(krama_id) && !pasanganIds.includes(String(r.anak_id)));
  return filteredRelasi;
};

// Helper: menghitung panjang silsilah dibawah target
const countMaxDownSteps = async (krama_id, jenis_kelamin, verifikasiFilter, limitMax, currentDepth = 0) => {
  if (currentDepth >= limitMax) return currentDepth;

  const anakList = await getAnakPurusaRelasi(krama_id, jenis_kelamin, verifikasiFilter);
  if (!anakList || anakList.length === 0) return currentDepth;

  let maxSubDepth = currentDepth;

  for (const anakRelasi of anakList) {
    const rawChild = await KramaBali.findByPk(anakRelasi.anak_id, { 
      attributes: ["id", "jenis_kelamin", "status_verifikasi", "data_perubahan"] 
    });

    const child = applyDataPerubahan(rawChild);

    if (child) {
      const predana = await isPredana(child.id, child.jenis_kelamin, verifikasiFilter);
      
      if (!predana) {
        const subDepth = await countMaxDownSteps(
          child.id, 
          child.jenis_kelamin, 
          verifikasiFilter, 
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
const findLeluhurPurusa = async (krama_id, verifikasiFilter, maxUpSteps) => {
  let currentKramaId = krama_id;
  let steps = 0;

  while (steps < maxUpSteps) {
    const allRelasiRaw = await RelasiKrama.findAll({ 
      where: verifikasiFilter,
      attributes: ["id", "anak_id", "ayah_id", "ibu_id", "status_verifikasi", "data_perubahan"]
    });

    const processedRelasi = allRelasiRaw.map(r => applyDataPerubahan(r)).find(r => String(r.anak_id) === String(currentKramaId));
    if (!processedRelasi) break;
    let nextParentId = null;

    if (processedRelasi.ayah_id) {
      nextParentId = processedRelasi.ayah_id;
    } else if (processedRelasi.ibu_id) {
      const isPurusa = await isPerempuanPurusa(processedRelasi.ibu_id, verifikasiFilter);
      if (isPurusa) {
        nextParentId = processedRelasi.ibu_id;
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
  verifikasiFilter, 
  depth = 1, 
  targetDepth = 1, 
  maxDepth = 2, 
  statusHubunganCurrent = "Anak Kandung",
  isRelasiDraft = false
) => {
  const rawKrama = await KramaBali.findOne({
    where: {
      id: krama_id,
      ...verifikasiFilter
    },
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "nama_panggilan", "jenis_kelamin", "status_hidup", "tipe_data", "foto_profile", "status_verifikasi", "user_id", "data_perubahan"]
  });

  if (!rawKrama) return null;
  const krama = applyDataPerubahan(rawKrama);

  const predanaStatus = await isPredana(krama.id, krama.jenis_kelamin, verifikasiFilter);
  const relativeDepth = depth - targetDepth;
  const maxDownSteps = maxDepth - targetDepth; 
  const canFetchChildren = relativeDepth < maxDownSteps;

  const [peranAdat, rawInfoKawin, pasangan, relasiAnakList] = await Promise.all([
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
    (canFetchChildren && !predanaStatus) ? getAnakPurusaRelasi(krama_id, krama.jenis_kelamin, verifikasiFilter) : Promise.resolve([])
  ]);

  const infoKawin = applyDataPerubahan(rawInfoKawin);
  let childrenNodes = [];

  if (canFetchChildren && relasiAnakList.length > 0 && !predanaStatus) {
    childrenNodes = await Promise.all(
      relasiAnakList.map((relasi) => {
        const statusRelasiRaw = relasi.status_hubungan ? String(relasi.status_hubungan).trim() : "Anak Kandung";
        
        return buildPohonSilsilah(
          relasi.anak_id, 
          target_highlight_id, 
          verifikasiFilter, 
          depth + 1, 
          targetDepth,
          maxDepth, 
          statusRelasiRaw,
          relasi.is_draft
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
    status_peran_adat: peranAdat,
    status_perkawinan: infoKawin ? infoKawin.status_perkawinan : "Belum Kawin",
    jenis_perkawinan: infoKawin ? infoKawin.jenis_perkawinan : "-",
    tipe_perubahan: krama.tipe_perubahan || (infoKawin ? infoKawin.tipe_perubahan : null),
    is_target: String(krama.id) === String(target_highlight_id),
    is_draft: krama.is_draft || isRelasiDraft || (infoKawin ? infoKawin.is_draft : false),
    generasi_ke: depth,
    pasangan: pasangan || [], 
    children: childrenNodes.filter(Boolean),
  };
};

export const getSilsilahPurusaTree = async (krama_id, user = null, maxDepth = 2) => {
  if (!krama_id) {
    throw new Error("ID Krama wajib diisi");
  }

  const verifikasiFilter = getVerifikasiFilter(user);

  const rawTargetCek = await KramaBali.findOne({
    where: { 
      id: krama_id, 
      ...verifikasiFilter
    },
    attributes: ["id", "jenis_kelamin", "status_verifikasi", "data_perubahan"]
  });

  if (!rawTargetCek) {
    throw new Error("Data Krama tidak ditemukan.");
  }

  const targetCek = applyDataPerubahan(rawTargetCek);
  const isTargetPredana = await isPredana(targetCek.id, targetCek.jenis_kelamin, verifikasiFilter);
  const maxDownStepsAllowed = maxDepth - 1;
  const actualDownSteps = await countMaxDownSteps(krama_id, targetCek.jenis_kelamin, verifikasiFilter, maxDownStepsAllowed);

  let maxUpSteps = maxDownStepsAllowed - actualDownSteps;

  if (isTargetPredana && maxUpSteps < 1) {
    maxUpSteps = 1;
  }

  if (maxUpSteps < 0) maxUpSteps = 0;

  const { rootId, targetDepth } = await findLeluhurPurusa(krama_id, verifikasiFilter, maxUpSteps);
  const silsilahTree = await buildPohonSilsilah(rootId, krama_id, verifikasiFilter, 1, targetDepth, maxDepth);
  return silsilahTree;
};