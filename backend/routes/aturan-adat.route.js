import express from "express";
import {
  getAllAturanAdat,
  getAturanAdatById,
  createAturanAdat,
  updateAturanAdat,
  deleteAturanAdat
} from "../controllers/aturan-adat.controller.js";
import { 
  verifyToken, 
  pakarOrSuperAdmin 
} from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get("/", verifyToken, getAllAturanAdat);
router.get("/:id", verifyToken, getAturanAdatById);
router.post("/", verifyToken, pakarOrSuperAdmin, createAturanAdat);
router.put("/:id", verifyToken, pakarOrSuperAdmin, updateAturanAdat);
router.delete("/:id", verifyToken, pakarOrSuperAdmin, deleteAturanAdat);

export default router;