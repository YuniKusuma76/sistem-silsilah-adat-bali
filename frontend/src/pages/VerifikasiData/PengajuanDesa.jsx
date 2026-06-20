import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaSearch, 
  FaArrowLeft, 
  FaInfoCircle, 
  FaSpinner
} from 'react-icons/fa'; 
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanDesa.module.css';

// Helper: Membuat slug url
const createSlug = (desa, date, id) => {
  if (!desa) return id;
  const desaSlug = desa.toLowerCase().replace(/ /g, '-');
  const dateFormatted = new Date(date).toISOString().split('T')[0];
  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${desaSlug}-${dateFormatted}-${encodedId}`;
};

const PengajuanDesa = ({ user }) => {
  const [dataPengajuan, setDataPengajuan] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const [desaAdatMap, setDesaAdatMap] = useState({});
  const [daftarDesaRaw, setDaftarDesaRaw] = useState([]);
  const [daftarKecamatan, setDaftarKecamatan] = useState([]);
  const [daftarKabupaten, setDaftarKabupaten] = useState([]);

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

  const isAdminDesa = user?.role === 'Admin Desa';
  const isSuperAdmin = user?.role === 'Super Admin';

  // Helper: Mengambil wilayah adat
  const fetchWilayahDanDesa = async () => {
    try {
      const [resDesa, resKec, resKab] = await Promise.all([
        axiosInstance.get('/desa-adat'),
        axiosInstance.get('/kecamatan'),
        axiosInstance.get('/kabupaten')
      ]);

      const desaData = resDesa.data?.data || [];
      setDaftarDesaRaw(desaData);
      setDaftarKecamatan(resKec.data?.data || []);
      setDaftarKabupaten(resKab.data?.data || []);

      const map = {};
      desaData.forEach(desa => { 
        map[desa.id] = desa.nama_desa_adat; 
      });
      setDesaAdatMap(map);
    } catch (error) {
      console.error("Gagal memuat data wilayah adat:", error);
    }
  };

  // Helper: Fungsi mengambil data permohonan mutasi desa adat
  const fetchData = async () => {
    try {
      setIsLoading(true);
      const targetEndpoint = isAdminDesa 
        ? '/permohonan-desa/berkas-desa' 
        : '/permohonan-desa/berkas-pusat';

      const response = await axiosInstance.get(targetEndpoint);
      setDataPengajuan(response.data?.data || []);
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memuat data permohonan mutasi desa adat." 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWilayahDanDesa();
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

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

  // Effect: Auto-Close Notifikasi Alert
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: Fungsi search filter riwayat
  const filteredRiwayat = useMemo(() => {
    const search = searchTerm.toLowerCase();
    return dataPengajuan.filter(item => {
      const namaAsal = desaAdatMap[item.desa_adat_id_asal]?.toLowerCase() || "";
      const namaTujuan = desaAdatMap[item.desa_adat_id_tujuan]?.toLowerCase() || "";
      return namaAsal.includes(search) || namaTujuan.includes(search);
    });
  }, [dataPengajuan, searchTerm, desaAdatMap]);

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
            Verifikasi Permohonan Mutasi Desa Adat
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah data permohonan mutasi desa adat yang diajukan
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
      {/* List Permohonan Desa Adat */}
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
                <th className="text-center">Tanggal Pengajuan</th>
                <th className="text-center">Desa Adat Asal</th>
                <th className="text-center">Desa Adat Tujuan</th>
                {isAdminDesa && <th className="text-center">Status Berkas</th>}
                {isSuperAdmin && <th className="text-center">Status Permohonan</th>}
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
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data permohonan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const namaDesaTujuan = desaAdatMap[item.desa_adat_id_tujuan] || "Desa Adat Tidak Diketahui";
                  const namaDesaAsal = desaAdatMap[item.desa_adat_id_asal] || "Desa Adat Tidak Diketahui";
                  const infoWilayahTujuan = item.desa_adat_id_tujuan 
                    ? getWilayahLengkap(item.desa_adat_id_tujuan) 
                    : null;
                  const infoWilayahAsal = item.desa_adat_id_asal 
                    ? getWilayahLengkap(item.desa_adat_id_asal) 
                    : null;

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
                            {namaDesaAsal}
                          </span>
                          {infoWilayahAsal && (
                            <span className={styles.detailWilayah}>
                              {infoWilayahAsal.kecamatan} • {infoWilayahAsal.kabupaten}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col">
                          <span className="font-bold">
                            {namaDesaTujuan}
                          </span>
                          {infoWilayahTujuan && (
                            <span className={styles.detailWilayah}>
                              {infoWilayahTujuan.kecamatan} • {infoWilayahTujuan.kabupaten}
                            </span>
                          )}
                        </div>
                      </td>
                      {isAdminDesa && (
                        <td className="text-center">
                          <span className={`${styles.badge} ${getStatusClass(item.status_validasi_berkas)}`}>
                            {item.status_validasi_berkas}
                          </span>
                        </td>
                      )}
                      {isSuperAdmin && (
                        <td className="text-center">
                          <span className={`${styles.badge} ${getStatusClass(item.status_permohonan)}`}>
                            {item.status_permohonan}
                          </span>
                        </td>
                      )}
                      <td className="text-center">
                        <div className="flex justify-center gap-2">
                          <button 
                            className={styles.btnDetail} 
                            onClick={() => {
                              const slug = createSlug(namaDesaTujuan, item.tanggal_pengajuan, item.id);
                              navigate(`/verifikasi-data/pengajuan-desa-adat/detail/${slug}`);
                            }}
                          >
                            <FaInfoCircle /> Detail
                          </button>
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

export default PengajuanDesa;