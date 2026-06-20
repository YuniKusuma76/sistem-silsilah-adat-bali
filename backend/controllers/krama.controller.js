import { Op } from "sequelize";
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

// Validasi Input Valid
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

// Data Krama Include
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

    let filterCondition = {
      status_verifikasi: "Disetujui"
    };

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
    
    const leluhurList = await KramaBali.scope('leluhurOnly').findAll({
      where: filterCondition,
      include: ["wilayah_adat"],
      order: [["id", "ASC"]]
    });

    let message = "Berhasil mengambil data seluruh leluhur secara global.";
    
    if (desa_adat_id && leluhurList.length > 0) {
      const kramaDenganDesa = leluhurList.find(k => k.wilayah_adat !== null);
      const namaDesa = kramaDenganDesa?.wilayah_adat?.nama_desa_adat || desa_adat_id;
      message = `Berhasil mengambil data leluhur untuk wilayah desa adat ${namaDesa}.`;
    }

    res.status(200).json({
      message: message,
      count: leluhurList.length,
      data: leluhurList
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
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
      return res.status(404).json({
        message: "Data leluhur tidak ditemukan."
      });
    }

    // Konversi ke plain object agar manipulasi data aman dan bersih
    const dataLeluhur = dataLeluhurRaw.toJSON();

    // Memastikan data staging usulan perubahan data leluhur tidak ikut terlihat ke publik
    delete dataLeluhur.data_perubahan;
    delete dataLeluhur.status_sebelum_draft;

    const namaDesa = dataLeluhur.wilayah_adat?.nama_desa_adat || "Global";

    res.status(200).json({
      message: `Berhasil mengambil detail leluhur: ${dataLeluhur.nama_lengkap} (${namaDesa})`,
      data: dataLeluhur
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const getAllKrama = async (req, res) => {
  try {
    const { mode, tipe } = req.query;

    const userRole = req.role;
    const currentUserId = req.userId;
    const userDesaId = req.desaAdatId;

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
        return res.status(403).json({ 
          message: "Otoritas mengakses data ditolak!" 
        });
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
            }
          ]
        };
      }
    }

    // Filter berdasarkan tipe data Leluhur/Krama, jika ada
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
      // Konversi ke plain object agar manipulasi properti bersih
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

    res.status(200).json({
      message: "Berhasil mengambil data krama bali!",
      count: kramaList.length,
      data: kramaList
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
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
      return res.status(404).json({
        message: "Data krama bali tidak ditemukan."
      });
    }

    // Validasi hak akses ruang lingkup data
    const isDraft = dataKramaRaw.status_verifikasi === "Draft" || dataKramaRaw.status_verifikasi === "Ditolak";
    const isPending = dataKramaRaw.is_pending_update === true;
    const isOwner = dataKramaRaw.user_id === currentUserId;
    const isSuperAdmin = userRole === "Super Admin";

    // Menentukan desa yang berwenang
    const desaOtoritasId = (isPending && dataKramaRaw.data_perubahan?.desa_adat_id)
      ? parseInt(dataKramaRaw.data_perubahan.desa_adat_id)
      : parseInt(dataKramaRaw.desa_adat_id);

    const isAdminDesaBerwenang = userRole === "Admin Desa" && desaOtoritasId === parseInt(userDesaId);
    
    if (isDraft && !isOwner && !isAdminDesaBerwenang && !isSuperAdmin) {
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak! Data ini masih dalam proses verifikasi awal."
      });
    }

    // Konversi ke plain object agar manipulasi properti aman dan bersih
    const dataKrama = dataKramaRaw.toJSON();

    // Logika filter privasi (post-processing)
    const isSatuDesa = desaOtoritasId === parseInt(userDesaId);
    const isAdmin = isAdminDesaBerwenang || isSuperAdmin;

    if (!isOwner && !isAdmin) {
      delete dataKrama.data_perubahan;
      delete dataKrama.status_sebelum_draft;
    }

    res.status(200).json({
      message: "Berhasil mengambil detail data krama bali!",
      data: dataKrama
    });
  } catch (error) {
    res.status(500).json({
      message: error.message
    });
  }
};

