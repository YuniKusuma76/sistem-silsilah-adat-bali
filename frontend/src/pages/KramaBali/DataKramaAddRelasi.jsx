import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  FaUsers,
  FaUser
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBaru.module.css';

const DataKramaAddRelasi = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const { id: slugParam } = useParams();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([]);

  // STATE KRAMA UTAMA:
  const [kramaList, setKramaList] = useState([]);
  const [searchDesaUtama, setSearchDesaUtama] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // STATE PERKAWINAN:
  const [perkawinanListOptions, setPerkawinanListOptions] = useState([]);
  const [searchDesaPasangan, setSearchDesaPasangan] = useState({});
  const [openDesaDropdownIndex, setOpenDesaDropdownIndex] = useState(null);
  
  // STATE RELASI ORANG TUA & PENGANGKATAN ANAK:
  const [searchOrangTuaTerm, setSearchOrangTuaTerm] = useState("");
  // const [isDropdownOrangTuaOpen, setIsDropdownOrangTuaOpen] = useState(false);
  const [searchTermAnak, setSearchTermAnak] = useState("");
  const [isDropdownAnakOpen, setIsDropdownAnakOpen] = useState(false);
  
  // State alert notifikasi global
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
    status_hidup: "",
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
    isManual: false,
    manualAyah: { 
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
    manualIbu: { 
      nama_lengkap: "", 
      nama_panggilan: "",
      jenis_kelamin: "Perempuan",
      tanggal_lahir: "", 
      status_hidup: "Hidup",
      is_bali: true,
      desa_adat_id: "",
      tempat_asal_khusus: "",
      alamat_luar: "",
      tipe_data: "Keturunan" 
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
      status_hidup: "Hidup",
      is_bali: true,
      desa_adat_id: "",
      tempat_asal_khusus: "",
      alamat_luar: "",
      tipe_data: "Keturunan"
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

  // Helper: Decode slug url menjadi id asli
  const realId = useMemo(() => {
    if (!slugParam) return null;
    if (!slugParam.includes('-')) {
      return isNaN(slugParam) ? null : slugParam;
    }
    try {
      const parts = slugParam.split('-');
      const encodedId = parts[parts.length - 1];
      if (!encodedId) return null;
      
      const decoded = atob(encodedId);
      if (!decoded || decoded.trim() === "") return null;
      return decoded;
    } catch (error) {
      console.error("Format slug tidak valid:", error);
      return null;
    }
  }, [slugParam]);

  useEffect(() => {
    console.log("=== DIAGNOSTIK PIPELINES REALID ===");
    console.log("SlugParam terbaca dari URL (:id) ->", slugParam);
    console.log("State defaultAnakId terbaca ->", location.state?.defaultAnakId);
    console.log("Hasil akhir penyimpulan realId ->", realId);
    console.log("====================================");

    // 💡 PROTEKSI AKTIF: Jika slugParam ada tapi gagal didecode (realId bernilai null),
    // langsung tendang balik ke halaman list krama utama agar web tidak hang/crash.
    if (slugParam && realId === null) {
      setAlert({
        show: true,
        type: 'danger',
        message: 'Tautan navigasi relasi tidak valid atau telah dimodifikasi.'
      });
      
      const timeout = setTimeout(() => {
        navigate('/krama-bali', { replace: true });
      }, 2000); // beri jeda 2 detik agar user sempat membaca alert, atau bisa langsung 0 panggil navigate.
      
      return () => clearTimeout(timeout);
    }
  }, [slugParam, location.state, realId, navigate]);
  
  // Effect: Auto-Close Notifikasi Alert
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Effect: Fetching multi endpoint data master
  useEffect(() => {
    const fetchAllData = async () => {
      if (!realId) return;
      try {
        setIsLoading(true); // Nyalakan loading saat fetch data
        
        const results = await Promise.allSettled([
          axiosInstance.get(`/krama-bali/${realId}`),
          axiosInstance.get("/krama-bali?mode=public"),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
          axiosInstance.get("/perkawinan?mode=public")
        ]);

        const resKrama = results[0].status === "fulfilled" ? results[0].value.data?.data : null;
        const dataKrama = results[1].status === "fulfilled" ? results[1].value.data?.data : [];
        const dataDesa  = results[2].status === "fulfilled" ? results[2].value.data?.data : [];
        const dataKec   = results[3].status === "fulfilled" ? results[3].value.data?.data : [];
        const dataKab   = results[4].status === "fulfilled" ? results[4].value.data?.data : [];
        const dataProv  = results[5].status === "fulfilled" ? results[5].value.data?.data : [];
        const dataPerkawinan = results[6]?.status === "fulfilled" ? results[6].value.data?.data : [];

        setKramaList(dataKrama || []);
        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);
        setPerkawinanListOptions(dataPerkawinan || []);

        if (resKrama) {
          setKramaData({
            nama_lengkap: resKrama.nama_lengkap || "",
            nama_panggilan: resKrama.nama_panggilan || "",
            jenis_kelamin: resKrama.jenis_kelamin || "",
            tanggal_lahir: resKrama.tanggal_lahir ? resKrama.tanggal_lahir.substring(0, 10) : "",
            status_hidup: resKrama.status_hidup || "",
            is_bali: resKrama.is_bali ?? true,
            desa_adat_id: resKrama.desa_adat_id || "",
            tempat_asal_khusus: resKrama.tempat_asal_khusus || "",
            alamat_luar: resKrama.alamat_luar || "",
            tipe_data: resKrama.tipe_data || "Keturunan"
          });

          const activeDesa = dataDesa.find(d => String(d.id) === String(resKrama.desa_adat_id));
          if (activeDesa) {
            setSearchDesaUtama(activeDesa.nama_desa_adat);
          }
        } else {
          setAlert({ 
            show: true, 
            type: 'error', 
            message: 'Data krama tidak ditemukan.' 
          });
        }

        const failLoad = results.some(r => r.status === "rejected");
        if (failLoad) {
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
          message: 'Gagal memuat data master dari server. Periksa koneksi Anda.' 
        });
      } finally {
        // 💡 WAJIB TAMBAHKAN FINALLY: Jaminan mematikan status loading awal halaman
        setIsLoading(false); 
      }
    };
    fetchAllData();
  }, [realId]);

  // HELPER WILAYAH ADAT: Mengambil data lengkap hierarki wilayah adat
  const getWilayahLengkap = (desaId) => {
    if (!desaId) return null;
    const desa = desaList.find(d => String(d.id) === String(desaId));
    if (!desa) return null;

    const kec = desa.kecamatan_id 
      ? kecamatanList.find(k => String(k.id) === String(desa.kecamatan_id)) : null;
    const kab = kec?.kabupaten_id 
      ? kabupatenList.find(k => String(k.id) === String(kec.kabupaten_id)) : null;
    const prov = kab?.provinsi_id 
      ? provinsiList.find(p => String(p.id) === String(kab.provinsi_id)) : null;

    return {
      kecamatan: kec?.nama_kecamatan || "-",
      kabupaten: kab?.nama_kabupaten || "-",
      provinsi: prov?.nama_provinsi || "BALI"
    };
  };

  // HELPER WILAYAH ADAT GENERIC: Melakukan filter desa berdasarkan index spesifik
  const getFilteredDesaManual = (index) => {
    const term = searchDesaPasangan[index] || "";
    if (!term.trim()) return [];
    return desaList.filter((d) =>
      d.nama_desa_adat.toLowerCase().includes(term.toLowerCase())
    );
  };
  
  // HELPER RELASI ORANG TUA: Format tampilan label pencarian anak angkat
  const getOrangTuaLabel = (anak) => {
    if (!anak) return "";

    try {
      // Skenario 1: Jika objek anak yang dikirim dari baris data RelasiKrama
      if (anak.ayah || anak.ibu) {
        const namaAnak = anak.anak?.nama_lengkap || anak.nama_lengkap || "Nama Tidak Diketahui";
        const namaAyah = anak.ayah?.nama_lengkap || "Tidak Diketahui";
        const namaIbu = anak.ibu?.nama_lengkap || "Tidak Diketahui";

        if (anak.ayah && anak.ibu) return `${namaAnak} (Ortu: ${namaAyah} & ${namaIbu})`;
        if (anak.ayah) return `${namaAnak} (Ayah: ${namaAyah})`;
        if (anak.ibu) return `${namaAnak} (Ibu: ${namaIbu})`;
        return namaAnak;
      }

      // Skenario 2: Jika objek anak yang dikirim murni dari KramaBali tunggal dengan relasi orang tua
      if (Array.isArray(anak.relasi_orangtua) && anak.relasi_orangtua.length > 0) {
        const relasiTerakhir = anak.relasi_orangtua[anak.relasi_orangtua.length - 1];
        if (relasiTerakhir) {
          const namaAyah = relasiTerakhir.ayah?.nama_lengkap || "Tidak Diketahui";
          const namaIbu = relasiTerakhir.ibu?.nama_lengkap || "Tidak Diketahui";

          if (relasiTerakhir.ayah && relasiTerakhir.ibu) return `${anak.nama_lengkap || "Nama Tidak Diketahui"} (Ortu: ${namaAyah} & ${namaIbu})`;
          if (relasiTerakhir.ayah) return `${anak.nama_lengkap || "Nama Tidak Diketahui"} (Ayah: ${namaAyah})`;
          if (relasiTerakhir.ibu) return `${anak.nama_lengkap || "Nama Tidak Diketahui"} (Ibu: ${namaIbu})`;
        }
      }
    } catch (err) {
      console.error("Error formatting orang tua label:", err);
    }

    return `${anak.nama_lengkap || "Nama Tidak Diketahui"}`;
  };

  // HELPER RELASI ORANG TUA: Membuat label text kombinasi pasangan untuk dropdown pilihan orang tua
  const getPerkawinanLabel = (p) => {
    if (!p) return "";
    const namaSuami = p.suami?.nama_lengkap || "Tidak Diketahui";
    const namaIstri = p.istri?.nama_lengkap || "Tidak Diketahui";
    
    let statusDisplay = p.status_perkawinan || "Aktif";
    if (statusDisplay === "Cerai Hidup") {
      statusDisplay = "Cerai";
    }
    if (statusDisplay === "Cerai Mati") {
      statusDisplay = "Cerai Mati";
    }
    return `${namaSuami} & ${namaIstri} (${statusDisplay})`;
  };

  // HELPER RELASI ORANG TUA: Menangani perubahan input form data orang tua
  const handleParentChange = (e) => {
    const { name, value } = e.target;
    if (name === "status_diketahui" && value === "Tidak Diketahui") {
      clearParentData();
      return;
    }
    setParentData((prev) => {
      const updated = { 
        ...prev, 
        [name]: value 
      };
      // Jika memilih opsi input manual baru
      if (name === "selected_perkawinan_id" && value === "NEW_ENTRY") {
        updated.selected_perkawinan_id = null;
        updated.selected_ayah_id = null;
        updated.selected_ibu_id = null;
        updated.isManual = true;
      } 
      // Jika memilih opsi input manual baru untuk single parent
      else if (name === "selected_parent_id" && value === "NEW_ENTRY") {
        updated.selected_parent_id = null;
        updated.isManual = true;
      }
      // Jika memilih data perkawinan yang sudah terdaftar dari database
      else if (name === "selected_perkawinan_id" && value !== "NEW_ENTRY") {
        const matchPerkawinan = perkawinanListOptions.find(m => String(m.id) === String(value));
        updated.isManual = false;
        updated.selected_ayah_id = matchPerkawinan?.suami_id || null;
        updated.selected_ibu_id = matchPerkawinan?.istri_id || null;
      }
      // Jika memilih data single parent yang sudah terdaftar
      else if (name === "selected_parent_id" && value !== "NEW_ENTRY") {
        updated.isManual = false;
        updated.selected_ayah_id = value;
      }
      return updated;
    });
  };

  // HELPER RELASI ORANG TUA: Menangani input teks manual data orang tua
  const handleManualParentInput = (targetObject, fieldName, value) => {
    setParentData((prev) => ({
      ...prev,
      [targetObject]: { ...prev[targetObject], [fieldName]: value }
    }));
  };

  // HELPER PENGANGKATAN ANAK: Menangani perubahan input data pengangkatan anak
  const handleAdoptingChange = (e) => {
    const { name, value } = e.target;
    setAdoptingData((prev) => {
      if (name === "anak_angkat_id") {
        if (value === "NEW_ENTRY") {
          return {
            ...prev,
            anak_angkat_id: "",
            isAnakManual: true
          };
        } else {
          return {
            ...prev,
            anak_angkat_id: value,
            isAnakManual: false
          };
        }
      }
      return {
        ...prev, [name]: value
      };
    })
  };

  // HELPER PENGANGKATAN ANAK: Menangani input teks manual data anak angkat
  const handleManualAnakInput = (field, value) => {
    setAdoptingData((prev) => ({
      ...prev,
      manualAnak: { ...prev.manualAnak, [field]: value }
    }));
  };

  // HELPER RELASI ORANG TUA: Membersihkan input form data orang tua
  const clearParentData = () => {
    setParentData({
      status_diketahui: "Tidak Diketahui",
      status_hubungan: "Anak Kandung",
      jenis_pengangkatan: "Pasangan",
      tanggal_pengangkatan: "",
      selected_perkawinan_id: "",
      selected_ayah_id: "",
      selected_ibu_id: "",
      isManual: false,
      manualAyah: { 
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
      manualIbu: { 
        nama_lengkap: "", 
        nama_panggilan: "", 
        jenis_kelamin: "Perempuan", 
        tanggal_lahir: "", 
        status_hidup: "Hidup", 
        is_bali: true, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: "Keturunan" 
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
        status_hidup: "Hidup", 
        is_bali: true, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: "Keturunan" 
      }
    });
  };

  // HELPER PENGANGKATAN ANAK: Membersihkan input form pengangkatan anak
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
        is_bali: false, 
        desa_adat_id: "", 
        tempat_asal_khusus: "", 
        alamat_luar: "", 
        tipe_data: "Keturunan" 
      },
    });
  };

  // SUBMIT DATA 
