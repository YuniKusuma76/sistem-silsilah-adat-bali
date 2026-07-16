import { Op, where } from "sequelize";
import { customAlphabet } from "nanoid";
import db from "../config/db.config.js";
import {
  Perkawinan,
  KramaBali,
  DesaAdat,
  Keluarga,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  User
} from "../models/associations.js";
import { buatPerkawinanBali } from "../services/perkawinan.service.js";
import { integrasiPerkawinanLeluhur } from "../services/perkawinan-leluhur.service.js";
import { prosesPerceraianBali } from "../services/perceraian.service.js";
import { eksekusiVerifikasiPerkawinan } from "../services/verifikasi-perkawinan.service.js";
import { eksekusiVerifikasiPerceraian } from "../services/verifikasi-perceraian.service.js";
import { updateDataPerkawinan } from "../services/update-perkawinan.service.js";
import { verifikasiUpdateDataPerkawinan } from "../services/verifikasi-update-perkawinan.service.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

const VALID_STATUS_PERKAWINAN = [
  "Kawin", 
  "Cerai Hidup", 
  "Cerai Mati", 
  "Tidak Diketahui"
];

const VALID_JENIS_PERKAWINAN = [
  "Biasa", 
  "Nyentana", 
  "Pade Gelahang", 
  "Tidak Diketahui"
];

const VALID_PIHAK_MENINGGAL = [
  "Purusa", 
  "Predana", 
  "Suami", 
  "Istri"
];

const VALID_KETETAPAN_SILSILAH = [
  "Tetap", 
  "Kembali ke Asal", 
  "Tidak Ada"
];

const VALID_STATUS_VERIFIKASI = [
  "Draft",
  "Disetujui",
  "Ditolak"
];

const PERKAWINAN_INCLUDE = [
  {
    model: KramaBali,
    as: "suami",
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi"]
  },{
    model: KramaBali,
    as: "istri",
    attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi"]
  },{
    model: Keluarga,
    as: "keluarga_baru"
  }
];

// Helper: membuat nomor pendaftaran otomatis
const karakter = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const generateDigit = customAlphabet(karakter, 7);

const generateCodeUnique = async () => {
  const tahunSekarang = new Date().getFullYear();
  const finalDigitAcak = generateDigit();
  const kodeLengkap = `PWH/${tahunSekarang}/${finalDigitAcak}`;
  return kodeLengkap;
};

export const getAllPerkawinan = async (req, res) => {
  try {
    const { mode, krama_id } = req.query;
    
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    let whereCondition = {};
    let territorialCondition = [];
    let isVerificationMode = mode === "verification";

    const isEagerLoadingRequired = isVerificationMode || mode === "personal" || mode === "public";

    // ============================================================
    // LOGIKA FILTERING BERDASARKAN MODE 
    // ============================================================
    
    // Kondisi 1: Mengambil semua data orang lain yang telah disetujui
    if (mode === "public") {
      whereCondition.status_verifikasi = "Disetujui";
    }
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (mode === "personal") {
      whereCondition.user_id = currentUserId;
    }
    // Kondisi 3: Mengambil data dengan status draft
    else if (isVerificationMode) {
      if (userRole !== "Admin Desa" && userRole !== "Super Admin") {
        throw {
          status: 403,
          message: "Otoritas mengakses data ditolak!"
        };
      }
      if (krama_id) {
        whereCondition[Op.and] = [
          {
            [Op.or]: [
              { status_verifikasi: "Draft" },
              { status_verifikasi: "Disetujui" },
              { status_verifikasi: "Ditolak" }
            ]
          },
          {
            [Op.or]: [
              { suami_id: krama_id },
              { istri_id: krama_id }
            ]
          }
        ];
      } else {
        whereCondition[Op.or] = [
          { status_verifikasi: "Draft" },
          { status_verifikasi: "Disetujui", is_pending_update: true },
          { status_verifikasi: "Ditolak", is_pending_update: true }
        ];
      }
      // validasi spesifik hak akses admin desa
      if (userRole === "Admin Desa") {
        territorialCondition = [
          {
            [Op.and]: [
              { jenis_perkawinan: "Biasa" },
              { "$suami.desa_adat_id$": userDesaId }
            ]
          },{
            [Op.and]: [
              { jenis_perkawinan: "Nyentana" },
              { "$istri.desa_adat_id$": userDesaId }
            ]
          },{
            [Op.and]: [
              { jenis_perkawinan: "Pade Gelahang" },
              {
                [Op.or]: [
                  { "$suami.desa_adat_id$": userDesaId },
                  { "$istri.desa_adat_id$": userDesaId }
                ]
              }
            ]
          },{
            [Op.and]: [
              { "data_perubahan.UPDATE_PERKAWINAN.jenis_perkawinan": "Biasa" },
              { "$suami.desa_adat_id$": userDesaId }
            ]
          },
          {
            [Op.and]: [
              { "data_perubahan.UPDATE_PERKAWINAN.jenis_perkawinan": "Nyentana" },
              { "$istri.desa_adat_id$": userDesaId }
            ]
          },
          {
            [Op.and]: [
              { "data_perubahan.UPDATE_PERKAWINAN.jenis_perkawinan": "Pade Gelahang" },
              {
                [Op.or]: [
                  { "$suami.desa_adat_id$": userDesaId },
                  { "$istri.desa_adat_id$": userDesaId }
                ]
              }
            ]
          }
        ];
      }
    }

    const finalWhere = territorialCondition.length > 0
      ? { [Op.and]: [whereCondition, { [Op.or]: territorialCondition }] }
      : whereCondition;

    const PERKAWINAN_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "suami",
        required: isEagerLoadingRequired,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },
      {
        model: KramaBali,
        as: "istri",
        required: isEagerLoadingRequired,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id"]
      },
      {
        model: User,
        as: "pembuat_perkawinan",
        attributes: ["id", "full_name", "email", "role"]
      }
    ];

    const perkawinanRaw = await Perkawinan.findAll({
      where: finalWhere,
      include: PERKAWINAN_INCLUDE_KHUSUS,
      order: [["id", "DESC"]]
    });

    // Mapping Data Keluarga Aktif
    const kepalaKeluargaIds = [];

    perkawinanRaw.forEach((item) => {
      const draftKey = "UPDATE_PERKAWINAN";
      const jenisKawinEfektif = item.data_perubahan?.[draftKey]?.jenis_perkawinan || item.jenis_perkawinan;

      if (jenisKawinEfektif === "Pade Gelahang") {
        if (item.suami_id) kepalaKeluargaIds.push(item.suami_id);
        if (item.istri_id) kepalaKeluargaIds.push(item.istri_id);
      } else {
        const purusaId = jenisKawinEfektif === "Nyentana" ? item.istri_id : item.suami_id;
        if (purusaId) kepalaKeluargaIds.push(purusaId);
      }
    });

    let mapKeluargaAktif = new Map();
    
    if (kepalaKeluargaIds.length > 0) {
      const keluargaTerbaca = await Keluarga.findAll({
        where: {
          kepala_keluarga_id: { 
            [Op.in]: [...new Set(kepalaKeluargaIds)] 
          }, 
          status_keluarga: "Aktif"
        }
      });

      keluargaTerbaca.forEach(k => {
        mapKeluargaAktif.set(k.kepala_keluarga_id, k);
      });
    }

    const perkawinanList = perkawinanRaw.map((instance) => {
      const data = instance.toJSON();
      const isOwner = data.user_id === currentUserId;
      const isAdmin = userRole === "Admin Desa" || userRole === "Super Admin";

      if (!isOwner && !isAdmin) {
        delete data.data_perubahan;
        delete data.status_sebelum_draft;
      }

      const draftKey = "UPDATE_PERKAWINAN";
      const jenisKawinEfektif = data.data_perubahan?.[draftKey]?.jenis_perkawinan || data.jenis_perkawinan;

      if (jenisKawinEfektif === "Pade Gelahang") {
        data.keluarga_suami = mapKeluargaAktif.get(data.suami_id) || null;
        data.keluarga_istri = mapKeluargaAktif.get(data.istri_id) || null;
      } else {
        const purusaId = jenisKawinEfektif === "Nyentana" ? data.istri_id : data.suami_id;
        data.keluarga_baru = mapKeluargaAktif.get(purusaId) || null;
      }

      return data;
    });

    return res.status(200).json({
      message: "Berhasil mengambil data perkawinan!",
      count: perkawinanList.length,
      data: perkawinanList
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat mengambil data perkawinan."
    });
  }
};

