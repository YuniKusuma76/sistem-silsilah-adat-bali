import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaSearch, 
  FaPlus, 
  FaTrash, 
  FaExclamationTriangle,
  FaInfoCircle,
  FaListUl,      
  FaCheckCircle,  
  FaTimesCircle
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './AturanAdatBali.module.css';

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
const createSlug = (aturan, date, id) => {
  if (!aturan) return id;
  const aturanSlug = aturan.toLowerCase().replace(/ /g, '-');
  const dateFormatted = new Date(date).toISOString().split('T')[0];
  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${aturanSlug}-${dateFormatted}-${encodedId}`;
};

const AturanAdatBali = () => {
  const [dataAturan, setDataAturan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

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

  // State menampilkan modal konfirmasi
  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  // Helper: Fungsi mengambil data aturan adat bali
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/aturan-adat');
      setDataAturan(response.data?.data || []);
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memuat data aturan adat bali." 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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
  }, [location.state]);

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
      fetchData();
      setModal({ 
        show: false, 
        id: null 
      });
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

  // Helper: Fungsi search filter aturan
  const filteredData = dataAturan.filter(item => 
    item.nama_aturan?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.kategori?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.status_peran_adat?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.dasar_keputusan?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper: Menghitung jumlah aturan
  const totalAturanCount = dataAturan.length;
  const aktifAturanCount = dataAturan.filter(item => item.status_aturan === 'Aktif').length;
  const nonAktifAturanCount = dataAturan.filter(item => item.status_aturan === 'Non-Aktif').length;

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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

  // Halper: Style badge status aturan
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
            Data Aturan Adat Bali
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah data aturan Adat Bali yang menentukan status peran adat di Bali
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
      {/* Statistik Aturan */}
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
                  Total Keseluruhan
                </span>
                <h3 className={styles.statsCount}>
                  {loading ? '...' : totalAturanCount}
                </h3>
              </div>
            </div>
            <div className={styles.statsCard}>
              <div className={`${styles.statsIconWrapper} bg-green-50 text-green-700`}>
                <FaCheckCircle size={18} />
              </div>
              <div>
                <span className={styles.statsLabel}>
                  Aturan Aktif
                </span>
                <h3 className={styles.statsCount}>
                  {loading ? '...' : aktifAturanCount}
                </h3>
              </div>
            </div>
            <div className={styles.statsCard}>
              <div className={`${styles.statsIconWrapper} bg-red-50 text-red-700`}>
                <FaTimesCircle size={18} />
              </div>
              <div>
                <span className={styles.statsLabel}>
                  Aturan Non-Aktif
                </span>
                <h3 className={styles.statsCount}>
                  {loading ? '...' : nonAktifAturanCount}
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
              placeholder="Cari nama aturan atau kategori..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <button className={styles.btnAddData} onClick={() => navigate('/aturan-adat-bali/add')}>
            <FaPlus size={12} />
            <span>Pengajuan Baru</span>
          </button>
        </div>
        {/* List Aturan Adat Bali */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="text-center w-16">No</th>
                <th className="text-center">Kategori</th>
                <th className="text-center">Nama Aturan</th>
                <th className="text-center">Status Aturan</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="5" className="text-center py-20">
                    <div className={styles.loadContainer}>
                      <div className={`${styles.loadSpinner} animate-spin`}></div>
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan="5" className="text-center py-16 text-gray-500">
                    <div className={styles.infoDataContent}>
                      <FaInfoCircle className={styles.infoDataIcon} />
                      <p className="text-sm font-medium">
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data aturan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const currentStatus = item.status_aturan;
                  return (
                    <tr key={item.id}>
                      <td className="text-center text-gray-400">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="font-mono font-bold text-amber-950 text-sm">
                        {item.kategori}
                      </td>
                      <td className="text-gray-700 font-medium">
                        {item.nama_aturan}
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
                            onClick={() => {
                              const slug = createSlug(item.kategori, item.createdAt, item.id);
                              navigate(`/aturan-adat-bali/detail/${slug}`);
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
          <p>Menampilkan {currentItems.length} dari {filteredData.length} data</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AturanAdatBali;