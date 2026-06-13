import React, { useState, useEffect } from 'react';
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

const VerifikasiData = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // State stats data verifikasi
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
  
  // State alert notifikasi global
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
      label: 'Verifikasi Role Pangguna',
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
      path: '/verifikasi-data/desa-adat',
      statusField: 'status_verifikasi', 
      statusMap: {
        pending: ['Menunggu Validasi Berkas', 'Menunggu Verifikasi'],
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
        pending: ['Draft'],
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

  // Helper: Mengambil data dan menjumlahkan stats
  const fetchStats = async () => {
    try {
      setLoading(true);
      const updatedStats = { ...stats };

      for (const key in categories) {
        if (categories[key].show) {
          try {
            const res = await axiosInstance.get(categories[key].endpoint);
            const rawData = res.data?.data || res.data || [];
            const data = Array.isArray(rawData) ? rawData : [];

            const cfg = categories[key];

            // Filter data berdasarkan status verifikasi dari backend
            const pending = data.filter(item => cfg.statusMap.pending.includes(item[cfg.statusField])).length;
            const approved = data.filter(item => cfg.statusMap.approved.includes(item[cfg.statusField])).length;
            const rejected = data.filter(item => cfg.statusMap.rejected.includes(item[cfg.statusField])).length;

            updatedStats[key] = { 
              total: data.length, 
              pending, 
              approved, 
              rejected 
            };
          } catch (error) {
            console.error(`Gagal memuat statistik untuk ${key}`, error);
          }
        }
      }
      setStats(updatedStats);
    } catch (error) {
      console.log(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Gagal memuat beberapa data statistik.' 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Helper: Navigasi path ke halaman masing-masing
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
      {/* Alert Section */}
      {alert.show && (
        <div className={`alert-container
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
            // Card Section
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