import { Op } from "sequelize";
import { customAlphabet } from "nanoid";
import db from "../config/db.config.js";
import {
  KramaBali,
  User,
  RelasiKrama,
  Perkawinan,
  Keluarga,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  DesaAdat,
  Kecamatan,
  Kabupaten,
  Provinsi
} from "../models/associations.js";
import { mappingAturanAdatBali } from "../services/decision-tree.service.js";
import { simpanRiwayatPeranAdat } from "../services/riwayat-peran-adat.service.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";
import { supabase } from "../config/supabase.config.js";
import { checkDuplicateKramaBali } from "../services/police-krama.service.js";

const VALID_JENIS_KELAMIN = [
  "Laki-laki", 
  "Perempuan", 
  "Tidak Diketahui"
];

const VALID_STATUS_HIDUP = [
  "Hidup", 
  "Meninggal", 
  "Tidak Diketahui"
];

const VALID_TIPE_DATA = [
  "Leluhur", 
  "Keturunan"
];

const VALID_STATUS_VERIFIKASI = [
  "Draft",
  "Disetujui",
  "Ditolak"
];

const BOBOT_EVENT = {
  "LAHIR": 1, 
  "PENGANGKATAN": 2, 
  "KAWIN": 3, 
  "CERAI": 4
};

// Helper: membuat nomor pendafatran otomatis
const karakter = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const generateNoRegistrasi = customAlphabet(karakter, 7);

const KRAMA_INCLUDE = [
  {
    model: User,
    as: "pembuat_krama",
    attributes: ["id", "full_name", "email", "role"]
  },{
    model: DesaAdat,
    as: "wilayah_adat",
    include: [
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
    ]
  },{
    model: RiwayatPeranAdat,
    as: "riwayat_peran_adat"
  },{
    model: RiwayatKeluarga,
    as: "riwayat_keluarga",
    include: [
      {
        model: Keluarga,
        as: "detail_keluarga"
      }
    ]
  },{
    model: RelasiKrama,
    as: "relasi_krama_bali"
  },{
    model: Perkawinan,
    as: "perkawinan_suami"
  },{
    model: Perkawinan,
    as: "perkawinan_istri"
  }
];

export const getLeluhurOnly = async (req, res) => {
  try {
    const { desa_adat_id } = req.query;
    let filterCondition = { status_verifikasi: "Disetujui" };

    // Logika filter wilayah adat leluhur
    if (desa_adat_id) {
      filterCondition = {
        [Op.and]: [
          { status_verifikasi: "Disetujui" },
          {
            [Op.or]: [
              { desa_adat_id: parseInt(desa_adat_id) },
              { desa_adat_id: null }
            ]
          }
        ]
      };
    }
    
    const leluhurListRaw = await KramaBali.scope('leluhurOnly').findAll({
      where: filterCondition,
      include: ["wilayah_adat"],
      order: [["id", "ASC"]]
    });

    const leluhurList = leluhurListRaw.map(item => {
      const plainItem = item.toJSON();
      delete plainItem.data_perubahan;
      delete plainItem.status_sebelum_draft;
      return plainItem;
    });

    let message = "Berhasil mengambil data seluruh leluhur secara global.";

    if (desa_adat_id && leluhurList.length > 0) {
      const kramaDenganDesa = leluhurList.find(k => k.wilayah_adat !== null);
      const namaDesa = kramaDenganDesa?.wilayah_adat?.nama_desa_adat || desa_adat_id;
      message = `Berhasil mengambil data leluhur untuk wilayah desa adat ${namaDesa}.`;
    }

    return res.status(200).json({
      message: message,
      count: leluhurList.length,
      data: leluhurList
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan server saat mengambil data list leluhur."
    });
  }
};

export const getLeluhurOnlyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const dataLeluhurRaw = await KramaBali.scope('leluhurOnly').findOne({
      where: {
        id: id,
        status_verifikasi: "Disetujui"
      },
      include: ["wilayah_adat"]
    });

    if (!dataLeluhurRaw) {
      throw { 
        status: 404, 
        message: "Data leluhur tidak ditemukan." 
      };
    }

    // Konversi ke plain object agar manipulasi data aman dan bersih
    const dataLeluhur = dataLeluhurRaw.toJSON();

    delete dataLeluhur.data_perubahan;
    delete dataLeluhur.status_sebelum_draft;

    const namaDesa = dataLeluhur.wilayah_adat?.nama_desa_adat || "Global";

    return res.status(200).json({
      message: `Berhasil mengambil detail leluhur: ${dataLeluhur.nama_lengkap} (${namaDesa})`,
      data: dataLeluhur
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan server saat mengambil detail data leluhur."
    });
  }
};

