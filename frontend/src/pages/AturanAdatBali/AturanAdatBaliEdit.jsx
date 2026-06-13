import React, { useState, useEffect } from 'react';
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

const AturanAdatBaliEdit = () => {
  const { id: slug } = useParams();
  const navigate = useNavigate();
  
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Helper: Decode slug id ke id asli
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

  // Effect: Fungsi mengambil data aturan adat bali
  useEffect(() => {
    const fetchExistingData = async () => {
      if (!actualId) return;
      try {
        setLoadingData(true);
        const response = await axiosInstance.get(`/aturan-adat/${actualId}`);
        const currentData = response.data?.data;

        if (currentData) {
          setFormData({
            nama_aturan: currentData.nama_aturan || '',
            kategori: currentData.kategori || '',
            status_peran_adat: currentData.status_peran_adat || '',
            garis_keturunan: currentData.garis_keturunan || '',
            dasar_keputusan: currentData.dasar_keputusan || '',
            status_aturan: currentData.status_aturan || 'Aktif'
          });

          // Mengubah object JSONB kriteria_kondisi menjadi array bentuk [{ key, value }]
          if (currentData.kriteria_kondisi && typeof currentData.kriteria_kondisi === 'object') {
            const rows = Object.entries(currentData.kriteria_kondisi).map(([key, value]) => ({
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
          message: 'Gagal mengambil data aturan adat lama untuk diubah.'
        });
      } finally {
        setLoadingData(false);
      }
    };
    fetchExistingData();
  }, [actualId]);

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
  
  // Helper: Menangani perubahan input form
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev, [name]: value 
    }));
  };

  // Helper: Menangani perubahan input kriteria kondisi
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

  // SUBMIT DATA
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Validasi form
    if (
      !formData.nama_aturan.trim() || 
      !formData.kategori || 
      !formData.status_peran_adat || 
      !formData.garis_keturunan || 
      !formData.dasar_keputusan.trim()
    ) {
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
      await axiosInstance.put(`/aturan-adat/${actualId}`, payload);
      navigate('/aturan-adat-bali', { 
        state: { 
          successMessage: 'Perubahan data Aturan Adat Bali berhasil disimpan!' 
        } 
      });
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menyimpan perubahan aturan adat bali.'
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
            Mengubah Aturan Adat Baru
          </h2>
          <p className={styles.navSubtitle}>
            Perbarui data data aturan Adat Bali dengan data yang sah
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
      {/* Form Content Area */}
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
                    <select id="status_aturan" name="status_aturan" value={formData.status_aturan} onChange={handleInputChange} required>
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
                  ></textarea>
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
                        title="Hapus Parameter"
                      >
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