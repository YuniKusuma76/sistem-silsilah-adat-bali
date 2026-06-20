import React, { useState, useEffect, useMemo } from 'react';
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
  FaTimes,
  FaHome
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './PengajuanDesaDetail.module.css';

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

const PengajuanDesaDetail = ({ user }) => {
  const { id: slug } = useParams();
  const navigate = useNavigate();

  const isAdminDesa = user?.role === 'Admin Desa';
  const isSuperAdmin = user?.role === 'Super Admin';

  // Helper: Decode slug id ke id asli
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
  
  const [data, setData] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [alamatLengkapDesaAsal, setAlamatLengkapDesaAsal] = useState('-');
  const [alamatLengkapDesaTujuan, setAlamatLengkapDesaAsalTujuan] = useState('-');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyAction, setVerifyAction] = useState('');
  const [catatanKeputusan, setCatatanKeputusan] = useState('');
  
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

  // Helper: Fungsi menyusun string alamat lengkap dari object
  const susunAlamatWilayah = (objDesa) => {
    if (!objDesa) return '-';
    const namaDesa = `Desa Adat ${objDesa.nama_desa_adat || '-'}`;
    const namaKec = objDesa.kecamatan ? `, Kec. ${objDesa.kecamatan.nama_kecamatan}` : '';
    const namaKab = objDesa.kecamatan?.kabupaten ? `, Kab. ${objDesa.kecamatan.kabupaten.nama_kabupaten}` : '';
    const namaProv = objDesa.kecamatan?.kabupaten?.provinsi ? `, Prov. ${objDesa.kecamatan.kabupaten.provinsi.nama_provinsi}` : '';
    return `${namaDesa}${namaKec}${namaKab}${namaProv}`;
  };

  // Helper: Fungsi mengambil detail data permohonan mutasi desa adat
  const fetchDetailData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/permohonan-desa/${actualId}`);
      const permohonanData = response.data?.data || response.data;
      setData(permohonanData);

      if (permohonanData.desa_asal_pemohon) {
        setAlamatLengkapDesaAsal(susunAlamatWilayah(permohonanData.desa_asal_pemohon));
      }
      if (permohonanData.desa_tujuan_pemohon) {
        setAlamatLengkapDesaAsalTujuan(susunAlamatWilayah(permohonanData.desa_tujuan_pemohon));
      }
    } catch (error) {
      setAlert({
        show: true, 
        type: 'error',
        message: error.response?.data?.message || "Gagal memuat data permohonan mutasi desa adat."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (actualId) {
      fetchDetailData();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  // Halper: Fungsi membatalkan permohonan desa adat
  const handleConfirmBatalkan = async () => {
    if (!modal.id) return;
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-desa/cancel/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Permohonan mutasi desa adat berhasil dibatalkan.' 
      });
      setModal({ 
        show: false, 
        id: null 
      });
      fetchDetailData(); 
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal membatalkan permohonan mutasi desa adat." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: Fungsi memverifikasi permohonan mutasi desa adat
  const handleVerification = async () => {
    if (verifyAction === 'Ditolak' && !catatanKeputusan.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: isAdminDesa 
          ? "Wajib mengisi catatan/alasan ketika berkas permohonan mutasi dinyatakan tidak valid!" 
          : "Wajib mengisi catatan/alasan ketika permohonan mutasi desa adat ditolak!"
      });
      return; 
    }
    setIsSubmitting(true);
    try {
      const endpointTarget = isAdminDesa 
        ? `/permohonan-desa/validasi/${actualId}`
        : `/permohonan-desa/verifikasi/${actualId}`;

      const payload = isAdminDesa 
        ? { 
            status_validasi_berkas: verifyAction === 'Disetujui' ? 'Berkas Valid' : 'Berkas Tidak Valid', 
            catatan_validasi: catatanKeputusan 
          }
        : { 
            status_permohonan: verifyAction === 'Disetujui' ? 'Disetujui' : 'Ditolak', 
            catatan_verifikasi: catatanKeputusan 
          };

      await axiosInstance.patch(endpointTarget, payload);

      setAlert({ 
        show: true, 
        type: 'success', 
        message: isAdminDesa 
          ? `Berkas permohonan mutasi desa adat dinyatakan ${verifyAction === 'Disetujui' ? 'valid' : 'tidak valid'}!` 
          : `Permohonan mutasi desa adat berhasil di${verifyAction === 'Disetujui' ? 'setujui' : 'tolak'}.`
      });
      setShowVerifyModal(false);
      setCatatanKeputusan('');
      fetchDetailData(); 
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal memverifikasi permohonan mutasi desa adat." 
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
          const response = await axiosInstance.get(`/permohonan-desa/document/${actualId}`, {
            responseType: 'blob' 
          });
          if (isMounted) {
            localUrl = URL.createObjectURL(response.data);
            setImagePreviewUrl(localUrl);
          }
        } catch (error) { 
          console.error("Gagal memuat preview dokumen:", error);
        }
      };
      fetchImage();
    }

    return () => {
      isMounted = false;
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [data?.dokumen_pendukung, actualId]);

  // Helper: Mengunduh atau melihat dokumen pendukung
  const downloadOrViewFile = async (mode) => {
    if (!data?.dokumen_pendukung) return;
    setIsDownloading(true);
    try {
      const response = await axiosInstance.get(`/permohonan-desa/document/${actualId}`, {
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
        URL.createObjectURL(fileURL);
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

  // Halper: Style badge status permohonan
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Disetujui': 
      case 'Berkas Valid':
        return { 
          className: styles.badgeSuccess, 
          icon: <FaCheckCircle /> 
        };
      case 'Ditolak': 
      case 'Berkas Tidak Valid': 
        return { 
          className: styles.badgeDanger, 
          icon: <FaTimesCircle /> 
        };
      case 'Menunggu Verifikasi':
      case 'Menunggu Validasi Berkas':
        return { 
          className: styles.badgeWarning, 
          icon: <FaClock /> 
        };
      case 'Dibatalkan': 
        return { 
          className: styles.badgeGray, 
          icon: <FaBan /> 
        };
      default:
        return { 
          className: styles.badgeAmber, 
          icon: <FaClock /> 
        };
    }
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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MEMUAT DATA...</p>
      </div>
    );
  }

  if (!data) return null;
  
  const statusBerkasStyle = getStatusBadge(data.status_validasi_berkas);
  const statusPermohonanStyle = getStatusBadge(data.status_permohonan);
  const isImage = data.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i);

  // Helper: Mengevaluasi kemunculan tombol verifikasi
  const canVerify = () => {
    if (isAdminDesa && data.status_validasi_berkas === 'Menunggu Validasi Berkas') return true;
    if (isSuperAdmin && data.status_validasi_berkas === 'Berkas Valid' && data.status_permohonan === 'Menunggu Verifikasi') return true;
    return false;
  };

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Permohonan Mutasi Desa Adat
          </h2>
          <p className={styles.navSubtitle}>
            Rincian data permohonan mutasi desa adat yang diajukan
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
        message="Permohonan mutasi desa adat yang dibatalkan bersifat permanen dan tidak akan diproses oleh admin."
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
      {/* Content Area */}
      <div className={`${styles.contentArea} mb-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Kolom Kiri */}
          <div className="lg:col-span-2 space-y-6">
            <div className={styles.cardContainer}>
              <div className={styles.section}>
                <div>
                  <p className={`${styles.labelColumn} tracking-widest`}>
                    Desa Adat Tujuan
                  </p>
                  <h3 className={styles.sectionContent}>
                    <FaMapMarkerAlt size={25} className="text-amber-700 mr-2 flex-shrink-0" /> 
                    <span className="text-stone-800 font-bold">
                      {alamatLengkapDesaTujuan}
                    </span>
                  </h3>
                </div>
                <div className="flex flex-col gap-4 mt-4 lg:mt-0 lg:items-start">
                  <div className={`${styles.badge} ${statusBerkasStyle.className} w-fit`}>
                    {statusBerkasStyle.icon} 
                    <span className="whitespace-nowrap">
                      {data.status_validasi_berkas}
                    </span>
                  </div>
                  <div className={`${styles.badge} ${statusPermohonanStyle.className} w-fit`}>
                    {statusPermohonanStyle.icon} 
                    <span className="whitespace-nowrap">
                      {data.status_permohonan}
                    </span>
                  </div>
                </div>
              </div>
              <div className={styles.desaWaktu}>
                <div>
                  <p className={styles.labelColumn}>
                    Desa Adat Asal
                  </p>
                  <p className={styles.contentColumn}>
                    <FaHome size={22} className="text-amber-700 mr-2 flex-shrink-0" /> 
                    <span className="text-stone-700 font-medium">
                      {alamatLengkapDesaAsal}
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
            {/* Alasan Mutasi Desa Adat */}
            <div className={`${styles.cardContainer} space-y-8`}>
              <div>
                <h4 className={styles.labelReason}>
                  <FaFileAlt className="text-amber-700 mr-2" /> Alasan Permohonan
                </h4>
                <div className={styles.reason}>
                  {data.alasan_pindah}
                </div>
              </div>
              {/* Catatan Validasi Berkas */}
              {data.catatan_validasi && (
                <div className={styles.noteAreaAD}>
                  <h4 className={styles.labelNote}>
                    {data.status_validasi_berkas === 'Dibatalkan' ? 'Keterangan Pembatalan' : 'Catatan Validator Berkas'}
                  </h4>
                  <p className="text-xs italic text-stone-600">
                    {data.catatan_validasi}
                  </p>
                  {data.tanggal_validasi && (
                    <div className={styles.noteTanggal}>
                      <FaClock size={11} /> Berkas diperiksa pada: {
                        new Date(data.tanggal_validasi).toLocaleString('id-ID')
                      }
                    </div>
                  )}
                </div>
              )}
              {/* Catatan Verifikasi */}
              {data.catatan_verifikasi && (
                <div className={styles.noteAreaSA}>
                  <h4 className={styles.labelNote}>
                    {data.status_permohonan === 'Dibatalkan' ? 'Keterangan Pembatalan' : 'Catatan Verifikator'}
                  </h4>
                  <p className="text-xs italic text-stone-600">
                    {data.catatan_verifikasi}
                  </p>
                  {data.tanggal_verifikasi && (
                    <div className={styles.noteTanggal}>
                      <FaClock size={11} /> Keputusan dikeluarkan pada: {
                        new Date(data.tanggal_verifikasi).toLocaleString('id-ID')
                      }
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          {/* Kolom Kanan */}
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
            {/* Button Kembali */}
            <div className="pt-2 flex flex-col gap-2">
              {canVerify() && (
                <button 
                  onClick={() => {
                    setVerifyAction('Disetujui');
                    setShowVerifyModal(true);
                  }} 
                  className={styles.btnApproveGold}
                >
                  <FaUserCheck /> {
                    isAdminDesa ? 'Validasi Berkas Pengajuan' : 'Verifikasi Permohonan'
                  }
                </button>
              )}
              {!isAdminDesa && !isSuperAdmin && data.status_validasi_berkas === 'Menunggu Validasi Berkas' && (
                <button onClick={() => setModal({ show: true, id: actualId })} className={styles.btnHapusRed}>
                  <FaTrash /> Batalkan Permohonan
                </button>
              )}
              <button 
                onClick={() => navigate((isAdminDesa || isSuperAdmin) ? '/verifikasi-data/pengajuan-desa-adat' : '/pengajuan-desa-adat/my-data')} 
                className={styles.btnBackNetral}
              >
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
                <FaUserCheck size={21} className="text-amber-700 mr-2" /> {isAdminDesa 
                  ? 'Validasi Berkas Permohonan Mutasi' 
                  : 'Verifikasi Permohonan Mutasi Desa Adat'}
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
                  }`}
                >
                  {isAdminDesa ? '✅ Berkas Valid' : '✅ Setujui Mutasi'}
                </button>
                <button 
                  type="button" 
                  onClick={() => setVerifyAction('Ditolak')}
                  className={`${styles.choise} ${
                    verifyAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                  }`}
                >
                  {isAdminDesa ? '❌ Berkas Tidak Valid' : '❌ Tolak Mutasi'}
                </button>
              </div>
              <div className="space-y-1.5 text-left">
                <label className={styles.label}>
                  Catatan Tambahan / Alasan Penolakan {verifyAction === "Ditolak" && <span className="text-red-500">*</span>}
                </label>
                <textarea
                  className={styles.inputForm}
                  rows="5"
                  placeholder="Masukkan catatan keputusan untuk pemohon..."
                  value={catatanKeputusan}
                  onChange={(e) => setCatatanKeputusan(e.target.value)}
                  required={verifyAction === 'Ditolak'}
                ></textarea>
              </div>
              <div className="mt-6 flex gap-2 justify-end pt-3">
                <button 
                  onClick={() => { 
                    setShowVerifyModal(false); 
                    setCatatanKeputusan(''); 
                  }} 
                  disabled={isSubmitting} 
                  className={styles.btnCancel}
                >
                  Batal
                </button>
                <button 
                  onClick={handleVerification} 
                  disabled={isSubmitting}
                  className={verifyAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}
                >
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

export default PengajuanDesaDetail;