export const getAllKrama = async (req, res) => {
  try {
    const { mode, tipe } = req.query;

    const userRole = req.role;
    const currentUserId = req.userId;
    const userDesaId = req.desaAdatId

    // Proteksi mode: jika kosong, paksa ke public demi keamanan
    const validModes = ["public", "personal", "verification"];
    const activeMode = validModes.includes(mode) ? mode : "public";

    let whereCondition = {};

    // Kondisi 1: Mengambil semua data orang lain yang telah disetujui
    if (activeMode === "public") {
      whereCondition = {
        status_verifikasi: "Disetujui"
      };
    } 
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (activeMode === "personal") {
      whereCondition = {
        user_id: currentUserId
      };
    }
    // Kondisi 3: Mengambil data dengan status draft
    else if (activeMode === "verification") {
      const isAdmin = userRole === "Admin Desa" || userRole === "Super Admin";

      if (!isAdmin) {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak!" 
        };
      }
      
      if (userRole === "Super Admin") {
        whereCondition = {
          [Op.or]: [
            { status_verifikasi: "Draft" },
            { 
              [Op.and]: [
                { status_verifikasi: "Disetujui" },
                { is_pending_update: true }
              ]
            },
            { 
              [Op.and]: [
                { status_verifikasi: "Ditolak" },
                { is_pending_update: true }
              ]
            }
          ]
        };
      } else if (userRole === "Admin Desa") {
        whereCondition = {
          [Op.or]: [
            {
              status_verifikasi: "Draft",
              desa_adat_id: userDesaId
            },
            {
              status_verifikasi: "Disetujui",
              is_pending_update: true,
              [Op.or]: [
                {
                  [Op.and]: [
                    { "data_perubahan.desa_adat_id": { [Op.is]: null } },
                    { desa_adat_id: userDesaId }
                  ]
                },
                {"data_perubahan.desa_adat_id": userDesaId}
              ]
            },
            {
              status_verifikasi: "Ditolak",
              is_pending_update: true,
              [Op.or]: [
                {
                  [Op.and]: [
                    { "data_perubahan.desa_adat_id": { [Op.is]: null } },
                    { desa_adat_id: userDesaId }
                  ]
                },
                {"data_perubahan.desa_adat_id": userDesaId}
              ]
            }
          ]
        };
      }
    }

    // Filter berdasarkan tipe data Leluhur/Keturunan, jika ada
    if (tipe && VALID_TIPE_DATA.includes(tipe)) {
      whereCondition.tipe_data = tipe;
    }

    // Kondisi 4: Mengambil semua data tanpa terkecuali
    const kramaRaw = await KramaBali.findAll({
      where: whereCondition,
      include: KRAMA_INCLUDE,
      order: [["id", "DESC"]]
    });

    // ============================================================
    // LOGIKA FILTER PRIVASI & BUFFER SANITIZATION (POST-PROCESSING)
    // ============================================================
    const kramaList = kramaRaw.map(instance => {
      // konversi ke plain object agar manipulasi properti bersih
      const krama = instance.toJSON(); 

      const isSatuDesa = krama.desa_adat_id === userDesaId;
      const isAdmin = userRole === "Admin Desa" || userRole === "Super Admin";
      const isOwner = krama.user_id === currentUserId;

      if (!isOwner && !isAdmin) {
        delete krama.data_perubahan;
        delete krama.status_sebelum_draft;
      }

      if (activeMode === "public" && !isSatuDesa && !isAdmin && !isOwner) {
        return {
          id: krama.id,
          nama_lengkap: krama.nama_lengkap,
          nomor_pendaftaran: krama.nomor_pendaftaran,
          nama_panggilan: krama.nama_panggilan,
          jenis_kelamin: krama.jenis_kelamin,
          tanggal_lahir: krama.tanggal_lahir,
          status_hidup: krama.status_hidup,
          tipe_data: krama.tipe_data,
          desa_adat_id: krama.desa_adat_id,
          tempat_asal_khusus: krama.tempat_asal_khusus,
          relasi_krama_bali: krama.relasi_krama_bali,
          perkawinan_suami: krama.perkawinan_suami,
          perkawinan_istri: krama.perkawinan_istri,
          wilayah_adat: krama.wilayah_adat
        };
      }
      return krama;
    });

    return res.status(200).json({
      message: "Berhasil mengambil data krama bali!",
      count: kramaList.length,
      data: kramaList
    });
  } catch (error) {
    const statusCode = error.status || 500;
    console.error("ERROR GET_KRAMA_BALI:", error);
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan server saat memuat data krama bali."
    });
  }
};

export const getKramaById = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    const currentUserId = req.userId;

    const dataKramaRaw = await KramaBali.findOne({
      where: { id },
      include: KRAMA_INCLUDE
    });

    if (!dataKramaRaw) {
      throw { 
        status: 404, 
        message: "Data krama bali tidak ditemukan." 
      };
    }

    // Validasi hak akses ruang lingkup data
    const isDraft = dataKramaRaw.status_verifikasi === "Draft" || dataKramaRaw.status_verifikasi === "Ditolak";
    const isPending = dataKramaRaw.is_pending_update === true;
    const isOwner = dataKramaRaw.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    // Menentukan desa yang berwenang
    const desaOtoritasId = (isPending && dataKramaRaw.data_perubahan?.desa_adat_id)
      ? parseInt(dataKramaRaw.data_perubahan.desa_adat_id)
      : (dataKramaRaw.desa_adat_id ? parseInt(dataKramaRaw.desa_adat_id) : null);

    const isAdminDesaBerwenang = userRole === "Admin Desa" && desaOtoritasId === userDesaId;
    
    if (isDraft && !isOwner && !isAdminDesaBerwenang && !isSuperAdmin) {
      throw { 
        status: 403, 
        message: "Otoritas mengakses data ditolak! Data ini masih dalam proses verifikasi awal." 
      };
    }

    // Konversi ke plain object agar manipulasi properti aman dan bersih
    const dataKrama = dataKramaRaw.toJSON();

    const isSatuDesa = desaOtoritasId === userDesaId;
    const isAdmin = isAdminDesaBerwenang || isSuperAdmin;

    if (!isOwner && !isAdmin) {
      delete dataKrama.data_perubahan;
      delete dataKrama.status_sebelum_draft;
    }

    return res.status(200).json({
      message: "Berhasil mengambil detail data krama bali secara penuh!",
      data: dataKrama
    });

  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan server saat mengambil detail data krama bali."
    });
  }
};

