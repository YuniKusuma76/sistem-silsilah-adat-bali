import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { 
  FaSearch, 
  FaPlus, 
  FaEdit, 
  FaTrash, 
  FaExclamationTriangle,
  FaInfoCircle
} from 'react-icons/fa';
import Footer from '../components/Footer/Footer';

// Helper Modal Konfirmasi
const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message 
}) => {
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
            <button onClick={onClose}className="btn-modal-cencel">
              Batal
            </button>
            <button onClick={onConfirm} className="btn-delete">
              <FaTrash size={12} />
              Ya, Lanjutkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PakarAturanAdatBali = () => {
  // State Data
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // State Navigasi
  const navigate = useNavigate();
  const location = useLocation();
  
  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // State Modal dan Alert
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', message: '' 
  });

  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  const [isDeleting, setIsDeleting] = useState(false);

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
  
  // FETCH: Data Aturan Adat Bali
  const fetchData = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8080/api/aturan', { 
        withCredentials: true 
      });
      setData(response.data.data);
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

  // Effect: Fetch Data
  useEffect(() => {
    fetchData();
  }, []);

  // Handle Nonaktifkan Aturan
  const handleDelete = async () => {
    if (!modal.id) {
      return;
    }

    setIsDeleting(true);

    try {
      await axios.delete(`http://localhost:8080/api/aturan/${modal.id}`, { 
        withCredentials: true 
      });
      setAlert({ 
        show: true, 
        type: 'success', 
        message: "Aturan Adat Bali berhasil dinonaktifkan." 
      });
      setModal({ 
        show: false, 
        id: null 
      });
      fetchData();
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

  // Fungsi Logika Search
  const filteredData = data.filter(item => 
    item.kode_kondisi.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.status_peran_adat.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.dasar_keputusan.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Set Logika Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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

  return (
    <div className="main-container">
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleDelete}
        isProcessing={isDeleting}
        title="Konfirmasi Nonaktifkan"
        message="Aturan Adat Bali yang dinonaktifkan tidak akan berlaku dalam penentuan keputusan status peran adat bali. Lanjutkan proses?"
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
      {/* List Data Aturan */}
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Aturan Adat Bali
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Kelola logika penentuan status peran adat dalam sistem silsilah Adat Bali
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
          <button className="btn-add" onClick={() => navigate('/aturan-adat/create')}>
            <FaPlus /> <span>Aturan Adat Bali</span>
          </button>
        </div>
        {/* Table Aturan Adat Bali*/}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full">
              <thead>
                <tr className="thead-tr">
                  <th className="thead-th w-12 text-center">No</th>
                  <th className="thead-th">Kode Kondisi</th>
                  <th className="thead-th">Status Peran Adat</th>
                  <th className="thead-th">Garis Keturunan</th>
                  <th className="thead-th text-center">Status Aturan</th>
                  <th className="thead-th text-center">Action</th>
                </tr>
              </thead>
              <tbody className="tbody">
                {loading ? (
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
                        <p>{searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data Aturan Adat Bali"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((item, index) => (
                    <tr key={item.id} className="hover-tr transition-colors">
                      <td className="tbody-td text-center">
                        {indexOfFirstItem + index + 1}
                        </td>
                      <td className="tbody-td font-mono font-bold text-[#3A2000] text-xs">
                        {item.kode_kondisi}
                      </td>
                      <td className="tbody-td font-semibold">
                        {item.status_peran_adat}
                      </td>
                      <td className="tbody-td">
                        {item.garis_keturunan}
                      </td>
                      <td className="tbody-td text-center">
                        <span className={`span-badge ${item.status_aturan === 'Aktif' ? 'span-green' : 'span-red'}`}>
                          {item.status_aturan}
                        </span>
                      </td>
                      <td className="tbody-td text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            onClick={() => navigate(`/aturan-adat/detail/${item.id}`)} 
                            className="btn-detail" title="Lihat Detail"
                          >
                            <FaInfoCircle /> Detail
                          </button>
                          <button 
                            onClick={() => navigate(`/aturan-adat/edit/${item.id}`)} 
                            className="btn-edit" title="Edit Aturan"
                          >
                            <FaEdit /> Edit
                          </button>
                          {item.status_aturan === 'Aktif' && (
                            <button 
                              onClick={() => setModal({ show: true, id: item.id })} 
                              className="btn-delete" title="Non-aktifkan"
                            >
                              <FaTrash /> Nonaktifkan
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
        {!loading && filteredData.length > 0 && (
          <div className="page-container">
            <div className="mb-2 sm:mb-0">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredData.length)} of {filteredData.length} entries
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

export default PakarAturanAdatBali;