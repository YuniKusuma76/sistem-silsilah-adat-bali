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

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

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
      throw new Error(`Data perkawinan ini tidak memiliki usulan draf perubahan data ${tipe_update.toLowerCase()} yang aktif.`);
    }

    const existingChanges = perkawinan.data_perubahan || {};
    let subDraftUpdate = existingChanges[draftKey];

    const { [draftKey]: removedDraft, ...restChanges } = existingChanges;
    const isOtherDraftActive = Object.keys(restChanges).length > 0;
    const existingCatatan = perkawinan.catatan_admin_desa || {};

    let newCatatanAdmin = { ...existingCatatan };
    let operatorIdentity = user_role;

    if (user_role === "Admin Desa") {
      const desaOperator = await DesaAdat.findByPk(user_desa_id, { 
        transaction: t 
      });
      operatorIdentity = desaOperator ? `Admin Desa ${desaOperator.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    } 

    // JALUR A: DATA PERUBAHAN DITOLAK
    if (status_verifikasi === "Ditolak") {
      if (target_sisi === "suami" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_suami = `[PERUBAHAN ${tipe_update} DITOLAK]: ${catatan_admin}`;
      }
      if (target_sisi === "istri" || target_sisi === "super_admin") {
        newCatatanAdmin.catatan_desa_istri = `[PERUBAHAN ${tipe_update} DITOLAK]: ${catatan_admin}`;
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

    // JALUR B1: APPROVAL PARSIAL
    let approvedSuami = subDraftUpdate.approval_update_suami === true;
    let approvedIstri = subDraftUpdate.approval_update_istri === true;

    if (target_sisi === "suami") {
      approvedSuami = true;
    } else if (target_sisi === "istri") {
      approvedIstri = true;
    } else if (target_sisi === "super_admin") {
      approvedSuami = true;
      approvedIstri = true;
    }

    const isPadeGelahang = perkawinan.jenis_perkawinan === "Pade Gelahang";
    const isBelumLengkap = !approvedSuami || !approvedIstri;

    if (isPadeGelahang && isBelumLengkap) {
      subDraftUpdate.approval_update_suami = approvedSuami;
      subDraftUpdate.approval_update_istri = approvedIstri;
      subDraftUpdate.updated_at = new Date();

      const tungguPihak = !approvedSuami ? "Admin Desa Suami" : "Admin Desa Istri";

      const perkawinanParsial = await perkawinan.update({
        data_perubahan: {
          ...(existingChanges || {}), 
          [draftKey]: subDraftUpdate
        },
        catatan_admin_desa: {
          ...newCatatanAdmin,
          status_verifikasi_update: `Usulan perubahan data ${tipe_update.toLowerCase()} telah diverifikasi dan disetujui oleh ${nama_desa_operator}. Menunggu verifikasi dari pihak ${tungguPihak}.`,
          last_updated_by: operatorIdentity
        }
      }, { transaction: t });

      await t.commit();
      return { 
        type: "PERSETUJUAN_UPDATE_PARSIAL", 
        data: perkawinanParsial 
      };
    }

    subDraftUpdate.approval_update_suami = true;
    subDraftUpdate.approval_update_istri = true;
    existingChanges[draftKey] = subDraftUpdate;

    // JALUR B2: APPROVAL PENUH
    const statusPerkawinanAwal = perkawinan.status_perkawinan;
    let tanggalCeraiLama = null;

    if (perkawinan.tanggal_cerai) {
      tanggalCeraiLama = perkawinan.tanggal_cerai instanceof Date 
        ? perkawinan.tanggal_cerai.toISOString().split('T')[0]
        : String(perkawinan.tanggal_cerai).split(' ')[0];
    }
    
    const pihakMeninggalLama = perkawinan.pihak_meninggal;
    const pilihanPredanaLama = perkawinan.pilihan_predana;
    
    newCatatanAdmin.status_verifikasi_update = `Perubahan data ${tipe_update.toLowerCase()} telah diverifikasi dan disahkan oleh ${user_role}.`;
    newCatatanAdmin.last_updated_by = operatorIdentity;

    const idSuamiLama = perkawinan.suami_id;
    const idIstriLama = perkawinan.istri_id;

    if (subDraftUpdate.is_perubahan_ekstrem && tipe_update === "PERKAWINAN") {
      const jumlahAnak = await RelasiKrama.count({
        where: { 
          ayah_id: perkawinan.suami_id, 
          ibu_id: perkawinan.istri_id 
        },
        transaction: t
      });

      if (jumlahAnak > 0) {
        throw new Error("Perubahan data utama ditolak! Perkawinan ini telah memiliki relasi anak yang terikat di silsilah. Pindahkan relasi anak terlebih dahulu!");
      }

      const idPerkawinanLama = perkawinan.id;
      const idUserPengajuAsli = perkawinan.user_id;

      await eksekusiRollbackPerkawinan(perkawinan, "PERKAWINAN", t);
      
      await RiwayatPeranAdat.destroy({
        where: { perkawinan_id: idPerkawinanLama },
        transaction: t
      });

      await RiwayatKeluarga.destroy({
        where: { perkawinan_id: idPerkawinanLama },
        transaction: t
      });

      await perkawinan.destroy({ transaction: t });

      const tglKawinTerbaruStr = subDraftUpdate.tanggal_perkawinan.includes('T') 
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

      if (!suamiBaru || !istriBaru) {
        throw new Error("Data suami atau istri tidak ditemukan.");
      }

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

        if (statusPerkawinanAwal && statusPerkawinanAwal !== "Kawin") {
          const targetPerkawinanId = perkawinanBaru?.id || perkawinanBaru?.perkawinan?.id;
          let statusCeraiAdat = statusPerkawinanAwal;

          if (statusPerkawinanAwal === "Cerai") {
            statusCeraiAdat = "Cerai Hidup";
          }

          let pihakMeninggalTerdeteksi = pihakMeninggalLama;

          if (statusCeraiAdat.toLowerCase().includes("mati") && !pihakMeninggalTerdeteksi) {
            pihakMeninggalTerdeteksi = "suami"; 
          }

          const pilihanPredanaTerformat = pilihanPredanaLama || subDraftUpdate.pilihan_predana || "Kembali ke Asal";

          await prosesPerceraianBali({
            perkawinan_id: targetPerkawinanId,
            status_perkawinan: statusCeraiAdat, 
            tanggal_cerai: tanggalCeraiLama || tglKawinTerbaruStr,
            pihak_meninggal: pihakMeninggalTerdeteksi,
            pilihan_predana: pilihanPredanaTerformat,
            user_id: idUserPengajuAsli, 
            user_role, 
            user_desa_id
          }, t);
        }
      }
      
      await RiwayatPeranAdat.update({ 
        selesai_tanggal: null 
      },{
        where: {
          krama_id: [idSuamiLama, idIstriLama],
          kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
          perkawinan_id: null
        },
        transaction: t
      });

      await RiwayatPeranAdat.update({ 
        selesai_tanggal: tglKawinTerbaruStr 
      },{
        where: {
          krama_id: [subDraftUpdate.suami_id, subDraftUpdate.istri_id],
          kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
          perkawinan_id: null
        },
        transaction: t
      });

      await t.commit();
      return { 
        type: "PERSETUJUAN_UPDATE_PENUH", 
        data: perkawinanBaru 
      };
    }

    // JALUR B3: APPROVAL PERUBAHAN TANGGAL
    let tglKawinTerbaru = perkawinan.tanggal_perkawinan;
    const teksHapusKawin = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perkawinan kosong).";
    const teksHapusCerai = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perceraian kosong).";

    if (tipe_update === "PERKAWINAN") {
      const tglPerkawinanMurni = subDraftUpdate.tanggal_perkawinan.includes('T') 
        ? subDraftUpdate.tanggal_perkawinan.split('T')[0] 
        : subDraftUpdate.tanggal_perkawinan.split(' ')[0];

      tglKawinTerbaru = tglPerkawinanMurni;

      if (perkawinan.status_perkawinan !== "Kawin" && tanggalCeraiLama) {
        if (new Date(tglKawinTerbaru) > new Date(tanggalCeraiLama)) {
          throw new Error("Tanggal perkawinan baru tidak boleh melampaui tanggal perceraian yang telah terdaftar.");
        }
      }

      await perkawinan.update({
        suami_id: subDraftUpdate.suami_id,
        istri_id: subDraftUpdate.istri_id,
        tanggal_perkawinan: tglPerkawinanMurni,
        jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
        is_pending_update: isOtherDraftActive,
        data_perubahan: isOtherDraftActive ? restChanges : null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await Promise.all([
        RiwayatPeranAdat.update({ 
          mulai_tanggal: tglKawinTerbaru,
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusKawin, '')
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        }),
        RiwayatKeluarga.update({ 
          awal_masuk: tglKawinTerbaru,
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusKawin, '')
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        })
      ]);

      if (perkawinan.status_perkawinan !== "Kawin" && tanggalCeraiLama) {
        const safeObjectDateCerai = new Date(`${tanggalCeraiLama}T12:00:00`);
        
        await RiwayatPeranAdat.update({ 
          selesai_tanggal: safeObjectDateCerai 
        },{ 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        });
        
        await RiwayatPeranAdat.update({ 
          mulai_tanggal: safeObjectDateCerai,
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
        },{ 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, 
          transaction: t 
        });
      }

      await RiwayatPeranAdat.update({ 
        selesai_tanggal: tglKawinTerbaru 
      },{ 
        where: { 
          krama_id: [subDraftUpdate.suami_id, subDraftUpdate.istri_id],
          kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] },
          perkawinan_id: null 
        }, 
        transaction: t 
      });
      
      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
        await RiwayatKeluarga.update({ 
          awal_masuk: tglKawinTerbaru 
        },{ 
          where: { 
            perkawinan_id: perkawinan.id,
            krama_id: [perkawinan.suami_id, perkawinan.istri_id],
            kategori_event: "KAWIN"
          }, 
          transaction: t 
        });

        if (perkawinan.status_perkawinan !== "Kawin" && tanggalCeraiLama) {
          const safeObjectDateCerai = new Date(`${tanggalCeraiLama}T12:00:00`);

          await RiwayatKeluarga.update({ 
            akhir_masuk: safeObjectDateCerai 
          },{ 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: [perkawinan.suami_id, perkawinan.istri_id],
              kategori_event: "KAWIN",
              kedudukan: "Anggota" 
            }, 
            transaction: t 
          });

          await RiwayatKeluarga.update({ 
            awal_masuk: safeObjectDateCerai,
            dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
          },{ 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: [perkawinan.suami_id, perkawinan.istri_id],
              kategori_event: "CERAI"
            }, 
            transaction: t 
          });
        }
      } else {
        const pihakPredanaId = perkawinan.jenis_perkawinan === "Nyentana" ? perkawinan.suami_id : perkawinan.istri_id;

        await RiwayatKeluarga.update({ 
          awal_masuk: tglKawinTerbaru 
        },{ 
          where: { 
            perkawinan_id: perkawinan.id,
            kategori_event: "KAWIN"
          }, 
          transaction: t 
        });

        if (perkawinan.status_perkawinan !== "Kawin" && tanggalCeraiLama) {
          const safeObjectDateCerai = new Date(`${tanggalCeraiLama}T12:00:00`);

          await RiwayatKeluarga.update({ 
            akhir_masuk: safeObjectDateCerai 
          },{ 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: pihakPredanaId,
              kategori_event: "KAWIN"
            }, 
            transaction: t 
          });

          await RiwayatKeluarga.update({ 
            awal_masuk: safeObjectDateCerai,
            dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
          },{ 
            where: { 
              perkawinan_id: perkawinan.id,
              krama_id: pihakPredanaId,
              kategori_event: "CERAI"
            }, 
            transaction: t 
          });
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

      await perkawinan.update({
        tanggal_cerai: objectDateCeraiUntukDB,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        pihak_meninggal: subDraftUpdate.pihak_meninggal,
        pilihan_predana: subDraftUpdate.pilihan_predana,
        is_pending_update: isOtherDraftActive,
        data_perubahan: isOtherDraftActive ? restChanges : null,
        catatan_admin_desa: newCatatanAdmin
      }, { transaction: t });

      await Promise.all([
        RiwayatPeranAdat.update({ 
          selesai_tanggal: objectDateCeraiUntukDB 
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        }),
        RiwayatPeranAdat.update({ 
          mulai_tanggal: objectDateCeraiUntukDB,
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, 
          transaction: t 
        }),
        RiwayatKeluarga.update({ 
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, 
          transaction: t 
        })
      ]);

      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
        await RiwayatKeluarga.update({ 
          akhir_masuk: objectDateCeraiUntukDB 
        },{ 
          where: { 
            perkawinan_id: perkawinan.id,
            krama_id: [perkawinan.suami_id, perkawinan.istri_id],
            kategori_event: "KAWIN",
            kedudukan: "Anggota"
          }, 
          transaction: t 
        });

        await RiwayatKeluarga.update({ 
          awal_masuk: objectDateCeraiUntukDB 
        },{
          where: {
            perkawinan_id: perkawinan.id,
            krama_id: [perkawinan.suami_id, perkawinan.istri_id],
            kategori_event: "CERAI",
            akhir_masuk: null
          },
          transaction: t
        });
      } else {
        const pihakPredanaId = perkawinan.jenis_perkawinan === "Nyentana" ? perkawinan.suami_id : perkawinan.istri_id;

        await RiwayatKeluarga.update({ 
          akhir_masuk: objectDateCeraiUntukDB 
        },{ 
          where: { 
            perkawinan_id: perkawinan.id,
            krama_id: pihakPredanaId,
            kategori_event: "KAWIN"
          }, 
          transaction: t 
        });

        await RiwayatKeluarga.update({ 
          awal_masuk: objectDateCeraiUntukDB 
        },{
          where: {
            perkawinan_id: perkawinan.id,
            krama_id: pihakPredanaId,
            kategori_event: "CERAI",
            akhir_masuk: null
          },
          transaction: t
        });
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