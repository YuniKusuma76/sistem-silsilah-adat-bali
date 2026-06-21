import Provinsi from "./provinsi.model.js";
import Kabupaten from "./kabupaten.model.js";
import Kecamatan from "./kecamatan.model.js";
import DesaAdat from "./desa-adat.model.js";
import User from "./user.model.js";
import PermohonanRole from "./permohonan-role.model.js";
import PermohonanDesa from "./permohonan-desa.model.js";
import KramaBali from "./krama.model.js";
import Perkawinan from "./perkawinan.model.js";
import RelasiKrama from "./relasi.model.js";
import Keluarga from "./keluarga.model.js";
import RiwayatKeluarga from "./riwayat-keluarga.model.js";
import RiwayatPeranAdat from "./riwayat-peran-adat.model.js";
import AturanAdatBali from "./aturan-adat.model.js";
import KontakPesan from "./kontak-pesan.model.js";
import Notifikasi from "./notifikasi.model.js";

// RELASI MODEL WILAYAH 
Provinsi.hasMany(Kabupaten, { 
  foreignKey: "provinsi_id",
  as: "kabupaten_di_provinsi"
});
Kabupaten.belongsTo(Provinsi, { 
  foreignKey: "provinsi_id",
  as: "provinsi"
});

Kabupaten.hasMany(Kecamatan, { 
  foreignKey: "kabupaten_id",
  as: "kecamatan_di_kabupaten"
});
Kecamatan.belongsTo(Kabupaten, { 
  foreignKey: "kabupaten_id",
  as: "kabupaten"
});

Kecamatan.hasMany(DesaAdat, { 
  foreignKey: "kecamatan_id",
  as: "desa_di_kecamatan"
});
DesaAdat.belongsTo(Kecamatan, { 
  foreignKey: "kecamatan_id",
  as: "kecamatan"
});

DesaAdat.hasMany(KramaBali, { 
  foreignKey: "desa_adat_id", 
  as: "krama_desa_adat"
});
KramaBali.belongsTo(DesaAdat, { 
  foreignKey: "desa_adat_id", 
  as: "wilayah_adat" 
});

// RELASI MODEL LAIN DENGAN MODEL USER
DesaAdat.hasMany(User, {
  foreignKey: "desa_adat_id",
  as: "krama_adat"
});
User.belongsTo(DesaAdat, {
  foreignKey: "desa_adat_id",
  as: "desa_adat"
});

// RELASI MODEL PERMOHONAN ROLE
User.hasMany(PermohonanRole, {
  foreignKey: "user_id",
  as: "permohonan_role"
});
PermohonanRole.belongsTo(User, {
  foreignKey: "user_id",
  as: "pemohon"
});

User.hasMany(PermohonanRole, {
  foreignKey: "diverifikasi_oleh",
  as: "pemrosesan_role"
});
PermohonanRole.belongsTo(User, {
  foreignKey: "diverifikasi_oleh",
  as: "verifikator"
});

DesaAdat.hasMany(PermohonanRole, { 
  foreignKey: "desa_adat_id_tujuan", 
  as: "permohonan_desa" 
});

PermohonanRole.belongsTo(DesaAdat, { 
  foreignKey: "desa_adat_id_tujuan", 
  as: "desa_tujuan" 
});

// RELASI MODEL PERMOHONAN DESA
User.hasMany(PermohonanDesa, { 
  foreignKey: "user_id", 
  as: "permohonan_mutasi" 
});
PermohonanDesa.belongsTo(User, { 
  foreignKey: "user_id", 
  as: "pemohon_mutasi" 
});

User.hasMany(PermohonanDesa, { 
  foreignKey: "divalidasi_oleh", 
  as: "berkas_divalidasi" 
});
PermohonanDesa.belongsTo(User, { 
  foreignKey: "divalidasi_oleh", 
  as: "validator_berkas" 
});

User.hasMany(PermohonanDesa, { 
  foreignKey: "diverifikasi_oleh", 
  as: "berkas_diverifikasi" 
});
PermohonanDesa.belongsTo(User, { 
  foreignKey: "diverifikasi_oleh", 
  as: "verifikator_keputusan" 
});

DesaAdat.hasMany(PermohonanDesa, { 
  foreignKey: "desa_adat_id_asal",
  as: "mutasi_keluar" 
});
PermohonanDesa.belongsTo(DesaAdat, { 
  foreignKey: "desa_adat_id_asal", 
  as: "desa_asal_pemohon" 
});

DesaAdat.hasMany(PermohonanDesa, { 
  foreignKey: "desa_adat_id_tujuan", 
  as: "mutasi_masuk" 
});
PermohonanDesa.belongsTo(DesaAdat, { 
  foreignKey: "desa_adat_id_tujuan", 
  as: "desa_tujuan_pemohon" 
});

// RELASI MODEL ATURAN ADAT
User.hasMany(AturanAdatBali, {
  foreignKey: "dibuat_oleh",
  as: "aturan_adat_bali"
});
AturanAdatBali.belongsTo(User, {
  foreignKey: "dibuat_oleh",
  as: "pakar_aturan"
});

// RELASI MODEL KRAMA BALI
User.hasMany(KramaBali, {
  foreignKey: "user_id",
  as: "data_krama_masuk"
});
KramaBali.belongsTo(User, {
  foreignKey: "user_id",
  as: "pembuat_krama"
});

KramaBali.hasMany(Keluarga, {
  foreignKey: "kepala_keluarga_id",
  as: "keluarga_yang_dipimpin"
});
Keluarga.belongsTo(KramaBali, {
  foreignKey: "kepala_keluarga_id",
  as: "kepala_keluarga"
});

