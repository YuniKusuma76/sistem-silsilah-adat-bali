import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaSearch, 
  FaTrash, 
  FaInfoCircle, 
  FaPlus, 
  FaExclamationTriangle
} from 'react-icons/fa'; 
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// Helper Modal Konfirmasi
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing }) => {
  if (!isOpen) {
    return null;
  }
  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="p-6">
          <div className="flex justify-center mb-5">
            <div className="elipsis-icon-warn">
              <FaExclamationTriangle className="icon-warn" />
            </div>
          </div>
          {/* Modal Content */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600">
              {message}
            </p>
          </div>
          {/* Modal Button */}
          <div className="mt-6 flex gap-3 justify-center">
            <button 
              onClick={onClose} 
              disabled={isProcessing} 
              className="btn-modal-cencel"
            >
              Kembali
            </button>
            <button 
              onClick={onConfirm} 
              disabled={isProcessing}
              className="btn-delete"
            >
              <FaTrash size={12} />
              Ya, Batalkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PermohonanPeran = () => {
  // State Data
  const [riwayat, setRiwayat] = useState([]);
  const [userRole, setUserRole] = useState('');

  // State UI
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State Navigasi
  const navigate = useNavigate();
  const location = useLocation();

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // State Alert
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', message: '' 
  });

  // State Modal
  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch User Role
  const fetchUserRole = async () => {
    try {
      const response = await axiosInstance.get('/users');
      const userData = response.data.data; 
      if (userData && userData.role) {
        setUserRole(userData.role);
      }
    } catch (error) {
      console.error("Gagal mengambil data user", error);
    }
  };

  // Fungsi Fetch Data Permohonan
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/permohonan-role/owner');
      setRiwayat(response.data.data);
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Gagal memuat riwayat permohonan.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Batalkan Permohonan
  const handleConfirmBatalkan = async () => {
    if (!modal.id) {
      return;
    }
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-role/cancel/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Permohonan berhasil dibatalkan.' 
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
        message: error.response?.data?.message || "Gagal membatalkan permohonan." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // EFFECT: Handle Flash Message & Fetch Data
  useEffect(() => {
    if (location.state?.successMessage) {
      setAlert({ 
        show: true, 
        type: 'success', 
        message: location.state.successMessage });
      window.history.replaceState({}, document.title);
    }
    fetchData();
    fetchUserRole();
  }, [location]);

  // EFFECT: Auto Close Alert 
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => { 
        setAlert(prev => ({ 
          ...prev, 
          show: false 
        })); 
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  // Fungsi Logika Search
  const filteredRiwayat = riwayat.filter(item =>
    item.role_diajukan.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.status_permohonan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Set Logika Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRiwayat.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRiwayat.length / itemsPerPage);

  // Effect: Set Current Page Aktif
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Fungsi Go Next Page
  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Fungsi Render Halaman Pagination
  const renderPageNumbers = () => {
    const pageNumbers = [];

    if (totalPages <= 2) {
      for (let i = 1; i <= totalPages; i++) {
        pageNumbers.push(i);
      }
    } else {
      // Selalu tampilkan halaman pertama
      pageNumbers.push(1);
      // Tentukan range halaman di sekitar Current Page
      const startPage = Math.max(2, currentPage - 1);
      const endPage = Math.min(totalPages - 1, currentPage + 1);
      // Logic tambah titik-titik di kiri
      if (startPage > 2) {
        pageNumbers.push('...');
      }
      // Masukkan halaman tengah
      for (let i = startPage; i <= endPage; i++) {
        pageNumbers.push(i);
      }
      // Logic tambah titik-titik di kanan
      if (endPage < totalPages - 1) {
        pageNumbers.push('...');
      }
      // Selalu tampilkan halaman terakhir
      pageNumbers.push(totalPages);
    }
    // Tampilkan elipsis
    return pageNumbers.map((number, index) => {
      if (number === '...') {
        return (
          <span key={index} className="elipsis-style">
            ...
          </span>
        );
      }
      // Tambilkan Button Page Aktif
      return (
        <button
          key={index}
          onClick={() => goToPage(number)}
          className={`btn-page-number ${currentPage === number ? 'active-page': 'not-active-page'}`}>
          {number}
        </button>
      );
    });
  };

  // Halper Badge Status Pengajuan
  const getStatusClass = (status) => {
    switch (status) {
      case 'Setuju': return 'span-green';
      case 'Tolak': return 'span-red';
      case 'Menunggu': return 'span-yellow';
      case 'Batal': return 'span-gray';
      default: return 'bg-gray-50 text-gray-800';
    }
  };

  return (
    <div className="main-container">
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleConfirmBatalkan}
        isProcessing={isSubmitting}
        title="Konfirmasi Pembatalan"
        message="Tindakan ini tidak dapat dibatalkan. Permohonan Anda tidak akan diproses oleh Admin setelah dibatalkan. Tetap batalkan permohonan peran?"
      />
      {/* Alert Content */}
      {alert.show && (
        <div className={`alert-container 
          ${alert.type === 'success' ? 'border-green-500 bg-green-50' : alert.type === 'error' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`}>
          <div className="flex items-start p-4">
            {/* Icon */}
            <div className="flex-shrink-0 mr-3 text-2xl">
              {alert.type === 'success' && '✅'}
              {alert.type === 'error' && '⚠️'}
              {alert.type === 'loading' && '⏳'}
            </div>
            {/* Content */}
            <div className="flex-1">
              <h4 className={`font-bold text-sm 
                ${alert.type === 'success' ? 'text-green-800' : alert.type === 'error' ? 'text-red-800' : 'text-blue-800'}`}>
                {alert.type === 'success' ? 'Berhasil!' : alert.type === 'error' ? 'Terjadi Kesalahan!' : 'Mohon Tunggu.'}
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
          {/* Progress bar line */}
          {(alert.type === 'success' || alert.type === 'error') && (
            <div className="h-1.5 w-full bg-gray-200">
              <div className={`h-full animate-shrink ${alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
          )}
        </div>
      )}
      {/* List Data Permohonan */}
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Riwayat Permohonan Peran
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Daftar pengajuan perubahan hak akses akun Anda
          </p>
        </div>
        {/* Search Bar */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex gap-2 w-full max-w-md">
            <div className="relative w-full">
              <span className="search-span">
                <FaSearch />
              </span>
              <input 
                type="text" 
                placeholder="Search" 
                className="search-field"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {userRole !== 'Pakar' && userRole !== 'Admin' && (
            <button 
              className="btn-add" 
              onClick={() => navigate('/permohonan-peran/riwayat/create')}
            >
              <FaPlus /> <span>Ajukan Permohonan Baru</span>
            </button>
          )}
        </div>
        {/* Table Riwayat Permohonan */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full">
              <thead>
                <tr className="thead-tr">
                  <th className="thead-th text-center">No</th>
                  <th className="thead-th">Tanggal Pengajuan</th>
                  <th className="thead-th">Role Diajukan</th>
                  <th className="thead-th text-center">Status</th>
                  <th className="thead-th text-center" style={{ width: '20%' }}>Action</th>
                </tr>
              </thead>
              <tbody className="tbody">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10">
                      <div className="loading-spinner-content">
                        <div className="loading-spinner"></div>
                        <span className="text-gray-500">Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-gray-500">
                      <div className="flex flex-col items-center">
                        <FaInfoCircle className="text-gray-300 text-3xl mb-2" />
                        <p>{searchTerm ? `Data ${searchTerm} tidak ditemukan.` : "Tidak Ada Riwayat Permohonan"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => (
                    <tr key={item.id} className="hover-tr transition-colors">
                      <td className="tbody-td text-center">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="tbody-td text-gray-600">
                        {new Date(item.tanggal_pengajuan).toLocaleDateString('id-ID', { 
                          day: 'numeric',
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </td>
                      <td className="tbody-td font-bold">
                        {item.role_diajukan}
                      </td>
                      <td className="tbody-td text-center">
                        <span className={`span-badge ${getStatusClass(item.status_permohonan)}`}>
                          {item.status_permohonan}
                        </span>
                      </td>
                      <td className="tbody-td text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button 
                            className="btn-detail" 
                            title="Lihat Detail" 
                            onClick={() => navigate(`/permohonan-peran/riwayat/detail/${item.id}`)}
                          >
                            <FaInfoCircle /> <span>Detail</span>
                          </button>
                          {item.status_permohonan === 'Menunggu' && (
                            <button 
                              className="btn-delete" 
                              title="Batalkan Permohonan"
                              onClick={() => setModal({ show: true, id: item.id })}
                            >
                              <FaTrash /> <span>Batal</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        {/* PAGINATION */}
        {!isLoading && filteredRiwayat.length > 0 && (
          <div className="page-container">
            <div className="mb-2 sm:mb-0">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredRiwayat.length)} of {filteredRiwayat.length} entries
            </div>
            <div className="page-content">
              <button 
                onClick={() => goToPage(1)} 
                disabled={currentPage === 1} 
                className="btn-page border-r border-gray-300">
                  «
              </button>
              <button 
                onClick={() => goToPage(currentPage - 1)} 
                disabled={currentPage === 1} 
                className="btn-page border-r border-gray-300">
                  ‹
              </button>

              {renderPageNumbers()}

              <button 
                onClick={() => goToPage(currentPage + 1)} 
                disabled={currentPage >= totalPages} 
                className="btn-page border-r border-gray-300">
                  ›
              </button>
              <button 
                onClick={() => goToPage(totalPages)} 
                disabled={currentPage >= totalPages} 
                className="btn-page">
                  »
              </button>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default PermohonanPeran;