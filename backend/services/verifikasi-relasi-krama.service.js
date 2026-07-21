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

export const prosesVerifikasiRelasiKrama = async ({
  relasiId,
  statusVerifikasiInput,
  catatanAdminInput,
  currentUserId,
  userRole,
  userDesaId
}, t) => {
  const relasi = await RelasiKrama.findByPk(relasiId, {
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

  if (statusSaatIni === "Disetujui" && !relasi.is_pending_update) {
    throw { 
      status: 400, 
      message: "Proses verifikasi dihentikan! Relasi krama ini sudah diverifikasi dan aktif di dalam silsilah Adat Bali." 
    };
  }

  if (statusSaatIni === "Ditolak") {
    throw { 
      status: 400, 
      message: "Proses verifikasi dihentikan! Relasi krama ini sudah berstatus ditolak." 
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

  let dataPerubahanRaw = relasi.data_perubahan || null;

  if (dataPerubahanRaw && dataPerubahanRaw.data_perubahan) {
    dataPerubahanRaw = dataPerubahanRaw.data_perubahan;
  }

  const anakDesaId = relasi.anak?.desa_adat_id;
  const desaTujuanId = relasi.desa_adat_id_tujuan || dataPerubahanRaw?.desa_adat_id_tujuan;

  if (userRole === "Admin Desa") {
    const isLintasDesaAktif = desaTujuanId && anakDesaId && parseInt(anakDesaId) !== parseInt(desaTujuanId);

    if (isLintasDesaAktif) {
      if (parseInt(userDesaId) !== parseInt(anakDesaId) && parseInt(userDesaId) !== parseInt(desaTujuanId)) {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak! Anda bukan bagian dari Admin Desa Asal maupun Tujuan pengajuan lintas desa adat ini." 
        };
      }
    } else {
      if (parseInt(anakDesaId) !== parseInt(userDesaId)) {
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

  // JALUR B: VERIFIKASI DISETUJUI / PERSETUJUAN BERTAHAP
  let nextStatusVerifikasi = "Draft";
  let idApprovedAsal = relasi.approved_asal_by;
  let idApprovedTujuan = relasi.approved_tujuan_by;
  let catatanFinal = catatanAdminInput || `Pengajuan relasi krama telah diverifikasi dan disetujui resmi oleh ${userRole}.`;

  const isLintasDesaAktif = desaTujuanId && anakDesaId && parseInt(anakDesaId) !== parseInt(desaTujuanId);

  if (userRole === "Super Admin") {
    nextStatusVerifikasi = "Disetujui";
    idApprovedAsal = currentUserId;
    idApprovedTujuan = currentUserId;
  } else if (isLintasDesaAktif) {
    if (parseInt(userDesaId) === parseInt(anakDesaId)) idApprovedAsal = currentUserId;
    if (parseInt(userDesaId) === parseInt(desaTujuanId)) idApprovedTujuan = currentUserId;

    if (idApprovedAsal && idApprovedTujuan) {
      nextStatusVerifikasi = "Disetujui";
      catatanFinal = "Persetujuan birokrasi lintas desa adat lengkap! Data silsilah keluarga dinyatakan aktif di dalam silsilah Adat Bali.";
    } else {
      nextStatusVerifikasi = "Draft";
      catatanFinal = parseInt(userDesaId) === parseInt(anakDesaId)
        ? `Data relasi krama telah disetujui oleh Admin Desa Asal. Menunggu verifikasi dari Admin Desa Tujuan.`
        : `Data relasi krama telah disetujui oleh Admin Desa Tujuan. Menunggu verifikasi dari Admin Desa Asal.`;
    }
  } else {
    nextStatusVerifikasi = "Disetujui";
    idApprovedAsal = currentUserId;
    idApprovedTujuan = currentUserId;
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

  // EKSEKUSI PERNGAJUAN DISETUJUI
  let targetAyahId = isModeUpdate && dataPerubahanRaw.hasOwnProperty('ayah_id') 
    ? dataPerubahanRaw.ayah_id 
    : relasi.ayah_id;

  let targetIbuId = isModeUpdate && dataPerubahanRaw.hasOwnProperty('ibu_id') 
    ? dataPerubahanRaw.ibu_id 
    : relasi.ibu_id;

  const targetStatusHubungan = isModeUpdate && dataPerubahanRaw.hasOwnProperty('status_hubungan') 
    ? dataPerubahanRaw.status_hubungan 
    : relasi.status_hubungan;
  
  let rawPerkawinanId = isModeUpdate 
    ? (dataPerubahanRaw.perkawinan_id || relasi.perkawinan_id) 
    : relasi.perkawinan_id;

  if (rawPerkawinanId === "null" || rawPerkawinanId === "undefined") rawPerkawinanId = null;
  
  let targetPerkawinanId = rawPerkawinanId ? parseInt(rawPerkawinanId) : null;
  const kramaOrangTuaId = targetAyahId || targetIbuId;

  if (!targetPerkawinanId && kramaOrangTuaId) {
    const matchPerkawinanSah = await Perkawinan.findOne({
      where: {
        status_perkawinan: "Kawin",
        status_verifikasi: "Disetujui",
        [Op.or]: [
          { suami_id: kramaOrangTuaId },
          { istri_id: kramaOrangTuaId }
        ]
      },
      transaction: t
    });

    if (matchPerkawinanSah) {
      targetPerkawinanId = matchPerkawinanSah.id;
      targetAyahId = matchPerkawinanSah.suami_id;
      targetIbuId = matchPerkawinanSah.istri_id;
    }
  }

  const existingRelasiActive = await RelasiKrama.findOne({
    where: {
      id: { [Op.ne]: relasiId },
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

  const rawTanggalAngkat = isModeUpdate ? dataPerubahanRaw.tanggal_pengangkatan : relasi.tanggal_pengangkatan;
  let tglAngkatDateOnly = null;

  if (targetStatusHubungan === "Anak Angkat" && rawTanggalAngkat) {
    tglAngkatDateOnly = rawTanggalAngkat.includes('T') 
      ? rawTanggalAngkat.split('T')[0] 
      : rawTanggalAngkat.split(' ')[0];
  }

  const commonParams = {
    user_id: currentUserId,
    status_verifikasi: "Disetujui",
    catatan_admin_desa: catatanFinal,
    is_pending_update: false,
    desa_adat_id_tujuan: isLintasDesaAktif ? desaTujuanId : null,
    approved_asal_by: idApprovedAsal,
    approved_tujuan_by: idApprovedTujuan
  };

  const isLeluhurMode = relasi.anak?.tipe_data === "Leluhur" || ayahBaru?.tipe_data === "Leluhur" || ibuBaru?.tipe_data === "Leluhur";
  let relasiFinalId = relasi.id;

  // KONDISI 1: VERIFIKASI DATA RELASI BARU
  if (!isModeUpdate) {
    if (isLeluhurMode) {
      const servicePayloadNew = {
        anak_id: relasi.anak_id, 
        ayah_id: targetAyahId, 
        ibu_id: targetIbuId,
        perkawinan_id: targetPerkawinanId, 
        tanggal_pengangkatan: tglAngkatDateOnly,
        status_hubungan: relasi.status_hubungan, 
        is_verifikasi: true, 
        ...commonParams
      };

      await integrasiRelasiLeluhur({ 
        ...servicePayloadNew, 
        ayah: ayahBaru, 
        ibu: ibuBaru, 
        anak: relasi.anak 
      }, t);
    } else {
      if (relasi.status_hubungan === "Anak Kandung") {
        if (!targetPerkawinanId) {
          throw { 
            status: 400, 
            message: "Pencatatan anak kandung keturunan wajib menyertakan data perkawinan orang tua!" 
          };
        }
        
        const userIdPengaju = relasi.user_id; 
        await relasi.destroy({ transaction: t }); 

        const servicePayloadKandungNew = {
          anak_id: relasi.anak_id,
          perkawinan_id: targetPerkawinanId,
          ayah_id: targetAyahId,
          ibu_id: targetIbuId,
          status_hubungan: "Anak Kandung",
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };

        const hasilService = await buatAnakKandung(servicePayloadKandungNew, t);
        relasiFinalId = hasilService?.id || relasiFinalId;
      } else if (relasi.status_hubungan === "Anak Angkat") {
        const servicePayloadNew = {
          anak_id: relasi.anak_id, 
          ayah_id: targetAyahId, 
          ibu_id: targetIbuId,
          perkawinan_id: targetPerkawinanId, 
          tanggal_pengangkatan: tglAngkatDateOnly,
          status_hubungan: relasi.status_hubungan, 
          is_verifikasi: true, 
          ...commonParams
        };

        if (targetPerkawinanId) {
          await anakAngkatPasangan(servicePayloadNew, t);
        } else {
          await buatAnakAngkat(servicePayloadNew, t);
        }
      }
    }
  }
  
  // KONDISI 2: VERIFIKASI PERUBAHAN DATA RELASI KRAMA
  else {
    const isPerubahanStruktural = (
      (dataPerubahanRaw.hasOwnProperty('ayah_id') && dataPerubahanRaw.ayah_id !== relasi.ayah_id) ||
      (dataPerubahanRaw.hasOwnProperty('ibu_id') && dataPerubahanRaw.ibu_id !== relasi.ibu_id) ||
      (dataPerubahanRaw.hasOwnProperty('status_hubungan') && dataPerubahanRaw.status_hubungan !== relasi.status_hubungan)
    );

    if (isPerubahanStruktural) {
      await eksekusiRollbackRelasi(relasi, t);
      await relasi.destroy({ transaction: t });

      const servicePayloadStruktural = {
        anak_id: relasi.anak_id, 
        ayah_id: targetAyahId, 
        ibu_id: targetIbuId,
        status_hubungan: targetStatusHubungan, 
        tanggal_pengangkatan: tglAngkatDateOnly,
        urutan_lahir: dataPerubahanRaw.urutan_lahir || relasi.urutan_lahir || null,
        perkawinan_id: targetPerkawinanId, 
        is_verifikasi: false, 
        ...commonParams,
        user_id: relasi.user_id
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
          hasilService = targetPerkawinanId 
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
        await relasi.destroy({ transaction: t });

        const servicePayloadKandungNon = {
          anak_id: relasi.anak_id,
          perkawinan_id: targetPerkawinanId,
          ayah_id: targetAyahId,
          ibu_id: targetIbuId,
          status_hubungan: "Anak Kandung",
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };
        const hasilService = await buatAnakKandung(servicePayloadKandungNon, t);
        relasiFinalId = hasilService?.id || relasiFinalId;
      } else {
        await relasi.update({
          tanggal_pengangkatan: tglAngkatDateOnly,
          urutan_lahir: dataPerubahanRaw.urutan_lahir || relasi.urutan_lahir || null,
          perkawinan_id: targetPerkawinanId,
          data_perubahan: null,
          status_sebelum_draft: null,
          ...commonParams,
          user_id: relasi.user_id
        }, { transaction: t });

        const servicePayloadNonStruktural = {
          anak_id: relasi.anak_id, 
          ayah_id: targetAyahId, 
          ibu_id: targetIbuId,
          status_hubungan: targetStatusHubungan, 
          tanggal_pengangkatan: tglAngkatDateOnly,
          perkawinan_id: targetPerkawinanId, 
          is_verifikasi: false, ...commonParams,
          user_id: relasi.user_id
        };

        if (isLeluhurMode) {
          await integrasiRelasiLeluhur({ 
            ...servicePayloadNonStruktural, 
            ayah: ayahBaru, 
            ibu: ibuBaru, 
            anak: relasi.anak 
          }, t);
        } else if (targetStatusHubungan === "Anak Angkat") {
          if (targetPerkawinanId) {
            await anakAngkatPasangan(servicePayloadNonStruktural, t);
          } else {
            await buatAnakAngkat(servicePayloadNonStruktural, t);
          }
        }
      }
    }
  }

  await rekonsiliasiKronologiKeluarga(relasi.anak_id, t);

  return { 
    nextStatusVerifikasi: "Disetujui", 
    isLintasDesaAktif, 
    anakDesaId, desaTujuanId, 
    relasiFinalId, catatanFinal, 
    relasi 
  };
};