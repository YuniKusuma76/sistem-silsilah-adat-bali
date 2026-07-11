import express from "express";
import {
  getAllAturanAdat,
  getAturanAdatById,
  createAturanAdat,
  updateAturanAdat,
  approvedUpdateAturan,
  cancelUpdateAturan,
  activeAturanAdat,
  deleteAturanAdat
} from "../controllers/aturan-adat.controller.js";
import { 
  verifyToken, 
  pakarOrSuperAdmin,
  superAdminOnly
} from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get("/", verifyToken, getAllAturanAdat);
router.get("/:id", verifyToken, getAturanAdatById);
router.post("/", verifyToken, pakarOrSuperAdmin, createAturanAdat);
router.put("/:id", verifyToken, pakarOrSuperAdmin, updateAturanAdat);
router.patch("/verifikasi/:id", verifyToken, superAdminOnly, approvedUpdateAturan);
router.patch("/cancel/:id", verifyToken, pakarOrSuperAdmin, cancelUpdateAturan);
router.patch("/active/:id", verifyToken, pakarOrSuperAdmin, activeAturanAdat);
router.delete("/:id", verifyToken, superAdminOnly, deleteAturanAdat);

export default router;