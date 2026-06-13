import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  FaSearch, 
  FaPlus, 
  FaTrash, 
  FaEdit, 
  FaExclamationTriangle,
  FaInfoCircle
} from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// Helper modal konfirmasi
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message }) => {
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
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-2">
              {title}
            </h3>
            <p className="text-sm text-bali-brown">
              {message}
            </p>
          </div>
          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={onClose}className="btn-cencel-confirm">
              Batal
            </button>
            <button onClick={onConfirm} className="btn-delete">
              <FaTrash size={12} />
              Ya, Nonaktifkan
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const AdminUsers = () => {
  // State Data
  const [userList, setUserList] = useState([]);

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

  // State Modal Konfirmasi
  const [modal, setModal] = useState({
    show: false,
    idToDelete: null
  });

  // EFFECT: Handle Flash Message & Fetch Data
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

  // EFFECT: Auto Close Alert 
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
  
  // Effect: Fetch Data User
  useEffect(() => {
    fetchData();
  }, []);

  // Mengambil Data User dari API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/users');
      setUserList(response.data.data || response.data);
    } catch (error) {
      console.log(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal memuat data user.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Delete Click
  const handleDeleteClick = (id) => {
    setModal({
      show: true,
      idToDelete: id
    });
  };

  // Fungsi Menonaktifkan User
  const executeDelete = async () => {
    const id = modal.idToDelete;
    setModal({ 
      show: false, 
      idToDelete: null 
    });
    setAlert({ 
      show: true, 
      type: 'loading', 
      message: 'Memproses...' 
    });
    try {
      await axiosInstance.delete(`/users/${id}`);

      const filteredList = userList.filter(user => user.id !== id);
      setUserList(filteredList);

      setAlert({
        show: true,
        type: 'success',
        message: 'User berhasil dinonaktifkan!'
      });
      fetchData(); 
    } catch (error) {
      console.log(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menonaktifkan user.'
      });
    }
  };

  // Fungsi Logika Search
  const filteredUser = userList.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) 
  );

  // Set Logika Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredUser.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredUser.length / itemsPerPage);

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

  // Helper Warna Status
  const getStatusBadge = (status) => {
    return status === 'Aktif' ? 'span-green' : 'span-red';
  };

  // Helper Warna Role
  const getRoleBadge = (role) => {
    switch (role) {
      case 'Admin': return 'bg-purple-100 text-purple-700 border-purple-200';
      case 'Pakar': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Krama': return 'bg-orange-100 text-orange-700 border-orange-200';
      default: return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  // Helper membuat slug
  const createSlug = (item) => {
    const name = item.name;
    // Bersihkan Nama: Huruf kecil, spasi jadi strip
    const cleanName = name.toLowerCase()
      .replace(/\s+/g, '-') 
      .replace(/[^\w-]/g, '');
    // Encode ID ke Base64 agar tidak terbaca langsung
    const encodedId = btoa(item.id.toString());
    // Gabungkan: nama-kode
    return `${cleanName}-${encodedId}`;
  };

  return (
    <div className="main-container relative">
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, idToDelete: null })}
        onConfirm={executeDelete}
        title="Konfirmasi Hapus"
        message="Apakah Anda yakin ingin menonaktifkan akun user ini? Tindakan ini tidak dapat dibatalkan."
      />
      {/* Alert Action */}
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
      {/* List User Content */}
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            User
          </h2>
          <p className="text-gray-600 text-md mb-5">
            List semua user yang terdaftar ke dalam sistem silsilah Adat Bali
          </p>
        </div>
        {/* Search dan Button Add */}
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
          <button className="btn-add" onClick={() => navigate('/users/create')}>
            <FaPlus size={14} /> <span>Data User</span>
          </button>
        </div>
        {/* Tabel Data User */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full">
              <thead>
                <tr className="thead-tr">
                  <th className="thead-th w-16 text-center">No</th>
                  <th className="thead-th">Name</th>
                  <th className="thead-th">E-mail</th>
                  <th className="thead-th text-center">Role</th>
                  <th className="thead-th text-center">Status</th>
                  <th className="thead-th text-center" style={{ width: '20%' }}>Action</th>
                </tr>
              </thead>
              <tbody className="tbody">
                {isLoading ? (
                  <tr>
                    <td colSpan="6" className="text-center py-8">
                      <div className="loading-spinner-content">
                        <div className="loading-spinner"></div>
                        <span>Memuat data...</span>
                      </div>
                    </td>
                  </tr>
                ) : currentItems.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-10 text-gray-500">
                      <div className="flex flex-col items-center">
                        <FaInfoCircle className="text-gray-300 text-3xl mb-2" />
                        <p>{searchTerm ? `Data ${searchTerm} tidak ditemukan` : "Tidak Ada User"}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  currentItems.map((user, index) => (
                    <tr key={user.id} className="hover-tr">
                      <td className="tbody-td text-center">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="tbody-td font-medium">
                        {user.name}
                      </td>
                      <td className="tbody-td font-medium">
                        {user.email}
                      </td>
                      <td className="tbody-td text-center">
                        <span className={`span-badge ${getRoleBadge(user.role)}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`span-badge ${getStatusBadge(user.status_akun)}`}>
                          {user.status_akun}
                        </span>
                      </td>
                      <td className="py-3 px-6 text-center">
                        <div className="flex justify-center items-center gap-2">
                          <button 
                            className="btn-edit" 
                            title="Edit Data" 
                            onClick={() => {
                              const slug = createSlug(user);
                              navigate(`/users/edit/${slug}`);
                            }}
                          >
                            <FaEdit size={12} /> 
                            <span>Edit</span>
                          </button>
                          <button 
                            className="btn-delete" 
                            title="Hapus Data" 
                            onClick={() => handleDeleteClick(user.id)}
                          >
                            <FaTrash size={12} /> 
                            <span>Nonaktifkan</span>
                          </button>
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
        {!isLoading && filteredUser.length > 0 && (
          <div className="page-container">
            <div className="mb-2 sm:mb-0">
              Showing {indexOfFirstItem + 1} to {Math.min(indexOfLastItem, filteredUser.length)} of {filteredUser.length} entries
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

export default AdminUsers;