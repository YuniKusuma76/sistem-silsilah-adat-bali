import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

export const refreshToken = async (req, res) => {
  try {
    // Mengambil refresh token dari cookie
    const refreshTokenValue = req.cookies?.refreshToken;
    if (!refreshTokenValue) { 
      return res.sendStatus(401);
    }

    const user = await User.findOne({
      where: {
        refresh_token: refreshTokenValue
      }
    });

    if (!user) {
      return res.sendStatus(403);
    }

    // Verifikasi token
    jwt.verify(refreshTokenValue, process.env.REFRESH_TOKEN_SECRET, (error, decoded) => {
      if (error) {
        return res.sendStatus(403);
      }

      const payload = {
        userId: user.id,
        fullName: user.full_name,
        displayName: user.display_name,
        email: user.email,
        role: user.role,
        desaAdatId: user.desa_adat_id
      };
      
      const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '20m'
      });

      // Set access token ke cookie
      res.cookie('accessToken', accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", //True ketika deploy dengan HTTPS
        sameSite: "strict",
        maxAge: 20 * 60 * 1000 
      });

      res.status(200).json({ 
        message: "Token successfully refreshed.",
        user: payload
      });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ 
      message: "Internal Server Error." 
    });
  }
};