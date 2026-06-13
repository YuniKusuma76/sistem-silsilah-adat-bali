import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaSearch, 
  FaTrash, 
  FaInfoCircle, 
  FaPlus, 
  FaExclamationTriangle
} from 'react-icons/fa'; 
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanDesaPersonal.module.css';

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
              <FaTrash size={12} /> {isProcessing ? 'Memproses...' : 'Ya, Batalkan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: Membuat slug url
const createSlug = (desa, date, id) => {
  const desaSlug = desa.toLowerCase().replace(/ /g, '-');
  const dateFormatted = new Date(date).toISOString().split('T')[0];
  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${desaSlug}-${dateFormatted}-${encodedId}`;
};

const PengajuanDesaPersonal = ({ user }) => {
  const [riwayat, setRiwayat] = useState([]);
  const [desaAdatMap, setDesaAdatMap] = useState({});

  const [daftarDesaRaw, setDaftarDesaRaw] = useState([]);
  const [daftarKecamatan, setDaftarKecamatan] = useState([]);
  const [daftarKabupaten, setDaftarKabupaten] = useState([]);

  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
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

  // Helper: Mengambil nama desa adat
  const fetchDesaAdat = async () => {
    try {
      const response = await axiosInstance.get('/desa-adat');
      const resData = response.data.data;
      setDaftarDesaRaw(resData);
      
      const map = {};
      response.data.data.forEach(desa => { map[desa.id] = desa.nama_desa_adat; });
      setDesaAdatMap(map);
    } catch (error) {
      console.error("Gagal mengambil data desa adat", error);
    }
  };

  // Helper: Mengambil wilayah adat
  const fetchWilayahData = async () => {
    try {
      const [resKec, resKab] = await Promise.all([
        axiosInstance.get('/kecamatan'),
        axiosInstance.get('/kabupaten')
      ]);
      setDaftarKecamatan(resKec.data.data);
      setDaftarKabupaten(resKab.data.data);
    } catch (error) { 
      console.error(error); 
    }
  };

  // Helper: Fungsi mengambil data permohonan desa adat
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const response = await axiosInstance.get('/permohonan-desa/owner');
      setRiwayat(response.data.data || []);
    } catch (error) {
      console.log(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Gagal memuat riwayat permohonan desa adat.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

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
    fetchDesaAdat();
    fetchWilayahData();
    fetchData();
  }, [location]);

  // Helper: Fungsi mengambil detail wilayah berdasarkan desa adat id
  const getWilayahLengkap = (desaId) => {
    const desa = daftarDesaRaw.find(d => String(d.id) === String(desaId));
    if (!desa) return null;

    const kec = daftarKecamatan.find(k => String(k.id) === String(desa.kecamatan_id));
    const kab = daftarKabupaten.find(kb => String(kb.id) === String(kec?.kabupaten_id));

    return {
      kecamatan: kec ? kec.nama_kecamatan : '-',
      kabupaten: kab ? kab.nama_kabupaten : '-',
    };
  };

  // Halper: Fungsi membatalkan permohonan role
  const handleConfirmBatalkan = async () => {
    if (!modal.id) return;
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-desa/cancel/${modal.id}`);
      setAlert({ 
        show: true, type: 'success', 
        message: 'Permohonan desa adat berhasil dibatalkan.' 
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
        message: error.response?.data?.message || "Gagal membatalkan permohonan desa adat." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Helper: Fungsi search filter riwayat
  const filteredRiwayat = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return riwayat.filter(item => {
      const namaAsal = desaAdatMap[item.desa_adat_id_asal]?.toLowerCase() || "";
      const namaTujuan = desaAdatMap[item.desa_adat_id_tujuan]?.toLowerCase() || "";
      return namaAsal.includes(search) || namaTujuan.includes(search);
    });
  }, [riwayat, searchTerm, desaAdatMap]);

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredRiwayat.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredRiwayat.length / itemsPerPage);

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
      case 'Berkas Valid': 
        return styles.badgeSuccess;
      case 'Ditolak': 
      case 'Berkas Tidak Valid': 
        return styles.badgeDanger;
      case 'Menunggu Verifikasi': 
      case 'Menunggu Validasi Berkas': 
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
            Riwayat Pengajuan Desa Adat
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah riwayat pengajuan perubahan desa adat yang diajukan
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
        onConfirm={handleConfirmBatalkan}
        isProcessing={isSubmitting}
        title="Batalkan Permohonan?"
        message="Permohonan yang dibatalkan tidak akan diproses oleh admin."
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
      {/* List Permohonan Desa */}
      <div className={styles.contentArea}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Cari desa adat asal atau tujuan..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          {user?.role !== 'Super Admin' && user?.role !== 'Pakar' && (
            <button className={styles.btnAddData} onClick={() => navigate('/pengajuan-desa-adat/my-data/add')}>
              <FaPlus size={12} />
              <span>Pengajuan Baru</span>
            </button>
          )}
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className="text-center w-16">No</th>
                <th className="text-center">Tanggal Pengajuan</th>
                <th className="text-center">Desa Adat Tujuan</th>
                <th className="text-center">Status Berkas</th>
                <th className="text-center">Status Permohonan</th>
                <th className="text-center"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="7" className="text-center py-20">
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
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data pengajuan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const namaDesa = desaAdatMap[item.desa_adat_id_tujuan] || "Desa";

                  return (
                    <tr key={item.id}>
                      <td className="text-center text-gray-400">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="text-center">
                        {new Date(item.tanggal_pengajuan).toLocaleDateString('id-ID', { 
                          day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col">
                          <span className="font-bold">
                            {namaDesa}
                          </span>
                          {item.desa_adat_id_tujuan && (
                            <span className="text-[9px] text-amber-800 uppercase font-bold tracking-tighter">
                              {getWilayahLengkap(item.desa_adat_id_tujuan)?.kecamatan} • {getWilayahLengkap(item.desa_adat_id_tujuan)?.kabupaten}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <span className={`${styles.badge} ${getStatusClass(item.status_validasi_berkas)}`}>
                          {item.status_validasi_berkas}
                        </span>
                      </td>
                      <td className="text-center">
                        <span className={`${styles.badge} ${getStatusClass(item.status_permohonan)}`}>
                          {item.status_permohonan}
                        </span>
                      </td>
                      <td className="text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            className={styles.btnDetail} 
                            onClick={() => {
                              const slug = createSlug(namaDesa, item.tanggal_pengajuan, item.id);
                              navigate(`/pengajuan-desa-adat/my-data/detail/${slug}`);
                            }}
                          >
                            <FaInfoCircle /> Detail
                          </button>
                          {item.status_validasi_berkas === 'Menunggu Validasi Berkas' && (
                            <button className={styles.btnDelete} onClick={() => setModal({ show: true, id: item.id })}>
                              <FaTrash size={11} /> Batal
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
          <p>Menampilkan {currentItems.length} dari {filteredRiwayat.length} data</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PengajuanDesaPersonal;