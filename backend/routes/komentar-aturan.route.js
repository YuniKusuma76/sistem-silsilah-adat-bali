import express from "express";
import {
  kirimKomentar,
  getKomentarByAturan
} from "../controllers/komentar-aturan.controller.js";
import { 
  verifyToken, 
  pakarOrSuperAdmin 
} from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get("/komentar/:id", verifyToken,pakarOrSuperAdmin, getKomentarByAturan);
router.post("/komentar", verifyToken, pakarOrSuperAdmin, kirimKomentar);

export default router;