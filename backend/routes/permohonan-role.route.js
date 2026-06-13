import express from "express";
import {
  ajukanPermohonan,
  verifikasiPermohonan,
  batalkanPermohonan,
  getDokumenPendukung,
  getAllPermohonan,
  getPermohonanSaya,
  getDetailPermohonan
} from "../controllers/permohonan-role.controller.js";
import { 
  verifyToken, 
  superAdminOnly 
} from "../middlewares/verification.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post("/", verifyToken, (req, res, next) => {
  upload.single('dokumen_pendukung')(req, res, (error) => {
    if (error) {
      // Menangkap error limit file
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({
          message: "Ukuran file terlalu besar! Maksimal ukuran file dokumen pendukung adalah 5MB."
        });
      }
      // Menangkap error format file di middleware
      return res.status(400).json({
        message: error.message
      });
    }
    next();
  });
}, ajukanPermohonan);

router.put("/:id", verifyToken, superAdminOnly, verifikasiPermohonan);
router.put("/cancel/:id", verifyToken, batalkanPermohonan);
router.get("/document/:id", verifyToken, getDokumenPendukung);
router.get("/", verifyToken, superAdminOnly, getAllPermohonan);
router.get("/owner", verifyToken, getPermohonanSaya);
router.get("/:id", verifyToken, getDetailPermohonan);

export default router;