export const createKrama = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;

  try {
    // Mulai transaksi database
    t = await db.transaction();

    const userRole = req.role;
    const userDesaId = req.desaAdatId;

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

    // Validasi tipe data
    if (!VALID_TIPE_DATA.includes(tipe_data)) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Tipe data tidak valid!" 
      });
    }

    // Logika validasi sanitasi data is_bali
    let final_is_bali = is_bali;
    let final_desa_adat_id = null;
    let final_alamat_luar = null

    if (tipe_data === "Keturunan") {
      // Validasi jenis kelamin
      if (!jenis_kelamin || !VALID_JENIS_KELAMIN.includes(jenis_kelamin)) {
        await t.rollback();
        return res.status(400).json({ 
          message: "Jenis kelamin tidak valid!" 
        });
      }
      // Validasi status hidup
      if (!status_hidup || !VALID_STATUS_HIDUP.includes(status_hidup)) {
        await t.rollback();
        return res.status(400).json({ 
          message: "Status hidup tidak valid!" 
        });
      }
      // Validasi alamat asal
      if (is_bali === undefined || is_bali === null) {
        await t.rollback();
        return res.status(400).json({
          message: "Status asal krama wajib diisi!"
        });
      }
      // Validasi input data berdasarkan wilayah adat
      if (is_bali === true) {
        if (!desa_adat_id) {
          await t.rollback();
          return res.status(400).json({
            message: "Krama bali wajib memilih desa adat asal!"
          });
        }
        final_desa_adat_id = desa_adat_id;
        final_alamat_luar = null;
      } else {
        if (!alamat_luar) {
          await t.rollback();
          return res.status(400).json({
            message: "Krama luar bali wajib mengisi alamat asal!"
          });
        }
        final_desa_adat_id = null;
        final_alamat_luar = alamat_luar;
      }
    } else {
      // Jika krama merupakan tipe data Leluhur
      final_is_bali = is_bali ?? null;
      final_desa_adat_id = (final_is_bali === true) ? desa_adat_id : null;
      final_alamat_luar = (final_is_bali === false) ? alamat_luar : null;
    }

    // Logika auto-approval berdasarkan operator
    let statusVerifAwal = "Draft";
    let catatanAdminDesa = "Menunggu verifikasi Admin Desa...";

    const isSuperAdmin = userRole === "Super Admin";
    const isAdminDesaLokal = userRole === "Admin Desa" && Number(userDesaId) === Number(final_desa_adat_id);
    const isAuthedToApprove = isSuperAdmin || isAdminDesaLokal;

    if (isAuthedToApprove) {
      statusVerifAwal = "Disetujui";
      catatanAdminDesa = `Data diverifikasi otomatis oleh sistem (Input by ${userRole}).`;
    }

    const kramaBaru = await KramaBali.create({
      nama_lengkap,
      nama_panggilan,
      jenis_kelamin: jenis_kelamin || "Tidak Diketahui",
      tanggal_lahir: tanggal_lahir || null,
      status_hidup: tipe_data === "Leluhur" ? "Tidak Diketahui" : (status_hidup || "Hidup"),
      is_bali: final_is_bali,
      desa_adat_id: final_desa_adat_id,
      tempat_asal_khusus,
      alamat_luar: final_alamat_luar,
      tipe_data,
      user_id: req.userId,
      status_verifikasi: statusVerifAwal,
      catatan_admin_desa: catatanAdminDesa,
      is_pending_update: false,
      data_perubahan: null,
      status_sebelum_draft: null
    }, { 
      transaction: t 
    });

    // ============================================================
    // EKSEKUSI DECISION TREE HANYA JIKA DATA DISETUJUI (Keturunan)
    // ============================================================
    if (tipe_data === "Keturunan" && isAuthedToApprove) {
      // Menentukan status peran adat awal
      const keputusan = await mappingAturanAdatBali("LAHIR", {
        jenis_kelamin
      }, t);

      await simpanRiwayatPeranAdat({
        krama_id: kramaBaru.id,
        status_peran_adat: keputusan.status_peran_adat,
        garis_keturunan: keputusan.garis_keturunan,
        dasar_keputusan: keputusan.dasar_keputusan,
        event_date: kramaBaru.tanggal_lahir
      }, t);
    }

    await t.commit();

    res.status(201).json({
      message: isAuthedToApprove
        ? "Data krama bali berhasil ditambahkan resmi ke sistem!"
        : "Data krama bali berhasil diajukan! Menunggu proses verifikasi oleh Admin Desa.",
      data: kramaBaru
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    res.status(500).json({
      message: error.message
    });
  }
};

export const verifikasiKrama = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;

  try {
    const { id } = req.params;
    const currentUserId = req.userId;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    const { 
      status_verifikasi, 
      catatan_admin_desa 
    } = req.body

    // Validasi status verifikasi
    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      return res.status(400).json({
        message: "Status verifikasi tidak valid!"
      });
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
      await t.rollback();
      return res.status(404).json({ 
        message: "Data krama bali tidak ditemukan." 
      });
    }

    // VALIDASI VERIFIKASI GANDA
    const statusSaatIni = krama.status_verifikasi;
    const isTrueVerif = statusSaatIni === "Draft" || statusSaatIni === "Ditolak" ||(statusSaatIni === "Disetujui" && krama.is_pending_update === true);

    if (!isTrueVerif) {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi dihentikan! Data ini tidak memiliki antrean pengajuan yang aktif."
      });
    }

    // Identifikasi mutasi lintas desa adat
    const desaAsalId = krama.desa_adat_id;
    const desaTujuanId = krama.is_pending_update && krama.data_perubahan?.desa_adat_id
      ? Number(krama.data_perubahan.desa_adat_id)
      : null;

    const isMutasiLintasDesa = desaTujuanId && Number(desaAsalId) !== Number(desaTujuanId);

    // Hak akses data oleh admin desa
    if (userRole === "Admin Desa") {
      const desaOtoritasHak = isMutasiLintasDesa ? desaAsalId : (desaTujuanId || desaAsalId);

      if (Number(desaOtoritasHak) !== Number(userDesaId)) {
        await t.rollback();
        return res.status(403).json({
          message: isMutasiLintasDesa 
            ? "Otoritas mengakses data ditolak! Usulan mutasi keluar desa adat wajib diverifikasi terlebih dahulu oleh Admin Desa Asal krama bali."
            : "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
        });
      }
    }

    // Menandai jenis pengajuan untuk logika peran adat nanti
    const riwayatPeranLama = await RiwayatPeranAdat.findOne({
      where: { krama_id: id },
      transaction: t
    });

    const isPendaftaranBaru = !riwayatPeranLama;

    // CASE 1: VERIFIKASI DITOLAK
    if (status_verifikasi === "Ditolak") {
      if (!catatan_admin_desa?.trim()) {
        await t.rollback();
        return res.status(400).json({ 
          message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!" 
        });
      }

      const statusKembali = krama.is_pending_update 
        ? krama.status_sebelum_draft 
        : "Ditolak";
      
      let labelPenolak = userRole;

      if (userRole === "Admin Desa") {
        labelPenolak = `Admin Desa ${krama.wilayah_adat?.nama_desa_adat || "Adat"}`;
      }

      await krama.update({
        status_verifikasi: statusKembali,
        catatan_admin_desa: `Data krama bali telah ditolak oleh ${labelPenolak}. Alasan/Catatan Penolakan: ${catatan_admin_desa.trim()}`,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null
      }, { 
        transaction: t 
      });

      await t.commit();

      const kramaTerbaru = await KramaBali.findByPk(id, { 
        include: KRAMA_INCLUDE
      });

      return res.status(200).json({
        message: `Data krama bali atas nama ${krama.nama_lengkap} resmi ditolak oleh ${userRole}.`,
        data: kramaTerbaru
      });
    }

    // CASE 2: VERIFIKASI DISETUJUI
    let finalUpdate = {
      status_verifikasi: "Disetujui",
      catatan_admin_desa: catatan_admin_desa?.trim() 
        ? catatan_admin_desa.trim() 
        : (krama.is_pending_update 
            ? `Usulan perubahan data krama bali resmi disahkan oleh ${userRole}.`
            : `Pengajuan pendaftaran krama bali baru telah disetujui oleh ${userRole}.`
          ),
      is_pending_update: false,
      status_sebelum_draft: null,
      data_perubahan: null
    };

    // BONGKAR JSONB: jika ada data di buffer, pindahkan ke kolom utama
    if (krama.is_pending_update && krama.data_perubahan) {
      const dataBaru = krama.data_perubahan;

      // Marge data dari JSONB ke objek update
      finalUpdate = { 
        ...finalUpdate, 
        ...dataBaru 
      };

      // Sinkronisasi kronologis jika ada perubahan tanggal lahir
      if (dataBaru.tanggal_lahir && krama.tipe_data === "Keturunan") {
        const tanggalBaru = dataBaru.tanggal_lahir;

        await Promise.all([
          RiwayatPeranAdat.findOne({
            where: { krama_id: id },
            order: [["mulai_tanggal", "ASC"], ["id", "ASC"]],
            transaction: t
          }).then(async (riwayat) => {
            if (riwayat) await riwayat.update({ 
              mulai_tanggal: tanggalBaru 
            }, { 
              transaction: t 
            });
          }),
          RiwayatKeluarga.findOne({
            where: { 
              krama_id: id, 
              dasar_keputusan: { [Op.like]: "%anak kandung%" } 
            },
            order: [["awal_masuk", "ASC"], ["id", "ASC"]],
            transaction: t
          }).then(async (riwayat) => {
            if (riwayat) await riwayat.update({ 
              awal_masuk: tanggalBaru 
            }, { 
              transaction: t 
            });
          })
        ]);
      }
    }

    await krama.update(finalUpdate, { 
      transaction: t 
    });
    const kramaRefreshed = await krama.reload({ 
      transaction: t 
    });

    // ===========================================================
    // LOGIKA DECISION TREE UNTUK DATA BARU
    // ===========================================================
    if (kramaRefreshed.tipe_data === "Keturunan" && isPendaftaranBaru) {
      const keputusan = await mappingAturanAdatBali("LAHIR", {
        jenis_kelamin: kramaRefreshed.jenis_kelamin
      }, t);

      await simpanRiwayatPeranAdat({
        krama_id: kramaRefreshed.id,
        status_peran_adat: keputusan.status_peran_adat,
        garis_keturunan: keputusan.garis_keturunan,
        dasar_keputusan: keputusan.dasar_keputusan,
        event_date: kramaRefreshed.tanggal_lahir
      }, t);
    }

    await t.commit();

    const kramaTerbaru = await KramaBali.findByPk(id, {
      include: KRAMA_INCLUDE
    });

    res.status(200).json({
      message: `Data krama bali atas nama ${krama.nama_lengkap} berhasil ${status_verifikasi}.`,
      data: kramaTerbaru
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    res.status(500).json({
      message: error.message
    });
  }
};

