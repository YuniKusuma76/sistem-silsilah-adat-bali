import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaArrowLeft, 
  FaUser, 
  FaEnvelope, 
  FaShieldAlt, 
  FaMapMarkerAlt, 
  FaCalendarAlt,
  FaIdCard,
  FaInfoCircle,
  FaEdit,
  FaTrash,
  FaCheck,
  FaExclamationTriangle,
  FaSave,
  FaTimes,
  FaUserCheck,
  FaUserShield,
  FaEye,
  FaEyeSlash
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './UserDetail.module.css';

// Helper: Modal konfirmasi perubahan status akun
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing, isActivate }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className="p-6">
          <div className="flex justify-center mb-5">
            <div className={isActivate ? styles.elipsisGreen : styles.elipsisRed}>
              <FaExclamationTriangle className={isActivate ? "text-green-600 text-2xl" : "text-red-600 text-2xl"} />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-2">{title}</h3>
            <p className="text-sm text-gray-600">{message}</p>
          </div>
          <div className="mt-10 flex gap-3 justify-center">
            <button onClick={onClose} disabled={isProcessing} className={styles.btnCancel}>
              Kembali
            </button>
            <button 
              onClick={onConfirm} 
              disabled={isProcessing} 
              className={isActivate ? styles.btnDetail : styles.btnDelete}
              style={{ borderRadius: '0.75rem', padding: '0.625rem 1.25rem' }}
            >
              {isActivate ? <FaCheck size={12} /> : <FaTrash size={12} />} 
              {isProcessing ? ' Memproses...' : ' Ya, Lanjutkan'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const UserDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isProcessingStatus, setIsProcessingStatus] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    display_name: '',
    email: ''
  });

  const [passwordData, setPasswordData] = useState({
    new_password: '',
    confirm_password: ''
  });

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  // Helper: Mengekstrak ID asli dari slug
  const extractIdFromSlug = (slugString) => {
    if (!slugString) return null;
    if (!isNaN(slugString)) return slugString; 
    try {
      if (slugString.includes('_')) {
        const parts = slugString.split('_');
        const encodedId = parts[parts.length - 1];
        return atob(encodedId);
      }
      if (slugString.includes('-')) {
        const parts = slugString.split('-');
        const encodedId = parts[parts.length - 1];
        if (encodedId.length >= 2) return atob(encodedId);
      }
      return slugString.split(/[-_]/).pop();
    } catch (error) {
      console.error(error);
      return slugString.split(/[-_]/).pop();
    }
  };
  
  const fetchUserDetail = async () => {
    setLoading(true);
    const userId = extractIdFromSlug(slug);
    if (!userId) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Format parameter URL tidak valid.' 
      });
      setLoading(false);
      return;
    }
    try {
      const response = await axiosInstance.get(`/users/${userId}`);
      const resData = response.data?.data || response.data?.user || response.data;
      setUser(resData);
    } catch (error) {
      console.error("Gagal mengambil data detail user:", error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || "Gagal memuat detail data pengguna." 
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (showEditModal && user) {
      setFormData({
        full_name: user.full_name || '',
        display_name: user.display_name || '',
        email: user.email || ''
      });
    }
  }, [showEditModal, user]);

  useEffect(() => {
    if (showEditModal || showPasswordModal || showStatusModal) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => document.body.classList.remove("no-scroll");
  }, [showEditModal, showPasswordModal, showStatusModal]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/users/${user.id}`, formData);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Data user berhasil diperbarui!' 
      });
      setShowEditModal(false);
      await fetchUserDetail();
      window.dispatchEvent(new Event("profileUpdated"));
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal memperbarui data user' 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (!showPasswordModal) {
      setPasswordData({ 
        new_password: '', 
        confirm_password: '' 
      });
    }
  }, [showPasswordModal]);

  // Perbarui password
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
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
      await axiosInstance.patch(`/users/${user.id}`, {
        newPassword: passwordData.new_password,
        confirmPassword: passwordData.confirm_password
      });
      
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Password berhasil diperbarui!' 
      });
      setShowPasswordModal(false);
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

  const handleToggleStatus = async () => {
    if (!user?.id) return;
    setIsProcessingStatus(true);
    const isCurrentNonActive = user.status_akun === 'Non-Aktif';

    try {
      if (isCurrentNonActive) {
        await axiosInstance.patch(`/users/${user.id}`, { status_akun: 'Aktif' });
      } else {
        await axiosInstance.delete(`/users/${user.id}`);
      }
      
      setAlert({
        show: true,
        type: 'success',
        message: `Status akun ${user.full_name} berhasil ${isCurrentNonActive ? 'diaktifkan kembali' : 'dinonaktifkan'}.`
      });
      setShowStatusModal(false);
      fetchUserDetail();
    } catch (error) {
      console.error("Gagal mengubah status akun:", error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || `Gagal memproses status akun pengguna.`
      });
    } finally {
      setIsProcessingStatus(false);
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

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MEMUAT DATA...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className={styles.mainContainer}>
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Akun Pengguna
          </h2>
          <p className={styles.navSubtitle}>
            Informasi lengkap profil dan wilayah otoritas binaan pengguna
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
      <div className={styles.contentArea}>
        <div className={styles.tableWrapper}>
          <div className="animate-fade-in">
            <div className={styles.container}>
              <div className={styles.cardContent}>
                <div className={styles.avatarWrapper}>
                  <div className={styles.avatar}>
                    <FaUser />
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className={styles.titleContent}>
                    {user.full_name}
                  </h3>
                  <p className="text-sm text-gray-500 font-medium mt-1">
                    @{user.display_name || 'Username'}
                  </p>
                  <div className="mt-3">
                    <span 
                      className={`${styles.badge} ${user.status_akun === 'Non-Aktif' ? styles.badgeDanger : styles.badgeSuccess}`}>{user.status_akun || 'Aktif'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 w-full sm:w-auto flex-shrink-0">
                <button onClick={() => setShowEditModal(true)} className={styles.btnEdit}>
                  <FaEdit /> Edit Profil
                </button>
                <button onClick={() => setShowPasswordModal(true)} className={styles.btnEditPass}>
                  <FaShieldAlt /> Ganti Password
                </button>
              </div>
            </div>
            <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6 text-left pb-4">
              <div className={styles.statsCard}>
                <div className={`${styles.statsIconWrapper} text-gray-500`}>
                  <FaIdCard size={18} />
                </div>
                <div>
                  <span className={styles.statsLabel}>
                    Display Name
                  </span>
                  <h3 className="text-sm font-bold text-gray-800 mt-0.5">
                    {user.display_name}
                  </h3>
                </div>
              </div>
              <div className={styles.statsCard}>
                <div className={`${styles.statsIconWrapper} text-gray-500`}>
                  <FaEnvelope size={17} />
                </div>
                <div>
                  <span className={styles.statsLabel}>
                    E-mail
                  </span>
                  <h3 className="text-sm font-bold text-gray-800 mt-0.5">
                    {user.email}
                  </h3>
                </div>
              </div>
              <div className={styles.statsCard}>
                <div className={`${styles.statsIconWrapper} text-amber-700`}>
                  <FaUserShield size={20} />
                </div>
                <div>
                  <span className={styles.statsLabel}>
                    Role
                  </span>
                  <h3 className="text-sm font-black text-[#3a2000] mt-0.5">
                    {user.role}
                  </h3>
                </div>
              </div>
              <div className={styles.statsCard}>
                <div className={`${styles.statsIconWrapper} text-gray-500`}>
                  <FaCalendarAlt size={17} />
                </div>
                <div>
                  <span className={styles.statsLabel}>
                    Tanggal Masuk
                  </span>
                  <h3 className="text-sm font-bold text-gray-800 mt-0.5">
                    {new Date(user.createdAt || Date.now()).toLocaleDateString('id-ID', { 
                      day: 'numeric', month: 'long', year: 'numeric' 
                    })}
                  </h3>
                </div>
              </div>
              {/* Wilayah Adat */}
              {user.desa_adat && (
                <div className={styles.cardLocation}>
                  <div className={styles.cardHeader}>
                    <FaMapMarkerAlt className="text-amber-800 text-sm" />
                    <h4 className={styles.cardTitle}>Wilayah Adat</h4>
                  </div>
                  <div className={styles.gridLocation}>
                    <div>
                      <span className={styles.gridLabel}>
                        Desa Adat
                      </span>
                      <p className="text-sm font-extrabold text-amber-950 mt-1">
                        {user.desa_adat.nama_desa_adat || '-'}
                      </p>
                    </div>
                    <div>
                      <span className={styles.gridLabel}>
                        Kecamatan
                      </span>
                      <p className="text-sm font-semibold text-gray-700 mt-1">
                        {user.desa_adat.kecamatan?.nama_kecamatan || '-'}
                      </p>
                    </div>
                    <div>
                      <span className={styles.gridLabel}>
                        Kabupaten
                      </span>
                      <p className="text-sm font-semibold text-gray-700 mt-1">
                        {user.desa_adat.kecamatan?.kabupaten?.nama_kabupaten || '-'}
                      </p>
                    </div>
                    <div>
                      <span className={styles.gridLabel}>
                        Provinsi
                      </span>
                      <p className="text-sm font-semibold text-gray-700 mt-1">
                        {user.desa_adat.kecamatan?.kabupaten?.provinsi?.nama_provinsi || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className={styles.buttonGroup}>
              <button onClick={() => navigate('/user-pengguna')} className={styles.btnBack}>
                <FaArrowLeft /> Kembali
              </button>
              <button onClick={() => setShowStatusModal(true)} className={user.status_akun === 'Non-Aktif' ? styles.btnDetail : styles.btnDelete}>
                {user.status_akun === 'Non-Aktif' ? <><FaCheck size={11} /> Aktifkan Akun</> : <><FaTrash size={11} /> Nonaktifkan Akun</>}
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Confirmation Modal */}
      <ConfirmationModal 
        isOpen={showStatusModal} 
        onClose={() => setShowStatusModal(false)} 
        onConfirm={handleToggleStatus} 
        isProcessing={isProcessingStatus} 
        isActivate={user?.status_akun === 'Non-Aktif'} 
        title={user?.status_akun === 'Non-Aktif' ? "Aktifkan Akun Kembali?" : "Nonaktifkan Akun Pengguna?"} 
        message={user?.status_akun === 'Non-Aktif' 
          ? `Akun atas nama ${user?.full_name} akan dipulihkan hak akses loginnya ke sistem.` 
          : `Akun atas nama ${user?.full_name} tidak akan bisa melakukan login atau mengakses dasbor silsilah adat.`
        } 
      />
      {/* Modal Edit Data */}
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
              <div className="sm:col-span-2">
                <label className={styles.labelField}>
                  Nama Lengkap
                </label>
                <input 
                  type="text" 
                  className={styles.inputForm} 
                  value={formData.full_name} 
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})} 
                  required 
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className={styles.labelField}>
                    Display Name
                  </label>
                  <input 
                    type="text" 
                    className={styles.inputForm} 
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
                    type="email" 
                    className={styles.inputForm} 
                    value={formData.email} 
                    onChange={(e) => setFormData({...formData, email: e.target.value})} 
                    required 
                  />
                </div>
              </div>
              <div className={styles.btnGroupModal}>
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
      {/* Modal Edit Password */}
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
            <form onSubmit={handleUpdatePassword} className="space-y-4 text-left">
              <div className="relative">
                <label className={styles.labelField}>
                  Password Baru
                </label>
                <input 
                  type={showPassword ? "text" : "password"}
                  name="new_password" 
                  className={styles.inputForm} 
                  value={passwordData.new_password} 
                  onChange={(e) => setPasswordData({...passwordData, new_password: e.target.value})} 
                  required 
                  placeholder="Minimal 6 karakter" 
                />
                <button type="button" className={styles.eyePassword} disabled={isSubmitting} onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
              <div className="relative">
                <label className={styles.labelField}>
                  Konfirmasi Password
                </label>
                <input 
                  
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirm_password" 
                  className={styles.inputForm} 
                  value={passwordData.confirm_password} 
                  onChange={(e) => setPasswordData({...passwordData, confirm_password: e.target.value})} 
                  required 
                  placeholder="Konfirmasi password baru" 
                />
                <button type="button" className={styles.eyePassword} disabled={isSubmitting} onClick={() => setShowConfirmPassword(!showConfirmPassword)}>
                  {showConfirmPassword ? <FaEyeSlash size={18} /> : <FaEye size={18} />}
                </button>
              </div>
              <div className={styles.btnGroupModal}>
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

export default UserDetail;