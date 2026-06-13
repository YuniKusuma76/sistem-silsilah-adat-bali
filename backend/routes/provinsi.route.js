import express from "express";
import {
  getAllProvinsi,
  getProvinsiById,
  createProvinsi,
  updateProvinsi,
  deleteProvinsi
} from "../controllers/provinsi.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get('/', getAllProvinsi);
router.get('/:id', getProvinsiById);
router.post('/', verifyToken, createProvinsi);
router.put('/:id', verifyToken, updateProvinsi);
router.delete('/:id', verifyToken, deleteProvinsi);

export default router;