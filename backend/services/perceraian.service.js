import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  RiwayatKeluarga,
  Keluarga
} from "../models/associations.js";
import { 
  tutupRiwayatPeranAdat,
  simpanRiwayatPeranAdat
} from "./riwayat-peran-adat.service.js";
import { 
  simpanRiwayatKeluarga, 
  tutupRiwayatKeluarga 
} from "./riwayat-keluarga.service.js";
import { mappingAturanAdatBali } from "./decision-tree.service.js";

export const prosesPerceraianBali = async ({
  perkawinan_id,
  status_perkawinan, 
  tanggal_cerai,
  pihak_meninggal,
  pilihan_predana,
  is_admin_direct = false,
  user_role,
  user_desa_id
}, passedTransaction = null) => {
  // Mulai transaksi database
  const t = passedTransaction || await db.transaction();

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
      jenis_perkawinan 
    } = perkawinan;

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

    // ROLE KRAMA: Mengalihkan data perceraian ke draft data perubahan JSONB
    if (!is_admin_direct) {
      const existingChanges = perkawinan.data_perubahan || {};

      const updatedPerkawinanDraft = await perkawinan.update({
        is_pending_update: true,
        status_sebelum_draft: perkawinan.status_verifikasi,
        data_perubahan: {
          ...existingChanges,
          PERCERAIAN: {
            status_sebelumnya: perkawinan.status_perkawinan,
            status_perkawinan,
            tanggal_cerai,
            pihak_meninggal,
            pilihan_predana,
            updated_at: new Date()
          }
        },
        catatan_admin_desa: {
          ...perkawinan.catatan_admin_desa,
          status_verifikasi_perceraian: "Usulan perceraian sedang dalam proses verifikasi Admin Desa.",
          last_updated_by: "Sistem (Input by Krama)"
        }
      }, { transaction: t });

      if (!passedTransaction) {
        await t.commit();
      }

      return {
        perkawinan_id,
        is_pending_update: true,
        data_perkawinan: updatedPerkawinanDraft
      };
    }

    // Validasi integritas data krama bali jika dieksekusi admin
    if (suami.status_verifikasi === "Draft" || istri.status_verifikasi === "Draft") {
      throw new Error("Proses verifikasi dihentikan! Data krama kedua belah pihak belum terverifikasi.");
    }

    // MENYUSUN STRUKTUR JSONB UNTUK CATATAN ADMIN DESA
    let namaDesaOperator = `Admin Desa ${user_desa_id}`;

    if (user_role === "Admin Desa") {
      const kramaBali = suami.desa_adat_id === user_desa_id 
        ? suami 
        : (istri.desa_adat_id === user_desa_id ? istri : null);
      if (kramaBali?.wilayah_adat?.nama_desa_adat) {
        namaDesaOperator = kramaBali.wilayah_adat.nama_desa_adat;
      }
    } else if (user_role === "Super Admin") {
      namaDesaOperator = "Super Admin";
    }

    const catatanAdmin = {
      ...perkawinan.catatan_admin_desa,
      status_verifikasi_perceraian: `Perceraian telah diproses dan disetujui langsung oleh ${user_role}.`,
      last_updated_by: namaDesaOperator
    };
    
    // ==========================================
    // CASE 1: PERKAWINAN PADE GELAHANG
    // ==========================================
    if (jenis_perkawinan === "Pade Gelahang") {
      let kramaMeninggal = null;
      let dbPihakMeninggal = null; 

      // Menentukan pihak meninggal
      if (status_perkawinan === "Cerai Mati") {
        if (pihak_meninggal === "Suami") {
          kramaMeninggal = suami;
          dbPihakMeninggal = "Suami";
        } else if (pihak_meninggal === "Istri") {
          kramaMeninggal = istri;
          dbPihakMeninggal = "Istri"; 
        }
      }

      let isSuamiMeninggal = status_perkawinan === "Cerai Mati" && pihak_meninggal === "Suami";
      let isIstriMeninggal = status_perkawinan === "Cerai Mati" && pihak_meninggal === "Istri";

      // Mapping decision tree untuk status peran adat
      const [keputusanSuami, keputusanIstri] = await Promise.all([
        mappingAturanAdatBali("CERAI", { 
          jenis_cerai: status_perkawinan, 
          status_peran_sebelum: "Purusa", 
          pilihan_setelah_cerai: "Tetap", 
          jenis_perkawinan_sebelum: "Pade Gelahang", 
          posisi: "suami" 
        }, t),
        mappingAturanAdatBali("CERAI", { 
          jenis_cerai: status_perkawinan, 
          status_peran_sebelum: "Purusa", 
          pilihan_setelah_cerai: "Tetap", 
          jenis_perkawinan_sebelum: "Pade Gelahang", 
          posisi: "istri" 
        }, t)
      ]);

      if (!isSuamiMeninggal) {
        await simpanRiwayatPeranAdat({ 
          krama_id: suami_id, 
          status_peran_adat: keputusanSuami.status_peran_adat, 
          garis_keturunan: keputusanSuami.garis_keturunan, 
          dasar_keputusan: keputusanSuami.dasar_keputusan, 
          event_date: tanggal_cerai 
        }, t);
      }
      if (!isIstriMeninggal) {
        await simpanRiwayatPeranAdat({ 
          krama_id: istri_id, 
          status_peran_adat: keputusanIstri.status_peran_adat, 
          garis_keturunan: keputusanIstri.garis_keturunan, 
          dasar_keputusan: keputusanIstri.dasar_keputusan, 
          event_date: tanggal_cerai 
        }, t);
      }

      const labelSilsilahSuami = keputusanSuami.status_peran_adat ? "Tetap" : "Kembali ke Asal";
      const labelSilsilahIstri = keputusanIstri.status_peran_adat ? "Tetap" : "Kembali ke Asal";

      // Memutuskan hubungan silang/cross-membership keluarga
      const [riwayatKKSuami, riwayatKKIstri] = await Promise.all([
        RiwayatKeluarga.findOne({ 
          where: { 
            krama_id: suami_id, 
            kedudukan: "Kepala Keluarga", 
            akhir_masuk: null 
          }, 
          include: [{ 
            model: Keluarga, 
            as: "detail_keluarga", 
            where: { 
              jenis_keluarga: "Pade Gelahang" 
            } 
          }], transaction: t 
        }),
        RiwayatKeluarga.findOne({ 
          where: { 
            krama_id: istri_id, 
            kedudukan: "Kepala Keluarga", 
            akhir_masuk: null 
          }, 
          include: [{ 
            model: Keluarga, 
            as: "detail_keluarga", 
            where: { 
              jenis_keluarga: "Pade Gelahang" 
            } 
          }], transaction: t 
        })
      ]);

      // Putus keanggotaan silang suami dari keluarga Pade Gelahang milik Istri
      if (riwayatKKIstri) {
        await RiwayatKeluarga.update(
          { akhir_masuk: tanggal_cerai },
          { 
            where: { 
              krama_id: suami_id, 
              keluarga_id: riwayatKKIstri.keluarga_id, 
              akhir_masuk: null 
            }, transaction: t 
          }
        );
      }

      // Putus keanggotaan silang istri dari keluarga Pade Gelahang milik Suami
      if (riwayatKKSuami) {
        await RiwayatKeluarga.update(
          { akhir_masuk: tanggal_cerai },
          { 
            where: { 
              krama_id: istri_id, 
              keluarga_id: riwayatKKSuami.keluarga_id, 
              akhir_masuk: null 
            }, transaction: t 
          }
        );
      }

      if (kramaMeninggal) {
        await kramaMeninggal.update({ 
          status_hidup: "Meninggal" 
        }, { 
          transaction: t 
        });
        await tutupRiwayatPeranAdat(kramaMeninggal.id, tanggal_cerai, t);
        await tutupRiwayatKeluarga(kramaMeninggal.id, tanggal_cerai, t);
      }

      const updatedPerkawinan = await perkawinan.update({
        status_perkawinan: status_perkawinan,
        status_verifikasi: "Disetujui",
        tanggal_cerai: tanggal_cerai,
        pihak_meninggal: dbPihakMeninggal,
        ketetapan_silsilah_suami: labelSilsilahSuami,
        ketetapan_silsilah_istri: labelSilsilahIstri,
        catatan_admin_desa: catatanAdmin,
        is_pending_update: false,
        status_sebelum_draft: null,
        data_perubahan: null
      }, { 
        transaction: t 
      });

      if (!passedTransaction) {
        await t.commit();
      }

      return { 
        perkawinan_id, 
        status_perkawinan, 
        data_perkawinan: updatedPerkawinan 
      };
    }

    // ==========================================
    // CASE 2: PERKAWINAN BIASA dan NYENTANA
    // ==========================================
    let purusa, predana;
    if (jenis_perkawinan === "Nyentana") {
      purusa = istri;
      predana = suami;
    } else {
      purusa = suami;
      predana = istri; 
    }

    // Mencari keluarga aktif karena perkawinan ini
    const riwayatKKPernikahan = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: purusa.id, 
        kedudukan: "Kepala Keluarga", 
        akhir_masuk: null 
      },
      transaction: t
    });

    const targetKeluargaId = riwayatKKPernikahan 
      ? riwayatKKPernikahan.keluarga_id 
      : null;

    let keputusanPurusa = "Tetap";
    let keputusanPredana = "Tetap";

    // Mengubah string input pihak meninggal ke bentuk entitas object
    let isPurusaMeninggal = status_perkawinan === "Cerai Mati" && (
      pihak_meninggal === "Purusa" || pihak_meninggal === (
        purusa.id === suami_id ? "Suami" : "Istri"
      )
    );
    let isPredanaMeninggal = status_perkawinan === "Cerai Mati" && (
      pihak_meninggal === "Predana" || pihak_meninggal === (
        predana.id === suami_id ? "Suami" : "Istri"
      )
    );

    let opsiPredanaEfektif = pilihan_predana;
    if (status_perkawinan === "Cerai Hidup") {
      opsiPredanaEfektif = "Kembali ke Asal";
    }

    // Mapping keputusan decision tree untuk pihak purusa
    const hasilPurusa = await mappingAturanAdatBali("CERAI", {
      jenis_cerai: status_perkawinan,
      status_peran_sebelum: "Purusa",
      pilihan_setelah_cerai: "Tetap",
      jenis_perkawinan_sebelum: jenis_perkawinan,
      posisi: purusa.id === suami.id ? "suami" : "istri"
    }, t);

    if (!isPurusaMeninggal) {
      await simpanRiwayatPeranAdat({ 
        krama_id: purusa.id, 
        status_peran_adat: hasilPurusa.status_peran_adat, 
        garis_keturunan: hasilPurusa.garis_keturunan, 
        dasar_keputusan: hasilPurusa.dasar_keputusan, 
        event_date: tanggal_cerai 
      }, t);
    }

    // Mapping keputusan decision tree untuk pihak predana
    const hasilPredana = await mappingAturanAdatBali("CERAI", {
      jenis_cerai: status_perkawinan,
      status_peran_sebelum: "Predana",
      pilihan_setelah_cerai: opsiPredanaEfektif,
      jenis_perkawinan_sebelum: jenis_perkawinan,
      posisi: predana.id === suami.id ? "suami" : "istri"
    }, t);

    // Menentukan keputusan predana berdasarkan nilai opsi predana efektif
    if (opsiPredanaEfektif === "Kembali ke Asal") {
      keputusanPredana = "Kembali ke Asal";
    } else if (hasilPredana && hasilPredana.status_peran_adat) {
      keputusanPredana = "Tetap";
    } else {
      keputusanPredana = "Kembali ke Asal";
    }
    
    if (keputusanPredana === "Tetap") {
      if (!isPredanaMeninggal && hasilPredana) {
        await simpanRiwayatPeranAdat({ 
          krama_id: predana.id, 
          status_peran_adat: hasilPredana.status_peran_adat, 
          garis_keturunan: hasilPredana.garis_keturunan, 
          dasar_keputusan: hasilPredana.dasar_keputusan, 
          event_date: tanggal_cerai 
        }, t);
      }
    } else {
      if (!isPredanaMeninggal) {
        await tutupRiwayatPeranAdat(predana.id, tanggal_cerai, t);
        if (hasilPredana && hasilPredana.status_peran_adat) {
          await simpanRiwayatPeranAdat({ 
            krama_id: predana.id, 
            status_peran_adat: hasilPredana.status_peran_adat, 
            garis_keturunan: hasilPredana.garis_keturunan, 
            dasar_keputusan: hasilPredana.dasar_keputusan, 
            event_date: tanggal_cerai 
          }, t);
        }
      }
    }

    // Mengelola data krama meninggal
    if (status_perkawinan === "Cerai Mati") {
      let kramaMeninggal = isPurusaMeninggal 
        ? purusa 
        : (isPredanaMeninggal ? predana : null);
      if (kramaMeninggal) {
        await kramaMeninggal.update({ 
          status_hidup: "Meninggal" 
        }, { 
          transaction: t 
        });
        await tutupRiwayatPeranAdat(kramaMeninggal.id, tanggal_cerai, t);
        await tutupRiwayatKeluarga(kramaMeninggal.id, tanggal_cerai, t);
      }
    }

    // Memindahkan silsilah pihak predana
    if (predana && keputusanPredana === "Kembali ke Asal" && !isPredanaMeninggal) {
      await tutupRiwayatKeluarga(predana.id, tanggal_cerai, t);

      // Mencari keluarga asal pihak predana
      const riwayatAsal = await RiwayatKeluarga.findOne({
        where: {
          krama_id: predana.id,
          keluarga_id: { [Op.ne]: targetKeluargaId }
        },
        order: [["awal_masuk", "DESC"]],
        transaction: t
      });

      let isKeluargaTujuan = null;
      let kedudukanBaru = "Anggota";

      // Mencari data keluarga sesuai riwayat keluarga
      if (!riwayatAsal && predana.ayah_id) {
        const keluargaAyah = await Keluarga.findOne({
          where: { 
            kepala_keluarga_id: predana.ayah_id, 
            status_keluarga: "Aktif" 
          },
          transaction: t
        });
        if (keluargaAyah) {
          isKeluargaTujuan = keluargaAyah.id;
        }
      } else if (riwayatAsal) {
        const keluargaLama = await Keluarga.findByPk(riwayatAsal.keluarga_id, { 
          transaction: t 
        });
        if (keluargaLama) {
          isKeluargaTujuan = keluargaLama.id;
          if (keluargaLama.status_keluarga === "Non-Aktif") {
            await keluargaLama.update({ 
              status_keluarga: "Aktif" 
            }, { 
              transaction: t 
            });
          }
        }
      }

      // Membuat keluarga asal baru jika keluarga asal pihak predana tidak terdaftar
      if (!isKeluargaTujuan) {
        const keluargaBaruAsal = await Keluarga.create({
          kepala_keluarga_id: predana.id,
          jenis_keluarga: "Keluarga Asal",
          status_keluarga: "Aktif"
        }, { 
          transaction: t 
        });
        isKeluargaTujuan = keluargaBaruAsal.id;
        kedudukanBaru = "Kepala Keluarga";
      }

      await simpanRiwayatKeluarga({
        krama_id: predana.id,
        keluarga_id: isKeluargaTujuan,
        kedudukan: kedudukanBaru,
        dasar_keputusan: "Kedudukan diberikan karena krama kembali ke keluarga asal setelah perceraian.",
        event_date: tanggal_cerai,
        allow_multiple: false 
      }, t);
    }

    const updatedPerkawinanInstance = await perkawinan.update({
      status_perkawinan,
      status_verifikasi: "Disetujui",
      tanggal_cerai,
      pihak_meninggal: status_perkawinan === "Cerai Mati" 
        ? pihak_meninggal 
        : null,
      ketetapan_silsilah_suami: purusa.id === suami_id 
        ? keputusanPurusa 
        : keputusanPredana,
      ketetapan_silsilah_istri: purusa.id === istri_id 
        ? keputusanPurusa 
        : keputusanPredana,
      catatan_admin_desa: catatanAdmin,
      is_pending_update: false,
      status_sebelum_draft: null,
      data_perubahan: null
    }, { 
      transaction: t 
    });

    // Menutup keluarga lama jika tidak ada anggota keluarga
    if (targetKeluargaId) {
      const anggotaAktif = await RiwayatKeluarga.count({
        where: { 
          keluarga_id: targetKeluargaId, 
          akhir_masuk: null 
        },
        transaction: t
      });
      if (anggotaAktif === 0) {
        await Keluarga.update({ 
          status_keluarga: "Non-Aktif" 
        }, { 
          where: { id: targetKeluargaId }, 
          transaction: t 
        });
      }
    }

    if (!passedTransaction) {
      await t.commit();
    }

    return {
      perkawinan_id,
      status_perkawinan,
      keputusan_predana: keputusanPredana,
      data_perkawinan: updatedPerkawinanInstance
    };
  } catch (error) {
    if (!passedTransaction) {
      await t.rollback();
    }
    throw error;
  }
};