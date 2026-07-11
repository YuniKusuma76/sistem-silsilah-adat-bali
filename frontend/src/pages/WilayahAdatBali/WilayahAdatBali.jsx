import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { 
  MdNotificationsNone,
  MdAddLocationAlt,
  MdEditLocationAlt  
} from 'react-icons/md';
import { 
  FaSearch, 
  FaInfoCircle, 
  FaMapMarkedAlt, 
  FaCity, 
  FaGlobeAsia,
  FaEdit,
  FaTrash,
  FaPlus,
  FaTimes,
  FaSave 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './WilayahAdatBali.module.css';

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

const WilayahAdatBali = ({ user }) => {
  const [dataDesa, setDataDesa] = useState([]);
  const [dataKecamatan, setDataKecamatan] = useState([]);
  const [dataKabupaten, setDataKabupaten] = useState([]);
  const [dataProvinsi, setDataProvinsi] = useState([]);

  const notifDropdownRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('desa');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const navigate = useNavigate();

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editId, setEditId] = useState(null);
  const [deleteTargetName, setDeleteTargetName] = useState('');
  
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });
  
  const [formData, setFormData] = useState({
    nama_wilayah: '',
    parent_id: ''
  });
  
  const [editFormData, setEditFormData] = useState({
    nama_wilayah: '',
    parent_id: ''
  });

  const [deleteTarget, setDeleteTarget] = useState({ 
    id: null, 
    type: '' 
  });

  const fetchAllWilayah = async () => {
    try {
      setLoading(true);
      const [resDesa, resKec, resKab, resProv] = await Promise.all([
        axiosInstance.get('/desa-adat'),
        axiosInstance.get('/kecamatan'),
        axiosInstance.get('/kabupaten'),
        axiosInstance.get('/provinsi')
      ]);

      setDataDesa(resDesa.data?.data || []);
      setDataKecamatan(resKec.data?.data || []);
      setDataKabupaten(resKab.data?.data || []);
      setDataProvinsi(resProv.data?.data || []);
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: 'Gagal memuat beberapa data wilayah geografis adat Bali.'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllWilayah();
  }, []);

  const openAddModal = () => {
    setFormData({ nama_wilayah: '', parent_id: '' });
    setIsAddModalOpen(true);
  };

  const handleEdit = (id, type) => {
    setEditId(id);
    let selectedData = null;

    switch (type) {
      case 'desa':
        selectedData = dataDesa.find(item => item.id === id);
        setEditFormData({
          nama_wilayah: selectedData?.nama_desa_adat || '',
          parent_id: selectedData?.kecamatan?.id || selectedData?.kecamatan_id || ''
        });
        break;
      case 'kecamatan':
        selectedData = dataKecamatan.find(item => item.id === id);
        setEditFormData({
          nama_wilayah: selectedData?.nama_kecamatan || '',
          parent_id: selectedData?.kabupaten?.id || selectedData?.kecamatan_id || ''
        });
        break;
      case 'kabupaten':
        selectedData = dataKabupaten.find(item => item.id === id);
        setEditFormData({
          nama_wilayah: selectedData?.nama_kabupaten || '',
          parent_id: selectedData?.provinsi?.id || selectedData?.provinsi_id || ''
        });
        break;
      case 'provinsi':
        selectedData = dataProvinsi.find(item => item.id === id);
        setEditFormData({
          nama_wilayah: selectedData?.nama_provinsi || '',
          parent_id: ''
        });
        break;
      default:
        return;
    }
    setIsEditModalOpen(true);
  };

  const handleDelete = (id, type) => {
    setDeleteTarget({ id, type });
    let selectedData = null;
    switch (type) {
      case 'desa':
        selectedData = dataDesa.find(item => item.id === id);
        setDeleteTargetName(selectedData?.nama_desa_adat || 'Desa Adat ini');
        break;
      case 'kecamatan':
        selectedData = dataKecamatan.find(item => item.id === id);
        setDeleteTargetName(selectedData?.nama_kecamatan || 'Kecamatan ini');
        break;
      case 'kabupaten':
        selectedData = dataKabupaten.find(item => item.id === id);
        setDeleteTargetName(selectedData?.nama_kabupaten || 'Kabupaten ini');
        break;
      case 'provinsi':
        selectedData = dataProvinsi.find(item => item.id === id);
        setDeleteTargetName(selectedData?.nama_provinsi || 'Provinsi ini');
        break;
      default:
        return;
    }
    setIsDeleteModalOpen(true);
  };

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HELPER NOTIFIKASI: mengambil list notifikasi yang masuk
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleEditInputChange = (e) => {
    const { name, value } = e.target;
    setEditFormData(prev => ({ ...prev, [name]: value }));
  };

  // Helper: menangani crud wilayah adat
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.nama_wilayah) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Nama wilayah tidak boleh kosong!' 
      });
      return;
    }

    try {
      setLoading(true);
      let endpoint = '';
      let payload = {};

      switch (activeTab) {
        case 'desa':
          endpoint = '/desa-adat';
          payload = { 
            nama_desa_adat: formData.nama_wilayah, 
            kecamatan_id: formData.parent_id 
          };
          break;
        case 'kecamatan':
          endpoint = '/kecamatan';
          payload = { 
            nama_kecamatan: formData.nama_wilayah, 
            kabupaten_id: formData.parent_id 
          };
          break;
        case 'kabupaten':
          endpoint = '/kabupaten';
          payload = { 
            nama_kabupaten: formData.nama_wilayah, 
            provinsi_id: formData.parent_id 
          };
          break;
        case 'provinsi':
          endpoint = '/provinsi';
          payload = { 
            nama_provinsi: formData.nama_wilayah 
          };
          break;
        default:
          return;
      }

      const response = await axiosInstance.post(endpoint, payload);
      if (response.status === 200 || response.status === 201) {
        setAlert({
          show: true,
          type: 'success',
          message: `Berhasil menambahkan data ${activeTab === 'desa' ? 'Desa Adat' : activeTab} baru!`
        });
        setIsAddModalOpen(false);
        fetchAllWilayah();
      }
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat menyimpan wilayah baru.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();

    if (!editFormData.nama_wilayah) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Nama wilayah tidak boleh kosong!' 
      });
      return;
    }

    try {
      setLoading(true);
      let endpoint = '';
      let payload = {};

      switch (activeTab) {
        case 'desa':
          endpoint = `/desa-adat/${editId}`;
          payload = { 
            nama_desa_adat: editFormData.nama_wilayah, 
            kecamatan_id: editFormData.parent_id 
          };
          break;
        case 'kecamatan':
          endpoint = `/kecamatan/${editId}`;
          payload = { 
            nama_kecamatan: editFormData.nama_wilayah, 
            kabupaten_id: editFormData.parent_id 
          };
          break;
        case 'kabupaten':
          endpoint = `/kabupaten/${editId}`;
          payload = { 
            nama_kabupaten: editFormData.nama_wilayah, 
            provinsi_id: editFormData.parent_id 
          };
          break;
        case 'provinsi':
          endpoint = `/provinsi/${editId}`;
          payload = { 
            nama_provinsi: editFormData.nama_wilayah 
          };
          break;
        default:
          return;
      }

      const response = await axiosInstance.put(endpoint, payload);
      if (response.status === 200) {
        setAlert({
          show: true,
          type: 'success',
          message: `Berhasil memperbarui data ${activeTab === 'desa' ? 'Desa Adat' : activeTab}!`
        });
        setIsEditModalOpen(false);
        fetchAllWilayah();
      }
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat memperbarui wilayah adat.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDeleteSubmit = async () => {
    const { id, type } = deleteTarget;
    if (!id || !type) return;

    try {
      setLoading(true);
      let endpoint = '';

      switch (type) {
        case 'desa': 
          endpoint = `/desa-adat/${id}`; 
          break;
        case 'kecamatan': 
          endpoint = `/kecamatan/${id}`; 
          break;
        case 'kabupaten': 
          endpoint = `/kabupaten/${id}`; 
          break;
        case 'provinsi':
            endpoint = `/provinsi/${id}`; 
            break;
        default: return;
      }

      const response = await axiosInstance.delete(endpoint);
      if (response.status === 200 || response.status === 204) {
        setAlert({
          show: true,
          type: 'success',
          message: `Berhasil menghapus data wilayah ${type === 'desa' ? 'Desa Adat' : type}.`
        });
        setIsDeleteModalOpen(false);
        fetchAllWilayah();
      }
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat memperbarui wilayah adat.' 
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper: menangani tombol aksi
  const renderActionButtons = (id, type) => (
    <td className="text-center">
      <div className="flex justify-center gap-2">
        {user.role === "Super Admin" && (
          <>
            <button className={styles.btnEdit} onClick={() => handleEdit(id, type)}>
              <FaEdit size={12} /> Edit
            </button>
            <button className={styles.btnDelete} onClick={() => handleDelete(id, type)}>
              <FaTrash size={11} /> Hapus
            </button>
          </>
        )}
      </div>
    </td>
  );

  const currentTabConfig = useMemo(() => {
    switch (activeTab) {
      case 'kecamatan':
        return {
          rawList: dataKecamatan,
          searchField: 'nama_kecamatan',
          headers: ['No', 'Nama Kecamatan', 'Nama Kabupaten', ''],
          renderRow: (item, idx) => (
            <tr key={item.id || idx}>
              <td className="text-center text-gray-400">
                {idx + 1}
              </td>
              <td className="text-gray-700 font-semibold">
                {item.nama_kecamatan}
              </td>
              <td className="text-gray-600 text-sm">
                {item.kabupaten?.nama_kabupaten || '-'}
              </td>
              {renderActionButtons(item.id, 'kecamatan')}
            </tr>
          )
        };
      case 'kabupaten':
        return {
          rawList: dataKabupaten,
          searchField: 'nama_kabupaten',
          headers: ['No', 'Nama Kabupaten/Kota', 'Nama Provinsi', ''],
          renderRow: (item, idx) => (
            <tr key={item.id || idx}>
              <td className="text-center text-gray-400">
                {idx + 1}
              </td>
              <td className="text-gray-700 font-semibold">
                {item.nama_kabupaten}
              </td>
              <td className="text-gray-600 text-sm">
                {item.provinsi?.nama_provinsi || '-'}
              </td>
              {renderActionButtons(item.id, 'kabupaten')}
            </tr>
          )
        };
      case 'provinsi':
        return {
          rawList: dataProvinsi,
          searchField: 'nama_provinsi',
          headers: ['No', 'Nama Provinsi', ''],
          renderRow: (item, idx) => (
            <tr key={item.id || idx}>
              <td className="text-center text-gray-400">
                {idx + 1}
              </td>
              <td className="text-gray-700 font-semibold">
                {item.nama_provinsi}
              </td>
              {renderActionButtons(item.id, 'provinsi')}
            </tr>
          )
        };
      case 'desa':
      default:
        return {
          rawList: dataDesa,
          searchField: 'nama_desa_adat',
          headers: ['No', 'Nama Desa Adat', 'Kecamatan', ''],
          renderRow: (item, idx) => (
            <tr key={item.id || idx}>
              <td className="text-center text-gray-400">
                {idx + 1}
              </td>
              <td className="text-gray-700 font-semibold">
                {item.nama_desa_adat}
              </td>
              <td className="text-gray-600 text-sm">
                {item.kecamatan?.nama_kecamatan || '-'}
              </td>
              {renderActionButtons(item.id, 'desa')}
            </tr>
          )
        };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, dataDesa, dataKecamatan, dataKabupaten, dataProvinsi]);

  const filteredData = useMemo(() => {
    return currentTabConfig.rawList.filter(item => {
      const valueToSearch = item[currentTabConfig.searchField];
      return valueToSearch?.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [currentTabConfig, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const goToPage = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  // Helper: merender halaman pagination
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
            Data Wilayah Adat Bali
          </h2>
          <p className={styles.navSubtitle}>
            Manajemen pemetaan wilayah daerah dan desa adat di Bali
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
        <div className={styles.tabContainer}>
          <button 
            onClick={() => setActiveTab('desa')} 
            className={`${styles.tabButton} ${activeTab === 'desa' ? styles.tabActive : ''}`}>
            <FaMapMarkedAlt size={14} /> 
            <span>Desa Adat ({dataDesa.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('kecamatan')} 
            className={`${styles.tabButton} ${activeTab === 'kecamatan' ? styles.tabActive : ''}`}>
            <HiOutlineOfficeBuilding size={14} /> 
            <span>Kecamatan ({dataKecamatan.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('kabupaten')} 
            className={`${styles.tabButton} ${activeTab === 'kabupaten' ? styles.tabActive : ''}`}>
            <FaCity size={14} /> 
            <span>Kabupaten ({dataKabupaten.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('provinsi')} 
            className={`${styles.tabButton} ${activeTab === 'provinsi' ? styles.tabActive : ''}`}>
            <FaGlobeAsia size={14} /> 
            <span>Provinsi ({dataProvinsi.length})</span>
          </button>
        </div>
        <div className={styles.toolbar}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder={`Cari nama ${activeTab === 'desa' ? 'desa adat' : activeTab}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          {user.role === "Super Admin" && (
            <button className={styles.btnAddData} onClick={openAddModal}>
              <FaPlus size={12} /> 
              <span>Tambah {activeTab === 'desa' ? 'Desa Adat' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
            </button>
          )}
        </div>
        {/* List Wilayah Bali */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {currentTabConfig.headers.map((head, i) => {
                  let thClass = "py-4 px-6 font-bold tracking-wider";
                  if (head === 'No' || head === '') {
                    thClass += " text-center w-24";
                  } else {
                    thClass += " text-left text-xs";
                  }
                  return (
                    <th key={i} className={thClass}>
                      {head}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={currentTabConfig.headers.length} className="text-center py-20">
                    <div className={styles.loadContainer}>
                      <div className={`${styles.loadSpinner} animate-spin`}></div>
                      <span className="text-gray-400 font-medium">
                        Memuat data wilayah...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={currentTabConfig.headers.length} className="text-center py-20 text-gray-400">
                    <div className={styles.infoDataContent}>
                      <FaInfoCircle className={styles.infoDataIcon} />
                      <p className="text-sm font-semibold text-gray-500 mt-2">
                        {searchTerm ? `Data wilayah "${searchTerm}" tidak ditemukan` : "Tidak ada data wilayah tersedia."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                currentItems.map((item, idx) => currentTabConfig.renderRow(item, indexOfFirstItem + idx))
              )}
            </tbody>
          </table>
        </div>
        {/* PAGINATION PANEL */}
        <div className={styles.pagination}>
          <p>Menampilkan {currentItems.length} dari {filteredData.length} data</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      {/* MODAL ADD DATA WILAYAH */}
      {isAddModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-in`}>
            <div className={styles.headerModal}>
              <h3>
                <MdAddLocationAlt size={18} className="text-amber-700 mr-1" /> 
                Menambahkan Wilayah {activeTab === 'desa' ? 'Desa Adat' : activeTab}
              </h3>
              <FaTimes className={styles.iconClose} onClick={() => setIsAddModalOpen(false)} size={16} />
            </div>
            <form onSubmit={handleAddSubmit}>
              <div className={styles.modalInputGroup}>
                <label>
                  Nama {activeTab === 'desa' ? 'Desa Adat' : activeTab}
                </label>
                <input 
                  type="text"
                  name="nama_wilayah"
                  placeholder={`Masukkan nama ${activeTab === 'desa' ? 'desa adat' : activeTab}...`}
                  value={formData.nama_wilayah}
                  onChange={handleInputChange}
                  required
                />
              </div>
              {activeTab !== 'provinsi' && (
                <div className={styles.modalInputGroup}>
                  <label>
                    {activeTab === 'desa' && 'Pilih Kecamatan'}
                    {activeTab === 'kecamatan' && 'Pilih Kabupaten'}
                    {activeTab === 'kabupaten' && 'Pilih Provinsi'}
                  </label>
                  <select
                    name="parent_id"
                    value={formData.parent_id}
                    onChange={handleInputChange}
                    required>
                    <option value="">- Pilih -</option>
                    {activeTab === 'desa' && dataKecamatan.map(kec => (
                      <option key={kec.id} value={kec.id}>{kec.nama_kecamatan}</option>
                    ))}
                    {activeTab === 'kecamatan' && dataKabupaten.map(kab => (
                      <option key={kab.id} value={kab.id}>{kab.nama_kabupaten}</option>
                    ))}
                    {activeTab === 'kabupaten' && dataProvinsi.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nama_provinsi}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" className={styles.btnCancel} onClick={() => setIsAddModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.btnSaveAction}>
                  <FaSave size={12} /> Simpan Data
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL EDIT DATA WILAYAH */}
      {isEditModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-in`}>
            <div className={styles.headerModal}>
              <h3>
                <MdEditLocationAlt size={18} className="text-amber-700 mr-1" /> 
                Memperbarui Data {activeTab === 'desa' ? 'Desa Adat' : activeTab}
              </h3>
              <FaTimes className={styles.iconClose} onClick={() => setIsEditModalOpen(false)} size={16} />
            </div>
            <form onSubmit={handleEditSubmit}>
              <div className={styles.modalInputGroup}>
                <label>
                  Nama {activeTab === 'desa' ? 'Desa Adat' : activeTab}
                </label>
                <input 
                  type="text"
                  name="nama_wilayah"
                  placeholder={`Perbarui nama ${activeTab === 'desa' ? 'desa adat' : activeTab}...`}
                  value={editFormData.nama_wilayah}
                  onChange={handleEditInputChange}
                  required
                />
              </div>
              {activeTab !== 'provinsi' && (
                <div className={styles.modalInputGroup}>
                  <label>
                    {activeTab === 'desa' && 'Kecamatan'}
                    {activeTab === 'kecamatan' && 'Kabupaten'}
                    {activeTab === 'kabupaten' && 'Provinsi'}
                  </label>
                  <select
                    name="parent_id"
                    value={editFormData.parent_id}
                    onChange={handleEditInputChange}
                    required>
                    <option value="">- Pilih -</option>
                    {activeTab === 'desa' && dataKecamatan.map(kec => (
                      <option key={kec.id} value={kec.id}>{kec.nama_kecamatan}</option>
                    ))}
                    {activeTab === 'kecamatan' && dataKabupaten.map(kab => (
                      <option key={kab.id} value={kab.id}>{kab.nama_kabupaten}</option>
                    ))}
                    {activeTab === 'kabupaten' && dataProvinsi.map(prov => (
                      <option key={prov.id} value={prov.id}>{prov.nama_provinsi}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-100">
                <button type="button" className={styles.btnCancel} onClick={() => setIsEditModalOpen(false)}>
                  Batal
                </button>
                <button type="submit" className={styles.btnSaveAction}>
                  <FaSave size={12} /> Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI DELETE */}
      {isDeleteModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContainer} animate-fade-in`}>
            <div className="p-6 text-center">
              <div className="flex justify-center mb-7 mt-6">
              <div className={styles.elipsis}>
                <FaTrash className="text-red-600 text-2xl" />
              </div>
              </div>
              <h3 className="text-base font-bold text-gray-800 mt-4">
                Hapus Wilayah Adat?
              </h3>
              <p className="text-xs text-gray-500 mt-2 px-2 leading-relaxed">
                Apakah Anda yakin ingin menghapus <span className="font-extrabold text-red-600">"{deleteTargetName}"</span>? 
                Data yang sudah dihapus tidak dapat dikembalikan.
              </p>
              <div className="flex gap-3 mt-6 justify-center">
                <button type="button" className={styles.btnCancel} onClick={() => setIsDeleteModalOpen(false)}>
                  Batal
                </button>
                <button type="button" className={styles.btnDeleteAction} onClick={confirmDeleteSubmit}>
                  Ya, Hapus Data
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default WilayahAdatBali;