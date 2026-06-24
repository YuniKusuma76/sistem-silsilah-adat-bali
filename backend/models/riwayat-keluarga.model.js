import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const RiwayatKeluarga = db.define("tb_riwayat_keluarga", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  krama_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  keluarga_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  perkawinan_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  kedudukan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kategori_event: {
    type: DataTypes.STRING,
    allowNull: false
  },
  bobot_event: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  awal_masuk: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  akhir_masuk: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  dasar_keputusan: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { fields: ["krama_id"] },
    { fields: ["keluarga_id"] },
    { fields: ["kategori_event"] },
    {
      name: "idx_keluarga_aktif",
      fields: ["keluarga_id", "akhir_masuk"]
    }
  ]
});

export default RiwayatKeluarga;