import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaSearch, FaTrash, FaInfoCircle } from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

const SilsilahAdatBali = ({ user }) => {
  // State Data
  const [kramaList, setKramaList] = useState([]);

  // State UI
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  // State Navigasi
  const navigate = useNavigate();
  const location = useLocation();

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // State Alert Global
    const [alert, setAlert] = useState({
      show: false,
      type: '',
      message: ''
    });
  
    // Effect: Alert Diteruskan ke Alert Halaman lain
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
  
    // Effect: Auto-Close Alert
    useEffect(() => {
      if (alert.show && alert.type === 'success' || alert.type === 'error') {
        const timer = setTimeout(() => {
          setAlert(prev => ({ 
            ...prev, 
            show: false 
          }));
        }, 3000);
        return () => clearTimeout(timer);
      }
    }, [alert.show, alert.type]);

  // Set Role Admin
  const isAdmin = user?.role === 'Admin';

  // Effect: Mengambil Fetch Data
  useEffect(() => {
    fetchData();
  }, []);

  // Mengambil Data dari Request API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/krama-bali?mode=public');
      setKramaList(response.data.data);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fungsi Search Data Krama
  const filteredKrama = useMemo(() => {
    return kramaList.filter(krama => 
      krama.nama_lengkap.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [kramaList, searchTerm]);

  // Set Logika Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredKrama.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredKrama.length / itemsPerPage);

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
      {/* List Krama Bali Content */}
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Daftar Krama Bali
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Daftar seluruh Krama Bali yang telah terdaftar silsilah keluarganya
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
        </div>
        {/* Tabel Krama Bali */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full">
              <thead>
                <tr className="thead-tr">
                  <th className="thead-th w-16 text-center">No</th>
                  <th className="thead-th">Nama Krama Bali</th>
                  <th className="thead-th text-center">Jenis Kelamin</th>
                  <th className="thead-th text-center">Status Hidup</th>
                  <th className="thead-th text-center" style={{ width: '25%' }}>Action</th>
                </tr>
              </thead>
              <tbody className="tbody">
                {isLoading ? (
                  <tr>
                    <td colSpan="5" className="text-center py-8">
                      <div className="loading-spinner-content">
                        <div className="loading-spinner"></div>
                        <span>Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center py-10 text-gray-500">
                      <div className="flex flex-col items-center">
                        <FaInfoCircle className="text-gray-300 text-3xl mb-2" />
                        <p>{searchTerm ? `Data ${searchTerm} tidak ditemukan` : "Tidak Ada Krama Bali"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((krama, index) => (
                    <tr key={krama.id} className="hover:bg-gray-50 transition-colors">
                      <td className="tbody-td text-center">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="tbody-td font-medium">
                        {krama.nama_lengkap}
                      </td>
                      <td className="tbody-td text-center">
                        {krama.jenis_kelamin}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`span-badge ${krama.status_hidup === 'Hidup' ? 'span-green' : 'span-red'}`}>
                          {krama.status_hidup}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button 
                            className="btn-detail" 
                            title="Lihat Detail" 
                            onClick={() => navigate(`/silsilah-bali/detail/${krama.id}`)}>
                              <FaInfoCircle size={12} /> 
                              <span>Detail</span>
                          </button>
                          {isAdmin && (
                            <button className="btn-delete" title="Hapus Data" >
                              <FaTrash size={12} /> 
                              <span>Hapus</span>
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
        {!isLoading && filteredKrama.length > 0 && (
          <div className="page-container">
            <div className="mb-2 sm:mb-0">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredKrama.length)} of {filteredKrama.length} entries
            </div>
            <div className="page-content">
              <button 
                onClick={() => goToPage(1)} 
                disabled={currentPage === 1} 
                className="btn-page">
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

export default SilsilahAdatBali;