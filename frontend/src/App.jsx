import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import axiosInstance from './api/axiosInstance.js';
import Home from './pages/Home/Home.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
import AturanAdatBali from './pages/AturanAdatBali/AturanAdatBali.jsx';
import AturanAdatBaliBaru from './pages/AturanAdatBali/AturanAdatBaliBaru.jsx';
import AturanAdatBaliDetail from './pages/AturanAdatBali/AturanAdatBaliDetail.jsx';
import AturanAdatBaliEdit from './pages/AturanAdatBali/AturanAdatBaliEdit.jsx';
import WilayahAdatBali from './pages/WilayahAdatBali/WilayahAdatBali.jsx';
import User from './pages/User/User.jsx';
import UserDetail from './pages/User/UserDetail.jsx';
import Profile from './components/Profile/Profile.jsx';
import Login from './auth/Login/Login.jsx';
import Register from './auth/Register/Register.jsx';
import KontakPesan from './pages/PusatBantuan/KontakPesan.jsx';
import DaftarPesanMasuk from './pages/PusatBantuan/DaftarPesanMasuk.jsx';
import PengajuanRole from './pages/VerifikasiData/PengajuanRole.jsx';
import PengajuanRolePersonal from './pages/Pengajuan/PengajuanRolePersonal.jsx';
import PengajuanRoleBaru from './pages/Pengajuan/PengajuanRoleBaru.jsx';
import PengajuanRoleDetail from './pages/Pengajuan/PengajuanRoleDetail.jsx';
import PengajuanDesa from './pages/VerifikasiData/PengajuanDesa.jsx';
import PengajuanDesaPersonal from './pages/Pengajuan/PengajuanDesaPersonal.jsx';
import PengajuanDesaBaru from './pages/Pengajuan/PengajuanDesaBaru.jsx';
import PengajuanDesaDetail from './pages/Pengajuan/PengajuanDesaDetail.jsx';
import VerifikasiData from './pages/VerifikasiData/VerifikasiData.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';



import PengajuanKrama from './pages/VerifikasiData/PengajuanKrama.jsx';
import PengajuanRelasi from './pages/VerifikasiData/PengajuanRelasi.jsx';
import PengajuanPerkawinan from './pages/VerifikasiData/PengajuanPerkawinan.jsx';
import VerifikasiDataDetail from './pages/VerifikasiData/VerifikasiDataDetail.jsx';
import TrehBali from './pages/TrehBali/TrehBali.jsx';
import TrehPuncak from './pages/TrehBali/TrehPuncak.jsx';
import DataKramaBali from './pages/KramaBali/DataKramaBali.jsx';
import DataKramaPersonal from './pages/KramaBali/DataKramaPersonal.jsx';
import DataKramaBaru from './pages/KramaBali/DataKramaBaru.jsx';
import SilsilahBali from './pages/TrehBali/SilsilahBali.jsx';
import DataKramaEditKrama from './pages/KramaBali/DataKramaEditKrama.jsx';
import DataKramaTambahRelasi from './pages/KramaBali/DataKramaTambahRelasi.jsx';
import DataKramaEditRelasi from './pages/KramaBali/DataKramaEditRelasi.jsx';
import DataKramaTambahKawin from './pages/KramaBali/DataKramaTambahKawin.jsx';
import DataKramaEditKawin from './pages/KramaBali/DataKramaEditKawin.jsx';
import DataKramaPerceraian from './pages/KramaBali/DataKramaPerceraian.jsx';
import DataKramaDetail from './pages/KramaBali/DataKramaDetail.jsx';

// Helper: middleware hak akses route
const ProtectedRoute = ({ user, allowedRoles, children }) => {
  if (!user) {
    return <Navigate to="/home" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/home" replace />;
  }
  return children;
};