export const getPerkawinanById = async (req, res) => {
  try {
    const { id } = req.params;

    const PERKAWINAN_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "suami",
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id", "user_id"]
      },
      {
        model: KramaBali,
        as: "istri",
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "status_verifikasi", "desa_adat_id", "user_id"]
      },
      {
        model: User,
        as: "pembuat_perkawinan",
        attributes: ["id", "full_name", "email", "role"]
      }
    ];

    const dataKawin = await Perkawinan.findByPk(id, {
      include: PERKAWINAN_INCLUDE_KHUSUS
    });

    if (!dataKawin) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    const data = dataKawin.get({ clone: true });

    // Validasi Otoritas Hak Akses Data
    const isDraft = data.status_verifikasi === "Draft" || data.status_verifikasi === "Ditolak";
    const isPending = data.is_pending_update === true;

    if (isDraft || isPending) {
      const isOwner = data.user_id === req.userId || data.suami?.user_id === req.userId || data.istri?.user_id === req.userId;
      const isSuperAdmin = req.role === "Super Admin";
      const isAdminDesaLokal = req.role === "Admin Desa" && (data.suami?.desa_adat_id === req.desaAdatId || data.istri?.desa_adat_id === req.desaAdatId);

      if (!isOwner && !isAdminDesaLokal && !isSuperAdmin) {
        throw {
          status: 403,
          message: "Otoritas mengakses data ditolak!"
        };
      }
    }

    // Mapping Keluarga Aktif
    if (data.status_verifikasi === "Disetujui") {
      // KONDISI 1: Skenario perkawinan pade gelahang
      if (data.jenis_perkawinan === "Pade Gelahang") {
        const [keluargaSuami, keluargaIstri] = await Promise.all([
          Keluarga.findOne({ 
            where: { 
              kepala_keluarga_id: data.suami_id, 
              status_keluarga: "Aktif" 
            } 
          }),
          Keluarga.findOne({ 
            where: { 
              kepala_keluarga_id: data.istri_id, 
              status_keluarga: "Aktif" 
            } 
          })
        ]);
        data.keluarga_suami = keluargaSuami;
        data.keluarga_istri = keluargaIstri;
      }
      // KONDISI 2: Skenario perkawinan nyentana/biasa
      else {
        const purusaId = data.jenis_perkawinan === "Nyentana" ? data.istri_id : data.suami_id;
        data.keluarga_baru = purusaId ? await Keluarga.findOne({ 
          where: { 
            kepala_keluarga_id: purusaId, 
            status_keluarga: "Aktif" 
          } 
        }): null;
      }
    } else {
      if (data.jenis_perkawinan === "Pade Gelahang") {
        data.keluarga_suami = null;
        data.keluarga_istri = null;
      } else {
        data.keluarga_baru = null;
      }
    }

    return res.status(200).json({
      message: "Berhasil mengambil data detail perkawinan!",
      data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat mengambil detail data perkawinan."
    });
  }
};

export const createPerkawinan = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;
  
  try {
    const {
      suami_id,
      istri_id,
      status_perkawinan,
      jenis_perkawinan,
      tanggal_perkawinan
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(suami_id),
      KramaBali.findByPk(istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data suami atau istri tidak ditemukan." 
      };
    }

    const isLeluhurPath = suami.tipe_data === "Leluhur" || istri.tipe_data === "Leluhur";

    // VALIDASI KEDAULATAN DESA ADAT UNTUK INPUT DATA
    if (!isLeluhurPath && (user_role === "Krama" || user_role === "Admin Desa")) {
      if (jenis_perkawinan === "Biasa") {
        if (suami.desa_adat_id !== user_desa_id) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang boleh mendaftarkan perkawinan ini." 
          };
        }
      }
      if (jenis_perkawinan === "Nyentana") {
        if (istri.desa_adat_id !== user_desa_id) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang boleh mendaftarkan perkawinan ini." 
          };
        }
      }
      if (jenis_perkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id !== user_desa_id && istri.desa_adat_id !== user_desa_id) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya salah satu desa adat pasangan yang boleh mendaftarkan perkawinan ini." 
          };
        }
      }
    }

    let finalData;
    const nomorPendaftaran = await generateCodeUnique();

    // Mulai transaksi database
    t = await db.transaction();

    // ============================================================
    // CASE 1: JALUR INTEGRASI PERKAWINAN LELUHUR
    // ============================================================
    if (isLeluhurPath) {
      let namaDesaAdat = null;

      if (user_role === "Admin Desa" && user_desa_id) {
        const desaAdat = await DesaAdat.findByPk(user_desa_id, { 
          transaction: t 
        });

        if (desaAdat) {
          namaDesaAdat = desaAdat.nama_desa_adat;
        }
      }

      finalData = await integrasiPerkawinanLeluhur({
        nomor_pendaftaran: nomorPendaftaran,
        suami_id,
        istri_id,
        status_perkawinan: status_perkawinan || "Kawin",
        jenis_perkawinan: jenis_perkawinan || "Biasa",
        tanggal_perkawinan,
        user_id,
        user_role,
        user_desa_id,
        nama_desa_operator: namaDesaAdat
      }, t);
    }

    // ============================================================
    // CASE 2: JALUR INTEGRASI PERKAWINAN KETURUNAN
    // ============================================================
    else {
      if (!VALID_JENIS_PERKAWINAN.includes(jenis_perkawinan)) {
        throw { 
          status: 400, 
          message: "Jenis perkawinan tidak valid!" 
        };
      }

      finalData = await buatPerkawinanBali({
        nomor_pendaftaran: nomorPendaftaran,
        suami_id, 
        istri_id, 
        status_perkawinan: status_perkawinan || "Kawin", 
        jenis_perkawinan, 
        tanggal_perkawinan,
        user_id,
        user_role,
        user_desa_id
      }, t);
    }

    const isDraft = finalData?.perkawinan?.status_verifikasi === "Draft";

    try {
      const notifikasiPromises = [];

      if (!isDraft) {
        const deskripsiOtomatis = `Perkawinan baru antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah diverifikasi dan disetujui otomatis oleh sistem (Input by ${user_role}).`;

        if (suami.desa_adat_id) {
          notifikasiPromises.push(
            kirimNotifikasiSistem(req, {
              judul: "Pendaftaran Perkawinan Adat Baru",
              deskripsi: deskripsiOtomatis,
              kategori: "LOG_SISTEM",
              tautan_fitur: "/krama-bali",
              desa_adat_id: suami.desa_adat_id,
              sender_id: user_id,
              kontak_pesan_id: null,
              user_id: null
            }, null)
          );
        }
        if (istri.desa_adat_id && String(suami.desa_adat_id) !== String(istri.desa_adat_id)) {
          notifikasiPromises.push(
            kirimNotifikasiSistem(req, {
              judul: "Pendaftaran Perkawinan Adat Baru",
              deskripsi: deskripsiOtomatis,
              kategori: "LOG_SISTEM",
              tautan_fitur: "/krama-bali",
              desa_adat_id: istri.desa_adat_id,
              sender_id: user_id,
              kontak_pesan_id: null,
              user_id: null
            }, null)
          );
        }
      } else {
        const deskripsiDraft = `Adanya pendaftaran perkawinan baru antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} oleh ${user_role}. Menunggu verifikasi dari Admin Desa bersangkutan.`;

        if (jenis_perkawinan === "Pade Gelahang") {
          if (suami.desa_adat_id) {
            notifikasiPromises.push(
              kirimNotifikasiSistem(req, {
                judul: "Antrean Perkawinan Adat Baru",
                deskripsi: deskripsiDraft,
                kategori: "VERIFIKASI",
                tautan_fitur: "/verifikasi-data/perkawinan",
                desa_adat_id: suami.desa_adat_id,
                sender_id: user_id,
                kontak_pesan_id: null,
                user_id: null
              }, null)
            );
          }
          if (istri.desa_adat_id && String(suami.desa_adat_id) !== String(istri.desa_adat_id)) {
            notifikasiPromises.push(
              kirimNotifikasiSistem(req, {
                judul: "Antrean Perkawinan Adat Baru",
                deskripsi: deskripsiDraft,
                kategori: "VERIFIKASI",
                tautan_fitur: "/verifikasi-data/perkawinan",
                desa_adat_id: istri.desa_adat_id,
                sender_id: user_id,
                kontak_pesan_id: null,
                user_id: null
              }, null)
            );
          }
        } else {
          let targetDesaNotif = user_desa_id || (jenis_perkawinan === "Nyentana" ? istri.desa_adat_id : suami.desa_adat_id);

          notifikasiPromises.push(
            kirimNotifikasiSistem(req, {
              judul: "Antrean Perkawinan Adat Baru",
              deskripsi: deskripsiDraft,
              kategori: "VERIFIKASI",
              tautan_fitur: "/verifikasi-data/perkawinan",
              desa_adat_id: targetDesaNotif,
              sender_id: user_id,
              kontak_pesan_id: null,
              user_id: null
            }, null)
          );
        }
      }

      if (notifikasiPromises.length > 0) {
        await Promise.all(notifikasiPromises);
      }
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas:", error.message);
    }

    await t.commit();

    return res.status(201).json({
      message: isDraft
        ? "Data perkawinan berhasil diajukan! Menunggu verifikasi dari Admin Desa."
        : "Data perkawinan berhasil disimpan dan disetujui oleh sistem!",
      data: finalData
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membuat data perkawinan."
    });
  }
};

