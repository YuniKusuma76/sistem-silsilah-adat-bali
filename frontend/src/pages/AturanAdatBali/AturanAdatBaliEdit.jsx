import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaSave, 
  FaPlus, 
  FaTrash, 
  FaSlidersH, 
  FaGavel 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './AturanAdatBaliEdit.module.css';

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

const AturanAdatBaliEdit = ({ user }) => {
  const { id: slug } = useParams();
  const navigate = useNavigate();
  const notifDropdownRef = useRef(null);
  
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [formData, setFormData] = useState({
    nama_aturan: '',
    kategori: '', 
    status_peran_adat: '',
    garis_keturunan: '',
    dasar_keputusan: '',
    status_aturan: ''
  });

  // State Khusus JSONB kriteria_kondisi dinamis
  const [kriteriaRows, setKriteriaRows] = useState([]);

  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Helper: enkripsi slug url menjadi id asli
  const getActualId = () => {
    try {
      const parts = slug.split('-');
      const encodedId = parts[parts.length - 1];
      return atob(encodedId);
    } catch (error) {
      console.error(error);
      return slug; 
    }
  };

  const actualId = getActualId();

  useEffect(() => {
    const fetchExistingData = async () => {
      if (!actualId) return;
      try {
        setLoadingData(true);
        const response = await axiosInstance.get(`/aturan-adat/${actualId}`);
        const currentData = response.data?.data;

        if (currentData) {
          const dataSource = currentData.is_pending_update && currentData.data_perubahan
            ? currentData.data_perubahan 
            : currentData;
            
          setFormData({
            nama_aturan: dataSource.nama_aturan || '',
            kategori: dataSource.kategori || '',
            status_peran_adat: dataSource.status_peran_adat || '',
            garis_keturunan: dataSource.garis_keturunan || '',
            dasar_keputusan: dataSource.dasar_keputusan || '',
            status_aturan: dataSource.status_aturan || 'Aktif'
          });

          // Mengubah object JSONB kriteria_kondisi menjadi array bentuk [{ key, value }]
          if (dataSource.kriteria_kondisi && typeof dataSource.kriteria_kondisi === 'object') {
            const rows = Object.entries(dataSource.kriteria_kondisi).map(([key, value]) => ({
              key,
              value: String(value)
            }));
            setKriteriaRows(rows);
          }
        }
      } catch (error) {
        console.error(error);
        setAlert({
          show: true,
          type: 'error',
          message: 'Gagal mengambil data aturan adat bali lama untuk diperbarui.'
        });
      } finally {
        setLoadingData(false);
      }
    };
    fetchExistingData();
  }, [actualId]);

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

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev, [name]: value 
    }));
  };

  const handleKriteriaChange = (index, field, value) => {
    const updatedRows = [...kriteriaRows];
    updatedRows[index][field] = value;
    setKriteriaRows(updatedRows);
  };

  const addKriteriaRow = () => {
    setKriteriaRows(prev => [...prev, { 
      key: '', value: '' 
    }]);
  };

  const removeKriteriaRow = (index) => {
    if (kriteriaRows.length === 1) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Minimal harus ada 1 kriteria kondisi.' 
      });
      return;
    }
    setKriteriaRows(prev => prev.filter((_, i) => i !== index));
  };

  // SUBMIT DATA:
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validasi form
    if (!formData.nama_aturan.trim() || !formData.kategori || !formData.status_peran_adat || !formData.garis_keturunan || !formData.dasar_keputusan.trim()) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Mohon lengkapi semua kolom utama yang wajib diisi.' 
      });
      setIsSubmitting(false);
      return;
    }

    const kriteria_kondisi = {};

    for (const row of kriteriaRows) {
      const rowKey = String(row.key).trim();
      const rowValue = String(row.value).trim();

      if (!rowKey || !rowValue) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Nama parameter atau nilai kriteria JSONB tidak boleh kosong.' 
        });
        setIsSubmitting(false);
        return;
      }
      
      let finalValue = rowValue;
      if (rowValue.toLowerCase() === 'true') finalValue = true;
      if (rowValue.toLowerCase() === 'false') finalValue = false;

      if (!isNaN(rowValue) && rowValue !== '') {
        finalValue = Number(rowValue);
      }

      kriteria_kondisi[rowKey] = finalValue;
    }

    const payload = {
      ...formData,
      kriteria_kondisi
    };

    try {
      const response = await axiosInstance.put(`/aturan-adat/${actualId}`, payload);
      const successMessage = response.data?.message || 'Perubahan data Aturan Adat Bali berhasil disimpan!';
      navigate(`/aturan-adat-bali/detail/${slug}`, { 
        state: { successMessage } 
      });
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat menyimpan perubahan aturan adat bali.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MEMUAT DATA...</p>
      </div>
    );
  }

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Memperbarui Aturan Adat Bali
          </h2>
          <p className={styles.navSubtitle}>
            Perbarui data aturan Adat Bali dengan data yang valid dan sah
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
      <form onSubmit={handleSubmit} className={styles.contentArea}>
        <div className={styles.formGrid}>
          <div className={styles.leftColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FaGavel className={styles.iconHeader} />
                <h3>Formulir Informasi Utama Aturan</h3>
              </div>
              <div className={styles.cardBody}>
                {/* Nama Aturan */}
                <div className={styles.inputGroup}>
                  <label htmlFor="nama_aturan">
                    Nama Aturan Adat <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    id="nama_aturan"
                    name="nama_aturan"
                    placeholder="Contoh: Perkawinan Pade Gelahang - Posisi Istri"
                    value={formData.nama_aturan}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                {/* Kategori dan Status Peran Adat */}
                <div className={styles.gridTwoCols}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="kategori">
                      Kategori Aturan <span className="text-red-500">*</span>
                    </label>
                    <select id="kategori" name="kategori" value={formData.kategori} onChange={handleInputChange} required>
                      <option value="">- Pilih -</option>
                      <option value="LAHIR">LAHIR</option>
                      <option value="KAWIN">KAWIN</option>
                      <option value="CERAI">CERAI</option>
                      <option value="PENGANGKATAN">PENGANGKATAN</option>
                    </select>
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="status_peran_adat">
                      Status Peran Adat <span className="text-red-500">*</span>
                    </label>
                    <select id="status_peran_adat" name="status_peran_adat" value={formData.status_peran_adat} onChange={handleInputChange} required>
                      <option value="">- Pilih -</option>
                      <option value="Tidak Memiliki Status Peran Adat">Tidak Memiliki Status Peran Adat</option>
                      <option value="Purusa">Purusa</option>
                      <option value="Predana">Predana</option>
                    </select>
                  </div>
                </div>
                {/* Garis Keturunan dan Status */}
                <div className={styles.gridTwoCols}>
                  <div className={styles.inputGroup}>
                    <label htmlFor="garis_keturunan">
                      Garis Keturunan <span className="text-red-500">*</span>
                    </label>
                    <select id="garis_keturunan" name="garis_keturunan" value={formData.garis_keturunan} onChange={handleInputChange} required>
                      <option value="">- Pilih -</option>
                      <option value="Tidak Memiliki Garis Keturunan">Tidak Memiliki Garis Keturunan</option>
                      <option value="Purusa">Purusa</option>
                      <option value="Purusa Nyentana">Purusa Nyentana</option>
                      <option value="Purusa Pade Gelahang">Purusa Pade Gelahang</option>
                    </select>
                  </div>
                  <div className={styles.inputGroup}>
                    <label htmlFor="status_aturan">
                      Status Pemberlakuan Aturan <span className="text-red-500">*</span>
                    </label>
                    <select id="status_aturan" name="status_aturan" value={formData.status_aturan} onChange={handleInputChange} disabled={true}>
                      <option value="Aktif">Aktif</option>
                      <option value="Non-Aktif">Non-Aktif</option>
                    </select>
                  </div>
                </div>
                {/* Dasar Keputusan */}
                <div className={styles.inputGroup}>
                  <label htmlFor="dasar_keputusan">
                    Dasar Keputusan / Penjelasan Hukum Adat <span className="text-red-500">*</span>
                  </label>
                  <textarea 
                    id="dasar_keputusan"
                    name="dasar_keputusan"
                    rows="5"
                    placeholder="Tuliskan alasan dan landasan hukum adat bali mengapa keputusan status peran tersebut dipilih..."
                    value={formData.dasar_keputusan}
                    onChange={handleInputChange}
                    required
                  />
                </div>
              </div>
            </div>
          </div>
          <div className={styles.rightColumn}>
            <div className={styles.card}>
              <div className={styles.cardHeaderDynamic}>
                <div className="flex items-center gap-3">
                  <FaSlidersH className={styles.iconHeader} />
                  <h3>Kriteria Kondisi</h3>
                </div>
                <button type="button" onClick={addKriteriaRow} className={styles.btnAddRow}>
                  <FaPlus size={10} /> Tambah Parameter
                </button>
              </div>
              <div className={styles.cardBody}>
                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                  Tentukan kriteria kondisi aturan di bawah ini. Sistem akan membaca key-value ini untuk mencocokkan keputusan secara otomatis.
                </p>
                <div className={styles.kriteriaList}>
                  {kriteriaRows.map((row, index) => (
                    <div key={index} className={styles.kriteriaRowItem}>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="Nama Key"
                          value={row.key}
                          onChange={(e) => handleKriteriaChange(index, 'key', e.target.value)}
                          className="font-mono text-xs"
                          required
                        />
                      </div>
                      <div className="flex-1">
                        <input 
                          type="text" 
                          placeholder="Nilai Value"
                          value={row.value}
                          onChange={(e) => handleKriteriaChange(index, 'value', e.target.value)}
                          className="text-xs"
                          required
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => removeKriteriaRow(index)}
                        className={styles.btnDeleteRow}
                        title="Hapus Parameter">
                        <FaTrash size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className={styles.buttonGroup}>
          <button type="button" onClick={() => navigate(`/aturan-adat-bali/detail/${slug}`)} className={styles.btnCancel}>
            <FaArrowLeft /> Batal
          </button>
          <button type="submit" disabled={isSubmitting} className={styles.btnSave}>
            <FaSave size={14} /> {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
      <Footer />
    </div>
  );
};

export default AturanAdatBaliEdit;