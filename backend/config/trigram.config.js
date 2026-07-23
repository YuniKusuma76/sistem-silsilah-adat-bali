import db from "./db.config.js";

export const initPgTrgm = async () => {
  try {
    await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm;`);
    console.log("Extension 'pg_trgm' berhasil diaktifkan!");

    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_tb_krama_bali_nama_trgm 
      ON tb_krama_bali USING gin (nama_lengkap gin_trgm_ops);
    `);
    console.log("Index Trigram 'idx_tb_krama_bali_nama_trgm' siap digunakan.");
  } catch (error) {
    console.error("Gagal menginisialisasi pg_trgm extension/index:", error.message);
  }
};