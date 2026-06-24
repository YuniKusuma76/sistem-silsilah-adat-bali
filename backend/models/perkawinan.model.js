import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const Perkawinan = db.define("tb_perkawinan", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  suami_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  istri_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  status_perkawinan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Kawin"
  },
  jenis_perkawinan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Biasa"
  },
  tanggal_perkawinan: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  pihak_meninggal: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tanggal_cerai: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  ketetapan_silsilah_suami: {
    type: DataTypes.STRING,
    allowNull: true
  },
  ketetapan_silsilah_istri: {
    type: DataTypes.STRING,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: "Field untuk menyimpan user yang mendaftarkan perkawinan"
  },
  status_verifikasi: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Draft"
  },
  is_approved_desa_suami: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: "Persetujuan khusus dari Admin Desa pihak Suami (untuk Pade Gelahang)"
  },
  is_approved_desa_istri: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: "Persetujuan khusus dari Admin Desa pihak Istri (untuk Pade Gelahang)"
  },
  catatan_admin_desa: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  status_sebelum_draft: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: null
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
  }
}, {
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { fields: ["suami_id"] },
    { fields: ["istri_id"] },
    { fields: ["status_perkawinan"] },
    { fields: ["status_verifikasi"] },
    { fields: ["is_approved_desa_suami"] },
    { fields: ["is_approved_desa_istri"] },
    {
      unique: true,
      name: "idx_perkawinan_aktif",
      fields: ["suami_id", "istri_id"],
      where: {
        status_perkawinan: "Kawin"
      }
    }
  ]
});

export default Perkawinan;