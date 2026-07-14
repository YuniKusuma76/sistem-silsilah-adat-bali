import React, { useState, useEffect, useMemo, useRef } from 'react';
import Cropper from 'react-easy-crop';
import { useNavigate, useParams } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaChevronDown, 
  FaSave, 
  FaTimes, 
  FaExclamationTriangle,
  FaCamera,
  FaTrash
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBaru.module.css';

const SUPABASE_STORAGE_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/";
const DEFAULT_AVATAR_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/default-avatar.jpg";

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

const DataKramaEditKrama = ({ user }) => {
  const { id: slugParam } = useParams();
  const navigate = useNavigate();
  const notifDropdownRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);
  
  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([])
  
  // STATE KRAMA UTAMA:
  const [searchDesaUtama, setSearchDesaUtama] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // STATE CROP FOTO:
  const [selectedFoto, setSelectedFoto] = useState(null);
  const [previewFoto, setPreviewFoto] = useState(null);
  const [imageSrc, setImageSrc] = useState(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);
  
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });
  
  // STATE KRAMA UTAMA: Form input data krama bali
  const [kramaData, setKramaData] = useState({
    nomor_pendaftaran: "",
    nama_lengkap: "",
    nama_panggilan: "",
    jenis_kelamin: "",
    tanggal_lahir: "",
    status_hidup: "Hidup",
    is_bali: true,
    desa_adat_id: "",
    tempat_asal_khusus: "",
    alamat_luar: "",
    tipe_data: "Keturunan"
  });

  // Helper: enkripsi slug url menjadi id asli
  const realId = useMemo(() => {
    if (!slugParam) return null;
    if (!slugParam.includes('-')) {
      const cleanParam = String(slugParam).trim();
      return isNaN(Number(cleanParam)) ? null : cleanParam;
    }
    try {
      const parts = slugParam.split('-');
      let encodedId = parts[parts.length - 1];
      if (!encodedId) return null;
      
      encodedId = encodedId.trim();
      const decoded = atob(encodedId);

      if (!decoded || decoded.trim() === "") return null;
      return String(decoded).trim(); 
    } catch (error) {
      console.error("Format slug tidak valid:", error);
      return null;
    }
  }, [slugParam]);
  
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  useEffect(() => {
    const fetchDataKrama = async () => {
      if (!realId) return;
      try {
        setIsLoading(true);
        const results = await Promise.allSettled([
          axiosInstance.get(`/krama-bali/${realId}`),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
        ]);

        const [
          resKramaObj, 
          resDesaObj, 
          resKecObj, 
          resKabObj, 
          resProvObj
        ] = results;

        const resKrama = resKramaObj.status === "fulfilled" ? resKramaObj.value.data?.data : null;
        const dataDesa = resDesaObj.status === "fulfilled" ? resDesaObj.value.data?.data : [];
        const dataKec = resKecObj.status === "fulfilled" ? resKecObj.value.data?.data : [];
        const dataKab = resKabObj.status === "fulfilled" ? resKabObj.value.data?.data : [];
        const dataProv = resProvObj.status === "fulfilled" ? resProvObj.value.data?.data : [];

        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);

        if (resKrama) {
          setKramaData({
            nomor_pendaftaran: resKrama.nomor_pendaftaran || "",
            nama_lengkap: resKrama.nama_lengkap || "",
            nama_panggilan: resKrama.nama_panggilan || "",
            jenis_kelamin: resKrama.jenis_kelamin || "",
            tanggal_lahir: resKrama.tanggal_lahir ? resKrama.tanggal_lahir.substring(0, 10) : "",
            status_hidup: resKrama.status_hidup || "Hidup",
            is_bali: resKrama.is_bali ?? true,
            desa_adat_id: resKrama.desa_adat_id || "",
            tempat_asal_khusus: resKrama.tempat_asal_khusus || "",
            alamat_luar: resKrama.alamat_luar || "",
            tipe_data: resKrama.tipe_data || "Keturunan"
          });

          if (resKrama.foto_profile) {
            setPreviewFoto(`${SUPABASE_STORAGE_URL}${resKrama.foto_profile}`);
          }

          const activeDesa = dataDesa.find(d => String(d.id) === String(resKrama.desa_adat_id));
          
          if (activeDesa) {
            setSearchDesaUtama(activeDesa.nama_desa_adat);
          }
        } else {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: 'Gagal memuat data krama utama. Data krama tidak ditemukan.' 
          });
        }

        const failLoadMasterData = results.slice(2).some(r => r.status === "rejected");

        if (failLoadMasterData) {
          setAlert({
            show: true,
            type: 'warning',
            message: 'Beberapa data master gagal dimuat, namun form tetap dapat diisi.'
          });
        }
      } catch (error) {
        console.error("Critical Master Data Fetch Error:", error);
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Terjadi kesalahan pada server saat memuat data relasi krama.' 
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDataKrama();
  }, [realId]);

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

  // HELPER WILAYAH ADAT: Mengambil data lengkap hierarki wilayah adat
  const getWilayahLengkap = (desaId) => {
    if (!desaId) return null; 

    const desa = desaList.find(d => String(d.id) === String(desaId));
    if (!desa) return null;

    const kec = desa.kecamatan_id 
      ? kecamatanList.find(k => String(k.id) === String(desa.kecamatan_id)) 
      : null;
    const kab = kec?.kabupaten_id 
      ? kabupatenList.find(k => String(k.id) === String(kec.kabupaten_id)) 
      : null;
    const prov = kab?.provinsi_id 
      ? provinsiList.find(p => String(p.id) === String(kab.provinsi_id)) 
      : null;

    return {
      kecamatan: kec?.nama_kecamatan || "-",
      kabupaten: kab?.nama_kabupaten || "-",
      provinsi: prov?.nama_provinsi || "BALI"
    };
  };

  const filteredDesa = useMemo(() => {
    if (!searchDesaUtama.trim()) return [];
    return desaList
      .filter((d) => d.nama_desa_adat.toLowerCase().includes(searchDesaUtama.toLowerCase()))
      .slice(0, 8);
  }, [desaList, searchDesaUtama]);
  
  // HELPER KRAMA UTAMA: Menangani perubahan data input krama utama
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setKramaData((prev) => ({ 
      ...prev, 
      [name]: type === "checkbox" ? checked : value 
    }));
  };

  const handleTipeDataChange = (e) => {
    const targetValue = e.target.value;
    setKramaData((prev) => ({
      ...prev,
      tipe_data: targetValue,
      nama_panggilan: targetValue === "Leluhur" ? "" : prev.nama_panggilan,
      tanggal_lahir: targetValue === "Leluhur" ? "" : prev.tanggal_lahir,
      status_hidup: targetValue === "Leluhur" ? "Tidak Diketahui" : "Hidup",
    }));
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setAlert({
          show: true,
          type: "error",
          message: "Ukuran foto profil terlalu besar! Maksimal ukuran file adalah 2MB."
        });
        return;
      }
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        setImageSrc(reader.result);
        setIsCropModalOpen(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const getCroppedImg = async (imageSrc, pixelCrop) => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => (image.onload = resolve));

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (!blob) return;
        const file = new File([blob], "profile_krama_1x1.png", { type: "image/png" });
        resolve({ file, url: URL.createObjectURL(blob) });
      }, "image/png");
    });
  };

  const handleCropComplete = async () => {
    try {
      const { file, url } = await getCroppedImg(imageSrc, croppedAreaPixels);
      setSelectedFoto(file);
      setPreviewFoto(url);
      setIsCropModalOpen(false);
    } catch (e) {
      console.error("Gagal melakukan cropping gambar:", e);
    }
  };

  const handleHapusFoto = () => {
    setSelectedFoto(null);
    setPreviewFoto(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = ""; 
    }
  };

  // HELPER VALIDASI:
  const validateForm = () => {
    if (!kramaData.nama_lengkap.trim()) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: 'Nama lengkap krama utama (form I) wajib diisi!' 
      });
      return false;
    }
    
    if (kramaData.tipe_data === "Keturunan") {
      if (!kramaData.jenis_kelamin) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Jenis kelamin krama keturunan wajib dipilih!' 
        });
        return false;
      }
      if (kramaData.is_bali && !kramaData.desa_adat_id) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Krama Bali wajib memilih desa adat asal!' 
        });
        return false;
      }
      if (!kramaData.is_bali && !kramaData.alamat_luar.trim()) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Krama luar Bali wajib mengisi alamat asal!' 
        });
        return false;
      }
    }
    return true;
  };

  // SUBMIT DATA:
  const saveKrama = async (e, isConfirmed = false) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
    }
    
    if (typeof validateForm === "function" && !validateForm()) return;

    if (!isConfirmed) {
      setShowSaveConfirmModal(true);
      return;
    }

    setShowSaveConfirmModal(false);

    try {
      setIsLoading(true);
      const payloadKrama = { ...kramaData };
      delete payloadKrama.nomor_pendaftaran;

      if (payloadKrama.desa_adat_id === "") {
        payloadKrama.desa_adat_id = null;
      }
      if (payloadKrama.tanggal_lahir === "") {
        payloadKrama.tanggal_lahir = null;
      }
      if (payloadKrama.jenis_kelamin === "") {
        payloadKrama.jenis_kelamin = null;
      }

      if (payloadKrama.tipe_data === "Keturunan") {
        if (!payloadKrama.status_hidup) {
          payloadKrama.status_hidup = "Hidup";
        }
      } else {
        if (!payloadKrama.status_hidup) {
          payloadKrama.status_hidup = "Tidak Diketahui";
        }
      }

      const formData = new FormData();

      Object.keys(payloadKrama).forEach((key) => {
        if (key !== 'foto_profile') {
          if (payloadKrama[key] === null) {
            formData.append(key, "");
          } else {
            formData.append(key, payloadKrama[key]);
          }
        }
      });

      if (selectedFoto) {
        formData.append("photo-krama", selectedFoto);
      }

      await axiosInstance.put(`/krama-bali/${realId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });

      navigate(`/krama-bali/my-data/detail/${slugParam}`, { 
        state: { successMessage: 'Perubahan data krama bali berhasil disimpan!' } 
      });
    } catch (error) {
      console.error("Critical Save Error: ", error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan sistem saat menyimpan silsilah krama.' 
      });
      window.scrollTo(0, 0);
    } finally { 
      setIsLoading(false); 
    }
  };
  
  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Perbarui Data Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Perbaiki data lama krama bali dengan data baru yang sebenarnya dan sah
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
      <div className="p-8 flex-1 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          <form onSubmit={saveKrama} className="w-full space-y-8">
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                Data Diri Krama Bali
              </h3>
              <div className="space-y-5">
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Nomor Pendaftaran
                  </label>
                  <input 
                    type="text"
                    name="nomor_pendaftaran" 
                    value={kramaData.nomor_pendaftaran || "-"} 
                    className={styles.disableFieldReg} 
                    disabled={true}
                  />
                </div>
                {/* Tipe Data */}
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Tipe Data <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      name="tipe_data" 
                      value={kramaData.tipe_data} 
                      onChange={handleTipeDataChange} 
                      className={styles.inputSelect} 
                      required>
                      <option value="Keturunan">Keturunan</option>
                      <option value="Leluhur">Leluhur</option>
                    </select>
                    <div className={styles.selectIcon}>
                      <FaChevronDown size={12}/>
                    </div>
                  </div>
                  <p className={styles.noted}>
                    * Pilih tipe data krama yang sesuai
                  </p>
                </div>
                {/* Nama Lengkap */}
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="nama_lengkap" 
                    value={kramaData.nama_lengkap} 
                    onChange={handleChange} 
                    className={styles.inputText}
                    placeholder="Contoh: I Wayan Sudarsana" 
                  />
                </div>
                {/* Nama Panggilan */}
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Nama Panggilan
                  </label>
                  <input 
                    type="text" 
                    name="nama_panggilan" 
                    value={kramaData.nama_panggilan} 
                    onChange={handleChange} 
                    className={styles.inputText}
                    placeholder="Contoh: Sudarsana" 
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Foto Profile
                  </label>
                  <div className={styles.inputFoto}>
                    {previewFoto ? (
                      <div className="relative group w-52 h-52">
                        <img src={previewFoto} alt="Preview 1:1" className={styles.previewFoto} />
                        <button type="button" onClick={handleHapusFoto} className={styles.trashFoto} title="Hapus Foto">
                          <FaTrash />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.emptyFoto}>
                        <FaCamera size={20} />
                        <span className="text-[10px] font-medium">
                          No Photo
                        </span>
                      </div>
                    )}
                    <div className="flex flex-col space-y-1">
                      <input 
                        ref={fileInputRef} 
                        type="file" 
                        accept="image/jpeg, image/jpg, image/png"
                        onChange={handleFotoChange}
                        className={styles.chooseFoto}
                      />
                      <p className="text-[10px] text-gray-400 font-medium">
                        * Format gambar: .jpg, .jpeg, .png (maksimal 2MB)
                      </p>
                    </div>
                  </div>
                </div>
                <div className={styles.dualInput}>
                  {/* Jenis Kelamin */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Jenis Kelamin {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <select 
                        name="jenis_kelamin" 
                        value={kramaData.jenis_kelamin} 
                        onChange={handleChange} 
                        className={styles.inputSelect}>
                        <option value="" disabled>- Pilih -</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                      <div className={styles.selectIcon}>
                        <FaChevronDown size={12}/>
                      </div>
                    </div>
                  </div>
                  {/* Tanggal Lahir */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Tanggal Lahir
                    </label>
                    <input 
                      type="date" 
                      name="tanggal_lahir" 
                      value={kramaData.tanggal_lahir} 
                      onChange={handleChange} 
                      className={styles.inputCalendar} 
                    />
                  </div>
                </div>
                <div className={styles.dualInput}>
                  {/* Status Hidup */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Status Hidup
                    </label>
                    <div className="relative">
                      <select 
                        name="status_hidup" 
                        value={kramaData.status_hidup} 
                        onChange={handleChange} 
                        className={styles.inputSelect}>
                        <option value="Hidup">Hidup</option>
                        <option value="Meninggal">Meninggal</option>
                        {kramaData.tipe_data === "Leluhur" && (
                          <option value="Tidak Diketahui">Tidak Diketahui</option>
                        )}
                      </select>
                      <div className={styles.selectIcon}>
                        <FaChevronDown size={12}/>
                      </div>
                    </div>
                  </div>
                  {/* IS BALI */}
                  <div className={styles.checkbox}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        name="is_bali" 
                        checked={kramaData.is_bali} 
                        id="is_bali" 
                        className={styles.checkboxInput} 
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setKramaData(prev => ({
                            ...prev,
                            is_bali: isChecked,
                            desa_adat_id: e.target.checked ? prev.desa_adat_id : "",
                            tempat_asal_khusus: e.target.checked ? prev.tempat_asal_khusus : "",
                            alamat_luar: e.target.checked ? "" : prev.alamat_luar
                          }));
                          setSearchDesaUtama("");
                        }}
                      />
                      <label htmlFor="is_bali" className={styles.checkboxLabel}>
                        Krama ini asal Bali?
                      </label>
                    </div>
                    <p className={styles.checkboxNote}>
                      {kramaData.tipe_data === "Leluhur" 
                        ? "* Centang jika krama berasal dari Bali tetapi wilayah asal bersifat opsional jika data tidak diketahui."
                        : "* Centang jika krama berasal dari Bali."
                      }
                    </p>
                  </div>
                </div>
                {/* Kondisi IS BALI */}
                {kramaData.is_bali ? (
                  <div className="space-y-4 animate-fade-in">
                    <div className={styles.isBaliDual}>
                      <div className="flex flex-col space-y-1.5 relative">
                        <label className={styles.labelInput}>
                          Desa Adat Asal {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            className={styles.termsDesaAdat}
                            placeholder="Cari wilayah desa adat..."
                            value={isDropdownOpen ? searchDesaUtama : (desaList.find(d => String(d.id) === String(kramaData.desa_adat_id))?.nama_desa_adat || "")}
                            onChange={(e) => {
                              setSearchDesaUtama(e.target.value); 
                              setIsDropdownOpen(true);
                            }}
                            onFocus={() => {
                              const currentDesaName = desaList.find(d => String(d.id) === String(kramaData.desa_adat_id))?.nama_desa_adat || "";
                              setSearchDesaUtama(currentDesaName);
                              setIsDropdownOpen(true);
                            }}
                          />
                          <div className={styles.termsIcon}>
                            <FaChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                          {isDropdownOpen && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                              <div className={styles.dropdownResult}>
                                {filteredDesa.length > 0 ? (
                                  filteredDesa.map((d) => (
                                    <div 
                                      key={d.id} 
                                      className={styles.dropdownItems} 
                                      onClick={() => {
                                        setKramaData(prev => ({ ...prev, desa_adat_id: d.id })); 
                                        setSearchDesaUtama(d.nama_desa_adat); 
                                        setIsDropdownOpen(false); 
                                      }}
                                    >
                                      <p className="text-sm font-bold text-gray-800">
                                        {d.nama_desa_adat}
                                      </p>
                                      {(() => {
                                        const wil = getWilayahLengkap(d.id);
                                        return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                      })()}
                                    </div>
                                  ))
                                ) : (
                                  <div className="px-4 py-3 text-sm text-gray-500 italic bg-white">
                                    Desa adat tidak ditemukan
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className={styles.labelInput}>
                          Tempat Asal Khusus
                        </label>
                        <input 
                          name="tempat_asal_khusus" 
                          value={kramaData.tempat_asal_khusus} 
                          onChange={handleChange} 
                          className={styles.inputText} 
                          placeholder="Contoh: Puri Agung Bangli" 
                        />
                      </div>
                    </div>
                    {/* Preview Wilayah Adat */}
                    {kramaData.desa_adat_id && (
                      <div className={styles.previewWilayahAdat}>
                        {(() => {
                          const w = getWilayahLengkap(kramaData.desa_adat_id);
                          if (!w) return null;
                          return (
                            <>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-gray-400">
                                  Kecamatan
                                </span>
                                <span className="text-sm font-semibold">
                                  {w.kecamatan}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-gray-400">
                                  Kabupaten
                                </span>
                                <span className="text-sm font-semibold">
                                  {w.kabupaten}
                                </span>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase text-gray-400">
                                  Provinsi
                                </span>
                              <span className="text-sm font-semibold">
                                {w.provinsi}
                              </span>
                            </div>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col space-y-1.5 animate-fade-in">
                    <div className="flex flex-col space-y-1.5">
                      <label className={styles.labelInput}>
                        Alamat Luar Bali {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                      </label>
                      <input 
                        name="alamat_luar" 
                        value={kramaData.alamat_luar} 
                        onChange={handleChange} 
                        className={styles.inputText} 
                        placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..."
                        required={kramaData.tipe_data !== "Leluhur"} 
                      />
                      <p className={styles.noted}>
                        * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            {/* ACTION BUTTONS */}
            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => setShowCancelModal(true)} className={styles.btnBackRed} disabled={isLoading}>
                <FaTimes /> Batal</button>
              <button type="submit" disabled={isLoading} className={styles.btnSubmit}>
                <FaSave size={14} /> {isLoading ? 'Menyimpan...' : 'Simpan Krama'}
              </button>
            </div>
          </form>
        </div>
      </div>
      {/* Modal Konfirmasi Save */}
      {showSaveConfirmModal && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-in`}>
            <div className="p-6">
              <div className="flex justify-center mb-5">
                <div className={styles.elipsisConf}>
                  <FaExclamationTriangle className="text-amber-500 text-2xl" />
                </div>
              </div>
              <div className="text-center">
                <h3 className="text-lg font-bold text-gray-900 mb-2">
                  Konfirmasi Perubahan Data Krama
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Apakah Anda yakin data krama bali ini sudah benar, sah, dan sesuai dengan awig-awig/pararem desa adat?
                </p>
                <p className={styles.noteConf}>
                  * Pastikan data yang Anda masukkan sudah benar agar tidak terjadinya kesalahan input dan membutuhkan proses verifikasi ulang untuk perubahan data.
                </p>
              </div>
              <div className="mt-8 flex gap-3 justify-center">
                <button 
                  type="button" 
                  onClick={() => setShowSaveConfirmModal(false)} 
                  className={styles.btnCancel}
                  disabled={isLoading}>
                  Periksa Kembali
                </button>
                <button 
                  type="button" 
                  onClick={() => saveKrama(null, true)} 
                  className={styles.btnSubmit}
                  disabled={isLoading}>
                  <FaSave size={14} className="mr-1" /> {isLoading ? 'Memproses...' : 'Ya, Lanjutkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Konfirmasi Cancel */}
      {showCancelModal && (
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
                  Konfirmasi Pembatalan
                </h3>
                <p className="text-sm text-gray-600">
                  Apakah Anda yakin ingin membatalkan perubahan data ini? Semua modifikasi data krama bali yang baru saja Anda ketik akan hilang seketika.
                </p>
              </div>
              <div className="mt-10 flex gap-3 justify-center">
                <button onClick={() => setShowCancelModal(false)} className={styles.btnCancel}>
                  Kembali
                </button>
                <button 
                  onClick={() => {
                    setShowCancelModal(false);
                    navigate(`/krama-bali/my-data/detail/${slugParam}`);
                  }}
                  className={styles.btnDelete}>
                  <FaTimes size={15} /> {isLoading ? 'Memproses...' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Crop Foto */}
      {isCropModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.ratioCrop}>
            <h4 className="text-sm font-bold text-amber-900 mb-3 uppercase">
              Crop Foto Profile
            </h4>
            <div className="relative flex-1 bg-gray-900 overflow-hidden mb-5">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(_, croppedPixels) => setCroppedAreaPixels(croppedPixels)}
              />
            </div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-semibold text-gray-500">
                ZOOM:
              </span>
              <input 
                type="range" 
                min={1} 
                max={3} 
                step={0.1} 
                value={zoom} 
                onChange={(e) => setZoom(Number(e.target.value))}
                className="w-full accent-amber-700"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setIsCropModalOpen(false)} className={styles.btnCancel}>
                Batal
              </button>
              <button type="button" onClick={handleCropComplete} className={styles.btnCrop}>
                Potong & Terapkan
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default DataKramaEditKrama;