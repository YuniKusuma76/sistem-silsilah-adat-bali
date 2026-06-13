import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

const Kontak = ({user}) => {
  // State Form Data
  const [formData, setFormData] = useState({
    nama_pengirim: '',
    email_address: '',
    pesan: ''
  });

  // State Alert Global
  const [alert, setAlert] = useState({
    show: false,
    type: '', 
    message: ''
  });

  // Effect: Set Name dan Email ketika Login
  useEffect(() => {
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setFormData(prev => ({
        ...prev,
        nama_pengirim: user.name || '',
        email_address: user.email || ''
      }));
    }
  }, [user]);

  // Effect: Auto-Close Alert
  useEffect(() => {
    if (alert.show && (alert.type === 'success' || alert.type === 'error')) {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Handle Perubahan Input
  const handleChange = (e) => {
    const { 
      name, 
      value 
    } = e.target;

    setFormData(prev => ({ 
      ...prev, 
      [name]: value 
    }));
  };

  // Handle Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ 
      show: true, 
      type: 'loading', 
      message: 'Sedang mengirim pesan...' 
    });

    try {
      await axiosInstance.post('/kontak', formData);
      setFormData(prev => ({
        ...prev,
        pesan: '', 
        nama_pengirim: user ? prev.nama_pengirim : '',
        email_address: user ? prev.email_address : ''
      }));

      setAlert({
        show: true,
        type: 'success',
        message: 'Pesan berhasil dikirim!'
      });
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Gagal mengirim pesan.";
      setAlert({
        show: true,
        type: 'error',
        message: errorMessage
      });
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
      {/* Banner Kontak */}
      <div className="kontak-banner">
        <img src="/keluarga-bali.png" alt="Keluarga Bali" className="w-full h-full object-cover"/>
      </div>
      {/* Content Form Kontak */}
      <div className="kontak-content">
        <div className="w-full max-w-3xl text-center mb-8">
          <h2 className="kontak-header-h2">
            Hubungi Kami
          </h2>
          <div className="kontak-line"></div>
          <p className="text-gray-600 text-md mb-5">
            Informasi, kritik, dan saran Anda, silakan kirim melalui form di bawah ini
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-3xl space-y-6">
          {/* Input Nama Pengirim */}
          <div className="flex flex-col">
            <label className="font-bold text-black text-md">
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="nama_pengirim"
              value={formData.nama_pengirim}
              onChange={handleChange}
              disabled={!!user}
              placeholder="Masukkan nama Anda disini"
              className={`field-input ${user ? 'cursor-not-allowed opacity-80 bg-gray-100' : ''}`}
              required
            />
          </div>
          {/* Input Email Address */}
          <div className="flex flex-col">
            <label className="font-bold text-black text-md">
              E-mail Address <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              name="email_address"
              value={formData.email_address}
              onChange={handleChange}
              disabled={!!user}
              placeholder="Masukkan email Anda disini"
              className={`field-input ${user ? 'cursor-not-allowed opacity-80 bg-gray-100' : ''}`}
              required
            />
          </div>
          {/* Input Pesan */}
          <div className="flex flex-col">
            <label className="font-bold text-black text-md">
              Pesan Anda <span className="text-red-500">*</span>
            </label>
            <textarea
              name="pesan"
              value={formData.pesan}
              onChange={handleChange}
              rows="5"
              placeholder="Tulis pesan Anda disini"
              className="field-input resize-none"
              required
            ></textarea>
          </div>
          {/* Button Submit */}
          <div className="flex justify-center mt-8">
            <button 
              type="submit" 
              disabled={alert.type === 'loading'} 
              className={`kontak-button ${alert.type === 'loading' ? 'opacity-70 cursor-not-allowed' : ''}`}
            >
              {alert.type === 'loading' && (<span className="spinner-button"></span>)}
              {alert.type === 'loading' ? 'MENGIRIM...' : 'KIRIM'}
            </button>
          </div>
        </form>
      </div>
      <Footer />
    </div>
  );
};

export default Kontak;