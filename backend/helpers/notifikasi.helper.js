import Notifikasi from "../models/notifikasi.model.js";

export const kirimNotifikasiSistem = async (req, {
  judul,
  deskripsi,
  kategori,
  tautan_fitur,
  desa_adat_id,
  sender_id,
  kontak_pesan_id,
  user_id
}, transaction = null) => {
  try {
    // Memulai transaksi query notifikasi
    const queryOptions = transaction ? { transaction } : {};
    const notifBaru = await Notifikasi.create({
      judul,
      deskripsi,
      kategori,
      tautan_fitur,
      is_read: false,
      desa_adat_id: desa_adat_id || null,
      sender_id: sender_id || null,
      kontak_pesan_id: kontak_pesan_id || null,
      user_id: user_id || null
    }, queryOptions);
    return notifBaru;
  } catch (error) {
    console.error("Gagal mengeksekusi helper notifikasi:", error.message);
    throw new Error(error.message);
  }
};