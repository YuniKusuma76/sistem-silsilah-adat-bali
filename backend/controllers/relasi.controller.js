import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  KramaBali,
  User,
  DesaAdat,
  RiwayatPeranAdat,
  RiwayatKeluarga,
  Keluarga,
  Perkawinan
} from "../models/associations.js";
import { buatAnakAngkat } from "../services/anak-angkat.service.js";
import { buatAnakKandung } from "../services/anak-kandung.service.js";
import { anakAngkatPasangan } from "../services/anak-angkat-perkawinan.service.js";
import { integrasiRelasiLeluhur } from "../services/anak-relasi-leluhur.service.js";
import { prosesUpdateRelasiKrama } from "../services/update-relasi-krama.service.js";
import { prosesVerifikasiRelasiKrama } from "../services/verifikasi-relasi-krama.service.js";
import { kirimNotifikasiSistem } from "../helpers/notifikasi.helper.js";

const VALID_STATUS_HUBUNGAN = [
  "Anak Kandung", 
  "Anak Angkat"
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

const RELASI_INCLUDE = [
  {
    model: KramaBali,
    as: "anak",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
  },{
    model: User,
    as: "pembuat_relasi",
    attributes: ["id", "full_name", "email", "role"]
  },{
    model: KramaBali,
    as: "ayah",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
  },{
    model: KramaBali,
    as: "ibu",
    attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
  },{
    model: DesaAdat,
    as: "desa_tujuan",
    attributes: ["id", "nama_desa_adat"] 
  }
];

export const getAllRelasiKrama = async (req, res) => {
  try {
    const { mode, ayah_id, ibu_id, anak_id } = req.query;

    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    let whereCondition = {};
    
    // Logika filter relasi krama berdasarkan parameter silsilah
    if (ayah_id && ayah_id !== "undefined" && ayah_id !== "null") {
      whereCondition.ayah_id = ayah_id;
    }
    if (ibu_id && ibu_id !== "undefined" && ibu_id !== "null") {
      whereCondition.ibu_id = ibu_id;
    }
    if (anak_id && anak_id !== "undefined" && anak_id !== "null") {
      whereCondition.anak_id = anak_id;
    }

    let territorialCondition = null;

    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
    const isKrama = userRole === "Krama";

    // ============================================================
    // LOGIKA FILTERING BERDASARKAN MODE 
    // ============================================================
    
    // Kondisi 1: Mengambil data dengan status draft
    if (mode === "verification") {
      if (!isAdmin && !isKrama) {
        throw { 
          status: 403, 
          message: "Otoritas mengakses data ditolak!" 
        };
      }

      if (isAdmin) {
        if (anak_id && anak_id !== "undefined" && anak_id !== "null") {
          whereCondition.status_verifikasi = { 
            [Op.in]: ["Disetujui", "Draft", "Ditolak"] 
          };
        } else {
          whereCondition[Op.or] = [
            { status_verifikasi: "Draft" },
            { status_verifikasi: "Disetujui", is_pending_update: true },
            { status_verifikasi: "Ditolak", is_pending_update: true }
          ];
        }

        if (userRole === "Admin Desa") {
          territorialCondition = {
            [Op.or]: [
              { "$anak.desa_adat_id$": userDesaId },
              { desa_adat_id_tujuan: userDesaId }
            ]
          };
        }
      } else if (isKrama) {
        whereCondition.user_id = currentUserId; 
        whereCondition.status_verifikasi = { 
          [Op.in]: ["Draft", "Disetujui", "Ditolak"] 
        };
      }
    }
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (mode === "personal") {
      whereCondition.user_id = currentUserId;
      territorialCondition = null;
    }
    // Kondisi 3: Mengambil semua data orang lain yang telah disetujui
    else if (mode === "public") {
      whereCondition.status_verifikasi = "Disetujui";
      territorialCondition = null;
    } 
    // Default kondisi
    else {
      if (userRole === "Admin Desa") {
        territorialCondition = {
          [Op.or]: [
            { "$anak.desa_adat_id$": userDesaId },
            { "$ayah.desa_adat_id$": userDesaId },
            { "$ibu.desa_adat_id$": userDesaId }
          ]
        };
      }
    }

    let finalWhere = { ...whereCondition };

    if (territorialCondition) {
      finalWhere = { [Op.and]: [whereCondition, territorialCondition] };
    }

    const RELASI_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "anak",
        required: true,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: User,
        as: "pembuat_relasi",
        required: false,
        attributes: ["id", "full_name", "email", "role"]
      },{
        model: KramaBali,
        as: "ayah",
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: KramaBali,
        as: "ibu",
        required: false,
        attributes: ["id", "nomor_pendaftaran", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: DesaAdat,
        as: "desa_tujuan",
        required: false, 
        attributes: ["id", "nama_desa_adat"] 
      }
    ];

    let relasiList = await RelasiKrama.findAll({
      where: finalWhere,
      include: RELASI_INCLUDE_KHUSUS,
      order: [
        ["status_verifikasi", "ASC"],
        ["urutan_lahir", "ASC"],
        ["id", "ASC"]
      ]
    });

    if (mode === "public") {
      relasiList = relasiList.map(item => {
        const rawItem = typeof item.get === 'function' ? item.get({ plain: true }) : item;
        if (rawItem.is_pending_update) {
          rawItem.data_perubahan = null;
          rawItem.status_sebelum_draft = null;
        }
        return rawItem;
      });
    }
    
    return res.status(200).json({
      message: "Berhasil mengambil data relasi krama!",
      count: relasiList.length,
      data: relasiList
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat mengambil data relasi krama."
    });
  }
};

