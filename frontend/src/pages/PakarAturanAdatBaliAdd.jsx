import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaSave,
  FaChevronDown
} from 'react-icons/fa';
import axios from 'axios';
import Footer from '../components/Footer/Footer';

const PakarAturanAdatBaliAdd = () => {
  // State Form Data
  const [formData, setFormData] = useState({
    kode_kondisi: '',
    status_peran_adat: '',
    garis_keturunan: '',
    dasar_keputusan: '',
    status_aturan: 'Aktif'
  });

  // State UI
  const [isLoading, setIsLoading] = useState(false);

  // State Navigasi
  const navigate = useNavigate();

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

  // Handler Perubahan Input
  const handleChange = (e) => {
    const { 
      name, 
      value 
    } = e.target;
    // Auto Uppercase untuk Kode Kondisi
    if (name === 'kode_kondisi') {
      const formatted = value.toUpperCase().replace(/\s+/g, '_');
      setFormData(prev => ({ 
        ...prev, 
        [name]: formatted 
      }));
    } else {
      setFormData(prev => ({ 
        ...prev, 
        [name]: value 
      }));
    }
  };

  // Handler Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validasi
    if (!formData.kode_kondisi || !formData.status_peran_adat || !formData.garis_keturunan || !formData.dasar_keputusan) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Semua kolom wajib diisi!' 
      });
      window.scrollTo(0,0);
      return;
    }

    setIsLoading(true);

    try {
      await axios.post('http://localhost:8080/api/aturan', formData, { 
        withCredentials: true 
      });

      navigate('/aturan-adat', { 
        state: { 
          successMessage: 'Aturan Adat Bali berhasil ditambahkan!' 
        } 
      });
    } catch (error) {
      setAlert({ 
        show: true,
        type: 'error', 
        message: error.response?.data?.message || "Gagal menyimpan data aturan adat bali." 
      });
      window.scrollTo(0,0);
    } finally {
      setIsLoading(false);
    }
  };

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
            Menambahkan Aturan Adat Bali
          </h2>
          <p className="text-gray-600 text-md">
            Definisikan kondisi dan hasil keputusan aturan penentuan status peran adat bali.
          </p>
        </div>
      </div>
      {/* Form Add Aturan */}
      <div className="px-8 pb-12 flex-1">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 max-w-4xl mx-auto">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Kode Kondisi */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Kode Kondisi <span className="text-red-500">*</span>
              </label>
              <input 
                type="text"
                name="kode_kondisi"
                value={formData.kode_kondisi}
                onChange={handleChange}
                disabled={isLoading}
                className="field-input font-mono"
                placeholder="CONTOH: KAWIN_NYENTANA_SUAMI"
              />
              <p className="text-xs text-gray-400 mt-1">
                * Format: HURUF_BESAR_DENGAN_UNDERSCORE. Harus unik.
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Status Peran Adat */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Status Peran Adat <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select 
                    name="status_peran_adat"
                    value={formData.status_peran_adat}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="select-input"
                  >
                    <option value="">-- Pilih Status Peran Adat --</option>
                    <option value="Purusa">Purusa</option>
                    <option value="Predana">Predana</option>
                    <option value="Tidak Memiliki Status Peran Adat">Tidak Memiliki Status Peran Adat</option>
                  </select>
                  <FaChevronDown className="arrow-down" />
                </div>
              </div>
              {/* Garis Keturunan */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Garis Keturunan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select 
                    name="garis_keturunan"
                    value={formData.garis_keturunan}
                    onChange={handleChange}
                    disabled={isLoading}
                    className="select-input"
                  >
                    <option value="">-- Pilih Garis Keturunan --</option>
                    <option value="Purusa">Purusa</option>
                    <option value="Purusa Nyentana">Purusa Nyentana</option>
                    <option value="Purusa Pade Gelahang">Purusa Pade Gelahang</option>
                    <option value="Predana">Predana</option>
                    <option value="Tidak Memiliki Garis Keturunan">Tidak Memiliki Garis Keturunan</option>
                  </select>
                  <FaChevronDown className="arrow-down" />
                </div>
              </div>
            </div>
            {/* Dasar Keputusan */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Dasar Keputusan <span className="text-red-500">*</span>
              </label>
              <textarea 
                name="dasar_keputusan"
                value={formData.dasar_keputusan}
                onChange={handleChange}
                disabled={isLoading}
                className="field-input min-h-[120px]"
                placeholder="Jelaskan alasan logis mengapa status ini diberikan"
              ></textarea>
            </div>
            {/* Tombol Aksi */}
            <div className="flex items-center justify-center gap-4 pt-4 mt-6">
              <button 
                type="button" 
                onClick={() => navigate('/aturan-adat')}
                className="btn-cencel"
                disabled={isLoading}>
                <FaArrowLeft /> Batal
              </button>
              <button type="submit" className="btn-submit" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="upload-proses"></div>
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <> <FaSave /> Simpan </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default PakarAturanAdatBaliAdd;