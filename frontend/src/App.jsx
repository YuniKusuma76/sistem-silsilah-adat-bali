import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import axiosInstance from './api/axiosInstance.js';
// Autentikasi
import Login from './auth/Login/Login.jsx';
import Register from './auth/Register/Register.jsx';
// Aturan Adat Bali
import AturanAdatBaliEdit from './pages/AturanAdatBali/AturanAdatBaliEdit.jsx';
import AturanAdatBaliBaru from './pages/AturanAdatBali/AturanAdatBaliBaru.jsx';
import AturanAdatBaliDetail from './pages/AturanAdatBali/AturanAdatBaliDetail.jsx';
import AturanAdatBali from './pages/AturanAdatBali/AturanAdatBali.jsx';
// Conditional Layout
import Sidebar from './components/Sidebar/Sidebar.jsx';
import Profile from './components/Profile/Profile.jsx';
import Home from './pages/Home/Home.jsx';
import Dashboard from './pages/Dashboard/Dashboard.jsx';
// Pengajuan Role
import PengajuanRoleBaru from './pages/Pengajuan/PengajuanRoleBaru.jsx';
import PengajuanRoleDetail from './pages/Pengajuan/PengajuanRoleDetail.jsx';
import PengajuanRolePersonal from './pages/Pengajuan/PengajuanRolePersonal.jsx';
// Pengajuan Desa
import PengajuanDesaDetail from './pages/Pengajuan/PengajuanDesaDetail.jsx';
import PengajuanDesaBaru from './pages/Pengajuan/PengajuanDesaBaru.jsx';
import PengajuanDesaPersonal from './pages/Pengajuan/PengajuanDesaPersonal.jsx';
// Wilayah Adat Bali
import WilayahAdatBali from './pages/WilayahAdatBali/WilayahAdatBali.jsx';
// User Pengguna
import UserDetail from './pages/User/UserDetail.jsx';
import User from './pages/User/User.jsx';
// Krama Bali
import TrehBali from './pages/TrehBali/TrehBali.jsx';
import TrehPuncak from './pages/TrehBali/TrehPuncak.jsx';
import DataKramaBali from './pages/KramaBali/DataKramaBali.jsx';
import DataKramaPersonal from './pages/KramaBali/DataKramaPersonal.jsx';
import DataKramaBaru from './pages/KramaBali/DataKramaBaru.jsx';
import SilsilahBali from './pages/TrehBali/SilsilahBali.jsx';
import DataKramaEditKrama from './pages/KramaBali/DataKramaEditKrama.jsx';
import DataKramaAddRelasi from './pages/KramaBali/DataKramaAddRelasi.jsx';
import DataKramaEditRelasi from './pages/KramaBali/DataKramaEditRelasi.jsx';
// Verifikasi Data
import VerifikasiData from './pages/VerifikasiData/VerifikasiData.jsx';

import DataKramaDetail from './pages/KramaBali/DataKramaDetail.jsx';
import Kontak from './pages/Kontak.jsx';
import SilsilahAdatBali from './pages/SilsilahAdatBali.jsx';
import SilsilahAdatBaliDetail from './pages/SilsilahAdatBaliDetail.jsx';
import SilsilahAdatBaliVisualisasi from './pages/SilsilahAdatBaliVisualisasi.jsx';
import Keluarga from './pages/Keluarga.jsx';
import KeluargaAdd from './pages/KeluargaAdd.jsx';
import KeluargaDetail from './pages/KeluargaDetail.jsx';
import KeluargaVisualisasi from './pages/KeluargaVisualisasi.jsx';
// Menu Aturan Adat Bali
import PakarAturanAdatBali from './pages/PakarAturanAdatBali.jsx';
import PakarAturanAdatBaliAdd from './pages/PakarAturanAdatBaliAdd.jsx';
import PakarAturanAdatBaliDetail from './pages/PakarAturanAdatBaliDetail.jsx';
import PakarAturanAdatBaliEdit from './pages/PakarAturanAdatBaliEdit.jsx';
// Menu Permohonan Peran Pengguna
import PermohonanPeran from './pages/PermohonanPeran.jsx';
import PermohonanPeranAdd from './pages/PermohonanPeranAdd.jsx';
import PermohonanPeranDetail from './pages/PermohonanPeranDetail.jsx';
import AdminPermohonanPeran from './pages/AdminPermohonanPeran.jsx';
import AdminPermohonanPeranDetail from './pages/AdminPermohonanPeranDetail.jsx';
// Menu Khusus Admin
import AdminKontak from './pages/AdminKontak.jsx';
import AdminKontakDetail from './pages/AdminKontakDetail.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminUsersAdd from './pages/AdminUsersAdd.jsx';
import AdminUsersEdit from './pages/AdminUsersEdit.jsx';
import AdminAturanAdatBali from './pages/AdminAturanAdatBali.jsx';
import AdminAturanAdatBaliDetail from './pages/AdminAturanAdatBaliDetail.jsx';

