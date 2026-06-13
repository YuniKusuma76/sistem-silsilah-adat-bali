import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const AturanAdatBali = db.define("tb_aturan_adat_bali", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama_aturan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kategori: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kriteria_kondisi: {
    type: DataTypes.JSON,
    allowNull: false
  },
  status_peran_adat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  garis_keturunan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dasar_keputusan: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status_aturan: {
    type: DataTypes.ENUM("Aktif","Non-Aktif"),
    defaultValue: "Aktif",
    allowNull: false
  },
  dibuat_oleh: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default AturanAdatBali;