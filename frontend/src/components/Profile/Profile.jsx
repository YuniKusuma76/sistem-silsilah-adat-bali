import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
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

// Helper: Membuat format waktu
const formatWaktuRelatif = (dateString) => {
  const tanggalNotif = new Date(dateString);
  const sekarang = new Date();
  const selisihMiliDetik = sekarang - tanggalNotif;
  
  const selisihMenit = Math.floor(selisihMiliDetik / (1000 * 60));
  const selisihJam = Math.floor(selisihMiliDetik / (1000 * 60 * 60));

  if (selisihMenit < 1) return "Baru saja";
  if (selisihMenit < 60) return `${selisihMenit} menit yang lalu`;
  if (selisihJam < 24) return `${selisihJam} jam yang lalu`;
  
  return tanggalNotif.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

const Profile = ({ user }) => {
  const notifDropdownRef = useRef(null);
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

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

  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

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
      console.error("Gagal memuat profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/users/${profile.id}`, formData);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Profile berhasil diperbarui!' 
      });
      setShowEditModal(false);
      await fetchProfile();
      window.dispatchEvent(new Event("profileUpdated"));
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat memperbarui profile' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HELPER NOTIFIKASI: Mengambil list notifikasi yang masuk
  const fetchNotifikasiLengkap = async () => {
    if (!user) return;
    try {
      const response = await axiosInstance.get('/notifikasi/personal');
      setListNotifikasi(response.data.data || []);
      const unread = response.data.data.filter(n => !n.is_read).length;
      setJumlahNotif(unread);
    } catch (error) {
      console.error("Gagal mengambil list notifikasi masuk", error);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchNotifikasiLengkap();
    const interval = setInterval(fetchNotifikasiLengkap, 30000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTandaiDibaca = async (notifId) => {
    try {
      await axiosInstance.patch(`/notifikasi/read/${notifId}`);
      await fetchNotifikasiLengkap();
    } catch (error) {
      console.error(error);
      const errorMessage = error.response?.data?.message || "Gagal membaca notifikasi yang masuk.";
      setAlert({ 
        show: true, 
        type: 'error', 
        message: errorMessage 
      });
    }
  };

  useEffect(() => {
    if (!showPasswordModal) {
      resetPasswordForm();
    }
  }, [showPasswordModal]);

  const handleUpdatePassword = async (e) => {
    e.preventDefault();

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
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat memperbarui password. Pastikan password lama Anda benar!' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  if (loading) return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner}></div>
      <p>MEMUAT PROFILE...</p>
    </div>
  );

  if (!profile) return null;

  const wilayah = profile.desa_adat;
  const alamatLengkap = wilayah 
    ? `Desa Adat ${wilayah.nama_desa_adat}, Kec. ${wilayah.kecamatan?.nama_kecamatan}, Kab. ${wilayah.kecamatan?.kabupaten?.nama_kabupaten}, Prov. ${wilayah.kecamatan?.kabupaten?.provinsi?.nama_provinsi}`
    : "Tidak Terikat Wilayah Adat";

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
          <div ref={notifDropdownRef} className="relative">
            <div className={styles.notifWrapper} onClick={() => setIsDropdownNotifOpen(!isDropdownNotifOpen)}>
              <MdNotificationsNone className={styles.notifIcon} />
              {jumlahNotif > 0 && <span className={styles.notifBadge}>{jumlahNotif}</span>}
            </div>
            {/* DROPDOWN NOTIFIKASI */}
            {isDropdownNotifOpen && (
              <div className={styles.notifDropdownMenu}>
                <div className={styles.notifDropdownHeader}>
                  <h3 className={styles.notifDropdownHeaderTitle}>
                    Pemberitahuan Sistem
                  </h3>
                  {jumlahNotif > 0 && (
                    <span className={styles.notifDropdownHeaderCount}>
                      {jumlahNotif} Baru
                    </span>
                  )}
                </div>
                <div className={styles.notifDropdownBody}>
                  {!user ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      Silakan login untuk melihat pemberitahuan.
                    </div>
                  ) : listNotifikasi.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 italic text-xs">
                      Tidak ada pemberitahuan baru.
                    </div>
                  ) : (
                    <div className={styles.notifListContainer}>
                      {listNotifikasi.map((notif) => {
                        const badgeStyles = {
                          VERIFIKASI: styles.badgeVerifikasi,
                          PERINGATAN: styles.badgePeringatan,
                          KONTAK: styles.badgeKontak,
                          LOG_SISTEM: styles.badgeLogSistem,
                          INFORMASI: styles.badgeInformasi,
                        };
                        const activeBadgeStyle = badgeStyles[notif.kategori] || styles.badgeInformasi;

                        return (
                          <div 
                            key={notif.id} 
                            onClick={() => {
                              if (!notif.is_read) handleTandaiDibaca(notif.id);
                              if (notif.tautan_fitur) navigate(notif.tautan_fitur);
                            }}
                            className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`${styles.badgeBase} ${activeBadgeStyle}`}>
                                  {notif.kategori}
                                </span>
                                <h4 className={notif.is_read ? styles.notifTitleRead : styles.notifTitleUnread}>
                                  {notif.judul}
                                </h4>
                              </div>
                              <p className={styles.notifDeskripsi}>
                                {notif.deskripsi}
                              </p>
                              <span className={styles.notifTime}>
                                {formatWaktuRelatif(notif.createdAt)}
                              </span>
                            </div>
                            {!notif.is_read && (
                              <div className="flex items-start">
                                <span className={styles.dotUnreadIndicator} title="Belum dibaca" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
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
                  #{profile.display_name}
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