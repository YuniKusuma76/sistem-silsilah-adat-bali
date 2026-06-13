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
router.get('/:id', verifyToken, getRelasiKramaById);
router.post('/', verifyToken, createRelasiKrama);
router.patch('/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiRelasiKrama);
router.put('/:id', verifyToken, updateRelasiKramaById);
router.patch('/cancel-update/:id', verifyToken, cancelUpdateRelasi);
router.delete('/:id', verifyToken, deleteRelasiKramaById);

export default router;