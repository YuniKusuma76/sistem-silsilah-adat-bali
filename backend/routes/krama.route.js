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
import { 
  verifyToken,
  superAdminOrAdminDesa 
} from '../middlewares/verification.middleware.js';

const router = express.Router();

router.get('/leluhur', getLeluhurOnly);
router.get('/leluhur/:id', getLeluhurOnlyById);
router.get('/', verifyToken, getAllKrama);
router.get('/:id', verifyToken, getKramaById);
router.post('/', verifyToken, createKrama);
router.patch('/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiKrama);
router.put('/:id', verifyToken, updateKramaById);
router.patch('/cancel-update/:id', verifyToken, cancelUpdateKrama);
router.delete('/:id', verifyToken, deleteKramaById);

export default router;