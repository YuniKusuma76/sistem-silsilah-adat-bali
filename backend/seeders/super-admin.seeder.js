import User from "../models/user.model.js";
import bcrypt from "bcrypt";

export const seederSuperAdmin = async () => {
  const superAdminName = process.env.SUPER_ADMIN_NAME;
  const superAdminDisplay = process.env.SUPER_ADMIN_DISPLAY;
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD;

  try {
    // Cek kesediaan akun super admin
    const superAdminExists = await User.findOne({
      where: {
        email: superAdminEmail
      }
    });
    // Buat akun superadmin jika belum ada
    if (!superAdminExists) {
      const salt = await bcrypt.genSalt();
      const hashPassword = await bcrypt.hash(superAdminPassword, salt);

      await User.create({
        full_name: superAdminName,
        display_name: superAdminDisplay,
        email: superAdminEmail,
        password: hashPassword,
        role: "Super Admin",
        status_akun: "Aktif",
        desa_adat_id: null
      });

      console.log('---------------------------------------');
      console.log('Admin Account Created!');
      console.log(`Full Name       : ${superAdminName}`);
      console.log(`Display Name    : ${superAdminDisplay}`);
      console.log(`Email           : ${superAdminEmail}`);
      console.log(`Password        : ${superAdminPassword}`);
      console.log('---------------------------------------');
    }
  } catch (error) {
    console.log("Akun Super Admin gagal dibuat:", error);
  }
};