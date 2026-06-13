export const validateUserPayload = ({
  full_name,
  email,
  password,
  confirmPassword, 
  isUpdate = false
}) => {
  // 1. Validasi Field Wajib
  if (!isUpdate && (!full_name || !email || !password || !confirmPassword)) {
    return "Semua kolom wajib diisi!"
  }

  // 2. Validasi Format Email
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return "Format e-mail tidak valid!";
    }
  }

  // 3. Validasi Password
  if (password) {
    if (password.length < 6) {
      return "Password minimal harus 6 karakter!";
    }
    if (password !== confirmPassword) {
      return "Password dan konfirmasi password tidak cocok!";
    }
  }

  return null;
};