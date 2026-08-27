import express from 'express';
import {
  getAllRelasiKrama,
  getRelasiKramaById,
  createRelasiKrama,
  updateRelasiKramaById,
  verifikasiRelasiKrama,
  cancelUpdateRelasiKrama,
  deleteRelasiKramaById,
  getBerkasKelengkapan
} from '../controllers/relasi.controller.js';
import { 
  verifyToken,
  superAdminOrAdminDesa
} from '../middlewares/verification.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';

const router = express.Router();

const uploadBerkasMiddleware = (req, res, next) => {
  upload.single('berkas_kelengkapan')(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Ukuran file terlalu besar! Maksimal ukuran file dokumen pendukung adalah 2MB."
        });
      }
      return res.status(400).json({
        message: error.message || "Terjadi kesalahan saat mengunggah berkas."
      });
    }
    next();
  });
};

router.get('/', verifyToken, getAllRelasiKrama);
router.post("/", verifyToken, uploadBerkasMiddleware, createRelasiKrama);
router.patch('/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiRelasiKrama);
router.patch('/cancel-update/:id', verifyToken, cancelUpdateRelasiKrama);
router.get("/document/:id", verifyToken, getBerkasKelengkapan);
router.get('/:id', verifyToken, getRelasiKramaById);
router.put('/:id', verifyToken, uploadBerkasMiddleware, updateRelasiKramaById);
router.delete('/:id', verifyToken, deleteRelasiKramaById);

export default router;