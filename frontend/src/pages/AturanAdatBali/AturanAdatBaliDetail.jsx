import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaGavel,
  FaCalendarAlt,
  FaExclamationTriangle, 
  FaTrash,      
  FaSlidersH,      
  FaInfoCircle,     
  FaShieldAlt,   
  FaUser,   
  FaEnvelope,
  FaEdit
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './AturanAdatBaliDetail.module.css';

// Helper: Modal konfirmasi
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className="p-6">
          <div className="flex justify-center mb-5">
            <div className={styles.elipsis}>
              <FaExclamationTriangle className="text-red-600 text-2xl" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600">
              {message}
            </p>
          </div>
          <div className="mt-10 flex gap-3 justify-center">
            <button onClick={onClose} disabled={isProcessing} className={styles.btnCancel}>
              Kembali
            </button>
            <button onClick={onConfirm} disabled={isProcessing} className={styles.btnDelete}>
              <FaTrash size={12} /> {isProcessing ? 'Memproses...' : 'Ya, Nonaktifkan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AturanAdatBaliDetail = ({ user }) => {
  const { id: slug } = useParams();
  const navigate = useNavigate();

  const [aturan, setAturan] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper: Decode slug id ke id asli
  const getActualId = () => {
    try {
      const parts = slug.split('-');
      const encodedId = parts[parts.length - 1];
      return atob(encodedId);
    } catch (error) {
      console.error(error);
      return slug; 
    }
  };

  const actualId = getActualId();

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // State menampilkan modal konfirmasi
  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  // Helper: Fungsi mengambil detail data aturan
  const fetchDetail = async () => {
    if (!actualId) return;
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/aturan-adat/${actualId}`);
      setAturan(response.data?.data || null);
    } catch (error) {
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || "Gagal memuat detail aturan adat bali."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  // Helper: Format tampilan tanggal dan waktu
  const formatDate = (dateString) => {
    if (!dateString) return '-';

    const date = new Date(dateString);
    const datePart = date.toLocaleDateString('id-ID', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    const timePart = date.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace('.', ':');

    return `${datePart} ${timePart} WITA`;
  };
  
  // Halper: Fungsi menonaktifkan aturan adat bali
  const handleDelete = async () => {
    if (!modal.id) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/aturan-adat/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: "Aturan Adat Bali berhasil dinonaktifkan." 
      });
      setModal({ 
        show: false, 
        id: null 
      });
      fetchDetail();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal menonaktifkan aturan adat bali." 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Halper: Style badge status aturan
  const getStatusClass = (status) => {
    switch (status) {
      case 'Aktif': return styles.badgeSuccess;
      case 'Non-Aktif': return styles.badgeDanger;
      default: return styles.badgeAmber;
    }
  };

  // Effect: Auto-close alert
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => setAlert(prev => ({ 
        ...prev, 
        show: false 
      })), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MEMUAT DATA...</p>
      </div>
    );
  }

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Aturan Adat Bali
          </h2>
          <p className={styles.navSubtitle}>
            Rincian data aturan Adat Bali yang menentukan status peran adat di Bali
          </p>
        </div>
        <div className={styles.navRight}>
          <div className={styles.notifWrapper}>
            <MdNotificationsNone className={styles.notifIcon} />
            <span className={styles.notifBadge}>3</span>
          </div>
          <div className={styles.navDivider}></div>
          <div className={styles.userSection}>
            <span className={styles.userName}>
              SSAB APP
            </span>
          </div>
        </div>
      </nav>
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleDelete}
        isProcessing={isDeleting}
        title="Nonaktifkan Aturan?"
        message="Aturan Adat Bali yang dinonaktifkan tidak akan berlaku dalam penentuan keputusan status peran adat Bali."
      />
      {/* Alert Section */}
      {alert.show && (
        <div className={`alert-section 
          ${alert.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
          <div className="flex items-start p-4">
            <div className="flex-shrink-0 mr-3 mt-2 text-2xl">
              {alert.type === 'success' ? '✅' : '⚠️'}
            </div>
            <div className="flex-1">
              <h4 className={`font-bold text-sm ${alert.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {alert.type === 'success' ? 'Berhasil!' : 'Terjadi Kesalahan.'}
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {alert.message}
              </p>
            </div>
            <button onClick={() => setAlert(prev => ({ ...prev, show: false }))} className="alert-button">
              &times;
            </button>
          </div>
          {(alert.type === 'success' || alert.type === 'error') && (
            <div className="h-1.5 w-full bg-gray-200">
              <div className={`h-full animate-shrink ${alert.type === 'success' 
                ? 'bg-green-500' 
                : 'bg-red-500'}`}>
              </div>
            </div>
          )}
        </div>
      )}
      <div className={`${styles.contentArea} mb-10`}>
        {/* Kondisi dan Status Aturan */}
        <div className={styles.headerArea}>
          <div className={styles.headerTitleSection}>
            <span className={styles.categoryBadge}>
              {aturan?.kategori}
            </span>
            <h1 className={styles.mainTitle}>
              {aturan?.nama_aturan}
            </h1>
          </div>
        </div>
        <div className={styles.contentGrid}>
          {/* Detail Inti Aturan */}
          <div className={styles.leftColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FaGavel className={styles.iconHeader} />
                <h3>Hasil Keputusan & Peran Adat</h3>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.infoRow}>
                  <label>Status Peran Adat</label>
                  <p className="text-lg font-bold text-amber-950">
                    {aturan?.status_peran_adat || '-'}
                  </p>
                </div>
                <div className={styles.infoRow}>
                  <label>Garis Keturunan</label>
                  <p className="font-semibold text-gray-800">
                    {aturan?.garis_keturunan || '-'}
                  </p>
                </div>
                <div className={styles.infoRow}>
                  <label>Dasar Keputusan</label>
                  <div className={styles.boxDescription}>
                    {aturan?.dasar_keputusan || 'Tidak ada penjelasan dasar keputusan.'}
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FaSlidersH className={styles.iconHeader} />
                <h3>Kriteria & Parameter Kondisi</h3>
              </div>
              <div className={styles.cardBody}>
                <p className="text-xs text-gray-500 italic mb-1 ml-1">
                  *Parameter di bawah ini digunakan sistem untuk mengevaluasi status peran adat secara otomatis.
                </p>
                {aturan?.kriteria_kondisi && Object.keys(aturan.kriteria_kondisi).length > 0 ? (
                  <div className={styles.tableResponsive}>
                    <table className={styles.paramTable}>
                      <thead>
                        <tr>
                          <th>Nama Parameter</th>
                          <th>Nilai Kondisi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(aturan.kriteria_kondisi).map(([key, value]) => (
                          <tr key={key}>
                            <td className="font-mono text-sm text-gray-600">
                              {key}
                            </td>
                            <td>
                              <span className={styles.paramValueBadge}>
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className={styles.nullKriteria}>
                    Tidak ada kriteria kondisi spesifik yang diatur.
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className={styles.rightColumn}>
            {/* Status & Waktu */}
            <div className={styles.cardSpecial}>
              <div className={styles.cardHeader}>
                <FaInfoCircle className={styles.iconHeader} />
                <h3>Status Dokumen</h3>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.statusContent}>
                  <span className="text-sm text-gray-500 font-medium">
                    Status Aturan
                  </span>
                  <span className={`${styles.badge} ${getStatusClass(aturan?.status_aturan)}`}>
                    {aturan?.status_aturan}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-sm">
                    <FaCalendarAlt className="text-gray-400 mt-3" />
                    <div>
                      <span className="block text-xs text-gray-400">
                        Dibuat Pada
                      </span>
                      <span className="text-gray-700 font-medium">
                        {formatDate(aturan?.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <FaCalendarAlt className="text-gray-400 mt-3" />
                    <div>
                      <span className="block text-xs text-gray-400">
                        Terakhir Diperbarui
                      </span>
                      <span className="text-gray-700 font-medium">
                        {formatDate(aturan?.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
                {aturan?.status_aturan === 'Aktif' && (
                  <div className="mt-6 pt-4 border-t border-gray-100">
                    <button className={styles.btnNonaktif} onClick={() => setModal({ show: true, id: aturan.id })}>
                      <FaTrash size={12} /> Nonaktifkan Aturan
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Data Pakar */}
            <div className={styles.cardSpecial}>
              <div className={styles.cardHeader}>
                <FaShieldAlt className={styles.iconHeader} />
                <h3>Pakar Penanggung Jawab</h3>
              </div>
              <div className={styles.cardBody}>
                {aturan?.pakar_aturan ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className={styles.avatarPlaceholder}>
                        {user.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) || 
                          user.fullName?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)|| "U"
                        }
                      </div>
                      <div>
                        <h4 className={styles.namaPakar}>
                          {aturan.pakar_aturan.full_name}
                        </h4>
                        <span className={styles.roleBadge}>
                          {aturan.pakar_aturan.role}
                        </span>
                      </div>
                    </div>
                    <div className={styles.emailPakar}>
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <FaEnvelope className="text-gray-400" />
                        <span>{aturan.pakar_aturan.email}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic text-center">
                    Data pakar tidak disematkan.
                  </p>
                )}
              </div>
            </div>
            <div>
              <button className={styles.btnEditData} onClick={() => navigate(`/aturan-adat-bali/detail/edit/${slug}`)}>
                <FaEdit /> Edit Data
              </button>
              <button className={styles.btnBackNetral} onClick={() => navigate('/aturan-adat-bali')}>
                <FaArrowLeft /> Kembali
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AturanAdatBaliDetail;