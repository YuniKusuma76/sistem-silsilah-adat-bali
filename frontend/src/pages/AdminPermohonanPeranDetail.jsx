import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  FaUserCog,
  FaCheck,
  FaTimes,
  FaIdCard,
  FaExclamationTriangle,
} from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// Modal Verifikasi
const VerificationModal = ({ isOpen, onClose, onSubmit, data, isProcessing }) => {
  // State Data Verifikasi
  const [status, setStatus] = useState('Setuju');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState('');

  // Effect: Reset state ketika modal dibuka
  useEffect(() => {
    if (isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStatus('Setuju');
      setCatatan('');
      setError('');
    }
  }, [isOpen]);

  // Handle Submit
  const handleSubmit = () => {
    if (status === 'Tolak' && !catatan.trim()) {
      setError("Catatan wajib diisi jika permohonan ditolak!");
      return;
    }
    onSubmit(data.id, status, catatan);
  };

  if (!isOpen || !data) {
    return null;
  }

  const isSetuju = status === 'Setuju';

  return (
    <div className="modal-overlay">
      <div className="modal-verifikasi">
        {/* Header Modal */}
        <div className="modal-header">
          <h3 className="modal-title">
            <FaUserCog className="text-[#3A2000]" /> Verifikasi Permohonan Peran
          </h3>
          <button onClick={onClose} className="modal-close">
            <FaTimes size={18} />
          </button>
        </div>
        <div className="p-6">
          {/* Informasi User */}
          <div className="card-user-content">
            <div className="user-images">
              <img src="/profile.png" alt="Pemohon" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                Pemohon
              </p>
              <p className="font-bold text-gray-800 text-lg leading-tight">
                {data.pengguna?.name}
              </p>
              <p className="text-sm font-medium mt-1 flex items-center gap-2">
                <FaIdCard /> 
                <span>{data.pengguna?.role}</span>
              </p>
            </div>
          </div>
          {/* Informasi Role */}
          <div className="card-role-content">
            <span className="text-gray-500 block text-xs uppercase font-bold">
              Permohonan Role
            </span>
            <span className="text-lg font-bold text-[#3A2000]">
              {data.role_diajukan}
            </span>
          </div>
          {/* Keputusan Admin */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Keputusan Permohonan
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Card Setuju */}
              <button
                onClick={() => setStatus('Setuju')}
                className={`card-btn-setuju ${isSetuju ? 'isSetuju' : 'isNotSetuju'}`}
              >
                {isSetuju && <div className="absolute top-2 right-2 text-green-600"></div>}
                <FaCheck size={20} className={isSetuju ? 'text-green-600' : 'text-gray-400'} />
                <span className="font-bold text-sm">Setujui</span>
              </button>
              {/* Card Tolak */}
              <button
                onClick={() => setStatus('Tolak')}
                className={`card-btn-tolak ${!isSetuju ? 'isTolak' : 'isNotTolak'}`}
              >
                {!isSetuju && <div className="absolute top-2 right-2 text-red-600"></div>}
                <FaTimes size={20} className={!isSetuju ? 'text-red-600' : 'text-gray-400'} />
                <span className="font-bold text-sm">Tolak</span>
              </button>
            </div>
          </div>
          {/* Catatan Keputusan */}
          <div className={`transition-all duration-300 ${!isSetuju ? 'opacity-100' : 'opacity-100'}`}>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Catatan Validator 
              {!isSetuju && <span className="text-red-500 ml-1">*</span>}
            </label>
            <textarea
              className={`area-input-note ${error ? 'error-note' : isSetuju ? 'setuju-note' : 'tolak-note'}`}
              placeholder={!isSetuju ? "Berikan catatan..." : "Berikan catatan opsional..."}
              value={catatan}
              onChange={(e) => { setCatatan(e.target.value); setError(''); }}
            ></textarea>
            {error && (
              <p className="text-red-500 text-xs mt-2 flex items-center gap-1 animate-pulse">
                <FaExclamationTriangle /> {error}
              </p>
            )}
          </div>
        </div>
        {/* Footer Actions */}
        <div className="p-6 pt-2 flex items-center justify-end gap-3 bg-white">
          <button 
            onClick={onClose} 
            disabled={isProcessing} 
            className="btn-verif-batal"
          >
            Batal
          </button>
          <button 
            onClick={handleSubmit} 
            disabled={isProcessing}
            className={`btn-verif ${isSetuju ? 'btn-setuju' : 'btn-tolak'} disabled:opacity-70 disabled:cursor-not-allowed`}
          >
            {isProcessing ? (
              <>
                <div className="spinner-verif"></div>
                <span>Menyimpan...</span>
              </>
            ) : (
              <>
                {isSetuju ? <FaCheck /> : <FaTimes />}
                <span>{isSetuju ? 'Setujui Permohonan' : 'Tolak Permohonan'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper untuk ekstrak ID dari Slug
const extractIdFromSlug = (slug) => {
  if (!slug) return null;
  try {
    const parts = slug.split('-');
    const encodedId = parts[parts.length - 1];
    // 1. Kembalikan karakter URL-Safe ke Base64 standar
    let base64 = encodedId.replace(/-/g, '+').replace(/_/g, '/');
    // 2. Tambahkan padding '=' jika hilang saat proses encode
    while (base64.length % 4) {
      base64 += '=';
    }
    // 3. Decode dan kembalikan
    return atob(base64); 
  } catch (error) {
    console.error("Gagal decode slug:", error);
    return null;
  }
};

const AdminPermohonanPeranDetail = () => {
  // State ID
  const { id: slug } = useParams();
  const realId = extractIdFromSlug(slug);

  // State Navigasi
  const navigate = useNavigate();

  // State Data
  const [data, setData] = useState(null);

  // State UI
  const [loading, setLoading] = useState(true);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  
  // State Verifikasi dan Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State Alert Global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const fetchDetail = async () => {
    if (!realId) {
      return;
    }
    try {
      setLoading(true);
      const response = await axiosInstance.get(`/permohonan-peran/${realId}`);
      setData(response.data.data);
    } catch (error) {
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || "Gagal memuat data permohonan."
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realId]);

  // Handle Verifikasi
  const handleVerificationSubmit = async (targetId, status, catatan) => {
    setIsSubmitting(true);
    try {
      await axiosInstance.put(`/permohonan-peran/${targetId}`, {
        status_permohonan: status,
        catatan_admin: catatan
      });
      setAlert({ 
        show: true, 
        type: 'success', 
        message: `Permohonan peran berhasil diverifikasi.` 
      });
      setModalOpen(false);
      fetchDetail();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal memproses data permohonan." 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effect: Auto-Close Alert
  useEffect(() => {
    if ((alert.show && alert.type === 'success') || alert.type === 'error') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ 
          ...prev, 
          show: false 
        }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Fetch Preview Gambar
  useEffect(() => {
    if (data && data.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i)) {
      const fetchImage = async () => {
        try {
          const response = await axiosInstance.get(`/permohonan-peran/${realId}/dokumen`, {
            responseType: 'blob' 
          });

          if (response.data.type === 'application/json') {
            return;
          }

          const url = URL.createObjectURL(response.data);
          setImagePreviewUrl(url);
        } catch (error) {
          console.error("Gagal memuat preview gambar", error);
        }
      };
      fetchImage();
    }
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, realId]);

  // Handler View Dokumen dan Download
  const downloadOrViewFile = async (mode) => {
    if (!data.dokumen_pendukung) {
      return;
    }
    setIsDownloading(true);

    try {
      const response = await axiosInstance.get(`/permohonan-peran/${realId}/dokumen`, {
        responseType: 'blob' 
      });

      const contentType = response.headers['content-type'];

      if (contentType && contentType.includes('application/json')) {
        const textData = await response.data.text();
        const jsonError = JSON.parse(textData);
        throw new Error(jsonError.message || "File tidak ditemukan di server.");
      }

      const file = new Blob([response.data], { 
        type: contentType 
      });
      const fileURL = URL.createObjectURL(file);

      if (mode === 'view') {
        const pdfWindow = window.open(fileURL, '_blank');
        if (!pdfWindow) {
          setAlert({
            show: true,
            type: 'error',
            message: "Pop-up diblokir browser. Izinkan pop-up untuk melihat dokumen."
          });
        }
      } else {
        const link = document.createElement('a');
        link.href = fileURL;
        link.setAttribute('download', data.dokumen_pendukung);
        document.body.appendChild(link);
        link.click();
        link.remove();

        setAlert({
          show: true,
          type: 'success',
          message: "Dokumen berhasil diunduh."
        });
      }

      if (mode === 'download') {
        setTimeout(() => URL.revokeObjectURL(fileURL), 1000);
      }
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: `Gagal: ${error.message}`
      });
    } finally {
      setIsDownloading(false);
    }
  };

  

  // Helper Badge Status Pengajuan
  const getStatusBadge = (status) => {
    switch (status) {
      case 'Setuju':
        return { 
          className: 'span-green', icon: <FaCheckCircle /> 
        };
      case 'Tolak':
        return { 
          className: 'span-red', icon: <FaTimesCircle /> 
        };
      case 'Batal':
        return { 
          className: 'span-gray', icon: <FaBan /> 
        };
      default:
        return { 
          className: 'span-yellow', icon: <FaClock /> 
        };
    }
  };

  // Fungsi Set Date
  const formatDateOnly = (dateString) => {
    if (!dateString) {
      return '-';
    }
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    });
  };

  // Fungsi Set Time
  const formatTimeOnly = (dateString) => {
    if (!dateString) {
      return '';
    }
    const time = new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit', 
      minute: '2-digit'
    });
    return `${time.replace('.', ':')} WITA`;
  };

  // Fungsi Membaca CheckList
  const renderChecklist = () => {
    const list = typeof data.detail_checklist === 'string' 
      ? JSON.parse(data.detail_checklist) 
      : data.detail_checklist || [];
      
    if (list.length === 0) {
      return <li className="text-gray-400 text-sm italic">Tidak Ada Checklist</li>;
    }
    return list.map((item, idx) => (
      <li key={idx} className="list-checklist">
        <FaCheckCircle className="text-green-500 mt-0.5 flex-shrink-0" />
        <span>{item}</span>
      </li>
    ));
  };

  // Render Loading
  if (loading) return (
    <div className="main-container">
      <div className="loading-spinner-content">
        <div className="loading-spinner"></div>
        <span className="text-gray-500 ml-2">
          Memuat detail permohonan...
        </span>
      </div>
    </div>
  );

  if (!data) {
    return null;
  }

  const statusStyle = getStatusBadge(data.status_permohonan);
  const isImage = data.dokumen_pendukung && data.dokumen_pendukung.match(/\.(jpeg|jpg|png)$/i);

  return (
    <div className="main-container">
      {/* Alert Content */}
      {alert.show && (
        <div className={`alert-container 
          ${alert.type === 'success' ? 'border-green-500 bg-green-50' : alert.type === 'error' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`}>
          <div className="flex items-start p-4">
            {/* Icon */}
            <div className="flex-shrink-0 mr-3 text-2xl">
              {alert.type === 'success' && '✅'}
              {alert.type === 'error' && '⚠️'}
              {alert.type === 'loading' && '⏳'}
            </div>
            {/* Content */}
            <div className="flex-1">
              <h4 className={`font-bold text-sm 
                ${alert.type === 'success' ? 'text-green-800' : alert.type === 'error' ? 'text-red-800' : 'text-blue-800'}`}>
                {alert.type === 'success' ? 'Berhasil!' : alert.type === 'error' ? 'Terjadi Kesalahan!' : 'Mohon Tunggu.'}
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
          {/* Progress bar line */}
          {(alert.type === 'success' || alert.type === 'error') && (
            <div className="h-1.5 w-full bg-gray-200">
              <div className={`h-full animate-shrink ${alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
          )}
        </div>
      )}
      {/* Modal Verifikasi */}
      <VerificationModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)} 
        onSubmit={handleVerificationSubmit} 
        data={data} 
        isProcessing={isSubmitting} 
      />
      {/* Detail Content */}
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Detail & Verifikasi Permohonan Peran
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Meninjau dokumen pendukung dan memberikan keputusan akses peran
          </p>
        </div>
        {/* Button Verifikasi */}
        <div className="mb-8 flex justify-end">
          {data.status_permohonan === 'Menunggu' && (
            <button onClick={() => setModalOpen(true)} className="verif-field">
              <FaUserCog /> Proses Verifikasi
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="card-st-container">
              <div className="p-5 flex flex-wrap justify-between gap-4">
                <div className="border-b border-gray-200 w-full pb-4 mb-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden">
                    <img src="/profile.png" alt="Pemohon" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-bold uppercase">
                      Pemohon
                    </p>
                    <p className="font-bold text-gray-800 text-lg">
                      {data.pengguna?.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      <FaIdCard /> <span>{data.pengguna?.role}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="ps-6 pb-6 pe-6 flex flex-wrap justify-between items-center gap-4">
                <div>
                  <h3 className="role-header">
                    Permohonan Role
                  </h3>
                  <div className="role-text"><FaUserCheck className="text-xl" /> {data.role_diajukan}</div>
                </div>
                <div className={`status-condition ${statusStyle.className}`}>
                  {statusStyle.icon} <span>{data.status_permohonan}</span>
                </div>
              </div>
              <div className="ps-6 pb-6 pe-6 bg-gray-50/50 grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8 text-sm space-y-4">
                {/* Tanggal Pengajuan */}
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-3">
                  <div className="mb-1 mt-4 sm:mb-0">
                    <p className="date-title">
                      Tanggal Pengajuan:
                    </p>
                    <p className="date-text flex items-center gap-2 mb-1">
                      <FaCalendarAlt className="text-gray-400" /> 
                      {formatDateOnly(data.tanggal_pengajuan)}
                    </p>
                    <p className="date-text flex items-center gap-2">
                      <FaClock className="text-gray-400" /> 
                      {formatTimeOnly(data.tanggal_pengajuan)}
                    </p>
                  </div>
                </div>
                {/* Tanggal Keputusan*/}
                {data.tanggal_keputusan && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-3">
                    <div className="mb-1 sm:mb-0">
                      <p className="date-title">
                        Diputuskan Pada:
                      </p>
                      <p className="date-text flex items-center gap-2 mb-1">
                        <FaCheckCircle className="text-gray-400" /> 
                        {formatDateOnly(data.tanggal_keputusan)}
                      </p>
                      <p className="date-text flex items-center gap-2">
                        <FaClock className="text-gray-400" /> 
                        {formatTimeOnly(data.tanggal_keputusan)}
                      </p>
                    </div>
                  </div>
                )}
                {/* Tanggal Pembatalan*/}
                {data.tanggal_pembatalan && (
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center pb-3">
                    <div className="mb-1 sm:mb-0">
                      <p className="date-title">
                        Dibatalkan Pada:
                      </p>
                      <p className="date-text flex items-center gap-2 mb-1">
                        <FaBan className="text-gray-400" /> 
                        {formatDateOnly(data.tanggal_pembatalan)}
                      </p>
                      <p className="date-text flex items-center gap-2">
                        <FaClock className="text-gray-400" /> 
                        {formatTimeOnly(data.tanggal_pembatalan)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Card Detail Pengajuan */}
            <div className="card-detail">
              <h3 className="card-detail-title">
                <FaFileAlt /> Detail Pengajuan
              </h3>
              <div className="mb-6">
                <label className="label-data">
                  Alasan Permohonan
                </label>
                <div className="kolom-alasan">
                  {data.alasan_permohonan}
                </div>
              </div>
              <div>
                <label className="label-data">
                  Persyaratan yang Disetujui</label>
                <ul className="space-y-2">
                  {renderChecklist()}
                </ul>
              </div>
            </div>
          </div>
          {/* Dokumen */}
          <div className="space-y-6">
            <div className="card-dokumen">
              <h3 className="card-dokumen-title">
                <FaFileAlt /> Dokumen Pendukung
              </h3>
              {!data.dokumen_pendukung ? (
                  <div className="content-noDokumen">
                    <FaFileImage size={24} className="mx-auto mb-2 opacity-50"/>
                    <span className="text-xs">Tidak ada dokumen</span>
                  </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {/* Preview Area */}
                  <div className="content-isDokumen group">
                    {isImage ? (
                      imagePreviewUrl ? (
                        <img 
                          src={imagePreviewUrl} 
                          alt="Preview" 
                          className="preview-dokumen"/>
                      ) : (
                        <div className="loading-spinner"></div>
                      )
                    ) : (
                      // Icon PDF Besar
                      <div className="flex flex-col items-center text-red-500">
                        <FaFilePdf size={48} />
                        <span className="text-xs mt-2 font-medium">
                          Dokumen PDF
                        </span>
                      </div>
                    )}
                  </div>
                  {/* Tombol View & Download */}
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => downloadOrViewFile('view')}
                      disabled={isDownloading}
                      className="btn-preview"
                    >
                      <FaEye /> Lihat
                    </button>
                    <button 
                      onClick={() => downloadOrViewFile('download')}
                      disabled={isDownloading}
                      className="btn-download"
                    >
                      <FaDownload /> Unduh
                    </button>
                  </div>
                </div>
              )}
            </div>
            {/* Catatan Admin / Keterangan Status */}
            {(data.catatan_admin || data.status_permohonan === 'Tolak' || data.status_permohonan === 'Batal') && (
              <div className={`card-note border ${
                data.status_permohonan === 'Tolak' ? 'bg-red-50 border-red-200' : 
                data.status_permohonan === 'Batal' ? 'bg-gray-100 border-gray-300' : 'bg-blue-50 border-blue-200'}`
              }>
              <h3 className={`field-keputusan flex items-center gap-2 font-bold text-sm mb-3 ${
                data.status_permohonan === 'Tolak' ? 'text-red-700' : 
                data.status_permohonan === 'Batal' ? 'text-gray-700' : 'text-blue-700'}`
              }>
                {/* Icon Logic */}
                {data.status_permohonan === 'Tolak' ? <FaTimesCircle /> : data.status_permohonan === 'Batal' ? <FaBan /> : <FaCheckCircle />}
                {/* Title Logic */}
                {data.status_permohonan === 'Batal' ? 'Keterangan Pembatalan' : 'Catatan Validator'}
              </h3>
                <p className={`text-sm italic ${
                  data.status_permohonan === 'Tolak' ? 'text-red-800' : 
                  data.status_permohonan === 'Batal' ? 'text-gray-600' : 'text-blue-800'}`
                }>
                  "{data.catatan_admin || 'Tidak ada catatan khusus.'}"
                </p>
                {/* Tampilkan Validator hanya jika BUKAN dibatalkan sendiri */}
                {data.validator && data.status_permohonan !== 'Batal' && (
                  <div className="mt-4 pt-4 text-right">
                    <p className="text-xs text-gray-500">
                      Divalidasi oleh:
                    </p>
                    <p className="text-xs font-bold text-gray-700">
                      {data.validator.name}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        {/* Button Kembali*/}
        <div className="mt-8 pt-6 flex items-center justify-center">
          <button 
            onClick={() => navigate('/permohonan-peran/list')} 
            className="btn-cencel"
          >
            <FaArrowLeft /> Kembali
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminPermohonanPeranDetail;