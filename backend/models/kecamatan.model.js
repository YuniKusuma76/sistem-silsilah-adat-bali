import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const Kecamatan = db.define("tb_kecamatan", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama_kecamatan: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kabupaten_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default Kecamatan;