KramaBali.hasMany(Perkawinan, {
  foreignKey: "suami_id",
  as: "perkawinan_suami"
});
Perkawinan.belongsTo(KramaBali, {
  foreignKey: "suami_id",
  as: "suami"
});

KramaBali.hasMany(Perkawinan, {
  foreignKey: "istri_id",
  as: "perkawinan_istri"
});
Perkawinan.belongsTo(KramaBali, {
  foreignKey: "istri_id",
  as: "istri"
});

KramaBali.hasMany(RiwayatKeluarga, {
  foreignKey: "krama_id",
  as: "riwayat_keluarga"
});
RiwayatKeluarga.belongsTo(KramaBali, {
  foreignKey: "krama_id",
  as: "krama_adat"
});

Keluarga.hasMany(RiwayatKeluarga, {
  foreignKey: "keluarga_id",
  as: "riwayat_anggota_keluarga"
});
RiwayatKeluarga.belongsTo(Keluarga, {
  foreignKey: "keluarga_id",
  as: "detail_keluarga"
});

KramaBali.belongsToMany(Keluarga, {
  through: RiwayatKeluarga,
  foreignKey: "krama_id",
  otherKey: "keluarga_id",
  as: "daftar_keluarga"
});

Keluarga.belongsToMany(KramaBali, {
  through: RiwayatKeluarga,
  foreignKey: "keluarga_id",
  otherKey: "krama_id",
  as: "anggota_krama"
});

User.hasMany(Perkawinan, {
  foreignKey: "user_id",
  as: "data_kawin_masuk"
});
Perkawinan.belongsTo(User, {
  foreignKey: "user_id",
  as: "pembuat_perkawinan"
});

KramaBali.hasMany(RelasiKrama, {
  foreignKey: "ayah_id",
  as: "keturunan_ayah"
});
RelasiKrama.belongsTo(KramaBali, {
  foreignKey: "ayah_id",
  as: "ayah"
});

KramaBali.hasMany(RelasiKrama, {
  foreignKey: "ibu_id",
  as: "keturunan_ibu"
});
RelasiKrama.belongsTo(KramaBali, {
  foreignKey: "ibu_id",
  as: "ibu"
});

KramaBali.hasMany(RelasiKrama, {
  foreignKey: "anak_id",
  as: "relasi_krama_bali"
});
RelasiKrama.belongsTo(KramaBali, {
  foreignKey: "anak_id",
  as: "anak"
});

User.hasMany(RelasiKrama, {
  foreignKey: "user_id",
  as: "data_relasi_masuk"
});
RelasiKrama.belongsTo(User, {
  foreignKey: "user_id",
  as: "pembuat_relasi"
});

User.hasMany(RelasiKrama, {
  foreignKey: "approved_asal_by",
  as: "data_pelepasan_anak"
});
RelasiKrama.belongsTo(User, {
  foreignKey: "approved_asal_by",
  as: "approved_pelepasan"
});

User.hasMany(RelasiKrama, {
  foreignKey: "approved_tujuan_by",
  as: "data_penerimaan_anak"
});
RelasiKrama.belongsTo(User, {
  foreignKey: "approved_tujuan_by",
  as: "approved_penerimaan"
});

DesaAdat.hasMany(RelasiKrama, {
  foreignKey: "desa_adat_id_tujuan",
  as: "asal_ortu_angkat"
});
RelasiKrama.belongsTo(DesaAdat, { 
  foreignKey: "desa_adat_id_tujuan", 
  as: "desa_tujuan" 
});

KramaBali.hasMany(RiwayatPeranAdat, {
  foreignKey: "krama_id",
  as: "riwayat_peran_adat"
});
RiwayatPeranAdat.belongsTo(KramaBali, {
  foreignKey: "krama_id",
  as: "krama_adat"
});

// RELASI MODEL KONTAK DAN NOTIFIKASI
User.hasMany(KontakPesan, {
  foreignKey: "user_id",
  as: "pesan_pengaduan"
});
KontakPesan.belongsTo(User, {
  foreignKey: "user_id",
  as: "user_pengirim"
});

DesaAdat.hasMany(KontakPesan, {
  foreignKey: "desa_adat_id",
  as: "wilayah_adat_pesan"
});
KontakPesan.belongsTo(DesaAdat, {
  foreignKey: "desa_adat_id",
  as: "asal_pesan"
});

User.hasMany(Notifikasi, {
  foreignKey: "sender_id",
  as: "pesan_masuk"
});
Notifikasi.belongsTo(User, {
  foreignKey: "sender_id",
  as: "user_notifikasi"
});

DesaAdat.hasMany(Notifikasi, {
  foreignKey: "desa_adat_id",
  as: "wilayah_adat_notifikasi"
});
Notifikasi.belongsTo(DesaAdat, {
  foreignKey: "desa_adat_id",
  as: "asal_notifikasi"
});

KontakPesan.hasMany(Notifikasi, { 
  foreignKey: 'kontak_pesan_id', 
  as: 'notifikasi_pesan', 
  onDelete: 'CASCADE' 
});
Notifikasi.belongsTo(KontakPesan, { 
  foreignKey: 'kontak_pesan_id', 
  as: 'sumber_pesan' 
});

export {
  User,
  KontakPesan,
  Notifikasi,
  PermohonanRole,
  PermohonanDesa,
  AturanAdatBali,
  KramaBali,
  RelasiKrama,
  Perkawinan,
  Keluarga,
  RiwayatKeluarga,
  RiwayatPeranAdat,
  Provinsi,
  Kabupaten,
  Kecamatan,
  DesaAdat
};