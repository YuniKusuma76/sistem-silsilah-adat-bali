import express from 'express';
import {
  getAllPerkawinan,
  getPerkawinanById,
  createPerkawinan,
  verifikasiPerkawinan,
  createPerceraian,
  verifikasiPerceraian,
  cancelPerceraian,
  deletePerkawinan,
  updatePerkawinanById,
  verifikasiUpdatePerkawinan,
  cancelUpdatePerkawinanById,
  cancelUpdatePerceraianById
} from '../controllers/perkawinan.controller.js';
import { 
  verifyToken,
  superAdminOrAdminDesa
} from '../middlewares/verification.middleware.js';

const router = express.Router();

router.post("/kawin", verifyToken, createPerkawinan);
router.put("/cerai/:id", verifyToken, createPerceraian);
router.put("/update/:id", verifyToken, updatePerkawinanById);
router.patch("/kawin/verifikasi/:id", verifyToken, superAdminOrAdminDesa, verifikasiPerkawinan);
router.patch("/cerai/verifikasi/:id", verifyToken, superAdminOrAdminDesa, verifikasiPerceraian);
router.patch("/update/verifikasi/:id", verifyToken, superAdminOrAdminDesa, verifikasiUpdatePerkawinan);
router.patch('/cerai/cancel-draft/:id', verifyToken, cancelPerceraian);
router.delete('/kawin/cancel-draft/:id', verifyToken, deletePerkawinan);
router.patch("/kawin/cancel-update/:id", verifyToken, cancelUpdatePerkawinanById);
router.patch("/cerai/cancel-update/:id", verifyToken, cancelUpdatePerceraianById);
router.get("/", verifyToken, getAllPerkawinan);
router.get("/:id", verifyToken, getPerkawinanById);

export default router;