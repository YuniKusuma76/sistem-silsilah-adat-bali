import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaSearch, 
  FaArrowLeft, 
  FaInfoCircle,
  FaSpinner
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './PengajuanPerkawinan.module.css';

// Helper: Membuat slug url
const createSlug = (namaLengkap, tipeData, id) => {
  const baseName = namaLengkap ? namaLengkap : 'krama';
  const baseType = tipeData ? tipeData : 'keturunan';

  const safeName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const safeType = baseType
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${safeName}-${safeType}-${encodedId}`;
};

const PengajuanPerkawinan = () => {
  const [perkawinanList, setPerkawinanList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Helper: Fungsi mengambil data perkawinan
  const fetchDataPerkawinan = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/perkawinan?mode=verification');
      setPerkawinanList(response.data.data || []);
    } catch (error) {
      console.log(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memuat data perkawinan." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDataPerkawinan();
  }, []);

  // Effect: Alert diteruskan ke alert halaman lain
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

  // Effect: Auto-Close Notifikasi Alert
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: Menangani input pencarian
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  // Helper: Fungsi search filter krama
  const filteredKawin = useMemo(() => {
    if (!searchTerm.trim()) return perkawinanList;
    const term = searchTerm.toLowerCase();
    return perkawinanList.filter((r) => {
      const namaSuami = r.suami?.nama_lengkap?.toLowerCase() || '';
      const namaIstri = r.istri?.nama_lengkap?.toLowerCase() || '';
      const statusKawin = r.status_perkawinan?.toLowerCase() || '';
      const jenisKawin = r.jenis_perkawinan?.toLowerCase() || '';
      return namaSuami.includes(term) || namaIstri.includes(term) || statusKawin.includes(term) || jenisKawin.includes(term);
    });
  }, [perkawinanList, searchTerm]);

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredKawin.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredKawin.length / itemsPerPage);

  // Effect: Setting current page aktif default 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Fungsi pergi ke next page
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

  // Halper: Style badge status permohonan
  const getStatusClass = (status) => {
    switch (status) {
      case 'Disetujui': 
        return styles.badgeSuccess;
      case 'Ditolak': 
        return styles.badgeDanger;
      case 'Draft': 
        return styles.badgeWarning;
      case 'Dibatalkan': 
        return styles.badgeGray;
      default: 
        return styles.badgeAmber;
    }
  };
  
  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Verifikasi Data Perkawinan
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah data perkawinan dan perceraian yang didaftarkan
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
      {/* List Krama Bali */}
      <div className={styles.contentArea}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchTerm}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.btnBackRed} onClick={() => navigate('/verifikasi-data')}>
            <FaArrowLeft size={12} />
            <span>Kembali ke Dashboard</span>
          </button>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="text-center w-16">No</th>
                <th className="text-left">Nama Suami</th>
                <th className="text-left">Nama Istri</th>
                <th className="text-center">Status Perkawinan</th>
                <th className="text-center">Jenis Perkawinan</th>
                <th className="text-center">Status Verifikasi</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-12">
                    <div className={styles.loadContainer}>
                      <div className={`${styles.loadSpinner} animate-spin`}></div>
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan="7" className="text-center py-16 text-gray-500">
                    <div className={styles.infoDataContent}>
                      <FaInfoCircle className={styles.infoDataIcon} />
                      <p className="text-sm font-medium">
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data perkawinan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((kawin, index) => {
                  const kramaUtama = kawin.jenis_perkawinan === 'Nyentana' 
                    ? (kawin.istri || kawin.suami) 
                    : (kawin.suami || kawin.istri);
                    
                  return (
                    <tr key={kawin.id}>
                      <td className="text-center text-gray-400">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="font-bold text-gray-800">
                        <div className="flex items-center gap-2">
                          <span>{kawin.suami?.nama_lengkap}</span>
                          {kawin.is_pending_update && (
                            <span className={styles.warnUpdate}title="Relasi ini memiliki draft usulan perubahan data">
                              <FaExclamationTriangle className="mr-2 mb-0.5" /> 
                              <span>Ada Update</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="font-bold text-gray-800">
                        {kawin.istri?.nama_lengkap}
                      </td>
                      <td className="text-gray-800 text-center font-medium">
                        {kawin.status_perkawinan}
                      </td>
                      <td className="text-gray-800 text-center font-medium">
                        {kawin.jenis_perkawinan}
                      </td>
                      <td className="text-center">
                        <span className={`${styles.badge} ${getStatusClass(kawin.status_verifikasi)}`}>
                          {kawin.status_verifikasi}
                        </span>
                      </td>
                      <td className="text-center">
                        <button 
                          className={styles.btnDetail} 
                          onClick={() => {
                            if (kramaUtama) {
                              const safeName = kramaUtama.nama_lengkap || 'krama';
                              const safeType = kramaUtama.tipe_data || 'keturunan';
                              const slugKrama = createSlug(safeName, safeType, kramaUtama.id);
                              navigate(`/verifikasi-data/perkawinan/detail/${slugKrama}`, { state: { fromPerkawinan: true } });
                            } else {
                              setAlert({
                                show: true,
                                type: 'error',
                                message: 'Gagal memproses informasi detail. Data perkawinan tidak termuat dari server.'
                              });
                            }
                          }}
                        >
                          <FaInfoCircle /> Detail
                        </button>
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
          <p>Menampilkan {currentItems.length} dari {filteredKawin.length} data</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PengajuanPerkawinan;