// Middleware Hak Akses Route
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
  const [showLogin, setShowLogin] = useState(false);
  const [showRegister, setShowRegister] = useState(false);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // State alert notifikasi global
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });
  
  // Effect: Auto-close alert
  useEffect(() => {
    if (alert.show && (alert.type === 'success' || alert.type === 'error')) {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: Fungsi melihat status login awal
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

  // Effect: Refresh token saat pertama kali buka web
  useEffect(() => {
    checkLoginStatus();
  }, []);

  // Helper: Menampilkan alert login success
  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setShowLogin(false);
    setAlert({
      show: true,
      type: 'success',
      message: `Selamat datang kembali, ${userData.display_name}!`
    });
  };

  // Helper: Menampilkan alert logout
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

  // Helper: Flags hak akses untuk role
  const isManagement = ['Super Admin', 'Admin Desa'].includes(user?.role);
  const isSuperAdmin = user?.role === 'Super Admin';

  return (
    <div className="app-container">
      {/* Alert Section */}
      {alert.show && (
        <div className={`alert-section 
          ${alert.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
          <div className="flex items-start p-4">
            <div className="flex-shrink-0 mt-2 mr-3 text-2xl">
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
      {/* Sidebar Layout */}
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
            path="/krama-bali/detail/edit-krama/:id" 
            element={<DataKramaEditKrama user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/add-relasi/:id" 
            element={<DataKramaAddRelasi user={user} />} 
          />
          <Route 
            path="/krama-bali/detail/edit-relasi/:id" 
            element={<DataKramaEditRelasi user={user} />} 
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
            <Route index element={
              <ProtectedRoute user={user} allowedRoles={['Pakar', 'Super Admin']}>
                <AturanAdatBali user={user} />
              </ProtectedRoute>
            } />
            <Route 
              path="detail/:id" 
              element={<AturanAdatBaliDetail user={user} />} 
            />
            <Route 
              path="add" 
              element={<AturanAdatBaliBaru user={user} />} 
            />
            <Route 
              path="detail/edit/:id" 
              element={<AturanAdatBaliEdit user={user} />} 
            />
          </Route>
          {/* Wilayah Adat Bali Routes */}
          <Route path="/wilayah-adat-bali">
            <Route index element={
              <ProtectedRoute user={user} allowedRoles={['Super Admin']}>
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
          {/* Verifikasi Data Route */}
          <Route 
            path="/verifikasi-data" 
            element={<VerifikasiData user={user} />} 
          />


          {/* WAITING ROOM */}
          
          
          
          {/* Silsilah (Akses Berdasarkan Desa di dalam Komponen) */}
          <Route path="/silsilah-bali">
            <Route index element={user ? <SilsilahAdatBali setAlert={setAlert} user={user} /> : <Navigate to="/home" />} />
            <Route path="detail/:id" element={<SilsilahAdatBaliDetail user={user} />} />
            <Route path="visualisasi/:id" element={<SilsilahAdatBaliVisualisasi user={user} />} />
          </Route>

          {/* Akses Khusus Krama & Admin Desa (Scope: Desa Adat Sendiri) */}
          <Route path="/keluarga" element={<ProtectedRoute user={user} allowedRoles={['Krama', 'Admin Desa']}><Keluarga user={user} /></ProtectedRoute>} />
          <Route path="/keluarga/create" element={<KeluargaAdd user={user} />} />
          <Route path="/keluarga/detail/:id" element={<KeluargaDetail user={user} />} />
          <Route path="/keluarga/visualisasi/:id" element={<KeluargaVisualisasi user={user} />} />

          {/* Aturan Adat (Scope: Global - Pakar & Super Admin) */}
          <Route path="/aturan-adat">
            <Route index element={<ProtectedRoute user={user} allowedRoles={['Pakar', 'Super Admin']}><PakarAturanAdatBali user={user} /></ProtectedRoute>} />
            <Route path="create" element={<PakarAturanAdatBaliAdd user={user} />} />
            <Route path="detail/:id" element={<PakarAturanAdatBaliDetail user={user} />} />
            <Route path="edit/:id" element={<PakarAturanAdatBaliEdit user={user} />} />
            <Route path="list" element={<AdminAturanAdatBali user={user} />} />
            <Route path="list/detail/:id" element={<AdminAturanAdatBaliDetail user={user} />} />
          </Route>

          {/* Manajemen Peran (Admin Desa handle warga desa sendiri, Super Admin handle semua) */}
          <Route path="/permohonan-peran">
            <Route path="riwayat" element={<ProtectedRoute user={user} allowedRoles={['Viewer', 'Krama', 'Pakar']}><PermohonanPeran user={user} /></ProtectedRoute>} />
            <Route path="riwayat/create" element={<PermohonanPeranAdd user={user} />} />
            <Route path="riwayat/detail/:id" element={<PermohonanPeranDetail user={user} />} />
            <Route path="list" element={<ProtectedRoute user={user} allowedRoles={['Super Admin', 'Admin Desa']}><AdminPermohonanPeran user={user} /></ProtectedRoute>} />
            <Route path="list/detail/:id" element={<AdminPermohonanPeranDetail user={user} />} />
          </Route>

          {/* Super Admin Area */}
          <Route path="/users" element={<ProtectedRoute user={user} allowedRoles={['Super Admin']}><AdminUsers /></ProtectedRoute>} />
          <Route path="/users/create" element={<AdminUsersAdd />} />
          <Route path="/users/edit/:id" element={<AdminUsersEdit />} />
          
          <Route path="/kontak/inbox" element={<ProtectedRoute user={user} allowedRoles={['Super Admin']}><AdminKontak /></ProtectedRoute>} />
          <Route path="/kontak/inbox/detail/:id" element={<AdminKontakDetail />} />

          {/* Conditional Contact Page */}
          <Route path="/kontak" element={isSuperAdmin ? <Navigate to="/home" replace /> : <Kontak user={user} />} />
        </Routes>
      </div>
      {/* Show Modal Login dan Register */}
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