import express from 'express';
import {
  getAllPerkawinan,
  getPerkawinanById,
  createPerkawinan,
  verifikasiPerkawinan,
  ceraiPerkawinan,
  verifikasiPerceraian,
  cancelPerceraian,
  deletePerkawinan
} from '../controllers/perkawinan.controller.js';
import { 
  verifyToken,
  superAdminOrAdminDesa
} from '../middlewares/verification.middleware.js';

const router = express.Router();

router.get("/", verifyToken, getAllPerkawinan);
router.get("/:id", verifyToken, getPerkawinanById);
router.post("/kawin", verifyToken, createPerkawinan);
router.patch("/kawin/verifikasi/:id", verifyToken, superAdminOrAdminDesa, verifikasiPerkawinan);
router.delete('/kawin/:id', verifyToken, deletePerkawinan);
router.put("/cerai/:id", verifyToken, ceraiPerkawinan);
router.patch("/cerai/verifikasi/:id", verifyToken, superAdminOrAdminDesa, verifikasiPerceraian);
router.put('/cerai/cancel/:id', verifyToken, superAdminOrAdminDesa, cancelPerceraian);

export default router;