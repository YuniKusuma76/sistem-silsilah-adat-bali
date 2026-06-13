import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaFilePdf, 
  FaFileImage, 
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
  FaExclamationTriangle
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

const PengajuanRoleDetail = () => {
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
  const [alamatLengkapDesa, setAlamatLengkapDesa] = useState('-');

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

  // Helper: Fungsi mengambil detail data permohonan
  const fetchDetailDanWilayah = async () => {
    try {
      setLoading(true);

      const response = await axiosInstance.get(`/permohonan-role/${actualId}`);
      const permohonanData = response.data.data;
      setData(permohonanData);

      if (permohonanData.desa_adat_id_tujuan) {
        try {
          const [resDesa, resKec, resKab, resProv] = await Promise.all([
            axiosInstance.get('/desa-adat'),
            axiosInstance.get('/kecamatan'),
            axiosInstance.get('/kabupaten'),
            axiosInstance.get('/provinsi')
          ]);

          const daftarDesa = resDesa.data.data || [];
          const daftarKec = resKec.data.data || [];
          const daftarKab = resKab.data.data || [];
          const daftarProv = resProv.data.data || [];

          // Mencari objek desa adat yang sesuai
          const targetDesa = daftarDesa.find(d => d.id === permohonanData.desa_adat_id_tujuan);

          if (targetDesa) {
            const targetKec = daftarKec.find(k => k.id === targetDesa.kecamatan_id || k.id === targetDesa.kecamatan_id_adat);
            const targetKab = targetKec ? daftarKab.find(kb => kb.id === targetKec.kabupaten_id) : null;
            const targetProv = targetKab ? daftarProv.find(p => p.id === targetKab.provinsi_id) : null;

            // Menyusun string alamat lengkap
            const namaDesa = `Desa Adat ${targetDesa.nama_desa_adat}`;
            const namaKec = targetKec ? `, Kec. ${targetKec.nama_kecamatan}` : '';
            const namaKab = targetKab ? `, Kab. ${targetKab.nama_kabupaten}` : '';
            const namaProv = targetProv ? `, Prov. ${targetProv.nama_provinsi}` : '';
            
            setAlamatLengkapDesa(`${namaDesa}${namaKec}${namaKab}${namaProv}`);
          } else {
            setAlamatLengkapDesa(`${permohonanData.desa_adat_id_tujuan}`);
          }
        } catch (errorWilayah) {
          console.error("Gagal memetakan hierarki wilayah adat:", errorWilayah);
          setAlamatLengkapDesa(`${permohonanData.desa_adat_id_tujuan}`);
        }
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
    fetchDetailDanWilayah();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  // Halper: Fungsi membatalkan permohonan role
  const handleConfirmBatalkan = async () => {
    if (!modal.id) return;
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-role/cancel/${modal.id}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Permohonan role berhasil dibatalkan.' 
      });
      setModal({ 
        show: false, 
        id: null 
      });
      fetchDetailDanWilayah(); 
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal membatalkan permohonan role." 
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
          const response = await axiosInstance.get(`/permohonan-role/document/${actualId}`, {
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
      const response = await axiosInstance.get(`/permohonan-role/document/${actualId}`, {
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
  const statusStyle = getStatusBadge(data.status_permohonan);
  const isImage = data.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i);

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Pengajuan Role
          </h2>
          <p className={styles.navSubtitle}>
            Rincian data permohonan perubahan role yang diajukan
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
              {/* Role dan Status Permohonan */}
              <div className={styles.roleStatus}>
                <div>
                  <p className={`${styles.labelColumn} tracking-widest`}>
                    Permohonan Role
                  </p>
                  <h3 className={styles.roleContent}>
                    <FaUserCheck className="text-amber-700" /> {data.role_yang_diminta}
                  </h3>
                </div>
                <div className={`${styles.badge} ${statusStyle.className}`}>
                  {statusStyle.icon} <span>{data.status_permohonan}</span>
                </div>
              </div>
              {/* Desa Adat dan Tanggal */}
              <div className={styles.desaWaktu}>
                <div>
                  <p className={styles.labelColumn}>
                    Desa Adat Tujuan
                  </p>
                  <p className={styles.contentColumn}>
                    <FaMapMarkerAlt className="text-amber-700 mr-2" /> 
                    <span>{alamatLengkapDesa}</span>
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
                        dateStyle: 'full' 
                      })} • ${new Date(data.tanggal_pengajuan).toLocaleTimeString('id-ID', { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      }).replace('.', ':')} WITA`}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            <div className={`${styles.cardContainer} space-y-8`}>
              <div>
                <h4 className={styles.labelReason}>
                  <FaFileAlt className="text-amber-700 mr-2" /> Alasan Permohonan
                </h4>
                <div className={styles.reason}>
                  {data.alasan_permohonan}
                </div>
              </div>
              {/* Catatan verifikasi */}
              {(data.catatan_super_admin || data.status_permohonan !== 'Menunggu') && (
                <div className={`${styles.noteArea} ${
                  data.status_permohonan === 'Ditolak' ? 'bg-red-50 border-red-500' : 
                  data.status_permohonan === 'Dibatalkan' ? 'bg-gray-50 border-gray-400' : 
                  'bg-green-50 border-green-500'}`
                }>
                  <h4 className={styles.labelNote}>
                    {data.status_permohonan === 'Dibatalkan' ? 'Keterangan Pembatalan:' : 'Catatan Validator:'}
                  </h4>
                  <p className="text-xs italic text-gray-600">
                    {data.catatan_super_admin}
                  </p>
                  {data.tanggal_verifikasi && (
                    <div className={styles.noteTanggal}>
                      <FaClock className="mb-0.5" /> Diverifikasi pada: {
                        new Date(data.tanggal_verifikasi).toLocaleString('id-ID')
                      }
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
              {data.status_permohonan === 'Menunggu' && (
                <button onClick={() => setModal({ show: true, id: actualId })} className={styles.btnHapusRed}>
                  <FaTrash /> Batalkan
                </button>
              )}
              <button onClick={() => navigate('/pengajuan-role/my-data')} className={styles.btnBackNetral}>
                <FaArrowLeft /> Kembali ke Riwayat
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PengajuanRoleDetail;