import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fotoFilter = (req, file, cb) => {
  const allowedExtensions = /jpeg|jpg|png/;
  const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedExtensions.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new Error("Format foto tidak valid! Ekstensi berkas wajib berupa gambar dengan format .jpeg/.jpg/.png"));
};

export const uploadFotoProfile = multer({
  storage: storage,
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: fotoFilter
});