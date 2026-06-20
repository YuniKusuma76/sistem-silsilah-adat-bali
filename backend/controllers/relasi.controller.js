import { Op } from "sequelize";
import db from "../config/db.config.js";
import {
  RelasiKrama,
  KramaBali,
  User,
  DesaAdat
} from "../models/associations.js";
import { buatAnakAngkat } from "../services/anak-angkat.service.js";
import { buatAnakKandung } from "../services/anak-kandung.service.js";
import { anakAngkatPasangan } from "../services/anak-angkat-perkawinan.service.js";
import { integrasiRelasiLeluhur } from "../services/relasi-leluhur.service.js";
import { eksekusiRollbackRelasi } from "../services/batal-relasi-krama.service.js";
import { hitungUrutanLahir } from "../services/urutan-lahir.service.js";

// Validasi Input Valid
const VALID_STATUS_HUBUNGAN = [
  "Anak Kandung", 
  "Anak Angkat"
];

const VALID_STATUS_VERIFIKASI = [
  "Draft",
  "Menunggu Pelepasan",
  "Menunggu Penerimaan",
  "Disetujui",
  "Ditolak"
];

// Data Relasi Include
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
    const {
      mode,
      ayah_id,
      ibu_id,
      anak_id
    } = req.query;

    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    let whereCondition = {};
    
    // Logika filter relasi berdasarkan parameter silsilah
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
        return res.status(403).json({ 
          message: "Otoritas mengakses data ditolak!" 
        });
      }

      whereCondition[Op.or] = [
        { status_verifikasi: "Draft" },
        { status_verifikasi: "Menunggu Penerimaan" },
        { status_verifikasi: "Menunggu Pelepasan" },
        { is_pending_update: true }
      ];

      if (isAdmin) {
        if (userRole === "Admin Desa") {
          if (anak_id) {
            const kramaAnak = await KramaBali.findByPk(anak_id);
            if (kramaAnak && String(kramaAnak.desa_adat_id) !== String(userDesaId)) {
              whereCondition.status_verifikasi = "Disetujui";
              delete whereCondition[Op.or]; 
              territorialCondition = null; 
            } else {
              whereCondition[Op.or] = [
                { status_verifikasi: "Disetujui" },
                { status_verifikasi: "Draft" },
                { status_verifikasi: "Menunggu Penerimaan" },
                { status_verifikasi: "Menunggu Pelepasan" },
                { is_pending_update: true }
              ];

              territorialCondition = {
                [Op.or]: [
                  { "$anak.desa_adat_id$": userDesaId },
                  { "$ayah.desa_adat_id$": userDesaId },
                  { "$ibu.desa_adat_id$": userDesaId },
                  { desa_adat_id_tujuan: userDesaId },
                  {
                    [Op.and]: [
                      { "$anak.tipe_data$": "Leluhur" },
                      { user_id: currentUserId }
                    ]
                  }
                ]
              };
            } 
          } else {
            territorialCondition = {
              [Op.or]: [
                { "$anak.desa_adat_id$": userDesaId },
                { "$ayah.desa_adat_id$": userDesaId },
                { "$ibu.desa_adat_id$": userDesaId },
                { desa_adat_id_tujuan: userDesaId }
              ]
            };
          }
        } else if (userRole === "Super Admin") {
          whereCondition[Op.or] = [
            { status_verifikasi: "Disetujui" },
            { status_verifikasi: "Draft" },
            { status_verifikasi: "Menunggu Penerimaan" },
            { status_verifikasi: "Menunggu Pelepasan" },
            { is_pending_update: true }
          ];
        }
      } else if (isKrama) {
        whereCondition.user_id = currentUserId; 
        delete whereCondition[Op.or];
        whereCondition.status_verifikasi = { [Op.in]: ["Draft", "Menunggu Penerimaan", "Menunggu Pelepasan", "Disetujui"] };
      }
    }
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (mode === "personal") {
      whereCondition.user_id = currentUserId;
      delete whereCondition[Op.or];
        whereCondition.status_verifikasi = { [Op.in]: ["Draft", "Menunggu Penerimaan", "Menunggu Pelepasan", "Disetujui"] };
    }
    // Kondisi 3: Mengambil semua data orang lain yang telah disetujui
    else if (mode === "public") {
      whereCondition.status_verifikasi = "Disetujui";
      territorialCondition = null;
    } else {
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

    // Menggabungkan filter jika diakses Admin Desa saat verifikasi
    let finalWhere = { ...whereCondition };

    if (territorialCondition) {
      finalWhere = {
        [Op.and]: [
          whereCondition,
          territorialCondition
        ]
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


    let relasiList = await RelasiKrama.findAll({
      where: finalWhere,
      include: RELASI_INCLUDE_KHUSUS,
      order: [
        ["status_verifikasi", "ASC"],
        ["urutan_lahir", "ASC"],
        ["id", "ASC"]
      ]
    });

    // Sanitisasi jika terdapat data perubahan
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
    console.error("Error pada getAllRelasiKrama:", error); 
    
    return res.status(500).json({
      message: "Terjadi kesalahan pada server",
      error: error.message 
    });
  }
};

export const getRelasiKramaById = async (req, res) => {
  try {
    const { id } = req.params;
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

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
      return res.status(404).json({
        message: "Data relasi krama tidak ditemukan."
      });
    }

    const anakDesaId = dataRelasi.anak?.desa_adat_id;
    const ayahDesaId = dataRelasi.ayah?.desa_adat_id;
    const ibuDesaId = dataRelasi.ibu?.desa_adat_id;
    const desaTujuanId = dataRelasi.desa_adat_id_tujuan;

    const isLeluhurMode = dataRelasi.anak?.tipe_data === "Leluhur" || 
      dataRelasi.ayah?.tipe_data === "Leluhur" || 
      dataRelasi.ibu?.tipe_data === "Leluhur";

    // ============================================================
    // LOGIKA PROTEKSI HAK AKSES DATA (SENSITIVITY CHECK)
    // ============================================================
    const isNotApproved = dataRelasi.status_verifikasi !== "Disetujui";
    const isOwner = dataRelasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    // Otoritas admin desa
    const isAdminDesaTerkait = userRole === "Admin Desa" && (
      (isLeluhurMode && dataRelasi.user_id === currentUserId) ||
      (!isLeluhurMode && (
        (anakDesaId && parseInt(anakDesaId) === parseInt(userDesaId)) ||
        (ayahDesaId && parseInt(ayahDesaId) === parseInt(userDesaId)) ||
        (ibuDesaId && parseInt(ibuDesaId) === parseInt(userDesaId)) ||
        (desaTujuanId && parseInt(desaTujuanId) === parseInt(userDesaId))
      ))
    );

    const isAdmin = isAdminDesaTerkait || isSuperAdmin;

    if (isNotApproved && !isOwner && !isAdmin) {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak! Data relasi ini masih dalam proses peninjauan birokrasi desa adat."
      });
    }

    // Validasi hak akses data perubahan agar tidak bocor ke publik
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
          status_verifikasi: result.status_verifikasi,
          urutan_lahir: result.urutan_lahir,
          garis_keturunan: result.garis_keturunan,
          catatan_admin_desa: "Data relasi krama telah disahkan oleh Admin Desa.",
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
    return res.status(500).json({
      message: error.message
    });
  }
};

export const createRelasiKrama = async (req, res) => {
  // Mulai transaksi database
  const t = await db.transaction();

  try {
    const {
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

    // Validasi untuk mencegah loop silsilah
    if (anak_id === ayah_id || anak_id === ibu_id) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Identitas anak tidak boleh sama dengan ayah atau ibu!" 
      });
    }

    if (ayah_id && ibu_id && ayah_id === ibu_id) {
      await t.rollback();
      return res.status(400).json({
        message: "Identitas ayah dan ibu tidak boleh sama!"
      });
    }

    // Validasi status hubungan
    if (!VALID_STATUS_HUBUNGAN.includes(status_hubungan)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Status hubungan tidak valid!" 
      });
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
      await t.rollback();
      return res.status(404).json({ 
        message: "Data anak tidak ditemukan." 
      });
    }

    // Logika auto-approval berdasarkan operator
    const desaTujuanId = ayah ? ayah.desa_adat_id : (ibu ? ibu.desa_adat_id : null);
    const isLintasDesa = desaTujuanId && parseInt(anak.desa_adat_id) !== parseInt(desaTujuanId);

    // Validasi duplikasi relasi krama aktif
    const existingRelasi = await RelasiKrama.findOne({
      where: {
        anak_id,
        status_hubungan,
        status_verifikasi: { [Op.notIn]: ["Ditolak"] }
      },
      transaction: t
    });

    if (existingRelasi) {
      await t.rollback();
      return res.status(400).json({ 
        message: `Relasi sebagai ${status_hubungan} sudah terdaftar atau sedang dalam proses peninjauan sistem.` 
      });
    }

    let statusVerifAwal = "Draft";
    let catatanAdminDesa = "Menunggu verifikasi dari Admin Desa.";
    let idApprovedAsal = null;
    let idApprovedTujuan = null;

    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";

    if (isAdmin) {
      if (userRole === "Super Admin") {
        statusVerifAwal = "Disetujui";
        idApprovedAsal = currentUserId;
        idApprovedTujuan = currentUserId;
        catatanAdminDesa = "Data diverifikasi otomatis oleh sistem (Input by Super Admin).";
      } else if (isLintasDesa) {
        statusVerifAwal = "Draft"; 
        catatanAdminDesa = `Pendaftaran relasi krama lintas desa oleh Admin Desa diajukan sebagai draft. Menunggu proses peninjauan birokrasi antar desa adat.`;
      } else {
        statusVerifAwal = "Disetujui";
        idApprovedAsal = currentUserId;
        idApprovedTujuan = currentUserId;
        catatanAdminDesa = `Data diverifikasi otomatis oleh sistem (Input by ${userRole}).`;
      }
    }

    const commonParams = {
      user_id: currentUserId,
      status_verifikasi: statusVerifAwal,
      catatan_admin_desa: catatanAdminDesa,
      is_pending_update: false,
      data_perubahan: null,
      desa_adat_id_tujuan: isLintasDesa ? desaTujuanId : null,
      approved_asal_by: idApprovedAsal,
      approved_tujuan_by: idApprovedTujuan
    };

    // Memasukkan data mentah ke JSONB jika belum disetujui otomatis
    if (statusVerifAwal !== "Disetujui") {
      commonParams.data_perubahan = {
        ayah_id: ayah_id || null,
        ibu_id: ibu_id || null,
        perkawinan_id: perkawinan_id || null,
        status_hubungan,
        tanggal_pengangkatan: status_hubungan === "Anak Angkat" ? tanggal_pengangkatan : null,
        urutan_lahir: urutan_lahir || null
      };
    } else {
      commonParams.data_perubahan = null;
    }

    let relasiBaru;
    
    // ============================================================
    // LOGIKA EKSEKUSI (BAYPASS SERVICE JIKA DRAFT)
    // ============================================================
    if (statusVerifAwal !== "Disetujui") {
      relasiBaru = await RelasiKrama.create({
        anak_id,
        ayah_id: ayah_id || null,
        ibu_id: ibu_id || null,
        status_hubungan,
        tanggal_pengangkatan: status_hubungan === "Anak Angkat" ? tanggal_pengangkatan : null,
        urutan_lahir: urutan_lahir || null,
        ...commonParams
      }, { 
        transaction: t 
      });
    } else {
      const isLeluhurMode = anak.tipe_data === "Leluhur" || ayah?.tipe_data === "Leluhur" || ibu?.tipe_data === "Leluhur";

      if (isLeluhurMode) {
        relasiBaru = await integrasiRelasiLeluhur({
          anak_id,
          ayah_id,
          ibu_id,
          status_hubungan,
          urutan_lahir,
          tanggal_pengangkatan,
          ayah,
          ibu,
          anak,
          ...commonParams
        }, t);
      } else {
        const servicePayload = { 
          anak_id, 
          perkawinan_id, 
          ayah_id, 
          ibu_id, 
          status_hubungan, 
          tanggal_pengangkatan, 
          ...commonParams 
        };

        // Case Keturunan 1: Logika service anak kandung
        if (status_hubungan === "Anak Kandung") {
          if (!perkawinan_id) {
            await t.rollback();
            return res.status(400).json({
              message: "Pencatatan anak kandung warga aktif wajib menyertakan data perkawinan orang tua!"
            });
          }
          relasiBaru = await buatAnakKandung(servicePayload, t);
        }
        // Case Keturunan 2: Logika service anak angkat
        else if (status_hubungan === "Anak Angkat") {
          // Kondisi 1: Diangkat oleh Pasangan Suami-Istri
          if (perkawinan_id) {
            relasiBaru = await anakAngkatPasangan(servicePayload, t);
          } 
          // Kondisi 2: Diangkat oleh Single Parent (Belum/Tidak Kawin)
          else {
            relasiBaru = await buatAnakAngkat(servicePayload, t);
          }
        }
      }
    }

    await t.commit();

    let responseMessage = "Data relasi silsilah krama berhasil diajukan! Menunggu proses verifikasi.";

    if (statusVerifAwal === "Disetujui") {
      responseMessage = "Data relasi silsilah krama berhasil diproses dan aktif di pohon silsilah keluarga!";
    } else if (statusVerifAwal === "Menunggu Penerimaan") {
      responseMessage = "Tahap Pelepasan disetujui! Menunggu konfirmasi penerimaan dari Admin Desa Tujuan/Calon Orang Tua Angkat.";
    } else if (statusVerifAwal === "Menunggu Pelepasan") {
      responseMessage = "Tahap Penerimaan disetujui! Menunggu konfirmasi pelepasan dari Admin Desa Asal Anak.";
    }

    return res.status(201).json({
      message: responseMessage,
      data: relasiBaru
    });
  } catch (error) {
    await t.rollback();
    return res.status(400).json({
      message: error.message
    });
  }
};

export const verifikasiRelasiKrama = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.userId;
  const userRole = req.role;
  const userDesaId = req.desaAdatId;

  const { 
    status_verifikasi, 
    catatan_admin_desa 
  } = req.body;
  
  // Validasi status verifikasi
  const VALID_STATUS = ["Disetujui", "Ditolak"];
  if (!VALID_STATUS.includes(status_verifikasi)) {
    return res.status(400).json({
      message: "Status verifikasi tidak valid!"
    });
  }

  // Mulai transaksi database
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(id, { 
      include: [
        { 
          model: KramaBali, 
          as: "anak", 
          attributes: ["id", "desa_adat_id"],
          include: [{ 
            model: DesaAdat, 
            as: "wilayah_adat", 
            attributes: ["nama_desa_adat"] 
          }]
        },
        { 
          model: KramaBali, 
          as: "ayah", 
          attributes: ["id", "desa_adat_id"],
          include: [{ 
            model: DesaAdat, 
            as: "wilayah_adat", 
            attributes: ["nama_desa_adat"] 
          }] 
        },
        { 
          model: KramaBali, 
          as: "ibu", 
          attributes: ["id", "desa_adat_id"],
          include: [{ 
            model: DesaAdat, 
            as: "wilayah_adat", 
            attributes: ["nama_desa_adat"] 
          }] 
        }
      ],
      transaction: t
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data relasi krama tidak ditemukan." 
      });
    }

    const statusSaatIni = relasi.status_verifikasi;

    // Validasi ketika status sudah final
    if (statusSaatIni === "Disetujui" && !relasi.is_pending_update) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Proses verifikasi dihentikan! Relasi ini sudah disetujui secara permanen." 
      });
    }
    if (statusSaatIni === "Ditolak") {
      await t.rollback();
      return res.status(400).json({ 
        message: "Proses verifikasi dihentikan! Relasi ini sudah berstatus ditolak." 
      });
    }
    
    let dataPerubahanRaw = relasi.data_perubahan;
    if (dataPerubahanRaw && dataPerubahanRaw.data_perubahan) {
      dataPerubahanRaw = dataPerubahanRaw.data_perubahan;
    }

    // IDENTIFIKASI WILAYAH ADAT
    const anakDesaId = relasi.anak?.desa_adat_id;
    const desaTujuanId = relasi.desa_adat_id_tujuan || dataPerubahanRaw?.desa_adat_id_tujuan;

    const isLintasDesa = desaTujuanId && parseInt(anakDesaId) !== parseInt(desaTujuanId);
    const isAdminAsal = parseInt(userDesaId) === parseInt(anakDesaId);
    const isAdminTujuan = desaTujuanId && parseInt(userDesaId) === parseInt(desaTujuanId);

    if (userRole === "Admin Desa") {
      if (isLintasDesa) {
        // Tahap 1: Approval desa adat asal anak
        if (statusSaatIni === "Draft" && !isAdminAsal) {
          await t.rollback();
          return res.status(403).json({ 
            message: "Otoritas mengaksed data ditolak! Tahap pelepasan relasi krama lintas desa adat wajib disetujui oleh Admin Desa Asal Anak terlebih dahulu." 
          });
        }
        // Tahap 2: Approval desa adat tujuan/ calon orang tua angkat
        if (statusSaatIni === "Menunggu Penerimaan" && !isAdminTujuan) {
          await t.rollback();
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Tahap penerimaan anak angkat lintas desa adat wajib diverifikasi oleh Admin Desa Tujuan/Calon Orang Tua Angkat." 
          });
        }
        // Tahapan Terbalik dari Menunggu Pelepasan
        if (statusSaatIni === "Menunggu Pelepasan" && !isAdminAsal) {
          await t.rollback();
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Data memerlukan persetujuan pelepasan resmi dari Admin Desa Asal Anak." 
          });
        }
      } else {
        if (parseInt(anakDesaId) !== parseInt(userDesaId)) {
          await t.rollback();
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          });
        }
      }
    }

    // ============================================================
    // CASE 1: PROSES VERIFIKASI DITOLAK
    // ============================================================
    if (status_verifikasi === "Ditolak") {
      if (!catatan_admin_desa) {
        await t.rollback();
        return res.status(400).json({
          message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
        });
      }

      const statusFinalTolak = relasi.is_pending_update ? relasi.status_sebelum_draft : "Ditolak";
      const namaDesaAsal = relasi.anak?.wilayah_adat?.nama_desa_adat || "Asal";
      const operatorVerifikator = userRole === "Super Admin" 
        ? "Super Admin" 
        : `${userRole} Desa Adat ${isAdminAsal ? namaDesaAsal : "Tujuan"}`;

      await relasi.update({
        status_verifikasi: statusFinalTolak,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null,
        desa_adat_id_tujuan: null,
        catatan_admin_desa: `Data relasi telah ditolak oleh ${operatorVerifikator}. Catatan/Alasan Penolakan: ${catatan_admin_desa}.`,
      }, { 
        transaction: t 
      });

      await t.commit();
      return res.status(200).json({ 
        message: `Pangajuan relasi krama ditolak oleh ${userRole}.` 
      });
    }

    // ============================================================
    // CASE 2: VERIFIKASI DISETUJUI
    // ============================================================
    let nextStatusVerifikasi = "Disetujui"; 
    let idApprovedAsal = relasi.approved_asal_by;
    let idApprovedTujuan = relasi.approved_tujuan_by;
    let catatanFinal = catatan_admin_desa || `Pangajuan relasi krama disetujui oleh ${userRole}.`;

    if (userRole === "Super Admin") {
      nextStatusVerifikasi = "Disetujui";
      idApprovedAsal = currentUserId;
      idApprovedTujuan = currentUserId;
    } else if (isLintasDesa) {
      // Kondisi 1: Admin Desa Asal telah setuju melepas silsilah anak
      if (statusSaatIni === "Draft") {
        nextStatusVerifikasi = "Menunggu Penerimaan";
        idApprovedAsal = currentUserId;
        catatanFinal = catatan_admin_desa || `Pelepasan silsilah anak telah disetujui oleh Admin Desa Asal. Data diteruskan, menunggu konfirmasi penerimaan dari Admin Desa Tujuan/Admin Desa Orang Tua Angkat.`;
      } 
      // Kondisi 2: Admin Desa Tujuan telah setuju menerima silsilah anak
      else if (statusSaatIni === "Menunggu Penerimaan") {
        nextStatusVerifikasi = "Disetujui"; 
        idApprovedTujuan = currentUserId;
        catatanFinal = catatan_admin_desa || `Penerimaan silsilah anak telah disetujui oleh Admin Desa Tujuan/Admin Desa Orang Tua Angkat. Data silsilah mengangkat anak lintas desa adat dinyatakan sah & aktif.`;
      } 
      // Kondisi 3: Tahapn sebaliknya
      else if (statusSaatIni === "Menunggu Pelepasan") {
        nextStatusVerifikasi = "Disetujui";
        idApprovedAsal = currentUserId;
        catatanFinal = catatan_admin_desa || `Pelepasan silsilah anak telah disetujui oleh Admin Desa Asal. Data silsilah mengangkat anak lintas desa adat dinyatakan sah & aktif.`;
      } 
    } else {
      nextStatusVerifikasi = "Disetujui";
      idApprovedAsal = currentUserId;
      idApprovedTujuan = currentUserId;
    }

    let payloadUpdateKrama = {
      status_verifikasi: nextStatusVerifikasi,
      catatan_admin_desa: catatanFinal,
      approved_asal_by: idApprovedAsal,
      approved_tujuan_by: idApprovedTujuan
    };

    // Menentukan manajemen staging buffer JSONB
    if (nextStatusVerifikasi !== "Disetujui") {
      payloadUpdateKrama.is_pending_update = relasi.is_pending_update;
      await relasi.update(payloadUpdateKrama, { 
        transaction: t 
      });
    } else {
      payloadUpdateKrama.is_pending_update = false;
      payloadUpdateKrama.data_perubahan = null;
      payloadUpdateKrama.status_sebelum_draft = null;
      payloadUpdateKrama.desa_adat_id_tujuan = null;
      
      let dataGabunganFinal = { ...relasi.get() };
      if (relasi.is_pending_update && dataPerubahanRaw) {
        dataGabunganFinal = { 
          ...dataGabunganFinal, 
          ...dataPerubahanRaw 
        };
        payloadUpdateKrama = { 
          ...payloadUpdateKrama, 
          ...dataPerubahanRaw 
        };
      }

      await eksekusiRollbackRelasi(relasi, t);
      await relasi.update(payloadUpdateKrama, { 
        transaction: t 
      });

      const targetStatusHubungan = dataGabunganFinal.status_hubungan;
      const targetPerkawinanId = dataGabunganFinal.perkawinan_id;

      const serviceParam = { 
        ...dataGabunganFinal, 
        user_id: currentUserId, 
        status_verifikasi: "Disetujui",
        is_verifikasi: true 
      };

      if (targetStatusHubungan === "Anak Kandung") {
        if (!targetPerkawinanId) {
          await t.rollback();
          return res.status(400).json({ 
            message: "Pencatatan anak kandung warga aktif wajib menyertakan data perkawinan orang tua!" 
          });
        }
        await buatAnakKandung(serviceParam, t);
      } else if (targetStatusHubungan === "Anak Angkat") {
        if (targetPerkawinanId) {
          await anakAngkatPasangan(serviceParam, t);
        } else {
          await buatAnakAngkat(serviceParam, t);
        }
      }
    }

    await t.commit();

    const updatedData = await RelasiKrama.findByPk(id, { 
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
        }
      ]
    });

    let responseMessage = `Berkas relasi berhasil diverifikasi. Status saat ini: ${nextStatusVerifikasi}.`;
    if (nextStatusVerifikasi === "Disetujui") {
      responseMessage = "Data silsilah krama berhasil disetujui! Bagan pohon silsilah keluarga telah diperbarui.";
    }

    return res.status(200).json({
      message: responseMessage,
      data: updatedData
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(400).json({ 
      message: error.message 
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
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(id, { 
      transaction: t 
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data relasi krama tidak ditemukan." 
      });
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

    // Mengambil detail data krama bali untuk melihat wilayah adat
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
      await t.rollback();
      return res.status(404).json({ 
        message: "Data anak tidak ditemukan." 
      });
    }

    const desaTujuanId = ayah ? ayah.desa_adat_id : (ibu ? ibu.desa_adat_id : null);
    const isLintasDesa = desaTujuanId && parseInt(anak.desa_adat_id) !== parseInt(desaTujuanId);

    // =====================================================================
    // UPDATE RELASI JALUR ROLE KRAMA
    // =====================================================================
    if (userRole !== "Super Admin" && userRole !== "Admin Desa") {
      const statusSaatIni = relasi.status_verifikasi;
      const statusBaru = statusSaatIni === "Disetujui" ? "Disetujui" : "Draft";

      const payloadPerubahanWarga = {
        ...dataUpdate,
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
        desa_adat_id_tujuan: dataUpdate.desa_adat_id_tujuan || cleanDataPerubahan.desa_adat_id_tujuan,
        catatan_admin_desa: "Adanya usulan perubahan data relasi krama oleh pengguna! Menunggu verifikasi dari Admin Desa."
      }, { 
        transaction: t 
      });

      await t.commit();
      return res.status(200).json({ 
        message: statusSaatIni === "Disetujui"
          ? "Usulan perubahan berhasil diajukan! Data silsilah aktif tetap menggunakan data lama hingga disetujui oleh Admin Desa."
          : "Perbaikan data berhasil diajukan! Menunggu verifikasi ulang oleh Admin Desa."
      });
    }

    // =====================================================================
    // UPDATE RELASI JALUR ROLE SUPER ADMIN DAN ADMIN DESA
    // =====================================================================
    if (anakIdAktif === targetAyahId || anakIdAktif === targetIbuId) {
      await t.rollback();
      return res.status(400).json({
        message: "Identitas anak tidak boleh sama dengan ayah atau ibu baru!"
      });
    }

    if (targetAyahId && targetIbuId && targetAyahId === targetIbuId) {
      await t.rollback();
      return res.status(400).json({
        message: "Identitas ayah dan ibu tidak boleh sama!"
      });
    }

    let statusVerifTarget = "Disetujui";
    let catatanUpdate = `Data relasi krama diperbarui secara resmi oleh ${userRole}.`;
    let idApprovedAsal = relasi.approved_asal_by;
    let idApprovedTujuan = relasi.approved_tujuan_by;

    if (userRole === "Super Admin") {
      statusVerifTarget = "Disetujui";
      idApprovedAsal = currentUserId;
      idApprovedTujuan = currentUserId;
      catatanUpdate = "Data relasi krama diperbarui dan diverifikasi otomatis (Input by Super Admin).";
    } else if (isLintasDesa) {
      statusVerifTarget = "Draft";
      idApprovedAsal = null;
      idApprovedTujuan = null;
      catatanUpdate = `Perubahan relasi krama lintas desa oleh Admin Desa diajukkan sebagai draft usulan baru. Menunggu proses peninjauan birokrasi desa adat.`;
    } else {
      statusVerifTarget = "Disetujui";
      idApprovedAsal = currentUserId;
      idApprovedTujuan = currentUserId;
      catatanUpdate = `Data relasi krama diperbarui secara resmi oleh ${userRole}.`;
    }

    let relasiBaru;

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
          perkawinan_id: targetPerkawinanId
        }
      }, { 
        transaction: t 
      });
    } else {
      await eksekusiRollbackRelasi(relasi, t);
      await relasi.destroy({ transaction: t });

      const servicePayload = { 
        anak_id: anakIdAktif,
        ayah_id: targetAyahId,
        ibu_id: targetIbuId,
        status_hubungan: targetStatusHubungan,
        tanggal_pengangkatan: dataUpdate.tanggal_pengangkatan || relasi.tanggal_pengangkatan,
        urutan_lahir: dataUpdate.urutan_lahir || null,
        perkawinan_id: targetPerkawinanId,
        user_id: currentUserId,
        status_verifikasi: "Disetujui",
        catatan_admin_desa: catatanUpdate,
        is_pending_update: false,
        data_perubahan: null,
        desa_adat_id_tujuan: null,
        approved_asal_by: idApprovedAsal,
        approved_tujuan_by: idApprovedTujuan
      };

      // Memanggil service sesuai dengan status hubungan yang baru
      if (targetStatusHubungan === "Anak Kandung") {
        if (!targetPerkawinanId) {
          await t.rollback();
          return res.status(400).json({
            message: "Pencatatan anak kandung warga aktif wajib menyertakan data perkawinan orang tua!"
          });
        }
        relasiBaru = await buatAnakKandung(servicePayload, t);
      } else if (targetStatusHubungan === "Anak Angkat") {
        if (targetPerkawinanId) {
          relasiBaru = await anakAngkatPasangan(servicePayload, t);
        } else {
          relasiBaru = await buatAnakAngkat(servicePayload, t);
        }
      }
    }

    await t.commit();

    const finalRelasiId = statusVerifTarget === "Disetujui" 
      ? (relasiBaru?.id || relasiBaru?.relasi?.id) 
      : id;

    const updateRelasi = await RelasiKrama.findByPk(finalRelasiId, {
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
        }, { 
          model: DesaAdat, 
          as: "desa_tujuan", 
          attributes: ["id", "nama_desa_adat"] 
        }
      ]
    });

    let responseMessage = "Data relasi krama berhasil diperbarui secara resmi!";
    if (statusVerifTarget === "Draft") {
      responseMessage = "Perubahan relasi lintas desa berhasil diajukan sebagai draft peninjauan birokrasi adat.";
    }

    return res.status(200).json({ 
      message: responseMessage,
      data: updateRelasi 
    });
  } catch (error) {
    await t.rollback();
    return res.status(400).json({ 
      message: error.message 
    });
  }
};

