import db from "../config/db.config.js";
import { Perkawinan } from "../models/associations.js";
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
    // Validasi ketersediaan data perkawinan
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

    // STATUS VERIFIKASI BERDASARKAN ROLE
    let newCatatanAdmin = { ...existingCatatan };

    if (status_verifikasi === "Ditolak") {
      if (target_sisi === "suami" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_suami = catatan_admin;
      }
      if (target_sisi === "istri" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_istri = catatan_admin;
      }
      newCatatanAdmin.status_verifikasi_perceraian = `Usulan draft perceraian ditolak oleh ${user_role}.`;
    } else if (status_verifikasi === "Disetujui") {
      let catatanOtomatis = `Usulan draft perceraian telah disetujui dan diverifikasi oleh ${user_role}.`;
      
      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
        if (target_sisi === "suami" || target_sisi === "super_admin") {
          newCatatanAdmin.catatan_desa_suami = catatanOtomatis;
        }
        if (target_sisi === "istri" || target_sisi === "super_admin") {
          newCatatanAdmin.catatan_desa_istri = catatanOtomatis;
        }
      } else {
        newCatatanAdmin.catatan_desa_suami = catatanOtomatis;
        newCatatanAdmin.catatan_desa_istri = catatanOtomatis;
      }
      newCatatanAdmin.status_verifikasi_perceraian = `Perceraian telah diverifikasi dan disetujui oleh ${user_role}.`;
    } 

    newCatatanAdmin.last_updated_by = nama_desa_operator;

    // CASE 1: PENGAJUAN DATA PERCERAIAN DITOLAK
    if (status_verifikasi === "Ditolak") {
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

    // CASE 2: PENGAJUAN DATA PERCERAIAN DISETUJUI
    const existingChanges = perkawinan.data_perubahan || {};
    const drafCerai = existingChanges.PERCERAIAN;

    // inisialisasi atau mengambil flag persetujuan dari objek draft JSONB
    let approvedSuami = drafCerai.is_approved_desa_suami || false;
    let approvedIstri = drafCerai.is_approved_desa_istri || false;

    if (target_sisi === "suami" || target_sisi === "super_admin") {
      approvedSuami = true;
    }
    if (target_sisi === "istri" || target_sisi === "super_admin") {
      approvedIstri = true;
    }

    // SKENARIO A: Persetujuan Parsial Kawin Pade Gelahang
    if (perkawinan.jenis_perkawinan === "Pade Gelahang" && (!approvedSuami || !approvedIstri)) {
      const perkawinanParsial = await perkawinan.update({
        data_perubahan: {
          ...existingChanges,
          PERCERAIAN: {
            ...drafCerai,
            is_approved_desa_suami: approvedSuami,
            is_approved_desa_istri: approvedIstri,
            updated_at: new Date()
          }
        },
        catatan_admin_desa: {
          ...newCatatanAdmin,
          status_verifikasi_perceraian: `Usulan draft perceraian telah diverifikasi dan disetujui oleh ${nama_desa_operator}. Menunggu verifikasi dari Admin Desa Pasangan.`
        }
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERSETUJUAN_CERAI_PARSIAL", 
        data: perkawinanParsial 
      };
    }

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

    const perkawinanSah = await hasilMutasiFisik.data_perkawinan.update({
      catatan_admin_desa: {
        ...hasilMutasiFisik.data_perkawinan.catatan_admin_desa,
        ...newCatatanAdmin
      }
    }, { transaction: t });

    await t.commit();
    return { 
      type: "PERSETUJUAN_CERAI_PENUH", 
      data: perkawinanSah 
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};