import React, { useState, useEffect } from 'react';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaUser, 
  FaEnvelope, 
  FaIdBadge, 
  FaMapMarkerAlt, 
  FaUniversity,
  FaCalendarAlt,
  FaEdit,
  FaShieldAlt,
  FaSave, 
  FaTimes,
  FaUserCheck,
  FaArrowLeft
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../Footer/Footer.jsx';
import styles from './Profile.module.css';

const Profile = ({ user }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    display_name: '',
    email: ''
  });

  const [passwordData, setPasswordData] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  });

  const resetPasswordForm = () => {
    setPasswordData({
      old_password: '',
      new_password: '',
      confirm_password: ''
    });
  };

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Helper: Mengambil data profile
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/users/profile');
      const userData = response.data.data.user || response.data.data;
      setProfile(userData);
      setFormData({
        full_name: userData.full_name,
        display_name: userData.display_name,
        email: userData.email
      });
    } catch (error) {
      console.error("Gagal memuat profil:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // Helper: Melakukan edit data profile
  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/users/${profile.id}`, formData);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Profil berhasil diperbarui!' 
      });
      setShowEditModal(false);
      await fetchProfile();
      window.dispatchEvent(new Event("profileUpdated"));
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal memperbarui profil' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showPasswordModal) {
      resetPasswordForm();
    }
  }, [showPasswordModal]);

  // Helper: Fungsi memperbarui password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    
    // Validasi kecocokan password baru di frontend
    if (passwordData.new_password !== passwordData.confirm_password) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Konfirmasi password baru tidak cocok!' 
      });
      return;
    }

    if (passwordData.new_password.length < 6) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Password baru minimal harus 6 karakter!' 
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/users/${profile.id}`, {
        oldPassword: passwordData.old_password,
        newPassword: passwordData.new_password,
        confirmPassword: passwordData.confirm_password
      });
      
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Password berhasil diperbarui!' 
      });
      setShowPasswordModal(false);
      setPasswordData({ 
        old_password: '', 
        new_password: '', 
        confirm_password: '' 
      }); 
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal memperbarui password. Pastikan password lama benar.' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Effect: Auto-close alert
  useEffect(() => {
    if (alert.show) {
      const timer = setTimeout(() => setAlert(prev => ({ 
        ...prev, 
        show: false 
      })), 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show]);

  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <p>MEMUAT PROFIL...</p>
    </div>
  );

  if (!profile) return null;

  // Helper: Menyusun alamat berjenjang
  const wilayah = profile.desa_adat;
  const alamatLengkap = wilayah 
    ? `Desa Adat ${wilayah.nama_desa_adat}, Kec. ${wilayah.kecamatan?.nama_kecamatan}, Kab. ${wilayah.kecamatan?.kabupaten?.nama_kabupaten}, Prov. ${wilayah.kecamatan?.kabupaten?.provinsi?.nama_provinsi}`
    : "Data Wilayah Belum Melengkapi";

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Profil Pengguna
          </h2>
          <p className={styles.navSubtitle}>
            Informasi detail akun dan keanggotaan adat Anda
          </p>
        </div>
        <div className={styles.navRight}>
          <div className={styles.notifWrapper}>
            <MdNotificationsNone className={styles.notifIcon} />
            <span className={styles.notifBadge}>3</span>
          </div>
          <div className={styles.navDivider}></div>
          <div className={styles.userSection}>
            <span className={styles.userName}>
              SSAB APP
            </span>
          </div>
        </div>
      </nav>
      {/* Alert Section */}
      {alert.show && (
        <div className={`alert-section
          ${alert.type === 'success' ? 'border-green-500' : 'border-red-500'}`}>
          <div className="flex items-start p-4">
            <div className="flex-shrink-0 mr-3 mt-2 text-2xl">
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
      {/* Profile Section */}
      <div className={styles.contentArea}>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* SISI KIRI: Foto & Ringkasan */}
          <div className="lg:col-span-1 space-y-6">
            <div className={styles.cardInfoUser}>
              <div className={styles.avatarWrapper}>
                <div className={styles.avatar}>
                  {user.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2) || 
                    user.fullName?.split(" ").map(n => n[0]).join("").toUpperCase().substring(0, 2)|| "U"
                  }
                </div>
              </div>
              <div className="text-center mt-4">
                <h3 className="text-xl font-black text-[#3A2000]">
                  {profile.full_name}
                </h3>
                <p className="text-sm text-gray-500 font-medium">
                  @{profile.display_name}
                </p>
                <div className={styles.badgeRole}>
                  <FaShieldAlt className="mr-2" /> {profile.role}
                </div>
              </div>
              {/* Email dan Tanggal Masuk */}
              <div className="mt-8 pt-6 border-t border-gray-00 space-y-4">
                <div className="flex items-center text-gray-600">
                  <FaEnvelope className="w-5 text-amber-700 mr-3" />
                  <span className="text-sm">
                    {profile.email}
                  </span>
                </div>
                <div className="flex items-center text-gray-600">
                  <FaCalendarAlt className="w-5 text-amber-700 mr-3" />
                  <span className="text-sm font-medium">
                    Terdaftar sejak: {new Date(profile.createdAt || Date.now()).toLocaleDateString('id-ID', { 
                      month: 'long', year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* SISI KANAN: Detail Informasi */}
          <div className="lg:col-span-2 space-y-6">
            {/* Detail Akun */}
            <div className={styles.cardDetails}>
              <div className="flex justify-between items-center mb-6">
                <h4 className={`${styles.labelDetails} text-md`}>
                  <FaUser className="mr-3 text-amber-700" /> Informasi Personal
                </h4>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  <button onClick={() => setShowEditModal(true)} className={styles.btnEdit}>
                    <FaEdit /> Edit Profil
                  </button>
                  <button onClick={() => setShowPasswordModal(true)} className={styles.btnEditPass}>
                    <FaShieldAlt /> Ganti Password
                  </button>
                </div>
              </div>
              {/* Informasi Diri */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className={styles.labelField}>
                    Nama Lengkap
                  </label>
                  <p className={styles.valueField}>
                    {profile.full_name}
                  </p>
                </div>
                <div>
                  <label className={styles.labelField}>
                    Display Name
                  </label>
                  <p className={styles.valueField}>
                    {profile.display_name}
                  </p>
                </div>
                <div>
                  <label className={styles.labelField}>
                    E-mail
                  </label>
                  <p className={styles.valueField}>
                    {profile.email}
                  </p>
                </div>
              </div>
            </div>
            {/* Informasi Adat */}
            <div className={styles.cardDetails}>
              <h4 className={`${styles.labelAdat} text-md`}>
                <FaUniversity className="mr-3 text-amber-700" /> Keanggotaan Adat
              </h4>
              <div className="space-y-6">
                <div>
                  <label className={styles.labelField}>
                    Wilayah Adat
                  </label>
                  <div className="flex items-start mt-1">
                    <FaMapMarkerAlt className="text-amber-700 mt-1 mr-3 flex-shrink-0" />
                    <p className={styles.valueFieldAlamat}>
                      {alamatLengkap}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className={styles.miniWilayahCard}>
                    <span className={styles.labelWilayah}>
                      Desa Adat
                    </span>
                    <p className={styles.wilayah}>
                      {wilayah?.nama_desa_adat|| '-'}
                    </p>
                  </div>
                  <div className={styles.miniWilayahCard}>
                    <span className={styles.labelWilayah}>
                      Kecamatan
                    </span>
                    <p className={styles.wilayah}>
                      {wilayah?.kecamatan?.nama_kecamatan || '-'}
                    </p>
                  </div>
                  <div className={styles.miniWilayahCard}>
                    <span className={styles.labelWilayah}>
                      Kabupaten
                    </span>
                    <p className={styles.wilayah}>
                      {wilayah?.kecamatan?.kabupaten?.nama_kabupaten || '-'}
                    </p>
                  </div>
                  <div className={styles.miniWilayahCard}>
                    <span className={styles.labelWilayah}>
                      Provinsi
                    </span>
                    <p className={styles.wilayah}>
                      {wilayah?.kecamatan?.kabupaten?.provinsi?.nama_provinsi || '-'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* MODAL EDIT PROFILE */}
      {showEditModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3>
                <FaUserCheck size={21} className="text-amber-700 mt-0.5 mr-2" /> Edit Profile
              </h3>
              <button onClick={() => setShowEditModal(false)}>
                <FaTimes className={styles.iconClose} />
              </button>
            </div>
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className={styles.labelField}>
                  Nama Lengkap
                </label>
                <input 
                  type="text" className={styles.inputForm}
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className={styles.labelField}>
                  Display Name
                </label>
                <input 
                  type="text" className={styles.inputForm}
                  value={formData.display_name}
                  onChange={(e) => setFormData({...formData, display_name: e.target.value})}
                  required
                />
              </div>
              <div>
                <label className={styles.labelField}>
                  E-mail
                </label>
                <input 
                  type="email" className={styles.inputForm}
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className={styles.btnCancelModal}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className={styles.btnSaveModal}>
                  {isSubmitting ? 'Menyimpan...' : <><FaSave /> Simpan</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL GANTI PASSWORD */}
      {showPasswordModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3>
                <FaShieldAlt size={20} className="text-amber-700 mt-0.5 mr-2" /> Ganti Password
              </h3>
              <button onClick={() => setShowPasswordModal(false)}>
                <FaTimes className={styles.iconClose} />
              </button>
            </div>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div>
                <label className={styles.labelField}>
                  Password Lama
                </label>
                <input 
                  type="password" className={styles.inputForm}
                  value={passwordData.old_password}
                  onChange={(e) => setPasswordData({...passwordData, old_password: e.target.value})}
                  required
                  placeholder="Masukkan password saat ini"
                />
              </div>
              <div className="border-t pt-4">
                <label className={styles.labelField}>
                  Password Baru
                </label>
                <input 
                  type="password" className={styles.inputForm}
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})}
                  required
                  placeholder="Minimal 6 karakter"
                />
              </div>
              <div>
                <label className={styles.labelField}>
                  Konfirmasi Password
                </label>
                <input 
                  type="password" className={styles.inputForm}
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})}
                  required
                  placeholder="Konfirmasi password baru"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowPasswordModal(false)} className={styles.btnCancelModal}>
                  Batal
                </button>
                <button type="submit" disabled={isSubmitting} className={styles.btnSaveModal}>
                  {isSubmitting ? 'Memproses...' : <><FaSave /> Update</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default Profile;