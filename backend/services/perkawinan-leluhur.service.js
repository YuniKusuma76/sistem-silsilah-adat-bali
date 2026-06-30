import db from "../config/db.config.js";
import { Perkawinan } from "../models/associations.js";
import { buatKeluargaLeluhur } from "./keluarga.service.js";
import { simpanRiwayatKeluarga } from "./riwayat-keluarga.service.js";

export const integrasiPerkawinanLeluhur = async ({
  suami_id,
  istri_id,
  status_perkawinan,
  jenis_perkawinan,
  tanggal_perkawinan,
  user_id,
  user_role,
  user_desa_id,
  nama_desa_operator
}, t) => {
  // MENENTUKAN STATUS APPROVAL BERDASARKAN ROLE
  const isSuperAdmin = user_role === "Super Admin";
  const isAdminDesa = user_role === "Admin Desa";

  let statusVerifikasi = "Draft";
  let approvedSuami = false;
  let approvedIstri = false;
  let catatanAdmin = {};

  if (isSuperAdmin || isAdminDesa) {
    statusVerifikasi = "Disetujui";
    approvedSuami = true;
    approvedIstri = true;

    let operatorIdentity = "Super Admin";

    if (isAdminDesa) {
      operatorIdentity = nama_desa_operator ? `Admin Desa ${nama_desa_operator}` : `Admin Desa Setempat`;
    }

    catatanAdmin = {
      catatan_desa_suami: `Data perkawinan leluhur diverifikasi otomatis oleh sistem (Input by ${user_role}).`,
      catatan_desa_istri: `Data perkawinan leluhur diverifikasi otomatis oleh sistem (Input by ${user_role}).`,
      last_updated_by: operatorIdentity
    };
  } else {
    catatanAdmin = {
      catatan_desa_suami: "Menunggu verifikasi Admin Desa.",
      catatan_desa_istri: "Menunggu verifikasi Admin Desa.",
      last_updated_by: "Sistem (Input by Krama)"
    };
  }

  const jenisPerkawinanValid = jenis_perkawinan || "Biasa";
  const tanggalPerkawinanMurni = tanggal_perkawinan || new Date().toISOString().split('T')[0];

  const jamSekarang = new Date().toTimeString().split(' ')[0];
  const finalTanggalLeluhurDateTime = new Date(`${tanggalPerkawinanMurni} ${jamSekarang}`);

  const perkawinan = await Perkawinan.create({
    suami_id,
    istri_id,
    status_perkawinan: status_perkawinan || "Kawin",
    jenis_perkawinan: jenisPerkawinanValid,
    tanggal_perkawinan: tanggalPerkawinanMurni,
    status_verifikasi: statusVerifikasi,      
    is_approved_desa_suami: approvedSuami,      
    is_approved_desa_istri: approvedIstri,
    catatan_admin_desa: catatanAdmin,
    user_id
  }, { transaction: t });

  if (statusVerifikasi !== "Disetujui") {
    return {
      perkawinan,
      keluarga: null,
    };
  }

  // =====================================================
  // PROCESS 1: Perkawinan Biasa dan Nyentana Leluhur
  // =====================================================
  if (jenisPerkawinanValid !== "Pade Gelahang") {
    const isNyentana = jenisPerkawinanValid === "Nyentana";
    const kepalaId = isNyentana ? istri_id : suami_id;
    const anggotaId = isNyentana ? suami_id : istri_id;

    const keluargaLeluhur = await buatKeluargaLeluhur({
      kepala_keluarga_id: kepalaId
    }, t);

    await simpanRiwayatKeluarga({
      krama_id: kepalaId,
      keluarga_id: keluargaLeluhur.id,
      perkawinan_id: perkawinan.id,
      kedudukan: "Kepala Keluarga",
      kategori_event: "KAWIN",
      dasar_keputusan: isNyentana 
        ? "Kedudukan sebagai kepala keluarga diberikan karena krama ini berstatus Purusa Nyentana dalam sejarah silsilah keluarga leluhur."
        : "Kedudukan sebagai kepala keluarga diberikan karena krama ini merupakan penerus garis keturunan (Purusa) untuk keluarga leluhurnya.",
      event_date: finalTanggalLeluhurDateTime,
      allow_multiple: true
    }, t);

    await simpanRiwayatKeluarga({
      krama_id: anggotaId,
      keluarga_id: keluargaLeluhur.id,
      perkawinan_id: perkawinan.id,
      kedudukan: "Anggota",
      kategori_event: "KAWIN",
      dasar_keputusan: isNyentana
        ? "Kedudukan sebagai anggota diberikan karena krama ini tercatat sebagai suami yang masuk ke dalam keluarga purusa istri (Nyentana)."
        : "Kedudukan sebagai anggota diberikan karena krama ini tercatat sebagai istri (Predana) dalam catatan Trah Bali.",
      event_date: finalTanggalLeluhurDateTime,
      allow_multiple: true
    }, t);

    return {
      perkawinan,
      keluarga: keluargaLeluhur
    };
  }

  // ====================================================================
  // PROCESS 2: Antisipasi Perkawinan Pade Gelahang Leluhur
  // ====================================================================
  if (jenisPerkawinanValid === "Pade Gelahang") {
    const [keluargaSuami, keluargaIstri] = await Promise.all([
      buatKeluargaLeluhur({ kepala_keluarga_id: suami_id }, t),
      buatKeluargaLeluhur({ kepala_keluarga_id: istri_id }, t)
    ]);

    // riwayat keluarga untuk keluarga silsilah suami
    await simpanRiwayatKeluarga({
      krama_id: suami_id,
      keluarga_id: keluargaSuami.id,
      perkawinan_id: perkawinan.id,
      kedudukan: "Kepala Keluarga",
      kategori_event: "KAWIN",
      dasar_keputusan: "Kedudukan sebagai kepala keluarga leluhur diberikan kepada krama ini karena berstatus purusa di garis keturunan asalnya pada perkawinan Pade Gelahang.",
      event_date: finalTanggalLeluhurDateTime,
      allow_multiple: true
    }, t);

    await simpanRiwayatKeluarga({
      krama_id: istri_id,
      keluarga_id: keluargaSuami.id,
      perkawinan_id: perkawinan.id,
      kedudukan: "Anggota",
      kategori_event: "KAWIN",
      dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini sebagai pendamping predana di silsilah keluarga suaminya pada perkawinan Pade Gelahang.",
      event_date: finalTanggalLeluhurDateTime,
      allow_multiple: true
    }, t);

    // riwayat keluarga untuk keluarga silsilah istri
    await simpanRiwayatKeluarga({
      krama_id: istri_id,
      keluarga_id: keluargaIstri.id,
      perkawinan_id: perkawinan.id,
      kedudukan: "Kepala Keluarga",
      kategori_event: "KAWIN",
      dasar_keputusan: "Kedudukan sebagai kepala keluarga leluhur diberikan kepada krama ini karena berstatus purusa di garis keturunan asalnya pada perkawinan Pade Gelahang.",
      event_date: finalTanggalLeluhurDateTime,
      allow_multiple: true
    }, t);

    await simpanRiwayatKeluarga({
      krama_id: suami_id,
      keluarga_id: keluargaIstri.id,
      perkawinan_id: perkawinan.id,
      kedudukan: "Anggota",
      kategori_event: "KAWIN",
      dasar_keputusan: "Kedudukan sebagai anggota diberikan kepada krama ini sebagai pendamping predana di silsilah keluarga istrinya pada perkawinan Pade Gelahang.",
      event_date: finalTanggalLeluhurDateTime,
      allow_multiple: true
    }, t);

    return {
      perkawinan,
      keluarga_suami: keluargaSuami,
      keluarga_istri: keluargaIstri
    };
  }
};