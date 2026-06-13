import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
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
  FaExclamationTriangle
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaDetail.module.css';
import ModalDetailKrama from './ModalDetailKrama.jsx';
import ModalDetailRelasi from './ModalDetailRelasi.jsx';

// Helper: Modal konfirmasi
const ConfirmationModal = ({ isOpen, onClose, onConfirm, title, message, isProcessing }) => {
  if (!isOpen) return null;
  return (
    <div className={styles.modalOverlay}>
      <div className={`${styles.modalContainer} animate-fade-in`}>
        <div className="p-6">
          <div className="flex justify-center mb-5">
            <div className={styles.elipsis}>
              <FaExclamationTriangle className="text-red-600 text-2xl" />
            </div>
          </div>
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-2">
              {title}
            </h3>
            <p className="text-sm text-gray-600">
              {message}
            </p>
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

// Helper: Membuat slug url
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
  const navigate = useNavigate();
  const location = useLocation();

  const [krama, setKrama] = useState(null);
  const [relasiList, setRelasiList] = useState([]);
  const [perkawinanList, setPerkawinanList] = useState([]);
  const [riwayatKeluargaList, setRiwayatKeluargaList] = useState([]);
  const [peranAdatList, setPeranAdatList] = useState([]);

  const [keluargaMap, setKeluargaMap] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  const [masterDesaMap, setMasterDesaMap] = useState({});
  const [isModalKramaOpen, setIsModalKramaOpen] = useState(false);
  const [masterKramaMap, setMasterKramaMap] = useState({});
  const [isModalRelasiOpen, setIsModalRelasiOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedRelasi, setSelectedRelasi] = useState(null);


  // State alert notifikasi global
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

  // State menampilkan modal konfirmasi
  const [modal, setModal] = useState({ 
    show: false, 
    id: null 
  });

  // Helper: Decode slug url menjadi id asli
  const realId = useMemo(() => {
    if (!slugParam) return null;
    if (!slugParam.includes('-')) return slugParam;
    try {
      const parts = slugParam.split('-');
      const encodedId = parts[parts.length - 1];
      return atob(encodedId);
    } catch (error) {
      console.error("Gagal melakukan decode ID dari slug URL:", error);
      return null;
    }
  }, [slugParam]);

  // Effect: Mengambil data master krama bali
  const fetchAllData = async () => {
    if (!realId) {
      setIsLoading(false);
      return;
    }
    try {
      setIsLoading(true);
      const [
        resKrama,
        resRelasi,
        resPerkawinan,
        resRiwayatKeluarga,
        resPeranAdat,
        resKeluarga,
        resDesaAdat,
        resKramaList
      ] = await Promise.allSettled([
        axiosInstance.get(`/krama-bali/${realId}`),
        axiosInstance.get('/relasi-krama?mode=public'),
        axiosInstance.get('/perkawinan?mode=public'),
        axiosInstance.get('/riwayat-keluarga'),
        axiosInstance.get('/riwayat-peran-adat'),
        axiosInstance.get('/keluarga'),
        axiosInstance.get('/desa-adat'),
        axiosInstance.get('/krama-bali?mode=public')
      ]);

      // Setting data krama
      if (resKrama.status === 'fulfilled') {
        setKrama(resKrama.value.data.data);
      }
      // Setting data relasi orang tua
      if (resRelasi.status === 'fulfilled') {
        const rawRelasi = resRelasi.value.data.data;
        const cleanRelasiList = Array.isArray(rawRelasi) ? rawRelasi : (rawRelasi ? [rawRelasi] : []);
        setRelasiList(cleanRelasiList);

        const relasiSpesifik = cleanRelasiList.find(r => 
          String(r.anak_id) === String(realId) || 
          String(r.id_krama) === String(realId)
        );
        if (!isModalRelasiOpen || relasiSpesifik) {
          setSelectedRelasi(relasiSpesifik || null);
        }
      }
      // Setting data perkawinan
      if (resPerkawinan.status === 'fulfilled') {
        const rawPerkawinan = resPerkawinan.value.data.data;
        setPerkawinanList(Array.isArray(rawPerkawinan) ? rawPerkawinan : (rawPerkawinan ? [rawPerkawinan] : []));
      }
      // Setting data riwayat keluarga
      if (resRiwayatKeluarga.status === 'fulfilled') {
        const rawRiwayatKel = resRiwayatKeluarga.value.data.data;
        setRiwayatKeluargaList(Array.isArray(rawRiwayatKel) ? rawRiwayatKel : (rawRiwayatKel ? [rawRiwayatKel] : []));
      }
      // Setting data riwayat status peran adat
      if (resPeranAdat.status === 'fulfilled') {
        const rawPeran = resPeranAdat.value.data.data;
        setPeranAdatList(Array.isArray(rawPeran) ? rawPeran : (rawPeran ? [rawPeran] : []));
      }
      // Mengambil data keluarga untuk nama Kepala Keluarga
      if (resKeluarga.status === 'fulfilled') {
        const rawKeluarga = resKeluarga.value.data.data || [];
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
      // Mengambil data desa adat
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
      // Mengambil data krama bali
      if (resKramaList.status === 'fulfilled') {
        const rawKramaList = resKramaList.value.data?.data || [];
        const mappingKrama = {};
        rawKramaList.forEach(k => {
          if (k && k.id !== undefined) {
            mappingKrama[k.id] = k.nama_lengkap;
            mappingKrama[String(k.id)] = k.nama_lengkap;
          }
        });
        setMasterKramaMap(mappingKrama);
      }
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: 'Gagal memuat detail data krama bali.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realId]);

  // Helper: Membatalkan perubahan data krama
  const handleCancelKramaUpdate = async () => {
    setIsProcessing(true);
    try {
      await axiosInstance.patch(`/krama-bali/cancel-update/${realId}`);
      setAlert({
        show: true,
        type: 'success',
        message: 'Pengajuan perubahan data krama berhasil dibatalkan.'
      });
      setIsModalKramaOpen(false);
      fetchAllData();
    } catch (error) {
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal membatalkan pengajuan perubahan data.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper: Menangani tombol untuk membuka modal relasi
  const handleOpenModalRelasi = (dataRelasiItem) => {
    setSelectedRelasi(dataRelasiItem);
    setIsModalRelasiOpen(true);
  };

  // Helper: Membatalkan perubahan data relasi
  const handleCancelRelasiUpdate = async () => {
    if (!selectedRelasi) return;
    setIsProcessing(true);
    try {
      // Sesuaikan endpoint backend untuk membatalkan draft relasi Anda
      await axiosInstance.put(`/relasi-krama/${selectedRelasi.id}/batal-perubahan`);
      
      setAlert({ show: true, type: 'success', message: 'Perubahan relasi berhasil dibatalkan.' });
      setIsModalRelasiOpen(false);
      fetchAllData(); // Muat ulang data halaman detail krama
    } catch (error) {
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal membatalkan perubahan relasi.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper: Hak akses manajemen data
  const hasAccess = useMemo(() => {
    if (!user || !krama) return false;
    if (user.role === 'Super Admin') return true;
    if (user.role === 'Admin Desa' && user.desa_adat_id === krama.desa_adat_id) return true;
    if (user.role === 'Krama' && user.id === krama.user_id) return true;
    return false;
  }, [user, krama]);

  // Effect: Alert Diteruskan ke alert halaman lain
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
  
  // Effect: Auto-Close Notifikasi Alert
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: Menghapus data krama
  const handleDelete = async () => {
    if (!modal.id) return;
    setIsDeleting(true);
    try {
      await axiosInstance.delete(`/krama-bali/${realId}`);
      const targetRoute = location.state?.fromPersonal ? '/krama-bali/my-data' : '/krama-bali';
      setModal({ 
        show: false, 
        id: null 
      });
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

  // Helper: Menangani tombol kembali
  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate('/krama-bali');
    }
  };

  // Helper: Menangani filter data master
  const processedData = useMemo(() => {
    if (!krama) return null;

    const orangTuaKandung = relasiList.find(r => 
      r && String(r.anak_id) === String(krama.id) && r.status_hubungan === 'Anak Kandung'
    );
    const orangTuaAngkatList = relasiList.filter(r => 
      r && String(r.anak_id) === String(krama.id) && r.status_hubungan === 'Anak Angkat'
    );
    const userPerkawinan = perkawinanList.filter(p => 
      p && (String(p.suami_id) === String(krama.id) || String(p.istri_id) === String(krama.id))
    );
    const lastKawin = userPerkawinan.length > 0 ? userPerkawinan[userPerkawinan.length - 1] : null;
    let namaPasangan = "Tidak Diketahui";

    if (lastKawin) {
      namaPasangan = String(lastKawin.suami_id) === String(krama.id)
        ? lastKawin.istri?.nama_lengkap || "Istri" 
        : lastKawin.suami?.nama_lengkap || "Suami";
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
      lastKawin,
      namaPasangan,
      filteredRiwayatKeluarga,
      filteredPeranAdat,
      wilayahAdatLengkap,
      alamatAsalLuar
    };
  }, [krama, relasiList, perkawinanList, riwayatKeluargaList, peranAdatList]);

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
        Data krama bali tidak ditemukan.
      </div>
    );
  }

  const {
    orangTuaKandung,
    orangTuaAngkatList,
    lastKawin,
    namaPasangan,
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
            Detail Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Informasi lengkap mengenai krama bali yang termasuk ke dalam silsilah Adat Bali
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
      {/* Modal Konfirmasi */}
      <ConfirmationModal 
        isOpen={modal.show}
        onClose={() => setModal({ show: false, id: null })}
        onConfirm={handleDelete}
        isProcessing={isDeleting}
        title="Konfirmasi Menghapus"
        message="Apakah Anda yakin ingin menghapus data krama ini secara permanen beserta seluruh riwayatnya?"
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
          {/* KOLOM KIRI */}
          <div className="lg:col-span-2 space-y-6">
            {/* Data Krama Bali */}
            <ModernCard title="Identitas Krama Bali" icon={<FaUser className="text-white" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                  <button onClick={() => setIsModalKramaOpen(true)} className={styles.btnInfoDetail}>
                    <FaEdit className="mb-0.5"/> Kelola Data
                  </button>
                </div>
              )}
            </ModernCard>
            {/* Data Orang Tua */}
            <div className={styles.cardSection}>
              <div className={styles.headerSection}>
                <FaUsers className="text-white" />
                <h3 className={styles.titleSection}>
                  Informasi Orang Tua
                </h3>
              </div>
              <div className="p-6 space-y-6">
                {/* Bagian Orang Tua Kandung */}
                {orangTuaKandung && (
                  <div>
                    <div className={styles.headerCard}>
                      <FaUsers className="text-amber-700 text-sm" />
                      <h4 className={styles.titleHeader}>
                        Orang Tua Kandung
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pl-1">
                      <div className="md:col-span-2 flex flex-col gap-4">
                        {orangTuaKandung?.ayah?.nama_lengkap && (
                          <IconInfoRow 
                            icon={<FaUser className="text-blue-600" />} 
                            label="Ayah" 
                            value={orangTuaKandung.ayah.nama_lengkap} 
                          />
                        )}
                        {orangTuaKandung?.ibu?.nama_lengkap && (
                          <IconInfoRow 
                            icon={<FaUser className="text-pink-600" />} 
                            label="Ibu" 
                            value={orangTuaKandung.ibu.nama_lengkap} 
                          />
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
                  </div>
                )}
                {/* Bagian Orang Tua Angkat */}
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
                  </div>
                ))}
                {!orangTuaKandung && orangTuaAngkatList.length === 0 && (
                  <p className="text-gray-400 text-xs italic text-center py-2">
                    Data orang tua belum terdaftar.
                  </p>
                )}
                {hasAccess && (
                  <div className="flex justify-end mt-3 border-t border-gray-100">
                    <button 
                      onClick={() => {
                        const relasiAktif = orangTuaKandung 
                          ? orangTuaKandung 
                          : (orangTuaAngkatList && orangTuaAngkatList.length > 0 ? orangTuaAngkatList[0] : null);
                        handleOpenModalRelasi(relasiAktif);
                      }}
                      className={styles.btnInfoDetail}
                    >
                      <FaEdit className="mb-0.5"/> Kelola Data
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
                  Informasi Status Perkawinan Adat
                </h3>
              </div>
              <div className="p-6 space-y-6">
                <div className={styles.statusSection}>
                  <div className={styles.statusHeader}>
                    <FaHeart className={lastKawin && lastKawin.status_perkawinan === "Kawin" ? "text-pink-600 text-xs" : "text-gray-400 text-xs"} />
                    <label className={styles.statusLabel}>
                      Status Perkawinan Saat Ini
                    </label>
                  </div>
                  <div>
                    <span className={`${styles.statusDetail} ${
                      (() => {
                        const status = lastKawin?.status_perkawinan;
                        if (status === 'Kawin') {
                          return 'bg-pink-100 text-pink-700';
                        } 
                        if (status === 'Cerai' || status === 'Cerai Mati') {
                          return 'bg-red-100 text-red-700';
                        }
                        return 'bg-gray-100 text-gray-600';
                      })()
                    }`}>
                      {lastKawin?.status_perkawinan || "Belum Kawin"}
                    </span>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {lastKawin && lastKawin.status_perkawinan !== "Belum Kawin" && (
                    <>
                      <InfoItem 
                        label="Jenis Perkawinan" 
                        value={lastKawin.jenis_perkawinan} 
                        icon={<FaIdCard/>} 
                      />
                      <InfoItem 
                        label="Nama Pasangan" 
                        value={namaPasangan} 
                        icon={<FaUser/>}
                      />
                      <InfoItem 
                        label="Tanggal Perkawinan" 
                        value={formatDate(lastKawin.tanggal_perkawinan)} 
                        icon={<FaCalendarAlt/>}
                      />
                      {lastKawin.tanggal_cerai && (
                        <InfoItem 
                          label="Tanggal Perceraian" 
                          value={<span className="text-red-600 font-bold">{formatDate(lastKawin.tanggal_cerai)}</span>} 
                          icon={<FaCalendarAlt/>}
                        />
                      )}
                    </>
                  )}
                </div>
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
                    Tidak ada riwayat status peran adat.
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
                    Belum terdaftar dalam keluarga manapun.
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
                className={styles.btnVisualisasi}
              >
                <FaSitemap /> Visualisasi Silsilah
              </button>
              <button onClick={handleBack} className={styles.btnBackNetral}>
                <FaArrowLeft /> Kembali
              </button>
            </div>
          </div>
        </div>
        {/* Action Buttons Group */}
        <div className={styles.buttonGroup}>
          {hasAccess && (
            <>
              <button onClick={() => navigate(`/krama-bali/edit/${realId}`)} className={styles.btnEditYellow}>
                <FaEdit /> Update Data
              </button>
              <button onClick={() => setModal({ show: true, id: krama.id })} className={styles.btnHapusRed}>
                <FaTrash /> Hapus Data
              </button>
            </>
          )}
        </div>
      </div>
      <Footer />
      {/* Modal Detail Krama */}
      <ModalDetailKrama 
        isOpen={isModalKramaOpen}
        onClose={() => setIsModalKramaOpen(false)}
        krama={krama}
        masterDesaMap={masterDesaMap}
        wilayahAdatLengkap={wilayahAdatLengkap}
        onEdit={() => {
          setIsModalKramaOpen(false);
          const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
          navigate(`/krama-bali/detail/edit-krama/${slug}`);
        }}
        onDelete={() => {
          setIsModalKramaOpen(false);
          setModal({ show: true, id: krama.id }); 
        }}
        onCancelUpdate={handleCancelKramaUpdate}
        isProcessing={isProcessing}
      />
      {/* Modal Detail Relasi */}
      <ModalDetailRelasi
        isOpen={isModalRelasiOpen}
        onClose={() => {
          setIsModalRelasiOpen(false);
          setTimeout(() => setSelectedRelasi(null), 300); 
        }}
        relasi={selectedRelasi}
        namaAyahLama={selectedRelasi?.ayah?.nama_lengkap}
        namaIbuLama={selectedRelasi?.ibu?.nama_lengkap}
        namaAnakLama={selectedRelasi?.anak?.nama_lengkap || krama?.nama_lengkap}
        masterKramaMap={masterKramaMap} 
        onEdit={() => {
          setIsModalRelasiOpen(false);
          const slug = createSlug(
            krama?.nama_lengkap || 'krama', 
            selectedRelasi?.status_hubungan || 'relasi', 
            selectedRelasi?.id
          );
          navigate(`/krama-bali/detail/edit-relasi/${slug}`);
        }}
        onDelete={() => {
          setIsModalRelasiOpen(false);
          setModal({ show: true, type: 'relasi', id: selectedRelasi?.id });
        }}
        onCancelUpdate={handleCancelRelasiUpdate} 
        onAddRelasi={() => {
          setIsModalRelasiOpen(false);
          // LOG DIAGNOSTIK: Pastikan krama.id tidak bernilai undefined sebelum melompat!
  console.log("=== CHECK DATA SEBELUM PINDAH HALAMAN ===");
  console.log("Data Krama murni:", krama);
  console.log("ID Krama yang dikirim:", krama?.id);

  if (!krama?.id) {
    window.alert("Waduh! Data Krama belum sepenuhnya termuat dari server.");
    return;
  }

  const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
  navigate(`/krama-bali/detail/add-relasi/${slug}`, { 
    state: { defaultAnakId: krama.id } 
  });
        }}
        isProcessing={isProcessing}
      />
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