import React, { useEffect } from 'react';
import { 
  FaTrash, 
  FaEdit, 
  FaUserCog, 
  FaExclamationCircle,
  FaArrowRight,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaTimes
} from 'react-icons/fa';
import styles from './ModalDetail.module.css';

// Helper: Membuat format tanggal indonesia
const formatDate = (dateString) => {
  if (!dateString) return 'Tidak Diketahui';
  const date = new Date(dateString);
  return isNaN(date.getTime()) 
    ? 'Tidak Diketahui' 
    : date.toLocaleDateString('id-ID', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
};

const ModalDetailKrama = ({ 
  isOpen, 
  onClose, 
  krama, 
  masterDesaMap, 
  wilayahAdatLengkap,
  onEdit, 
  onDelete,
  onCancelUpdate,
  isProcessing
}) => {
  // Effect: Menangani scroll ketika modal ditampilkan
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isOpen]);

  if (!isOpen || !krama) return null;

  // Helper: Mengambil kolom data verifikasi
  const { 
    status_verifikasi, 
    catatan_admin_desa, 
    is_pending_update, 
    data_perubahan,
    nama_lengkap,
    nama_panggilan,
    jenis_kelamin,
    tanggal_lahir,
    status_hidup,
    is_bali,
    tempat_asal_khusus,
    alamat_luar,
    tipe_data
  } = krama;

  // Helper: Mengambil data di dalam data perubahan JSONB
  const renderPerubahanRow = (label, nilaiLama, namaField, type = 'text') => {
    if (!data_perubahan || data_perubahan[namaField] === undefined) return null;

    let nilaiBaru = data_perubahan[namaField];
    let nilaiLamaDiformat = nilaiLama;

    // Kondisi 1: Jika tipe data adalah date
    if (type === 'date') {
      nilaiLamaDiformat = formatDate(nilaiLama);
      nilaiBaru = formatDate(nilaiBaru);
    }
    // Kondisi 2: Jika tipe data adalah boolean
    if (type === 'boolean') {
      nilaiLamaDiformat = nilaiLama ? 'Krama Bali' : 'Krama Luar Bali';
      nilaiBaru = nilaiBaru ? 'Krama Bali' : 'Krama Luar Bali';
    }
    // Kondisi 3: Jika tipe data adalah desa adat id
    if (type === 'desa_adat') {
      // mengambil nama desa adat yang aktif
      if (krama?.wilayah_adat?.nama_desa_adat) {
        nilaiLamaDiformat = `Desa Adat ${krama.wilayah_adat.nama_desa_adat.trim()}`;
      } else {
        nilaiLamaDiformat = wilayahAdatLengkap || 'Tidak Diketahui';
      }
      
      const idBaruStr = String(nilaiBaru);
      const idBaruNum = Number(nilaiBaru);

      // mapping nama desa adat yang baru
      if (masterDesaMap && (masterDesaMap[idBaruStr] || masterDesaMap[idBaruNum])) {
        const namaDesaBaru = masterDesaMap[idBaruStr] || masterDesaMap[idBaruNum];
        nilaiBaru = `Desa Adat ${namaDesaBaru.trim()}`;
      } else {
        nilaiBaru = `${nilaiBaru} (Nama desa adat tidak ditemukan)`;
      }
    }

    if (nilaiLamaDiformat === nilaiBaru) return null;

    return (
      <tr className="hover:bg-gray-50 transition-colors">
        <td className={styles.labelChange}>
          {label}
        </td>
        <td className="p-3 border-r border-gray-100">
          <span className={styles.oldValue} title={nilaiLamaDiformat}>
            {nilaiLamaDiformat ?? '-'}
          </span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <span className={styles.newValue} title={nilaiBaru}>
              {nilaiBaru ?? '-'}
            </span>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <FaUserCog size={18} className="mb-1" /> Status & Pengelolaan Krama
          </h3>
          <button onClick={onClose}>
            <FaTimes size={15} className={styles.iconClose} />
          </button>
        </div>
        <div className="p-6 space-y-5 text-[11px]">
          <div className={styles.cardVerification}>
            <div className="text-center">
              <span className={styles.labelColumn}>
                Status Verifikasi
              </span>
              <span className={`${styles.badge} ${
                status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>
                {status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                {status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                {status_verifikasi === 'Draft' && <FaHourglassHalf size={10} />}
                {status_verifikasi || 'Draft'}
              </span>
            </div>
            <div className="text-center">
              <span className={styles.labelColumn}>
                Status Sinkronisasi
              </span>
              {is_pending_update ? (
                <span className={styles.badgePending}>
                  Menunggu Verifikasi Perubahan
                </span>
              ) : (
                <span className={styles.badgeSuccess}>
                  Data Aktif & Sinkron
                </span>
              )}
            </div>
            {catatan_admin_desa && (
              <div className={styles.noteColumn}>
                <span className={styles.labelColumn}>
                  Catatan Admin Desa
                </span>
                <p className="italic text-black p-1">
                  {catatan_admin_desa}
                </p>
              </div>
            )}
          </div>
          {/* DATA PERUBAHAN */}
          {is_pending_update && data_perubahan && (
            <div className={styles.cardAreaChange}>
              <h4 className={styles.cardTitle}>
                <FaExclamationCircle className={styles.cardIcon} /> 
                Draft Perubahan Data
              </h4>
              <div className={styles.cardTable}>
                <table className={styles.table}>
                  <thead>
                    <tr className={styles.tableHeader}>
                      <th className="p-3 w-1/4">Kategori</th>
                      <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                      <th className="p-3 w-3/8">Usulan Perubahan</th>
                    </tr>
                  </thead>
                  <tbody className={styles.tableBody}>
                    {renderPerubahanRow("Nama Lengkap", nama_lengkap, "nama_lengkap")}
                    {renderPerubahanRow("Nama Panggilan", nama_panggilan, "nama_panggilan")}
                    {renderPerubahanRow("Jenis Kelamin", jenis_kelamin, "jenis_kelamin")}
                    {renderPerubahanRow("Tanggal Lahir", tanggal_lahir, "tanggal_lahir", "date")}
                    {renderPerubahanRow("Status Hidup", status_hidup, "status_hidup")}
                    {renderPerubahanRow("Asal Wilayah", is_bali, "is_bali", "boolean")}
                    {renderPerubahanRow("Desa Adat", krama.desa_adat_id, "desa_adat_id", "desa_adat")}
                    {renderPerubahanRow("Tempat Asal Khusus", tempat_asal_khusus, "tempat_asal_khusus")}
                    {renderPerubahanRow("Alamat Luar", alamat_luar, "alamat_luar")}
                    {renderPerubahanRow("Tipe Data", tipe_data, "tipe_data")}
                  </tbody>
                </table>
              </div>
              <div className={styles.noteBtnGroup}>
                <span>💡</span>
                <p className="italic font-medium">
                  Fitur modifikasi dan penghapusan data dikunci sementara waktu hingga Admin Desa memeriksa dan mengesahkan draft perubahan di atas.
                </p>
              </div>
            </div>
          )}
        </div>
        {/* BUTTON */}
        <div className={styles.btnGroup}>
          {is_pending_update ? (
            <button onClick={onCancelUpdate} disabled={isProcessing}className={styles.btnBatalRed}>
              <FaTimes size={10} /> {isProcessing ? 'Memproses...' : 'Batalkan Perubahan'}
            </button>
          ) : (
            <>
              <button onClick={onEdit} disabled={isProcessing}className={styles.btnEditAmber}>
                <FaEdit /> Edit Identitas
              </button>
              <button onClick={onDelete} disabled={isProcessing}className={styles.btnHapusRed}>
                <FaTrash size={10} /> Hapus Data
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ModalDetailKrama;