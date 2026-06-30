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

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const buatPerkawinanBali = async ({
  suami_id,
  istri_id,
  status_perkawinan,
  jenis_perkawinan,
  tanggal_perkawinan,
  user_id,
  user_role,
  user_desa_id,
  isUpdateMode = false
}, passedTransaction = null) => {
  // Mulai transaksi database atau transaksi yang lewat
  const isExternalTransaction = !!passedTransaction;
  const t = passedTransaction || await db.transaction();
  
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

    const jamSekarang = new Date().toTimeString().split(' ')[0];
    const finalTanggalPerkawinan = tanggal_perkawinan 
      ? new Date(`${tanggal_perkawinan} ${jamSekarang}`)
      : new Date();

    // TIDAK BOLEH ADA PERKAWINAN POLIANDRI
    if (!isUpdateMode) {
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
    }

    // PERKAWINAN POLIGAMI ADAT BALI
    let isPoligami = false;

    const perkawinanSuamiAktif = await Perkawinan.findOne({
      where: {
        suami_id,
        status_perkawinan: "Kawin"
      },
      transaction: t
    });

    // memastikan status peran adat sebelumnya adalah Purusa
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
          selesai_tanggal: null
        },
        transaction: t
      });
      
      if (!statusPurusaPertama && perkawinanPertama && perkawinanPertama.jenis_perkawinan === "Nyentana") {
        throw new Error("Krama ini tidak dapat melakukan poligami karena tidak berstatus purusa pada perkawinan pertamanya (Status Nyentana).");
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
    let alasanPaksaDraft = "";

    const kramaDraft = suami.status_verifikasi === "Draft" || istri.status_verifikasi === "Draft";

    if (isSuperAdmin) {
      if (kramaDraft) {
        statusVerifikasi = "Draft";
        alasanPaksaDraft = " (Data didraft karena ada data krama bali belum yang diverifikasi).";
      } else {
        statusVerifikasi = "Disetujui";
        approvedSuami = true;
        approvedIstri = true;
      }
    } else if (isAdminDesa) {
      // setting persetujuan sepihak berdasarkan desa adat
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
      // kondisi jika perkawinan lintas desa/data krama masih draft
      if (kramaDraft) {
        statusVerifikasi = "Draft";
        alasanPaksaDraft = " (Data perkawinan didraft karena data krama bali ada yang masih berstatus Draft).";
      } else {
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
    }

    // MENYUSUN STRUKTUR JSONB UNTUK CATATAN ADMIN DESA
    let catatanAdmin = {};

    if (isSuperAdmin) {
      catatanAdmin = {
        catatan_desa_suami: statusVerifikasi === "Draft" 
          ? "Menunggu verifikasi data krama bali dari Admin Desa." 
          : "Data perkawinan diverifikasi otomatis oleh sistem (Input by Super Admin).",
        catatan_desa_istri: statusVerifikasi === "Draft" 
          ? "Menunggu verifikasi data krama bali dari Admin Desa." 
          : "Data perkawinan diverifikasi otomatis oleh sistem (Input by Super Admin).",
        last_updated_by: "Super Admin"
      };
    } else if (isAdminDesa) {
      catatanAdmin = {
        catatan_desa_suami: suami.desa_adat_id === user_desa_id 
          ? `Data perkawinan diajukan oleh Admin Desa Suami${alasanPaksaDraft}`
          : (jenis_perkawinan !== "Pade Gelahang" 
              ? "Data Perkawinan diverifikasi otomatis oleh sistem (Mengikuti Admin Desa Purusa)." 
              : "Menunggu verifikasi dari Admin Desa Suami."),
        catatan_desa_istri: istri.desa_adat_id === user_desa_id 
          ? `Data perkawinan diajukan oleh Admin Desa Istri${alasanPaksaDraft}`
          : (jenis_perkawinan !== "Pade Gelahang" 
              ? "Data Perkawinan diverifikasi otomatis oleh sistem (Mengikuti Admin Desa Purusa)." 
              : "Menunggu verifikasi dari Admin Desa Istri."),
        last_updated_by: namaDesaOperator
      };
    } else {
      catatanAdmin = {
        catatan_desa_suami: "Menunggu verifikasi dari Admin Desa Suami.",
        catatan_desa_istri: "Menunggu verifikasi dari Admin Desa Istri.",
        last_updated_by: "Sistem (Input by Krama)"
      };
    }

    const statusPerkawinanValid = status_perkawinan || "Kawin";

    // Validasi duplikasi perkawinan aktif dengan pasangan yang sama
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
        throw new Error("Pendaftaran perkawinan pasangan ini sudah ada dan sedang menunggu verifikasi dari Admin Desa!");
      }
      throw new Error("Perkawinan antara kedua krama ini sudah terdaftar dan berstatus aktif!");
    }

    const perkawinan = await Perkawinan.create({
      suami_id,
      istri_id,
      status_perkawinan: statusPerkawinanValid,
      jenis_perkawinan,
      tanggal_perkawinan: tanggal_perkawinan || new Date().toISOString().split('T')[0],
      user_id,
      status_verifikasi: statusVerifikasi,
      is_approved_desa_suami: approvedSuami,
      is_approved_desa_istri: approvedIstri,
      catatan_admin_desa: catatanAdmin
    }, { transaction: t });

    if (statusVerifikasi !== "Disetujui") {
      if (!isExternalTransaction) {
        await t.commit();
      }
      return { perkawinan };
    }

    // ==================================================
    // PROCESS: Mapping decision tree jika data disetujui
    // ==================================================
    await tutupKeluargaAngkat({ krama_id: suami_id, t });
    await tutupKeluargaAngkat({ krama_id: istri_id, t });

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

    // menutup riwayat peran adat perkawinan pertama suami
    if (isPoligami) {
      await RiwayatPeranAdat.update(
        { selesai_tanggal: finalTanggalPerkawinan },
        {
          where: {
            krama_id: suami_id,
            selesai_tanggal: null,
            status_peran_adat: "Purusa"
          },
          transaction: t
        }
      );
    }

    const infoTambahanDasar = !tanggal_perkawinan ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perkawinan kosong)." : "";

    await Promise.all([
      simpanRiwayatPeranAdat({ 
        krama_id: suami_id,
        perkawinan_id: perkawinan.id, 
        jenis_perkawinan, 
        status_peran_adat: peranSuami.status_peran_adat,
        garis_keturunan: peranSuami.garis_keturunan,
        dasar_keputusan: peranSuami.dasar_keputusan + infoTambahanDasar,
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        event_date: finalTanggalPerkawinan 
      }, t),
      simpanRiwayatPeranAdat({ 
        krama_id: istri_id,
        perkawinan_id: perkawinan.id,
        jenis_perkawinan, 
        status_peran_adat: peranIstri.status_peran_adat,
        garis_keturunan: peranIstri.garis_keturunan,
        dasar_keputusan: peranIstri.dasar_keputusan + infoTambahanDasar,
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        event_date: finalTanggalPerkawinan 
      }, t)
    ]);

    // ============================================
    // LOGIKA 1: PERKAWINAN BIASA dan NYENTANA
    // ============================================
    if (jenis_perkawinan !== "Pade Gelahang") {
      await tutupKeluargaAktif({ 
        kepala_keluarga_id: istri_id, 
        event_date: finalTanggalPerkawinan, t 
      });

      let keluargaTarget = null;

      if (isPoligami) {
        keluargaTarget = await Keluarga.findOne({
          where: {
            kepala_keluarga_id: suami_id,
            status_keluarga: "Aktif"
          },
          transaction: t
        });

        if (!keluargaTarget) {
          throw new Error("Keluarga aktif untuk perkawinan pertama suami tidak ditemukan.");
        }
      } else {
        await tutupKeluargaAktif({ 
          kepala_keluarga_id: suami_id, 
          event_date: finalTanggalPerkawinan, t 
        });

        const purusaId = peranSuami.status_peran_adat === "Purusa" ? suami_id : istri_id;

        keluargaTarget = await buatKeluargaBali({
          kepala_keluarga_id: purusaId,
          jenis_keluarga: jenis_perkawinan
        }, t);
      }

      // Menentukan status peran adat purusa dan predana
      const purusa = peranSuami.status_peran_adat === "Purusa" ? suami : istri;
      const predana = purusa.id === suami.id ? istri : suami;
      
      await simpanRiwayatKeluarga({
        krama_id: purusa.id,
        keluarga_id: keluargaTarget.id,
        perkawinan_id: perkawinan.id,
        kedudukan: "Kepala Keluarga",
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        dasar_keputusan: isPoligami
          ? "Kedudukan sebagai kepala keluarga pada perkawinan poligami diberikan dengan tetap mempertahankan kedudukan pada perkawinan sebelumnya."
          : "Kedudukan sebagai kepala keluarga diberikan karena krama ini berstatus purusa dalam perkawinannya.",
        event_date: finalTanggalPerkawinan,
        allow_multiple: isPoligami
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: predana.id,
        keluarga_id: keluargaTarget.id,
        perkawinan_id: perkawinan.id,
        kedudukan: "Anggota",
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        dasar_keputusan: isPoligami
          ? "Kedudukan sebagai anggota diberikan kepada istri berikutnya untuk masuk ke dalam keluarga purusa suami karena terlibat perkawinan poligami."
          : "Kedudukan sebagai anggota diberikan karena krama ini berstatus predana dalam perkawinannya.",
        event_date: finalTanggalPerkawinan
      }, t);

      if (!isExternalTransaction) {
        await t.commit();
      }
      return { 
        perkawinan, 
        keluarga: keluargaTarget 
      };
    }

    // ========================================
    // LOGIKA 2: PERKAWINAN PADE GELAHANG
    // ========================================
    if (jenis_perkawinan === "Pade Gelahang") {
      await Promise.all([
        tutupKeluargaAktif({ 
          kepala_keluarga_id: suami_id, 
          event_date: finalTanggalPerkawinan, t 
        }),
        tutupKeluargaAktif({ 
          kepala_keluarga_id: istri_id, 
          event_date: finalTanggalPerkawinan, t 
        })
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
        perkawinan_id: perkawinan.id,
        kedudukan: "Kepala Keluarga",
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
        event_date: finalTanggalPerkawinan,
        allow_multiple: true
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: istri_id,
        keluarga_id: keluargaSuami.id,
        perkawinan_id: perkawinan.id,
        kedudukan: "Anggota",
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga suaminya pada perkawinan pade gelahang.",
        event_date: finalTanggalPerkawinan,
        allow_multiple: true
      }, t);

      // Menyimpan riwayat keluarga untuk keluarga pihak istri
      await simpanRiwayatKeluarga({
        krama_id: istri_id,
        keluarga_id: keluargaIstri.id,
        perkawinan_id: perkawinan.id,
        kedudukan: "Kepala Keluarga",
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
        event_date: finalTanggalPerkawinan,
        allow_multiple: true
      }, t);

      await simpanRiwayatKeluarga({
        krama_id: suami_id,
        keluarga_id: keluargaIstri.id,
        perkawinan_id: perkawinan.id,
        kedudukan: "Anggota",
        kategori_event: "KAWIN",
        bobot_event: BOBOT_EVENT["KAWIN"],
        dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga istrinya pada perkawinan pade gelahang.",
        event_date: finalTanggalPerkawinan,
        allow_multiple: true
      }, t);

      if (!isExternalTransaction) {
        await t.commit();
      }
      
      return {
        perkawinan,
        keluarga_suami: keluargaSuami,
        keluarga_istri: keluargaIstri
      };
    }
  } catch (error) {
    if (!isExternalTransaction) {
      await t.rollback();
    }
    throw error;
  }
};