import express from "express";
import { getSilsilahTree } from "../controllers/silsilah-adat-bali.controller.js";
import { 
  getTrehBali,
  getLeluhurOptions
} from "../controllers/silsilah-leluhur.controller.js";
import { 
  getTrehBaliPuncak,
  getLeluhurPuncakOptions 
} from "../controllers/silsilah-puncak.controller.js";
import { verifyToken } from "../middlewares/verification.middleware.js";

const router = express.Router();

router.get("/leluhur/options", getLeluhurOptions);
router.get("/leluhur/:rootId", getTrehBali);
router.get("/puncak/options", getLeluhurPuncakOptions);
router.get("/puncak/:rootId", verifyToken, getTrehBaliPuncak);
router.get("/krama/:kramaId", verifyToken, getSilsilahTree);

export default router;