export const verifikasiPerkawinan = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;

  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const { status_verifikasi, catatan_admin } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      throw { 
        status: 400, 
        message: "Status verifikasi tidak valid!" 
      };
    }

    if (status_verifikasi === "Ditolak" && (!catatan_admin || catatan_admin.trim() === "")) {
      throw { 
        status: 400, 
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!" 
      };
    }

    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan || perkawinan.status_verifikasi !== "Draft") {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ini tidak berada dalam antrean pengajuan data." 
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data krama suami atau istri tidak ditemukan." 
      };
    }

    if (suami.status_verifikasi === "Draft" || istri.status_verifikasi === "Draft") {
      throw {
        status: 400,
        message: "Proses verifikasi dihentikan! Data suami atau istri masih berstatus Draft dan belum disahkan."
      };
    }

    let targetSisi = null;

    // VALIDASI HAK AKSES RUANG LINGKUP DATA
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak suami yang dapat mendaftarkan/mengelola data verifikasi ini." 
          };
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Hanya desa adat pihak istri yang dapat mendaftarkan/mengelola data verifikasi ini." 
          };
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat Anda tidak terikat dengan kedua mempelai." 
          };
        }
        targetSisi = isDesaSuami ? "suami" : "istri";
      }
    } else if (user_role === "Super Admin") {
      targetSisi = "super_admin";
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    // Mulai transaksi database
    t = await db.transaction();

    const hasilVerifikasi = await eksekusiVerifikasiPerkawinan({
      perkawinan_id,
      status_verifikasi,
      catatan_admin,
      user_role,
      user_desa_id,
      target_sisi: targetSisi,
      nama_desa_operator: namaOperator
    }, t);

    const responseMessages = {
      PENOLAKAN: "Pengajuan data perkawinan telah diverifikasi dengan status: Ditolak.",
      PADE_GELAHANG_PARSIAL: `Data perkawinan Pade Gelahang berhasil diverifikasi oleh ${namaOperator}. Menunggu verifikasi persetujuan dari pihak desa pasangan.`,
      PERKAWINAN_LELUHUR: "Data perkawinan leluhur telah diverifikasi penuh dan berhasil dicatat dalam Trah Bali.",
      PERKAWINAN_AKTIF: "Data perkawinan berhasil diverifikasi dengan status: Disetujui (Aktif).",
      PERKAWINAN_PADE_GELAHANG: "Data perkawinan Pade Gelahang telah diverifikasi secara penuh oleh kedua belah pihak desa! Entitas keluarga mandiri resmi diaktifkan.",
      default: "Data perkawinan berhasil diverifikasi dan dicatat!"
    };

    try {
      let deskripsiNotif = "";

      if (status_verifikasi === "Ditolak") {
        deskripsiNotif = `Pengajuan pendaftaran perkawinan adat antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah ditolak oleh ${user_role}.`;
      } else if (hasilVerifikasi.type === "PADE_GELAHANG_PARSIAL") {
        deskripsiNotif = `Pendaftaran perkawinan Pade Gelahang antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah disetujui oleh ${namaOperator}. Menunggu verifikasi dari Admin Desa Pasangan.`;
      } else {
        deskripsiNotif = `Pengajuan pendaftaran perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah disetujui dan disahkan ke dalam silsilah oleh ${user_role}.`;
      }

      let kategoriNotif = "LOG_SISTEM";

      if (status_verifikasi === "Ditolak") {
        kategoriNotif = "PERINGATAN";
      } else if (hasilVerifikasi.type === "PADE_GELAHANG_PARSIAL") {
        kategoriNotif = "VERIFIKASI"; 
      }

      const notifikasiPromises = [];

      notifikasiPromises.push(
        kirimNotifikasiSistem(req, {
          judul: "Peninjauan Data Perkawinan Adat",
          deskripsi: deskripsiNotif,
          kategori: kategoriNotif,
          tautan_fitur: "/krama-bali/my-data",
          desa_adat_id: user_desa_id || suami.desa_adat_id,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: perkawinan.user_id 
        }, null)
      );

      if (suami.desa_adat_id) {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: "Pencatatan Perkawinan Adat Krama",
            deskripsi: deskripsiNotif,
            kategori: kategoriNotif,
            tautan_fitur: hasilVerifikasi.type === "PADE_GELAHANG_PARSIAL" ? "/verifikasi-data/perkawinan" : "/krama-bali",
            desa_adat_id: suami.desa_adat_id,
            sender_id: user_id,
            kontak_pesan_id: null,
            user_id: null
          }, null)
        );
      }

      if (istri.desa_adat_id && String(suami.desa_adat_id) !== String(istri.desa_adat_id)) {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: "Pencatatan Perkawinan Adat Krama",
            deskripsi: deskripsiNotif,
            kategori: kategoriNotif,
            tautan_fitur: hasilVerifikasi.type === "PADE_GELAHANG_PARSIAL" ? "/verifikasi-data/perkawinan" : "/krama-bali",
            desa_adat_id: istri.desa_adat_id,
            sender_id: user_id,
            kontak_pesan_id: null,
            user_id: null
          }, null)
        );
      }

      await Promise.all(notifikasiPromises);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas verifikasi:", error.message);
    }

    await t.commit();

    return res.status(200).json({
      message: responseMessages[hasilVerifikasi.type] || responseMessages.default,
      data: hasilVerifikasi.data
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kesalahan pada server saat memverifikasi data perkawinan."
    });
  }
};

