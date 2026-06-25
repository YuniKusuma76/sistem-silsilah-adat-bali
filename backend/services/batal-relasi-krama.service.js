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

  const orangTuaIds = [ayah_id, ibu_id].filter(Boolean);
  
  const keluargaLama = await Keluarga.findOne({
    where: {
      [Op.or]: [
        { kepala_keluarga_id: { [Op.in]: orangTuaIds } },
      ]
    },
    transaction: t
  });

  const targetKeluargaId = keluargaLama ? keluargaLama.id : null;
  const kepala_keluarga_id = ayah_id || ibu_id;

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
        { where: { id: idKeluargaLama }, transaction: t }
      );
    }
  }

  // KONDISI 1: ROLLBACK DAMPAK ANAK KANDUNG
  if (status_hubungan === "Anak Kandung") {
    await RiwayatKeluarga.destroy({
      where: {
        krama_id: anak_id,
        awal_masuk: anak.tanggal_lahir,
        kategori_event: "LAHIR",
        bobot_event: BOBOT_EVENT["LAHIR"],
        kedudukan: "Anggota",
        ...(targetKeluargaId && { keluarga_id: targetKeluargaId })
      },
      transaction: t
    });

    await hitungUrutanLahir({
      ayah_id,
      ibu_id,
      mode: "CAMPUR"
    }, t);
  }

  // KONDISI 2: ROLLBACK DAMPAK ANAK ANGKAT
  if (status_hubungan === "Anak Angkat") {
    if (!tanggal_pengangkatan) {
      throw new Error("Tanggal pengangkatan tidak ditemukan.");
    }

    const riwayatSebelumAdopsi = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        akhir_masuk: tanggal_pengangkatan
      },
      include: [{ association: "detail_keluarga" }],
      transaction: t
    });

    await RiwayatKeluarga.destroy({
      where: {
        krama_id: anak_id,
        awal_masuk: tanggal_pengangkatan,
        kategori_event: "PENGANGKATAN",
          bobot_event: BOBOT_EVENT["PENGANGKATAN"],
        kedudukan: "Anggota",
        ...(targetKeluargaId && { keluarga_id: targetKeluargaId })
      },
      transaction: t
    });

    // Backward Stitching Reversal: Membuka kembali linimasa keluarga sebelum adopsi
    await RiwayatKeluarga.update(
      { akhir_masuk: null }, 
      { where: {
          krama_id: anak_id,
          akhir_masuk: tanggal_pengangkatan
        },
        transaction: t
      }
    );

    // menghitung sisa draft pengangkatan sah
    const sisaAnakAngkat = await RelasiKrama.count({
      where: {
        id: { [Op.ne]: relasi_id },
        status_hubungan: "Anak Angkat",
        status_verifikasi: "Disetujui",
        [Op.or]: [
          { ayah_id: kepala_keluarga_id },
          { ibu_id: kepala_keluarga_id }
        ]
      },
      transaction: t
    });

    if (kepala_keluarga_id) {
      await RiwayatPeranAdat.destroy({
        where: {
          krama_id: kepala_keluarga_id,
          event_date: tanggal_pengangkatan
        },
        transaction: t
      });
      
      await RiwayatPeranAdat.update(
        { selesai_tanggal: null },
        { where: {
            krama_id: kepala_keluarga_id,
            selesai_tanggal: tanggal_pengangkatan
          },
          transaction: t
        }
      );
    }

    // menghapus keluarga angkat jika tidak ada entitas krama
    if (sisaAnakAngkat === 0 && kepala_keluarga_id) {
      const keluargaAngkat = await Keluarga.findOne({
        where: {
          kepala_keluarga_id: kepala_keluarga_id,
          jenis_keluarga: "Keluarga Angkat"
        },
        transaction: t
      });

      if (keluargaAngkat) {
        await RiwayatKeluarga.destroy({
          where: {
            krama_id: kepala_keluarga_id,
            keluarga_id: keluargaAngkat.id
          },
          transaction: t
        });
        await keluargaAngkat.destroy({ transaction: t });
      }
    }

    if (sisaAnakAngkat > 0) {
      await hitungUrutanLahir({
        ayah_id,
        ibu_id,
        kepala_keluarga_id, 
        mode: "ANGKAT"
      }, t);
    }

    // Memulihkan Mutas Desa Adat Anak
    if (riwayatSebelumAdopsi && riwayatSebelumAdopsi.detail_keluarga) {
      const idDesaAsal = riwayatSebelumAdopsi.detail_keluarga.desa_adat_id;

      if (idDesaAsal) {
        await KramaBali.update(
          { desa_adat_id: idDesaAsal },
          { where: { id: anak_id }, transaction: t }
        );
      }
    }
  }
};

export const batalkanRelasiKrama = async (relasiId) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(relasiId, {
      transaction: t
    });

    if (!relasi) {
      throw new Error("Data relasi krama tidak ditemukan.");
    }

    await eksekusiRollbackRelasi(relasi, t);
    await relasi.destroy({ transaction: t });

    await t.commit();
    return true;
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    throw error;
  }
};