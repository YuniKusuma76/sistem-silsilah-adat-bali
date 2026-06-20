import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaSave, 
  FaUpload, 
  FaCheckCircle, 
  FaChevronDown,
  FaMapMarkerAlt
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanRoleBaru.module.css';

const PengajuanRoleBaru = () => {
  const [roleYangDiminta, setRoleYangDiminta] = useState('');
  const [alasanPermohonan, setAlasanPermohonan] = useState('');
  const [fileDokumen, setFileDokumen] = useState(null);
  const [previewFileName, setPreviewFileName] = useState('');
  const [desaAdatIdTujuan, setDesaAdatIdTujuan] = useState('');

  const [daftarDesa, setDaftarDesa] = useState([]);
  const [daftarKecamatan, setDaftarKecamatan] = useState([]);
  const [daftarKabupaten, setDaftarKabupaten] = useState([]);
  const [daftarProvinsi, setDaftarProvinsi] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const dropdownRef = useRef(null);

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });
  
  // Effect: Mengambil data wilayah adat
  useEffect(() => {
    const fetchSemuaWilayah = async () => {
      try {
        const [resDesa, resKec, resKab, resProv] = await Promise.all([
          axiosInstance.get('/desa-adat'),
          axiosInstance.get('/kecamatan'),
          axiosInstance.get('/kabupaten'),
          axiosInstance.get('/provinsi')
        ]);

        setDaftarDesa(resDesa.data.data || []);
        setDaftarKecamatan(resKec.data.data || []);
        setDaftarKabupaten(resKab.data.data || []);
        setDaftarProvinsi(resProv.data.data || []);
      } catch (error) {
        console.error("Gagal memuat data wilayah adat", error);
      }
    };
    fetchSemuaWilayah();
  }, []);

  // Helper: Fungsi filter desa adat berdasarkan search
  const filteredDesa = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return daftarDesa.filter(desa =>
      desa.nama_desa_adat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [daftarDesa, searchTerm]);

  // Helper: Fungsi mengambil detail wilayah berdasarkan desa adat id
  const getWilayahLengkap = (desaId) => {
    const desa = daftarDesa.find(d => String(d.id) === String(desaId));
    if (!desa) return null;

    const kec = daftarKecamatan.find(k => String(k.id) === String(desa.kecamatan_id));
    const kab = daftarKabupaten.find(kb => String(kb.id) === String(kec?.kabupaten_id));
    const prov = daftarProvinsi.find(p => String(p.id) === String(kab?.provinsi_id));

    return {
      kecamatan: kec ? kec.nama_kecamatan : '-',
      kabupaten: kab ? kab.nama_kabupaten : '-',
      provinsi: prov ? prov.nama_provinsi : '-'
    };
  };

  // Effect: Menutup dropdown ketika klik di luar area input
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Effect: Auto-close alert
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: Fungsi upload file dokumen pendukung
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setAlert({ 
          show: true, 
          type: 'error',
          message: 'Ukuran file maksimal 5MB!' 
        });
        return;
      }
      setFileDokumen(file);
      setPreviewFileName(file.name);
    }
  };

  // SUBMIT DATA PERMOHONAN
  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validasi input role
    if (!roleYangDiminta) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Silakan pilih role yang ingin diajukan!' 
      });
      return;
    }
    // Validasi input desa adat khusus role admin desa
    if (roleYangDiminta === 'Admin Desa' && !desaAdatIdTujuan) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Role Admin Desa wajib memilih Desa Adat Tujuan!' 
      });
      window.scrollTo(0, 0);
      return;
    }
    // Validasi input alasan permohonan dan dokumen pendukung
    if (!alasanPermohonan.trim() || !fileDokumen) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Alasan permohonan dan dokumen pendukung wajib diisi!' 
      });
      window.scrollTo(0, 0);
      return;
    }

    const formData = new FormData();
    formData.append('role_yang_diminta', roleYangDiminta);
    formData.append('desa_adat_id_tujuan', roleYangDiminta === 'Admin Desa' ? desaAdatIdTujuan : '');
    formData.append('alasan_permohonan', alasanPermohonan);
    formData.append('dokumen_pendukung', fileDokumen);
    setIsLoading(true);

    try {
      await axiosInstance.post('/permohonan-role', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/pengajuan-role/my-data', { 
        state: { 
          successMessage: 'Permohonan perubahan role berhasil dikirim! Menunggu verifikasi dari admin...' 
        } 
      });
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal mengajukan permohonan perubahan role.' 
      });
      window.scrollTo(0, 0);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
        <nav className={styles.navbar}>
          <div className={styles.navLeft}>
            <h2 className={styles.navTitle}>
              Pengajuan Permohonan Perubahan Role
            </h2>
            <p className={styles.navSubtitle}>
              Lengkapi formulir pengajuan permohonan perubahan role dengan data yang valid dan sah
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
      {/* Form Permohonan Role */}
      <div className={styles.contentArea}>
        <div className={styles.cardContainer}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Permohonan Role */}
            <div>
              <label className={styles.labelInputSelect}>
                Permohonan Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  className={styles.inputPilihan}
                  value={roleYangDiminta}
                  onChange={(e) => {
                    setRoleYangDiminta(e.target.value);
                    setDesaAdatIdTujuan('');
                    setSearchTerm('');
                  }}
                  disabled={isLoading}
                >
                  <option value="">-- Pilih Role --</option>
                  <option value="Admin Desa">Admin Desa Adat</option>
                  <option value="Pakar">Pakar Aturan Adat</option>
                </select>
                <div className={styles.selectIcon}>
                  <FaChevronDown />
                </div>
              </div>
              <p className={styles.note }>
                * Pilih peran yang sesuai dengan kapasitas Anda dalam sistem.
              </p>
            </div>
            {/* Desa Adat Tujuan */}
            {roleYangDiminta === 'Admin Desa' && (
              <div ref={dropdownRef} className="space-y-4 animate-fade-in">
                <div>
                  <label className={styles.labelInputSelect}>
                    Desa Adat Tujuan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className={styles.inputPilihan}
                      placeholder="Ketikkan nama desa adat..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setDesaAdatIdTujuan('');
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      disabled={isLoading}
                    />
                    <div className={styles.selectIcon}>
                      <FaMapMarkerAlt className={searchTerm ? "text-amber-700" : "text-gray-400"} />
                    </div>
                  </div>
                  {/* Dropdown Hasil Pencarian */}
                  {isDropdownOpen && searchTerm && (
                    <div className={styles.dropdownResult}>
                      {filteredDesa.length > 0 ? (
                        filteredDesa.map((desa) => (
                          <div
                            key={desa.id}
                            className={styles.dropdownItems}
                            onClick={() => {
                              setDesaAdatIdTujuan(desa.id);
                              setSearchTerm(desa.nama_desa_adat);
                              setIsDropdownOpen(false);
                            }}
                          >
                            <p className="text-sm font-bold text-gray-800">
                              {desa.nama_desa_adat}
                            </p>
                            <p className="text-[10px] text-gray-500 uppercase">
                              {getWilayahLengkap(desa.id)?.kecamatan} • {getWilayahLengkap(desa.id)?.kabupaten}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-3 text-sm text-gray-500 italic">
                          Desa {searchTerm} tidak ditemukan
                        </div>
                      )}
                    </div>
                  )}
                </div>
                {/* Preview Wilayah Adat Otomatis */}
                {desaAdatIdTujuan && (
                  <div className={styles.previewWilayahAdat}>
                    {(() => {
                      const w = getWilayahLengkap(desaAdatIdTujuan);
                      if (!w) return null;
                      return (
                        <>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">
                              Kecamatan
                            </span>
                            <span className="text-sm font-semibold">
                              {w.kecamatan}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">
                              Kabupaten
                            </span>
                            <span className="text-sm font-semibold">
                              {w.kabupaten}
                            </span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[10px] uppercase text-gray-400">
                              Provinsi
                            </span>
                          <span className="text-sm font-semibold">
                            {w.provinsi}
                          </span>
                        </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>
          {/* Alasan Permohonan */}
          <div>
            <label className={styles.labelInputSelect}>
              Alasan Permohonan <span className="text-red-500">*</span>
            </label>
            <textarea 
              className={styles.inputText}
              placeholder="Jelaskan alasan pengajuan permohonan perubahan role..."
              value={alasanPermohonan}
              onChange={(e) => setAlasanPermohonan(e.target.value)}
              disabled={isLoading}
            />
          </div>
          {/* Dokumen Pendukung */}
          <div>
            <label className={styles.labelInputSelect}>
              Dokumen Pendukung <span className="text-red-500">*</span>
            </label>
            <div className={styles.inputTextArea}>
              {previewFileName ? (
                <div className="flex flex-col items-center animate-fade-in">
                  <FaCheckCircle className={styles.iconChecklist} />
                  <p className={styles.namaFile}>
                    {previewFileName}
                  </p>
                  <button 
                    type="button" 
                    onClick={() => {setFileDokumen(null); setPreviewFileName('');}}
                    className={styles.btnHapusFile}>
                    Hapus File
                  </button>
                </div>
              ) : (
                <>
                  <FaUpload className={styles.iconUpload} />
                  <div className={styles.areaUpload}>
                    <label htmlFor="file-upload" className={styles.upload}>
                      <span>Upload file</span>
                      <input 
                        id="file-upload" 
                        name="file-upload" 
                        type="file" 
                        className="hidden" 
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={handleFileChange}
                        disabled={isLoading}
                      />
                    </label>
                    <p className="pl-1">
                      atau drag and drop
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">
                    PNG, JPG, JPEG, PDF, Max 5MB
                  </p>
                </>
              )}
            </div>
          </div>
          {/* Button Actions */}
          <div className={styles.buttonGroup}>
            <button type="button" onClick={() => navigate('/pengajuan-role/my-data')} className={styles.btnBackRed} disabled={isLoading}>
              <FaArrowLeft /> Kembali
            </button>
            <button type="submit" className={styles.btnSubmit} disabled={isLoading}>
              {isLoading ? 'Sedang Mengirim...' : <><FaSave /> Kirim Permohonan</>}
            </button>
          </div>
        </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PengajuanRoleBaru;