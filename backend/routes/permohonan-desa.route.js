import express from "express";
import {
  ajukanPermohonanDesa,
  validasiBerkas,
  verifikasiPermohonanDesa,
  batalkanPermohonanDesa,
  hapusRiwayatPermohonanDesa,
  getDokumenPendukung,
  getPermohonanAdminDesa,
  getPermohonanSuperAdmin,
  getPermohonanSaya,
  getDetailPermohonanDesa
} from "../controllers/permohonan-desa.controller.js";
import { verifyToken, superAdminOnly, adminDesaOnly } from "../middlewares/verification.middleware.js";
import { upload } from "../middlewares/upload.middleware.js";

const router = express.Router();

router.post("/", verifyToken, (req, res, next) => {
  upload.single('dokumen_pendukung')(req, res, (error) => {
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
}, ajukanPermohonanDesa);

router.patch("/validasi/:id", verifyToken, adminDesaOnly, validasiBerkas);
router.patch("/verifikasi/:id", verifyToken, superAdminOnly, verifikasiPermohonanDesa);
router.put("/cancel/:id", verifyToken, batalkanPermohonanDesa);
router.delete("/:id", verifyToken, hapusRiwayatPermohonanDesa);
router.get("/document/:id", verifyToken, getDokumenPendukung);
router.get("/berkas-desa", verifyToken, adminDesaOnly, getPermohonanAdminDesa);
router.get("/berkas-pusat", verifyToken, superAdminOnly, getPermohonanSuperAdmin);
router.get("/owner", verifyToken, getPermohonanSaya);
router.get("/:id", verifyToken, getDetailPermohonanDesa);

export default router;