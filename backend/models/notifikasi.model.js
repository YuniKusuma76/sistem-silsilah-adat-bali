import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const Notifikasi = db.define("tb_notifikasi", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  judul: {
    type: DataTypes.STRING,
    allowNull: false
  },
  deskripsi: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  kategori: {
    type: DataTypes.STRING,
    allowNull: false
  },
  tautan_fitur: {
    type: DataTypes.STRING,
    allowNull: true
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  desa_adat_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  sender_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Field untuk user yang mengirimkan notifikasi"
  },
  kontak_pesan_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Field yang menghubungkan notifikasi dengan laporan pengaduan"
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "Field untuk user yang menerima notifikasi"
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default Notifikasi;