import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const RiwayatPeranAdat = db.define("tb_riwayat_peran_adat", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  krama_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  perkawinan_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status_peran_adat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  jenis_perkawinan: {
    type: DataTypes.STRING,
    allowNull: true
  },
  garis_keturunan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  dasar_keputusan: {
    type: DataTypes.TEXT,
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
  mulai_tanggal: {
    type: DataTypes.DATE,
    allowNull: true
  },
  selesai_tanggal: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { fields: ["krama_id"] },
    { fields: ["perkawinan_id"] },
    { fields: ["kategori_event"] },
    {
      name: "idx_peran_aktif_krama",
      fields: ["krama_id", "selesai_tanggal"]
    }
  ]
});

export default RiwayatPeranAdat;