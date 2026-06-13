import express from "express";
import { 
  Register, 
  Login, 
  Logout 
} from "../controllers/user.controller.js";
import { refreshToken } from "../controllers/refresh-token.controller.js";

const router = express.Router();

router.post('/register', Register);
router.post('/login', Login);
router.get('/refresh-token', refreshToken);
router.post('/logout', Logout);

export default router;