import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaSearch, 
  FaTrash, 
  FaInfoCircle, 
  FaPlus, 
  FaExclamationTriangle,
  FaTimes
} from 'react-icons/fa'; 
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanDesaPersonal.module.css';

// Helper: Modal konfirmasi
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing, variant = 'delete' }) => {
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
              {variant === 'delete' ? <FaTrash size={12} /> : <FaTimes size={12} />} 
              <span className="ml-1">
                {isProcessing ? 'Memproses...' : variant === 'delete' ? 'Ya, Hapus' : 'Ya, Batalkan'}
              </span>
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

// Helper: Membuat format waktu
const formatWaktuRelatif = (dateString) => {
  const tanggalNotif = new Date(dateString);
  const sekarang = new Date();
  const selisihMiliDetik = sekarang - tanggalNotif;
  
  const selisihMenit = Math.floor(selisihMiliDetik / (1000 * 60));
  const selisihJam = Math.floor(selisihMiliDetik / (1000 * 60 * 60));

  if (selisihMenit < 1) return "Baru saja";
  if (selisihMenit < 60) return `${selisihMenit} menit yang lalu`;
  if (selisihJam < 24) return `${selisihJam} jam yang lalu`;
  
  return tanggalNotif.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
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
  
  const notifDropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const [modal, setModal] = useState({ 
    show: false, 
    id: null,
    action: '' 
  });

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

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get('/permohonan-desa/owner');
      setRiwayat(response.data.data || []);
    } catch (error) {
      console.log(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Gagal memuat riwayat permohonan mutasi desa adat.' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWilayahDanDesa();
    fetchData();
  }, [user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HELPER NOTIFIKASI: Mengambil list notifikasi yang masuk
  const fetchNotifikasiLengkap = async () => {
    if (!user) return;
    try {
      const response = await axiosInstance.get('/notifikasi/personal');
      setListNotifikasi(response.data.data || []);
      const unread = response.data.data.filter(n => !n.is_read).length;
      setJumlahNotif(unread);
    } catch (error) {
      console.error("Gagal mengambil list notifikasi masuk", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifikasiLengkap();
    const interval = setInterval(fetchNotifikasiLengkap, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTandaiDibaca = async (notifId) => {
    try {
      await axiosInstance.patch(`/notifikasi/read/${notifId}`);
      await fetchNotifikasiLengkap();
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || "Gagal membaca notifikasi yang masuk.";
      setAlert({ 
        show: true, 
        type: 'error', 
        message: errorMessage 
      });
    }
  };

  const handleExecuteModalAction = async () => {
    if (!modal.id) return;
    setIsSubmitting(true);
    try {
      if (modal.action === 'cancel') {
        await axiosInstance.put(`/permohonan-desa/cancel/${modal.id}`);
        setAlert({ 
          show: true, 
          type: 'success', 
          message: 'Permohonan mutasi desa adat berhasil dibatalkan.' 
        });
      } else if (modal.action === 'delete') {
        await axiosInstance.delete(`/permohonan-desa/${modal.id}`);
        setAlert({ 
          show: true, 
          type: 'success', 
          message: 'Riwayat permohonan mutasi desa adat dan dokumen pendukung berhasil dihapus secara permanen.' 
        });
      }
      fetchData(); 
      setModal({ 
        show: false, 
        id: null, 
        action: '' 
      });
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || `Terjadi kesalahan pada sistem saat memproses riwayat permohonan mutasi desa adat.` 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // HELPER WILAYAH ADAT: Mengambil data hierarki wilayah adat
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

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

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

  useEffect(() => { 
    setCurrentPage(1); 
  }, [searchTerm]);

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
            Riwayat Permohonan Mutasi Desa Adat
          </h2>
          <p className={styles.navSubtitle}>
            Berikut adalah riwayat permohonan mutasi desa adat yang diajukan
          </p>
        </div>
        <div className={styles.navRight}>
          <div ref={notifDropdownRef} className="relative">
            <div className={styles.notifWrapper} onClick={() => setIsDropdownNotifOpen(!isDropdownNotifOpen)}>
              <MdNotificationsNone className={styles.notifIcon} />
              {jumlahNotif > 0 && <span className={styles.notifBadge}>{jumlahNotif}</span>}
            </div>
            {/* DROPDOWN NOTIFIKASI */}
            {isDropdownNotifOpen && (
              <div className={styles.notifDropdownMenu}>
                <div className={styles.notifDropdownHeader}>
                  <h3 className={styles.notifDropdownHeaderTitle}>
                    Pemberitahuan Sistem
                  </h3>
                  {jumlahNotif > 0 && (
                    <span className={styles.notifDropdownHeaderCount}>
                      {jumlahNotif} Baru
                    </span>
                  )}
                </div>
                <div className={styles.notifDropdownBody}>
                  {!user ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      Silakan login untuk melihat pemberitahuan.
                    </div>
                  ) : listNotifikasi.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      Tidak ada pemberitahuan baru.
                    </div>
                  ) : (
                    <div className={styles.notifListContainer}>
                      {listNotifikasi.map((notif) => {
                        const badgeStyles = {
                          VERIFIKASI: styles.badgeVerifikasi,
                          PERINGATAN: styles.badgePeringatan,
                          KONTAK: styles.badgeKontak,
                          LOG_SISTEM: styles.badgeLogSistem,
                          INFORMASI: styles.badgeInformasi,
                        };
                        const activeBadgeStyle = badgeStyles[notif.kategori] || styles.badgeInformasi;

                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              if (!notif.is_read) handleTandaiDibaca(notif.id);
                              if (notif.tautan_fitur) navigate(notif.tautan_fitur);
                            }}
                            className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`${styles.badgeBase} ${activeBadgeStyle}`}>
                                  {notif.kategori}
                                </span>
                                <h4 className={notif.is_read ? styles.notifTitleRead : styles.notifTitleUnread}>
                                  {notif.judul}
                                </h4>
                              </div>
                              <p className={styles.notifDeskripsi}>
                                {notif.deskripsi}
                              </p>
                              <span className={styles.notifTime}>
                                {formatWaktuRelatif(notif.createdAt)}
                              </span>
                            </div>
                            {!notif.is_read && (
                              <div className="flex items-start">
                                <span className={styles.dotUnreadIndicator} title="Belum dibaca" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
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
        onClose={() => setModal({ show: false, id: null, action: '' })}
        onConfirm={handleExecuteModalAction}
        isProcessing={isSubmitting}
        variant={modal.action}
        title={modal.action === 'delete' ? "Hapus Riwayat Permohonan?" : "Batalkan Permohonan?"}
        message={modal.action === 'delete' 
          ? "Apakah Anda yakin ingin menghapus riwayat ini? Data permohonan mutasi desa adat dan dokumen pendukung akan dihapus secara permanen."
          : "Permohonan mutasi desa adat yang dibatalkan bersifat permanen dan tidak akan diproses oleh Admin Terkait."
        }
      />
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
      <div className={styles.contentArea}>
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Cari desa adat asal atau desa adat tujuan..." 
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
                        {searchTerm ? `Data "${searchTerm}" tidak ditemukan` : "Tidak ada data permohonan"}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, index) => {
                  const namaDesa = desaAdatMap[item.desa_adat_id_tujuan] || "Desa Adat Tidak Diketahui";
                  const infoWilayah = item.desa_adat_id_tujuan 
                  ? getWilayahLengkap(item.desa_adat_id_tujuan) 
                  : null;

                  return (
                    <tr key={item.id}>
                      <td className="text-center text-gray-400">
                        {indexOfFirstItem + index + 1}
                      </td>
                      <td className="text-center">
                        {new Date(item.createdAt).toLocaleDateString('id-ID', { 
                          day: 'numeric', month: 'long', year: 'numeric' 
                        })}
                      </td>
                      <td className="text-center">
                        <div className="flex flex-col">
                          <span className="font-bold">
                            {namaDesa}
                          </span>
                          {infoWilayah && (
                            <span className={styles.detailWilayah}>
                              {infoWilayah.kecamatan} • {infoWilayah.kabupaten}
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
                              const slug = createSlug(namaDesa, item.createdAt, item.id);
                              navigate(`/pengajuan-desa-adat/my-data/detail/${slug}`);
                            }}>
                            <FaInfoCircle /> Detail
                          </button>
                          {item.status_validasi_berkas === 'Menunggu Validasi Berkas' && (
                            <button className={styles.btnDelete} onClick={() => setModal({ show: true, id: item.id, action: 'cancel' })}>
                              <FaTimes size={11} /> Batalkan
                            </button>
                          )}
                          {(item.status_permohonan === 'Dibatalkan' || item.status_permohonan === 'Ditolak') && (
                            <button className={styles.btnDelete} onClick={() => setModal({ show: true, id: item.id, action: 'delete' })}>
                              <FaTrash size={11} /> Hapus
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