export const updateKramaById = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;

  try {
    const { id } = req.params;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;
    const payload = { ...req.body };

    // Mulai transaksi database
    t = await db.transaction();
    
    const krama = await KramaBali.findByPk(id, {
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!krama) {
      await t.rollback();
      return res.status(404).json({
        message: "Data krama bali tidak ditemukan."
      });
    }

    // Validasi hak akses ruang lingkup data
    if (userRole !== "Super Admin") {
      if (req.userId !== krama.user_id) {
        if (userRole === "Admin Desa") {
          if (parseInt(krama.desa_adat_id) !== parseInt(userDesaId)) {
            await t.rollback();
            return res.status(403).json({ 
              message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
            });
          }
        } else {
          await t.rollback();
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
      }
    }
    
    if (krama.tipe_data === "Keturunan") {
      // Validasi jenis kelamin
      if (payload.jenis_kelamin && !VALID_JENIS_KELAMIN.includes(payload.jenis_kelamin)) {
        await t.rollback();
        return res.status(400).json({ 
          message: "Jenis kelamin tidak valid!" 
        });
      }
      // Validasi status hidup
      if (payload.status_hidup && !VALID_STATUS_HIDUP.includes(payload.status_hidup)) {
        await t.rollback();
        return res.status(400).json({ 
          message: "Status hidup tidak valid!" 
        });
      }
    }
    
    // LOGIKA SINKRONISASI TEMPAT TANGGAL/DOMISILI
    if (payload.is_bali !== undefined) {
      if (payload.is_bali === true) {
        payload.alamat_luar = null;
      } else if (payload.is_bali === false) {
        payload.desa_adat_id = null;
        payload.tempat_asal_khusus = null;
      } else {
        payload.desa_adat_id = null;
        payload.alamat_luar = null;
        payload.tempat_asal_khusus = null;
      }
    }

    // Menentukan target desa adat hasil kiriman user
    const targetDesaAdatId = payload.desa_adat_id !== undefined 
      ? payload.desa_adat_id 
      : krama.desa_adat_id;

    // ============================================================
    // LOGIKA BUFFERING PERUBAHAN DATA BERDASARKAN OPERATOR
    // ============================================================
    const isSuperAdmin = userRole === "Super Admin";
    const isAdminDesaLokal = userRole === "Admin Desa" && Number(userDesaId) === Number(krama.desa_adat_id);
    const isAuthedToApprove = isSuperAdmin || isAdminDesaLokal;

    if (!isAuthedToApprove) {
      const statusSaatIni = krama.status_verifikasi;

      await krama.update({
        status_sebelum_draft: statusSaatIni,
        is_pending_update: true,
        data_perubahan: payload,
        catatan_admin_desa: `Adanya usulan perubahan data krama oleh ${userRole}. Menunggu verifikasi dari Admin Desa...`
      }, { 
        transaction: t 
      });

      await t.commit();
      const updateKramaPersonal = await KramaBali.findByPk(id, {
        include: KRAMA_INCLUDE
      });

      return res.status(200).json({
        message: "Usulan perubahan data krama bali berhasil diajukan! Data publik tetap menggunakan data lama hingga disetujui oleh Admin Desa.",
        data: updateKramaPersonal
      });
    } else {
      if (!isSuperAdmin && payload.desa_adat_id && Number(payload.desa_adat_id) !== Number(userDesaId)) {
        await t.rollback();
        return res.status(400).json({ 
          message: "Proses memperbarui data ditolak! Untuk melakukan mutasi warga keluar dari desa adat Anda, silakan ajukan melalui usulan perubahan agar diverifikasi oleh desa tujuan." 
        });
      }

      await krama.update({
        ...payload,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null,
        status_verifikasi: "Disetujui",
        catatan_admin_desa: `Data krama bali telah diperbarui secara resmi oleh ${userRole}.`
      }, { 
        transaction: t 
      });

      // Logika sinkronisasi kronologis tanggal lahir
      if (payload.tanggal_lahir && krama.tipe_data === "Keturunan") {
        const tanggalLahirBaru = payload.tanggal_lahir;

        await Promise.all([
          RiwayatPeranAdat.findOne({
            where: { krama_id: id },
            order: [["mulai_tanggal", "ASC"], ["id", "ASC"]],
            transaction: t
          }).then(async (riwayatPeranAwal) => {
            if (riwayatPeranAwal) {
              await riwayatPeranAwal.update({ 
                mulai_tanggal: tanggalLahirBaru 
              }, { 
                transaction: t 
              });
            }
          }),
          RiwayatKeluarga.findOne({
            where: { 
              krama_id: id,
              dasar_keputusan: { [Op.like]: "%anak kandung%" }
            },
            order: [["awal_masuk", "ASC"], ["id", "ASC"]],
            transaction: t
          }).then(async (riwayatKeluargaAwal) => {
            if (riwayatKeluargaAwal) {
              await riwayatKeluargaAwal.update({ 
                awal_masuk: tanggalLahirBaru 
              }, { 
                transaction: t 
              });
            }
          })
        ]);
      }
    }

    await t.commit();
    
    const updateKramaAdmin = await KramaBali.findByPk(id, {
      include: KRAMA_INCLUDE
    });

    res.status(200).json({
      message: "Data krama bali berhasil diperbarui secara resmi!",
      data: updateKramaAdmin
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    res.status(400).json({
      message: error.message 
    });
  }
};

export const cancelUpdateKrama = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
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
      await t.rollback();
      return res.status(404).json({ 
        message: "Data krama bali tidak ditemukan." 
      });
    }

    // Validasi adanya content yang dibatalkan
    if (!krama.is_pending_update) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Tidak ada usulan perubahan yang aktif pada data ini." 
      });
    }

    // Identifikasi keterlibatan desa adat
    const desaAsalId = krama.desa_adat_id;
    const desaTujuanId = krama.data_perubahan?.desa_adat_id 
      ? Number(krama.data_perubahan.desa_adat_id) 
      : null;
    
    // Validasi hanya pemilik data yang boleh membatalkan usulan
    if (userRole !== "Super Admin" && userId !== krama.user_id) {
      if (userRole === "Admin Desa") {
        const isAsalMatch = Number(desaAsalId) === Number(userDesaId);
        const isTujuanMatch = desaTujuanId && Number(desaTujuanId) === Number(userDesaId);

        if (!isAsalMatch && !isTujuanMatch) {
          await t.rollback();
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          });
        }
      } else {
        await t.rollback();
        return res.status(403).json({ 
          message: "Otoritas mengakses data ditolak!" 
        });
      }
    }

    // Mengambil status verifikasi sebelumnya
    const statusPulih = krama.status_sebelum_draft || "Draft";
    let catatanBatal = `Usulan perubahan data krama bali telah resmi dibatalkan oleh ${userRole}.`;
    
    if (statusPulih === "Ditolak") {
      catatanBatal = "Usulan perbaikan data krama bali dibatalkan! Status penolakan sebelumnya dipulihkan.";
    } else if (statusPulih === "Disetujui") {
      catatanBatal = "Usulan perubahan data krama bali dibatalkan! Data krama bali aktif kembali menggunakan data sah yang lama.";
    }

    await krama.update({
      is_pending_update: false,
      data_perubahan: null,
      status_verifikasi: statusPulih,
      status_sebelum_draft: null,
      catatan_admin_desa: catatanBatal
    }, { 
      transaction: t 
    });

    await t.commit();

    res.status(200).json({ 
      message: `Berhasil membatalkan usulan perubahan data krama bali. Status saat ini: ${statusPulih}.` 
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    res.status(500).json({ 
      message: error.message 
    });
  }
};

