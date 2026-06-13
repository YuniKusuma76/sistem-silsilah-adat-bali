import express from "express";
import {
  getAllDesaAdat,
  getDesaAdatById,
  createDesaAdat,
  updateDesaAdat,
  deleteDesaAdat
} from "../controllers/desa-adat.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get('/', getAllDesaAdat);
router.get('/:id', getDesaAdatById);
router.post('/', verifyToken, createDesaAdat);
router.put('/:id', verifyToken, updateDesaAdat);
router.delete('/:id', verifyToken, deleteDesaAdat);

export default router;