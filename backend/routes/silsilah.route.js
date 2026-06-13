import express from "express";
import { getSilsilahTree } from "../controllers/silsilah-adat-bali.controller.js";
import { getTrehBali } from "../controllers/silsilah-leluhur.controller.js";
import { getTrehBaliPuncak } from "../controllers/silsilah-puncak.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get("/leluhur/:rootId", getTrehBali);
router.get("/puncak/:rootId", verifyToken, getTrehBaliPuncak);
router.get("/krama/:kramaId", verifyToken, getSilsilahTree);

export default router;