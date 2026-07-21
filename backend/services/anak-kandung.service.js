import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama, 
  KramaBali, 
  Perkawinan, 
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

export const buatAnakKandung = async ({
  anak_id,
  perkawinan_id,
  user_id,             
  status_verifikasi,   
  catatan_admin_desa
}, passedTransaction = null) => {
  // Menggunakan transaksi yang dilewatkan atau buat baru
  const t = passedTransaction || await db.transaction();

  try {
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan.");
    }

    const { suami_id, istri_id, jenis_perkawinan } = perkawinan;

    const anak = await KramaBali.findByPk(anak_id, { 
      transaction: t 
    });

    if (!anak) {
      throw new Error("Data anak tidak ditemukan.");
    }

    const tglLahirMurni = anak.tanggal_lahir  
      ? (anak.tanggal_lahir.includes('T') ? anak.tanggal_lahir.split('T')[0] : anak.tanggal_lahir.split(' ')[0])
      : new Date().toISOString().split('T')[0];

    const finalTanggalRiwayat = new Date(`${tglLahirMurni}T00:00:00.000Z`);
    const infoTambahanDasar = !anak.tanggal_lahir ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal lahir kosong)." : "";

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

    const relasi = await RelasiKrama.create({
      anak_id,
      ayah_id: suami_id,
      ibu_id: istri_id,
      status_hubungan: "Anak Kandung",
      user_id,             
      status_verifikasi,   
      catatan_admin_desa
    }, { transaction: t });

    if (status_verifikasi !== "Disetujui") {
      if (!passedTransaction) {
        await t.commit();
      }
      return relasi;
    }

    // Logika Chronological Stitching dan Urutan Lahir
    let tanggal_keluar = await hitungTanggalKeluarAnak(anak_id, tglLahirMurni, t);

    const finalTanggalKeluar = tanggal_keluar 
      ? new Date(`${tanggal_keluar}T23:59:59.999Z`)
      : null;

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

      // masuk ke silsilah keluarga pihak ayah
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaSuamiTarget.id,
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama ini dicatat sebagai anak kandung dalam keluarga pihak ayah karena perkawinan pade gelahang orang tuanya." + infoTambahanDasar,
        event_date: finalTanggalRiwayat,
        kategori_event: "LAHIR",
        bobot_event: BOBOT_EVENT["LAHIR"],
        allow_multiple: true,
        akhir_masuk: finalTanggalKeluar
      }, t);

      // masuk ke silsilah keluarga pihak ibu
      await simpanRiwayatKeluarga({
        krama_id: anak_id,
        keluarga_id: keluargaIstriTarget.id,
        perkawinan_id: perkawinan_id,
        kedudukan: "Anggota",
        dasar_keputusan: "Krama ini dicatat sebagai anak kandung dalam keluarga pihak ibu karena perkawinan pade gelahang orang tuanya." + infoTambahanDasar,
        event_date: finalTanggalRiwayat,
        kategori_event: "LAHIR",
        bobot_event: BOBOT_EVENT["LAHIR"],
        allow_multiple: true,
        akhir_masuk: finalTanggalKeluar 
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
        dasar_keputusan: `Krama ini dicatat sebagai anak kandung dalam keluarga perkawinan ${jenis_perkawinan} orang tuanya.` + infoTambahanDasar,
        event_date: finalTanggalRiwayat,
        kategori_event: "LAHIR",
        bobot_event: BOBOT_EVENT["LAHIR"],
        akhir_masuk: finalTanggalKeluar, 
        allow_multiple: finalTanggalKeluar ? true : false 
      }, t);
    }

    // ==============================================================
    // LOGIKA REKONSILIASI DATA MANDIRI
    // ==============================================================
    const riwayatMandiriDarurat = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        kedudukan: "Kepala Keluarga", 
        akhir_masuk: null,
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

      // memastikan riwayat perkawinan ditutup sesuai tanggal cerai
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

        if (keluargaSuamiTarget) {
          await simpanRiwayatKeluarga({
            krama_id: anak_id,
            keluarga_id: keluargaSuamiTarget.id,
            perkawinan_id: perkawinanIdDarurat || perkawinan_id,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga kandung pihak ibu setelah data relasi orang tua berhasil terdaftar ke dalam sistem.",
            event_date: tanggalMasukAsal,
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"],
            allow_multiple: true
          }, t);
        }

        if (keluargaIstriTarget) {
          await simpanRiwayatKeluarga({
            krama_id: anak_id,
            keluarga_id: keluargaIstriTarget.id,
            perkawinan_id: perkawinanIdDarurat || perkawinan_id,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga kandung pihak ibu setelah data relasi orang tua berhasil terdaftar ke dalam sistem.",
            event_date: tanggalMasukAsal,
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"],
            allow_multiple: true
          }, t);
        }
      } else {
        const keluargaTujuanId = keluargaSuamiTarget?.id || keluargaIstriTarget?.id;
        
        if (keluargaTujuanId && keluargaTujuanId !== keluargaAsalId) {
          await riwayatMandiriDarurat.destroy({ transaction: t });
          
          await simpanRiwayatKeluarga({
            krama_id: anak_id,
            keluarga_id: keluargaTujuanId,
            perkawinan_id: perkawinanIdDarurat || perkawinan_id,
            kedudukan: "Anggota",
            dasar_keputusan: "Krama dikembalikan ke keluarga kandung dari perkawinan orang tua kandungnya setelah data relasi orang tua berhasil terdaftar ke dalam sistem.",
            event_date: tanggalMasukAsal,
            kategori_event: "CERAI",
            bobot_event: BOBOT_EVENT["CERAI"]
          }, t);
        } else if (keluargaTujuanId && keluargaTujuanId === keluargaAsalId) {
          const riwayatLahirBaru = await RiwayatKeluarga.findOne({
            where: {
              krama_id: parseInt(anak_id),
              keluarga_id: keluargaTujuanId,
              kategori_event: "LAHIR"
            },
            transaction: t
          });

          if (riwayatLahirBaru) {
            await riwayatLahirBaru.update({
              kategori_event: "CERAI",
              bobot_event: BOBOT_EVENT["CERAI"],
              awal_masuk: tanggalMasukAsal, 
              akhir_masuk: null,
              perkawinan_id: perkawinanIdDarurat || perkawinan_id,
              dasar_keputusan: riwayatLahirBaru.dasar_keputusan
            }, { transaction: t });
          }
          await riwayatMandiriDarurat.destroy({ transaction: t });
        }
      }

      if (idKeluargaLamaDarurat) {
        await Keluarga.update({ 
          status_keluarga: "Non-Aktif" 
        },{ 
          where: { id: idKeluargaLamaDarurat }, 
          transaction: t 
        });
      }
    }

    // UPDATE DESA ADAT ANAK SECARA SAH
    const desaAdatTarget = jenis_perkawinan === "Nyentana" 
      ? istriData?.desa_adat_id 
      : suamiData?.desa_adat_id;

    if (desaAdatTarget) {
      await KramaBali.update(
        { desa_adat_id: desaAdatTarget },
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