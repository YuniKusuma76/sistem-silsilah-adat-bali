import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const PermohonanDesa = db.define("tb_permohonan_desa_adat", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  desa_adat_id_asal: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  desa_adat_id_tujuan: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  alasan_pindah: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  dokumen_pendukung: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status_validasi_berkas: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Menunggu Validasi Berkas"
  },
  status_permohonan: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: "Menunggu Verifikasi"
  },
  catatan_validasi: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  catatan_verifikasi: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  divalidasi_oleh: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  diverifikasi_oleh: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tanggal_validasi: {
    type: DataTypes.DATE,
    allowNull: true
  },
  tanggal_verifikasi: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default PermohonanDesa;