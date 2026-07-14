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
  FaIdCardAlt,
  FaCamera 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './VerifikasiDataDetail.module.css';

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

const VerifikasiDataDetail = ({ user }) => {
  const { id: slugParam } = useParams();
  const notifDropdownRef = useRef(null);
  
  const [keluargaMap, setKeluargaMap] = useState({});
  const [masterDesaMap, setMasterDesaMap] = useState({});
  const [kramaCacheMap, setKramaCacheMap] = useState({});
  
  const [krama, setKrama] = useState(null);
  const [relasiList, setRelasiList] = useState([]);
  const [perkawinanList, setPerkawinanList] = useState([]);
  const [riwayatKeluargaList, setRiwayatKeluargaList] = useState([]);
  const [peranAdatList, setPeranAdatList] = useState([]);
  
  const [isOpenModalKrama, setIsOpenModalKrama] = useState(false);
  const [verifyKramaAction, setVerifyKramaAction] = useState('Disetujui');
  const [catatanKramaValidator, setCatatanKramaValidator] = useState('');
  const [isSubmittingKrama, setIsSubmittingKrama] = useState(false);

  const [isOpenModalRelasi, setIsOpenModalRelasi] = useState(false); 
  const [verifyRelasiAction, setVerifyRelasiAction] = useState('Disetujui');
  const [catatanRelasiValidator, setCatatanRelasiValidator] = useState('');
  const [isSubmittingRelasi, setIsSubmittingRelasi] = useState(false);
  const [selectedRelasi, setSelectedRelasi] = useState(null);
  const [modalRelasiData, setModalRelasiData] = useState(null);
  const [konteksVerifikasiRelasi, setKonteksVerifikasiRelasi] = useState('CREATE_RELASI');

  const [isOpenModalKawin, setIsOpenModalKawin] = useState(false);
  const [verifyKawinAction, setVerifyKawinAction] = useState('Disetujui');
  const [catatanKawinValidator, setCatatanKawinValidator] = useState('');
  const [isSubmittingKawin, setIsSubmittingKawin] = useState(false);
  const [selectedKawin, setSelectedKawin] = useState(null);
  const [modalKawinData, setModalKawinData] = useState(null);
  const [konteksVerifikasiKawin, setKonteksVerifikasiKawin] = useState('REGULAR_KAWIN');
  const [tabVerifikasiAktif, setTabVerifikasiAktif] = useState('KAWIN');
  
  const [isLoading, setIsLoading] = useState(true);
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

  // Helper: menentukan hak manajemen ruang lingkup data
  const userDesaId = useMemo(() => {
    if (!user) return null;
    const rawId = user.desa_adat_id || user.desaAdatId || user.desa_adat?.id;
    return rawId ? String(rawId) : null;
  }, [user]);

  const hasAccess = useMemo(() => {
    if (!user || !krama) return false;
    if (user.role === 'Super Admin') return true;
    
    if (user.role === 'Admin Desa') {
      if (String(user.id || user.userId) === String(krama.user_id)) return true;

      const kramaDesaRaw = krama.desa_adat_id || krama.desaAdatId || krama.desa_id;
      const kramaDesaId = kramaDesaRaw ? String(kramaDesaRaw) : null;

      // Menggunakan userDesaId yang sudah di-ekstrak di atas
      if (userDesaId && kramaDesaId && userDesaId === kramaDesaId) return true;

      if (krama.is_pending_update && krama.data_perubahan?.desa_adat_id) {
        const desaUsulanId = String(krama.data_perubahan.desa_adat_id);
        // Jika desa usulan sama dengan desa admin yang login, beri akses verifikasi
        if (userDesaId === desaUsulanId) return true;
      }

      if (modalRelasiData) {
        const relasiDesaId = modalRelasiData.desa_adat_id || modalRelasiData.desaAdatId || modalRelasiData.desa_id;
        const relasiTujuanId = modalRelasiData.desa_adat_id_tujuan || modalRelasiData.data_perubahan?.desa_adat_id_tujuan;
        if (userDesaId && (String(relasiDesaId) === userDesaId || String(relasiTujuanId) === userDesaId)) return true;
      }
      
      if (modalKawinData) {
        const kawinSuamiDesa = modalKawinData.suami?.desa_adat_id || modalKawinData.suami?.desaAdatId;
        const kawinIstriDesa = modalKawinData.istri?.desa_adat_id || modalKawinData.istri?.desaAdatId;
        if (userDesaId && (String(kawinSuamiDesa) === userDesaId || String(kawinIstriDesa) === userDesaId)) return true;
      }

      const isDesaTujuan = Array.isArray(relasiList) && relasiList.some(r => {
        const tujuanId = r.desa_adat_id_tujuan || r.data_perubahan?.desa_adat_id_tujuan;
        const asalId = r.desa_adat_id || r.desa_id;
        return userDesaId && (String(tujuanId) === userDesaId || String(asalId) === userDesaId);
      });

      return isDesaTujuan;
    }
    
    if (user.role === 'Krama') {
      return String(user.id || user.userId) === String(krama.user_id);
    }
    return false;
  }, [user, krama, relasiList, modalRelasiData, modalKawinData, userDesaId]);

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

      const results = await Promise.allSettled([
        axiosInstance.get(`/relasi-krama?anak_id=${realId}&mode=verification`),
        axiosInstance.get(`/perkawinan?krama_id=${realId}&mode=verification`),
        axiosInstance.get(`/riwayat-keluarga?krama_id=${realId}`),
        axiosInstance.get(`/riwayat-peran-adat?krama_id=${realId}`),
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
        let rawRelasi = resRelasi.value.data?.data || resRelasi.value.data;
        let cleanRelasiList = Array.isArray(rawRelasi) ? rawRelasi : (rawRelasi ? [rawRelasi] : []);

        const isRelasiVerified = cleanRelasiList.length > 0 && cleanRelasiList[0].status === 'Disetujui';
        
        if (isRelasiVerified) {
          const resRelasiPublic = await axiosInstance.get(`/relasi-krama?anak_id=${realId}&mode=public`);
          const rawRelasiPub = resRelasiPublic.data?.data || resRelasiPublic.data;
          cleanRelasiList = Array.isArray(rawRelasiPub) ? rawRelasiPub : (rawRelasiPub ? [rawRelasiPub] : []);
        }
        setRelasiList(cleanRelasiList);
      }
      // setting data perkawinan
      if (resPerkawinan.status === 'fulfilled') {
        let rawPerkawinan = resPerkawinan.value.data?.data || resPerkawinan.value.data;
        let cleanPerkawinanList = Array.isArray(rawPerkawinan) ? rawPerkawinan : (rawPerkawinan ? [rawPerkawinan] : []);

        const isPerkawinanFinal = cleanPerkawinanList.length > 0 && 
          (cleanPerkawinanList[0].status_verifikasi === 'Disetujui' || cleanPerkawinanList[0].status === 'Disetujui') &&
          !cleanPerkawinanList[0].is_pending_update;
          
        if (cleanPerkawinanList.length === 0 || isPerkawinanFinal) {
          const resPerkawinanPublic = await axiosInstance.get(`/perkawinan?krama_id=${realId}&mode=public`);
          const rawPerkawinanPub = resPerkawinanPublic.data?.data || resPerkawinanPublic.data;
          cleanPerkawinanList = Array.isArray(rawPerkawinanPub) ? rawPerkawinanPub : (rawPerkawinanPub ? [rawPerkawinanPub] : []);
        }
        setPerkawinanList(cleanPerkawinanList);
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
        message: error.response?.data?.message || error.message || 'Gagal memuat detail data verifikasi krama bali.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realId]);

  useEffect(() => {
    const resolusiNamaKramaGlobal = async () => {
      // Kumpulkan semua sumber perkawinan (baik yang aktif di card luar maupun yang di dalam modal)
      const semuaPerkawinan = [...perkawinanList];
      if (modalKawinData) semuaPerkawinan.push(modalKawinData);

      const idsToFetch = [];

      semuaPerkawinan.forEach(pItem => {
        let data_perubahan_kawin = pItem?.data_perubahan;
        if (data_perubahan_kawin && data_perubahan_kawin.data_perubahan) {
          data_perubahan_kawin = data_perubahan_kawin.data_perubahan;
        }
        if (!data_perubahan_kawin) return;

        const targetPayload = data_perubahan_kawin.UPDATE_PERKAWINAN || 
                              data_perubahan_kawin.UPDATE_PERCERAIAN ||
                              data_perubahan_kawin.PERCERAIAN || 
                              data_perubahan_kawin;
        
        const idSuamiBaru = targetPayload.suami_id;
        const idIstriBaru = targetPayload.istri_id;

        if (idSuamiBaru && !kramaCacheMap[idSuamiBaru] && !idsToFetch.includes(idSuamiBaru)) {
          idsToFetch.push(idSuamiBaru);
        }
        if (idIstriBaru && !kramaCacheMap[idIstriBaru] && !idsToFetch.includes(idIstriBaru)) {
          idsToFetch.push(idIstriBaru);
        }
      });

      if (idsToFetch.length > 0) {
        try {
          const newCache = { ...kramaCacheMap };
          let hasChanges = false;
          
          await Promise.all(
            idsToFetch.map(async (id) => {
              if (!id || isNaN(Number(id))) return;
              try {
                const res = await axiosInstance.get(`/krama-bali/${id}`);
                if (res.data?.data?.nama_lengkap) {
                  newCache[id] = res.data.data.nama_lengkap;
                  hasChanges = true;
                }
              } catch (err) {
                console.error(`Gagal mengambil resolusi nama krama ID ${id}:`, err);
              }
            })
          );
          
          if (hasChanges) {
            setKramaCacheMap(newCache);
          }
        } catch (error) {
          console.error("Gagal memproses batch resolusi nama krama:", error);
        }
      }
    };

    if (perkawinanList.length > 0 || modalKawinData) {
      resolusiNamaKramaGlobal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perkawinanList, modalKawinData?.id]);

  // Helper: Fungsi verifikasi data
  const handleVerifyKrama = async () => {
    if (verifyKramaAction === 'Ditolak' && !catatanKramaValidator.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: 'Wajib mengisi catatan/alasan ketika pengajuan pendaftaran data krama bali ditolak!'
      });
      return;
    }
    setIsSubmittingKrama(true);
    try {
      await axiosInstance.patch(`/krama-bali/verifikasi/${realId}`, {
        status_verifikasi: verifyKramaAction,
        catatan_admin_desa: catatanKramaValidator
      });

      setAlert({
        show: true,
        type: 'success',
        message: `Pengajuan data krama bali berhasil diproses dengan status: ${verifyKramaAction}.`
      });
      
      setIsOpenModalKrama(false); 
      setCatatanKramaValidator(''); 
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Terjadi Kesalahan saat menyimpan keputusan verifikasi data krama bali. Periksa koneksi Anda!'
      });
    } finally {
      setIsSubmittingKrama(false);
    }
  };

  const handleVerifyRelasi = async () => {
    if (!selectedRelasi?.id) return;
    if (verifyRelasiAction === 'Ditolak' && !catatanRelasiValidator.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: 'Wajib mengisi catatan/alasan ketika keputusan verifikasi ditolak!'
      });
      return;
    }
    setIsSubmittingRelasi(true);
    try {
      let endpointUrl = "";
      let payload = {
        status_verifikasi: verifyRelasiAction,
        catatan_admin_desa: catatanRelasiValidator 
      };

      if (konteksVerifikasiRelasi === 'UPDATE_RELASI') {
        endpointUrl = `/relasi-krama/update/verifikasi/${selectedRelasi.id}`;
      } else {
        endpointUrl = `/relasi-krama/create/verifikasi/${selectedRelasi.id}`;
      }
      
      console.log(`🚀 Mengarahkan ke Kamar Route Adat: ${endpointUrl} (Konteks: ${konteksVerifikasiRelasi})`);
      
      await axiosInstance.patch(endpointUrl, payload);
      setAlert({
        show: true,
        type: 'success',
        message: `Proses keputusan verifikasi adat berhasil disimpan dengan status: ${verifyRelasiAction}.`
      });
      
      setIsOpenModalRelasi(false);
      setCatatanRelasiValidator('');
      setSelectedRelasi(null);
      setModalRelasiData(null);
      fetchAllData();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal memproses keputusan verifikasi data relasi krama.'
      });
    } finally {
      setIsSubmittingRelasi(false);
    }
  };

  const handleVerifyKawin = async () => {
    if (!selectedKawin?.id) return;
    if (verifyKawinAction === 'Ditolak' && !catatanKawinValidator.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: `Wajib mengisi catatan/alasan ketika pengajuan verifikasi ditolak!`
      });
      return;
    }
    
    setIsSubmittingKawin(true);

    try {
      let endpointUrl = "";

      let payload = {
        status_verifikasi: verifyKawinAction,
        catatan_admin: catatanKawinValidator
      };

      const dapatkanTargetSisiEkstensi = () => {
        if (user?.role === 'Super Admin') return "super_admin";
        if (user?.role === 'Admin Desa') {
          const desaSuamiId = selectedKawin.suami?.desa_adat_id || selectedKawin.suami?.desaAdatId || selectedKawin.desa_pria_id;
          const desaIstriId = selectedKawin.istri?.desa_adat_id || selectedKawin.istri?.desaAdatId || selectedKawin.desa_wanita_id;
          
          if (String(desaIstriId) === String(userDesaId)) {
            return "istri";
          }
          if (String(desaSuamiId) === String(userDesaId)) {
            return "suami";
          }
        }
        return "super_admin";
      };

      switch (konteksVerifikasiKawin) {
        case 'REGULAR_KAWIN':
          endpointUrl = `/perkawinan/kawin/verifikasi/${selectedKawin.id}`;
          break;
        case 'REGULAR_CERAI':
          endpointUrl = `/perkawinan/cerai/verifikasi/${selectedKawin.id}`;
          payload.perkawinan_id = selectedKawin.id;
          payload.target_sisi = dapatkanTargetSisiEkstensi();
          break;
        case 'UPDATE_PERKAWINAN':
          endpointUrl = `/perkawinan/update/verifikasi/${selectedKawin.id}`;
          payload.tipe_update = "PERKAWINAN";
          payload.target_sisi = dapatkanTargetSisiEkstensi();
          break;
        case 'UPDATE_PERCERAIAN':
          endpointUrl = `/perkawinan/update/verifikasi/${selectedKawin.id}`;
          payload.tipe_update = "PERCERAIAN";
          payload.target_sisi = dapatkanTargetSisiEkstensi();
          break;
        default:
          throw new Error("Konteks verifikasi perkawinan tidak dikenali.");
      }

      await axiosInstance.patch(endpointUrl, payload);

      setAlert({
        show: true,
        type: 'success',
        message: `Proses verifikasi berhasil disimpan dengan status: ${verifyKawinAction}.`
      });

      setIsOpenModalKawin(false);
      setCatatanKawinValidator('');
      setSelectedKawin(null);
      
      if (typeof fetchAllData === 'function') {
        fetchAllData();
      }
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem saat memproses keputusan verifikasi perkawinan/perceraian adat.'
      });
    } finally {
      setIsSubmittingKawin(false);
    }
  };

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

  const handleBack = () => {
    if (location.state?.fromPerkawinan) {
      navigate('/verifikasi-data/perkawinan');
    } else if (location.state?.fromRelasi) {
      navigate('/verifikasi-data/relasi-krama');
    } else {
      navigate('/verifikasi-data/krama-bali');
    }
  };

  // Effect: Mengotomatisasikan pilihan verifikasi
  useEffect(() => {
    if (isOpenModalKrama && krama) {
      setVerifyKramaAction('Disetujui');
      setCatatanKramaValidator('');
    }
  }, [isOpenModalKrama, krama]);

  useEffect(() => {
    if (selectedRelasi) {
      const statusSistem = selectedRelasi.status_verifikasi;
      if (statusSistem === 'Draft' || !statusSistem) {
        setVerifyRelasiAction('Disetujui');
      } else {
        setVerifyRelasiAction(statusSistem);
      }
    }
  }, [selectedRelasi]);

  useEffect(() => {
    if (isOpenModalKawin) {
      setVerifyKawinAction('Disetujui');
      setCatatanKawinValidator('');
    }
  }, [isOpenModalKawin]);

  // Helper: Menampilkan foto krama
  const DEFAULT_AVATAR_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/default-avatar.jpg";
  const SUPABASE_STORAGE_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/";

  const renderFotoProfile = () => {
    if (krama.foto_profile) {
      return `${SUPABASE_STORAGE_URL}${krama.foto_profile}`;
    }
    return DEFAULT_AVATAR_URL;
  };  

  // Helper: menangani filter data master
  // Helper: menangani filter data master (TERPILIH & DIPERBAIKI SINKRONISASI ID)
  const processedData = useMemo(() => {
    if (!krama) return null;

    const anakRelasiList = relasiList.filter(r => r && String(r.anak_id) === String(krama.id));
    const orangTuaKandung = anakRelasiList.find(r => r.status_hubungan === 'Anak Kandung');
    const orangTuaAngkatList = anakRelasiList.filter(r => r.status_hubungan === 'Anak Angkat');

    // Penguatan pencocokan ID: memeriksa primitive ID maupun object relation ID dari backend
    const userPerkawinanList = perkawinanList.filter(p => {
      if (!p) return false;
      const idSuami = String(p.suami_id || p.suami?.id || '');
      const idIstri = String(p.istri_id || p.istri?.id || '');
      const idKrama = String(krama.id || '');
      return idSuami === idKrama || idIstri === idKrama;
    });

    // Perbaikan Toleransi Huruf Besar/Kecil (Mencegah data terlempar ke log lampau akibat string 'KAWIN')
    const perkawinanAktifList = userPerkawinanList.filter(p => {
      const status = p.status_perkawinan ? String(p.status_perkawinan).trim().toLowerCase() : '';
      return status === 'kawin';
    });

    const riwayatPerkawinanLama = userPerkawinanList.filter(p => {
      const status = p.status_perkawinan ? String(p.status_perkawinan).trim().toLowerCase() : '';
      return status !== 'kawin';
    });

    let namaPasanganAktif = "Tidak Ada Pasangan Aktif";

    if (perkawinanAktifList.length > 0) {
      namaPasanganAktif = perkawinanAktifList.map(p => {
        const idSuami = String(p.suami_id || p.suami?.id || '');
        return idSuami === String(krama.id)
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
      } else if (krama.desa_adat_id && desa) {
        wilayahAdatLengkap = `Desa Adat ${desa.trim()}`;
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
      if (krama?.wilayah_adat?.nama_desa_adat) {
        nilaiLamaDiformat = `Desa Adat ${krama.wilayah_adat.nama_desa_adat.trim()}`;
      } else {
        nilaiLamaDiformat = wilayahAdatLengkap || 'Tidak Diketahui';
      }
      
      const idBaruStr = String(nilaiBaru);
      const idBaruNum = Number(nilaiBaru);

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
      <tr className="hover:bg-gray-50 transition-colors" key={namaField}>
        <td className={styles.labelChange}>{label}</td>
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

  const renderFotoChangeRow = () => {
    if (!data_perubahan || !data_perubahan.foto_profile || data_perubahan.foto_profile === krama.foto_profile) {
      return null;
    }

    const fotoLamaUrl = krama.foto_profile 
      ? `${SUPABASE_STORAGE_URL}${krama.foto_profile}` 
      : DEFAULT_AVATAR_URL;
      
    const fotoBaruUrl = data_perubahan.foto_profile 
      ? `${SUPABASE_STORAGE_URL}${data_perubahan.foto_profile}` 
      : DEFAULT_AVATAR_URL;

    return (
      <tr className="hover:bg-gray-50 transition-colors">
        <td className={styles.labelChange}>
          Foto Profil
        </td>
        <td className="p-3 border-r border-gray-100">
          <img src={fotoLamaUrl} alt="Foto Lama" className="w-40 h-40 rounded-lg object-cover border" />
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <img src={fotoBaruUrl} alt="Foto Baru" className="w-40 h-40 rounded-lg object-cover border-2 border-amber-500" />
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
        <td className={styles.labelChange}>{label}</td>
        <td className="p-3 border-r border-gray-100">
          <span className={styles.oldValue}>{nilaiLamaDiformat ?? '-'}</span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <span className={styles.newValue}>{nilaiBaru ?? '-'}</span>
          </div>
        </td>
      </tr>
    );
  };

  const renderPerubahanPerkawinanRow = (label, nilaiLama, namaField, type = 'text', perkawinanItem = null, kramaPasanganObj = null, cacheMap = {}) => {
    const targetData = perkawinanItem || modalKawinData;
    if (!targetData) return null;

    let rawChange = targetData?.data_perubahan;
    
    if (typeof rawChange === 'string') {
      try { rawChange = JSON.parse(rawChange); } catch (e) { console.error(e); }
    }
    if (rawChange && rawChange.data_perubahan) {
      rawChange = rawChange.data_perubahan;
    }

    let camelField = namaField.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    let nilaiBaru = undefined;

    // Ekstraksi Objek Utama Perubahan berdasarkan draf aktif
    const searchObj = rawChange ? (rawChange.UPDATE_PERKAWINAN || rawChange.PERCERAIAN || rawChange.UPDATE_PERCERAIAN || rawChange) : null;

    if (searchObj) {
      nilaiBaru = searchObj[namaField] !== undefined ? searchObj[namaField] : searchObj[camelField];
    }

    if (nilaiBaru === undefined && targetData?.is_pending_update) {
      nilaiBaru = targetData[namaField] !== undefined ? targetData[namaField] : targetData[camelField];
    }

    // Jika tidak ada perubahan nilai baru di draf manapun, sembunyikan baris
    if (nilaiBaru === undefined) return null;

    let nilaiLamaDiformat = type === 'date' ? formatDate(nilaiLama) : nilaiLama;
    let nilaiBaruDiformat = type === 'date' ? formatDate(nilaiBaru) : nilaiBaru;

    // ============================================================
    // RESOLUSI NAMA LENGKAP KRAMA BARU (ANTI-STUCK / DIRECT BLENDING)
    // ============================================================
    if (namaField === 'suami_id' || namaField === 'istri_id') {
      const relasiKey = namaField === 'suami_id' ? 'suami' : 'istri';
      const kramaLama = kramaPasanganObj || targetData?.[relasiKey];

      // 1. Tentukan Nilai Tampilan Lama
      if (kramaLama?.nama_lengkap) {
        const isLamaDraft = kramaLama?.status_verifikasi === 'Draft';
        nilaiLamaDiformat = `${kramaLama.nama_lengkap}${isLamaDraft ? ' [DRAFT]' : ''}`;
      } else if (nilaiLama) {
        nilaiLamaDiformat = `Krama ID: ${nilaiLama}`;
      }

      if (String(nilaiBaru) === String(kramaLama?.id || nilaiLama)) {
        nilaiBaruDiformat = nilaiLamaDiformat;
      } else {
        const kramaBaruPayload = searchObj?.[relasiKey];
        
        if (kramaBaruPayload?.nama_lengkap) {
          nilaiBaruDiformat = `${kramaBaruPayload.nama_lengkap} [DRAFT]`;
        }
        // Jika data asinkronus dari useEffect langkah 1 sudah masuk, tampilkan nama lengkapnya!
        else if (cacheMap && cacheMap[nilaiBaru]) {
          nilaiBaruDiformat = `${cacheMap[nilaiBaru]} [DRAFT]`;
        } 
        else {
          let namaDariCatatan = "";
          try {
            const parsedCatatan = JSON.parse(searchObj?.catatan_update || targetData?.catatan_update);
            namaDariCatatan = parsedCatatan?.nama_pasangan_baru || "";
          } catch (e) {
            console.log(e);
            namaDariCatatan = "";
          }

          if (namaDariCatatan && namaDariCatatan.trim() !== "") {
            nilaiBaruDiformat = `${namaDariCatatan} [DRAFT]`;
          } else {
            // Biarkan bertuliskan Memuat Nama sebentar, karena useEffect global di atas akan langsung menimpanya dengan nama asli
            nilaiBaruDiformat = `Memuat Nama... [DRAFT]`;
          }
        }
      }
    }

    // Sembunyikan baris jika tidak ada perubahan nilai nyata
    if (String(nilaiLamaDiformat ?? '').trim() === String(nilaiBaruDiformat ?? '').trim()) {
      return null;
    }

    return (
      <tr className="hover:bg-gray-50 transition-colors" key={namaField}>
        <td className={styles.labelChange}>{label}</td>
        <td className="p-3 border-r border-gray-100">
          <span className={styles.oldValue}>{nilaiLamaDiformat ?? '-'}</span>
        </td>
        <td className="p-3">
          <div className="flex items-center gap-2">
            <FaArrowRight className={styles.arrows} />
            <span className={styles.newValue}>
              {nilaiBaruDiformat?.includes('[DRAFT]') ? (
                <>
                  {nilaiBaruDiformat.replace(' [DRAFT]', '')} 
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
  } = processedData || {};

  return (
    <div className={styles.detailContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Detail Verifikasi Data Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Informasi lengkap mengenai krama bali yang perlu ditinjau dan diverifikasi
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <InfoItem 
                    label="Nama Lengkap" 
                    icon={<FaIdCard />} 
                    value={nama_lengkap} 
                  />
                  <InfoItem 
                    label="Nama Panggilan" 
                    icon={<FaUser />} 
                    value={nama_panggilan} 
                  />
                  <InfoItem 
                    label="Jenis Kelamin" 
                    icon={<FaVenusMars />} 
                    value={jenis_kelamin} 
                  />
                  <InfoItem 
                    label="Tanggal Lahir" 
                    icon={<FaBirthdayCake />} 
                    value={formatDate(tanggal_lahir)} 
                  />
                  <InfoItem 
                    label="Tipe Data" 
                    icon={<FaSitemap />} 
                    value={tipe_data} 
                  />
                  <InfoItem 
                    label="Status Hidup" 
                    icon={<FaHeart className={status_hidup === "Meninggal" ? "text-gray-400 text-xs" : "text-red-600 text-xs"} />}
                    value={(() => {
                      let colorClass = 'bg-blue-100 text-blue-600'; 
                      if (status_hidup === 'Hidup') {
                        colorClass = 'bg-green-100 text-green-700';
                      } else if (status_hidup === 'Meninggal') {
                        colorClass = 'bg-red-100 text-red-700';
                      } else if (status_hidup === 'Tidak Diketahui') {
                        colorClass = 'bg-gray-200 text-gray-700';
                      }
                      return (
                        <span className={`${styles.statusHidup} ${colorClass}`}>
                          {status_hidup}
                        </span>
                      );
                    })()}
                  />
                  <div className="md:col-span-2 space-y-4 mb-4">
                    {is_bali ? (
                      <>
                        <InfoItem 
                          label="Tempat Asal Khusus" 
                          value={tempat_asal_khusus?.trim() ? tempat_asal_khusus : "-"} 
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
                {/* Data Perubahan */}
                {is_pending_update && data_perubahan && (
                  <div className={styles.cardAreaChange}>
                    <div className={styles.cardTitle}>
                      <FaExclamationTriangle className={styles.cardIcon} />
                      Draft Usulan Perubahan Data Krama Bali
                    </div>
                    <div className={styles.cardTable}>
                      <table className={styles.table}>
                        <thead>
                          <tr className={styles.tableHeader}>
                            <th className="p-3 w-1/5 text-left">Kategori</th>
                            <th className="p-3 w-2/5 text-left">Data Aktif Saat Ini</th>
                            <th className="p-3 w-2/5 text-left">Usulan Perubahan</th>
                          </tr>
                        </thead>
                        <tbody className={styles.tableBody}>
                          {renderFotoChangeRow()}
                          {renderPerubahanRow("Nama Lengkap", nama_lengkap, "nama_lengkap")}
                          {renderPerubahanRow("Nama Panggilan", nama_panggilan, "nama_panggilan")}
                          {renderPerubahanRow("Jenis Kelamin", jenis_kelamin, "jenis_kelamin")}
                          {renderPerubahanRow("Tanggal Lahir", tanggal_lahir, "tanggal_lahir", "date")}
                          {renderPerubahanRow("Status Hidup", status_hidup, "status_hidup")}
                          {renderPerubahanRow("Asal Wilayah", is_bali, "is_bali", "boolean")}
                          {renderPerubahanRow("Desa Adat", krama?.desa_adat_id, "desa_adat_id", "desa_adat")}
                          {renderPerubahanRow("Tempat Asal Khusus", tempat_asal_khusus, "tempat_asal_khusus")}
                          {renderPerubahanRow("Alamat Luar", alamat_luar, "alamat_luar")}
                          {renderPerubahanRow("Tipe Data", tipe_data, "tipe_data")}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {hasAccess && (status_verifikasi === "Draft" || ((status_verifikasi === "Disetujui" || status_verifikasi === "Ditolak") && is_pending_update)) && (
                  <div className="flex justify-end mt-4 pt-3 border-t border-gray-100">
                    <button 
                      onClick={() => {
                        setCatatanKramaValidator('');
                        setIsOpenModalKrama(true);
                      }} 
                      className={styles.btnInfoDetail}>
                      <FaEdit className="mb-0.5" /> Verifikasi Data
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
                    {/* Data Perubahan */}
                    {orangTuaKandung.is_pending_update && orangTuaKandung.data_perubahan && (
                      <div className={styles.cardAreaChange}>
                        <div className={styles.cardTitle}>
                          <FaExclamationTriangle className={styles.cardIcon} />
                          Draft Usulan Perubahan Data Relasi Krama
                        </div>
                        <div className={styles.cardTable}>
                          <table className={styles.table}>
                            <thead>
                              <tr className={styles.tableHeader}>
                                <th className="p-3 w-1/5 text-left">Kategori</th>
                                <th className="p-3 w-2/5 text-left">Data Aktif Saat Ini</th>
                                <th className="p-3 w-2/5 text-left">Usulan Perubahan</th>
                              </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                              {renderPerubahanRelasiRow("Ayah Kandung", orangTuaKandung.ayah?.nama_lengkap || 'Tidak Diketahui', "ayah_id", "krama")}
                              {renderPerubahanRelasiRow("Ibu Kandung", orangTuaKandung.ibu?.nama_lengkap || 'Tidak Diketahui', "ibu_id", "krama")}
                              {renderPerubahanRelasiRow("Status Hubungan", orangTuaKandung.status_hubungan, "status_hubungan")}
                              {renderPerubahanRelasiRow("Urutan Lahir (Anak Ke)", orangTuaKandung.urutan_lahir, "urutan_lahir")}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {hasAccess && orangTuaKandung.id && (orangTuaKandung.status_verifikasi === 'Draft' || orangTuaKandung.is_pending_update) && (
                      <div className="flex justify-end mt-3 border-t border-gray-100/50 pt-2">
                        <button 
                          onClick={() => {
                            setSelectedRelasi(orangTuaKandung);
                            setModalRelasiData(orangTuaKandung);
let hasChanges = false;
        if (orangTuaKandung.data_perubahan) {
          const rawData = orangTuaKandung.data_perubahan.data_perubahan || orangTuaKandung.data_perubahan;
          if (rawData && typeof rawData === 'object' && Object.keys(rawData).length > 0) {
            hasChanges = true;
          }
        }

        if (orangTuaKandung.is_pending_update && hasChanges) {
          setKonteksVerifikasiRelasi('UPDATE_RELASI');
        } else {
          setKonteksVerifikasiRelasi('CREATE_RELASI');
        }
                            setVerifyRelasiAction(orangTuaKandung.status_verifikasi || 'Draft');
                            setCatatanRelasiValidator('');
                            setIsOpenModalRelasi(true);
                          }}
                          className={styles.btnInfoDetail}>
                          <FaEdit className="mb-0.5 mr-1"/> Verifikasi Ortu Kandung
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
                    {/* Data Perubahan */}
                    {angkat.is_pending_update && angkat.data_perubahan && (
                      <div className={styles.cardAreaChange}>
                        <div className={styles.cardTitle}>
                          <FaExclamationTriangle className={styles.cardIcon} />
                          Draft Usulan Perubahan Data Relasi Krama
                        </div>
                        <div className={styles.cardTable}>
                          <table className={styles.table}>
                            <thead>
                              <tr className={styles.tableHeader}>
                                <th className="p-3 w-1/5 text-left">Kategori</th>
                                <th className="p-3 w-2/5 text-left">Data Aktif Saat Ini</th>
                                <th className="p-3 w-2/5 text-left">Usulan Perubahan</th>
                              </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                              {renderPerubahanRelasiRow("Ayah Angkat", angkat.ayah?.nama_lengkap || 'Tidak Diketahui', "ayah_id", "krama")}
                              {renderPerubahanRelasiRow("Ibu Angkat", angkat.ibu?.nama_lengkap || 'Tidak Diketahui', "ibu_id", "krama")}
                              {renderPerubahanRelasiRow("Status Hubungan", angkat.status_hubungan, "status_hubungan")}
                              {renderPerubahanRelasiRow("Urutan Lahir (Anak Ke)", angkat.urutan_lahir, "urutan_lahir")}
                              {renderPerubahanRelasiRow("Tanggal Pengangkatan Anak", angkat.tanggal_pengangkatan, "tanggal_pengangkatan", "date")}
                              {renderPerubahanRelasiRow("Desa Adat Tujuan", krama?.desa_adat_id, "desa_adat_id_tujuan", 'desa_adat')}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {hasAccess && angkat.id && (angkat.status_verifikasi === 'Draft' || angkat.is_pending_update) && (
                      <div className="flex justify-end mt-3 border-t border-gray-100/50 pt-2">
                        <button 
                          onClick={() => {
                            setSelectedRelasi(angkat);
                            setModalRelasiData(angkat);
let hasChanges = false;
        if (angkat.data_perubahan) {
          const rawData = angkat.data_perubahan.data_perubahan || angkat.data_perubahan;
          if (rawData && typeof rawData === 'object' && Object.keys(rawData).length > 0) {
            hasChanges = true;
          }
        }

        if (angkat.is_pending_update && hasChanges) {
          setKonteksVerifikasiRelasi('UPDATE_RELASI');
        } else {
          setKonteksVerifikasiRelasi('CREATE_RELASI');
        }
                            setVerifyRelasiAction(angkat.status_verifikasi || 'Draft');
                            setCatatanRelasiValidator('');
                            setIsOpenModalRelasi(true);
                          }}
                          className={styles.btnInfoDetail}>
                          <FaEdit className="mb-0.5 mr-1" /> Verifikasi Ortu Angkat
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
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
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
                            {/* DATA PERUBAHAN */}
                            {pAktif.is_pending_update && pAktif.data_perubahan && (
                              <div className={styles.cardAreaChange}>
                                <h4 className={styles.cardTitle}>
                                  <FaExclamationTriangle className={styles.cardIcon} /> 
                                  Draft Usulan Perubahan / Aksi Perkawinan Adat
                                </h4>
                                <div className={styles.cardTable}>
                                  <table className={styles.table}>
                                    <thead>
                                      <tr className={styles.tableHeader}>
                                        <th className="p-3 w-1/5 text-left">Kategori</th>
                                        <th className="p-3 w-1/5 text-left">Data Aktif Saat Ini</th>
                                        <th className="p-3 w-2/5 text-left">Usulan Perubahan</th>
                                      </tr>
                                    </thead>
                                    <tbody className={styles.tableBody}>
                                      {renderPerubahanPerkawinanRow("Nama Suami", pAktif?.suami_id, "suami_id", "text", pAktif, pAktif?.suami, kramaCacheMap)}
                                      {renderPerubahanPerkawinanRow("Nama Istri", pAktif?.istri_id, "istri_id", "text", pAktif, pAktif?.istri, kramaCacheMap)}
                                      {renderPerubahanPerkawinanRow("Jenis Perkawinan", pAktif?.jenis_perkawinan, "jenis_perkawinan", "text", pAktif)}
                                      {renderPerubahanPerkawinanRow("Tanggal Perkawinan", pAktif?.tanggal_perkawinan, "tanggal_perkawinan", "date", pAktif)}
                                      {renderPerubahanPerkawinanRow("Status Perkawinan", pAktif?.status_perkawinan, "status_perkawinan", "text", pAktif)}
                                      {renderPerubahanPerkawinanRow("Tanggal Perceraian", pAktif?.tanggal_cerai, "tanggal_cerai", "date", pAktif)}
                                      {renderPerubahanPerkawinanRow("Pihak yang Meninggal", pAktif?.pihak_meninggal, "pihak_meninggal", "text", pAktif)}
                                      {renderPerubahanPerkawinanRow("Ketetapan Silsilah Predana", pAktif?.pilihan_predana, "pilihan_predana", "text", pAktif)}
                                    </tbody>
                                  </table>
                                  {(() => {
                                  const targetCatatan = 
                                    pAktif?.data_perubahan?.UPDATE_PERKAWINAN?.catatan_update || 
                                    pAktif?.data_perubahan?.UPDATE_PERCERAIAN?.catatan_update || 
                                    pAktif?.data_perubahan?.catatan_update || 
                                    pAktif?.catatan_update;

                                  if (!targetCatatan || String(targetCatatan).trim() === "" || String(targetCatatan) === "undefined" || String(targetCatatan) === "null") {
                                    return null;
                                  }

                                  let teksKeterangan = "";
                                  const isJsonString = typeof targetCatatan === "string" && (targetCatatan.trim().startsWith("{") || targetCatatan.trim().startsWith("["));

                                  if (isJsonString) {
                                    try {
                                      const parsed = JSON.parse(targetCatatan);
                                      teksKeterangan = parsed?.keterangan || targetCatatan;
                                    } catch (error) { 
                                      console.log(error);
                                      teksKeterangan = targetCatatan;
                                    }
                                  } else {
                                    teksKeterangan = String(targetCatatan);
                                  }
                                  
                                  if (!teksKeterangan || teksKeterangan === "undefined" || teksKeterangan === "null") return null;

                                  return (
                                    <div className={styles.noteChange}>
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                        Catatan/Alasan Perubahan:
                                      </span>
                                      <p className="text-[11px] text-black italic">
                                        {teksKeterangan}
                                      </p>
                                    </div>
                                  );
                                })()}
                                </div>
                              </div>
                            )}
                            {/* VERIFIKASI */}
                            {(() => {
                              const desaSuamiId = pAktif.suami?.desa_adat_id || pAktif.suami?.desaAdatId || pAktif.desa_pria_id;
                              const desaIstriId = pAktif.istri?.desa_adat_id || pAktif.istri?.desaAdatId || pAktif.desa_wanita_id;
                              const isAdminTerlibat = user.role === 'Super Admin' || (user.role === 'Admin Desa' && userDesaId && (String(desaSuamiId) === userDesaId || String(desaIstriId) === userDesaId));
                              const sudahVerifikasi = pAktif.riwayat_verifikasi?.some(v => String(v.desa_adat_id) === userDesaId);

                              if (isAdminTerlibat && (pAktif.status_verifikasi === 'Draft' || pAktif.is_pending_update) && !sudahVerifikasi) {
                                return (
                                  <div className="flex justify-end mt-3 border-t border-gray-100 pt-2">
                                    <button 
                                      className={styles.btnInfoDetail}
                                      onClick={() => {
                                        setSelectedKawin(pAktif);
                                        setModalKawinData(pAktif);
                                        
                                        if (pAktif.status_verifikasi === 'Draft') {
                                          setTabVerifikasiAktif('KAWIN');
                                          setKonteksVerifikasiKawin('REGULAR_KAWIN');
                                        } else if (pAktif.data_perubahan?.UPDATE_PERCERAIAN) {
                                          setTabVerifikasiAktif('UPDATE_CERAI');
                                          setKonteksVerifikasiKawin('UPDATE_PERCERAIAN');
                                        } else if (pAktif.data_perubahan?.UPDATE_PERKAWINAN) {
                                          setTabVerifikasiAktif('UPDATE_KAWIN');
                                          setKonteksVerifikasiKawin('UPDATE_PERKAWINAN');
                                        } else if (pAktif.data_perubahan?.PERCERAIAN) {
                                          setTabVerifikasiAktif('CERAI');
                                          setKonteksVerifikasiKawin('REGULAR_CERAI');
                                        } else {
                                          setTabVerifikasiAktif('KAWIN');
                                          setKonteksVerifikasiKawin('REGULAR_KAWIN');
                                        }
                                        
                                        setVerifyKawinAction('Disetujui'); 
                                        setCatatanKawinValidator('');
                                        setIsOpenModalKawin(true);
                                      }}>
                                      <FaEdit className="mb-0.5 mr-1"/> Verifikasi Perkawinan
                                    </button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
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
                                {/* VERIFIKASI */}
                                {(() => {
                                  const desaSuamiId = pLama.suami?.desa_adat_id || pLama.suami?.desaAdatId || pLama.desa_pria_id;
                                  const desaIstriId = pLama.istri?.desa_adat_id || pLama.istri?.desaAdatId || pLama.desa_wanita_id;
                                  const isAdminTerlibat = user.role === 'Super Admin' || (user.role === 'Admin Desa' && userDesaId && (String(desaSuamiId) === userDesaId || String(desaIstriId) === userDesaId));
                                  const sudahVerifikasiParsial = pLama.riwayat_verifikasi?.some(v => String(v.desa_adat_id) === userDesaId);
                                  const isKonteksVerifikasi = pLama.is_pending_update && !sudahVerifikasiParsial;

                                  if (hasAccess || isAdminTerlibat) {
                                    return (
                                      <button 
                                        className={styles.eyeLog}
                                        onClick={() => { 
                                          setSelectedKawin(pLama);
                                          setModalKawinData(pLama);
                                          
                                          if (pLama.data_perubahan?.UPDATE_PERCERAIAN) {
                                            setTabVerifikasiAktif('UPDATE_CERAI');
                                            setKonteksVerifikasiKawin('UPDATE_PERCERAIAN');
                                          } else if (pLama.data_perubahan?.UPDATE_PERKAWINAN) {
                                            setTabVerifikasiAktif('UPDATE_KAWIN');
                                            setKonteksVerifikasiKawin('UPDATE_PERKAWINAN');
                                          } else {
                                            setKonteksVerifikasiKawin('UPDATE_PERKAWINAN');
                                          }
                                          
                                          setVerifyKawinAction(isKonteksVerifikasi ? (pLama.status_verifikasi || 'Draft') : 'Disetujui');
                                          setCatatanKawinValidator('');
                                          setIsOpenModalKawin(true); 
                                        }}>
                                        <FaEye className="text-xs" />
                                        <span>{isKonteksVerifikasi ? 'Verifikasi Perceraian' : 'Detail Log'}</span>
                                      </button>
                                    );
                                  }
                                  return null;
                                })()}
                              </div>
                            </div>
                            {/* DATA PERUBAHAN */}
                            {pLama.is_pending_update && pLama.data_perubahan && (
                              <div className={`${styles.cardAreaChange} mt-2`}>
                                <h4 className={styles.cardTitle}>
                                  <FaExclamationTriangle className={styles.cardIcon} /> 
                                  Draft Usulan Perubahan Data Perkawinan Lampau (Koreksi)
                                </h4>
                                <div className={styles.cardTable}>
                                  <table className={styles.table}>
                                    <thead>
                                      <tr className={styles.tableHeader}>
                                        <th className="p-3 w-1/5 text-left">Kategori</th>
                                        <th className="p-3 w-2/5 text-left">Data Aktif Saat Ini</th>
                                        <th className="p-3 w-2/5 text-left">Usulan Perubahan</th>
                                      </tr>
                                    </thead>
                                    <tbody className={styles.tableBody}>
                                      {renderPerubahanPerkawinanRow("Nama Suami", pLama?.suami_id, "suami_id", "text", pLama, pLama?.suami, kramaCacheMap)}
                                      {renderPerubahanPerkawinanRow("Nama Istri", pLama?.istri_id, "istri_id", "text", pLama, pLama?.istri, kramaCacheMap)}
                                      {renderPerubahanPerkawinanRow("Jenis Perkawinan", pLama?.jenis_perkawinan, "jenis_perkawinan", "text", pLama)}
                                      {renderPerubahanPerkawinanRow("Tanggal Perkawinan", pLama?.tanggal_perkawinan, "tanggal_perkawinan", "date", pLama)}
                                      {renderPerubahanPerkawinanRow("Status Perkawinan", pLama?.status_perkawinan, "status_perkawinan", "text", pLama)}
                                      {renderPerubahanPerkawinanRow("Tanggal Perceraian", pLama?.tanggal_cerai, "tanggal_cerai", "date", pLama)}
                                      {renderPerubahanPerkawinanRow("Pihak yang Meninggal", pLama?.pihak_meninggal, "pihak_meninggal", "text", pLama)}
                                      {renderPerubahanPerkawinanRow("Ketetapan Silsilah Predana", pLama?.pilihan_predana, "pilihan_predana", "text", pLama)}
                                    </tbody>
                                  </table>
                                  {(() => {
                                    const targetCatatan = 
                                      pLama?.data_perubahan?.UPDATE_PERKAWINAN?.catatan_update || 
                                      pLama?.data_perubahan?.UPDATE_PERCERAIAN?.catatan_update || 
                                      pLama?.data_perubahan?.catatan_update || 
                                      pLama?.catatan_update;

                                    if (!targetCatatan || String(targetCatatan).trim() === "" || String(targetCatatan) === "undefined" || String(targetCatatan) === "null") {
                                      return null;
                                    }

                                    let teksKeterangan = "";
                                    const isJsonString = typeof targetCatatan === "string" && (targetCatatan.trim().startsWith("{") || targetCatatan.trim().startsWith("["));

                                    if (isJsonString) {
                                      try {
                                        const parsed = JSON.parse(targetCatatan);
                                        teksKeterangan = parsed?.keterangan || targetCatatan;
                                      } catch (error) {
                                        console.log(error);
                                        teksKeterangan = targetCatatan;
                                      }
                                    } else {
                                      teksKeterangan = String(targetCatatan);
                                    }

                                    if (!teksKeterangan || teksKeterangan === "undefined" || teksKeterangan === "null") return null;

                                    return (
                                      <div className={styles.noteChange}>
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
                                          Catatan/Alasan Perubahan:
                                        </span>
                                        <p className="text-[11px] text-black italic">
                                          {teksKeterangan}
                                        </p>
                                      </div>
                                    );
                                  })()}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* KOLOM KANAN */}
          <div className="space-y-6">
            {/* Foto Profile */}
            <div className={styles.previewFoto}>
              <h3 className={styles.previewTitle}>
                <FaCamera size={16} className="mb-0.5" /> Foto Profile
              </h3>
              <div className="flex flex-col items-center space-y-2 pb-2">
                <img 
                  src={renderFotoProfile()} 
                  alt={`Foto ${krama.nama_lengkap}`} 
                  className={styles.ratioFoto}
                  onError={(e) => {
                    e.target.onerror = null; 
                    e.target.src = DEFAULT_AVATAR_URL;
                  }}
                />
              </div>
            </div>
            {/* Riwayat Peran Adat */}
            <ModernCard title="Riwayat Peran Adat" icon={<MdHistory className="text-white" />}>
              <div className={styles.riwayatAdatSection}>
                {filteredPeranAdat.length === 0 ? (
                  <p className="text-gray-400 text-xs italic text-center py-4">
                    Tidak ada riwayat status peran adat
                  </p>
                ) : (
                  [...filteredPeranAdat]
                  .sort((a, b) => new Date(b.mulai_tanggal) - new Date(a.mulai_tanggal))
                  .map((peran, idx) => (
                    <TimelineItem 
                      key={peran.id || idx}
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
                  [...filteredRiwayatKeluarga]
                  .sort((a, b) => new Date(b.awal_masuk) - new Date(a.awal_masuk))
                  .map((kel, idx) => {
                    const isActive = kel.akhir_masuk === null;
                    const keluargaIdTarget = kel.keluarga_id || kel.keluarga?.id;
                    const keluargaData = keluargaMap[keluargaIdTarget];
                    const namaKepala = keluargaData ? keluargaData.nama_kepala : "Tidak Diketahui";
                    let jenisKeluarga = keluargaData?.jenis_keluarga || kel.keluarga?.jenis_keluarga || "Anggota Keluarga";

                    if (['Biasa', 'Nyentana', 'Pade Gelahang'].includes(jenisKeluarga)) {
                      jenisKeluarga = `Keluarga Perkawinan ${jenisKeluarga}`;
                    } else if (['Leluhur'].includes(jenisKeluarga)) {
                      jenisKeluarga = `Keluarga ${jenisKeluarga}`;
                    }

                    return (
                      <div key={kel.id || idx} className={styles.jalurRiwayat}>
                        <div className={`${styles.jalurAktif} ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <p className={styles.tanggalAktif}>
                          {formatDate(kel.awal_masuk)} - {isActive ? 'Sekarang' : formatDate(kel.akhir_masuk)}
                        </p>
                        <h4 className="text-sm font-bold text-gray-800">
                          {jenisKeluarga}
                        </h4>
                        <p className="text-xs text-gray-500 mt-1">
                          Kepala Keluarga: <span className="font-semibold text-gray-700">{namaKepala}</span>
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
                  if (krama?.id) {
                    const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
                    navigate(`/krama-bali/detail/silsilah/${slug}`);
                  }
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
                <span>Status & Verifikasi Data Krama Bali</span>
              </h3>
              <button onClick={() => setIsOpenModalKrama(false)}>
                <FaTimes size={15} className={styles.iconClose} />
              </button>
            </div>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center gap-2 text-stone-700">
                <h4 className="font-bold text-xs uppercase tracking-wide">
                  Status & Sinkronisasi Data:
                </h4>
              </div>
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
            </div>
            {/* VERIFIKASI */}
            {(is_pending_update || status_verifikasi === "Draft" || status_verifikasi === "Ditolak") && (
              <div className="pt-7">
                <div className="flex items-center gap-2 text-stone-700">
                  <h4 className="font-bold text-xs uppercase tracking-wide">
                    Verifikasi Data:
                  </h4>
                </div>
                <div className="flex gap-2 my-2">
                  <button 
                    type="button"
                    onClick={() => setVerifyKramaAction('Disetujui')}
                    className={`${styles.choise} ${
                      verifyKramaAction === 'Disetujui' ? styles.choiseApproved : styles.choiseDefault
                    }`}>
                    ✅ Setujui Data
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVerifyKramaAction('Ditolak')}
                    className={`${styles.choise} ${
                      verifyKramaAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                    }`}>
                    ❌ Tolak Data
                  </button>
                </div>
                <div className="space-y-1 pt-3 text-left">
                  <label className={styles.label}>
                    Catatan Tambahan / Alasan Penolakan {verifyKramaAction === "Ditolak" && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    className={styles.inputForm}
                    rows="5"
                    placeholder="Masukkan catatan keputusan untuk pembuat..."
                    value={catatanKramaValidator}
                    onChange={(e) => setCatatanKramaValidator(e.target.value)}
                    required={verifyKramaAction === 'Ditolak'}
                  />
                </div>
                <div className="mt-6 flex gap-2 justify-end pt-3">
                  <button 
                    onClick={() => {
                      setIsOpenModalKrama(false);
                      setCatatanKramaValidator('');
                    }} 
                    disabled={isSubmittingKrama} 
                    className={styles.btnCancel}>
                    Kembali
                  </button>
                  <button 
                    onClick={handleVerifyKrama} 
                    disabled={isSubmittingKrama || (verifyKramaAction === 'Ditolak' && !catatanKramaValidator.trim())}
                    className={verifyKramaAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}>
                    {isSubmittingKrama ? 'Memproses...' : 'Konfirmasi Keputusan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL DETAIL VERIFIKASI DATA RELASI KRAMA */}
      {isOpenModalRelasi && modalRelasiData && selectedRelasi && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} max-h-[90vh] flex flex-col overflow-hidden`}>
            <div className={`${styles.headerModal} flex-shrink-0`}>
              <h3>
                <FaUsers size={21} className="text-amber-700 mr-2" /> 
                <span>Status & Verifikasi Data Relasi Krama ({selectedRelasi.status_hubungan})</span>
              </h3>
              <button onClick={() => { 
                setIsOpenModalRelasi(false); 
                setModalRelasiData(null); 
              }}>
                <FaTimes size={15} className={styles.iconClose} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 pr-2 space-y-4">
              <div className="space-y-2 text-[11px]">
                <div className="flex items-center gap-2 text-stone-700">
                  <h4 className="font-bold text-sm uppercase tracking-wide">
                    Status & Sinkronisasi Data:
                  </h4>
                </div>
                <div className={styles.cardVerification}>
                  <div className="text-center">
                    <span className={styles.labelColumn}>
                      Status Verifikasi
                    </span>
                    <span className={`${styles.badge} ${
                      modalRelasiData?.status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                      modalRelasiData?.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {modalRelasiData?.status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                      {modalRelasiData?.status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                      {(
                        modalRelasiData?.status_verifikasi === 'Draft') && <FaHourglassHalf size={10} />}
                      <span>
                        {modalRelasiData?.status_verifikasi || 'Draft'}
                      </span>
                    </span>
                  </div>
                  <div className="text-center">
                    <span className={styles.labelColumn}>
                      Status Sinkronisasi
                    </span>
                    {modalRelasiData?.is_pending_update || modalRelasiData?.status_verifikasi === 'Draft' ? (
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
                  {modalRelasiData?.catatan_admin_desa && (
                    <div className={styles.noteColumn}>
                      <span className={styles.labelColumn}>
                        Catatan Validasi Admin Desa
                      </span>
                      <p className="italic text-black p-1">
                        {modalRelasiData?.catatan_admin_desa}
                      </p>
                    </div>
                  )}
                </div>
              </div>
              {/* Verifikasi */}
              {(selectedRelasi?.is_pending_update || selectedRelasi?.status_verifikasi === "Draft") && (
                <div>
                  <div className="flex items-center gap-2 text-stone-700">
                    <h4 className="font-bold text-sm uppercase tracking-wide">
                      Verifikasi Data:
                    </h4>
                  </div>
                  <div className="flex gap-2 my-2">
                    <button 
                      type="button"
                      onClick={() => setVerifyRelasiAction('Disetujui')}
                      className={`${styles.choise} ${
                        verifyRelasiAction === 'Disetujui' ? styles.choiseApproved : styles.choiseDefault
                      }`}>
                      ✅ Setujui Relasi
                    </button>
                    <button 
                      type="button"
                      onClick={() => setVerifyRelasiAction('Ditolak')}
                      className={`${styles.choise} ${
                        verifyRelasiAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                      }`}>
                      ❌ Tolak Relasi
                    </button>
                  </div>
                  <div className="space-y-1 pt-2 text-left">
                    <label className={styles.label}>
                      Catatan Tambahan / Alasan Penolakan {verifyRelasiAction === "Ditolak" && <span className="text-red-500">*</span>}
                    </label>
                    <textarea
                      className={styles.inputForm}
                      rows="5"
                      placeholder="Masukkan catatan keputusan untuk pembuat..."
                      value={catatanRelasiValidator}
                      onChange={(e) => setCatatanRelasiValidator(e.target.value)}
                      required={verifyRelasiAction === 'Ditolak'}
                    ></textarea>
                  </div>
                  <div className="mt-3 flex gap-2 justify-end">
                    <button 
                      onClick={() => {
                        setIsOpenModalRelasi(false);
                        setSelectedRelasi(null);
                      }} 
                      disabled={isSubmittingRelasi} 
                      className={styles.btnCancel}>
                      Kembali
                    </button>
                    <button 
                      onClick={handleVerifyRelasi} 
                      disabled={isSubmittingRelasi || (verifyRelasiAction === 'Ditolak' && !catatanRelasiValidator.trim())}
                      className={verifyRelasiAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}>
                      {isSubmittingRelasi ? 'Memproses...' : 'Konfirmasi Keputusan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      {/* MODAL DETAIL VERIFIKASI DATA PERKAWINAN ADAT */}
      {isOpenModalKawin && modalKawinData && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} max-h-[90vh] flex flex-col overflow-hidden`}>
            <div className={`${styles.headerModal} flex-shrink-0`}>
              <h3>
                <FaUserFriends size={21} className="text-amber-700 mr-2" /> 
                <span>Status & Verifikasi Data Perkawinan Adat</span>
              </h3>
              <button onClick={() => { 
                setIsOpenModalKawin(false); 
                setModalKawinData(null); 
              }}>
                <FaTimes size={15} className={styles.iconClose} />
              </button>
            </div>
              <div className="flex-1 overflow-y-auto space-y-4">
                <div className="space-y-2 text-[11px]">
                  <div className="flex items-center gap-2 text-stone-700">
                    <h4 className="font-bold text-xs uppercase tracking-wide">
                      Status & Sinkronisasi Data:
                    </h4>
                  </div>
                  <div className={styles.cardVerification}>
                    <div className="text-center">
                      <span className={styles.labelColumn}>
                        Status Verifikasi
                      </span>
                      <span className={`${styles.badge} ${
                        modalKawinData?.status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                        modalKawinData?.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {modalKawinData?.status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                        {modalKawinData?.status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                        {modalKawinData?.status_verifikasi === 'Draft' && <FaHourglassHalf size={10} />}
                        <span>
                          {modalKawinData?.status_verifikasi || 'Draft'}
                        </span>
                      </span>
                    </div>
                    <div className="text-center">
                      <span className={styles.labelColumn}>
                        Status Sinkronisasi
                      </span>
                      {modalKawinData?.is_pending_update || modalKawinData?.status_verifikasi === "Draft" ? (
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
                    {modalKawinData?.catatan_admin_desa && (
                      <div className={styles.noteColumn}>
                        <span className={styles.labelColumn}>
                          Catatan Validasi Admin Desa
                        </span>
                        <div className="overflow-hidden border border-gray-50 mt-1">
                          <table className={styles.cardTabel}>
                            <tbody className="divide-y">
                              {modalKawinData.catatan_admin_desa?.catatan_desa_suami && (
                                <tr>
                                  <td className="px-4 py-2 font-medium w-36 border-r">Desa Adat Suami</td>
                                  <td className="px-4 py-2 italic">{modalKawinData.catatan_admin_desa.catatan_desa_suami}</td>
                                </tr>
                              )}
                              {modalKawinData.catatan_admin_desa?.catatan_desa_istri && (
                                <tr>
                                  <td className="px-4 py-2 font-medium w-36 border-r">Desa Adat Istri</td>
                                  <td className="px-4 py-2 italic">{modalKawinData.catatan_admin_desa.catatan_desa_istri}</td>
                                </tr>
                              )}
                              {modalKawinData.catatan_admin_desa?.status_verifikasi_update && (
                                <tr>
                                  <td className="px-4 py-2 font-medium w-36 border-r">Log Updated</td>
                                  <td className="px-4 py-2 italic text-amber-700 font-medium">
                                    {modalKawinData.catatan_admin_desa?.status_verifikasi_update}
                                  </td>
                                </tr>
                              )}
                              {modalKawinData.catatan_admin_desa?.status_verifikasi_perceraian && (
                                <tr>
                                  <td className="px-4 py-2 font-medium w-36 border-r">Log Perceraian</td>
                                  <td className="px-4 py-2 italic text-blue-700 font-medium">
                                    {modalKawinData.catatan_admin_desa?.status_verifikasi_perceraian}
                                  </td>
                                </tr>
                              )}
                              {typeof modalKawinData.catatan_admin_desa === "string" && (
                                <tr>
                                  <td className="px-4 py-2 font-medium w-36 border-r">Catatan Umum</td>
                                  <td className="px-4 py-2 italic">{modalKawinData.catatan_admin_desa}</td>
                                </tr>
                              )}
                              {modalKawinData.catatan_admin_desa?.last_updated_by && (
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
                  {/* Tab Fokus Verifikasi */}
{(modalKawinData?.status_verifikasi === 'Draft' || modalKawinData?.is_pending_update) && (
  <div className="pt-2 border-b border-gray-100">
    <div className="flex items-center gap-2 text-stone-700">
      <h4 className="font-bold text-xs uppercase tracking-wide">
        Target Fokus Verifikasi:
      </h4>
    </div>
    
    <div className="flex mb-4 pt-1 flex-wrap gap-1">
      {/* 1. JALUR DRAF PERKAWINAN BARU (REGULAR KAWIN) */}
      {modalKawinData?.status_verifikasi === 'Draft' && (
        <button
          type="button"
          className={`${styles.tabTarget} ${tabVerifikasiAktif === 'KAWIN' 
            ? 'bg-amber-700 text-white shadow-sm' 
            : 'text-stone-500 hover:text-stone-800'
          }`}
          onClick={() => {
            setTabVerifikasiAktif('KAWIN');
            setKonteksVerifikasiKawin('REGULAR_KAWIN');
            setVerifyKawinAction('Disetujui');
            setCatatanKawinValidator('');
          }}>
          Draft Pendaftaran Perkawinan
        </button>
      )}

      {/* 2. JALUR DRAF PERCERAIAN BARU (REGULAR CERAI) */}
      {modalKawinData?.data_perubahan?.PERCERAIAN && (
        <button
          type="button"
          disabled={modalKawinData?.status_verifikasi === 'Draft'}
          title={modalKawinData?.status_verifikasi === 'Draft' ? "Status perkawinan harus disetujui terlebih dahulu sebelum memproses perceraian." : "Verifikasi draft perceraian"}
          className={`${styles.tabTarget} ${
            modalKawinData?.status_verifikasi === 'Draft'
              ? styles.tabTargetDisable
              : tabVerifikasiAktif === 'CERAI'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'text-stone-500 hover:text-stone-800'
          }`}
          onClick={() => {
            if (modalKawinData?.status_verifikasi === 'Draft') return;
            setTabVerifikasiAktif('CERAI');
            setKonteksVerifikasiKawin('REGULAR_CERAI');
            setVerifyKawinAction('Disetujui');
            setCatatanKawinValidator('');
          }}>
          Draft Usulan Perceraian
        </button>
      )}

      {/* 3. JALUR DRAF KOREKSI DATA PERKAWINAN (UPDATE PERKAWINAN) */}
      {modalKawinData?.data_perubahan?.UPDATE_PERKAWINAN && (
        <button
          type="button"
          className={`${styles.tabTarget} ${tabVerifikasiAktif === 'UPDATE_KAWIN'
            ? 'bg-emerald-700 text-white shadow-sm'
            : 'text-stone-500 hover:text-stone-800'
          }`}
          onClick={() => {
            setTabVerifikasiAktif('UPDATE_KAWIN');
            setKonteksVerifikasiKawin('UPDATE_PERKAWINAN');
            setVerifyKawinAction('Disetujui');
            setCatatanKawinValidator('');
          }}>
          Koreksi Data Perkawinan
        </button>
      )}

      {/* 4. JALUR DRAF KOREKSI DATA PERCERAIAN (UPDATE PERCERAIAN) */}
      {modalKawinData?.data_perubahan?.UPDATE_PERCERAIAN && (
        <button
          type="button"
          className={`${styles.tabTarget} ${tabVerifikasiAktif === 'UPDATE_CERAI'
            ? 'bg-indigo-700 text-white shadow-sm'
            : 'text-stone-500 hover:text-stone-800'
          }`}
          onClick={() => {
            setTabVerifikasiAktif('UPDATE_CERAI');
            setKonteksVerifikasiKawin('UPDATE_PERCERAIAN');
            setVerifyKawinAction('Disetujui');
            setCatatanKawinValidator('');
          }}>
          Koreksi Data Perceraian
        </button>
      )}
    </div>
    
    {/* Info Alert pembantu jika status perkawinan perdana masih bertipe Draft */}
    {modalKawinData?.status_verifikasi === 'Draft' && modalKawinData?.data_perubahan?.PERCERAIAN && (
      <span className="text-[10px] text-amber-700 italic block mb-3 bg-amber-50 p-2 rounded border-l-2 border-amber-500">
        * Catatan: Sistem mendeteksi adanya draf perceraian yang tertunda. Anda diwajibkan menyetujui/mengesahkan status <strong>Draft Pendaftaran Perkawinan</strong> ini terlebih dahulu sebelum tab perceraian terbuka.
      </span>
    )}
  </div>
)}
                  {/* VERIFIKASI */}
                  {(modalKawinData?.is_pending_update || modalKawinData?.status_verifikasi === "Draft" || modalKawinData?.status_verifikasi === "Ditolak") && (
                    <div>
                      <div className="flex items-center gap-2 text-stone-700">
                        <h4 className="font-bold text-xs uppercase tracking-wide">
                          Verifikasi Data:
                        </h4>
                      </div>
                      <div className="flex gap-2 my-2">
                        <button 
                          type="button"
                          onClick={() => setVerifyKawinAction('Disetujui')}
                          className={`${styles.choise} ${
                            verifyKawinAction === 'Disetujui' ? styles.choiseApproved : styles.choiseDefault
                          }`}>
                          ✅ Setujui Data
                        </button>
                        <button 
                          type="button"
                          onClick={() => setVerifyKawinAction('Ditolak')}
                          className={`${styles.choise} ${
                            verifyKawinAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                          }`}>
                          ❌ Tolak Data
                        </button>
                      </div>
                      <div className="space-y-1 pt-4 text-left">
                        <label className={styles.label}>
                          Catatan Tambahan / Alasan Penolakan {verifyKawinAction === "Ditolak" && <span className="text-red-500">*</span>}
                        </label>
                        <textarea
                          className={styles.inputForm}
                          rows="5"
                          placeholder="Masukkan catatan keputusan untuk pembuat..."
                          value={catatanKawinValidator} 
                          onChange={(e) => setCatatanKawinValidator(e.target.value)}
                          required={verifyKawinAction === 'Ditolak'}
                        />
                      </div>
                      <div className="mt-6 flex gap-2 justify-end pt-3">
                        <button 
                          onClick={() => {
                            setIsOpenModalKawin(false);
                            setCatatanKawinValidator('');
                          }} 
                          disabled={isSubmittingKawin} 
                          className={styles.btnCancel}>
                          Kembali
                        </button>
                        <button 
                          onClick={handleVerifyKawin} 
                          disabled={isSubmittingKawin || (verifyKawinAction === 'Ditolak' && !catatanKawinValidator.trim())}
                          className={verifyKawinAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}>
                          {isSubmittingKawin ? 'Memproses...' : 'Konfirmasi Keputusan'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
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

export default VerifikasiDataDetail;