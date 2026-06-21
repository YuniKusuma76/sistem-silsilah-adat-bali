import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const KontakPesan = db.define("tb_kontak_pesan", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama_pengirim: {
    type: DataTypes.STRING,
    allowNull: false
  },
  email_address: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  kategori_pesan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  pesan: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status_pesan: {
    type: DataTypes.STRING,
    defaultValue: "Menunggu",
    allowNull: false
  },
  desa_adat_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default KontakPesan;