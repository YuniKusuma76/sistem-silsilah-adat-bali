import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const Kontak = db.define("tb_kontak", {
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
  pesan: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  status_pesan: {
    type: DataTypes.STRING,
    defaultValue: "Menunggu",
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default Kontak;