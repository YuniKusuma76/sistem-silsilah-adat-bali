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
  FaUserCheck,
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
  FaTimes,
  FaHourglassHalf,
  FaExclamationTriangle,
  FaCheck,
  FaArrowRight 
} from 'react-icons/fa';
import axiosInstance from '../src/api/axiosInstance.js';
import Footer from '../src/components/Footer/Footer.jsx';
import styles from './PengajuanKramaDetail.module.css';

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

const PengajuanKramaDetail = ({ user }) => {
  const { id: slugParam } = useParams();
  const [isLoading, setIsLoading] = useState(true);

  const [krama, setKrama] = useState(null);
  const [relasiList, setRelasiList] = useState([]);
  const [perkawinanList, setPerkawinanList] = useState([]);
  const [riwayatKeluargaList, setRiwayatKeluargaList] = useState([]);
  const [peranAdatList, setPeranAdatList] = useState([]);

  const [keluargaMap, setKeluargaMap] = useState({});
  const [masterDesaMap, setMasterDesaMap] = useState({});

  const [isOpenModalKelola, setIsOpenModalKelola] = useState(false); 
  const [verifyAction, setVerifyAction] = useState('Disetujui');
  const [catatanValidator, setCatatanValidator] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isOpenModalRelasi, setIsOpenModalRelasi] = useState(false);
  const [selectedRelasi, setSelectedRelasi] = useState(null); 
  const [verifyRelasiAction, setVerifyRelasiAction] = useState('Disetujui');
  const [catatanRelasiValidator, setCatatanRelasiValidator] = useState('');
  const [isSubmittingRelasi, setIsSubmittingRelasi] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  // State alert notifikasi global
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
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
      console.error("Format slug tidak valid:", error);
      return null;
    }
  }, [slugParam]);

  // Helper: Fungsi hak akses manajemen data krama
  const hasAccess = useMemo(() => {
    if (!user || !krama) return false;
    if (user.role === 'Super Admin') return true;
    if (user.role === 'Admin Desa') {
      const userDesaId = String(user.desa_adat_id || user.desaAdatId || user.desa_adat?.id);
      const kramaDesaId = String(krama.desa_adat_id || krama.desaAdatId || krama.desa_id);
      if (String(user.id || user.userId) === String(krama.user_id)) return true;

      if (userDesaId === kramaDesaId) return true;
      const isDesaTujuan = relasiList.some(r => {
        const tujuanId = String(r.desa_adat_id_tujuan || r.data_perubahan?.desa_adat_id_tujuan || "");
        return tujuanId === userDesaId;
      });

      return isDesaTujuan;
    }
    if (user.role === 'Krama') {
      return String(user.id || user.userId) === String(krama.user_id);
    }
    return false;
  }, [user, krama, relasiList]);

  // Effect: Mengambil data master krama bali
  const fetchDetailData = async () => {
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
        resDesaAdat
      ] = await Promise.allSettled([
        axiosInstance.get(`/krama-bali/${realId}`),
        axiosInstance.get(`/relasi-krama?anak_id=${realId}&mode=verification`),
        axiosInstance.get('/perkawinan'),
        axiosInstance.get('/riwayat-keluarga'),
        axiosInstance.get('/riwayat-peran-adat'),
        axiosInstance.get('/keluarga'),
        axiosInstance.get('/desa-adat')
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
      // Setting data desa adat
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
        message: 'Gagal memuat detail data verifikasi krama bali.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDetailData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realId]);

  // Helper: Fungsi verifikasi data krama bali
  const handleVerifyKrama = async () => {
    if (verifyAction === 'Ditolak' && !catatanValidator.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: 'Wajib mengisi catatan/alasan ketika pengajuan pendaftaran data krama bali ditolak!'
      });
      return;
    }
    setIsSubmitting(true);
    try {
      await axiosInstance.patch(`/krama-bali/verifikasi/${realId}`, {
        status_verifikasi: verifyAction,
        catatan_admin_desa: catatanValidator
      });

      setAlert({
        show: true,
        type: 'success',
        message: `Pengajuan data krama bali berhasil diproses dengan status: ${verifyAction}.`
      });
      
      setIsOpenModalKelola(false); 
      setCatatanValidator(''); 
      fetchDetailData();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menyimpan keputusan verifikasi data krama bali.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper: Fungsi verifikasi data relasi krama
  const handleVerifyRelasi = async () => {
    if (!selectedRelasi?.id) return;
    if (verifyRelasiAction === 'Ditolak' && !catatanRelasiValidator.trim()) {
      setAlert({
        show: true,
        type: 'warning',
        message: 'Wajib mengisi catatan/alasan ketika pengajuan pendaftaran data relasi krama ditolak!'
      });
      return;
    }
    setIsSubmittingRelasi(true);
    try {
      await axiosInstance.patch(`/relasi-krama/verifikasi/${selectedRelasi.id}`, {
        status_verifikasi: verifyRelasiAction,
        catatan_admin_desa: catatanRelasiValidator 
      });

      setAlert({
        show: true,
        type: 'success',
        message: `Pengajuan data relasi krama berhasil diproses dengan status: ${verifyRelasiAction}.`
      });
      
      setIsOpenModalRelasi(false);
      setCatatanRelasiValidator('');
      setSelectedRelasi(null);
      fetchDetailData();
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || 'Gagal menyimpan keputusan verifikasi data relasi krama.'
      });
    } finally {
      setIsSubmittingRelasi(false);
    }
  };

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

  // Effect: Menangani scroll ketika modal ditampilkan
  useEffect(() => {
    if (isOpenModalKelola || isOpenModalRelasi) {
      document.body.classList.add("no-scroll");
    } else {
      document.body.classList.remove("no-scroll");
    }
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, [isOpenModalKelola, isOpenModalRelasi]);

  // Effect: Mengotomatiskan pilihan tombol verifikasi krama bali
  useEffect(() => {
  if (isOpenModalKelola && krama) {
    setVerifyAction('Disetujui');
    setCatatanValidator('');
  }
}, [isOpenModalKelola, krama]);

  // Effect: Mengotomatiskan pilihan tombol verifikasi relasi mengikuti data yang dibuka
  useEffect(() => {
    if (selectedRelasi) {
      const statusSistem = selectedRelasi.status_verifikasi;
      if (statusSistem === 'Draft' || statusSistem === 'Menunggu Penerimaan' || statusSistem === 'Menunggu Pelepasan' || !statusSistem) {
        setVerifyRelasiAction('Disetujui');
      } else {
        setVerifyRelasiAction(statusSistem);
      }
    }
  }, [selectedRelasi]);

  // Helper: Menangani tombol kembali
  const handleBack = () => {
    if (location.state?.fromPerkawinan) {
      navigate('/verifikasi-data/perkawinan');
    } else if (location.state?.fromRelasi) {
      navigate('/verifikasi-data/relasi-krama');
    } else {
      navigate('/verifikasi-data/krama-bali');
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

  // Ekstraksi data krama aktif
  const {
    data_perubahan,
    is_pending_update,
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

  // Helper: Mengambil data di dalam data perubahan JSONB
  const renderPerubahanRow = (label, nilaiLama, namaField, type = 'text') => {
    if (!data_perubahan || data_perubahan[namaField] === undefined) return null;

    let nilaiBaru = data_perubahan[namaField];
    let nilaiLamaDiformat = nilaiLama;

    // Kondisi 1: Jika tipe data adalah date
    if (type === 'date') {
      nilaiLamaDiformat = formatDate(nilaiLama);
      nilaiBaru = formatDate(nilaiBaru);
    }
    // Kondisi 2: Jika tipe data adalah boolean
    if (type === 'boolean') {
      nilaiLamaDiformat = nilaiLama ? 'Krama Bali' : 'Krama Luar Bali';
      nilaiBaru = nilaiBaru ? 'Krama Bali' : 'Krama Luar Bali';
    }
    // Kondisi 3: Jika tipe data adalah desa adat id
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

    if (nilaiLamaDiformat === nilaiBaru) return null;

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

  const renderLivePerubahanRelasi = (label, nilaiLama, namaField, relasiObj, type = 'text') => {
    const dataPerubahan = relasiObj?.data_perubahan || {};

    let nilaiBaru = dataPerubahan[namaField] !== undefined 
      ? dataPerubahan[namaField] 
      : relasiObj[namaField]; 

    if (namaField === 'status_hubungan') nilaiBaru = dataPerubahan.status_hubungan;

    let nilaiLamaDiformat = nilaiLama;

    if (type === 'desa_adat') {
      const idLamaStr = String(nilaiLama);
      if (masterDesaMap && masterDesaMap[idLamaStr]) {
        nilaiLamaDiformat = `Desa Adat ${masterDesaMap[idLamaStr].trim()}`;
      } else {
        nilaiLamaDiformat = nilaiLama && String(nilaiLama) !== "null" ? `Desa Adat ID ${nilaiLama}` : '-';
      }

      const idBaruStr = String(nilaiBaru);
      if (masterDesaMap && masterDesaMap[idBaruStr]) {
        nilaiBaru = `Desa Adat ${masterDesaMap[idBaruStr].trim()}`;
      } else {
        nilaiBaru = nilaiBaru && String(nilaiBaru) !== "null" ? `Desa Adat ID ${nilaiBaru}` : '-';
      }
    }

    if (type === 'date') {
      nilaiLamaDiformat = formatDate(nilaiLama);
      nilaiBaru = formatDate(nilaiBaru);
    }

    if (type === 'krama') {
      nilaiLamaDiformat = nilaiLama && String(nilaiLama).trim() !== "null" ? nilaiLama : 'Tidak Diketahui';
      if (namaField === 'ayah_id') {
        const namaAyah = dataPerubahan?.nama_ayah_baru || relasiObj?.ayah?.nama_lengkap;
        nilaiBaru = (namaAyah && String(namaAyah).trim() !== "null") ? namaAyah : 'Tidak Diketahui';
      } else if (namaField === 'ibu_id') {
        const namaIbu = dataPerubahan?.nama_ibu_baru || relasiObj?.ibu?.nama_lengkap;
        nilaiBaru = (namaIbu && String(namaIbu).trim() !== "null") ? namaIbu : 'Tidak Diketahui';
      }
    }

    if (String(nilaiLamaDiformat || '').trim() === String(nilaiBaru || '').trim()) return null;

    return (
      <tr className="hover:bg-gray-50 transition-colors text-xs" key={namaField}>
        <td className={styles.labelChange + " p-2 font-medium text-gray-500"}>
          {label}
        </td>
        <td className="p-2 border-r border-gray-100 text-gray-600 font-semibold">
          {nilaiLamaDiformat ?? '-'}
        </td>
        <td className="p-2">
          <div className="flex items-center gap-1.5">
            <FaArrowRight className="text-amber-600 text-[10px]" />
            <span className="font-bold text-amber-700">
              {nilaiBaru ?? '-'}
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
            Detail Data Krama Bali
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
                </div>
              )}
              {hasAccess && (
                <div className="flex justify-end mt-3 border-t border-gray-100">
                  <button 
                    onClick={() => {
                      setCatatanValidator('');
                      setIsOpenModalKelola(true);
                    }}
                    className={styles.btnInfoDetail}
                  >
                    <FaUserCheck className="mb-0.5"/> Kelola Data
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
                                <th className="p-3 w-1/4">Kategori</th>
                                <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                                <th className="p-3 w-3/8">Usulan Perubahan</th>
                              </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                              {renderLivePerubahanRelasi("Ayah Kandung", orangTuaKandung.ayah?.nama_lengkap || 'Tidak Diketahui', "ayah_id", orangTuaKandung, "krama")}
                              {renderLivePerubahanRelasi("Ibu Kandung", orangTuaKandung.ibu?.nama_lengkap || 'Tidak Diketahui', "ibu_id", orangTuaKandung, "krama")}
                              {renderLivePerubahanRelasi("Status Hubungan", orangTuaKandung.status_hubungan, "status_hubungan", orangTuaKandung)}
                              {renderLivePerubahanRelasi("Urutan Lahir (Anak Ke)", orangTuaKandung.urutan_lahir, "urutan_lahir", orangTuaKandung)}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {hasAccess && (
                      <div className="flex justify-end mt-3 border-t border-gray-100">
                        <button 
                          onClick={() => {
                            setSelectedRelasi(orangTuaKandung);
                            setVerifyRelasiAction(orangTuaKandung.status_verifikasi || 'Draft');
                            setCatatanRelasiValidator('');
                            setIsOpenModalRelasi(true);
                          }}
                          className={styles.btnInfoDetail}
                        >
                          <FaUserCheck className="mb-0.5 mr-1"/> Kelola Relasi Kandung
                        </button>
                      </div>
                    )}
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
                                <th className="p-3 w-1/4">Kategori</th>
                                <th className="p-3 w-3/8">Data Aktif Saat Ini</th>
                                <th className="p-3 w-3/8">Usulan Perubahan</th>
                              </tr>
                            </thead>
                            <tbody className={styles.tableBody}>
                              {renderLivePerubahanRelasi("Ayah Angkat", angkat.ayah?.nama_lengkap || 'Tidak Diketahui', "ayah_id", angkat, "krama")}
                              {renderLivePerubahanRelasi("Ibu Angkat", angkat.ibu?.nama_lengkap || 'Tidak Diketahui', "ibu_id", angkat, "krama")}
                              {renderLivePerubahanRelasi("Status Hubungan", angkat.status_hubungan, "status_hubungan", angkat)}
                              {renderLivePerubahanRelasi("Urutan Lahir (Anak Ke)", angkat.urutan_lahir, "urutan_lahir", angkat)}
                              {renderLivePerubahanRelasi("Tanggal Pengangkatan Anak", angkat.tanggal_pengangkatan, "tanggal_pengangkatan", angkat, "date")}
                              {renderLivePerubahanRelasi("Desa Adat Tujuan", krama?.desa_adat_id, "desa_adat_id_tujuan", angkat, 'desa_adat')}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                    {hasAccess && (
                      <div className="flex justify-end mt-3 border-t border-gray-100">
                        <button 
                          onClick={() => {
                            setSelectedRelasi(angkat);
                            setVerifyRelasiAction(angkat.status_verifikasi || 'Draft');
                            setCatatanRelasiValidator('');
                            setIsOpenModalRelasi(true);
                          }}
                          className={styles.btnInfoDetail}
                        >
                          <FaUserCheck className="mb-0.5 mr-1"/> Kelola Relasi Angkat
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {!orangTuaKandung && orangTuaAngkatList.length === 0 && (
                  <p className="text-gray-400 text-xs italic text-center py-2">
                    Data orang tua belum terdaftar.
                  </p>
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
                {hasAccess && (
                  <div className="flex justify-end mt-3 border-t border-gray-100">
                    <button className={styles.btnInfoDetail}>
                      <FaEdit className="mb-0.5"/> Kelola Data
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
            {/* Button Action */}
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
      </div>
      <Footer />
      {/* MODAL VERIFIKASI KRAMA */}
      {isOpenModalKelola && krama && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3 >
                <FaUserCheck size={21} className="text-amber-700 mr-2" /> 
                <span>Status & Verifikasi Data Krama Bali</span>
              </h3>
              <button onClick={() => setIsOpenModalKelola(false)}>
                <FaTimes className={styles.iconClose} />
              </button>
            </div>
            {/* Status Verifikasi Terkini */}
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
                    krama.status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                    krama.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {krama.status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                    {krama.status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                    {krama.status_verifikasi === 'Draft' && <FaHourglassHalf size={10} />}
                    {krama.status_verifikasi || 'Draft'}
                  </span>
                </div>
                <div className="text-center">
                  <span className={styles.labelColumn}>
                    Status Sinkronisasi Data
                  </span>
                  {krama.is_pending_update || krama.status_verifikasi === "Draft" ? (
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
                {krama.catatan_admin_desa && (
                  <div className={styles.noteColumn}>
                    <span className={styles.labelColumn}>
                      Catatan Sebelumnya
                    </span>
                    <p className="italic text-black p-1">
                      {krama.catatan_admin_desa}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* VERIFIKASI */}
            {(krama.is_pending_update || krama.status_verifikasi === "Draft" || krama.status_verifikasi === "Ditolak") && (
              <div className="pt-7">
                <div className="flex items-center gap-2 text-stone-700">
                  <h4 className="font-bold text-sm uppercase tracking-wide">
                    Verifikasi Data:
                  </h4>
                </div>
                <div className="flex gap-2 my-2">
                  <button 
                    type="button"
                    onClick={() => setVerifyAction('Disetujui')}
                    className={`${styles.choise} ${
                      verifyAction === 'Disetujui' ? styles.choiseApproved : styles.choiseDefault
                    }`}
                  >
                    ✅ Setujui Data
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVerifyAction('Ditolak')}
                    className={`${styles.choise} ${
                      verifyAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                    }`}
                  >
                    ❌ Tolak Data
                  </button>
                </div>
                <div className="space-y-1 pt-4 text-left">
                  <label className={styles.label}>
                    Catatan Tambahan / Alasan Penolakan {verifyAction === "Ditolak" && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    className={styles.inputForm}
                    rows="5"
                    placeholder="Masukkan catatan keputusan untuk pembuat..."
                    value={catatanValidator}
                    onChange={(e) => setCatatanValidator(e.target.value)}
                    required={verifyAction === 'Ditolak'}
                  ></textarea>
                </div>
                <div className="mt-6 flex gap-2 justify-end pt-3">
                  <button 
                    onClick={() => {
                      setIsOpenModalKelola(false);
                      setCatatanValidator('');
                    }} 
                    disabled={isSubmitting} 
                    className={styles.btnCancel}
                  >
                    Kembali
                  </button>
                  <button 
                    onClick={handleVerifyKrama} 
                    disabled={isSubmitting}
                    className={verifyAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}
                  >
                    {isSubmitting ? 'Memproses...' : 'Konfirmasi Keputusan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* MODAL VERIFIKASI RELASI KRAMA */}
      {isOpenModalRelasi && selectedRelasi && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <div className={styles.headerModal}>
              <h3>
                <FaUserCheck size={21} className="text-amber-700 mr-2" /> 
                <span>Status & Verifikasi Data Relasi Krama ({selectedRelasi.status_hubungan})</span>
              </h3>
              <button onClick={() => setIsOpenModalRelasi(false)}>
                <FaTimes className={styles.iconClose} />
              </button>
            </div>
            {/* Status Verifikasi Terkini */}
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
                    selectedRelasi.status_verifikasi === 'Disetujui' ? 'bg-green-100 text-green-700' :
                    selectedRelasi.status_verifikasi === 'Ditolak' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {selectedRelasi.status_verifikasi === 'Disetujui' && <FaCheckCircle size={10} />}
                    {selectedRelasi.status_verifikasi === 'Ditolak' && <FaTimesCircle size={10} />}
                    {(
                      selectedRelasi.status_verifikasi === 'Draft' || 
                      selectedRelasi.status_verifikasi === 'Menunggu Penerimaan' || 
                      selectedRelasi.status_verifikasi === 'Menunggu Pelepasan'
                    ) && <FaHourglassHalf size={10} />}
                    <span>
                      {selectedRelasi.status_verifikasi || 'Draft'}
                    </span>
                  </span>
                </div>
                <div className="text-center">
                  <span className={styles.labelColumn}>
                    Status Sinkronisasi Data
                  </span>
                  {selectedRelasi.is_pending_update || selectedRelasi.status_verifikasi === "Draft" ||
                  selectedRelasi.status_verifikasi === "Menunggu Penerimaan" ||
                  selectedRelasi.status_verifikasi === "Menunggu Pelepasan"  ? (
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
                {selectedRelasi.catatan_admin_desa && (
                  <div className={styles.noteColumn}>
                    <span className={styles.labelColumn}>
                      Catatan Sebelumnya
                    </span>
                    <p className="italic text-black p-1">
                      {selectedRelasi.catatan_admin_desa}
                    </p>
                  </div>
                )}
              </div>
            </div>
            {/* Verifikasi */}
            {(selectedRelasi.is_pending_update || selectedRelasi.status_verifikasi === "Draft" ||
              selectedRelasi.status_verifikasi === "Menunggu Penerimaan" ||
              selectedRelasi.status_verifikasi === "Menunggu Pelepasan"
            ) && (
              <div className="pt-7">
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
                    }`}
                  >
                    ✅ Setujui Relasi
                  </button>
                  <button 
                    type="button"
                    onClick={() => setVerifyRelasiAction('Ditolak')}
                    className={`${styles.choise} ${
                      verifyRelasiAction === 'Ditolak' ? styles.choiseReject : styles.choiseDefault
                    }`}
                  >
                    ❌ Tolak Relasi
                  </button>
                </div>
                <div className="space-y-1 pt-2 text-left">
                  <label className={styles.label}>
                    Catatan Tambahan / Alasan Penolakan {verifyRelasiAction === "Ditolak" && <span className="text-red-500">*</span>}
                  </label>
                  <textarea
                    className={styles.inputForm}
                    rows="3"
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
                    className={styles.btnCancel}
                  >
                    Kembali
                  </button>
                  <button 
                    onClick={handleVerifyRelasi} 
                    disabled={isSubmittingRelasi}
                    className={verifyRelasiAction === 'Disetujui' ? styles.btnSaveModal : styles.btnRejectModal}
                  >
                    {isSubmittingRelasi ? 'Memproses...' : 'Konfirmasi Keputusan'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
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

export default PengajuanKramaDetail;