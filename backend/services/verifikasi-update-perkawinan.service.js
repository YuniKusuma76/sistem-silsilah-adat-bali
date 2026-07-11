import { Op } from "sequelize";
import db from "../config/db.config.js";
import { 
  Perkawinan, 
  KramaBali, 
  User, 
  RiwayatPeranAdat, 
  RiwayatKeluarga,
  Keluarga,
  RelasiKrama
} from "../models/associations.js";
import { buatPerkawinanBali } from "./perkawinan.service.js";
import { integrasiPerkawinanLeluhur } from "./perkawinan-leluhur.service.js";
import { prosesPerceraianBali } from "./perceraian.service.js";
import { eksekusiRollbackPerkawinan } from "./batal-perkawinan.service.js";

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

    const { [draftKey]: removedDraft, ...restChanges } = existingChanges;
    const isOtherDraftActive = Object.keys(restChanges).length > 0;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };
    const operatorIdentity = user_role === "Admin Desa" ? `Admin Desa ${user_desa_id}` : user_role;

    // ==========================================================
    // JALUR A: DATA PERUBAHAN DITOLAK
    // ==========================================================
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
        is_pending_update: isOtherDraftActive,
        data_perubahan: isOtherDraftActive ? restChanges : null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PENOLAKAN_UPDATE", 
        data: perkawinanDitolak 
      };
    }

    // ==========================================================
    // JALUR B1: APPROVAL PARSIAL
    // ==========================================================
    let approvedSuami = subDraftUpdate.is_approved_desa_suami || false;
    let approvedIstri = subDraftUpdate.is_approved_desa_istri || false;

    if (target_sisi === "suami" || target_sisi === "super_admin") {
      approvedSuami = true;
    }
    if (target_sisi === "istri" || target_sisi === "super_admin") {
      approvedIstri = true;
    }

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

    // ==========================================================
    // JALUR B2: APPROVAL PENUH 
    // ==========================================================
    const statusPerkawinanAwal = perkawinan.status_perkawinan;
    const tanggalCeraiLama = perkawinan.tanggal_cerai;
    const pihakMeninggalLama = perkawinan.pihak_meninggal;
    
    newCatatanAdmin.status_verifikasi_update = `Perubahan data ${tipe_update.toLowerCase()} telah diverifikasi dan disahkan oleh ${user_role}.`;
    newCatatanAdmin.last_updated_by = operatorIdentity;

    if (subDraftUpdate.is_perubahan_ekstrem && tipe_update === "PERKAWINAN") {
      const jumlahAnak = await RelasiKrama.count({
        where: { 
          ayah_id: perkawinan.suami_id, 
          ibu_id: perkawinan.istri_id 
        },
        transaction: t
      });

      if (jumlahAnak > 0) {
        throw new Error("Perubahan data ditolak! Perkawinan ini telah memiliki relasi anak yang terikat.");
      }

      const idSuamiLama = perkawinan.suami_id;
      const idIstriLama = perkawinan.istri_id;
      const idUserPengajuAsli = perkawinan.user_id;

      await eksekusiRollbackPerkawinan(perkawinan, "PERKAWINAN", t);
      await perkawinan.destroy({ transaction: t });

      const tglKawinTerbaru = subDraftUpdate.tanggal_perkawinan.includes('T') 
        ? subDraftUpdate.tanggal_perkawinan.split('T')[0] 
        : subDraftUpdate.tanggal_perkawinan.split(' ')[0];

      const [suamiBaru, istriBaru] = await Promise.all([
        KramaBali.findByPk(subDraftUpdate.suami_id, { 
          transaction: t 
        }),
        KramaBali.findByPk(subDraftUpdate.istri_id, { 
          transaction: t 
        })
      ]);

      let perkawinanBaru;

      if (suamiBaru.tipe_data === "Leluhur" || istriBaru.tipe_data === "Leluhur") {
        perkawinanBaru = await integrasiPerkawinanLeluhur({
          suami_id: subDraftUpdate.suami_id,
          istri_id: subDraftUpdate.istri_id,
          status_perkawinan: subDraftUpdate.status_perkawinan,
          jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
          tanggal_perkawinan: tglKawinTerbaru, 
          event_date: tglKawinTerbaru,
          user_id: idUserPengajuAsli, 
          user_role: user_role, 
          user_desa_id: user_desa_id,
          nama_desa_operator: operatorIdentity
        }, t);
      } else {
        perkawinanBaru = await buatPerkawinanBali({
          suami_id: subDraftUpdate.suami_id,
          istri_id: subDraftUpdate.istri_id,
          status_perkawinan: "Kawin",
          jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
          tanggal_perkawinan: tglKawinTerbaru, 
          event_date: tglKawinTerbaru,
          user_id: idUserPengajuAsli, 
          user_role: user_role, 
          user_desa_id: user_desa_id,
          isUpdateMode: true
        }, t);

        if (statusPerkawinanAwal !== "Kawin") {
          const targetPerkawinanId = perkawinanBaru?.id || perkawinanBaru?.perkawinan?.id;
          await prosesPerceraianBali({
            perkawinan_id: targetPerkawinanId,
            status_perkawinan: statusPerkawinanAwal, 
            tanggal_cerai: tanggalCeraiLama || tglKawinTerbaru,
            event_date: tanggalCeraiLama || tglKawinTerbaru,
            pihak_meninggal: pihakMeninggalLama,
            pilihan_predana: subDraftUpdate.pilihan_predana || null,
            user_id: idUserPengajuAsli, 
            user_role: user_role, 
            user_desa_id: user_desa_id
          }, t);
        }
      }
      
      await RiwayatPeranAdat.update(
        { selesai_tanggal: null },
        {
          where: {
            krama_id: [idSuamiLama, idIstriLama],
            kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
            perkawinan_id: null
          },
          transaction: t
        }
      );

      await RiwayatPeranAdat.update(
        { selesai_tanggal: tglKawinTerbaru },
        {
          where: {
            krama_id: [subDraftUpdate.suami_id, subDraftUpdate.istri_id],
            kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
            perkawinan_id: null
          },
          transaction: t
        }
      );

      await t.commit();
      return { 
        type: "PERSETUJUAN_UPDATE_PENUH", 
        data: perkawinanBaru 
      };
    }

    // ==========================================================
    // JALUR B3: APPROVAL PERUBAHAN TANGGAL
    // ==========================================================
    if (tipe_update === "PERKAWINAN") {
      const tglPerkawinanMurni = subDraftUpdate.tanggal_perkawinan.includes('T') 
        ? subDraftUpdate.tanggal_perkawinan.split('T')[0] 
        : subDraftUpdate.tanggal_perkawinan.split(' ')[0];

      let tglKawinTerbaru = tglPerkawinanMurni;

      await perkawinan.update({
        suami_id: subDraftUpdate.suami_id,
        istri_id: subDraftUpdate.istri_id,
        tanggal_perkawinan: tglPerkawinanMurni,
        jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        is_pending_update: isOtherDraftActive,
        data_perubahan: isOtherDraftActive ? restChanges : null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await RiwayatPeranAdat.update(
        { mulai_tanggal: tglKawinTerbaru },
        { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        }
      );

      await RiwayatPeranAdat.update(
        { selesai_tanggal: tglKawinTerbaru },
        { 
          where: { 
            krama_id: [perkawinan.suami_id, perkawinan.istri_id],
            kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
            perkawinan_id: null       
          }, 
          transaction: t 
        }
      );
      
      await RiwayatKeluarga.update(
        { awal_masuk: tglKawinTerbaru }, 
        { 
          where: { perkawinan_id: perkawinan.id }, 
          transaction: t 
        }
      );
    } else if (tipe_update === "PERCERAIAN") {
      const tglCeraiMurni = subDraftUpdate.tanggal_cerai.includes('T') 
        ? subDraftUpdate.tanggal_cerai.split('T')[0] 
        : subDraftUpdate.tanggal_cerai.split(' ')[0];

      let finalTanggalCeraiVerif;
      if (tglCeraiMurni === perkawinan.tanggal_perkawinan) {
        const waktuBerjalan = new Date();
        waktuBerjalan.setSeconds(waktuBerjalan.getSeconds() + 5);
        finalTanggalCeraiVerif = waktuBerjalan;
      } else {
        const jamBerjalan = new Date().toTimeString().split(' ')[0];
        finalTanggalCeraiVerif = new Date(`${tglCeraiMurni} ${jamBerjalan}`);
      }

      await perkawinan.update({
        tanggal_cerai: tglCeraiMurni,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        pihak_meninggal: subDraftUpdate.pihak_meninggal,
        is_pending_update: isOtherDraftActive,
        data_perubahan: isOtherDraftActive ? restChanges : null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await RiwayatPeranAdat.update(
        { selesai_tanggal: finalTanggalCeraiVerif },
        { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        }
      );

      await RiwayatKeluarga.update(
        { akhir_masuk: finalTanggalCeraiVerif }, 
        { 
          where: { perkawinan_id: perkawinan.id }, 
          transaction: t 
        }
      );
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