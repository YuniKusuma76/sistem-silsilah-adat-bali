import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaChevronDown, 
  FaSave, 
  FaTimes, 
  FaPlus, 
  FaTrash, 
  FaInfoCircle, 
  FaEraser, 
  FaExclamationTriangle,
  FaLock
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBaru.module.css';

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

const DataKramaEditKawin = ({ user }) => {
  const { id: slugParam } = useParams();
  const notifDropdownRef = useRef(null);
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [currentKawinRaw, setCurrentKawinRaw] = useState(null);
  const [showSaveConfirmModal, setShowSaveConfirmModal] = useState(false);

  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([]);

  // STATE KRAMA UTAMA:
  const [kramaList, setKramaList] = useState([]);
  const [searchDesaUtama, setSearchDesaUtama] = useState("");

  // STATE PERKAWINAN:
  const [perkawinanlist, setPerkawinanlist] = useState([]);
  const [searchPasangan, setSearchPasangan] = useState({}); 
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [openDesaDropdownIndex, setOpenDesaDropdownIndex] = useState(null);
  const [searchDesaManual, setSearchDesaManual] = useState({});
  
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

  useEffect(() => {
    const fetchAllData = async () => {
      if (!realId) return;
      try {
        setIsLoading(true);
        const kawinQueryMode = (user?.role === "Super Admin" || user?.role === "Admin Desa") 
          ? "verification" 
          : "personal";

        const results = await Promise.allSettled([
          axiosInstance.get(`/perkawinan/${realId}?mode=${kawinQueryMode}`),
          axiosInstance.get("/krama-bali?mode=public"),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
        ]);

        const [
          resKawinObj, 
          resKramaListObj, 
          resDesaObj, 
          resKecObj, 
          resKabObj, 
          resProvObj 
        ] = results;

        const resKawin = resKawinObj.status === "fulfilled" ? resKawinObj.value.data?.data : null;
        const dataKrama = resKramaListObj.status === "fulfilled" ? resKramaListObj.value.data?.data : [];
        const dataDesa = resDesaObj.status === "fulfilled" ? resDesaObj.value.data?.data : [];
        const dataKec = resKecObj.status === "fulfilled" ? resKecObj.value.data?.data : [];
        const dataKab = resKabObj.status === "fulfilled" ? resKabObj.value.data?.data : [];
        const dataProv = resProvObj.status === "fulfilled" ? resProvObj.value.data?.data : [];

        setKramaList(dataKrama || []);
        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);
        setCurrentKawinRaw(resKawin);

        if (resKawin) {
          const targetId = resKawin.suami_id || resKawin.istri_id;
          let kramaUtama = resKawin?.suami || resKawin?.Suami || resKawin?.istri || resKawin?.Istri;

          if (targetId) {
            try {
              const resDetailKrama = await axiosInstance.get(`/krama-bali/${targetId}`);
              if (resDetailKrama.data?.data) {
                kramaUtama = resDetailKrama.data.data;
              }
            } catch (errKrama) {
              console.error("Gagal mengambil detail krama bali:", errKrama);
              if (!kramaUtama && dataKrama.length > 0) {
                kramaUtama = dataKrama.find(k => String(k.id) === String(targetId));
              }
            }
          }

          if (kramaUtama) {
            let safeTanggalLahir = "";

            if (kramaUtama.tanggal_lahir) {
              safeTanggalLahir = kramaUtama.tanggal_lahir.substring(0, 10);
            }

            setKramaData({
              nama_lengkap: kramaUtama.nama_lengkap || "",
              nama_panggilan: kramaUtama.nama_panggilan || "",
              jenis_kelamin: kramaUtama.jenis_kelamin || "",
              tanggal_lahir: safeTanggalLahir, 
              status_hidup: kramaUtama.status_hidup || "Hidup",
              is_bali: kramaUtama.is_bali ?? true,
              desa_adat_id: kramaUtama.desa_adat_id || "",
              tempat_asal_khusus: kramaUtama.tempat_asal_khusus || "",
              alamat_luar: kramaUtama.alamat_luar || "",
              tipe_data: kramaUtama.tipe_data || "Keturunan"
            });

            const activeDesa = dataDesa.find(d => String(d.id) === String(kramaUtama.desa_adat_id));
            if (activeDesa) {
              setSearchDesaUtama(activeDesa.nama_desa_adat);
            }

            const idPasanganDb = kramaUtama?.jenis_kelamin === "Laki-laki" ? resKawin.istri_id : resKawin.suami_id;
            const objekPasangan = dataKrama.find(k => String(k.id) === String(idPasanganDb));
            
            if (objekPasangan) {
              setSearchPasangan({ 0: objekPasangan.nama_lengkap });
            }

            const tipeAwal = (resKawin.status_perkawinan === "Cerai" || resKawin.status_perkawinan === "Cerai Mati") 
              ? "PERCERAIAN" 
              : "PERKAWINAN";

            setPerkawinanlist([{
              id_asli_db: resKawin.id,
              tipe_update: tipeAwal,
              status_perkawinan: resKawin.status_perkawinan || "Kawin",
              jenis_perkawinan: resKawin.jenis_perkawinan || "Biasa",
              tanggal_perkawinan: resKawin.tanggal_perkawinan ? resKawin.tanggal_perkawinan.substring(0, 10) : "",
              pasangan_id: idPasanganDb || "",
              tanggal_cerai: resKawin.tanggal_cerai ? resKawin.tanggal_cerai.substring(0, 10) : "",
              pihak_meninggal: resKawin.pihak_meninggal || "",
              pilihan_predana: resKawin.pilihan_predana || "Kembali ke Asal",
              catatan_update: "",
              isPasanganBaru: false,
              isDataLamaTerunci: false
            }]);
          }
        } else {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: 'Data perkawinan tidak ditemukan.' 
          });
        }
      } catch (error) {
        console.error("Gagal memuat rangkaian data silsilah:", error);
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Gagal memuat detail data perkawinan. Periksa koneksi Anda.' 
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const term = searchDesaManual[index] || "";
    if (!term.trim()) return [];
    return desaList
      .filter((d) => d.nama_desa_adat.toLowerCase().includes(term.toLowerCase()))
      .slice(0, 8);
  };

  // HELPER PERKAWINAN: Mengambil data pasangan terdaftar berdasarkan gender lawan jenis
  const getFilteredPasangan = (index) => {
    if (!kramaData.jenis_kelamin) return [];
    const targetGender = kramaData.jenis_kelamin === "Laki-laki" ? "Perempuan" : "Laki-laki";
    const term = searchPasangan[index] || "";
    if (!term.trim()) return [];

    return kramaList
      .filter((k) => 
        k.jenis_kelamin === targetGender &&
        k.nama_lengkap.toLowerCase().includes(term.toLowerCase())
      )
      .slice(0, 8);
  };

  // HELPER PERKAWINAN: Menangani perubahan data input perkawinan
  const handlePerkawinanChange = (index, field, value) => {
    const list = perkawinanlist.map((item, idx) => {
      if (idx !== index) return item;

      const updatedItem = { ...item };
      const genderPasanganOtomatis = kramaData.jenis_kelamin === "Laki-laki" ? "Perempuan" : "Laki-laki";

      if (field === "pasangan_id" && value === "NEW_ENTRY") {
        updatedItem.isPasanganBaru = true;
        updatedItem.pasangan_id = "";
        
        updatedItem.dataPasanganBaru = {
          ...updatedItem.dataPasanganBaru,
          jenis_kelamin: genderPasanganOtomatis,
          tipe_data: kramaData.tipe_data,
          status_hidup: kramaData.tipe_data === "Leluhur" ? "Tidak Diketahui" : "Hidup"
        };
      } else {
        if (field === "pasangan_id") {
          updatedItem.isPasanganBaru = false;
        }
        updatedItem[field] = value;
      }
      
      // =========================================================================
      // PENYESUAIAN TAMBAHAN: SINKRONISASI TIPE UPDATE DENGAN STATUS PILIHAN FRONTEND
      // =========================================================================
      if (field === "status_perkawinan") {
        if (value === "Cerai" || value === "Cerai Mati") {
          updatedItem.tipe_update = "PERCERAIAN";
        } else {
          updatedItem.tipe_update = "PERKAWINAN";
        }
      }
      // =========================================================================

      // Otomatisasi status hidup ketika cerai mati
      if (field === "status_perkawinan" && value === "Cerai Mati") {
        updatedItem.pihak_meninggal = updatedItem.pihak_meninggal || "Pasangan";
        updatedItem.pilihan_predana = updatedItem.pilihan_predana || "Kembali ke Asal";
        
        if (updatedItem.isPasanganBaru && updatedItem.pihak_meninggal === "Pasangan") {
          updatedItem.dataPasanganBaru = {
            ...updatedItem.dataPasanganBaru,
            status_hidup: "Meninggal"
          };
        }
      }
      
      if (field === "pihak_meninggal" && updatedItem.status_perkawinan === "Cerai Mati" && updatedItem.isPasanganBaru) {
        updatedItem.dataPasanganBaru = {
          ...updatedItem.dataPasanganBaru,
          status_hidup: value === "Pasangan" ? "Meninggal" : (kramaData.tipe_data === "Leluhur" ? "Tidak Diketahui" : "Hidup")
        };
      }
      return updatedItem;
    });
    setPerkawinanlist(list);
  };

  const handlePasanganBaruChange = (index, field, value) => {
    const list = perkawinanlist.map((item, idx) => {
      if (idx !== index) return item;
      if (field === "dataPasanganBaruUtuh") {
        return {
          ...item,
          dataPasanganBaru: value
        };
      }
      return {
        ...item,
        dataPasanganBaru: {
          ...item.dataPasanganBaru,
          [field]: value
        }
      };
    });
    setPerkawinanlist(list);
  };
  
  // HELPER PERKAWINAN: Menambah kolom input pasangan jika poligami
  const tambahBarisPerkawinan = () => {
    const defaultTipeData = kramaData.tipe_data;
    const defaultStatusHidup = defaultTipeData === "Leluhur" ? "Tidak Diketahui" : "Hidup";
    const genderPasanganOtomatis = kramaData.jenis_kelamin === "Laki-laki" ? "Perempuan" : "Laki-laki";

    setPerkawinanlist([...perkawinanlist, {
      id_temp: Date.now(),
      status_perkawinan: "Kawin",
      jenis_perkawinan: "Biasa",
      tanggal_perkawinan: "",
      pasangan_id: "",
      tanggal_cerai: "",
      pihak_meninggal: "",
      pilihan_predana: "Tetap",
      isPasanganBaru: false,
      dataPasanganBaru: { 
        nama_lengkap: "", 
        nama_panggilan: "",
        jenis_kelamin: genderPasanganOtomatis,
        tanggal_lahir: "", 
        status_hidup: defaultStatusHidup,
        is_bali: true,
        desa_adat_id: "",
        tempat_asal_khusus: "",
        alamat_luar: "",
        tipe_data: defaultTipeData
      }
    }]);
  };

  const hapusBarisPerkawinan = (index) => {
    const list = perkawinanlist.filter((_, idx) => idx !== index);
    setPerkawinanlist(list);

    if (searchDesaManual[index]) {
      setSearchDesaManual(prev => {
        const updated = { ...prev };
        delete updated[index];
        return updated;
      });
    }
  };

  // HELPER PERKAWINAN: Membersihkan form input perkawinan
  const clearPerkawinan = (index) => {
    const defaultTipeData = kramaData.tipe_data;
    const defaultStatusHidup = defaultTipeData === "Leluhur" ? "Tidak Diketahui" : "Hidup";
    const genderPasanganOtomatis = kramaData.jenis_kelamin === "Laki-laki" ? "Perempuan" : "Laki-laki";

    setSearchDesaManual(prev => ({ ...prev, [index]: "" }));

    const list = perkawinanlist.map((item, idx) => {
      if (idx !== index) return item;
      return {
        id_temp: item.id_temp,
        status_perkawinan: "Kawin",
        jenis_perkawinan: "Biasa",
        tanggal_perkawinan: "",
        pasangan_id: "",
        tanggal_cerai: "",
        pihak_meninggal: "",
        pilihan_predana: "Tetap",
        isPasanganBaru: false,
        dataPasanganBaru: {
          nama_lengkap: "",
          nama_panggilan: "",
          jenis_kelamin: genderPasanganOtomatis,
          tanggal_lahir: "",
          status_hidup: defaultStatusHidup, 
          is_bali: true,
          desa_adat_id: "",
          tempat_asal_khusus: "",
          alamat_luar: "",
          tipe_data: defaultTipeData
        }
      };
    });
    setPerkawinanlist(list);
  };

  const handleBack = () => {
    setShowCancelModal(false);
    const targetMainId = currentKawinRaw?.suami_id || currentKawinRaw?.istri_id;
    if (targetMainId) {
      navigate(`/krama-bali/my-data/detail/${targetMainId}`, { 
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
    for (let i = 0; i < perkawinanlist.length; i++) {
      const p = perkawinanlist[i];

      if (p.isDataLamaTerunci) continue;

      if (!p.pasangan_id && !p.isPasanganBaru) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: `Baris ke-${i + 1}: Silakan pilih pasangan terdaftar atau pilih opsi 'Input Pasangan Baru'!` 
        });
        return false;
      }

      if (p.isPasanganBaru) {
        if (!p.dataPasanganBaru.nama_lengkap.trim()) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: `Nama lengkap pasangan baru pada baris ke-${i + 1} wajib diisi!` 
          });
          return false;
        }
        if (p.dataPasanganBaru.is_bali && !p.dataPasanganBaru.desa_adat_id) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: `Desa Adat asal untuk pasangan baru pada baris ke-${i + 1} wajib dipilih!` 
          });
          return false;
        }
        if (!p.dataPasanganBaru.is_bali && !p.dataPasanganBaru.alamat_luar?.trim()) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: `Alamat luar Bali untuk pasangan baru pada baris ke-${i + 1} wajib diisi!` 
          });
          return false;
        }
        if (!p.catatan_update?.trim()) {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: `Baris ke-${i + 1}: Alasan atau keterangan perubahan data wajib diisi!` 
          });
          return false;
        }
      }
    }
    return true;
  };
  
  // SUBMIT DATA:
  const saveKrama = async (e, isConfirmed = false) => {
    if (e) e.preventDefault();
    if (typeof validateForm === "function" && !validateForm()) {
      return;
    }

    if (!isConfirmed) {
      setShowSaveConfirmModal(true);
      return;
    }

    setShowSaveConfirmModal(false);

    // Konversi value agar tidak kosong
    const safeInt = (value) => {
      if (value === undefined || value === null || value === "") return null;
      const parsed = parseInt(value, 10);
      return isNaN(parsed) ? null : parsed;
    };

    const safeDate = (value) => {
      if (!value || String(value).trim() === "" || String(value).toLowerCase() === "invalid date") {
        return null;
      }
      const testDate = new Date(value);
      return isNaN(testDate.getTime()) ? null : value;
    };

    try {
      setIsLoading(true);
      const mainId = safeInt(currentKawinRaw?.suami_id || currentKawinRaw?.istri_id);

      if (!mainId) {
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Data target krama utama tidak ditemukan.' 
        });
        setIsLoading(false);
        return;
      }

      // PROSES SAVE PERUBAHAN DATA
      for (const m of perkawinanlist) {
        if (m.isDataLamaTerunci) {
          continue;
        }

        if (currentKawinRaw?.status_perkawinan === "Kawin" && (m.status_perkawinan === "Cerai" || m.status_perkawinan === "Cerai Mati")) {
          setAlert({
            show: true,
            type: 'warning',
            message: 'Proses dihentikan! Gunakan modul pengajuan perceraian jika ingin mengubah status perkawinan menjadi cerai hidup/cerai mati.'
          });
          setIsLoading(false);
          return; 
        }

        let targetPasanganId = safeInt(m.pasangan_id);
        let namaPasanganTerbaca = m.nama_pasangan || m.nama_lengkap || "";

        if (m.isPasanganBaru && m.dataPasanganBaru) {
          const payloadSpouse = { ...m.dataPasanganBaru };

          payloadSpouse.desa_adat_id = safeInt(payloadSpouse.desa_adat_id);
          payloadSpouse.tanggal_lahir = safeDate(payloadSpouse.tanggal_lahir);

          if (payloadSpouse.tempat_asal_khusus === "") {
            payloadSpouse.tempat_asal_khusus = null;
          }
          if (payloadSpouse.alamat_luar === "") {
            payloadSpouse.alamat_luar = null;
          }
          
          let genderPasanganPilihan = "Tidak Diketahui";
          const genderUtama = kramaData?.jenis_kelamin;

          if (genderUtama === "Laki-laki") {
            genderPasanganPilihan = "Perempuan";
          } else if (genderUtama === "Perempuan") {
            genderPasanganPilihan = "Laki-laki";
          } else {
            genderPasanganPilihan = m.dataPasanganBaru?.jenis_kelamin || "Tidak Diketahui";
          }

          const spouseRes = await axiosInstance.post("/krama-bali", { 
            ...payloadSpouse, 
            jenis_kelamin: genderPasanganPilihan
          });

          const rawSpouseId = spouseRes.data?.data?.id || spouseRes.data?.id || spouseRes.data?.data?.krama?.id;
          targetPasanganId = safeInt(rawSpouseId);
          namaPasanganTerbaca = m.dataPasanganBaru?.nama_lengkap || "";
        }

        if (!targetPasanganId) {
          throw new Error(`Gagal memproses data pasangan pada baris perkawinan ke-${perkawinanlist.indexOf(m) + 1}. Data pasangan tidak ditemukan.`);
        }

        const payloadPutBackend = {
          tipe_update: m.tipe_update, 
          suami_id: kramaData?.jenis_kelamin === "Laki-laki" ? mainId : targetPasanganId,
          istri_id: kramaData?.jenis_kelamin === "Laki-laki" ? targetPasanganId : mainId,
          jenis_perkawinan: m.jenis_perkawinan,
          tanggal_event: m.tipe_update === "PERCERAIAN" ? safeDate(m.tanggal_cerai) : safeDate(m.tanggal_perkawinan),
          status_perkawinan: m.status_perkawinan, 
          pihak_meninggal: m.tipe_update === "PERCERAIAN" ? (m.pihak_meninggal || null) : null,
          pilihan_predana: m.tipe_update === "PERCERAIAN" ? (m.pilihan_predana || null) : null,
          catatan_update: JSON.stringify({
            keterangan: m.catatan_update || `Perubahan data utama perkawinan relasi purusa-predana.`,
            nama_pasangan_baru: namaPasanganTerbaca
          })
        };

        if (m.id_asli_db) {
          const resUpdate = await axiosInstance.put(`/perkawinan/update/${m.id_asli_db}`, payloadPutBackend);
          console.log(resUpdate.data);
        } else {
          let payloadPostNew = { 
            suami_id: payloadPutBackend.suami_id,
            istri_id: payloadPutBackend.istri_id,
            status_perkawinan: "Kawin", 
            jenis_perkawinan: m.jenis_perkawinan, 
            tanggal_perkawinan: payloadPutBackend.tanggal_event 
          };
          const resPost = await axiosInstance.post("/perkawinan/kawin", payloadPostNew);
          console.log(resPost.data);
        }
      }

      navigate(`/krama-bali/my-data/detail/${mainId}`, { 
        state: { successMessage: 'Perubahan data perkawinan adat berhasil diperbarui!' },
        replace: true
      });

    } catch (error) {
      console.error(error);
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem. Periksa koneksi Anda...' 
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
              Perbarui Data Perkawinan Adat
            </h2>
            <p className={styles.navSubtitle}>
              Perbaiki data lama perkawinan adat dengan data baru yang sebenarnya dan sah
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
            <div className={`${styles.noteFormEdit} animate-fade-in`}>
              <div className="flex items-start gap-3">
                <div className="text-amber-600 mt-0.5 text-xl">
                  <FaExclamationTriangle />
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-amber-900 uppercase tracking-wider">
                    Pemberitahuan Perubahan Pasangan Perkawinan Adat
                  </h4>
                  <p className="text-[11px] text-amber-800 mt-1 leading-relaxed">
                    Perubahan atau pergantian pasangan dilakukan dari sudut pandang <strong>Krama Utama selaku pihak Purusa</strong>. 
                  </p>
                  <p className="text-[11px] text-amber-700 mt-2 font-semibold">
                    <strong>PENTING:</strong> <i>Jika perkawinan lama telah memiliki relasi anak (keturunan). pastikan Anda telah memindahkan/mengamankan relasi silsilah anak-anak dari pasangan lama terlebih dahulu di modul manajemen relasi orang tua sebelum mengganti data pasangan di form ini!</i>
                  </p>
                </div>
              </div>
            </div>
            <form onSubmit={saveKrama} className="w-full space-y-8">
              {/* BAGIAN 1: DATA DIRI KRAMA BALI */}
              <section className={styles.section}>
                <h3 className={styles.sectionTitle}>
                  I. Data Diri Krama Utama
                </h3>
                <div className="space-y-5">
                  {/* Tipe Data */}
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
                  {/* Nama Lengkap */}
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
                  {/* Nama Panggilan */}
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
                    {/* Tanggal Lahir */}
                    <div className="flex flex-col space-y-1.5">
                      <label className={styles.labelInput}>
                        Tanggal Lahir
                      </label>
                      <input 
                        type={kramaData.tanggal_lahir ? "date" : "text"}
                        name="tanggal_lahir" 
                        value={kramaData.tanggal_lahir || "Tidak Diketahui"} 
                        className={styles.inputCalendar} 
                        disabled={true}
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
                    {/* IS BALI */}
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
                  {/* Kondisi IS BALI */}
                  {kramaData.is_bali ? (
                    <div className="space-y-4 animate-fade-in">
                      <div className={styles.isBaliDual}>
                        {/* Search Select Desa Adat */}
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
                      {kramaData.desa_adat_id && desaList.length > 0 && (
                        <div className={styles.previewWilayahAdat}>
                          {(() => {
                            if (typeof getWilayahLengkap !== "function") return null;
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
              {/* BAGIAN 2: DATA PERKAWINAN */}
              <section className={styles.section}>
                <div className={styles.sectionContent}>
                  <h3 className={styles.sectionDualTitle}>
                    II. Data Perkawinan Adat
                  </h3>
                  {kramaData.jenis_kelamin === "Laki-laki" && (
                    <button type="button" onClick={tambahBarisPerkawinan} className={styles.btnAddIstri}>
                      <FaPlus size={12}/> Tambah Perkawinan
                    </button>
                  )}
                </div>
                <div className="space-y-8">
                  {perkawinanlist.map((m, index) => {
                    const isPredanaMeninggal = (() => {
                      if (m.status_perkawinan !== "Cerai Mati") return false;
                      const kramaUtamaPerempuan = kramaData.jenis_kelamin === "Perempuan";
                      if (m.jenis_perkawinan === "Nyentana") {
                        return (!kramaUtamaPerempuan && m.pihak_meninggal === "Krama Utama") || (kramaUtamaPerempuan && m.pihak_meninggal === "Pasangan");
                      } else {
                        return (kramaUtamaPerempuan && m.pihak_meninggal === "Krama Utama") || (!kramaUtamaPerempuan && m.pihak_meninggal === "Pasangan");
                      }
                    })();
  
                    const isGenderPredana = m.jenis_perkawinan === "Nyentana" ? "Laki-laki" : "Perempuan";
                    const pasanganTerpilih = kramaList.find(k => String(k.id) === String(m.pasangan_id));
                    const isPasanganDraft = pasanganTerpilih?.status_verifikasi === "Draft";
  
                    return (
                      <div key={m.id_temp || index} className={`${styles.cardSection} ${m.isDataLamaTerunci ? 'bg-gray-50 border-l-4 border-amber-500 opacity-95' : ''}`}>
                        {perkawinanlist.length > 1 && !m.isDataLamaTerunci && (
                          <button type="button" onClick={() => hapusBarisPerkawinan(index)} className={styles.btnTrashKawin} title="Hapus Draf Perkawinan Baru">
                            <FaTrash size={14} />
                          </button>
                        )}
                        {m.isDataLamaTerunci && (
                          <span className="items-center flex flex-1 text-[10px] bg-amber-100 text-amber-800 px-2 py-1 font-bold uppercase mb-5 rounded-md">
                            <FaLock className="mr-1 mb-0.5" /> Riwayat Perkawinan Terdaftar (Terkunci)
                          </span>
                        )}
                        {/* Status Perkawinan */}
                        <div className={styles.dualColumn}>
                          <div className="flex flex-col space-y-1.5">
                            <label className={styles.labelInputSelect}>
                              Status Perkawinan #{index + 1} <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <select 
                                value={m.status_perkawinan} 
                                onChange={(e) => handlePerkawinanChange(index, "status_perkawinan", e.target.value)} 
                                className={`${styles.inputPilihan} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed text-gray-600' : ''}`}
                                disabled={true}>
                                <option value="Kawin">Kawin</option>
                                <option value="Cerai Hidup">Cerai Hidup</option>
                                <option value="Cerai Mati">Cerai Mati</option>
                              </select>
                              <div className={styles.selectIcon}>
                                <FaChevronDown size={12}/>
                              </div>
                            </div>
                          </div>
                          {m.status_perkawinan !== "Belum Kawin" && !m.isDataLamaTerunci && (
                            <button type="button" onClick={() => {clearPerkawinan(index)}} className={styles.btnResetDetail}>
                              <FaEraser /> Reset Detail
                            </button>
                          )}
                        </div>
                        {m.status_perkawinan !== "Belum Kawin" && (
                          <div className={`${styles.popupInput} animate-fade-in`}>
                            {/* Jenis Perkawinan & Tanggal Perkawinan */}
                            <div className={styles.dualColumn}>
                              <div className="flex flex-col space-y-1.5">
                                <label className={styles.labelInputSelect}>
                                  Jenis Perkawinan <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                  <select 
                                    value={m.jenis_perkawinan} 
                                    onChange={(e) => handlePerkawinanChange(index, "jenis_perkawinan", e.target.value)} 
                                    className={`${styles.inputPilihan} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    disabled={m.isDataLamaTerunci} 
                                    required>
                                    <option value="Biasa">Biasa</option>
                                    <option value="Nyentana">Nyentana</option>
                                    <option value="Pade Gelahang">Pade Gelahang</option>
                                  </select>
                                  <div className={styles.selectIcon}>
                                    <FaChevronDown size={12} />
                                  </div>
                                </div>
                              </div>
                              <div className="flex flex-col space-y-1.5">
                                <label className={styles.labelInputSelect}>
                                  Tanggal Perkawinan 
                                </label>
                                <input 
                                  type="date" 
                                  value={m.tanggal_perkawinan} 
                                  onChange={(e) => handlePerkawinanChange(index, "tanggal_perkawinan", e.target.value)} 
                                  className={`${styles.inputCalendar} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                  disabled={m.isDataLamaTerunci}
                                />
                              </div>
                            </div>
                            {/* Pencarian Nama Pasangan */}
                            <div className="flex flex-col space-y-1.5 relative">
                              <label className={styles.labelInputSelect}>
                                Nama Pasangan <span className="text-red-500">*</span>
                              </label>
                              <div className="relative">
                                <input
                                  type="text"
                                  className={`${styles.inputText} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed font-semibold' : ''}`}
                                  placeholder={m.isDataLamaTerunci ? "" : "Ketikkan nama pasangan..."}
                                  value={openDropdownIndex === index ? (searchPasangan[index] || "") 
                                    : m.isPasanganBaru ? "Data Pasangan Baru" : pasanganTerpilih 
                                    ? `${pasanganTerpilih.nama_lengkap}${isPasanganDraft ? " (DRAFT - MENUNGGU VERIFIKASI)" : ""}` : ""
                                  }
                                  onChange={(e) => {
                                    if (m.isDataLamaTerunci) return;
                                    setSearchPasangan({ ...searchPasangan, [index]: e.target.value }); 
                                    setOpenDropdownIndex(index); 
                                  }}
                                  onFocus={() => {
                                    if (m.isDataLamaTerunci) return;
                                    setSearchPasangan({ ...searchPasangan, [index]: "" });
                                    setOpenDropdownIndex(index);
                                  }}
                                  disabled={m.isDataLamaTerunci}
                                  required={!m.isPasanganBaru}
                                />
                                <div className={styles.termsIcon}>
                                  <FaChevronDown size={12} className={`transition-transform ${openDropdownIndex === index ? 'rotate-180' : ''}`} />
                                </div>
                                {openDropdownIndex === index && !m.isDataLamaTerunci && (
                                  <>
                                    <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownIndex(null)}></div>
                                    <div className={styles.dropdownHasilPasangan}>
                                      <div
                                        className={styles.listHasilTerms}
                                        onClick={() => {
                                          handlePerkawinanChange(index, "pasangan_id", "NEW_ENTRY");
                                          setOpenDropdownIndex(null);
                                          setSearchPasangan({ ...searchPasangan, [index]: "" });
                                        }}>
                                        <span className="font-bold text-blue-600">
                                          + Input Pasangan Baru
                                        </span>
                                      </div>
                                      {getFilteredPasangan(index).length > 0 ? (
                                        getFilteredPasangan(index).map((k) => (
                                          <div
                                            key={k.id}
                                            className={styles.filterHasilTerms}
                                            onClick={() => {
                                              handlePerkawinanChange(index, "pasangan_id", k.id);
                                              setOpenDropdownIndex(null);
                                              setSearchPasangan({ ...searchPasangan, [index]: k.nama_lengkap });
                                            }}>
                                            <p className="font-bold text-gray-800">{k.nama_lengkap}</p>
                                            <p className="text-[10px] text-gray-500 uppercase italic">
                                              {k.is_bali 
                                                ? (desaList.find(d => String(d.id) === String(k.desa_adat_id))?.nama_desa_adat || "Asal Bali")
                                                : (k.alamat_luar || "Luar Bali")
                                              } • {k.nama_panggilan || k.tipe_data}
                                            </p>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="px-4 py-2.5 text-xs text-gray-400 italic bg-white">
                                          Nama pasangan tidak ditemukan
                                        </div>
                                      )}
                                    </div>
                                  </>
                                )}
                              </div>
                              {/* Preview Pasangan */}
                              {pasanganTerpilih && !m.isPasanganBaru && (
                                <div className={`${styles.preview} animate-fade-in`}>
                                  <div className={styles.previewTitle}>
                                    <FaInfoCircle className="text-blue-600 mb-0.5" /> Preview Ringkas Data Diri Pasangan
                                  </div>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                                    <div>
                                      <span className={styles.previewLabel}>
                                        Nama Lengkap
                                      </span>
                                      <span className="font-semibold text-gray-900">{pasanganTerpilih.nama_lengkap}</span>
                                    </div>
                                    <div>
                                      <span className={styles.previewLabel}>
                                        Status Hidup/Tipe Data
                                      </span>
                                      <span className={`font-semibold ${pasanganTerpilih.status_hidup === 'Meninggal' ? 'text-red-600' : 'text-green-600'}`}>
                                        {pasanganTerpilih.status_hidup || "Hidup"}
                                      </span>
                                      <span className="text-gray-500 font-normal"> ({pasanganTerpilih.tipe_data})</span>
                                    </div>
                                    <div className="mt-1">
                                      <span className={styles.previewLabel}>
                                        Jenis Kelamin
                                      </span>
                                      <span className="font-medium">{pasanganTerpilih.jenis_kelamin}</span>
                                    </div>
                                    <div className="mt-1">
                                      <span className={styles.previewLabel}>
                                        Wilayah Adat Asal/Alamat Asal
                                      </span>
                                      <span className="font-medium">
                                        {pasanganTerpilih.is_bali 
                                          ? (desaList.find(d => String(d.id) === String(pasanganTerpilih.desa_adat_id))?.nama_desa_adat || "Asal Bali")
                                          : (pasanganTerpilih.alamat_luar || "Luar Bali")
                                        }
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {/* Data Detail jika Pasangan Baru */}
                            {m.isPasanganBaru && !m.isDataLamaTerunci && (
                              <div className={`${styles.cardPasanganBaru} animate-fade-in shadow-inner`}>
                                <h4 className={styles.titleCardPasangan}>
                                  <FaInfoCircle/> Informasi Pasangan Baru
                                </h4>
                                <div className="space-y-5 mt-3">
                                  {/* Tipe Data Pasangan Baru*/}
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Tipe Data Pasangan <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <select 
                                        name="tipe_data" 
                                        value={m.dataPasanganBaru.tipe_data || ""} 
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          handlePerkawinanChange(index, "dataPasanganBaru", {
                                            ...m.dataPasanganBaru,
                                            tipe_data: val,
                                            status_hidup: val === "Leluhur" ? "Tidak Diketahui" : "Hidup"
                                          });
                                        }}
                                        className={styles.inputSelect} 
                                        required={m.isPasanganBaru}>
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
                                  {/* Nama Lengkap Pasangan Baru*/}
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Lengkap <span className="text-red-500">*</span>
                                    </label>
                                    <input 
                                      type="text" 
                                      value={m.dataPasanganBaru.nama_lengkap || ""} 
                                      onChange={(e) => handlePasanganBaruChange(index, "nama_lengkap", e.target.value)}
                                      className={styles.inputText}
                                      placeholder="Contoh: Ni Made Sri Utami" 
                                      required 
                                    />
                                  </div>
                                  {/* Nama Panggilan Pasangan Baru */}
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Panggilan
                                    </label>
                                    <input 
                                      type="text" 
                                      value={m.dataPasanganBaru.nama_panggilan || ""} 
                                      onChange={(e) => handlePasanganBaruChange(index, "nama_panggilan", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Sri Utami" 
                                    />
                                  </div>
                                  <div className={styles.dualInput}>
                                    {/* Tanggal Lahir Pasangan Baru */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Tanggal Lahir
                                      </label>
                                      <input 
                                        type="date" 
                                        value={m.dataPasanganBaru.tanggal_lahir || ""} 
                                        onChange={(e) => handlePasanganBaruChange(index, "tanggal_lahir", e.target.value)} 
                                        className={styles.inputCalendar} 
                                      />
                                    </div>
                                    {/* Status Hidup Pasangan Baru*/}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Status Hidup 
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={m.dataPasanganBaru.status_hidup || ""} 
                                          onChange={(e) => handlePasanganBaruChange(index, "status_hidup", e.target.value)} 
                                          className={styles.inputSelect}>
                                          <option value="Hidup">Hidup</option>
                                          <option value="Meninggal">Meninggal</option>
                                          {m.dataPasanganBaru.tipe_data === "Leluhur" && (
                                            <option value="Tidak Diketahui">Tidak Diketahui</option>
                                          )}
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown size={12}/>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {/* IS BALI Pasangan Baru */}
                                  <div className={styles.checkbox}>
                                    <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={m.dataPasanganBaru.is_bali || false} 
                                        id={`is_bali_pasangan_${index}`} 
                                        className={styles.checkboxInput} 
                                        onChange={(e) => {
                                          const isChecked = e.target.checked;
                                          const updatedDataPasangan = {
                                            ...m.dataPasanganBaru,
                                            is_bali: isChecked,
                                            desa_adat_id: isChecked ? m.dataPasanganBaru.desa_adat_id : "",
                                            alamat_luar: isChecked ? "" : m.dataPasanganBaru.alamat_luar
                                          };
                                          handlePasanganBaruChange(index, "dataPasanganBaruUtuh", updatedDataPasangan);
                                        }}
                                      />
                                      <label htmlFor={`is_bali_pasangan_${index}`} className={styles.checkboxLabel}>
                                        Krama ini asal Bali?
                                      </label>
                                    </div>
                                    <p className={styles.checkboxNote}>
                                      {m.dataPasanganBaru.tipe_data === "Leluhur" 
                                        ? "* Centang jika krama berasal dari Bali tetapi wilayah asal bersifat opsional jika data tidak diketahui."
                                        : "* Centang jika krama berasal dari Bali."
                                      }
                                    </p>
                                  </div>
                                  {m.dataPasanganBaru.is_bali ? (
                                    <div className="space-y-4 animate-fade-in">
                                      <div className="flex flex-col space-y-1.5 relative">
                                        <label className={styles.labelInput}>
                                          Desa Adat Asal {m.dataPasanganBaru.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                        </label>
                                        <div className="relative">
                                          <input
                                            type="text"
                                            className={styles.termsDesaAdat}
                                            placeholder="Cari desa adat pasangan..."
                                            value={openDesaDropdownIndex === index 
                                              ? (searchDesaManual[index] || "") 
                                              : (desaList.find(d => String(d.id) === String(m.dataPasanganBaru.desa_adat_id))?.nama_desa_adat || "")
                                            }
                                            onChange={(e) => {
                                              setSearchDesaManual({ ...searchDesaManual, [index]: e.target.value }); 
                                              setOpenDesaDropdownIndex(index);
                                            }}
                                            onFocus={() => setOpenDesaDropdownIndex(index)}
                                          />
                                          <div className={styles.termsIcon}>
                                            <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === index ? 'rotate-180' : ''}`} />
                                          </div>
                                          {openDesaDropdownIndex === index && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                              <div className={styles.dropdownResult}>
                                                {getFilteredDesaManual(index).length > 0 ? (
                                                  getFilteredDesaManual(index).map((d) => (
                                                    <div 
                                                      key={d.id} 
                                                      className={styles.dropdownItems} 
                                                      onClick={() => {
                                                        handlePasanganBaruChange(index, "desa_adat_id", d.id); 
                                                        setSearchDesaManual({ ...searchDesaManual, [index]: d.nama_desa_adat }); 
                                                        setOpenDesaDropdownIndex(null); 
                                                      }}>
                                                      <p className="text-sm font-bold text-gray-800">{d.nama_desa_adat}</p>
                                                      {(() => {
                                                        const wil = getWilayahLengkap(d.id);
                                                        return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                      })()}
                                                    </div>
                                                  ))
                                                ) : (
                                                  <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                    Desa adat tidak ditemukan
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {/* Info Detail Wilayah Adat Pasangan */}
                                      {m.dataPasanganBaru.desa_adat_id && (() => {
                                        const wilayah = getWilayahLengkap(m.dataPasanganBaru.desa_adat_id);
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
                                          value={m.dataPasanganBaru.tempat_asal_khusus || ""} 
                                          onChange={(e) => handlePasanganBaruChange(index, "tempat_asal_khusus", e.target.value)} 
                                          className={styles.inputText} 
                                          placeholder="Contoh: Puri Agung Bangli" 
                                        />
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col space-y-1.5 animate-fade-in">
                                      <label className={styles.labelInput}>
                                        Alamat Luar Bali {m.dataPasanganBaru.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <input 
                                        value={m.dataPasanganBaru.alamat_luar || ""} 
                                        onChange={(e) => handlePasanganBaruChange(index, "alamat_luar", e.target.value)} 
                                        className={styles.inputText} 
                                        placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..." 
                                        required={!m.dataPasanganBaru.is_bali && m.dataPasanganBaru.tipe_data !== "Leluhur"}
                                      />
                                      <p className={styles.noted}>
                                        * Diisi dengan alamat lengkap asal krama, baik dalam negeri maupun luar negeri
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {/* KOLOM DETAIL PERCERAIAN */}
                            {(m.status_perkawinan === "Cerai Hidup" || m.status_perkawinan === "Cerai Mati") && (
                              <div className={styles.inputContent}>
                                <h5 className="text-xs font-bold text-rose-800 uppercase tracking-wider items-center flex flex-1">
                                  Rincian Pencatatan Mutasi Perceraian Adat
                                </h5>
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInputSelect}>
                                    Tanggal Perceraian
                                  </label>
                                  <input 
                                    type="date" 
                                    value={m.tanggal_cerai || ""} 
                                    onChange={(e) => handlePerkawinanChange(index, "tanggal_cerai", e.target.value)} 
                                    className={`${styles.inputCalendar} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                    disabled={m.isDataLamaTerunci}
                                  />
                                </div>
                                {m.status_perkawinan === "Cerai Mati" && (
                                  <div className="space-y-3">
                                    <div className={styles.dualColumn}>
                                      <div className="flex flex-col space-y-1.5">
                                        <label className={styles.labelInputSelect}>
                                          Pihak Meninggal <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                          <select 
                                            value={m.pihak_meninggal || ""} 
                                            onChange={(e) => handlePerkawinanChange(index, "pihak_meninggal", e.target.value)} 
                                            className={`${styles.inputPilihan} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                            disabled={m.isDataLamaTerunci}
                                            required={m.status_perkawinan === "Cerai Mati" && kramaData.tipe_data !== "Leluhur"}>
                                            <option value="Pasangan">Pasangan</option>
                                            <option value="Krama Utama">Krama Utama (Form I)</option>
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
                                            value={m.pilihan_predana || ""} 
                                            onChange={(e) => handlePerkawinanChange(index, "pilihan_predana", e.target.value)} 
                                            className={`${styles.inputPilihan} ${m.isDataLamaTerunci ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                                            disabled={m.isDataLamaTerunci}
                                            required={m.status_perkawinan === "Cerai Mati" && kramaData.tipe_data !== "Leluhur"}>
                                            <option value="Tetap">Tetap di Purusa</option>
                                            <option value="Kembali ke Asal">Kembali ke Asal</option>
                                          </select>
                                          <div className={styles.selectIcon}>
                                            <FaChevronDown />
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                    {/* Catatan Adat Otomatis */}
                                    {isPredanaMeninggal && (
                                      <div className={styles.notedPredana}>
                                        <strong>Catatan Adat:</strong> Karena pihak <strong>{isGenderPredana}/Predana</strong> yang meninggal dalam status pernikahan aktif, 
                                        disarankan memilih ketetapan silsilah <strong>"Tetap di Purusa"</strong>. Menurut hukum adat Bali, swadharma dan 
                                        kedudukan silsilah pihak Predana secara mutlak tetap berada di pihak keluarga penegak garis keturunan (Purusa).
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}
                            <div className="flex flex-col space-y-1.5">
                              <label className={styles.labelInputSelect}>
                                Alasan/Keterangan Perubahan Data <span className="text-red-500">*</span>
                              </label>
                              <textarea
                                rows="2"
                                className={styles.inputText}
                                placeholder="Contoh: Perubahan kesalahan pengetikan nama pasangan pada draft verifikasi awal/menyesuaikan dokumen sah."
                                value={m.catatan_update || ""}
                                onChange={(e) => handlePerkawinanChange(index, "catatan_update", e.target.value)}
                                disabled={m.isDataLamaTerunci}
                                required={!m.isDataLamaTerunci}
                              />
                              <p className="text-[10px] text-gray-400 italic">
                                * Berikan alasan yang jelas dan valid sebagai dokumen pendukung mengapa data perkawinan adat ini diubah.
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
              {/* ACTION BUTTONS */}
              <div className={styles.buttonGroup}>
                <button type="button" onClick={() => setShowCancelModal(true)} className={styles.btnBackRed} disabled={isLoading}>
                  <FaTimes /> Batal</button>
                <button type="submit" className={styles.btnSubmit} disabled={isLoading}>
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
                    Konfirmasi Perubahan Perkawinan Adat
                  </h3>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Apakah Anda yakin data perkawinan krama utama ini sudah benar, sah, dan sesuai dengan awig-awig/pararem desa adat?
                  </p>
                  <p className={styles.noteConf}>
                    * Perubahan data utama pada perkawinan adat Purusa-Predana ini akan langsung mempengaruhi diagram pohon silsilah keluarga dan membutuhkan proses verifikasi ulang jika terdapat kesalahan input data.
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
                  <h3 className="text-lg font-bold text-black mb-1">
                    Konfirmasi Pembatalan
                  </h3>
                  <p className="text-sm text-gray-600">
                    Apakah Anda yakin ingin membatalkan proses perubahan data perkawinan ini? Semua perubahan data yang telah Anda ketik akan hilang seketika.
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

export default DataKramaEditKawin;