export const createPerceraian = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;

  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const {
      status_perkawinan,
      tanggal_cerai,
      pihak_meninggal,
      pilihan_predana
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    if (!status_perkawinan) {
      throw { 
        status: 400, 
        message: "Status perkawinan wajib diisi!" 
      };
    }

    if (!VALID_STATUS_PERKAWINAN.includes(status_perkawinan)) {
      throw { 
        status: 400, 
        message: "Status perkawinan tidak valid!" 
      };
    }

    // Validasi kondisional untuk skenario cerai mati
    if (status_perkawinan === "Cerai Mati") {
      if (!pihak_meninggal) {
        throw { 
          status: 400, 
          message: "Pihak yang meninggal wajib ditentukan untuk status cerai mati!" 
        };
      }
      if (!VALID_PIHAK_MENINGGAL.includes(pihak_meninggal)) {
        throw { 
          status: 400, 
          message: "Pilihan pihak meninggal tidak valid!" 
        };
      }
    }

    const perkawinanAsal = await Perkawinan.findByPk(perkawinan_id);

    if (!perkawinanAsal) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    if (perkawinanAsal.status_perkawinan !== "Kawin") {
      throw {
        status: 400,
        message: "Proses perceraian ditolak! Perkawinan ini sudah berada dalam status cerai."
      };
    }

    // Validasi urutan linimasa untuk tanggal kawin dan tanggal cerai
    const tanggalCeraiMurni = (tanggal_cerai || new Date().toISOString()).split('T')[0].split(' ')[0];
    const tanggalKawinMurni = perkawinanAsal.tanggal_perkawinan;

    if (tanggalCeraiMurni < tanggalKawinMurni) {
      throw { 
        status: 400, 
        message: "Tanggal perceraian tidak boleh lebih lampau dari tanggal perkawinan!" 
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinanAsal.suami_id),
      KramaBali.findByPk(perkawinanAsal.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data suami atau istri dari perkawinan ini tidak ditemukan." 
      };
    }

    // VALIDASI KEDAULATAN DESA ADAT UNTUK INPUT DATA
    if (user_role === "Krama" || user_role === "Admin Desa") {
      const jenisKawin = perkawinanAsal.jenis_perkawinan;
      let authorized = false;

      if (jenisKawin === "Biasa" || !jenisKawin || jenisKawin === "Tidak Diketahui") {
        authorized = suami.desa_adat_id === user_desa_id;
      }
      else if (jenisKawin === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      }
      else if (jenisKawin === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }

      if (!authorized) {
        throw { 
          status: 403, 
          message: "Otoritas untuk mengelola data perceraian perkawinan ini ditolak!" 
        };
      }
    }

    // Mulai transaksi database
    t = await db.transaction();

    const hasilCerai = await prosesPerceraianBali({
      perkawinan_id, 
      status_perkawinan, 
      tanggal_cerai: tanggalCeraiMurni, 
      pihak_meninggal, 
      pilihan_predana,
      user_id,
      user_role,
      user_desa_id
    }, t);

    const isDraftCerai = hasilCerai.is_pending_update;

    try {
      const jenisMutasiText = status_perkawinan === "Cerai Mati" ? "Perceraian (Cerai Mati)" : "Perceraian (Cerai Hidup)";
      const notifikasiPromises = [];

      if (!isDraftCerai) {
        const deskripsiSukses = `Perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah diverifikasi dan disetujui otomatis oleh sistem (Input by ${user_role}).`;
        
        if (suami.desa_adat_id) {
          notifikasiPromises.push(
            kirimNotifikasiSistem(req, {
              judul: "Pendaftaran Perceraian Adat", 
              deskripsi: deskripsiSukses, 
              kategori: "LOG_SISTEM", 
              tautan_fitur: "/krama-bali",
              desa_adat_id: suami.desa_adat_id, 
              sender_id: user_id, 
              kontak_pesan_id: null, 
              user_id: null
            }, null)
          );
        }
        if (istri.desa_adat_id && String(suami.desa_adat_id) !== String(istri.desa_adat_id)) {
          notifikasiPromises.push(
            kirimNotifikasiSistem(req, {
              judul: "Pendaftaran Perceraian Adat", 
              deskripsi: deskripsiSukses, 
              kategori: "LOG_SISTEM", 
              tautan_fitur: "/krama-bali",
              desa_adat_id: istri.desa_adat_id, 
              sender_id: user_id, 
              kontak_pesan_id: null, 
              user_id: null
            }, null)
          );
        }
      } else {
        const deskripsiDraft = `Adanya draft usulan ${status_perkawinan.toLowerCase()} antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} oleh ${user_role}. Menunggu verifikasi dari Admin Desa Bersangkutan.`;
        
        if (perkawinanAsal.jenis_perkawinan === "Pade Gelahang") {
          if (suami.desa_adat_id) {
            notifikasiPromises.push(
              kirimNotifikasiSistem(req, {
                judul: `Antrean Usulan ${jenisMutasiText}`, 
                deskripsi: deskripsiDraft, 
                kategori: "VERIFIKASI", 
                tautan_fitur: "/verifikasi-data/perkawinan",
                desa_adat_id: suami.desa_adat_id, 
                sender_id: user_id, 
                kontak_pesan_id: null, 
                user_id: null
              }, null)
            );
          }
          if (istri.desa_adat_id && String(suami.desa_adat_id) !== String(istri.desa_adat_id)) {
            notifikasiPromises.push(
              kirimNotifikasiSistem(req, {
                judul: `Antrean Usulan ${jenisMutasiText}`, 
                deskripsi: deskripsiDraft, 
                kategori: "VERIFIKASI", 
                tautan_fitur: "/verifikasi-data/perkawinan",
                desa_adat_id: istri.desa_adat_id, 
                sender_id: user_id, 
                kontak_pesan_id: null, 
                user_id: null
              }, null)
            );
          }
        } else {
          let targetDesaNotif = perkawinanAsal.jenis_perkawinan === "Nyentana" ? istri.desa_adat_id : suami.desa_adat_id;
          notifikasiPromises.push(
            kirimNotifikasiSistem(req, {
              judul: `Antrean Usulan ${jenisMutasiText}`, 
              deskripsi: deskripsiDraft, 
              kategori: "VERIFIKASI", 
              tautan_fitur: "/verifikasi-data/perkawinan",
              desa_adat_id: targetDesaNotif, 
              sender_id: user_id, 
              kontak_pesan_id: null, 
              user_id: null
            }, null)
          );
        }
      }

      if (notifikasiPromises.length > 0) {
        await Promise.all(notifikasiPromises);
      }
    } catch (notifError) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas perceraian:", notifError.message);
    }

    await t.commit();

    return res.status(200).json({
      message: isDraftCerai
        ? "Usulan perceraian berhasil diajukan! Menunggu verifikasi dari Admin Desa." 
        : "Data perceraian berhasil diproses dan struktur silsilah keluarga telah diperbarui secara langsung!",
      data: hasilCerai.data_perkawinan || hasilCerai
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membuat data perceraian."
    });
  }
};

