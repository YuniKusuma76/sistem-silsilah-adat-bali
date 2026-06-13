import express from 'express';
import {
  getAllRiwayatKeluarga,
  getRiwayatKeluargaById
} from '../controllers/riwayat-keluarga.controller.js';
import { verifyToken } from '../middlewares/verification.middleware.js';

const router = express.Router();

router.get("/", verifyToken, getAllRiwayatKeluarga);
router.get("/:id", verifyToken, getRiwayatKeluargaById);

export default router;