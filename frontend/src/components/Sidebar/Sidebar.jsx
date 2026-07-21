import React, { useState, useEffect, useRef } from 'react';
import styles from './Sidebar.module.css';
import { Link, useLocation } from 'react-router-dom';
import { GrDocumentConfig, GrDocumentUser } from "react-icons/gr";
import { LuNetwork, LuUserPen } from "react-icons/lu";
import { FaMapLocationDot } from "react-icons/fa6";
import { 
  MdDashboard, 
  MdApproval,
  MdOutlineEditLocationAlt,
  MdLiveHelp,
  MdMoveToInbox 
} from "react-icons/md";
import { 
  FaHome, 
  FaUsers, 
  FaEnvelope,
  FaChevronRight,
  FaUser,
  FaUserCog,
  FaSignOutAlt
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';;

const SIDEBAR_MENU = {
  Guest: [
    { 
      path: "/home", 
      label: "Home", 
      icon: <FaHome size={18} /> 
    },{ 
      path: "/treh-bali", 
      label: "Treh Bali", 
      icon: <LuNetwork size={18} /> 
    },{ 
      path: "/pusat-bantuan", 
      label: "Pusat Bantuan", 
      icon: <MdLiveHelp size={18} /> 
    }
  ],

  Viewer: [
    { 
      path: "/home", 
      label: "Home", 
      icon: <FaHome size={18} /> 
    },{ 
      path: "/krama-bali", 
      label: "Data Krama Bali", 
      icon: <FaUsers size={18} /> 
    },{ 
      path: "/pengajuan-role/my-data", 
      label: "Pengajuan Role", 
      icon: <LuUserPen size={18} /> 
    },{ 
      path: "/pengajuan-desa-adat/my-data", 
      label: "Pengajuan Desa Adat", 
      icon: <MdOutlineEditLocationAlt size={18} /> 
    },{ 
      path: "/pusat-bantuan", 
      label: "Pusat Bantuan", 
      icon: <MdLiveHelp size={18} /> 
    }
  ],

  Pakar: [
    { 
      path: "/home", 
      label: "Home", 
      icon: <FaHome size={18} /> 
    },{ 
      path: "/krama-bali", 
      label: "Data Krama Bali", 
      icon: <FaUsers size={18} /> 
    },{ 
      path: "/aturan-adat-bali", 
      label: "Aturan Adat Bali", 
      icon: <GrDocumentConfig size={18} /> 
    },{ 
      path: "/pengajuan-role/my-data", 
      label: "Pengajuan Role", 
      icon: <LuUserPen size={18} /> 
    },{ 
      path: "/pusat-bantuan", 
      label: "Pusat Bantuan", 
      icon: <MdLiveHelp size={18} /> 
    }
  ],

  Krama: [
    { 
      path: "/home", 
      label: "Home", 
      icon: <FaHome size={18} /> 
    },{ 
      path: "/krama-bali", 
      label: "Data Krama Bali", 
      icon: <FaUsers size={18} /> 
    },{ 
      path: "/pengajuan-role/my-data", 
      label: "Pengajuan Role", 
      icon: <LuUserPen size={18} /> 
    },{ 
      path: "/pengajuan-desa-adat/my-data", 
      label: "Pengajuan Desa Adat", 
      icon: <MdOutlineEditLocationAlt size={18} /> 
    },{ 
      path: "/pusat-bantuan", 
      label: "Pusat Bantuan", 
      icon: <MdLiveHelp size={18} /> 
    }
  ],

  "Admin Desa": [
    { 
      path: "/dashboard", 
      label: "Dashboard", 
      icon: <MdDashboard size={18} /> 
    },{ 
      type: "divider" 
    },{ 
      path: "/krama-bali", 
      label: "Data Krama Bali", 
      icon: <FaUsers size={18} /> 
    },{ 
      path: "/aturan-adat-bali", 
      label: "Aturan Adat Bali", 
      icon: <GrDocumentConfig size={18} /> 
    },{ 
      path: "/wilayah-adat-bali", 
      label: "Wilayah Adat Bali", 
      icon: <FaMapLocationDot size={18} /> 
    },{ 
      type: "divider" 
    },{ 
      path: "/user-pengguna", 
      label: "Data Akun Pengguna", 
      icon: <FaUserCog size={18} /> 
    },{ 
      path: "/verifikasi-data", 
      label: "Verifikasi Data", 
      icon: <MdApproval size={18} /> 
    },{ 
      path: "/pengajuan-role/my-data", 
      label: "Pengajuan Role", 
      icon: <LuUserPen size={18} /> 
    },{ 
      path: "/pesan-masuk", 
      label: "Laporan & Pesan Masuk", 
      icon: <MdMoveToInbox  size={18} /> 
    }
  ],

  "Super Admin": [
    { 
      path: "/dashboard", 
      label: "Dashboard", 
      icon: <MdDashboard size={18} /> 
    },{ 
      type: "divider" 
    },{ 
      path: "/krama-bali", 
      label: "Data Krama Bali", 
      icon: <FaUsers size={18} /> 
    },{ 
      path: "/aturan-adat-bali", 
      label: "Aturan Adat Bali", 
      icon: <GrDocumentConfig size={18} /> 
    },{ 
      path: "/wilayah-adat-bali", 
      label: "Wilayah Adat Bali", 
      icon: <FaMapLocationDot size={18} /> 
    },{ 
      type: "divider" 
    },{ 
      path: "/user-pengguna", 
      label: "Data Akun Pengguna", 
      icon: <FaUserCog size={18} /> 
    },{ 
      path: "/verifikasi-data", 
      label: "Verifikasi Data", 
      icon: <MdApproval size={18} /> 
    },{ 
      path: "/pesan-masuk", 
      label: "Laporan & Pesan Masuk", 
      icon: <MdMoveToInbox  size={18} /> 
    }
  ]
};

const Sidebar = ({ user, onLoginClick, onRegisterClick, onLogout }) => {
  const dropdownRef = useRef(null);
  const location = useLocation();
  const currentPath = location.pathname;

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [localDisplayName, setLocalDisplayName] = useState('');

  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalDisplayName(user.display_name || user.displayName);
    }
  }, [user]);

  const refreshSidebarProfile = async () => {
    try {
      const response = await axiosInstance.get('/users/profile');
      const updatedUser = response.data.data.user || response.data.data;
      setLocalDisplayName(updatedUser.display_name);
    } catch (error) {
      console.error("Gagal melakukan refresh pada sidebar:", error);
    }
  };

  useEffect(() => {
    window.addEventListener("profileUpdated", refreshSidebarProfile);
    return () => {
      window.removeEventListener("profileUpdated", refreshSidebarProfile);
    };
  }, []);

  const role = user?.role || "Guest";

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleLogoutClick = () => {
    setIsDropdownOpen(false);
    if (onLogout) {
      onLogout();
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <>
      <div className={styles.sidebar}>
        <div className={styles.logoContainer}>
          <div className={styles.sidebarLogo}>
            <img src="/logo.webp" alt="Sistem Silsilah Adat Bali" className="object-contain max-h-full" />
          </div>
        </div>
        {user ? (
          <div className={styles.loginBorder} ref={dropdownRef}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className={styles.borderProfile}>
                  <div className={styles.defaultAvatar}>
                    {user.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) || 
                      user.fullName?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)|| "U"
                    }
                  </div>
                </div>
                <div className={styles.circleGreen}></div>
              </div>
              <div className="flex-1 cursor-pointer" onClick={toggleDropdown}>
                <div className={styles.boxUsername}>
                  <h3 className="font-bold text-white text-sm select-none">
                    {localDisplayName}
                  </h3>
                  <FaChevronRight size={12} className={`${styles.clickToggle} ${isDropdownOpen ? 'rotate-90' : ''}`} />
                </div>
                <div className="flex items-center gap-1">
                  <span className={styles.textGreen}>
                    Online • {user.role}
                  </span>
                </div>
              </div>
            </div>
            {isDropdownOpen && (
              <div className={`${styles.dropdown} animate-fade-in-down`}>
                <Link to="/profile" className={styles.profile} onClick={() => setIsDropdownOpen(false)}>
                  <div className={styles.profileContent}>
                    <FaUser className="text-gray-700" size={16} />
                    <span className="text-gray-800 text-sm font-bold">
                      Profile
                    </span>
                  </div>
                </Link>
                <div onClick={handleLogoutClick} className={styles.logoutContent}>
                  <FaSignOutAlt className="text-red-600" size={16} /> 
                  <span className="text-red-600 text-sm font-bold">
                    Logout
                  </span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className={styles.authContainer}>
            <button onClick={onLoginClick} className={styles.authButtonLogin}>
              LOGIN
            </button>
            <button onClick={onRegisterClick} className={styles.authButtonRegister}>
              REGISTER
            </button>
          </div>
        )}
        {/* Fitur Aplikasi */}
        <nav className={styles.sidebarScroll}>
          <ul>
            {(SIDEBAR_MENU[role] || SIDEBAR_MENU.Guest).map((menu, index) => {
              if (menu.type === "divider") {
                return <li key={index} className={styles.sidebarDivider}></li>;
              }
              const isActive = menu.path === '/home' 
                ? currentPath === '/home'
                : currentPath.startsWith(menu.path);

              return (
                <li key={index} className={`${styles.menuItem} ${isActive ? styles.isActive : styles.notActive}`}>
                  <Link to={menu.path} className="flex items-center w-full px-6 py-4">
                    <span className="mr-4">{menu.icon}</span>
                    <span className="text-sm font-bold tracking-wide">{menu.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
};

export default Sidebar;