const saveKrama = async (e) => {
  if (e && typeof e.preventDefault === 'function') {
    e.preventDefault();
  }

  const safeInt = (value) => {
    if (value === undefined || value === null || value === "") return null;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? null : parsed;
  };
  const safeString = (value) => {
    return value && String(value).trim() !== "" ? String(value).trim() : null;
  };

  // Lakukan pengecekan ID secara transparan
  const targetAnakId = safeInt(realId);
  
  // DIAGNOSTIK MANDIRI: Jika macet, Anda bisa langsung tahu penyebabnya di Console F12
  console.log("=== MEMULAI PROSES SUBMIT RELASI ===");
  console.log("Nilai slugParam saat ini:", slugParam);
  console.log("Nilai realId hasil decode:", realId);
  console.log("Nilai targetAnakId final:", targetAnakId);

  if (!targetAnakId) {
    console.warn("❌ SUBMIT DIBATALKAN: targetAnakId kosong atau tidak valid!");
    setAlert({
      show: true,
      type: 'error',
      message: 'Gagal memproses data. ID Krama utama tidak terdeteksi dari URL.'
    });
    return; // Berhenti dengan memberikan peringatan di layar
  }

  try {
    setIsLoading(true);
    let relasiBerhasilDibuat = false; // Sekarang aman di dalam blok try-catch-finally

    // ====================================================================
    // SKENARIO 1: INPUT DATA PENGANGKATAN ANAK (ADOPSI KELUAR)
    // ====================================================================
    if (adoptingData.status_pengangkatan === "Ya" || adoptingData.status_pengangkatan === "Mengangkat Anak") {
      if (adoptingData.anak_angkat_id || adoptingData.isAnakManual) {
        let finalAnakId = safeInt(adoptingData.anak_angkat_id);
        
        if (adoptingData.isAnakManual) {
          const payloadAnak = { ...adoptingData.manualAnak };
          payloadAnak.desa_adat_id = safeInt(payloadAnak.desa_adat_id);
          payloadAnak.tanggal_lahir = safeString(payloadAnak.tanggal_lahir);
          
          const resAnak = await axiosInstance.post("/krama-bali", payloadAnak);
          finalAnakId = safeInt(resAnak.data.data.id);
        }

        let payloadA = { 
          anak_id: finalAnakId, 
          status_hubungan: "Anak Angkat", 
          tanggal_pengangkatan: safeString(adoptingData.tanggal_pengangkatan_anak),
          status_verifikasi: user?.role === "Super Admin" || user?.role === "Admin Desa" ? "Disetujui" : "Draft",
          user_id: safeInt(user?.id),
        };

        const perkawinanAktifKrama = perkawinanListOptions.find(m => 
          String(m.suami_id) === String(targetAnakId) || String(m.istri_id) === String(targetAnakId)
        );

        if (perkawinanAktifKrama) {
          payloadA.perkawinan_id = safeInt(perkawinanAktifKrama.id);
          payloadA.ayah_id = safeInt(perkawinanAktifKrama.suami_id);
          payloadA.ibu_id = safeInt(perkawinanAktifKrama.istri_id);
        } else { 
          payloadA.perkawinan_id = null;
          if (kramaData.jenis_kelamin === "Laki-laki") {
            payloadA.ayah_id = targetAnakId;
            payloadA.ibu_id = null;
          } else {
            payloadA.ibu_id = targetAnakId;
            payloadA.ayah_id = null;
          }
        }

        console.log("Mengirim Payload Adopsi Baru:", payloadA);
        await axiosInstance.post("/relasi-krama", payloadA);
        relasiBerhasilDibuat = true;
      }
    } 
    // ====================================================================
    // SKENARIO 2: INPUT DATA ORANG TUA KANDUNG / ANGKAT (INTERNAL)
    // ====================================================================
    else if (parentData.status_diketahui === "Diketahui") {
      let finalPerkawinanId = safeInt(parentData.selected_perkawinan_id);
      let finalSingleParentId = safeInt(parentData.selected_ayah_id || parentData.selected_ibu_id);
      let ayahId = safeInt(parentData.selected_ayah_id);
      let ibuId = safeInt(parentData.selected_ibu_id);

      if (parentData.isManual) {
        if (
          parentData.status_hubungan === "Anak Kandung" || 
          (parentData.status_hubungan === "Anak Angkat" && parentData.jenis_pengangkatan === "Pasangan")
        ) {
          if (!ayahId) {
            const payloadAyah = { ...parentData.manualAyah };
            payloadAyah.desa_adat_id = safeInt(payloadAyah.desa_adat_id);
            payloadAyah.tanggal_lahir = safeString(payloadAyah.tanggal_lahir);

            const resAyah = await axiosInstance.post("/krama-bali", { 
              ...payloadAyah, 
              jenis_kelamin: "Laki-laki" 
            });
            ayahId = safeInt(resAyah.data.data.id);
          }

          if (!ibuId) {
            const payloadIbu = { ...parentData.manualIbu };
            payloadIbu.desa_adat_id = safeInt(payloadIbu.desa_adat_id);
            payloadIbu.tanggal_lahir = safeString(payloadIbu.tanggal_lahir);

            const resIbu = await axiosInstance.post("/krama-bali", { 
              ...payloadIbu, 
              jenis_kelamin: "Perempuan"
            });
            ibuId = safeInt(resIbu.data.data.id);
          }

          if (!finalPerkawinanId) {
            const resKawin = await axiosInstance.post("/perkawinan/kawin", {
              suami_id: ayahId,
              istri_id: ibuId,
              status_perkawinan: "Kawin",
              jenis_perkawinan: parentData.manualPerkawinan.jenis_perkawinan || "Biasa",
              tanggal_perkawinan: safeString(parentData.manualPerkawinan.tanggal_perkawinan),
              data_perubahan: null
            });

            const dataPerkawinanSistem = resKawin.data.data?.perkawinan || resKawin.data.data;
            finalPerkawinanId = safeInt(dataPerkawinanSistem?.id);

            if (finalPerkawinanId && parentData.manualPerkawinan.status_perkawinan) {
              const statusMentah = String(parentData.manualPerkawinan.status_perkawinan).trim().toLowerCase();

              if (statusMentah.includes("cerai")) {
                const userRole = user?.role || "Krama";
                const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
                const jenisMutasiFinal = statusMentah.includes("mati") ? "Cerai Mati" : "Cerai Hidup";
                const tglCeraiFinal = safeString(parentData.manualPerkawinan.tanggal_cerai) || safeString(parentData.manualPerkawinan.tanggal_perkawinan);
                
                let pihakMeninggalFinal = null;
                if (statusMentah.includes("mati")) {
                  pihakMeninggalFinal = (parentData.manualPerkawinan.pihak_meninggal || "Pasangan") === "Pasangan" ? "Istri" : "Suami";
                }

                let pilihanPredanaFinal = (
                  parentData.manualPerkawinan.pilihan_predana === "Tetap" || 
                  parentData.manualPerkawinan.pilihan_predana === "Tetap di Tempat"
                ) ? "Tetap" : "Kembali ke Asal";
                
                const payloadDrafPerceraian = {
                  PERCERAIAN: {
                    jenis_mutasi: jenisMutasiFinal,
                    status_perkawinan: jenisMutasiFinal,
                    tanggal_cerai: tglCeraiFinal,
                    pihak_meninggal: pihakMeninggalFinal,
                    pilihan_predana: pilihanPredanaFinal,
                    is_auto_draft: true
                  }
                };

                let payloadUpdateUtama = {
                  status_perkawinan: jenisMutasiFinal,
                  tanggal_cerai: tglCeraiFinal,
                  is_pending_update: !isAdmin, 
                  data_perubahan: payloadDrafPerceraian
                };

                if (statusMentah.includes("mati")) {
                  payloadUpdateUtama.pihak_meninggal = pihakMeninggalFinal;
                  payloadUpdateUtama.pilihan_predana = pilihanPredanaFinal;
                }

                await axiosInstance.put(`/perkawinan/cerai/${finalPerkawinanId}`, payloadUpdateUtama);

                if (!isAdmin) {
                  await new Promise(resolve => setTimeout(resolve, 250));
                  await axiosInstance.patch(`/perkawinan/cerai/verifikasi/${finalPerkawinanId}`, {
                    perkawinan_id: finalPerkawinanId,
                    status_verifikasi: "Draft",
                    target_sisi: "super_admin",
                    status_verifikasi_perceraian: `Diajukan otomatis via form simultan oleh ${userRole}`,
                    user_role: userRole,
                    nama_desa_operator: user?.nama_desa || "Admin Desa Setempat"
                  });
                }
              }
            }
          }
        } else {
          if (!finalSingleParentId) {
            const payloadSingle = { ...parentData.manualSingle };
            payloadSingle.desa_adat_id = safeInt(payloadSingle.desa_adat_id);
            payloadSingle.tanggal_lahir = safeString(payloadSingle.tanggal_lahir);

            const resSingle = await axiosInstance.post("/krama-bali", payloadSingle);
            finalSingleParentId = safeInt(resSingle.data.data.id);
          }
        }
      }

      let payloadR = { 
        anak_id: targetAnakId, // Menggunakan variabel terproteksi hasil safeInt
        status_hubungan: parentData.status_hubungan || "Anak Kandung", 
        tanggal_pengangkatan: parentData.status_hubungan === "Anak Angkat" ? safeString(parentData.tanggal_pengangkatan) : null,
        perkawinan_id: finalPerkawinanId,
        status_verifikasi: "Disetujui",
        user_id: safeInt(user?.id)
      };

      if (parentData.status_hubungan !== "Anak Kandung" && parentData.jenis_pengangkatan !== "Pasangan") { 
        let genderParent = "";
        if (parentData.isManual && !parentData.selected_ayah_id && !parentData.selected_ibu_id) {
          genderParent = parentData.manualSingle?.jenis_kelamin;
        } else {
          const pk = kramaList?.find(k => safeInt(k.id) === finalSingleParentId);
          if (pk) genderParent = pk.jenis_kelamin;
        }

        if (genderParent === "Laki-laki") {
          payloadR.ayah_id = finalSingleParentId;
          payloadR.ibu_id = null;
        } else {
          payloadR.ibu_id = finalSingleParentId;
          payloadR.ayah_id = null;
        }
        payloadR.perkawinan_id = null; 
      } else {
        payloadR.ayah_id = ayahId;
        payloadR.ibu_id = ibuId;
      }

      console.log("Mengirim Payload Relasi Baru:", payloadR);
      await axiosInstance.post("/relasi-krama", payloadR);
      relasiBerhasilDibuat = true;
    }

    if (relasiBerhasilDibuat) {
      // Navigasi balik ke detail krama asal setelah sukses mendaftar
      navigate(`/krama-bali/detail/${slugParam}`, { 
        state: { successMessage: 'Relasi silsilah keluarga baru berhasil didaftarkan!' } 
      });
    } else {
      // 💡 JIKA USER KLIK SIMPAN SAAT FORM MASIH KOSONG / BELUM MEMILIH OPSI OLEH USER
      setIsLoading(false);
      setAlert({
        show: true,
        type: 'warning',
        message: 'Silakan pilih status hubungan orang tua atau data pengangkatan anak terlebih dahulu sebelum menyimpan.'
      });
    }

  } catch (error) {
    console.error("=== SYSTEM ERROR CAUGHT ===", error.response?.data || error);
    setAlert({ 
      show: true, 
      type: 'error', 
      message: error.response?.data?.message || 'Gagal mendaftarkan relasi. Terjadi kesalahan pada server.' 
    });
    window.scrollTo(0,0);
  } finally { 
    setIsLoading(false); // Paksa matikan status loading dalam kondisi apapun
  }
};
  
  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Menambahkan Data Relasi Orang Tua
          </h2>
          <p className={styles.navSubtitle}>
            Lengkapi formulir data relasi orang tua dengan data yang sebenarnya dan sah
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
      {/* Alert Action */}
      {alert.show && (
        <div className={`alert-container
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
          <form onSubmit={(e) => e.preventDefault()} className="w-full space-y-8" noValidate>
            {/* BAGIAN 1: DATA KRAMA BALI*/}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                I. Data Diri Krama Bali
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
                      disabled
                    >
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
                    disabled
                  />
                </div>
                {/* Nama Panggilan */}
                <div className="flex flex-col space-y-1">
                  <label className={styles.labelInput}>
                    Nama Panggilan {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                  </label>
                  <input 
                    type="text" 
                    name="nama_panggilan" 
                    value={kramaData.nama_panggilan} 
                    className={styles.inputText}
                    disabled
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
                        disabled
                      >
                        <option value="">- Pilih -</option>
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
                      Tanggal Lahir {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                    </label>
                    <input 
                      type="date" 
                      name="tanggal_lahir" 
                      value={kramaData.tanggal_lahir} 
                      className={styles.inputCalendar} 
                      disabled
                    />
                  </div>
                </div>
                <div className={styles.dualInput}>
                  {/* Status Hidup */}
                  <div className="flex flex-col space-y-1.5">
                    <label className={styles.labelInput}>
                      Status Hidup {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                    </label>
                    <div className="relative">
                      <select 
                        name="status_hidup" 
                        value={kramaData.status_hidup} 
                        className={styles.inputSelect} 
                        disabled
                      >
                        <option value="">- Pilih -</option>
                        <option value="Hidup">Hidup</option>
                        <option value="Meninggal">Meninggal</option>
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
                        disabled
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
                            value={searchDesaUtama || "Tidak Terikat Desa Adat"}
                            disabled
                          />
                          <div className={styles.termsIcon}>
                            <FaChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col space-y-1.5">
                        <label className={styles.labelInput}>
                          Tempat Asal Khusus
                        </label>
                        <input 
                          name="tempat_asal_khusus" 
                          value={kramaData.tempat_asal_khusus || ""} 
                          className={styles.inputText} 
                          placeholder="Contoh: Puri Agung Bangli"
                          disabled 
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
                        value={kramaData.alamat_luar || ""} 
                        className={styles.inputText} 
                        placeholder="Jl. Raya No. 1/Unit 3, 100 George Street Sydney..."
                        disabled
                      />
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
                {/* Keterangan Orang Tua */}
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
                        required
                      >
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
                {/* Form Input Orang Tua */}
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
                            className={styles.inputPilihan}
                          >
                            <option value="Anak Kandung">Anak Kandung</option>
                            <option value="Anak Angkat">Anak Angkat</option>
                          </select>
                          <div className={styles.selectIcon}>
                            <FaChevronDown />
                          </div>
                        </div>
                      </div>
                      {/* Jenis Pengangkatan */}
                      {parentData.status_hubungan === "Anak Angkat" && (
                        <div className="flex flex-col space-y-1.5 animate-fade-in">
                          <label className={styles.labelInputSelect}>
                            Jenis Pengangkatan <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <select
                              name="jenis_pengangkatan"
                              value={parentData.jenis_pengangkatan}
                              onChange={handleParentChange}
                              className={styles.inputPilihan}
                              required={parentData.status_diketahui === "Diketahui" && parentData.status_hubungan === "Anak Angkat"}
                            >
                              <option value="Pasangan">Pasangan Suami Istri</option>
                              <option value="Tunggal">Orang Tua Tunggal</option>
                            </select>
                            <div className={styles.selectIcon}>
                              <FaChevronDown size={12} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    {/* Nama Orang Tua */}
                    <div className="flex flex-col space-y-4">
                      {(parentData.status_hubungan === "Anak Kandung" || 
                        (parentData.status_hubungan === "Anak Angkat" && parentData.jenis_pengangkatan === "Pasangan")) 
                      ? (
                        <>
                          {/* Pasangan Suami-Istri */}
                          <div className="flex flex-col space-y-1.5">
                            <label className={styles.labelInputSelect}>
                              Nama Orang Tua <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                className={styles.inputText}
                                placeholder="Ketikkan nama ayah atau ibu..."
                                value={isDropdownOpen ? searchOrangTuaTerm 
                                  : parentData.isManual ? "Data Orang Tua Baru" 
                                  : perkawinanListOptions.find(m => String(m.id) === String(parentData.selected_perkawinan_id))
                                  ? getPerkawinanLabel(perkawinanListOptions.find(m => String(m.id) === String(parentData.selected_perkawinan_id)))
                                  : searchOrangTuaTerm
                                }
                                onChange={(e) => {
                                  setSearchOrangTuaTerm(e.target.value);
                                  setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                required={parentData.status_diketahui === "Diketahui" && !parentData.isManual}
                              />
                              <div className={styles.termsIcon}>
                                <FaChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                              </div>
                              {/* Dropdown Hasil Pencarian */}
                              {isDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                  <div className={styles.dropdownResult}>
                                    <div
                                      className={styles.listHasilTerms}
                                      onClick={() => {
                                        handleParentChange({ target: { name: "selected_perkawinan_id", value: "NEW_ENTRY" } });
                                        setIsDropdownOpen(false);
                                        setSearchOrangTuaTerm("");
                                      }}
                                    >
                                      <span className="font-bold text-blue-600">
                                        + Input Orang Tua Baru
                                      </span>
                                    </div>
                                    {/* Filter List Perkawinan */}
                                    {perkawinanListOptions
                                      .filter(m => getPerkawinanLabel(m).toLowerCase().includes(searchOrangTuaTerm.toLowerCase()))
                                      .map((m) => (
                                        <div
                                          key={m.id}
                                          className={styles.filterHasilTerms}
                                          onClick={() => {
                                            handleParentChange({ target: { name: "selected_perkawinan_id", value: m.id } });
                                            setIsDropdownOpen(false);
                                            setSearchOrangTuaTerm("");
                                          }}
                                        >
                                          <p className="font-bold text-gray-800">
                                            {getPerkawinanLabel(m)}
                                          </p>
                                          <p className="text-[10px] text-gray-500 uppercase italic">
                                            Data Terdaftar
                                          </p>
                                        </div>
                                      ))
                                    }
                                    {perkawinanListOptions.filter(m => getPerkawinanLabel(m).toLowerCase().includes(searchOrangTuaTerm.toLowerCase())).length === 0 && (
                                      <div className="px-4 py-3 text-sm text-gray-500 italic">
                                        Data perkawinan tidak ditemukan.
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                          {/* Input Data Orang Tua dan Perkawinan */}
                          {parentData.isManual && (
                            <div className="mt-6 space-y-6 animate-fade-in">
                              {/* A. FORM DATA AYAH */}
                              <div className={styles.cardInfoBiru}>
                                <h4 className={styles.titleCardBiru}>
                                  <FaInfoCircle/> Informasi Ayah Baru
                                </h4>
                                <div className="space-y-5 mt-3">
                                  {/* Tipe Data */}
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
                                        required={parentData.isManual}
                                      >
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
                                      value={parentData.manualAyah.nama_lengkap} 
                                      onChange={(e) => handleManualParentInput("manualAyah", "nama_lengkap", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: I Wayan Sudarsana" 
                                      required={parentData.isManual} 
                                    />
                                  </div>
                                  {/* Nama Panggilan */}
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Panggilan {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                    </label>
                                    <input 
                                      type="text" 
                                      value={parentData.manualAyah.nama_panggilan} 
                                      onChange={(e) => handleManualParentInput("manualAyah", "nama_panggilan", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Sudarsana" 
                                      required={parentData.isManual && parentData.manualAyah.tipe_data !== "Leluhur"}
                                    />
                                  </div>
                                  <div className={styles.dualInput}>
                                    {/* Jenis Kelamin */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Jenis Kelamin <span className="text-red-500">*</span>
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualAyah.jenis_kelamin} 
                                          onChange={(e) => handleManualParentInput("manualAyah", "jenis_kelamin", e.target.value)} 
                                          className={styles.inputSelect} 
                                          required={parentData.isManual}
                                        >
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
                                        Tanggal Lahir {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <input 
                                        type="date" 
                                        value={parentData.manualAyah.tanggal_lahir} 
                                        onChange={(e) => handleManualParentInput("manualAyah", "tanggal_lahir", e.target.value)} 
                                        className={styles.inputText} 
                                        required={parentData.isManual && parentData.manualAyah.tipe_data !== "Leluhur"}
                                      />
                                    </div>
                                  </div>
                                  <div className={styles.dualInput}>
                                    {/* Status Hidup */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Status Hidup {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualAyah.status_hidup} 
                                          onChange={(e) => handleManualParentInput("manualAyah", "status_hidup", e.target.value)} 
                                          className={styles.inputSelect} 
                                          required={parentData.isManual && parentData.manualAyah.tipe_data !== "Leluhur"}
                                        >
                                          <option value="Hidup">Hidup</option>
                                          <option value="Meninggal">Meninggal</option>
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
                                          onChange={(e) => handleManualParentInput("manualAyah", "is_bali", e.target.checked)} 
                                          id="is_bali_ayah_manual" 
                                          className={styles.checkboxInput} 
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
                                          />
                                          <div className={styles.termsIcon}>
                                            <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualAyah" ? 'rotate-180' : ''}`} />
                                          </div>
                                          {/* Dropdown Hasil Pencarian Desa Pangan*/}
                                          {openDesaDropdownIndex === "manualAyah" && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                              <div className={styles.dropdownResult}>
                                                {getFilteredDesaManual("manualAyah").length > 0 ? (
                                                  getFilteredDesaManual("manualAyah").map((d) => (
                                                    <div 
                                                      key={d.id} 
                                                      className={styles.dropdownItems} 
                                                      onClick={() => {
                                                        handleManualParentInput("manualAyah", "desa_adat_id", d.id); 
                                                        setSearchDesaPasangan({ ...searchDesaPasangan, manualAyah: d.nama_desa_adat }); 
                                                        setOpenDesaDropdownIndex(null); 
                                                      }}
                                                    >
                                                      <p className="text-sm font-bold text-gray-800">
                                                        {d.nama_desa_adat}
                                                      </p>
                                                      {/* Menampilkan Informasi Wilayah Adat */}
                                                      {(() => {
                                                        const wil = getWilayahLengkap(d.id);
                                                        return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                      })()}
                                                    </div>
                                                  ))
                                                ) : (
                                                  <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                    Desa adat tidak ditemukan.
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {/* Info Detail Wilayah Adat Pasangan */}
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
                                  {/* Tipe Data */}
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
                                        required={parentData.isManual}
                                      >
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
                                      value={parentData.manualIbu.nama_lengkap} 
                                      onChange={(e) => handleManualParentInput("manualIbu", "nama_lengkap", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Ni Made Sri Utami" 
                                      required={parentData.isManual} 
                                    />
                                  </div>
                                  {/* Nama Panggilan */}
                                  <div className="flex flex-col space-y-1">
                                    <label className={styles.labelInput}>
                                      Nama Panggilan {parentData.manualIbu.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                    </label>
                                    <input 
                                      type="text" 
                                      value={parentData.manualIbu.nama_panggilan} 
                                      onChange={(e) => handleManualParentInput("manualIbu", "nama_panggilan", e.target.value)} 
                                      className={styles.inputText}
                                      placeholder="Contoh: Sri Utami" 
                                      required={parentData.isManual && parentData.manualIbu.tipe_data !== "Leluhur"}
                                    />
                                  </div>
                                  <div className={styles.dualInput}>
                                    {/* Jenis Kelamin */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Jenis Kelamin <span className="text-red-500">*</span>
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualIbu.jenis_kelamin} 
                                          onChange={(e) => handleManualParentInput("manualIbu", "jenis_kelamin", e.target.value)} 
                                          className={styles.inputSelect} 
                                          required={parentData.isManual}
                                        >
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
                                        Tanggal Lahir {parentData.manualIbu.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <input 
                                        type="date" 
                                        value={parentData.manualIbu.tanggal_lahir} 
                                        onChange={(e) => handleManualParentInput("manualIbu", "tanggal_lahir", e.target.value)} 
                                        className={styles.inputText} 
                                        required={parentData.isManual && parentData.manualIbu.tipe_data !== "Leluhur"}
                                      />
                                    </div>
                                  </div>
                                  <div className={styles.dualInput}>
                                    {/* Status Hidup */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInput}>
                                        Status Hidup {parentData.manualIbu.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <div className="relative">
                                        <select 
                                          value={parentData.manualIbu.status_hidup} 
                                          onChange={(e) => handleManualParentInput("manualIbu", "status_hidup", e.target.value)} 
                                          className={styles.inputSelect} 
                                          required={parentData.isManual && parentData.manualIbu.tipe_data !== "Leluhur"}
                                        >
                                          <option value="Hidup">Hidup</option>
                                          <option value="Meninggal">Meninggal</option>
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
                                          onChange={(e) => handleManualParentInput("manualIbu", "is_bali", e.target.checked)} 
                                          id="is_bali_ibu_manual" 
                                          className={styles.checkboxInput} 
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
                                          />
                                          <div className={styles.termsIcon}>
                                            <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualIbu" ? 'rotate-180' : ''}`} />
                                          </div>
                                          {/* Dropdown Hasil Pencarian Desa Pangan*/}
                                          {openDesaDropdownIndex === "manualIbu" && (
                                            <>
                                              <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                              <div className={styles.dropdownResult}>
                                                {getFilteredDesaManual("manualIbu").length > 0 ? (
                                                  getFilteredDesaManual("manualIbu").map((d) => (
                                                    <div 
                                                      key={d.id} 
                                                      className={styles.dropdownItems} 
                                                      onClick={() => {
                                                        handleManualParentInput("manualIbu", "desa_adat_id", d.id); 
                                                        setSearchDesaPasangan({ ...searchDesaPasangan, manualIbu: d.nama_desa_adat }); 
                                                        setOpenDesaDropdownIndex(null); 
                                                      }}
                                                    >
                                                      <p className="text-sm font-bold text-gray-800">
                                                        {d.nama_desa_adat}
                                                      </p>
                                                      {/* Menampilkan Informasi Wilayah Adat */}
                                                      {(() => {
                                                        const wil = getWilayahLengkap(d.id);
                                                        return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                      })()}
                                                    </div>
                                                  ))
                                                ) : (
                                                  <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                    Desa adat tidak ditemukan.
                                                  </div>
                                                )}
                                              </div>
                                            </>
                                          )}
                                        </div>
                                      </div>
                                      {/* Info Detail Wilayah Adat Pasangan */}
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
                                  {/* Status Perkawinan */}
                                  <div className="flex flex-col space-y-1.5">
                                    <label className={styles.labelInputSelect}>
                                      Status Perkawinan <span className="text-red-500">*</span>
                                    </label>
                                    <div className="relative">
                                      <select
                                        value={parentData.manualPerkawinan.status_perkawinan}
                                        onChange={(e) => handleManualParentInput("manualPerkawinan", "status_perkawinan", e.target.value)}
                                        className={styles.inputPilihan} 
                                        required
                                      >
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
                                    {/* Jenis Perkawinan */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInputSelect}>
                                        Jenis Perkawinan <span className="text-red-500">*</span>
                                      </label>
                                      <div className="relative">
                                        <select
                                          value={parentData.manualPerkawinan.jenis_perkawinan || "Biasa"}
                                          onChange={(e) => handleManualParentInput("manualPerkawinan", "jenis_perkawinan", e.target.value)}
                                          className={styles.inputPilihan}
                                          required
                                        >
                                          <option value="Biasa">Biasa</option>
                                          <option value="Nyentana">Nyentana</option>
                                          <option value="Pade Gelahang">Pade Gelahang</option>
                                        </select>
                                        <div className={styles.selectIcon}>
                                          <FaChevronDown />
                                        </div>
                                      </div>
                                    </div>
                                    {/* Tanggal Perkawinan */}
                                    <div className="flex flex-col space-y-1.5">
                                      <label className={styles.labelInputSelect}>
                                        Tanggal Perkawinan {parentData.manualAyah.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                      </label>
                                      <input
                                        type="date"
                                        value={parentData.manualPerkawinan.tanggal_perkawinan || ""}
                                        onChange={(e) => handleManualParentInput("manualPerkawinan", "tanggal_perkawinan", e.target.value)}
                                        className={styles.inputCalendar}
                                        required={parentData.manualAyah.tipe_data !== "Leluhur"}
                                      />
                                    </div>
                                  </div>
                                  {(parentData.manualPerkawinan.status_perkawinan === "Cerai" ||
                                    parentData.manualPerkawinan.status_perkawinan === "Cerai Mati") && (
                                    <div className={`${styles.popupInput} animate-fade-in`}>
                                      {/* Tanggal Cerai */}
                                      <div className="flex flex-col space-y-1.5">
                                        <label className={styles.labelInputSelect}>
                                          {parentData.manualPerkawinan.status_perkawinan === "Cerai" ? "Tanggal Perceraian" : "Tanggal Kematian/Wafat"} <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                          type="date"
                                          value={parentData.manualPerkawinan.tanggal_cerai || ""}
                                          onChange={(e) => handleManualParentInput("manualPerkawinan", "tanggal_cerai", e.target.value)}
                                          className={styles.inputCalendar}
                                          required
                                        />
                                      </div>
                                      {parentData.manualPerkawinan.status_perkawinan === "Cerai Mati" && (
                                        <div className="space-y-5 mt-3">
                                          <div className={styles.dualColumn}>
                                            {/* Pihak Meninggal */}
                                            <div className="flex flex-col space-y-1.5">
                                              <label className={styles.labelInputSelect}>
                                                Pihak Meninggal <span className="text-red-500">*</span>
                                              </label>
                                              <div className="relative">
                                                <select
                                                  value={parentData.manualPerkawinan.pihak_meninggal || "Pasangan"}
                                                  onChange={(e) => handleManualParentInput("manualPerkawinan", "pihak_meninggal", e.target.value)}
                                                  className={styles.inputPilihan}
                                                  required
                                                >
                                                  <option value="Pasangan">Ibu</option>
                                                  <option value="Krama Utama">Ayah</option>
                                                </select>
                                                <div className={styles.selectIcon}>
                                                  <FaChevronDown />
                                                </div>
                                              </div>
                                            </div>
                                            {/* Keputusan Predana */}
                                            <div className="flex flex-col space-y-1.5">
                                              <label className={styles.labelInputSelect}>
                                                Ketetapan Silsilah Predana <span className="text-red-500">*</span>
                                              </label>
                                              <div className="relative">
                                                <select
                                                  value={parentData.manualPerkawinan.pilihan_predana || ""}
                                                  onChange={(e) => handleManualParentInput("manualPerkawinan", "pilihan_predana", e.target.value)}
                                                  className={styles.inputPilihan}
                                                  required
                                                >
                                                  <option value="Tetap">Tetap di Purusa</option>
                                                  <option value="Kembali ke Asal">Kembali ke Asal</option>
                                                </select>
                                                <div className={styles.selectIcon}>
                                                  <FaChevronDown />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                          {parentData.manualPerkawinan.pihak_meninggal === "Pasangan" && (
                                            <div className={styles.notedPredana}>
                                              <strong>Catatan Adat:</strong> Karena pihak Perempuan (Ibu/Predana) yang meninggal dalam status pernikahan aktif, 
                                              disarankan memilih ketetapan silsilah <strong>"Tetap di Purusa"</strong>. Menurut hukum adat, swadharma dan 
                                              kedudukan silsilah pihak Perempuan (Ibu/Predana) secara mutlak tetap berada di pihak keluarga suami (Ayah/Purusa).
                                            </div>
                                            )}
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
                          {/* Orang Tua Tunggal */}
                          <div className="flex flex-col space-y-1.5 relative">
                            <label className={styles.labelInputSelect}>
                              Nama Orang Tua <span className="text-red-500">*</span>
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                className={styles.inputText}
                                placeholder="Ketikkan nama orang tua ..."
                                value={isDropdownOpen ? searchOrangTuaTerm 
                                  : parentData.isManual ? "Data Orang Tua Baru"
                                  : (kramaList.find(k => String(k.id) === String(parentData.selected_parent_id))?.nama_lengkap || (parentData.isManual ? "" : ""))
                                }
                                onChange={(e) => {
                                  setSearchOrangTuaTerm(e.target.value);
                                  setIsDropdownOpen(true);
                                }}
                                onFocus={() => setIsDropdownOpen(true)}
                                required={parentData.status_diketahui === "Diketahui" && !parentData.isManual}
                              />
                              <div className={styles.termsIcon}>
                                <FaChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                              </div>
                              {/* Hasil Pencarian Orang Tua Tunggal */}
                              {isDropdownOpen && (
                                <>
                                  <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                  <div className={`${styles.dropdownResult}`}>
                                    <div
                                      className={styles.listHasilTerms}
                                      onClick={() => {
                                        handleParentChange({ target: { name: "selected_parent_id", value: "NEW_ENTRY" } });
                                        setIsDropdownOpen(false);
                                        setSearchOrangTuaTerm("");
                                      }}
                                    >
                                      <span className="font-bold text-blue-600">
                                        + Input Orang Tua Baru
                                      </span>
                                    </div>
                                    {/* Filter List Krama */}
                                    {kramaList
                                      .filter(k => k.nama_lengkap.toLowerCase().includes(searchOrangTuaTerm.toLowerCase()))
                                      .slice(0, 10).map((k) => {
                                        const namaDesaKrama = desaList.find(d => String(d.id) === String(k.desa_adat_id))?.nama_desa_adat || k.tempat_asal_khusus || "Luar Bali";
                                        return (
                                          <div
                                            key={k.id}
                                            className={styles.filterHasilTerms}
                                            onClick={() => {
                                              handleParentChange({ target: { name: "selected_parent_id", value: k.id } });
                                              setIsDropdownOpen(false);
                                              setSearchOrangTuaTerm("");
                                            }}
                                          >
                                            <p className="font-bold text-gray-800">
                                              {k.nama_lengkap}
                                            </p>
                                            <p className="text-[10px] text-gray-500 uppercase italic">
                                              {k.jenis_kelamin} • {namaDesaKrama}
                                            </p>
                                          </div>
                                        );
                                      })
                                    }
                                    {kramaList.filter(k => k.nama_lengkap.toLowerCase().includes(searchOrangTuaTerm.toLowerCase())).length === 0 && (
                                      <div className="px-4 py-3 text-sm text-gray-500 italic">
                                        Nama krama tidak ditemukan.
                                      </div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                            {!isDropdownOpen && parentData.selected_parent_id && !parentData.isManual && (
                              (() => {
                                const currentSingleId = parentData.selected_ayah_id || parentData.selected_ibu_id;
                                const kramaTerpilih = kramaList.find(k => String(k.id) === String(currentSingleId));
                                if (!kramaTerpilih || !kramaTerpilih.desa_adat_id) {
                                  return null;
                                }
                                const w = getWilayahLengkap(kramaTerpilih.desa_adat_id);
                                const namaDesa = desaList.find(d => String(d.id) === String(kramaTerpilih.desa_adat_id))?.nama_desa_adat;
                                return (
                                  <div className={`${styles.asalSingleParent} animate-fade-in`}>
                                    {kramaTerpilih?.desa_adat_id ? (
                                      /* SKENARIO A: JIKA KRAMA ASAL BALI */
                                      <>
                                        <p className="text-gray-700 font-semibold">
                                          Wilayah Asal Orang Tua:  <span className="text-amber-900 font-bold">{namaDesa || "Tidak Diketahui"}</span>
                                        </p>
                                        {w && (
                                          <p className="text-gray-500 text-[11px]">
                                            Kecamatan {w.kecamatan}, Kabupaten {w.kabupaten}, Provinsi {w.provinsi}
                                          </p>
                                        )}
                                      </>
                                    ) : (
                                      /* SKENARIO B: JIKA KRAMA ASAL LUAR BALI */
                                      <>
                                        <p className="text-gray-700 font-semibold">
                                          Wilayah Asal Orang Tua:  <span className="text-blue-700 font-bold">Luar Bali</span>
                                        </p>
                                        <p className={styles.alamatLuarParent}>
                                          <span className={styles.fontAlamatLuar}>Alamat Lengkap:</span>
                                          {kramaTerpilih?.alamat_luar || "Tidak Diketahui"}
                                        </p>
                                      </>
                                    )}
                                  </div>
                                );
                              })()
                            )}
                          </div>
                          {/* Input Data Orang Tua Tunggal */}
                          {parentData.isManual && (
                          <div className={`${styles.cardInfoGray} animate-fade-in shadow-inner`}>
                            <h4 className={styles.titleCardBiru}>
                              <FaInfoCircle/> Informasi Orang Tua Baru
                            </h4>
                            <div className="space-y-5 mt-3">
                              {/* Tipe Data */}
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
                                    required={parentData.isManual}
                                  >
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
                                  value={parentData.manualSingle.nama_lengkap} 
                                  onChange={(e) => handleManualParentInput("manualSingle", "nama_lengkap", e.target.value)} 
                                  className={styles.inputText}
                                  placeholder="Contoh: Ni Made Sri Utami" 
                                  required={parentData.isManual} 
                                />
                              </div>
                              {/* Nama Panggilan */}
                              <div className="flex flex-col space-y-1">
                                <label className={styles.labelInput}>
                                  Nama Panggilan {parentData.manualSingle.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                  type="text" 
                                  value={parentData.manualSingle.nama_panggilan} 
                                  onChange={(e) => handleManualParentInput("manualSingle", "nama_panggilan", e.target.value)} 
                                  className={styles.inputText}
                                  placeholder="Contoh: Sri Utami" 
                                  required={parentData.isManual && parentData.manualSingle.tipe_data !== "Leluhur"}
                                />
                              </div>
                              <div className={styles.dualInput}>
                                {/* Jenis Kelamin */}
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Jenis Kelamin <span className="text-red-500">*</span>
                                  </label>
                                  <div className="relative">
                                    <select 
                                      value={parentData.manualSingle.jenis_kelamin} 
                                      onChange={(e) => handleManualParentInput("manualSingle", "jenis_kelamin", e.target.value)} 
                                      className={styles.inputSelect} 
                                      required={parentData.isManual}
                                    >
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
                                    Tanggal Lahir {parentData.manualSingle.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                  </label>
                                  <input 
                                    type="date" 
                                    value={parentData.manualSingle.tanggal_lahir} 
                                    onChange={(e) => handleManualParentInput("manualSingle", "tanggal_lahir", e.target.value)} 
                                    className={styles.inputText} 
                                    required={parentData.isManual && parentData.manualSingle.tipe_data !== "Leluhur"}
                                  />
                                </div>
                              </div>
                              <div className={styles.dualInput}>
                                {/* Status Hidup */}
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Status Hidup {parentData.manualSingle.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                  </label>
                                  <div className="relative">
                                    <select 
                                      value={parentData.manualSingle.status_hidup} 
                                      onChange={(e) => handleManualParentInput("manualSingle", "status_hidup", e.target.value)} 
                                      className={styles.inputSelect} 
                                      required={parentData.isManual && parentData.manualSingle.tipe_data !== "Leluhur"}
                                    >
                                      <option value="Hidup">Hidup</option>
                                      <option value="Meninggal">Meninggal</option>
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
                                      onChange={(e) => handleManualParentInput("manualSingle", "is_bali", e.target.checked)} 
                                      id="is_bali_parent_manual" 
                                      className={styles.checkboxInput} 
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
                                      />
                                      <div className={styles.termsIcon}>
                                        <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualSingle" ? 'rotate-180' : ''}`} />
                                      </div>
                                      {/* Dropdown Hasil Pencarian Desa Pangan*/}
                                      {openDesaDropdownIndex === "manualSingle" && (
                                        <>
                                          <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                          <div className={styles.dropdownResult}>
                                            {getFilteredDesaManual("manualSingle").length > 0 ? (
                                              getFilteredDesaManual("manualSingle").map((d) => (
                                                <div 
                                                  key={d.id} 
                                                  className={styles.dropdownItems} 
                                                  onClick={() => {
                                                    handleManualParentInput("manualSingle", "desa_adat_id", d.id); 
                                                    setSearchDesaPasangan({ ...searchDesaPasangan, manualSingle: d.nama_desa_adat }); 
                                                    setOpenDesaDropdownIndex(null); 
                                                  }}
                                                >
                                                  <p className="text-sm font-bold text-gray-800">
                                                    {d.nama_desa_adat}
                                                  </p>
                                                  {/* Menampilkan Informasi Wilayah Adat */}
                                                  {(() => {
                                                    const wil = getWilayahLengkap(d.id);
                                                    return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                                  })()}
                                                </div>
                                              ))
                                            ) : (
                                              <div className="px-4 py-3 text-sm text-gray-500 italic">
                                                Desa adat tidak ditemukan.
                                              </div>
                                            )}
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  {/* Info Detail Wilayah Adat Pasangan */}
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
                          required
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
                {/* Status Mengangkat Anak */}
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
                      >
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
                {/* 2. Form Detail Anak Angkat */}
                {adoptingData.status_pengangkatan === "Mengangkat Anak" && (
                  <div className={`${styles.popupInput} animate-fade-in`}>
                    {/* Nama Anak Angkat */}
                    <div className="flex flex-col space-y-1">
                      <label className={styles.labelInputSelect}>
                        Nama Anak Angkat <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          className={styles.inputText}
                          placeholder="Ketikkan nama anak..."
                          value={isDropdownAnakOpen ? searchTermAnak 
                            : adoptingData.isAnakManual ? "Data Anak Baru" 
                            : kramaList.find(k => String(k.id) === String(adoptingData.anak_angkat_id)) 
                              ? getOrangTuaLabel(kramaList.find(k => String(k.id) === String(adoptingData.anak_angkat_id))) 
                              : searchTermAnak
                          }
                          onChange={(e) => {
                            setSearchTermAnak(e.target.value);
                            setIsDropdownAnakOpen(true);
                          }}
                          onFocus={() => setIsDropdownAnakOpen(true)}
                          required={adoptingData.status_pengangkatan === "Mengangkat Anak" && !adoptingData.isManual}
                        />
                        <div className={styles.termsIcon}>
                          <FaChevronDown size={12} className={`transition-transform ${isDropdownAnakOpen ? 'rotate-180' : ''}`} />
                        </div>
                        {/* Dropdown Hasil Pencarian Anak */}
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
                                }}
                              >
                                <span className="font-bold text-blue-600">
                                  + Input Anak Baru
                                </span>
                              </div>
                              {/* Filter List Krama */}
                              {kramaList
                                .filter(k => getOrangTuaLabel(k).toLowerCase().includes(searchTermAnak.toLowerCase()))
                                .map((k) => (
                                  <div
                                    key={k.id}
                                    className={styles.filterHasilTerms}
                                    onClick={() => {
                                      handleAdoptingChange({ target: { name: "anak_angkat_id", value: k.id } });
                                      setIsDropdownAnakOpen(false);
                                      setSearchTermAnak("");
                                    }}
                                  >
                                    <p className="font-bold text-gray-800">
                                      {getOrangTuaLabel(k)}
                                    </p>
                                    <p className="text-[10px] text-gray-500 uppercase italic">
                                      {k.desa_adat_id 
                                        ? (desaList.find(d => String(d.id) === String(k.desa_adat_id))?.nama_desa_adat || k.tempat_asal_khusus || (k.is_bali ? "Bali" : "Bali")) 
                                        : (k.tempat_asal_khusus || (k.is_bali ? "Bali" : k.alamat_luar || "Luar Bali"))
                                      } • Data Terdaftar
                                    </p>
                                  </div>
                                ))
                              }
                              {kramaList.filter(k => getOrangTuaLabel(k).toLowerCase().includes(searchTermAnak.toLowerCase())).length === 0 && (
                                <div className="px-4 py-3 text-sm text-gray-500 italic">
                                  Nama anak tidak ditemukan.
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {/* Form Input Manual Anak Baru */}
                    {adoptingData.isAnakManual && (
                      <div className={`${styles.cardInfoGreen} animate-fade-in shadow-inner`}>
                        <h4 className={styles.titleCardGreen}>
                          <FaInfoCircle /> Informasi Anak Angkat
                        </h4>
                        <div className="space-y-5 mt-3">
                          {/* Tipe Data */}
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
                                required={adoptingData.isManual}
                              >
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
                              value={adoptingData.manualAnak.nama_lengkap} 
                              onChange={(e) => handleManualAnakInput("nama_lengkap", e.target.value)} 
                              className={styles.inputText}
                              placeholder="Contoh: I Putu Gede Adnyana" 
                              required={adoptingData.isManual} 
                            />
                          </div>
                          {/* Nama Panggilan */}
                          <div className="flex flex-col space-y-1">
                            <label className={styles.labelInput}>
                              Nama Panggilan {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                            </label>
                            <input 
                              type="text" 
                              value={adoptingData.manualAnak.nama_panggilan} 
                              onChange={(e) => handleManualAnakInput("nama_panggilan", e.target.value)} 
                              className={styles.inputText}
                              placeholder="Contoh: Gede Adnyana" 
                              required={adoptingData.isManual && adoptingData.manualAnak.tipe_data !== "Leluhur"}
                            />
                          </div>
                          <div className={styles.dualInput}>
                            {/* Jenis Kelamin */}
                            <div className="flex flex-col space-y-1.5 flex-1">
                              <label className={styles.labelInput}>
                                Jenis Kelamin {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                              </label>
                              <div className="relative">
                                <select 
                                  value={adoptingData.manualAnak.jenis_kelamin} 
                                  onChange={(e) => handleManualAnakInput("jenis_kelamin", e.target.value)} 
                                  className={styles.inputSelect} 
                                  required={adoptingData.isAnakManual}
                                >
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
                                Tanggal Lahir {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                              </label>
                              <input 
                                type="date" 
                                value={adoptingData.manualAnak.tanggal_lahir} 
                                onChange={(e) => handleManualAnakInput("tanggal_lahir", e.target.value)} 
                                className={styles.inputCalendar} 
                                required={adoptingData.isManual && adoptingData.manualAnak.tipe_data !== "Leluhur"}
                              />
                            </div>
                          </div>
                          <div className={styles.dualInput}>
                            {/* Status Hidup */}
                            <div className="flex flex-col space-y-1.5">
                              <label className={styles.labelInput}>
                                Status Hidup {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                              </label>
                              <div className="relative">
                                <select 
                                  value={adoptingData.manualAnak.status_hidup} 
                                  onChange={(e) => handleManualAnakInput("status_hidup", e.target.value)} 
                                  className={styles.inputSelect} 
                                  required={adoptingData.isManual && adoptingData.manualAnak.tipe_data !== "Leluhur"}
                                >
                                  <option value="Hidup">Hidup</option>
                                  <option value="Meninggal">Meninggal</option>
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
                                  onChange={(e) => handleManualAnakInput("is_bali", e.target.checked)} 
                                  id="is_bali_anak_angkat" 
                                  className={styles.checkboxInput} 
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
                                  />
                                  <div className={styles.termsIcon}>
                                    <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === "manualAnak" ? 'rotate-180' : ''}`} />
                                  </div>
                                  {/* Dropdown Hasil Pencarian Desa Pangan*/}
                                  {openDesaDropdownIndex === "manualAnak" && (
                                    <>
                                      <div className="fixed inset-0 z-40" onClick={() => setOpenDesaDropdownIndex(null)}></div>
                                      <div className={styles.dropdownResult}>
                                        {getFilteredDesaManual("manualAnak").length > 0 ? (
                                          getFilteredDesaManual("manualAnak").map((d) => (
                                            <div 
                                              key={d.id} 
                                              className={styles.dropdownItems} 
                                              onClick={() => {
                                                handleManualAnakInput("desa_adat_id", d.id); 
                                                setSearchDesaPasangan({ ...searchDesaPasangan, manualAnak: d.nama_desa_adat }); 
                                                setOpenDesaDropdownIndex(null); 
                                              }}
                                            >
                                              <p className="text-sm font-bold text-gray-800">
                                                {d.nama_desa_adat}
                                              </p>
                                              {/* Menampilkan Informasi Wilayah Adat */}
                                              {(() => {
                                                const wil = getWilayahLengkap(d.id);
                                                return wil && <p className={styles.descDesaAdat}>{wil.kecamatan} • {wil.kabupaten}</p>;
                                              })()}
                                            </div>
                                          ))
                                        ) : (
                                          <div className="px-4 py-3 text-sm text-gray-500 italic">
                                            Desa adat tidak ditemukan.
                                          </div>
                                        )}
                                      </div>
                                    </>
                                  )}
                                </div>
                              </div>
                              {/* Info Detail Wilayah Adat Anak */}
                              {adoptingData.manualAnak.desa_adat_id && (() => {
                                const wilayah = getWilayahLengkap(adoptingData.manualAnak.desa_adat_id);
                                return wilayah && (
                                  <div className={styles.previewWilayahAdat}>
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
                                required={!adoptingData.manualAnak.is_bali && adoptingData.manualAnak.tipe_data !== "Leluhur"}
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
                        Tanggal Pengangkatan {adoptingData.manualAnak.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type="date"
                        name="tanggal_pengangkatan_anak"
                        value={adoptingData.tanggal_pengangkatan_anak}
                        onChange={handleAdoptingChange}
                        className={styles.inputText}
                        required
                      />
                    </div>
                  </div>
                )}
              </div>
            </section>
            {/* ACTION BUTTONS */}
            <div className={styles.buttonGroup}>
    <button 
      type="button" 
      onClick={() => setShowCancelModal(true)} 
      className={styles.btnBackRed} 
      disabled={isLoading}
    >
      <FaTimes /> Batal
    </button>
    
    <button 
      type="button" // 💡 DIUBAH MENJADI BUTTON BIASA (BUKAN SUBMIT)
      onClick={saveKrama} // 💡 AKSI DIPINDAHKAN LANGSUNG KE SINI
      disabled={isLoading} 
      className={styles.btnSubmit}
    >
      <FaSave size={14} /> {isLoading ? 'Menyimpan...' : 'Simpan Krama'}
    </button>
  </div>
          </form>
        </div>
      </div>
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
                  Apakah Anda yakin ingin membatalkan pendaftaran ini? Semua perubahan data yang telah Anda ketik akan hilang seketika.
                </p>
              </div>
              <div className="mt-10 flex gap-3 justify-center">
                <button onClick={() => setShowCancelModal(false)} className={styles.btnCancel}>
                  Kembali
                </button>
                <button 
                  onClick={() => {
                    setShowCancelModal(false);
                    navigate(`/krama-bali/detail/${slugParam}`);
                  }}
                  className={styles.btnDelete}>
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

export default DataKramaAddRelasi;