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
}, t) => {
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
    const stringTanggalPerkawinan = perkawinan.tanggal_perkawinan; // Format dari DB: YYYY-MM-DD

    let finalTanggalCerai;
    let infoTambahanDasar = "";
    let stringDateCeraiOnly = "";

    if (tanggal_cerai) {
      if (tanggal_cerai instanceof Date) {
        stringDateCeraiOnly = tanggal_cerai.toISOString().split('T')[0];
      } else if (typeof tanggal_cerai === 'string' && tanggal_cerai.trim() !== "") {
        let rawDateStr = tanggal_cerai.includes('T') 
          ? tanggal_cerai.split('T')[0] 
          : tanggal_cerai.split(' ')[0];

        if (rawDateStr.includes('-') && rawDateStr.split('-')[0].length === 2) {
          const [dd, mm, yyyy] = rawDateStr.split('-');
          stringDateCeraiOnly = `${yyyy}-${mm}-${dd}`;
        } else {
          stringDateCeraiOnly = rawDateStr;
        }
      }
    }

    if (!stringDateCeraiOnly || stringDateCeraiOnly === stringTanggalPerkawinan) {
      const waktuSekarang = new Date();
      waktuSekarang.setSeconds(waktuSekarang.getSeconds() + 5);
      finalTanggalCerai = waktuSekarang;
      infoTambahanDasar = " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal perceraian kosong).";
    } else {
      const jamSekarang = new Date().toTimeString().split(' ')[0];
      finalTanggalCerai = new Date(`${stringDateCeraiOnly} ${jamSekarang}`);
    }

    // ===========================================================
    // MENENTUKAN STATUS APPROVAL BERDASARKAN ROLE
    // ===========================================================
    const isKramaAtauPerkawinanDraft = suami.status_verifikasi === "Draft" || istri.status_verifikasi === "Draft" || perkawinan.status_verifikasi === "Draft";
    let isExecuteDirect = false; 
    let statusVerifikasiPerceraian = "";
    let approvedSuami = perkawinan.is_approved_desa_suami;
    let approvedIstri = perkawinan.is_approved_desa_istri;

    if (user_role === "Super Admin") {
      if (isKramaAtauPerkawinanDraft && perkawinan.user_id !== user_id) {
        isExecuteDirect = false;
        statusVerifikasiPerceraian = "Usulan perceraian berhasil disimpan! Status draft sementara karena data krama bali/perkawinan masih ditinjau.";
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
        statusVerifikasiPerceraian = "Usulan perceraian berhasil disimpan! Status draft sementara karena data krama bali/perkawinan masih ditinjau.";
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
      const kramaOperator = suami.desa_adat_id === user_desa_id ? suami : (istri.desa_adat_id === user_desa_id ? istri : null);
      
      if (kramaOperator?.wilayah_adat?.nama_desa_adat) {
        const namaBersih = kramaOperator.wilayah_adat.nama_desa_adat.replace(/Admin Desa\s+/i, "");
        namaDesaOperator = `Admin Desa ${namaBersih}`;
      }
    }

    // JALUR A: BUFFERING DATA PERUBAHAN (DRAFT)
    if (!isExecuteDirect) {
      const existingChanges = perkawinan.data_perubahan || {};
      const stringTanggalCeraiDraft = finalTanggalCerai.toISOString();

      const updatedPerkawinanDraft = await perkawinan.update({
        is_pending_update: true,
        status_sebelum_draft: perkawinan.status_verifikasi,
        data_perubahan: {
          ...existingChanges,
          PERCERAIAN: {
            status_sebelumnya: perkawinan.status_perkawinan,
            status_perkawinan,
            tanggal_cerai: stringTanggalCeraiDraft,
            pihak_meninggal,
            pilihan_predana,
            updated_at: stringTanggalCeraiDraft
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
    
    // CASE 1: PERKAWINAN PADE GELAHANG
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

      let opsiSilsilahSuami = isSuamiMeninggal ? "Tetap" : (isIstriMeninggal ? pilihan_predana : "Tetap");
      let opsiSilsilahIstri = isIstriMeninggal ? "Tetap" : (isSuamiMeninggal ? pilihan_predana : "Tetap");

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
        await tutupRiwayatPeranAdat({ 
          krama_id: suami_id, 
          event_date: finalTanggalCerai, 
          bobot_baru: BOBOT_EVENT["CERAI"], t 
        });

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
        await tutupRiwayatPeranAdat({ 
          krama_id: istri_id, 
          event_date: finalTanggalCerai, 
          bobot_baru: BOBOT_EVENT["CERAI"], t 
        });

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

      const labelSilsilahSuami = opsiSilsilahSuami === "Tetap" ? "Tetap" : "Kembali ke Asal";
      const labelSilsilahIstri = opsiSilsilahIstri === "Tetap" ? "Tetap" : "Kembali ke Asal";

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

      if (status_perkawinan === "Cerai Mati") {
        if (isSuamiMeninggal) {
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

          if (labelSilsilahIstri !== "Tetap" && riwayatKKSuami) {
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
        } else if (isIstriMeninggal) {
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

          if (labelSilsilahSuami !== "Tetap" && riwayatKKIstri) {
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
        }
      } else {
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
        tanggal_cerai: finalTanggalCerai.toISOString().split('T')[0],
        pihak_meninggal: dbPihakMeninggal,
        ketetapan_silsilah_suami: labelSilsilahSuami,
        ketetapan_silsilah_istri: labelSilsilahIstri,
        catatan_admin_desa: catatanAdminPenutup,
        is_pending_update: false,
        status_sebelum_draft: null,
        data_perubahan: null
      }, { transaction: t });

      if (isSuamiMeninggal) {
        const perkawinanPoligamiLainnya = await Perkawinan.findAll({
          where: {
            suami_id: suami_id,
            status_perkawinan: "Kawin",
            id: { [Op.ne]: perkawinan.id }
          },
          transaction: t
        });

        for (const pLain of perkawinanPoligamiLainnya) {
          const targetPihakMeninggal = pLain.jenis_perkawinan === "Nyentana" ? "Purusa" : "Suami";
          await prosesPerceraianBali({
            perkawinan_id: pLain.id,
            status_perkawinan: "Cerai Mati",
            tanggal_cerai: finalTanggalCerai,
            pihak_meninggal: targetPihakMeninggal,
            pilihan_predana: "Tetap",
            user_id,
            user_role,
            user_desa_id
          }, t);
        }
      }

      return { 
        perkawinan_id, 
        status_perkawinan, 
        data_perkawinan: updatedPerkawinan 
      };
    }

    // CASE 2: PERKAWINAN BIASA dan NYENTANA
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
      await tutupRiwayatPeranAdat({ 
        krama_id: purusa.id, 
        event_date: finalTanggalCerai, 
        bobot_baru: BOBOT_EVENT["CERAI"], t 
      });

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
        await tutupRiwayatPeranAdat({ 
          krama_id: predana.id, 
          event_date: finalTanggalCerai, 
          bobot_baru: BOBOT_EVENT["CERAI"], t 
        });
        
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

    // memindahkan silsilah pihak predana
    if (predana && keputusanPredana === "Kembali ke Asal" && !isPredanaMeninggal) {
      await tutupRiwayatKeluarga({ 
        krama_id: predana.id, 
        event_date: finalTanggalCerai, 
        bobot_baru: BOBOT_EVENT["CERAI"], t 
      });
      
      const riwayatMasaLalu = await RiwayatKeluarga.findOne({
        where: {
          krama_id: predana.id,
          keluarga_id: { [Op.ne]: targetKeluargaId },
          [Op.or]: [{ 
            kategori_event: { [Op.in]: ["LAHIR", "PENGANGKATAN"] } 
          },{ 
            kategori_event: "CERAI",
            perkawinan_id: perkawinan.id 
          }]
        },
        order: [["awal_masuk", "DESC"]],
        transaction: t
      });

      let isKeluargaTujuan = null;
      let kedudukanBaru = "Anggota";
      let riwayatAsalDitemukan = false;

      if (riwayatMasaLalu) {
        const keluargaLama = await Keluarga.findByPk(riwayatMasaLalu.keluarga_id, { 
          transaction: t 
        });

        if (keluargaLama) {
          isKeluargaTujuan = keluargaLama.id;
          riwayatAsalDitemukan = true;

          if (keluargaLama.status_keluarga === "Non-Aktif") {
            await keluargaLama.update({ 
              status_keluarga: "Aktif" 
            }, { transaction: t });
          }
        }
      }

      if (!isKeluargaTujuan && predana.ayah_id) {
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
      }

      if (!isKeluargaTujuan && predana.ibu_id) {
        const keluargaIbu = await Keluarga.findOne({
          where: { 
            kepala_keluarga_id: predana.ibu_id, 
            status_keluarga: "Aktif" 
          },
          transaction: t
        });

        if (keluargaIbu) {
          isKeluargaTujuan = keluargaIbu.id;
        } else {
          const riwayatKKIbu = await RiwayatKeluarga.findOne({
            where: {
              krama_id: predana.ibu_id,
              akhir_masuk: null
            },
            transaction: t
          });
          
          if (riwayatKKIbu) {
            isKeluargaTujuan = riwayatKKIbu.keluarga_id;
          }
        }
      }

      if (!isKeluargaTujuan) {
        const keluargaAsalBaru = await Keluarga.create({
          kepala_keluarga_id: predana.id,
          jenis_keluarga: "Keluarga Asal",
          status_keluarga: "Aktif"
        }, { transaction: t });
        
        isKeluargaTujuan = keluargaAsalBaru.id;
        kedudukanBaru = "Kepala Keluarga";
      }

      if (riwayatAsalDitemukan && riwayatMasaLalu) {
        await riwayatMasaLalu.update({
          awal_masuk: finalTanggalCerai, 
          akhir_masuk: null, 
          perkawinan_id: perkawinan.id, 
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          dasar_keputusan: "Kedudukan sebagai anggota kembali diaktifkan karena krama kembali ke keluarga asal orang tuanya setelah perceraian." + infoTambahanDasar,
        }, { transaction: t });
      } else {
        await simpanRiwayatKeluarga({
          krama_id: predana.id,
          keluarga_id: isKeluargaTujuan,
          perkawinan_id: perkawinan.id,
          kedudukan: kedudukanBaru,
          kategori_event: "CERAI",
          bobot_event: BOBOT_EVENT["CERAI"],
          dasar_keputusan: "Kedudukan diberikan karena krama kembali ke keluarga asal setelah perceraian." + infoTambahanDasar,
          event_date: finalTanggalCerai,
          allow_multiple: false
        }, t);
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

      if (isPredanaMeninggal && targetKeluargaId) {
        await RiwayatKeluarga.update(
          { akhir_masuk: finalTanggalCerai },
          { 
            where: { 
              krama_id: predana.id, 
              keluarga_id: targetKeluargaId, 
              akhir_masuk: null 
            }, transaction: t 
          }
        );
      }

      if (isPurusaMeninggal && keputusanPredana === "Kembali ke Asal" && targetKeluargaId) {
        await RiwayatKeluarga.update(
          { akhir_masuk: finalTanggalCerai },
          { 
            where: { 
              krama_id: predana.id, 
              keluarga_id: targetKeluargaId, 
              akhir_masuk: null 
            }, transaction: t 
          }
        );
      }
    } else {
      if (targetKeluargaId && predana) {
        await RiwayatKeluarga.update(
          { akhir_masuk: finalTanggalCerai },
          { 
            where: { 
              krama_id: predana.id, 
              keluarga_id: targetKeluargaId, 
              akhir_masuk: null 
            }, transaction: t 
          }
        );
      }
    }

    const updatedPerkawinanInstance = await perkawinan.update({
      status_perkawinan,
      status_verifikasi: "Disetujui",
      tanggal_cerai: finalTanggalCerai.toISOString().split('T')[0],
      pihak_meninggal: status_perkawinan === "Cerai Mati" ? pihak_meninggal : null,
      ketetapan_silsilah_suami: jenis_perkawinan === "Pade Gelahang" 
        ? labelSilsilahSuami 
        : (purusa.id === suami_id ? keputusanPurusa : keputusanPredana),
      ketetapan_silsilah_istri: jenis_perkawinan === "Pade Gelahang" 
        ? labelSilsilahIstri 
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

    if (isPurusaMeninggal) {
      const perkawinanPoligamiLainnya = await Perkawinan.findAll({
        where: {
          suami_id: suami_id,
          status_perkawinan: "Kawin",
          id: { [Op.ne]: perkawinan.id }
        },
        transaction: t
      });

      for (const pLain of perkawinanPoligamiLainnya) {
        let targetPihakMeninggal = "Purusa";
        if (pLain.jenis_perkawinan === "Biasa") {
          targetPihakMeninggal = "Purusa";
        } else if (pLain.jenis_perkawinan === "Nyentana") {
          targetPihakMeninggal = "Predana";
        } else if (pLain.jenis_perkawinan === "Pade Gelahang") {
          targetPihakMeninggal = "Suami";
        }

        await prosesPerceraianBali({
          perkawinan_id: pLain.id,
          status_perkawinan: "Cerai Mati",
          tanggal_cerai: finalTanggalCerai,
          pihak_meninggal: targetPihakMeninggal,
          pilihan_predana: "Tetap",
          user_id,
          user_role,
          user_desa_id
        }, t);
      }
    }

    return {
      perkawinan_id,
      status_perkawinan,
      keputusan_predana: keputusanPredana,
      data_perkawinan: updatedPerkawinanInstance
    };
  } catch (error) {
    throw error;
  }
};