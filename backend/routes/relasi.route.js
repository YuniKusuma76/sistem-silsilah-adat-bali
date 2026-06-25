import express from 'express';
import {
  getAllRelasiKrama,
  getRelasiKramaById,
  createRelasiKrama,
  verifikasiRelasiKrama,
  updateRelasiKramaById,
  cancelUpdateRelasi,
  deleteRelasiKramaById
} from '../controllers/relasi.controller.js';
import { 
  verifyToken,
  superAdminOrAdminDesa
} from '../middlewares/verification.middleware.js';

const router = express.Router();

router.get('/', verifyToken, getAllRelasiKrama);
router.post('/', verifyToken, createRelasiKrama);
router.patch('/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiRelasiKrama);
router.patch('/cancel-update/:id', verifyToken, cancelUpdateRelasi);
router.get('/:id', verifyToken, getRelasiKramaById);
router.put('/:id', verifyToken, updateRelasiKramaById);
router.delete('/:id', verifyToken, deleteRelasiKramaById);

export default router;