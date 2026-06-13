import express from 'express';
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from 'cors';
import helmet from "helmet";
import path from 'path';
import db from './config/db.config.js';
import './models/associations.js';
import routes from './routes/index.js';
import AuthRoute from './routes/auth.route.js';
import { seederSuperAdmin } from "./seeders/super-admin.seeder.js";
import { seederWilayahBali } from "./seeders/wilayah-bali.seeder.js";

dotenv.config();

const app = express();
const APP_PORT = process.env.APP_PORT || 5000;
const __dirname = path.resolve();

app.use(helmet());
app.use(express.json());
app.use(cookieParser());

app.use(cors({
  credentials: true,
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  exposedHeaders: ['Content-Disposition']
}));

app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, 'assets', 'panda.jpg'));
});

app.use("/api", AuthRoute); 
app.use("/api", routes);

const initApp = async () => {
  try {
    await db.authenticate();
    console.log("Database connected...");

    await db.sync();
    await seederSuperAdmin();
    await seederWilayahBali();

    app.listen(APP_PORT, () => console.log(`Server running at port ${APP_PORT}`));
  } catch (error) {
    console.log(error);
  }
};

initApp();