export const verifikasiPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const { status_verifikasi, catatan_admin } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      throw {
        status: 400,
        message: "Status verifikasi tidak valid!"
      };
    }

    if (status_verifikasi === "Ditolak" && (!catatan_admin || catatan_admin.trim() === "")) {
      throw {
        status: 400,
        message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
      };
    }

    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    if (perkawinan.status_verifikasi !== "Disetujui") {
      throw {
        status: 400,
        message: "Proses verifikasi dihentikan! Data perkawinan belum diverifikasi dan disahkan oleh Admin Desa."
      };
    }

    if (perkawinan.status_perkawinan === "Cerai" || perkawinan.status_perkawinan === "Cerai Mati") {
      throw {
        status: 400,
        message: "Proses verifikasi ditolak! Perceraian untuk perkawinan ini sudah disetujui sebelumnya dan sudah sah."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.PERCERAIAN) {
      throw {
        status: 400,
        message: "Proses verifikasi dihentikan! Data perkawinan ini tidak memiliki usulan draf perceraian yang aktif dalam antrean."
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data suami atau istri tidak ditemukan." 
      };
    }

    let targetSisi = null;

    // VALIDASI HAK AKSES RUANG LINGKUP DATA & PENENTUAN TARGET SISI
    if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      const isDesaSuami = suami.desa_adat_id === user_desa_id;
      const isDesaIstri = istri.desa_adat_id === user_desa_id;

      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        if (!isDesaSuami) {
          throw { status: 403, message: "Otoritas ditolak! Hanya desa pihak suami yang dapat memverifikasi." };
        }
        targetSisi = "suami";
      } else if (jenisPerkawinan === "Nyentana") {
        if (!isDesaIstri) {
          throw { status: 403, message: "Otoritas ditolak! Hanya desa pihak istri yang dapat memverifikasi." };
        }
        targetSisi = "istri";
      } else if (jenisPerkawinan === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          throw { status: 403, message: "Otoritas ditolak! Wilayah desa adat Anda tidak terikat dengan krama." };
        }
        
        if (suami.desa_adat_id === istri.desa_adat_id) {
          targetSisi = "super_admin";
        } else {
          const { target_sisi: targetSisiInput } = req.body;
          if (!targetSisiInput || !["suami", "istri"].includes(targetSisiInput)) {
            targetSisi = isDesaSuami ? "suami" : "istri";
          } else {
            targetSisi = targetSisiInput;
          }
        }
      }
    } else if (user_role === "Super Admin") {
      targetSisi = "super_admin";
    }

    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    const hasilVerifikasi = await eksekusiVerifikasiPerceraian({
      perkawinan_id,
      status_verifikasi,
      catatan_admin,
      user_id,
      user_role,
      user_desa_id,
      target_sisi: targetSisi,
      nama_desa_operator: namaOperator
    });

    const responseMessages = {
      PENOLAKAN_CERAI: "Pengajuan usulan draf perceraian telah diverifikasi dengan status: Ditolak",
      PERSETUJUAN_CERAI_PARSIAL: `Usulan perceraian Pade Gelahang berhasil disetujui oleh ${namaOperator}. Menunggu verifikasi persetujuan dari pihak desa pasangan agar mutasi silsilah dapat dieksekusi.`,
      PERSETUJUAN_CERAI_PENUH: "Data perceraian krama telah disetujui secara penuh! Struktur silsilah keluarga dan penyesuaian peran adat krama resmi diperbarui.",
      default: "Data perceraian berhasil diverifikasi dan dicatat!"
    };

    try {
      let deskripsiNotif = "";

      if (status_verifikasi === "Ditolak") {
        deskripsiNotif = `Pengajuan draft perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah ditolak oleh ${user_role}.`;
      } else if (hasilVerifikasi.type === "PERSETUJUAN_CERAI_PARSIAL") {
        deskripsiNotif = `Usulan perceraian Pade Gelahang antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} disetujui oleh ${namaOperator}. Menunggu verifikasi dari Admin Desa Pasangan.`;
      } else {
        deskripsiNotif = `Pengajuan usulan perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah disetujui resmi dan disahkan oleh ${user_role}.`;
      }

      const notifikasiPromises = [];

      notifikasiPromises.push(
        kirimNotifikasiSistem(req, {
          judul: "Hasil Verifikasi Perceraian",
          deskripsi: deskripsiNotif,
          kategori: status_verifikasi === "Ditolak" ? "PERINGATAN" : "INFORMASI",
          tautan_fitur: "/krama-bali/my-data",
          desa_adat_id: null,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: perkawinan.user_id 
        }, null)
      );

      if (suami.desa_adat_id) {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: "Pencatatan Perkawinan Cerai",
            deskripsi: `${deskripsiNotif} (Sisi Wilayah Adat Suami)`,
            kategori: "LOG_SISTEM",
            tautan_fitur: "/krama-bali",
            desa_adat_id: suami.desa_adat_id,
            sender_id: user_id,
            kontak_pesan_id: null,
            user_id: null
          }, null)
        );
      }

      if (istri.desa_adat_id && String(suami.desa_adat_id) !== String(istri.desa_adat_id)) {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: "Pencatatan Perkawinan Cerai",
            deskripsi: `${deskripsiNotif} (Sisi Wilayah Adat Istri)`,
            kategori: "LOG_SISTEM",
            tautan_fitur: "/krama-bali",
            desa_adat_id: istri.desa_adat_id,
            sender_id: user_id,
            kontak_pesan_id: null,
            user_id: null
          }, null)
        );
      }

      await Promise.all(notifikasiPromises);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas verifikasi perceraian:", error.message);
    }

    return res.status(200).json({
      message: responseMessages[hasilVerifikasi.type] || responseMessages.default,
      data: hasilVerifikasi.data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kesalahan pada server saat memverifikasi data perceraian."
    });
  }
};

