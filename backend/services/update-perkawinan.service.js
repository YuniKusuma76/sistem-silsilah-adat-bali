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

export const updateDataPerkawinan = async ({
  perkawinan_id,
  tipe_update,
  suami_id,
  istri_id,
  jenis_perkawinan,
  tanggal_event,
  status_perkawinan,  
  pihak_meninggal,
  pilihan_predana,
  catatan_update,
  user_id,            
  user_role,          
  user_desa_id
}) => {
  if (tipe_update !== "PERKAWINAN" && tipe_update !== "PERCERAIAN") {
    throw new Error("Parameter tipe update tidak valid!");
  }

  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan.");
    }

    if (tipe_update === "PERCERAIAN" && perkawinan.status_perkawinan === "Kawin") {
      throw new Error("Proses memperbarui dihentikan! Gunakan pengajuan perceraian jika ingin mengubah status perkawinan menjadi cerai.");
    }

    const [suamiLama, istriLama] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id, { 
        transaction: t 
      }),
      KramaBali.findByPk(perkawinan.istri_id, { 
        transaction: t 
      })
    ]);

    // SETTING HAK AKSES MANAJEMEN DATA
    let isHakAkses = false;
    let approvedSuami = false;
    let approvedIstri = false;

    if (user_role === "Super Admin") {
      isHakAkses = true;
      approvedSuami = true;
      approvedIstri = true;
    } else if (user_role === "Admin Desa") {
      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
        if (suamiLama.desa_adat_id === user_desa_id || istriLama.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else if (perkawinan.jenis_perkawinan === "Nyentana") {
        if (istriLama.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else {
        if (suamiLama.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      }
      if (isHakAkses) {
        if (suamiLama.desa_adat_id === user_desa_id) {
          approvedSuami = true;
        }
        if (istriLama.desa_adat_id === user_desa_id) {
          approvedIstri = true;
        }
      }
    } else {
      if (perkawinan.user_id === user_id) isHakAkses = true;
    }

    if (!isHakAkses) {
      throw new Error("Otoritas mengakses data ditolak! Anda tidak memiliki hak untuk mengusulkan perubahan pada data perkawinan ini.");
    }

    let isExecuteDirect = false;
    if (user_role === "Super Admin") {
      isExecuteDirect = true;
    } else if (user_role === "Admin Desa") {
      if (perkawinan.jenis_perkawinan !== "Pade Gelahang") {
        isExecuteDirect = true;
      } else {
        if (approvedSuami && approvedIstri) {
          isExecuteDirect = true;
        }
      }
    }

    const existingChanges = perkawinan.data_perubahan || {};
    let subDraftUpdate = {};

    if (tipe_update === "PERKAWINAN") {
      const isDataUtamaBerubah = (suami_id && suami_id !== perkawinan.suami_id) 
        || (istri_id && istri_id !== perkawinan.istri_id) 
        || (jenis_perkawinan && jenis_perkawinan !== perkawinan.jenis_perkawinan);
      
      subDraftUpdate = {
        suami_id: suami_id || perkawinan.suami_id,
        istri_id: istri_id || perkawinan.istri_id,
        tanggal_perkawinan: tanggal_event || perkawinan.tanggal_perkawinan,
        jenis_perkawinan: jenis_perkawinan || perkawinan.jenis_perkawinan,
        status_perkawinan: status_perkawinan || perkawinan.status_perkawinan,
        is_perubahan_ekstrem: isDataUtamaBerubah
      };
    } else if (tipe_update === "PERCERAIAN") {
      const isTglCeraiBerubah = tanggal_event && tanggal_event !== perkawinan.tanggal_cerai;

      subDraftUpdate = {
        tanggal_cerai: tanggal_event || perkawinan.tanggal_cerai,
        status_perkawinan: status_perkawinan || perkawinan.status_perkawinan,
        pihak_meninggal: pihak_meninggal || perkawinan.pihak_meninggal,
        pilihan_predana: pilihan_predana || null,
        is_pergeseran_tanggal: isTglCeraiBerubah
      };
    }

    const userOperator = await User.findByPk(user_id, { 
      transaction: t 
    });

    subDraftUpdate.catatan_update = catatan_update || `Pengajuan draft perubahan data ${tipe_update.toLowerCase()}.`;
    subDraftUpdate.diusulkan_oleh = `${user_role} (${userOperator?.display_name})`;
    subDraftUpdate.updated_at = new Date();
    subDraftUpdate.is_approved_desa_suami = approvedSuami;
    subDraftUpdate.is_approved_desa_istri = approvedIstri;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    const operatorIdentity = user_role === "Admin Desa" ? `Admin Desa ${user_desa_id}` : user_role;

    // ==========================================================
    // JALUR A: BUFFERING KE DRAFT PERUBAHAN DATA
    // ==========================================================
    if (!isExecuteDirect) {
      if (subDraftUpdate.is_perubahan_ekstrem && tipe_update === "PERKAWINAN") {
        const jumlahAnakDraf = await RelasiKrama.count({
          where: { 
            ayah_id: perkawinan.suami_id, 
            ibu_id: perkawinan.istri_id 
          },
          transaction: t
        });
        
        if (jumlahAnakDraf > 0) {
          throw new Error("Perubahan data ditolak! Perkawinan ini telah memiliki relasi anak yang terikat.");
        }
      }

      const draftUpdateFinal = { 
        ...existingChanges, 
        [`UPDATE_${tipe_update}`]: subDraftUpdate 
      };

      const perkawinanDraf = await perkawinan.update({
        is_pending_update: true,
        status_sebelum_draft: perkawinan.status_verifikasi,
        data_perubahan: draftUpdateFinal,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Usulan perubahan data ${tipe_update.toLowerCase()} berhasil disimpan! Menunggu verifikasi dari Admin Desa Bersangkutan.`,
          last_updated_by: operatorIdentity
        }
      }, { transaction: t });

      await t.commit();
      return { 
        type: "MASUK_DRAFT_ANTREAN", 
        data: perkawinanDraf 
      };
    }
    
    // ==========================================================
    // JALUR B1: AUTO-APPROVAL (PERUBAHAN EKSTREM)
    // ==========================================================
    const statusPerkawinanAwal = perkawinan.status_perkawinan;
    const tanggalCeraiLama = perkawinan.tanggal_cerai;
    const pihakMeninggalLama = perkawinan.pihak_meninggal;
    
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
          user_id, 
          user_role, 
          user_desa_id,
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
          user_id, 
          user_role, 
          user_desa_id,
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
            pilihan_predana: pilihan_predana || subDraftUpdate.pilihan_predana,
            user_id, 
            user_role, 
            user_desa_id
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
        type: "AUTO_APPROVED_SUKSES", 
        data: perkawinanBaru 
      };
    }

    // ==========================================================
    // JALUR B2: AUTO-APPROVAL (PERGESERAN TANGGAL/STATUS)
    // ==========================================================
    let tglKawinTerbaru = perkawinan.tanggal_perkawinan;

    if (tipe_update === "PERKAWINAN") {
      const tglPerkawinanMurni = subDraftUpdate.tanggal_perkawinan.includes('T') 
        ? subDraftUpdate.tanggal_perkawinan.split('T')[0] 
        : subDraftUpdate.tanggal_perkawinan.split(' ')[0];

      tglKawinTerbaru = tglPerkawinanMurni;

      await perkawinan.update({
        suami_id: subDraftUpdate.suami_id,
        istri_id: subDraftUpdate.istri_id,
        tanggal_perkawinan: tglPerkawinanMurni,
        jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Data perkawinan berhasil diperbarui secara langsung oleh ${user_role}.`,
          last_updated_by: operatorIdentity
        }
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
      let finalTanggalCeraiUpdate;
      const stringDateCeraiOnly = subDraftUpdate.tanggal_cerai.includes('T') 
        ? subDraftUpdate.tanggal_cerai.split('T')[0] 
        : subDraftUpdate.tanggal_cerai.split(' ')[0];
      
      // Jika tanggal cerai hasil koreksi sama dengan tanggal perkawinan aktif
      if (stringDateCeraiOnly === perkawinan.tanggal_perkawinan) {
        const waktuBerjalan = new Date();
        // Berikan kompensasi waktu dinamis 5 detik agar memenangkan urutan silsilah peran adat
        waktuBerjalan.setSeconds(waktuBerjalan.getSeconds() + 5);
        finalTanggalCeraiUpdate = waktuBerjalan;
      } else {
        const jamBerjalan = new Date().toTimeString().split(' ')[0];
        finalTanggalCeraiUpdate = new Date(`${stringDateCeraiOnly} ${jamBerjalan}`);
      }

      await perkawinan.update({
        tanggal_cerai: stringDateCeraiOnly,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        pihak_meninggal: subDraftUpdate.pihak_meninggal,
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Data perkawinan berhasil diperbarui secara langsung oleh ${user_role}.`,
          last_updated_by: operatorIdentity
        }
      }, { transaction: t });

      await RiwayatPeranAdat.update(
        { selesai_tanggal: finalTanggalCeraiUpdate },
        { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        }
      );

      await RiwayatKeluarga.update(
        { akhir_masuk: finalTanggalCeraiUpdate }, 
        { 
          where: { perkawinan_id: perkawinan.id }, 
          transaction: t 
        }
      );
    }
    
    await t.commit();
    return { 
      type: "AUTO_APPROVED_SUKSES", 
      data: perkawinan 
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};