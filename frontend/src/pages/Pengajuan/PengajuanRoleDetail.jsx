import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaFilePdf, 
  FaCheckCircle, 
  FaClock, 
  FaTimesCircle, 
  FaDownload, 
  FaUserCheck,
  FaBan, 
  FaFileAlt, 
  FaEye, 
  FaCalendarAlt, 
  FaMapMarkerAlt,
  FaTrash,
  FaExclamationTriangle,
  FaSpinner,
  FaTimes
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanRoleDetail.module.css';

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
            <h3 className="text-lg font-bold text-black mb-2">{title}</h3>
            <p className="text-sm text-gray-600">{message}</p>
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

const PengajuanRoleDetail = ({ user }) => {
  const { id: slug } = useParams();
  const navigate = useNavigate();
  const notifDropdownRef = useRef(null);

  const isSuperAdmin = user?.role === 'Super Admin';

  const [data, setData] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [alamatLengkapDesa, setAlamatLengkapDesa] = useState('-');

  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyAction, setVerifyAction] = useState('');
  const [catatanValidator, setCatatanValidator] = useState('');

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  // Helper: enkripsi slug url menjadi id asli
  const actualId = useMemo(() => {
    try {
      const parts = slug.split('-');
      const encodedId = parts[parts.length - 1];
      return atob(encodedId);
    } catch (error) {
      console.error("Format slug tidak valid:", error);
      return slug; 
    }
  }, [slug]);
  
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const [resDesa, resKec, resKab, resProv] = await Promise.all([
          axiosInstance.get('/desa-adat'),
          axiosInstance.get('/kecamatan'),
          axiosInstance.get('/kabupaten'),
          axiosInstance.get('/provinsi')
        ]);
        
        setDesaList(resDesa.data.data || []);
        setKecamatanList(resKec.data.data || []);
        setKabupatenList(resKab.data.data || []);
        setProvinsiList(resProv.data.data || []);

        if (actualId) {
          const response = await axiosInstance.get(`/permohonan-role/${actualId}`);
          const permohonanData = response.data?.data || response.data;
          setData(permohonanData);
        }
      } catch (error) {
        setAlert({
          show: true,
          type: 'error',
          message: error.response?.data?.message || "Terjadi kesalahan pada sistem. Periksa kembali koneksi Anda."
        });
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
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

  // HELPER WILAYAH ADAT: Mengambil data lengkap hierarki wilayah adat
  const getWilayahLengkap = (desaId) => {
    if (!desaId) return null; 
    const desa = desaList.find(d => String(d.id) === String(desaId));
    if (!desa) return null;

    const kec = desa.kecamatan_id 
      ? kecamatanList.find(k => String(k.id) === String(desa.kecamatan_id)) 
      : null;
    const kab = kec?.kabupaten_id 
      ? kabupatenList.find(k => String(k.id) === String(kec.kabupaten_id)) 
      : null;
    const prov = kab?.provinsi_id 
      ? provinsiList.find(p => String(p.id) === String(kab.provinsi_id)) 
      : null;

    return {
      desa: desa.nama_desa_adat || "-",
      kecamatan: kec?.nama_kecamatan || "-",
      kabupaten: kab?.nama_kabupaten || "-",
      provinsi: prov?.nama_provinsi || "BALI"
    };
  };

  // Helper: Menyusun alamat lengkap dari object
  useEffect(() => {
    if (data && desaList.length > 0) {
      const targetDesaId = data.desa_adat_id_tujuan?.id || data.desa_adat_id_tujuan;
      
      if (targetDesaId) {
        const wilayah = getWilayahLengkap(targetDesaId);
        if (wilayah) {
          setAlamatLengkapDesa(`Desa Adat ${wilayah.desa}, Kec. ${wilayah.kecamatan}, Kab. ${wilayah.kabupaten}, Prov. ${wilayah.provinsi}`);
        } else if (typeof data.desa_adat_id_tujuan === 'object') {
          const dObj = data.desa_adat_id_tujuan;
          const namaDesa = `Desa Adat ${dObj.nama_desa_adat || '-'}`;
          const namaKec = dObj.kecamatan ? `, Kec. ${dObj.kecamatan.nama_kecamatan}` : '';
          const namaKab = dObj.kecamatan?.kabupaten ? `, Kab. ${dObj.kecamatan.kabupaten.nama_kabupaten}` : '';
          const namaProv = dObj.kecamatan?.kabupaten?.provinsi ? `, Prov. ${dObj.kecamatan.kabupaten.provinsi.nama_provinsi}` : '';
          setAlamatLengkapDesa(`${namaDesa}${namaKec}${namaKab}${namaProv}`);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, desaList, kecamatanList, kabupatenList, provinsiList]);

  const refreshDetailData = async () => {
    try {
      const response = await axiosInstance.get(`/permohonan-role/${actualId}`);
      const permohonanData = response.data?.data || response.data;
      setData(permohonanData);
    } catch (error) {
      console.error("Terjadi kesalahan pada sistem saat refresh data:", error);
    }
  };

  const handleConfirmBatalkan = async () => {
    if (!modal.id) return;
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-role/cancel/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Permohonan perubahan role berhasil dibatalkan.' 
      });
      setModal({ 
        show: false, 
        id: null 
      });
      refreshDetailData(); 
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal membatalkan permohonan perubahan role." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerification = async () => {
    if (verifyAction === 'Ditolak' && !catatanValidator.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: 'Wajib mengisi catatan/alasan ketika permohonan perubahan role ditolak!'
      });
      return; 
    }
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/permohonan-role/verifikasi/${actualId}`, {
        status_permohonan: verifyAction === 'Disetujui' ? 'Disetujui' : 'Ditolak',
        catatan_super_admin: catatanValidator
      });

      setAlert({ 
        show: true, 
        type: 'success', 
        message: `Permohonan perubahan role berhasil di${verifyAction === 'Disetujui' ? 'setujui' : 'tolak'}.` 
      });
      setShowVerifyModal(false);
      setCatatanValidator('');
      refreshDetailData();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal memverifikasi permohonan perubahan role." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: Menampilkan preview dokumen pendukung
  useEffect(() => {
    let isMounted = true;
    let localUrl = null;

    if (data?.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i)) {
      const fetchImage = async () => {
        try {
          const response = await axiosInstance.get(`/permohonan-role/document/${actualId}`, {
            responseType: 'blob' 
          });
          if (isMounted) {
            localUrl = URL.createObjectURL(response.data);
            setImagePreviewUrl(localUrl);
          }
        } catch (error) { 
          console.error("Terjadi kesalahan pada sistem saat memuat preview dokumen:", error); 
        }
      };
      fetchImage();
    }
    return () => {
      isMounted = false;
      if (localUrl) {
        URL.revokeObjectURL(localUrl);
      }
    };
  }, [data?.dokumen_pendukung, actualId]);

  // Helper: Mengunduh atau melihat dokumen pendukung
  const downloadOrViewFile = async (mode) => {
    if (!data?.dokumen_pendukung) return;
    setIsDownloading(true);
    try {
      const response = await axiosInstance.get(`/permohonan-role/document/${actualId}`, {
        responseType: 'blob' 
      });

      const file = new Blob([response.data], { 
        type: response.headers['content-type'] 
      });
      const fileURL = URL.createObjectURL(file);

      if (mode === 'view') {
        window.open(fileURL, '_blank');
        setTimeout(() => URL.revokeObjectURL(fileURL), 1000);
      } else {
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', data.dokumen_pendukung);
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(fileURL);
      }
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memproses file dokumen pendukung." 
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'Disetujui': 
        return { 
          className: styles.badgeSuccess, 
          icon: <FaCheckCircle /> 
        };
      case 'Ditolak': 
        return { 
          className: styles.badgeDanger, 
          icon: <FaTimesCircle /> 
        };
      case 'Dibatalkan': 
        return { 
          className: styles.badgeGray, 
          icon: <FaBan /> 
        };
      case 'Menunggu':
        return { 
          className: styles.badgeWarning, 
          icon: <FaClock /> 
        };
      default:
        return { 
          className: styles.badgeAmber, 
          icon: <FaClock /> 
        };
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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MEMUAT DATA...</p>
      </div>
    );
  }

  if (!data) return null;

  const statusStyle = getStatusBadge(data.status_permohonan);
  const isImage = data.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i);

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Permohonan Perubahan Role
          </h2>
          <p className={styles.navSubtitle}>
            Rincian data permohonan perubahan role yang diajukan
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
                              if (notif.tautan_fitur) window.location.href = notif.tautan_fitur;
                            }}
                            className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}
                          >
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
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleConfirmBatalkan}
        isProcessing={isSubmitting}
        title="Batalkan Permohonan?"
        message="Permohonan perubahan role yang dibatalkan bersifat permanen dan tidak akan diproses oleh Admin Validator."
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
      <div className={`${styles.contentArea} mb-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className={styles.cardContainer}>
              <div className={styles.roleStatus}>
                <div>
                  <p className={`${styles.labelColumn} tracking-widest`}>
                    Permohonan Role
                  </p>
                  <h3 className={styles.roleContent}>
                    <FaUserCheck size={25} className="text-amber-700 mr-2 flex-shrink-0" /> 
                    <span className="text-stone-800 font-bold">
                      {data.role_yang_diminta}
                    </span>
                  </h3>
                </div>
                <div className={`${styles.badge} ${statusStyle.className} w-fit`}>
                  {statusStyle.icon} 
                  <span className="whitespace-nowrap">
                    {data.status_permohonan}
                  </span>
                </div>
              </div>
              <div className={styles.desaWaktu}>
                <div>
                  <p className={styles.labelColumn}>
                    Desa Adat Tujuan
                  </p>
                  <p className={styles.contentColumn}>
                    <FaMapMarkerAlt size={22} className="text-amber-700 mr-2 flex-shrink-0" /> 
                    <span className="text-stone-700 font-semibold">
                      {alamatLengkapDesa}
                    </span>
                  </p>
                </div>
                <div>
                  <p className={styles.labelColumn}>
                    Waktu Pengajuan
                  </p>
                  <p className={styles.contentColumn}>
                    <FaCalendarAlt className="text-amber-700 mr-1" /> 
                    <span>
                      {`${new Date(data.tanggal_pengajuan).toLocaleDateString('id-ID', { 
                        dateStyle: 'full' 
                      })} • ${new Date(data.tanggal_pengajuan).toLocaleTimeString('id-ID', { 
                        hour: '2-digit', minute: '2-digit' 
                      }).replace('.', ':')} WITA`}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {/* Alasan Perubahan Role */}
            <div className={`${styles.cardContainer} space-y-8`}>
              <div>
                <h4 className={styles.labelReason}>
                  <FaFileAlt className="text-amber-700 mr-2" /> Alasan Permohonan
                </h4>
                <div className={styles.reason}>
                  {data.alasan_permohonan}
                </div>
              </div>
              {/* Catatan verifikasi Validator */}
              {(data.catatan_super_admin || data.status_permohonan !== 'Menunggu') && (
                <div className={`${styles.noteArea} ${
                  data.status_permohonan === 'Ditolak' ? 'bg-red-50 border-red-500' : 
                  data.status_permohonan === 'Dibatalkan' ? 'bg-gray-50 border-gray-400' : 'bg-green-50 border-green-500'}`
                }>
                  <h4 className={styles.labelNote}>
                    {data.status_permohonan === 'Dibatalkan' ? 'Keterangan Pembatalan' : 'Catatan Validator'}
                  </h4>
                  <p className="text-xs italic text-gray-600">
                    {data.catatan_super_admin}
                  </p>
                  {data.tanggal_verifikasi && (
                    <div className={styles.noteTanggal}>
                      <FaClock className="mb-0.5" /> Ditinjau pada: {
                        new Date(data.tanggal_verifikasi).toLocaleString('id-ID')
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-6">
            <div className={styles.cardDokumen}>
              <h4 className={styles.labelCardDokumen}>
                Dokumen Pendukung
              </h4>
              {!data.dokumen_pendukung ? (
                <div className={styles.unknowContent}>
                  <FaBan className={styles.unknowIcon} />
                  <p className={styles.unknow}>
                    Tidak ada dokumen
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className={styles.areaFile}>
                    {isImage && imagePreviewUrl ? (
                      <img src={imagePreviewUrl} alt="Preview Berkas" className="w-full h-full object-cover rounded-lg" />
                    ) : (
                      <div className={styles.file}>
                        <FaFilePdf size={48} className="text-rose-600 mb-2" />
                        <p className={styles.labelFile}>
                          {data.dokumen_pendukung.split('.').pop().toUpperCase()} Document
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => downloadOrViewFile('view')} disabled={isDownloading} className={styles.btnLihatFile}>
                      {isDownloading ? <FaSpinner className="animate-spin" /> : <FaEye />} <span>Buka</span>
                    </button>
                    <button onClick={() => downloadOrViewFile('download')} disabled={isDownloading} className={styles.btnUnduhFile}>
                      <FaDownload /> <span>Unduh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div className="pt-2 flex flex-col gap-2">
              {isSuperAdmin && data.status_permohonan === 'Menunggu' && (
                <button 
                  onClick={() => {
                    setVerifyAction('Disetujui');
                    setShowVerifyModal(true);
                  }} 
                  className={styles.btnApproveGold}>
                  <FaUserCheck /> Verifikasi Permohonan
                </button>
              )}
              {!isSuperAdmin && data.status_permohonan === 'Menunggu' && (
                <button onClick={() => setModal({ show: true, id: actualId })} className={styles.btnHapusRed}>
                  <FaTrash /> Batalkan Permohonan
                </button>
              )}
              <button 
                onClick={() => navigate(isSuperAdmin ? '/verifikasi-data/pengajuan-role' : '/pengajuan-role/my-data')} 
                className={styles.btnBackNetral}>
                <FaArrowLeft /> Kembali
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {/* MODAL VERIFIKASI */}
      {showVerifyModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3>
                <FaUserCheck size={21} className="text-amber-700 mr-2" /> Verifikasi Permohonan Perubahan Role
              </h3>
              <button onClick={() => setShowVerifyModal(false)}>
                <FaTimes className={styles.iconClose} />
              </button>
            </div>
            <div>
              <div className="flex gap-2 my-4">
                <button 
                  type="button"
                  onClick={() => setVerifyAction('Disetujui')}
                  className={`${styles.choise} ${
                    verifyAction === 'Disetujui' ? styles.choiseApproved : styles.choiseDefault
                  }`}>
                  ✅ Setujui Permohonan
                </button>
                <button 
                  type="button"
                  onClick={() => setVerifyAction('Ditolak')}
                  className={`${styles.choise} ${
                    verifyAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                  }`}>
                  ❌ Tolak Permohonan
                </button>
              </div>
              <div className="space-y-1 text-left">
                <label className={styles.label}>
                  Catatan Tambahan / Alasan Penolakan {verifyAction === "Ditolak" && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  className={styles.inputForm}
                  rows="5"
                  placeholder="Masukkan catatan keputusan untuk pemohon..."
                  value={catatanValidator}
                  onChange={(e) => setCatatanValidator(e.target.value)}
                  required={verifyAction === 'Ditolak'}
                />
              </div>
              <div className="mt-6 flex gap-2 justify-end pt-3">
                <button 
                  onClick={() => {
                    setShowVerifyModal(false);
                    setCatatanValidator('');
                  }} 
                  disabled={isSubmitting} 
                  className={styles.btnCancel}>
                  Batal
                </button>
                <button 
                  onClick={handleVerification} 
                  disabled={isSubmitting}
                  className={verifyAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}>
                  {isSubmitting ? 'Memproses...' : 'Konfirmasi Keputusan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PengajuanRoleDetail;