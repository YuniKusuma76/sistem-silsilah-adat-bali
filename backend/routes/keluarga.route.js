import express from 'express';
import {
  getAllKeluarga,
  getKeluargaById
} from '../controllers/keluarga.controller.js';
import { verifyToken } from '../middlewares/verification.middleware.js';

const router = express.Router();

router.get("/", verifyToken, getAllKeluarga);
router.get("/:id", verifyToken, getKeluargaById);

export default router;