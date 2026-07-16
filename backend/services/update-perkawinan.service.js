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

    if (!suamiLama || !istriLama) {
      throw new Error("Data suami atau istri tidak ditemukan.");
    }

    const isSatuDesaAdat = suamiLama.desa_adat_id === istriLama.desa_adat_id;

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
        if (suamiLama.desa_adat_id === user_desa_id || isSatuDesaAdat) {
          approvedSuami = true;
        }
        if (istriLama.desa_adat_id === user_desa_id || isSatuDesaAdat) {
          approvedIstri = true;
        }
      }
    } else {
      if (perkawinan.user_id === user_id) {
        isHakAkses = true;
      }
    }

    if (!isHakAkses) {
      throw new Error("Otoritas mengakses data ditolak! Anda tidak memiliki hak untuk mengusulkan perubahan pada data perkawinan ini.");
    }

    // SETTING NAMA DESA OPERATOR
    const userOperator = await User.findByPk(user_id, { 
      transaction: t 
    });

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let operatorIdentity = "Super Admin";

    if (user_role === "Admin Desa") {
      operatorIdentity = `Admin Desa ${user_desa_id}`;
      const kramaOperator = suamiLama.desa_adat_id === user_desa_id 
        ? suamiLama 
        : (istriLama.desa_adat_id === user_desa_id ? istriLama : null);

      if (kramaOperator?.wilayah_adat?.nama_desa_adat) {
        const namaBersih = kramaOperator.wilayah_adat.nama_desa_adat.replace(/Admin Desa\s+/i, "");
        operatorIdentity = `Admin Desa ${namaBersih}`;
      } else {
        const desa = await DesaAdat.findByPk(user_desa_id, { transaction: t });
        if (desa) {
          const namaBersih = desa.nama_desa_adat.replace(/Admin Desa\s+/i, "");
          operatorIdentity = `Admin Desa ${namaBersih}`;
        }
      }
    } else if (user_role === "Krama") {
      operatorIdentity = "Krama Pemilik Data"
    }

    // SETTING JALUR EKSEKUSI
    let isExecuteDirect = false;

    if (user_role === "Super Admin") {
      isExecuteDirect = true;
    } else if (user_role === "Admin Desa") {
      if (perkawinan.jenis_perkawinan !== "Pade Gelahang" || isSatuDesaAdat) {
        isExecuteDirect = true;
      } else {
        const draftKey = `UPDATE_${tipe_update}`;
        const drafUpdateLama = perkawinan.data_perubahan?.[draftKey] || {};
        
        let priorApprovedSuami = drafUpdateLama.approval_update_suami || false;
        let priorApprovedIstri = drafUpdateLama.approval_update_istri || false;

        if (suamiLama.desa_adat_id === user_desa_id) {
          priorApprovedSuami = true;
        }
        if (istriLama.desa_adat_id === user_desa_id) {
          priorApprovedIstri = true;
        }

        if (priorApprovedSuami && priorApprovedIstri) {
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

    subDraftUpdate.catatan_update = catatan_update || `Pengajuan draf pembaruan data ${tipe_update.toLowerCase()}.`;
    subDraftUpdate.diusulkan_oleh = operatorIdentity;
    subDraftUpdate.updated_at = new Date();

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

      const draftKey = `UPDATE_${tipe_update}`;
      const drafUpdateLama = existingChanges[draftKey] || {};

      subDraftUpdate.approval_update_suami = drafUpdateLama.approval_update_suami || (suamiLama.desa_adat_id === user_desa_id);
      subDraftUpdate.approval_update_istri = drafUpdateLama.approval_update_istri || (istriLama.desa_adat_id === user_desa_id);

      const draftUpdateFinal = { 
        ...existingChanges, 
        [draftKey]: subDraftUpdate 
      };

      const perkawinanDraf = await perkawinan.update({
        is_pending_update: true,
        status_sebelum_draft: perkawinan.status_verifikasi,
        data_perubahan: draftUpdateFinal,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Usulan draft perubahan data ${tipe_update.toLowerCase()} berhasil disimpan! Menunggu verifikasi dari Admin Desa Adat Pasangan.`,
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
    
    let tanggalCeraiLama = null;
    if (perkawinan.tanggal_cerai) {
      tanggalCeraiLama = perkawinan.tanggal_cerai instanceof Date 
        ? perkawinan.tanggal_cerai.toISOString().split('T')[0]
        : String(perkawinan.tanggal_cerai).split(' ')[0];
    }
    
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
    const teksHapusKawin = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perkawinan kosong).";
    const teksHapusCerai = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perceraian kosong).";

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
          status_verifikasi_update: `Data perkawinan berhasil diperbarui langsung oleh ${operatorIdentity}.`,
          last_updated_by: operatorIdentity
        }
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
          mulai_tanggal: new Date(perkawinan.tanggal_cerai),
          dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
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
        await RiwayatKeluarga.update({ 
          awal_masuk: tglKawinTerbaru 
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            krama_id: [perkawinan.suami_id, perkawinan.istri_id], 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        });

        if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
          await RiwayatKeluarga.update({ 
            akhir_masuk: new Date(perkawinan.tanggal_cerai) 
          }, { 
            where: { 
              perkawinan_id: perkawinan.id, 
              krama_id: [perkawinan.suami_id, perkawinan.istri_id], 
              kategori_event: "KAWIN", 
              kedudukan: "Anggota" 
            }, 
            transaction: t 
          });

          await RiwayatKeluarga.update({ 
            awal_masuk: new Date(perkawinan.tanggal_cerai),
            dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
          }, { 
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
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        });

        if (perkawinan.status_perkawinan !== "Kawin" && perkawinan.tanggal_cerai) {
          await RiwayatKeluarga.update({ 
            akhir_masuk: new Date(perkawinan.tanggal_cerai) 
          }, { 
            where: { 
              perkawinan_id: perkawinan.id, 
              krama_id: pihakPredanaId, 
              kategori_event: "KAWIN" 
            }, 
            transaction: t 
          });

          await RiwayatKeluarga.update({ 
            awal_masuk: new Date(perkawinan.tanggal_cerai),
            dasar_keputusan: db.fn('REPLACE', db.col('dasar_keputusan'), teksHapusCerai, '')
          }, { 
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
        is_pending_update: false,
        data_perubahan: null,
        catatan_admin_desa: {
          ...existingCatatan,
          status_verifikasi_update: `Data perceraian berhasil diperbarui langsung oleh ${operatorIdentity}.`,
          last_updated_by: operatorIdentity
        }
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
        }, { 
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
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            krama_id: [perkawinan.suami_id, perkawinan.istri_id], 
            kategori_event: "CERAI", 
            akhir_masuk: null 
          }, 
          transaction: t 
        });
      } else {
        const pihakPredanaId = perkawinan.jenis_perkawinan === "Nyentana" 
          ? perkawinan.suami_id 
          : perkawinan.istri_id;

        await RiwayatKeluarga.update({ 
          akhir_masuk: objectDateCeraiUntukDB 
        }, { 
          where: { 
            perkawinan_id: perkawinan.id, 
            krama_id: pihakPredanaId, 
            kategori_event: "KAWIN" 
          }, 
          transaction: t 
        });

        await RiwayatKeluarga.update({ 
          awal_masuk: objectDateCeraiUntukDB 
        }, { 
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
      type: "AUTO_APPROVED_SUKSES", 
      data: perkawinan 
    };
  } catch (error) {
    await t.rollback();
    throw error;
  }
};