import { Sequelize } from "sequelize";
import db from "../config/db.config.js";

const { DataTypes } = Sequelize;

const Keluarga = db.define("tb_keluarga", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  kepala_keluarga_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  jenis_keluarga: {
    type: DataTypes.STRING,
    allowNull: false
  },
  status_keluarga: {
    type: DataTypes.STRING,
    defaultValue: "Aktif",
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true,
  indexes: [
    { fields: ["kepala_keluarga_id"] },
    { fields: ["status_keluarga"] }
  ]
});

export default Keluarga;