import React, { useState, useEffect } from 'react';
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

const Dashboard = () => {
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