export const cancelPerceraian = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Mengambil data perkawinan dan krama untuk validasi otoritas wilayah
    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.PERCERAIAN) {
      throw {
        status: 400,
        message: "Proses pembatalan dihentikan! Data perkawinan ini tidak memiliki usulan draf perceraian aktif yang bisa dibatalkan."
      };
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw {
        status: 404,
        message: "Data krama suami atau istri tidak ditemukan."
      };
    }

    // Validasi Kedaulatan Wilayah Desa Adat
    let authorized = false;

    if (user_role === "Super Admin") {
      authorized = true;
    } else if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      // Skenario 1: Perkawinan Biasa (Purusa = Suami)
      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        authorized = suami.desa_adat_id === user_desa_id;
      } 
      // Skenario 2: Perkawinan Nyentana (Purusa = Istri)
      else if (jenisPerkawinan === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      } 
      // Skenario 3: Perkawinan Pade Gelahang (Kedua desa berwenang)
      else if (jenisPerkawinan === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }
    } else {
      if (perkawinan.user_id === user_id || suami.user_id === user_id || istri.user_id) {
        authorized = true;
      }
    }

    if (!authorized) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak untuk membatalkan pengajuan ini."
      };
    }
    
    let namaOperator = "Krama Pemilik Data";

    if (user_role === "Super Admin") {
      namaOperator = "Super Admin";
    } else if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id);
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    // Membersihkan draft perubahan data
    const existingChanges = perkawinan.data_perubahan || {};
    const { PERCERAIAN, ...restChanges } = existingChanges;

    const isOtherDraftActive = Object.keys(restChanges).length > 0;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    const labelPelaku = user_role === "Krama" ? "Krama Pengaju Perceraian" : user_role;
    newCatatanAdmin.status_verifikasi_perceraian = `Usulan draft perceraian telah dibatalkan dan ditarik dari antrean oleh ${labelPelaku}.`;
    newCatatanAdmin.tanggal_pembatalan_perceraian = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = namaOperator;

    const perkawinanPulih = await perkawinan.update({
      is_pending_update: isOtherDraftActive, 
      status_sebelum_draft: isOtherDraftActive ? perkawinan.status_sebelum_draft : null,
      data_perubahan: isOtherDraftActive ? restChanges : null,
      catatan_admin_desa: newCatatanAdmin
    });

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Pembatalan Draft Perceraian",
        deskripsi: `Draft usulan perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah dibatalkan dan ditarik dari antrean oleh ${labelPelaku}.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: perkawinan.user_id 
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas pembatalan cerai:", error.message);
    }

    return res.status(200).json({
      message: "Proses pembatalan sukses! Draft usulan perceraian berhasil dibersihkan dari antrean.",
      data: perkawinanPulih
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draf perceraian."
    });
  }
};

export const deletePerkawinan = async (req, res) => {
  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_role = req.role;
    const user_id = req.userId;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id);
    if (!perkawinan) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    // Validasi status verifikasi
    const statusTerakhir = perkawinan.status_verifikasi;
    if (statusTerakhir !== "Draft" && statusTerakhir !== "Ditolak") {
      throw {
        status: 400,
        message: `Proses menghapus data ditolak! Data perkawinan ini sudah berstatus '${statusTerakhir}' dan telah terikat dalam silsilah aktif.`
      };
    }

    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suami || !istri) {
      throw { 
        status: 404, 
        message: "Data krama suami atau istri tidak ditemukan." 
      };
    }

    // Validasi Otoritas Hak Menghapus Data
    const targetUserIdPengaju = perkawinan.user_id;
    let authorized = false;

    if (user_role === "Super Admin") {
      authorized = true;
    } else if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      // Skenario 1: Perkawinan Biasa (Purusa = Pihak Suami)
      if (jenisPerkawinan === "Biasa" || jenisPerkawinan === "Tidak Diketahui" || !jenisPerkawinan) {
        authorized = suami.desa_adat_id === user_desa_id;
      } 
      // Skenario 2: Perkawinan Nyentana (Purusa = Pihak Istri)
      else if (jenisPerkawinan === "Nyentana") {
        authorized = istri.desa_adat_id === user_desa_id;
      } 
      // Skenario 3: Perkawinan Pade Gelahang (Kedua desa memiliki wewenang)
      else if (jenisPerkawinan === "Pade Gelahang") {
        authorized = suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id;
      }
    } else {
      if (perkawinan.user_id === user_id || suami.user_id === user_id || istri.user_id) {
        authorized = true;
      }
    }

    if (!authorized) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak untuk menghapus data pengajuan perkawinan ini."
      };
    }

    await perkawinan.destroy();

    try {
      const labelPelaku = user_role === "Krama" ? "Krama Pemilik Data" : user_role;
      await kirimNotifikasiSistem(req, {
        judul: "Penghapusan Data Perkawinan",
        deskripsi: `Data draft pendaftaran perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} yang berstatus [${statusTerakhir}] resmi dihapus permanen oleh ${labelPelaku}.`,
        kategori: "PERINGATAN",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: targetUserIdPengaju
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas hapus draft:", error.message);
    }

    return res.status(200).json({
      message: `Data pendaftaran perkawinan yang berstatus '${statusTerakhir}' berhasil dihapus secara permanen dari sistem.`
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat menghapus draft perkawinan."
    });
  }
};

export const updatePerkawinanById = async (req, res) => {
  try {
    const { id } = req.params;

    const {
      tipe_update,
      suami_id,
      istri_id,
      jenis_perkawinan,
      tanggal_event,
      status_perkawinan,
      pihak_meninggal,
      pilihan_predana,
      catatan_update
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    if (!tipe_update) {
      throw { 
        status: 400, 
        message: "Tipe update wajib ditentukan!" 
      };
    }

    // Validasi ketersediaan data perkawinan
    const perkawinanLama = await Perkawinan.findByPk(id);
    if (!perkawinanLama) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    if (tipe_update === "PERKAWINAN" && status_perkawinan && status_perkawinan !== perkawinanLama.status_perkawinan) {
      if (perkawinanLama.status_perkawinan === "Kawin" && status_perkawinan !== "Kawin") {
        throw {
          status: 400,
          message: "Proses memperbarui data ditolak! Untuk perceraian perkawinan aktif, gunakan modul 'Ajukan Perceraian'."
        };
      }
    }

    const targetUserIdPengaju = perkawinanLama.user_id;
    const targetSuamiId = suami_id || perkawinanLama.suami_id;
    const targetIstriId = istri_id || perkawinanLama.istri_id;

    if (targetSuamiId === targetIstriId) {
      throw {
        status: 400,
        message: "Proses memperbarui data dihentikan! Identitas suami dan istri tidak boleh krama yang sama."
      };
    }

    const resultUpdate = await updateDataPerkawinan({
      perkawinan_id: id,
      tipe_update,
      suami_id,
      istri_id,
      jenis_perkawinan,
      tanggal_event,
      status_perkawinan,
      pihak_meninggal,
      pilihan_predana,
      catatan_update,
      user_id,
      user_role,
      user_desa_id
    });

    const isAutoApproved = resultUpdate.type === "AUTO_APPROVED_SUKSES";
    const labelTipe = tipe_update.toLowerCase();

    try {
      if (isAutoApproved) {
        const rawData = resultUpdate.data;
        const dataPerkawinanTerbaru = rawData?.perkawinan || rawData;

        const finalSuamiId = dataPerkawinanTerbaru?.suami_id || targetSuamiId;
        const finalIstriId = dataPerkawinanTerbaru?.istri_id || targetIstriId;

        const [suamiBaru, istriBaru] = await Promise.all([
          KramaBali.findByPk(finalSuamiId),
          KramaBali.findByPk(finalIstriId)
        ]);

        await kirimNotifikasiSistem(req, {
          judul: `Update Data ${tipe_update}`,
          deskripsi: `Data ${labelTipe} antara ${suamiBaru?.nama_lengkap || 'Krama'} dan ${istriBaru?.nama_lengkap || 'Krama'} telah berhasil diperbarui langsung oleh ${user_role}.`,
          kategori: "LOG_SISTEM",
          tautan_fitur: "/krama-bali",
          desa_adat_id: user_desa_id || suamiBaru?.desa_adat_id,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: targetUserIdPengaju
        }, null);
      } else {
        const [suamiTarget, istriTarget] = await Promise.all([
          KramaBali.findByPk(targetSuamiId),
          KramaBali.findByPk(targetIstriId)
        ]);

        const jenisPerkawinanTarget = jenis_perkawinan || perkawinanLama.jenis_perkawinan;
        let desaTujuanNotifikasi = suamiTarget?.desa_adat_id;

        if (tipe_update === "PERCERAIAN") {
          desaTujuanNotifikasi = parseInt(suamiTarget?.desa_adat_id) === parseInt(user_desa_id)
            ? istriTarget?.desa_adat_id
            : suamiTarget?.desa_adat_id;
        } else {
          if (jenisPerkawinanTarget === "Pade Gelahang") {
            desaTujuanNotifikasi = parseInt(suamiTarget?.desa_adat_id) === parseInt(user_desa_id)
              ? istriTarget?.desa_adat_id
              : suamiTarget?.desa_adat_id;
          } else if (jenisPerkawinanTarget === "Nyentana") {
            desaTujuanNotifikasi = istriTarget?.desa_adat_id;
          }
        }

        const labelPelaku = user_role === "Krama" ? "Krama Pemilik Data" : user_role;

        await kirimNotifikasiSistem(req, {
          judul: `Usulan Perubahan ${tipe_update}`,
          deskripsi: `Adanya pengajuan draft perubahan data ${labelTipe} antara ${suamiTarget?.nama_lengkap || 'Krama'} dan ${istriTarget?.nama_lengkap || 'Krama'} oleh ${labelPelaku}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
          kategori: "VERIFIKASI",
          tautan_fitur: "/verifikasi-data/perkawinan",
          desa_adat_id: desaTujuanNotifikasi,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: null
        }, null);
      }
    } catch (notifError) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas update:", notifError.message);
    }
    
    return res.status(200).json({
      message: isAutoApproved
        ? `Perubahan data ${labelTipe} berhasil diterapkan dan disetujui langsung oleh sistem!`
        : `Usulan perubahan data ${labelTipe} berhasil disimpan! Menunggu verifikasi dari Admin Desa Bersangkutan.`,
      data: resultUpdate.data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat memperbarui data perkawinan/perceraian."
    });
  }
};

