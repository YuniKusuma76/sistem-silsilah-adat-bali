import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const KramaBali = db.define("tb_krama_bali", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nomor_pendaftaran: {
    type: DataTypes.STRING(7),
    allowNull: false,
  },
  nama_lengkap: {
    type: DataTypes.STRING,
    allowNull: false
  },
  nama_panggilan: {
    type: DataTypes.STRING,
    allowNull: true
  },
  jenis_kelamin: {
    type: DataTypes.STRING,
    allowNull: true
  },
  tanggal_lahir: {
    type: DataTypes.DATEONLY,
    allowNull: true
  },
  status_hidup: {
    type: DataTypes.STRING,
    allowNull: true,
    defaultValue: "Hidup"
  },
  is_bali: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    defaultValue: true
  },
  desa_adat_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  tempat_asal_khusus: {
    type: DataTypes.STRING,
    allowNull: true,
    comment: "Field untuk menyimpan lokasi kuno"
  },
  alamat_luar: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: "Field untuk menyimpan alamat luar bali"
  },
  tipe_data: {
    type: DataTypes.STRING,
    allowNull: false
  },
  foto_profile: {
    type: DataTypes.STRING,
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
  is_pending_update: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: "Field penanda adanya usulan perubahan yang belum ditinjau"
  },
  data_perubahan: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: "Field untuk menyimpan data baru sementara sebelum di-approve"
  }
}, {
  freezeTableName: true,
  timestamps: true,
  scopes: {
    leluhurOnly: {
      where: {
        tipe_data: 'Leluhur',
      },
      attributes: ['id', 'nomor_pendaftaran', 'nama_lengkap','nama_panggilan', 'jenis_kelamin', 'foto_profile', 'desa_adat_id', 'tempat_asal_khusus', 'tipe_data']
    },
    keturunanFull: {
      where: {
        tipe_data: 'Keturunan'
      },
      include: [{ all: true}]
    }
  }
});

export default KramaBali;