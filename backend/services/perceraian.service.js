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

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const prosesPerceraianBali = async ({
  perkawinan_id,
  status_perkawinan, 
  tanggal_cerai,
  pihak_meninggal,
  pilihan_predana,
  user_id,
  user_role,
  user_desa_id
}, passedTransaction = null) => {
  // Mulai transaksi database yang dilewatkan
  const t = passedTransaction || await db.transaction();

  try {
    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, {
      transaction: t
    });

    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan.");
    }

    if (perkawinan.status_perkawinan !== "Kawin") {
      throw new Error("Perkawinan ini sudah tidak berstatus kawin.");
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

    // SETTING VALUE KETIKA TANGGAL CERAI NULL/STRING KOSONG
    const isTanggalCeraiKosong = !tanggal_cerai || tanggal_cerai === perkawinan.tanggal_perkawinan;

    let finalTanggalCerai;
    let infoTambahanDasar = "";

    if (isTanggalCeraiKosong) {
      const hariIni = new Date().toISOString().split('T')[0];
      if (hariIni === perkawinan.tanggal_perkawinan) {
        const besok = new Date();
        besok.setDate(besok.getDate() + 1);
        finalTanggalCerai = besok.toISOString().split('T')[0];
        infoTambahanDasar = " (Tanggal riwayat bergeser 1 hari karena tanggal cerai kosong dan sama dengan tanggal perkawinan).";
      } else {
        finalTanggalCerai = hariIni;
        infoTambahanDasar = " (Tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal cerai kosong).";
      }
    } else {
      if (tanggal_cerai === perkawinan.tanggal_perkawinan) {
        const dt = new Date(tanggal_cerai);
        dt.setDate(dt.getDate() + 1);
        finalTanggalCerai = dt.toISOString().split('T')[0];
        infoTambahanDasar = " (Tanggal riwayat otomatis bergeser 1 hari setelah tanggal perkawinan untuk linimasa riwayat).";
      } else {
        finalTanggalCerai = tanggal_cerai;
      }
    }

    // ===========================================================
    // MENENTUKAN STATUS APPROVAL BERDASARKAN ROLE
    // ===========================================================
    const isKramaAtauPerkawinanDraft = suami.status_verifikasi === "Draft" || 
      istri.status_verifikasi === "Draft" || 
      perkawinan.status_verifikasi === "Draft";

    let isExecuteDirect = false; 
    let statusVerifikasiPerceraian = "";
    let approvedSuami = perkawinan.is_approved_desa_suami;
    let approvedIstri = perkawinan.is_approved_desa_istri;

    if (user_role === "Super Admin") {
      if (isKramaAtauPerkawinanDraft && perkawinan.user_id !== user_id) {
        isExecuteDirect = false;
        statusVerifikasiPerceraian = "Usulan perceraian berhasil disimpan! Tertahan sementara karena data krama bali/perkawinan masih ditinjau.";
      } else {
        isExecuteDirect = true;
      }
    } else if (user_role === "Admin Desa") {
      let punyaHakKelola = false;

      if (jenis_perkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id) {
          punyaHakKelola = true;
        } 
      } else if (jenis_perkawinan === "Nyentana") {
        if (istri.desa_adat_id === user_desa_id) {
          punyaHakKelola = true;
        }
      } else {
        if (suami.desa_adat_id === user_desa_id) {
          punyaHakKelola = true;
        }
      }
      
      if (!punyaHakKelola) {
        throw new Error("Otoritas untuk mengelola data perceraian perkawinan ini ditolak!");
      }

      if (isKramaAtauPerkawinanDraft) {
        isExecuteDirect = false;
        statusVerifikasiPerceraian = "Usulan perceraian berhasil disimpan! Tertahan sementara karena data krama bali/perkawinan masih ditinjau.";
      } else {
        if (jenis_perkawinan === "Pade Gelahang") {
          if (suami.desa_adat_id === user_desa_id) approvedSuami = true;
          if (istri.desa_adat_id === user_desa_id) approvedIstri = true;

          if (approvedSuami && approvedIstri) {
            isExecuteDirect = true;
          } else {
            isExecuteDirect = false;
            statusVerifikasiPerceraian = "Usulan perceraian berhasil disimpan! Menunggu verifikasi data perceraian dari Admin Desa Pasangannya.";
          }
        } else {
          isExecuteDirect = true;
        }
      }
    } else {
      isExecuteDirect = false;
      statusVerifikasiPerceraian = "Usulan perceraian berhasil disimpan! Menunggu verifikasi dari Admin Desa.";
    }

    // SINKRONISASI NAMA DESA OPERATOR UNTUK AUDIT LOGS
    let namaDesaOperator = "Sistem (Input by Krama)";

    if (user_role === "Super Admin") {
      namaDesaOperator = "Super Admin";
    } else if (user_role === "Admin Desa") {
      namaDesaOperator = `Admin Desa ${user_desa_id}`;
      const kramaOperator = suami.desa_adat_id === user_desa_id 
        ? suami 
        : (istri.desa_adat_id === user_desa_id ? istri : null);

      if (kramaOperator?.wilayah_adat?.nama_desa_adat) {
        namaDesaOperator = kramaOperator.wilayah_adat.nama_desa_adat;
      }
    }

    // JALUR A: BUFFERING DATA PERUBAHAN (DRAFT)
    if (!isExecuteDirect) {
      const existingChanges = perkawinan.data_perubahan || {};

      const updatedPerkawinanDraft = await perkawinan.update({
        is_pending_update: true,
        status_sebelum_draft: perkawinan.status_verifikasi,
        data_perubahan: {
          ...existingChanges,
          PERCERAIAN: {
            status_sebelumnya: perkawinan.status_perkawinan,
            status_perkawinan,
            tanggal_cerai: finalTanggalCerai,
            pihak_meninggal,
            pilihan_predana,
            updated_at: finalTanggalCerai
          }
        },
        is_approved_desa_suami: approvedSuami,
        is_approved_desa_istri: approvedIstri,
        catatan_admin_desa: {
          ...perkawinan.catatan_admin_desa,
          status_verifikasi_perceraian: statusVerifikasiPerceraian,
          last_updated_by: namaDesaOperator
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

    // JALUR B: EKSEKUSI LANGSUNG (DISETUJUI)
    const catatanAdminPenutup = {
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

      // menentukan pihak meninggal
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

      // mapping decision tree untuk status peran adat
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
          perkawinan_id: perkawinan.id,
          status_peran_adat: keputusanSuami.status_peran_adat, 
          garis_keturunan: keputusanSuami.garis_keturunan, 
          dasar_keputusan: keputusanSuami.dasar_keputusan + infoTambahanDasar, 
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          event_date: finalTanggalCerai
        }, t);
      }
      if (!isIstriMeninggal) {
        await simpanRiwayatPeranAdat({ 
          krama_id: istri_id, 
          perkawinan_id: perkawinan.id,
          status_peran_adat: keputusanIstri.status_peran_adat, 
          garis_keturunan: keputusanIstri.garis_keturunan, 
          dasar_keputusan: keputusanIstri.dasar_keputusan + infoTambahanDasar, 
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          event_date: finalTanggalCerai 
        }, t);
      }

      const labelSilsilahSuami = keputusanSuami.status_peran_adat ? "Tetap" : "Kembali ke Asal";
      const labelSilsilahIstri = keputusanIstri.status_peran_adat ? "Tetap" : "Kembali ke Asal";

      // memutuskan hubungan silang keluarga
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

      // menutup keanggotaan silang suami dari keluarga pihak istri
      if (riwayatKKIstri) {
        await RiwayatKeluarga.update(
          { akhir_masuk: finalTanggalCerai },
          { 
            where: { 
              krama_id: suami_id, 
              keluarga_id: riwayatKKIstri.keluarga_id, 
              akhir_masuk: null 
            }, transaction: t 
          }
        );
      }

      // menutup keanggotaan silang istri dari keluarga pihak suami
      if (riwayatKKSuami) {
        await RiwayatKeluarga.update(
          { akhir_masuk: finalTanggalCerai },
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
        }, { transaction: t });

        await tutupRiwayatPeranAdat({ 
          krama_id: kramaMeninggal.id, 
          event_date: finalTanggalCerai, 
          bobot_baru: 4, t 
        });
        
        await tutupRiwayatKeluarga({ 
          krama_id: kramaMeninggal.id, 
          event_date: finalTanggalCerai, 
          bobot_baru: 4, t 
        });
      }

      const updatedPerkawinan = await perkawinan.update({
        status_perkawinan: status_perkawinan,
        status_verifikasi: "Disetujui",
        tanggal_cerai: finalTanggalCerai,
        pihak_meninggal: dbPihakMeninggal,
        ketetapan_silsilah_suami: labelSilsilahSuami,
        ketetapan_silsilah_istri: labelSilsilahIstri,
        catatan_admin_desa: catatanAdminPenutup,
        is_pending_update: false,
        status_sebelum_draft: null,
        data_perubahan: null
      }, { transaction: t });

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

    // mencari keluarga aktif karena perkawinan ini
    const riwayatKeluargaPerkawinan = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: purusa.id, 
        kedudukan: "Kepala Keluarga", 
        akhir_masuk: null 
      },
      transaction: t
    });

    const targetKeluargaId = riwayatKeluargaPerkawinan ? riwayatKeluargaPerkawinan.keluarga_id : null;

    let keputusanPurusa = "Tetap";
    let keputusanPredana = "Tetap";

    // mengubah string input pihak meninggal ke bentuk entitas object
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

    let opsiPredanaEfektif = status_perkawinan === "Cerai Hidup" ? "Kembali ke Asal" : pilihan_predana;

    // mapping keputusan decision tree untuk pihak purusa
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
        perkawinan_id: perkawinan.id,
        status_peran_adat: hasilPurusa.status_peran_adat, 
        garis_keturunan: hasilPurusa.garis_keturunan, 
        dasar_keputusan: hasilPurusa.dasar_keputusan + infoTambahanDasar, 
        kategori_event: "CERAI",
        bobot_event: BOBOT_EVENT["CERAI"],
        event_date: finalTanggalCerai 
      }, t);
    }

    // mapping keputusan decision tree untuk pihak predana
    const hasilPredana = await mappingAturanAdatBali("CERAI", {
      jenis_cerai: status_perkawinan,
      status_peran_sebelum: "Predana",
      pilihan_setelah_cerai: opsiPredanaEfektif,
      jenis_perkawinan_sebelum: jenis_perkawinan,
      posisi: predana.id === suami.id ? "suami" : "istri"
    }, t);

    // menentukan keputusan predana berdasarkan nilai opsi predana efektif
    if (opsiPredanaEfektif === "Kembali ke Asal") {
      keputusanPredana = "Kembali ke Asal";
    } else if (hasilPredana && hasilPredana.status_peran_adat) {
      keputusanPredana = "Tetap";
    } else {
      keputusanPredana = "Kembali ke Asal";
    }
    
    if (!isPredanaMeninggal) {
      if (keputusanPredana === "Tetap" && hasilPredana) {
        await simpanRiwayatPeranAdat({ 
          krama_id: predana.id, 
          perkawinan_id: perkawinan.id,
          status_peran_adat: hasilPredana.status_peran_adat, 
          garis_keturunan: hasilPredana.garis_keturunan, 
          dasar_keputusan: hasilPredana.dasar_keputusan + infoTambahanDasar, 
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          event_date: finalTanggalCerai 
        }, t);
      } else {
        await tutupRiwayatPeranAdat({ 
          krama_id: predana.id, 
          event_date: finalTanggalCerai, 
          bobot_baru: 4, t 
        });
        
        if (hasilPredana && hasilPredana.status_peran_adat) {
          await simpanRiwayatPeranAdat({ 
            krama_id: predana.id, 
            perkawinan_id: perkawinan.id,
            status_peran_adat: hasilPredana.status_peran_adat, 
            garis_keturunan: hasilPredana.garis_keturunan, 
            dasar_keputusan: hasilPredana.dasar_keputusan + infoTambahanDasar, 
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"],
            event_date: finalTanggalCerai 
          }, t);
        }
      } 
    }

    // mengelola data krama meninggal
    if (status_perkawinan === "Cerai Mati") {
      let kramaMeninggal = isPurusaMeninggal ? purusa : (isPredanaMeninggal ? predana : null);

      if (kramaMeninggal) {
        await kramaMeninggal.update({ 
          status_hidup: "Meninggal" 
        }, { transaction: t });

        await tutupRiwayatPeranAdat({ 
          krama_id: kramaMeninggal.id, 
          event_date: finalTanggalCerai, 
          bobot_baru: 4, t 
        });
        
        await tutupRiwayatKeluarga({ 
          krama_id: kramaMeninggal.id, 
          event_date: finalTanggalCerai, 
          bobot_baru: 4, t 
        });
      }
    }

    // memindahkan silsilah pihak predana
    if (predana && keputusanPredana === "Kembali ke Asal" && !isPredanaMeninggal) {
      await tutupRiwayatKeluarga({ 
        krama_id: predana.id, 
        event_date: finalTanggalCerai, 
        bobot_baru: 4, t 
      });
      
      const riwayatKeluargaAsal = await RiwayatKeluarga.findOne({
        where: {
          krama_id: predana.id,
          keluarga_id: { [Op.ne]: targetKeluargaId }
        },
        order: [["awal_masuk", "DESC"]],
        transaction: t
      });

      let isKeluargaTujuan = null;
      let kedudukanBaru = "Anggota";

      // mencari data keluarga sesuai riwayat keluarga
      if (!riwayatKeluargaAsal && predana.ayah_id) {
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
      } else if (riwayatKeluargaAsal) {
        const keluargaLama = await Keluarga.findByPk(riwayatKeluargaAsal.keluarga_id, { 
          transaction: t 
        });
        if (keluargaLama) {
          isKeluargaTujuan = keluargaLama.id;
          if (keluargaLama.status_keluarga === "Non-Aktif") {
            await keluargaLama.update({ 
              status_keluarga: "Aktif" 
            }, { transaction: t });
          }
        }
      }

      // membuat keluarga asal baru jika keluarga asal pihak predana tidak terdaftar
      if (!isKeluargaTujuan) {
        const keluargaAsalBaru = await Keluarga.create({
          kepala_keluarga_id: predana.id,
          jenis_keluarga: "Keluarga Asal",
          status_keluarga: "Aktif"
        }, { transaction: t });
        isKeluargaTujuan = keluargaAsalBaru.id;
        kedudukanBaru = "Kepala Keluarga";
      }

      await simpanRiwayatKeluarga({
        krama_id: predana.id,
        keluarga_id: isKeluargaTujuan,
        perkawinan_id: perkawinan.id,
        kedudukan: kedudukanBaru,
        kategori_event: "CERAI",
        bobot_event: BOBOT_EVENT["CERAI"],
        dasar_keputusan: "Kedudukan diberikan karena krama kembali ke keluarga asal setelah perceraian.",
        event_date: finalTanggalCerai,
        allow_multiple: false
      }, t);
    }

    const updatedPerkawinanInstance = await perkawinan.update({
      status_perkawinan,
      status_verifikasi: "Disetujui",
      tanggal_cerai: finalTanggalCerai,
      pihak_meninggal: status_perkawinan === "Cerai Mati" ? pihak_meninggal : null,
      ketetapan_silsilah_suami: jenis_perkawinan === "Pade Gelahang" 
        ? (keputusanSuami.status_peran_adat ? "Tetap" : "Kembali ke Asal") 
        : (purusa.id === suami_id ? keputusanPurusa : keputusanPredana),
      ketetapan_silsilah_istri: jenis_perkawinan === "Pade Gelahang" 
        ? (keputusanIstri.status_peran_adat ? "Tetap" : "Kembali ke Asal") 
        : (purusa.id === istri_id ? keputusanPurusa : keputusanPredana),
      catatan_admin_desa: catatanAdminPenutup,
      is_approved_desa_suami: true,
      is_approved_desa_istri: true,
      is_pending_update: false,
      status_sebelum_draft: null,
      data_perubahan: null
    }, { transaction: t });

    // menutup keluarga lama jika tidak ada anggota keluarga
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