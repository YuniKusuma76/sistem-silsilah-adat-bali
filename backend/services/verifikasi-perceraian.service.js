import db from "../config/db.config.js";
import { Perkawinan, KramaBali } from "../models/associations.js";
import { prosesPerceraianBali } from "./perceraian.service.js";

export const eksekusiVerifikasiPerceraian = async ({
  perkawinan_id,
  status_verifikasi,
  catatan_admin,
  user_id,
  user_role,
  user_desa_id,
  target_sisi,
  nama_desa_operator
}) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan.");
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.PERCERAIAN) {
      throw new Error("Data perkawinan ini tidak memiliki usulan draft perceraian yang aktif.");
    }

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    const operatorName = nama_desa_operator || `Admin Desa ${user_desa_id}`;
    let newCatatanAdmin = { ...existingCatatan };

    // CASE 1: PENGAJUAN DATA PERCERAIAN DITOLAK
    if (status_verifikasi === "Ditolak") {
      if (target_sisi === "suami" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_suami = catatan_admin || "Ditolak oleh Admin Desa Suami.";
      }
      if (target_sisi === "istri" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_istri = catatan_admin || "Ditolak oleh Admin Desa Istri.";
      }
      newCatatanAdmin.status_verifikasi_perceraian = `Usulan draft perceraian ditolak oleh ${user_role}.`;
      newCatatanAdmin.last_updated_by = operatorName;

      const perkawinanDitolak = await perkawinan.update({
        is_pending_update: false,
        status_sebelum_draft: null,
        data_perubahan: null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PENOLAKAN_CERAI", 
        data: perkawinanDitolak 
      };
    }

    // ====================================================================
    // CASE 2: PENGAJUAN DATA PERCERAIAN DISETUJUI
    // ====================================================================
    const drafCerai = { ...perkawinan.data_perubahan.PERCERAIAN };

    // Ambil data krama untuk memverifikasi apakah ini kasus 1 desa atau beda desa
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id, { transaction: t }),
      KramaBali.findByPk(perkawinan.istri_id, { transaction: t })
    ]);

    if (!suami || !istri) {
      throw new Error("Data krama suami atau istri tidak ditemukan.");
    }

    const isSatuDesaAdat = suami.desa_adat_id === istri.desa_adat_id;

    // Ambil/inisialisasi status approval khusus untuk perceraian dari metadata JSON draf
    let approvedSuami = drafCerai.approval_cerai_suami || false;
    let approvedIstri = drafCerai.approval_cerai_istri || false;

    // Mutasi state berdasarkan pihak yang melakukan verifikasi saat ini
    if (target_sisi === "suami" || target_sisi === "super_admin" || isSatuDesaAdat) {
      approvedSuami = true;
    }
    if (target_sisi === "istri" || target_sisi === "super_admin" || isSatuDesaAdat) {
      approvedIstri = true;
    }

    let catatanOtomatis = `Usulan draft perceraian telah disetujui dan diverifikasi oleh ${user_role}.`;

    if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
      if (isSatuDesaAdat) {
        newCatatanAdmin.catatan_desa_suami = catatanOtomatis;
        newCatatanAdmin.catatan_desa_istri = catatanOtomatis;
      } else {
        if (target_sisi === "suami" || target_sisi === "super_admin") newCatatanAdmin.catatan_desa_suami = catatanOtomatis;
        if (target_sisi === "istri" || target_sisi === "super_admin") newCatatanAdmin.catatan_desa_istri = catatanOtomatis;
      }
    } else {
      newCatatanAdmin.catatan_desa_suami = catatanOtomatis;
      newCatatanAdmin.catatan_desa_istri = catatanOtomatis;
    }
    
    newCatatanAdmin.last_updated_by = operatorName;

    // SKENARIO 2.A: Persetujuan Masih Parsial (Hanya untuk Pade Gelahang yang BEDA DESA)
    if (perkawinan.jenis_perkawinan === "Pade Gelahang" && !isSatuDesaAdat && (!approvedSuami || !approvedIstri)) {
      newCatatanAdmin.status_verifikasi_perceraian = `Usulan draft perceraian telah diverifikasi dan disetujui oleh ${operatorName}. Menunggu verifikasi dari Admin Desa Pasangan.`;

      // Simpan progres approval ke dalam JSON data_perubahan agar tidak hilang
      drafCerai.approval_cerai_suami = approvedSuami;
      drafCerai.approval_cerai_istri = approvedIstri;

      const perkawinanParsial = await perkawinan.update({
        data_perubahan: {
          ...perkawinan.data_perubahan,
          PERCERAIAN: drafCerai
        },
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERSETUJUAN_CERAI_PARSIAL", 
        data: perkawinanParsial 
      };
    }

    // SKENARIO 2.B: Persetujuan Penuh Perceraian (Biasa / Nyentana / Pade Gelahang yang sudah klop)
    newCatatanAdmin.status_verifikasi_perceraian = isSatuDesaAdat
      ? `Perceraian Pade Gelahang satu desa telah disetujui penuh oleh ${user_role}.`
      : `Perceraian telah diverifikasi dan disetujui secara sah oleh kedua belah pihak desa adat (${user_role}).`;

    // Sinkronkan kolom utama (opsional jika dipakai modul lain) sebelum mutasi fisik dilakukan
    await perkawinan.update({
      is_approved_desa_suami: true,
      is_approved_desa_istri: true,
      catatan_admin_desa: newCatatanAdmin
    }, { transaction: t });

    const hasilMutasiFisik = await prosesPerceraianBali({
      perkawinan_id: perkawinan.id,
      status_perkawinan: drafCerai.status_perkawinan,
      tanggal_cerai: drafCerai.tanggal_cerai, 
      pihak_meninggal: drafCerai.pihak_meninggal,
      pilihan_predana: drafCerai.pilihan_predana,
      user_id,
      user_role,
      user_desa_id
    }, t);

    await t.commit();
    
    return { 
      type: "PERSETUJUAN_CERAI_PENUH", 
      data: hasilMutasiFisik.data_perkawinan 
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};