export const getRelasiKramaById = async (req, res) => {
  try {
    const { id } = req.params;

    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    if (!id || id === "undefined" || id === "null") {
      throw { 
        status: 400, 
        message: "ID Relasi Krama tidak valid." 
      };
    }

    const RELASI_INCLUDE_KHUSUS = [
      {
        model: KramaBali,
        as: "anak",
        required: true,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: User,
        as: "pembuat_relasi",
        required: false,
        attributes: ["id", "full_name", "email", "role"]
      },{
        model: KramaBali,
        as: "ayah",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: KramaBali,
        as: "ibu",
        required: false,
        attributes: ["id", "nama_lengkap", "jenis_kelamin", "status_hidup", "tipe_data", "desa_adat_id"]
      },{
        model: DesaAdat,
        as: "desa_tujuan",
        required: false, 
        attributes: ["id", "nama_desa_adat"] 
      }
    ];

    const dataRelasi = await RelasiKrama.findByPk(id, {
      include: RELASI_INCLUDE_KHUSUS
    });

    if (!dataRelasi) {
      throw { 
        status: 404, 
        message: "Data relasi krama tidak ditemukan." 
      };
    }

    const anakDesaId = dataRelasi.anak?.desa_adat_id;
    const ayahDesaId = dataRelasi.ayah?.desa_adat_id;
    const ibuDesaId = dataRelasi.ibu?.desa_adat_id;
    const desaTujuanId = dataRelasi.desa_adat_id_tujuan;
    const isLeluhurMode = dataRelasi.anak?.tipe_data === "Leluhur" || dataRelasi.ayah?.tipe_data === "Leluhur" || dataRelasi.ibu?.tipe_data === "Leluhur";

    // ============================================================
    // LOGIKA PROTEKSI HAK AKSES DATA 
    // ============================================================
    const isNotApproved = dataRelasi.status_verifikasi !== "Disetujui";
    const isOwner = dataRelasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    const isAdminDesaTerkait = userRole === "Admin Desa" && (
      (isLeluhurMode && dataRelasi.user_id === currentUserId) ||
      (!isLeluhurMode && ((anakDesaId && parseInt(anakDesaId) === parseInt(userDesaId)) ||
        (ayahDesaId && parseInt(ayahDesaId) === parseInt(userDesaId)) ||
        (ibuDesaId && parseInt(ibuDesaId) === parseInt(userDesaId)) ||
        (desaTujuanId && parseInt(desaTujuanId) === parseInt(userDesaId))
      ))
    );

    const isAdmin = isAdminDesaTerkait || isSuperAdmin;

    if (isNotApproved && !isOwner && !isAdmin) {
      throw { 
        status: 403, 
        message: "Otoritas mengakses data ditolak! Data relasi krama ini masih berada dalam proses peninjauan oleh Admin Desa Adat terkait." 
      };
    }

    const result = dataRelasi.toJSON();

    const isSatuDesa = !isLeluhurMode && (
      (anakDesaId && parseInt(anakDesaId) === parseInt(userDesaId)) || 
      (ayahDesaId && parseInt(ayahDesaId) === parseInt(userDesaId)) || 
      (ibuDesaId && parseInt(ibuDesaId) === parseInt(userDesaId)) ||
      (desaTujuanId && parseInt(desaTujuanId) === parseInt(userDesaId))
    );

    if (!isAdmin && !isOwner) {
      delete result.data_perubahan;
      delete result.status_sebelum_draft;
      delete result.approved_asal_by;
      delete result.approved_tujuan_by;
      delete result.user_id;

      if (!isSatuDesa) {
        const maskedRelasi = {
          id: result.id,
          anak_id: result.anak_id,
          ayah_id: result.ayah_id,
          ibu_id: result.ibu_id,
          status_hubungan: result.status_hubungan,
          tanggal_pengangkatan: result.tanggal_pengangkatan,
          status_verifikasi: result.status_verifikasi,
          urutan_lahir: result.urutan_lahir,
          garis_keturunan: result.garis_keturunan,
          catatan_admin_desa: "Data relasi krama telah diverifikasi dan disetujui secara resmi oleh Admin Desa.",
          anak: result.anak,
          ayah: result.ayah,
          ibu: result.ibu
        };

        return res.status(200).json({
          message: "Berhasil mengambil data relasi krama bali!",
          data: maskedRelasi
        });
      }
    }

    return res.status(200).json({
      message: "Berhasil mengambil detail data relasi krama!",
      data: result
    });
  } catch (error) {
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan internal server saat mengambil detail relasi krama."
    });
  }
};

