import React, { useState, useEffect, useRef } from 'react';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { MdOutlineTerrain, MdNotificationsNone } from 'react-icons/md';
import { 
  FaUsers, 
  FaMapMarkedAlt, 
  FaGavel, 
  FaUserShield, 
  FaCity,
  FaUserCog,    
  FaUserCheck, 
  FaUserGraduate,
  FaUserAstronaut,
  FaUserInjured
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance'; 
import Footer from '../../components/Footer/Footer';
import styles from './Dashboard.module.css';

const Dashboard = ({ user }) => {
  const [jumlahNotif, setJumlahNotif] = useState(0);
  const notifDropdownRef = useRef(null);
  
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState({
    users: 0,
    krama: 0,
    provinsi: 0,
    kabupaten: 0,
    kecamatan: 0,
    desaAdat: 0,
    aturanAdat: 0,
    roleSuperAdmin: 0,
    roleAdminDesa: 0,
    roleKrama: 0,
    rolePakar: 0,
    roleViewer: 0,
  });

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Effect: Menghitung jumlah data setiap route
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const [resUsers, resProv, resKab, resKec, resDesa, resAturan, resKrama] = await Promise.all([
          axiosInstance.get('/users'),
          axiosInstance.get('/provinsi'),
          axiosInstance.get('/kabupaten'),
          axiosInstance.get('/kecamatan'),
          axiosInstance.get('/desa-adat'),
          axiosInstance.get('/aturan-adat'),
          axiosInstance.get('/krama-bali'),
        ]);

        const allUsers = resUsers.data?.data || [];
        const superAdminCount = allUsers.filter(u => u.role === 'Super Admin').length;
        const adminDesaCount = allUsers.filter(u => u.role === 'Admin Desa').length;
        const kramaRoleCount = allUsers.filter(u => u.role === 'Krama').length;
        const pakarCount = allUsers.filter(u => u.role === 'Pakar').length;
        const viewerCount = allUsers.filter(u => u.role === 'Viewer').length;

        setStats({
          users: resUsers.data?.data?.length || 0,
          provinsi: resProv.data?.data?.length || 0,
          kabupaten: resKab.data?.data?.length || 0,
          kecamatan: resKec.data?.data?.length || 0,
          desaAdat: resDesa.data?.data?.length || 0,
          aturanAdat: resAturan.data?.data?.length || 0,
          krama: resKrama.data?.data?.length || 0,
          roleSuperAdmin: superAdminCount,
          roleAdminDesa: adminDesaCount,
          roleKrama: kramaRoleCount,
          rolePakar: pakarCount,
          roleViewer: viewerCount,
        });
      } catch (error) {
        console.error("Gagal mengambil data statistik:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const mainStatConfig = [
    { 
      label: "Total Desa Adat", 
      value: stats.desaAdat, 
      icon: <FaMapMarkedAlt />, 
      color: "#e74a3b" 
    },{ 
      label: "Total Kecamatan", 
      value: stats.kecamatan, 
      icon: <HiOutlineOfficeBuilding />, 
      color: "#fd7e14" 
    },{ 
      label: "Total Kabupaten", 
      value: stats.kabupaten, 
      icon: <FaCity />, 
      color: "#6610f2" 
    },{ 
      label: "Total Provinsi", 
      value: stats.provinsi, 
      icon: <MdOutlineTerrain />, 
      color: "#36b9cc" 
    },{ 
      label: "Total Aturan Adat", 
      value: stats.aturanAdat, 
      icon: <FaGavel />, 
      color: "#f6c23e" 
    },{ 
      label: "Total User", 
      value: stats.users, 
      icon: <FaUserShield />, 
      color: "#4e73df" 
    },{ 
      label: "Total Krama Bali", 
      value: stats.krama, 
      icon: <FaUsers />, 
      color: "#1cc88a" 
    },
  ];

  const roleStatConfig = [
    { 
      label: "Role Super Admin", 
      value: stats.roleSuperAdmin, 
      icon: <FaUserCog />, 
      color: "#2c3e50" 
    },{ 
      label: "Role Admin Desa", 
      value: stats.roleAdminDesa, 
      icon: <FaUserCheck />, 
      color: "#27ae60" 
    },{ 
      label: "Role Pakar", 
      value: stats.rolePakar, 
      icon: <FaUserGraduate />, 
      color: "#d35400" 
    },{ 
      label: "Role Krama", 
      value: stats.roleKrama, 
      icon: <FaUsers />, 
      color: "#2980b9" 
    },{ 
      label: "Role Viewer", 
      value: stats.roleViewer, 
      icon: <FaUserShield />, 
      color: "#7f8c8d" 
    },
  ];

  // Effect: Menutup dropdown ketika klik di luar area input
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: Mengambil list notifikasi yang masuk
  const fetchNotifikasiLengkap = async () => {
    if (!user) return;
    try {
      const response = await axiosInstance.get('/notifikasi/personal');
      setListNotifikasi(response.data.data || []);
      const unread = response.data.data.filter(n => !n.is_read).length;
      setJumlahNotif(unread);
    } catch (error) {
      console.error("Gagal mengambil daftar notifikasi", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifikasiLengkap();
    const interval = setInterval(fetchNotifikasiLengkap, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Helper: Menandai notifikasi telah dibaca
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
      {/* Navbar */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Dashboard Overview
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah ringkatan aktivitas data silsilah adat bali
          </p>
        </div>
        <div className={styles.navRight}>
          <div ref={notifDropdownRef} className="relative">
            <div className={styles.notifWrapper} onClick={() => setIsDropdownNotifOpen(!isDropdownNotifOpen)}>
              <MdNotificationsNone className={styles.notifIcon} />
              {jumlahNotif > 0 && <span className={styles.notifBadge}>{jumlahNotif}</span>}
            </div>
            {/* PANEL DROPDOWN NOTIFIKASI MELAYANG */}
            {isDropdownNotifOpen && (
              <div className={styles.notifDropdownMenu}>
                <div className={styles.notifDropdownHeader}>
                  <h3 className="text-sm font-bold text-gray-800">
                    Pemberitahuan Sistem
                  </h3>
                </div>
                <div className={styles.notifDropdownBody}>
                  {!user ? (
                    <div className="text-center py-6 text-gray-400 italic text-xs">
                      Silakan login untuk melihat pemberitahuan.
                    </div>
                  ) : listNotifikasi.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 italic text-xs">
                      Tidak ada pemberitahuan baru.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
                      {listNotifikasi.map((notif) => (
                        <div key={notif.id} className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}>
                          <div className="flex-1 pr-2">
                            <div className="flex items-center space-x-1.5 mb-1">
                              <span className={styles.badgeKategoriKecil}>
                                {notif.kategori}
                              </span>
                              <h4 className="text-xs font-bold text-gray-900 truncate max-w-[180px]">
                                {notif.judul}
                              </h4>
                            </div>
                            <p className="text-[11px] text-gray-600 leading-normal">
                              {notif.deskripsi}
                            </p>
                            <span className="text-[9px] text-gray-400 block mt-1">
                              {new Date(notif.createdAt).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          {!notif.is_read && (
                            <button onClick={() => handleTandaiDibaca(notif.id)}className={styles.btnReadKecil}>
                              Baca
                            </button>
                          )}
                        </div>
                      ))}
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
      {/* Alert Action */}
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
      {/* Content */}
      <div className={styles.contentWrapper}>
        {/* STATISTIK WILAYAH & DATA INTI ADAT */}
        <div className={styles.sectionBlock}>
          <div className={styles.sectionHeader}>
            <h3>Statistik Logistik & Geografis Adat</h3>
          </div>
          <div className={styles.statsGrid}>
            {mainStatConfig.map((item, index) => (
              <div key={index} className={styles.statCard}>
                <div className={styles.iconWrapper} style={{ backgroundColor: item.color }}>
                  {item.icon}
                </div>
                <div className={styles.info}>
                  <span className={styles.statLabel}>{item.label}</span>
                  <h2 className={styles.statValue}>{item.value.toLocaleString()}</h2>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* STATISTIK BREAKDOWN ROLE AKUN PENGGUNA */}
        <div className={`${styles.sectionBlock} mt-8`}>
          <div className={styles.sectionHeader}>
            <h3>Ringkasan Distribusi Role Pengguna</h3>
          </div>
          <div className={styles.statsGrid}>
            {roleStatConfig.map((item, index) => (
              <div key={index} className={styles.statCard}>
                <div className={styles.iconWrapper} style={{ backgroundColor: item.color }}>
                  {item.icon}
                </div>
                <div className={styles.info}>
                  <span className={styles.statLabel}>{item.label}</span>
                  <h2 className={styles.statValue}>{item.value.toLocaleString()}</h2>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className={styles.footerContainer}>
        <Footer />
      </div>
    </div>
  );
};

export default Dashboard;