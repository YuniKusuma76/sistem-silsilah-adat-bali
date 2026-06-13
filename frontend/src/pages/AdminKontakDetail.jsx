import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaCalendarAlt, 
  FaClock,
  FaQuoteLeft,
  FaCheckCircle,
  FaSpinner,
  FaUserTie,
  FaIdCard,
  FaCopy,
  FaChevronDown
} from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// Helper untuk ekstrak ID dari Slug
const extractIdFromSlug = (slug) => {
  try {
    // Split berdasarkan strip "-"
    const parts = slug.split('-');
    // Ambil bagian terakhir (encodedId)
    const encodedId = parts[parts.length - 1];
    // Decode Base64 menjadi string, lalu parse ke Integer
    return atob(encodedId); 
  } catch (error) {
    console.error("Gagal decode slug:", error);
    return null;
  }
};

const AdminKontakDetail = () => {
  // State Data
  const { id: slug } = useParams();
  const realId = extractIdFromSlug(slug);
  const [kontak, setKontak] = useState(null);
  
  // State UI
  const [isLoading, setIsLoading] = useState(true);

  // State Navigasi
  const navigate = useNavigate();

  // State Alert
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

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

  // Fetch Detail Data
  useEffect(() => {
    const fetchDetail = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/kontak/${realId}`);
        setKontak(response.data.data);
      } catch (error) {
        setAlert({
          show: true,
          type: 'error',
          message: error.response?.data?.message || 'Gagal memuat detail pesan user.'
        });
      } finally {
        setIsLoading(false);
      }
    };
    if (realId) fetchDetail();
  }, [realId]);

  // Handle Update Status
  const handleStatusChange = async (newStatus) => {
    try {
      await axiosInstance.patch(`/kontak/status-pesan/${realId}`, {
        status_pesan: newStatus
      });

      setKontak(prev => ({ 
        ...prev, 
        status_pesan: newStatus 
      }));
      
      setAlert({
        show: true,
        type: 'success',
        message: `Status berhasil diubah menjadi ${newStatus}`
      });
    } catch (error) {
      console.log(error);
      setAlert({
        show: true,
        type: 'error',
        message: 'Gagal mengupdate status pesan.'
      });
    }
  };

  // Helper Warna & Style Status
  const getStatusStyle = (status) => {
    switch (status) {
      case 'Selesai':
        return {
          bg: 'bg-green-100',
          text: 'text-green-700',
          border: 'border-green-200',
          icon: <FaCheckCircle className="mr-2" />
        };
      case 'Proses':
        return {
          bg: 'bg-blue-100',
          text: 'text-blue-700',
          border: 'border-blue-200',
          icon: <FaSpinner className="mr-2 animate-spin" />
        };
      default:
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          border: 'border-yellow-200',
          icon: <FaClock className="mr-2" />
        };
    }
  };

  // Helper Format Tanggal
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric'
    });
  };

  // Helper Format Waktu
  const formatTime = (dateString) => {
    return new Date(dateString).toLocaleTimeString('id-ID', {
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // Handle Copy Email
  const handleCopyEmail = (email) => {
    navigator.clipboard.writeText(email);
    setAlert({
      show: true,
      type: 'success',
      message: 'Alamat email berhasil disalin.'
    });
  };

  if (isLoading) {
    return (
      <div className="main-container">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600"></div>
          <span className="text-gray-500 font-medium">
            Memuat pesan user...
          </span>
        </div>
      </div>
    );
  }

  if (!kontak) {
    return null;
  }

  const statusStyle = getStatusStyle(kontak.status_pesan);

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

      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Detail Kontak & Pesan User
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Detail kontak dan pesan user yang terkirim
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 space-y-6">
            {/* CARD PENGIRIM */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-[#3A2000] text-white flex items-center gap-2">
                <FaUserTie />
                <h3 className="text-sm font-bold uppercase tracking-wide">
                  Informasi Pengirim
                </h3>
              </div>
              {/* Nama Pengirim */}
              <div className="p-6 text-center">
                <div className="w-20 h-20 mx-auto bg-gray-200 rounded-full mb-4 border-4 border-white shadow-md overflow-hidden">
                  <img src="/profile.png" alt="User Pengirim" className="w-full h-full object-cover" />
                </div>
                <h4 className="text-lg font-bold text-gray-800 break-words leading-tight px-2">
                  {kontak.nama_pengirim}
                </h4>
                {/* Email Pengirim */}
                <button 
                  onClick={() => handleCopyEmail(kontak.email_address)} 
                  className="group flex items-center justify-center gap-2 mb-4 w-full text-gray-500 hover:text-blue-600 transition-all cursor-pointer py-1.5 px-3" 
                  title="Salin Email"
                >
                  <span className="text-sm truncate max-w-[180px] font-medium border-b border-dashed border-gray-300 group-hover:border-blue-400">
                    {kontak.email_address}
                  </span>
                  <FaCopy size={12} className="text-gray-400 group-hover:text-blue-500 ml-1"/>
                </button>
                {/* Role Pengirim */}
                <div className={`inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wide border
                  ${kontak.user_pengirim ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                  <FaIdCard /> 
                  {kontak.user_pengirim ? `${kontak.user_pengirim.role}` : 'Guest'}
                </div>
                {/* Info Tanggal Pengiriman */}
                <div className="mt-6 pt-4 border-t border-dashed border-gray-200 flex justify-between text-xs text-gray-500">
                  <div className="flex items-center gap-2">
                    <FaCalendarAlt size={12} className="relative -top-[1px]" /> 
                    <span>{formatDate(kontak.createdAt)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FaClock size={12} className="relative -top-[1px]" />
                    <span>{formatTime(kontak.createdAt)} WITA</span>
                  </div>
                </div>
              </div>
            </div>
            {/* CARD STATUS */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">
                Tindakan Admin
              </h3>
              <div className={`p-4 rounded-xl border ${statusStyle.bg} ${statusStyle.border} mb-5 flex items-center`}>
                <div className={`text-xl ${statusStyle.text}`}>
                  {statusStyle.icon}
                </div>
                <div className="ml-3">
                  <p className={`text-[10px] font-bold uppercase opacity-80 ${statusStyle.text}`}>
                    Status Saat Ini
                  </p>
                  <p className={`font-bold text-lg leading-none ${statusStyle.text}`}>
                    {kontak.status_pesan}
                  </p>
                </div>
              </div>

              <div className="relative">
                <label className="text-xs font-bold text-gray-700 mb-1 block">
                  Update Status Pesan:
                </label>
                <select
                  value={kontak.status_pesan}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 font-semibold focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:bg-white transition-all cursor-pointer appearance-none"
                >
                  <option value="Menunggu">⏳ Menunggu</option>
                  <option value="Proses">⚙️ Sedang Diproses</option>
                  <option value="Selesai">✅ Selesai</option>
                </select>
                <div className="absolute right-3 top-[2.2rem] pointer-events-none text-gray-400">
                  <FaChevronDown className="w-4 h-4 object-contain items-center" />
                </div>
              </div>
            </div>
          </div>
          {/* CARD PESAN */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-lg border-0 ring-1 ring-gray-100 min-h-[620px] flex flex-col relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1.5 bg-[#3A2000]"></div>
              {/* Header Pesan */}
              <div className="px-8 py-6 border-b border-gray-300 flex justify-between items-start bg-white">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-gray-100 rounded-lg text-[#3A2000]">
                    <FaQuoteLeft size={20} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 tracking-tight">
                      Pesan User
                    </h3>
                    <p className="text-sm text-gray-500">
                      Detail pesan yang dikirimkan oleh user
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-8 flex-1 bg-white">
                <div className="max-w-3xl">
                  <div className="prose prose-lg max-w-none text-gray-600 leading-loose whitespace-pre-wrap font-sans">
                    {kontak.pesan}
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-8 py-4 border-t border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2 text-gray-400 text-xs font-medium italic">
                <FaCheckCircle size={10} className="text-green-500" /> Pesan tersimpan
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Button Back */}
        <div className="mt-8 pt-6 flex items-center justify-center">
          <button 
            onClick={() => navigate('/kontak/inbox')} 
            className="btn-cencel"
          >
            <FaArrowLeft size={14} /> Kembali
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default AdminKontakDetail;