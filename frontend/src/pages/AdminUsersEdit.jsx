import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  FaEye, 
  FaEyeSlash, 
  FaChevronDown, 
  FaTimes, 
  FaEdit 
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

const AdminUsersEdit = () => {
  // State Data
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("Viewer");
  const [statusAkun, setStatusAkun] = useState("Aktif");

  // State UI
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // State Navigasi
  const navigate = useNavigate();

  // State ID
  const { id: slug } = useParams();
  const realId = extractIdFromSlug(slug);

  // State Alert
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

  // Effect: Auto-Close Alert
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

  // Effect: Ambil Data Berdasarkan Slug
  useEffect(() => {
    const getUserById = async () => {
      // Jika decode gagal, redirect
      if (!realId) {
        navigate('/users');
        return;
      }

      try {
        const response = await axiosInstance.get(`/users/${realId}`);
        const data = response.data.data || response.data;
        
        setName(data.name);
        setEmail(data.email);
        setRole(data.role);
        setStatusAkun(data.status_akun);
      } catch (error) {
        console.log(error);
        setAlert({
          show: true,
          type: 'error',
          message: 'Gagal memuat data user.'
        });
        setTimeout(() => navigate('/users'), 2000);
      }
    };
    
    if (slug) {
      getUserById();
    }
  }, [slug, realId, navigate]);

  // Fungsi update data
  const updateUser = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Validasi password
      if (password && password !== confirmPassword) {
        throw new Error("Password tidak cocok!");
      }

      const payload = {
        name: name,
        email: email,
        role: role,
        status_akun: statusAkun
      };

      if (password) {
        payload.newPassword = password;       
        payload.confirmPassword = confirmPassword; 
      }

      await axiosInstance.patch(`/users/${realId}`, payload);

      navigate("/users", { 
        state: { 
          successMessage: 'Data user berhasil diupdate!' 
        } 
      });
    } catch (error) {
      console.log(error);
      const errorMessage = error.response?.data?.message || error.message || 'Gagal mengupdate data user.';
      setAlert({
        show: true,
        type: 'error',
        message: errorMessage
      });
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
      {/* Form Edit Data User */}
      <div className="p-8 flex-1 flex flex-col items-center">
        <div className="main-title w-full">
          <h2 className="main-title-h2">
            Mengedit Data User
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Memperbarui data user pada sistem silsilah Adat Bali
          </p>
        </div>
        {/* Form Container */}
        <div className="w-full max-w-2xl bg-white">
          <form onSubmit={updateUser} className="w-full max-w-3xl space-y-6">
            {/* name */}
            <div className="flex flex-col">
              <label className="font-bold text-black text-md">
                Name <span className="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                name="name"
                value={name}
                className="field-input"
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            {/* Email */}
            <div className="flex flex-col">
              <label className="font-bold text-black text-md">
                E-mail <span className="text-red-500">*</span>
              </label>
              <input 
                type="email" 
                name="email"
                value={email}
                className="field-input"
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {/* Password */}
            <div className="flex flex-col">
              <label className="font-bold text-black text-md">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type={showPassword ? "text" : "password"}
                  value={password}
                  className="field-input"
                  placeholder="******"
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="btn-eyes"
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <p className="text-xs text-gray-500 italic mt-1">
                *Biarkan field kosong jika tidak mengganti password
              </p>
            </div>
            {/* Confirm Password */}
            <div className="flex flex-col">
              <label className="font-bold text-black text-md">
                Confirm Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input 
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  className="field-input"
                  placeholder="******"
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button 
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="btn-eyes"
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <p className="text-xs text-gray-500 italic mt-1">
                *Biarkan field kosong jika tidak mengganti password
              </p>
            </div>

            <div className="flex flex-col">
              <label className="font-bold text-black text-md">
                Role <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  className="select-input"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                >
                  <option value="Viewer">Viewer</option>
                  <option value="Krama">Krama</option>
                  <option value="Pakar">Pakar</option>
                  <option value="Admin">Admin</option>
                </select>
                <div className="arrow-down">
                  <FaChevronDown />
                </div>
              </div>
            </div>
            {/* State Akun */}
            <div className="flex flex-col">
              <label className="font-bold text-black text-md">
                Status Akun <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select 
                  className="select-input"
                  value={statusAkun}
                  onChange={(e) => setStatusAkun(e.target.value)}
                >
                  <option value="Aktif">Aktif</option>
                  <option value="Non-Aktif">Non-Aktif</option>
                </select>
                <div className="arrow-down">
                  <FaChevronDown />
                </div>
              </div>
            </div>
            {/* Action Buttons */}
            <div className="flex justify-center gap-6 mt-10 pt-4">
              <button 
                type="button" 
                onClick={() => navigate("/users")} 
                className="btn-cencel"
              >
                <FaTimes />
                <span>Cancel</span>
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className={`btn-update ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {isLoading ? (
                  <div className="loading-button"></div>
                ) : (
                  <>
                    <FaEdit />
                    <span>Update</span>
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

export default AdminUsersEdit;