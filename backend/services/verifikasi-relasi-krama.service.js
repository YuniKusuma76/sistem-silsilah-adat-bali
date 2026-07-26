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

// Helper: konversi nilai ke number atau null
const toSafeIntOrNull = (value) => {
  if (value === null || value === undefined || value === 'null' || value === 'undefined' || String(value).trim() === '' || value === 0 || value === '0' || isNaN(Number(value))) {
    return null;
  }
  return Number(value);
};

const hasProp = (obj, prop) => obj && Object.prototype.hasOwnProperty.call(obj, prop);

const parseIdValue = (data, key, defaultValue) => {
  if (!data || !hasProp(data, key)) {
    return toSafeIntOrNull(defaultValue);
  }
  return toSafeIntOrNull(data[key]);
};

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

  // MENCEGAH NILAI NULL PADA KOLOM WAJIB
  relasi.ayah_id = toSafeIntOrNull(relasi.ayah_id);
  relasi.ibu_id = toSafeIntOrNull(relasi.ibu_id);
  relasi.perkawinan_id = toSafeIntOrNull(relasi.perkawinan_id);
  relasi.user_id = toSafeIntOrNull(relasi.user_id);
  relasi.approved_asal_by = toSafeIntOrNull(relasi.approved_asal_by);
  relasi.approved_tujuan_by = toSafeIntOrNull(relasi.approved_tujuan_by);
  relasi.desa_adat_id_tujuan = toSafeIntOrNull(relasi.desa_adat_id_tujuan);

  const idAyahLama = relasi.ayah_id;
  const idIbuLama = relasi.ibu_id;

  const isPendingUpdate = !!relasi.is_pending_update;
  const isPernahDitolak = relasi.status_verifikasi === "Ditolak" || relasi.status_sebelum_draft === "Ditolak";
  const isModeUpdateMurni = isPendingUpdate && !isPernahDitolak;

  if (relasi.status_verifikasi === "Disetujui" && !isPendingUpdate) {
    throw { 
      status: 400, 
      message: "Proses verifikasi dihentikan! Relasi krama ini sudah diverifikasi dan aktif di dalam silsilah Adat Bali." 
    };
  }

  if (relasi.status_verifikasi === "Ditolak" && !isPendingUpdate) {
    throw { 
      status: 400, 
      message: "Proses verifikasi dihentikan! Relasi krama ini berstatus ditolak dan belum ada draft usulan perbaikan." 
    };
  }
  
  if (statusVerifikasiInput === "Disetujui") {
    if (relasi.anak?.status_verifikasi === "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data anak masih berstatus draft, mohon verifikasi data anak terlebih dahulu." 
      };
    }
    if (relasi.ayah?.status_verifikasi === "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ayah masih berstatus draft, mohon verifikasi data ayah terlebih dahulu." 
      };
    }
    if (relasi.ibu?.status_verifikasi === "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ibu masih berstatus draft, mohon verifikasi data ibu terlebih dahulu." 
      };
    }
  }

  let dataPerubahanRaw = relasi.data_perubahan || null;

  if (dataPerubahanRaw && dataPerubahanRaw.data_perubahan) {
    dataPerubahanRaw = dataPerubahanRaw.data_perubahan;
  }

  const cleanDataPerubahanRaw = dataPerubahanRaw ? { ...dataPerubahanRaw } : {};
  delete cleanDataPerubahanRaw.catatan_update;

  const anakDesaId = toSafeIntOrNull(relasi.anak?.desa_adat_id);
  const desaTujuanId = toSafeIntOrNull(relasi.desa_adat_id_tujuan || cleanDataPerubahanRaw?.desa_adat_id_tujuan);

  if (userRole === "Admin Desa") {
    const isLintasDesaAktif = desaTujuanId && anakDesaId && anakDesaId !== desaTujuanId;

    if (isLintasDesaAktif) {
      if (cleanUserDesaId !== anakDesaId && cleanUserDesaId !== desaTujuanId) {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak! Anda bukan bagian dari Admin Desa Asal maupun Admin Desa Tujuan pada pengajuan relasi lintas desa adat ini." 
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

    if (isModeUpdateMurni) {
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
        is_pending_update: false,
        data_perubahan: null,
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
      catatanFinal = "Persetujuan Admin Desa untuk relasi lintas desa adat lengkap! Data silsilah keluarga dinyatakan aktif di dalam silsilah Adat Bali.";
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

  // EKSEKUSI PENETAPAN TARGET DATA
  let targetAyahId = isPendingUpdate 
    ? parseIdValue(cleanDataPerubahanRaw, 'ayah_id', relasi.ayah_id) 
    : relasi.ayah_id;

  let targetIbuId = isPendingUpdate 
    ? parseIdValue(cleanDataPerubahanRaw, 'ibu_id', relasi.ibu_id) 
    : relasi.ibu_id;

  const targetStatusHubungan = isPendingUpdate && hasProp(cleanDataPerubahanRaw, 'status_hubungan') && cleanDataPerubahanRaw.status_hubungan && String(cleanDataPerubahanRaw.status_hubungan) !== 'null'
    ? cleanDataPerubahanRaw.status_hubungan 
    : relasi.status_hubungan;

  const rawBerkas = isPendingUpdate && hasProp(cleanDataPerubahanRaw, 'berkas_pengangkatan')
    ? cleanDataPerubahanRaw.berkas_pengangkatan
    : relasi.berkas_pengangkatan;

  const targetBerkasPengangkatan = (!rawBerkas || String(rawBerkas).trim() === '' || String(rawBerkas) === 'null' || String(rawBerkas) === 'undefined') 
    ? null 
    : String(rawBerkas).trim();
  
  let targetPerkawinanId = isPendingUpdate 
    ? parseIdValue(cleanDataPerubahanRaw, 'perkawinan_id', relasi.perkawinan_id) 
    : relasi.perkawinan_id;

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

  const rawTanggalAngkat = isPendingUpdate ? cleanDataPerubahanRaw?.tanggal_pengangkatan : relasi.tanggal_pengangkatan;
  const isTanggalAngkatKosong = !rawTanggalAngkat || String(rawTanggalAngkat).trim() === "" || String(rawTanggalAngkat) === "null";
  let tglAngkatDateOnly = null;

  if (targetStatusHubungan === "Anak Angkat" && !isTanggalAngkatKosong) {
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
    approved_tujuan_by: idApprovedTujuan
  };

  const isLeluhurMode = relasi.anak?.tipe_data === "Leluhur" || ayahBaru?.tipe_data === "Leluhur" || ibuBaru?.tipe_data === "Leluhur";
  let relasiFinalId = relasi.id;

  // KONDISI 1: VERIFIKASI DATA RELASI BARU
  if (!isModeUpdateMurni) {
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
        berkas_pengangkatan: targetBerkasPengangkatan,
        urutan_lahir: toSafeIntOrNull(cleanDataPerubahanRaw?.urutan_lahir ?? relasi.urutan_lahir),
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
          berkas_pengangkatan: targetBerkasPengangkatan,
          urutan_lahir: toSafeIntOrNull(cleanDataPerubahanRaw?.urutan_lahir ?? relasi.urutan_lahir),
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };

        const hasilService = await buatAnakKandung(servicePayloadKandungNew, t);
        relasiFinalId = hasilService?.id || relasiFinalId;
      } else if (targetStatusHubungan === "Anak Angkat") {
        const isAdopsiPasangan = !!(targetAyahId && targetIbuId) || !!targetPerkawinanId;
        const pengangkatId = targetAyahId || targetIbuId;

        const servicePayloadAngkatNew = {
          anak_id: relasi.anak_id, 
          ayah_id: targetAyahId, 
          ibu_id: targetIbuId,
          pengangkat_id: pengangkatId,
          krama_id: pengangkatId,
          perkawinan_id: targetPerkawinanId, 
          tanggal_pengangkatan: tglAngkatDateOnly,
          status_hubungan: "Anak Angkat", 
          berkas_pengangkatan: targetBerkasPengangkatan,
          urutan_lahir: toSafeIntOrNull(cleanDataPerubahanRaw?.urutan_lahir ?? relasi.urutan_lahir),
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };

        let hasilService = null;

        if (isAdopsiPasangan) {
          hasilService = await anakAngkatPasangan(servicePayloadAngkatNew, t);
        } else {
          hasilService = await buatAnakAngkat(servicePayloadAngkatNew, t);
        }
        relasiFinalId = hasilService?.id || relasiFinalId;
      }
    }
  } 
  // KONDISI 2: VERIFIKASI PERUBAHAN DATA RELASI KRAMA 
  else {
    const isPerubahanStruktural = targetAyahId !== idAyahLama || targetIbuId !== idIbuLama || targetStatusHubungan !== relasi.status_hubungan;

    if (isPerubahanStruktural) {
      await eksekusiRollbackRelasi(relasi, t);
      await relasi.destroy({ transaction: t });

      const pengangkatIdStruktural = targetAyahId || targetIbuId;

      const servicePayloadStruktural = {
        anak_id: relasi.anak_id, 
        ayah_id: targetAyahId, 
        ibu_id: targetIbuId,
        pengangkat_id: pengangkatIdStruktural,
        krama_id: pengangkatIdStruktural,
        status_hubungan: targetStatusHubungan, 
        tanggal_pengangkatan: tglAngkatDateOnly,
        urutan_lahir: toSafeIntOrNull(cleanDataPerubahanRaw?.urutan_lahir ?? relasi.urutan_lahir),
        perkawinan_id: targetPerkawinanId, 
        berkas_pengangkatan: targetBerkasPengangkatan,
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

        const servicePayloadKandungNon = {
          anak_id: relasi.anak_id,
          perkawinan_id: targetPerkawinanId,
          ayah_id: targetAyahId,
          ibu_id: targetIbuId,
          status_hubungan: "Anak Kandung",
          urutan_lahir: toSafeIntOrNull(cleanDataPerubahanRaw?.urutan_lahir ?? relasi.urutan_lahir),
          berkas_pengangkatan: targetBerkasPengangkatan,
          is_verifikasi: false,
          ...commonParams,
          user_id: userIdPengaju
        };
        const hasilService = await buatAnakKandung(servicePayloadKandungNon, t);
        relasiFinalId = hasilService?.id || relasiFinalId;
      } else {
        await relasi.update({
          tanggal_pengangkatan: tglAngkatDateOnly,
          urutan_lahir: toSafeIntOrNull(cleanDataPerubahanRaw?.urutan_lahir ?? relasi.urutan_lahir),
          perkawinan_id: targetPerkawinanId,
          berkas_pengangkatan: targetBerkasPengangkatan,
          data_perubahan: null,
          status_sebelum_draft: null,
          ...commonParams,
          user_id: toSafeIntOrNull(relasi.user_id)
        }, { transaction: t });

        if (targetStatusHubungan === "Anak Angkat" && tglAngkatDateOnly) {
          const tglAngkatTimestamp = new Date(tglAngkatDateOnly).getTime();
          const kepalaKeluargaId = targetAyahId || targetIbuId;
          const teksHapusOtomatis = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal pengangkatan kosong).";

          if (kepalaKeluargaId) {
            const isAdopsiPasangan = targetAyahId && targetIbuId;

            const riwayatAnakLama = await RiwayatKeluarga.findOne({
              where: {
                krama_id: relasi.anak_id,
                kategori_event: "PENGANGKATAN"
              },
              transaction: t
            });

            if (riwayatAnakLama) {
              const tglLamaMurni = riwayatAnakLama.awal_masuk instanceof Date 
                ? riwayatAnakLama.awal_masuk.toISOString().split('T')[0]
                : String(riwayatAnakLama.awal_masuk).split('T')[0];

              const awalHariLama = new Date(`${tglLamaMurni}T00:00:00.000Z`);
              const akhirHariLama = new Date(`${tglLamaMurni}T23:59:59.999Z`);

              const keluargaTarget = await Keluarga.findOne({
                where: {
                  kepala_keluarga_id: kepalaKeluargaId,
                  jenis_keluarga: "Keluarga Angkat"
                },
                transaction: t
              });

              if (keluargaTarget) {
                await keluargaTarget.update({
                  dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
                }, { transaction: t });
              }

              if (!isAdopsiPasangan) {
                if (keluargaTarget) {
                  await RiwayatKeluarga.update({ 
                    awal_masuk: new Date(tglAngkatTimestamp),
                    dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
                  },{
                    where: {
                      krama_id: kepalaKeluargaId,
                      keluarga_id: keluargaTarget.id,
                      kedudukan: "Kepala Keluarga",
                      awal_masuk: { [Op.between]: [awalHariLama, akhirHariLama] }
                    },
                    transaction: t
                  });
                }

                await RiwayatPeranAdat.update({ 
                  mulai_tanggal: new Date(tglAngkatTimestamp),
                  dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
                },{ 
                  where: { 
                    krama_id: kepalaKeluargaId, 
                    kategori_event: "PENGANGKATAN",
                    mulai_tanggal: { [Op.between]: [awalHariLama, akhirHariLama] }
                  }, 
                  transaction: t 
                });

                await RiwayatPeranAdat.update({ 
                  selesai_tanggal: new Date(tglAngkatTimestamp) 
                },{
                  where: {
                    krama_id: kepalaKeluargaId,
                    kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
                    selesai_tanggal: { [Op.between]: [awalHariLama, akhirHariLama] }
                  },
                  transaction: t
                });
              }
            }

            await RiwayatKeluarga.update({ 
              awal_masuk: new Date(tglAngkatTimestamp),
              dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusOtomatis, '')
            },{ 
              where: { 
                krama_id: relasi.anak_id, 
                kategori_event: "PENGANGKATAN" 
              }, 
              transaction: t 
            });
          }
        }
        relasiFinalId = relasi.id;
      }
    }
  }

  // REKONSILIASI KRONOLOGI LINTAS PIHAK (ANAK, ORANG TUA LAMA & ORANG TUA BARU)
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