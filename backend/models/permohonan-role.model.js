import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const PermohonanRole = db.define("tb_permohonan_role", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  role_yang_diminta: {
    type: DataTypes.STRING,
    allowNull: false
  },
  desa_adat_id_tujuan: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  alasan_permohonan: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dokumen_pendukung: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status_permohonan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Menunggu"
  },
  catatan_super_admin: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  diverifikasi_oleh: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tanggal_pengajuan: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  tanggal_verifikasi: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default PermohonanRole;