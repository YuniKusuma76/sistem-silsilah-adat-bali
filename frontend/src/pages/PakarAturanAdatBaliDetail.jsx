import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { 
  FaArrowLeft, 
  FaBook, 
  FaUserTie, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaGavel,
  FaQuoteLeft,
  FaCalendarAlt,
  FaIdCard
} from 'react-icons/fa';
import Footer from '../components/Footer/Footer';

const PakarAturanAdatBaliDetail = () => {
  // Params ID Aturan
  const { id } = useParams();

  // State Navigasi
  const navigate = useNavigate();

  // State Data
  const [data, setData] = useState(null);

  // State UI
  const [loading, setLoading] = useState(true);
  
  // State Alert Global
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

  // Efek: Auto-Close Alert
  useEffect(() => {
    if (alert.show && alert.type === 'success' || alert.type === 'error') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ 
          ...prev, 
          show: false 
        }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Fetch Data Detail Aturan
  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`http://localhost:8080/api/aturan/${id}`, {
          withCredentials: true
        });
        setData(response.data.data);
      } catch (error) {
        setAlert({
          show: true,
          type: 'error',
          message: error.response?.data?.message || "Gagal memuat detail aturan."
        });
        window.scrollTo(0,0);
      } finally {
        setLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  // Halper Functions Badge
  const getStatusBadge = (status) => {
    if (status === 'Aktif') {
      return (
        <span className="badge-green">
          <FaCheckCircle /> Aktif
        </span>
      );
    }
    return (
      <span className="badge-red">
        <FaTimesCircle /> Non-Aktif
      </span>
    );
  };

  // Halper Functions Format Tanggal
  const formatDate = (dateString) => {
    if (!dateString) {
      return '-';
    }

    const date = new Date(dateString);
    // Format Tanggal: "Minggu, 25 Januari 2026"
    const datePart = date.toLocaleDateString('id-ID', {
      weekday: 'long', 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric'
    });
    // Format Jam: "16:17"
    const timePart = date.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).replace('.', ':');

    // Gabungkan: "Minggu, 25 Januari 2026 16:17 WITA"
    return `${datePart} ${timePart} WITA`;
  };

  // Render Loading 
  if (loading) return (
    <div className="app-content">
      <div className="main-container">
        <div className="loading-spinner-content">
          <div className="loading-spinner"></div>
          <span className="text-gray-500 ml-2">
            Memuat data...
          </span>
        </div>
      </div>
    </div>
  );

  if (!data) {
    return null;
  }

  // Destructure Data untuk kemudahan akses
  const { pakar_ahli } = data;

  return (
    <div className="main-container">
      {/* Alert Action */}
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
                {alert.type === 'success' ? 'Berhasil!' : alert.type === 'error' ? 'Terjadi Kesalahan' : 'Mohon Tunggu'}
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
            Detail Aturan Adat Bali</h2>
          <p className="text-gray-600 text-md">
            Detail aturan adat penentuan status peran adat bali.
          </p>
        </div>
        <div className="p-6 md:p-10 flex-1 flex flex-col">
          <div className="mb-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <p className="text-gray-500 text-base flex items-center gap-2">
                  <FaBook className="text-[#3A2000]" /> 
                  Kode Kondisi: 
                  <span className="font-mono font-bold text-gray-800 bg-gray-100 px-2 rounded">
                    {data.kode_kondisi}
                  </span>
                </p>
              </div>
              <div>
                {getStatusBadge(data.status_aturan)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* KOLOM KIRI (Detail Logika) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Card 1: Hasil Keputusan */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                  <FaGavel className="text-[#3A2000]" />
                  <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">
                    Hasil Keputusan
                  </h3>
                </div>
                <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-7">
                  {/* Status Peran Adat*/}
                  <div className="bg-[#f9f5f0] p-4 rounded-lg border border-[#e6dccf] hover:shadow-sm transition">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      Status Peran Adat
                    </p>
                    <p className="text-xl font-bold text-[#3A2000]">
                      {data.status_peran_adat}
                    </p>
                  </div>
                  {/* Garis Keturunan */}
                  <div className="bg-[#f9f5f0] p-4 rounded-lg border border-[#e6dccf] hover:shadow-sm transition">
                    <p className="text-xs text-gray-500 uppercase font-bold mb-1">
                      Garis Keturunan
                    </p>
                    <div className="flex items-center gap-2">
                      <p className="text-xl font-bold text-[#3A2000]">
                        {data.garis_keturunan}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              {/* Card 2: Dasar Keputusan */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
                <FaQuoteLeft className="text-gray-100 text-6xl absolute top-4 left-4 -z-0" />
                <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide mb-4 relative z-10 flex items-center gap-2">
                  Dasar Keputusan
                </h3>
                <div className="relative z-10">
                  <p className="text-gray-700 leading-relaxed text-lg font-serif italic pl-4 border-l-4 border-[#3A2000]">
                    "{data.dasar_keputusan}"
                  </p>
                </div>
              </div>
            </div>
            {/* KOLOM KANAN (Info Metadata & Pakar) */}
            <div className="space-y-6">
              {/* Info Pakar */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-[#3A2000] text-white flex items-center gap-2">
                  <FaUserTie />
                  <h3 className="text-sm font-bold uppercase tracking-wide">
                    Penyusun Aturan
                  </h3>
                </div>
                <div className="p-6 text-center">
                  <div className="w-20 h-20 mx-auto bg-gray-200 rounded-full mb-4 border-4 border-white shadow-md overflow-hidden">
                    <img src="/profile.png" alt="Pakar" className="w-full h-full object-cover" />
                  </div>
                  <h4 className="text-lg font-bold text-gray-800">
                    {pakar_ahli?.name || 'Sistem Admin'}
                  </h4>
                  <p className="text-sm text-gray-500 mb-4">
                    {pakar_ahli?.email || '-'}
                  </p>
                  <div className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 rounded text-xs font-semibold text-gray-600">
                    <FaIdCard /> {pakar_ahli?.role || 'Admin'}
                  </div>
                </div>
              </div>
              {/* Metadata Tanggal */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4">
                  Riwayat Perubahan
                </h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                      <FaCalendarAlt /> Dibuat pada
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {formatDate(data.createdAt)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mb-1">
                      <FaCalendarAlt /> Terakhir diupdate
                    </p>
                    <p className="text-sm font-semibold text-gray-700">
                      {formatDate(data.updatedAt)}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* BUTTON BACK */}
        <div className="mt-8 pt-6 flex items-center justify-center">
          <button className="btn-cencel" onClick={() => navigate('/aturan-adat')}>
            <FaArrowLeft /> Kembali
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PakarAturanAdatBaliDetail;