const App = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [user, setUser] = useState(null);

  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });
  
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: melihat status login awal
  const checkLoginStatus = async () => {
    try {
      const response = await axiosInstance.get('/refresh-token');
      setUser(response.data.user);
    } catch (error) {
      console.log(error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkLoginStatus();
  }, []);

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    setAlert({
      show: true,
      type: 'success',
      message: `Selamat datang kembali, ${userData.display_name}!`
    });
  };

  const handleLogout = async () => {
    try {
      await axiosInstance.post('/logout');
      setUser(null); 
      navigate('/');
      setAlert({
        show: true,
        type: 'success',
        message: 'Anda behasil logout dari sistem.'
      });
    } catch (error) {
      console.log(error);
      setUser(null);
      setAlert({
        show: true,
        type: 'error',
        message: 'Server Error! Gagal melakukan logout, sesi dibersihkan.'
      });
    }
  };

  if (isLoading) {
    return (
      <div className="loading-container">
        <div className="loading-content">
          <div className="spinner-actios"></div>
          <span className="blok-text">
            Memuat Sistem Silsilah Adat Bali...
          </span>
        </div>
      </div>
    );
  }

  const isManagement = ['Super Admin', 'Admin Desa'].includes(user?.role);
  const isSuperAdmin = user?.role === 'Super Admin';

  return (
    <div className="app-container">
      {/* Alert Section */}
      {alert.show && (
        <div className={`alert-section
          ${alert.type === 'success' ? 'border-green-500 bg-green-50' 
            : alert.type === 'error' ? 'border-red-500 bg-red-50'
            : alert.type === 'warning' ? 'border-amber-500 bg-amber-50' 
            : 'border-blue-500 bg-blue-50'}`
          }>
          <div className="flex items-start p-4">
            {/* Icon */}
            <div className="flex-shrink-0 mr-3 text-2xl">
              {alert.type === 'success' && '✅'}
              {alert.type === 'error' && '❌'}
              {alert.type === 'warning' && '⚠️'}
              {alert.type === 'loading' && '⏳'}
            </div>
            {/* Content */}
            <div className="flex-1">
              <h4 className={`font-bold text-sm 
                ${alert.type === 'success' ? 'text-green-800' 
                  : alert.type === 'error' ? 'text-red-800' 
                  : alert.type === 'warning' ? 'text-amber-800'
                  : 'text-blue-800'}`
                }>
                {alert.type === 'success' ? 'Berhasil!' 
                  : alert.type === 'error' ? 'Terjadi Kesalahan!' 
                  : alert.type === 'warning' ? 'Perhatian Adat!'
                  : 'Mohon Tunggu...'
                }
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
          {/* Progress Bar Line */}
          {(alert.type === 'success' || alert.type === 'error' || alert.type === 'warning') && (
            <div className="h-1.5 w-full bg-gray-200">
              <div className={`h-full animate-shrink ${
                alert.type === 'success' ? 'bg-green-500' : 
                alert.type === 'error' ? 'bg-red-500' : 'bg-amber-500'
                }`
              }></div>
            </div>
          )}
        </div>
      )}
      {/* Sidebar Section */}
      <Sidebar 
        user={user}
        isManagement={isManagement}
        isSuperAdmin={isSuperAdmin}
        onLoginClick={() => setShowLogin(true)}
        onRegisterClick={() => setShowRegister(true)}
        onLogout={handleLogout}
      />
      {/* Pages Sidebar Layout */}
      <div className="flex-1 relative">
        <Routes>
          {/* Public Routes */}
          <Route 
            path="/" 
            element={<Navigate to="/home" replace />}
          />
          <Route 
            path="/home" 
            element={<Home />} 
          />
          <Route 
            path="/treh-bali/:id?" 
            element={<TrehBali />}
          />
          {/* Conditional Routes */}
          <Route 
            path="/profile" 
            element={<Profile user={user} />}
          />
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <Dashboard user={user} />
              </ProtectedRoute>
            } 
          />
          {/* Aturan Adat Bali Routes */}
          <Route path="/aturan-adat-bali">
            <Route index element={ <AturanAdatBali user={user} /> } />
            <Route 
              path="detail/:id" 
              element={<AturanAdatBaliDetail user={user} />} 
            />
            <Route 
              path="add" 
              element={
                <ProtectedRoute user={user} allowedRoles={['Pakar', 'Super Admin']}>
                  <AturanAdatBaliBaru user={user} />
                </ProtectedRoute>
              } 
            />
            <Route 
              path="detail/edit/:id" 
              element={
                <ProtectedRoute user={user} allowedRoles={['Pakar', 'Super Admin']}>
                  <AturanAdatBaliEdit user={user} />
                </ProtectedRoute>
              } 
            />
          </Route>
          {/* Wilayah Adat Bali Routes */}
          <Route path="/wilayah-adat-bali">
            <Route index element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin','Admin Desa']}>
                <WilayahAdatBali user={user} />
              </ProtectedRoute>
            } />
          </Route>
          {/* User Route */}
          <Route path="/user-pengguna">
            <Route index element={
              <ProtectedRoute user={user} allowedRoles={['Admin Desa', 'Super Admin']}>
                <User user={user} />
              </ProtectedRoute>
            } />
            <Route 
              path="detail/:slug" 
              element={<UserDetail user={user} />} 
            />
          </Route>
          {/* Kontak Pesan Route */}
          <Route 
            path="/pusat-bantuan" 
            element={<KontakPesan user={user} />}
          />
          <Route 
            path="/pesan-masuk/pusat-bantuan" 
            element={<KontakPesan user={user} />}
          />
          <Route 
            path="/pesan-masuk" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <DaftarPesanMasuk user={user} />
              </ProtectedRoute>
            } 
          />
          {/* Pengajuan Role Routes */}
          <Route 
            path="/pengajuan-role/my-data" 
            element={<PengajuanRolePersonal user={user} />} 
          />
          <Route 
            path="/pengajuan-role/my-data/add" 
            element={<PengajuanRoleBaru user={user} />} 
          />
          <Route 
            path="/pengajuan-role/my-data/detail/:id" 
            element={<PengajuanRoleDetail user={user} />} 
          />
          <Route 
            path="/verifikasi-data/pengajuan-role" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin']}>
                <PengajuanRole user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/pengajuan-role/detail/:id" 
            element={<PengajuanRoleDetail user={user} />} 
          />
          {/* Pengajuan Desa Adat Routes */}
          <Route 
            path="/pengajuan-desa-adat/my-data" 
            element={<PengajuanDesaPersonal user={user} />} 
          />
          <Route 
            path="/pengajuan-desa-adat/my-data/add" 
            element={<PengajuanDesaBaru user={user} />} 
          />
          <Route 
            path="/pengajuan-desa-adat/my-data/detail/:id" 
            element={<PengajuanDesaDetail user={user} />} 
          />
          <Route 
            path="/verifikasi-data/pengajuan-desa-adat" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <PengajuanDesa user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/pengajuan-desa-adat/detail/:id" 
            element={<PengajuanDesaDetail user={user} />} 
          />
          {/* Krama Bali Routes */}
          <Route 
            path="/krama-bali" 
            element={<DataKramaBali user={user} />} 
          />
          <Route 
            path="/krama-bali/treh-puncak/:id?" 
            element={<TrehPuncak user={user} />} 
          />
          <Route 
            path="/krama-bali/my-data" 
            element={<DataKramaPersonal user={user} />} 
          />
          <Route 
            path="/krama-bali/my-data/add" 
            element={<DataKramaBaru user={user} />} 
          />
          <Route 
            path="/krama-bali/my-data/detail/:id" 
            element={<DataKramaDetail user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/:id" 
            element={<DataKramaDetail user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/silsilah/:id" 
            element={<SilsilahBali user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/my-data/edit-krama/:id" 
            element={<DataKramaEditKrama user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/my-data/add-relasi/:id" 
            element={<DataKramaTambahRelasi user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/my-data/edit-relasi/:id" 
            element={<DataKramaEditRelasi user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/add-perkawinan/:id" 
            element={<DataKramaTambahKawin user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/my-data/edit-perkawinan/:id" 
            element={<DataKramaEditKawin user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/my-data/perceraian/:id" 
            element={<DataKramaPerceraian user={user} />} 
          />
          <Route 
            path="/verifikasi-data/krama-bali" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <PengajuanKrama user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/krama-bali/detail/:id" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <VerifikasiDataDetail user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/relasi-krama" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <PengajuanRelasi user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/relasi-krama/detail/:id" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <VerifikasiDataDetail user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/perkawinan" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <PengajuanPerkawinan user={user} />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/verifikasi-data/perkawinan/detail/:id" 
            element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}>
                <VerifikasiDataDetail user={user} />
              </ProtectedRoute>
            } 
          />
          {/* Verifikasi Data Route */}
          <Route 
            path="/verifikasi-data" 
            element={<VerifikasiData user={user} />} 
          />
        </Routes>
      </div>
      {showLogin && ( 
        <Login 
          onClose={() => setShowLogin(false)} 
          onSwitchRegister={() => {
            setShowLogin(false);
            setShowRegister(true);
          }} 
          onLoginSuccess={handleLoginSuccess}
        />
      )}
      {showRegister && (
        <Register 
          onClose={() => setShowRegister(false)} 
          onSwitchLogin={() => {
            setShowRegister(false);
            setShowLogin(true);
          }}
        />
      )}
    </div>
  );
};

export default App;