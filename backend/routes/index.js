import express from "express";
import UserRoute from "./user.route.js";
import PermohonanRoleRoute from "./permohonan-role.route.js";
import PermohonanDesaRoute from "./permohonan-desa.route.js";
import ProvinsiRoute from "./provinsi.route.js";
import KabupatenRoute from "./kabupaten.route.js";
import KecamatanRoute from "./kecamatan.route.js";
import DesaAdatRoute from "./desa-adat.route.js";
import AturanAdatRoute from "./aturan-adat.route.js";

import KramaRoute from './krama.route.js';
import KeluargaRoute from './keluarga.route.js';
import RelasiKramaRoute from './relasi.route.js';
import PerkawinanRoute from './perkawinan.route.js';
import RiwayatKeluargaRoute from './riwayat-keluarga.route.js';
import RiwayatPeranAdatRoute from './riwayat-peran.route.js';
import SilsilahRoute from './silsilah.route.js';
import KontakRoute from "./kontak.route.js";

const routes = express.Router();

routes.use('/users', UserRoute);
routes.use("/permohonan-role", PermohonanRoleRoute);
routes.use("/permohonan-desa", PermohonanDesaRoute);
routes.use("/provinsi", ProvinsiRoute);
routes.use("/kabupaten", KabupatenRoute);
routes.use("/kecamatan", KecamatanRoute);
routes.use("/desa-adat", DesaAdatRoute);
routes.use('/aturan-adat', AturanAdatRoute);
routes.use('/krama-bali', KramaRoute);
routes.use('/relasi-krama', RelasiKramaRoute);
routes.use('/perkawinan', PerkawinanRoute);

routes.use('/keluarga', KeluargaRoute);
routes.use('/riwayat-keluarga', RiwayatKeluargaRoute);
routes.use('/riwayat-peran-adat', RiwayatPeranAdatRoute);
routes.use('/silsilah', SilsilahRoute);
routes.use('/kontak', KontakRoute);

export default routes;