import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  RiwayatPeranAdat,
  RiwayatKeluarga,
  Keluarga
} from "../models/associations.js";
import { buatPerkawinanBali } from "./perkawinan.service.js";
import { integrasiPerkawinanLeluhur } from "./perkawinan-leluhur.service.js";
import { prosesPerceraianBali } from "./perceraian.service.js";

export const verifikasiUpdateDataPerkawinan = async ({
  perkawinan_id,
  tipe_update,
  status_verifikasi,
  catatan_admin,
  user_id,            
  user_role,          
  user_desa_id,
  target_sisi,
  nama_desa_operator
}) => {
  if (tipe_update !== "PERKAWINAN" && tipe_update !== "PERCERAIAN") {
    throw new Error("Parameter tipe update tidak valid!");
  }

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

    const draftKey = `UPDATE_${tipe_update}`;

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.[draftKey]) {
      throw new Error(`Data perkawinan ini tidak memiliki usulan draft perubahan data ${tipe_update.toLowerCase()} yang aktif.`);
    }

    const existingChanges = perkawinan.data_perubahan || {};
    let subDraftUpdate = existingChanges[draftKey];

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    const operatorIdentity = user_role === "Admin Desa" ? `Admin Desa ${user_desa_id}` : user_role;

    // DATA PERUBAHAN DITOLAK
    if (status_verifikasi === "Ditolak") {
      if (target_sisi === "suami" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_suami = `Usulan perubahan data ${tipe_update.toLowerCase()} ditolak: ${catatan_admin}`;
      }
      if (target_sisi === "istri" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_istri = `Usulan perubahan data ${tipe_update.toLowerCase()} ditolak: ${catatan_admin}`;
      }
      newCatatanAdmin.status_verifikasi_update = `Usulan perubahan data ${tipe_update.toLowerCase()} ditolak oleh ${user_role}.`;
      newCatatanAdmin.last_updated_by = operatorIdentity;

      const perkawinanDitolak = await perkawinan.update({
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PENOLAKAN_UPDATE", 
        data: perkawinanDitolak 
      };
    }

    // DATA PERUBAHAN DISETUJUI
    let approvedSuami = subDraftUpdate.is_approved_desa_suami || false;
    let approvedIstri = subDraftUpdate.is_approved_desa_istri || false;

    if (target_sisi === "suami" || target_sisi === "super_admin") {
      approvedSuami = true;
    }
    if (target_sisi === "istri" || target_sisi === "super_admin") {
      approvedIstri = true;
    }

    // SKENARIO A: Persetujuan Parsial Kawin Pade Gelahang
    if (perkawinan.jenis_perkawinan === "Pade Gelahang" && (!approvedSuami || !approvedIstri)) {
      subDraftUpdate.is_approved_desa_suami = approvedSuami;
      subDraftUpdate.is_approved_desa_istri = approvedIstri;
      subDraftUpdate.updated_at = new Date();

      const perkawinanParsial = await perkawinan.update({
        data_perubahan: {
          ...existingChanges,
          [draftKey]: subDraftUpdate
        },
        catatan_admin_desa: {
          ...newCatatanAdmin,
          status_verifikasi_update: `Usulan perubahan data ${tipe_update.toLowerCase()} disetujui oleh ${nama_desa_operator}. Menunggu verifikasi dari Admin Desa Pasangannya.`,
          last_updated_by: operatorIdentity
        }
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERSETUJUAN_UPDATE_PARSIAL", 
        data: perkawinanParsial 
      };
    }

    // SKENARIO B: Persetujuan Kawin Biasa dan Nyentana
    const statusPerkawinanAwal = perkawinan.status_perkawinan;

    // rollback riwayat ketika perubahan data utama terjadi
    if (subDraftUpdate.is_perubahan_ekstrem) {
      await RiwayatPeranAdat.destroy({ 
        where: { perkawinan_id: perkawinan.id }, 
        transaction: t 
      });
      await RiwayatKeluarga.destroy({ 
        where: { perkawinan_id: perkawinan.id }, 
        transaction: t 
      });

      await Keluarga.destroy({ 
        where: { 
          kepala_keluarga_id: perkawinan.suami_id, 
          jenis_keluarga: perkawinan.jenis_perkawinan 
        }, 
        transaction: t 
      });

      const tglMurniPerkawinan = perkawinan.tanggal_perkawinan.split(' ')[0];
      const rentangHariPerkawinan = {
        [db.Sequelize.Op.between]: [`${tglMurniPerkawinan} 00:00:00`, `${tglMurniPerkawinan} 23:59:59`]
      };

      await RiwayatKeluarga.update(
        { akhir_masuk: null },
        { where: { 
            krama_id: [perkawinan.suami_id, perkawinan.istri_id], 
            akhir_masuk: rentangHariPerkawinan 
          }, 
          transaction: t 
        }
      );
    }

    // mutasi data perubahan ke tabel utama
    newCatatanAdmin.status_verifikasi_update = `Perubahan data ${tipe_update.toLowerCase()} telah diverifikasi dan disahkan oleh ${user_role}.`;
    newCatatanAdmin.last_updated_by = operatorIdentity;

    if (tipe_update === "PERKAWINAN") {
      const tglPerkawinanMurni = subDraftUpdate.tanggal_perkawinan.split('T')[0].split(' ')[0];

      await perkawinan.update({
        suami_id: subDraftUpdate.suami_id,
        istri_id: subDraftUpdate.istri_id,
        tanggal_perkawinan: tglPerkawinanMurni,
        jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });
    } else if (tipe_update === "PERCERAIAN") {
      const tanggalCeraiLama = perkawinan.tanggal_cerai;
      const tglCeraiMurni = subDraftUpdate.tanggal_cerai.split('T')[0].split(' ')[0];

      await perkawinan.update({
        tanggal_cerai: tglCeraiMurni,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        pihak_meninggal: subDraftUpdate.pihak_meninggal,
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      // sinkronisasi pergeseran linimasa riwayat cerai
      if (subDraftUpdate.is_pergeseran_tanggal && tanggalCeraiLama !== tanggalCeraiBaru) {
        const jamSekarang = new Date().toTimeString().split(' ')[0];
        const tglCeraiBaruDateTime = `${tglCeraiMurni} ${jamSekarang}`;

        const rentangHariCeraiLama = {
          [db.Sequelize.Op.between]: [`${tanggalCeraiLama} 00:00:00`, `${tanggalCeraiLama} 23:59:59`]
        };

        await RiwayatPeranAdat.update(
          { mulai_tanggal: tglCeraiBaruDateTime },
          { where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, transaction: t }
        );
        await RiwayatPeranAdat.update(
          { selesai_tanggal: tglCeraiBaruDateTime },
          { where: { 
            perkawinan_id: perkawinan.id, 
            selesai_tanggal: tanggalCeraiLama 
          }, transaction: t }
        );
        await RiwayatKeluarga.update(
          { awal_masuk: tglCeraiBaruDateTime },
          { where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, transaction: t }
        );
        await RiwayatKeluarga.update(
          { akhir_masuk: tglCeraiBaruDateTime },
          { where: { 
            perkawinan_id: perkawinan.id, 
            akhir_masuk: tglCeraiBaruDateTime 
          }, transaction: t }
        );
      }
    }

    // eksekusi perubahan menggunakan service
    if (subDraftUpdate.is_perubahan_ekstrem && tipe_update === "PERKAWINAN") {
      const [suamiBaru, istriBaru] = await Promise.all([
        KramaBali.findByPk(perkawinan.suami_id, { 
          transaction: t 
        }),
        KramaBali.findByPk(perkawinan.istri_id, { 
          transaction: t 
        })
      ]);

      if (suamiBaru.tipe_data === "Leluhur" || istriBaru.tipe_data === "Leluhur") {
        await integrasiPerkawinanLeluhur({
          suami_id: perkawinan.suami_id,
          istri_id: perkawinan.istri_id,
          status_perkawinan: perkawinan.status_perkawinan,
          jenis_perkawinan: perkawinan.jenis_perkawinan,
          tanggal_perkawinan: perkawinan.tanggal_perkawinan,
          user_id,
          user_role,
          user_desa_id,
          nama_desa_operator: operatorIdentity
        }, t);
      } else {
        await buatPerkawinanBali({
          suami_id: perkawinan.suami_id,
          istri_id: perkawinan.istri_id,
          status_perkawinan: "Kawin", 
          jenis_perkawinan: perkawinan.jenis_perkawinan,
          tanggal_perkawinan: perkawinan.tanggal_perkawinan,
          user_id,
          user_role,
          user_desa_id
        }, t);

        if (statusPerkawinanAwal !== "Kawin") {
          await prosesPerceraianBali({
            perkawinan_id: perkawinan.id,
            status_perkawinan: statusPerkawinanAwal,
            tanggal_cerai: perkawinan.tanggal_cerai || perkawinan.tanggal_perkawinan,
            pihak_meninggal: perkawinan.pihak_meninggal,
            pilihan_predana: subDraftUpdate.pilihan_predana || null,
            user_id,
            user_role,
            user_desa_id
          }, t);
        }
      }
    }

    await t.commit();
    return { 
      type: "PERSETUJUAN_UPDATE_PENUH", 
      data: perkawinan 
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};