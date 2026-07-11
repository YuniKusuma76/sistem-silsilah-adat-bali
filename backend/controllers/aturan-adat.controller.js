import { AturanAdatBali, User } from "../models/associations.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

const VALID_STATUS_PERAN_ADAT = [
  "Purusa", 
  "Predana", 
  "Tidak Memiliki Status Peran Adat"
];

const VALID_GARIS_KETURUNAN = [
  "Purusa", 
  "Purusa Nyentana", 
  "Purusa Pade Gelahang", 
  "Predana", 
  "Tidak Memiliki Garis Keturunan"
];

const VALID_KATEGORI = [
  "LAHIR", 
  "PENGANGKATAN", 
  "KAWIN", 
  "CERAI"
];

export const getAllAturanAdat = async (req, res) => {
  try {
    const daftarAturan = await AturanAdatBali.findAll({
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }],
      order: [["updatedAt", "DESC"]]
    });

    return res.status(200).json({
      message: "Berhasil mengambil data aturan adat bali yang terdaftar!",
      data: daftarAturan
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const getAturanAdatById = async (req, res) => {
  try {
    const dataAturan = await AturanAdatBali.findOne({
      where: { id: req.params.id },
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    if (!dataAturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    let responData = dataAturan.toJSON();

    if (responData.is_pending_update && responData.data_perubahan) {
      responData.usulan_perubahan = responData.data_perubahan;
    } else {
      responData.usulan_perubahan = null;
    }

    return res.status(200).json({
      message: "Berhasil mengambil data aturan adat bali yang terdaftar!",
      data: responData
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createAturanAdat = async (req, res) => {
  const {
    nama_aturan,
    kategori,
    kriteria_kondisi,
    status_peran_adat,
    garis_keturunan,
    dasar_keputusan
  } = req.body;

  if (!nama_aturan || !kategori || !status_peran_adat || !garis_keturunan || !dasar_keputusan) {
    return res.status(400).json({
      message: "Semua kolom wajib diisi!"
    });
  }

  if (!kriteria_kondisi || typeof kriteria_kondisi !== 'object' || Array.isArray(kriteria_kondisi) || kriteria_kondisi === null || Object.keys(kriteria_kondisi).length === 0) {
    return res.status(400).json({
      message: "Kriteria kondisi wajib diisi dan tidak boleh kosong!"
    });
  }

  if (!VALID_KATEGORI.includes(kategori)) {
    return res.status(400).json({ 
      message: "Kategori aturan adat bali tidak valid!" 
    });
  }

  if (!VALID_STATUS_PERAN_ADAT.includes(status_peran_adat)) {
    return res.status(400).json({ 
      message: "Status peran adat bali tidak valid!" 
    });
  }

  if (!VALID_GARIS_KETURUNAN.includes(garis_keturunan)) {
    return res.status(400).json({ 
      message: "Garis keturunan tidak valid!" 
    });
  }
  
  try {
    const aturanBaru = await AturanAdatBali.create({
      nama_aturan,
      kategori,
      kriteria_kondisi,
      status_peran_adat,
      garis_keturunan,
      dasar_keputusan,
      status_aturan: "Non-Aktif",
      dibuat_oleh: req.userId
    });

    await kirimNotifikasiSistem(req, {
      judul: "Aturan Adat Bali Baru",
      deskripsi: `Adanya aturan adat bali baru yang telah terdaftar ke dalam sistem: ${nama_aturan}.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: "/aturan-adat-bali",
      desa_adat_id: null,
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: null
    });

    return res.status(201).json({
      message: "Data aturan adat bali berhasil ditambahkan!",
      data: aturanBaru
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const updateAturanAdat = async (req, res) => {
  try {
    const aturan = await AturanAdatBali.findOne({
      where: { id: req.params.id }
    });

    if (!aturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    const {
      nama_aturan,
      kategori,
      kriteria_kondisi,
      status_peran_adat,
      garis_keturunan,
      dasar_keputusan,
      status_aturan
    } = req.body;

    if (!nama_aturan || !kategori || !status_peran_adat || !garis_keturunan || !dasar_keputusan) {
      return res.status(400).json({
        message: "Semua kolom wajib diisi!"
      });
    }

    if (!kriteria_kondisi || typeof kriteria_kondisi !== 'object' || Array.isArray(kriteria_kondisi) || kriteria_kondisi === null || Object.keys(kriteria_kondisi).length === 0) {
      return res.status(400).json({
        message: "Kriteria kondisi wajib diisi dalam format objek JSON yang valid dan tidak boleh kosong!"
      });
    }

    if (!VALID_KATEGORI.includes(kategori)) {
      return res.status(400).json({ 
        message: "Kategori aturan adat tidak valid!" 
      });
    }

    if (!VALID_STATUS_PERAN_ADAT.includes(status_peran_adat)) {
      return res.status(400).json({ 
        message: "Status peran adat tidak valid!" 
      });
    }

    if (!VALID_GARIS_KETURUNAN.includes(garis_keturunan)) {
      return res.status(400).json({ 
        message: "Garis keturunan tidak valid!" 
      });
    }

    // PERUBAHAN PADA KRITERIA KONDISI
    const isUpdateKey = JSON.stringify(kriteria_kondisi) !== JSON.stringify(aturan.kriteria_kondisi);
    const isUpdateKategori = kategori !== aturan.kategori;
    let pesanResponse = "";

    if (isUpdateKey || isUpdateKategori) {
      await AturanAdatBali.update({
        is_pending_update: true,
        status_sebelum_draft: aturan.status_aturan,
        data_perubahan: {
          nama_aturan,
          kategori,
          kriteria_kondisi,
          status_peran_adat,
          garis_keturunan,
          dasar_keputusan
        }
      }, { where: { id: aturan.id } });
      pesanResponse = "Berhasil menyimpan perubahan kriteria aturan! Menunggu penyesuaian aturan oleh Super Admin.";
    } else {
      await AturanAdatBali.update({
        nama_aturan,
        status_peran_adat,
        garis_keturunan,
        dasar_keputusan,
        status_aturan
      }, { where: { id: aturan.id } });
      pesanResponse = "Berhasil memperbarui data aturan adat bali!";
    }

    const updateAturan = await AturanAdatBali.findByPk(aturan.id, {
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    await kirimNotifikasiSistem(req, {
      judul: (isUpdateKey || isUpdateKategori) ? "Perubahan Struktur Aturan Adat Bali" : "Perubahan Aturan Adat Bali",
      deskripsi: (isUpdateKey || isUpdateKategori) 
        ? `Adanya usulan perubahan struktur baru pada aturan adat bali: ${nama_aturan}.`
        : `Adanya perubahan data pada aturan adat bali: ${nama_aturan}.`,
      kategori: (isUpdateKey || isUpdateKategori) ? "VERIFIKASI" : "LOG_SISTEM",
      tautan_fitur: "/aturan-adat-bali",
      desa_adat_id: null,
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: null
    });

    return res.status(200).json({
      message: pesanResponse,
      data: updateAturan
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const approvedUpdateAturan = async (req, res) => {
  try {
    const { id } = req.params;
    const aturan = await AturanAdatBali.findByPk(id);

    if (!aturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    if (!aturan.is_pending_update || !aturan.data_perubahan) {
      return res.status(400).json({
        message: "Tidak ada usulan perubahan struktur data aturan adat bali yang perlu ditinjau."
      });
    }

    const drafBaru = aturan.data_perubahan;
    const statusFinal = aturan.status_sebelum_draft || aturan.status_aturan;

    await AturanAdatBali.update({
      nama_aturan: drafBaru.nama_aturan,
      kategori: drafBaru.kategori,
      kriteria_kondisi: drafBaru.kriteria_kondisi,
      status_peran_adat: drafBaru.status_peran_adat,
      garis_keturunan: drafBaru.garis_keturunan,
      dasar_keputusan: drafBaru.dasar_keputusan,
      status_aturan: statusFinal,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null
    }, { where: { id: aturan.id } });

    const aturanTerupdate = await AturanAdatBali.findByPk(aturan.id, {
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    const tanggalBuat = aturanTerupdate.createdAt.toISOString().split('T')[0];
    const kategoriSlug = aturanTerupdate.kategori.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const encodedId = Buffer.from(String(aturanTerupdate.id)).toString('base64').replace(/=/g, '');
    const tautanSpesifik = `/aturan-adat-bali/detail/${kategoriSlug}-${tanggalBuat}-${encodedId}`;

    await kirimNotifikasiSistem(req, {
      judul: "Pembaruan Struktur Aturan Adat Bali",
      deskripsi: `Struktur baru telah diterapkan pada aturan adat bali: ${aturanTerupdate.nama_aturan}.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: tautanSpesifik,
      desa_adat_id: null,
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: aturanTerupdate.dibuat_oleh
    });

    return res.status(200).json({
      message: "Perubahan struktur aturan adat bali berhasil diaktifkan!",
      data: aturanTerupdate
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const cancelUpdateAturan = async (req, res) => {
  try {
    const { id } = req.params;
    
    const aturan = await AturanAdatBali.findByPk(id);
    if (!aturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    if (!aturan.is_pending_update || !aturan.data_perubahan) {
      return res.status(400).json({
        message: "Tidak ada usulan perubahan struktur data aturan adat bali yang perlu ditinjau."
      });
    }

    const namaAturan = aturan.nama_aturan;
    const pakarId = aturan.dibuat_oleh;

    await AturanAdatBali.update({
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null
    }, { where: { id: aturan.id } });

    const aturanTerupdate = await AturanAdatBali.findByPk(aturan.id, {
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    const tanggalBuat = aturanTerupdate.createdAt.toISOString().split('T')[0];
    const kategoriSlug = aturanTerupdate.kategori.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const encodedId = Buffer.from(String(aturanTerupdate.id)).toString('base64').replace(/=/g, '');
    const tautanSpesifik = `/aturan-adat-bali/detail/${kategoriSlug}-${tanggalBuat}-${encodedId}`;

    const isAdmin = req.role === "Super Admin";
    const notifikasiPromises = [];

    if (isAdmin) {
      notifikasiPromises.push(
        kirimNotifikasiSistem(req, {
          judul: "Perubahan Struktur Aturan Ditolak",
          deskripsi: `Usulan perubahan struktur baru pada aturan adat bali telah ditolak oleh Super Admin: "${namaAturan}".`,
          kategori: "LOG_SISTEM",
          tautan_fitur: tautanSpesifik,
          desa_adat_id: null,
          sender_id: req.userId,
          kontak_pesan_id: null,
          user_id: pakarId
        })
      );
    } else {
      const daftarAdmin = await User.findAll({
        where: { role: "Super Admin" },
        attributes: ["id"]
      });

      daftarAdmin.forEach((admin) => {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: "Perubahan Struktur Aturan Dibatalkan",
            deskripsi: `Usulan perubahan struktur baru pada aturan adat bali telah dibatalkan oleh Pakar: "${namaAturan}".`,
            kategori: "LOG_SISTEM",
            tautan_fitur: tautanSpesifik,
            desa_adat_id: null,
            sender_id: req.userId,
            kontak_pesan_id: null,
            user_id: admin.id 
          })
        );
      });
    }
    
    await Promise.all(notifikasiPromises);
    
    return res.status(200).json({
      message: isAdmin 
        ? "Usulan perubahan struktur baru aturan adat bali berhasil ditolak!" 
        : "Usulan perubahan struktur baru aturan adat bali berhasil ditarik kembali!",
      data: aturanTerupdate
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const activeAturanAdat = async (req, res) => {
  try {
    const aturan = await AturanAdatBali.findOne({
      where: { id: req.params.id }
    });

    if (!aturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    if (aturan.status_aturan === "Aktif") {
      return res.status(400).json({
        message: "Aturan adat bali ini sudah dalam status aktif."
      });
    }

    await AturanAdatBali.update({
      status_aturan: "Aktif"
    }, { where: { id: aturan.id} });

    const aturanTeraktifkan = await AturanAdatBali.findByPk(aturan.id, {
      include: [{
        model: User,
        as: "pakar_aturan",
        attributes: ["id", "full_name", "email", "role"]
      }]
    });

    // Membuat slug url untuk navigasi notifikasi
    const tanggalBuat = aturanTeraktifkan.createdAt.toISOString().split('T')[0];
    const kategoriSlug = aturanTeraktifkan.kategori.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const encodedId = Buffer.from(String(aturanTeraktifkan.id)).toString('base64').replace(/=/g, '');
    const tautanSpesifik = `/aturan-adat-bali/detail/${kategoriSlug}-${tanggalBuat}-${encodedId}`;

    await kirimNotifikasiSistem(req, {
      judul: "Aturan Adat Bali Diaktifkan",
      deskripsi: `Aturan adat bali dengan nama ${aturan.nama_aturan} telah diaktifkan.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: tautanSpesifik,
      desa_adat_id: null,
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: aturanTeraktifkan.dibuat_oleh
    });

    return res.status(200).json({
      message: "Berhasil mengaktifkan aturan adat bali!",
      data: aturanTeraktifkan
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};

export const deleteAturanAdat = async (req, res) => {
  try {
    const aturan = await AturanAdatBali.findOne({
      where: { id: req.params.id }
    });

    if (!aturan) {
      return res.status(404).json({
        message: "Aturan adat bali tidak ditemukan."
      });
    }

    if (aturan.status_aturan === "Non-Aktif") {
      return res.status(400).json({
        message: "Aturan adat bali ini sudah dalam status non-aktif."
      });
    }

    await AturanAdatBali.update({
      status_aturan: "Non-Aktif"
    }, { where: { id: aturan.id} });

    // Membuat slug url untuk navigasi notifikasi
    const tanggalBuat = aturan.createdAt.toISOString().split('T')[0];
    const kategoriSlug = aturan.kategori.toLowerCase().replace(/[^a-z0-9]/g, '-');
    const encodedId = Buffer.from(String(aturan.id)).toString('base64').replace(/=/g, '');
    const tautanSpesifik = `/aturan-adat-bali/detail/${kategoriSlug}-${tanggalBuat}-${encodedId}`;

    await kirimNotifikasiSistem(req, {
      judul: "Aturan Adat Bali Dinonaktifkan",
      deskripsi: `Aturan adat bali dengan nama ${aturan.nama_aturan} telah dinonaktifkan.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: tautanSpesifik,
      desa_adat_id: null,
      sender_id: req.userId,
      kontak_pesan_id: null,
      user_id: aturan.dibuat_oleh
    });

    return res.status(200).json({
      message: "Berhasil menonaktifkan aturan adat bali!",
    });
  } catch (error) {
    return res.status(500).json({
      message: error.message
    });
  }
};