export const deleteKramaById = async (req, res) => {
  // Deklarasi t diluar agar catch bisa diakses
  let t;

  try {
    const { id } = req.params;
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    // Mulai transaksi database
    t = await db.transaction();

    const krama = await KramaBali.findByPk(id, { 
      transaction: t,
      lock: t.LOCK.UPDATE
    });

    if (!krama) {
      await t.rollback();
      return res.status(404).json({
        message: "Data krama bali tidak ditemukan."
      });
    }

    // Identifikasi keterlibatan desa adat
    const desaAsalId = krama.desa_adat_id;
    const desaTujuanId = krama.is_pending_update && krama.data_perubahan?.desa_adat_id
      ? Number(krama.data_perubahan.desa_adat_id)
      : null;

    // Validasi hak akses ruang lingkup data
    if (userRole !== "Super Admin") {
      if (req.userId === krama.user_id) {
        if (krama.status_verifikasi === "Disetujui") {
          await t.rollback();
          return res.status(403).json({
            message: "Proses menghapus data dihentikan! Data krama bali ini sudah disetujui dan tidak dapat dihapus secara sepihak oleh pemilik data."
          });
        }
      } else {
        if (userRole === "Admin Desa") {
          const isAsalMatch = Number(desaAsalId) === Number(userDesaId);
          const isTujuanMatch = desaTujuanId && Number(desaTujuanId) === Number(userDesaId);

          if (!isAsalMatch && !isTujuanMatch) {
            await t.rollback();
            return res.status(403).json({ 
              message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
            });
          }
        } else {
          await t.rollback();
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
      } 
    }

    // Memastikan krama tidak memiliki relasi struktural yang mengunci keturunan
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
    
    // Validasi pemblokiran penghapusan data
    if (isOrangTua) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Proses menghapus data dihentikan! Krama masih tercatat sebagai orang tua." 
      });
    }
    if (isKawin) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Proses menghapus data dihentikan! Krama masih tercatat dalam suatu perkawinan." 
      });
    }
    if (isKepalaKeluarga) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Proses menghapus data dihentikan! Krama masih tercatat sebagai kepala keluarga yang aktif." 
      });
    }

    const idAyahLama = relasiSilsilahAnak?.ayah_id || null;
    const idIbuLama = relasiSilsilahAnak?.ibu_id || null;

    // ============================================================
    // LOGIKA EKSEKUSI CASCADING INTERNAL DATA DATA MENTAH / APPROVAL
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

    // Kalibrasi urutan lahir saudara lain
    if (idAyahLama || idIbuLama) {
      await hitungUrutanLahir({
        mode: "CAMPUR",
        ayah_id: idAyahLama,
        ibu_id: idIbuLama
      }, t);
    }
    
    await t.commit();

    res.status(200).json({
      message: "Data krama bali beserta riwayat struktural terkait berhasil dihapus!"
    });
  } catch (error) {
    if (t && !t.finished) {
      await t.rollback();
    }
    res.status(400).json({
      message: error.message
    });
  }
};