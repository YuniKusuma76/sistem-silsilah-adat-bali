import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  RiwayatPeranAdat
} from "../models/associations.js";
import {
  buatKeluargaBali,
  buatKeluargaLeluhur,
  tutupKeluargaAktif
} from "./keluarga.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";
import { simpanRiwayatPeranAdat } from "./riwayat-peran-adat.service.js";
import { tutupKeluargaAngkat } from "./keluarga-angkat.service.js";
import { mappingAturanAdatBali } from "./decision-tree.service.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const eksekusiVerifikasiPerkawinan = async ({
  perkawinan_id,
  status_verifikasi,
  catatan_admin,
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

    const { 
      suami_id, 
      istri_id, 
      jenis_perkawinan, 
      tanggal_perkawinan 
    } = perkawinan;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    const finalTanggalPerkawinan = tanggal_perkawinan || new Date().toISOString().split('T')[0];
    const infoTambahanDasar = !tanggal_perkawinan ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perkawinan kosong)." : "";
    
    // STATUS VERIFIKASI BERDASARKAN ROLE
    let newCatatanAdmin = { ...existingCatatan };

    if (status_verifikasi === "Ditolak") {
      if (target_sisi === "suami" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_suami = catatan_admin;
      }
      if (target_sisi === "istri" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_istri = catatan_admin;
      }
    } else if (status_verifikasi === "Disetujui") {
      let catatanOtomatis = `Data perkawinan telah diverifikasi oleh ${user_role}.`;
      
      if (jenis_perkawinan === "Pade Gelahang") {
        catatanOtomatis = `Data perkawinan pade gelahang telah diverifikasi oleh ${user_role}.`;

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
    } 

    newCatatanAdmin.last_updated_by = nama_desa_operator;

    // CASE 1: PENGAJUAN DATA PERKAWINAN DITOLAK
    if (status_verifikasi === "Ditolak") {
      const perkawinanDitolak = await perkawinan.update({
        status_verifikasi: "Ditolak",
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PENOLAKAN", 
        data: perkawinanDitolak 
      };
    }

    // CASE 2: PENGAJUAN DATA PERKAWINAN DISETUJUI
    let approvedSuami = perkawinan.is_approved_desa_suami;
    let approvedIstri = perkawinan.is_approved_desa_istri;

    if (target_sisi === "suami" || target_sisi === "super_admin") {
      approvedSuami = true;
    }
    if (target_sisi === "istri" || target_sisi === "super_admin") {
      approvedIstri = true;
    }

    // SKENARIO A: Persetujuan Parsial Kawin Pade Gelahang
    if (perkawinan.jenis_perkawinan === "Pade Gelahang" && (!approvedSuami || !approvedIstri)) {
      const perkawinanParsial = await perkawinan.update({
        is_approved_desa_suami: approvedSuami,
        is_approved_desa_istri: approvedIstri,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PADE_GELAHANG_PARSIAL", 
        data: perkawinanParsial 
      };
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(suami_id, { 
        transaction: t 
      }),
      KramaBali.findByPk(istri_id, { 
        transaction: t 
      })
    ]);

    // PROSES 1: Jalur Integrasi Perkawinan Leluhur
    if (suami.tipe_data === "Leluhur" || istri.tipe_data === "Leluhur") {
      const keluargaLeluhur = await buatKeluargaLeluhur({ 
        kepala_keluarga_id: suami_id 
      }, t);

      await Promise.all([
        simpanRiwayatKeluarga({
          krama_id: suami_id,
          keluarga_id: keluargaLeluhur.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Kepala Keluarga",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan karena krama ini merupakan penerus garis keturunan untuk keluarganya.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: true
        }, t),
        simpanRiwayatKeluarga({
          krama_id: istri_id,
          keluarga_id: keluargaLeluhur.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Anggota",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini tercatat sebagai istri dalam catatan Trah Bali.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: true
        }, t)
      ]);

      const perkawinanLeluhur = await perkawinan.update({
        status_verifikasi: "Disetujui", 
        is_approved_desa_suami: true, 
        is_approved_desa_istri: true,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERKAWINAN_LELUHUR", 
        data: perkawinanLeluhur 
      };
    }

    // PROSES 2: Jalur Integrasi Perkawinan Keturunan
    let isPoligami = false;

    const kawinPoligami = await Perkawinan.findOne({
      where: {
        suami_id,
        status_perkawinan: "Kawin",
        id: { [db.Sequelize.Op.ne]: perkawinan_id }
      },
      transaction: t
    });

    // memastikan status peran adat sebelumnya adalah Purusa
    if (kawinPoligami) {
      const perkawinanPertama = await Perkawinan.findOne({
        where: { 
          suami_id,
          id: { [db.Sequelize.Op.ne]: perkawinan_id } 
        },
        order: [["tanggal_perkawinan", "ASC"]],
        transaction: t
      });

      const statusPurusaPertama = await RiwayatPeranAdat.findOne({
        where: {
          krama_id: suami_id,
          status_peran_adat: "Purusa",
          perkawinan_id: perkawinanPertama.id 
        },
        transaction: t
      });
      
      if (!statusPurusaPertama) {
        throw new Error("Krama ini tidak dapat melakukan poligami karena tidak berstatus purusa pada perkawinan pertamanya.");
      }

      isPoligami = true;
    }

    await Promise.all([
      tutupKeluargaAngkat({ krama_id: suami_id, t }),
      tutupKeluargaAngkat({ krama_id: istri_id, t })
    ]);

    // Mapping decision tree untuk menentukan status peran adat
    const [peranSuami, peranIstri] = await Promise.all([
      mappingAturanAdatBali("KAWIN", { 
        jenis_perkawinan, 
        posisi: "suami", 
        isPoligami 
      }, t),
      mappingAturanAdatBali("KAWIN", { 
        jenis_perkawinan, 
        posisi: "istri", 
        isPoligami: false 
      }, t)
    ]);

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

    // KONDISI 1: Perkawinan Biasa dan Nyentana
    if (jenis_perkawinan !== "Pade Gelahang") {
      await tutupKeluargaAktif({ 
        kepala_keluarga_id: istri_id, 
        event_date: finalTanggalPerkawinan, t 
      });

      if (!isPoligami) {
        await tutupKeluargaAktif({ 
          kepala_keluarga_id: suami_id, 
          event_date: finalTanggalPerkawinan, t 
        });
      }

      // menentukan status peran adat purusa dan predana
      const purusa = peranSuami.status_peran_adat === "Purusa" ? suami : istri;
      const predana = purusa.id === suami.id ? istri : suami;
      
      const keluarga = await buatKeluargaBali({
        kepala_keluarga_id: purusa.id,
        jenis_keluarga: jenis_perkawinan,
      }, t);

      await Promise.all([
        simpanRiwayatKeluarga({
          krama_id: purusa.id,
          keluarga_id: keluarga.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Kepala Keluarga",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: isPoligami
            ? "Kedudukan sebagai kepala keluarga pada perkawinan poligami diberikan dengan tetap mempertahankan kedudukan pada perkawinan sebelumnya."
            : "Kedudukan sebagai kepala keluarga diberikan karena krama ini berstatus purusa dalam perkawinannya.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: isPoligami
        }, t),
        simpanRiwayatKeluarga({
          krama_id: predana.id,
          keluarga_id: keluarga.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Anggota",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini berstatus predana dalam perkawinannya.",
          event_date: finalTanggalPerkawinan
        }, t)
      ]);

      const perkawinanUmum = await perkawinan.update({
        status_verifikasi: "Disetujui", 
        is_approved_desa_suami: true, 
        is_approved_desa_istri: true, 
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERKAWINAN_AKTIF", 
        data: perkawinanUmum
      };
    }
    // KONDISI 2: Perkawinan Pade Gelahang
    else {
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

      await Promise.all([
        // Menyimpan riwayat keluarga untuk keluarga pihak suami
        simpanRiwayatKeluarga({
          krama_id: suami_id,
          keluarga_id: keluargaSuami.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Kepala Keluarga",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: true
        }, t),
        simpanRiwayatKeluarga({
          krama_id: istri_id,
          keluarga_id: keluargaSuami.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Anggota",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga suaminya pada perkawinan pade gelahang.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: true
        }, t),
        // Menyimpan riwayat keluarga untuk keluarga pihak istri
        simpanRiwayatKeluarga({
          krama_id: istri_id,
          keluarga_id: keluargaIstri.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Kepala Keluarga",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: true
        }, t),
        simpanRiwayatKeluarga({
          krama_id: suami_id,
          keluarga_id: keluargaIstri.id,
          perkawinan_id: perkawinan.id,
          kedudukan: "Anggota",
          kategori_event: "KAWIN",
          bobot_event: BOBOT_EVENT["KAWIN"],
          dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga istrinya pada perkawinan pade gelahang.",
          event_date: finalTanggalPerkawinan,
          allow_multiple: true
        }, t)
      ]);

      const perkawinanUnik = await perkawinan.update({
        status_verifikasi: "Disetujui", 
        is_approved_desa_suami: true, 
        is_approved_desa_istri: true, 
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERKAWINAN_PADE_GELAHANG", 
        data: perkawinanUnik 
      };
    }
  } catch (error) {
    await t.rollback();
    throw error;
  }
};