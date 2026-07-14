import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaSave, 
  FaUpload, 
  FaCheckCircle, 
  FaChevronDown,
  FaMapMarkerAlt,
  FaHome,
  FaExclamationTriangle
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanDesaBaru.module.css';

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

const PengajuanDesaBaru = ({ user }) => {
  const navigate = useNavigate();
  const dropdownRef = useRef(null);
  const notifDropdownRef = useRef(null);

  const [daftarDesa, setDaftarDesa] = useState([]);
  const [daftarKecamatan, setDaftarKecamatan] = useState([]);
  const [daftarKabupaten, setDaftarKabupaten] = useState([]);
  const [daftarProvinsi, setDaftarProvinsi] = useState([]);

  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [formDataPengajuan, setFormDataPengajuan] = useState({
    desaAdatIdAsal: '',
    namaDesaAsal: 'Memuat data...',
    desaAdatIdTujuan: '',
    alasanPindah: '',
    fileDokumen: null,
    previewFileName: ''
  });

  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  useEffect(() => {
    const fetchSemuaData = async () => {
      setIsLoading(true);
      try {
        const [resDesa, resKec, resKab, resProv, resProfile] = await Promise.all([
          axiosInstance.get('/desa-adat'),
          axiosInstance.get('/kecamatan'),
          axiosInstance.get('/kabupaten'),
          axiosInstance.get('/provinsi'),
          axiosInstance.get('/users/profile')
        ]);

        // Setting master data wilayah
        const masterDesa = resDesa.data.data || [];
        setDaftarDesa(masterDesa);
        setDaftarKecamatan(resKec.data.data || []);
        setDaftarKabupaten(resKab.data.data || []);
        setDaftarProvinsi(resProv.data.data || []);

        // Setting data desa adat asal dari profile login
        const userProfile = resProfile.data.data;
        if (userProfile && userProfile.desa_adat_id) {
          const desaAsalObj = masterDesa.find(d => String(d.id) === String(userProfile.desa_adat_id));
          setFormDataPengajuan(prev => ({
            ...prev,
            desaAdatIdAsal: userProfile.desa_adat_id,
            namaDesaAsal: desaAsalObj ? desaAsalObj.nama_desa_adat : `${userProfile.desa_adat_id}`
          }));
        } else {
          setFormDataPengajuan(prev => ({ 
            ...prev, 
            namaDesaAsal: 'Tidak Terikat Desa Adat' 
          }));
        }
      } catch (error) {
        console.error(error);
        setAlert({
          show: true,
          type: 'error',
          message: error.response?.data?.message || "Terjadi kesalahan pada sistem. Periksa kembali koneksi Anda."
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchSemuaData();
  }, []);

  const filteredDesa = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return daftarDesa.filter(desa =>
      desa.nama_desa_adat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [daftarDesa, searchTerm]);

  // HELPER WILAYAH ADAT: Mengambil data lengkap hierarki wilayah adat
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

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
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

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setAlert({ 
          show: true, 
          type: 'error',
          message: 'Ukuran file terlalu besar! Maksimal ukuran file dokumen pendukung adalah 2MB.' 
        });
        e.target.value = null; 
        return;
      }

      const allowedExtensions = /(\.jpg|\.jpeg|\.png|\.pdf)$/i;
      
      if (!allowedExtensions.exec(file.name)) {
        setAlert({
          show: true,
          type: 'error',
          message: 'Format file tidak valid! Format file wajib .jpeg/.jpg/.png/.pdf'
        });
        e.target.value = null;
        return;
      }

      setFormDataPengajuan(prev => ({
        ...prev,
        fileDokumen: file,
        previewFileName: file.name
      }));
    }
  };

  const handleHapusFile = () => {
    setFormDataPengajuan(prev => ({
      ...prev,
      fileDokumen: null,
      previewFileName: ''
    }));
  };

  // HELPER VALIDASI:
  const validateForm = () => {
    if (!formDataPengajuan.desaAdatIdTujuan) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Silakan pilih desa adat tujuan yang ingin diajukan!' 
      });
      return false;
    }
    if (!formDataPengajuan.alasanPindah.trim() || !formDataPengajuan.fileDokumen) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Alasan permohonan dan dokumen pendukung wajib diisi!' 
      });
      window.scrollTo(0, 0);
      return false;
    }
    return true;
  };

  // SUBMIT DATA PERMOHONAN:
  const handleSubmit = async (e, isConfirmed = false) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }

    if (!validateForm()) return;

    if (!isConfirmed) {
      setShowSaveConfirmModal(true);
      return;
    }
    setShowSaveConfirmModal(false);

    const dataKirim = new FormData();
    dataKirim.append('desa_adat_id_tujuan', formDataPengajuan.desaAdatIdTujuan);
    dataKirim.append('alasan_pindah', formDataPengajuan.alasanPindah);
    dataKirim.append('dokumen_pendukung', formDataPengajuan.fileDokumen);
    
    try {
      setIsLoading(true);
      await axiosInstance.post('/permohonan-desa', dataKirim, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      navigate('/pengajuan-desa-adat/my-data', { 
        state: { successMessage: 'Permohonan mutasi desa adat berhasil dikirim! Menunggu verifikasi dari Admin Terkait.' } 
      });
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan sistem saat mengirim permohonan mutasi desa adat.' 
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
            Pengajuan Permohonan Mutasi Desa Adat
          </h2>
          <p className={styles.navSubtitle}>
            Lengkapi formulir pengajuan permohonan mutasi desa adat dengan data yang valid dan sah
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
        <div className={styles.cardContainer}>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Desa Adat Asal */}
              <div className="space-y-4">
                <div>
                  <label className={styles.labelInputSelect}>
                    Desa Adat Saat ini
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className={`${styles.inputPilihan}`}
                      value={formDataPengajuan.namaDesaAsal}
                      readOnly
                    />
                    <div className={styles.selectIcon}>
                      <FaHome className="text-gray-400" />
                    </div>
                  </div>
                </div>
                {/* Preview Wilayah Asal */}
                {formDataPengajuan.desaAdatIdAsal && (
                  <div className={`${styles.previewWilayahAdat}`}>
                    {(() => {
                      const w = getWilayahLengkap(formDataPengajuan.desaAdatIdAsal);
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
              {/* Desa Adat Tujuan */}
              <div ref={dropdownRef} className="space-y-4 animate-fade-in">
                <div>
                  <label className={styles.labelInputSelect}>
                    Desa Adat Tujuan <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className={styles.inputPilihan}
                      placeholder="Ketik nama desa adat tujuan..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setFormDataPengajuan(prev => ({ ...prev, desaAdatIdTujuan: '' }));
                        setIsDropdownOpen(true);
                      }}
                      onFocus={() => setIsDropdownOpen(true)}
                      disabled={isLoading}
                    />
                    <div className={styles.selectIcon}>
                      <FaMapMarkerAlt className={searchTerm ? "text-amber-700" : "text-gray-400"} />
                    </div>
                  </div>
                  {isDropdownOpen && searchTerm && (
                    <div className={styles.dropdownResult}>
                      {filteredDesa.length > 0 ? (
                        filteredDesa.map((desa) => (
                          <div
                            key={desa.id}
                            className={styles.dropdownItems}
                            onClick={() => {
                              setFormDataPengajuan(prev => ({ ...prev, desaAdatIdTujuan: desa.id }));
                              setSearchTerm(desa.nama_desa_adat);
                              setIsDropdownOpen(false);
                            }}>
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
                {/* Preview Wilayah Adat */}
                {formDataPengajuan.desaAdatIdTujuan && (
                  <div className={styles.previewWilayahAdat}>
                    {(() => {
                      const w = getWilayahLengkap(formDataPengajuan.desaAdatIdTujuan);
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
            </div>
            {/* Alasan Permohonan */}
            <div>
              <label className={styles.labelInputSelect}>
                Alasan Permohonan <span className="text-red-500">*</span>
              </label>
              <textarea 
                className={styles.inputText}
                placeholder="Jelaskan alasan pengajuan permohonan mutasi desa adat..."
                value={formDataPengajuan.alasanPindah}
                onChange={(e) => setFormDataPengajuan(prev => ({ ...prev, alasanPindah: e.target.value }))}
                disabled={isLoading}
              />
            </div>
            {/* Dokumen Pendukung */}
            <div>
              <label className={styles.labelInputSelect}>
                Dokumen Pendukung <span className="text-red-500">*</span>
              </label>
              <div className={styles.inputTextArea}>
                {formDataPengajuan.previewFileName ? (
                  <div className="flex flex-col items-center animate-fade-in">
                    <FaCheckCircle className={styles.iconChecklist} />
                    <p className={styles.namaFile}>
                      {formDataPengajuan.previewFileName}
                    </p>
                    <button type="button" onClick={handleHapusFile} className={styles.btnHapusFile}>
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
                      <p className="pl-1">atau drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, JPEG, PDF, Max 2MB
                    </p>
                  </>
                )}
              </div>
            </div>
            {/* Button Actions */}
            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => navigate('/pengajuan-desa-adat/my-data')} className={styles.btnBackRed} disabled={isLoading}>
                <FaArrowLeft /> Kembali
              </button>
              <button type="submit" className={styles.btnSubmit} disabled={isLoading}>
                {isLoading ? 'Sedang Mengirim...' : <><FaSave /> Kirim Permohonan</>}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Modal Konfirmasi Save */}
      {showSaveConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-in`}>
            <div className="p-6">
              <div className="flex justify-center mb-5">
                <div className={styles.elipsisConf}>
                  <FaExclamationTriangle className="text-amber-500 text-2xl" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Konfirmasi Permohonan Mutasi Desa Adat
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Apakah Anda yakin data permohonan mutasi desa adat ini sudah benar dan sesuai dengan data yang sebenarnya?
                </p>
              </div>
              <div className="mt-8 flex gap-3 justify-center">
                <button 
                  type="button" 
                  onClick={() => setShowSaveConfirmModal(false)} 
                  className={styles.btnCancel}
                  disabled={isLoading}>
                  Periksa Kembali
                </button>
                <button 
                  type="button" 
                  onClick={() => handleSubmit(null, true)} 
                  className={styles.btnSubmit}
                  disabled={isLoading}>
                  <FaSave size={14} className="mr-1" /> {isLoading ? 'Memproses...' : 'Ya, Lanjutkan'}
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

export default PengajuanDesaBaru;