export const verifikasiUpdatePerkawinan = async (req, res) => {
  try {
    const { id } = req.params;

    const { 
      tipe_update, 
      status_verifikasi, 
      catatan_admin 
    } = req.body;

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      throw { 
        status: 400, 
        message: "Status verifikasi tidak valid!" 
      };
    }

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(id);
    if (!perkawinan) {
      throw { 
        status: 404, 
        message: "Data perkawinan tidak ditemukan." 
      };
    }

    const draftKey = `UPDATE_${tipe_update}`;
    const subDraftUpdate = perkawinan.data_perubahan?.[draftKey] || {};
    const targetUserIdPengaju = perkawinan.user_id;

    if (!perkawinan.is_pending_update || Object.keys(subDraftUpdate).length === 0) {
      throw { 
        status: 400, 
        message: `Tidak ada draft perubahan ${tipe_update?.toLowerCase() || ''} yang aktif untuk diverifikasi.` 
      };
    }

    // OTORITAS KEDAULATAN DESA ADAT
    const [suamiLama, istriLama] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id),
      KramaBali.findByPk(perkawinan.istri_id)
    ]);

    if (!suamiLama || !istriLama) {
      throw { 
        status: 404, 
        message: "Data krama pasangan saat ini tidak ditemukan." 
      };
    }

    const isSatuDesaAdat = suamiLama.desa_adat_id === user_desa_id && istriLama.desa_adat_id === user_desa_id;
    let targetSisi = "super_admin";

    if (user_role === "Admin Desa") {
      const jenisPerkawinanEfektif = subDraftUpdate.jenis_perkawinan || perkawinan.jenis_perkawinan;
      const isDesaSuami = suamiLama.desa_adat_id === user_desa_id;
      const isDesaIstri = istriLama.desa_adat_id === user_desa_id;

      if (jenisPerkawinanEfektif === "Pade Gelahang") {
        if (!isDesaSuami && !isDesaIstri) {
          throw { 
            status: 403,
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          };
        }

        if (suamiLama.desa_adat_id === istriLama.desa_adat_id) {
          targetSisi = "super_admin";
        } else if (user_desa_id === istriLama.desa_adat_id) {
          targetSisi = "istri";
        } else {
          targetSisi = "suami";
        }
      } else if (jenisPerkawinanEfektif === "Nyentana") {
        if (!isDesaIstri) {
          throw { 
            status: 403, 
            message: "Proses verifikasi dihentikan! Otoritas mengesahkan perubahan data hanya milik desa adat pihak istri/pradana." 
          };
        }
        targetSisi = "istri";
      } else {
        if (!isDesaSuami) {
          throw { 
            status: 403, 
            message: "Proses verifikasi dihentikan! Otoritas mengesahkan perubahan data hanya milik desa adat pihak suami/purusha." 
          };
        }
        targetSisi = "suami";
      }
    }

    // PENYELARASAN NAMA DESA OPERATOR
    let namaOperator = "Super Admin";

    if (user_role === "Admin Desa") {
      const kramaOperator = suamiLama.desa_adat_id === user_desa_id 
        ? suamiLama 
        : (istriLama.desa_adat_id === user_desa_id ? istriLama : null);

      if (kramaOperator?.wilayah_adat?.nama_desa_adat) {
        const namaBersih = kramaOperator.wilayah_adat.nama_desa_adat.replace(/Admin Desa\s+/i, "");
        namaOperator = `Admin Desa ${namaBersih}`;
      } else {
        const desa = await DesaAdat.findByPk(user_desa_id);
        if (desa) {
          const namaBersih = desa.nama_desa_adat.replace(/Admin Desa\s+/i, "");
          namaOperator = `Admin Desa ${namaBersih}`;
        } else {
          namaOperator = `Admin Desa ${user_desa_id}`;
        }
      }
    }

    const resultVerifikasi = await verifikasiUpdateDataPerkawinan({
      perkawinan_id: id,
      tipe_update,
      status_verifikasi,
      catatan_admin,
      user_id,
      user_role,
      user_desa_id,
      target_sisi: targetSisi,
      nama_desa_operator: namaOperator
    });

    try {
      let judulNotif = `Verifikasi Perubahan ${tipe_update}`;
      let deskripsiNotif = "";

      const dataPerkawinanFinal = resultVerifikasi.data?.perkawinan || resultVerifikasi.data;
      const finalSuamiId = subDraftUpdate.suami_id || dataPerkawinanFinal?.suami_id || perkawinan.suami_id;
      const finalIstriId = subDraftUpdate.istri_id || dataPerkawinanFinal?.istri_id || perkawinan.istri_id;

      const [suamiFinal, istriFinal] = await Promise.all([
        KramaBali.findByPk(finalSuamiId),
        KramaBali.findByPk(finalIstriId)
      ]);

      const namaSuami = suamiFinal?.nama_lengkap || "Krama";
      const namaIstri = istriFinal?.nama_lengkap || "Krama";
      const labelTipe = tipe_update.toLowerCase();

      if (status_verifikasi === "Ditolak") {
        deskripsiNotif = `Usulan draft perubahan data ${labelTipe} antara ${namaSuami} dan ${namaIstri} ditolak oleh ${user_role}.`;
      } else if (resultVerifikasi.type === "PERSETUJUAN_UPDATE_PENUH") {
        deskripsiNotif = `Usulan draft perubahan data ${labelTipe} antara ${namaSuami} dan ${namaIstri} telah disetujui dan disahkan oleh ${user_role}.`;
      } else {
        deskripsiNotif = `Usulan draft perubahan data ${labelTipe} telah disetujui secara parsial oleh ${namaOperator}. Menunggu verifikasi dari Admin Desa Pasangannya.`;
      }

      const notifikasiPromises = [];

      notifikasiPromises.push(
        kirimNotifikasiSistem(req, {
          judul: judulNotif,
          deskripsi: deskripsiNotif,
          kategori: status_verifikasi === "Ditolak" ? "PERINGATAN" : "INFORMASI",
          tautan_fitur: "/krama-bali/my-data",
          desa_adat_id: null,
          sender_id: user_id,
          kontak_pesan_id: null,
          user_id: targetUserIdPengaju
        }, null)
      );

      if (suamiFinal?.desa_adat_id) {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: judulNotif,
            deskripsi: `${deskripsiNotif} (Sisi Wilayah Adat Pihak Purusha/Suami)`,
            kategori: "LOG_SISTEM",
            tautan_fitur: "/krama-bali",
            desa_adat_id: suamiFinal.desa_adat_id,
            sender_id: user_id,
            kontak_pesan_id: null,
            user_id: null
          }, null)
        );
      }

      if (istriFinal?.desa_adat_id && String(suamiFinal?.desa_adat_id) !== String(istriFinal?.desa_adat_id)) {
        notifikasiPromises.push(
          kirimNotifikasiSistem(req, {
            judul: judulNotif,
            deskripsi: `${deskripsiNotif} (Sisi Wilayah Adat Pihak Pradana/Istri)`,
            kategori: "LOG_SISTEM",
            tautan_fitur: "/krama-bali",
            desa_adat_id: istriFinal.desa_adat_id,
            sender_id: user_id,
            kontak_pesan_id: null,
            user_id: null
          }, null)
        );
      }

      await Promise.all(notifikasiPromises);
    } catch (notifError) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas verifikasi update:", notifError.message);
    }

    return res.status(200).json({
      message: status_verifikasi === "Ditolak"
        ? `Usulan perubahan data ${tipe_update.toLowerCase()} berhasil ditolak.`
        : (resultVerifikasi.type === "PERSETUJUAN_UPDATE_PENUH" 
            ? `Verifikasi selesai. Perubahan data ${tipe_update.toLowerCase()} resmi disahkan ke dalam silsilah!` 
            : `Persetujuan parsial berhasil direkam. Menunggu verifikasi dari Admin Desa Pasangan.`),
      data: resultVerifikasi.data
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat melakukan verifikasi koreksi data."
    });
  }
};

