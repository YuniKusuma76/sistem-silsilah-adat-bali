import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Keluarga,
  KramaBali
} from "../models/associations.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

export const eksekusiRollbackRelasi = async (relasi, t) => {
  const { 
    id: relasi_id,
    anak_id, 
    ayah_id, 
    ibu_id, 
    status_hubungan, 
    tanggal_pengangkatan 
  } = relasi;

  // Validasi ketersediaan data anak
  const anak = await KramaBali.findByPk(anak_id, { 
    transaction: t 
  });

  if (!anak) {
    throw new Error("Data anak tidak ditemukan.");
  }

  const kepala_keluarga_lama_id = ayah_id || ibu_id;
  let keluargaAsalId = null;

  if (kepala_keluarga_lama_id) {
    const keluargaLama = await Keluarga.findOne({
      where: { kepala_keluarga_id: kepala_keluarga_lama_id },
      transaction: t
    });
    keluargaAsalId = keluargaLama ? keluargaLama.id : null;
  }

  // PEMBALIKAN REKONSILIASI DATA MANDIRI
  const riwayatAsalMandiri = await RiwayatKeluarga.findOne({
    where: {
      krama_id: anak_id,
      dasar_keputusan: { [Op.like]: "%dikembalikan ke keluarga%" },
      akhir_masuk: null
    },
    transaction: t
  });

  if (riwayatAsalMandiri) {
    const idKeluargaLama = riwayatAsalMandiri.keluarga_id;

    await riwayatAsalMandiri.update({
      kedudukan: "Kepala Keluarga",
      dasar_keputusan: "Kedudukan dipulihkan kembali karena hubungan relasi krama dengan orang tuanya telah dibatalkan."
    }, { transaction: t });

    if (idKeluargaLama) {
      await Keluarga.update(
        { status_keluarga: "Aktif" },
        { 
          where: { id: idKeluargaLama }, 
          transaction: t 
        }
      );
    }
  }

  const dapatkanWaktuMurniObj = (stringTanggal) => {
    if (!stringTanggal) return null;
    const tglMurni = stringTanggal.includes('T') 
      ? stringTanggal.split('T')[0] 
      : stringTanggal.split(' ')[0];
    const awalHari = new Date(`${tglMurni}T00:00:00.000Z`);
    const akhirHari = new Date(`${tglMurni}T23:59:59.999Z`);
    return { awalHari, akhirHari };
  };

  // KONDISI 1: ROLLBACK DAMPAK ANAK KANDUNG
  if (status_hubungan === "Anak Kandung") {
    const waktuLahir = dapatkanWaktuMurniObj(anak.tanggal_lahir);
    
    await RiwayatKeluarga.destroy({
      where: {
        krama_id: anak_id,
        kategori_event: "LAHIR",
        bobot_event: BOBOT_EVENT["LAHIR"],
        kedudukan: "Anggota",
        ...(keluargaAsalId && { keluarga_id: keluargaAsalId })
      },
      transaction: t
    });

    await hitungUrutanLahir({
      ayah_id: ayah_id,
      ibu_id: ibu_id,
      mode: "CAMPUR"
    }, t);
  }

  // KONDISI 2: ROLLBACK DAMPAK ANAK ANGKAT
  if (status_hubungan === "Anak Angkat") {
    const waktuAdopsi = tanggal_pengangkatan ? dapatkanWaktuMurniObj(tanggal_pengangkatan) : null;

    let riwayatSebelumAdopsi = null;
    
    // mengambil riwayat sebelum pengangkatan
    if (waktuAdopsi) {
      riwayatSebelumAdopsi = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: anak_id, 
          akhir_masuk: { 
            [Op.between]: [waktuAdopsi.awalHari, waktuAdopsi.akhirHari] 
          } 
        },
        include: [{ 
          model: Keluarga, 
          as: "detail_keluarga", 
          required: false 
        }],
        transaction: t
      });
    }

    // mencari riwayat lama yang event datenya pernah ditutup
    if (!riwayatSebelumAdopsi) {
      riwayatSebelumAdopsi = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: anak_id, 
          akhir_masuk: { [Op.ne]: null } 
        },
        order: [["akhir_masuk", "DESC"]],
        include: [{ 
          model: Keluarga, 
          as: "detail_keluarga", 
          required: false 
        }],
        transaction: t
      });
    }

    await RiwayatKeluarga.destroy({
      where: {
        krama_id: anak_id,
        kategori_event: "PENGANGKATAN",
        bobot_event: BOBOT_EVENT["PENGANGKATAN"],
        kedudukan: "Anggota",
        ...(keluargaAsalId && { keluarga_id: keluargaAsalId })
      },
      transaction: t
    });

    // Backward Stitching Reversal: Buka kembali linimasa riwayat lama krama
    if (riwayatSebelumAdopsi) {
      await riwayatSebelumAdopsi.update(
        { akhir_masuk: null },
        { transaction: t }
      );
    }

    // menghitung sisa data adopsi sah yang terdaftar di orang tua ini
    const sisaAnakAngkat = await RelasiKrama.count({
      where: {
        id: { [Op.ne]: relasi_id },
        status_hubungan: "Anak Angkat",
        status_verifikasi: "Disetujui",
        [Op.or]: [
          { ayah_id: kepala_keluarga_lama_id },
          { ibu_id: kepala_keluarga_lama_id }
        ]
      },
      transaction: t
    });

    if (kepala_keluarga_lama_id) {
      await RiwayatPeranAdat.destroy({
        where: {
          krama_id: kepala_keluarga_lama_id,
          kategori_event: "PENGANGKATAN"
        },
        transaction: t
      });
      
      if (waktuAdopsi) {
        await RiwayatPeranAdat.update(
          { selesai_tanggal: null },
          { 
            where: {
              krama_id: kepala_keluarga_lama_id,
              selesai_tanggal: { 
                [Op.between]: [waktuAdopsi.awalHari, waktuAdopsi.akhirHari] 
              }
            },
            transaction: t
          }
        );
      } else {
        await RiwayatPeranAdat.update(
          { selesai_tanggal: null },
          { 
            where: { 
              krama_id: kepala_keluarga_lama_id, 
              selesai_tanggal: { [Op.ne]: null } 
            },
            order: [["selesai_tanggal", "DESC"]],
            limit: 1,
            transaction: t
          }
        );
      }
    }

    // hapus total entitas keluarga angkat jika sisa krama anak angkat habis
    if (sisaAnakAngkat === 0 && kepala_keluarga_lama_id) {
      const keluargaAngkat = await Keluarga.findOne({
        where: {
          kepala_keluarga_id: kepala_keluarga_lama_id,
          jenis_keluarga: "Keluarga Angkat"
        },
        transaction: t
      });

      if (keluargaAngkat) {
        await RiwayatKeluarga.destroy({
          where: {
            krama_id: kepala_keluarga_lama_id,
            keluarga_id: keluargaAngkat.id
          },
          transaction: t
        });
        await keluargaAngkat.destroy({ transaction: t });
      }
    }

    await hitungUrutanLahir({
      kepala_keluarga_id: kepala_keluarga_lama_id, 
      mode: "ANGKAT"
    }, t);

    // memulihkan Mutasi Wilayah Desa Adat Anak
    if (riwayatSebelumAdopsi && riwayatSebelumAdopsi.detail_keluarga) {
      const idDesaAsal = riwayatSebelumAdopsi.detail_keluarga.desa_adat_id;

      if (idDesaAsal) {
        await KramaBali.update(
          { desa_adat_id: idDesaAsal },
          { 
            where: { id: anak_id }, 
            transaction: t 
          }
        );
      }
    }

    // membuka kembali riwayat keluar keluarga kandung
    if (waktuAdopsi) {
      await RiwayatKeluarga.update(
        { akhir_masuk: null },
        {
          where: {
            krama_id: anak_id,
            kategori_event: "LAHIR",
            akhir_masuk: { 
              [Op.between]: [waktuAdopsi.awalHari, waktuAdopsi.akhirHari] 
            }
          },
          transaction: t
        }
      );
    } else {
      await RiwayatKeluarga.update(
        { akhir_masuk: null },
        {
          where: {
            krama_id: anak_id,
            kategori_event: "LAHIR",
            akhir_masuk: { [Op.ne]: null }
          },
          order: [["akhir_masuk", "DESC"]],
          limit: 1,
          transaction: t
        }
      );
    }
  }
};

export const batalkanRelasiKrama = async (relasiId) => {
  // Mulai transaksi database
  const t = await db.transaction();
  let transactionCommittedOrRolledBack = false;

  try {
    // Validasi ketersediaan data relasi krama
    const relasi = await RelasiKrama.findByPk(relasiId, {
      transaction: t
    });

    if (!relasi) {
      throw new Error("Data relasi krama tidak ditemukan.");
    }

    await eksekusiRollbackRelasi(relasi, t);
    
    await RelasiKrama.destroy({
      where: { id: relasiId },
      transaction: t
    });

    await t.commit();
    transactionCommittedOrRolledBack = true;
    return true;
  } catch (error) {
    if (!transactionCommittedOrRolledBack) {
      await t.rollback();
    }
    throw error;
  }
};