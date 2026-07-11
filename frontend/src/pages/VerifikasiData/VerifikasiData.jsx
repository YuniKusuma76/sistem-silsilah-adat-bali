import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; 
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaShieldAlt, 
  FaUniversity, 
  FaUsers, 
  FaNetworkWired, 
  FaHeart, 
  FaArrowRight
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import styles from './VerifikasiData.module.css';

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

const VerifikasiData = ({ user }) => {
  const notifDropdownRef = useRef(null);
  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);
  
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // STATE START VERIFIKASI DATA:
  const [stats, setStats] = useState({
    role: { 
      total: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0 
    },
    desa_adat: { 
      total: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0 
    },
    krama_bali: { 
      total: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0 
    },
    relasi_krama: { 
      total: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0 
    },
    perkawinan: { 
      total: 0, 
      pending: 0, 
      approved: 0, 
      rejected: 0 
    },
  });
  
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const isSuperAdmin = user?.role === 'Super Admin';
  const isAdminDesa = user?.role === 'Admin Desa';

  // Helper: Mendefinisikan kategori verifikasi data
  const categories = {
    role: {
      label: 'Verifikasi Perubahan Role',
      icon: <FaShieldAlt />,
      show: isSuperAdmin,
      endpoint: '/permohonan-role',
      path: '/verifikasi-data/pengajuan-role',
      statusField: 'status_permohonan', 
      statusMap: {
        pending: ['Menunggu'],
        approved: ['Disetujui'],
        rejected: ['Ditolak', 'Dibatalkan']
      }
    },
    desa_adat: {
      label: 'Verifikasi Mutasi Desa Adat',
      icon: <FaUniversity />,
      show: isSuperAdmin || isAdminDesa,
      endpoint: isAdminDesa 
        ? '/permohonan-desa/berkas-desa' 
        : '/permohonan-desa/berkas-pusat',
      path: '/verifikasi-data/pengajuan-desa-adat',
      statusMap: {
        pending: ['Menunggu Validasi Berkas', 'Menunggu Verifikasi', 'Menunggu'],
        approved: ['Berkas Valid', 'Disetujui'],
        rejected: ['Berkas Tidak Valid', 'Ditolak', 'Dibatalkan']
      }
    },
    krama_bali: {
      label: 'Verifikasi Krama Bali',
      icon: <FaUsers />,
      show: isSuperAdmin || isAdminDesa,
      endpoint: '/krama-bali?mode=verification',
      path: '/verifikasi-data/krama-bali',
      statusField: 'status_verifikasi',
      statusMap: {
        pending: ['Draft'],
        approved: ['Disetujui'],
        rejected: ['Ditolak']
      }
    },
    relasi_krama: {
      label: 'Verifikasi Relasi Krama',
      icon: <FaNetworkWired />,
      show: isSuperAdmin || isAdminDesa,
      endpoint: '/relasi-krama?mode=verification',
      path: '/verifikasi-data/relasi-krama',
      statusField: 'status_verifikasi',
      statusMap: {
        pending: ['Draft', 'Menunggu Penerimaan', 'Menunggu Pelepasan'],
        approved: ['Disetujui'],
        rejected: ['Ditolak']
      }
    },
    perkawinan: {
      label: 'Verifikasi Perkawinan',
      icon: <FaHeart />,
      show: isSuperAdmin || isAdminDesa,
      endpoint: '/perkawinan?mode=verification',
      path: '/verifikasi-data/perkawinan',
      statusField: 'status_verifikasi',
      statusMap: {
        pending: ['Draft'],
        approved: ['Disetujui'],
        rejected: ['Ditolak']
      }
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const updatedStats = { ...stats };

      // mengumpulkan semua kategori dan mengeksekusi secara bersamaan
      const activeKeys = Object.keys(categories).filter(key => categories[key].show);
      const promises = activeKeys.map(key => axiosInstance.get(categories[key].endpoint));
      const responses = await Promise.all(promises);

      activeKeys.forEach((key, index) => {
        const res = responses[index];
        const rawData = res.data?.data || res.data || [];
        const data = Array.isArray(rawData) ? rawData : [];

        const cfg = categories[key];

        let pending = 0;
        let approved = 0;
        let rejected = 0;

        data.forEach(item => {
          let statusValue = key === 'desa_adat' 
            ? (isAdminDesa ? item.status_validasi_berkas : item.status_permohonan)
            : item[cfg.statusField];

          if ((key === 'relasi_krama' || key === 'krama_bali' || key === 'perkawinan') && item.is_pending_update) {
            pending++;
          } 

          if (cfg.statusMap.pending.includes(statusValue)) {
            if (!((key === 'relasi_krama' || key === 'krama_bali' || key === 'perkawinan') && item.is_pending_update)) {
              pending++;
            }
          } else if (cfg.statusMap.approved.includes(statusValue)) {
            approved++;
          } else if (cfg.statusMap.rejected.includes(statusValue)) {
            rejected++;
          }
        });

        updatedStats[key] = {
          total: data.length,
          pending,
          approved,
          rejected
        };
      });

      setStats(updatedStats);
    } catch (error) {
      console.log(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Terjadi kesalahan ketika memuat data statistik. Periksa kembali koneksi Anda." 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  const handleNavigate = (path) => {
    console.log(`Navigasi ke halaman: ${path}`);
    navigate(path);
  };

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MENGHITUNG DATA...</p>
      </div>
    );
  }

  return (
    <div className={styles.dashboardContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Dashboard Verifikasi Data
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah ringkasan aktivitas dan perhitungan data verifikasi
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
                              if (notif.tautan_fitur) window.location.href = notif.tautan_fitur;
                            }}
                            className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}
                          >
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
      <div className={styles.contentWrapper}>
        <div className={styles.statsGrid}>
          {Object.keys(categories).map(key => {
            const cat = categories[key];
            if (!cat.show) return null;
            const dataStat = stats[key];
            return (
              <div key={key} className={styles.statsCard}>
                <div className={styles.cardHeader}>
                  <div className={styles.iconBox}>
                    {cat.icon}
                  </div>
                  <h3>{cat.label}</h3>
                </div>
                <div className={styles.countWrapper}>
                  <div className={styles.countItem}>
                    <span className={styles.countValue}>
                      {dataStat.total}
                    </span>
                    <span className={styles.countLabel}>
                      Total Data
                    </span>
                  </div>
                </div>
                <div className={styles.statusDivider}>
                  <div className={styles.subStat} title="Menunggu Verifikasi">
                    <div>
                      <p>Menunggu</p>
                      <strong>{dataStat.pending}</strong>
                    </div>
                  </div>
                  <div className={styles.subStat} title="Telah Disetujui">
                    <div>
                      <p>Disetujui</p>
                      <strong>{dataStat.approved}</strong>
                    </div>
                  </div>
                  <div className={styles.subStat} title="Telah Ditolak">
                    <div>
                      <p>DiTolak</p>
                      <strong>{dataStat.rejected}</strong>
                    </div>
                  </div>
                </div>
                <button className={styles.btnNavigate}onClick={() => handleNavigate(cat.path)}>
                  Lihat Selengkapnya <FaArrowRight className="mb-0.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default VerifikasiData;