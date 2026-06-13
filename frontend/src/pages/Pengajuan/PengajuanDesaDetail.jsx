import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaFilePdf, 
  FaCheckCircle, 
  FaClock, 
  FaTimesCircle, 
  FaDownload, 
  FaBan, 
  FaFileAlt, 
  FaEye, 
  FaCalendarAlt, 
  FaMapMarkerAlt,
  FaTrash,
  FaExclamationTriangle,
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
              <FaTrash size={12} /> {isProcessing ? 'Memproses...' : 'Ya, Batalkan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const PengajuanDesaDetail = () => {
  const { id: slug } = useParams();
  const navigate = useNavigate();

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
  
  const [data, setData] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [alamatLengkapDesaAsal, setAlamatLengkapDesaAsal] = useState('-');
  const [alamatLengkapDesaTujuan, setAlamatLengkapDesaAsalTujuan] = useState('-');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  
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

  // Helper: Fungsi mengambil detail data permohonan
  const fetchDetailData = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/permohonan-desa/${actualId}`);
      const permohonanData = response.data.data;
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
        message: error.response?.data?.message || "Gagal memuat detail data permohonan."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  // Halper: Fungsi membatalkan permohonan desa
  const handleConfirmBatalkan = async () => {
    if (!modal.id) return;
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-desa/cancel/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Permohonan desa adat berhasil dibatalkan.' 
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
        message: error.response?.data?.message || "Gagal membatalkan permohonan desa adat." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: Menampilkan preview dokumen pendukung
  useEffect(() => {
    if (data?.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i)) {
      const fetchImage = async () => {
        try {
          const response = await axiosInstance.get(`/permohonan-desa/document/${actualId}`, {
            responseType: 'blob' 
          });
          const url = URL.createObjectURL(response.data);
          setImagePreviewUrl(url);
        } catch (error) { 
          console.error(error); 
        }
      };
      fetchImage();
    }
    return () => { 
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl); 
    };
  }, [data, actualId, imagePreviewUrl]);

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
      } else {
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', data.dokumen_pendukung);
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: "Gagal memproses file." 
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

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Pengajuan Desa Adat
          </h2>
          <p className={styles.navSubtitle}>
            Rincian data permohonan perubahan desa adat yang diajukan
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
        message="Permohonan yang dibatalkan tidak akan diproses oleh admin."
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
      {/* Content Area */}
      <div className={`${styles.contentArea} mb-10`}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className={styles.cardContainer}>
              {/* Desa Adat Tujuan dan Status */}
              <div className={styles.section}>
                <div>
                  <p className={`${styles.labelColumn} tracking-widest`}>
                    Desa Adat Tujuan
                  </p>
                  <h3 className={styles.sectionContent}>
                    <FaMapMarkerAlt size={25} className="text-amber-700 mr-2" /> {alamatLengkapDesaTujuan}
                  </h3>
                </div>
                <div className="flex flex-col gap-4 mt-4 lg:mt-0 lg:items-start">
                <div className={`${styles.badge} ${statusBerkasStyle.className} w-fit`}>
                  {statusBerkasStyle.icon} 
                  <span className="ml-2 whitespace-nowrap">
                    {data.status_validasi_berkas}
                  </span>
                </div>
                <div className={`${styles.badge} ${statusPermohonanStyle.className} w-fit`}>
                  {statusPermohonanStyle.icon} 
                  <span className="ml-2 whitespace-nowrap">
                    {data.status_permohonan}
                  </span>
                </div>
              </div>
              </div>
              {/* Desa Adat Asal dan Tanggal */}
              <div className={styles.desaWaktu}>
                <div>
                  <p className={styles.labelColumn}>
                    Desa Adat Asal
                  </p>
                  <p className={styles.contentColumn}>
                    <FaHome size={22} className="text-amber-700 mr-2" /> 
                    <span>{alamatLengkapDesaAsal}</span>
                  </p>
                </div>
                <div>
                  <p className={styles.labelColumn}>
                    Waktu Pengajuan
                  </p>
                  <p className={styles.contentColumn}>
                    <FaCalendarAlt className="text-amber-700" /> 
                    <span>
                      {`${new Date(data.tanggal_pengajuan).toLocaleDateString('id-ID', { 
                        dateStyle: 'full' })} • ${new Date(data.tanggal_pengajuan).toLocaleTimeString('id-ID', { 
                          hour: '2-digit', minute: '2-digit' 
                        }).replace('.', ':')} WITA`
                      }
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {/* Alasan Pindah */}
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
                    Catatan Validator Berkas:
                  </h4>
                  <p className="text-xs italic text-gray-600">
                    {data.catatan_validasi}
                  </p>
                  {data.tanggal_validasi && (
                    <div className={styles.noteTanggal}>
                      <FaClock className="mb-0.5" /> Berkas diperiksa pada: {new Date(data.tanggal_validasi).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              )}
              {/* Catatan Verifikasi */}
              {data.catatan_verifikasi && (
                <div className={styles.noteAreaSA}>
                  <h4 className={styles.labelNote}>
                    Catatan Verifikator:
                  </h4>
                  <p className="text-xs italic text-gray-600">
                    {data.catatan_verifikasi}
                  </p>
                  {data.tanggal_verifikasi && (
                    <div className={styles.noteTanggal}>
                      <FaClock className="mb-0.5" /> Keputusan dikeluarkan pada: {new Date(data.tanggal_verifikasi).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="space-y-6">
            {/* Dokumen Pendukung */}
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
                      <img src={imagePreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-red-500">
                        <FaFilePdf size={50} className="ml-2" />
                        <p className={styles.labelFile}>
                          Dokumen PDF
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => downloadOrViewFile('view')} disabled={isDownloading} className={styles.btnLihatFile}>
                      <FaEye /> <span>Lihat</span>
                    </button>
                    <button onClick={() => downloadOrViewFile('download')} disabled={isDownloading} className={styles.btnUnduhFile}>
                      <FaDownload /> <span>Unduh</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Button Kembali */}
            <div className="pt-2">
              {data.status_validasi_berkas === 'Menunggu Validasi Berkas' && (
                <button onClick={() => setModal({ show: true, id: actualId })} className={styles.btnHapusRed}>
                  <FaTrash /> Batalkan
                </button>
              )}
              <button onClick={() => navigate('/pengajuan-desa-adat/my-data')} className={styles.btnBackNetral}>
                <FaArrowLeft /> Kembali ke Riwayat
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

export default PengajuanDesaDetail