import { AturanAdatBali, KomentarAturanAdat, User } from "../models/associations.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

const VALID_ROLE_PENGIRIM = [
  "Super Admin", 
  "Pakar"
];

export const kirimKomentar = async (req, res) => {
  const { aturan_adat_id, isi_komentar } = req.body;
  
  try {
    if (!isi_komentar || isi_komentar.trim() === "") {
      return res.status(400).json({ 
        message: "Isi komentar wajib diisi!" 
      });
    }

    if (!req.userId) {
      return res.status(401).json({
        message: "Silakan login terlebih dahulu!"
      });
    }

    const user = await User.findByPk(req.userId);
    if (!user) {
      return res.status(404).json({
        message: "Data pengguna tidak ditemukan!"
      });
    }

    if (!VALID_ROLE_PENGIRIM.includes(user.role)) {
      return res.status(403).json({
        message: "Anda tidak memiliki akses untuk memberikan komentar di halaman ini!"
      });
    }

    const dataAturan = await AturanAdatBali.findByPk(aturan_adat_id, {
      attributes: ["kategori", "createdAt"]
    });

    // Membuat slug url untuk navigasi notifikasi
    const tanggalBuat = dataAturan.createdAt.toISOString().split('T')[0];
    const kategoriSlug = dataAturan.kategori.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const encodedId = Buffer.from(String(aturan_adat_id)).toString('base64').replace(/=/g, '');
    const tautanSpesifik = `/aturan-adat-bali/detail/${kategoriSlug}-${tanggalBuat}-${encodedId}`;

    const komentarBaru = await KomentarAturanAdat.create({
      aturan_adat_id,
      user_id: req.userId,
      isi_komentar
    });

    const targetRole = user.role === "Pakar" ? "Super Admin" : "Pakar";
    const penerimaNotif = await User.findAll({
      where: { role: targetRole },
      attributes: ["id"]
    });

    const notifikasiPromises = [];

    penerimaNotif.forEach((penerima) => {
      notifikasiPromises.push(
        kirimNotifikasiSistem(req, {
          judul: "Komentar Diskusi Baru",
          deskripsi: `Adanya komentar baru pada aturan Adat Bali: "${isi_komentar.substring(0, 50)}...".`,
          kategori: "LOG_SISTEM",
          tautan_fitur: tautanSpesifik,
          desa_adat_id: null,
          sender_id: req.userId,
          kontak_pesan_id: null,
          user_id: penerima.id
        })
      );
    });

    await Promise.all(notifikasiPromises);

    return res.status(201).json({ 
      message: "Komentar berhasil dikirim!", 
      data: komentarBaru 
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const getKomentarByAturan = async (req, res) => {
  try {
    const { id } = req.params;

    const listKomentar = await KomentarAturanAdat.findAll({
      where: { aturan_adat_id: id },
      include: [
        {
          model: User,
          as: "pengirim_komentar",
          attributes: ["id", "full_name", "display_name", "email", "role"]
        },{
          model: AturanAdatBali,
          as: "aturan",
          attributes: ["id", "nama_aturan", "kategori", "status_peran_adat"]
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    return res.status(200).json({
      message: "Berhasil mengambil riwayat komentar!", 
      data: listKomentar
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message
    });
  }
};