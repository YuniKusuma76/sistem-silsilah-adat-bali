import express from "express";
import { 
  createKontak, 
  getKontak, 
  getKontakById,
  updateStatusKontak,
  deleteKontak
} from "../controllers/kontak.controller.js";
import { 
  verifyToken, 
  identifyUser, 
  superAdminOnly 
} from "../middlewares/verification.middleware.js";

const router = express.Router();

router.post('/', identifyUser, createKontak);
router.get('/', verifyToken, superAdminOnly, getKontak);
router.get('/:id', verifyToken, superAdminOnly, getKontakById);
router.patch('/status-pesan/:id', verifyToken, superAdminOnly, updateStatusKontak);
router.delete('/:id', verifyToken, superAdminOnly, deleteKontak);

export default router;