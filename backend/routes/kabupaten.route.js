import express from "express";
import {
  getAllKabupaten,
  getKabupatenById,
  createKabupaten,
  updateKabupaten,
  deleteKabupaten
} from "../controllers/kabupaten.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get('/', getAllKabupaten);
router.get('/:id', getKabupatenById);
router.post('/', verifyToken, createKabupaten);
router.put('/:id', verifyToken, updateKabupaten);
router.delete('/:id', verifyToken, deleteKabupaten);

export default router;