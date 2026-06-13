import React, { useEffect } from 'react';
import { 
  FaTrash, 
  FaEdit, 
  FaExclamationCircle,
  FaArrowRight,
  FaCheckCircle,
  FaTimesCircle,
  FaHourglassHalf,
  FaTimes,
  FaUsers,
  FaPlusCircle
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

const ModalDetailRelasi = ({
  isOpen, 
  onClose, 
  relasi, 
  namaAyahLama,
  namaIbuLama,
  namaAnakLama,
  masterKramaMap = {},
  onEdit, 
  onDelete,
  onCancelUpdate,
  onAddRelasi,
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

  if (!isOpen) return null;

  // Helper: Mengambil data di dalam data perubahan JSONB
  const renderPerubahanRow = (label, nilaiLama, namaField, type = 'text') => {
    if (!relasi?.data_perubahan || relasi.data_perubahan[namaField] === undefined) return null;

    let nilaiBaru = relasi.data_perubahan[namaField];
    let nilaiLamaDiformat = nilaiLama;

    if (type === 'date') {
      nilaiLamaDiformat = formatDate(nilaiLama);
      nilaiBaru = formatDate(nilaiBaru);
    }

    if (type === 'krama') {
      nilaiLamaDiformat = nilaiLama || 'Tidak Diketahui';
      const idBaruStr = String(nilaiBaru);
      
      if (masterKramaMap[idBaruStr]) {
        nilaiBaru = masterKramaMap[idBaruStr].trim();
      } else {
        nilaiBaru = `${nilaiBaru} (Nama krama tidak ditemukan)`;
      }
    }

    // Hindari render jika data identik
    if (String(nilaiLamaDiformat).trim() === String(nilaiBaru).trim()) return null;

    return (
      <tr className="hover:bg-gray-50 transition-colors">
        <td className={styles.labelChange}>{label}</td>
        <td className="p-3 border-r border-gray-100">
          <span className={styles.oldValue} title={String(nilaiLamaDiformat)}>
            {nilaiLamaDiformat ?? '-'}
          </span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <span className={styles.newValue} title={String(nilaiBaru)}>
              {nilaiBaru ?? '-'}
            </span>
          </div>
        </td>
      </tr>
    );
  };

  const { 
    status_verifikasi = 'Draft', 
    catatan_admin_desa, 
    is_pending_update, 
    data_perubahan,
    status_hubungan,
    urutan_lahir,
    tanggal_pengangkatan
  } = relasi || {};

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className={styles.modalHeader}>
          <h3 className={styles.modalTitle}>
            <FaUsers size={18} className="mb-1" /> 
            {!relasi ? 'Hubungan Keluarga' : 'Status & Pengelolaan Relasi'}
          </h3>
          <button onClick={onClose} aria-label="Close modal">
            <FaTimes size={15} className={styles.iconClose} />
          </button>
        </div>
        {!relasi ? (
          <>
            <div className="p-8 text-center space-y-4">
              <div className={styles.iconModalEmpty}>
                <FaUsers className="text-gray-500 text-xl" />
              </div>
              <div className="space-y-1">
                <h4 className={styles.titleModalEmpty}>Belum Ada Relasi</h4>
                <p className={styles.descModalEmpty}>
                  Krama ini belum terhubung dengan data silsilah orang tua (Ayah/Ibu) di dalam sistem desa adat.
                </p>
              </div>
            </div>
            <div className={styles.btnGroup}>
              <button onClick={onAddRelasi} disabled={isProcessing} className={styles.btnAddGreen}>
                <FaPlusCircle size={11} /> {isProcessing ? 'Memproses...' : 'Ajukan Relasi'}
              </button>
            </div>
          </>
        ) : (
          <>
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
              {/* DATA PERUBAHAN HUBUNGAN KELUARGA */}
              {is_pending_update && data_perubahan && (
                <div className={styles.cardAreaChange}>
                  <h4 className={styles.cardTitle}>
                    <FaExclamationCircle className={styles.cardIcon} /> 
                    Draft Perubahan Hubungan Keluarga
                  </h4>
                  <div className={styles.cardTable}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHeader}>
                          <th className="p-3 w-1/4">Kategori Relasi</th>
                          <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                          <th className="p-3 w-3/8">Usulan Perubahan</th>
                        </tr>
                      </thead>
                      <tbody className={styles.tableBody}>
                        {renderPerubahanRow("Ayah Kandung/Angkat", namaAyahLama, "ayah_id", "krama")}
                        {renderPerubahanRow("Ibu Kandung/Angkat", namaIbuLama, "ibu_id", "krama")}
                        {renderPerubahanRow("Anak", namaAnakLama, "anak_id", "krama")}
                        {renderPerubahanRow("Status Hubungan", status_hubungan, "status_hubungan")}
                        {renderPerubahanRow("Urutan Lahir (Anak Ke)", urutan_lahir, "urutan_lahir")}
                        {renderPerubahanRow("Tanggal Pengangkatan Anak", tanggal_pengangkatan, "tanggal_pengangkatan", "date")}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.noteBtnGroup}>
                    <span>💡</span>
                    <p className="italic font-medium">
                      Fitur modifikasi dan penghapusan hubungan dikunci sementara waktu hingga Admin Desa memeriksa dan mengesahkan draft perubahan di atas.
                    </p>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.btnGroup}>
              {is_pending_update ? (
                <button onClick={onCancelUpdate} disabled={isProcessing} className={styles.btnBatalRed}>
                  <FaTimes size={10} /> {isProcessing ? 'Memproses...' : 'Batalkan Perubahan'}
                </button>
              ) : (
                <>
                  <button onClick={onEdit} disabled={isProcessing} className={styles.btnEditAmber}>
                    <FaEdit /> Edit Relasi
                  </button>
                  <button onClick={onDelete} disabled={isProcessing} className={styles.btnHapusRed}>
                    <FaTrash size={10} /> Hapus Relasi
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ModalDetailRelasi;