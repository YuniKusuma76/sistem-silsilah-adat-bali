import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdNotificationsNone } from 'react-icons/md';
import { 
  FaChevronDown, 
  FaSave, 
  FaTimes, 
  FaPlus, 
  FaTrash, 
  FaInfoCircle, 
  FaEraser, 
  FaExclamationTriangle
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBaru.module.css';

const DataKramaBaru = ({ user }) => {
  const navigate = useNavigate();
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
  const [searchPasangan, setSearchPasangan] = useState({}); 
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  
  // STATE RELASI ORANG TUA & PENGANGKATAN ANAK:
  const [searchOrangTuaTerm, setSearchOrangTuaTerm] = useState("");
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
  
  // STATE PERKAWINAN: Form input data perkawinan
  const [perkawinanlist, setPerkawinanlist] = useState([
    {
      id_temp: Date.now(),
      status_perkawinan: "Belum Kawin",
      jenis_perkawinan: "Biasa",
      tanggal_perkawinan: "",
      pasangan_id: "",
      tanggal_cerai: "",
      pihak_meninggal: "",
      pilihan_predana: "Kembali ke Asal",
      isPasanganBaru: false,
      dataPasanganBaru: { 
        nama_lengkap: "", 
        nama_panggilan: "",
        tanggal_lahir: "", 
        status_hidup: "Hidup",
        is_bali: true,
        desa_adat_id: "",
        tempat_asal_khusus: "",
        alamat_luar: "",
        tipe_data: "Keturunan"
      }
    }
  ]);
  
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
  
  // Effect: Auto-Close Notifikasi Alert
  useEffect(() => {
    if (alert.show && (
      alert.type === 'success' || 
      alert.type === 'error' || 
      alert.type === 'warning'
    )) {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Effect: Fetching multi endpoint data master
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Promise.allSettled agar satu error yang lain tidak mati
        const results = await Promise.allSettled([
          axiosInstance.get("/krama-bali?mode=public"),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
          axiosInstance.get("/perkawinan?mode=public")
        ]);

        const dataKrama = results[0].status === "fulfilled" 
          ? results[0].value.data?.data : [];
        const dataDesa = results[1].status === "fulfilled" 
          ? results[1].value.data?.data : [];
        const dataKec = results[2].status === "fulfilled" 
          ? results[2].value.data?.data : [];
        const dataKab = results[3].status === "fulfilled" 
          ? results[3].value.data?.data : [];
        const dataProv = results[4].status === "fulfilled" 
          ? results[4].value.data?.data : [];
        const dataPerkawinan = results[5].status === "fulfilled" 
          ? results[5].value.data?.data : [];

        setKramaList(dataKrama || []);
        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);
        setPerkawinanListOptions(dataPerkawinan || []);

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
      }
    };
    fetchData();
  }, []);

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

  // HELPER WILAYAH ADAT: Melakukan filter desa utama berdasarkan search
  const filteredDesa = useMemo(() => {
    if (!searchDesaUtama.trim()) return [];
    return desaList.filter((d) => 
      d.nama_desa_adat.toLowerCase().includes(searchDesaUtama.toLowerCase())
    );
  }, [desaList, searchDesaUtama]); 

  // HELPER RELASI ORANG TUA: Format tampilan label pencarian anak angkat
  const getOrangTuaLabel = (anak) => {
    if (!anak) return "";

    // Skenario 1: Jika objek anak yang dikirim dari baris data RelasiKrama (sudah menyertakan ayah dan ibu)
    if (anak.ayah || anak.ibu) {
      const namaAnak = anak.anak?.nama_lengkap;
      const namaAyah = anak.ayah?.nama_lengkap;
      const namaIbu = anak.ibu?.nama_lengkap;

      if (namaAyah && namaIbu) return `${namaAnak} (Ortu: ${namaAyah} & ${namaIbu})`;
      if (namaAyah) return `${namaAnak} (Ayah: ${namaAyah})`;
      if (namaIbu) return `${namaAnak} (Ibu: ${namaIbu})`;
      return namaAnak;
    }

    // Skenario 2: Jika objek anak yang dikirim murni dari KramaBali tunggal dengan relasi orang tua
    if (anak.relasi_orangtua && anak.relasi_orangtua.length > 0) {
      const relasiTerakhir = anak.relasi_orangtua[anak.relasi_orangtua.length - 1];
      const namaAyah = relasiTerakhir.ayah?.nama_lengkap;
      const namaIbu = relasiTerakhir.ibu?.nama_lengkap;

      if (namaAyah && namaIbu) return `${anak.nama_lengkap} (Ortu: ${namaAyah} & ${namaIbu})`;
      if (namaAyah) return `${anak.nama_lengkap} (Ayah: ${namaAyah})`;
      if (namaIbu) return `${anak.nama_lengkap} (Ibu: ${namaIbu})`;
    }
    return `${anak.nama_lengkap}`;
  };

  // HELPER PERKAWINAN: Mengambil data pasangan terdaftar berdasarkan gender lawan jenis
  const getFilteredPasangan = (index) => {
    if (!kramaData.jenis_kelamin) return [];
    const targetGender = kramaData.jenis_kelamin === "Laki-laki" 
      ? "Perempuan" 
      : "Laki-laki";
    const term = searchPasangan[index] || "";
    if (!term.trim()) return [];

    return kramaList.filter((k) => 
      k.jenis_kelamin === targetGender &&
      k.nama_lengkap.toLowerCase().includes(term.toLowerCase())
    );
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
  
  // HELPER KRAMA UTAMA: Menangani perubahan data input krama utama
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setKramaData((prev) => ({ 
      ...prev, 
      [name]: type === "checkbox" ? checked : value 
    }));
  };

  // HELPER KRAMA UTAMA: Menangani perubahan khusus dropdown tipe data
  const handleTipeDataChange = (e) => {
    const targetValue = e.target.value;
    setKramaData((prev) => ({
      ...prev,
      tipe_data: targetValue,
      nama_panggilan: targetValue === "Leluhur" ? "" : prev.nama_panggilan,
      tanggal_lahir: targetValue === "Leluhur" ? "" : prev.tanggal_lahir,
      status_hidup: targetValue === "Leluhur" ? "" : prev.status_hidup,
    }));
  };

  // HELPER PERKAWINAN: Menangani perubahan data input perkawinan
  const handlePerkawinanChange = (index, field, value) => {
    const list = perkawinanlist.map((item, idx) => {
      if (idx !== index) return item;

      // membuat salinan objek baru untuk baris yang sedang diedit
      const updatedItem = { ...item };

      if (field === "pasangan_id" && value === "NEW_ENTRY") {
        updatedItem.isPasanganBaru = true;
        updatedItem.pasangan_id = "";
      } else {
        if (field === "pasangan_id") updatedItem.isPasanganBaru = false;
        updatedItem[field] = value;
      }
      
      // setting default jika status perkawinan dirubah ke Cerai Mati
      if (field === "status_perkawinan" && value === "Cerai Mati") {
        updatedItem.pihak_meninggal = updatedItem.pihak_meninggal || "Pasangan";
        updatedItem.pilihan_predana = updatedItem.pilihan_predana || "Kembali ke Asal";
        // setting status hidup pasangan baru sesuai kondisi
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
          status_hidup: value === "Pasangan" ? "Meninggal" : "Hidup"
        };
      }
      return updatedItem;
    });
    setPerkawinanlist(list);
  };

  // HELPER PERKAWINAN: Menangani perubahan data input pasangan baru
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
    setPerkawinanlist([...perkawinanlist, {
      id_temp: Date.now(),
      status_perkawinan: "Belum Kawin",
      jenis_perkawinan: "Biasa",
      tanggal_perkawinan: "",
      pasangan_id: "",
      tanggal_cerai: "",
      pihak_meninggal: "",
      pilihan_predana: "Kembali ke Asal",
      isPasanganBaru: false,
      dataPasanganBaru: { 
        nama_lengkap: "", 
        nama_panggilan: "",
        tanggal_lahir: "", 
        status_hidup: "Hidup",
        is_bali: true,
        desa_adat_id: "",
        tempat_asal_khusus: "",
        alamat_luar: "",
        tipe_data: "Keturunan"
      }
    }]);
  };

  // HELPER PERKAWINAN: Menghapus baris input perkawinan
  const hapusBarisPerkawinan = (index) => {
    const list = perkawinanlist.filter((_, idx) => idx !== index);
    setPerkawinanlist(list);
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
      [targetObject]: {
        ...prev[targetObject], 
        [fieldName]: value
      }
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
      manualAnak: { 
        ...prev.manualAnak, 
        [field]: value 
      }
    }));
  };

  // HELPER PERKAWINAN: Membersihkan input form perkawinan
  const clearPerkawinan = (index) => {
    const list = perkawinanlist.map((item, idx) => {
      if (idx !== index) return item;
      return {
        id_temp: item.id_temp,
        status_perkawinan: "Belum Kawin",
        jenis_perkawinan: "Biasa",
        tanggal_perkawinan: "",
        pasangan_id: "",
        tanggal_cerai: "",
        pihak_meninggal: "",
        pilihan_predana: "Kembali ke Asal",
        isPasanganBaru: false,
        dataPasanganBaru: {
          nama_lengkap: "",
          nama_panggilan: "",
          tanggal_lahir: "",
          status_hidup: "Hidup", 
          is_bali: true,
          desa_adat_id: "",
          tempat_asal_khusus: "",
          alamat_luar: "",
          tipe_data: "Keturunan"
        }
      };
    });
    setPerkawinanlist(list);
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
    e.preventDefault();
    try {
      setIsLoading(true);
      const payloadKrama = { ...kramaData };

      if (payloadKrama.desa_adat_id === "") {
        payloadKrama.desa_adat_id = null;
      }
      if (payloadKrama.tipe_data === "Leluhur") {
        if (payloadKrama.tanggal_lahir === "") {
          payloadKrama.tanggal_lahir = null;
        }
        if (payloadKrama.jenis_kelamin === "") {
          payloadKrama.jenis_kelamin = null;
        }
        if (payloadKrama.status_hidup === "") {
          payloadKrama.status_hidup = null;
        }
      }

      const mainRes = await axiosInstance.post("/krama-bali", payloadKrama);
      const mainId = mainRes.data.data.id;

      // ====================================================================
      // FUNGSI PERKAWINAN dan INPUT CERAI SIMULTAN (Proses Input Bersamaan)
      // ====================================================================
      let createdMarriageId = null;

      for (const m of perkawinanlist) {
        // normalisasi string untuk deteksi jenis mutasi hukum adat
        const statusMentah = String(m.status_perkawinan || "").trim().toLowerCase();
        const apakahCerai = statusMentah.includes("cerai");
        const apakahCeraiMati = statusMentah.includes("mati");

        if (statusMentah !== "belum kawin" && statusMentah !== "") {
          let spouseId = m.pasangan_id;
          // membuat pasangan baru jika belum ada di database
          if (m.isPasanganBaru) {
            const payloadSpouse = { ...m.dataPasanganBaru };
            if (payloadSpouse.desa_adat_id === "") {
              payloadSpouse.desa_adat_id = null;
            }
            // setting jenis kelamin dinamis
            let genderPasanganPilihan = "Tidak Diketahui";
            const jkUtama = kramaData?.jenis_kelamin;

            if (jkUtama === "Laki-laki") {
              genderPasanganPilihan = "Perempuan";
            } else if (jkUtama === "Perempuan") {
              genderPasanganPilihan = "Laki-laki";
            } else {
              genderPasanganPilihan = m.dataPasanganBaru?.jenis_kelamin || "Tidak Diketahui";
            }

            const spouseRes = await axiosInstance.post("/krama-bali", { 
              ...payloadSpouse, 
              jenis_kelamin: genderPasanganPilihan
            });
            spouseId = spouseRes.data.data.id;
          }
          // payload utama untuk mencatat perkawinan
          let payloadP = { 
            suami_id: kramaData?.jenis_kelamin === "Laki-laki" ? mainId : spouseId,
            istri_id: kramaData?.jenis_kelamin === "Laki-laki" ? spouseId : mainId,
            status_perkawinan: "Kawin", 
            jenis_perkawinan: m.jenis_perkawinan || "Biasa", 
            tanggal_perkawinan: m.tanggal_perkawinan || null, 
            data_perubahan: null,
          };
          // eksekusi post pendaftaran status perkawinan
          const mRes = await axiosInstance.post("/perkawinan/kawin", payloadP);
          const marriageId = mRes.data.data?.perkawinan?.id || mRes.data.data?.id;
          createdMarriageId = marriageId;

          // baypass eksekusi mutasi perceraian historis
          if (apakahCerai && marriageId) {
            try {
              const userRole = user?.role || "Krama"; 
              const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
              const jenisMutasiFinal = statusMentah.includes("mati") ? "Cerai Mati" : "Cerai Hidup";
              const tglCeraiFinal = m.tanggal_cerai || m.tanggal_perkawinan || null;

              let pihakMeninggalFinal = null;
              
              if (apakahCeraiMati) {
                const pilihanForm = m.pihak_meninggal || "Pasangan"; 
                const jkUtama = kramaData.jenis_kelamin || "Laki-laki";
                if (pilihanForm === "Pasangan") {
                  // jika pasangan meninggal, gender kebalikan dari krama utama
                  pihakMeninggalFinal = jkUtama === "Laki-laki" ? "Istri" : "Suami";
                } else {
                  // jika krama utama meninggal, gender disesuaikan langsung dengan form I
                  pihakMeninggalFinal = jkUtama === "Laki-laki" ? "Suami" : "Istri";
                }
              }
              // sinkronisasi input ketetapan silsilah predana
              let pilihanPredanaFinal = "Kembali ke Asal";
              if (m.pilihan_predana === "Tetap di Tempat" || m.pilihan_predana === "Tetap") {
                pilihanPredanaFinal = "Tetap";
              }
              // data_perubahan jsonB
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
              // melakukan update status is_pending_update
              let payloadUpdateUtama = {
                status_perkawinan: jenisMutasiFinal,
                tanggal_cerai: tglCeraiFinal,
                is_pending_update: isAdmin ? false : true,
                data_perubahan: payloadDrafPerceraian
              };

              if (apakahCeraiMati) {
                payloadUpdateUtama.pihak_meninggal = pihakMeninggalFinal;
                payloadUpdateUtama.pilihan_predana = pilihanPredanaFinal;
              }

              await axiosInstance.put(`/perkawinan/cerai/${marriageId}`, payloadUpdateUtama);

              if (isAdmin) {
                console.log("Berhasil memproses dan memverifikasi mutasi perceraian simultan.");
              } else {
                await new Promise(resolve => setTimeout(resolve, 250));
                await axiosInstance.patch(`/perkawinan/cerai/verifikasi/${marriageId}`, {
                  perkawinan_id: marriageId,
                  status_verifikasi: "Draft",
                  target_sisi: "super_admin",
                  status_verifikasi_perceraian: `Diajukan otomatis via form simultan oleh ${userRole}`,
                  user_role: userRole,
                  nama_desa_operator: user?.nama_desa || "Admin Desa Setempat"
                });
                console.log("Usulan draft perceraian berhasil diajukan! Menunggu verifikasi Admin Desa.");
              }
            } catch (errError) {
              console.error(errError?.response?.data || errError.message);
            }
          }
        }
      }
      // ====================================================================
      // FUNGSI INPUT DATA ORANG TUA PASANGAN/TUNGGAL
      // ====================================================================
      const processParentData = parentData.status_diketahui === "Diketahui";

      if (processParentData) {
        let finalPerkawinanId = parentData.selected_perkawinan_id;
        let finalSingleParentId = parentData.selected_ayah_id || parentData.selected_ibu_id;

        let ayahId = parentData.selected_ayah_id;
        let ibuId = parentData.selected_ibu_id;

        if (parentData.isManual) {
          // Skenario 1: Relasi dengan orang tua berpasangan (Anak Kandung / Angkat Pasangan)
          if (parentData.status_hubungan === "Anak Kandung" || (parentData.status_hubungan === "Anak Angkat" && parentData.jenis_pengangkatan === "Pasangan")) {
            // mendaftarkan ayah secara menual
            if (!ayahId) {
              const payloadAyah = { ...parentData.manualAyah };
              if (payloadAyah.desa_adat_id === "") {
                payloadAyah.desa_adat_id = null;
              }
              const resAyah = await axiosInstance.post("/krama-bali", { 
                ...payloadAyah, 
                jenis_kelamin: "Laki-laki" 
              });
              ayahId = resAyah.data.data.id;
            }
            // mendaftarkan ibu secara manual
            if (!ibuId) {
              const payloadIbu = { ...parentData.manualIbu };
              if (payloadIbu.desa_adat_id === "") {
                payloadIbu.desa_adat_id = null;
              }
              const resIbu = await axiosInstance.post("/krama-bali", { 
                ...payloadIbu, 
                jenis_kelamin: "Perempuan"
              });
              ibuId = resIbu.data.data.id;
            }
            // mendaftarkan perkawinan orang tua baru
            if (!finalPerkawinanId) {
              const resKawin = await axiosInstance.post("/perkawinan/kawin", {
                suami_id: ayahId,
                istri_id: ibuId,
                status_perkawinan: "Kawin",
                jenis_perkawinan: parentData.manualPerkawinan.jenis_perkawinan || "Biasa",
                tanggal_perkawinan: parentData.manualPerkawinan.tanggal_perkawinan || null,
                data_perubahan: null
              });

              const dataPerkawinanSistem = resKawin.data.data?.perkawinan || resKawin.data.data;
              const newMarriageId = dataPerkawinanSistem?.id;
              finalPerkawinanId = newMarriageId;

              // Proses ketika mendaftarkan perceraian secara bersamaan dengan perkawinan
              if (newMarriageId && parentData.manualPerkawinan.status_perkawinan) {
                const statusMentah = String(parentData.manualPerkawinan.status_perkawinan).trim().toLowerCase();
                const apakahCerai = statusMentah.includes("cerai");
                const apakahCeraiMati = statusMentah.includes("mati");

                if (apakahCerai) {
                  const userRole = user?.role || "Krama";
                  const isAdmin = userRole === "Super Admin" || userRole === "Admin Desa";
                  const jenisMutasiFinal = apakahCeraiMati ? "Cerai Mati" : "Cerai Hidup";
                  const tglCeraiFinal = parentData.manualPerkawinan.tanggal_cerai || parentData.manualPerkawinan.tanggal_perkawinan || null;
                  // menentukan pihak meninggal
                  let pihakMeninggalFinal = null;
                  if (apakahCeraiMati) {
                    const pilihanForm = parentData.manualPerkawinan.pihak_meninggal || "Pasangan";
                    pihakMeninggalFinal = pilihanForm === "Pasangan" ? "Istri" : "Suami";
                  }
                  // mengambil pilihan predanan ketika cerai mati
                  let pilihanPredanaFinal = "Kembali ke Asal";
                  if (parentData.manualPerkawinan.pilihan_predana === "Tetap di Tempat" || parentData.manualPerkawinan.pilihan_predana === "Tetap") {
                    pilihanPredanaFinal = "Tetap";
                  }
                  
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
                    is_pending_update: isAdmin ? false : true, 
                    data_perubahan: payloadDrafPerceraian
                  };

                  if (apakahCeraiMati) {
                    payloadUpdateUtama.pihak_meninggal = pihakMeninggalFinal;
                    payloadUpdateUtama.pilihan_predana = pilihanPredanaFinal;
                  }

                  try {
                    await axiosInstance.put(`/perkawinan/cerai/${newMarriageId}`, payloadUpdateUtama);
                  } catch (putError) {
                    console.error(putError.response?.data);
                    throw putError; 
                  }

                  if (!isAdmin) {
                    await new Promise(resolve => setTimeout(resolve, 250));
                    await axiosInstance.patch(`/perkawinan/cerai/verifikasi/${newMarriageId}`, {
                      perkawinan_id: newMarriageId,
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
          } 
          // Skenario 2: Relasi dengan orang tua tunggal
          else {
            if (!finalSingleParentId) {
              const payloadSingle = { ...parentData.manualSingle };
              if (payloadSingle.desa_adat_id === "") {
                payloadSingle.desa_adat_id = null;
              }
              const resSingle = await axiosInstance.post("/krama-bali", payloadSingle);
              finalSingleParentId = resSingle.data.data.id;
            }
          }
        }
        // Menyusun payload relasi anak dengan orang tua baru
        let safePerkawinanId = null;
        if (finalPerkawinanId && !isNaN(finalPerkawinanId)) {
          safePerkawinanId = parseInt(finalPerkawinanId);
        }

        let payloadR = { 
          anak_id: mainId ? parseInt(mainId) : null,
          status_hubungan: parentData.status_hubungan || "Anak Kandung", 
          tanggal_pengangkatan: parentData.status_hubungan === "Anak Angkat" ? parentData.tanggal_pengangkatan : null,
          perkawinan_id: safePerkawinanId,
          status_verifikasi: "Disetujui",
          user_id: user?.id
        };

        if (parentData.status_hubungan !== "Anak Kandung" && parentData.jenis_pengangkatan !== "Pasangan") { 
          let genderParent = "";

          if (parentData.isManual && !parentData.selected_ayah_id && !parentData.selected_ibu_id) {
            genderParent = parentData.manualSingle?.jenis_kelamin;
          } else {
            const parsedId = finalSingleParentId ? parseInt(finalSingleParentId) : null;
            const pk = kramaList?.find(k => k.id === parsedId);
            if (pk) genderParent = pk.jenis_kelamin;
          }

          if (genderParent === "Laki-laki") {
            payloadR.ayah_id = finalSingleParentId ? parseInt(finalSingleParentId) : null;
            payloadR.ibu_id = null;
          } else {
            payloadR.ibu_id = finalSingleParentId ? parseInt(finalSingleParentId) : null;
            payloadR.ayah_id = null;
          }
          payloadR.perkawinan_id = null; 
        } else {
          payloadR.ayah_id = ayahId ? parseInt(ayahId) : null;
          payloadR.ibu_id = ibuId ? parseInt(ibuId) : null;
        }

        await axiosInstance.post("/relasi-krama", payloadR);
      }
      // ====================================================================
      // FUNGSI INPUT DATA PENGANGKATAN ANAK
      // ====================================================================
      if (adoptingData.status_pengangkatan === "Ya" || adoptingData.status_pengangkatan === "Mengangkat Anak") {
        if (adoptingData.anak_angkat_id || adoptingData.isAnakManual) {
          let finalAnakId = adoptingData.anak_angkat_id;
          
          // Skenario jika data anak didaftarkan manual
          if (adoptingData.isAnakManual) {
            const payloadAnak = { ...adoptingData.manualAnak };
            if (payloadAnak.desa_adat_id === "") {
              payloadAnak.desa_adat_id = null;
            }
            
            const resAnak = await axiosInstance.post("/krama-bali", payloadAnak);
            finalAnakId = resAnak.data.data.id;
          }

          let payloadA = { 
            anak_id: finalAnakId ? parseInt(finalAnakId) : null, 
            status_hubungan: "Anak Angkat", 
            tanggal_pengangkatan: adoptingData.tanggal_pengangkatan_anak || null,
            status_verifikasi: user?.role === "Super Admin" || user?.role === "Admin Desa" ? "Disetujui" : "Draft",
            user_id: user?.id
          };

          // Menyesuaikan relasi jika terdapat data perkawinan
          const perkawinanKramaUtamaId = typeof createdMarriageId !== 'undefined' 
            ? createdMarriageId 
            : kramaData?.selected_perkawinan_id;

          if (perkawinanKramaUtamaId) {
            // jika berpasangan, ikat anak angkat dengan keluarga perkawinannya
            payloadA.perkawinan_id = parseInt(perkawinanKramaUtamaId);
            payloadA.ayah_id = null;
            payloadA.ibu_id = null;
          } else { 
            // jika belum berpasangan, tentukan form berdasarkan jenis kelaminnya
            payloadA.perkawinan_id = null;
            if (kramaData.jenis_kelamin === "Laki-laki") {
              payloadA.ayah_id = mainId;
              payloadA.ibu_id = null;
            } else {
              payloadA.ibu_id = mainId;
              payloadA.ayah_id = null;
            }
          }
          await axiosInstance.post("/relasi-krama", payloadA);
        }
      }
      navigate("/krama-bali/my-data", { 
        state: { successMessage: 'Data krama bali berhasil ditambahkan!' } 
      });
    } catch (error) {
      setAlert({ 
        show: true, 
        type: 'error', 
        message: error.response?.data?.message || 'Terjadi kesalahan pada sistem.' 
      });
      window.scrollTo(0,0);
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
            Menambahkan Data Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Lengkapi formulir dengan data yang sebenarnya dan sah
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
      {/* Form Add Krama Bali */}
      <div className="p-8 flex-1 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          <form onSubmit={saveKrama} className="w-full space-y-8">
            {/* BAGIAN 1: DATA DIRI KRAMA BALI */}
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
                      onChange={handleTipeDataChange}
                      className={styles.inputSelect} 
                      required
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
                    name="nama_lengkap" 
                    value={kramaData.nama_lengkap} 
                    onChange={handleChange} 
                    className={styles.inputText}
                    placeholder="Contoh: I Wayan Sudarsana" 
                    required 
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
                    onChange={handleChange} 
                    className={styles.inputText}
                    placeholder="Contoh: Sudarsana" 
                    required={kramaData.tipe_data !== "Leluhur"}
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
                        onChange={handleChange} 
                        className={styles.inputSelect} 
                        required={kramaData.tipe_data !== "Leluhur"}
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
                      onChange={handleChange} 
                      className={styles.inputCalendar} 
                      required={kramaData.tipe_data !== "Leluhur"}
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
                        onChange={handleChange} 
                        className={styles.inputSelect} 
                        required={kramaData.tipe_data !== "Leluhur"}
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
                        onChange={(e) => {
                          handleChange(e);
                          setKramaData(prev => ({
                            ...prev,
                            is_bali: e.target.checked,
                            desa_adat_id: e.target.checked ? prev.desa_adat_id : "",
                            tempat_asal_khusus: e.target.checked ? prev.tempat_asal_khusus : "",
                            alamat_luar: e.target.checked ? "" : prev.alamat_luar
                          }));
                          setSearchDesaUtama("");
                        }} 
                        id="is_bali" 
                        className={styles.checkboxInput} 
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
                            required={kramaData.tipe_data !== "Leluhur"}
                          />
                          <div className={styles.termsIcon}>
                            <FaChevronDown size={12} className={`transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                          </div>
                          {/* Dropdown Hasil Pencarian */}
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
                                    Desa tidak ditemukan.
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
                          value={kramaData.tempat_asal_khusus || ""} 
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
                        value={kramaData.alamat_luar || ""} 
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
            {/* BAGIAN 2: DATA PERKAWINAN */}
            <section className={styles.section}>
              <div className={styles.sectionContent}>
                <h3 className={styles.sectionDualTitle}>
                  II. Data Perkawinan
                </h3>
                {kramaData.jenis_kelamin === "Laki-laki" && (
                  <button type="button" onClick={tambahBarisPerkawinan} className={styles.btnAddIstri}>
                    <FaPlus size={12}/> Tambah Istri
                  </button>
                )}
              </div>
              <div className="space-y-8">
                {perkawinanlist.map((m, index) => (
                  <div key={m.id_temp} className={styles.cardSection}>
                    {perkawinanlist.length > 1 && (
                      <button type="button" onClick={() => hapusBarisPerkawinan(index)} className={styles.btnTrashKawin}>
                        <FaTrash size={14} />
                      </button>
                    )}
                    {/* Status Perkawinan */}
                    <div className={styles.dualColumn}>
                      <div className="flex flex-col space-y-1.5">
                        <label className={styles.labelInputSelect}>
                          Status Perkawinan {perkawinanlist.length > 1 ? `#${index+1}` : ''} <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <select 
                            value={m.status_perkawinan} 
                            onChange={(e) => handlePerkawinanChange(index, "status_perkawinan", e.target.value)} 
                            className={styles.inputPilihan} 
                            required
                          >
                            <option value="Belum Kawin">Belum Kawin</option>
                            <option value="Kawin">Kawin</option>
                            <option value="Cerai">Cerai Hidup</option>
                            <option value="Cerai Mati">Cerai Mati</option>
                          </select>
                          <div className={styles.selectIcon}>
                            <FaChevronDown size={12}/>
                          </div>
                        </div>
                      </div>
                      {m.status_perkawinan !== "Belum Kawin" && (
                        <button type="button" onClick={() => {clearPerkawinan(index)}} className={styles.btnResetDetail}>
                          <FaEraser /> Reset Detail
                        </button>
                      )}
                    </div>
                    {/* Jika Status Kawin/Cerai/Cerai Mati */}
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
                                className={styles.inputPilihan} 
                                required
                              >
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
                              Tanggal Perkawinan {kramaData.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                            </label>
                            <input 
                              type="date" 
                              value={m.tanggal_perkawinan} 
                              onChange={(e) => handlePerkawinanChange(index, "tanggal_perkawinan", e.target.value)} 
                              className={styles.inputCalendar}
                              required={m.status_perkawinan !== "Belum Kawin" && kramaData.tipe_data !== "Leluhur"}
                            />
                          </div>
                        </div>
                        {/* Pencarian Nama Pasangan Terdaftar */}
                        <div className="flex flex-col space-y-1.5 relative">
                          <label className={styles.labelInputSelect}>
                            Nama Pasangan <span className="text-red-500">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              className={styles.inputText}
                              placeholder="Ketikkan nama pasangan..."
                              value={openDropdownIndex === index ? (searchPasangan[index] || "") 
                                : m.isPasanganBaru ? " Data Pasangan Baru" 
                                : (kramaList.find(k => String(k.id) === String(m.pasangan_id))?.nama_lengkap || "")
                              }
                              onChange={(e) => {
                                setSearchPasangan({ ...searchPasangan, [index]: e.target.value }); 
                                setOpenDropdownIndex(index); 
                              }}
                              onFocus={() => {
                                setSearchPasangan({ ...searchPasangan, [index]: "" });
                                setOpenDropdownIndex(index);
                              }}
                              required={m.status_perkawinan !== "Belum Kawin" && !m.isPasanganBaru}
                            />
                            <div className={styles.termsIcon}>
                              <FaChevronDown size={12} className={`transition-transform ${openDropdownIndex === index ? 'rotate-180' : ''}`} />
                            </div>
                            {/* Dropdown Hasil Pencarian Pasangan */}
                            {openDropdownIndex === index && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setOpenDropdownIndex(null)}></div>
                                <div className={styles.dropdownHasilPasangan}>
                                  <div
                                    className={styles.listHasilTerms}
                                    onClick={() => {
                                      handlePerkawinanChange(index, "pasangan_id", "NEW_ENTRY");
                                      setOpenDropdownIndex(null);
                                      setSearchPasangan({ ...searchPasangan, [index]: "" });
                                    }}
                                  >
                                    <span className="font-bold text-blue-600">+ Input Pasangan Baru</span>
                                  </div>
                                  {/* Hasil Filter Lawan Jenis*/}
                                  {getFilteredPasangan(index).length > 0 ? (
                                    getFilteredPasangan(index).map((k) => (
                                      <div
                                        key={k.id}
                                        className={styles.filterHasilTerms}
                                        onClick={() => {
                                          handlePerkawinanChange(index, "pasangan_id", k.id);
                                          setOpenDropdownIndex(null);
                                          setSearchPasangan({ ...searchPasangan, [index]: k.nama_lengkap });
                                        }}
                                      >
                                        <p className="font-bold text-gray-800">{k.nama_lengkap}</p>
                                        <p className="text-[10px] text-gray-500 uppercase italic">
                                          {k.desa_adat_id 
                                            ? (desaList.find(d => String(d.id) === String(k.desa_adat_id))?.nama_desa_adat || "Asal Bali")
                                            : (k.alamat_luar || "Luar Bali")
                                          } • {k.nama_panggilan || k.tipe_data}
                                        </p>
                                      </div>
                                    ))
                                  ) : (
                                    <div className="px-4 py-2.5 text-xs text-gray-400 italic bg-white">
                                      Nama pasangan tidak ditemukan.
                                    </div>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                        {/* Data Detail jika Pasangan Baru */}
                        {m.isPasanganBaru && (
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
                                        tipe_data: val
                                      });
                                      if (val === "Leluhur") {
                                        handlePerkawinanChange(index, "dataPasanganBaru", {
                                          ...m.dataPasanganBaru,
                                          tipe_data: val,
                                          status_hidup: "Meninggal"
                                        });
                                      }
                                    }}
                                    className={styles.inputSelect} 
                                    required={m.isPasanganBaru}
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
                              {/* Nama Panggilan Pasangn Baru */}
                              <div className="flex flex-col space-y-1">
                                <label className={styles.labelInput}>
                                  Nama Panggilan {m.dataPasanganBaru.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                </label>
                                <input 
                                  type="text" 
                                  value={m.dataPasanganBaru.nama_panggilan || ""} 
                                  onChange={(e) => handlePasanganBaruChange(index, "nama_panggilan", e.target.value)} 
                                  className={styles.inputText}
                                  placeholder="Contoh: Sri Utami" 
                                  required={m.dataPasanganBaru.tipe_data !== "Leluhur"}
                                />
                              </div>
                              <div className={styles.dualInput}>
                                {/* Tanggal Lahir Pasangan Baru */}
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Tanggal Lahir {m.dataPasanganBaru.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                  </label>
                                  <input 
                                    type="date" 
                                    value={m.dataPasanganBaru.tanggal_lahir || ""} 
                                    onChange={(e) => handlePasanganBaruChange(index, "tanggal_lahir", e.target.value)} 
                                    className={styles.inputCalendar} 
                                    required={m.dataPasanganBaru.tipe_data !== "Leluhur"}
                                  />
                                </div>
                                {/* Status Hidup Pasangan Baru*/}
                                <div className="flex flex-col space-y-1.5">
                                  <label className={styles.labelInput}>
                                    Status Hidup {m.dataPasanganBaru.tipe_data !== "Leluhur" && <span className="text-red-500">*</span>}
                                  </label>
                                  <div className="relative">
                                    <select 
                                      value={m.dataPasanganBaru.status_hidup || ""} 
                                      onChange={(e) => handlePasanganBaruChange(index, "status_hidup", e.target.value)} 
                                      className={styles.inputSelect} 
                                      required={m.dataPasanganBaru.tipe_data !== "Leluhur"}
                                    >
                                      <option value="Hidup">Hidup</option>
                                      <option value="Meninggal">Meninggal</option>
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
                                    onChange={(e) => {
                                      const isChecked = e.target.checked;
                                      const updatedDataPasangan = {
                                        ...m.dataPasanganBaru,
                                        is_bali: isChecked,
                                        desa_adat_id: isChecked ? m.dataPasanganBaru.desa_adat_id : "",
                                        alamat_luar: isChecked ? "" : m.dataPasanganBaru.alamat_luar
                                      };
                                      handlePasanganBaruChange(index, "dataPasanganBaruUtuh", updatedDataPasangan);
                                      setSearchDesaPasangan(prev => ({ ...prev, [index]: "" }));
                                    }}
                                    id={`is_bali_pasangan_${index}`} 
                                    className={styles.checkboxInput} 
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
                                        placeholder="Cari wilayah desa adat..."
                                        value={openDesaDropdownIndex === index 
                                          ? (searchDesaPasangan[index] || "") 
                                          : (desaList.find(d => String(d.id) === String(m.dataPasanganBaru.desa_adat_id))?.nama_desa_adat || "")
                                        }
                                        onChange={(e) => {
                                          setSearchDesaPasangan({ ...searchDesaPasangan, [index]: e.target.value }); 
                                          setOpenDesaDropdownIndex(index);
                                        }}
                                        onFocus={() => {
                                          setSearchDesaPasangan({ ...searchDesaPasangan, [index]: "" });
                                          setOpenDesaDropdownIndex(index);
                                        }}
                                      />
                                      <div className={styles.termsIcon}>
                                        <FaChevronDown size={12} className={`transition-transform ${openDesaDropdownIndex === index ? 'rotate-180' : ''}`} />
                                      </div>
                                      {/* Dropdown Hasil Pencarian Desa Pangan*/}
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
                                                    setSearchDesaPasangan({ ...searchDesaPasangan, [index]: d.nama_desa_adat }); 
                                                    setOpenDesaDropdownIndex(null); 
                                                  }}
                                                >
                                                  <p className="text-sm font-bold text-gray-800">{d.nama_desa_adat}</p>
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
                        {(m.status_perkawinan === "Cerai" || m.status_perkawinan === "Cerai Mati") && (
                          <div className={styles.inputContent}>
                            <div className="flex flex-col space-y-1.5">
                              <label className={styles.labelInputSelect}>
                                {m.status_perkawinan === "Cerai" ? "Tanggal Perceraian" : "Tanggal Perceraian/Kematian"} <span className="text-red-500">*</span>
                              </label>
                              <input 
                                type="date" 
                                value={m.tanggal_cerai || ""} 
                                onChange={(e) => handlePerkawinanChange(index, "tanggal_cerai", e.target.value)} 
                                className={styles.inputCalendar}
                                required={(m.status_perkawinan === "Cerai" || m.status_perkawinan === "Cerai Mati") && kramaData.tipe_data !== "Leluhur"}  
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
                                        className={styles.inputPilihan} 
                                        required={m.status_perkawinan === "Cerai Mati" && kramaData.tipe_data !== "Leluhur"}
                                      >
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
                                        className={styles.inputPilihan} 
                                        required={m.status_perkawinan === "Cerai Mati" && kramaData.tipe_data !== "Leluhur"}
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
                                {/* Catatan Adat Otomatis */}
                                {((kramaData.jenis_kelamin === "Laki-laki" && m.pihak_meninggal === "Pasangan") || 
                                  (kramaData.jenis_kelamin === "Perempuan" && m.pihak_meninggal === "Krama Utama")) && (
                                  <div className={styles.notedPredana}>
                                    <strong>Catatan Adat:</strong> Karena pihak Perempuan (Predana) yang meninggal dalam status pernikahan aktif, 
                                    disarankan memilih ketetapan silsilah <strong>"Tetap di Purusa"</strong>. Menurut hukum adat, swadharma dan 
                                    kedudukan silsilah pihak Perempuan (Predana) secara mutlak tetap berada di pihak keluarga suami (Purusa).
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
            {/* BAGIAN 3: DATA ORANG TUA */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                III. Data Orang Tua
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
            {/* BAGIAN 4: MENGANGKAT ANAK */}
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                IV. Data Pengangkatan Anak
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
              <button type="button" onClick={() => setShowCancelModal(true)} className={styles.btnBackRed} disabled={isLoading}>
                <FaTimes /> Batal</button>
              <button type="submit" disabled={isLoading} className={styles.btnSubmit}>
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
                    navigate("/krama-bali/my-data");
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

export default DataKramaBaru;