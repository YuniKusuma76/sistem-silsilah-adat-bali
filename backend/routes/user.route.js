import express from "express";
import {
  getAllUsers, 
  getUsers,
  getProfile, 
  getUserById,
  createUser, 
  updateUser,
  deleteUser 
} from "../controllers/user.controller.js";
import { 
  superAdminOrAdminDesa, 
  verifyToken 
} from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get('/', verifyToken, getAllUsers);
router.get('/conditional', verifyToken, getUsers);
router.get('/profile', verifyToken, getProfile);
router.get('/:id', verifyToken, getUserById);
router.post('/', verifyToken, superAdminOrAdminDesa, createUser);
router.patch('/:id', verifyToken, updateUser);
router.delete('/:id', verifyToken, superAdminOrAdminDesa, deleteUser);

export default router;