export const createKrama = async (req, res) => {
  const file = req.file;
  let filePath = null;
  let t;

  try {
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    const currentUserId = req.userId;

    const {
      nama_lengkap,
      nama_panggilan,
      jenis_kelamin,
      tanggal_lahir,
      status_hidup,
      is_bali,
      desa_adat_id,
      tempat_asal_khusus,
      alamat_luar,
      tipe_data,
    } = req.body;

    let final_is_bali = is_bali;
    if (typeof is_bali === "string") {
      final_is_bali = is_bali === "true";
    } else if (is_bali === undefined || is_bali === null) {
      final_is_bali = true; // Default fallback
    }

    // 2. Mengubah string ID dari FormData menjadi integer/null yang bersih
    const final_desa_adat_id_input = desa_adat_id && desa_adat_id !== "" ? Number(desa_adat_id) : null;
    const final_alamat_luar_input = alamat_luar && alamat_luar !== "" ? alamat_luar.trim() : null;

    if (!nama_lengkap) {
      throw { 
        status: 400, 
        message: "Nama lengkap wajib diisi!" 
      };
    }

    if (!VALID_TIPE_DATA.includes(tipe_data)) {
      throw { 
        status: 400, 
        message: "Tipe data tidak valid!" 
      };
    }

    const finalGenerateNomor = generateNoRegistrasi();

    let final_desa_adat_id = null;
    let final_alamat_luar = null;

    if (tipe_data === "Keturunan") {
      if (!jenis_kelamin || !VALID_JENIS_KELAMIN.includes(jenis_kelamin)) {
        throw { 
          status: 400, 
          message: "Jenis kelamin tidak valid!" 
        };
      }

      if (!status_hidup || !VALID_STATUS_HIDUP.includes(status_hidup)) {
        throw { 
          status: 400, 
          message: "Status hidup tidak valid!" 
        };
      }

      // Validasi input wilayah asal
      if (final_is_bali === true) {
        if (!final_desa_adat_id_input) {
          throw { 
            status: 400, 
            message: "Krama bali wajib memilih desa adat asal!" 
          };
        }
        final_desa_adat_id = final_desa_adat_id_input;
      } else {
        if (!final_alamat_luar_input) {
          throw { 
            status: 400, 
            message: "Krama luar bali wajib mengisi alamat asal!" 
          };
        }
        final_alamat_luar = final_alamat_luar_input;
      }
    } else {
      if (final_is_bali === true && final_desa_adat_id_input) {
        final_desa_adat_id = final_desa_adat_id_input;
      } else if (final_is_bali === false && final_alamat_luar_input) {
        final_alamat_luar = final_alamat_luar_input;
      }
    }

    // LOGIKA AUTO-APPROVAL DATA KRAMA BALI
    let statusVerifAwal = "Draft";
    let catatanAdminDesa = "Data krama bali berhasil disimpan! Menunggu verifikasi dari Admin Desa." + (!tanggal_lahir ? " (tanggal riwayat akan disesuaikan dengan tanggal input sistem karena input tanggal lahir kosong)." : "");

    const isSuperAdmin = userRole === "Super Admin";
    const isAdminDesaLokal = userRole === "Admin Desa" && (final_desa_adat_id ? Number(userDesaId) === Number(final_desa_adat_id) : true);
    const isAuthedToApprove = isSuperAdmin || isAdminDesaLokal;

    if (isAuthedToApprove) {
      statusVerifAwal = "Disetujui";
      catatanAdminDesa = `Data krama bali diverifikasi otomatis oleh sistem (Input by ${userRole}).`;
    }

    // Proses Upload File ke Bucket Privat Supabase
    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}_krama_${finalGenerateNomor}.${fileExt}`;

      filePath = `foto-profile-krama/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photo-krama')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        throw { 
          status: 500, 
          message: `Gagal mengunggah foto profil krama ke Cloud Storage: ${uploadError.message}` 
        };
      }
    }

    // Mulai transaksi database
    t = await db.transaction();

    const kramaBaru = await KramaBali.create({
      nomor_pendaftaran: finalGenerateNomor,
      nama_lengkap,
      nama_panggilan: nama_panggilan || null,
      jenis_kelamin: jenis_kelamin || "Tidak Diketahui",
      tanggal_lahir: tanggal_lahir || null,
      status_hidup: tipe_data === "Leluhur" ? (status_hidup || "Tidak Diketahui") : (status_hidup || "Hidup"),
      is_bali: final_is_bali,
      desa_adat_id: final_desa_adat_id,
      tempat_asal_khusus,
      alamat_luar: final_alamat_luar,
      tipe_data,
      foto_profile: filePath,
      user_id: currentUserId,
      status_verifikasi: statusVerifAwal,
      catatan_admin_desa: catatanAdminDesa,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null
    }, { transaction: t });

    // ============================================================
    // EKSEKUSI DECISION TREE HANYA JIKA DATA DISETUJUI (Keturunan)
    // ============================================================
    if (tipe_data === "Keturunan" && isAuthedToApprove) {
      const keputusan = await mappingAturanAdatBali("LAHIR", {
        jenis_kelamin
      }, t);

      const tglMulai = kramaBaru.tanggal_lahir 
        ? new Date(`${kramaBaru.tanggal_lahir} ${new Date().toTimeString().split(' ')[0]}`)
        : new Date();

      await simpanRiwayatPeranAdat({
        krama_id: kramaBaru.id,
        status_peran_adat: keputusan.status_peran_adat,
        garis_keturunan: keputusan.garis_keturunan,
        dasar_keputusan: keputusan.dasar_keputusan + (!tanggal_lahir ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal lahir kosong)." : ""), 
        kategori_event: "LAHIR",
        bobot_event: BOBOT_EVENT["LAHIR"],
        event_date: tglMulai
      }, t);
    }

    if (isAuthedToApprove) {
      await kirimNotifikasiSistem(req, {
        judul: "Pendaftaran Data Krama Bali",
        deskripsi: `Data krama bali baru atas nama ${kramaBaru.nama_lengkap} telah ditambahkan dan diverifikasi otomatis oleh sistem (Input by ${userRole}).`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: kramaBaru.desa_adat_id || userDesaId,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t)
    } else {
      await kirimNotifikasiSistem(req, {
        judul: "Antrean Data Krama Bali Baru",
        deskripsi: `Adanya pendaftaran data krama bali baru atas nama ${kramaBaru.nama_lengkap} oleh ${userRole}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
        kategori: "VERIFIKASI",
        tautan_fitur: "/verifikasi-data/krama-bali",
        desa_adat_id: kramaBaru.desa_adat_id,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t);
    }

    await t.commit();

    return res.status(201).json({
      message: isAuthedToApprove
        ? "Data krama bali berhasil ditambahkan resmi ke sistem!"
        : "Data krama bali berhasil diajukan! Menunggu proses verifikasi dari Admin Desa.",
      data: kramaBaru
    });
  } catch (error) {
    if (t) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error("Transaksi database sudah ditutup:", rollbackError.message);
      }
    }
    if (filePath) {
      await supabase.storage.from('photo-krama').remove([filePath]);
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat menyimpan data krama bali."
    });
  }
};

export const verifikasiKrama = async (req, res) => {
  let fileFotoDihapusPascaCommit = null;
  let t;

  try {
    const { id } = req.params;
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    const { status_verifikasi, catatan_admin_desa, force = false } = req.body;

    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      return res.status(400).json({ 
        message: "Status verifikasi tidak valid!" 
      });
    }

    const kramaTargetAwal = await KramaBali.findByPk(id, {
      attributes: ["id", "nama_lengkap", "jenis_kelamin", "desa_adat_id", "is_pending_update", "data_perubahan"]
    });

    if (!kramaTargetAwal) {
      return res.status(404).json({
        message: "Data krama bali tidak ditemukan."
      });
    }

    // Identifikasi mutasi lintas desa adat
    const desaAsalId = kramaTargetAwal.desa_adat_id;
    const desaTujuanId = kramaTargetAwal.is_pending_update && kramaTargetAwal.data_perubahan?.desa_adat_id
      ? Number(kramaTargetAwal.data_perubahan.desa_adat_id)
      : null;
    const isMutasiLintasDesa = desaTujuanId && Number(desaAsalId) !== Number(desaTujuanId);

    if (userRole === "Admin Desa") {
      const desaOtoritasHak = isMutasiLintasDesa ? desaTujuanId : (desaAsalId || desaTujuanId);
      if (Number(desaOtoritasHak) !== Number(userDesaId)) {
        return res.status(403).json({ 
          message: isMutasiLintasDesa 
            ? "Otoritas mengakses data ditolak! Usulan mutasi krama bali masuk wajib diverifikasi oleh Admin Desa Adat Tujuan."
            : "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
        });
      }
    }

    // CHECK POTENSI DUPLIKASI DATA
    if (status_verifikasi === "Disetujui" && !force) {
      const namaTarget = kramaTargetAwal.is_pending_update && kramaTargetAwal.data_perubahan?.nama_lengkap
        ? kramaTargetAwal.data_perubahan.nama_lengkap
        : kramaTargetAwal.nama_lengkap;

      const jenisKelaminTarget = kramaTargetAwal.is_pending_update && kramaTargetAwal.data_perubahan?.jenis_kelamin
        ? kramaTargetAwal.data_perubahan.jenis_kelamin
        : kramaTargetAwal.jenis_kelamin;

      const desaAdatTarget = kramaTargetAwal.is_pending_update && kramaTargetAwal.data_perubahan?.desa_adat_id
        ? kramaTargetAwal.data_perubahan.desa_adat_id
        : kramaTargetAwal.desa_adat_id;

      const potensiDuplikat = await checkDuplicateKramaBali({
        id: kramaTargetAwal.id,
        nama_lengkap: namaTarget,
        jenis_kelamin: jenisKelaminTarget,
        desa_adat_id: desaAdatTarget
      });

      if (potensiDuplikat.length > 0) {
        return res.status(409).json({
          is_duplicate_warning: true,
          message: "Terdeteksi potensi duplikasi data krama di desa adat yang sama.",
          total_potensi: potensiDuplikat.length,
          potensi_duplikat: potensiDuplikat
        });
      }
    }

    // Mulai transaksi database
    t = await db.transaction();

    const krama = await KramaBali.findByPk(id, {
      include: [{ 
        model: DesaAdat, 
        as: "wilayah_adat", 
        attributes: ["nama_desa_adat"] 
      }],
      transaction: t,
      lock: {
        level: t.LOCK.UPDATE,
        of: KramaBali
      }
    });

    if (!krama) {
      throw { 
        status: 404, 
        message: "Data krama bali tidak ditemukan." 
      };
    }

    // VALIDASI ANTREAN PENGAJUAN AKTIF
    const statusSaatIni = krama.status_verifikasi;
    const isPendingUpdateData = krama.is_pending_update === true;
    const isTrueVerif = statusSaatIni === "Draft" || statusSaatIni === "Ditolak" || (statusSaatIni === "Disetujui" && krama.is_pending_update === true);

    if (!isTrueVerif) {
      throw { 
        status: 400, 
        message: "Proses verifikasi dihentikan! Data ini tidak memiliki antrean pengajuan yang aktif." 
      };
    }

    // Mengambil status peran adat krama target
    const riwayatPeranLama = await RiwayatPeranAdat.findOne({
      where: { 
        krama_id: id, 
        kategori_event: "LAHIR" 
      },
      transaction: t
    });

    const labelOperator = userRole === "Admin Desa" 
      ? `Admin Desa ${krama.wilayah_adat?.nama_desa_adat || "Adat"}` 
      : userRole;

    // =======================================================
    // CASE 1: VERIFIKASI DITOLAK
    // =======================================================
    if (status_verifikasi === "Ditolak") {
      if (!catatan_admin_desa?.trim()) {
        throw { 
          status: 400, 
          message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!" 
        };
      }

      const statusKembali = krama.is_pending_update 
        ? krama.status_sebelum_draft 
        : "Ditolak";

      if (isPendingUpdateData && krama.data_perubahan?.foto_profile) {
        fileFotoDihapusPascaCommit = krama.data_perubahan.foto_profile;
      }

      await krama.update({
        status_verifikasi: statusKembali,
        catatan_admin_desa: isPendingUpdateData ? `[PERUBAHAN DITOLAK]: ${catatan_admin_desa.trim()}.` : `[DITOLAK]: ${catatan_admin_desa.trim()}.`,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null
      }, { transaction: t });

      const deskripsiNotifTolak = isPendingUpdateData
        ? `Usulan perubahan data krama bali atas nama ${krama.nama_lengkap} telah ditolak oleh ${labelOperator}. Catatan: ${catatan_admin_desa}`
        : `Pengajuan pendaftaran krama bali baru atas nama ${krama.nama_lengkap} telah ditolak oleh ${labelOperator}. Catatan: ${catatan_admin_desa}`;

      await kirimNotifikasiSistem(req, {
        judul: isPendingUpdateData ? "Perubahan Data Krama Bali Ditolak" : "Pendaftaran Data Krama Bali Ditolak",
        deskripsi: deskripsiNotifTolak,
        kategori: "PERINGATAN",
        tautan_fitur: "/krama-bali/my-data",
        desa_adat_id: null,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: krama.user_id
      }, t);

      await t.commit();

      if (fileFotoDihapusPascaCommit) {
        supabase.storage.from('photo-krama').remove([fileFotoDihapusPascaCommit]).catch(err => {
          console.error("Gagal menghapus file usulan foto yang ditolak:", err.message);
        });
      }

      const kramaTerbaru = await KramaBali.findByPk(id, { 
        include: KRAMA_INCLUDE
      });

      return res.status(200).json({
        message: `Data krama bali atas nama ${krama.nama_lengkap} resmi ditolak oleh ${labelOperator}.`,
        data: kramaTerbaru
      });
    }

    // ======================================================
    // CASE 2: VERIFIKASI DISETUJUI
    // ======================================================
    let finalUpdate = {
      status_verifikasi: "Disetujui",
      catatan_admin_desa: catatan_admin_desa?.trim() || (isPendingUpdateData 
        ? `Usulan perubahan data krama bali resmi diverifikasi dan disetujui oleh ${userRole}.`
        : `Pengajuan pendaftaran krama bali baru telah diverifikasi dan disetujui oleh ${userRole}.`),
      is_pending_update: false,
      status_sebelum_draft: null,
      data_perubahan: null
    };

    const idDesaAsalUntukNotif = krama.desa_adat_id;

    // BONGKAR BUFFER JSONB: jika ada data di buffer, pindahkan ke kolom utama
    if (isPendingUpdateData && krama.data_perubahan) {
      const dataBaru = krama.data_perubahan;
      finalUpdate = { 
        ...finalUpdate, 
        ...dataBaru 
      };

      if (dataBaru.foto_profile && krama.foto_profile) {
        fileFotoDihapusPascaCommit = krama.foto_profile;
      }

      // Sinkronisasi kronologis jika ada perubahan tanggal lahir
      if (dataBaru.tanggal_lahir && krama.tipe_data === "Keturunan") {
        const tanggalBaruDateTime = new Date(`${dataBaru.tanggal_lahir} ${new Date().toTimeString().split(' ')[0]}`);
        
        if (riwayatPeranLama) {
          await riwayatPeranLama.update({ 
            mulai_tanggal: tanggalBaruDateTime 
          }, { transaction: t });
        }

        const riwayatKeluargaExist = await RiwayatKeluarga.findOne({
          where: { 
            krama_id: id, 
            kategori_event: "LAHIR" 
          },
          transaction: t
        });

        if (riwayatKeluargaExist) {
          await riwayatKeluargaExist.update({ 
            awal_masuk: tanggalBaruDateTime 
          }, { transaction: t });
        }
      }
    }

    await krama.update(finalUpdate, { transaction: t });
    const kramaRefreshed = krama

    // ===========================================================
    // LOGIKA EVALUASI DECISION TREE UNTUK DATA BARU
    // ===========================================================
    if (kramaRefreshed.tipe_data === "Keturunan") {
      const jenisKelaminAktif = kramaRefreshed.jenis_kelamin;
      const tanggalLahirAktif = kramaRefreshed.tanggal_lahir;

      if (jenisKelaminAktif && jenisKelaminAktif !== "Tidak Diketahui") {
        const keputusan = await mappingAturanAdatBali("LAHIR", {
          jenis_kelamin: jenisKelaminAktif
        }, t);
        
        const tglMulai = tanggalLahirAktif 
          ? new Date(`${tanggalLahirAktif} ${new Date().toTimeString().split(' ')[0]}`)
          : new Date();

        if (riwayatPeranLama) {
          await riwayatPeranLama.update({
            status_peran_adat: keputusan.status_peran_adat,
            garis_keturunan: keputusan.garis_keturunan,
            dasar_keputusan: keputusan.dasar_keputusan + (!tanggalLahirAktif ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal lahir kosong)." : ""),
            mulai_tanggal: tglMulai
          }, { transaction: t });
        } else {
          await simpanRiwayatPeranAdat({
            krama_id: kramaRefreshed.id,
            status_peran_adat: keputusan.status_peran_adat,
            garis_keturunan: keputusan.garis_keturunan,
            dasar_keputusan: keputusan.dasar_keputusan + (!tanggalLahirAktif ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal lahir kosong)." : ""),
            kategori_event: "LAHIR",
            bobot_event: BOBOT_EVENT["LAHIR"],
            event_date: tglMulai
          }, t);
        }
      }
    }

    const judulNotifWarga = isPendingUpdateData ? "Perubahan Data Krama Bali Disetujui" : "Data Krama Bali Disetujui";
    const deskripsiNotifWarga = isPendingUpdateData
      ? `Usulan perubahan data krama bali atas nama ${kramaRefreshed.nama_lengkap} telah diverifikasi dan disetujui resmi oleh ${userRole}.`
      : `Pengajuan pendaftaran krama bali baru atas nama ${kramaRefreshed.nama_lengkap} telah diverifikasi dan disetujui resmi oleh ${userRole}.`;

    const judulLogSistem = isMutasiLintasDesa 
      ? "Penerimaan Mutasi Krama Bali" 
      : (isPendingUpdateData ? "Perubahan Data Krama Bali" : "Pendaftaran Krama Bali Baru");

    const deskripsiLogSistem = isMutasiLintasDesa 
      ? `Data mutasi desa adat asal krama bali atas nama ${kramaRefreshed.nama_lengkap} telah diverifikasi dan disetujui oleh Admin Desa Adat Tujuan.`
      : (isPendingUpdateData 
          ? `Usulan perubahan data krama bali atas nama ${kramaRefreshed.nama_lengkap} telah diverifikasi dan disetujui oleh ${userRole}.`
          : `Pengajuan pendaftaran krama bali baru atas nama ${kramaRefreshed.nama_lengkap} telah diverifikasi dan disetujui oleh ${userRole}.`);

    const notifikasiPromises = [
      kirimNotifikasiSistem(req, {
        judul: judulNotifWarga,
        deskripsi: deskripsiNotifWarga,
        kategori: "INFORMASI",
        tautan_fitur: "/krama-bali/my-data",
        desa_adat_id: null,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: kramaRefreshed.user_id
      }, t),
      kirimNotifikasiSistem(req, {
        judul: judulLogSistem,
        deskripsi: deskripsiLogSistem,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: kramaRefreshed.desa_adat_id,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t)
    ];

    if (isMutasiLintasDesa && idDesaAsalUntukNotif) {
      notifikasiPromises.push(
        kirimNotifikasiSistem(req, {
          judul: "Mutasi Desa Adat Asal Krama Bali",
          deskripsi: `Data krama bali atas nama ${kramaRefreshed.nama_lengkap} telah resmi dimutasi keluar menuju Desa Adat Tujuan setelah disetujui oleh otoritas desa adat.`,
          kategori: "LOG_SISTEM",
          tautan_fitur: "/krama-bali",
          desa_adat_id: idDesaAsalUntukNotif,
          sender_id: currentUserId,
          kontak_pesan_id: null,
          user_id: null
        }, t)
      );
    }

    await Promise.all(notifikasiPromises);
    await t.commit();

    if (fileFotoDihapusPascaCommit) {
      supabase.storage.from('photo-krama').remove([fileFotoDihapusPascaCommit]).catch(err => {
        console.error("Gagal membersihkan berkas foto lama pasca persetujuan usulan:", err.message);
      });
    }

    const kramaTerbaru = await KramaBali.findByPk(id, {
      include: KRAMA_INCLUDE
    });

    return res.status(200).json({
      message: `Data krama bali atas nama ${krama.nama_lengkap} berhasil ${status_verifikasi}.`,
      data: kramaTerbaru
    });
  } catch (error) {
    if (t) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error("Transaksi database sudah ditutup:", rollbackError.message);
      }
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat proses verifikasi krama bali."
    });
  }
};

export const updateKramaById = async (req, res) => {
  const file = req.file;
  let fileFotoBaruPath = null;
  let fileFotoLamaYangAkanDihapus = null;
  let t;

  try {
    const { id } = req.params;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    const currentUserId = req.userId;

    const payload = { ...req.body };
    
    delete payload.nomor_pendaftaran;
    delete payload.foto_profile;

    // membersihkan string kosong
    if (payload.desa_adat_id === "") {
      payload.desa_adat_id = null;
    }
    if (payload.tanggal_lahir === "") {
      payload.tanggal_lahir = null;
    }
    if (payload.jenis_kelamin === "") {
      payload.jenis_kelamin = null;
    }
    if (payload.status_hidup === "") {
      payload.status_hidup = null;
    }

    const kramaCek = await KramaBali.findByPk(id);

    if (!kramaCek) {
      throw { 
        status: 404, 
        message: "Data krama bali tidak ditemukan." 
      };
    }

    // Proses Upload File ke Bucket Privat Supabase
    if (file) {
      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}_krama_${kramaCek.nomor_pendaftaran}.${fileExt}`;

      fileFotoBaruPath = `foto-profile-krama/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('photo-krama')
        .upload(fileFotoBaruPath, file.buffer, {
          contentType: file.mimetype,
          upsert: false
        });

      if (uploadError) {
        throw { 
          status: 500, 
          message: `Gagal mengunggah foto profil baru: ${uploadError.message}` 
        };
      }
    }

    // Mulai transaksi database
    t = await db.transaction();
    
    const krama = await KramaBali.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    // VALIDASI HAK AKSES RUANG LINGKUP DATA
    if (userRole !== "Super Admin" && currentUserId !== krama.user_id) {
      if (userRole === "Admin Desa") {
        if (parseInt(krama.desa_adat_id) !== parseInt(userDesaId)) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          };
        }
      } else {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak!" 
        };
      }
    }
    
    if (krama.tipe_data === "Keturunan") {
      if (payload.jenis_kelamin && !VALID_JENIS_KELAMIN.includes(payload.jenis_kelamin)) {
        throw { 
          status: 400, 
          message: "Jenis kelamin tidak valid!" 
        };
      }
      if (payload.status_hidup && !VALID_STATUS_HIDUP.includes(payload.status_hidup)) {
        throw { 
          status: 400, 
          message: "Status hidup tidak valid!" 
        };
      }
    }
    
    // LOGIKA SINKRONISASI WILAYAH ASAL
    if (payload.is_bali !== undefined) {
      if (payload.is_bali === true) {
        payload.alamat_luar = null;
      } else if (payload.is_bali === false) {
        payload.desa_adat_id = null;
        payload.tempat_asal_khusus = null;
      }
    }

    // ============================================================
    // LOGIKA BUFFERING PERUBAHAN DATA BERDASARKAN OPERATOR
    // ============================================================
    const isSuperAdmin = userRole === "Super Admin";
    const isAdminDesaLokal = userRole === "Admin Desa" && (krama.desa_adat_id ? Number(userDesaId) === Number(krama.desa_adat_id) : true);
    const isAuthedToApprove = isSuperAdmin || isAdminDesaLokal;

    if (!isAuthedToApprove) {
      if (fileFotoBaruPath) {
        payload.foto_profile = fileFotoBaruPath;
      }

      await krama.update({
        status_sebelum_draft: krama.status_verifikasi,
        is_pending_update: true,
        data_perubahan: payload,
        catatan_admin_desa: `Adanya usulan perubahan data krama bali oleh ${userRole}. Menunggu verifikasi dari Admin Desa Bersangkutan.`
      }, { transaction: t });

      await kirimNotifikasiSistem(req, {
        judul: "Antrean Perubahan Data Krama Bali",
        deskripsi: `Adanya perubahan data krama bali atas nama ${payload.nama_lengkap || krama.nama_lengkap} oleh ${userRole}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
        kategori: "VERIFIKASI",
        tautan_fitur: "/verifikasi-data/krama-bali",
        desa_adat_id: krama.desa_adat_id || userDesaId,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t);

      await t.commit();

      const updateKramaPersonal = await KramaBali.findByPk(id, {
        include: KRAMA_INCLUDE
      });

      return res.status(200).json({
        message: "Usulan perubahan data krama bali berhasil diajukan! Data publik tetap menggunakan data lama hingga disetujui oleh Admin Desa.",
        data: updateKramaPersonal
      });
    } 

    if (!isSuperAdmin && payload.desa_adat_id && Number(payload.desa_adat_id) !== Number(userDesaId)) {
      throw { 
        status: 400, 
        message: "Proses memperbarui dihentikan! Untuk melakukan mutasi warga keluar dari desa adat Anda, silakan ajukan melalui usulan perubahan agar diverifikasi oleh Admin Desa Tujuan." 
      };
    }

    if (fileFotoBaruPath) {
      payload.foto_profile = fileFotoBaruPath;
      if (krama.foto_profile) {
        fileFotoLamaYangAkanDihapus = krama.foto_profile;
      }
    }

    await krama.update({
      ...payload,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null,
      status_verifikasi: "Disetujui",
      catatan_admin_desa: `Data krama bali telah diperbarui secara resmi oleh ${userRole}.`
    }, { transaction: t });

    // PROSES EVALUASI DECISION TREE
    const jenisKelaminAktif = payload.jenis_kelamin || krama.jenis_kelamin;
    const tanggalLahirAktif = payload.tanggal_lahir || krama.tanggal_lahir;

    if (krama.tipe_data === "Keturunan" && jenisKelaminAktif && jenisKelaminAktif !== "Tidak Diketahui") {
      const riwayatLahirExist = await RiwayatPeranAdat.findOne({
        where: { 
          krama_id: id, 
          kategori_event: "LAHIR" 
        },
        transaction: t
      });

      // mapping ulang decision tree berdasarkan jenis kelamin aktif
      const keputusan = await mappingAturanAdatBali("LAHIR", { 
        jenis_kelamin: jenisKelaminAktif 
      }, t);

      const tglMulai = tanggalLahirAktif 
        ? new Date(`${tanggalLahirAktif} ${new Date().toTimeString().split(' ')[0]}`)
        : new Date();

      if (riwayatLahirExist) {
        await riwayatLahirExist.update({
          status_peran_adat: keputusan.status_peran_adat,
          garis_keturunan: keputusan.garis_keturunan,
          dasar_keputusan: keputusan.dasar_keputusan + (!tanggalLahirAktif ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal lahir kosong)." : ""),
          mulai_tanggal: tglMulai
        }, { transaction: t });
      } else {
        await simpanRiwayatPeranAdat({
          krama_id: id,
          status_peran_adat: keputusan.status_peran_adat,
          garis_keturunan: keputusan.garis_keturunan,
          dasar_keputusan: keputusan.dasar_keputusan + (!tanggalLahirAktif ? " (tanggal riwayat disesuaikan dengan tanggal input sistem karena tanggal lahir kosong)." : ""),
          kategori_event: "LAHIR",
          bobot_event: BOBOT_EVENT["LAHIR"],
          event_date: tglMulai
        }, t);
      }
    }

    if (payload.tanggal_lahir && krama.tipe_data === "Keturunan") {
      const tanggalLahirBaruDateTime = new Date(`${payload.tanggal_lahir} ${new Date().toTimeString().split(' ')[0]}`);

      const riwayatLahirExist = await RiwayatPeranAdat.findOne({
        where: { 
          krama_id: id, 
          kategori_event: "LAHIR" 
        },
        transaction: t
      });

      if (riwayatLahirExist) {
        await riwayatLahirExist.update({ 
          mulai_tanggal: tanggalLahirBaruDateTime 
        }, { transaction: t });
      }

      const hubunganKeluargaKandung = await RiwayatKeluarga.findOne({
        where: { 
          krama_id: id,
          kategori_event: "LAHIR"
        },
        transaction: t
      });

      if (hubunganKeluargaKandung) {
        await hubunganKeluargaKandung.update({ 
          awal_masuk: tanggalLahirBaruDateTime 
        }, { transaction: t });
      }
    }

    const targetDesaNotif = payload.desa_adat_id !== undefined ? payload.desa_adat_id : krama.desa_adat_id;

    await Promise.all([
      kirimNotifikasiSistem(req, {
        judul: "Perubahan Data Krama Bali",
        deskripsi: `Data krama bali atas nama ${payload.nama_lengkap || krama.nama_lengkap} telah diverifikasi dan diperbarui otomatis oleh sistem (Update by ${userRole}).`,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/krama-bali",
        desa_adat_id: targetDesaNotif || userDesaId,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t),
      ...(krama.user_id ? [
        kirimNotifikasiSistem(req, {
          judul: "Perbaruan Data Krama Bali",
          deskripsi: `Data krama bali Anda atas nama ${payload.nama_lengkap || krama.nama_lengkap} telah disesuaikan dan diperbarui secara resmi oleh ${userRole}.`,
          kategori: "INFORMASI",
          tautan_fitur: "/krama-bali/my-data",
          desa_adat_id: null, 
          sender_id: currentUserId,
          kontak_pesan_id: null,
          user_id: krama.user_id
        }, t)
      ] : [])
    ]);

    await t.commit();

    if (fileFotoLamaYangAkanDihapus) {
      supabase.storage.from('photo-krama').remove([fileFotoLamaYangAkanDihapus]).catch(err => {
        console.error("Gagal menghapus berkas foto lama di cloud storage:", err.message);
      });
    }
    
    const updateKramaAdmin = await KramaBali.findByPk(id, {
      include: KRAMA_INCLUDE
    });

    return res.status(200).json({
      message: "Data krama bali berhasil diperbarui secara resmi!",
      data: updateKramaAdmin
    });
  } catch (error) {
    if (t) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error("Transaksi database sudah ditutup:", rollbackError.message);
      }
    }
    if (fileFotoBaruPath) {
      await supabase.storage.from('photo-krama').remove([fileFotoBaruPath]);
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat memperbarui data krama bali."
    });
  }
};

