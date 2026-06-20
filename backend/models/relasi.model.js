import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const RelasiKrama = db.define("tb_relasi_krama", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  anak_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  ayah_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  ibu_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  status_hubungan: {
    type: DataTypes.STRING,
    allowNull: true
  },
  urutan_lahir: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tanggal_pengangkatan: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status_verifikasi: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Draft"
  },
  catatan_admin_desa: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status_sebelum_draft: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
  },
  desa_adat_id_tujuan: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  is_pending_update: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: "Field penanda adanya usulan perubahan yang belum di-approve"
  },
  data_perubahan: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: "Field untuk menyimpan data baru sementara sebelum di-approve"
  },
  approved_asal_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "ID Admin Desa Asal Anak yang menyetujui pelepasan"
  },
  approved_tujuan_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: "ID Admin Desa Tujuan/Orang Tua yang menyetujui penerimaan"
  }
}, {
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { fields: ["ayah_id"] },
    { fields: ["ibu_id"] },
    { fields: ["anak_id"] },
    { fields: ["status_verifikasi"] },
    { fields: ["desa_adat_id_tujuan"] },
    { fields: ["approved_asal_by"] },
    { fields: ["approved_tujuan_by"] }
  ]
});

export default RelasiKrama;