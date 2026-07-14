import express from 'express';
import {
  getLeluhurOnly,
  getLeluhurOnlyById,
  getAllKrama,
  getKramaById,
  createKrama,
  verifikasiKrama,
  updateKramaById,
  cancelUpdateKrama,
  deleteKramaById
} from '../controllers/krama.controller.js';
import { verifyToken, superAdminOrAdminDesa } from '../middlewares/verification.middleware.js';
import { uploadFotoProfile } from '../middlewares/upload-foto.middleware.js';

const router = express.Router();

router.get('/leluhur', getLeluhurOnly);
router.get('/leluhur/:id', getLeluhurOnlyById);
router.get('/', verifyToken, getAllKrama);
router.get('/:id', verifyToken, getKramaById);

router.post('/', verifyToken, (req, res, next) => {
  uploadFotoProfile.single('photo-krama')(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Ukuran file terlalu besar! Maksimal ukuran file dokumen pendukung adalah 2MB."
        });
      }
      return res.status(400).json({
        message: error.message
      });
    }
    next();
  });
}, createKrama);

router.put('/:id', verifyToken, (req, res, next) => {
  uploadFotoProfile.single('photo-krama')(req, res, (error) => {
    if (error) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Ukuran file terlalu besar! Maksimal ukuran file dokumen pendukung adalah 2MB."
        });
      }
      return res.status(400).json({
        message: error.message
      });
    }
    next();
  });
}, updateKramaById);

router.patch('/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiKrama);
router.patch('/cancel-update/:id', verifyToken, cancelUpdateKrama);
router.delete('/:id', verifyToken, deleteKramaById);

export default router;