export const cancelUpdateKrama = async (req, res) => {
  let fileFotoUsulanDihapusPascaCommit = null;
  let t;

  try {
    const { id } = req.params;
    const userRole = req.role;
    const userId = req.userId;
    const userDesaId = req.desaAdatId;

    // Mulai transaksi database
    t = await db.transaction();

    const krama = await KramaBali.findByPk(id, { 
      transaction: t,
      lock: t.LOCK.UPDATE 
    });

    if (!krama) {
      throw { 
        status: 404,
        message: "Data krama bali tidak ditemukan." 
      };
    }

    if (!krama.is_pending_update) {
      throw { 
        status: 400, 
        message: "Tidak ada usulan perubahan yang aktif pada data ini." 
      };
    }

    // Identifikasi keterlibatan desa adat
    const desaAsalId = krama.desa_adat_id;
    const desaTujuanId = krama.data_perubahan?.desa_adat_id 
      ? Number(krama.data_perubahan.desa_adat_id) 
      : null;
    
    // VALIDASI HAK AKSES MEMBATALKAN PERUBAHAN DATA
    if (userRole !== "Super Admin" && userId !== krama.user_id) {
      if (userRole === "Admin Desa") {
        const isAsalMatch = Number(desaAsalId) === Number(userDesaId);
        const isTujuanMatch = desaTujuanId && Number(desaTujuanId) === Number(userDesaId);
        if (!isAsalMatch && !isTujuanMatch) {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          };
        }
      } else {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak! Anda bukan pengusul yang mengajukan perubahan data ini." 
        };
      }
    }

    if (krama.data_perubahan?.foto_profile) {
      fileFotoUsulanDihapusPascaCommit = krama.data_perubahan.foto_profile;
    }

    // DETERMINASI REKONSILIASI STATUS & LOGGING CATATAN
    const statusPulih = krama.status_sebelum_draft || "Draft";
    let catatanBatal = "";

    const isOwner = userId === krama.user_id;
    const aktorLabel = isOwner ? "Pengusul" : userRole;
    
    if (statusPulih === "Ditolak") {
      catatanBatal = `Usulan perbaikan data krama bali telah dibatalkan oleh ${aktorLabel}. Status penolakan sebelumnya dipulihkan kembali.`;
    } else if (statusPulih === "Disetujui") {
      catatanBatal = `Usulan perubahan data krama bali telah dibatalkan oleh ${aktorLabel}. Data krama bali aktif kembali menggunakan data yang lama.`;
    } else {
      catatanBatal = `Usulan perubahan data krama bali telah dihapus dari antrean oleh ${aktorLabel}.`;
    }

    await krama.update({
      is_pending_update: false,
      data_perubahan: null,
      status_verifikasi: statusPulih,
      status_sebelum_draft: null,
      catatan_admin_desa: catatanBatal
    }, { transaction: t });

    await Promise.all([
      kirimNotifikasiSistem(req, {
        judul: "Pembatalan Usulan Perubahan Krama Bali",
        deskripsi: catatanBatal,
        kategori: "LOG_SISTEM",
        tautan_fitur: "/verifikasi-data/krama-bali",
        desa_adat_id: krama.desa_adat_id || userDesaId, 
        sender_id: userId,
        kontak_pesan_id: null,
        user_id: null 
      }, t),

      ...(!isOwner && krama.user_id ? [
        kirimNotifikasiSistem(req, {
          judul: "Perubahan Krama Bali Dibatalkan Admin",
          deskripsi: `Usulan perubahan data krama bali Anda atas nama ${krama.nama_lengkap} telah dibatalkan dari antrean oleh Admin Desa.`,
          kategori: "PERINGATAN",
          tautan_fitur: "/krama-bali/my-data",
          desa_adat_id: null, 
          sender_id: userId,
          kontak_pesan_id: null,
          user_id: krama.user_id 
        }, t)
      ] : [])
    ]);

    await t.commit();

    if (fileFotoUsulanDihapusPascaCommit) {
      supabase.storage.from('photo-krama').remove([fileFotoUsulanDihapusPascaCommit]).catch(err => {
        console.error("Gagal menghapus file usulan foto yang dibatalkan:", err.message);
      });
    }

    const kramaTerbaru = await KramaBali.findByPk(id, {
      include: KRAMA_INCLUDE
    });

    return res.status(200).json({ 
      message: `Berhasil membatalkan usulan perubahan data krama bali. Status dialihkan kembali menjadi: ${statusPulih}.`,
      data: kramaTerbaru
    });
  } catch (error) {
    if (t) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error("Transaksi database sudah ditutup:", rollbackError.message);
      }
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kesalahan server saat membatalkan usulan perubahan data krama bali." 
    });
  }
};

