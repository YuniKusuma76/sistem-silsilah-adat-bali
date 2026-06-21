import { Op } from "sequelize";
import {
  Notifikasi,
  User,
  DesaAdat,
  KontakPesan
} from "../models/associations.js";

export const getNotifikasiSaya = async (req, res) => {
  try {
    const userRole = req.role; 
    const userDesaId = req.desaAdatId;
    const currentUserId = req.userId;

    let filterCondition = {};
    let includeCondition = [
      { 
        model: User, 
        as: "pengirim", 
        attributes: ["full_name", "display_name", "email", "role"] 
      },{ 
        model: User, 
        as: "penerima", 
        attributes: ["full_name", "display_name", "email", "role"] 
      },{ 
        model: DesaAdat, 
        as: "asal_notifikasi", 
        attributes: ["nama_desa_adat"] 
      }
    ];

    if (userRole === "Super Admin") {
      filterCondition = {
        [Op.or]: [
          { sender_id: { [Op.ne]: currentUserId } },
          { sender_id: null }
        ]
      };
    } else if (userRole === "Admin Desa") {
      filterCondition = { 
        desa_adat_id: userDesaId,
        [Op.or]: [
          { sender_id: { [Op.ne]: currentUserId } },
          { sender_id: null }
        ] 
      };
    } else if (["Krama", "Pakar", "Viewer"].includes(userRole)) {
      filterCondition = {
        [Op.or]: [
          { user_id: currentUserId },
          { 
            desa_adat_id: userDesaId,
            kontak_pesan_id: { [Op.ne]: null }
          }
        ] 
      };

      includeCondition.push({
        model: KontakPesan,
        as: "sumber_pesan", 
        required: false,
        where: { user_id: currentUserId },
        attributes: ["id", "kategori_pesan", "status_pesan"]
      });
    } else {
      return res.status(403).json({ 
        message: "Otoritas mengakses notifikasi ditolak!" 
      });
    }

    const daftarNotif = await Notifikasi.findAll({
      where: filterCondition,
      include: includeCondition,
      order: [["createdAt", "DESC"]]
    });
    return res.status(200).json({
      message: "Berhasil mengambil semua notifikasi sistem yang masuk.",
      data: daftarNotif
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};

export const markNotifikasiDibaca = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.userId;

    const notif = await Notifikasi.findByPk(id);

    if (!notif) {
      return res.status(404).json({ 
        message: "Notifikasi tidak ditemukan" 
      });
    }

    if (notif.sender_id === currentUserId) {
      return res.status(403).json({
        message: "Otoritas mengakses ditolak! Anda tidak dapat memproses notifikasi dari aksi Anda sendiri."
      });
    }

    notif.is_read = true;
    await notif.save();

    return res.status(200).json({ 
      message: "Berhasil membaca notifikasi sistem yang masuk." 
    });
  } catch (error) {
    return res.status(500).json({ 
      message: error.message 
    });
  }
};