export const createRelasiKrama = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    let {
      anak_id,
      ayah_id,
      ibu_id,
      status_hubungan,
      tanggal_pengangkatan,
      perkawinan_id,
      urutan_lahir
    } = req.body;

    const currentUserId = req.userId;
    const userRole = req.role;
    const adminDesaId = req.desaAdatId;

    if (anak_id === ayah_id || anak_id === ibu_id) {
      throw { 
        status: 400, 
        message: "Identitas anak tidak boleh sama dengan ayah atau ibu!" 
      };
    }

    if (ayah_id && ibu_id && ayah_id === ibu_id) {
      throw { 
        status: 400, 
        message: "Identitas ayah dan ibu tidak boleh sama!" 
      };
    }

    if (!VALID_STATUS_HUBUNGAN.includes(status_hubungan)) {
      throw { 
        status: 400, 
        message: "Status hubungan tidak valid!" 
      };
    }

    // Validasi ketersediaan data anak, ayah, dan ibu
    const [anak, ayah, ibu] = await Promise.all([
      KramaBali.findByPk(anak_id, { 
        transaction: t 
      }),
      ayah_id ? KramaBali.findByPk(ayah_id, { 
        transaction: t 
      }) : null,
      ibu_id ? KramaBali.findByPk(ibu_id, { 
        transaction: t 
      }) : null
    ]);

    if (!anak) {
      throw { 
        status: 404, 
        message: "Data anak tidak ditemukan." 
      };
    }

    // melihat hubungan perkawinan orang tua pengangkat
    if (status_hubungan === "Anak Angkat" && (!ayah_id || !ibu_id)) {
      const kramaOrangTuaId = ayah_id || ibu_id;

      const perkawinanAktif = await Perkawinan.findOne({
        where: {
          status_perkawinan: "Kawin",
          [Op.or]: [
            { suami_id: kramaOrangTuaId },
            { istri_id: kramaOrangTuaId }
          ]
        },
        transaction: t
      });

      if (perkawinanAktif) {
        ayah_id = perkawinanAktif.suami_id;
        ibu_id = perkawinanAktif.istri_id;
        perkawinan_id = perkawinanAktif.id;
      }
    }

    const desaTujuanId = ayah ? ayah.desa_adat_id : (ibu ? ibu.desa_adat_id : null);
    const desaAsalAnakId = anak.desa_adat_id || adminDesaId; 
    const isLintasDesa = desaTujuanId && desaAsalAnakId && parseInt(desaAsalAnakId) !== parseInt(desaTujuanId);

    const existingRelasi = await RelasiKrama.findOne({
      where: {
        anak_id,
        status_hubungan,
        status_verifikasi: { [Op.notIn]: ["Ditolak"] }
      },
      transaction: t
    });

    if (existingRelasi) {
      throw { 
        status: 400, 
        message: `Data relasi sebagai ${status_hubungan} untuk krama ini sudah terdaftar atau sedang dalam proses peninjauan.`
      };
    }

    // LOGIKA AUTO-APPROVAL RELASI KRAMA
    let statusVerifAwal = "Draft";
    let catatanAdminDesa = "Pengajuan data relasi krama baru berhasil disimpan! Menunggu verifikasi dari Admin Desa.";
    if (status_hubungan === "Anak Angkat" && !tanggal_pengangkatan) {
      catatanAdminDesa += " (tanggal riwayat akan disesuaikan dengan tanggal input sistem karena input tanggal pengangkatan kosong).";
    }

    let idApprovedAsal = null;
    let idApprovedTujuan = null;

    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";

    if (isAdmin) {
      if (userRole === "Super Admin") {
        statusVerifAwal = "Disetujui";
        idApprovedAsal = currentUserId;
        idApprovedTujuan = currentUserId;
        catatanAdminDesa = "Data relasi krama diverifikasi dan disetujui otomatis oleh sistem (Input by Super Admin).";
      } else if (isLintasDesa) {
        statusVerifAwal = "Draft"; 
        catatanAdminDesa = `Pendaftaran relasi krama lintas desa adat oleh Admin Desa diajukan sebagai draft. Menunggu koordinasi birokrasi antar desa adat.`;
      } else {
        statusVerifAwal = "Disetujui";
        idApprovedAsal = currentUserId;
        idApprovedTujuan = currentUserId;
        catatanAdminDesa = `Data relasi krama diverifikasi dan disetujui otomatis oleh sistem (Input by ${userRole}).`;
      }
    }

    let tglAngkatDateOnly = null;

    if (status_hubungan === "Anak Angkat" && tanggal_pengangkatan) {
      tglAngkatDateOnly = tanggal_pengangkatan.includes('T') 
        ? tanggal_pengangkatan.split('T')[0] 
        : tanggal_pengangkatan.split(' ')[0];
    }

    const commonParams = {
      user_id: currentUserId,
      status_verifikasi: statusVerifAwal,
      catatan_admin_desa: catatanAdminDesa,
      is_pending_update: false,
      desa_adat_id_tujuan: isLintasDesa ? desaTujuanId : null,
      approved_asal_by: idApprovedAsal,
      approved_tujuan_by: idApprovedTujuan
    };

    let relasiBaru;
    
    // ============================================================
    // LOGIKA EKSEKUSI DATA (BAYPASS SERVICE JIKA DRAFT)
    // ============================================================
    const isLeluhurMode = anak.tipe_data === "Leluhur" || ayah?.tipe_data === "Leluhur" || ibu?.tipe_data === "Leluhur";

    if (statusVerifAwal !== "Disetujui") {
      relasiBaru = await RelasiKrama.create({
        anak_id,
        ayah_id: ayah_id || null,
        ibu_id: ibu_id || null,
        status_hubungan,
        tanggal_pengangkatan: tglAngkatDateOnly,
        urutan_lahir: urutan_lahir || null,
        data_perubahan: null,
        status_sebelum_draft: null,
        ...commonParams
      }, { transaction: t });
    } else {
      if (isLeluhurMode) {
        relasiBaru = await integrasiRelasiLeluhur({
          anak_id,
          ayah_id,
          ibu_id,
          status_hubungan,
          urutan_lahir,
          tanggal_pengangkatan: tglAngkatDateOnly,
          ayah,
          ibu,
          anak,
          perkawinan_id,
          user_id: currentUserId,
          status_verifikasi: statusVerifAwal,
          catatan_admin_desa: catatanAdminDesa,
          is_verifikasi: false
        }, t);
      } else {
        const servicePayload = { 
          anak_id, 
          perkawinan_id, 
          ayah_id, 
          ibu_id, 
          status_hubungan, 
          tanggal_pengangkatan: tglAngkatDateOnly,
          is_verifikasi: false,
          ...commonParams 
        };

        if (status_hubungan === "Anak Kandung") {
          if (!perkawinan_id) {
            throw { 
              status: 400, 
              message: "Pencatatan anak kandung keturunan wajib menyertakan data perkawinan orang tua!"
            };
          }
          relasiBaru = await buatAnakKandung(servicePayload, t);
        } else if (status_hubungan === "Anak Angkat") {
          if (perkawinan_id) {
            relasiBaru = await anakAngkatPasangan(servicePayload, t);
          } else {
            relasiBaru = await buatAnakAngkat(servicePayload, t);
          }
        }
      }
    }

    const targetDesaId = adminDesaId || anak.desa_adat_id || desaTujuanId;

    await kirimNotifikasiSistem(req, {
      judul: statusVerifAwal === "Disetujui" ? "Pendaftaran Data Relasi Krama" : "Antrean Data Relasi Krama Baru",
      deskripsi: statusVerifAwal === "Disetujui" 
        ? `Data relasi krama dengan status hubungan sebagai ${status_hubungan.toLowerCase()} telah diverifikasi dan disetujui otomatis oleh sistem (Input by ${userRole}).`
        : `Adanya pengajuan data relasi krama baru dengan status hubungan sebagai ${status_hubungan.toLowerCase()} oleh ${userRole}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
      kategori: statusVerifAwal === "Disetujui" ? "LOG_SISTEM" : "VERIFIKASI",
      tautan_fitur: statusVerifAwal === "Disetujui" ? "/krama-bali" : "/verifikasi-data/relasi-krama",
      desa_adat_id: targetDesaId,
      sender_id: currentUserId,
      kontak_pesan_id: null,
      user_id: null
    }, t);

    await t.commit();

    return res.status(201).json({
      message: statusVerifAwal === "Disetujui" 
        ? "Data relasi krama baru berhasil disetujui dan aktif di bagan silsilah Adat Bali!"
        : "Data relasi krama baru berhasil diajukan! Menunggu proses verifikasi dari Admin Desa Bersangkutan.",
      data: relasiBaru
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat menyimpan data relasi krama."
    });
  }
};

export const updateRelasiKramaById = async (req, res) => {
  const { id } = req.params;

  const currentUserId = req.userId;
  const userRole = req.role;
  const adminDesaId = req.desaAdatId;

  const dataUpdate = req.body;

  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const relasi = await RelasiKrama.findByPk(id, { 
      transaction: t 
    });

    if (!relasi) {
      throw { 
        status: 404, 
        message: "Data relasi krama tidak ditemukan." 
      };
    }

    const anakIdAktif = relasi.anak_id;

    const targetAyahId = dataUpdate.hasOwnProperty('ayah_id') 
      ? dataUpdate.ayah_id 
      : relasi.ayah_id;

    const targetIbuId = dataUpdate.hasOwnProperty('ibu_id') 
      ? dataUpdate.ibu_id 
      : relasi.ibu_id;

    const targetStatusHubungan = dataUpdate.hasOwnProperty('status_hubungan') 
      ? dataUpdate.status_hubungan 
      : relasi.status_hubungan;

    const targetPerkawinanId = dataUpdate.perkawinan_id || relasi.data_perubahan?.perkawinan_id || null;

    if (dataUpdate.status_hubungan && !VALID_STATUS_HUBUNGAN.includes(targetStatusHubungan)) {
      throw { 
        status: 400, 
        message: "Status hubungan tidak valid!" 
      };
    }

    // Mengambil detail data anak, ayah, dan ibu
    const [anak, ayah, ibu] = await Promise.all([
      KramaBali.findByPk(anakIdAktif, { 
        transaction: t 
      }),
      targetAyahId ? KramaBali.findByPk(targetAyahId, { 
        transaction: t 
      }) : null,
      targetIbuId ? KramaBali.findByPk(targetIbuId, { 
        transaction: t 
      }) : null
    ]);

    if (!anak) {
      throw { 
        status: 404, 
        message: "Data anak tidak ditemukan." 
      };
    }

    const desaTujuanId = ayah ? ayah.desa_adat_id : (ibu ? ibu.desa_adat_id : null);
    const desaAsalAnakId = anak.desa_adat_id || adminDesaId;
    const isLintasDesa = desaTujuanId && desaAsalAnakId && parseInt(desaAsalAnakId) !== parseInt(desaTujuanId);
    const rawTanggalAngkat = dataUpdate.tanggal_pengangkatan || relasi.tanggal_pengangkatan;
    
    let tglAngkatDateOnly = null;

    if (targetStatusHubungan === "Anak Angkat" && rawTanggalAngkat) {
      tglAngkatDateOnly = rawTanggalAngkat.includes('T') 
        ? rawTanggalAngkat.split('T')[0] 
        : rawTanggalAngkat.split(' ')[0];
    }

    const tglAngkatTimestamp = tglAngkatDateOnly ? `${tglAngkatDateOnly}T00:00:00.000Z` : null;

    // =====================================================================
    // JALUR 1: UPDATE RELASI JALUR ROLE KRAMA
    // =====================================================================
    if (userRole !== "Super Admin" && userRole !== "Admin Desa") {
      const statusSaatIni = relasi.status_verifikasi;
      const statusBaru = statusSaatIni === "Disetujui" ? "Disetujui" : "Draft";

      const payloadPerubahanWarga = {
        ...dataUpdate,
        tanggal_pengangkatan: tglAngkatDateOnly,
        perkawinan_id: targetPerkawinanId
      };

      const cleanDataPerubahan = payloadPerubahanWarga.data_perubahan 
        ? payloadPerubahanWarga.data_perubahan 
        : payloadPerubahanWarga;

      await relasi.update({
        status_sebelum_draft: statusSaatIni,
        is_pending_update: true,
        data_perubahan: cleanDataPerubahan, 
        status_verifikasi: statusBaru,
        desa_adat_id_tujuan: dataUpdate.desa_adat_id_tujuan || cleanDataPerubahan.desa_adat_id_tujuan || null,
        catatan_admin_desa: "Draft perubahan data relasi krama berhasil disimpan. Menunggu verifikasi dari Admin Desa Bersangkutan."
      }, { transaction: t });

      await kirimNotifikasiSistem(req, {
        judul: "Usulan Perubahan Relasi Krama",
        deskripsi: `Adanya pengajuan usulan perubahan data relasi krama untuk anak atas nama ${anak?.nama_lengkap}. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
        kategori: "VERIFIKASI",
        tautan_fitur: "/verifikasi-data/relasi-krama",
        desa_adat_id: desaAsalAnakId,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t);

      await t.commit();

      return res.status(200).json({ 
        message: statusSaatIni === "Disetujui"
          ? "Usulan perubahan relasi krama berhasil diajukan! Data silsilah Adat Bali tetap aktif menggunakan data lama hingga disetujui oleh Admin Desa."
          : "Perbaikan data relasi krama berhasil diajukan! Menunggu verifikasi ulang oleh Admin Desa."
      });
    }

    // =====================================================================
    // JALUR 2: UPDATE RELASI JALUR ROLE SUPER ADMIN DAN ADMIN DESA
    // =====================================================================
    if (anakIdAktif === targetAyahId || anakIdAktif === targetIbuId) {
      throw { 
        status: 400, 
        message: "Identitas anak tidak boleh sama dengan ayah atau ibu baru!" 
      };
    }

    if (targetAyahId && targetIbuId && targetAyahId === targetIbuId) {
      throw { 
        status: 400, 
        message: "Identitas ayah dan ibu tidak boleh sama!" 
      };
    }

    let statusVerifTarget = "Disetujui";
    let catatanUpdate = `Data relasi krama telah diperbarui secara resmi oleh ${userRole}.`;
    let idApprovedAsal = relasi.approved_asal_by;
    let idApprovedTujuan = relasi.approved_tujuan_by;

    if (userRole === "Super Admin") {
      idApprovedAsal = currentUserId;
      idApprovedTujuan = currentUserId;
      catatanUpdate = "Data relasi krama diverifikasi dan diperbarui otomatis oleh sistem (Input by Super Admin).";
    } else if (isLintasDesa) {
      statusVerifTarget = "Draft";
      idApprovedAsal = null;
      idApprovedTujuan = null;
      catatanUpdate = `Perubahan relasi krama lintas desa adat oleh Admin Desa diajukan sebagai draft. Menunggu proses peninjauan dari birokrasi antar desa adat.`;
    } else {
      idApprovedAsal = currentUserId;
      idApprovedTujuan = currentUserId;
    }

    const commonParams = {
      user_id: currentUserId,
      status_verifikasi: statusVerifTarget,
      catatan_admin_desa: catatanUpdate,
      is_pending_update: false,
      desa_adat_id_tujuan: isLintasDesa ? desaTujuanId : null,
      approved_asal_by: idApprovedAsal,
      approved_tujuan_by: idApprovedTujuan
    };

    let relasiFinal = null;

    // EKSEKUSI PARSIAL DATA PRUBAHAN
    if (statusVerifTarget !== "Disetujui") {
      await relasi.update({
        is_pending_update: false,
        status_sebelum_draft: relasi.status_verifikasi,
        status_verifikasi: statusVerifTarget,
        desa_adat_id_tujuan: isLintasDesa ? desaTujuanId : null,
        catatan_admin_desa: catatanUpdate,
        approved_asal_by: idApprovedAsal,
        approved_tujuan_by: idApprovedTujuan,
        data_perubahan: {
          ...dataUpdate,
          tanggal_pengangkatan: tglAngkatDateOnly,
          perkawinan_id: targetPerkawinanId
        }
      }, { transaction: t });

      relasiFinal = relasi;
    } else {
      relasiFinal = await prosesUpdateRelasiKrama({
        relasi,
        dataUpdate,
        targetAyahId,
        targetIbuId,
        targetStatusHubungan,
        targetPerkawinanId,
        tglAngkatDateOnly,
        tglAngkatTimestamp,
        anak,
        ayah,
        ibu,
        commonParams
      }, t);
    }

    const targetDesaId = adminDesaId || desaAsalAnakId || desaTujuanId;
    
    await kirimNotifikasiSistem(req, {
      judul: statusVerifTarget === "Disetujui" ? "Perubahan Data Relasi Krama" : "Antrean Perubahan Relasi Lintas Desa Adat",
      deskripsi: statusVerifTarget === "Disetujui"
        ? `Perubahan data relasi krama dengan hubungan sebagai ${targetStatusHubungan.toLowerCase()} berhasil diverifikasi dan disetujui oleh ${userRole}.`
        : `Usulan perubahan data relasi krama lintas desa adat dengan hubungan sebagai ${targetStatusHubungan.toLowerCase()} masuk antrean draft peninjauan baru. Menunggu verifikasi dari Admin Desa Bersangkutan.`,
      kategori: statusVerifTarget === "Disetujui" ? "LOG_SISTEM" : "VERIFIKASI",
      tautan_fitur: statusVerifTarget === "Disetujui" ? "/krama-bali" : "/verifikasi-data/relasi-krama",
      desa_adat_id: targetDesaId,
      sender_id: currentUserId,
      kontak_pesan_id: null,
      user_id: null
    }, t);

    const finalRelasiId = statusVerifTarget === "Disetujui" 
      ? (relasiFinal?.id || relasiFinal?.relasi?.id || relasi.id) 
      : id;
    
    const updateRelasiFetch = await RelasiKrama.findByPk(finalRelasiId, {
      include: [
        { 
          model: KramaBali, 
          as: "anak", 
          attributes: ["id", "nama_lengkap", "desa_adat_id"] 
        },{ 
          model: KramaBali, 
          as: "ayah", 
          attributes: ["id", "nama_lengkap", "desa_adat_id"] 
        },{ 
          model: KramaBali, 
          as: "ibu", 
          attributes: ["id", "nama_lengkap", "desa_adat_id"] 
        },{ 
          model: DesaAdat, 
          as: "desa_tujuan", 
          attributes: ["id", "nama_desa_adat"] 
        }
      ],
      transaction: t
    });
    
    await t.commit();

    return res.status(200).json({ 
      message: statusVerifTarget === "Disetujui"
        ? "Data relasi krama berhasil diperbarui secara resmi dan aktif di silsilah Adat Bali!"
        : "Perubahan relasi lintas desa adat berhasil diajukan sebagai draft peninjauan birokrasi desa adat.",
      data: updateRelasiFetch 
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kegagalan server saat memproses pembaruan relasi krama."
    });
  }
};

