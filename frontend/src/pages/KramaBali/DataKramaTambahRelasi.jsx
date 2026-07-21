import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaChevronDown, 
  FaSave, 
  FaTimes, 
  FaInfoCircle, 
  FaEraser, 
  FaExclamationTriangle,
  FaCamera
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBaru.module.css';

const SUPABASE_STORAGE_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/";
const DEFAULT_AVATAR_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/default-avatar.jpg";

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

const DataKramaTambahRelasi = ({ user }) => {
  const { id: slugParam } = useParams();
  const notifDropdownRef = useRef(null);
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([]);

  // STATE KRAMA UTAMA:
  const [kramaList, setKramaList] = useState([]);
  const [searchDesaUtama, setSearchDesaUtama] = useState("");
  const [previewFoto, setPreviewFoto] = useState(DEFAULT_AVATAR_URL);

  // STATE PERKAWINAN:
  const [perkawinanListOptions, setPerkawinanListOptions] = useState([]);
  const [searchDesaPasangan, setSearchDesaPasangan] = useState({});
  const [openDesaDropdownIndex, setOpenDesaDropdownIndex] = useState(null);
  
  // STATE RELASI ORANG TUA & PENGANGKATAN ANAK:
  const [relasiKramaList, setRelasiKramaList] = useState([]);
  const [searchOrangTuaTerm, setSearchOrangTuaTerm] = useState("");
  const [isDropdownOrangTuaOpen, setIsDropdownOrangTuaOpen] = useState(false);
  const [searchTermAnak, setSearchTermAnak] = useState("");
  const [isDropdownAnakOpen, setIsDropdownAnakOpen] = useState(false);

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

  // STATE RELASI ORANG TUA: Form input data orang tua
  const [parentData, setParentData] = useState({
    status_diketahui: "Tidak Diketahui",
    status_hubungan: "Anak Kandung",
    jenis_pengangkatan: "Pasangan",
    tanggal_pengangkatan: "",
    selected_perkawinan_id: "",
    selected_ayah_id: "",
    selected_ibu_id: "",
    urutan_lahir: "",
    isManual: false,
    manualAyah: { 
      nama_lengkap: "", 
      nama_panggilan: "",
      jenis_kelamin: "Laki-laki",
      tanggal_lahir: "", 
      status_hidup: "Meninggal",
      is_bali: true,
      desa_adat_id: "",
      tempat_asal_khusus: "",
      alamat_luar: "",
      tipe_data: "Leluhur"
    },
    manualIbu: { 
      nama_lengkap: "", 
      nama_panggilan: "",
      jenis_kelamin: "Perempuan",
      tanggal_lahir: "", 
      status_hidup: "Meninggal",
      is_bali: true,
      desa_adat_id: "",
      tempat_asal_khusus: "",
      alamat_luar: "",
      tipe_data: "Leluhur"
    },
    manualPerkawinan: { 
      status_perkawinan: "Kawin",
      jenis_perkawinan: "Biasa",
      tanggal_perkawinan: "",
      tanggal_cerai: "",
      pihak_meninggal: "Pasangan",
      pilihan_predana: "Tetap"   
    },
    manualSingle: { 
      nama_lengkap: "", 
      nama_panggilan: "",
      jenis_kelamin: "Laki-laki",
      tanggal_lahir: "", 
      status_hidup: "Meninggal",
      is_bali: true,
      desa_adat_id: "",
      tempat_asal_khusus: "",
      alamat_luar: "",
      tipe_data: "Leluhur"
    }
  });

  // STATE PENGANGKATAN ANAK: Form input data pengangkatan anak
  const [adoptingData, setAdoptingData] = useState({
    status_pengangkatan: "Tidak",
    anak_angkat_id: "",
    tanggal_pengangkatan_anak: "",
    isAnakManual: false,
    manualAnak: {
      nama_lengkap: "", 
      nama_panggilan: "",
      jenis_kelamin: "Laki-laki",
      tanggal_lahir: "", 
      status_hidup: "Hidup",
      is_bali: true,
      desa_adat_id: "",
      tempat_asal_khusus: "",
      alamat_luar: "",
      tipe_data: "Keturunan"
    }
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
    if (slugParam && realId === null) {
      setAlert({
        show: true,
        type: 'error',
        message: 'Terjadi kesalahan pada server. Periksa koneksi Anda!'
      });

      const navTimer = setTimeout(() => {
        navigate('/krama-bali', { replace: true });
      }, 3000);

      return () => clearTimeout(navTimer);
    }
  }, [slugParam, realId, navigate]);
  
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: mengeksekusi endpoint backend yang diperlukan
  useEffect(() => {
    const fetchAllData = async () => {
      if (!realId) return;
      try {
        setIsLoading(true);
        const results = await Promise.allSettled([
          axiosInstance.get(`/krama-bali/${realId}`),
          axiosInstance.get("/krama-bali?mode=public"),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
          axiosInstance.get("/perkawinan?mode=public"),
          axiosInstance.get("/relasi-krama?mode=public")
        ]);

        const [
          resKramaObj, 
          resKramaListObj, 
          resDesaObj, 
          resKecObj, 
          resKabObj, 
          resProvObj, 
          resPerkawinanObj,
          resRelasiKramaObj
        ] = results;

        const resKrama = resKramaObj.status === "fulfilled" ? resKramaObj.value.data?.data : null;
        const dataKrama = resKramaListObj.status === "fulfilled" ? resKramaListObj.value.data?.data : [];
        const dataDesa = resDesaObj.status === "fulfilled" ? resDesaObj.value.data?.data : [];
        const dataKec = resKecObj.status === "fulfilled" ? resKecObj.value.data?.data : [];
        const dataKab = resKabObj.status === "fulfilled" ? resKabObj.value.data?.data : [];
        const dataProv = resProvObj.status === "fulfilled" ? resProvObj.value.data?.data : [];
        const dataPerkawinan = resPerkawinanObj.status === "fulfilled" ? resPerkawinanObj.value.data?.data : [];
        const dataRelasi = resRelasiKramaObj.status === "fulfilled" ? resRelasiKramaObj.value.data?.data : [];

        setKramaList(dataKrama || []);
        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);
        setPerkawinanListOptions(dataPerkawinan || []);
        setRelasiKramaList(dataRelasi || []);

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
    fetchAllData();
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

  const getFilteredDesaManual = (index) => {
    const term = searchDesaPasangan[index] || "";
    if (!term.trim()) return [];
    return desaList
      .filter((d) => d.nama_desa_adat.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 8);
  };
  
  // HELPER PENGANGKATAN ANAK: Label pencarian anak angkat
  const getOrangTuaLabel = (data, masterRelasiList = []) => {
    if (!data) return "";
    const namaAnak = data.nama_lengkap || "Anak";

    // skenario 1: jika objek anak yang dikirim dari baris data RelasiKrama (sudah menyertakan ayah dan ibu)
    if (data.ayah || data.ibu) {
      const namaAyah = data.ayah?.nama_lengkap;
      const namaIbu = data.ibu?.nama_lengkap;
      if (namaAyah && namaIbu) {
        return `${namaAnak} (Orang tua: ${namaAyah} & ${namaIbu})`;
      }
      if (namaAyah) {
        return `${namaAnak} (Ayah: ${namaAyah})`;
      }
      if (namaIbu) {
        return `${namaAnak} (Ibu: ${namaIbu})`;
      }
    }

    // skenario 2: jika objek anak yang dikirim murni dari KramaBali tunggal dengan relasi orang tua
    if (masterRelasiList && masterRelasiList.length > 0) {
      const relasiKetemu = masterRelasiList.find(r => String(r.anak_id) === String(data.id));
      if (relasiKetemu) {
        const namaAyah = relasiKetemu.ayah?.nama_lengkap;
        const namaIbu = relasiKetemu.ibu?.nama_lengkap;

        if (namaAyah && namaIbu) {
          return `${namaAnak} (Orang tua: ${namaAyah} & ${namaIbu})`;
        }
        if (namaAyah) {
          return `${namaAnak} (Ayah: ${namaAyah})`;
        }
        if (namaIbu) {
          return `${namaAnak} (Ibu: ${namaIbu})`;
        }
      }
    }

    return namaAnak;
  };

  const getHanyaNamaOrangTua = (data, masterRelasiList = []) => {
    if (!data) return "-";

    if (data.ayah || data.ibu) {
      const namaAyah = data.ayah?.nama_lengkap;
      const namaIbu = data.ibu?.nama_lengkap;

      if (namaAyah && namaIbu) {
        return `${namaAyah} & ${namaIbu}`;
      }
      if (namaAyah) {
        return namaAyah;
      }
      if (namaIbu) {
        return namaIbu;
      }
    }

    if (data.relasi_orangtua && data.relasi_orangtua.length > 0) {
      const relasiTerakhir = data.relasi_orangtua[data.relasi_orangtua.length - 1];
      const namaAyah = relasiTerakhir.ayah?.nama_lengkap;
      const namaIbu = relasiTerakhir.ibu?.nama_lengkap;

      if (namaAyah && namaIbu) {
        return `${namaAyah} & ${namaIbu}`;
      }
      if (namaAyah) {
        return namaAyah;
      }
      if (namaIbu) {
        return namaIbu;
      }
    }

    if (masterRelasiList && masterRelasiList.length > 0) {
      const relasiKetemu = masterRelasiList.find(r => String(r.anak_id) === String(data.id));
      
      if (relasiKetemu) {
        const namaAyah = relasiKetemu.ayah?.nama_lengkap;
        const namaIbu = relasiKetemu.ibu?.nama_lengkap;

        if (namaAyah && namaIbu) {
          return `${namaAyah} & ${namaIbu}`;
        }
        if (namaAyah) {
          return namaAyah;
        }
        if (namaIbu) {
          return namaIbu;
        }
      }
    }

    return "Tidak Diketahui/Belum Terdaftar";
  };

  // HELPER RELASI ORANG TUA: Label pasangan orang tua
  const getPerkawinanLabel = (p) => {
    if (!p) return "";
    const namaSuami = p.suami?.nama_lengkap;
    const namaIstri = p.istri?.nama_lengkap;

    // skenario konstruksi
    let kombinasiNama = "";

    if (namaSuami && namaIstri) {
      kombinasiNama = `${namaSuami} & ${namaIstri}`;
    } else if (namaSuami) {
      kombinasiNama = `${namaSuami} & [Istri Tidak Tercatat]`;
    } else if (namaIstri) {
      kombinasiNama = `[Suami Tidak Tercatat] & ${namaIstri}`;
    } else {
      kombinasiNama = "[Pasangan Leluhur Tidak Tercatat]";
    }
    
    let statusDisplay = p.status_perkawinan || "Aktif";

    if (statusDisplay === "Cerai Hidup" || statusDisplay === "Cerai") {
      statusDisplay = "CERAI HIDUP";
    } else if (statusDisplay === "Cerai Mati") {
      statusDisplay = "CERAI MATI";
    }
    
    return `${kombinasiNama} (${statusDisplay})`;
  };

  // HELPER RELASI ORANG TUA: Menangani perubahan data input orang tua
  const handleParentChange = (e) => {
    const { name, value } = e.target;
    if (name === "status_diketahui" && value === "Tidak Diketahui") {
      clearParentData();
      return;
    }

    setParentData((prev) => {
      const updated = { ...prev, [name]: value };
      const defaultTipeData = kramaData?.tipe_data || "Keturunan";
      const defaultStatusHidup = defaultTipeData === "Leluhur" ? "Tidak Diketahui" : "Hidup";
      
      // kondisi 1: jika memilih opsi input pasangan orang tua baru
      if (name === "selected_perkawinan_id" && value === "NEW_ENTRY") {
        updated.selected_perkawinan_id = null;
        updated.selected_ayah_id = null;
        updated.selected_ibu_id = null;
        updated.isManual = true;
        updated.manualAyah = { 
          ...prev.manualAyah, 
          tipe_data: defaultTipeData, 
          status_hidup: defaultTipeData === "Leluhur" ? "Meninggal" : "Hidup" 
        };
        updated.manualIbu = { 
          ...prev.manualIbu, 
          tipe_data: defaultTipeData, 
          status_hidup: defaultTipeData === "Leluhur" ? "Meninggal" : "Hidup" 
        };
      }
      
      // kondisi 2: jika memilih opsi input orang tua tunggal baru
      else if (name === "selected_parent_id" && value === "NEW_ENTRY") {
        updated.selected_parent_id = null;
        updated.isManual = true;
        updated.selected_ayah_id = null;
        updated.selected_ibu_id = null;
        updated.manualSingle = { 
          ...prev.manualSingle, 
          tipe_data: defaultTipeData, 
          status_hidup: defaultStatusHidup 
        };
      }

      // kondisi 3: jika memilih data pasangan orang tua sah
      else if (name === "selected_perkawinan_id" && value !== "NEW_ENTRY") {
        const matchPerkawinan = perkawinanListOptions.find(m => String(m.id) === String(value));
        updated.isManual = false;
        updated.selected_ayah_id = matchPerkawinan?.suami_id || null;
        updated.selected_ibu_id = matchPerkawinan?.istri_id || null;
      }

      // kondisi 4: jika memilih data orang tua tunggal sah
      else if (name === "selected_parent_id" && value !== "NEW_ENTRY") {
        updated.isManual = false;
        const targetKrama = kramaList.find(k => String(k.id) === String(value));
        
        if (targetKrama?.jenis_kelamin === "Perempuan") {
          updated.selected_ibu_id = value;
          updated.selected_ayah_id = null;
        } else {
          updated.selected_ayah_id = value;
          updated.selected_ibu_id = null;
        }
      }

      if (name === "jenis_pengangkatan") {
        updated.isManual = false;
        updated.selected_perkawinan_id = "";
        updated.selected_parent_id = "";
        updated.selected_ayah_id = "";
        updated.selected_ibu_id = "";
      }

      return updated;
    });
  };

  const handleManualParentInput = (targetObject, fieldName, value) => {
    setParentData((prev) => ({
      ...prev,
      [targetObject]: { ...prev[targetObject], [fieldName]: value }
    }));
  };

  // HELPER PENGANGKATAN ANAK: Menangani perubahan data input pengangkatan anak
  const handleAdoptingChange = (e) => {
    const { name, value } = e.target;

    setAdoptingData((prev) => {
      if (name === "anak_angkat_id") {
        if (value === "NEW_ENTRY") {
          return {
            ...prev,
            anak_angkat_id: "",
            isAnakManual: true,
            manualAnak: {
              ...prev.manualAnak,
              tipe_data: "Keturunan",
              status_hidup: "Hidup"
            }
          };
        } else {
          return {
            ...prev,
            anak_angkat_id: value,
            isAnakManual: false
          };
        }
      }

      return { ...prev, [name]: value };
    });
  };

  const handleManualAnakInput = (field, value) => {
    setAdoptingData((prev) => {
      const updatedManualAnak = { ...prev.manualAnak, [field]: value };
      
      if (field === "is_bali") {
        if (value === true) {
          updatedManualAnak.alamat_luar = "";
        } else {
          updatedManualAnak.desa_adat_id = "";
          updatedManualAnak.tempat_asal_khusus = "";
        }
      }
      
      return { ...prev, manualAnak: updatedManualAnak };
    });
  };

  // HELPER RELASI ORANG TUA: Membersihkan form input orang tua
  const clearParentData = () => {
    const defaultTipeData = kramaData.tipe_data;
    const defaultStatusManual = defaultTipeData === "Leluhur" ? "Meninggal" : "Hidup";
    const defaultStatusSingle = defaultTipeData === "Leluhur" ? "Tidak Diketahui" : "Hidup";

    setParentData({
      status_diketahui: "Tidak Diketahui",
      status_hubungan: "Anak Kandung",
      jenis_pengangkatan: "Pasangan",
      tanggal_pengangkatan: "",
      selected_perkawinan_id: "",
      selected_ayah_id: "",
      selected_ibu_id: "",
      urutan_lahir: "",
      isManual: false,
      manualAyah: { 
        nama_lengkap: "", 
        nama_panggilan: "", 
        jenis_kelamin: "Laki-laki", 
        tanggal_lahir: "", 
        status_hidup: defaultStatusManual, 
        is_bali: true, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: defaultTipeData 
      },
      manualIbu: { 
        nama_lengkap: "", 
        nama_panggilan: "", 
        jenis_kelamin: "Perempuan", 
        tanggal_lahir: "", 
        status_hidup: defaultStatusManual, 
        is_bali: true, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: defaultTipeData 
      },
      manualPerkawinan: { 
        status_perkawinan: "Kawin", 
        jenis_perkawinan: "Biasa", 
        tanggal_perkawinan: "", 
        tanggal_cerai: "", 
        pihak_meninggal: "Pasangan", 
        pilihan_predana: "Tetap" 
      },
      manualSingle: { 
        nama_lengkap: "", 
        nama_panggilan: "", 
        jenis_kelamin: "Laki-laki", 
        tanggal_lahir: "", 
        status_hidup: defaultStatusSingle, 
        is_bali: true, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: defaultTipeData 
      }
    });
  };

  // HELPER PENGANGKATAN ANAK: Membersihkan form input pengangkatan anak
  const clearAdoptingData = () => {
    setSearchTermAnak("");
    setIsDropdownAnakOpen(false);
    setAdoptingData({
      status_pengangkatan: "Tidak",
      anak_angkat_id: "",
      tanggal_pengangkatan_anak: "",
      isAnakManual: false,
      manualAnak: { 
        nama_lengkap: "", 
        nama_panggilan: "", 
        jenis_kelamin: "Laki-laki", 
        tanggal_lahir: "", 
        status_hidup: "Hidup", 
        is_bali: true, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: "Keturunan" 
      },
    });
  };

  const handleBack = () => {
    setShowCancelModal(false);
    if (slugParam) {
      navigate(`/krama-bali/my-data/detail/${slugParam}`, { 
        replace: true 
      });
    } else {
      navigate("/krama-bali/my-data", { 
        replace: true 
      });
    }
  };

  // HELPER VALIDASI:
  const validateForm = () => {
    if (parentData.status_diketahui === "Diketahui" && parentData.isManual) {
      if (parentData.jenis_pengangkatan === "Pasangan") {
        if (!parentData.manualAyah.nama_lengkap.trim()) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: 'Nama lengkap ayah pada pendaftaran baru wajib diisi!' 
          });
          return false;
        }
        if (!parentData.manualIbu.nama_lengkap.trim()) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: 'Nama lengkap Ibu pada pendaftaran baru wajib diisi!' 
          });
          return false;
        }
      } else if (parentData.jenis_pengangkatan === "Tunggal") {
        if (!parentData.manualSingle.nama_lengkap.trim()) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: 'Nama lengkap orang tua tunggal pada pendaftaran baru wajib diisi!' 
          });
          return false;
        }
      }
    }

    if ((adoptingData.status_pengangkatan === "Ya" || adoptingData.status_pengangkatan === "Mengangkat Anak") && adoptingData.isAnakManual) {
      if (!adoptingData.manualAnak.nama_lengkap.trim()) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Nama lengkap anak angkat pada pendaftaran baru wajib diisi!' 
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

    // konversi value agar tidak menjadi array kosong
    const safeInt = (value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    };

    const safeDate = (value) => {
      if (!value || String(value).trim() === "" || String(value).toLowerCase() === "invalid date") {
        return null;
      }
      return String(value).trim();
    };

    const targetKramaUtamaId = safeInt(realId);

    if (!targetKramaUtamaId) {
      setAlert({
        show: true,
        type: 'error',
        message: 'Data target krama utama tidak ditemukan.'
      });
      return;
    }

    try {
      setIsLoading(true);
      let payloadFinal = null;

      // ====================================================================
      // SKENARIO 1: INPUT DATA PENGANGKATAN ANAK (KRAMA UTAMA ADALAH ORANG TUA)
      // ====================================================================
      if (adoptingData.status_pengangkatan === "Ya" || adoptingData.status_pengangkatan === "Mengangkat Anak") {
        let finalAnakId = adoptingData.anak_angkat_id;
        
        if (adoptingData.isAnakManual) {
          const payloadAnak = { ...adoptingData.manualAnak };

          if (payloadAnak.desa_adat_id === "") {
            payloadAnak.desa_adat_id = null;
          }

          const resAnak = await axiosInstance.post("/krama-bali", payloadAnak);
          finalAnakId = resAnak.data?.data?.id || resAnak.data?.id;
        }

        const perkawinanId = parentData.selected_perkawinan_id && parentData.selected_perkawinan_id !== "NEW_ENTRY"
          ? safeInt(parentData.selected_perkawinan_id)
          : null;

        payloadFinal = {
          anak_id: safeInt(finalAnakId),
          status_hubungan: "Anak Angkat",
          tanggal_pengangkatan: safeDate(adoptingData.tanggal_pengangkatan_anak),
          perkawinan_id: perkawinanId,
          ayah_id: !perkawinanId && kramaData.jenis_kelamin === "Laki-laki" ? targetKramaUtamaId : null,
          ibu_id: !perkawinanId && kramaData.jenis_kelamin === "Perempuan" ? targetKramaUtamaId : null,
          urutan_lahir: null,
          status_verifikasi: "Disetujui",
          user_id: user?.id || null
        };
      }
      
      // ====================================================================
      // SKENARIO 2: INPUT DATA ORANG TUA (KRAMA UTAMA ADALAH ANAK)
      // ====================================================================
      else if (parentData.status_diketahui === "Diketahui") {
        let finalPerkawinanId = parentData.selected_perkawinan_id;
        let finalSingleParentId = parentData.selected_parent_id || parentData.selected_ayah_id || parentData.selected_ibu_id;
        let ayahId = parentData.selected_ayah_id;
        let ibuId = parentData.selected_ibu_id;

        if (parentData.isManual) {
          if (parentData.jenis_pengangkatan === "Pasangan") {
            // mendaftarkan ayah secara manual
            if (!ayahId && parentData.manualAyah?.nama_lengkap) {
              const payloadAyah = { ...parentData.manualAyah };
              if (payloadAyah.desa_adat_id === "") {
                payloadAyah.desa_adat_id = null;
              }
              
              const resAyah = await axiosInstance.post("/krama-bali", { 
                ...payloadAyah, 
                jenis_kelamin: "Laki-laki" 
              });

              ayahId = resAyah.data?.data?.id || resAyah.data?.id;
            }

            // mendaftarkan ibu secara manual
            if (!ibuId && parentData.manualIbu?.nama_lengkap) {
              const payloadIbu = { ...parentData.manualIbu };
              if (payloadIbu.desa_adat_id === "") {
                payloadIbu.desa_adat_id = null;
              }
              
              const resIbu = await axiosInstance.post("/krama-bali", { 
                ...payloadIbu, 
                jenis_kelamin: "Perempuan" 
              });
              
              ibuId = resIbu.data?.data?.id || resIbu.data?.id;
            }

            // mendaftarkan perkawinan orang tua
            if (!finalPerkawinanId && ayahId && ibuId) {
              const resKawin = await axiosInstance.post("/perkawinan/kawin", {
                suami_id: ayahId,
                istri_id: ibuId,
                status_perkawinan: "Kawin",
                jenis_perkawinan: parentData.manualPerkawinan.jenis_perkawinan || "Biasa",
                tanggal_perkawinan: safeDate(parentData.manualPerkawinan.tanggal_perkawinan)
              });

              const dataPerkawinanSistem = resKawin.data.data?.perkawinan || resKawin.data.data;
              finalPerkawinanId = dataPerkawinanSistem?.id;

              if (finalPerkawinanId && parentData.manualPerkawinan.status_perkawinan) {
                const statusMentahP = String(parentData.manualPerkawinan.status_perkawinan).trim().toLowerCase();

                if (statusMentahP.includes("cerai")) {
                  const apakahCeraiMatiP = statusMentahP.includes("mati");
                  const jenisMutasiFinalP = apakahCeraiMatiP ? "Cerai Mati" : "Cerai Hidup";
                  
                  let pihakMeninggalP = null;

                  if (apakahCeraiMatiP) {
                    const pilihanForm = parentData.manualPerkawinan.pihak_meninggal || "Pasangan";
                    const kramaUtamaPerempuan = kramaData.jenis_kelamin === "Perempuan";

                    if (parentData.manualPerkawinan.jenis_perkawinan === "Nyentana") {
                      if (kramaUtamaPerempuan) {
                        pihakMeninggalP = pilihanForm === "Pasangan" ? "Predana" : "Purusa";
                      } else {
                        pihakMeninggalP = pilihanForm === "Pasangan" ? "Purusa" : "Predana";
                      }
                    } else {
                      if (kramaUtamaPerempuan) {
                        pihakMeninggalP = pilihanForm === "Pasangan" ? "Purusa" : "Predana";
                      } else {
                        pihakMeninggalP = pilihanForm === "Pasangan" ? "Predana" : "Purusa";
                      }
                    }
                  }

                  await axiosInstance.put(`/perkawinan/cerai/${finalPerkawinanId}`, {
                    status_perkawinan: jenisMutasiFinalP,
                    tanggal_cerai: safeDate(parentData.manualPerkawinan.tanggal_cerai),
                    pihak_meninggal: pihakMeninggalP,
                    pilihan_predana: parentData.manualPerkawinan.pilihan_predana === "Tetap" ? "Tetap" : "Kembali ke Asal"
                  });
                }
              }
            }
          } else if (parentData.jenis_pengangkatan === "Tunggal") {
            if (!finalSingleParentId) {
              const payloadSingle = { ...parentData.manualSingle };
              if (payloadSingle.desa_adat_id === "") {
                payloadSingle.desa_adat_id = null;
              }

              const singleFormData = new FormData();

              Object.keys(payloadSingle).forEach((key) => {
                if (payloadSingle[key] !== null && payloadSingle[key] !== undefined) {
                  singleFormData.append(key, payloadSingle[key]);
                }
              });

              const resSingle = await axiosInstance.post("/krama-bali", singleFormData, {
                headers: { "Content-Type": "multipart/form-data" }
              });
              
              finalSingleParentId = resSingle.data?.data?.id || resSingle.data?.id || resSingle.data?.data?.krama?.id;

              if (payloadSingle.jenis_kelamin === "Perempuan") {
                ibuId = finalSingleParentId;
                ayahId = null;
              } else {
                ayahId = finalSingleParentId;
                ibuId = null;
              }
            }
          }
        }

        if (parentData.jenis_pengangkatan === "Tunggal" && !finalSingleParentId) {
          finalSingleParentId = ayahId || ibuId;
        }

        let safePerkawinanId = finalPerkawinanId && !isNaN(finalPerkawinanId) ? parseInt(finalPerkawinanId) : null;

        payloadFinal = {
          anak_id: targetKramaUtamaId,
          status_hubungan: parentData.status_hubungan || "Anak Kandung",
          tanggal_pengangkatan: parentData.status_hubungan === "Anak Angkat" ? safeDate(parentData.tanggal_pengangkatan) : null,
          perkawinan_id: parentData.jenis_pengangkatan === "Tunggal" ? null : safePerkawinanId,
          urutan_lahir: parentData.urutan_lahir ? parseInt(parentData.urutan_lahir) : null,
          ayah_id: null,
          ibu_id: null,
          status_verifikasi: "Disetujui",
          user_id: user?.id || null
        };

        if (parentData.jenis_pengangkatan === "Tunggal") {
          let genderParent = "";

          if (parentData.isManual) {
            genderParent = parentData.manualSingle?.jenis_kelamin;
          } else {
            const parsedId = finalSingleParentId ? parseInt(finalSingleParentId) : null;
            const pk = kramaList?.find(k => k.id === parsedId);
            if (pk) {
              genderParent = pk.jenis_kelamin;
            }
          }

          if (genderParent === "Perempuan") {
            payloadFinal.ibu_id = finalSingleParentId ? parseInt(finalSingleParentId) : null;
            payloadFinal.ayah_id = null;
          } else {
            payloadFinal.ayah_id = finalSingleParentId ? parseInt(finalSingleParentId) : null;
            payloadFinal.ibu_id = null;
          }
        } else {
          payloadFinal.ayah_id = ayahId ? parseInt(ayahId) : null;
          payloadFinal.ibu_id = ibuId ? parseInt(ibuId) : null;
        }
      }

      if (payloadFinal) {
        await axiosInstance.post("/relasi-krama", payloadFinal);
        navigate(`/krama-bali/my-data/detail/${slugParam}`, { 
          state: { successMessage: 'Data relasi silsilah krama berhasil disimpan!' } 
        });
      } else {
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Relasi Save Error: ", error.response?.data || error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || error.message || 'Terjadi kesalahan pada sistem saat menyimpan data relasi krama.' 
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
            Pengajuan Relasi Orang Tua Baru
          </h2>
          <p className={styles.navSubtitle}>
            Lengkapi formulir data relasi orang tua dengan data yang sebenarnya dan sah
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
      <div className="p-8 flex-1 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          {/* BANNER WARNING */}
          <div className={`${styles.noteForm} animate-fade-in`}>
            <div className="flex gap-3">
              <div className="text-blue-600 mt-0.5">
                <FaInfoCircle size={18} className="mb-1.5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-blue-900 uppercase tracking-wide">
                  Pemberitahuan Penting Penginputan Data Relasi Krama
                </h4>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Setiap pencatatan relasi krama baru secara otomatis membentuk garis hubungan anak dengan orang tua pihak Purusa serta memperbarui linimasa keluarga aktif anak bersangkutan di sistem.
                </p>
                <ul className="text-[11px] text-blue-600 list-disc list-inside space-y-0.5 pt-1 italic">
                  <li>Perhatikan setiap kolom input agar tidak salah memasukkan data relasi krama.</li>
                  <li>Pembatalan atau perubahan data relasi yang telah disetujui akan memicu prosedur <em>rollback</em> sistem secara permanen.</li>
                  <li>Penambahan atau pendaftaran relasi orang tua dilakukan dari sisi anak.</li>
                  <li>Pengangkatan anak dilakukan dari sisi orang tua/pihak Purusa.</li>
                </ul>
              </div>
            </div>
          </div>
          <form onSubmit={(e) => e.preventDefault()} className="w-full space-y-8" noValidate>
            {/* BAGIAN 1: DATA DIRI KRAMA BALI */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                I. Data Diri Krama Bali Utama
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
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Tipe Data <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <select 
                      name="tipe_data" 
                      value={kramaData.tipe_data} 
                      className={styles.inputSelect} 
                      disabled={true}>
                      <option value="Keturunan">Keturunan</option>
                      <option value="Leluhur">Leluhur</option>
                    </select>
                    <div className={styles.selectIcon}>
                      <FaChevronDown size={12}/>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Nama Lengkap <span className="text-red-500">*</span>
                  </label>
                  <input 
                    type="text" 
                    name="nama_lengkap" 
                    value={kramaData.nama_lengkap} 
                    className={styles.inputText}
                    disabled={true} 
                  />
                </div>
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Nama Panggilan
                  </label>
                  <input 
                    type="text" 
                    name="nama_panggilan" 
                    value={kramaData.nama_panggilan || "-"} 
                    className={styles.inputText}
                    disabled={true}
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
                        type="file" 
                        accept="image/jpeg, image/jpg, image/png"
                        className={styles.chooseFoto}
                        disabled={true}
                      />
                      <p className="text-[10px] text-gray-400 font-medium">
                        * Format gambar: .jpg, .jpeg, .png (maksimal 2MB)
                      </p>
                    </div>
                  </div>
                </div>
                <div className={styles.dualInput}>
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Jenis Kelamin {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <select 
                        name="jenis_kelamin" 
                        value={kramaData.jenis_kelamin} 
                        className={styles.inputSelect}
                        disabled={true}>
                        <option value="" disabled>- Pilih -</option>
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                      <div className={styles.selectIcon}>
                        <FaChevronDown size={12}/>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Tanggal Lahir
                    </label>
                    <input 
                      type={kramaData.tanggal_lahir ? "date" : "text"}
                      name="tanggal_lahir" 
                      value={kramaData.tanggal_lahir || "Tidak Diketahui"} 
                      className={styles.inputCalendar} 
                      disabled
                    />
                  </div>
                </div>
                <div className={styles.dualInput}>
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Status Hidup
                    </label>
                    <div className="relative">
                      <select 
                        name="status_hidup" 
                        value={kramaData.status_hidup} 
                        className={styles.inputSelect}
                        disabled={true}>
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
                  <div className={styles.checkbox}>
                    <div className="flex items-center gap-3">
                      <input 
                        type="checkbox" 
                        name="is_bali" 
                        checked={kramaData.is_bali} 
                        id="is_bali" 
                        className={styles.checkboxInput} 
                        disabled={true}
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
                            value={desaList.find(d => String(d.id) === String(kramaData.desa_adat_id))?.nama_desa_adat || searchDesaUtama || "Tidak Diketahui"}
                            disabled={true}
                          />
                          <div className={styles.termsIcon}>
                            <FaChevronDown size={12} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className={styles.labelInput}>
                          Tempat Asal Khusus
                        </label>
                        <input 
                          name="tempat_asal_khusus" 
                          value={kramaData.tempat_asal_khusus || "-"} 
                          className={styles.inputText} 
                          disabled={true}
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
                        value={kramaData.alamat_luar || "-"} 
                        className={styles.inputText} 
                        disabled={true}
                      />
                      <p className={styles.noted}>
                        * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </section>
            {/* BAGIAN 2: DATA ORANG TUA */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                II. Data Orang Tua
              </h3>
              <div className={styles.cardSection}>
                <div className={styles.dualColumn}>
                  <div className="flex flex-col space-y-1.5 flex-1">
                    <label className={styles.labelInputSelect}>
                      Keterangan Orang Tua <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="status_diketahui"
                        value={parentData.status_diketahui}
                        onChange={handleParentChange}
                        className={styles.inputPilihan}
                        required>
                        <option value="Tidak Diketahui">Tidak Diketahui</option>
                        <option value="Diketahui">Diketahui</option>
                      </select>
                      <div className={styles.selectIcon}>
                        <FaChevronDown size={12}/>
                      </div>
                    </div>
                  </div>
                  {parentData.status_diketahui === "Diketahui" && (
                    <button type="button" onClick={clearParentData} className={styles.btnResetDetail}>
                      <FaEraser /> Reset Detail
                    </button>
                  )}
                </div>
                {/* Form Input Relasi Orang Tua */}
                {parentData.status_diketahui === "Diketahui" && (
                  <div className={`${styles.popupInput} animate-fade-in`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Status Hubungan */}
                      <div className="flex flex-col space-y-1.5">
                        <label className={styles.labelInputSelect}>
                          Status Hubungan <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select
                            name="status_hubungan"
                            value={parentData.status_hubungan}
                            onChange={handleParentChange}
                            className={styles.inputPilihan}>
                            <option value="Anak Kandung">Anak Kandung</option>
                            <option value="Anak Angkat">Anak Angkat</option>
                          </select>
                          <div className={styles.selectIcon}>
                            <FaChevronDown />
                          </div>
                        </div>
                      </div>
                      {/* Struktur Orang Tua/Jenis Pengangkatan */}
                      {(parentData.status_hubungan === "Anak Angkat" || kramaData.tipe_data === "Leluhur") && (
                        <div className="flex flex-col space-y-1.5 animate-fade-in">
                          <label className={styles.labelInputSelect}>
                            Struktur Orang Tua <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              name="jenis_pengangkatan"
                              value={parentData.jenis_pengangkatan}
                              onChange={handleParentChange}
                              className={styles.inputPilihan}>
                              <option value="Pasangan">Pasangan Suami Istri</option>
                              <option value="Tunggal">
                                {parentData.status_hubungan === "Anak Kandung" ? "Orang Tua Tunggal/Leluhur Tunggal" : "Orang Tua Tunggal"}
                              </option>
                            </select>
                            <div className={styles.selectIcon}>
                              <FaChevronDown size={12} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col space-y-4">
                      {(parentData.status_hubungan === "Anak Kandung" || (parentData.status_hubungan === "Anak Angkat" && parentData.jenis_pengangkatan === "Pasangan")) && parentData.jenis_pengangkatan !== "Tunggal" ? (
                        <>
                          <div className="flex flex-col space-y-1.5">
                            <label className={styles.labelInputSelect}>
                              Nama Orang Tua <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                className={styles.inputText}
                                placeholder="Ketikkan nama ayah atau ibu..."
                                value={isDropdownOrangTuaOpen ? searchOrangTuaTerm 
                                  : parentData.isManual ? "Data Pasangan Orang Tua Baru" 
                                  : perkawinanListOptions.find(m => String(m.id) === String(parentData.selected_perkawinan_id))
                                  ? getPerkawinanLabel(perkawinanListOptions.find(m => String(m.id) === String(parentData.selected_perkawinan_id)))
                                  : searchOrangTuaTerm
                                }
                                onChange={(e) => {
                                  setSearchOrangTuaTerm(e.target.value);
                                  setIsDropdownOrangTuaOpen(true);
                                }}
                                onFocus={() => setIsDropdownOrangTuaOpen(true)} 
                                required={parentData.status_diketahui === "Diketahui" && !parentData.isManual}
                              />
                              <div className={styles.termsIcon}>
                                <FaChevronDown size={12} className={`transition-transform ${isDropdownOrangTuaOpen ? 'rotate-180' : ''}`} />
                              </div>
                              {isDropdownOrangTuaOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOrangTuaOpen(false)}></div>
                                  <div className={styles.dropdownResult}>
                                    <div
                                      className={styles.listHasilTerms}
                                      onClick={() => {
                                        handleParentChange({ target: { name: "selected_perkawinan_id", value: "NEW_ENTRY" } });
                                        setIsDropdownOrangTuaOpen(false);
                                        setSearchOrangTuaTerm("");
                                      }}>
                                      <span className="font-bold text-blue-600">
                                        + Input Pasangan Orang Tua Baru
                                      </span>
                                    </div>
                                    {perkawinanListOptions.filter(m => getPerkawinanLabel(m).toLowerCase().includes(searchOrangTuaTerm.toLowerCase())).map((m) => {
                                      const namaSuami = m.suami?.nama_lengkap || "[Suami Tidak Tercatat]";
                                      const namaIstri = m.istri?.nama_lengkap || "[Istri Tidak Tercatat]";
                                      let statusDisplay = m.status_perkawinan || "Aktif";

                                      if (statusDisplay === "Cerai Hidup" || statusDisplay === "Cerai") {
                                        statusDisplay = "CERAI HIDUP";
                                      } else if (statusDisplay === "Cerai Mati") {
                                        statusDisplay = "CERAI MATI";
                                      } else {
                                        statusDisplay = statusDisplay.toUpperCase();
                                      }

                                      return (
                                        <div
                                          key={m.id}
                                          className={styles.filterHasilTerms}
                                          onClick={() => {
                                            handleParentChange({ target: { name: "selected_perkawinan_id", value: m.id } });
                                            setIsDropdownOrangTuaOpen(false);
                                            setSearchOrangTuaTerm("");
                                          }}>
                                          <div className="flex items-baseline gap-1.5">
                                            <p className="font-bold text-gray-800">
                                              {namaSuami} & {namaIstri}
                                            </p>
                                            {m.nomor_pendaftaran && (
                                              <span className="text-[10px] font-mono font-bold text-blue-600 bg-blue-50 px-1 rounded border border-blue-200">
                                                [{m.nomor_pendaftaran}]
                                              </span>
                                            )}
                                          </div>
                                          <p className="text-[10px] text-gray-500 uppercase font-medium">
                                            <span className={statusDisplay.includes("CERAI") ? "text-red-500 font-semibold" : "text-green-600 font-semibold"}>
                                              {statusDisplay}
                                            </span>
                                            {" • "}
                                            <span className="text-gray-600 font-mono">
                                              Perkawinan {m.jenis_perkawinan || "Biasa"}
                                            </span>
                                          </p>
                                        </div>
                                      );
                                    })}
                                    {perkawinanListOptions.filter(m => getPerkawinanLabel(m).toLowerCase().includes(searchOrangTuaTerm.toLowerCase())).length === 0 && (
                                      <div className="px-4 py-3 text-sm text-gray-500 italic">
                                        Data pasangan orang tua tidak ditemukan
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Preview Pasangan Orang Tua Terpilih */}
                          {parentData.selected_perkawinan_id && !parentData.isManual && (() => {
                            const perkawinanTerpilih = perkawinanListOptions.find(
                              m => String(m.id) === String(parentData.selected_perkawinan_id)
                            );

                            if (!perkawinanTerpilih) return null;
                            let statusDisplay = perkawinanTerpilih.status_perkawinan || "Aktif";

                            if (statusDisplay === "Cerai Hidup" || statusDisplay === "Cerai") {
                              statusDisplay = "CERAI HIDUP";
                            } else if (statusDisplay === "Cerai Mati") {
                              statusDisplay = "CERAI MATI";
                            } else {
                              statusDisplay = statusDisplay.toUpperCase();
                            }

                            return (
                              <div className={`${styles.preview} animate-fade-in`}>
                                <div className={`${styles.previewTitle} border-b border-gray-200 pb-2`}>
                                  <FaInfoCircle className="text-blue-600 mb-0.5" /> Preview Ringkas Data Pasangan Orang Tua
                                </div>
                                <div className="grid grid-cols-6 gap-x-6 gap-y-2 text-gray-700 text-sm">
                                  <div className={styles.colPreviewPasangan}>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-blue-600 block">
                                      Identitas Ayah
                                    </span>
                                    <div className="font-semibold text-gray-950 text-sm mt-0.5">
                                      {perkawinanTerpilih.suami?.nama_lengkap || "[Tidak Tercatat]"}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                                      [{perkawinanTerpilih.suami?.nomor_pendaftaran || "-"}] • {perkawinanTerpilih.suami?.status_hidup || "Hidup"}
                                    </div>
                                  </div>
                                  <div className="col-span-6 md:col-span-3 pb-2 md:pb-0">
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-pink-600 block">
                                      Identitas Ibu
                                    </span>
                                    <div className="font-semibold text-gray-950 text-sm mt-0.5">
                                      {perkawinanTerpilih.istri?.nama_lengkap || "[Tidak Tercatat]"}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5 font-mono">
                                      [{perkawinanTerpilih.istri?.nomor_pendaftaran || "-"}] • {perkawinanTerpilih.istri?.status_hidup || "Hidup"}
                                    </div>
                                  </div>

                                  <div className="col-span-6 border-t border-gray-200"></div>

                                  <div className="col-span-6 md:col-span-2">
                                    <span className={styles.previewLabel}>
                                      Status & Jenis Perkawinan Adat
                                    </span>
                                    <span className="font-medium block text-xs">
                                      <span className={statusDisplay.includes("CERAI") ? "text-red-600 font-bold" : "text-green-700 font-bold"}>
                                        {statusDisplay}
                                      </span>
                                      {" • "}
                                      <span className="text-gray-700 font-semibold text-xs uppercase font-mono">
                                        Perkawinan {perkawinanTerpilih.jenis_perkawinan || "Biasa"}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="col-span-6 md:col-span-2">
                                    <span className={styles.previewLabel}>
                                      Nomor Perkawinan Sistem
                                    </span>
                                    <span className="font-mono font-bold text-xs text-gray-900 block">
                                      <span className="text-blue-800">
                                        {perkawinanTerpilih.nomor_pendaftaran}
                                      </span>
                                    </span>
                                  </div>
                                  <div className="col-span-6 md:col-span-2">
                                    <span className={styles.previewLabel}>
                                      Tanggal Perkawinan
                                    </span>
                                    <span className="font-medium block text-xs">
                                      <span className="text-amber-700 font-bold">
                                        {perkawinanTerpilih.tanggal_perkawinan ? formatDate(perkawinanTerpilih.tanggal_perkawinan) : "-"}
                                      </span>
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Input Data Orang Tua dan Perkawinan */}
                          {parentData.isManual && (
                            <div className="mt-6 space-y-6 animate-fade-in">
                              {/* A. FORM DATA AYAH */}
                              <div className={styles.cardInfoBiru}>
                                <h4 className={styles.titleCardBiru}>
                                  <FaInfoCircle/> Informasi Ayah Baru
                                </h4>
                                <div className="space-y-5 mt-3">
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Tipe Data <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <select 
                                        name="tipe_data" 
                                        value={parentData.manualAyah.tipe_data} 
                                        onChange={(e) => handleManualParentInput("manualAyah", "tipe_data", e.target.value)} 
                                        className={styles.inputSelect} 
                                        required={parentData.isManual}>
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
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Lengkap <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                      type="text" 
                                      value={parentData.manualAyah.nama_lengkap} 
                                      onChange={(e) => handleManualParentInput("manualAyah", "nama_lengkap", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: I Wayan Sudarsana" 
                                      required={parentData.isManual} 
                                    />
                                  </div>
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Panggilan
                                    </label>
                                    <input 
                                      type="text" 
                                      value={parentData.manualAyah.nama_panggilan} 
                                      onChange={(e) => handleManualParentInput("manualAyah", "nama_panggilan", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Sudarsana" 
                                    />
                                  </div>
                                  <div className={styles.dualInput}>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Jenis Kelamin {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualAyah.jenis_kelamin} 
                                          onChange={(e) => handleManualParentInput("manualAyah", "jenis_kelamin", e.target.value)} 
                                          className={styles.inputSelect} 
                                          required={parentData.isManual && parentData.manualAyah.tipe_data !== "Leluhur"}>
                                          <option value="Laki-laki">Laki-laki</option>
                                          <option value="Perempuan">Perempuan</option>
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown size={12}/>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Tanggal Lahir
                                      </label>
                                      <input 
                                        type="date" 
                                        value={parentData.manualAyah.tanggal_lahir} 
                                        onChange={(e) => handleManualParentInput("manualAyah", "tanggal_lahir", e.target.value)} 
                                        className={styles.inputCalendar} 
                                      />
                                    </div>
                                  </div>
                                  <div className={styles.dualInput}>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Status Hidup
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualAyah.status_hidup} 
                                          onChange={(e) => handleManualParentInput("manualAyah", "status_hidup", e.target.value)} 
                                          className={styles.inputSelect}>
                                          <option value="Hidup">Hidup</option>
                                          <option value="Meninggal">Meninggal</option>
                                          {parentData.manualAyah.tipe_data === "Leluhur" && (
                                            <option value="Tidak Diketahui">Tidak Diketahui</option>
                                          )}
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown size={12}/>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={styles.checkbox}>
                                      <div className="flex items-center gap-3">
                                        <input 
                                          type="checkbox" 
                                          checked={parentData.manualAyah.is_bali} 
                                          id="is_bali_ayah_manual" 
                                          className={styles.checkboxInput} 
                                          onChange={(e) => handleManualParentInput("manualAyah", "is_bali", e.target.checked)} 
                                        />
                                        <label htmlFor="is_bali_ayah_manual" className={styles.checkboxLabel}>
                                          Krama ini asal Bali?
                                        </label>
                                      </div>
                                      <p className={styles.checkboxNote}>
                                        {parentData.manualAyah.tipe_data === "Leluhur" 
                                          ? "* Centang jika krama berasal dari Bali tetapi wilayah asal bersifat opsional jika data tidak diketahui."
                                          : "* Centang jika krama berasal dari Bali."
                                        }
                                      </p>
                                    </div>
                                  </div>
                                  {parentData.manualAyah.is_bali ? (
                                    <div className="space-y-4 animate-fade-in">
                                      <div className="flex flex-col space-y-1.5 relative">
                                        <label className={styles.labelInput}>
                                          Desa Adat Asal {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="relative">
                                          <input
                                            type="text"
                                            className={styles.termsDesaAdat}
                                            placeholder="Cari wilayah desa adat..."
                                            value={openDesaDropdownIndex === "manualAyah" 
                                              ? (searchDesaPasangan["manualAyah"] || "") 
                                              : (desaList.find(d => String(d.id) === String(parentData.manualAyah.desa_adat_id))?.nama_desa_adat || "")
                                            }
                                            onChange={(e) => {
                                              setSearchDesaPasangan({ ...searchDesaPasangan, manualAyah: e.target.value }); 
                                              setOpenDesaDropdownIndex("manualAyah");
                                            }}
                                            onFocus={() => setOpenDesaDropdownIndex("manualAyah")} 
                                            required={parentData.isManual && parentData.manualAyah.tipe_data !== "Leluhur"}
                                          />
                                          <div className={styles.termsIcon}>
                                            <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualAyah" ? 'rotate-180' : ''}`} />
                                          </div>
                                          {openDesaDropdownIndex === "manualAyah" && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                              <div className={styles.dropdownResult}>
                                                {getFilteredDesaManual("manualAyah").length > 0 ? (getFilteredDesaManual("manualAyah").map((d) => (
                                                  <div 
                                                    key={d.id} 
                                                    className={styles.dropdownItems} 
                                                    onClick={() => {
                                                      handleManualParentInput("manualAyah", "desa_adat_id", d.id); 
                                                      setSearchDesaPasangan({ ...searchDesaPasangan, manualAyah: d.nama_desa_adat }); 
                                                      setOpenDesaDropdownIndex(null); 
                                                    }}>
                                                    <p className="text-sm font-bold text-gray-800">{d.nama_desa_adat}</p>
                                                    {(() => {
                                                      const wil = getWilayahLengkap(d.id);
                                                      return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                    })()}
                                                  </div>
                                                ))) : (
                                                  <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                    Desa adat tidak ditemukan
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {parentData.manualAyah.desa_adat_id && (() => {
                                        const wilayah = getWilayahLengkap(parentData.manualAyah.desa_adat_id);
                                        return wilayah && (
                                          <div className="bg-amber-50 shadow-inner p-3 rounded grid grid-cols-3 gap-2 text-xs border border-gray-200 mt-2">
                                            <div>
                                              <span className="block text-[10px] uppercase text-gray-400">
                                                Kecamatan
                                              </span>
                                              <strong>{wilayah.kecamatan}</strong>
                                            </div>
                                            <div>
                                              <span className="block text-[10px] uppercase text-gray-400">
                                                Kabupaten
                                              </span>
                                              <strong>{wilayah.kabupaten}</strong>
                                            </div>
                                            <div>
                                              <span className="block text-[10px] uppercase text-gray-400">
                                                Provinsi
                                              </span>
                                            <strong>{wilayah.provinsi}</strong>
                                          </div>
                                          </div>
                                        );
                                      })()}
                                      <div className="flex flex-col space-y-1.5">
                                        <label className={styles.labelInput}>
                                          Tempat Asal Khusus
                                        </label>
                                        <input 
                                          name="tempat_asal_khusus" 
                                          value={parentData.manualAyah.tempat_asal_khusus || ""} 
                                          onChange={(e) => handleManualParentInput("manualAyah", "tempat_asal_khusus", e.target.value)} 
                                          className={styles.inputText} 
                                          placeholder="Contoh: Puri Agung Bangli" 
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col space-y-1.5 animate-fade-in">
                                      <label className={styles.labelInput}>
                                        Alamat Luar Bali {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <input 
                                        value={parentData.manualAyah.alamat_luar || ""} 
                                        onChange={(e) => handleManualParentInput("manualAyah", "alamat_luar", e.target.value)} 
                                        className={styles.inputText} 
                                        placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..." 
                                        required={parentData.isManual && !parentData.manualAyah.is_bali && parentData.manualAyah.tipe_data !== "Leluhur"}
                                      />
                                      <p className={styles.noted}>
                                        * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* B. FORM DATA IBU */}
                              <div className={styles.cardInfoPink}>
                                <h4 className={styles.titleCardPink}>
                                  <FaInfoCircle/> Informasi Ibu Baru
                                </h4>
                                <div className="space-y-5 mt-3">
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Tipe Data <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <select 
                                        name="tipe_data" 
                                        value={parentData.manualIbu.tipe_data} 
                                        onChange={(e) => handleManualParentInput("manualIbu", "tipe_data", e.target.value)} 
                                        className={styles.inputSelect} 
                                        required={parentData.isManual}>
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
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Lengkap <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                      type="text" 
                                      value={parentData.manualIbu.nama_lengkap} 
                                      onChange={(e) => handleManualParentInput("manualIbu", "nama_lengkap", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Ni Made Sri Utami" 
                                      required={parentData.isManual} 
                                    />
                                  </div>
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Panggilan
                                    </label>
                                    <input 
                                      type="text" 
                                      value={parentData.manualIbu.nama_panggilan} 
                                      onChange={(e) => handleManualParentInput("manualIbu", "nama_panggilan", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Sri Utami" 
                                    />
                                  </div>
                                  <div className={styles.dualInput}>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Jenis Kelamin {parentData.manualIbu.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualIbu.jenis_kelamin} 
                                          onChange={(e) => handleManualParentInput("manualIbu", "jenis_kelamin", e.target.value)} 
                                          className={styles.inputSelect} 
                                          required={parentData.isManual && parentData.manualIbu.tipe_data !== "Leluhur"}>
                                          <option value="Laki-laki">Laki-laki</option>
                                          <option value="Perempuan">Perempuan</option>
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown size={12}/>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Tanggal Lahir
                                      </label>
                                      <input 
                                        type="date" 
                                        value={parentData.manualIbu.tanggal_lahir} 
                                        onChange={(e) => handleManualParentInput("manualIbu", "tanggal_lahir", e.target.value)} 
                                        className={styles.inputCalendar} 
                                      />
                                    </div>
                                  </div>
                                  <div className={styles.dualInput}>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Status Hidup
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualIbu.status_hidup} 
                                          onChange={(e) => handleManualParentInput("manualIbu", "status_hidup", e.target.value)} 
                                          className={styles.inputSelect}>
                                          <option value="Hidup">Hidup</option>
                                          <option value="Meninggal">Meninggal</option>
                                          {parentData.manualIbu.tipe_data === "Leluhur" && (
                                            <option value="Tidak Diketahui">Tidak Diketahui</option>
                                          )}
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown size={12}/>
                                        </div>
                                      </div>
                                    </div>
                                    <div className={styles.checkbox}>
                                      <div className="flex items-center gap-3">
                                        <input 
                                          type="checkbox" 
                                          checked={parentData.manualIbu.is_bali} 
                                          id="is_bali_ibu_manual" 
                                          className={styles.checkboxInput} 
                                          onChange={(e) => handleManualParentInput("manualIbu", "is_bali", e.target.checked)} 
                                        />
                                        <label htmlFor="is_bali_ibu_manual" className={styles.checkboxLabel}>
                                          Krama ini asal Bali?
                                        </label>
                                      </div>
                                      <p className={styles.checkboxNote}>
                                        {parentData.manualIbu.tipe_data === "Leluhur" 
                                          ? "* Centang jika krama berasal dari Bali tetapi wilayah asal bersifat opsional jika data tidak diketahui."
                                          : "* Centang jika krama berasal dari Bali."
                                        }
                                      </p>
                                    </div>
                                  </div>
                                  {parentData.manualIbu.is_bali ? (
                                    <div className="space-y-4 animate-fade-in">
                                      <div className="flex flex-col space-y-1.5 relative">
                                        <label className={styles.labelInput}>
                                          Desa Adat Asal {parentData.manualIbu.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="relative">
                                          <input
                                            type="text"
                                            className={styles.termsDesaAdat}
                                            placeholder="Cari wilayah desa adat..."
                                            value={openDesaDropdownIndex === "manualIbu" 
                                              ? (searchDesaPasangan["manualIbu"] || "") 
                                              : (desaList.find(d => String(d.id) === String(parentData.manualIbu.desa_adat_id))?.nama_desa_adat || "")
                                            }
                                            onChange={(e) => {
                                              setSearchDesaPasangan({ ...searchDesaPasangan, manualIbu: e.target.value }); 
                                              setOpenDesaDropdownIndex("manualIbu");
                                            }}
                                            onFocus={() => setOpenDesaDropdownIndex("manualIbu")} 
                                            required={parentData.isManual && parentData.manualIbu.tipe_data !== "Leluhur"}
                                          />
                                          <div className={styles.termsIcon}>
                                            <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualIbu" ? 'rotate-180' : ''}`} />
                                          </div>
                                          {openDesaDropdownIndex === "manualIbu" && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                              <div className={styles.dropdownResult}>
                                                {getFilteredDesaManual("manualIbu").length > 0 ? (getFilteredDesaManual("manualIbu").map((d) => (
                                                  <div 
                                                    key={d.id} 
                                                    className={styles.dropdownItems} 
                                                    onClick={() => {
                                                      handleManualParentInput("manualIbu", "desa_adat_id", d.id); 
                                                      setSearchDesaPasangan({ ...searchDesaPasangan, manualIbu: d.nama_desa_adat }); 
                                                      setOpenDesaDropdownIndex(null); 
                                                    }}>
                                                    <p className="text-sm font-bold text-gray-800">{d.nama_desa_adat}</p>
                                                    {(() => {
                                                      const wil = getWilayahLengkap(d.id);
                                                      return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                    })()}
                                                  </div>
                                                ))) : (
                                                  <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                    Desa adat tidak ditemukan
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {parentData.manualIbu.desa_adat_id && (() => {
                                        const wilayah = getWilayahLengkap(parentData.manualIbu.desa_adat_id);
                                        return wilayah && (
                                          <div className="bg-amber-50 shadow-inner p-3 rounded grid grid-cols-3 gap-2 text-xs border border-gray-200 mt-2">
                                            <div>
                                              <span className="block text-[10px] uppercase text-gray-400">
                                                Kecamatan
                                              </span>
                                              <strong>{wilayah.kecamatan}</strong>
                                            </div>
                                            <div>
                                              <span className="block text-[10px] uppercase text-gray-400">
                                                Kabupaten
                                              </span>
                                              <strong>{wilayah.kabupaten}</strong>
                                            </div>
                                            <div>
                                              <span className="block text-[10px] uppercase text-gray-400">
                                                Provinsi
                                              </span>
                                              <strong>{wilayah.provinsi}</strong>
                                            </div>
                                          </div>
                                        );
                                      })()}
                                      <div className="flex flex-col space-y-1.5">
                                        <label className={styles.labelInput}>
                                          Tempat Asal Khusus
                                        </label>
                                        <input 
                                          name="tempat_asal_khusus" 
                                          value={parentData.manualIbu.tempat_asal_khusus || ""} 
                                          onChange={(e) => handleManualParentInput("manualIbu", "tempat_asal_khusus", e.target.value)} 
                                          className={styles.inputText} 
                                          placeholder="Contoh: Puri Agung Bangli" 
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col space-y-1.5 animate-fade-in">
                                      <label className={styles.labelInput}>
                                        Alamat Luar Bali {parentData.manualIbu.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <input 
                                        value={parentData.manualIbu.alamat_luar || ""} 
                                        onChange={(e) => handleManualParentInput("manualIbu", "alamat_luar", e.target.value)} 
                                        className={styles.inputText} 
                                        placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..." 
                                        required={parentData.isManual && !parentData.manualIbu.is_bali && parentData.manualIbu.tipe_data !== "Leluhur"}
                                      />
                                      <p className={styles.noted}>
                                        * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                              {/* C. FORM DATA PERKAWINAN ORTU */}
                              <div className={styles.cardInfoGray}>
                                <h4 className={styles.titleCardGray}>
                                  <FaInfoCircle/> Informasi Perkawinan Orang Tua
                                </h4>
                                <div className="space-y-5 mt-3">
                                  <div className="flex flex-col space-y-1.5">
                                    <label className={styles.labelInputSelect}>
                                      Status Perkawinan <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <select
                                        value={parentData.manualPerkawinan.status_perkawinan}
                                        onChange={(e) => handleManualParentInput("manualPerkawinan", "status_perkawinan", e.target.value)}
                                        className={styles.inputPilihan} 
                                        required={parentData.isManual}>
                                        <option value="Kawin">Kawin</option>
                                        <option value="Cerai">Cerai Hidup</option>
                                        <option value="Cerai Mati">Cerai Mati</option>
                                      </select>
                                      <div className={styles.selectIcon}>
                                        <FaChevronDown />
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles.dualColumn}>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInputSelect}>
                                        Jenis Perkawinan <span className="text-red-500">*</span>
                                      </label>
                                      <div className="relative">
                                        <select
                                          value={parentData.manualPerkawinan.jenis_perkawinan || "Biasa"}
                                          onChange={(e) => handleManualParentInput("manualPerkawinan", "jenis_perkawinan", e.target.value)}
                                          className={styles.inputPilihan}
                                          required>
                                          <option value="Biasa">Biasa</option>
                                          <option value="Nyentana">Nyentana</option>
                                          <option value="Pade Gelahang">Pade Gelahang</option>
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInputSelect}>
                                        Tanggal Perkawinan
                                      </label>
                                      <input
                                        type="date"
                                        value={parentData.manualPerkawinan.tanggal_perkawinan || ""}
                                        onChange={(e) => handleManualParentInput("manualPerkawinan", "tanggal_perkawinan", e.target.value)}
                                        className={styles.inputCalendar}
                                      />
                                    </div>
                                  </div>
                                  {(parentData.manualPerkawinan.status_perkawinan === "Cerai" ||parentData.manualPerkawinan.status_perkawinan === "Cerai Mati") && (
                                    <div className={`${styles.popupInput} animate-fade-in`}>
                                      <div className="flex flex-col space-y-1.5">
                                        <label className={styles.labelInputSelect}>
                                          Tanggal Perceraian
                                        </label>
                                        <input
                                          type="date"
                                          value={parentData.manualPerkawinan.tanggal_cerai || ""}
                                          onChange={(e) => handleManualParentInput("manualPerkawinan", "tanggal_cerai", e.target.value)}
                                          className={styles.inputCalendar}
                                        />
                                      </div>
                                      {parentData.manualPerkawinan.status_perkawinan === "Cerai Mati" && (
                                        <div className="space-y-5 mt-3">
                                          <div className={styles.dualColumn}>
                                            <div className="flex flex-col space-y-1.5">
                                              <label className={styles.labelInputSelect}>
                                                Pihak Meninggal <span className="text-red-500">*</span>
                                              </label>
                                              <div className="relative">
                                                <select
                                                  value={parentData.manualPerkawinan.pihak_meninggal || ""}
                                                  onChange={(e) => handleManualParentInput("manualPerkawinan", "pihak_meninggal", e.target.value)}
                                                  className={styles.inputPilihan}
                                                  required={parentData.manualPerkawinan.status_perkawinan === "Cerai Mati" && parentData.manualAyah.tipe_data !== "Leluhur" && parentData.manualIbu.tipe_data !== "Leluhur"}>
                                                  <option value="Pasangan">Predana</option>
                                                  <option value="Krama Utama">Purusa</option>
                                                </select>
                                                <div className={styles.selectIcon}>
                                                  <FaChevronDown />
                                                </div>
                                              </div>
                                            </div>
                                            <div className="flex flex-col space-y-1.5">
                                              <label className={styles.labelInputSelect}>
                                                Ketetapan Silsilah Predana <span className="text-red-500">*</span>
                                              </label>
                                              <div className="relative">
                                                <select
                                                  value={parentData.manualPerkawinan.pilihan_predana || ""}
                                                  onChange={(e) => handleManualParentInput("manualPerkawinan", "pilihan_predana", e.target.value)}
                                                  className={styles.inputPilihan}
                                                  required={parentData.manualPerkawinan.status_perkawinan === "Cerai Mati" && parentData.manualAyah.tipe_data !== "Leluhur" && parentData.manualIbu.tipe_data !== "Leluhur"}>
                                                  <option value="Tetap">Tetap di Purusa</option>
                                                  <option value="Kembali ke Asal">Kembali ke Asal</option>
                                                </select>
                                                <div className={styles.selectIcon}>
                                                  <FaChevronDown />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          {(() => {
                                            if (parentData.manualPerkawinan.status_perkawinan !== "Cerai Mati") return null;
                                            
                                            const jenisP = parentData.manualPerkawinan.jenis_perkawinan;
                                            if (jenisP === "Pade Gelahang") return null;

                                            const mati = parentData.manualPerkawinan.pihak_meninggal || "Pasangan";
                                            const isPredanaMeninggal = jenisP === "Nyentana" ? mati === "Krama Utama" : mati === "Pasangan";
                                            const isGenderPredana = jenisP === "Nyentana" ? "Laki-laki" : "Perempuan";

                                            return isPredanaMeninggal ? (
                                              <div className={styles.notedPredana}>
                                                <strong>Catatan Adat:</strong> Karena pihak <strong>{isGenderPredana} (Predana)</strong> yang meninggal dalam status pernikahan aktif, 
                                                disarankan memilih ketetapan silsilah <strong>"Tetap di Purusa"</strong>. Menurut hukum adat Bali, swadharma dan 
                                                kedudukan silsilah pihak Predana secara mutlak tetap berada di pihak keluarga penegak garis keturunan (Purusa).
                                              </div>
                                            ) : null;
                                          })()}
                                        </div>  
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          {/* Nama Orang Tua Tunggal */}
                          <div className="flex flex-col space-y-1.5 relative">
                            <label className={styles.labelInputSelect}>
                              Nama Orang Tua Tunggal <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                className={styles.inputText}
                                placeholder="Ketikkan nama orang tua/leluhur purusa tunggal ..."
                                value={isDropdownOrangTuaOpen ? searchOrangTuaTerm 
                                  : parentData.isManual ? "Data Orang Tua Tunggal Baru"
                                  : (kramaList.find(k => String(k.id) === String(parentData.selected_parent_id))?.nama_lengkap || (parentData.isManual ? "" : ""))
                                }
                                onChange={(e) => {
                                  setSearchOrangTuaTerm(e.target.value);
                                  setIsDropdownOrangTuaOpen(true);
                                }}
                                onFocus={() => setIsDropdownOrangTuaOpen(true)}
                                required={parentData.status_diketahui === "Diketahui" && !parentData.isManual}
                              />
                              <div className={styles.termsIcon}>
                                <FaChevronDown size={12} className={`transition-transform ${isDropdownOrangTuaOpen ? 'rotate-180' : ''}`} />
                              </div>
                              {isDropdownOrangTuaOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOrangTuaOpen(false)}></div>
                                  <div className={`${styles.dropdownResult}`}>
                                    <div
                                      className={styles.listHasilTerms}
                                      onClick={() => {
                                        handleParentChange({ target: { name: "selected_parent_id", value: "NEW_ENTRY" } });
                                        setIsDropdownOrangTuaOpen(false);
                                        setSearchOrangTuaTerm("");
                                      }}>
                                      <span className="font-bold text-blue-600">
                                        + Input Orang Tua Tunggal Baru
                                      </span>
                                    </div>
                                    {kramaList.filter(k => k.nama_lengkap.toLowerCase().includes(searchOrangTuaTerm.toLowerCase())).slice(0, 10).map((k) => (
                                      <div
                                        key={k.id}
                                        className={styles.filterHasilTerms}
                                        onClick={() => {
                                          handleParentChange({ target: { name: "selected_parent_id", value: k.id } });
                                          setIsDropdownOrangTuaOpen(false);
                                          setSearchOrangTuaTerm("");
                                        }}>
                                        <div className="flex items-baseline gap-1.5">
                                          <p className="font-bold text-gray-800">{k.nama_lengkap}</p>
                                          {k.nomor_pendaftaran && (
                                            <span className="text-[10px] font-mono font-bold text-gray-600 bg-gray-100 px-1 rounded">
                                              [{k.nomor_pendaftaran}]
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[10px] text-gray-500 uppercase italic">
                                          {k.jenis_kelamin || "Laki-laki"} • {(() => {
                                            const desaAdat = k.desa_adat_id 
                                              ? desaList.find(d => String(d.id) === String(k.desa_adat_id))
                                              : null;
                                            if (desaAdat) {
                                              return desaAdat.nama_desa_adat;
                                            }
                                            if (k.is_bali === true || k.is_bali === "true" || k.is_bali === 1) {
                                              return "Asal Bali";
                                            }
                                            if (k.tipe_data === "Leluhur") {
                                              return "Asal Bali (Leluhur)";
                                            }
                                            return k.alamat_luar || "Luar Bali";
                                          })()} • {k.nama_panggilan || k.tipe_data || "Krama"}
                                        </p>
                                      </div>
                                    ))}
                                    {kramaList.filter(k => k.nama_lengkap.toLowerCase().includes(searchOrangTuaTerm.toLowerCase())).length === 0 && (
                                      <div className="px-4 py-3 text-sm text-gray-500 italic">
                                        Nama orang tua tidak ditemukan
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Preview Orang Tua Tunggal */}
                          {parentData.selected_parent_id && !parentData.isManual && (() => {
                            const ortuTunggalTerpilih = kramaList.find(
                              k => String(k.id) === String(parentData.selected_parent_id)
                            );

                            if (!ortuTunggalTerpilih) return null;

                            const desaAdatOrtu = ortuTunggalTerpilih.desa_adat_id
                              ? desaList.find(d => String(d.id) === String(ortuTunggalTerpilih.desa_adat_id))
                              : null;

                            return (
                              <div className={`${styles.preview} animate-fade-in`}>
                                <div className={styles.previewTitle}>
                                  <FaInfoCircle className="text-blue-600 mb-0.5" /> Preview Ringkas Data Orang Tua Tunggal
                                </div>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                                  <div>
                                    <span className={styles.previewLabel}>
                                      Nama Lengkap
                                    </span>
                                    <span className="font-semibold text-gray-900">
                                      {ortuTunggalTerpilih.nama_lengkap}
                                    </span>
                                  </div>
                                  <div>
                                    <span className={styles.previewLabel}>
                                      Status Hidup/Tipe Data
                                    </span>
                                    <span className={`font-semibold ${ortuTunggalTerpilih.status_hidup === 'Meninggal' ? 'text-red-600' : 'text-green-600'}`}>
                                      {ortuTunggalTerpilih.status_hidup || "Hidup"}
                                    </span>
                                    <span className="text-gray-500 font-normal"> ({ortuTunggalTerpilih.tipe_data})</span>
                                  </div>
                                  <div className="mt-1">
                                    <span className={styles.previewLabel}>
                                      Jenis Kelamin
                                    </span>
                                    <span className="font-medium">{ortuTunggalTerpilih.jenis_kelamin}</span>
                                  </div>
                                  <div className="mt-1">
                                    <span className={styles.previewLabel}>
                                      Wilayah Adat Asal/Alamat Asal
                                    </span>
                                    <span className="font-medium">
                                      {ortuTunggalTerpilih && desaAdatOrtu?.nama_desa_adat ? (
                                        <span className="text-blue-700 font-medium">
                                          Desa Adat {desaAdatOrtu.nama_desa_adat}
                                        </span>
                                      ) : ortuTunggalTerpilih?.is_bali ? (
                                        "Asal Bali"
                                      ) : (
                                        ortuTunggalTerpilih?.alamat_luar || "Data Alamat Tidak Tersedia"
                                      )}
                                    </span>
                                  </div>
                                  <div className="mt-1">
                                    <span className={styles.previewLabel}>
                                      Nomor Pendaftaran Krama
                                    </span>
                                    <span className="font-mono font-bold text-xs">
                                      {ortuTunggalTerpilih.nomor_pendaftaran || "-"}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Input Data Orang Tua Tunggal */}
                          {parentData.isManual && (
                          <div className={`${styles.cardInfoGray} animate-fade-in shadow-inner`}>
                            <h4 className={styles.titleCardGray}>
                              <FaInfoCircle/> Informasi Orang Tua Tunggal Baru
                            </h4>
                            <div className="space-y-5 mt-3">
                              <div className="flex flex-col space-y-1">
                                <label className={styles.labelInput}>
                                  Tipe Data <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <select 
                                    name="tipe_data" 
                                    value={parentData.manualSingle.tipe_data} 
                                    onChange={(e) => handleManualParentInput("manualSingle", "tipe_data", e.target.value)} 
                                    className={styles.inputSelect} 
                                    required={parentData.isManual}>
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
                              <div className="flex flex-col space-y-1">
                                <label className={styles.labelInput}>
                                  Nama Lengkap <span className="text-red-500">*</span>
                                </label>
                                <input 
                                  type="text" 
                                  value={parentData.manualSingle.nama_lengkap} 
                                  onChange={(e) => handleManualParentInput("manualSingle", "nama_lengkap", e.target.value)} 
                                  className={styles.inputText}
                                  placeholder="Contoh: Ni Made Sri Utami" 
                                  required={parentData.isManual} 
                                />
                              </div>
                              <div className="flex flex-col space-y-1">
                                <label className={styles.labelInput}>
                                  Nama Panggilan
                                </label>
                                <input 
                                  type="text" 
                                  value={parentData.manualSingle.nama_panggilan} 
                                  onChange={(e) => handleManualParentInput("manualSingle", "nama_panggilan", e.target.value)} 
                                  className={styles.inputText}
                                  placeholder="Contoh: Sri Utami" 
                                />
                              </div>
                              <div className={styles.dualInput}>
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Jenis Kelamin {parentData.manualSingle.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                  </label>
                                  <div className="relative">
                                    <select 
                                      value={parentData.manualSingle.jenis_kelamin} 
                                      onChange={(e) => handleManualParentInput("manualSingle", "jenis_kelamin", e.target.value)} 
                                      className={styles.inputSelect} 
                                      required={parentData.isManual && parentData.manualSingle.tipe_data !== "Leluhur"}>
                                      <option value="Laki-laki">Laki-laki</option>
                                      <option value="Perempuan">Perempuan</option>
                                    </select>
                                    <div className={styles.selectIcon}>
                                      <FaChevronDown size={12}/>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Tanggal Lahir
                                  </label>
                                  <input 
                                    type="date" 
                                    value={parentData.manualSingle.tanggal_lahir} 
                                    onChange={(e) => handleManualParentInput("manualSingle", "tanggal_lahir", e.target.value)} 
                                    className={styles.inputCalendar} 
                                  />
                                </div>
                              </div>
                              <div className={styles.dualInput}>
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Status Hidup
                                  </label>
                                  <div className="relative">
                                    <select 
                                      value={parentData.manualSingle.status_hidup} 
                                      onChange={(e) => handleManualParentInput("manualSingle", "status_hidup", e.target.value)} 
                                      className={styles.inputSelect}>
                                      <option value="Hidup">Hidup</option>
                                      <option value="Meninggal">Meninggal</option>
                                      {parentData.manualSingle.tipe_data === "Leluhur" && (
                                        <option value="Tidak Diketahui">Tidak Diketahui</option>
                                      )}
                                    </select>
                                    <div className={styles.selectIcon}>
                                      <FaChevronDown size={12}/>
                                    </div>
                                  </div>
                                </div>
                                <div className={styles.checkbox}>
                                  <div className="flex items-center gap-3">
                                    <input 
                                      type="checkbox" 
                                      checked={parentData.manualSingle.is_bali} 
                                      id="is_bali_parent_manual" 
                                      className={styles.checkboxInput} 
                                      onChange={(e) => handleManualParentInput("manualSingle", "is_bali", e.target.checked)} 
                                    />
                                    <label htmlFor="is_bali_parent_manual" className={styles.checkboxLabel}>
                                      Krama ini asal Bali?
                                    </label>
                                  </div>
                                  <p className={styles.checkboxNote}>
                                    {parentData.manualSingle.tipe_data === "Leluhur" 
                                      ? "* Centang jika krama berasal dari Bali tetapi wilayah asal bersifat opsional jika data tidak diketahui."
                                      : "* Centang jika krama berasal dari Bali."
                                    }
                                  </p>
                                </div>
                              </div>
                              {parentData.manualSingle.is_bali ? (
                                <div className="space-y-4 animate-fade-in">
                                  <div className="flex flex-col space-y-1.5 relative">
                                    <label className={styles.labelInput}>
                                      Desa Adat Asal {parentData.manualSingle.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                    </label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className={styles.termsDesaAdat}
                                        placeholder="Cari wilayah desa adat..."
                                        value={openDesaDropdownIndex === "manualSingle" 
                                          ? (searchDesaPasangan["manualSingle"] || "") 
                                          : (desaList.find(d => String(d.id) === String(parentData.manualSingle.desa_adat_id))?.nama_desa_adat || "")
                                        }
                                        onChange={(e) => {
                                          setSearchDesaPasangan({ ...searchDesaPasangan, manualSingle: e.target.value }); 
                                          setOpenDesaDropdownIndex("manualSingle");
                                        }}
                                        onFocus={() => setOpenDesaDropdownIndex("manualSingle")} 
                                        required={parentData.isManual && parentData.manualSingle.tipe_data !== "Leluhur"}
                                      />
                                      <div className={styles.termsIcon}>
                                        <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualSingle" ? 'rotate-180' : ''}`} />
                                      </div>
                                      {openDesaDropdownIndex === "manualSingle" && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                          <div className={styles.dropdownResult}>
                                            {getFilteredDesaManual("manualSingle").length > 0 ? (getFilteredDesaManual("manualSingle").map((d) => (
                                              <div 
                                                key={d.id} 
                                                className={styles.dropdownItems} 
                                                onClick={() => {
                                                  handleManualParentInput("manualSingle", "desa_adat_id", d.id); 
                                                  setSearchDesaPasangan({ ...searchDesaPasangan, manualSingle: d.nama_desa_adat }); 
                                                  setOpenDesaDropdownIndex(null); 
                                                }}>
                                                <p className="text-sm font-bold text-gray-800">{d.nama_desa_adat}</p>
                                                {(() => {
                                                  const wil = getWilayahLengkap(d.id);
                                                  return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                })()}
                                              </div>
                                            ))) : (
                                              <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                Desa adat tidak ditemukan
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {parentData.manualSingle.desa_adat_id && (() => {
                                    const wilayah = getWilayahLengkap(parentData.manualSingle.desa_adat_id);
                                    return wilayah && (
                                      <div className="bg-amber-50 shadow-inner p-3 rounded grid grid-cols-3 gap-2 text-xs border border-gray-200 mt-2">
                                        <div>
                                          <span className="block text-[10px] uppercase text-gray-400">
                                            Kecamatan
                                          </span>
                                          <strong>{wilayah.kecamatan}</strong>
                                        </div>
                                        <div>
                                          <span className="block text-[10px] uppercase text-gray-400">
                                            Kabupaten
                                          </span>
                                          <strong>{wilayah.kabupaten}</strong>
                                        </div>
                                        <div>
                                          <span className="block text-[10px] uppercase text-gray-400">
                                            Provinsi
                                          </span>
                                        <strong>{wilayah.provinsi}</strong>
                                      </div>
                                      </div>
                                    );
                                  })()}
                                  <div className="flex flex-col space-y-1.5">
                                    <label className={styles.labelInput}>
                                      Tempat Asal Khusus
                                    </label>
                                    <input 
                                      name="tempat_asal_khusus" 
                                      value={parentData.manualSingle.tempat_asal_khusus || ""} 
                                      onChange={(e) => handleManualParentInput("manualSingle", "tempat_asal_khusus", e.target.value)} 
                                      className={styles.inputText} 
                                      placeholder="Contoh: Puri Agung Bangli" 
                                    />
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col space-y-1.5 animate-fade-in">
                                  <label className={styles.labelInput}>
                                    Alamat Luar Bali {parentData.manualSingle.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                  </label>
                                  <input 
                                    value={parentData.manualSingle.alamat_luar || ""} 
                                    onChange={(e) => handleManualParentInput("manualSingle", "alamat_luar", e.target.value)} 
                                    className={styles.inputText} 
                                    placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..." 
                                    required={parentData.isManual && !parentData.manualSingle.is_bali && parentData.manualSingle.tipe_data !== "Leluhur"}
                                  />
                                  <p className={styles.noted}>
                                    * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                          )}
                        </>
                      )}
                    </div>
                    {/* Tanggal Pengangkatan (Khusus Anak Angkat) */}
                    {parentData.status_hubungan === "Anak Angkat" && (
                      <div className="flex flex-col space-y-1.5">
                        <label className={styles.labelInputSelect}>
                          Tanggal Pengangkatan
                        </label>
                        <input
                          type="date"
                          name="tanggal_pengangkatan"
                          value={parentData.tanggal_pengangkatan}
                          onChange={handleParentChange}
                          className={styles.inputCalendar}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
            {/* BAGIAN 3: MENGANGKAT ANAK */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                III. Data Pengangkatan Anak
              </h3>
              <div className={styles.cardSection}>
                <div className={styles.dualColumn}>
                  <div className="flex flex-col space-y-1.5 flex-1">
                    <label className={styles.labelInputSelect}>
                      Apakah krama ini mengangkat anak? <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="status_pengangkatan"
                        value={adoptingData.status_pengangkatan}
                        onChange={handleAdoptingChange}
                        className={styles.inputSelect}
                        required>
                        <option value="Tidak">Tidak</option>
                        <option value="Mengangkat Anak">Ya, Mengangkat Anak</option>
                      </select>
                      <div className={styles.selectIcon}>
                        <FaChevronDown size={12}/>
                      </div>
                    </div>
                  </div>
                  {adoptingData.status_pengangkatan === "Mengangkat Anak" && (
                    <button type="button" onClick={clearAdoptingData} className={styles.btnResetDetail}>
                      <FaEraser /> Reset Detail
                    </button>
                  )}
                </div>
                {/* Form Input Anak Angkat */}
                {adoptingData.status_pengangkatan === "Mengangkat Anak" && (
                  <div className={`${styles.popupInput} animate-fade-in`}>
                    <div className="flex flex-col space-y-1">
                      <label className={styles.labelInputSelect}>
                        Nama Anak Angkat <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className={styles.inputText}
                          placeholder="Ketikkan nama anak angkat..."
                          value={isDropdownAnakOpen ? searchTermAnak 
                            : adoptingData.isAnakManual ? "Data Anak Angkat Baru" 
                            : kramaList.find(k => String(k.id) === String(adoptingData.anak_angkat_id)) 
                              ? getOrangTuaLabel(kramaList.find(k => String(k.id) === String(adoptingData.anak_angkat_id))) 
                              : searchTermAnak
                          }
                          onChange={(e) => {
                            setSearchTermAnak(e.target.value);
                            setIsDropdownAnakOpen(true);
                          }}
                          onFocus={() => setIsDropdownAnakOpen(true)}
                        />
                        <div className={styles.termsIcon}>
                          <FaChevronDown size={12} className={`transition-transform ${isDropdownAnakOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {isDropdownAnakOpen && (
                          <>
                            <div className="fixed inset-0 z-40" onClick={() => setIsDropdownAnakOpen(false)}></div>
                            <div className={styles.dropdownResult}>
                              <div
                                className={styles.listHasilTerms}
                                onClick={() => {
                                  handleAdoptingChange({ target: { name: "anak_angkat_id", value: "NEW_ENTRY" } });
                                  setIsDropdownAnakOpen(false);
                                  setSearchTermAnak("");
                                }}>
                                <span className="font-bold text-blue-600">
                                  + Input Anak Angkat Baru
                                </span>
                              </div>
                              {kramaList.filter(k => getOrangTuaLabel(k).toLowerCase().includes(searchTermAnak.toLowerCase())).map((k) => (
                                <div
                                  key={k.id}
                                  className={styles.filterHasilTerms}
                                  onClick={() => {
                                    handleAdoptingChange({ target: { name: "anak_angkat_id", value: k.id } });
                                    setIsDropdownAnakOpen(false);
                                    setSearchTermAnak("");
                                  }}>
                                  <div className="flex items-baseline gap-1.5">
                                    <p className="font-bold text-gray-800">{k.nama_lengkap}</p>
                                    {k.nomor_pendaftaran && (
                                      <span className="text-[10px] font-mono font-bold text-gray-600 bg-gray-100 px-1 rounded">
                                        [{k.nomor_pendaftaran}]
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] text-gray-500 uppercase italic">
                                    {(() => {
                                      const desaAdat = k.desa_adat_id 
                                        ? desaList.find(d => String(d.id) === String(k.desa_adat_id))
                                        : null;

                                      if (desaAdat) {
                                        return desaAdat.nama_desa_adat;
                                      }
                                      if (k.is_bali === true || k.is_bali === "true" || k.is_bali === 1) {
                                        return "Asal Bali";
                                      }
                                      if (k.tipe_data === "Leluhur") {
                                        return "Asal Bali (Leluhur)";
                                      }
                                      return k.alamat_luar || "Luar Bali";
                                    })()} • {k.nama_panggilan || k.tipe_data || "Krama"}
                                  </p>
                                </div>
                              ))}
                              {kramaList.filter(k => getOrangTuaLabel(k).toLowerCase().includes(searchTermAnak.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-sm text-gray-500 italic">
                                  Nama anak tidak ditemukan
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Preview Anak Angkat Terpilih */}
                    {adoptingData.anak_angkat_id && !adoptingData.isAnakManual && (() => {
                      const anakTerpilih = kramaList.find(
                        k => String(k.id) === String(adoptingData.anak_angkat_id)
                      );

                      if (!anakTerpilih) return null;

                      const desaAdatAnak = anakTerpilih.desa_adat_id
                        ? desaList.find(d => String(d.id) === String(anakTerpilih.desa_adat_id))
                        : null;

                      return (
                        <div className={`${styles.preview} animate-fade-in mt-3`}>
                          <div className={styles.previewTitle}>
                            <FaInfoCircle className="text-blue-600 mb-0.5" /> Preview Ringkas Data Diri Anak Angkat
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                            <div>
                              <span className={styles.previewLabel}>
                                Nama Lengkap
                              </span>
                              <span className="font-semibold text-gray-900">
                                {anakTerpilih.nama_lengkap}
                              </span>
                            </div>
                            <div>
                              <span className={styles.previewLabel}>
                                Status Hidup/Tipe Data
                              </span>
                              <span className={`font-semibold ${anakTerpilih.status_hidup === 'Meninggal' ? 'text-red-600' : 'text-green-600'}`}>
                                {anakTerpilih.status_hidup || "Hidup"}
                              </span>
                              <span className="text-gray-500 font-normal"> ({anakTerpilih.tipe_data})</span>
                            </div>
                            <div className="mt-1">
                              <span className={styles.previewLabel}>
                                Jenis Kelamin
                              </span>
                              <span className="font-medium">{anakTerpilih.jenis_kelamin}</span>
                            </div>
                            <div className="mt-1">
                              <span className={styles.previewLabel}>
                                Orang Tua Kandung/Angkat
                              </span>
                              <span className="font-medium text-gray-600">
                                {getHanyaNamaOrangTua(anakTerpilih, relasiKramaList)}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className={styles.previewLabel}>
                                Wilayah Adat Asal/Alamat Asal
                              </span>
                              <span className="font-medium">
                                {anakTerpilih && desaAdatAnak?.nama_desa_adat ? (
                                  <span className="text-blue-700 font-medium">
                                    Desa Adat {desaAdatAnak.nama_desa_adat}
                                  </span>
                                ) : anakTerpilih?.is_bali ? (
                                  "Asal Bali"
                                ) : (
                                  anakTerpilih?.alamat_luar || "Data Alamat Tidak Tersedia"
                                )}
                              </span>
                            </div>
                            <div className="mt-1">
                              <span className={styles.previewLabel}>
                                Nomor Pendaftaran Krama
                              </span>
                              <span className="font-mono font-bold text-xs">
                                {anakTerpilih.nomor_pendaftaran || "-"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Form Input Anak Angkat Baru */}
                    {adoptingData.isAnakManual && (
                      <div className={`${styles.cardInfoGreen} animate-fade-in shadow-inner`}>
                        <h4 className={styles.titleCardGreen}>
                          <FaInfoCircle /> Informasi Anak Angkat Baru
                        </h4>
                        <div className="space-y-5 mt-3">
                          <div className="flex flex-col space-y-1">
                            <label className={styles.labelInput}>
                              Tipe Data <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <select 
                                name="tipe_data" 
                                value={adoptingData.manualAnak.tipe_data} 
                                onChange={(e) => handleManualAnakInput("tipe_data", e.target.value)} 
                                className={styles.inputSelect} 
                                required={adoptingData.isAnakManual}>
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
                          <div className="flex flex-col space-y-1">
                            <label className={styles.labelInput}>
                              Nama Lengkap <span className="text-red-500">*</span>
                            </label>
                            <input 
                              type="text" 
                              value={adoptingData.manualAnak.nama_lengkap} 
                              onChange={(e) => handleManualAnakInput("nama_lengkap", e.target.value)} 
                              className={styles.inputText}
                              placeholder="Contoh: I Putu Gede Adnyana" 
                              required={adoptingData.isAnakManual}
                            />
                          </div>
                          <div className="flex flex-col space-y-1">
                            <label className={styles.labelInput}>
                              Nama Panggilan
                            </label>
                            <input 
                              type="text" 
                              value={adoptingData.manualAnak.nama_panggilan} 
                              onChange={(e) => handleManualAnakInput("nama_panggilan", e.target.value)} 
                              className={styles.inputText}
                              placeholder="Contoh: Gede Adnyana" 
                            />
                          </div>
                          <div className={styles.dualInput}>
                            <div className="flex flex-col space-y-1.5 flex-1">
                              <label className={styles.labelInput}>
                                Jenis Kelamin {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                              </label>
                              <div className="relative">
                                <select 
                                  value={adoptingData.manualAnak.jenis_kelamin} 
                                  onChange={(e) => handleManualAnakInput("jenis_kelamin", e.target.value)} 
                                  className={styles.inputSelect} 
                                  required={adoptingData.isAnakManual && adoptingData.manualAnak.tipe_data !== "Leluhur"}>
                                  <option value="Laki-laki">Laki-laki</option>
                                  <option value="Perempuan">Perempuan</option>
                                </select>
                                <div className={styles.selectIcon}>
                                  <FaChevronDown size={12}/>
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col space-y-1.5">
                              <label className={styles.labelInput}>
                                Tanggal Lahir
                              </label>
                              <input 
                                type="date" 
                                value={adoptingData.manualAnak.tanggal_lahir} 
                                onChange={(e) => handleManualAnakInput("tanggal_lahir", e.target.value)} 
                                className={styles.inputCalendar} 
                              />
                            </div>
                          </div>
                          <div className={styles.dualInput}>
                            <div className="flex flex-col space-y-1.5">
                              <label className={styles.labelInput}>
                                Status Hidup
                              </label>
                              <div className="relative">
                                <select 
                                  value={adoptingData.manualAnak.status_hidup} 
                                  onChange={(e) => handleManualAnakInput("status_hidup", e.target.value)} 
                                  className={styles.inputSelect}>
                                  <option value="Hidup">Hidup</option>
                                  <option value="Meninggal">Meninggal</option>
                                  {adoptingData.manualAnak.tipe_data === "Leluhur" && (
                                    <option value="Tidak Diketahui">Tidak Diketahui</option>
                                  )}
                                </select>
                                <div className={styles.selectIcon}>
                                  <FaChevronDown size={12}/>
                                </div>
                              </div>
                            </div>
                            <div className={styles.checkbox}>
                              <div className="flex items-center gap-3">
                                <input 
                                  type="checkbox" 
                                  checked={adoptingData.manualAnak.is_bali} 
                                  id="is_bali_anak_angkat" 
                                  className={styles.checkboxInput} 
                                  onChange={(e) => handleManualAnakInput("is_bali", e.target.checked)} 
                                />
                                <label htmlFor="is_bali_anak_angkat" className={styles.checkboxLabel}>
                                  Krama ini asal Bali?
                                </label>
                              </div>
                              <p className={styles.checkboxNote}>
                                {adoptingData.manualAnak.tipe_data === "Leluhur" 
                                  ? "* Centang jika krama berasal dari Bali tetapi wilayah asal bersifat opsional jika data tidak diketahui."
                                  : "* Centang jika krama berasal dari Bali."
                                }
                              </p>
                            </div>
                          </div>
                          {adoptingData.manualAnak.is_bali ? (
                            <div className="space-y-4 animate-fade-in">
                              <div className="flex flex-col space-y-1.5 relative">
                                <label className={styles.labelInput}>
                                  Desa Adat Asal {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                </label>
                                <div className="relative">
                                  <input
                                    type="text"
                                    className={styles.termsDesaAdat}
                                    placeholder="Cari wilayah desa adat..."
                                    value={openDesaDropdownIndex === "manualAnak" 
                                      ? (searchDesaPasangan["manualAnak"] || "") 
                                      : (desaList.find(d => String(d.id) === String(adoptingData.manualAnak.desa_adat_id))?.nama_desa_adat || "")
                                    }
                                    onChange={(e) => {
                                      setSearchDesaPasangan({ ...searchDesaPasangan, manualAnak: e.target.value }); 
                                      setOpenDesaDropdownIndex("manualAnak");
                                    }}
                                    onFocus={() => setOpenDesaDropdownIndex("manualAnak")} 
                                    required={adoptingData.isAnakManual && adoptingData.manualAnak.tipe_data !== "Leluhur"}
                                  />
                                  <div className={styles.termsIcon}>
                                    <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualAnak" ? 'rotate-180' : ''}`} />
                                  </div>
                                  {openDesaDropdownIndex === "manualAnak" && (
                                    <>
                                      <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                      <div className={styles.dropdownResult}>
                                        {getFilteredDesaManual("manualAnak").length > 0 ? (getFilteredDesaManual("manualAnak").map((d) => (
                                          <div 
                                            key={d.id} 
                                            className={styles.dropdownItems} 
                                            onClick={() => {
                                              handleManualAnakInput("desa_adat_id", d.id); 
                                              setSearchDesaPasangan({ ...searchDesaPasangan, manualAnak: d.nama_desa_adat }); 
                                              setOpenDesaDropdownIndex(null); 
                                            }}>
                                            <p className="text-sm font-bold text-gray-800">{d.nama_desa_adat}</p>
                                            {(() => {
                                              const wil = getWilayahLengkap(d.id);
                                              return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                            })()}
                                          </div>
                                        ))) : (
                                          <div className="px-4 py-3 text-sm text-gray-500 italic">
                                            Desa adat tidak ditemukan
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              {adoptingData.manualAnak.desa_adat_id && (() => {
                                const wilayah = getWilayahLengkap(adoptingData.manualAnak.desa_adat_id);
                                return wilayah && (
                                  <div className="bg-amber-50 shadow-inner p-3 rounded grid grid-cols-3 gap-2 text-xs border border-gray-200 mt-2">
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-400">
                                        Kecamatan
                                      </span>
                                      <strong>{wilayah.kecamatan}</strong>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-400">
                                        Kabupaten
                                      </span>
                                      <strong>{wilayah.kabupaten}</strong>
                                    </div>
                                    <div>
                                      <span className="block text-[10px] uppercase text-gray-400">
                                        Provinsi
                                      </span>
                                      <strong>{wilayah.provinsi}</strong>
                                    </div>
                                  </div>
                                );
                              })()}
                              <div className="flex flex-col space-y-1.5">
                                <label className={styles.labelInput}>
                                  Tempat Asal Khusus
                                </label>
                                <input 
                                  name="tempat_asal_khusus" 
                                  value={adoptingData.manualAnak.tempat_asal_khusus || ""} 
                                  onChange={(e) => handleManualAnakInput("tempat_asal_khusus", e.target.value)} 
                                  className={styles.inputText} 
                                  placeholder="Contoh: Puri Agung Bangli" 
                                />
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col space-y-1.5 animate-fade-in">
                              <label className={styles.labelInput}>
                                Alamat Luar Bali {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                              </label>
                              <input 
                                value={adoptingData.manualAnak.alamat_luar || ""} 
                                onChange={(e) => handleManualAnakInput("alamat_luar", e.target.value)} 
                                className={styles.inputText} 
                                placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..." 
                                required={adoptingData.isAnakManual && !adoptingData.manualAnak.is_bali && adoptingData.manualAnak.tipe_data !== "Leluhur"}
                              />
                              <p className={styles.noted}>
                                * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {/* Tanggal Pengangkatan */}
                    <div className="flex flex-col space-y-1.5">
                      <label className={styles.labelInputSelect}>
                        Tanggal Pengangkatan
                      </label>
                      <input
                        type="date"
                        name="tanggal_pengangkatan_anak"
                        value={adoptingData.tanggal_pengangkatan_anak}
                        onChange={handleAdoptingChange}
                        className={styles.inputCalendar}
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
            {/* ACTION BUTTONS */}
            <div className={styles.buttonGroup}>
              <button type="button" onClick={() => setShowCancelModal(true)} className={styles.btnBackRed} disabled={isLoading}>
                <FaTimes /> Batal
              </button>
              <button type="button"onClick={saveKrama} className={styles.btnSubmit} disabled={isLoading} >
                <FaSave size={14} /> {isLoading ? 'Menyimpan...' : 'Simpan Relasi'}
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
                  Konfirmasi Pengajuan Relasi Krama
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Apakah Anda yakin data relasi krama utama ini sudah benar, sah, dan sesuai dengan awig-awig/pararem desa adat?
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
                  Apakah Anda yakin ingin membatalkan pengajuan relasi krama ini? Semua perubahan data yang telah Anda ketik akan hilang seketika.
                </p>
              </div>
              <div className="mt-10 flex gap-3 justify-center">
                <button onClick={() => setShowCancelModal(false)} className={styles.btnCancel}>
                  Kembali
                </button>
                <button onClick={handleBack} className={styles.btnDelete}>
                  <FaTimes size={15} /> {isLoading ? 'Memproses...' : 'Ya, Batalkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default DataKramaTambahRelasi;