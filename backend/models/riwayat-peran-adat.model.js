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
  mulai_tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  selesai_tanggal: {
    type: DataTypes.DATEONLY,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default RiwayatPeranAdat;