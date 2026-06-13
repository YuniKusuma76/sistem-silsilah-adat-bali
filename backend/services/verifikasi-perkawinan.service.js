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

    // Mengelola catatan admin desa JSONB
    const existingCatatan = perkawinan.catatan_admin_desa || {};
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

    // CASE 1: Pengajuan data perkawinan Ditolak
    if (status_verifikasi === "Ditolak") {
      const perkawinanDitolak = await perkawinan.update({
        status_verifikasi: "Ditolak",
        catatan_admin_desa: newCatatanAdmin
      }, { 
        transaction: t 
      });

      await t.commit();
      return { 
        type: "PENOLAKAN", 
        data: perkawinanDitolak 
      };
    }

    // CASE 2: Pengajuan data perkawinan Disetujui
    let approvedSuami = perkawinan.is_approved_desa_suami;
    let approvedIstri = perkawinan.is_approved_desa_istri;

    if (target_sisi === "suami" || target_sisi === "super_admin") {
      approvedSuami = true;
    }
    if (target_sisi === "istri" || target_sisi === "super_admin") {
      approvedIstri = true;
    }

    // Skenario persetujuan parsial kawin pade gelahang
    if (perkawinan.jenis_perkawinan === "Pade Gelahang" && (!approvedSuami || !approvedIstri)) {
      const perkawinanParsial = await perkawinan.update({
        is_approved_desa_suami: approvedSuami,
        is_approved_desa_istri: approvedIstri,
        catatan_admin_desa: newCatatanAdmin
      }, { 
        transaction: t 
      });

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

    // PROSES 1: Jalur integrasi perkawinan Leluhur
    if (suami.tipe_data === "Leluhur" || istri.tipe_data === "Leluhur") {
      const keluargaLeluhur = await buatKeluargaLeluhur({ 
        kepala_keluarga_id: suami_id 
      }, t);

      await Promise.all([
        simpanRiwayatKeluarga({
          krama_id: suami_id,
          keluarga_id: keluargaLeluhur.id,
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan karena krama ini merupakan penerus garis keturunan untuk keluarganya.",
          event_date: tanggal_perkawinan,
          allow_multiple: true
        }, t),
        simpanRiwayatKeluarga({
          krama_id: istri_id,
          keluarga_id: keluargaLeluhur.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini tercatat sebagai istri dalam catatan Trah Bali.",
          event_date: tanggal_perkawinan,
          allow_multiple: true
        }, t)
      ]);

      const perkawinanLeluhur = await perkawinan.update({
        status_verifikasi: "Disetujui", 
        is_approved_desa_suami: true, 
        is_approved_desa_istri: true,
        catatan_admin_desa: newCatatanAdmin
      }, {
        transaction: t
      });

      await t.commit();
      return { 
        type: "PERKAWINAN_LELUHUR", 
        data: perkawinanLeluhur 
      };
    }

    // PROSES 2: Jalur integrasi perkawinan Keturunan
    let isPoligami = false;

    const kawinPoligami = await Perkawinan.findOne({
      where: {
        suami_id,
        status_perkawinan: "Kawin",
        id: { 
          [db.Sequelize.Op.ne]: perkawinan_id 
        }
      },
      transaction: t
    });

    // Memastikan status peran adat sebelumnya adalah Purusa
    if (kawinPoligami) {
      const perkawinanPertama = await Perkawinan.findOne({
        where: { 
          suami_id,
          id: { 
            [db.Sequelize.Op.ne]: perkawinan_id 
          } 
        },
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

    await Promise.all([
      tutupKeluargaAngkat(suami_id, t),
      tutupKeluargaAngkat(istri_id, t)
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

    // KONDISI 1: Perkawinan Biasa dan Nyentana
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

      await Promise.all([
        simpanRiwayatKeluarga({
          krama_id: purusa.id,
          keluarga_id: keluarga.id,
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: isPoligami
            ? "Kedudukan sebagai kepala keluarga pada perkawinan poligami diberikan dengan tetap mempertahankan kedudukan pada perkawinan sebelumnya."
            : "Kedudukan sebagai kepala keluarga diberikan karena krama ini berstatus purusa dalam perkawinannya.",
          event_date: tanggal_perkawinan,
          allow_multiple: isPoligami
        }, t),
        simpanRiwayatKeluarga({
          krama_id: predana.id,
          keluarga_id: keluarga.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Kedudukan sebagai anggota diberikan karena krama ini berstatus predana dalam perkawinannya.",
          event_date: tanggal_perkawinan
        }, t)
      ]);

      const perkawinanUmum = await perkawinan.update({
        status_verifikasi: "Disetujui", 
        is_approved_desa_suami: true, 
        is_approved_desa_istri: true, 
        catatan_admin_desa: newCatatanAdmin
      }, { 
        transaction: t 
      });

      await t.commit();
      return { 
        type: "PERKAWINAN_AKTIF", 
        data: perkawinanUmum
      };
    }
    // KONDISI 2: Perkawinan Pade Gelahang
    else {
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

      await Promise.all([
        // Menyimpan riwayat keluarga untuk keluarga pihak suami
        simpanRiwayatKeluarga({
          krama_id: suami_id,
          keluarga_id: keluargaSuami.id,
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
          event_date: tanggal_perkawinan,
          allow_multiple: true
        }, t),
        simpanRiwayatKeluarga({
          krama_id: istri_id,
          keluarga_id: keluargaSuami.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga suaminya pada perkawinan pade gelahang.",
          event_date: tanggal_perkawinan,
          allow_multiple: true
        }, t),
        // Menyimpan riwayat keluarga untuk keluarga pihak istri
        simpanRiwayatKeluarga({
          krama_id: istri_id,
          keluarga_id: keluargaIstri.id,
          kedudukan: "Kepala Keluarga",
          dasar_keputusan: "Kedudukan sebagai kepala keluarga diberikan kepada krama ini karena memiliki status purusa di keluarga orang tuanya pada perkawinan pade gelahang.",
          event_date: tanggal_perkawinan,
          allow_multiple: true
        }, t),
        simpanRiwayatKeluarga({
          krama_id: suami_id,
          keluarga_id: keluargaIstri.id,
          kedudukan: "Anggota",
          dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini karena memiliki status peran adat predana di keluarga istrinya pada perkawinan pade gelahang.",
          event_date: tanggal_perkawinan,
          allow_multiple: true
        }, t)
      ]);

      const perkawinanUnik = await perkawinan.update({
        status_verifikasi: "Disetujui", 
        is_approved_desa_suami: true, 
        is_approved_desa_istri: true, 
        catatan_admin_desa: newCatatanAdmin
      }, { 
        transaction: t 
      });

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