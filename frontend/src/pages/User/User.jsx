import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { MdNotificationsNone, MdAddLocationAlt } from 'react-icons/md';
import { 
  FaSearch, 
  FaPlus, 
  FaTrash, 
  FaExclamationTriangle,
  FaInfoCircle,
  FaListUl,      
  FaCheckCircle,  
  FaTimesCircle,
  FaUserCheck,   
  FaTimes,      
  FaMapMarkerAlt, 
  FaLock,         
  FaEye,          
  FaEyeSlash,     
  FaSave,
  FaChevronDown
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './User.module.css';

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

// Helper: Membuat slug url
const createSlug = (users, date, id) => {
  if (!users) return `user_${id}`;
  const usersSlug = users.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');
  let dateFormatted;
  try {
    const parsedDate = date ? new Date(date) : new Date();
    dateFormatted = isNaN(parsedDate.getTime()) 
      ? new Date().toISOString().split('T')[0] 
      : parsedDate.toISOString().split('T')[0];
  } catch (error) {
    console.error(error);
    dateFormatted = new Date().toISOString().split('T')[0];
  }
  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${usersSlug}-${dateFormatted}_${encodedId}`;
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

const User = ({ user }) => {
  const dropdownRef = useRef(null);
  const notifDropdownRef = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();

  const [dataUser, setDataUser] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchDesa, setSearchDesa] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);

  const [showDropdown, setShowDropdown] = useState(false);
  const [daftarDesaAdat, setDaftarDesaAdat] = useState([]);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'Viewer',
    desa_adat_id: '',
    password: '',
    confirmPassword: ''
  });

  const [infoWilayah, setInfoWilayah] = useState({
    kecamatan: '',
    kabupaten: '',
    provinsi: ''
  });
  
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  const fetchDataUser = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/users/conditional');
      setDataUser(response.data?.data || []);
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memuat data user." 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDataUser();
  }, []);

  useEffect(() => {
    const fetchDesaAdat = async () => {
      try {
        const response = await axiosInstance.get(`/desa-adat`);
        const data = response.data?.data || response.data || [];
        setDaftarDesaAdat(data);
      } catch (error) {
        console.error("Gagal memuat data desa adat:", error);
      }
    };
    fetchDesaAdat();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // HELPER NOTIFIKASI: mengambil list notifikasi yang masuk
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
    if (showAddModal || modal.show) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => {
      document.body.classList.remove("no-scroll");
    }
  }, [showAddModal, modal.show]);

  const desaFiltered = searchDesa.trim() === "" ? daftarDesaAdat : daftarDesaAdat.filter((desa) => {
    const namaDesa = (desa.nama_desa_adat || desa.nama_desa || desa.nama || '').toLowerCase();
    return namaDesa.includes(searchDesa.toLowerCase());
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ 
      ...prev, [name]: value 
    }));
  };

  const handleSelectDesa = async (desa) => {
    const namaTerpilih = desa.nama_desa_adat || desa.nama_desa || desa.nama;
    setSearchDesa(namaTerpilih);
    setShowDropdown(false);
    
    setFormData((prev) => ({ 
      ...prev, 
      desa_adat_id: desa.id 
    }));
    setInfoWilayah({
      kecamatan: 'Memuat...', 
      kabupaten: 'Memuat...', 
      provinsi: 'Memuat...' 
    });
    try {
      const resKec = await axiosInstance.get(`/kecamatan/${desa.kecamatan_id}`);
      const dataKec = resKec.data?.data || resKec.data;

      if (!dataKec?.kabupaten_id) {
        throw new Error("Kabupaten tidak ditemukan");
      }

      const resKab = await axiosInstance.get(`/kabupaten/${dataKec.kabupaten_id}`);
      const dataKab = resKab.data?.data || resKab.data;

      if (!dataKab?.provinsi_id) {
        throw new Error("Provinsi tidak ditemukan");
      }

      const resProv = await axiosInstance.get(`/provinsi/${dataKab.provinsi_id}`);
      const dataProv = resProv.data?.data || resProv.data;

      setInfoWilayah({
        kecamatan: dataKec.nama_kecamatan || '-',
        kabupaten: dataKab.nama_kabupaten || '-',
        provinsi: dataProv.nama_provinsi || '-'
      });
    } catch (error) {
      console.error("Gagal melakukan auto-fill wilayah:", error);
      setInfoWilayah({ 
        kecamatan: 'Gagal memuat', 
        kabupaten: 'Gagal memuat', 
        provinsi: 'Gagal memuat' 
      });
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setFormData({
      full_name: '',
      email: '',
      role: 'Viewer',
      desa_adat_id: '',
      password: '',
      confirmPassword: ''
    });
    setSearchDesa('');
    setInfoWilayah({
      kecamatan: '',
      kabupaten: '',
      provinsi: ''
    });
    setShowDropdown(false);
  };

  // SUBMIT DATA USER:
  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!formData.full_name || !formData.email) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Nama lengkap dan email wajib diisi!' 
      });
      return;
    }

    if (formData.password.length < 6) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Password baru minimal harus 6 karakter!' 
      });
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Konfirmasi password tidak cocok!' 
      });
      return;
    }

    const butuhDesa = ["Admin Desa", "Krama", "Viewer"].includes(formData.role);
    if (butuhDesa && !formData.desa_adat_id) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Silakan pilih Desa Adat yang valid dari daftar!' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.post(`/users`, {
        full_name: formData.full_name,
        email: formData.email,
        role: formData.role,
        desa_adat_id: butuhDesa ? parseInt(formData.desa_adat_id) : null,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });

      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Akun pengguna baru berhasil didaftarkan!' 
      });
      setShowAddModal(false);
      
      setFormData({ 
        full_name: '', 
        email: '', 
        role: 'Viewer', 
        desa_adat_id: '', 
        password: '', 
        confirmPassword: '' 
      });
      setSearchDesa('');
      setInfoWilayah({ 
        kecamatan: '', 
        kabupaten: '', 
        provinsi: '' 
      });
      fetchDataUser();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal membuat akun user.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleDeleteUser = async () => {
    if (!modal.id) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/users/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: "Akun user berhasil dinonaktifkan." 
      });
      fetchDataUser();
      setModal({ 
        show: false, 
        id: null 
      });
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal menonaktifkan akun user." 
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper: Fungsi search filter aturan
  const filteredDataUser = dataUser.filter(item => 
    item.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper: Menghitung jumlah aturan
  const totalUserCount = dataUser.length;
  const aktifUserCount = dataUser.filter(item => item.status_akun === 'Aktif').length;
  const nonAktifUserCount = dataUser.filter(item => item.status_akun === 'Non-Aktif').length;

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredDataUser.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredDataUser.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Helper: Merender halaman pagination
  const renderPageNumbers = () => {
    const pageNumbers = [];
    if (totalPages <= 2) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      pageNumbers.push(1);
      // Menentukan range halaman di sekitar Current Page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);

      if (startPage > 2) {
        pageNumbers.push('...');
      }
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      // Halaman terakhir selalu tampil
      pageNumbers.push(totalPages);
    }

    return pageNumbers.map((number, index) => {
      if (number === '...') {
        return (<span key={index} className="elipsis-style">...</span>);
      }
      return (
        <button key={index} onClick={() => goToPage(number)} className={`${styles.btnPageNumber} 
          ${currentPage === number ? styles.activePage: ''}`}
        >
          {number}
        </button>
      );
    });
  };

  const getStatusClass = (status) => {
    switch (status) {
      case 'Aktif': return styles.badgeSuccess;
      case 'Non-Aktif': return styles.badgeDanger;
      default: return styles.badgeAmber;
    }
  };

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Data Akun Pengguna
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah data akun pengguna yang terdaftar ke dalam sistem
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
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleDeleteUser}
        isProcessing={isDeleting}
        title="Konfirmasi Nonaktifkan Akun"
        message="Apakah Anda yakin ingin menonaktifkan akun pengguna ini? Akun yang dinonaktifkan tidak akan dapat masuk ke dalam sistem."
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
      {/* Statistik User */}
      <div className={styles.contentArea}>
        <div className={styles.statsCardWrapper}>
          <div className={styles.statsHeader}>
            <FaInfoCircle className="text-amber-800 text-base" />
            <h3>Ringkasan Data</h3>
          </div>
          <div className={styles.statsContainer}>
            <div className={styles.statsCard}>
              <div className={`${styles.statsIconWrapper} bg-amber-50 text-amber-800`}>
                <FaListUl size={18} />
              </div>
              <div>
                <span className={styles.statsLabel}>
                  Total Akun
                </span>
                <h3 className={styles.statsCount}>
                  {loading ? '...' : totalUserCount}
                </h3>
              </div>
            </div>
            <div className={styles.statsCard}>
              <div className={`${styles.statsIconWrapper} bg-green-50 text-green-700`}>
                <FaCheckCircle size={18} />
              </div>
              <div>
                <span className={styles.statsLabel}>
                  Akun Aktif
                </span>
                <h3 className={styles.statsCount}>
                  {loading ? '...' : aktifUserCount}
                </h3>
              </div>
            </div>
            <div className={styles.statsCard}>
              <div className={`${styles.statsIconWrapper} bg-red-50 text-red-700`}>
                <FaTimesCircle size={18} />
              </div>
              <div>
                <span className={styles.statsLabel}>
                  Akun Non-Aktif
                </span>
                <h3 className={styles.statsCount}>
                  {loading ? '...' : nonAktifUserCount}
                </h3>
              </div>
            </div>
          </div>
        </div>
        {/* Search dan Button */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Cari nama lengkap user atau role..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.btnAddData} onClick={() => setShowAddModal(true)}>
            <FaPlus size={12} /> <span>Akun Baru</span>
          </button>
        </div>
        {/* List User */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="text-center w-16">No</th>
                <th className="text-left">Nama Lengkap</th>
                <th className="text-left">Display Name</th>
                <th className="text-center">Role</th>
                <th className="text-center">Status Akun</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="text-center py-20">
                    <div className={styles.loadContainer}>
                      <div className={`${styles.loadSpinner} animate-spin`}></div>
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center py-16 text-gray-500">
                    <div className={styles.infoDataContent}>
                      <FaInfoCircle className={styles.infoDataIcon} />
                      <p className="text-sm font-medium">
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data user"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const currentStatus = item.status_akun;
                  return (
                    <tr key={item.id}>
                      <td className="text-center text-gray-400">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="text-gray-700 font-semibold">
                        {item.full_name}
                      </td>
                      <td className="font-bold text-amber-950 text-sm">
                        {item.display_name}
                      </td>
                      <td className="text-gray-700 font-medium text-center">
                        {item.role}
                      </td>
                      <td className="text-center">
                        <span className={`${styles.badge} ${getStatusClass(currentStatus)}`}>
                          {currentStatus}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            className={styles.btnDetail} 
                            onClick={(e) => {
                              e.stopPropagation();
                              const slug = createSlug(item.display_name, item.createdAt, item.id);
                              navigate(`/user-pengguna/detail/${slug}`);
                            }}
                          >
                            <FaInfoCircle /> Detail
                          </button>
                          {currentStatus === 'Aktif' && (
                            <button className={styles.btnDelete} onClick={() => setModal({ show: true, id: item.id })}>
                              <FaTrash size={11} /> Nonaktifkan
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* PAGINATION */}
        <div className={styles.pagination}>
          <p>Menampilkan {currentItems.length} dari {filteredDataUser.length} data</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      {/* MODAL EDIT PROFILE */}
      {showAddModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3>
                <FaUserCheck size={21} className="text-amber-700 mt-0.5 mr-2" /> Membuat Akun baru
              </h3>
              <button onClick={handleCloseAddModal}>
                <FaTimes size={16} className={styles.iconClose} />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div className="relative">
                <label className={styles.labelField}>
                  Nama Lengkap
                </label>
                <input 
                  type="text" 
                  name="full_name"
                  value={formData.full_name} 
                  onChange={handleChange}
                  placeholder="Nama Lengkap" 
                  className={styles.inputForm} 
                  autoComplete="name"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="relative">
                <label className={styles.labelField}>
                  E-mail
                </label>
                <input 
                  type="email" 
                  name="email"
                  value={formData.email} 
                  onChange={handleChange}
                  placeholder="E-mail" 
                  className={styles.inputForm} 
                  autoComplete="email"
                  disabled={isSubmitting}
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className={styles.labelField}>
                    Role
                  </label>
                  <select id="role" name="role" value={formData.role} onChange={handleChange} className={styles.inputSelect} required>
                    <option value="Super Admin">Super Admin</option>
                    <option value="Admin Desa">Admin Desa</option>
                    <option value="Pakar">Pakar</option>
                    <option value="Krama">Krama</option>
                    <option value="Viewer">Viewer</option>
                  </select>
                  <div className={styles.selectIcon} style={{ position: 'absolute', right: '1rem', bottom: '0.8rem', pointerEvents: 'none', color: '#6b7280' }}>
                    <FaChevronDown size={12}/>
                  </div>
                </div>
                {/* Dropdown Desa Adat */}
                {(formData.role === "Admin Desa" || formData.role === "Krama" || formData.role === "Viewer") && (
                  <div className="relative" ref={dropdownRef}>
                    <label className={styles.labelField}>
                      Desa Adat
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Ketikkan nama desa adat..."
                        value={searchDesa}
                        onFocus={() => setShowDropdown(true)}
                        onChange={(e) => { 
                          setSearchDesa(e.target.value); 
                          setFormData(prev => ({ ...prev, desa_adat_id: '' })); 
                          setInfoWilayah({ kecamatan: '', kabupaten: '', provinsi: '' }); 
                          setShowDropdown(true); 
                        }}
                        className={styles.inputSelect}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    {/* Panel Hasil Dropdown Autocomplete */}
                    {showDropdown && (
                      <div className={styles.dropdownPanel}>
                        {desaFiltered.length > 0 ? (
                          desaFiltered.map((desa) => (
                            <button key={desa.id} type="button" onClick={() => handleSelectDesa(desa)} className={styles.dropdownInput}>
                              {desa.nama_desa_adat || desa.nama_desa || desa.nama}
                            </button>
                          ))
                        ) : (
                          <div className="p-4 text-center text-xs text-gray-400">
                            {searchDesa.length > 0 ? "Desa adat tidak ditemukan" : "Memuat data..."}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )} 
              </div>
              {/* Grid Auto-Fill Wilayah */}
              {["Admin Desa", "Krama", "Viewer"].includes(formData.role) && (
                <div className={styles.previewWilayahAdat}>
                  <div className="relative">
                    <label className={styles.labelGrid}>
                      Kecamatan
                    </label>
                    <input 
                      type="text" 
                      value={infoWilayah.kecamatan} 
                      placeholder="-" 
                      className={styles.inputGrid} 
                      disabled 
                    />
                  </div>
                  <div className="relative">
                    <label className={styles.labelGrid}>
                      Kabupaten
                    </label>
                    <input 
                      type="text" 
                      value={infoWilayah.kabupaten} 
                      placeholder="-" 
                      className={styles.inputGrid} 
                      disabled 
                    />
                  </div>
                  <div className="relative">
                    <label className={styles.labelGrid}>
                      Provinsi
                    </label>
                    <input 
                      type="text" 
                      value={infoWilayah.provinsi} 
                      placeholder="-" 
                      className={styles.inputGrid} 
                      disabled 
                    />
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="relative">
                <label className={styles.labelField}>
                  Password
                </label>
                <input 
                  type={showPassword ? "text" : "password"} 
                  name="password"
                  value={formData.password} 
                  onChange={handleChange}
                  placeholder="Password" 
                  className={styles.inputForm} 
                  disabled={isSubmitting}
                  required
                />
                <button 
                  type="button" 
                  className={styles.eyePassword} 
                  disabled={isSubmitting} 
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
              <div className="relative">
                <label className={styles.labelField}>
                  Konfirmasi Password
                </label>
                <input 
                  type={showConfirmPassword ? "text" : "password"} 
                  name="confirmPassword"
                  value={formData.confirmPassword} 
                  onChange={handleChange}
                  placeholder="Konfirmasi Password" 
                  className={styles.inputForm} 
                  disabled={isSubmitting}
                  required
                />
                <button 
                  type="button" 
                  className={styles.eyePassword} 
                  disabled={isSubmitting} 
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
              </div>
              <div className="flex justify-center gap-3 pt-4">
                <button type="button" onClick={handleCloseAddModal} className={styles.btnCancelModal}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className={styles.btnSaveModal}>
                  {isSubmitting ? 'Menyimpan...' : <><FaSave /> Simpan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default User;