import express from "express";
import {
  getNotifikasiSaya,
  markNotifikasiDibaca
} from "../controllers/notifikasi.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get("/personal", verifyToken, getNotifikasiSaya);
router.patch("/read/:id", verifyToken, markNotifikasiDibaca);

export default router;