export const deleteKramaById = async (req, res) => {
  let fileFotoAktifDihapusPascaCommit = null;
  let fileFotoUsulanDihapusPascaCommit = null;
  let t;

  try {
    const { id } = req.params;
    const userRole = req.role;
    const userId = req.userId;
    const userDesaId = req.desaAdatId;

    // Mulai transaksi database
    t = await db.transaction();

    const krama = await KramaBali.findByPk(id, { 
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!krama) {
      throw { 
        status: 404, 
        message: "Data krama bali tidak ditemukan." 
      };
    }

    // Identifikasi keterlibatan wilayah desa adat
    const desaAsalId = krama.desa_adat_id;
    const desaTujuanId = krama.is_pending_update && krama.data_perubahan?.desa_adat_id
      ? Number(krama.data_perubahan.desa_adat_id)
      : null;

    // VALIDASI HAK AKSES RUANG LINGKUP DATA
    if (userRole !== "Super Admin") {
      if (userId === krama.user_id) {
        if (krama.status_verifikasi === "Disetujui") {
          throw { 
            status: 403, 
            message: "Proses menghapus data dihentikan! Data krama bali ini sudah disetujui dan tidak dapat dihapus secara sepihak oleh pemilik data." 
          };
        }
      } else {
        if (userRole === "Admin Desa") {
          const isAsalMatch = Number(desaAsalId) === Number(userDesaId);
          const isTujuanMatch = desaTujuanId && Number(desaTujuanId) === Number(userDesaId);
          if (!isAsalMatch && !isTujuanMatch) {
            throw { 
              status: 403, 
              message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
            };
          }
        } else {
          throw { 
            status: 403, 
            message: "Otoritas mengakses data ditolak!" 
          };
        }
      }
    }

    // MELIHAT RELASI STRUKTURAL SILSILAH
    const [isOrangTua, isKawin, isKepalaKeluarga, relasiSilsilahAnak] = await Promise.all([
      // Case 1: Melihat statusnya sebagai orang tua
      RelasiKrama.findOne({
        where: { 
          [Op.or]: [{ ayah_id: id }, { ibu_id: id }],
          status_verifikasi: { [Op.ne]: "Ditolak" }
        },
        transaction: t
      }),
      // Case 2: Melihat status perkawinannya
      Perkawinan.findOne({
        where: { 
          [Op.or]: [{ suami_id: id }, { istri_id: id }],
          status_verifikasi: { [Op.ne]: "Ditolak" }
        },
        transaction: t
      }),
      // Case 3: Melihat statusnya sebagai kepala keluarga aktif
      Keluarga.findOne({
        where: { 
          kepala_keluarga_id: id, 
          status_keluarga: "Aktif" 
        },
        transaction: t
      }),
      // Case 4: Melihat relasi untuk kalibrasi urutan lahir
      RelasiKrama.findOne({
        where: { 
          anak_id: id, 
          status_verifikasi: "Disetujui" 
        },
        transaction: t
      })
    ]);
    
    if (isOrangTua) {
      throw { 
        status: 400, 
        message: "Proses menghapus data dihentikan! Krama masih tercatat sebagai orang tua dalam silsilah." 
      };
    }
    if (isKawin) {
      throw { 
        status: 400, 
        message: "Proses menghapus data dihentikan! Krama masih tercatat aktif dalam hubungan perkawinan." 
      };
    }
    if (isKepalaKeluarga) {
      throw { 
        status: 400, 
        message: "Proses menghapus data dihentikan! Krama masih tercatat aktif sebagai Kepala Keluarga." 
      };
    }

    if (krama.foto_profile) {
      fileFotoAktifDihapusPascaCommit = krama.foto_profile;
    }

    if (krama.data_perubahan?.foto_profile) {
      fileFotoUsulanDihapusPascaCommit = krama.data_perubahan.foto_profile;
    }

    const idAyahLama = relasiSilsilahAnak?.ayah_id || null;
    const idIbuLama = relasiSilsilahAnak?.ibu_id || null;

    // ============================================================
    // LOGIKA EKSEKUSI CASCADING INTERNAL DATA INTERNAL / APPROVAL
    // ============================================================
    await RelasiKrama.destroy({
      where: { anak_id: id },
      transaction: t
    });
    await RiwayatPeranAdat.destroy({ 
      where: { krama_id: id },
      transaction: t
    });
    await RiwayatKeluarga.destroy({ 
      where: { krama_id: id },
      transaction: t
    });

    await krama.destroy({ 
      transaction: t 
    });

    if (idAyahLama || idIbuLama) {
      await hitungUrutanLahir({
        mode: "CAMPUR",
        ayah_id: idAyahLama,
        ibu_id: idIbuLama
      }, t);
    }

    await kirimNotifikasiSistem(req, {
      judul: "Data Krama Bali Dihapus",
      deskripsi: `Data krama bali atas nama ${krama.nama_lengkap} (${krama.nomor_pendaftaran}) telah dihapus oleh ${userRole}.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: "/krama-bali",
      desa_adat_id: krama.desa_adat_id || userDesaId,
      sender_id: userId,
      kontak_pesan_id: null,
      user_id: krama.user_id || null
    }, t);
    
    await t.commit();

    const listFileFotoDihapus = [];

    if (fileFotoAktifDihapusPascaCommit) {
      listFileFotoDihapus.push(fileFotoAktifDihapusPascaCommit);
    }

    if (fileFotoUsulanDihapusPascaCommit) {
      listFileFotoDihapus.push(fileFotoUsulanDihapusPascaCommit);
    }

    if (listFileFotoDihapus.length > 0) {
      supabase.storage.from('photo-krama').remove(listFileFotoDihapus).catch(err => {
        console.error("Gagal membersihkan aset media krama yang dihapus permanen:", err.message);
      });
    }

    return res.status(200).json({
      message: "Data krama bali beserta riwayat struktural terkait berhasil dihapus dari sistem secara resmi!"
    });
  } catch (error) {
    if (t) {
      try {
        await t.rollback();
      } catch (rollbackError) {
        console.error("Transaksi database sudah ditutup:", rollbackError.message);
      }
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan server saat mencoba menghapus data krama bali."
    });
  }
};