export const cancelUpdateRelasi = async (req, res) => {
  const { id } = req.params;
  const currentUserId = req.userId;
  const userRole = req.role;
  const userDesaId = req.desaAdatId;

  // Mulai transaksi database
  const t = await db.transaction();

  try {
    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(id, { 
      include: [
        {
          model: KramaBali,
          as: "anak",
          attributes: ["id", "desa_adat_id"],
          include: [{ 
            model: DesaAdat, 
            as: "wilayah_adat", 
            attributes: ["nama_desa_adat"] 
          }]
        }
      ],
      transaction: t 
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({ 
        message: "Data pengajuan relasi krama tidak ditemukan." 
      });
    }

    // VALIDASI HAK AKSES MANAJEMEN DATA RELASI
    const isOwner = relasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    const isDesaMatch = userRole === "Admin Desa" && (
      parseInt(relasi.anak?.desa_adat_id) === parseInt(userDesaId) ||
      (relasi.desa_adat_id_tujuan && parseInt(relasi.desa_adat_id_tujuan) === parseInt(userDesaId))
    );

    if (!isOwner && !isDesaMatch && !isSuperAdmin) {
      await t.rollback();
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }

    // Validasi adanya draft perubahan yang aktif
    if (!relasi.is_pending_update) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Tidak ada usulan perubahan data yang aktif atau sedang ditinjau pada data ini." 
      });
    }

    // =========================================================
    // LOGIKA PEMULIHAN STATUS & TERITORIAL FISIK
    // =========================================================
    const statusPulih = relasi.status_sebelum_draft || "Draft";
    let idApprovedAsalFinal = relasi.approved_asal_by;
    let idApprovedTujuanFinal = relasi.approved_tujuan_by;
    let catatanBaru = `Usulan perubahan data telah dibatalkan oleh ${userRole}.`;

    let nextDesaTujuanId = relasi.desa_adat_id_tujuan;

    if (statusPulih === "Ditolak") {
      catatanBaru = "Usulan perbaikan data telah dibatalkan! Status penolakan sebelumnya dipulihkan.";
      idApprovedAsalFinal = null;
      idApprovedTujuanFinal = null;
      nextDesaTujuanId = null;
    } else if (statusPulih === "Draft") {
      catatanBaru = "Usulan perubahan data telah dibatalkan! Status dipulihkan menjadi draft kembali.";
      idApprovedAsalFinal = null;
      idApprovedTujuanFinal = null;
      nextDesaTujuanId = null;
    } else if (statusPulih === "Disetujui") {
      catatanBaru = "Usulan perubahan data telah dibatalkan! Struktur silsilah keluarga aktif tetap menggunakan data sah yang lama.";
      nextDesaTujuanId = null;
    } else if (statusPulih === "Menunggu Penerimaan") {
      catatanBaru = "Usulan perubahan data telah dibatalkan! Status dipulihkan ke antrean peninjauan Desa Adat Tujuan/Calon Orang Tua Angkat.";
    } else if (statusPulih === "Menunggu Pelepasan") {
      catatanBaru = "Usulan perubahan data telah dibatalkan! Status dipulihkan ke antrean peninjauan Desa Adat Asal Anak.";
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
    }, { 
      transaction: t 
    });

    await t.commit();

    return res.status(200).json({ 
      message: `Berhasil membatalkan usulan perubahan data. Status verifikasi dipulihkan menjadi: ${statusPulih}.` 
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(500).json({ 
      message: error.message 
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
    
    // Validasi format ID Relasi Krama
    if (isNaN(relasiId)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "ID Relasi tidak valid." 
      });
    }

    // Validasi ketersediaan data relasi
    const relasi = await RelasiKrama.findByPk(relasiId, {
      include: [
        { 
          model: KramaBali, 
          as: "anak", 
          attributes: ["id", "desa_adat_id"] 
        }
      ],
      transaction: t
    });

    if (!relasi) {
      await t.rollback();
      return res.status(404).json({
        message: "Data relasi krama tidak ditemukan."
      });
    }

    // Validasi status verifikasi data yang tidak boleh dihapus
    if (relasi.status_verifikasi === "Disetujui") {
      await t.rollback();
      return res.status(400).json({
        message: "Proses menghapus data dihentikan! Data relasi silsilah ini telah disetujui secara resmi dan aktif di pohon silsilah keluarga."
      });
    }

    const anakDesaId = relasi.anak?.desa_adat_id;
    const desaTujuanId = relasi.desa_adat_id_tujuan;
    const isLintasDesa = desaTujuanId && parseInt(anakDesaId) !== parseInt(desaTujuanId);

    // Validasi hak akses edit ruang lingkup data
    const isOwner = relasi.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    if (userRole === "Admin Desa") {
      if (isLintasDesa) {
        const isAsalMatch = parseInt(anakDesaId) === parseInt(userDesaId);
        const isTujuanMatch = parseInt(desaTujuanId) === parseInt(userDesaId);

        if (!isAsalMatch && !isTujuanMatch) {
          await t.rollback();
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
          });
        }
      } else {
        if (String(anakDesaId) !== String(userDesaId)) {
          await t.rollback();
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
          });
        }
      }
    } else if (!isOwner && !isSuperAdmin) {
      await t.rollback();
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak!"
      });
    }

    await relasi.destroy({ transaction: t });
    await t.commit();

    return res.status(200).json({
      message: "Data draft pengajuan relasi silsilah krama berhasil dihapus secara permanen dari antrean sistem."
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    return res.status(400).json({
      message: error.message
    });
  }
};