import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaSearch, 
  FaInfoCircle, 
  FaCheck, 
  FaTimes, 
  FaUserCog, 
  FaFilter,
  FaExclamationTriangle,
  FaIdCard
} from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

const VerificationModal = ({ isOpen, onClose, onSubmit, data, isProcessing }) => {
  // State Data Verifikasi
  const [status, setStatus] = useState('Setuju');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');

  // Effect: Reset state ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('Setuju');
      setCatatan('');
      setError('');
    }
  }, [isOpen]);

  // Handle Submit
  const handleSubmit = () => {
    if (status === 'Tolak' && !catatan.trim()) {
      setError("Catatan wajib diisi jika permohonan ditolak!");
      return;
    }
    onSubmit(data.id, status, catatan);
  };

  if (!isOpen || !data) {
    return null;
  }

  const isSetuju = status === 'Setuju';

  return (
    <div className="modal-overlay">
      <div className="modal-verifikasi">
        {/* Header Modal */}
        <div className="modal-header">
          <h3 className="modal-title">
            <FaUserCog className="text-[#3A2000]" /> Verifikasi Permohonan Peran
          </h3>
          <button onClick={onClose} className="modal-close">
            <FaTimes size={18} />
          </button>
        </div>
        <div className="p-6">
          {/* Informasi User */}
          <div className="card-user-content">
            <div className="user-images">
              <img src="/profile.png" alt="Pemohon" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Pemohon
              </p>
              <p className="font-bold text-gray-800 text-lg leading-tight">
                {data.pengguna?.name}
              </p>
              <p className="text-sm font-medium mt-1 flex items-center gap-2">
                <FaIdCard /> 
                <span>{data.pengguna?.role}</span>
              </p>
            </div>
          </div>
          {/* Informasi Role */}
          <div className="card-role-content">
            <span className="text-gray-500 block text-xs uppercase font-bold">
              Permohonan Role
            </span>
            <span className="text-lg font-bold text-[#3A2000]">
              {data.role_diajukan}
            </span>
          </div>
          {/* Keputusan Admin */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Keputusan Permohonan
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Card Setuju */}
              <button
                onClick={() => setStatus('Setuju')}
                className={`card-btn-setuju ${isSetuju ? 'isSetuju' : 'isNotSetuju'}`}
              >
                {isSetuju && <div className="absolute top-2 right-2 text-green-600"></div>}
                <FaCheck size={20} className={isSetuju ? 'text-green-600' : 'text-gray-400'} />
                <span className="font-bold text-sm">Setujui</span>
              </button>
              {/* Card Tolak */}
              <button
                onClick={() => setStatus('Tolak')}
                className={`card-btn-tolak ${!isSetuju ? 'isTolak' : 'isNotTolak'}`}
              >
                {!isSetuju && <div className="absolute top-2 right-2 text-red-600"></div>}
                <FaTimes size={20} className={!isSetuju ? 'text-red-600' : 'text-gray-400'} />
                <span className="font-bold text-sm">Tolak</span>
              </button>
            </div>
          </div>
          {/* Catatan Keputusan */}
          <div className={`transition-all duration-300 ${!isSetuju ? 'opacity-100' : 'opacity-100'}`}>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Catatan Validator 
              {!isSetuju && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              className={`area-input-note ${error ? 'error-note' : isSetuju ? 'setuju-note' : 'tolak-note'}`}
              placeholder={!isSetuju ? "Berikan catatan..." : "Berikan catatan opsional..."}
              value={catatan}
              onChange={(e) => { setCatatan(e.target.value); setError(''); }}
            ></textarea>
            {error && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1 animate-pulse">
                <FaExclamationTriangle /> {error}
              </p>
            )}
          </div>
        </div>
        {/* Footer Actions */}
        <div className="p-6 pt-2 flex items-center justify-end gap-3 bg-white">
          <button 
            onClick={onClose} 
            disabled={isProcessing} 
            className="btn-verif-batal"
          >
            Batal
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isProcessing}
            className={`btn-verif ${isSetuju ? 'btn-setuju' : 'btn-tolak'} disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {isProcessing ? (
              <>
                <div className="spinner-verif"></div>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                {isSetuju ? <FaCheck /> : <FaTimes />}
                <span>{isSetuju ? 'Setujui Permohonan' : 'Tolak Permohonan'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper membuat slug
const createSlug = (item) => {
  const name = item.pengguna?.name || 'User';
  // Bersihkan Nama: Huruf kecil, hapus karakter aneh, spasi jadi strip
  const cleanName = name.toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Hapus simbol non-alfanumerik kecuali spasi/strip
    .replace(/\s+/g, '-')     // Spasi jadi strip
    .replace(/-+/g, '-');     // Cegah double strip (--)

  // 2. Encode ID ke Base64 & Bersihkan karakter URL-unsafe
  const encodedId = btoa(item.id.toString())
    .replace(/=/g, '')  // Hapus padding '=' agar URL bersih
    .replace(/\+/g, '-') // Ganti '+' jadi '-'
    .replace(/\//g, '_'); // Ganti '/' jadi '_'

  return `${cleanName}-${encodedId}`;
};

const AdminPermohonanPeran = () => {
  // State Navigasi
  const navigate = useNavigate();

  // State Data
  const [dataList, setDataList] = useState([]);

  // State UI
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Semua');

  // State Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // State Verfikasi
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Alert Global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Effect: Mencegah scroll ketika modal tampil
  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, []);

  // Effect: Auto-Close Alert
  useEffect(() => {
    if ((alert.show && alert.type === 'success') || alert.type === 'error') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ 
          ...prev, 
          show: false 
        }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Fetch Data dari API
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/permohonan-peran');
      setDataList(response.data.data);
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memuat data permohonan." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Effect: Fetch Data
  useEffect(() => {
    fetchData();
  }, []);

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

  // Handle Modal Verifikasi
  const openVerificationModal = (item) => {
    setSelectedItem(item);
    setModalOpen(true);
  };

  // Handle Verifikasi
  const handleVerificationSubmit = async (id, status, catatan) => {
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-peran/${id}`, {
        status_permohonan: status,
        catatan_admin: catatan
      });
      setAlert({ 
        show: true, 
        type: 'success', 
        message: `Permohonan peran berhasil diverifikasi.` 
      });
      setModalOpen(false);
      fetchData();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal memproses data permohonan." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Logika Search
  const filteredData = dataList.filter(item => { 
    const matchesSearch = 
      item.pengguna?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.role_diajukan.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'Semua' || item.status_permohonan === filterStatus;

    return matchesSearch && matchesStatus;
  });

  // Logika Pagination
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  // Effect: Set Current Page Aktif
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus]);

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

  // Helper Class Status
  const getStatusClass = (status) => {
    switch (status) {
      case 'Setuju': return 'span-green';
      case 'Tolak': return 'span-red';
      case 'Menunggu': return 'span-yellow';
      case 'Batal': return 'span-gray';
      default: return 'bg-gray-100 text-gray-800';
    }
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
      {/* Modal Verifikasi */}
      <VerificationModal 
        isOpen={modalOpen}
        data={selectedItem}
        onClose={() => setModalOpen(false)}
        onSubmit={handleVerificationSubmit}
        isProcessing={isSubmitting}
      />
      {/* List Data Permohonan */}
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Permohonan Peran
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Verifikasi pengajuan permohonan perubahan hak akses akun user
          </p>
        </div>
        {/* Search dan Filter */}
        <div className="flex justify-between items-center mb-6">
          {/* Search Bar */}
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
          {/* Filter Status */}
          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <FaFilter className="text-bali-brown" />
            {['Semua', 'Menunggu', 'Setuju', 'Tolak', 'Batal'].map((status) => (
              <button
                key={status}
                onClick={() => { setFilterStatus(status); setCurrentPage(1); }}
                className={`px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  filterStatus === status 
                    ? 'bg-[#3A2000] text-white shadow-md' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}>
                  {status}
              </button>
            ))}
          </div>
        </div>
        {/* Tabel Permohonan */}
        <div className="table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full w-full">
              <thead>
                <tr className="thead-tr">
                  <th className="thead-th text-center">No</th>
                  <th className="thead-th">Tanggal</th>
                  <th className="thead-th">Nama Pengguna</th>
                  <th className="thead-th">Role Diajukan</th>
                  <th className="thead-th text-center">Status</th>
                  <th className="thead-th text-center" style={{ width: '25%' }}>Action</th>
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
                        <p>{searchTerm ? `Data ${searchTerm} tidak ditemukan` : "Tidak Ada Permohonan"}</p>
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
                      <td className="tbody-td font-semibold text-gray-800">
                        <div className="flex items-center gap-2">
                          {item.pengguna?.name}
                        </div>
                      </td>
                      <td className="tbody-td text-[#3A2000] font-bold">
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
                            title="Lihat Detail & Dokumen"
                            onClick={() => {
                              const slug = createSlug(item);
                              navigate(`/permohonan-peran/list/detail/${slug}`);
                            }}
                          >
                            <FaInfoCircle /> Detail
                          </button>
                          {/* Tombol Verifikasi */}
                          {item.status_permohonan === 'Menunggu' && (
                            <button 
                              className="bg-green-600 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-700 transition shadow-sm flex items-center gap-1"
                              onClick={() => openVerificationModal(item)}
                              title="Proses Permohonan">
                                <FaUserCog /> Proses
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
        {!isLoading && filteredData.length > 0 && (
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

export default AdminPermohonanPeran;