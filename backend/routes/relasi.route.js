import express from 'express';
import {
  getAllRelasiKrama,
  getRelasiKramaById,
  createRelasiKrama,
  verifikasiRelasiKrama,
  updateRelasiKramaById,
  verifikasiUpdateRelasiKrama,
  cancelUpdateRelasiKrama,
  deleteRelasiKramaById
} from '../controllers/relasi.controller.js';
import { 
  verifyToken,
  superAdminOrAdminDesa
} from '../middlewares/verification.middleware.js';

const router = express.Router();

// 1. Route Kolektif & Pendaftaran (Tanpa ID di depan)
router.get('/', verifyToken, getAllRelasiKrama);
router.post('/', verifyToken, createRelasiKrama);

// 2. Route Spesifik / Fitur Khusus (Prefix Jelas)
router.patch('/create/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiRelasiKrama);
router.patch('/update/verifikasi/:id', verifyToken, superAdminOrAdminDesa, verifikasiUpdateRelasiKrama);
router.patch('/cancel-update/:id', verifyToken, cancelUpdateRelasiKrama);

// 3. Route CRUD Dinamis Murni (Wajib ditaruh paling bawah)
router.get('/:id', verifyToken, getRelasiKramaById);
router.put('/:id', verifyToken, updateRelasiKramaById);
router.delete('/:id', verifyToken, deleteRelasiKramaById);

export default router;