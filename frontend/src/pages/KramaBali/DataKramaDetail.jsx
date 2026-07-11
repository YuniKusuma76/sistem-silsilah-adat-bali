import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { GrDocumentUpdate } from "react-icons/gr";
import { 
  MdHistory, 
  MdNotificationsNone,
  MdFamilyRestroom 
} from "react-icons/md";
import { 
  FaArrowLeft, 
  FaEdit, 
  FaSitemap, 
  FaUser, 
  FaVenusMars, 
  FaBirthdayCake, 
  FaMapMarkerAlt, 
  FaHeart, 
  FaUserFriends, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaIdCard,
  FaUsers,
  FaTrash,
  FaList,
  FaCalendarAlt,
  FaExclamationTriangle,
  FaUserCog,
  FaTimes,
  FaCheck,
  FaArrowRight,
  FaHourglassHalf,
  FaPlusCircle,
  FaEye,
  FaIdCardAlt 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaDetail.module.css';

const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className="p-6">
          <div className="flex justify-center mb-5 mt-6">
            <div className={styles.elipsis}>
              <FaExclamationTriangle className="text-red-600 text-2xl" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-base font-bold text-black mb-2">{title}</h3>
            <p className="text-xs text-gray-600">{message}</p>
          </div>
          <div className="mt-10 flex gap-3 justify-center">
            <button onClick={onClose} disabled={isProcessing} className={styles.btnCancel}>
              Kembali
            </button>
            <button onClick={onConfirm} disabled={isProcessing} className={styles.btnDelete}>
              <FaTrash size={12} /> {isProcessing ? 'Memproses...' : 'Ya, Hapus'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper: Membuat format tanggal indonesia
const formatDate = (dateString) => {
  if (!dateString) return 'Tidak Diketahui';
  const date = new Date(dateString);
  return isNaN(date.getTime()) 
    ? 'Tidak Diketahui' 
    : date.toLocaleDateString('id-ID', { 
        day: 'numeric', month: 'long', year: 'numeric' 
      });
};

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

// Helper: Membuat style badge status peran adat
const getStatusBadge = (isActive) => {
  if (isActive) {
    return (
      <span className={styles.statusPeranAdatAktif}>
        <FaCheckCircle size={10} /> Aktif
      </span>
    );
  }
  return (
    <span className={styles.statusPeranAdatSelesai}>
      <FaTimesCircle size={10} /> Selesai
    </span>
  );
};

const createSlug = (namaLengkap, tipeData, id) => {
  const baseName = namaLengkap ? namaLengkap : 'krama';
  const baseType = tipeData ? tipeData : 'keturunan';

  const safeName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const safeType = baseType
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${safeName}-${safeType}-${encodedId}`;
};

const DataKramaDetail = ({ user }) => {
  const { id: slugParam } = useParams();
  const notifDropdownRef = useRef(null);
  const [keluargaMap, setKeluargaMap] = useState({});
  const [masterDesaMap, setMasterDesaMap] = useState({});
  
  const [krama, setKrama] = useState(null);
  const [relasiList, setRelasiList] = useState([]);
  const [perkawinanList, setPerkawinanList] = useState([]);
  const [riwayatKeluargaList, setRiwayatKeluargaList] = useState([]);
  const [peranAdatList, setPeranAdatList] = useState([]);
  
  const [isOpenModalKrama, setIsOpenModalKrama] = useState(false);
  const [isOpenModalRelasi, setIsOpenModalRelasi] = useState(false); 
  const [isOpenModalKawin, setIsOpenModalKawin] = useState(false);
  const [modalRelasiData, setModalRelasiData] = useState(null);
  const [modalKawinData, setModalKawinData] = useState(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const navigate = useNavigate();
  const location = useLocation();

  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

  const [modalDelete, setModalDelete] = useState({ 
    isOpen: false,
    type: '',       
    targetId: null,  
    title: '',
    message: ''
  });

  // Helper: enkripsi slug url menjadi id asli
  const realId = useMemo(() => {
    if (!slugParam) return null;
    if (!slugParam.includes('-')) return slugParam;
    try {
      const parts = slugParam.split('-');
      const encodedId = parts[parts.length - 1];
      return atob(encodedId);
    } catch (error) {
      console.error("Format slug tidak valid:", error);
      return null;
    }
  }, [slugParam]);

  const fetchAllData = async () => {
    if (!realId) { 
      setIsLoading(false); 
      return; 
    }

    try {
      setIsLoading(true);
      const resKrama = await axiosInstance.get(`/krama-bali/${realId}`);
      const kramaData = resKrama.data?.data;
      
      if (!kramaData) {
        throw new Error("Data krama utama tidak ditemukan.");
      }
      
      setKrama(kramaData);

      const isSuperAdmin = user?.role === 'Super Admin';
      const isAdminDesa = user?.role === 'Admin Desa';
      const isKramaAdat = user?.role === 'Krama';
      const isOwner = user && ((String(user.id) === String(kramaData.user_id) 
        || String(user.userId) === String(kramaData.user_id))) 
        && kramaData.user_id !== null && kramaData.user_id !== undefined;

      let relasiQueryMode = 'public'; 
      let perkawinanQueryMode = 'public'; 

      if (isSuperAdmin) {
        relasiQueryMode = 'verification';
        perkawinanQueryMode = 'verification'; 
      } else if (isAdminDesa) {
        const userDesaId  = user.desa_adat_id || user.desaAdatId || user.desa_adat?.id;
        const kramaDesaId = kramaData?.desa_adat_id || kramaData?.desaAdatId || kramaData?.desa_id;
        
        if (String(userDesaId) === String(kramaDesaId)) {
          relasiQueryMode = 'verification';
          perkawinanQueryMode = 'verification';
        } else {
          relasiQueryMode = 'public';
          perkawinanQueryMode = 'public';
        }
      } else if (isKramaAdat) {
        if (isOwner) {
          relasiQueryMode = 'personal';
          perkawinanQueryMode = 'personal'; 
        } else {
          relasiQueryMode = 'public';
          perkawinanQueryMode = 'public';
        }
      }

      console.log("Mengirim relasiQueryMode ke backend:", relasiQueryMode);
      console.log("Mengirim perkawinanQueryMode ke backend:", perkawinanQueryMode);

      const results = await Promise.allSettled([
        axiosInstance.get(`/relasi-krama?anak_id=${realId}&mode=${relasiQueryMode}`),
        axiosInstance.get(`/perkawinan?krama_id=${realId}&mode=${perkawinanQueryMode}`), // 🛠️ Menggunakan parameter dinamis
        axiosInstance.get('/riwayat-keluarga'),
        axiosInstance.get('/riwayat-peran-adat'),
        axiosInstance.get('/keluarga'),
        axiosInstance.get('/desa-adat')
      ]);

      const [
        resRelasi, 
        resPerkawinan, 
        resRiwayatKeluarga, 
        resPeranAdat, 
        resKeluarga, 
        resDesaAdat
      ] = results;

      // setting data relasi orang tua
      if (resRelasi.status === 'fulfilled') {
        const rawRelasi = resRelasi.value.data?.data || resRelasi.value.data;
        const cleanRelasiList = Array.isArray(rawRelasi) ? rawRelasi : (rawRelasi ? [rawRelasi] : []);
        setRelasiList(cleanRelasiList);
      }
      // setting data perkawinan
      if (resPerkawinan.status === 'fulfilled') {
        const rawPerkawinan = resPerkawinan.value.data?.data || resPerkawinan.value.data;
        setPerkawinanList(Array.isArray(rawPerkawinan) ? rawPerkawinan : (rawPerkawinan ? [rawPerkawinan] : []));
      }
      // seeting data riwayat keluarga
      if (resRiwayatKeluarga.status === 'fulfilled') {
        const rawRiwayatKel = resRiwayatKeluarga.value.data?.data || resRiwayatKeluarga.value.data;
        setRiwayatKeluargaList(Array.isArray(rawRiwayatKel) ? rawRiwayatKel : (rawRiwayatKel ? [rawRiwayatKel] : []));
      }
      // setting data riwayat status peran adat
      if (resPeranAdat.status === 'fulfilled') {
        const rawPeran = resPeranAdat.value.data?.data || resPeranAdat.value.data;
        setPeranAdatList(Array.isArray(rawPeran) ? rawPeran : (rawPeran ? [rawPeran] : []));
      }
      // mengambil data keluarga untuk nama kepala keluarga
      if (resKeluarga.status === 'fulfilled') {
        const rawKeluarga = resKeluarga.value.data?.data || resKeluarga.value.data || [];
        const mapping = {};
        rawKeluarga.forEach(fam => {
          if (fam && fam.id) {
            mapping[fam.id] = {
              nama_kepala: fam.kepala_keluarga?.nama_lengkap || fam.nama_kepala_keluarga || "Tidak Diketahui",
              jenis_keluarga: fam.jenis_keluarga
            };
          }
        });
        setKeluargaMap(mapping);
      }
      // setting data desa adat
      if (resDesaAdat.status === 'fulfilled') {
        const rawDesa = resDesaAdat.value.data?.data || resDesaAdat.value.data || [];
        const mappingDesa = {};
        rawDesa.forEach(desa => {
          if (desa && desa.id !== undefined) {
            mappingDesa[desa.id] = desa.nama_desa_adat;
            mappingDesa[String(desa.id)] = desa.nama_desa_adat;
          }
        });
        setMasterDesaMap(mappingDesa);
      }

    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: 'Gagal memuat detail data krama bali beserta informasi relasi silsilahnya.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realId]);

  // Helper: hak akses manajemen data detail krama bali
  const hasAccess = useMemo(() => {
    if (!user || !krama) return false;
    if (user.role === 'Super Admin') return true;
    if (user.role === 'Admin Desa') {
      const currentUserId = user.id || user.userId;
      const creatorId = krama.user_id || krama.userId;
      if (currentUserId && creatorId && String(currentUserId) === String(creatorId)) {
        return true;
      }
      const userDesaId = user.desa_adat_id || user.desaAdatId || user.desa_adat?.id;
      const kramaDesaId = krama.desa_adat_id || krama.desaAdatId || krama.desa_id;
      return String(userDesaId) === String(kramaDesaId);
    }
    if (user.role === 'Krama') {
      return user.id === krama.user_id || user.userId === krama.user_id;
    }
    if (user.role === 'Pakar' || user.role === 'Viewer') {
      return false;
    }
    return false;
  }, [user, krama]);

  useEffect(() => {
    if (location.state?.successMessage) {
      setAlert({
        show: true,
        type: 'success',
        message: location.state.successMessage
      });
      window.history.replaceState({}, document.title);
    }
  }, [location]);
  
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  useEffect(() => {
    if (isOpenModalKrama || isOpenModalRelasi || isOpenModalKawin) {
      document.body.classList.add("no-scroll");
      return () => {
        document.body.classList.remove("no-scroll");
      };
    }
  }, [isOpenModalKrama, isOpenModalRelasi, isOpenModalKawin]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // HELPER NOTIFIKASI: mengambil list notifikasi yang masuk
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

  // Helper: membatalkan perubahan data krama bali
  const handleCancelUpdateKrama = async () => {
    setIsProcessingAction(true);
    try {
      await axiosInstance.patch(`/krama-bali/cancel-update/${realId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Draft usulan perubahan data krama bali berhasil dibatalkan!' 
      });
      setIsOpenModalKrama(false);
      fetchAllData();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal membatalkan draft usulan perubahan data krama bali.' 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper: mengambil detail data relasi krama
  const fetchDetailRelasi = async (relasiId) => {
    setIsProcessingAction(true);
    try {
      const cleanId = String(relasiId).trim();
      let relasiQueryMode = 'public';

      if (user?.role === 'Super Admin' || user?.role === 'Admin Desa') {
        relasiQueryMode = 'verification';
      } else if (user?.role === 'Krama') {
        const isOwner = krama && (user?.id === krama.user_id || user?.userId === krama.user_id);
        relasiQueryMode = isOwner ? 'personal' : 'public';
      } else if (user?.role === 'Pakar' || user?.role === 'Viewer') {
        relasiQueryMode = 'public';
      }
      
      const response = await axiosInstance.get(`/relasi-krama/${cleanId}?mode=${relasiQueryMode}`);
      const rawResponseData = response.data?.data || response.data;
      const dataRelasi = Array.isArray(rawResponseData) ? rawResponseData[0] : rawResponseData;
      
      setModalRelasiData(dataRelasi); 
      setIsOpenModalRelasi(true); 
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Gagal memuat detail perubahan data relasi krama.' 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper: membatalkan perubahan data relasi krama
  const handleCancelUpdateRelasi = async (relasiId) => {
    setIsProcessingAction(true);
    try {
      await axiosInstance.patch(`/relasi-krama/cancel-update/${relasiId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Draft usulan perubahan data relasi krama berhasil dibatalkan!' 
      });
      setIsOpenModalRelasi(false);
      fetchAllData();
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal membatalkan draft usulan perubahan data relasi krama.' 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper: mengambil detail data perkawinan
  const fetchDetailPerkawinan = async (perkawinanId) => {
    setIsProcessingAction(true);
    try {
      const cleanId = String(perkawinanId).trim();
      let kawinQueryMode = 'public';

      if (user?.role === 'Super Admin' || user?.role === 'Admin Desa') {
        kawinQueryMode = 'verification';
      } else if (user?.role === 'Krama') {
        const isOwner = krama && (user?.id === krama.user_id || user?.userId === krama.user_id);
        kawinQueryMode = isOwner ? 'personal' : 'public';
      } else if (user?.role === 'Pakar' || user?.role === 'Viewer') {
        kawinQueryMode = 'public';
      }

      const response = await axiosInstance.get(`/perkawinan/${cleanId}?mode=${kawinQueryMode}`);
      const rawData = response.data?.data || response.data;
      const dataPerkawinan = Array.isArray(rawData) ? rawData[0] : rawData;

      setModalKawinData(dataPerkawinan);
      setIsOpenModalKawin(true);
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: 'Gagal memuat detail perubahan data perkawinan adat.'
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper: membatalkan perubahan data perkawinan
  const handleCancelDraftPerceraian = async (perkawinanId) => {
    if (!perkawinanId) return;
    setIsProcessingAction(true);
    try {
      await axiosInstance.patch(`/perkawinan/cerai/cancel-draft/${perkawinanId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Pengajuan data perceraian berhasil dibatalkan!' 
      });
      setIsOpenModalKawin(false);
      setModalKawinData(null);
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal membatalkan data pengajuan perceraian.' 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancelUpdatePerkawinan = async (perkawinanId) => {
    if (!perkawinanId) return;
    setIsProcessingAction(true);
    try {
      await axiosInstance.patch(`/perkawinan/kawin/cancel-update/${perkawinanId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Draft usulan perubahan data perkawinan aktif berhasil dibatalkan!' 
      });
      setIsOpenModalKawin(false);
      setModalKawinData(null);
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal membatalkan perubahan data perkawinan.' 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleCancelUpdatePerceraian = async (perkawinanId) => {
    if (!perkawinanId) return;
    setIsProcessingAction(true);
    try {
      await axiosInstance.patch(`/perkawinan/cerai/cancel-update/${perkawinanId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Draft usulan perubahan data perceraian berhasil dibatalkan!' 
      });
      setIsOpenModalKawin(false);
      setModalKawinData(null);
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Gagal membatalkan perubahan data perceraian.' 
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Helper: menampilkan modal konfirmasi menghapus data
  const handleConfirmDelete = async () => {
    const { type, targetId } = modalDelete;
    if (!targetId) return;

    setModalDelete(prev => ({ 
      ...prev, 
      isOpen: false 
    }));

    if (type === 'relasi') {
      await handleDeleteRelasi(targetId);
    } else if (type === 'krama') {
      await handleDeleteKrama(); 
    } else if (type === 'perkawinan') {
      await handleDeletePerkawinan(targetId); 
    }
  };

  const handleDeleteKrama = async () => {
    if (!realId) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/krama-bali/${realId}`);
      const targetRoute = location.state?.fromPersonal ? '/krama-bali/my-data' : '/krama-bali';
      navigate(targetRoute, { 
        state: { successMessage: 'Data krama bali berhasil dihapus secara permanen!' } 
      });
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menghapus data krama bali.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteRelasi = async (relasiId) => {
    if (!relasiId) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/relasi-krama/${relasiId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Data relasi krama berhasil dihapus secara permanen!' 
      });
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menghapus data relasi krama.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeletePerkawinan = async (perkawinanId) => {
    if (!perkawinanId) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/perkawinan/kawin/cancel-draft/${perkawinanId}`);
      setAlert({ 
        show: true, 
        type: 'success', 
        message: 'Draft pengajuan data perkawinan baru berhasil dihapus secara permanen!' 
      });
      setIsOpenModalKawin(false);
      setModalKawinData(null);
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menghapus draft data perkawinan.'
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper: navigasi ke form edit data
  const handleEditKramaRedirect = () => {
    setIsOpenModalKrama(false);
    const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
    navigate(`/krama-bali/detail/my-data/edit-krama/${slug}`);
  };

  const handleEditRelasiRedirect = () => {
    if (!modalRelasiData || !modalRelasiData.id) return;
    setIsOpenModalRelasi(false);
    const tipeDataAsli = krama?.tipe_data || 'keturunan';
    const slugRelasi = createSlug(krama?.nama_lengkap, tipeDataAsli, modalRelasiData.id);
    navigate(`/krama-bali/detail/my-data/edit-relasi/${slugRelasi}`);
  };

  const handleEditPerkawinanRedirect = () => {
    if (!modalKawinData || !modalKawinData.id) return;
    setIsOpenModalKawin(false);
    const tipeDataAsli = krama?.tipe_data || 'keturunan';
    const slugKawin = createSlug(krama.nama_lengkap, tipeDataAsli, modalKawinData.id);
    navigate(`/krama-bali/detail/my-data/edit-perkawinan/${slugKawin}`);
  };

  const handlePengajuanPerceraianRedirect = () => {
    if (!modalKawinData || !modalKawinData.id) return;
    setIsOpenModalKawin(false);
    const tipeDataAsli = krama?.tipe_data || 'keturunan';
    const slugKawin = createSlug(krama.nama_lengkap, tipeDataAsli, modalKawinData.id);
    navigate(`/krama-bali/detail/my-data/perceraian/${slugKawin}`);
  };

  // Helper: navigasi ke form add data baru
  const handleAddRelasiRedirect = () => {
    if (!krama || !krama.id) {
      console.warn("Data krama utama tidak ditemukan.");
      return;
    }
    setIsOpenModalRelasi(false);
    const tipeDataAsli = krama?.tipe_data || 'keturunan';
    const slugRelasi = createSlug(krama?.nama_lengkap, tipeDataAsli, krama.id);
    navigate(`/krama-bali/detail/my-data/add-relasi/${slugRelasi}`);
  };

  const handleAddPerkawinanRedirect = () => {
    if (!krama || !krama.id) {
      console.warn("Data krama utama tidak ditemukan.");
      return;
    }
    setIsOpenModalKawin(false);
    const tipeDataAsli = krama?.tipe_data || 'keturunan';
    const slugKawin = createSlug(krama?.nama_lengkap, tipeDataAsli, krama.id);
    navigate(`/krama-bali/detail/add-perkawinan/${slugKawin}`, {
      state: {
        kramaUtamaPenuh: krama,
        riwayatPerkawinanBawaan: perkawinanList.filter(p => 
          p && (String(p.suami_id) === String(krama.id) || String(p.istri_id) === String(krama.id))
        )
      }
    });
  };

  // Helper: Menampilkan modal konfirmasi menghapus data krama bali
  const handleTriggerDeleteKrama = () => {
    setModalDelete({
      isOpen: true,
      type: 'krama',
      targetId: realId,
      title: 'Konfirmasi Menghapus Krama Bali',
      message: 'Apakah Anda yakin ingin menghapus data krama bali ini secara permanen beserta seluruh riwayatnya?'
    });
    setIsOpenModalKrama(false);
  };

  const handleTriggerDeleteRelasi = () => {
    if (!modalRelasiData?.id) return
    setModalDelete({
      isOpen: true,
      type: 'relasi',
      targetId: modalRelasiData?.id, 
      title: 'Konfirmasi Menghapus Relasi Krama',
      message: 'Apakah Anda yakin ingin menghapus permanen draft pengajuan data relasi silsilah pada krama bali ini?'
    });
    setIsOpenModalRelasi(false); 
  };

  const handleTriggerDeletePerkawinan = () => {
    if (!modalKawinData?.id) return
    setModalDelete({
      isOpen: true,
      type: 'perkawinan',
      targetId: modalKawinData.id,
      title: 'Konfirmasi Menghapus Perkawinan',
      message: 'Apakah Anda yakin ingin menghapus permanen draft pengajuan data perkawinan pada krama bali ini?'
    });
    setIsOpenModalKawin(false); 
  };

  const handleBack = () => {
    const targetRoute = location.state?.fromPersonal ? '/krama-bali/my-data' : '/krama-bali';
    navigate(targetRoute);
  };

  // Helper: menangani filter data master
  const processedData = useMemo(() => {
    if (!krama) return null;

    const anakRelasiList = relasiList.filter(r => r && String(r.anak_id) === String(krama.id));
    const orangTuaKandung = anakRelasiList.find(r => r.status_hubungan === 'Anak Kandung');
    const orangTuaAngkatList = anakRelasiList.filter(r => r.status_hubungan === 'Anak Angkat');

    const userPerkawinanList = perkawinanList.filter(p => 
      p && (String(p.suami_id) === String(krama.id) || String(p.istri_id) === String(krama.id))
    );

    const perkawinanAktifList = userPerkawinanList.filter(p => p.status_perkawinan === 'Kawin');
    const riwayatPerkawinanLama = userPerkawinanList.filter(p => p.status_perkawinan !== 'Kawin');

    let namaPasanganAktif = "Tidak Ada Pasangan Aktif";

    if (perkawinanAktifList.length > 0) {
      namaPasanganAktif = perkawinanAktifList.map(p => {
        return String(p.suami_id) === String(krama.id)
          ? p.istri?.nama_lengkap || "Istri" 
          : p.suami?.nama_lengkap || "Suami";
      }).join(", ");
    }

    const filteredRiwayatKeluarga = riwayatKeluargaList.filter(r => 
      r && (
        String(r.krama_bali_id) === String(krama.id) || 
        String(r.krama_id) === String(krama.id) ||
        String(r?.krama_bali?.id) === String(krama.id)
      )
    );
    const filteredPeranAdat = peranAdatList.filter(p => 
      p && (
        String(p.krama_bali_id) === String(krama.id) || 
        String(p.krama_id) === String(krama.id) ||
        String(p?.krama_bali?.id) === String(krama.id)
      )
    );

    let wilayahAdatLengkap = "Tidak Diketahui";

    if (krama.is_bali) {
      const desa = krama.wilayah_adat?.nama_desa_adat;
      const kec = krama.wilayah_adat?.kecamatan?.nama_kecamatan;
      const kab = krama.wilayah_adat?.kecamatan?.kabupaten?.nama_kabupaten;
      const prov = krama.wilayah_adat?.kecamatan?.kabupaten?.provinsi?.nama_provinsi;
      
      if (krama.desa_adat_id && desa && kec && kab && prov) {
        wilayahAdatLengkap = `Desa Adat ${desa.trim()}, Kec. ${kec.trim()}, Kab. ${kab.trim()}, Prov. ${prov.trim()}`;
      }
    }
    const alamatAsalLuar = (!krama.is_bali && krama.alamat_luar && krama.alamat_luar.trim() !== "")
      ? krama.alamat_luar.trim()
      : "Tidak Diketahui";

    return {
      orangTuaKandung,
      orangTuaAngkatList,
      perkawinanAktifList,           
      riwayatPerkawinanLama,    
      namaPasanganAktif,
      filteredRiwayatKeluarga,
      filteredPeranAdat,
      wilayahAdatLengkap,
      alamatAsalLuar
    };
  }, [krama, relasiList, perkawinanList, riwayatKeluargaList, peranAdatList]);

  const { 
    status_verifikasi, 
    catatan_admin_desa, 
    is_pending_update, 
    data_perubahan,
    nama_lengkap,
    nama_panggilan,
    jenis_kelamin,
    tanggal_lahir,
    status_hidup,
    is_bali,
    tempat_asal_khusus,
    alamat_luar,
    tipe_data
  } = krama || {};

  // Helper: mengambil data perubahan JSONB
  const renderPerubahanRow = (label, nilaiLama, namaField, type = 'text') => {
    if (!data_perubahan || data_perubahan[namaField] === undefined) return null;

    let nilaiBaru = data_perubahan[namaField];
    let nilaiLamaDiformat = nilaiLama;

    const normalisasiKosong = (val) => {
      if (val === null || val === undefined || String(val).trim().toLowerCase() === "null") return "";
      return String(val).trim();
    };

    if (normalisasiKosong(nilaiLama) === normalisasiKosong(nilaiBaru)) {
      return null;
    }

    if (type === 'date') {
      nilaiLamaDiformat = formatDate(nilaiLama);
      nilaiBaru = formatDate(nilaiBaru);
    }
    if (type === 'boolean') {
      nilaiLamaDiformat = nilaiLama ? 'Krama Bali' : 'Krama Luar Bali';
      nilaiBaru = nilaiBaru ? 'Krama Bali' : 'Krama Luar Bali';
    }
    if (type === 'desa_adat') {
      // mengambil nama desa adat yang aktif
      if (krama?.wilayah_adat?.nama_desa_adat) {
        nilaiLamaDiformat = `Desa Adat ${krama.wilayah_adat.nama_desa_adat.trim()}`;
      } else {
        nilaiLamaDiformat = wilayahAdatLengkap || 'Tidak Diketahui';
      }
      
      const idBaruStr = String(nilaiBaru);
      const idBaruNum = Number(nilaiBaru);

      // mapping nama desa adat yang baru
      if (masterDesaMap && (masterDesaMap[idBaruStr] || masterDesaMap[idBaruNum])) {
        const namaDesaBaru = masterDesaMap[idBaruStr] || masterDesaMap[idBaruNum];
        nilaiBaru = `Desa Adat ${namaDesaBaru.trim()}`;
      } else {
        nilaiBaru = `${nilaiBaru} (Nama desa adat tidak ditemukan)`;
      }
    }

    if (String(nilaiLamaDiformat ?? '').trim() === String(nilaiBaru ?? '').trim()) {
      return null;
    }

    return (
      <tr className="hover:bg-gray-50 transition-colors">
        <td className={styles.labelChange}>
          {label}
        </td>
        <td className="p-3 border-r border-gray-100">
          <span className={styles.oldValue} title={nilaiLamaDiformat}>
            {nilaiLamaDiformat ?? '-'}
          </span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <span className={styles.newValue} title={nilaiBaru}>
              {nilaiBaru ?? '-'}
            </span>
          </div>
        </td>
      </tr>
    );
  };

  const renderPerubahanRelasiRow = (label, nilaiLama, namaField, type = 'text') => {
    let data_perubahan_relasi = modalRelasiData?.data_perubahan;

    if (data_perubahan_relasi && data_perubahan_relasi.data_perubahan) {
      data_perubahan_relasi = data_perubahan_relasi.data_perubahan;
    }
    if (!data_perubahan_relasi || data_perubahan_relasi[namaField] === undefined) {
      return null;
    }

    let nilaiBaru = data_perubahan_relasi[namaField];
    let nilaiLamaDiformat = nilaiLama;

    if (type === 'date') {
      nilaiLamaDiformat = formatDate(nilaiLama);
      nilaiBaru = formatDate(nilaiBaru);
    }
    if (type === 'krama') {
      nilaiLamaDiformat = nilaiLama && String(nilaiLama).trim() !== "null" ? nilaiLama : 'Tidak Diketahui';
      if (namaField === 'ayah_id') {
        const namaAyah = data_perubahan_relasi?.nama_ayah_baru || modalRelasiData?.ayah?.nama_lengkap;
        nilaiBaru = (namaAyah && String(namaAyah).trim() !== "null") ? namaAyah : 'Tidak Diketahui';
      } else if (namaField === 'ibu_id') {
        const namaIbu = data_perubahan_relasi?.nama_ibu_baru || modalRelasiData?.ibu?.nama_lengkap;
        nilaiBaru = (namaIbu && String(namaIbu).trim() !== "null") ? namaIbu : 'Tidak Diketahui';
      }
    }

    if (String(nilaiLamaDiformat).trim() === String(nilaiBaru).trim()) return null;

    return (
      <tr className="hover:bg-gray-50 transition-colors" key={namaField}>
        <td className={styles.labelChange}>
          {label}
        </td>
        <td className="p-3 border-r border-gray-100">
          <span className={styles.oldValue}>
            {nilaiLamaDiformat ?? '-'}
          </span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <span className={styles.newValue}>
              {nilaiBaru ?? '-'}
            </span>
          </div>
        </td>
      </tr>
    );
  };

const renderPerubahanPerkawinanRow = (label, nilaiLama, namaField, type = 'text') => {
  let data_perubahan_kawin = modalKawinData?.data_perubahan;

  if (data_perubahan_kawin && data_perubahan_kawin.data_perubahan) {
    data_perubahan_kawin = data_perubahan_kawin.data_perubahan;
  }
  if (!data_perubahan_kawin) return null;

  let nilaiBaru;

  if (data_perubahan_kawin.PERCERAIAN && data_perubahan_kawin.PERCERAIAN[namaField] !== undefined) {
    nilaiBaru = data_perubahan_kawin.PERCERAIAN[namaField];
  } else if (data_perubahan_kawin.UPDATE_PERKAWINAN && data_perubahan_kawin.UPDATE_PERKAWINAN[namaField] !== undefined) {
    nilaiBaru = data_perubahan_kawin.UPDATE_PERKAWINAN[namaField];
  } else if (data_perubahan_kawin[namaField] !== undefined) {
    nilaiBaru = data_perubahan_kawin[namaField];
  } else {
    return null;
  }

  let nilaiLamaDiformat = nilaiLama;
  let nilaiBaruDiformat = nilaiBaru;

  // 1. Format Tipe Tanggal
  if (type === 'date') {
    nilaiLamaDiformat = formatDate(nilaiLama);
    nilaiBaruDiformat = formatDate(nilaiBaru);
  }

  // ============================================================
  // LOGIKA TRANSLASI NAMA PURUSA / PRADANA (ANTI ID ANGKA LAMA)
  // ============================================================
  if (namaField === 'suami_id' || namaField === 'istri_id') {
    const relasiKey = namaField === 'suami_id' ? 'suami' : 'istri';
    const kramaLama = modalKawinData?.[relasiKey];

    // Tampilkan Nama Lengkap Krama Lama jika objek relasinya tersedia dari Eager Loading
    if (kramaLama?.nama_lengkap) {
      const isLamaDraft = kramaLama?.status_verifikasi === 'Draft';
      nilaiLamaDiformat = `${kramaLama.nama_lengkap}${isLamaDraft ? ' [DRAFT]' : ''}`;
    } else if (nilaiLama) {
      nilaiLamaDiformat = `Krama ID: ${nilaiLama}`;
    }

    // Terjemahkan Nilai Baru jika terjadi pergantian Krama Pasangan
    if (String(nilaiBaru) === String(kramaLama?.id || nilaiLama)) {
      nilaiBaruDiformat = nilaiLamaDiformat;
    } else {
      // Kasus data berubah ekstrem (pilih krama baru): Bongkar titipan nama baru di catatan_update
      let namaDariCatatan = "";
      try {
        const targetSearchObj = data_perubahan_kawin.UPDATE_PERKAWINAN || data_perubahan_kawin;
        const parsedCatatan = JSON.parse(targetSearchObj?.catatan_update || modalKawinData?.catatan_update);
        namaDariCatatan = parsedCatatan?.nama_pasangan_baru || "";
      } catch (e) { e
        namaDariCatatan = "";
      }

      if (namaDariCatatan) {
        nilaiBaruDiformat = `${namaDariCatatan} [DRAFT]`;
      } else if (data_perubahan_kawin?.[relasiKey]?.nama_lengkap) {
        nilaiBaruDiformat = `${data_perubahan_kawin[relasiKey].nama_lengkap} [DRAFT]`;
      } else {
        nilaiBaruDiformat = `Krama ID: ${nilaiBaru} [DRAFT]`;
      }
    }
  }

  // Sembunyikan baris jika tidak ada perubahan nilai nyata
  if (String(nilaiLamaDiformat ?? '').trim() === String(nilaiBaruDiformat ?? '').trim()) {
    return null;
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors" key={namaField}>
      <td className={styles.labelChange}>
        {label}
      </td>
      <td className="p-3 border-r border-gray-100">
        <span className={styles.oldValue}>
          {nilaiLamaDiformat ?? '-'}
        </span>
      </td>
      <td className="p-3">
        <div className="flex items-center gap-2">
          <FaArrowRight className={styles.arrows} />
          <span className={styles.newValue}>
            {nilaiBaruDiformat?.includes('[DRAFT]') ? (
              <>
                {nilaiBaruDiformat.replace(' [DRAFT]', '')} 
                <span className={styles.labelDraftChange}>DRAFT</span>
              </>
            ) : (
              nilaiBaruDiformat ?? '-'
            )}
          </span>
        </div>
      </td>
    </tr>
  );
};

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>MEMUAT DATA...</p>
      </div>
    );
  }

  if (!krama || !processedData) {
    return (
      <div className={styles.fieldFetchData}>
        Data krama bali tidak ditemukan
      </div>
    );
  }

  const {
    orangTuaKandung,
    orangTuaAngkatList,
    riwayatPerkawinanLama,
    perkawinanAktifList,
    filteredRiwayatKeluarga,
    filteredPeranAdat,
    wilayahAdatLengkap,
    alamatAsalLuar
  } = processedData;

  return (
    <div className={styles.detailContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Data Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Informasi lengkap mengenai krama bali yang termasuk ke dalam silsilah Adat Bali
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
                              if (notif.tautan_fitur) window.location.href = notif.tautan_fitur;
                            }}
                            className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}
                          >
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
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modalDelete.isOpen}
        title={modalDelete.title}
        message={modalDelete.message}
        onClose={() => setModalDelete(prev => ({ ...prev, isOpen: false }))}
        onConfirm={handleConfirmDelete}
        isProcessing={isDeleting || isProcessingAction}
      />
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
      <div className="p-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* CARD: Data Krama Bali */}
            <div className="relative">
              <ModernCard title="Identitas Krama Bali" icon={<FaUser className="text-white" />}>
                <div className={styles.fieldReg}>
                  <FaIdCardAlt className="text-amber-700 text-xs mb-0.5" />
                  <span className="text-[10px] font-semibold text-amber-800 uppercase tracking-wider mr-1">
                    No. Reg:
                  </span>
                  <span className="font-mono font-extrabold tracking-wider text-stone-900 text-xs">
                    {krama.nomor_pendaftaran || "-"}
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <InfoItem 
                    label="Nama Lengkap" 
                    icon={<FaIdCard />} 
                    value={krama.nama_lengkap} 
                  />
                  <InfoItem 
                    label="Nama Panggilan" 
                    icon={<FaUser />} 
                    value={krama.nama_panggilan} 
                  />
                  <InfoItem 
                    label="Jenis Kelamin" 
                    icon={<FaVenusMars />} 
                    value={krama.jenis_kelamin} 
                  />
                  <InfoItem 
                    label="Tanggal Lahir" 
                    icon={<FaBirthdayCake />} 
                    value={formatDate(krama.tanggal_lahir)} 
                  />
                  <InfoItem 
                    label="Tipe Data" 
                    icon={<FaSitemap />} 
                    value={krama.tipe_data} 
                  />
                  <InfoItem 
                    label="Status Hidup" 
                    icon={<FaHeart className={krama.status_hidup === "Meninggal" 
                      ? "text-gray-400 text-xs" 
                      : "text-red-600 text-xs"} />
                    }
                    value={(() => {
                      let colorClass = 'bg-blue-100 text-blue-600'; 
                      if (krama.status_hidup === 'Hidup') {
                        colorClass = 'bg-green-100 text-green-700';
                      } else if (krama.status_hidup === 'Meninggal') {
                        colorClass = 'bg-red-100 text-red-700';
                      } else if (krama.status_hidup === 'Tidak Diketahui') {
                        colorClass = 'bg-gray-200 text-gray-700';
                      }
                      return (
                        <span className={`${styles.statusHidup} ${colorClass}`}>
                          {krama.status_hidup}
                        </span>
                      );
                    })()}
                  />
                  <div className="md:col-span-2 space-y-4">
                    {krama.is_bali ? (
                      <>
                        <InfoItem 
                          label="Tempat Asal Khusus" 
                          value={krama.tempat_asal_khusus?.trim() ? krama.tempat_asal_khusus : "-"} 
                          icon={<FaMapMarkerAlt />} 
                        />
                        <InfoItem 
                          label="Wilayah Adat/Asal Krama" 
                          value={wilayahAdatLengkap} 
                          icon={<FaMapMarkerAlt />} 
                        />
                      </>
                    ) : (
                      <InfoItem 
                        label="Alamat Asal" 
                        value={alamatAsalLuar} 
                        icon={<FaMapMarkerAlt />} 
                      />
                    )}
                  </div>
                </div>
                {hasAccess && (
                  <div className="flex justify-end mt-3 border-t border-gray-100">
                    <button onClick={() => setIsOpenModalKrama(true)} className={styles.btnInfoDetail}>
                      <FaEdit className="mb-0.5"/> Kelola Data
                    </button>
                  </div>
                )}
              </ModernCard>
            </div>
            {/* Data Orang Tua */}
            <div className={styles.cardSection}>
              <div className={styles.headerSection}>
                <FaUsers className="text-white" />
                <h3 className={styles.titleSection}>
                  Informasi Orang Tua
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {orangTuaKandung && (
                  <div>
                    <div className={styles.headerCard}>
                      <FaUsers className="text-amber-700 text-sm" />
                      <h4 className={styles.titleHeader}>
                        Orang Tua Kandung {(!orangTuaKandung.ayah_id || !orangTuaKandung.ibu_id) && '(Histori Leluhur)'}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-1">
                      <div className="md:col-span-2 flex flex-col gap-4">
                        {orangTuaKandung?.ayah?.nama_lengkap ? (
                          <IconInfoRow 
                            icon={<FaUser className="text-blue-600" />} 
                            label="Ayah Kandung" 
                            value={orangTuaKandung.ayah.nama_lengkap} 
                          />
                        ) : (
                          <p className="text-xs text-gray-400 italic pl-8">
                            Data Ayah Tidak Tercatat
                          </p>
                        )}
                        {orangTuaKandung?.ibu?.nama_lengkap ? (
                          <IconInfoRow 
                            icon={<FaUser className="text-pink-600" />} 
                            label="Ibu Kandung" 
                            value={orangTuaKandung.ibu.nama_lengkap} 
                          />
                        ) : (
                          <p className="text-xs text-gray-400 italic pl-8">
                            Data Ibu Tidak Tercatat
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-1 flex flex-col gap-4 justify-start">
                        {orangTuaKandung?.urutan_lahir && (
                          <IconInfoRow 
                            icon={<FaList className="text-gray-500" />} 
                            label="Urutan Lahir" 
                            value={`Anak ke-${orangTuaKandung.urutan_lahir}`} 
                          />
                        )}
                      </div>
                    </div>
                    {hasAccess && orangTuaKandung.id && (
                      <div className="flex justify-end mt-3 border-t border-gray-100/50 pt-2">
                        <button 
                          onClick={() => {
                            setModalRelasiData(null);
                            fetchDetailRelasi(orangTuaKandung.id);
                          }}
                          className={styles.btnInfoDetail}>
                          <FaEdit className="mb-0.5 mr-1"/> Kelola Ortu Kandung
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {orangTuaAngkatList.map((angkat, idx) => (
                  <div key={idx} className={styles.cardOrtu}>
                    <div className={styles.headerCard}>
                      <FaUsers className="text-orange-700 text-sm" />
                      <h4 className={styles.titleHeader}>
                        Orang Tua Angkat {orangTuaAngkatList.length > 1 ? `#${idx + 1}` : ''}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-1">
                      <div className="md:col-span-2 flex flex-col gap-4">
                        {angkat?.ayah?.nama_lengkap && (
                          <IconInfoRow 
                            icon={<FaUser className="text-blue-500" />} 
                            label="Ayah Angkat" 
                            value={angkat.ayah.nama_lengkap} 
                          />
                        )}
                        {angkat?.ibu?.nama_lengkap && (
                          <IconInfoRow 
                            icon={<FaUser className="text-pink-500" />} 
                            label="Ibu Angkat" 
                            value={angkat.ibu.nama_lengkap} 
                          />
                        )}
                      </div>
                      <div className="md:col-span-1 flex flex-col gap-4 justify-start">
                        {angkat?.urutan_lahir && (
                          <IconInfoRow 
                            icon={<FaList className="text-gray-500" />} 
                            label="Urutan Lahir"
                            value={`Anak ke-${angkat.urutan_lahir}`} 
                          />
                        )}
                        {angkat?.tanggal_pengangkatan && (
                          <IconInfoRow 
                            icon={<FaCalendarAlt className="text-orange-500" />} 
                            label="Tanggal Pengangkatan" 
                            value={formatDate(angkat.tanggal_pengangkatan)} 
                          />
                        )}
                      </div>
                    </div>
                    {hasAccess && angkat.id && (
                      <div className="flex justify-end mt-3 border-t border-gray-100/50 pt-2">
                        <button 
                          onClick={() => {
                            setModalRelasiData(null);
                            fetchDetailRelasi(angkat.id);
                          }}
                          className={styles.btnInfoDetail}>
                          <FaEdit className="mb-0.5 mr-1"/> Kelola Ortu Angkat
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!orangTuaKandung && orangTuaAngkatList.length === 0 && (
                  <p className="text-gray-400 text-xs italic text-center py-2">
                    Data orang tua belum terdaftar di dalam sistem silsilah adat Bali
                  </p>
                )}
                {hasAccess && !orangTuaKandung && orangTuaAngkatList.length === 0 && (
                  <div className="flex justify-end mt-3 border-t border-gray-100">
                    <button 
                      onClick={() => {
                        setModalRelasiData(null);
                        setIsOpenModalRelasi(true);
                      }}
                      className={styles.btnInfoDetail}>
                      <FaEdit className="mb-0.5"/> 
                      <span>Hubungkan Relasi Baru</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* Data Perkawinan */}
            <div className={styles.cardSection}>
              <div className={styles.headerSection}>
                <FaUserFriends className="text-white" />
                <h3 className={styles.titleSection}>
                  Informasi Perkawinan Adat
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-1.5 text-amber-900 mb-1">
                    <FaHeart className={
                      perkawinanAktifList && perkawinanAktifList.length > 0 
                        ? "text-pink-600 text-xs mb-0.5" 
                        : "text-gray-400 text-xs mb-0.5"
                      } />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Perkawinan Aktif Saat Ini {perkawinanAktifList?.length > 1 && `(${perkawinanAktifList.length})`}
                    </span>
                  </div>
                  {perkawinanAktifList && perkawinanAktifList.length > 0 ? (
                    <div className="space-y-4">
                      {perkawinanAktifList.map((pAktif, index) => {
                        console.log("DEBUG DATA PERKAWINAN CARD:", pAktif);
                        const namaPasanganAktif = String(pAktif.suami_id) === String(krama.id)
                          ? pAktif.istri?.nama_lengkap || "Istri"
                          : pAktif.suami?.nama_lengkap || "Suami";

                        const noRegPasanganAktif = String(pAktif.suami_id) === String(krama.id)
                          ? (pAktif.istri?.nomor_pendaftaran || pAktif.nomor_pendaftaran_istri || "-")
                          : (pAktif.suami?.nomor_pendaftaran || pAktif.nomor_pendaftaran_suami || "-"); 

                        return (
                          <div key={pAktif.id || index} className={`${styles.cardPerkawinan} fallback-style`}>
                            <div className="flex justify-between items-center mb-3">
                              <div className="flex items-center gap-2">
                                <span className={styles.titleCardPerkawinan}>
                                  Perkawinan #{index + 1}
                                </span>
                                <span title="Nomor pendaftaran perkawinan ke dalam sistem" className={styles.labelRegPwh}>
                                  {pAktif.nomor_pendaftaran || "-"}
                                </span>
                              </div>
                              <span className={styles.titleStatus}>
                                Kawin
                              </span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                              <InfoItem 
                                label="Jenis Perkawinan" 
                                value={pAktif.jenis_perkawinan} 
                                icon={<FaIdCard/>} 
                              />
                              <InfoItem 
                                label="Tanggal Perkawinan" 
                                value={formatDate(pAktif.tanggal_perkawinan)} 
                                icon={<FaCalendarAlt/>} 
                              />
                              <InfoItem 
                                label="Nama Pasangan" 
                                value={
                                  <div className={styles.fieldPasangan}>
                                    <span className={styles.fieldNama}>
                                      {namaPasanganAktif}
                                    </span>
                                    <div title="Nomor pendaftaran krama di dalam sistem" className={styles.fieldKramaPwh}>
                                      <span>No.Reg: {noRegPasanganAktif}</span>
                                    </div>
                                  </div>
                                } 
                                icon={<FaUser/>} 
                              />
                            </div>
                            {hasAccess && (
                              <div className="flex justify-end mt-3 border-t border-gray-100">
                                <button 
                                  onClick={() => fetchDetailPerkawinan(pAktif.id)} 
                                  disabled={isProcessingAction}
                                  className={styles.btnInfoDetail}>
                                  <FaEdit className="mb-0.5"/> Kelola Perkawinan
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-lg border border-gray-100/70">
                      <p className="text-gray-400 text-xs italic text-center py-2">
                        Data perkawinan adat saat ini tidak ada yang tercatat aktif
                      </p>
                    </div>
                  )}
                </div>
                {riwayatPerkawinanLama.length > 0 && (
                  <div className="space-y-3 pt-2 border-t border-gray-100">
                    <span className={styles.titlePerkawinanLama}>
                      Riwayat Perkawinan Lampau ({riwayatPerkawinanLama.length})
                    </span>
                    <div className={styles.toggleRiwayat}>
                      {riwayatPerkawinanLama.map((pLama, idx) => {
                        const namaPasanganLama = String(pLama.suami_id) === String(krama.id)
                          ? pLama.istri?.nama_lengkap || "Istri" 
                          : pLama.suami?.nama_lengkap || "Suami";
                        const isCeraiMati = pLama.status_perkawinan?.toLowerCase().includes('mati');
                        const noRegPasanganLama = String(pLama.suami_id) === String(krama.id)
                          ? (pLama.istri?.nomor_pendaftaran || pLama.nomor_pendaftaran_istri || "-")
                          : (pLama.suami?.nomor_pendaftaran || pLama.nomor_pendaftaran_suami || "-");

                        return (
                          <div key={pLama.id || idx} className="relative group">
                            <div className={`${styles.toggleDot} ${isCeraiMati ? styles.dotAktif : styles.dotLampau}`} />
                            <div className={styles.cardRiwayat}>
                              <div className="space-y-2 flex-1">
                                <div className="flex flex-col items-start justify-start">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-bold text-gray-800 text-sm tracking-tight block">
                                      {namaPasanganLama}
                                    </span>
                                    <span className={styles.titleJenis}>
                                    Perkawinan {pLama.jenis_perkawinan}
                                  </span>
                                    <span title="Nomor pendaftaran perkawinan ke dalam sistem" className={styles.labelRegCr}>
                                      {pLama.nomor_pendaftaran || "-"}
                                    </span>
                                  </div>
                                  <div title="Nomor pendaftaran krama di dalam sistem" className={styles.fieldKramaCr}>
                                    <span>No.Reg: {noRegPasanganLama}</span>
                                  </div>
                                </div>
                                <div className="text-xs text-gray-500 flex items-center gap-1.5">
                                  <FaCalendarAlt className="text-gray-300 mb-0.5 text-[11px]" />
                                  <span>Periode:</span>
                                  <span className="py-0.5 text-[11px] font-medium">
                                    {formatDate(pLama.tanggal_perkawinan)}
                                  </span>
                                  <span className="text-gray-400 text-[11px]">s/d</span>
                                  <span className={`py-0.5 text-[11px] font-semibold ${isCeraiMati ? 'text-amber-700' : 'text-red-700'}`}>
                                    {formatDate(pLama.tanggal_cerai || pLama.selesai_tanggal)}
                                  </span>
                                </div>
                                {pLama.ketetapan_silsilah_istri && (
                                  <div className="mt-2 inline-flex items-center text-[10px] italic text-amber-800 bg-amber-50 px-2 py-0.5 border-l-2 border-amber-400 rounded-r">
                                    Ketetapan Silsilah Pihak Predana: 
                                    <strong className="ml-1">{pLama.ketetapan_silsilah_istri}</strong>
                                  </div>
                                )}
                              </div>
                              <div className={styles.badgeStatus}>
                                <span className={`${styles.labelStatus} ${isCeraiMati ? styles.labelCeraiMati : styles.labelCerai}`}>
                                  {pLama.status_perkawinan}
                                </span>
                                {hasAccess && (
                                  <button 
                                    onClick={() => { 
                                      setModalKawinData(pLama); 
                                      setIsOpenModalKawin(true); 
                                    }}  
                                    className={styles.eyeLog}>
                                    <FaEye className="text-xs" />
                                    <span>Detail Log</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {/* Button Action */}
                {hasAccess && (!perkawinanAktifList || perkawinanAktifList.length === 0) && (
                  <div className="flex justify-end mt-3 border-t border-gray-100">
                    <button 
                      onClick={() => { 
                        setModalKawinData(null); 
                        setIsOpenModalKawin(true); 
                      }} 
                      className={styles.btnInfoDetail}>
                      <FaEdit className="mb-0.5"/> 
                      <span>Perkawinan Baru</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* KOLOM KANAN */}
          <div className="space-y-6">
            {/* Riwayat Peran Adat */}
            <ModernCard title="Riwayat Peran Adat" icon={<MdHistory className="text-white" />}>
              <div className={styles.riwayatAdatSection}>
                {filteredPeranAdat.length === 0 ? (
                  <p className="text-gray-400 text-xs italic text-center py-4">
                    Tidak ada riwayat status peran adat
                  </p>
                ) : (
                  filteredPeranAdat.map((peran, idx) => (
                    <TimelineItem 
                      key={idx}
                      title={peran.status_peran_adat}
                      date={`${formatDate(peran.mulai_tanggal)} - ${peran.selesai_tanggal ? formatDate(peran.selesai_tanggal) : 'Sekarang'}`}
                      desc={peran.dasar_keputusan}
                      badge={getStatusBadge(!peran.selesai_tanggal)}
                    />
                  ))
                )}
              </div>
            </ModernCard>
            {/* Riwayat Keluarga */}
            <div className={styles.riwayatSection}>
              <h3 className={styles.riwayatTitle}>
                <MdFamilyRestroom size={16} /> Riwayat Keluarga
              </h3>
              <div className="space-y-5">
                {filteredRiwayatKeluarga.length === 0 ? (
                  <p className="text-gray-400 text-xs italic">
                    Belum terdaftar dalam keluarga manapun
                  </p>
                ) : (
                  filteredRiwayatKeluarga.map((kel, idx) => {
                    const isActive = kel.akhir_masuk === null;
                    const keluargaData = keluargaMap[kel.keluarga_id || kel.keluarga?.id];
                    const namaKepala = keluargaData ? keluargaData.nama_kepala : "Tidak Diketahui";
                    
                    let jenisKeluarga = keluargaData?.jenis_keluarga || kel.keluarga?.jenis_keluarga || "Anggota Keluarga";

                    if (['Biasa', 'Nyentana', 'Pade Gelahang'].includes(jenisKeluarga)) {
                      jenisKeluarga = `Keluarga Perkawinan ${jenisKeluarga}`;
                    } else if (['Leluhur'].includes(jenisKeluarga)) {
                      jenisKeluarga = `Keluarga ${jenisKeluarga}`;
                    }

                    return (
                      <div key={idx} className={styles.jalurRiwayat}>
                        <div className={`${styles.jalurAktif} ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <p className={styles.tanggalAktif}>
                          {formatDate(kel.awal_masuk)} - {isActive ? 'Sekarang' : formatDate(kel.akhir_masuk)}
                        </p>
                        <h4 className="text-sm font-bold text-gray-800">
                          {jenisKeluarga}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Kepala Keluarga: <span className="font-semibold text-gray-700">
                            {namaKepala}
                          </span>
                        </p>
                        <p className={styles.kedudukan}>
                          {kel.kedudukan}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            <div className={styles.btnGroup}>
              <button 
                onClick={() => {
                  const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
                  navigate(`/krama-bali/detail/silsilah/${slug}`);
                }}
                className={styles.btnVisualisasi}>
                <FaSitemap /> Visualisasi Silsilah
              </button>
              <button onClick={handleBack} className={styles.btnBackNetral}>
                <FaArrowLeft /> Kembali
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer />
      {/* MODAL DETAIL VERIFIKASI DATA KRAMA BALI */}
      {isOpenModalKrama && krama && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3>
                <FaUserCog size={21} className="text-amber-700 mr-2" /> 
                <span>Status & Pengelolaan Krama Bali</span>
              </h3>
              <button onClick={() => setIsOpenModalKrama(false)}>
                <FaTimes size={15} className={styles.iconClose} />
              </button>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className={styles.cardVerification}>
                <div className="text-center">
                  <span className={styles.labelColumn}>
                    Status Verifikasi
                  </span>
                  <span className={`${styles.badge} ${
                    status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                    status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                    {status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                    {status_verifikasi === 'Draft' && <FaHourglassHalf size={10} />}
                    {krama.status_verifikasi || 'Draft'}
                  </span>
                </div>
                <div className="text-center">
                  <span className={styles.labelColumn}>
                    Status Sinkronisasi
                  </span>
                  {is_pending_update || status_verifikasi === "Draft" ? (
                    <span className={styles.badgePending}>
                      <FaExclamationTriangle size={11} className="mb-0.5" /> 
                      <span>Menunggu Verifikasi</span>
                    </span>
                  ) : status_verifikasi === "Ditolak" ? (
                    <span className={styles.badgeRejected}>
                      <FaTimes size={11} /> 
                      <span>Pengajuan Ditolak</span>
                    </span>
                  ) : (
                    <span className={styles.badgeSuccess}>
                      <FaCheck size={11} /> 
                      <span>Data Aktif & Sinkron</span>
                    </span>
                  )}
                </div>
                {catatan_admin_desa && (
                  <div className={styles.noteColumn}>
                    <span className={styles.labelColumn}>
                      Catatan Validasi Admin Desa
                    </span>
                    <p className="italic text-black p-1">
                      {catatan_admin_desa}
                    </p>
                  </div>
                )}
              </div>
              {/* DATA PERUBAHAN */}
              {is_pending_update && data_perubahan && (
                <div className={styles.cardAreaChange}>
                  <h4 className={styles.cardTitle}>
                    <FaExclamationTriangle className={styles.cardIcon} /> 
                    Draft Usulan Perubahan Data Krama Bali Anda
                  </h4>
                  <div className={styles.cardTable}>
                    <table className={styles.table}>
                      <thead>
                        <tr className={styles.tableHeader}>
                          <th className="p-3 w-1/4">Kategori</th>
                          <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                          <th className="p-3 w-3/8">Usulan Perubahan</th>
                        </tr>
                      </thead>
                      <tbody className={styles.tableBody}>
                        {renderPerubahanRow("Nama Lengkap", nama_lengkap, "nama_lengkap")}
                        {renderPerubahanRow("Nama Panggilan", nama_panggilan, "nama_panggilan")}
                        {renderPerubahanRow("Jenis Kelamin", jenis_kelamin, "jenis_kelamin")}
                        {renderPerubahanRow("Tanggal Lahir", tanggal_lahir, "tanggal_lahir", "date")}
                        {renderPerubahanRow("Status Hidup", status_hidup, "status_hidup")}
                        {renderPerubahanRow("Asal Wilayah", is_bali, "is_bali", "boolean")}
                        {renderPerubahanRow("Desa Adat", krama.desa_adat_id, "desa_adat_id", "desa_adat")}
                        {renderPerubahanRow("Tempat Asal Khusus", tempat_asal_khusus, "tempat_asal_khusus")}
                        {renderPerubahanRow("Alamat Luar", alamat_luar, "alamat_luar")}
                        {renderPerubahanRow("Tipe Data", tipe_data, "tipe_data")}
                      </tbody>
                    </table>
                  </div>
                  <div className={styles.noteBtnGroup}>
                    <span >💡</span>
                    <p className="italic font-medium">
                      Fitur modifikasi dan penghapusan data dikunci sementara waktu hingga Admin Desa memeriksa dan mengesahkan draft perubahan di atas. Anda dapat membatalkan usulan ini jika ingin mengunci kembali data aktif.
                    </p>
                  </div>
                </div>
              )}
            </div>
            {/* Button Action */}
            <div className="mt-6 flex gap-2 justify-end pt-3">
              {is_pending_update ? (
                <button onClick={handleCancelUpdateKrama} className={styles.btnRejectModal} disabled={isProcessingAction}>
                  <FaTimes className="mr-2" /> 
                  {isProcessingAction ? 'Memproses...' : 'Batalkan Perubahan'}
                </button>
              ) : (
                <>
                  <button onClick={handleEditKramaRedirect} className={styles.btnEditModal}disabled={isProcessingAction}>
                    <FaEdit size={12} className="mr-2 mb-0.5" /> Edit Identitas
                  </button>
                  <button onClick={handleTriggerDeleteKrama} className={styles.btnRejectModal} disabled={isProcessingAction}>
                    <FaTrash size={10} className="mr-2 mb-0.5" /> Hapus Data
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL DETAIL VERIFIKASI DATA RELASI KRAMA */}
      {isOpenModalRelasi && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} max-h-[90vh] flex flex-col overflow-hidden`}>
            <div className={`${styles.headerModal} flex-shrink-0`}>
              <h3>
                <FaUsers size={21} className="text-amber-700 mr-2" /> 
                {!modalRelasiData ? 'Hubungan Keluarga' : 'Status & Pengelolaan Relasi'}
              </h3>
              <button onClick={() => { 
                setIsOpenModalRelasi(false); 
                setModalRelasiData(null); 
                setModalRelasiData(null);
              }}>
                <FaTimes size={15} className={styles.iconClose} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 pr-2 space-y-4">
              {/* Kondisi 1: Belum ada data relasi yang tercatat */}
              {!modalRelasiData ? (
                <>
                  <div className="p-8 text-center space-y-4">
                    <div className={styles.iconModalEmpty}>
                      <FaUsers className="text-gray-500 text-xl" />
                    </div>
                    <div className="space-y-1">
                      <h4 className={styles.titleModalEmpty}>
                        Belum Ada Relasi Silsilah
                      </h4>
                      <p className={styles.descModalEmpty}>
                        Krama ini belum terhubung dengan data silsilah orang tua (Ayah/Ibu) di dalam sistem silsilah adat Bali.
                      </p>
                    </div>
                  </div>
                  {hasAccess && (
                    <div className="mt-6 flex gap-2 justify-end pt-3">
                      <button onClick={handleAddRelasiRedirect} className={styles.btnAddGreen}>
                        <FaPlusCircle size={12} className="mr-2" /> 
                        <span>Ajukan Relasi Baru</span>
                      </button>
                    </div>
                  )}
                </>
              ) : (
                /* Kondisi 2: Data relasi telah tercatat */
                <>
                  <div className="space-y-2 text-[11px]">
                    <div className={styles.cardVerification}>
                      <div className="text-center">
                        <span className={styles.labelColumn}>
                          Status Verifikasi
                        </span>
                        <span className={`${styles.badge} ${
                          modalRelasiData.status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                          modalRelasiData.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {modalRelasiData.status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                          {modalRelasiData.status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                          {(
                            modalRelasiData.status_verifikasi === 'Draft' || 
                            modalRelasiData.status_verifikasi === 'Menunggu Penerimaan' || 
                            modalRelasiData.status_verifikasi === 'Menunggu Pelepasan'
                          ) && <FaHourglassHalf size={10} />}
                          <span>
                            {modalRelasiData.status_verifikasi || 'Draft'}
                          </span>
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={styles.labelColumn}>
                          Status Sinkronisasi
                        </span>
                        {modalRelasiData.is_pending_update || modalRelasiData.status_verifikasi === 'Draft' ||
                        modalRelasiData.status_verifikasi === 'Menunggu Penerimaan' ||
                        modalRelasiData.status_verifikasi === 'Menunggu Pelepasan' ? (
                          <span className={styles.badgePending}>
                            <FaExclamationTriangle size={11} className="mb-0.5" /> 
                            <span>Menunggu Verifikasi</span>
                          </span>
                        ) : (
                          <span className={styles.badgeSuccess}>
                            <FaCheck size={11} />
                            <span>Data Aktif & Sinkron</span> 
                          </span>
                        )}
                      </div>
                      {modalRelasiData.catatan_admin_desa && (
                        <div className={styles.noteColumn}>
                          <span className={styles.labelColumn}>
                            Catatan Validasi Admin Desa
                          </span>
                          <p className="italic text-black p-1">
                            {modalRelasiData.catatan_admin_desa}
                          </p>
                        </div>
                      )}
                    </div>
                    {/* DATA PERUBAHAN */}
                    {modalRelasiData.is_pending_update && modalRelasiData.data_perubahan && (
                      <div className={styles.cardAreaChange}>
                        <h4 className={styles.cardTitle}>
                          <FaExclamationTriangle className={styles.cardIcon} /> 
                          Draft Usulan Perubahan Data Relasi Krama Bali Anda
                        </h4>
                        <div className={styles.cardTable}>
                          <table className={styles.table}>
                            <thead>
                              <tr className={styles.tableHeader}>
                                <th className="p-3 w-1/4">Kategori</th>
                                <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                                <th className="p-3 w-3/8">Usulan Perubahan</th>
                              </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                              {renderPerubahanRelasiRow("Ayah Kandung/Angkat", modalRelasiData.ayah?.nama_lengkap || 'Tidak Diketahui', "ayah_id", "krama")}
                              {renderPerubahanRelasiRow("Ibu Kandung/Angkat", modalRelasiData.ibu?.nama_lengkap || 'Tidak Diketahui', "ibu_id", "krama")}
                              {renderPerubahanRelasiRow("Status Hubungan", modalRelasiData.status_hubungan, "status_hubungan")}
                              {renderPerubahanRelasiRow("Urutan Lahir (Anak Ke)", modalRelasiData.urutan_lahir, "urutan_lahir")}
                              {renderPerubahanRelasiRow("Tanggal Pengangkatan Anak", modalRelasiData.tanggal_pengangkatan, "tanggal_pengangkatan", "date")}
                            </tbody>
                          </table>
                        </div>
                        <div className={styles.noteBtnGroup}>
                          <span>💡</span>
                          <p className="italic font-medium">
                            Fitur modifikasi dan penghapusan hubungan dikunci sementara waktu hingga Admin Desa memeriksa dan mengesahkan draft perubahan.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Button Action */}
                  <div className="mt-6 flex gap-2 justify-end pt-3">
                    {modalRelasiData.is_pending_update ? (
                      hasAccess && (
                        <button onClick={() => handleCancelUpdateRelasi(modalRelasiData.id)} className={styles.btnRejectModal}>
                          <FaTimes className="mr-2" /> Batalkan Perubahan
                        </button>
                      )
                    ) : (
                      hasAccess && (
                        <>
                          <button onClick={handleAddRelasiRedirect} className={styles.btnAddGreen}>
                            <FaPlusCircle size={12} className="mr-2" /> 
                            <span>Ajukan Relasi Baru</span>
                          </button>
                          <button onClick={handleEditRelasiRedirect} className={styles.btnEditModal}>
                            <FaEdit size={12} className="mr-2 mb-0.5" /> Edit Relasi
                          </button>
                          <button onClick={handleTriggerDeleteRelasi} className={styles.btnRejectModal}>
                            <FaTrash size={10} className="mr-2 mb-0.5" /> Hapus Relasi
                          </button>
                        </>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL DETAIL VERIFIKASI DATA PERKAWINAN ADAT */}
      {isOpenModalKawin && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} max-h-[90vh] flex flex-col overflow-hidden`}>
            <div className={`${styles.headerModal} flex-shrink-0`}>
              <h3>
                <FaUserFriends size={21} className="text-amber-700 mr-2" /> 
                {!modalKawinData ? 'Pendaftaran Perkawinan Adat' : 'Status & Pengelolaan Perkawinan'}
              </h3>
              <button onClick={() => { 
                setIsOpenModalKawin(false); 
                setModalKawinData(null); 
                setModalKawinData(null);
              }}>
                <FaTimes size={15} className={styles.iconClose} />
              </button>
            </div>
              <div className="flex-1 overflow-y-auto p-1 pr-2 space-y-4">
              {/* Kondisi 1: Belum ada data perkawinan */}
              {!modalKawinData ? (
                <>
                  <div className="p-8 text-center space-y-4">
                    <div className={styles.iconModalEmpty}>
                      <FaHeart className="text-gray-500 text-xl" />
                    </div>
                    <div className="space-y-1">
                      <h4 className={styles.titleModalEmpty}>
                        Belum Tercatat Perkawinan
                      </h4>
                      <p className={styles.descModalEmpty}>
                        Krama ini belum memiliki catatan perkawinan adat yang terhubung dengan pasangannya di dalam sistem silsilah Adat Bali.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6 flex gap-2 justify-end pt-3">
                    <button onClick={handleAddPerkawinanRedirect} className={styles.btnAddGreen}>
                      <FaPlusCircle size={12} className="mr-2" /> 
                      <span>Daftarkan Perkawinan Baru</span>
                    </button>
                  </div>
                </>
              ) : (
                /* Kondisi 2: Adanya data perkawinan */
                <>
                  <div className="space-y-2 text-[11px]">
                    <div className={styles.cardVerification}>
                      <div className="text-center">
                        <span className={styles.labelColumn}>
                          Status Verifikasi
                        </span>
                        <span className={`${styles.badge} ${
                          modalKawinData.status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                          modalKawinData.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {modalKawinData.status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                          {modalKawinData.status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                          {modalKawinData.status_verifikasi === 'Draft' && <FaHourglassHalf size={10} />}
                          <span>
                            {modalKawinData.status_verifikasi || 'Draft'}
                          </span>
                        </span>
                      </div>
                      <div className="text-center">
                        <span className={styles.labelColumn}>
                          Status Sinkronisasi
                        </span>
                        {modalKawinData.is_pending_update || modalKawinData.status_verifikasi === 'Draft' ? (
                          <span className={styles.badgePending}>
                            <FaExclamationTriangle size={11} className="mb-0.5" /> 
                            <span>Menunggu Verifikasi</span>
                          </span>
                        ) : (
                          <span className={styles.badgeSuccess}>
                            <FaCheck size={11} />
                            <span>Data Aktif & Sinkron</span> 
                          </span>
                        )}
                      </div>
                      {modalKawinData.catatan_admin_desa && (
                        <div className={styles.noteColumn}>
                          <span className={styles.labelColumn}>
                            Catatan Validasi Admin Desa
                          </span>
                          <div className="overflow-hidden border border-gray-50 mt-1">
                            <table className={styles.cardTabel}>
                              <tbody className="divide-y">
                                {modalKawinData.catatan_admin_desa.catatan_desa_suami && (
                                  <tr>
                                    <td className="px-4 py-2 font-medium w-36 border-r">Desa Adat Suami</td>
                                    <td className="px-4 py-2 italic">{modalKawinData.catatan_admin_desa.catatan_desa_suami}</td>
                                  </tr>
                                )}
                                {modalKawinData.catatan_admin_desa.catatan_desa_istri && (
                                  <tr>
                                    <td className="px-4 py-2 font-medium w-36 border-r">Desa Adat Istri</td>
                                    <td className="px-4 py-2 italic">{modalKawinData.catatan_admin_desa.catatan_desa_istri}</td>
                                  </tr>
                                )}
                                {modalKawinData.catatan_admin_desa.status_verifikasi_update && (
                                  <tr>
                                    <td className="px-4 py-2 font-medium w-36 border-r">Log Updated</td>
                                    <td className="px-4 py-2 italic text-amber-700 font-medium">
                                      {modalKawinData.catatan_admin_desa.status_verifikasi_update}
                                    </td>
                                  </tr>
                                )}
                                {modalKawinData.catatan_admin_desa.status_verifikasi_perceraian && (
                                  <tr>
                                    <td className="px-4 py-2 font-medium w-36 border-r">Log Perceraian</td>
                                    <td className="px-4 py-2 italic text-blue-700 font-medium">
                                      {modalKawinData.catatan_admin_desa.status_verifikasi_perceraian}
                                    </td>
                                  </tr>
                                )}
                                {typeof modalKawinData.catatan_admin_desa === "string" && (
                                  <tr>
                                    <td className="px-4 py-2 font-medium w-36 border-r">Catatan Umum</td>
                                    <td className="px-4 py-2 italic">{modalKawinData.catatan_admin_desa}</td>
                                  </tr>
                                )}
                                {modalKawinData.catatan_admin_desa.last_updated_by && (
                                  <tr>
                                    <td className="px-4 py-2 font-semibold text-gray-500 border-r">Last Update By</td>
                                    <td className="px-4 py-2 text-[11px] text-gray-500 font-mono">
                                      {modalKawinData.catatan_admin_desa.last_updated_by}
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* DATA PERUBAHAN */}
                    {modalKawinData.is_pending_update && modalKawinData.data_perubahan && (
                      <div className={styles.cardAreaChange}>
                        <h4 className={styles.cardTitle}>
                          <FaExclamationTriangle className={styles.cardIcon} /> 
                          Draft Usulan Perubahan Data Perkawinan Adat Anda
                        </h4>
                        <div className={styles.cardTable}>
                          <table className={styles.table}>
                            <thead>
                              <tr className={styles.tableHeader}>
                                <th className="p-3 w-1/4">Kategori</th>
                                <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                                <th className="p-3 w-3/8">Usulan Perubahan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {renderPerubahanPerkawinanRow("Nama Suami", modalKawinData?.suami_id, "suami_id")}
                              {renderPerubahanPerkawinanRow("Nama Istri", modalKawinData?.istri_id, "istri_id")}
                              {renderPerubahanPerkawinanRow("Jenis Perkawinan", modalKawinData?.jenis_perkawinan, "jenis_perkawinan")}
                              {renderPerubahanPerkawinanRow("Tanggal Perkawinan", modalKawinData?.tanggal_perkawinan, "tanggal_perkawinan", "date")}
                              {renderPerubahanPerkawinanRow("Status Perkawinan", modalKawinData?.status_perkawinan, "status_perkawinan")}
                              {renderPerubahanPerkawinanRow("Tanggal Perceraian", modalKawinData?.tanggal_cerai, "tanggal_cerai", "date")}
                              {renderPerubahanPerkawinanRow("Pihak yang Meninggal", modalKawinData?.pihak_meninggal, "pihak_meninggal")}
                              {renderPerubahanPerkawinanRow("Ketetapan Silsilah Predana", modalKawinData?.pilihan_predana, "pilihan_predana")}
                            </tbody>
                          </table>
                        </div>
                        <div className={styles.noteBtnGroup}>
                          <span>💡</span>
                          <p className="italic font-medium">
                            Fitur modifikasi hubungan perkawinan dikunci sementara waktu hingga Admin Desa memeriksa dan mengesahkan draft perubahan ini.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  {/* Button Action */}
                  <div className="mt-6 flex gap-2 justify-end pt-3">
                    {modalKawinData.is_pending_update ? (
                      hasAccess && (
                        <>
                          {modalKawinData.data_perubahan && "UPDATE_PERCERAIAN" in modalKawinData.data_perubahan && (
                            <button 
                              onClick={() => handleCancelUpdatePerceraian(modalKawinData.id)} 
                              className={styles.btnRejectModal} 
                              disabled={isProcessingAction}
                              title="Batalkan Draft Usulan Perubahan Data Perceraian">
                              <FaTimes className="mr-2" /> Batalkan Perubahan Perceraian
                            </button>
                          )}
                          {modalKawinData.data_perubahan && "UPDATE_PERKAWINAN" in modalKawinData.data_perubahan && (
                            <button 
                              onClick={() => handleCancelUpdatePerkawinan(modalKawinData.id)} 
                              className={styles.btnRejectModal}
                              disabled={isProcessingAction}
                              title="Batalkan Draft Usulan Perubahan Data Perkawinan">
                              <FaTimes className="mr-2" /> Batalkan Perubahan Perkawinan
                            </button>
                          )}
                          {modalKawinData.data_perubahan && "PERCERAIAN" in modalKawinData.data_perubahan && (
                            <button 
                              onClick={() => handleCancelDraftPerceraian(modalKawinData.id)} 
                              className={styles.btnRejectModal} 
                              disabled={isProcessingAction}
                              title="Batalkan Pengajuan Usulan Perceraian">
                              <FaTimes className="mr-2" /> Batalkan Pengajuan Perceraian
                            </button>
                          )}
                        </>
                      )
                    ) : (
                      hasAccess && (
                        <>
                          {modalKawinData.status_perkawinan === "Kawin" && (
                            <button 
                              onClick={handlePengajuanPerceraianRedirect} 
                              className={styles.btnPostCerai}>
                              <GrDocumentUpdate size={12} className="mr-2" /> 
                              <span>Pengajuan Perceraian</span>
                            </button>
                          )}
                          <button 
                            onClick={handleAddPerkawinanRedirect} 
                            className={styles.btnAddGreen} 
                            title="Daftarkan Perkawinan Baru">
                            <FaPlusCircle size={12} className="mr-2" /> 
                            <span>Daftar</span>
                          </button>
                          <button 
                            onClick={() => handleEditPerkawinanRedirect(modalKawinData)} 
                            className={styles.btnEditModal} 
                            title="Edit Data Perkawinan Aktif">
                            <FaEdit size={12} className="mr-2 mb-0.5" /> Edit
                          </button>
                          <button 
                            onClick={handleTriggerDeletePerkawinan} 
                            className={styles.btnRejectModal}
                            disabled={isProcessingAction} 
                            title="Hapus Draft Perkawinan">
                            <FaTrash size={10} className="mr-2 mb-0.5" /> Hapus
                          </button>
                        </>
                      )
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Sub-komponen Dasar Dashboard Layout
const ModernCard = ({ title, icon, children }) => (
  <div className={styles.modernCard}>
    <div className="p-4 bg-[#3A2000] flex items-center gap-2">
      {icon}
      <h3 className="text-xs font-bold text-white uppercase tracking-wider">
        {title}
      </h3>
    </div>
    <div className="p-6">{children}</div>
  </div>
);

const InfoItem = ({ label, value, icon }) => (
  <div className="flex flex-col">
    <div className="flex items-center gap-1.5 mb-1 text-gray-400">
      {icon && <span className="text-xs">
        {icon}
      </span>}
      <label className={styles.labelInfoItem}>
        {label}
      </label>
    </div>
    <div className="text-xs font-semibold text-gray-800 break-words">
      {value || "-"}
    </div>
  </div>
);

const TimelineItem = ({ title, date, desc, badge }) => (
  <div className="border-b border-gray-50 pb-4 last:border-0 last:pb-0">
    <h4 className="text-sm font-bold text-gray-800 mb-0.5 leading-tight">
      {title}
    </h4>
    <p className="text-[10px] text-gray-400 font-medium mb-2">
      {date}
    </p>
    {desc && (
      <p className={styles.descTimeLineInfo}>
        {desc}
      </p>
    )}
    <div>{badge}</div>
  </div>
);

const IconInfoRow = ({ icon, label, value }) => (
  <div className={styles.iconInforRow}>
    <div className={styles.iconRow}>
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className={styles.labelRow}>
        {label}
      </p>
      <p className="text-xs font-semibold text-gray-700 truncate">
        {value || "-"}
      </p>
    </div>
  </div>
);

export default DataKramaDetail;