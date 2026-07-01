import { Op } from "sequelize";
import {
  User,
  DesaAdat,
  Kecamatan,
  Kabupaten,
  Provinsi
} from "../models/associations.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { validateUserPayload } from "../utils/validators.js";

// Validasi Input Valid
const VALID_ROLES = [
  "Super Admin", 
  "Pakar", 
  "Admin Desa", 
  "Krama", 
  "Viewer"
];

const VALID_STATUS = [
  "Aktif", 
  "Non-Aktif"
];

// Data Desa Adat Include
const DESA_ADAT_INCLUDE = [
  {
    model: Kecamatan,
    as: "kecamatan",
    include: [
      {
        model: Kabupaten,
        as: "kabupaten",
        include: [
          {
            model: Provinsi,
            as: "provinsi"
          }
        ]
      }
    ]
  }
];

export const Register = async (req, res) => {
  const {
    full_name,
    email,
    password,
    confirmPassword,
    desa_adat_id
  } = req.body;

  // Helper validasi format input
  const errorMessage = validateUserPayload({ 
    full_name, 
    email, 
    password, 
    confirmPassword 
  });

  if (errorMessage) {
    return res.status(400).json({ 
      message: errorMessage 
    });
  }

  // Validasi wilayah desa adat
  if (!desa_adat_id) {
    return res.status(400).json({
      message: "Wilayah desa adat wajib diisi!"
    });
  }

  try {
    // Validasi duplikasi email
    const userExists = await User.findOne({
      where: { email }
    });

    if (userExists) {
      if (userExists.status_akun === "Non-Aktif") {
        if (userExists.role === "Krama") {
          return res.status(409).json({
            message: "E-mail sudah terdaftar tetapi akun telah dinonaktifkan. Silakan hubungi Admin Desa setempat!"
          });
        } else {
          return res.status(409).json({
            message: "E-mail sudah terdaftar tetapi akun telah dinonaktifkan. Silakan hubungi Super Admin!" // Let's discuss
          });
        }
      }
      return res.status(409).json({
        message: "Email sudah terdaftar."
      });
    }

    // Enkripsi password
    const salt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, salt);

    // Auto generate display name
    const randomSuffix = crypto.randomBytes(2).toString('hex');
    const autoDisplayName = `User${randomSuffix}`;

    const user = await User.create({
      full_name,
      display_name: autoDisplayName,
      email,
      password: hashPassword,
      role: "Viewer",
      status_akun: "Aktif",
      desa_adat_id
    });

    const dataUser = await User.findByPk(user.id, {
      attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
      include: [{
        model: DesaAdat,
        as: "desa_adat",
        include: DESA_ADAT_INCLUDE
      }]
    });

    res.status(201).json({
      message: "Registrasi berhasil!",
      data: dataUser
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const Login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      message: "Semua kolom wajib diisi!"
    });
  }

  try {
    const user = await User.findOne({
      where: { email },
      include: [{
        model: DesaAdat,
        as: "desa_adat",
        include: DESA_ADAT_INCLUDE
      }]
    });

    if (!user) {
      return res.status(401).json({
        message: "E-mail atau password salah!"
      });
    }

    if (user.status_akun !== "Aktif") {
      if (user.role === "Krama") {
        return res.status(403).json({
          message: "Akun Anda telah dinonaktifkan. Silakan hubungi Admin Desa setempat!"
        });
      } else {
        return res.status(403).json({
          message: "Akun Anda telah dinonaktifkan. Silakan hubungi Super Admin!" // Let's discuss
        });
      }
    }
    
    // Validasi kecocokan password
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      return res.status(401).json({
        message: "E-mail atau password salah!"
      });
    }

    // Proses generate token dan set cookie
    const payload = {
      userId: user.id,
      email: user.email
    };

    const accessToken = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
      expiresIn: '20m'
    });

    const refreshToken = jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
      expiresIn: '1d'
    });

    await User.update({ 
      refresh_token: refreshToken 
    }, { 
      where: { id: user.id } 
    });

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // True jika deploy menggunakan HTTPS
      sameSite: "strict"
    };

    // Cookie Access Token (Durasi: 20 menit)
    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 20 * 60 * 1000
    });

    // Cookie Refresh Token (Durasi: 1 Hari)
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000
    });

    res.status(200).json({
      message: "Login berhasil!",
      accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        desa_adat: user.desa_adat
      }
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const Logout = async (req, res) => {
  const refreshToken = req.cookies?.refreshToken;

  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", //True jika deploy menggunakan HTTPS
    sameSite: "strict"
  };

  // Jika session sudah tidak ada, pastikan browser tetap bersih
  if (!refreshToken) {
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    return res.sendStatus(204);
  }

  try {
    const user = await User.findOne({
      where: { 
        refresh_token: refreshToken 
      }
    });

    // Jika token tidak cocok dengan user manapun di database
    if (!user) {
      res.clearCookie('accessToken', cookieOptions); 
      res.clearCookie('refreshToken', cookieOptions);
      return res.sendStatus(204);
    }

    // Menghapus refresh token di database
    await User.update({ 
      refresh_token: null 
    }, { 
      where: { id: user.id }
    });

    // Hapus Kedua Cookie di Browser dengan opsi yang tepat
    res.clearCookie('accessToken', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);

    return res.status(200).json({ 
      message: "Logout berhasil!" 
    });
  } catch (error) {
    res.clearCookie('accessToken', cookieOptions); 
    res.clearCookie('refreshToken', cookieOptions);

    res.status(500).json({
      message: "Terjadi kesalahan saat logout.",
      error: error.message
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    let dataUser = [];

    // Filter data berdasarkan role operator
    if (req.role === "Super Admin") {
      dataUser = await User.findAll({
        attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
        include: [{
          model: DesaAdat,
          as: "desa_adat",
          include: DESA_ADAT_INCLUDE
        }],
        order: [["id", "ASC"]]
      });
    } else if (req.role === "Admin Desa") {
      dataUser = await User.findAll({
        where: {
          role: "Krama",
          desa_adat_id: req.desaAdatId
        },
        attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
        include: [{
          model: DesaAdat,
          as: "desa_adat",
          include: DESA_ADAT_INCLUDE
        }],
        order: [["id", "ASC"]]
      });
    } else {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak!"
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil data user!",
      data: dataUser
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getUsers = async (req, res) => {
  try {
    let dataUser = [];

    // Filter data berdasarkan role operator
    if (req.role === "Super Admin") {
      dataUser = await User.findAll({
        where: {
          id: { 
            [Op.ne]: req.userId 
          }
        },
        attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
        include: [{
          model: DesaAdat,
          as: "desa_adat",
          include: DESA_ADAT_INCLUDE
        }],
        order: [["id", "ASC"]]
      });
    } else if (req.role === "Admin Desa") {
      dataUser = await User.findAll({
        where: {
          id: { 
            [Op.ne]: req.userId 
          },
          role: "Krama",
          desa_adat_id: req.desaAdatId
        },
        attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
        include: [{
          model: DesaAdat,
          as: "desa_adat",
          include: DESA_ADAT_INCLUDE
        }],
        order: [["id", "ASC"]]
      });
    } else {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak!"
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil data user!",
      data: dataUser
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
      include: [{
        model: DesaAdat,
        as: "desa_adat",
        include: DESA_ADAT_INCLUDE
      }]
    });

    if (!user) {
      return res.status(404).json({
        message: "Data profil user tidak ditemukan!"
      });
    }

    return res.status(200).json({
      message: "Berhasil mengambil data profil!",
      data: user
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
      include: [{
        model: DesaAdat,
        as: "desa_adat",
        include: DESA_ADAT_INCLUDE
      }]
    });

    if (!user) {
      return res.status(404).json({
        message: "User tidak ditemukan."
      });
    }

    // Logika mengakses otoritas data
    const isProfile = req.userId === user.id;
    
    if (req.role !== "Super Admin" && !isProfile) {
      if (req.role === "Admin Desa") {
        // Admin Desa hanya bisa melihat user dengan role Krama
        if (user.role !== "Krama") {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }

        // Jika role Krama, maka wilayah desa adat harus sama
        if (req.desaAdatId !== user.desa_adat_id) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
          });
        }
      } else {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak!"
        });
      }
    }

    return res.status(200).json({
      message: "Berhasil mengambil data user!",
      data: {
        id: user.id,
        full_name: user.full_name,
        display_name: user.display_name,
        email: user.email,
        role: user.role,
        status_akun: user.status_akun,
        desa_adat: user.desa_adat
      }
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createUser = async (req, res) => {
  const {
    full_name,
    display_name,
    email,
    password,
    confirmPassword,
    role,
    desa_adat_id       
  } = req.body;

  // Helper validasi format input
  const errorMessage = validateUserPayload({ 
    full_name, 
    email, 
    password, 
    confirmPassword 
  });

  if (errorMessage) {
    return res.status(400).json({ 
      message: errorMessage 
    });
  }

  // Validasi panjang karakter display name
  if (display_name !== undefined && display_name !== "") {
    if (display_name.length < 3 || display_name.length > 15) {
      return res.status(400).json({
        message: "Nama tampilan harus di antara 3 sampai 15 karakter!"
      });
    }
  }

  let finalRole = role || "Viewer";

  if (req.role === "Super Admin") {
    if (role && !VALID_ROLES.includes(role)) {
      return res.status(400).json({
        message: "Role tidak valid!"
      });
    }

    const ROLES_WAJIB_WILAYAH = ["Admin Desa", "Krama", "Viewer"];

    if (ROLES_WAJIB_WILAYAH.includes(finalRole)) {
      if (!desa_adat_id || desa_adat_id.toString().trim() === "") {
        return res.status(400).json({
          message: "Kolom wilayah desa adat wajib diisi!"
        });
      }
    }
  } else if (req.role === "Admin Desa") {
    if (!role || role.trim() === "") {
      return res.status(400).json({
        message: "Kolom role wajib diisi!"
      });
    }

    if (role !== "Krama") {
      return res.status(403).json({
        message: "Otoritas untuk mengakses ditolak!"
      });
    }

    if (!desa_adat_id) {
      return res.status(400).json({
        message: "Kolom wilayah desa adat wajib diisi!"
      });
    }

    if (parseInt(desa_adat_id) !== req.desaAdatId) {
      return res.status(403).json({
        message: "Otoritas ditolak! Wilayah desa adat berbeda."
      });
    }
    finalRole = "Krama";
  } else {
    return res.status(403).json({
      message: "Otoritas untuk mengakses ditolak!"
    });
  }

  try {
    // Validasi duplikasi email
    const userExists = await User.findOne({
      where: { email }
    });

    if (userExists) {
      if (userExists.status_akun === "Non-Aktif") {
        if (userExists.role === "Krama") {
          return res.status(409).json({
            message: "E-mail sudah terdaftar tetapi akun telah dinonaktifkan. Silakan hubungi Admin Desa setempat!"
          });
        } else {
          return res.status(409).json({
            message: "E-mail sudah terdaftar tetapi akun telah dinonaktifkan. Silakan hubungi Super Admin!" // Let's discuss
          });
        }
      }
      return res.status(409).json({
        message: "E-mail yang Anda gunakan sudah terdaftar."
      });
    }

    // Enkripsi password
    const salt = await bcrypt.genSalt();
    const hashPassword = await bcrypt.hash(password, salt);

    // Logika auto generate display name
    let finalDisplayName = display_name;

    if (!finalDisplayName || finalDisplayName.trim() === "") {
      const randomSuffix = crypto.randomBytes(2).toString('hex');
      finalDisplayName = `User${randomSuffix}`;
    }

    const newUser = await User.create({
      full_name,
      display_name: finalDisplayName,
      email,
      password: hashPassword,
      role: finalRole,           
      status_akun: "Aktif",
      desa_adat_id: req.role === "Admin Desa" ? req.desaAdatId : desa_adat_id
    });

    const dataUser = await User.findByPk(newUser.id, {
      attributes: ["id", "full_name", "display_name", "email", "role", "status_akun"],
      include: [{
        model: DesaAdat,
        as: "desa_adat",
        include: DESA_ADAT_INCLUDE
      }]
    });

    return res.status(201).json({
      message: "Akun user berhasil dibuat!",
      data: dataUser
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({
        message: "User tidak ditemukan."
      });
    }

    const {
      full_name,
      display_name,
      email,
      oldPassword,
      newPassword,
      confirmPassword,
      role,
      desa_adat_id,
      status_akun
    } = req.body;
    
    // Validasi hak akses edit operator
    const isEditProfile = req.userId === user.id;

    if (req.role !== "Super Admin") {
      if (req.role === "Admin Desa") {
        if (!isEditProfile) {
          // Admin Desa hanya bisa mengedit data dengan role Krama
          if (user.role !== "Krama") {
            return res.status(403).json({
              message: "Otoritas mengakses data ditolak!"
            });
          }
          // Jika role krama, wilayah desa adat harus sama
          if (req.desaAdatId !== user.desa_adat_id) {
            return res.status(403).json({
              message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
            });
          }
        }
        // Admin Desa tidak boleh mengedit role dan desa adat user
        if (role !== undefined || desa_adat_id !== undefined) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
      } else {
        if (!isEditProfile) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }

        if (role !== undefined || desa_adat_id !== undefined) {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
      }
    }

    // Logika mengedit data
    const updateData = {};

    if (full_name) {
      updateData.full_name = full_name;
    }

    // Validasi panjang karakter display name
    if (display_name !== undefined) {
      if (display_name.length < 3 || display_name.length > 15) {
        return res.status(400).json({
          message: "Nama tampilan harus di antara 3 sampai 15 karakter!"
        });
      }
      updateData.display_name = display_name;
    }

    // Logika mengedit password
    if (newPassword && newPassword !== "") {
      if (isEditProfile) {
        // Validasi password lama
        if (!oldPassword) {
          return res.status(400).json({ 
            message: "Password lama wajib diisi!" 
          });
        }
        // Validasi kecocokan password lama
        const match = await bcrypt.compare(oldPassword, user.password);
        if (!match) {
          return res.status(400).json({ 
            message: "Password lama yang Anda masukkan salah!" 
          });
        }
      }
      // Validasi password dan konfirmasi password
      if (newPassword !== confirmPassword) {
        return res.status(400).json({
          message: "Password baru dan konfirmasi password tidak cocok!"
        });
      }
      // Validasi panjang karakter password
      if (newPassword.length < 6) {
        return res.status(400).json({
          message: "Password baru minimal 6 karakter!"
        });
      }
      // Enkripsi password baru
      const salt = await bcrypt.genSalt();
      updateData.password = await bcrypt.hash(newPassword, salt);
    }

    // Logika mengedit e-mail
    if (email && email !== user.email) {
      // Validasi format e-mail
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          message: "Format e-mail tidak valid!"
        });
      }
      // Validasi email terdaftar
      const emailExists = await User.findOne({
        where: { email }
      });
      if (emailExists) {
        return res.status(400).json({
          message: "E-mail yang Anda gunakan sudah terdaftar oleh akun lain."
        });
      }
      updateData.email = email;
    }

    // Manajemen mengedit data berdasarkan operator
    if (req.role === "Super Admin") {
      if (role) {
        if (!VALID_ROLES.includes(role)) {
          return res.status(400).json({
            message: "Role tidak valid!"
          });
        }
        updateData.role = role;
      }
      if (desa_adat_id !== undefined) {
        updateData.desa_adat_id = desa_adat_id;
      }
    }

    if (status_akun) {
      if (!VALID_STATUS.includes(status_akun)) {
        return res.status(400).json({ 
          message: "Status akun tidak valid!" 
        });
      }

      if (req.role !== "Super Admin" && !isEditProfile) {
        if (req.role === "Admin Desa") {
          // Admin Desa hanya bisa mengedit status akun user dengan role Krama
          if (user.role !== "Krama") {
            return res.status(403).json({
              message: "Otoritas mengakses data ditolak!"
            });
          }
          // Jika role krama, wilayah desa adat harus sama
          if (req.desaAdatId !== user.desa_adat_id) {
            return res.status(403).json({
              message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
            });
          }
        } else {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
      }

      updateData.status_akun = status_akun;
      if (status_akun === "Non-Aktif") {
        updateData.refresh_token = null; 
      }
    }

    // Eksekusi update data ke database
    await User.update(updateData, {
      where: { id: user.id }
    });

    const updatedUser = await User.findByPk(user.id, {
      attributes: ["id", "full_name", "display_name", "email", "role", "status_akun", "desa_adat_id"],
      include: [{
        model: DesaAdat,
        as: "desa_adat",
        include: DESA_ADAT_INCLUDE
      }]
    });

    return res.status(200).json({
      message: "Data user berhasil diperbarui!",
      data: {
        id: updatedUser.id,
        full_name: updatedUser.full_name,
        display_name: updatedUser.display_name,
        email: updatedUser.email,
        role: updatedUser.role,
        status_akun: updatedUser.status_akun,
        desa_adat: updatedUser.desa_adat
      }
    });
  } catch (error) {
    return res. status(500).json({
      message: error.message
    });
  }
};

export const deleteUser = async (req, res) => {
  try {
    const user = await User.findOne({
      where: { id: req.params.id }
    });

    if (!user) {
      return res.status(404).json({ 
        message: "Userser tidak ditemukan." 
      });
    }

    if (user.status_akun === "Non-Aktif") {
      return res.status(400).json({ 
        message: "User ini sudah dalam status akun non-aktif." 
      });
    }

    // Validasi hak akses Super Admin
    if (user.role === "Super Admin") {
      const activeSuperAdminCount = await User.count({
        where: {
          role: "Super Admin",
          status_akun: "Aktif"
        }
      });

      if (activeSuperAdminCount <= 1) {
        return res.status(400).json({
          message: "Otoritas mengakses data ditolak! Minimal harus ada satu akun Super Admin yang aktif di dalam sistem."
        });
      }
    }
    // Validasi hak akses Super Admin
    if (req.role === "Admin Desa") {
      const isDeleteProfile = req.userId === user.id;

      if (!isDeleteProfile) {
        if (user.role !== "Krama") {
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
        if (req.desaAdatId !== user.desa_adat_id) {
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          });
        }
      }
    }

    // Eksekusi proses nonaktifkan akun
    await User.update({ 
      status_akun: "Non-Aktif",
      refresh_token: null   
    }, { where: { id: user.id } });

    if (req.userId === user.id) {
      const cookieOptions = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", //True jika deploy menggunakan HTTPS
        sameSite: "strict"
      };

      res.clearCookie('accessToken', cookieOptions);
      res.clearCookie('refreshToken', cookieOptions);
    }

    return res.status(200).json({ 
      message: "Akun user berhasil dinonaktifkan!" 
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};