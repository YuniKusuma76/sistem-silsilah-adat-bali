import express from "express";
import {
  getAllKecamatan,
  getKecamatanById,
  createKecamatan,
  updateKecamatan,
  deleteKecamatan
} from "../controllers/kecamatan.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get('/', getAllKecamatan);
router.get('/:id', getKecamatanById);
router.post('/', verifyToken, createKecamatan);
router.put('/:id', verifyToken, updateKecamatan);
router.delete('/:id', verifyToken, deleteKecamatan);

export default router;