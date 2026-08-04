import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  KramaBali,
  RelasiKrama,
  Perkawinan,
  RiwayatKeluarga,
  Keluarga,
  RiwayatPeranAdat
} from "../models/associations.js";
import { buatAnakKandung } from "./anak-kandung.service.js";
import { buatAnakAngkat } from "./anak-angkat.service.js";
import { anakAngkatPasangan } from "./anak-angkat-perkawinan.service.js";
import { integrasiRelasiLeluhur } from "./anak-relasi-leluhur.service.js";
import { eksekusiRollbackRelasi } from "./batal-relasi-krama.service.js";
import { rekonsiliasiKronologiKeluarga } from "../helpers/kronologis-order.helper.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";

// Helper: konversi nilai ke number atau null
const toSafeIntOrNull = (value) => {
  if (value === null || value === undefined || value === 'null' || value === 'undefined' || String(value).trim() === '' || value === 0 || value === '0' || isNaN(Number(value))) {
    return null;
  }
  return Number(value);
};

const hasProp = (obj, prop) => obj && Object.prototype.hasOwnProperty.call(obj, prop);

export const prosesVerifikasiRelasiKrama = async ({
  relasiId,
  statusVerifikasiInput,
  catatanAdminInput,
  currentUserId,
  userRole,
  userDesaId
}, t) => {
  const cleanRelasiId = toSafeIntOrNull(relasiId);
  const cleanCurrentUserId = toSafeIntOrNull(currentUserId);
  const cleanUserDesaId = toSafeIntOrNull(userDesaId);

  const relasi = await RelasiKrama.findByPk(cleanRelasiId, {
    include: [
      { 
        model: KramaBali, 
        as: "anak", 
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "desa_adat_id", "tipe_data", "status_verifikasi", "tanggal_lahir"]
      },{ 
        model: KramaBali, 
        as: "ayah", 
        attributes: ["id", "nama_lengkap", "desa_adat_id", "tipe_data", "status_verifikasi", "tanggal_lahir"]
      },{ 
        model: KramaBali, 
        as: "ibu", 
        attributes: ["id", "nama_lengkap", "desa_adat_id", "tipe_data", "status_verifikasi", "tanggal_lahir"]
      }
    ],
    transaction: t
  });

  if (!relasi) {
    throw { 
      status: 404, 
      message: "Data relasi krama tidak ditemukan." 
    };
  }

  const isModeUpdate = !!relasi.is_pending_update;
  const statusSaatIni = relasi.status_verifikasi;

  if (statusSaatIni === "Disetujui" && !isModeUpdate) {
    throw { 
      status: 400, 
      message: "Proses verifikasi dihentikan! Relasi krama ini sudah diverifikasi dan aktif di dalam silsilah Adat Bali." 
    };
  }

  if (statusSaatIni === "Ditolak" && !isModeUpdate) {
    throw { 
      status: 400, 
      message: "Proses verifikasi dihentikan! Relasi krama ini berstatus ditolak." 
    };
  }
  
  if (statusVerifikasiInput === "Disetujui") {
    if (relasi.anak?.status_verifikasi === "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data anak masih berstatus draft. Mohon verifikasi data anak terlebih dahulu." 
      };
    }
    if (relasi.ayah?.status_verifikasi === "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ayah masih berstatus draft. Mohon verifikasi data ayah terlebih dahulu." 
      };
    }
    if (relasi.ibu?.status_verifikasi === "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ibu masih berstatus draft. Mohon verifikasi data ibu terlebih dahulu." 
      };
    }
  }

  let rawChange = relasi.data_perubahan || {};

  if (rawChange && rawChange.data_perubahan) {
    rawChange = { ...rawChange.data_perubahan, ...rawChange };
  }

  const anakDesaId = toSafeIntOrNull(relasi.anak?.desa_adat_id);
  const desaTujuanId = toSafeIntOrNull(relasi.desa_adat_id_tujuan || rawChange?.desa_adat_id_tujuan);

  if (userRole === "Admin Desa") {
    const isLintasDesaAktif = desaTujuanId && anakDesaId && anakDesaId !== desaTujuanId;

    if (isLintasDesaAktif) {
      if (cleanUserDesaId !== anakDesaId && cleanUserDesaId !== desaTujuanId) {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak! Anda bukan bagian dari Admin Desa Asal maupun Tujuan pengajuan lintas desa adat ini." 
        };
      }
    } else {
      if (anakDesaId !== cleanUserDesaId) {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
        };
      }
    }
  }

  // JALUR A: VERIFIKASI DITOLAK
  if (statusVerifikasiInput === "Ditolak") {
    if (!catatanAdminInput) {
      throw { 
        status: 400, 
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!" 
      };
    }

    if (isModeUpdate) {
      const statusRollback = relasi.status_sebelum_draft || "Disetujui";

      await relasi.update({
        status_verifikasi: statusRollback,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null,
        catatan_admin_desa: `[PERUBAHAN DITOLAK]: ${catatanAdminInput}`
      }, { transaction: t });
    } else {
      await relasi.update({
        status_verifikasi: "Ditolak",
        catatan_admin_desa: `[PENGAJUAN DITOLAK]: ${catatanAdminInput}`
      }, { transaction: t });
    }

    return { 
      nextStatusVerifikasi: "Ditolak", 
      relasiFinalId: relasi.id, 
      relasi 
    };
  }

  // JALUR B: VERIFIKASI DISETUJUI/PERSETUJUAN BERTAHAP
  let nextStatusVerifikasi = "Draft";
  let idApprovedAsal = relasi.approved_asal_by;
  let idApprovedTujuan = relasi.approved_tujuan_by;
  let catatanFinal = catatanAdminInput || `Pengajuan relasi krama telah diverifikasi dan disetujui resmi oleh ${userRole}.`;

  const isLintasDesaAktif = desaTujuanId && anakDesaId && anakDesaId !== desaTujuanId;

  if (userRole === "Super Admin") {
    nextStatusVerifikasi = "Disetujui";
    idApprovedAsal = cleanCurrentUserId;
    idApprovedTujuan = cleanCurrentUserId;
  } else if (isLintasDesaAktif) {
    if (cleanUserDesaId === anakDesaId) idApprovedAsal = cleanCurrentUserId;
    if (cleanUserDesaId === desaTujuanId) idApprovedTujuan = cleanCurrentUserId;

    if (idApprovedAsal && idApprovedTujuan) {
      nextStatusVerifikasi = "Disetujui";
      catatanFinal = "Persetujuan birokrasi lintas desa adat lengkap! Data silsilah keluarga dinyatakan aktif di dalam silsilah Adat Bali.";
    } else {
      nextStatusVerifikasi = "Draft";
      catatanFinal = cleanUserDesaId === anakDesaId
        ? `Data relasi krama telah disetujui oleh Admin Desa Asal. Menunggu verifikasi dari Admin Desa Tujuan.`
        : `Data relasi krama telah disetujui oleh Admin Desa Tujuan. Menunggu verifikasi dari Admin Desa Asal.`;
    }
  } else {
    nextStatusVerifikasi = "Disetujui";
    idApprovedAsal = cleanCurrentUserId;
    idApprovedTujuan = cleanCurrentUserId;
  }

  if (nextStatusVerifikasi === "Draft") {
    await relasi.update({
      approved_asal_by: idApprovedAsal,
      approved_tujuan_by: idApprovedTujuan,
      catatan_admin_desa: catatanFinal
    }, { transaction: t });
    
    return { 
      nextStatusVerifikasi: "Draft", 
      relasiFinalId: relasi.id, 
      relasi 
    };
  }

  const idAyahLama = toSafeIntOrNull(relasi.ayah_id);
  const idIbuLama = toSafeIntOrNull(relasi.ibu_id);

  let targetAyahId = isModeUpdate && hasProp(rawChange, 'ayah_id') 
    ? toSafeIntOrNull(rawChange.ayah_id) 
    : idAyahLama;

  let targetIbuId = isModeUpdate && hasProp(rawChange, 'ibu_id') 
    ? toSafeIntOrNull(rawChange.ibu_id) 
    : idIbuLama;

  const targetStatusHubungan = isModeUpdate && hasProp(rawChange, 'status_hubungan') && rawChange.status_hubungan
    ? rawChange.status_hubungan 
    : relasi.status_hubungan;
  
  const filePengangkatanRaw = isModeUpdate && hasProp(rawChange, 'berkas_pengangkatan')
    ? rawChange.berkas_pengangkatan
    : relasi.berkas_pengangkatan;

  const targetBerkasPengangkatan = (!filePengangkatanRaw || String(filePengangkatanRaw).trim() === '' || String(filePengangkatanRaw) === 'null')
    ? null
    : String(filePengangkatanRaw).trim();

  let targetPerkawinanId = isModeUpdate 
    ? toSafeIntOrNull(rawChange.perkawinan_id ?? relasi.perkawinan_id)
    : toSafeIntOrNull(relasi.perkawinan_id);

  if (!targetPerkawinanId && (targetAyahId || targetIbuId)) {
    const whereCondition = [];
    if (targetAyahId && targetIbuId) {
      whereCondition.push({ suami_id: targetAyahId, istri_id: targetIbuId });
    }

    if (targetAyahId) {
      whereCondition.push({ suami_id: targetAyahId });
    }
    if (targetIbuId) {
      whereCondition.push({ istri_id: targetIbuId });
    }

    let matchPerkawinanSah = await Perkawinan.findOne({
      where: {
        status_perkawinan: "Kawin",
        status_verifikasi: "Disetujui",
        [Op.or]: whereCondition
      },
      order: [['createdAt', 'DESC']],
      transaction: t
    });

    if (!matchPerkawinanSah && whereCondition.length > 0) {
      matchPerkawinanSah = await Perkawinan.findOne({
        where: {
          [Op.or]: whereCondition
        },
        order: [['createdAt', 'DESC']],
        transaction: t
      });
    }

    if (matchPerkawinanSah) {
      targetPerkawinanId = matchPerkawinanSah.id;
      if (!targetAyahId) {
        targetAyahId = matchPerkawinanSah.suami_id;
      }
      if (!targetIbuId) {
        targetIbuId = matchPerkawinanSah.istri_id;
      }
    }
  }

  const existingRelasiActive = await RelasiKrama.findOne({
    where: {
      id: { [Op.ne]: cleanRelasiId },
      anak_id: relasi.anak_id,
      status_hubungan: targetStatusHubungan,
      status_verifikasi: "Disetujui"
    },
    transaction: t
  });

  if (existingRelasiActive) {
    throw { 
      status: 400, 
      message: `Proses verifikasi dihentikan! Data relasi krama sebagai ${targetStatusHubungan} sudah terdaftar secara aktif.` 
    };
  }

  const [ayahBaru, ibuBaru] = await Promise.all([
    targetAyahId ? KramaBali.findByPk(targetAyahId, { 
      transaction: t 
    }) : null,
    targetIbuId ? KramaBali.findByPk(targetIbuId, { 
      transaction: t 
    }) : null
  ]);

  const rawTanggalAngkat = isModeUpdate ? rawChange.tanggal_pengangkatan : relasi.tanggal_pengangkatan;
  let tglAngkatDateOnly = null;

  if (targetStatusHubungan === "Anak Angkat" && rawTanggalAngkat && String(rawTanggalAngkat).trim() !== '' && String(rawTanggalAngkat) !== 'null') {
    tglAngkatDateOnly = String(rawTanggalAngkat).includes('T') 
      ? String(rawTanggalAngkat).split('T')[0] 
      : String(rawTanggalAngkat).split(' ')[0];
  }

  const commonParams = {
    user_id: cleanCurrentUserId,
    status_verifikasi: "Disetujui",
    catatan_admin_desa: catatanFinal,
    is_pending_update: false,
    desa_adat_id_tujuan: isLintasDesaAktif ? desaTujuanId : null,
    approved_asal_by: idApprovedAsal,
    approved_tujuan_by: idApprovedTujuan,
    berkas_pengangkatan: targetBerkasPengangkatan
  };

  const isLeluhurMode = relasi.anak?.tipe_data === "Leluhur" || ayahBaru?.tipe_data === "Leluhur" || ibuBaru?.tipe_data === "Leluhur";
  let relasiFinalId = relasi.id;

  // KONDISI 1: VERIFIKASI DATA RELASI BARU
  if (!isModeUpdate) {
    const userIdPengaju = relasi.user_id || cleanCurrentUserId;
    await eksekusiRollbackRelasi(relasi, t);
    await relasi.destroy({ transaction: t });

    if (isLeluhurMode) {
      const servicePayloadNew = {
        anak_id: relasi.anak_id, 
        ayah_id: targetAyahId, 
        ibu_id: targetIbuId,
        perkawinan_id: targetPerkawinanId, 
        tanggal_pengangkatan: tglAngkatDateOnly,
        status_hubungan: targetStatusHubungan, 
        urutan_lahir: toSafeIntOrNull(rawChange?.urutan_lahir ?? relasi.urutan_lahir),
        is_verifikasi: false, 
        ...commonParams,
        user_id: userIdPengaju
      };

      const hasilLeluhur = await integrasiRelasiLeluhur({ 
        ...servicePayloadNew, 
        ayah: ayahBaru, 
        ibu: ibuBaru, 
        anak: relasi.anak 
      }, t);

      relasiFinalId = hasilLeluhur?.id || relasiFinalId;
    } else {
      if (targetStatusHubungan === "Anak Kandung") {
        if (!targetPerkawinanId) {
          throw { 
            status: 400, 
            message: "Pencatatan anak kandung keturunan wajib menyertakan data perkawinan orang tua!" 
          };
        }

        const servicePayloadKandungNew = {
          anak_id: relasi.anak_id,
          perkawinan_id: targetPerkawinanId,
          ayah_id: targetAyahId,
          ibu_id: targetIbuId,
          status_hubungan: "Anak Kandung",
          urutan_lahir: toSafeIntOrNull(rawChange?.urutan_lahir ?? relasi.urutan_lahir),
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };

        const hasilService = await buatAnakKandung(servicePayloadKandungNew, t);
        relasiFinalId = hasilService?.id || relasiFinalId;
      } else if (targetStatusHubungan === "Anak Angkat") {
        const pengangkatId = targetAyahId || targetIbuId;
        const isAdopsiPasangan = !!(targetAyahId && targetIbuId) || !!targetPerkawinanId;

        const servicePayloadAngkatNew = {
          anak_id: relasi.anak_id, 
          ayah_id: targetAyahId, 
          ibu_id: targetIbuId,
          pengangkat_id: pengangkatId,
          krama_id: pengangkatId,
          perkawinan_id: targetPerkawinanId, 
          tanggal_pengangkatan: tglAngkatDateOnly,
          status_hubungan: "Anak Angkat", 
          urutan_lahir: toSafeIntOrNull(rawChange?.urutan_lahir ?? relasi.urutan_lahir),
          is_verifikasi: false, 
          ...commonParams,
          user_id: userIdPengaju
        };

        const hasilService = isAdopsiPasangan 
          ? await anakAngkatPasangan(servicePayloadAngkatNew, t) 
          : await buatAnakAngkat(servicePayloadAngkatNew, t);

        relasiFinalId = hasilService?.id || relasiFinalId;
      }
    }
  } 
  
  // KONDISI 2: VERIFIKASI PERUBAHAN DATA RELASI KRAMA
  else {
    const isPerubahanStruktural = (targetAyahId !== idAyahLama) || (targetIbuId !== idIbuLama) || (targetStatusHubungan !== relasi.status_hubungan);

    if (isPerubahanStruktural) {
      await eksekusiRollbackRelasi(relasi, t);
      await relasi.destroy({ transaction: t });

      if (relasi.status_hubungan === "Anak Kandung") {
        await hitungUrutanLahir({
          ayah_id: idAyahLama,
          ibu_id: idIbuLama,
          mode: "CAMPUR"
        }, t);
      } else if (relasi.status_hubungan === "Anak Angkat" && (idAyahLama || idIbuLama)) {
        await hitungUrutanLahir({
          kepala_keluarga_id: idAyahLama || idIbuLama,
          mode: "ANGKAT"
        }, t);
      }
      
      const pengangkatIdStruktural = targetAyahId || targetIbuId;
      const urutanInputManual = toSafeIntOrNull(rawChange?.urutan_lahir ?? relasi.urutan_lahir);

      const servicePayloadStruktural = {
        anak_id: relasi.anak_id, 
        ayah_id: targetAyahId, 
        ibu_id: targetIbuId,
        pengangkat_id: pengangkatIdStruktural,
        krama_id: pengangkatIdStruktural,
        status_hubungan: targetStatusHubungan, 
        tanggal_pengangkatan: tglAngkatDateOnly,
        urutan_lahir: urutanInputManual,
        perkawinan_id: targetPerkawinanId, 
        is_verifikasi: false,
        ...commonParams,
        user_id: toSafeIntOrNull(relasi.user_id)
      };

      let hasilService = null;

      if (isLeluhurMode) {
        hasilService = await integrasiRelasiLeluhur({ 
          ...servicePayloadStruktural, 
          ayah: ayahBaru, 
          ibu: ibuBaru, 
          anak: relasi.anak 
        }, t);
      } else {
        if (targetStatusHubungan === "Anak Kandung") {
          if (!targetPerkawinanId) {
            throw { 
              status: 400, 
              message: "Pencatatan anak kandung keturunan wajib menyertakan data perkawinan orang tua!" 
            };
          }
          hasilService = await buatAnakKandung(servicePayloadStruktural, t);
        } else if (targetStatusHubungan === "Anak Angkat") {
          const isAdopsiPasangan = !!(targetAyahId && targetIbuId) || !!targetPerkawinanId;
          hasilService = isAdopsiPasangan 
            ? await anakAngkatPasangan(servicePayloadStruktural, t) 
            : await buatAnakAngkat(servicePayloadStruktural, t);
        }
      }

      relasiFinalId = hasilService?.id || relasiFinalId;
    } else {
      if (targetStatusHubungan === "Anak Kandung") {
        if (!targetPerkawinanId) {
          throw { 
            status: 400, 
            message: "Pencatatan anak kandung keturunan wajib menyertakan data perkawinan orang tua!" 
          };
        }

        const userIdPengaju = relasi.user_id;
        await eksekusiRollbackRelasi(relasi, t);
        await relasi.destroy({ transaction: t });

        await hitungUrutanLahir({
          ayah_id: idAyahLama,
          ibu_id: idIbuLama,
          mode: "CAMPUR"
        }, t);

        const servicePayloadKandungNon = {
          anak_id: relasi.anak_id,
          perkawinan_id: targetPerkawinanId,
          ayah_id: targetAyahId,
          ibu_id: targetIbuId,
          status_hubungan: "Anak Kandung",
          urutan_lahir: toSafeIntOrNull(rawChange.urutan_lahir ?? relasi.urutan_lahir),
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };

        const hasilService = await buatAnakKandung(servicePayloadKandungNon, t);
        relasiFinalId = hasilService?.id || relasiFinalId;
      } else {
        await relasi.update({
          tanggal_pengangkatan: tglAngkatDateOnly,
          urutan_lahir: toSafeIntOrNull(rawChange.urutan_lahir ?? relasi.urutan_lahir),
          perkawinan_id: targetPerkawinanId,
          berkas_pengangkatan: targetBerkasPengangkatan,
          data_perubahan: null,
          status_sebelum_draft: null,
          ...commonParams,
          user_id: toSafeIntOrNull(relasi.user_id)
        }, { transaction: t });

        relasiFinalId = relasi.id;
      }
    }
  }

  const setTargetKrama = new Set();

  if (relasi.anak_id) {
    setTargetKrama.add(relasi.anak_id);
  }
  if (idAyahLama) {
    setTargetKrama.add(idAyahLama);
  }
  if (idIbuLama) {
    setTargetKrama.add(idIbuLama);
  }
  if (targetAyahId) {
    setTargetKrama.add(targetAyahId);
  }
  if (targetIbuId) {
    setTargetKrama.add(targetIbuId);
  }

  for (const kramaId of setTargetKrama) {
    if (kramaId) {
      await rekonsiliasiKronologiKeluarga(kramaId, t);
    }
  }

  return { 
    nextStatusVerifikasi: "Disetujui", 
    isLintasDesaAktif, 
    anakDesaId, 
    desaTujuanId, 
    relasiFinalId, 
    catatanFinal, 
    relasi 
  };
};