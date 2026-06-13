import express from 'express';
import {
  getAllRiwayatPeranAdat,
  getRiwayatPeranAdatById
} from '../controllers/riwayat-peran.controller.js';
import { verifyToken } from '../middlewares/verification.middleware.js';

const router = express.Router();

router.get("/", verifyToken, getAllRiwayatPeranAdat);
router.get("/:id", verifyToken, getRiwayatPeranAdatById);

export default router;