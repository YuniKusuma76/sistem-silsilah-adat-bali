import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan, 
  KramaBali, 
  RelasiKrama, 
  RiwayatKeluarga, 
  Keluarga
} from "../models/associations.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";
import { hitungTanggalKeluarAnak } from "../helpers/tanggal-keluar.helper.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const anakAngkatPasangan = async ({
  anak_id,
  perkawinan_id,
  tanggal_pengangkatan,
  status_hubungan = "Anak Angkat",
  user_id,             
  status_verifikasi,   
  catatan_admin_desa,
  is_verifikasi = false
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan.");
    }

    const { suami_id, istri_id, jenis_perkawinan } = perkawinan;

    // Validasi ketersediaan data anak dan orang tua
    const anak = await KramaBali.findByPk(anak_id, { 
      transaction: t 
    });

    if (!anak) {
      throw new Error("Data anak tidak ditemukan.");
    }

    const [suamiData, istriData] = await Promise.all([
      KramaBali.findByPk(suami_id, { 
        attributes: ["desa_adat_id"], 
        transaction: t 
      }),
      KramaBali.findByPk(istri_id, { 
        attributes: ["desa_adat_id"], 
        transaction: t 
      })
    ]);

    let tglAngkatDateOnly;
    let infoTambahanDasar = "";
    const isTanggalAngkatKosong = !tanggal_pengangkatan || tanggal_pengangkatan === "";

    if (isTanggalAngkatKosong) {
      const tanggalLahirAcuan = anak.tanggal_lahir 
        ? (anak.tanggal_lahir.includes('T') ? anak.tanggal_lahir.split('T')[0] : anak.tanggal_lahir.split(' ')[0])
        : new Date().toISOString().split('T')[0];

      const dt = new Date(`${tanggalLahirAcuan}T00:00:00.000Z`);
      dt.setDate(dt.getDate() + 1);

      tglAngkatDateOnly = dt.toISOString().split('T')[0];
      infoTambahanDasar = " (Tanggal riwayat otomatis ditetapkan 1 hari setelah tanggal lahir anak karena tanggal pengangkatan kosong).";
    } else {
      tglAngkatDateOnly = tanggal_pengangkatan.includes('T') 
        ? tanggal_pengangkatan.split('T')[0] 
        : tanggal_pengangkatan.split(' ')[0];
    }

    let tglAngkatTimestamp = `${tglAngkatDateOnly}T00:00:00.000Z`;

    // Validasi Rentang Waktu Kronologis
    const riwayatAktif = await RiwayatKeluarga.findOne({
      where: { 
        krama_id: anak_id, 
        akhir_masuk: null 
      },
      transaction: t
    });

    if (riwayatAktif) {
      const tglAwalAktifStr = riwayatAktif.awal_masuk instanceof Date 
        ? riwayatAktif.awal_masuk.toISOString().split('T')[0]
        : riwayatAktif.awal_masuk.split('T')[0];

      if (new Date(tglAngkatTimestamp) <= new Date(riwayatAktif.awal_masuk)) {
        const d = new Date(`${tglAwalAktifStr}T00:00:00.000Z`);
        d.setDate(d.getDate() + 1);
        tglAngkatDateOnly = d.toISOString().split('T')[0];
        tglAngkatTimestamp = `${tglAngkatDateOnly}T00:00:00.000Z`;
      }
    }

    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tglAngkatDateOnly, t);

    let akhirMasukAnakAngkat = tanggal_keluar 
    ? new Date(`${tanggal_keluar}T00:00:00.000Z`)
    : null; 
    
    const objekWaktuEfektif = new Date(tglAngkatTimestamp);

    if (riwayatAktif) {
      const tglAwalAktif = new Date(riwayatAktif.awal_masuk);
      if (tglAwalAktif > objekWaktuEfektif) {
        akhirMasukAnakAngkat = riwayatAktif.awal_masuk; 
      } 
    }

    let relasi;

    const desaAdatTujuanId = jenis_perkawinan === "Nyentana" 
      ? istriData?.desa_adat_id 
      : suamiData?.desa_adat_id;

    if (!is_verifikasi) {
      relasi = await RelasiKrama.create({
        anak_id,
        ayah_id: suami_id,
        ibu_id: istri_id,
        status_hubungan,
        tanggal_pengangkatan: tglAngkatDateOnly,
        user_id,             
        status_verifikasi,   
        catatan_admin_desa,
        desa_adat_id_tujuan: desaAdatTujuanId
      }, { transaction: t });
    } else {
      relasi = await RelasiKrama.findOne({
        where: { 
          anak_id, 
          ayah_id: suami_id, 
          ibu_id: istri_id, 
          status_hubungan, 
          status_verifikasi: "Draft" 
        },
        transaction: t
      });

      if (relasi) {
        const tglFix = tanggal_pengangkatan || relasi.tanggal_pengangkatan;
        const tglFixClean = tglFix.includes('T') ? tglFix.split('T')[0] : tglFix.split(' ')[0];

        await relasi.update({
          status_verifikasi: "Disetujui",
          catatan_admin_desa,
          tanggal_pengangkatan: tglFixClean
        }, { transaction: t });

        tglAngkatDateOnly = tglFixClean;
        tglAngkatTimestamp = `${tglFixClean}T00:00:00.000Z`;
      }
    }

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // ===================================================================
    // Logika Chronological Stitching dan Backward Stitching
    // ===================================================================
    if (riwayatAktif && objekWaktuEfektif > new Date(riwayatAktif.awal_masuk)) {
      await RiwayatKeluarga.update(
        { akhir_masuk: objekWaktuEfektif },
        { where: {
            krama_id: anak_id,
            akhir_masuk: null
          },
          transaction: t
        }
      );
    }

    await hitungUrutanLahir({
      ayah_id: suami_id,
      ibu_id: istri_id,
      mode: "CAMPUR"
    }, t);

    let keluargaSuamiTarget = null;
    let keluargaIstriTarget = null;
    let keluargaAsalId = null;

    // =============================================================
    // MENCARI KELUARGA AKTIF BERDASARKAN JENIS PERKAWINAN
    // =============================================================
    if (jenis_perkawinan === "Pade Gelahang") {
      const [riwayatSuami, riwayatIstri] = await Promise.all([
        RiwayatKeluarga.findOne({ 
          where: { 
            krama_id: suami_id, 
            akhir_masuk: null 
          }, transaction: t }),
        RiwayatKeluarga.findOne({ 
          where: { 
            krama_id: istri_id, 
            akhir_masuk: null 
          }, transaction: t })
      ]);

      if (!riwayatSuami || !riwayatIstri) {
        throw new Error("Pelacakan keluarga aktif perkawinan pade gelahang gagal! Riwayat aktif orang tua tidak ditemukan.");
      }

      keluargaSuamiTarget = { id: riwayatSuami.keluarga_id };
      keluargaIstriTarget = { id: riwayatIstri.keluarga_id };
      keluargaAsalId = riwayatSuami.keluarga_id;

      // masuk ke silsilah keluarga pihak ayah angkat
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ayah melalui ikatan perkawinan Pade Gelahang orang tua angkatnya." + infoTambahanDasar,
        event_date: objekWaktuEfektif,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
        allow_multiple: true,
        akhir_masuk: akhirMasukAnakAngkat ? new Date(akhirMasukAnakAngkat) : null
      }, t);

      // masuk ke silsilah keluarga pihak ibu angkat
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama diangkat sebagai anak ke dalam keluarga pihak ibu melalui ikatan perkawinan Pade Gelahang orang tua angkatnya." + infoTambahanDasar,
        event_date: objekWaktuEfektif,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
        allow_multiple: true,
        akhir_masuk: akhirMasukAnakAngkat ? new Date(akhirMasukAnakAngkat) : null
      }, t);
    } else {
      const purusaId = jenis_perkawinan === "Nyentana" ? istri_id : suami_id;
      const predanaId = jenis_perkawinan === "Nyentana" ? suami_id : istri_id;

      let riwayatKeluarga = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: purusaId, 
          akhir_masuk: null 
        },
        transaction: t
      });

      // mencari riwayat keluarga aktif melalui istri
      if (!riwayatKeluarga) {
        riwayatKeluarga = await RiwayatKeluarga.findOne({
          where: { 
            krama_id: predanaId, 
            akhir_masuk: null 
          },
          transaction: t
        });
      }

      if (!riwayatKeluarga) {
        throw new Error("Riwayat keluarga aktif orang tua tidak ditemukan.");
      }

      const keluargaId = riwayatKeluarga.keluarga_id;
      keluargaAsalId = keluargaId;
      
      if (jenis_perkawinan === "Nyentana") {
        keluargaIstriTarget = { id: keluargaId };
      } else {
        keluargaSuamiTarget = { id: keluargaId };
      }

      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaId,
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: `Kedudukan sebagai anggota diberikan karena krama ini diangkat sebagai anak (${status_hubungan}) oleh pasangan suami istri perkawinan ${jenis_perkawinan.toLowerCase()} yang sah.` + infoTambahanDasar,
        event_date: objekWaktuEfektif,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
        akhir_masuk: akhirMasukAnakAngkat ? new Date(akhirMasukAnakAngkat) : null,
        allow_multiple: akhirMasukAnakAngkat ? true : false
      }, t);
    }

    // ==============================================================
    // LOGIKA REKONSILIASI DATA MANDIRI
    // ==============================================================
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: parseInt(anak_id),
        kedudukan: "Kepala Keluarga",
        [Op.or]: [
          { dasar_keputusan: { [Op.like]: "%kembali ke keluarga asal%" } },
          { dasar_keputusan: { [Op.like]: "%setelah perceraian%" } },
          { dasar_keputusan: { [Op.like]: "%keluarga asal setelah%" } },
          { dasar_keputusan: { [Op.like]: "%dikembalikan ke keluarga%" } }
        ]
      },
      transaction: t
    });

    if (riwayatMandiriDarurat) {
      const idKeluargaLamaDarurat = riwayatMandiriDarurat.keluarga_id;
      const tanggalMasukAsal = new Date(riwayatMandiriDarurat.awal_masuk);
      const perkawinanIdDarurat = riwayatMandiriDarurat.perkawinan_id;

      await RiwayatKeluarga.update(
        { akhir_masuk: tanggalMasukAsal },
        {
          where: {
            krama_id: parseInt(anak_id),
            kategori_event: "KAWIN",
            akhir_masuk: null
          },
          transaction: t
        }
      );

      if (jenis_perkawinan === "Pade Gelahang") {
        await riwayatMandiriDarurat.destroy({ transaction: t });

        if (keluargaSuamiTarget && keluargaSuamiTarget.id !== keluargaAsalId) {
          await simpanRiwayatKeluarga({
            krama_id: anak_id,
            keluarga_id: keluargaSuamiTarget.id,
            perkawinan_id: perkawinanIdDarurat || perkawinan_id,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga angkat pihak ayah setelah data relasi orang tua berhasil disinkronisasi ke dalam sistem.",
            event_date: tanggalMasukAsal,
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"],
            allow_multiple: true
          }, t);
        }

        if (keluargaIstriTarget && keluargaIstriTarget.id !== keluargaAsalId) {
          await simpanRiwayatKeluarga({
            krama_id: anak_id,
            keluarga_id: keluargaIstriTarget.id,
            perkawinan_id: perkawinanIdDarurat || perkawinan_id,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga angkat pihak ibu setelah data relasi orang tua berhasil disinkronisasi ke dalam sistem.",
            event_date: tanggalMasukAsal,
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"],
            allow_multiple: true
          }, t);
        }
      } else {
        // melihat kesamaan keluarga yang dituju setelah cerai
        const keluargaTujuanId = keluargaSuamiTarget?.id || keluargaIstriTarget?.id;
        
        if (keluargaTujuanId && keluargaTujuanId !== keluargaAsalId) {
          await riwayatMandiriDarurat.destroy({ transaction: t });
          
          await simpanRiwayatKeluarga({
            krama_id: anak_id,
            keluarga_id: keluargaTujuanId,
            perkawinan_id: perkawinanIdDarurat || perkawinan_id,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga angkat dari perkawinan orang tuanya setelah data relasi orang tua berhasil disinkronisasikan ke dalam sistem.",
            event_date: tanggalMasukAsal,
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"]
          }, t);
        } else if (keluargaTujuanId && keluargaTujuanId === keluargaAsalId) {
          const riwayatLahirBaru = await RiwayatKeluarga.findOne({
            where: {
              krama_id: parseInt(anak_id),
              keluarga_id: keluargaTujuanId,
              kategori_event: "PENGANGKATAN",
              akhir_masuk: null
            },
            transaction: t
          });

          if (riwayatLahirBaru) {
            await riwayatLahirBaru.update({
              kategori_event: "CERAI",
              bobot_event: BOBOT_EVENT["CERAI"],
              awal_masuk: tanggalMasukAsal, 
              akhir_masuk: null,
              dasar_keputusan: riwayatLahirBaru.dasar_keputusan + ` (Kedudukan aktif sebagai anggota di keluarga orang tua angkatnya dipulihkan kembali secara sah sejak tanggal perceraian ${tanggalMasukAsal.toISOString().split('T')[0]}).`
            }, { transaction: t });
          }
          await riwayatMandiriDarurat.destroy({ transaction: t });
        }
      }
        
      // nonaktifkan entitas keluarga darurat penampung
      if (idKeluargaLamaDarurat) {
        await Keluarga.update(
          { status_keluarga: "Non-Aktif" },
          { 
            where: { id: idKeluargaLamaDarurat }, 
            transaction: t 
          }
        );
      }
    }

    // MUTASI PENGANGKATAN ANAK LINTAS DESA
    if (desaAdatTujuanId) {
      await KramaBali.update(
        { desa_adat_id: desaAdatTujuanId },
        { where: { id: anak_id }, transaction: t }
      );
    }

    if (!passedTransaction) {
      await t.commit();
    }
    return relasi;
  } catch (error) {
    if (!passedTransaction) {
      await t.rollback();
    }
    throw error;
  }
};