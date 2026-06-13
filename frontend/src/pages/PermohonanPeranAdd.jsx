import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaSave, 
  FaUpload, 
  FaCheckCircle, 
  FaChevronDown,
  FaCheck
} from 'react-icons/fa';
import { IoIosSend } from "react-icons/io";
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// Data Static Checklist
const SYARAT_CHECKLIST = {
  Pakar: [
    'Memahami aturan Adat Bali',
    'Memiliki pengalaman atau keterlibatan dalam adat',
    'Bersedia memvalidasi data secara objektif'
  ],
  Krama: [
    'Terdaftar dalam silsilah keluarga adat',
    'Bertanggung jawab atas kebenaran data keluarga',
    'Menyetujui aturan penggunaan sistem'
  ]
};

const PermohonanPeranAdd = () => {
  // State Data
  const [roleDiajukan, setRoleDiajukan] = useState('');
  const [alasan, setAlasan] = useState('');
  const [fileDokumen, setFileDokumen] = useState(null);
  const [checkedItems, setCheckedItems] = useState({});

  // State UI
  const [isLoading, setIsLoading] = useState(false);
  const [previewFileName, setPreviewFileName] = useState('');

  // State Navigasi
  const navigate = useNavigate();

  // State Alert Global
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

  // Effect: Auto-Close Alert Global
  useEffect(() => {
    if (alert.show && (alert.type === 'success' || alert.type === 'error')) {
      const timer = setTimeout(() => {
        setAlert(prev => ({ 
          ...prev, 
          show: false 
        }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Handle Perubahan Role Pengguna
  const handleRoleChange = (e) => {
    const selectedRole = e.target.value;
    setRoleDiajukan(selectedRole);
    setCheckedItems({});
  };

  // Handle Centang Checklist
  const handleCheckboxChange = (item) => {
    setCheckedItems(prev => ({
      ...prev,
      [item]: !prev[item]
    }));
  };

  // Handle File Upload
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validasi ukuran (Max 5MB)
      if (file.size > 5 * 1024 * 1024) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Ukuran file terlalu besar! Maksimal 5MB.' 
        });
        window.scrollTo(0, 0);
        return;
      }
      setFileDokumen(file);
      setPreviewFileName(file.name);
    }
  };

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    // Validasi role
    if (!roleDiajukan) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Silakan pilih role yang diajukan!' 
      });
      window.scrollTo(0, 0);
      return;
    }
    // Validasi Checklist
    const syaratSaatIni = SYARAT_CHECKLIST[roleDiajukan];
    const jumlahDicentang = syaratSaatIni.filter(item => checkedItems[item]).length;
    if (jumlahDicentang !== syaratSaatIni.length) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Anda harus menyetujui semua kriteria checklist!' });
      window.scrollTo(0, 0);
      return;
    }
    // Validasi alasan
    if (!alasan.trim()) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Alasan permohonan wajib diisi!' 
      });
      window.scrollTo(0, 0);
      return;
    }
    // Validasi Dokumen
    if (!fileDokumen) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Dokumen pendukung wajib diunggah!' 
      });
      window.scrollTo(0, 0);
      return;
    }

    const formData = new FormData();
    formData.append('role_diajukan', roleDiajukan);
    formData.append('alasan_permohonan', alasan);
    
    // Kirim checklist sebagai JSON String
    const checklistArray = syaratSaatIni.filter(item => checkedItems[item]);
    formData.append('checklist', JSON.stringify(checklistArray));

    if (fileDokumen) {
      formData.append('dokumen_pendukung', fileDokumen);
    }

    setIsLoading(true);

    try {
      await axiosInstance.post('/permohonan-peran', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      navigate('/permohonan-peran/riwayat', { 
        state: { 
          successMessage: 'Permohonan berhasil diajukan! Harap tunggu verifikasi Admin.' 
        } 
      });
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || 'Terjadi kesalahan pada server.';
      setAlert({ 
        show: true, 
        type: 'error', 
        message: errorMessage 
      });
      window.scrollTo(0, 0);
    } finally {
      setIsLoading(false);
    }
  };

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
      {/* Form Permohonan*/}
      <div className="p-8 flex-1">
        <div className="permohonan-title">
          <h2 className="main-title-h2">
            Pengajuan Permohonan Peran
          </h2>
          <p className="text-gray-600 text-md">
            Lengkapi formulir di bawah ini untuk mengajukan perubahan hak akses akun Anda
          </p>
        </div>
      </div>
      {/* Form Permohonan */}
      <div className="px-8 pb-12 flex-1">
        <div className="card-permohonan">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Input Role */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Role yang Diajukan <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  className="select-input"
                  value={roleDiajukan}
                  onChange={handleRoleChange}
                  disabled={isLoading}>
                  <option value="">-- Pilih Role --</option>
                  <option value="Krama">Krama (Warga Adat)</option>
                  <option value="Pakar">Pakar (Ahli Adat)</option>
                </select>
                <div className="arrow-down">
                  <FaChevronDown />
                </div>
              </div>
              <p className="text-detail-p mt-1">
                * Pilih peran yang sesuai dengan kapasitas Anda dalam sistem.
              </p>
            </div>
            {/* Checklist Syarat */}
            {roleDiajukan && (
              <div className="role-checklist">
                <h4 className="title-checklist">
                  <FaCheckCircle /> Syarat & Ketentuan {roleDiajukan}
                </h4>
                <div className="space-y-3">
                  {SYARAT_CHECKLIST[roleDiajukan].map((item, index) => (
                    <label key={index} className="flex items-start cursor-pointer group">
                      <div className="relative flex items-center">
                        <input
                          type="checkbox"
                          className=" peer checklist-input"
                          checked={!!checkedItems[item]}
                          onChange={() => handleCheckboxChange(item)}
                        />
                        <FaCheck className="check" />
                      </div>
                      <span className="text-checklist">
                        {item}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {/* Input Alasan */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Alasan Permohonan <span className="text-red-500">*</span>
              </label>
              <textarea 
                className="field-input min-h-[120px]"
                placeholder="Tulis alasan Anda disini"
                value={alasan}
                onChange={(e) => setAlasan(e.target.value)}
                disabled={isLoading}
              ></textarea>
              <p className="text-detail-p">
                * Jelaskan mengapa Anda mengajukan peran ini.
              </p>
            </div>
            {/* Input Dokumen */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">
                Dokumen Pendukung <span className="text-red-500">*</span>
              </label>
              <div className="card-input-docs">
                <div className="space-y-1 text-center">
                  {previewFileName ? (
                    <div className="flex flex-col items-center animate-fade-in">
                      <div className="icon-success">
                        <FaCheckCircle size={24} />
                      </div>
                      <p className="text-sm text-gray-700 font-medium">
                        {previewFileName}
                      </p>
                      <button 
                        type="button" 
                        onClick={() => { setFileDokumen(null); setPreviewFileName(''); }}
                        className="btn-hapus-docs">
                        Hapus File
                      </button>
                    </div>
                  ) : (
                    <>
                      <FaUpload className="mx-auto h-8 w-8 text-gray-400 mb-5" />
                      <div className="flex text-sm text-gray-600 justify-center">
                        <label htmlFor="file-upload" className="label-input">
                          <span>Upload file</span>
                          <input 
                            id="file-upload" 
                            name="file-upload" 
                            type="file" 
                            className="sr-only" 
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
                        PNG, JPG, PDF, Max 5MB
                      </p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {/* Button Actions */}
            <div className="flex items-center justify-center gap-4 pt-4 mt-6">
              <button 
                type="button" 
                onClick={() => navigate('/permohonan-peran/riwayat')}
                className="btn-cencel" 
                disabled={isLoading}
              >
                <FaArrowLeft /> Cencel
              </button>
              <button 
                type="submit" 
                className="btn-submit" 
                disabled={isLoading}>
                {isLoading ? (
                  <>
                    <div className="upload-proses"></div>
                    <span>Submiting...</span>
                  </>
                ) : (
                  <>
                    <FaSave /> Submit
                  </>
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

export default PermohonanPeranAdd;