export const cancelUpdatePerkawinanById = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.UPDATE_PERKAWINAN) {
      throw {
        status: 400,
        message: "Proses pembatalan dihentikan! Data perkawinan ini tidak memiliki usulan draft perubahan data perkawinan aktif."
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id, { 
        transaction: t 
      }),
      KramaBali.findByPk(perkawinan.istri_id, { 
        transaction: t 
      })
    ]);

    if (!suami || !istri) {
      throw {
        status: 404,
        message: "Data krama suami atau istri tidak ditemukan."
      };
    }

    const targetUserIdPengaju = perkawinan.user_id;

    // Validasi Otoritas Hak Akses Membatalkan Perubahan Data
    let isHakAkses = false;

    if (user_role === "Super Admin") {
      isHakAkses = true;
    } else if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      if (jenisPerkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else if (jenisPerkawinan === "Nyentana") {
        if (istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else {
        if (suami.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      }
    } else {
      if (perkawinan.user_id === user_id || suami.user_id === user_id || istri.user_id === user_id) {
        isHakAkses = true;
      }
    }

    if (!isHakAkses) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak akses untuk membatalkan draft perubahan data perkawinan ini."
      };
    }

    let namaOperator = user_role === "Krama" ? "Krama Pemilik Data" : user_role;

    if (user_role === "Super Admin") {
      namaOperator === "Super Admin";
    } else if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id, { transaction: t });
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    const existingChanges = perkawinan.data_perubahan || {};

    const { UPDATE_PERKAWINAN, ...restChanges } = existingChanges;
    const isOtherDraft = Object.keys(restChanges).length > 0;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    const labelPelaku = user_role === "Krama" ? "Krama Pemilik Data" : user_role;
    newCatatanAdmin.status_verifikasi_update = `Usulan draft perubahan data perkawinan telah dibatalkan dan ditarik dari antrean oleh ${labelPelaku}.`;
    newCatatanAdmin.tanggal_pembatalan_update = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = namaOperator;

    const perkawinanPulih = await perkawinan.update({
      is_pending_update: isOtherDraft,
      status_verifikasi: isOtherDraft ? perkawinan.status_verifikasi : (perkawinan.status_sebelum_draft || perkawinan.status_verifikasi),
      status_sebelum_draft: isOtherDraft ? perkawinan.status_sebelum_draft : null,
      data_perubahan: isOtherDraft ? restChanges : null,
      catatan_admin_desa: newCatatanAdmin
    }, { transaction: t });

    await t.commit();

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Pembatalan Draft Perubahan Perkawinan",
        deskripsi: `Draft usulan perubahan data perkawinan antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah dibatalkan dan ditarik dari antrean oleh ${labelPelaku}.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: targetUserIdPengaju
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas pembatalan update perkawinan:", error.message);
    }
    
    return res.status(200).json({
      message: "Proses pembatalan berhasil! Draft usulan perubahan data perkawinan berhasil dibersihkan dari antrean.",
      data: perkawinanPulih
    });
  } catch (error) {
    await t.rollback();
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draf data perkawinan."
    });
  }
};

export const cancelUpdatePerceraianById = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const perkawinan_id = parseInt(req.params.id);
    if (isNaN(perkawinan_id)) {
      throw { 
        status: 400, 
        message: "ID Perkawinan tidak valid!" 
      };
    }

    const user_id = req.userId;
    const user_role = req.role;
    const user_desa_id = req.desaAdatId;

    // Validasi ketersediaan data perkawinan
    const perkawinan = await Perkawinan.findByPk(perkawinan_id, { 
      transaction: t 
    });

    if (!perkawinan) {
      throw {
        status: 404,
        message: "Data perkawinan tidak ditemukan."
      };
    }

    if (!perkawinan.is_pending_update || !perkawinan.data_perubahan?.UPDATE_PERCERAIAN) {
      throw {
        status: 400,
        message: "Proses pembatalan dihentikan! Data perkawinan ini tidak memiliki usulan draft perubahan data perceraian aktif."
      };
    }

    // Validasi ketersediaan data suami dan istri
    const [suami, istri] = await Promise.all([
      KramaBali.findByPk(perkawinan.suami_id, { 
        transaction: t 
      }),
      KramaBali.findByPk(perkawinan.istri_id, { 
        transaction: t 
      })
    ]);

    if (!suami || !istri) {
      throw {
        status: 404,
        message: "Data krama suami atau istri tidak ditemukan."
      };
    }

    const targetUserIdPengaju = perkawinan.user_id;

    // Validasi Otoritas Hak Akses Membatalkan Perubahan Data
    let isHakAkses = false;

    if (user_role === "Super Admin") {
      isHakAkses = true;
    } else if (user_role === "Admin Desa") {
      const jenisPerkawinan = perkawinan.jenis_perkawinan;
      if (jenisPerkawinan === "Pade Gelahang") {
        if (suami.desa_adat_id === user_desa_id || istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else if (jenisPerkawinan === "Nyentana") {
        if (istri.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      } else {
        if (suami.desa_adat_id === user_desa_id) {
          isHakAkses = true;
        }
      }
    } else {
      if (perkawinan.user_id === user_id || suami.user_id === user_id || istri.user_id === user_id) {
        isHakAkses = true;
      }
    }

    if (!isHakAkses) {
      throw {
        status: 403,
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak akses untuk membatalkan draft perubahan di wilayah desa adat ini."
      };
    }

    let namaOperator = user_role === "Krama" ? "Krama Pemilik Data" : user_role;

    if (user_id === "Super Admin") {
      namaOperator == "Super Admin";
    } else if (user_role === "Admin Desa") {
      const desa = await DesaAdat.findByPk(user_desa_id, { transaction: t });
      namaOperator = desa ? `Admin Desa ${desa.nama_desa_adat}` : `Admin Desa ${user_desa_id}`;
    }

    const existingChanges = perkawinan.data_perubahan || {};

    const { UPDATE_PERCERAIAN, ...restChanges } = existingChanges;
    const isOtherDraft = Object.keys(restChanges).length > 0;

    const existingCatatan = perkawinan.catatan_admin_desa || {};
    let newCatatanAdmin = { ...existingCatatan };

    const labelPelaku = user_role === "Krama" ? "Krama Pemilik Data" : user_role;
    newCatatanAdmin.status_verifikasi_update = `Usulan draft perubahan data perceraian telah dibatalkan dan ditarik dari antrean oleh ${labelPelaku}.`;
    newCatatanAdmin.tanggal_pembatalan_update = new Date().toLocaleDateString('id-ID');
    newCatatanAdmin.last_updated_by = namaOperator;

    const perkawinanPulih = await perkawinan.update({
      is_pending_update: isOtherDraft,
      status_verifikasi: isOtherDraft ? perkawinan.status_verifikasi : (perkawinan.status_sebelum_draft || perkawinan.status_verifikasi),
      status_sebelum_draft: isOtherDraft ? perkawinan.status_sebelum_draft : null,
      data_perubahan: isOtherDraft ? restChanges : null,
      catatan_admin_desa: newCatatanAdmin
    }, { transaction: t });

    await t.commit();

    try {
      await kirimNotifikasiSistem(req, {
        judul: "Pembatalan Draft Perubahan Perceraian",
        deskripsi: `Draft usulan perubahan data perceraian antara ${suami.nama_lengkap} dan ${istri.nama_lengkap} telah dibatalkan dan ditarik dari antrean oleh ${labelPelaku}.`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: user_desa_id || suami.desa_adat_id,
        sender_id: user_id,
        kontak_pesan_id: null,
        user_id: targetUserIdPengaju
      }, null);
    } catch (error) {
      console.error("Sistem gagal mengirimkan notifikasi aktivitas pembatalan update perceraian:", error.message);
    }

    return res.status(200).json({
      message: "Proses pembatalan berhasil! Draft usulan perubahan data perceraian berhasil dibersihkan dari antrean.",
      data: perkawinanPulih
    });
  } catch (error) {
    await t.rollback();
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draf data perkawinan."
    });
  }
};