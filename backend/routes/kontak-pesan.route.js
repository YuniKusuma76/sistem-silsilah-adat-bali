import express from "express";
import { 
  getAllPesan,
  getPesanById,
  createPesan,
  updateStatusPesan,
  deletePesan
} from "../controllers/kontak-pesan.controller.js";
import { 
  verifyToken, 
  identifyUser, 
  superAdminOrAdminDesa 
} from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get('/', verifyToken, superAdminOrAdminDesa, getAllPesan);
router.get('/:id', verifyToken, superAdminOrAdminDesa, getPesanById);
router.post('/', identifyUser, createPesan);
router.patch('/update-status/:id', verifyToken, superAdminOrAdminDesa, updateStatusPesan);
router.delete('/:id', verifyToken, superAdminOrAdminDesa, deletePesan);

export default router;