export const verifikasiRelasiKrama = async (req, res) => {
  const { id } = req.params;

  const currentUserId = req.userId;
  const userRole = req.role;
  const userDesaId = req.desaAdatId;

  const { status_verifikasi, catatan_admin_desa } = req.body;
  
  const VALID_STATUS = ["Disetujui", "Ditolak"];
  if (!VALID_STATUS.includes(status_verifikasi)) {
    return res.status(400).json({ 
      message: "Status verifikasi tidak valid!" 
    });
  }

  // Mulai Transaksi Database
  const t = await db.transaction();

  try {
    const hasil = await prosesVerifikasiRelasiKrama({
      relasiId: id,
      statusVerifikasiInput: status_verifikasi,
      catatanAdminInput: catatan_admin_desa,
      currentUserId,
      userRole,
      userDesaId
    }, t);

    const { 
      nextStatusVerifikasi, 
      isLintasDesaAktif, 
      anakDesaId, 
      desaTujuanId, 
      relasiFinalId, 
      catatanFinal, 
      relasi 
    } = hasil;

    let deskripsiNotif = "";
    let judulNotif = "Verifikasi Data Relasi Krama";

    const kategoriNotif = nextStatusVerifikasi === "Disetujui" ? "LOG_SISTEM" : "VERIFIKASI";

    if (nextStatusVerifikasi === "Ditolak") {
      const namaDesaAsal = relasi.anak?.wilayah_adat?.nama_desa_adat || "Asal";
      const isAdminAsal = parseInt(userDesaId) === parseInt(anakDesaId);

      const operatorVerifikator = userRole === "Super Admin" 
        ? "Super Admin" 
        : `${userRole} Desa Adat ${isAdminAsal ? namaDesaAsal : "Tujuan"}`;
      
      judulNotif = !!relasi.is_pending_update 
        ? "Usulan Perubahan Relasi Krama Ditolak" 
        : "Pengajuan Relasi Krama Ditolak";

      deskripsiNotif = !!relasi.is_pending_update
        ? `Usulan perubahan data relasi krama untuk anak ${relasi.anak?.nama_lengkap} ditolak oleh ${operatorVerifikator}. Data silsilah Adat Bali tetap menggunakan data relasi krama yang lama.`
        : `Draft pengajuan data relasi krama baru untuk anak ${relasi.anak?.nama_lengkap} ditolak oleh ${operatorVerifikator}.`;
    } else {
      deskripsiNotif = nextStatusVerifikasi === "Disetujui"
        ? `Relasi krama dengan status hubungan sebagai ${relasi.status_hubungan} atas nama ${relasi.anak?.nama_lengkap} telah diverifikasi dan disetujui secara resmi dan aktif di dalam silsilah Adat Bali.`
        : `Update status persetujuan data relasi krama lintas desa adat: ${catatanFinal}`;
    }

    if (isLintasDesaAktif) {
      const setDesaUnik = new Set();

      if (anakDesaId) {
        setDesaUnik.add(parseInt(anakDesaId));
      }
      if (desaTujuanId) {
        setDesaUnik.add(parseInt(desaTujuanId));
      }

      for (const idDesa of setDesaUnik) {
        await kirimNotifikasiSistem(req, {
          judul: nextStatusVerifikasi === "Disetujui" ? "Relasi Lintas Desa Adat Aktif" : "Update Persetujuan Lintas Desa Adat",
          deskripsi: deskripsiNotif,
          kategori: kategoriNotif,
          tautan_fitur: "/krama-bali",
          desa_adat_id: idDesa,
          sender_id: currentUserId,
          kontak_pesan_id: null,
          user_id: null
        }, t);
      }
    } else {
      await kirimNotifikasiSistem(req, {
        judul: judulNotif,
        deskripsi: deskripsiNotif,
        kategori: kategoriNotif,
        tautan_fitur: "/krama-bali",
        desa_adat_id: userDesaId || anakDesaId,
        sender_id: currentUserId,
        kontak_pesan_id: null,
        user_id: null
      }, t);
    }

    let dataResponFinal = null;

    if (nextStatusVerifikasi === "Disetujui") {
      dataResponFinal = await RelasiKrama.findByPk(relasiFinalId, {
        include: [
          { 
            model: KramaBali, 
            as: "anak", 
            attributes: ["id", "nama_lengkap"] 
          },{ 
            model: KramaBali, 
            as: "ayah", 
            attributes: ["id", "nama_lengkap"] 
          },{ 
            model: KramaBali, 
            as: "ibu", 
            attributes: ["id", "nama_lengkap"] 
          }
        ],
        transaction: t
      });
    } else {
      dataResponFinal = await RelasiKrama.findByPk(id, { 
        transaction: t 
      });
    }

    await t.commit();

    return res.status(200).json({
      message: nextStatusVerifikasi === "Ditolak"
        ? "Proses verifikasi data relasi krama berhasil dengan status: Ditolak."
        : (nextStatusVerifikasi === "Disetujui"
            ? "Data relasi krama berhasil disetujui penuh! Bagan silsilah keluarga telah aktif dan diperbarui."
            : `Persetujuan relasi krama lintas desa adat berhasil disimpan. ${catatanFinal}`),
      data: dataResponFinal
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kegagalan server saat memproses verifikasi relasi krama."
    });
  }
};

