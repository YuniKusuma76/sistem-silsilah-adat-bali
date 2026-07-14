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

    if (perkawinan.status_perkawinan === "Kawin" && status_perkawinan && status_perkawinan !== "Kawin") {
      throw new Error("Proses memperbarui data ditolak! Anda tidak dapat mengubah status perkawinan aktif menjadi cerai melalui pembaruan ini. Gunakan modul Ajukan Perceraian.");
    }

    if (perkawinan.status_perkawinan !== "Kawin" && status_perkawinan === "Kawin") {
      throw new Error("Proses memperbarui data ditolak! Perkawinan yang sudah berstatus cerai tidak dapat dikembalikan menjadi aktif melalui pembaruan ini.");
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
        if (suamiLama.desa_adat_id === user_desa_id) approvedSuami = true;
        if (istriLama.desa_adat_id === user_desa_id) approvedIstri = true;
      }
    } else {
      if (perkawinan.user_id === user_id) {
        isHakAkses = true;
      }
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
      
      const isTglKawinBerubah = (tanggal_event && tanggal_event !== perkawinan.tanggal_perkawinan);
      
      subDraftUpdate = {
        suami_id: suami_id || perkawinan.suami_id,
        istri_id: istri_id || perkawinan.istri_id,
        tanggal_perkawinan: tanggal_event || perkawinan.tanggal_perkawinan,
        jenis_perkawinan: jenis_perkawinan || perkawinan.jenis_perkawinan,
        status_perkawinan: perkawinan.status_perkawinan,
        is_perubahan_ekstrem: isDataUtamaBerubah,
        is_pergeseran_tanggal: isTglKawinBerubah
      };
    } else if (tipe_update === "PERCERAIAN") {
      const isTglCeraiBerubah = tanggal_event && tanggal_event !== perkawinan.tanggal_cerai;

      subDraftUpdate = {
        tanggal_cerai: tanggal_event || perkawinan.tanggal_cerai,
        status_perkawinan: status_perkawinan || perkawinan.status_perkawinan,
        pihak_meninggal: pihak_meninggal || perkawinan.pihak_meninggal,
        pilihan_predana: pilihan_predana || perkawinan.pilihan_predana,
        is_pergeseran_tanggal: isTglCeraiBerubah
      };
    }

    const userOperator = await User.findByPk(user_id, { 
      transaction: t 
    });

    subDraftUpdate.catatan_update = catatan_update || `Pengajuan draft perubahan data ${tipe_update.toLowerCase()}.`;
    subDraftUpdate.diusulkan_oleh = `${user_role} (${userOperator?.display_name})`;
    subDraftUpdate.updated_at = new Date();

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let operatorIdentity = user_role;

    if (user_role === "Admin Desa") {
      const kramaOperator = suamiLama.desa_adat_id === user_desa_id 
        ? suamiLama 
        : (istriLama.desa_adat_id === user_desa_id ? istriLama : null);

      if (kramaOperator?.wilayah_adat?.nama_desa_adat) {
        operatorIdentity = `Admin Desa ${kramaOperator.wilayah_adat.nama_desa_adat}`;
      } else {
        const desa = await DesaAdat.findByPk(user_desa_id, { 
          transaction: t 
        });
        operatorIdentity = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
      }
    }

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

      let finalApprovedSuami = perkawinan.is_approved_desa_suami || approvedSuami;
      let finalApprovedIstri = perkawinan.is_approved_desa_istri || approvedIstri;
      const draftKey = `UPDATE_${tipe_update}`;

      subDraftUpdate.is_approved_desa_suami = approvedSuami;
      subDraftUpdate.is_approved_desa_istri = approvedIstri;

      const draftUpdateFinal = { 
        ...existingChanges, 
        [draftKey]: subDraftUpdate 
      };

      const perkawinanDraf = await perkawinan.update({
        is_pending_update: true,
        status_sebelum_draft: perkawinan.status_verifikasi,
        data_perubahan: draftUpdateFinal,
        is_approved_desa_suami: finalApprovedSuami,
        is_approved_desa_istri: finalApprovedIstri,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Usulan perubahan data ${tipe_update.toLowerCase()} berhasil disimpan! Menunggu verifikasi dari pihak Admin Desa Adat Pasangan.`,
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
    const pilihanPredanaLama = perkawinan.pilihan_predana;
    
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

      const idSuamiLama = perkawinan.suami_id;
      const idIstriLama = perkawinan.istri_id;
      const idPerkawinanLama = perkawinan.id;

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
        throw new Error("Data suami atau istri baru tidak ditemukan.");
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
          user_id, 
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
            tanggal_cerai: tanggalCeraiLama || tglKawinTerbaruStr,
            pihak_meninggal: pihakMeninggalLama,
            pilihan_predana: pilihanPredanaLama || subDraftUpdate.pilihan_predana,
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

      if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
        if (new Date(tglKawinTerbaru) > new Date(perkawinan.tanggal_cerai)) {
          throw new Error("Tanggal perkawinan baru tidak boleh melampaui tanggal perceraian yang telah terdaftar.");
        }
      }

      await perkawinan.update({
        suami_id: subDraftUpdate.suami_id,
        istri_id: subDraftUpdate.istri_id,
        tanggal_perkawinan: tglPerkawinanMurni,
        jenis_perkawinan: subDraftUpdate.jenis_perkawinan,
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Data perkawinan berhasil diperbarui secara langsung oleh ${user_role}.`,
          last_updated_by: operatorIdentity
        }
      }, { transaction: t });

      await RiwayatPeranAdat.update({ 
        mulai_tanggal: tglKawinTerbaru 
      }, { 
        where: { 
          perkawinan_id: perkawinan.id, 
          kategori_event: "KAWIN" 
        }, 
        transaction: t 
      });

      if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
        await RiwayatPeranAdat.update({ 
          selesai_tanggal: new Date(perkawinan.tanggal_cerai) 
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        });
        
        await RiwayatPeranAdat.update({ 
          mulai_tanggal: new Date(perkawinan.tanggal_cerai) 
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, 
          transaction: t 
        });
      }

      await RiwayatPeranAdat.update({ 
        selesai_tanggal: tglKawinTerbaru 
      }, { 
        where: { 
          krama_id: [subDraftUpdate.suami_id, subDraftUpdate.istri_id], 
          kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] }, 
          perkawinan_id: null 
        }, 
        transaction: t 
      });

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

      await perkawinan.update({
        tanggal_cerai: objectDateCeraiUntukDB,
        status_perkawinan: subDraftUpdate.status_perkawinan,
        pihak_meninggal: subDraftUpdate.pihak_meninggal,
        pilihan_predana: subDraftUpdate.pilihan_predana,
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Data perceraian berhasil diperbarui secara langsung oleh ${user_role}.`,
          last_updated_by: operatorIdentity
        }
      }, { transaction: t });

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

      await RiwayatPeranAdat.update(
        { mulai_tanggal: objectDateCeraiUntukDB }, 
        { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "CERAI" 
          }, 
          transaction: t 
        }
      );

      if (perkawinan.jenis_perkawinan === "Pade Gelahang") {
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
      type: "AUTO_APPROVED_SUKSES", 
      data: perkawinan 
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};