import { Sequelize } from "sequelize";
import db from "../config/db.config.js";
import AturanAdatBali from "./aturan-adat.model.js";

const { DataTypes } = Sequelize;

const KomentarAturanAdat = db.define("tb_komentar_aturan_adat", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  aturan_adat_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  isi_komentar: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  freezeTableName: true,
  timestamps: true
});

export default KomentarAturanAdat;