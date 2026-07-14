import { Op } from "sequelize";
import db from "../config/db.config.js";
import { 
  Perkawinan, 
  KramaBali, 
  User, 
  RiwayatPeranAdat, 
  RiwayatKeluarga,
  Keluarga,
  RelasiKrama,
  DesaAdat
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

    let operatorIdentity = user_role;

    if (user_role === "Admin Desa") {
      const desaOperator = await DesaAdat.findByPk(user_desa_id, { transaction: t }) 
      operatorIdentity = desaOperator ? `Admin Desa ${desaOperator.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    } 

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
    // JALUR B2: APPROVAL PENUH (REKONSTRUKSI EKSTREM)
    // Sesuai 100% dengan mekanisme Jalur B1 Service UpdateData
    // ==========================================================
    const statusPerkawinanAwal = perkawinan.status_perkawinan;
    const tanggalCeraiLama = perkawinan.tanggal_cerai;
    const pihakMeninggalLama = perkawinan.pihak_meninggal;
    const pilihanPredanaLama = perkawinan.pilihan_predana;
    
    newCatatanAdmin.status_verifikasi_update = `Perubahan data ${tipe_update.toLowerCase()} telah diverifikasi dan disahkan oleh ${user_role}.`;
    newCatatanAdmin.last_updated_by = operatorIdentity;

    if (subDraftUpdate.is_perubahan_ekstrem && tipe_update === "PERKAWINAN") {
      // 1. Validasi ketat ikatan anak
      const jumlahAnak = await RelasiKrama.count({
        where: { 
          ayah_id: perkawinan.suami_id, 
          ibu_id: perkawinan.istri_id 
        },
        transaction: t
      });

      if (jumlahAnak > 0) {
        throw new Error("Perubahan ekstrem ditolak! Perkawinan ini telah memiliki relasi anak yang terikat di silsilah. Pindahkan relasi anak terlebih dahulu.");
      }

      // 2. Amankan ID lama untuk pembersihan total pasca rollback
      const idSuamiLama = perkawinan.suami_id;
      const idIstriLama = perkawinan.istri_id;
      const idPerkawinanLama = perkawinan.id;
      const idUserPengajuAsli = perkawinan.user_id;

      // 3. Jalankan service pembatalan / rollback bawaan sistem
      await eksekusiRollbackPerkawinan(perkawinan, "PERKAWINAN", t);
      
      // 4. PEMBERSIHAN TOTAL: Pastikan tidak ada riwayat peran adat & keluarga lama yang menggantung
      await RiwayatPeranAdat.destroy({
        where: { perkawinan_id: idPerkawinanLama },
        transaction: t
      });

      await RiwayatKeluarga.destroy({
        where: { perkawinan_id: idPerkawinanLama },
        transaction: t
      });

      // Hapus data master perkawinan lama
      await perkawinan.destroy({ transaction: t });

      // 5. Normalisasi format tanggal perkawinan baru
      const tglKawinTerbaruStr = subDraftUpdate.tanggal_perkawinan.includes('T') 
        ? subDraftUpdate.tanggal_perkawinan.split('T')[0] 
        : subDraftUpdate.tanggal_perkawinan.split(' ')[0];

      const [suamiBaru, istriBaru] = await Promise.all([
        KramaBali.findByPk(subDraftUpdate.suami_id, { transaction: t }),
        KramaBali.findByPk(subDraftUpdate.istri_id, { transaction: t })
      ]);

      if (!suamiBaru || !istriBaru) {
        throw new Error("Data Krama suami atau istri baru tidak ditemukan.");
      }

      // 6. Bangun entitas perkawinan baru berdasarkan tipe data krama
      let perkawinanBaru;
      if (suamiBaru.tipe_data === "Leluhur" || istriBaru.tipe_data === "Leluhur") {
        perkawinanBaru = await integrasiPerkawinanLeluhur({
          nomor_pendaftaran: perkawinan.nomor_pendaftaran,
          suami_id: subDraftUpdate.suami_id,
          istri_id: subDraftUpdate.istri_id,
          status_perkawinan: statusPerkawinanAwal, 
          jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
          tanggal_perkawinan: tglKawinTerbaruStr, 
          event_date: tglKawinTerbaruStr,
          user_id: idUserPengajuAsli, 
          user_role, 
          user_desa_id,
          nama_desa_operator: operatorIdentity
        }, t);
      } else {
        perkawinanBaru = await buatPerkawinanBali({
          nomor_pendaftaran: perkawinan.nomor_pendaftaran,
          suami_id: subDraftUpdate.suami_id,
          istri_id: subDraftUpdate.istri_id,
          status_perkawinan: "Kawin",
          jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
          tanggal_perkawinan: tglKawinTerbaruStr, 
          event_date: tglKawinTerbaruStr,
          user_id: idUserPengajuAsli, 
          user_role, 
          user_desa_id,
          isUpdateMode: true
        }, t);

        // 7. KONDISIONAL KRUSIAL: Jika status awalnya MEMANG SUDAH CERAI, jalankan perceraian ulang
        if (statusPerkawinanAwal !== "Kawin") {
          const targetPerkawinanId = perkawinanBaru?.id || perkawinanBaru?.perkawinan?.id;
          
          await prosesPerceraianBali({
            perkawinan_id: targetPerkawinanId,
            status_perkawinan: statusPerkawinanAwal, 
            tanggal_cerai: tanggalCeraiLama || tglKawinTerbaruStr,
            pihak_meninggal: pihakMeninggalLama,
            pilihan_predana: pilihanPredanaLama || subDraftUpdate.pilihan_predana,
            user_id: idUserPengajuAsli, 
            user_role, 
            user_desa_id
          }, t);
        }
      }
      
      // 8. Kembalikan masa lajang krama lama ke kondisi normal
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

      // 9. Set kunci selesai_tanggal masa lajang krama baru
      await RiwayatPeranAdat.update(
        { selesai_tanggal: tglKawinTerbaruStr },
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
    // JALUR B3: APPROVAL PERUBAHAN TANGGAL / STATUS BIASA
    // Sesuai 100% dengan mekanisme Jalur B2 Service UpdateData
    // ==========================================================
    let tglKawinTerbaru = perkawinan.tanggal_perkawinan;

    if (tipe_update === "PERKAWINAN") {
      const tglPerkawinanMurni = subDraftUpdate.tanggal_perkawinan.includes('T') 
        ? subDraftUpdate.tanggal_perkawinan.split('T')[0] 
        : subDraftUpdate.tanggal_perkawinan.split(' ')[0];

      tglKawinTerbaru = tglPerkawinanMurni;

      if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
        if (new Date(tglKawinTerbaru) > new Date(perkawinan.tanggal_cerai)) {
          throw new Error("Tanggal perkawinan baru tidak boleh melampaui tanggal perceraian yang telah terdaftar.");
        }
      }

      // 1. Update master perkawinan
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

      // 2. Sinkronisasi awal mulai ikatan perkawinan adat KAWIN
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

      if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
        await RiwayatPeranAdat.update(
          { selesai_tanggal: new Date(perkawinan.tanggal_cerai) },
          { 
            where: { 
              perkawinan_id: perkawinan.id, 
              kategori_event: "KAWIN" 
            }, 
            transaction: t 
          }
        );
        
        await RiwayatPeranAdat.update(
          { mulai_tanggal: new Date(perkawinan.tanggal_cerai) },
          { 
            where: { 
              perkawinan_id: perkawinan.id, 
              kategori_event: "CERAI" 
            }, 
            transaction: t 
          }
        );
      }

      // 3. Paksa penutupan selesai_tanggal riwayat LAHIR / PENGANGKATAN
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
      
      // 4. SINKRONISASI RIWAYAT KELUARGA (ADAPTIF PADE GELAHANG):
      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
        await RiwayatKeluarga.update(
          { awal_masuk: tglKawinTerbaru }, 
          { 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: [perkawinan.suami_id, perkawinan.istri_id],
              kategori_event: "KAWIN"
            }, 
            transaction: t 
          }
        );

        if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
          // PROTEKSI: Hanya update akhir_masuk krama berkEDUDUKAN "Anggota"
          await RiwayatKeluarga.update(
            { akhir_masuk: new Date(perkawinan.tanggal_cerai) }, 
            { 
              where: { 
                perkawinan_id: perkawinan.id,
                krama_id: [perkawinan.suami_id, perkawinan.istri_id],
                kategori_event: "KAWIN",
                kedudukan: "Anggota" 
              }, 
              transaction: t 
            }
          );

          await RiwayatKeluarga.update(
            { awal_masuk: new Date(perkawinan.tanggal_cerai) }, 
            { 
              where: { 
                perkawinan_id: perkawinan.id,
                krama_id: [perkawinan.suami_id, perkawinan.istri_id],
                kategori_event: "CERAI"
              }, 
              transaction: t 
            }
          );
        }
      } else {
        const pihakPredanaId = perkawinan.jenis_perkawinan === "Nyentana" ? perkawinan.suami_id : perkawinan.istri_id;

        await RiwayatKeluarga.update(
          { awal_masuk: tglKawinTerbaru }, 
          { 
            where: { 
              perkawinan_id: perkawinan.id,
              kategori_event: "KAWIN"
            }, 
            transaction: t 
          }
        );

        if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
          await RiwayatKeluarga.update(
            { akhir_masuk: new Date(perkawinan.tanggal_cerai) }, 
            { 
              where: { 
                perkawinan_id: perkawinan.id,
                krama_id: pihakPredanaId,
                kategori_event: "KAWIN"
              }, 
              transaction: t 
            }
          );

          await RiwayatKeluarga.update(
            { awal_masuk: new Date(perkawinan.tanggal_cerai) }, 
            { 
              where: { 
                perkawinan_id: perkawinan.id,
                krama_id: pihakPredanaId,
                kategori_event: "CERAI"
              }, 
              transaction: t 
            }
          );
        }
      }

    } else if (tipe_update === "PERCERAIAN") {
      let finalTanggalCeraiUpdate;

      const stringDateCeraiOnly = subDraftUpdate.tanggal_cerai.includes('T') 
        ? subDraftUpdate.tanggal_cerai.split('T')[0] 
        : subDraftUpdate.tanggal_cerai.split(' ')[0];
      
      if (stringDateCeraiOnly === perkawinan.tanggal_perkawinan) {
        const waktuBerjalan = new Date();
        waktuBerjalan.setSeconds(waktuBerjalan.getSeconds() + 5);
        finalTanggalCeraiUpdate = `${stringDateCeraiOnly} ${waktuBerjalan.toTimeString().split(' ')[0]}`;
      } else {
        finalTanggalCeraiUpdate = `${stringDateCeraiOnly} 00:00:00`;
      }

      const objectDateCeraiUntukDB = new Date(finalTanggalCeraiUpdate);

      if (new Date(perkawinan.tanggal_perkawinan) > objectDateCeraiUntukDB) {
        throw new Error("Tanggal perceraian tidak boleh lebih awal dari tanggal perkawinan adat.");
      }

      // 1. Eksekusi pembaruan pada master Perkawinan
      await perkawinan.update({
        tanggal_cerai: objectDateCeraiUntukDB,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        pihak_meninggal: subDraftUpdate.pihak_meninggal,
        pilihan_predana: subDraftUpdate.pilihan_predana,
        is_pending_update: isOtherDraftActive,
        data_perubahan: isOtherDraftActive ? restChanges : null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      // 2. Kunci selesai_tanggal riwayat KAWIN lama dengan timestamp cerai baru
      await RiwayatPeranAdat.update(
        { selesai_tanggal: objectDateCeraiUntukDB },
        { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        }
      );

      // 3. Kunci mulai_tanggal riwayat CERAI yang terikat perkawinan ini
      await RiwayatPeranAdat.update(
        { mulai_tanggal: objectDateCeraiUntukDB },
        {
          where: {
            perkawinan_id: perkawinan.id,
            krama_id: [perkawinan.suami_id, perkawinan.istri_id],
            kategori_event: "CERAI"
          },
          transaction: t
        }
      );

      // 4. SINKRONISASI MUTASI RIWAYAT KELUARGA (ADAPTIF PADE GELAHANG):
      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
        // PROTEKSI: Hanya batasi record kedudukan "Anggota", biarkan "Kepala Keluarga" tetap aktif
        await RiwayatKeluarga.update(
          { akhir_masuk: objectDateCeraiUntukDB }, 
          { 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: [perkawinan.suami_id, perkawinan.istri_id],
              kategori_event: "KAWIN",
              kedudukan: "Anggota"
            }, 
            transaction: t 
          }
        );

        await RiwayatKeluarga.update(
          { awal_masuk: objectDateCeraiUntukDB },
          {
            where: {
              perkawinan_id: perkawinan.id,
              krama_id: [perkawinan.suami_id, perkawinan.istri_id],
              kategori_event: "CERAI",
              akhir_masuk: null
            },
            transaction: t
          }
        );
      } else {
        const pihakPredanaId = perkawinan.jenis_perkawinan === "Nyentana" ? perkawinan.suami_id : perkawinan.istri_id;

        await RiwayatKeluarga.update(
          { akhir_masuk: objectDateCeraiUntukDB }, 
          { 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: pihakPredanaId,
              kategori_event: "KAWIN"
            }, 
            transaction: t 
          }
        );

        await RiwayatKeluarga.update(
          { awal_masuk: objectDateCeraiUntukDB },
          {
            where: {
              perkawinan_id: perkawinan.id,
              krama_id: pihakPredanaId,
              kategori_event: "CERAI",
              akhir_masuk: null
            },
            transaction: t
          }
        );
      }
    }
    
    await perkawinan.reload({ transaction: t });
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