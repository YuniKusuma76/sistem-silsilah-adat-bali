import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Keluarga
} from "../models/associations.js";

export const batalkanPerceraian = async ({
  perkawinan_id,
  user_role,
  nama_desa_operator
}) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, {
      transaction: t
    });
    if (!perkawinan) {
      throw new Error("Data perkawinan tidak ditemukan!");
    }

    if (perkawinan.status_perkawinan === "Kawin" && !perkawinan.is_pending_update) {
      throw new Error("Perkawinan ini sudah dalam status kawin (aktif).");
    }

    const { 
      suami_id, 
      istri_id, 
      tanggal_cerai, 
      status_perkawinan, 
      jenis_perkawinan
    } = perkawinan;

    // Menentukan status purusa untuk mencari keluarga perkawinan
    const purusaId = jenis_perkawinan === "Nyentana" ? istri_id : suami_id;

    // Validasi adanya perkawinan baru setelah perceraian
    const adaPerkawinanBaru = await Perkawinan.findOne({
      where: {
        [Op.or]: [
          { suami_id }, 
          { istri_id }
        ],
        tanggal_perkawinan: { [Op.gt]: tanggal_cerai },
        id: { [Op.ne]: perkawinan_id }
      },
      transaction: t
    });
    if (adaPerkawinanBaru) {
      throw new Error("Proses pembatalan dihentikan! Salah satu krama telah terlibat dalam perkawinan baru setelah tanggal perceraian ini.");
    }

    // PROSES 1: Rollback status hidup krama yang meninggal
    if (status_perkawinan === "Cerai Mati") {
      await KramaBali.update(
        { status_hidup: "Hidup" },
        { 
          where: { 
            id: { [Op.in]: [suami_id, istri_id] },
            status_hidup: "Meninggal" 
          },
          transaction: t
        }
      );
    }

    // PROSES 2: Identifikasi dan bersihkan riwayat yang dipicu perceraian ini
    const riwayatTujuanCerai = await RiwayatKeluarga.findAll({
      where: {
        krama_id: { [Op.in]: [suami_id, istri_id] },
        awal_masuk: tanggal_cerai,
        dasar_keputusan: { [Op.like]: "%kembali ke keluarga asal%" } 
      },
      transaction: t
    });

    const candidateKeluargaIds = [...new Set(riwayatTujuanCerai.map(r => r.keluarga_id))];

    // Menghapus riwayat keluarga ketika cerai
    await RiwayatKeluarga.destroy({
      where: {
        krama_id: { [Op.in]: [suami_id, istri_id] },
        awal_masuk: tanggal_cerai,
        dasar_keputusan: { [Op.like]: "%kembali ke keluarga asal%" }
      },
      transaction: t
    });

    const riwayatPernikahanLama = await RiwayatKeluarga.findOne({
      where: {
        krama_id: purusaId,
        akhir_masuk: tanggal_cerai
      },
      transaction: t
    });

    const kkPernikahanId = riwayatPernikahanLama 
      ? riwayatPernikahanLama.keluarga_id 
      : null;

    // Membuka kembali riwayat keluarga yang ditutup ketika cerai
    await RiwayatKeluarga.update(
      { akhir_masuk: null },
      {
        where: {
          krama_id: { [Op.in]: [suami_id, istri_id] },
          akhir_masuk: tanggal_cerai
        },
        transaction: t
      }
    );

    // Menghapus riwayat keluarga asal yang tidak memiliki anggota
    for (const keluargaId of candidateKeluargaIds) {
      if (keluargaId !== kkPernikahanId) {
        const count = await RiwayatKeluarga.count({ 
          where: { keluarga_id: keluargaId }, 
          transaction: t 
        });
        if (count === 0) {
          await Keluarga.destroy({ 
            where: { 
              id: keluargaId, 
              jenis_keluarga: "Keluarga Asal" 
            }, 
            transaction: t 
          });
        }
      }
    }

    // PROSES 3: Rollback riwayat peran adat
    await RiwayatPeranAdat.destroy({
      where: {
        krama_id: { [Op.in]: [suami_id, istri_id] },
        mulai_tanggal: tanggal_cerai
      },
      transaction: t
    });

    // Mengaktifkan status peran adat sebelumnya
    await RiwayatPeranAdat.update(
      { selesai_tanggal: null },
      {
        where: {
          krama_id: { [Op.in]: [suami_id, istri_id] },
          selesai_tanggal: tanggal_cerai
        },
        transaction: t
      }
    );

    // PROSES 4: Mengaktifkan kembali keluarga perkawinan sebelumnya
    if (jenis_perkawinan === "Pade Gelahang") {
      await Keluarga.update(
        { status_keluarga: "Aktif" },
        { 
          where: { 
            kepala_keluarga_id: { [Op.in]: [suami_id, istri_id] },
            jenis_keluarga: "Pade Gelahang"
          },
          transaction: t
        }
      );
    } else if (kkPernikahanId) {
      await Keluarga.update(
        { status_keluarga: "Aktif" },
        { 
          where: { id: kkPernikahanId },
          transaction: t
        }
      );
    }

    // PROSES 5: Membersihkan data master dan JSONB
    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };
    
    newCatatanAdmin.status_verifikasi_perceraian = `Data perceraian telah dibatalkan. Status hubungan dipulihkan menjadi Kawin oleh ${user_role}.`;
    newCatatanAdmin.tanggal_pembatalan = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = nama_desa_operator;

    const perkawinanPulih = await perkawinan.update({
      status_perkawinan: "Kawin",
      tanggal_cerai: null,
      pihak_meninggal: null,
      ketetapan_silsilah_suami: null,
      ketetapan_silsilah_istri: null,
      is_pending_update: false,
      status_sebelum_draft: null,
      data_perubahan: null,
      catatan_admin_desa: newCatatanAdmin
    }, {
      transaction: t
    });

    await t.commit();
    return perkawinanPulih;
  } catch (error) {
    await t.rollback();
    throw error;
  }
};