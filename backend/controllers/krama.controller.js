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
      filterCondition[Op.or] = [
        { desa_adat_id: parseInt(desa_adat_id) },
        { desa_adat_id: null }
      ];
    }
    
    const leluhurList = await KramaBali.scope('leluhurOnly').findAll({
      where: filterCondition,
      include: ["wilayah_adat"],
      order: [["id", "ASC"]]
    });

    // Logika mengambil anam desa adat untuk message response
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

    let whereCondition = {};

    // Kondisi 1: Mengambil semua data orang lain yang telah disetujui
    if (mode === "public") {
      whereCondition = {
        status_verifikasi: "Disetujui",
      };
    } 
    // Kondisi 2: Mengambil semua data milik user yang login
    else if (mode === "personal") {
      whereCondition = {
        user_id: currentUserId
      };
    }
    // Kondisi 3: Mengambil data dengan status draft
    else if (mode === "verification") {
      const isAdmin = userRole === "Admin Desa" || userRole === "Super Admin";

      if (!isAdmin) {
        return res.status(403).json({ 
          message: "Otoritas mengakses data ditolak!" 
        });
      }
      
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
      // Jika Admin Desa, batasi antrean sesuai wilayah desa adatnya masing-masing
      if (userRole === "Admin Desa") {
        whereCondition.desa_adat_id = userDesaId;
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

      if (mode === "public" && !isSatuDesa && !isAdmin && !isOwner) {
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
    if (dataKramaRaw.status_verifikasi !== "Disetujui") {
      const isOwner = dataKramaRaw.user_id === currentUserId;
      const isAdminDesa = (userRole === "Admin Desa" && dataKramaRaw.desa_adat_id === userDesaId);
      const isSuperAdmin = userRole === "Super Admin";

      if (!isOwner && !isAdminDesa && !isSuperAdmin) {
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak! Data ini masih dalam proses verifikasi."
        });
      }
    }

    // Konversi ke plain object agar manipulasi properti aman dan bersih
    const dataKrama = dataKramaRaw.toJSON();

    // Logika filter privasi (post-processing)
    const isSatuDesa = dataKrama.desa_adat_id === userDesaId;
    const isAdmin = userRole === "Admin Desa" || userRole === "Super Admin";
    const isOwner = dataKrama.user_id === currentUserId;

    if (!isOwner && !isAdmin) {
      delete dataKrama.data_perubahan;
      delete dataKrama.status_sebelum_draft;
    }

    if (!isSatuDesa && !isAdmin && !isOwner) {
      const maskedData = {
        id: dataKrama.id,
        nama_lengkap: dataKrama.nama_lengkap,
        nama_panggilan: dataKrama.nama_panggilan,
        jenis_kelamin: dataKrama.jenis_kelamin,
        status_hidup: dataKrama.status_hidup,
        tipe_data: dataKrama.tipe_data,
        desa_adat_id: dataKrama.desa_adat_id,
        tempat_asal_khusus: dataKrama.tempat_asal_khusus,
        relasi_krama_bali: dataKrama.relasi_krama_bali,
        perkawinan_suami: dataKrama.perkawinan_suami,
        perkawinan_istri: dataKrama.perkawinan_istri,
        wilayah_adat: dataKrama.wilayah_adat
      };

      return res.status(200).json({
        message: "Berhasil mengambil data krama bali!",
        data: maskedData
      });
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

        // Validasi hak akses desa adat untuk input data krama
        if (userRole !== "Super Admin") {
          if (parseInt(desa_adat_id) !== parseInt(userDesaId)) {
            await t.rollback();
            return res.status(403).json({ 
              message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
            });
          }
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
    let catatanAdminDesa = "Menunggu verifikasi oleh Admin Desa.";

    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
    if (isAdmin) {
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
    if (tipe_data === "Keturunan" && isAdmin) {
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
      message: isAdmin
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
    const userRole = req.role;
    const userDesaId = req.desaAdatId;

    const { 
      status_verifikasi, 
      catatan_admin_desa 
    } = req.body

    // Mulai transaksi database
    t = await db.transaction();

    // Validasi status verifikasi
    const VALID_STATUS = ["Disetujui", "Ditolak"];
    if (!VALID_STATUS.includes(status_verifikasi)) {
      await t.rollback();
      return res.status(400).json({
        message: "Status verifikasi tidak valid!"
      });
    }

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

    // ============================================================
    // VALIDASI VERIFIKASI GANDA
    // ============================================================
    const isTrueVerif = krama.status_verifikasi === "Draft" || (krama.status_verifikasi === "Disetujui" && krama.is_pending_update === true);

    if (!isTrueVerif) {
      await t.rollback();
      return res.status(400).json({
        message: "Proses verifikasi dihentikan! Data ini tidak memiliki antrean pengajuan yang aktif."
      });
    }

    // Hak akses data oleh admin desa
    if (userRole === "Admin Desa" && krama.desa_adat_id !== userDesaId) {
      await t.rollback();
      return res.status(403).json({
        message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
      });
    }

    // Menandai jenis pengajuan untuk logika peran adat nanti
    const isPendaftaranBaru = krama.status_verifikasi === "Draft" && !krama.status_sebelum_draft;

    // Logika eksekusi verifikasi dengan buffering data
    if (status_verifikasi === "Disetujui") {
      let finalUpdate = {
        status_verifikasi: "Disetujui",
        catatan_admin_desa: catatan_admin_desa || `Pangajuan data krama bali disetujui oleh ${userRole}.`,
        is_pending_update: false,
        status_sebelum_draft: null
      };

      // BONGKAR JSONB: jika ada data di buffer, pindahkan ke kolom utama
      if (krama.is_pending_update && krama.data_perubahan) {
        const dataBaru = krama.data_perubahan;

        // Marge data dari JSONB ke objek update
        finalUpdate = { 
          ...finalUpdate, 
          ...dataBaru 
        };

        finalUpdate.data_perubahan = null;

        // Sinkronisasi kronologis jika ada perubahan tanggal lahir
        if (dataBaru.tanggal_lahir && krama.tipe_data === "Keturunan") {
          const tanggalBaru = dataBaru.tanggal_lahir;

          // Memperbarui pada riwayat peran adat paling awal
          const riwayatPeranAwal = await RiwayatPeranAdat.findOne({
            where: { krama_id: id },
            order: [
              ["mulai_tanggal", "ASC"], 
              ["id", "ASC"]
            ],
            transaction: t
          });

          if (riwayatPeranAwal) {
            await riwayatPeranAwal.update({
              mulai_tanggal: tanggalBaru
            }, {
              transaction: t
            });
          }

          // Memperbarui riwayat keluarga paling awal dimana statusnya adalah anak kandung
          const riwayatKeluargaAwal = await RiwayatKeluarga.findOne({
            where: { 
              krama_id: id,
              dasar_keputusan: { [Op.like]: "%anak kandung%" }
            },
            order: [
              ["awal_masuk", "ASC"], 
              ["id", "ASC"]
            ],
            transaction: t
          });

          if (riwayatKeluargaAwal) {
            await riwayatKeluargaAwal.update({
              awal_masuk: tanggalBaru
            }, {
              transaction: t
            });
          }
        }
      }

      // Menjalankan update fisik data uatama krama
      await krama.update(finalUpdate, {
        transaction: t
      });

      // ===========================================================
      // LOGIKA DECISION TREE UNTUK DATA BARU
      // ===========================================================
      if (krama.tipe_data === "Keturunan" && isPendaftaranBaru) {
        // Mapping decision tree untuk status peran adat awal
        const keputusan = await mappingAturanAdatBali("LAHIR", {
          jenis_kelamin: krama.jenis_kelamin
        }, t);

        await simpanRiwayatPeranAdat({
          krama_id: krama.id,
          status_peran_adat: keputusan.status_peran_adat,
          garis_keturunan: keputusan.garis_keturunan,
          dasar_keputusan: keputusan.dasar_keputusan,
          event_date: krama.tanggal_lahir
        }, t);
      }
    } else {
      // Validasi input catatan oleh admin desa
      if (!catatan_admin_desa) {
        await t.rollback();
        return res.status(400).json({
          message: "Catatan verifikasi wajib diisi jika pengajuan ditolak!"
        });
      }

      // Mengambil status verifikasi terakhir
      const statusKembali = krama.status_sebelum_draft || "Ditolak"

      await krama.update({
        status_verifikasi: statusKembali,
        catatan_admin_desa,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null
      }, {
        transaction: t
      });
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
      if (userRole === "Admin Desa") {
        if (parseInt(krama.desa_adat_id) !== parseInt(userDesaId)) {
          await t.rollback();
          return res.status(403).json({ 
            message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda." 
          });
        }
      } else {
        if (req.userId !== krama.user_id) {
          await t.rollback();
          return res.status(403).json({
            message: "Otoritas mengakses data ditolak!"
          });
        }
      }
    }
    
    const payload = { ...req.body };

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
    
    // Logika sinkronisasi alamat dan field is_bali
    if (payload.is_bali !== undefined) {
      if (payload.is_bali === true) {
        payload.alamat_luar = null
      } else if (payload.is_bali === false) {
        payload.desa_adat_id = null
        payload.tempat_asal_khusus = null
      } else {
        payload.desa_adat_id = null;
        payload.alamat_luar = null
        payload.tempat_asal_khusus = null;
      }
    }

    // ============================================================
    // LOGIKA BUFFERING PERUBAHAN DATA BERDASARKAN OPERATOR
    // ============================================================
    if (userRole !== "Super Admin" && userRole !== "Admin Desa") {
      // Mengambil status verifikasi sebelumnya
      const statusSaatIni = krama.status_verifikasi;

      // Jika status verifikasi Disetujui, jangan rubah statusnya ke Draft
      const statusBaru = statusSaatIni === "Disetujui" ? "Disetujui" : "Draft";

      await krama.update({
        status_sebelum_draft: statusSaatIni,
        is_pending_update: true,
        data_perubahan: payload,
        status_verifikasi: statusBaru,
        catatan_admin_desa: "Adanya usulan perubahan data oleh pengguna! Menunggu verifikasi..."
      }, { 
        transaction: t 
      });

      await t.commit();

      const updateKramaPersonal = await KramaBali.findByPk(id, {
        include: KRAMA_INCLUDE
      });

      return res.status(200).json({
        message: statusSaatIni === "Disetujui"
          ? "Usulan perubahan data krama bali berhasil diajukan! Data publik tetap menggunakan data krama bali lama hingga disetujui oleh Admin Desa."
          : "Perbaikan data krama bali berhasil diajukan! Menunggu verifikasi ulang oleh Admin Desa.",
        data: updateKramaPersonal
      });
    } else {
      await krama.update({
        ...payload,
        is_pending_update: false,
        data_perubahan: null,
        status_sebelum_draft: null,
        status_verifikasi: "Disetujui",
        catatan_admin_desa: `Data diperbarui secara resmi oleh ${userRole}.`
      }, { 
        transaction: t 
      });

      // Logika sinkronisasi kronologis tanggal lahir
      if (payload.tanggal_lahir && krama.tipe_data === "Keturunan") {
        // Mengambil tanggal lahir baru
        const tanggalLahirBaru = payload.tanggal_lahir;

        // Mencari riwayat peran adat paling awal
        const riwayatPeranAwal = await RiwayatPeranAdat.findOne({
          where: { krama_id: id },
          order: [
            ["mulai_tanggal", "ASC"], 
            ["id", "ASC"]
          ],
          transaction: t
        });

        // Jika ditemukan, update mulai_tanggal agar sama dengan tanggal lahir baru
        if (riwayatPeranAwal) {
          await riwayatPeranAwal.update({
            mulai_tanggal: tanggalLahirBaru
          }, {
            transaction: t
          });
        }

        // Mencari riwayat keluarga paling awal dimana statusnya adalah anak kandung
        const riwayatKeluargaAwal = await RiwayatKeluarga.findOne({
          where: { 
            krama_id: id,
            dasar_keputusan: { [Op.like]: "%anak kandung%" }
          },
          order: [
            ["awal_masuk", "ASC"], 
            ["id", "ASC"]
          ],
          transaction: t
        });

        // Jika ditemukan, sinkronkan tanggal awal_masuk
        if (riwayatKeluargaAwal) {
          await riwayatKeluargaAwal.update({
            awal_masuk: tanggalLahirBaru
          }, {
            transaction: t
          });
        }
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
    
    // Validasi hanya pemilik data yang boleh membatalkan usulan
    if (userRole !== "Super Admin" && userId !== krama.user_id) {
      await t.rollback();
      return res.status(403).json({ 
        message: "Otoritas mengakses data ditolak!" 
      });
    }
    
    // Validasi adanya content yang dibatalkan
    if (!krama.is_pending_update) {
      await t.rollback();
      return res.status(400).json({ 
        message: "Tidak ada usulan perubahan yang aktif pada data ini." 
      });
    }

    // Mengambil status verifikasi sebelumnya
    const statusPulih = krama.status_sebelum_draft || krama.status_verifikasi;;

    // Kustomisasi pesan catatan agar informatif bagi Admin Desa saat audit data
    const catatanBatal = statusPulih === "Ditolak"
      ? "Usulan perbaikan data krama bali dibatalkan oleh pengguna! Status verifikasi sebelumnya dipulihkan."
      : `Usulan perubahan data krama bali telah dibatalkan oleh ${userRole}.`;

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

    // Validasi hak akses ruang lingkup data
    const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
    
    if (!isAdmin) {
      if (req.userId !== krama.user_id) {
        await t.rollback();
        return res.status(403).json({
          message: "Otoritas mengakses data ditolak!"
        });
      }

      if (krama.status_verifikasi === "Disetujui") {
        await t.rollback();
        return res.status(403).json({
          message: "Proses menghapus data dihentikan! Data krama bali ini sudah disetujui dan tidak dapat dihapus secara sepihak oleh pengguna."
        });
      }
    } else {
      if (userRole === "Admin Desa" && parseInt(krama.desa_adat_id) !== parseInt(userDesaId)) {
        await t.rollback();
        return res.status(403).json({ 
          message: "Otoritas mengakses data ditolak! Wilayah desa adat berbeda."
        });
      }
    }

    // Memastikan krama tidak memiliki relasi struktural yang mengunci keturunan
    const [isOrangTua, isKawin, isKepalaKeluarga] = await Promise.all([
      // Case 1: Melihat statusnya sebagai orang tua
      RelasiKrama.findOne({
        where: { 
          [Op.or]: [
            { ayah_id: id }, 
            { ibu_id: id }
          ],
          status_verifikasi: { [Op.ne]: "Ditolak" }
        },
        transaction: t
      }),
      // Case 2: Melihat status perkawinannya
      Perkawinan.findOne({
        where: { 
          [Op.or]: [
            { suami_id: id }, 
            { istri_id: id }
          ],
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
    
    await t.commit();

    res.status(200).json({
      message: "Data krama bali beserta relasi struktural terkait berhasil dihapus!"
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