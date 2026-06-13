import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  RiwayatPeranAdat,
  Keluarga
} from "../models/associations.js";
import { 
  buatKeluargaBali, 
  tutupKeluargaAktif
} from "./keluarga.service.js";
import { mappingAturanAdatBali } from "./decision-tree.service.js";
import { simpanRiwayatPeranAdat } from "./riwayat-peran-adat.service.js";
import { tutupKeluargaAngkat } from "./keluarga-angkat.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";

export const buatPerkawinanBali = async ({
  suami_id,
  istri_id,
  status_perkawinan,
  jenis_perkawinan,
  tanggal_perkawinan,
  user_id,
  user_role,
  user_desa_id
}) => {
  // Mulai transaksi database
  const t = await db.transaction();
  
  try {
    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(suami_id, { 
        include: [{ association: "wilayah_adat" }],
        transaction: t 
      }),
      KramaBali.findByPk(istri_id, { 
        include: [{ association: "wilayah_adat" }],
        transaction: t 
      })
    ]);

    if (!suami || !istri) {
      throw new Error("Data suami atau istri tidak ditemukan.");
    }

    if (suami.jenis_kelamin !== "Laki-laki") {
      throw new Error("Posisi Suami harus berjenis kelamin Laki-laki!");
    }

    if (istri.jenis_kelamin !== "Perempuan") {
      throw new Error("Posisi Istri harus berjenis kelamin Perempuan!");
    }

    if (!tanggal_perkawinan) {
      throw new Error("Tanggal perkawinan wajib diisi!");
    }

    // =================================================
    // KONDISI 1: Tidak Boleh Ada Perkawinan Poliandri
    // =================================================
    const perkawinanIstriAktif = await Perkawinan.findOne({
      where: {
        istri_id,
        status_perkawinan: "Kawin"
      },
      transaction: t
    });

    if (perkawinanIstriAktif) {
      throw new Error("Calon istri masih berstatus kawin dalam perkawinan lain.");
    }

    // ===================================================================
    // KONDISI 2: Perkawinan Poligami Adat Bali
    // ====================================================================
    let isPoligami = false;

    const perkawinanSuamiAktif = await Perkawinan.findOne({
      where: {
        suami_id,
        status_perkawinan: "Kawin"
      },
      transaction: t
    });

    // Memastikan status peran adat sebelumnya adalah Purusa
    if (perkawinanSuamiAktif) {
      const perkawinanPertama = await Perkawinan.findOne({
        where: { suami_id },
        order: [["tanggal_perkawinan", "ASC"]],
        transaction: t
      });

      const statusPurusaPertama = await RiwayatPeranAdat.findOne({
        where: {
          krama_id: suami_id,
          status_peran_adat: "Purusa",
          mulai_tanggal: perkawinanPertama.tanggal_perkawinan
        },
        transaction: t
      });
      
      if (!statusPurusaPertama) {
        throw new Error("Krama ini tidak dapat melakukan poligami karena tidak berstatus purusa pada perkawinan pertamanya.");
      }

      isPoligami = true;
    }

    // MENETUKAN STATUS APPROVAL AWAL BERDASARKAN ROLE
    const isSuperAdmin = user_role === "Super Admin";
    const isAdminDesa = user_role === "Admin Desa";

    let statusVerifikasi = "Draft";
    let approvedSuami = false;
    let approvedIstri = false;
    let namaDesaOperator = `Admin Desa ${user_desa_id}`;

    if (isSuperAdmin) {
      if (suami.status_verifikasi === "Draft" || istri.status_verifikasi === "Draft") {
        throw new Error("Proses verifikasi dihentikan! Mohon verifikasi data krama kedua mempelai terlebih dahulu.");
      }
      statusVerifikasi = "Disetujui";
      approvedSuami = true;
      approvedIstri = true;
    } else if (isAdminDesa) {
      if (suami.status_verifikasi === "Draft" || istri.status_verifikasi === "Draft") {
        throw new Error("Proses verifikasi dihentikan! Mohon verifikasi data krama kedua mempelai terlebih dahulu.");
      }

      if (suami.desa_adat_id === user_desa_id) {
        approvedSuami = true;
        if (suami.wilayah_adat?.nama_desa_adat) {
          namaDesaOperator = suami.wilayah_adat.nama_desa_adat;
        }
      }
      if (istri.desa_adat_id === user_desa_id) {
        approvedIstri = true;
        if (istri.wilayah_adat?.nama_desa_adat) {
          namaDesaOperator = istri.wilayah_adat.nama_desa_adat;
        }
      }

      if (jenis_perkawinan !== "Pade Gelahang") {
        statusVerifikasi = "Disetujui";
        approvedSuami = true;
        approvedIstri = true;
      } else {
        if (approvedSuami && approvedIstri) {
          statusVerifikasi = "Disetujui";
        }
      }
    }

    // MENYUSUN STRUKTUR JSONB UNTUK CATATAN ADMIN DESA
    let catatanAdmin = {};

    if (isSuperAdmin) {
      catatanAdmin = {
        catatan_desa_suami: "Data perkawinan diverifikasi otomatis oleh sistem (Input by Super Admin).",
        catatan_desa_istri: "Data perkawinan diverifikasi otomatis oleh sistem (Input by Super Admin).",
        last_updated_by: "Super Admin"
      };
    } else if (isAdminDesa) {
      catatanAdmin = {
        catatan_desa_suami: suami.desa_adat_id === user_desa_id 
          ? "Data perkawinan diverifikasi otomatis oleh sistem (Input by Admin Desa Suami)." 
          : (jenis_perkawinan !== "Pade Gelahang" 
              ? "Data Perkawinan diverifikasi otomatis oleh sistem (Mengikuti Admin Desa Purusa)." 
              : "Menunggu verifikasi Admin Desa Suami."),
        catatan_desa_istri: istri.desa_adat_id === user_desa_id 
          ? "Data perkawinan diverifikasi otomatis oleh sistem (Input by Admin Desa Istri)." 
          : (jenis_perkawinan !== "Pade Gelahang" 
              ? "Data Perkawinan diverifikasi otomatis oleh sistem (Mengikuti Admin Desa Purusa)." 
              : "Menunggu verifikasi Admin Desa Istri."),
        last_updated_by: namaDesaOperator
      };
    } else {
      catatanAdmin = {
        catatan_desa_suami: "Menunggu verifikasi Admin Desa Suami.",
        catatan_desa_istri: "Menunggu verifikasi Admin Desa Istri.",
        last_updated_by: "Sistem (Input by Krama)"
      };
    }

    const statusPerkawinanValid = status_perkawinan || "Kawin";

    // Validasi untuk mencegah duplikasi perkawinan aktif dengan pasangan yang sama
    const perkawinanSamaAktif = await Perkawinan.findOne({
      where: {
        status_perkawinan: "Kawin",
        [Op.and]: [
          {
            [Op.or]: [
              { suami_id: suami_id },
              { istri_id: suami_id }
            ]
          },
          {
            [Op.or]: [
              { suami_id: istri_id },
              { istri_id: istri_id }
            ]
          }
        ]
      },
      transaction: t
    });

    if (perkawinanSamaAktif) {
      if (perkawinanSamaAktif.status_verifikasi === "Draft") {
        throw new Error("Pendaftaran perkawinan pasangan ini sudah ada dan sedang menunggu verifikasi Admin Desa!");
      }
      throw new Error("Perkawinan antara kedua krama ini sudah terdaftar dan berstatus aktif!");
    }

    const perkawinan = await Perkawinan.create({
      suami_id,
      istri_id,
      status_perkawinan: statusPerkawinanValid,
      jenis_perkawinan,
      tanggal_perkawinan,
      user_id,
      status_verifikasi: statusVerifikasi,
      is_approved_desa_suami: approvedSuami,
      is_approved_desa_istri: approvedIstri,
      catatan_admin_desa: catatanAdmin
    }, { 
      transaction: t 
    });

    if (statusVerifikasi !== "Disetujui") {
      await t.commit();
      return { perkawinan };
    }

    // ==================================================
    // PROCESS: Mapping decision tree jika data disetujui
    // ==================================================
    await tutupKeluargaAngkat(suami_id, t);
    await tutupKeluargaAngkat(istri_id, t);

    const rolesMapping = await Promise.all([
      mappingAturanAdatBali("KAWIN", { 
        jenis_perkawinan, 
        posisi: "suami", 
        isPoligami: isPoligami 
      }, t),
      mappingAturanAdatBali("KAWIN", { 
        jenis_perkawinan, 
        posisi: "istri", 
        isPoligami: false 
      }, t)
    ]);

    const peranSuami = rolesMapping[0];
    const peranIstri = rolesMapping[1];

    if (!peranSuami || !peranIstri) {
      throw new Error("Status peran adat tidak dapat ditentukan.");
    }

    await Promise.all([
      simpanRiwayatPeranAdat({ 
        krama_id: suami_id, 
        jenis_perkawinan, 
        ...peranSuami, 
        event_date: tanggal_perkawinan 
      }, t),
      simpanRiwayatPeranAdat({ 
        krama_id: istri_id, 
        jenis_perkawinan, 
        ...peranIstri, 
        event_date: tanggal_perkawinan 
      }, t)
    ]);

    // ============================================
    // LOGIKA 1: PERKAWINAN BIASA dan NYENTANA
    // ============================================
    if (jenis_perkawinan !== "Pade Gelahang") {
      await tutupKeluargaAktif(istri_id, tanggal_perkawinan, t);

      if (!isPoligami) {
        await tutupKeluargaAktif(suami_id, tanggal_perkawinan, t);
      }

      // Menentukan status peran adat purusa dan predana
      const purusa = peranSuami.status_peran_adat === "Purusa" ? suami : istri;
      const predana = purusa.id === suami.id ? istri : suami;
      
      const keluarga = await buatKeluargaBali({
        kepala_keluarga_id: purusa.id,
        jenis_keluarga: jenis_perkawinan,
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: purusa.id,
        keluarga_id: keluarga.id,
        kedudukan: "Kepala Keluarga",
        dasar_keputusan: isPoligami
          ? "Kedudukan sebagai kepala keluarga pada perkawinan poligami diberikan dengan tetap mempertahankan kedudukan pada perkawinan sebelumnya."
          : "Kedudukan sebagai kepala keluarga diberikan karena krama ini berstatus purusa dalam perkawinannya.",
        event_date: tanggal_perkawinan,
        allow_multiple: isPoligami
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: predana.id,
        keluarga_id: keluarga.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini berstatus predana dalam perkawinannya.",
        event_date: tanggal_perkawinan
      }, t);

      await t.commit();
      return { perkawinan, keluarga };
    }

    // ========================================
    // LOGIKA 2: PERKAWINAN PADE GELAHANG
    // ========================================
    if (jenis_perkawinan === "Pade Gelahang") {
      await Promise.all([
        tutupKeluargaAktif(suami_id, tanggal_perkawinan, t),
        tutupKeluargaAktif(istri_id, tanggal_perkawinan, t)
      ]);

      const [keluargaSuami, keluargaIstri] = await Promise.all([
        buatKeluargaBali({ 
          kepala_keluarga_id: suami_id, 
          jenis_keluarga: "Pade Gelahang" 
        }, t),
        buatKeluargaBali({ 
          kepala_keluarga_id: istri_id, 
          jenis_keluarga: "Pade Gelahang" 
        }, t)
      ]);

      // Menyimpan riwayat keluarga untuk keluarga pihak suami
      await simpanRiwayatKeluarga({
        krama_id: suami_id,
        keluarga_id: keluargaSuami.id,
        kedudukan: "Kepala Keluarga",
        dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
        event_date: tanggal_perkawinan,
        allow_multiple: true
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: istri_id,
        keluarga_id: keluargaSuami.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga suaminya pada perkawinan pade gelahang.",
        event_date: tanggal_perkawinan,
        allow_multiple: true
      }, t);

      // Menyimpan riwayat keluarga untuk keluarga pihak istri
      await simpanRiwayatKeluarga({
        krama_id: istri_id,
        keluarga_id: keluargaIstri.id,
        kedudukan: "Kepala Keluarga",
        dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
        event_date: tanggal_perkawinan,
        allow_multiple: true
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: suami_id,
        keluarga_id: keluargaIstri.id,
        kedudukan: "Anggota",
        dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga istrinya pada perkawinan pade gelahang.",
        event_date: tanggal_perkawinan,
        allow_multiple: true
      }, t);

      await t.commit();
      
      return {
        perkawinan,
        keluarga_suami: keluargaSuami,
        keluarga_istri: keluargaIstri
      };
    }
  } catch (error) {
    await t.rollback();
    throw error;
  }
};