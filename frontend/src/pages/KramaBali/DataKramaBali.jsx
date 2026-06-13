import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaSearch, 
  FaInfoCircle,
  FaUserCircle,
  FaSitemap
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBali.module.css';

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

const DataKramaBali = ({ user }) => {
  const [kramaList, setKramaList] = useState([]);
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

  // Effect: Mengambil data krama bali
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get('/krama-bali?mode=public');
        setKramaList(response.data.data || []);
      } catch (error) {
        console.log(error);
        setAlert({
          show: true,
          type: 'error',
          message: 'Gagal memuat data krama.'
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
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
  const filteredKrama = useMemo(() => {
    return kramaList.filter(krama => 
      krama.nama_lengkap?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [kramaList, searchTerm]);

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredKrama.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredKrama.length / itemsPerPage);

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

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Data Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah data krama bali yang telah terdaftar dan diverifikasi
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
      {/* List Krama Bali Content */}
      <div className={styles.contentArea}>
        {/* Search Bar */}
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Cari nama krama..." 
              value={searchTerm}
              onChange={handleSearchChange}
              className={styles.searchInput}
            />
          </div>
          <div className="flex items-center gap-2">
            <button 
              className={styles.btnTrehPuncak} 
              onClick={() => navigate('/krama-bali/treh-puncak')}
              title="Lihat silsilah dari leluhur tertinggi"
            >
              <FaSitemap size={14} />
              <span>Treh Puncak</span>
            </button>
            {user?.role !== 'Viewer' && user?.role !== 'Pakar' && (
              <button 
                className={styles.btnMyData} 
                onClick={() => navigate('/krama-bali/my-data')}
                title="Lihat data yang saya masukkan"
              >
                <FaUserCircle size={14} />
                <span>Data Saya</span>
              </button>
            )}
          </div>
        </div>
        {/* Tabel Krama Bali */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="text-center w-16">No</th>
                <th>Nama Lengkap</th>
                <th className="text-center">Jenis Kelamin</th>
                <th className="text-center">Status Hidup</th>
                <th className="text-center">Tipe Data</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="text-center py-12">
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
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data krama"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((krama, index) => (
                  <tr key={krama.id}>
                    <td className="text-center text-gray-400">
                      {indexOfFirstItem + index + 1}
                    </td>
                    <td className="font-bold text-gray-800">
                      {krama.nama_lengkap}
                    </td>
                    <td className="text-center font-medium">
                      {krama.jenis_kelamin}
                    </td>
                    <td className="text-center">
                      <span className={`${styles.badge} ${
                        krama.status_hidup === 'Hidup' ? styles.badgeSuccess : 
                        krama.status_hidup === 'Meninggal' ? styles.badgeDanger :
                        styles.badgeGray
                      }`}>
                        {krama.status_hidup}
                      </span>
                    </td>
                    <td className="text-center font-medium">
                      {krama.tipe_data}
                    </td>
                    <td className="text-center">
                      <button 
                        className={styles.btnDetail} 
                        onClick={() => {
                          const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
                          navigate(`/krama-bali/detail/${slug}`);
                        }}
                      >
                        <FaInfoCircle /> Detail
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* PAGINATION */}
        <div className={styles.pagination}>
          <p>Menampilkan {currentItems.length} dari {filteredKrama.length} data</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default DataKramaBali;