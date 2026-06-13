import React, { useState, useEffect, useRef } from 'react';
import { IoMdClose } from 'react-icons/io';
import { 
  FaUser, 
  FaEnvelope, 
  FaLock, 
  FaEye, 
  FaEyeSlash,
  FaMapMarkerAlt
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import styles from './Register.module.css';

const Register = ({ onClose, onSwitchLogin }) => {
  const dropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [daftarDesaAdat, setDaftarDesaAdat] = useState([]);

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    desa_adat_id: '',
    password: '',
    confirmPassword: ''
  });

  const [infoWilayah, setInfoWilayah] = useState({
    kecamatan: '',
    kabupaten: '',
    provinsi: ''
  });

  // Effect: Mengambil data master desa adat
  useEffect(() => {
    const fetchDesaAdat = async () => {
      try {
        const response = await axiosInstance.get(`/desa-adat`);
        const data = response.data?.data || response.data || [];
        setDaftarDesaAdat(data);
      } catch (error) {
        console.error("Gagal memuat data desa adat:", error);
      }
    };
    fetchDesaAdat();
  }, []);

  // Effect: Menutup dropdown otomatis ketika klik di luar area input desa adat
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Effect: Mencegah melakukan scroll ketika modal tampil
  useEffect(() => {
    document.body.classList.add("no-scroll");
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, []);

  // Filter data desa berdasarkan ketikan user
  const desaFiltered = searchTerm.trim() === "" ? daftarDesaAdat : daftarDesaAdat.filter((desa) => {
    const namaDesa = (desa.nama_desa_adat || desa.nama_desa || desa.nama || '').toLowerCase();
    return namaDesa.includes(searchTerm.toLowerCase());
  });

  // Helper: Mengatasi perubahan form input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Helper: Memilih desa dari list dropdown
  const handleSelectDesa = async (desa) => {
    const namaTerpilih = desa.nama_desa_adat || desa.nama_desa || desa.nama;
    setSearchTerm(namaTerpilih);
    setShowDropdown(false);
    
    setFormData((prev) => ({ 
      ...prev, 
      desa_adat_id: desa.id 
    }));

    setInfoWilayah({
      kecamatan: 'Memuat...',
      kabupaten: 'Memuat...',
      provinsi: 'Memuat...'
    });

    try {
      const resKec = await axiosInstance.get(`/kecamatan/${desa.kecamatan_id}`);
      const dataKec = resKec.data?.data || resKec.data;

      if (!dataKec?.kabupaten_id) {
        throw new Error("ID Kabupaten tidak ditemukan");
      }

      const resKab = await axiosInstance.get(`/kabupaten/${dataKec.kabupaten_id}`);
      const dataKab = resKab.data?.data || resKab.data;

      if (!dataKab?.provinsi_id) {
        throw new Error("ID Provinsi tidak ditemukan");
      }

      const resProv = await axiosInstance.get(`/provinsi/${dataKab.provinsi_id}`);
      const dataProv = resProv.data?.data || resProv.data;

      setInfoWilayah({
        kecamatan: dataKec.nama_kecamatan || '-',
        kabupaten: dataKab.nama_kabupaten || '-',
        provinsi: dataProv.nama_provinsi || '-'
      });
    } catch (error) {
      console.error("Gagal melakukan auto-fill wilayah:", error);
      setInfoWilayah({
        kecamatan: 'Gagal memuat',
        kabupaten: 'Gagal memuat',
        provinsi: 'Gagal memuat'
      });
    }
  };

  // Effect: Pesan error hilang otomatis saat user mulai memperbaiki input
  useEffect(() => {
    if (message && messageType === 'error') {
      setMessage('');
      setMessageType('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData, termsAccepted, searchTerm]); 

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  // SUBMIT DATA
  const submitRegister = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setMessageType('');

    // Validasi terms & conditions
    if (!termsAccepted) {
      setIsLoading(false);
      setMessage("Anda harus menyetujui syarat dan ketentuan aplikasi.");
      setMessageType('error');
      return;
    }
    // Validasi wilayah adat
    if (!formData.desa_adat_id) {
      setIsLoading(false);
      setMessage("Silakan pilih desa adat asal Anda.");
      setMessageType('error');
      return;
    }
    // Validasi Panjang Password
    if (formData.password.length < 6) {
      setIsLoading(false);
      setMessage("Password minimal harus 6 karakter!");
      setMessageType('error');
      return;
    }
    // Validasi Password Match
    if (formData.password !== formData.confirmPassword) {
      setIsLoading(false);
      setMessage("Password dan konfirmasi password tidak cocok!");
      setMessageType('error');
      return;
    }

    try {
      const response = await axiosInstance.post(`/register`, {
        full_name: formData.full_name,
        email: formData.email,
        desa_adat_id: parseInt(formData.desa_adat_id),
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });

      setMessage(response.data.message);
      setMessageType('success');

      setTimeout(() => {
        onSwitchLogin();
      }, 2000);
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("Terjadi kesalahan pada server.");
      }
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={!isLoading ? onClose : undefined}>
      <div className={`${styles.cardRegister} animate-fade-in`} onClick={handleCardClick}>
        <button 
          onClick={!isLoading ? onClose : undefined} 
          className={`${styles.xButton} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          aria-label="Close Modal"
          disabled={isLoading}
        >
          <IoMdClose size={24} className="hover:rotate-90 transition-transform duration-300" />
        </button>

        <div className={styles.logoContainer}>
          <div className="w-48 h-48 md:w-80 md:h-80 relative">
            <img src="/logo.webp" alt="Sistem Silsilah Adat Bali" className="w-full h-full object-contain" />
          </div>
        </div>

        <div className={styles.inputRegister}>
          <form className="w-full flex flex-col mt-5" onSubmit={submitRegister}>
            {/* Full Name Input */}
            <div className={styles.inputGroup}>
              <div className={styles.iconWrapper}>
                <FaUser size={20} />
              </div>
              <input 
                type="text" 
                name="full_name"
                value={formData.full_name} 
                onChange={handleChange}
                placeholder="Nama Lengkap" 
                className={`${styles.authInput} disabled:opacity-50`} 
                autoComplete="name"
                disabled={isLoading}
                required
              />
            </div>
            {/* Email Input */}
            <div className={styles.inputGroup}>
              <div className={styles.iconWrapper}>
                <FaEnvelope size={20} />
              </div>
              <input 
                type="email" 
                name="email"
                value={formData.email} 
                onChange={handleChange}
                placeholder="E-mail" 
                className={`${styles.authInput} disabled:opacity-50`} 
                autoComplete="email"
                disabled={isLoading}
                required
              />
            </div>
            {/* Dropdown Desa Adat */}
            <div className={`${styles.inputGroup} relative`} ref={dropdownRef}>
              <div className={styles.iconWrapper}>
                <FaMapMarkerAlt size={20} />
              </div>
              <input
                type="text"
                placeholder="Desa Adat"
                value={searchTerm}
                onFocus={() => setShowDropdown(true)}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setFormData(prev => ({ ...prev, desa_adat_id: '' }));
                  setInfoWilayah({ kecamatan: '', kabupaten: '', provinsi: '' });
                  setShowDropdown(true);
                }}
                className={`${styles.authInput} disabled:opacity-50`}
                disabled={isLoading}
                required
              />
              {/* Panel Hasil Dropdown Autocomplete */}
              {showDropdown && (
                <div className={styles.dropdownPanel}>
                  {desaFiltered.length > 0 ? (
                    desaFiltered.map((desa) => (
                      <button
                        key={desa.id}
                        type="button"
                        onClick={() => handleSelectDesa(desa)}
                        className={styles.dropdownInput}
                      >
                        {desa.nama_desa_adat || desa.nama_desa || desa.nama}
                      </button>
                    ))
                  ) : (
                    <div className={styles.dropdownWarn}>
                      {searchTerm.length > 0 ? "Desa adat tidak ditemukan" : "Memuat data..."}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Grid Auto-Fill Wilayah */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div>
                <label className={styles.labelGrid}>
                  Kecamatan
                </label>
                <input 
                  type="text" 
                  value={infoWilayah.kecamatan} 
                  placeholder="-" 
                  className={styles.inputGrid} 
                  disabled 
                />
              </div>
              <div>
                <label className={styles.labelGrid}>
                  Kabupaten
                </label>
                <input 
                  type="text" 
                  value={infoWilayah.kabupaten} 
                  placeholder="-" 
                  className={styles.inputGrid} 
                  disabled 
                />
              </div>
              <div>
                <label className={styles.labelGrid}>
                  Provinsi
                </label>
                <input 
                  type="text" 
                  value={infoWilayah.provinsi} 
                  placeholder="-" 
                  className={styles.inputGrid} 
                  disabled 
                />
              </div>
            </div>
            {/* Password Input */}
            <div className={`${styles.inputGroup} relative`}>
              <div className={styles.iconWrapper}>
                <FaLock size={20} />
              </div>
              <input 
                type={showPassword ? "text" : "password"} 
                name="password"
                value={formData.password} 
                onChange={handleChange}
                placeholder="Password" 
                className={`${styles.authInput} disabled:opacity-50 pr-10`} 
                disabled={isLoading}
                required
              />
              <button 
                type="button" 
                className={styles.eyePassword} 
                disabled={isLoading} 
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>

            <div className={`${styles.inputGroup} relative`}>
              <div className={styles.iconWrapper}>
                <FaLock size={20} />
              </div>
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                name="confirmPassword"
                value={formData.confirmPassword} 
                onChange={handleChange}
                placeholder="Konfirmasi Password" 
                className={`${styles.authInput} disabled:opacity-50 pr-10`} 
                disabled={isLoading}
                required
              />
              <button 
                type="button" 
                className={styles.eyePassword} 
                disabled={isLoading} 
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              >
                {showConfirmPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
              </button>
            </div>
            {/* Term Checkbox */}
            <div className={styles.termsContainer}>
              <input 
                type="checkbox" 
                id="terms" 
                className={styles.termsInput} 
                checked={termsAccepted} 
                onChange={(e) => setTermsAccepted(e.target.checked)}
                disabled={isLoading}
              />
              <label htmlFor="terms" className={styles.checkTerms}>
                Saya Setuju Syarat & Ketentuan Aplikasi
              </label>
            </div>
            {/* Message Display */}
            {message && (
              <div className={`p-2 text-xs mb-3 text-center font-bold ${messageType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
                {message}
              </div>
            )}
            {/* Set Button Register */}
            <button 
              type="submit" 
              disabled={isLoading} 
              className={`${styles.btnRegister} ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
            >
              {isLoading ? (
                <>
                  <span className={styles.spinner}></span>
                  MEMPROSES...
                </>
              ) : "CREATE ACCOUNT"}
            </button>
            <div className="mt-4 text-center text-white text-xs pb-2">
              <span>Sudah punya akun? </span>
              <button 
                type="button" 
                onClick={!isLoading ? onSwitchLogin : undefined} 
                className={styles.switchModal}
                disabled={isLoading}
              >
                Login Here
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Register;