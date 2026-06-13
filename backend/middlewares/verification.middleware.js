import jwt from "jsonwebtoken";
import User from "../models/user.model.js";

// MIDDLEWARE 1: Strict Check Login
export const verifyToken = (req, res, next) => {
  const token = req.cookies.accessToken;
  if (req.query.mode === 'public') {
    return next();
  }

  const authHeader = req.headers['authorization'];


  if (!token) {
    return res.status(401).json({
      message: "Token tidak tersedia! Silakan login!"
    });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, async (error, decoded) => {
    if (error) {
      return res.status(403).json({
        message: "Token tidak valid!"
      });
    }

    try {
      const user = await User.findByPk(decoded.userId, {
        attributes: ["id", "email", "role", "status_akun", "desa_adat_id"]
      });

      if (!user || user.status_akun !== "Aktif") {
        return res.status(403).json({ 
          message: "Akun Anda sudah dinonaktifkan." 
        });
      }

      // Set variable global request
      req.userId = user.id;
      req.email = user.email;
      req.role = user.role;
      req.desaAdatId = user.desa_adat_id;

      next();
    } catch (error) {
      return res.status(500).json({
        message: error.message
      });
    }
  });
};

// MIDDLEWARE 2: Soft Check untuk Public/Guest
export const identifyUser = (req, res, next) => {
  const token = req.cookies.accessToken;

  if (!token) {
    req.userId = null;
    req.role = null;
    req.desaAdatId = null;
    return next();
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      req.userId = null;
      req.role = null;
      req.desaAdatId = null;
      return next();
    }

    req.userId = decoded.userId;
    req.role = decoded.role;
    req.desaAdatId = decoded.desa_adat_id;

    next();
  });
};

// MIDDLEWARE 3: Role Check untuk Super Admin
export const superAdminOnly = async (req, res, next) => {
  if (req.role !== "Super Admin") {
    return res.status(403).json({
      message: "Otoritas untuk mengakses ditolak!"
    });
  }

  next();
};

// MIDDLEWARE 4: Role Check untuk Admin Desa
export const adminDesaOnly = async (req, res, next) => {
  if (req.role !== "Admin Desa") {
    return res.status(403).json({
      message: "Otoritas untuk mengakses ditolak!"
    });
  }

  next();
};

// MIDDLEWARE 5: Role Check untuk Pakar
export const pakarOnly = (req, res, next) => {
  if (req.role !== "Pakar") {
    return res.status(403).json({ 
      message: "Otoritas untuk mengakses ditolak!" 
    });
  }

  next();
};

// MIDDLEWARE 6: Role Check untuk Pakar atau Super Admin
export const pakarOrSuperAdmin = (req, res, next) => {
  if (req.role !== "Pakar" && req.role !== "Super Admin") {
    return res.status(403).json({
      message: "Otoritas untuk mengakses ditolak!"
    });
  }

  next();
};

// MIDDLEWARE 7: Role Check untuk Super Admin atau Admin Desa
export const superAdminOrAdminDesa = (req, res, next) => {
  if (req.role !== "Super Admin" && req.role !== "Admin Desa") {
    return res.status(403).json({
      message: "Otoritas untuk mengakses ditolak!"
    });
  }

  next();
};