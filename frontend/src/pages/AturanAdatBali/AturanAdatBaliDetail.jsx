import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { IoMdChatboxes } from "react-icons/io";
import { 
  FaArrowLeft, 
  FaGavel,
  FaCalendarAlt,
  FaExclamationTriangle, 
  FaTrash,      
  FaSlidersH,      
  FaInfoCircle,     
  FaShieldAlt,   
  FaEnvelope,
  FaEdit,
  FaComments,
  FaPaperPlane,
  FaTimes,
  FaHistory,
  FaArrowRight,
  FaCheck,
  FaSpinner
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './AturanAdatBaliDetail.module.css';

// Helper: Modal konfirmasi
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing, isActivating }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className="p-6">
          <div className="flex justify-center mb-5">
            <div className={styles.elipsis}>
              {isActivating ? (
                <FaShieldAlt className="text-emerald-600 text-2xl" />
              ) : (
                <FaExclamationTriangle className="text-red-600 text-2xl" />
              )}
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-1">
              {title}
            </h3>
            <p className="text-[13px] text-gray-600">
              {message}
            </p>
          </div>
          <div className="mt-10 flex gap-3 justify-center">
            <button onClick={onClose} disabled={isProcessing} className={styles.btnCancel}>
              Kembali
            </button>
            <button onClick={onConfirm} disabled={isProcessing} className={ isActivating ? styles.btnSave : styles.btnDelete }>
              {isProcessing ? ( 'Memproses...') : isActivating ? (
                <>
                  <FaShieldAlt size={12} /> Ya, Aktifkan
                </>
              ) : (
                <>
                  <FaTrash size={12} /> Ya, Nonaktifkan
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: Membuat format waktu
const formatWaktuRelatif = (dateString) => {
  const tanggalNotif = new Date(dateString);
  const sekarang = new Date();
  const selisihMiliDetik = sekarang - tanggalNotif;
  
  const selisihMenit = Math.floor(selisihMiliDetik / (1000 * 60));
  const selisihJam = Math.floor(selisihMiliDetik / (1000 * 60 * 60));

  if (selisihMenit < 1) return "Baru saja";
  if (selisihMenit < 60) return `${selisihMenit} menit yang lalu`;
  if (selisihJam < 24) return `${selisihJam} jam yang lalu`;
  
  return tanggalNotif.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const AturanAdatBaliDetail = ({ user }) => {
  const { id: slug } = useParams();
  const notifDropdownRef = useRef(null);
  const chatEndRef = useRef(null);
  
  const navigate = useNavigate();
  const location = useLocation();

  const [aturan, setAturan] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [showKomentar, setShowKomentar] = useState(false);
  const [listKomentar, setListKomentar] = useState([]);
  const [inputKomentar, setInputKomentar] = useState('');
  const [isSendingKomentar, setIsSendingKomentar] = useState(false);

  const isPakarOrAdmin = user && ["Super Admin", "Pakar"].includes(user.role);

  // Helper: enkripsi slug url menjadi id asli
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

  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  const [perubahanModal, setPerubahanModal] = useState({
    show: false,
    type: '',
    title: '',
    message: ''
  });

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
        message: error.response?.data?.message || "Terjadi kesalahan pada sistem saat memuat detail aturan adat bali."
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchKomentar = async () => {
    if (!actualId) return;
    try {
      const response = await axiosInstance.get(`/aturan-adat-bali/komentar/${actualId}`);
      setListKomentar(response.data?.data || []);
    } catch (error) {
      console.error("Gagal memuat komentar diskusi:", error);
    }
  };

  const handleKirimKomentar = async (e) => {
    e.preventDefault();
    if (!inputKomentar.trim() || isSendingKomentar) return;

    try {
      setIsSendingKomentar(true);
      await axiosInstance.post('/aturan-adat-bali/komentar', {
        aturan_adat_id: actualId,
        isi_komentar: inputKomentar
      });
      setInputKomentar('');
      await fetchKomentar();
    } catch (error) {
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || "Terjadi kesalahan pada sistem saat mengirimkan komentar."
      });
    } finally {
      setIsSendingKomentar(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  useEffect(() => {
    if (showKomentar) {
      fetchKomentar();
      const interval = setInterval(fetchKomentar, 10000);
      return () => clearInterval(interval);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showKomentar, actualId]);

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [listKomentar]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setAlert({
        show: true,
        type: 'success',
        message: location.state.successMessage
      });
      window.history.replaceState({}, document.title);
    }
  }, [location]);

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HELPER NOTIFIKASI: Mengambil list notifikasi yang masuk
  const fetchNotifikasiLengkap = async () => {
    if (!user) return;
    try {
      const response = await axiosInstance.get('/notifikasi/personal');
      setListNotifikasi(response.data.data || []);
      const unread = response.data.data.filter(n => !n.is_read).length;
      setJumlahNotif(unread);
    } catch (error) {
      console.error("Gagal mengambil list notifikasi masuk", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifikasiLengkap();
    const interval = setInterval(fetchNotifikasiLengkap, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTandaiDibaca = async (notifId) => {
    try {
      await axiosInstance.patch(`/notifikasi/read/${notifId}`);
      await fetchNotifikasiLengkap();
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || "Gagal membaca notifikasi yang masuk.";
      setAlert({ 
        show: true, 
        type: 'error', 
        message: errorMessage 
      });
    }
  };

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

  const formatJamMenit = (dateString) => {
    if (!dateString) return '';
    const tanggal = new Date(dateString);
    
    const jam = tanggal.toLocaleTimeString('id-ID', {
      hour: '2-digit', minute: '2-digit', hour12: false
    }).replace('.', ':');

    return `${jam}`;
  };
  
  const handleToggleStatus = async () => {
    if (!modal.id || !aturan) return;
    setIsDeleting(true); 

    const isCurrentActive = aturan.status_aturan === 'Aktif';
    const endpoint = isCurrentActive ? `/aturan-adat/${modal.id}` : `/aturan-adat/active/${modal.id}`;
    const method = isCurrentActive ? 'delete' : 'patch';

    try {
      await axiosInstance[method](endpoint);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: `Aturan Adat Bali berhasil ${isCurrentActive ? 'dinonaktifkan' : 'diaktifkan'}.` 
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
        message: error.response?.data?.message || `Terjadi kesalahan pada sistem saat memproses perubahan status aturan.` 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper: Trigger membuka modal
  const pemicuApprove = () => {
    setPerubahanModal({
      show: true,
      type: 'approve',
      title: 'Terapkan Struktur Aturan Baru?',
      message: 'Struktur parameter kriteria/kategori yang baru akan langsung diaktifkan dan digunakan untuk menentukan keputusan status peran adat secara otomatis.'
    });
  };

  const pemicuCancel = () => {
    const isSuperAdmin = user?.role === "Super Admin";
    setPerubahanModal({
      show: true,
      type: 'cancel',
      title: isSuperAdmin ? 'Tolak Usulan Perubahan Struktur Aturan?' : 'Batalkan Usulan Perubahan Struktur Aturan?',
      message: isSuperAdmin 
        ? 'Usulan draft perubahan yang diajukan akan dihapus secara permanen dan sistem tetap menggunakan struktur aturan yang lama.'
        : 'Draft usulan perubahan struktur aturan Adat Bali akan ditarik dari antrean verifikasi oleh Super Admin.'
    });
  };

  const handleEksekusiPerubahan = async () => {
    const { type } = perubahanModal;
    setIsProcessingAction(true);
    
    try {
      let response;
      if (type === 'approve') {
        response = await axiosInstance.patch(`/aturan-adat/verifikasi/${actualId}`);
      } else {
        response = await axiosInstance.patch(`/aturan-adat/cancel/${actualId}`);
      }
      setAlert({
        show: true,
        type: 'success',
        message: response.data?.message
      });
      setPerubahanModal(prev => ({ ...prev, show: false }));
      await fetchDetail();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Aktif': 
        return styles.badgeSuccess;
      case 'Non-Aktif': 
        return styles.badgeDanger;
      default: return styles.badgeAmber;
    }
  };

  const renderCardUsulanPerubahan = () => {
    if (!aturan?.is_pending_update || !aturan?.usulan_perubahan) return null;
    const usulan = aturan.usulan_perubahan;
    const isSuperAdmin = user?.role === "Super Admin";

    return (
      <div className={`${styles.cardChange} animate-fade-in`}>
        <div className={styles.cardChangeHeader}>
          <div className="p-2 bg-amber-600 rounded-lg text-white">
            <FaSpinner size={18} className="animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-bold text-amber-900">
              Menunggu Persetujuan Struktur Baru
            </h3>
            <p className="text-xs text-amber-700">
              Aturan adat ini sedang diajukan untuk pembaruan kriteria/kategori
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className={styles.oldArea}>
            <span className={styles.oldAreaTittle}>
              STRUKTUR DATA SAAT INI
            </span>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-[10px] text-gray-400 block">
                  Nama Aturan
                </span>
                <p className="font-semibold text-gray-800">
                  {aturan.nama_aturan}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">
                  Kategori Aturan
                </span>
                <p className={styles.oldKategori}>
                  {aturan.kategori}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">
                  Kriteria Kondisi (JSONB)
                </span>
                <div className={styles.oldKriteria}>
                  {JSON.stringify(aturan.kriteria_kondisi, null, 2)}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.newArea}>
            <span className={styles.newAreaTittle}>
              USULAN PERUBAHAN BARU
            </span>
            <div className="space-y-2 text-sm">
              <div>
                <span className="text-[10px] text-gray-400 block">
                  Nama Aturan
                </span>
                <p className={`font-semibold ${usulan.nama_aturan !== aturan.nama_aturan ? 'text-amber-800' : 'text-gray-800'}`}>
                  {usulan.nama_aturan}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">
                  Kategori Aturan
                </span>
                <p className={`${styles.newKategori} ${usulan.kategori !== aturan.kategori ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                  {usulan.kategori}
                </p>
              </div>
              <div>
                <span className="text-[10px] text-gray-400 block">
                  Kriteria Kondisi (JSONB)
                </span>
                <div className={`${styles.newKriteria} ${
                  JSON.stringify(usulan.kriteria_kondisi) !== JSON.stringify(aturan.kriteria_kondisi)
                    ? 'bg-gray-50 border-amber-300 text-amber-600'
                    : 'bg-gray-50 border-gray-100 text-gray-600'
                }`}>
                  {JSON.stringify(usulan.kriteria_kondisi, null, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-5 pt-4 border-t border-amber-200 flex flex-col sm:flex-row justify-end items-center sm:items-center gap-4">
          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button onClick={pemicuCancel} disabled={isProcessingAction} className={styles.btnRejectModal}>
              {isProcessingAction ? <FaSpinner className="animate-spin" /> : <FaTimes />}
              {isSuperAdmin ? "Tolak Perubahan" : "Batalkan Perubahan"}
            </button>
            {isSuperAdmin && (
              <button onClick={pemicuApprove} disabled={isProcessingAction} className={styles.btnSaveModal}>
                {isProcessingAction ? <FaSpinner className="animate-spin" /> : <FaCheck />}
                Terapkan Perubahan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (showKomentar || modal.show) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => {
      document.body.classList.remove("no-scroll");
    }
  }, [showKomentar, modal.show]);

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
          <div ref={notifDropdownRef} className="relative">
            <div className={styles.notifWrapper} onClick={() => setIsDropdownNotifOpen(!isDropdownNotifOpen)}>
              <MdNotificationsNone className={styles.notifIcon} />
              {jumlahNotif > 0 && <span className={styles.notifBadge}>{jumlahNotif}</span>}
            </div>
            {/* DROPDOWN NOTIFIKASI */}
            {isDropdownNotifOpen && (
              <div className={styles.notifDropdownMenu}>
                <div className={styles.notifDropdownHeader}>
                  <h3 className={styles.notifDropdownHeaderTitle}>
                    Pemberitahuan Sistem
                  </h3>
                  {jumlahNotif > 0 && (
                    <span className={styles.notifDropdownHeaderCount}>
                      {jumlahNotif} Baru
                    </span>
                  )}
                </div>
                <div className={styles.notifDropdownBody}>
                  {!user ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      Silakan login untuk melihat pemberitahuan.
                    </div>
                  ) : listNotifikasi.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      Tidak ada pemberitahuan baru.
                    </div>
                  ) : (
                    <div className={styles.notifListContainer}>
                      {listNotifikasi.map((notif) => {
                        const badgeStyles = {
                          VERIFIKASI: styles.badgeVerifikasi,
                          PERINGATAN: styles.badgePeringatan,
                          KONTAK: styles.badgeKontak,
                          LOG_SISTEM: styles.badgeLogSistem,
                          INFORMASI: styles.badgeInformasi,
                        };
                        const activeBadgeStyle = badgeStyles[notif.kategori] || styles.badgeInformasi;

                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              if (!notif.is_read) handleTandaiDibaca(notif.id);
                              if (notif.tautan_fitur) navigate(notif.tautan_fitur);
                            }}
                            className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`${styles.badgeBase} ${activeBadgeStyle}`}>
                                  {notif.kategori}
                                </span>
                                <h4 className={notif.is_read ? styles.notifTitleRead : styles.notifTitleUnread}>
                                  {notif.judul}
                                </h4>
                              </div>
                              <p className={styles.notifDeskripsi}>
                                {notif.deskripsi}
                              </p>
                              <span className={styles.notifTime}>
                                {formatWaktuRelatif(notif.createdAt)}
                              </span>
                            </div>
                            {!notif.is_read && (
                              <div className="flex items-start">
                                <span className={styles.dotUnreadIndicator} title="Belum dibaca" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className={styles.navDivider}></div>
          <div className={styles.userSection}>
            <span className={styles.userName}>
              SSAB APP
            </span>
          </div>
        </div>
      </nav>
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleToggleStatus} 
        isProcessing={isDeleting}
        isActivating={aturan?.status_aturan !== 'Aktif'}
        title={aturan?.status_aturan === 'Aktif' ? "Nonaktifkan Aturan Adat Bali" : "Aktifkan Aturan Adat Bali"}
        message={aturan?.status_aturan === 'Aktif' 
          ? "Apakah Anda yakin menonaktifkan aturan ini? Aturan Adat Bali yang dinonaktifkan tidak akan berlaku dalam penentuan keputusan status peran Adat Bali di dalam sistem."
          : "Apakah Anda yakin mengaktifkan aturan ini? Aturan Adat Bali yang diaktifkan dapat digunakan untuk penentuan keputusan status peran Adat Bali di dalam sistem."
        }
      />
      {/* Alert Section */}
      {alert.show && (
        <div className={`alert-section
          ${alert.type === 'success' ? 'border-green-500 bg-green-50' 
            : alert.type === 'error' ? 'border-red-500 bg-red-50'
            : alert.type === 'warning' ? 'border-amber-500 bg-amber-50' 
            : 'border-blue-500 bg-blue-50'}`
          }>
          <div className="flex items-start p-4">
            {/* Icon */}
            <div className="flex-shrink-0 mr-3 text-2xl">
              {alert.type === 'success' && '✅'}
              {alert.type === 'error' && '❌'}
              {alert.type === 'warning' && '⚠️'}
              {alert.type === 'loading' && '⏳'}
            </div>
            {/* Content */}
            <div className="flex-1">
              <h4 className={`font-bold text-sm 
                ${alert.type === 'success' ? 'text-green-800' 
                  : alert.type === 'error' ? 'text-red-800' 
                  : alert.type === 'warning' ? 'text-amber-800'
                  : 'text-blue-800'}`
                }>
                {alert.type === 'success' ? 'Berhasil!' 
                  : alert.type === 'error' ? 'Terjadi Kesalahan!' 
                  : alert.type === 'warning' ? 'Perhatian Adat!'
                  : 'Mohon Tunggu...'
                }
              </h4>
              <p className="text-sm text-gray-600 mt-1">
                {alert.message}
              </p>
            </div>
            {/* Close Button */}
            <button onClick={() => setAlert(prev => ({ ...prev, show: false }))} className="alert-button">
              <span className="text-2xl leading-none">&times;</span>
            </button>
          </div>
          {/* Progress Bar Line */}
          {(alert.type === 'success' || alert.type === 'error' || alert.type === 'warning') && (
            <div className="h-1.5 w-full bg-gray-200">
              <div className={`h-full animate-shrink ${
                alert.type === 'success' ? 'bg-green-500' : 
                alert.type === 'error' ? 'bg-red-500' : 'bg-amber-500'
                }`
              }></div>
            </div>
          )}
        </div>
      )}
      <div className={`${styles.contentArea} mb-10`}>
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
                    Tidak ada kriteria kondisi spesifik yang diatur pada aturan ini
                  </div>
                )}
              </div>
            </div>
            {isPakarOrAdmin && renderCardUsulanPerubahan()}
          </div>
          <div className={styles.rightColumn}>
            <div className={styles.cardSpecial}>
              <div className={styles.cardHeader}>
                <FaInfoCircle className={styles.iconHeader} />
                <h3>Status Dokumen</h3>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.statusContent}>
                  <span className="text-sm text-gray-500 font-bold">
                    Status Aturan
                  </span>
                  <span className={`${styles.badge} ${getStatusClass(aturan?.status_aturan)}`}>
                    {aturan?.status_aturan}
                  </span>
                </div>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 text-xs">
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
                  <div className="flex items-start gap-3 text-xs">
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
                <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-2">
                  {isPakarOrAdmin && (
                    <button onClick={() => setShowKomentar(true)} className={styles.btnChat}>
                      <IoMdChatboxes size={17} /> Diskusi Aturan
                    </button>
                  )}
                  {aturan?.status_aturan === 'Aktif' && user?.role === "Super Admin" && (
                    <button className={styles.btnNonaktif} onClick={() => setModal({ show: true, id: aturan.id })}>
                      <FaTrash size={12} /> Nonaktifkan Aturan
                    </button>
                  )}
                  {aturan?.status_aturan === 'Non-Aktif' && user?.role === "Super Admin" && (
                    <button className={styles.btnAktif} onClick={() => setModal({ show: true, id: aturan.id })}>
                      <FaShieldAlt size={13} /> Aktifkan Aturan
                    </button>
                  )}
                </div>
              </div>
            </div>
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
                    Data pakar tidak dihubungkan
                  </p>
                )}
              </div>
            </div>
            <div>
              {isPakarOrAdmin && (
                <button className={styles.btnEditData} onClick={() => navigate(`/aturan-adat-bali/detail/edit/${slug}`)}>
                  <FaEdit /> Edit Data
                </button>
              )}
              <button className={styles.btnBackNetral} onClick={() => navigate('/aturan-adat-bali')}>
                <FaArrowLeft /> Kembali
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* MODAL KOMENTAR */}
      {showKomentar && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.chatBox} animate-fade-in`}>
            <div className={styles.chatHeaderBox}>
              <div className="flex items-center gap-2">
                <IoMdChatboxes size={20} className="text-amber-200 text-lg mr-1" />
                <div>
                  <h3 className="font-bold text-sm">Ruang Koordinasi Aturan Adat Bali</h3>
                  <p className="text-[10px] text-amber-200 italic line-clamp-1">
                    {aturan?.nama_aturan}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowKomentar(false)} className={styles.iconClose}>
                <FaTimes size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 bg-gray-50 space-y-3">
              {listKomentar.length === 0 ? (
                <div className="text-center py-32 text-gray-400 text-xs italic">
                  Belum ada diskusi. Silakan ketik pesan di bawah untuk memulai koordinasi
                </div>
              ) : (
                listKomentar.map((komentar) => {
                  const isSaya = komentar.user_id === user?.userId;
                  const profilPengirim = komentar.pengirim_komentar;

                  return (
                    <div 
                      key={komentar.id} 
                      className={`flex flex-col ${isSaya ? 'items-end' : 'items-start'}`}>
                      <span className="text-[10px] text-gray-400 mb-0.5 px-1">
                        {profilPengirim?.display_name || 'User4d4t'} • {profilPengirim?.role || 'Anggota'}
                      </span>
                      <div className={`max-w-[85%] rounded-lg p-3 text-sm shadow-sm ${
                        isSaya ? styles.bubbleSaya : styles.bubbleAnda
                      }`}>
                        <p className="leading-relaxed break-words whitespace-pre-line">
                          {komentar.isi_komentar}
                        </p>
                        <span className={`block text-[9px] mt-1 text-right ${isSaya ? 'text-amber-200' : 'text-gray-400'}`}>
                          {formatJamMenit(komentar.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={chatEndRef} />
            </div>
            {/* Area Input Komentar */}
            <form onSubmit={handleKirimKomentar} className={styles.areaInput}>
              <div className="flex gap-2 items-start w-full">
                <textarea
                  value={inputKomentar}
                  onChange={(e) => setInputKomentar(e.target.value)}
                  placeholder="Ketikkan catatan koordinasi struktur aturan..."
                  maxLength={1000}
                  rows={3}
                  className={styles.inputForm}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (inputKomentar.trim() && !isSendingKomentar) {
                        handleKirimKomentar(e);
                      }
                    }
                  }}
                />
                <button 
                  type="submit"
                  disabled={!inputKomentar.trim() || isSendingKomentar}
                  className={styles.buttonForm}>
                  <FaPaperPlane size={14} />
                </button>
              </div>
              <div className="flex justify-end items-center px-1 text-[10px] text-gray-400">
                <span>
                  {inputKomentar.length}/1000 karakter
                </span>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI */}
      {perubahanModal.show && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContainer} animate-fade-in`}>
            <div className="p-6">
              <div className="flex justify-center mb-5">
                <div className={styles.elipsis}>
                  {perubahanModal.type === 'approve' ? (
                    <FaCheck className="text-emerald-600 text-2xl" />
                  ) : (
                    <FaTimes className="text-red-600 text-2xl" />
                  )}
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-black mb-1">
                  {perubahanModal.title}
                </h3>
                <p className="text-[13px] text-gray-600">
                  {perubahanModal.message}
                </p>
              </div>
              <div className="mt-10 flex gap-3 justify-center">
                <button onClick={() => setPerubahanModal(prev => ({ ...prev, show: false }))} disabled={isProcessingAction} className={styles.btnCancel}>
                  Kembali
                </button>
                <button onClick={handleEksekusiPerubahan} disabled={isProcessingAction} className={ perubahanModal.type === 'approve' ? styles.btnSave : styles.btnDelete }>
                  {isProcessingAction ? 'Memproses...' : 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
        )}
      <Footer />
    </div>
  );
};

export default AturanAdatBaliDetail;