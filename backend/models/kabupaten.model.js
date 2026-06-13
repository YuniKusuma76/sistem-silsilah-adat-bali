import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const Kabupaten = db.define("tb_kabupaten", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama_kabupaten: {
    type: DataTypes.STRING,
    allowNull: false
  },
  provinsi_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default Kabupaten;