export const cancelUpdateRelasiKrama = async (req, res) => {
  const { id } = req.params;

  const currentUserId = req.userId;
  const userRole = req.role;
  const userDesaId = req.desaAdatId;

  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const relasi = await RelasiKrama.findByPk(id, { 
      include: [
        {
          model: KramaBali,
          as: "anak",
          attributes: ["id", "nomor_pendaftaran", "desa_adat_id", "nama_lengkap"]
        }
      ],
      transaction: t 
    });

    if (!relasi) {
      throw { 
        status: 404, 
        message: "Data pengajuan relasi krama tidak ditemukan." 
      };
    }

    if (!relasi.is_pending_update || !relasi.data_perubahan) {
      throw { 
        status: 400, 
        message: "Proses membatalkan perubahan dihentikan! Tidak ada usulan draft perubahan data yang aktif pada data relasi krama ini." 
      };
    }

    let dataPerubahanRaw = relasi.data_perubahan;

    if (dataPerubahanRaw && dataPerubahanRaw.data_perubahan) {
      dataPerubahanRaw = dataPerubahanRaw.data_perubahan;
    }

    // VALIDASI HAK AKSES MANAJEMEN DATA RELASI
    const isOwner = relasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    const desaTujuanUsulanId = relasi.desa_adat_id_tujuan || dataPerubahanRaw?.desa_adat_id_tujuan;
    const isDesaMatch = userRole === "Admin Desa" && (parseInt(relasi.anak?.desa_adat_id) === parseInt(userDesaId) ||
      (desaTujuanUsulanId && parseInt(desaTujuanUsulanId) === parseInt(userDesaId))
    );

    if (!isOwner && !isDesaMatch && !isSuperAdmin) {
      throw { 
        status: 403, 
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak untuk membatalkan usulan perubahan data ini." 
      };
    }

    // =========================================================
    // LOGIKA PEMULIHAN STATUS & TERITORIAL FISIK
    // =========================================================
    const statusPulih = relasi.status_sebelum_draft || "Disetujui";
    let idApprovedAsalFinal = relasi.approved_asal_by;
    let idApprovedTujuanFinal = relasi.approved_tujuan_by;
    let catatanBaru = `Usulan perubahan data telah dibatalkan oleh ${userRole}.`;
    let nextDesaTujuanId = relasi.desa_adat_id_tujuan;

    if (statusPulih === "Ditolak") {
      catatanBaru = `Usulan perbaikan data telah dibatalkan oleh ${userRole}. Status penolakan sebelumnya dipulihkan.`;
      idApprovedAsalFinal = null;
      idApprovedTujuanFinal = null;
      nextDesaTujuanId = null;
    } else if (statusPulih === "Draft") {
      catatanBaru = `Usulan perubahan lintas desa adat dibatalkan oleh ${userRole}. Status data dipulihkan menjadi Draft kembali.`;
      idApprovedAsalFinal = null;
      idApprovedTujuanFinal = null;
    } else if (statusPulih === "Disetujui") {
      catatanBaru = `Usulan perubahan data telah dibatalkan oleh ${userRole}. Struktur silsilah keluarga Adat Bali tetap aktif menggunakan data sah yang lama.`;
      idApprovedAsalFinal = null;
      idApprovedTujuanFinal = null;
      nextDesaTujuanId = null; 
    }

    await relasi.update({
      status_verifikasi: statusPulih,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null,
      desa_adat_id_tujuan: nextDesaTujuanId,
      catatan_admin_desa: catatanBaru,
      approved_asal_by: idApprovedAsalFinal,
      approved_tujuan_by: idApprovedTujuanFinal
    }, { transaction: t });

    const targetDesaId = userDesaId || relasi.anak?.desa_adat_id;

    await kirimNotifikasiSistem(req, {
      judul: "Usulan Perubahan Relasi Dibatalkan",
      deskripsi: `Draft usulan perbaikan/perubahan relasi krama untuk anak atas nama ${relasi.anak?.nama_lengkap} telah dibatalkan oleh ${userRole}.`,
      kategori: "LOG_SISTEM",
      tautan_fitur: "/krama-bali",
      desa_adat_id: targetDesaId,
      sender_id: currentUserId,
      kontak_pesan_id: null,
      user_id: null
    }, t);

    await t.commit();

    return res.status(200).json({ 
      message: `Berhasil membatalkan usulan draft perubahan data. Status verifikasi dipulihkan menjadi: ${statusPulih}.` 
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({ 
      message: error.message || "Terjadi kesalahan pada server saat membatalkan draft perubahan relasi krama." 
    });
  }
};

export const deleteRelasiKramaById = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const relasiId = parseInt(req.params.id);

    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    
    if (isNaN(relasiId)) {
      throw { 
        status: 400, 
        message: "ID Relasi Krama tidak valid." 
      };
    }

    // Validasi ketersediaan data relasi krama
    const relasi = await RelasiKrama.findByPk(relasiId, {
      include: [
        { 
          model: KramaBali, 
          as: "anak", 
          attributes: ["id", "nomor_pendaftaran", "desa_adat_id", "nama_lengkap"] 
        }
      ],
      transaction: t
    });

    if (!relasi) {
      throw { 
        status: 404, 
        message: "Data pengajuan relasi krama tidak ditemukan." 
      };
    }
    
    if (relasi.status_verifikasi === "Disetujui") {
      throw {
        status: 400,
        message: "Proses menghapus data dihentikan! Data relasi krama ini telah diverifikasi dan disetujui."
      };
    }

    if (relasi.is_pending_update) {
      throw {
        status: 400,
        message: "Proses menghapus data dihentikan! Data relasi krama ini masih memiliki antrean draft perubahan data yang aktif. Batalkan usulan perubahan data terlebih dahulu."
      };
    }

    // OTORITAS HAK AKSES WILAYAH ADAT
    const anakDesaId = relasi.anak?.desa_adat_id;
    const desaTujuanId = relasi.desa_adat_id_tujuan;
    const isLintasDesa = desaTujuanId && anakDesaId && parseInt(anakDesaId) !== parseInt(desaTujuanId);
    const isOwner = relasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    let isDesaMatch = false;

    if (userRole === "Admin Desa") {
      if (isLintasDesa) {
        isDesaMatch = parseInt(anakDesaId) === parseInt(userDesaId) || parseInt(desaTujuanId) === parseInt(userDesaId);
      } else {
        isDesaMatch = anakDesaId && parseInt(anakDesaId) === parseInt(userDesaId);
      }
    }

    if (!isOwner && !isSuperAdmin && !isDesaMatch) {
      throw { 
        status: 403, 
        message: "Otoritas mengakses data ditolak! Anda tidak memiliki hak akses untuk menghapus pengajuan data relasi krama ini." 
      };
    }

    await relasi.destroy({ transaction: t });
    await t.commit();

    return res.status(200).json({
      message: `Data pengajuan relasi krama berstatus ${relasi.status_verifikasi.toLowerCase()} berhasil dihapus secara permanen dari antrean sistem.`
    });

  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    const statusCode = error.status || 500;
    return res.status(statusCode).json({
      message: error.message || "Terjadi kesalahan pada server saat menghapus data relasi krama."
    });
  }
};