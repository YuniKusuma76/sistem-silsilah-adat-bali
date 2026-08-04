import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Keluarga,
  KramaBali,
  Perkawinan
} from "../models/associations.js";
import { hitungUrutanLahir } from "./urutan-lahir.service.js";
import { rekonsiliasiKronologiKeluarga } from "../helpers/kronologis-order.helper.js";

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

  // KONDISI KHUSUS: ROLLBACK RELASI LELUHUR
  if (kepala_keluarga_lama_id) {
    const keluargaLeluhur = await Keluarga.findOne({
      where: {
        kepala_keluarga_id: kepala_keluarga_lama_id,
        jenis_keluarga: "Leluhur"
      },
      transaction: t
    });

    if (keluargaLeluhur) {
      await RiwayatKeluarga.destroy({
        where: {
          krama_id: anak_id,
          keluarga_id: keluargaLeluhur.id,
          kedudukan: "Anggota"
        },
        transaction: t
      });

      const sisaAnggotaLeluhur = await RiwayatKeluarga.count({
        where: {
          keluarga_id: keluargaLeluhur.id,
          kedudukan: "Anggota"
        },
        transaction: t
      });

      if (sisaAnggotaLeluhur === 0) {
        await RiwayatKeluarga.destroy({
          where: {
            keluarga_id: keluargaLeluhur.id,
            krama_id: kepala_keluarga_lama_id
          },
          transaction: t
        });

        await keluargaLeluhur.destroy({ transaction: t });

        const riwayatOrangTuaYangDitutup = await RiwayatKeluarga.findOne({
          where: {
            krama_id: kepala_keluarga_lama_id,
            akhir_masuk: { [Op.ne]: null }
          },
          order: [["akhir_masuk", "DESC"]],
          transaction: t
        });

        if (riwayatOrangTuaYangDitutup) {
          await riwayatOrangTuaYangDitutup.update(
            { akhir_masuk: null },
            { transaction: t }
          );
        }

        if (ayah_id && ibu_id) {
          const sisaRelasiLeluhurLain = await RelasiKrama.count({
            where: {
              id: { [Op.ne]: relasi_id },
              ayah_id: ayah_id,
              ibu_id: ibu_id
            },
            transaction: t
          });

          if (sisaRelasiLeluhurLain === 0) {
            await Perkawinan.destroy({
              where: {
                suami_id: ayah_id,
                istri_id: ibu_id,
                status_perkawinan: "Tidak Diketahui"
              },
              transaction: t
            });
          }
        }
      }
    }
  }

  // PEMULIHAN MUTASI DESA ADAT
  const relasiSisaAktif = await RelasiKrama.findOne({
    where: {
      id: { [Op.ne]: relasi_id },
      anak_id: anak_id,
      status_verifikasi: "Disetujui"
    },
    transaction: t
  });

  let targetDesaIdMandiri = null;

  if (relasiSisaAktif) {
    const ortuMandiriId = relasiSisaAktif.ayah_id || relasiSisaAktif.ibu_id;
    if (ortuMandiriId) {
      const ortuAktif = await KramaBali.findByPk(ortuMandiriId, {
        attributes: ["desa_adat_id"],
        transaction: t
      });

      if (ortuAktif?.desa_adat_id) {
        targetDesaIdMandiri = ortuAktif.desa_adat_id;
      }
    }
  }

  if (!targetDesaIdMandiri) {
    const riwayatKeluargaAktif = await RiwayatKeluarga.findOne({
      where: {
        krama_id: anak_id,
        akhir_masuk: null
      },
      include: [{
        model: Keluarga,
        as: "detail_keluarga",
        required: false
      }],
      order: [["awal_masuk", "DESC"]],
      transaction: t
    });

    if (riwayatKeluargaAktif?.detail_keluarga?.desa_adat_id) {
      targetDesaIdMandiri = riwayatKeluargaAktif.detail_keluarga.desa_adat_id;
    } else if (riwayatKeluargaAktif?.detail_keluarga?.kepala_keluarga_id) {
      const kepalaAktif = await KramaBali.findByPk(riwayatKeluargaAktif.detail_keluarga.kepala_keluarga_id, {
        attributes: ["desa_adat_id"],
        transaction: t
      });
      if (kepalaAktif?.desa_adat_id) {
        targetDesaIdMandiri = kepalaAktif.desa_adat_id;
      }
    }
  }

  if (targetDesaIdMandiri && targetDesaIdMandiri !== anak.desa_adat_id) {
    await KramaBali.update(
      { desa_adat_id: targetDesaIdMandiri },
      { 
        where: { id: anak_id }, 
        transaction: t 
      }
    );
  }

  if (status_hubungan === "Anak Kandung") {
    await hitungUrutanLahir({
      ayah_id: ayah_id,
      ibu_id: ibu_id,
      mode: "CAMPUR"
    }, t);
  } else if (status_hubungan === "Anak Angkat" && kepala_keluarga_lama_id) {
    await hitungUrutanLahir({
      kepala_keluarga_id: kepala_keluarga_lama_id, 
      mode: "ANGKAT"
    }, t);
  }

  // REKONSILIASI KRONOLOGIS
  const entitasTerdampak = new Set();

  if (anak_id) {
    entitasTerdampak.add(parseInt(anak_id));
  }

  if (ayah_id) {
    entitasTerdampak.add(parseInt(ayah_id));
  }

  if (ibu_id) {
    entitasTerdampak.add(parseInt(ibu_id));
  }

  for (const kramaId of entitasTerdampak) {
    if (kramaId) {
      await rekonsiliasiKronologiKeluarga(kramaId, t);
    }
  }
};

export const batalkanRelasiKrama = async (relasiId) => {
  const t = await db.transaction();
  let transactionCommittedOrRolledBack = false;

  try {
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

    if (relasi.status_hubungan === "Anak Kandung") {
      await hitungUrutanLahir({
        ayah_id: relasi.ayah_id,
        ibu_id: relasi.ibu_id,
        mode: "CAMPUR"
      }, t);
    } else if (relasi.status_hubungan === "Anak Angkat") {
      const kepalaKeluargaId = relasi.ayah_id || relasi.ibu_id;
      if (kepalaKeluargaId) {
        await hitungUrutanLahir({
          kepala_keluarga_id: kepalaKeluargaId,
          mode: "ANGKAT"
        }, t);
      }
    }

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