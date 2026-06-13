import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const DesaAdat = db.define("tb_desa_adat", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  nama_desa_adat: {
    type: DataTypes.STRING,
    allowNull: false
  },
  kecamatan_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default DesaAdat;