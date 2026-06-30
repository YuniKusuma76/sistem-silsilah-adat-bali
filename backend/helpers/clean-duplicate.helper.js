import { Op } from "sequelize";
import db from "../config/db.config.js"; 
import dotenv from "dotenv";
import path from "path";
import { RelasiKrama } from "../models/associations.js";

dotenv.config({ path: path.resolve(process.cwd(), "../.env") });

const hapusDuplikatRelasi = async () => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    console.log("=== MEMULAI PROSES PEMBERSIHAN DUPLIKAT ===");

    // Mencari semua anak yang mempunyai relasi ganda yang aktif
    const duplikats = await RelasiKrama.findAll({
      attributes: ['anak_id', 'status_hubungan'],
      where: {
        status_verifikasi: "Disetujui"
      },
      group: ['anak_id', 'status_hubungan'],
      having: db.literal('COUNT(id) > 1'),
      transaction: t,
      raw: true
    });

    if (duplikats.length === 0) {
      console.log("Aman! Tidak ditemukan adanya duplikat relasi krama aktif.");
      await t.rollback();
      return;
    }

    console.log(`Ditemukan ${duplikats.length} kelompok data anak dengan relasi ganda.`);

    // Melakukan iterasi setiap data ganda untuk dibersihkan
    for (const item of duplikats) {
      const listRelasi = await RelasiKrama.findAll({
        where: {
          anak_id: item.anak_id,
          status_hubungan: item.status_hubungan,
          status_verifikasi: "Disetujui"
        },
        order: [['id', 'DESC']],
        transaction: t
      });

      // Mengambil relasi terbaru dan menghapus relasi lama
      const relasiTerbaru = listRelasi[0];
      const idsYangDihapus = listRelasi.slice(1).map(r => r.id);

      console.log(`Anak ID ${item.anak_id}: Mempertahankan Relasi ID ${relasiTerbaru.id}, Menghapus Relasi Lama ID [${idsYangDihapus.join(', ')}]`);

      await RelasiKrama.destroy({
        where: {
          id: { [Op.in]: idsYangDihapus }
        },
        transaction: t
      });
    }

    await t.commit();
    console.log("=== PEMBERSIHAN SELESAI, DATA BERHASIL DI-COMMIT ===");

  } catch (error) {
    await t.rollback();
    console.error("Gagal membersihkan duplikat, transaksi di-rollback:", error.message);
  }
};

hapusDuplikatRelasi();

// Perintah: node helpers/clean-duplicate.helper.js