import React, { useState, useEffect } from 'react';
import { MdNotificationsNone, MdAddLocationAlt  } from 'react-icons/md';
import { HiOutlineOfficeBuilding } from 'react-icons/hi';
import { 
  FaSearch, 
  FaInfoCircle, 
  FaMapMarkedAlt, 
  FaCity, 
  FaGlobeAsia,
  FaEdit,
  FaTrash,
  FaExclamationTriangle,
  FaPlus,
  FaSave,
  FaTimes
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './WilayahAdatBali.module.css';

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
              <FaTrash size={12} /> {isProcessing ? 'Memproses...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: Modal menambahkan data baru
const AddWilayahModal = ({ isOpen, onClose, onSave, activeTab, isProcessing, listOptions }) => {
  const [inputName, setInputName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');

  useEffect(() => {
    setInputName('');
    setSelectedParentId('');
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    onSave({
      name: inputName.trim(),
      parentId: selectedParentId
    });
  };

  // Helper: Label penentu judul card
  const getModalTitleAndLabels = () => {
    switch (activeTab) {
      case 'provinsi':
        return { 
          title: 'Menambahkan Provinsi Baru', 
          inputLabel: 'Nama Provinsi', 
          placeholder: 'Masukkan nama provinsi...', 
          parentLabel: null 
        };
      case 'kabupaten':
        return { 
          title: 'Menambahkan Kabupaten/Kota Baru', 
          inputLabel: 'Nama Kabupaten/Kota', 
          placeholder: 'Masukkan nama kabupaten...', 
          parentLabel: 'Nama Provinsi Induk' 
        };
      case 'kecamatan':
        return { 
          title: 'Menambahkan Kecamatan Baru', 
          inputLabel: 'Nama Kecamatan', 
          placeholder: 'Masukkan nama kecamatan...', 
          parentLabel: 'Nama Kabupaten Induk' 
        };
      case 'desa':
      default:
        return { 
          title: 'Menambahkan Desa Adat Baru', 
          inputLabel: 'Nama Desa Adat', 
          placeholder: 'Masukkan nama desa adat...', 
          parentLabel: 'Nama Kecamatan Induk' 
        };
    }
  };

  const config = getModalTitleAndLabels();

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} animate-fade-in`}>
        <div className={styles.headerModal}>
          <h3>
            <MdAddLocationAlt size={21} className="text-amber-700 mr-2" /> {config.title}
          </h3>
          <button onClick={onClose} disabled={isProcessing} className={`${styles.iconClose} mb-2`}>
            <FaTimes size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmitForm} className="p-6">
          {config.parentLabel && (
            <div className={styles.modalInputGroup}>
              <label>{config.parentLabel} <span className="text-red-500">*</span></label>
              <select 
                value={selectedParentId} 
                onChange={(e) => setSelectedParentId(e.target.value)}
                className={styles.inputForm}
                required
              >
                <option value="">- Pilih -</option>
                {listOptions.map(opt => (
                  <option key={opt.id} value={opt.id}>{opt.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.modalInputGroup}>
            <label>{config.inputLabel} <span className="text-red-500">*</span></label>
            <input 
              type="text" 
              placeholder={config.placeholder}
              value={inputName}
              className={styles.inputForm}
              onChange={(e) => setInputName(e.target.value)}
              required
            />
          </div>
          <div className="mt-8 flex gap-3 justify-end">
            <button type="button" onClick={onClose} disabled={isProcessing} className={styles.btnCancel}>
              Batal
            </button>
            <button type="submit" disabled={isProcessing} className={styles.btnSaveAction}>
              <FaSave size={12} /> {isProcessing ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Helper: Modal mengedit data
const EditWilayahModal = ({ isOpen, onClose, onUpdate, activeTab, isProcessing, listOptions, selectedItem }) => {
  const [inputName, setInputName] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');

  // Effect: Mengambil data lama
  useEffect(() => {
    if (isOpen && selectedItem) {
      if (activeTab === 'provinsi') {
        setInputName(selectedItem.nama_provinsi || '');
        setSelectedParentId('');
      } else if (activeTab === 'kabupaten') {
        setInputName(selectedItem.nama_kabupaten || '');
        // FIX: Paksa ke String agar select option mendeteksi kecocokan value
        setSelectedParentId(selectedItem.provinsi_id ? String(selectedItem.provinsi_id) : '');
      } else if (activeTab === 'kecamatan') {
        setInputName(selectedItem.nama_kecamatan || '');
        // FIX: Paksa ke String
        setSelectedParentId(selectedItem.kabupaten_id ? String(selectedItem.kabupaten_id) : '');
      } else {
        setInputName(selectedItem.nama_desa_adat || '');
        // FIX: Paksa ke String
        setSelectedParentId(selectedItem.kecamatan_id ? String(selectedItem.kecamatan_id) : '');
      }
    }
  }, [isOpen, selectedItem, activeTab]);

  if (!isOpen) return null;

  const handleSubmitForm = (e) => {
    e.preventDefault();
    if (!inputName.trim()) return;
    onUpdate({ 
      name: inputName.trim(), 
      parentId: selectedParentId 
    });
  };

  // Label penentu judul dinamis
  const getModalConfig = () => {
    switch (activeTab) {
      case 'provinsi': 
        return { 
          title: 'Memperbarui Data Provinsi', 
          inputLabel: 'Nama Provinsi', 
          parentLabel: null 
        };
      case 'kabupaten': 
      return { 
        title: 'Memperbarui Data Kabupaten/Kota', 
        inputLabel: 'Nama Kabupaten/Kota', 
        parentLabel: 'Nama Provinsi Induk' 
      };
      case 'kecamatan': 
        return { 
          title: 'Memperbarui Data Kecamatan', 
          inputLabel: 'Nama Kecamatan', 
          parentLabel: 'Nama Kabupaten Induk' 
        };
      case 'desa':
      default: 
        return { 
          title: 'Memperbarui Data Desa Adat', 
          inputLabel: 'Nama Desa Adat', 
          parentLabel: 'Nama Kecamatan Induk' 
        };
    }
  };

  const config = getModalConfig();

  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContent} animate-fade-in`}>
        <div className={styles.headerModal}>
          <h3>
            <MdAddLocationAlt size={21} className="text-amber-700 mr-2" /> {config.title}
          </h3>
          <button onClick={onClose} disabled={isProcessing} className={`${styles.iconClose} mb-2`}>
            <FaTimes size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmitForm} className="p-6">
          {config.parentLabel && (
            <div className={styles.modalInputGroup}>
              <label>
                {config.parentLabel} <span className="text-red-500">*</span>
              </label>
              <select 
                value={selectedParentId} 
                onChange={(e) => setSelectedParentId(e.target.value)}
                className={styles.inputForm}
                required
              >
                <option value="">- Pilih -</option>
                {listOptions.map(opt => (
                  <option key={opt.id} value={String(opt.id)}>{opt.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className={styles.modalInputGroup}>
            <label>
              {config.inputLabel} <span className="text-red-500">*</span>
            </label>
            <input 
              type="text" 
              value={inputName}
              className={styles.inputForm}
              onChange={(e) => setInputName(e.target.value)}
              required
            />
          </div>
          <div className="mt-8 flex gap-3 justify-end">
            <button type="button" onClick={onClose} disabled={isProcessing} className={styles.btnCancel}>
              Batal
            </button>
            <button type="submit" disabled={isProcessing} className={styles.btnSaveAction}>
              <FaSave size={12} /> {isProcessing ? 'Menyimpan...' : 'Simpan Data'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const WilayahAdatBali = () => {
  const [dataDesa, setDataDesa] = useState([]);
  const [dataKecamatan, setDataKecamatan] = useState([]);
  const [dataKabupaten, setDataKabupaten] = useState([]);
  const [dataProvinsi, setDataProvinsi] = useState([]);

  const [isDeleting, setIsDeleting] = useState(false);
  const [isSavingNew, setIsSavingNew] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('desa');

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
    id: null,
    type: ''
  });

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedRowData, setSelectedRowData] = useState(null);

  // Helper: Fungsi mengambil semua data wilayah
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
      console.error("Gagal memuat data wilayah:", error);
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

  // Effect: Setting current page aktif default 1
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  // Helper: Fungsi menyimpan data wilayah baru
  const handleSaveNewWilayah = async (submittedData) => {
    setIsSavingNew(true);
    let endpoint = '/desa-adat';
    let payload = {};

    if (activeTab === 'provinsi') {
      endpoint = '/provinsi';
      payload = { nama_provinsi: submittedData.name };
    } else if (activeTab === 'kabupaten') {
      endpoint = '/kabupaten';
      payload = { 
        nama_kabupaten: submittedData.name, 
        provinsi_id: Number(submittedData.parentId) 
      };
    } else if (activeTab === 'kecamatan') {
      endpoint = '/kecamatan';
      payload = { 
        nama_kecamatan: submittedData.name, 
        kabupaten_id: Number(submittedData.parentId) 
      };
    } else {
      endpoint = '/desa-adat';
      payload = { 
        nama_desa_adat: submittedData.name, 
        kecamatan_id: Number(submittedData.parentId) 
      };
    }

    try {
      await axiosInstance.post(endpoint, payload);
      setAlert({
        show: true,
        type: 'success',
        message: `Data ${activeTab === 'desa' ? 'Desa Adat' : activeTab} baru berhasil ditambahkan!`
      });
      setIsAddModalOpen(false);
      fetchAllWilayah();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menyimpan data wilayah baru.'
      });
    } finally {
      setIsSavingNew(false);
    }
  };

  // Helper: Fungsi memperbarui data
  const handleUpdateWilayah = async (submittedData) => {
    if (!selectedRowData?.id) return;
    setIsUpdating(true);
    let endpoint = `/desa-adat/${selectedRowData.id}`;
    let payload = {};

    if (activeTab === 'provinsi') { 
      endpoint = `/provinsi/${selectedRowData.id}`; 
      payload = { nama_provinsi: submittedData.name }; 
    } else if (activeTab === 'kabupaten') { 
      endpoint = `/kabupaten/${selectedRowData.id}`; 
      payload = { 
        nama_kabupaten: submittedData.name, 
        provinsi_id: Number(submittedData.parentId) 
      }; 
    } else if (activeTab === 'kecamatan') { 
      endpoint = `/kecamatan/${selectedRowData.id}`; 
      payload = { 
        nama_kecamatan: submittedData.name, 
        kabupaten_id: Number(submittedData.parentId) 
      }; 
    } else { 
      endpoint = `/desa-adat/${selectedRowData.id}`; 
      payload = { 
        nama_desa_adat: submittedData.name, 
        kecamatan_id: Number(submittedData.parentId) 
      }; 
    }

    try {
      await axiosInstance.put(endpoint, payload);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Perubahan data wilayah berhasil disimpan!' 
      });
      setIsEditModalOpen(false);
      setSelectedRowData(null);
      fetchAllWilayah();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal mengubah data.' 
      });
    } finally { 
      setIsUpdating(false); 
    }
  };

  // Helper: Fungsi menghapus data wilayah berdasarkan tab aktif
  const handleDeleteWilayah = async () => {
    if (!modal.id || !modal.type) return;
    setIsDeleting(true);
    
    let endpoint = `/desa-adat/${modal.id}`;
    if (modal.type === 'kecamatan') endpoint = `/kecamatan/${modal.id}`;
    if (modal.type === 'kabupaten') endpoint = `/kabupaten/${modal.id}`;
    if (modal.type === 'provinsi') endpoint = `/provinsi/${modal.id}`;

    try {
      await axiosInstance.delete(endpoint);
      const namaWilayahDisplay = modal.type === 'desa' ? 'Desa Adat' : modal.type.charAt(0).toUpperCase() + modal.type.slice(1);

      setAlert({
        show: true,
        type: 'success',
        message: `Data ${namaWilayahDisplay} berhasil dihapus dari sistem.`
      });
      setModal({ show: false, id: null, type: '' });
      fetchAllWilayah();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || `Gagal menghapus data wilayah.`
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper: Menentukan data opsi induk
  const getParentOptionsList = () => {
    if (activeTab === 'kabupaten') {
      return dataProvinsi.map(p => ({ 
        id: p.id, 
        name: p.nama_provinsi 
      }));
    }
    if (activeTab === 'kecamatan') {
      return dataKabupaten.map(k => ({ 
        id: k.id, 
        name: k.nama_kabupaten 
      }));
    }
    if (activeTab === 'desa') {
      return dataKecamatan.map(k => ({ 
        id: k.id, 
        name: k.nama_kecamatan 
      }));
    }
    return [];
  };

  // Helper: Menambahkan kolom aksi
  const getActiveDataAndFields = () => {
    const actionButtons = (item, type) => (
      <td className="text-center">
        <div className="flex justify-center gap-2">
          <button className={styles.btnEdit} onClick={() => { setSelectedRowData(item); setIsEditModalOpen(true); }}>
            <FaEdit size={12} /> Edit
          </button>
          <button className={styles.btnDelete} onClick={() => setModal({ show: true, id: item.id, type })}>
            <FaTrash size={11} /> Hapus
          </button>
        </div>
      </td>
    );
    // Tab Wilayah Bali
    switch (activeTab) {
      case 'desa':
      default:
        return {
          rawList: dataDesa,
          searchField: 'nama_desa_adat',
          headers: ['No', 'Nama Desa Adat', 'Kecamatan', ''],
          renderRow: (item, idx) => (
            <tr key={item.id || idx}>
              <td className="text-center text-gray-400">{idx + 1}</td>
              <td className="text-gray-700 font-semibold">{item.nama_desa_adat}</td>
              <td className="text-gray-600 text-sm">{item.kecamatan?.nama_kecamatan || '-'}</td>
              {actionButtons(item.id, 'desa')}
            </tr>
          )
        };
      case 'kecamatan':
        return {
          rawList: dataKecamatan,
          searchField: 'nama_kecamatan',
          headers: ['No', 'Nama Kecamatan', 'Nama Kabupaten', ''],
          renderRow: (item, idx) => (
            <tr key={item.id || idx}>
              <td className="text-center text-gray-400">{idx + 1}</td>
              <td className="text-gray-700 font-semibold">{item.nama_kecamatan}</td>
              <td className="text-gray-600 text-sm">{item.kabupaten?.nama_kabupaten || '-'}</td>
              {actionButtons(item.id, 'kecamatan')}
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
              <td className="text-center text-gray-400">{idx + 1}</td>
              <td className="text-gray-700 font-semibold">{item.nama_kabupaten}</td>
              <td className="text-gray-600 text-sm">{item.provinsi?.nama_provinsi || '-'}</td>
              {actionButtons(item.id, 'kabupaten')}
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
              <td className="text-center text-gray-400">{idx + 1}</td>
              <td className="text-gray-700 font-semibold">{item.nama_provinsi}</td>
              {actionButtons(item.id, 'provinsi')}
            </tr>
          )
        };
    }
  };

  const currentTabConfig = getActiveDataAndFields();

  // Helper: Fungsi search filter wilayah
  const filteredData = currentTabConfig.rawList.filter(item => {
    const valueToSearch = item[currentTabConfig.searchField];
    return valueToSearch?.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // HANDLE PAGINATION
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = filteredData.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

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
      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null, type: '' })}
        onConfirm={handleDeleteWilayah}
        isProcessing={isDeleting}
        title={`Hapus Data ${modal.type === 'desa' ? 'Desa Adat' : modal.type?.toUpperCase()}?`}
        message={"Menghapus wilayah ini dapat memengaruhi relasi hierarki data krama atau wilayah adat di bawahnya"}
      />
      {/* Add Modal */}
      <AddWilayahModal 
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveNewWilayah}
        activeTab={activeTab}
        isProcessing={isSavingNew}
        listOptions={getParentOptionsList()}
      />
      {/* Edit Modal */}
      <EditWilayahModal 
        isOpen={isEditModalOpen} 
        onClose={() => { 
          setIsEditModalOpen(false); 
          setSelectedRowData(null); 
          }
        } 
        onUpdate={handleUpdateWilayah} 
        activeTab={activeTab} 
        isProcessing={isUpdating} 
        listOptions={getParentOptionsList()} 
        selectedItem={selectedRowData} 
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
      <div className={styles.contentArea}>
        {/* Tab Navigasi */}
        <div className={styles.tabContainer}>
          <button 
            onClick={() => setActiveTab('desa')} 
            className={`${styles.tabButton} ${activeTab === 'desa' ? styles.tabActive : ''}`}
          >
            <FaMapMarkedAlt size={14} /> <span>Desa Adat ({dataDesa.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('kecamatan')} 
            className={`${styles.tabButton} ${activeTab === 'kecamatan' ? styles.tabActive : ''}`}
          >
            <HiOutlineOfficeBuilding size={14} /> <span>Kecamatan ({dataKecamatan.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('kabupaten')} 
            className={`${styles.tabButton} ${activeTab === 'kabupaten' ? styles.tabActive : ''}`}
          >
            <FaCity size={14} /> <span>Kabupaten ({dataKabupaten.length})</span>
          </button>
          <button 
            onClick={() => setActiveTab('provinsi')} 
            className={`${styles.tabButton} ${activeTab === 'provinsi' ? styles.tabActive : ''}`}
          >
            <FaGlobeAsia size={14} /> <span>Provinsi ({dataProvinsi.length})</span>
          </button>
        </div>
        {/* Search dan Button */}
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
          <button className={styles.btnAddData} onClick={() => setIsAddModalOpen(true)}>
            <FaPlus size={12} /> <span>Tambah {activeTab === 'desa' ? 'Desa Adat' : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}</span>
          </button>
        </div>
        {/* List Wilayah Bali */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                {currentTabConfig.headers.map((head, i) => (
                  <th key={i} className={head === 'No' || head === '' ? "text-center w-28" : "text-left"}>
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={currentTabConfig.headers.length} className="text-center py-20">
                    <div className={styles.loadContainer}>
                      <div className={`${styles.loadSpinner} animate-spin`}></div>
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : currentItems.length === 0 ? (
                <tr>
                  <td colSpan={currentTabConfig.headers.length} className="text-center py-16 text-gray-500">
                    <div className={styles.infoDataContent}>
                      <FaInfoCircle className={styles.infoDataIcon} />
                      <p className="text-sm font-medium">
                        {searchTerm ? `Data wilayah "${searchTerm}" tidak ditemukan` : "Tidak ada data wilayah."}
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
          <p>Menampilkan {currentItems.length} dari {filteredData.length} data wilayah</p>
          <div className={styles.pageButtons}>
            {renderPageNumbers()}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default WilayahAdatBali;