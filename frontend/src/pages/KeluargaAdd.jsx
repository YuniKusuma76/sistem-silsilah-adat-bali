import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { 
  FaChevronDown, 
  FaSave, 
  FaTimes, 
  FaPlus, 
  FaTrash, 
  FaInfoCircle, 
  FaEraser 
} from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

const KeluargaAdd = () => {
  const [kramaList, setKramaList] = useState([]);
  const [perkawinanListOptions, setPerkawinanlistOptions] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // State Alert Global
  const [alert, setAlert] = useState({
    show: false,
    type: '',
    message: ''
  });

  // State form data krama
  const [kramaData, setKramaData] = useState({
    nama_lengkap: "",
    nama_panggilan: "",
    jenis_kelamin: "",
    tanggal_lahir: "",
    status_hidup: "",
    alamat_adat: ""
  });

  // state form perkawinan
  const [perkawinanlist, setPerkawinanlist] = useState([
    {
      id_temp: Date.now(),
      status_perkawinan: "Belum Kawin",
      jenis_perkawinan: "",
      tanggal_perkawinan: "",
      pasangan_id: "",
      tanggal_cerai: "",
      pihak_meninggal: "",
      keputusan_predana: "",
      isPasanganBaru: false,
      dataPasanganBaru: { 
        nama_lengkap: "", 
        nama_panggilan: "",
        tanggal_lahir: "", 
        status_hidup: "Hidup", 
        alamat_adat: "" 
      }
    }
  ]);

  // State relasi orang tua
  const [parentData, setParentData] = useState({
    status_diketahui: "Tidak Diketahui",
    status_hubungan: "Anak Kandung",
    jenis_pengangkatan: "Pasangan",
    selected_perkawinan_id: "",
    selected_parent_id: "",
    tanggal_pengangkatan: "",
    isManual: false,
    manualAyah: { 
      nama_lengkap: "", 
      nama_panggilan: "",
      tanggal_lahir: "", 
      alamat_adat: "",   
      status_hidup: "Hidup" 
    },
    manualIbu: { 
      nama_lengkap: "",
      nama_panggilan: "", 
      tanggal_lahir: "", 
      alamat_adat: "",   
      status_hidup: "Hidup" 
    },
    manualPerkawinan: { 
      status_perkawinan: "Kawin",
      jenis_perkawinan: "Biasa",
      tanggal_perkawinan: "",
      tanggal_cerai: "",        
      pihak_meninggal: "",     
      keputusan_predana: ""     
    },
    manualSingle: { 
      nama_lengkap: "", 
      nama_panggilan: "",
      jenis_kelamin: "Laki-laki", 
      tanggal_lahir: "", 
      alamat_adat: "",   
      status_hidup: "Hidup" 
    }
  });

  // State mengangkat anak
  const [adoptingData, setAdoptingData] = useState({
    status_pengangkatan: "Tidak",
    anak_angkat_id: "",
    tanggal_pengangkatan_anak: "",
    isManual: false,
    manualAnak: {
      nama_lengkap: "",
      nama_panggilan: "",
      jenis_kelamin: "Laki-laki",
      tanggal_lahir: "",
      status_hidup: "Hidup",
      alamat_adat: ""
    }
  });;

  // Efek: Auto-Close Alert
  useEffect(() => {
    if (alert.show && alert.type === 'success' || alert.type === 'error') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ 
          ...prev, 
          show: false 
        }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const resKrama = await axiosInstance.get("/krama-bali");
        setKramaList(resKrama.data.data);

        const resPerkawinan = await axiosInstance.get("/perkawinan");
        setPerkawinanlistOptions(resPerkawinan.data.data);
      } catch (error) {
        console.log(error);
        setAlert({ 
          show: true, 
          type: 'error', 
          message: 'Gagal memuat data master.' 
        });
      }
    };
    fetchData();
  }, []);

  // Helper label orang tua
  const getOrangTuaLabel = (anak) => {
    if (!anak.relasi_orangtua || anak.relasi_orangtua.length === 0) {
      return `${anak.nama_lengkap} (Orang Tua Belum Tercatat)`;
    }
    const relasiTerakhir = anak.relasi_orangtua[anak.relasi_orangtua.length - 1];
    const ayah = kramaList.find(k => k.id === relasiTerakhir.ayah_id);
    const ibu = kramaList.find(k => k.id === relasiTerakhir.ibu_id);
    return `${anak.nama_lengkap} (Ortu: ${ayah?.nama_lengkap} & ${ibu?.nama_lengkap})`;
  };

  // Helper mengambil nama pasangan
  const getPasanganOptions = () => {
    if (!kramaData.jenis_kelamin) {
      return [];
    }
    const targetGender = kramaData.jenis_kelamin === "Laki-laki" ? "Perempuan" : "Laki-laki";
    return kramaList.filter((k) => k.jenis_kelamin === targetGender);
  };
  
  // Helper label perkawinan
  const getPerkawinanLabel = (p) => `${p.suami?.nama_lengkap || "?"} & ${p.istri?.nama_lengkap || "?"} (${p.status_perkawinan})`;

  // Halper perubahan data
  const handleChange = (e) => {
    const { name, value } = e.target;
    setKramaData({ 
      ...kramaData, 
      [name]: value 
    });
    if (name === "jenis_kelamin") {
      setPerkawinanlist([{
        id_temp: Date.now(),
        status_perkawinan: "Belum Kawin",
        jenis_perkawinan: "",
        tanggal_perkawinan: "",
        pasangan_id: "",
        tanggal_cerai: "",
        pihak_meninggal: "",
        keputusan_predana: "",
        isPasanganBaru: false,
        dataPasanganBaru: { 
          nama_lengkap: "", 
          nama_panggilan: "",
          tanggal_lahir: "", 
          status_hidup: "Hidup", 
          alamat_adat: "" 
        }
      }]);
    }
  };

  // Helper menambah kolom input pasangan
  // Perkawinan Poligami
  const tambahBarisPerkawinan = () => {
    setPerkawinanlist([...perkawinanlist, {
      id_temp: Date.now(),
      status_perkawinan: "Kawin",
      jenis_perkawinan: "Biasa",
      tanggal_perkawinan: "",
      pasangan_id: "",
      tanggal_cerai: "",
      pihak_meninggal: "",
      keputusan_predana: "",
      isPasanganBaru: false,
      dataPasanganBaru: { 
        nama_lengkap: "",
        nama_panggilan: "", 
        tanggal_lahir: "", 
        status_hidup: "Hidup", 
        alamat_adat: "" 
      }
    }]);
  };

  const hapusBarisPerkawinan = (index) => {
    const list = [...perkawinanlist];
    list.splice(index, 1);
    setPerkawinanlist(list);
  };

  const handlePerkawinanChange = (index, field, value) => {
    const list = [...perkawinanlist];
    if (field === "pasangan_id") {
      if (value === "NEW_ENTRY") {
        list[index].isPasanganBaru = true;
        list[index].pasangan_id = "";
      } else {
        list[index].isPasanganBaru = false;
        list[index].pasangan_id = value;
      }
    } else {
      list[index][field] = value;
    }
    setPerkawinanlist(list);
  };

  const handlePasanganBaruChange = (index, field, value) => {
    const list = [...perkawinanlist];
    list[index].dataPasanganBaru[field] = value;
    setPerkawinanlist(list);
  };

  // Handler untuk Dropdown & Input Biasa Orang Tua
  const handleParentChange = (e) => {
    const { name, value } = e.target;
    // Logika jika memilih "Input Baru" pada Dropdown Perkawinan/Ortu
    if ((name === "selected_perkawinan_id" || name === "selected_parent_id") && value === "NEW_ENTRY") {
      setParentData({ 
        ...parentData, 
        [name]: "", 
        isManual: true 
      });
    } 
    // Logika jika membatalkan manual (kembali memilih data list)
    else if ((name === "selected_perkawinan_id" || name === "selected_parent_id") && value !== "NEW_ENTRY") {
      setParentData({ 
        ...parentData, 
        [name]: value, 
        isManual: false 
      });
    } 
    else {
      setParentData({ 
        ...parentData, 
        [name]: value 
      });
    }
  };

  // Handler Khusus untuk Input Data Manual (Ayah/Ibu/Single)
  const handleManualParentInput = (type, field, value) => {
    setParentData(prev => ({
      ...prev,
      [type]: {
        ...prev[type],
        [field]: value
      }
    }));
  };

  // Handler Perubahan Data Pengangkatan Anak
  const handleAdoptingChange = (e) => {
    const { name, value } = e.target;
    if (name === "anak_angkat_id") {
      if (value === "NEW_ENTRY") {
        setAdoptingData({ 
          ...adoptingData, 
          anak_angkat_id: "", 
          isManual: true 
        });
      } else {
        setAdoptingData({ 
          ...adoptingData, 
          anak_angkat_id: value, 
          isManual: false 
        });
      }
    } else {
      setAdoptingData({ 
        ...adoptingData, 
        [name]: value 
      });
    }
  };

  // Handler Input Manual Anak
  const handleManualAnakInput = (field, value) => {
    setAdoptingData(prev => ({
      ...prev,
      manualAnak: {
        ...prev.manualAnak,
        [field]: value
      }
    }));
  };

  // Fungsi submit data
  const saveKrama = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const mainRes = await axiosInstance.post("/krama-bali", kramaData);

      const mainId = mainRes.data.data.id;
      let createdMarriageId = null;

      for (const m of perkawinanlist) {
        if (m.status_perkawinan !== "Belum Kawin") {
          let spouseId = m.pasangan_id;
          if (m.isPasanganBaru) {
            const spouseRes = await axiosInstance.post("/krama-bali", { 
              ...m.dataPasanganBaru, 
              jenis_kelamin: kramaData.jenis_kelamin === "Laki-laki" ? "Perempuan" : "Laki-laki" 
            });
            spouseId = spouseRes.data.data.id;
          }

          let payloadP = { 
            status_perkawinan: m.status_perkawinan, 
            jenis_perkawinan: m.jenis_perkawinan, 
            tanggal_perkawinan: m.tanggal_perkawinan, 
            tanggal_cerai: m.tanggal_cerai, 
            pihak_meninggal: m.pihak_meninggal, 
            pilihan_predana: m.keputusan_predana 
          };

          if (kramaData.jenis_kelamin === "Laki-laki") { 
            payloadP.suami_id = mainId; 
            payloadP.istri_id = spouseId; 
          } else { 
            payloadP.suami_id = spouseId; 
            payloadP.istri_id = mainId; 
          }

          const mRes = await axiosInstance.post("/perkawinan", payloadP);

          if(m.status_perkawinan === "Kawin" || m.status_perkawinan === "Cerai" || m.status_perkawinan === "Cerai Mati") {
            // Ambil ID perkawinan yang baru saja di-POST
            createdMarriageId = mRes.data.data.perkawinan ? mRes.data.data.perkawinan.id : mRes.data.data.id;
          }
        }
      }

      // Cek apakah data orang tua perlu diproses
      const processParentData = parentData.status_diketahui === "Diketahui";

      if (processParentData) {
        let finalPerkawinanId = parentData.selected_perkawinan_id;
        let finalSingleParentId = parentData.selected_parent_id;
        // JIKA MODE MANUAL (INPUT BARU)
        if (parentData.isManual) {
          // KASUS 1: INPUT MANUAL PASANGAN (AYAH & IBU)
          if (parentData.status_hubungan === "Anak Kandung" || (parentData.status_hubungan === "Anak Angkat" && parentData.jenis_pengangkatan === "Pasangan")) {
            // 1. Buat Data Ayah (Lengkap)
            const resAyah = await axiosInstance.post("/krama-bali", {
              ...parentData.manualAyah, 
              jenis_kelamin: "Laki-laki"
            });
            const newAyahId = resAyah.data.data.id;
            // 2. Buat Data Ibu (Lengkap)
            const resIbu = await axiosInstance.post("/krama-bali", {
              ...parentData.manualIbu, 
              jenis_kelamin: "Perempuan"
            });
            const newIbuId = resIbu.data.data.id;
            // 3. Buat Data Perkawinan Baru (Sesuai Input)
            const resKawin = await axiosInstance.post("/perkawinan", {
              suami_id: newAyahId,
              istri_id: newIbuId,
              status_perkawinan: parentData.manualPerkawinan.status_perkawinan,
              jenis_perkawinan: parentData.manualPerkawinan.jenis_perkawinan,
              tanggal_perkawinan: parentData.manualPerkawinan.tanggal_perkawinan,
              tanggal_cerai: parentData.manualPerkawinan.tanggal_cerai,
              pihak_meninggal: parentData.manualPerkawinan.pihak_meninggal,
              pilihan_predana: parentData.manualPerkawinan.keputusan_predana
            });
            
            const resData = resKawin.data.data;
            finalPerkawinanId = resData?.id || resData?.perkawinan?.id;

            if (!finalPerkawinanId) {
                throw new Error("Sistem gagal menyambungkan relasi: ID Perkawinan tidak ditemukan.");
            }
          } 
          // KASUS 2: INPUT MANUAL SINGLE PARENT
          else {
            const resSingle = await axiosInstance.post("/krama-bali", {
              ...parentData.manualSingle 
            });
            finalSingleParentId = resSingle.data.data.id;
          }
        }
        console.log("Membuat relasi dengan Perkawinan ID:", finalPerkawinanId)
        let payloadR = { 
          anak_id: mainId, 
          status_hubungan: parentData.status_hubungan, 
          tanggal_pengangkatan: parentData.status_hubungan === "Anak Angkat" ? parentData.tanggal_pengangkatan : null, // TAMBAHKAN KOMA DISINI
          perkawinan_id: finalPerkawinanId
        };

        if (parentData.status_hubungan === "Anak Kandung") {
          payloadR.perkawinan_id = finalPerkawinanId;
        } else if (parentData.status_hubungan === "Anak Angkat") {
          if (parentData.jenis_pengangkatan === "Pasangan") {
            payloadR.perkawinan_id = finalPerkawinanId;
          } else { 
            let genderParent = "";
            if(parentData.isManual) {
              genderParent = parentData.manualSingle.jenis_kelamin;
            } else {
              const pk = kramaList.find(k => k.id === parseInt(finalSingleParentId));
              if(pk) genderParent = pk.jenis_kelamin;
            }

            if (genderParent === "Laki-laki") {
              payloadR.ayah_id = finalSingleParentId;
            } else {
              payloadR.ibu_id = finalSingleParentId;
            } 
          }
        }
        await axiosInstance.post("/relasi-orangtua", payloadR);
      }

      // CEK STATUS PENGANGKATAN
      if (adoptingData.status_pengangkatan === "Mengangkat Anak") {
        // Lakukan jika ID dipilih ATAU Mode Manual aktif
        if (adoptingData.anak_angkat_id || adoptingData.isManual) {
          let finalAnakId = adoptingData.anak_angkat_id;
          // 1. Jika Manual, Buat Data Anak Dulu
          if (adoptingData.isManual) {
            const resAnak = await axiosInstance.post("/krama-bali", {
              ...adoptingData.manualAnak
            });
            finalAnakId = resAnak.data.data.id;
          }
          // 2. Siapkan Payload Relasi
          let payloadA = { 
            anak_id: finalAnakId, 
            status_hubungan: "Anak Angkat", 
            tanggal_pengangkatan: adoptingData.tanggal_pengangkatan_anak 
          };
          // Tentukan Orang Tua Angkatnya (Krama Utama ini)
          if (createdMarriageId) {
            // Jika Krama Utama baru saja menikah di form ini
            payloadA.perkawinan_id = createdMarriageId;
          } else { 
            // Jika Krama Utama single (atau data nikah tidak diinput disini)
            if (kramaData.jenis_kelamin === "Laki-laki") {
              payloadA.ayah_id = mainId;
            } else {
              payloadA.ibu_id = mainId;
            } 
          }
          // 3. Simpan Relasi
          await axiosInstance.post("/relasi-orangtua", payloadA);
        }
      }
      navigate("/keluarga", { 
        state: { 
          successMessage: 'Data krama bali berhasil ditambahkan!' 
        } 
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
    <div className="main-container">
      {/* Alert Action */}
      {alert.show && (
        <div className={`alert-container
          ${alert.type === 'success' ? 'border-green-500 bg-green-50' : alert.type === 'error' ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'}`}>
          <div className="flex items-start p-4">
            {/* Icon */}
            <div className="flex-shrink-0 mr-3 text-2xl">
              {alert.type === 'success' && '✅'}
              {alert.type === 'error' && '⚠️'}
              {alert.type === 'loading' && '⏳'}
            </div>
            {/* Content */}
            <div className="flex-1">
              <h4 className={`font-bold text-sm 
                ${alert.type === 'success' ? 'text-green-800' : alert.type === 'error' ? 'text-red-800' : 'text-blue-800'}`}>
                {alert.type === 'success' ? 'Berhasil!' : alert.type === 'error' ? 'Terjadi Kesalahan' : 'Mohon Tunggu'}
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
          {/* Progress bar line */}
          {(alert.type === 'success' || alert.type === 'error') && (
            <div className="h-1.5 w-full bg-gray-200">
              <div className={`h-full animate-shrink ${alert.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
          )}
        </div>
      )}
      {/* Form Add Krama Bali */}
      <div className="p-8 flex-1 flex flex-col items-center">
        <div className="main-title w-full">
          <h2 className="main-title-h2">
            Menambahkan Anggota Keluarga
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Tambahkan anggota keluarga baru ke dalam silsilah keluarga
          </p>
        </div>
        {/* Form Container */}
        <div className="w-full max-w-3xl bg-white">
          <form onSubmit={saveKrama} className="w-full space-y-8">
            {/* BAGIAN 1: DATA DIRI */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-black border-b pb-2">
                I. Data Diri Krama Bali
              </h3>
              <div className="flex flex-col">
                  <label className="font-bold text-black text-sm">
                    Nama Lengkap:
                  </label>
                  <input 
                    type="text" 
                    name="nama_lengkap" 
                    value={kramaData.nama_lengkap} 
                    onChange={handleChange} 
                    className="field-input"
                    placeholder="Masukkan nama lengkap krama" 
                    required 
                  />
              </div>
              <div className="flex flex-col">
                <label className="font-bold text-black text-sm">
                  Nama Panggilan:
                </label>
                <input 
                  type="text" 
                  name="nama_panggilan" 
                  value={kramaData.nama_panggilan} 
                  onChange={handleChange} 
                  className="field-input" 
                  placeholder="Masukkan nama panggilan krama" 
                  required 
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col">
                  <label className="font-bold text-black text-sm">
                    Jenis Kelamin:
                  </label>
                  <div className="relative">
                    <select name="jenis_kelamin" value={kramaData.jenis_kelamin} onChange={handleChange} className="select-input" required>
                      <option value="">-- Pilih --</option>
                      <option value="Laki-laki">Laki-laki</option>
                      <option value="Perempuan">Perempuan</option>
                    </select>
                    <div className="arrow-down"><FaChevronDown /></div>
                  </div>
                </div>
                <div className="flex flex-col">
                  <label className="font-bold text-black text-sm">
                    Tanggal Lahir:
                  </label>
                  <input 
                    type="date" 
                    name="tanggal_lahir" 
                    value={kramaData.tanggal_lahir} 
                    onChange={handleChange} 
                    className="field-input" 
                    required
                  />
                </div>
              </div>
              <div className="flex flex-col">
                  <label className="font-bold text-black text-sm">
                    Status Hidup:
                  </label>
                  <div className="relative">
                    <select name="status_hidup" value={kramaData.status_hidup} onChange={handleChange} className="select-input" required>
                      <option value="">-- Pilih --</option>
                      <option value="Hidup">Hidup</option>
                      <option value="Meninggal">Meninggal</option>
                    </select>
                    <div className="arrow-down"><FaChevronDown /></div>
                  </div>
              </div>
              <div className="flex flex-col">
                <label className="font-bold text-black text-sm">
                  Alamat Adat:
                </label>
                <input 
                type="text" 
                name="alamat_adat" 
                value={kramaData.alamat_adat} 
                onChange={handleChange} 
                className="field-input" 
                placeholder="Banjar / Desa Adat" 
                required
                />
              </div>
            </div>
            {/* BAGIAN 2: DATA PERKAWINAN */}
            <div className="space-y-6">
              <div className="flex justify-between items-center border-b pb-2">
                <h3 className="text-lg font-bold text-black">
                  II. Data Perkawinan
                </h3>
                {kramaData.jenis_kelamin === "Laki-laki" && (
                  <button type="button" onClick={tambahBarisPerkawinan} className="btn-add2">
                    <FaPlus size={10}/> 
                    Tambah Istri
                  </button>
                )}
              </div>

              {perkawinanlist.map((m, index) => (
                <div key={m.id_temp} className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative">
                  {perkawinanlist.length > 1 && (
                    <button type="button" onClick={() => hapusBarisPerkawinan(index)} className="absolute top-2 right-2 text-red-600 hover:text-red-700 p-2">
                      <FaTrash />
                    </button>
                  )}
                  <div className="flex flex-col mb-5">
                    <label className="font-bold text-black text-sm">
                      Status Perkawinan {perkawinanlist.length > 1 ? ` #${index+1}` : ''}:
                    </label>
                    <div className="relative">
                      <select value={m.status_perkawinan} onChange={(e) => handlePerkawinanChange(index, "status_perkawinan", e.target.value)} className="select-input" required>
                        <option value="Belum Kawin">Belum Kawin</option>
                        <option value="Kawin">Kawin</option>
                        <option value="Cerai">Cerai</option>
                        <option value="Cerai Mati">Cerai Mati</option>
                      </select>
                      <div className="arrow-down">
                        <FaChevronDown />
                      </div>
                    </div>
                  </div>

                  {m.status_perkawinan !== "Belum Kawin" && (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="flex flex-col">
                          <label className="font-bold text-black text-sm">
                            Jenis Perkawinan:
                          </label>
                          <div className="relative">
                            <select value={m.jenis_perkawinan} onChange={(e) => handlePerkawinanChange(index, "jenis_perkawinan", e.target.value)} className="select-input" required>
                              <option value="">-- Pilih --</option>
                              <option value="Biasa">Biasa</option>
                              <option value="Nyentana">Nyentana</option>
                              <option value="Pade Gelahang">Pade Gelahang</option>
                            </select>
                            <div className="arrow-down">
                              <FaChevronDown />
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col">
                          <label className="font-bold text-black text-sm">
                            Tanggal Perkawinan:
                          </label>
                          <input 
                            type="date" 
                            value={m.tanggal_perkawinan} 
                            onChange={(e) => handlePerkawinanChange(index, "tanggal_perkawinan", e.target.value)} 
                            className="field-input" 
                            required 
                          />
                        </div>
                      </div>

                      <div className="flex flex-col">
                          <label className="font-bold text-black text-sm">
                            Nama Pasangan:
                          </label>
                          <div className="relative">
                            <select value={m.isPasanganBaru ? "NEW_ENTRY" : m.pasangan_id} onChange={(e) => handlePerkawinanChange(index, "pasangan_id", e.target.value)} className="select-input" required={!m.isPasanganBaru}>
                                <option value="">-- Pilih Nama Pasangan --</option>
                                <option value="NEW_ENTRY" className="font-bold text-sm text-blue-600">+ Nama Pasangan Baru</option>
                                {getPasanganOptions().map((k) => (
                                  <option key={k.id} value={k.id}>{k.nama_lengkap}</option>
                                ))}
                            </select>
                            <div className="arrow-down">
                              <FaChevronDown />
                            </div>
                          </div>
                      </div>

                      {m.isPasanganBaru && (
                        <div className="p-4 bg-white border-l-4 border-blue-500 rounded shadow-sm">
                          <h4 className="text-sm font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <FaInfoCircle/> Data Pasangan Baru
                          </h4>
                          <div className="space-y-4">
                            <div className="flex flex-col">
                              <label className="font-bold text-black text-sm">
                                Nama Lengkap:
                              </label>
                              <input 
                                type="text" 
                                value={m.dataPasanganBaru.nama_lengkap} 
                                onChange={(e) => handlePasanganBaruChange(index, "nama_lengkap", e.target.value)} 
                                className="field-input" 
                                placeholder="Masukkan nama lengkap pasangan" 
                                required
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="font-bold text-black text-sm">
                                Nama Panggilan:
                              </label>
                              <input 
                                type="text" 
                                value={m.dataPasanganBaru.nama_panggilan} 
                                onChange={(e) => handlePasanganBaruChange(index, "nama_panggilan", e.target.value)} 
                                className="field-input" 
                                placeholder="Masukkan nama panggilan pasangan"
                                required 
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="font-bold text-black text-sm">
                                Tanggal Lahir:
                              </label>
                              <input 
                                type="date" 
                                value={m.dataPasanganBaru.tanggal_lahir} 
                                onChange={(e) => handlePasanganBaruChange(index, "tanggal_lahir", e.target.value)} 
                                className="field-input" 
                                required
                              />
                            </div>
                            <div className="flex flex-col">
                              <label className="font-bold text-black text-sm">
                                Alamat Adat:
                              </label>
                              <input 
                                type="text" 
                                value={m.dataPasanganBaru.alamat_adat} 
                                onChange={(e) => handlePasanganBaruChange(index, "alamat_adat", e.target.value)} 
                                className="field-input" 
                                placeholder="Banjar/ Desa Adat" 
                                required
                              />
                            </div>
                          </div>
                        </div>
                      )}

                      {(m.status_perkawinan === "Cerai" || m.status_perkawinan === "Cerai Mati") && (
                        <div className="pt-2 border-t">
                          <div className="flex flex-col mb-4">
                            <label className="font-bold text-black text-sm">
                              Tanggal Perceraian:
                            </label>
                            <input 
                              type="date" 
                              value={m.tanggal_cerai} 
                              onChange={(e) => handlePerkawinanChange(index, "tanggal_cerai", e.target.value)} 
                              className="field-input"
                              required  
                            />
                          </div>
                          {m.status_perkawinan === "Cerai Mati" && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="flex flex-col">
                                  <label className="font-bold text-black text-sm">
                                    Pihak Meninggal:
                                  </label>
                                  <div className="relative">
                                    <select value={m.pihak_meninggal} onChange={(e) => handlePerkawinanChange(index, "pihak_meninggal", e.target.value)} className="select-input" required>
                                      <option value="">-- Pilih --</option>
                                      {m.jenis_perkawinan === "Pade Gelahang" ? (
                                        <>
                                          <option value="Suami">Suami</option>
                                          <option value="Istri">Istri</option>
                                        </>
                                      ) : (
                                        <>
                                          <option value="Purusa">Purusa</option>
                                          <option value="Predana">Predana</option>
                                        </>
                                      )}
                                    </select>
                                    <div className="arrow-down">
                                      <FaChevronDown />
                                    </div>
                                  </div>
                              </div>
                              <div className="flex flex-col">
                                <label className="font-bold text-black text-sm">Ketetapan Predana:</label>
                                <div className="relative">
                                  <select value={m.keputusan_predana} onChange={(e) => handlePerkawinanChange(index, "keputusan_predana", e.target.value)} className="select-input">
                                    <option value="">-- Pilih --</option>
                                    <option value="Tetap">Tetap</option>
                                    <option value="Kembali ke Asal">Kembali ke Asal</option>
                                  </select>
                                  <div className="arrow-down">
                                    <FaChevronDown />
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      {/* BUTTON CLEAR INPUT PERKAWINAN */}
                      <button type="button" onClick={() => {
                        const list = [...perkawinanlist];

                        list[index] = { 
                          ...list[index], 
                          status_perkawinan: "Belum Kawin", 
                          jenis_perkawinan: "", 
                          pasangan_id: "", 
                          tanggal_cerai: "", 
                          pihak_meninggal: "", 
                          keputusan_predana: "", 
                          isPasanganBaru: false 
                        };

                        setPerkawinanlist(list);
                      }} className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-2 px-4 rounded transition duration-200 flex items-center justify-center gap-2">
                        <FaEraser /> Clear Input Perkawinan
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>     
            {/* BAGIAN 3: DATA ORANG TUA */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-black border-b pb-2">
                III. Data Orang Tua
              </h3>
              
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative">
                {/* 1. Opsi Diketahui/Tidak */}
                <div className="flex flex-col">
                  <label className="mt-1 font-bold text-black text-sm">
                    Keterangan Orang Tua:
                  </label>
                  <div className="relative">
                    <select
                      name="status_diketahui"
                      value={parentData.status_diketahui}
                      onChange={handleParentChange}
                      className="select-input"
                    >
                      <option value="Tidak Diketahui">Tidak Diketahui</option>
                      <option value="Diketahui">Diketahui</option>
                    </select>
                    <div className="arrow-down">
                      <FaChevronDown />
                    </div>
                  </div>
                </div>

                {/* 2. Form Input Orang Tua */}
                {parentData.status_diketahui === "Diketahui" && (
                  <div className="mt-5 space-y-5 border-t border-gray-300 pt-5 animate-fade-in">
                    
                    {/* Status Hubungan */}
                    <div className="flex flex-col">
                      <label className="font-bold text-black text-sm">Status Hubungan:</label>
                      <div className="relative">
                        <select
                          name="status_hubungan"
                          value={parentData.status_hubungan}
                          onChange={handleParentChange}
                          className="select-input"
                        >
                          <option value="Anak Kandung">Anak Kandung</option>
                          <option value="Anak Angkat">Anak Angkat</option>
                        </select>
                        <div className="arrow-down">
                          <FaChevronDown />
                        </div>
                      </div>
                    </div>

                    {/* Radio Button Jenis Pengangkatan */}
                    {parentData.status_hubungan === "Anak Angkat" && (
                      <div className="flex gap-6 py-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="jenis_pengangkatan"
                            value="Pasangan"
                            checked={parentData.jenis_pengangkatan === "Pasangan"}
                            onChange={handleParentChange}
                            className="accent-[#3A2000]"
                          />
                          <span className="text-sm font-bold text-black">Oleh Pasangan</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="jenis_pengangkatan"
                            value="Tunggal"
                            checked={parentData.jenis_pengangkatan === "Tunggal"}
                            onChange={handleParentChange}
                            className="accent-[#3A2000]"
                          />
                          <span className="text-sm font-bold text-black">Oleh Single Parent</span>
                        </label>
                      </div>
                    )}

                    {/* --- LOGIKA TAMPILAN DROPDOWN UTAMA --- */}
                    <div className="flex flex-col">
                      {(parentData.status_hubungan === "Anak Kandung" ||
                        (parentData.status_hubungan === "Anak Angkat" &&
                          parentData.jenis_pengangkatan === "Pasangan")) ? (
                        <>
                          {/* === INPUT ORANG TUA PASANGAN === */}
                          <label className="font-bold text-black text-sm">Nama Orang Tua:</label>
                          <div className="relative">
                            <select
                              name="selected_perkawinan_id"
                              value={parentData.isManual ? "NEW_ENTRY" : parentData.selected_perkawinan_id}
                              onChange={handleParentChange}
                              className="select-input"
                              required
                            >
                              <option value="">-- Pilih Orang Tua --</option>
                              <option value="NEW_ENTRY" className="font-bold text-blue-600">
                                + Input Baru
                              </option>
                              {perkawinanListOptions.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {getPerkawinanLabel(m)}
                                </option>
                              ))}
                            </select>
                            <div className="arrow-down">
                              <FaChevronDown />
                            </div>
                          </div>

                          {/* FORM MANUAL ORANG TUA (AYAH, IBU, PERKAWINAN) */}
                          {parentData.isManual && (
                            <div className="mt-6 space-y-6 animate-fade-in">
                              
                              {/* A. FORM DATA AYAH */}
                              <div className="p-4 bg-blue-50 border border-blue-200 rounded">
                                <h4 className="font-bold text-blue-800 text-sm mb-3 border-b border-blue-200 pb-2">
                                  A. Data Ayah Baru
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Nama Lengkap:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Nama Lengkap Ayah"
                                      value={parentData.manualAyah.nama_lengkap}
                                      onChange={(e) => handleManualParentInput("manualAyah", "nama_lengkap", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Nama Panggilan Ayah:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Nama Panggilan Ayah"
                                      value={parentData.manualAyah.nama_panggilan}
                                      onChange={(e) => handleManualParentInput("manualAyah", "nama_panggilan", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                      <label className="text-xs font-bold text-gray-600 mb-1">
                                        Tanggal Lahir:
                                      </label>
                                      <input
                                        type="date"
                                        value={parentData.manualAyah.tanggal_lahir}
                                        onChange={(e) => handleManualParentInput("manualAyah", "tanggal_lahir", e.target.value)}
                                        className="field-input"
                                        required
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <label className="text-xs font-bold text-gray-600 mb-1">
                                        Status Hidup:
                                      </label>
                                      <select
                                        value={parentData.manualAyah.status_hidup}
                                        onChange={(e) => handleManualParentInput("manualAyah", "status_hidup", e.target.value)}
                                        className="select-input"
                                      >
                                        <option value="Hidup">Hidup</option>
                                        <option value="Meninggal">Meninggal</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Alamat Adat:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Banjar / Desa Adat"
                                      value={parentData.manualAyah.alamat_adat}
                                      onChange={(e) => handleManualParentInput("manualAyah", "alamat_adat", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* B. FORM DATA IBU */}
                              <div className="p-4 bg-pink-50 border border-pink-200 rounded">
                                <h4 className="font-bold text-pink-800 text-sm mb-3 border-b border-pink-200 pb-2">
                                  B. Data Ibu Baru
                                </h4>
                                <div className="space-y-3">
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Nama Lengkap:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Nama Lengkap Ibu"
                                      value={parentData.manualIbu.nama_lengkap}
                                      onChange={(e) => handleManualParentInput("manualIbu", "nama_lengkap", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Nama Panggilan Ibu:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Nama Panggilan Ibu"
                                      value={parentData.manualIbu.nama_panggilan}
                                      onChange={(e) => handleManualParentInput("manualIbu", "nama_panggilan", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                      <label className="text-xs font-bold text-gray-600 mb-1">
                                        Tanggal Lahir:
                                      </label>
                                      <input
                                        type="date"
                                        value={parentData.manualIbu.tanggal_lahir}
                                        onChange={(e) => handleManualParentInput("manualIbu", "tanggal_lahir", e.target.value)}
                                        className="field-input"
                                        required
                                      />
                                    </div>
                                    <div className="flex flex-col">
                                      <label className="text-xs font-bold text-gray-600 mb-1">
                                        Status Hidup:
                                      </label>
                                      <select
                                        value={parentData.manualIbu.status_hidup}
                                        onChange={(e) => handleManualParentInput("manualIbu", "status_hidup", e.target.value)}
                                        className="select-input"
                                      >
                                        <option value="Hidup">Hidup</option>
                                        <option value="Meninggal">Meninggal</option>
                                      </select>
                                    </div>
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Alamat Adat:
                                    </label>
                                    <input
                                      type="text"
                                      placeholder="Banjar / Desa Adat"
                                      value={parentData.manualIbu.alamat_adat}
                                      onChange={(e) => handleManualParentInput("manualIbu", "alamat_adat", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* C. FORM DATA PERKAWINAN ORTU */}
                              <div className="p-4 bg-gray-100 border border-gray-300 rounded">
                                <h4 className="font-bold text-gray-800 text-sm mb-3 border-b border-gray-300 pb-2">
                                  C. Data Perkawinan Orang Tua
                                </h4>
                                <div className="space-y-4">
                                  {/* Baris 1: Status Perkawinan */}
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Status Perkawinan:
                                    </label>
                                    <div className="relative">
                                      <select
                                        value={parentData.manualPerkawinan.status_perkawinan}
                                        onChange={(e) => handleManualParentInput("manualPerkawinan", "status_perkawinan", e.target.value)}
                                        className="select-input text-sm"
                                      >
                                        <option value="Kawin">Kawin</option>
                                        <option value="Cerai">Cerai</option>
                                        <option value="Cerai Mati">Cerai Mati</option>
                                      </select>
                                      <div className="arrow-down">
                                        <FaChevronDown />
                                      </div>
                                    </div>
                                  </div>

                                  {/* Baris 2: Jenis & Tanggal */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex flex-col">
                                      <label className="text-xs font-bold text-gray-600 mb-1">
                                        Jenis Perkawinan:
                                      </label>
                                      <div className="relative">
                                        <select
                                          value={parentData.manualPerkawinan.jenis_perkawinan}
                                          onChange={(e) => handleManualParentInput("manualPerkawinan", "jenis_perkawinan", e.target.value)}
                                          className="select-input text-sm"
                                        >
                                          <option value="Biasa">Biasa</option>
                                          <option value="Nyentana">Nyentana</option>
                                          <option value="Pade Gelahang">Pade Gelahang</option>
                                        </select>
                                        <div className="arrow-down">
                                          <FaChevronDown />
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex flex-col">
                                      <label className="text-xs font-bold text-gray-600 mb-1">
                                        Tanggal Perkawinan:
                                      </label>
                                      <input
                                        type="date"
                                        value={parentData.manualPerkawinan.tanggal_perkawinan}
                                        onChange={(e) => handleManualParentInput("manualPerkawinan", "tanggal_perkawinan", e.target.value)}
                                        className="field-input text-sm"
                                        required
                                      />
                                    </div>
                                  </div>

                                  {/* Baris 3: Kondisional (Cerai / Cerai Mati) */}
                                  {(parentData.manualPerkawinan.status_perkawinan === "Cerai" ||
                                    parentData.manualPerkawinan.status_perkawinan === "Cerai Mati") && (
                                    <div className="space-y-4">
                                      {/* TANGGAL CERAI */}
                                      <div className="flex flex-col">
                                        <label className="text-xs font-bold text-gray-600 mb-1">
                                          Tanggal Perceraian:
                                        </label>
                                        <input
                                          type="date"
                                          value={parentData.manualPerkawinan.tanggal_cerai}
                                          onChange={(e) => handleManualParentInput("manualPerkawinan", "tanggal_cerai", e.target.value)}
                                          className="field-input text-sm"
                                          required
                                        />
                                      </div>
                                      
                                      {/* KHUSUS CERAI MATI */}
                                      {parentData.manualPerkawinan.status_perkawinan === "Cerai Mati" && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="flex flex-col">
                                            <label className="text-xs font-bold text-gray-600 mb-1">
                                              Pihak Meninggal:
                                            </label>
                                            <div className="relative">
                                              <select
                                                value={parentData.manualPerkawinan.pihak_meninggal}
                                                onChange={(e) => handleManualParentInput("manualPerkawinan", "pihak_meninggal", e.target.value)}
                                                className="select-input text-sm"
                                                required
                                              >
                                                <option value="">-- Pilih --</option>
                                                {parentData.manualPerkawinan.jenis_perkawinan === "Pade Gelahang" ? (
                                                  <>
                                                    <option value="Suami">Suami</option>
                                                    <option value="Istri">Istri</option>
                                                  </>
                                                ) : (
                                                  <>
                                                    <option value="Purusa">Purusa</option>
                                                    <option value="Predana">Predana</option>
                                                  </>
                                                )}
                                              </select>
                                              <div className="arrow-down">
                                                <FaChevronDown />
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex flex-col">
                                            <label className="text-xs font-bold text-gray-600 mb-1">
                                              Ketetapan Predana:
                                            </label>
                                            <div className="relative">
                                              <select
                                                value={parentData.manualPerkawinan.keputusan_predana}
                                                onChange={(e) => handleManualParentInput("manualPerkawinan", "keputusan_predana", e.target.value)}
                                                className="select-input text-sm"
                                              >
                                                <option value="">-- Pilih --</option>
                                                <option value="Tetap">Tetap</option>
                                                <option value="Kembali ke Asal">Kembali ke Asal</option>
                                              </select>
                                              <div className="arrow-down">
                                                <FaChevronDown />
                                              </div>
                                            </div>
                                          </div>
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
                          {/* === INPUT SINGLE PARENT === */}
                          <label className="font-bold text-black text-sm">Nama Orang Tua:</label>
                          <div className="relative">
                            <select
                              name="selected_parent_id"
                              value={parentData.isManual ? "NEW_ENTRY" : parentData.selected_parent_id}
                              onChange={handleParentChange}
                              className="select-input"
                              required
                            >
                              <option value="">-- Pilih Orang Tua --</option>
                              <option value="NEW_ENTRY" className="font-bold text-blue-600">
                                + Input Baru
                              </option>
                              {kramaList.map((k) => (
                                <option key={k.id} value={k.id}>
                                  {k.nama_lengkap}
                                </option>
                              ))}
                            </select>
                            <div className="arrow-down">
                              <FaChevronDown />
                            </div>
                          </div>

                          {/* FORM MANUAL SINGLE PARENT */}
                          {parentData.isManual && (
                            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded animate-fade-in">
                              <h4 className="font-bold text-blue-800 text-sm mb-3 border-b border-blue-200 pb-2">
                                Input Data Orang Tua Baru
                              </h4>
                              <div className="space-y-3">
                                <div className="flex flex-col">
                                  <label className="text-xs font-bold text-gray-600 mb-1">
                                    Nama Lengkap:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Nama Lengkap Orang Tua Angkat"
                                    value={parentData.manualSingle.nama_lengkap}
                                    onChange={(e) => handleManualParentInput("manualSingle", "nama_lengkap", e.target.value)}
                                    className="field-input"
                                    required
                                  />
                                </div>
                                <div className="flex flex-col">
                                  <label className="text-xs font-bold text-gray-600 mb-1">
                                    Nama Panggilan:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Nama Panggilan Orang Tua Angkat"
                                    value={parentData.manualSingle.nama_panggilan}
                                    onChange={(e) => handleManualParentInput("manualSingle", "nama_panggilan", e.target.value)}
                                    className="field-input"
                                    required
                                  />
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Jenis Kelamin:
                                    </label>
                                    <select
                                      value={parentData.manualSingle.jenis_kelamin}
                                      onChange={(e) => handleManualParentInput("manualSingle", "jenis_kelamin", e.target.value)}
                                      className="select-input"
                                    >
                                      <option value="Laki-laki">Laki-laki</option>
                                      <option value="Perempuan">Perempuan</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Status Hidup:
                                    </label>
                                    <select
                                      value={parentData.manualSingle.status_hidup}
                                      onChange={(e) => handleManualParentInput("manualSingle", "status_hidup", e.target.value)}
                                      className="select-input"
                                    >
                                      <option value="Hidup">Hidup</option>
                                      <option value="Meninggal">Meninggal</option>
                                    </select>
                                  </div>
                                  <div className="flex flex-col">
                                    <label className="text-xs font-bold text-gray-600 mb-1">
                                      Tanggal Lahir:
                                    </label>
                                    <input
                                      type="date"
                                      value={parentData.manualSingle.tanggal_lahir}
                                      onChange={(e) => handleManualParentInput("manualSingle", "tanggal_lahir", e.target.value)}
                                      className="field-input"
                                      required
                                    />
                                  </div>
                                </div>
                                <div className="flex flex-col">
                                  <label className="text-xs font-bold text-gray-600 mb-1">
                                    Alamat Adat:
                                  </label>
                                  <input
                                    type="text"
                                    placeholder="Banjar / Desa Adat"
                                    value={parentData.manualSingle.alamat_adat}
                                    onChange={(e) => handleManualParentInput("manualSingle", "alamat_adat", e.target.value)}
                                    className="field-input"
                                    required
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* Tanggal Pengangkatan (Khusus Anak Angkat) */}
                    {parentData.status_hubungan === "Anak Angkat" && (
                      <div className="flex flex-col">
                        <label className="font-bold text-black text-sm">
                          Tanggal Pengangkatan:
                        </label>
                        <input
                          type="date"
                          name="tanggal_pengangkatan"
                          value={parentData.tanggal_pengangkatan}
                          onChange={handleParentChange}
                          className="field-input"
                          required
                        />
                      </div>
                    )}

                    {/* Tombol Reset */}
                    <button
                      type="button"
                      onClick={() =>
                        setParentData({
                          status_diketahui: "Tidak Diketahui",
                          status_hubungan: "Anak Kandung",
                          jenis_pengangkatan: "Pasangan",
                          selected_perkawinan_id: "",
                          selected_parent_id: "",
                          tanggal_pengangkatan: "",
                          isManual: false,
                          manualAyah: {
                            nama_lengkap: "",
                            nama_panggilan: "",
                            tanggal_lahir: "",
                            alamat_adat: "",
                            status_hidup: "Hidup",
                          },
                          manualIbu: {
                            nama_lengkap: "",
                            nama_panggilan: "",
                            tanggal_lahir: "",
                            alamat_adat: "",
                            status_hidup: "Hidup",
                          },
                          manualPerkawinan: {
                            status_perkawinan: "Kawin",
                            jenis_perkawinan: "Biasa",
                            tanggal_perkawinan: "",
                            tanggal_cerai: "",
                            pihak_meninggal: "",
                            keputusan_predana: "",
                          },
                          manualSingle: {
                            nama_lengkap: "",
                            nama_panggilan: "",
                            jenis_kelamin: "Laki-laki",
                            tanggal_lahir: "",
                            alamat_adat: "",
                            status_hidup: "Hidup",
                          },
                        })
                      }
                      className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-2 px-4 rounded transition duration-200 flex items-center justify-center gap-2"
                    >
                      <FaEraser /> Reset Input Orang Tua
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* BAGIAN 4: MENGANGKAT ANAK */}
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-black border-b pb-2">
                IV. Status Pengangkatan Anak
              </h3>
              <div className="p-4 border border-gray-200 rounded-lg bg-gray-50 relative">
                {/* 1. Pertanyaan Utama */}
                <div className="flex flex-col">
                  <label className="font-bold text-black text-sm">
                    Apakah krama ini mengangkat anak?
                  </label>
                  <div className="relative">
                    <select
                      name="status_pengangkatan"
                      value={adoptingData.status_pengangkatan}
                      onChange={handleAdoptingChange}
                      className="select-input"
                    >
                      <option value="Tidak">Tidak</option>
                      <option value="Mengangkat Anak">Ya, Mengangkat Anak</option>
                    </select>
                    <div className="arrow-down">
                      <FaChevronDown />
                    </div>
                  </div>
                </div>
                {/* 2. Form Detail Anak Angkat */}
                {adoptingData.status_pengangkatan === "Mengangkat Anak" && (
                  <div className="mt-5 space-y-5 border-t border-gray-300 pt-5 animate-fade-in">
                    {/* Dropdown Cari Anak */}
                    <div className="flex flex-col">
                      <label className="font-bold text-black text-sm">
                        Nama Anak Angkat:
                      </label>
                      <div className="relative">
                        <select
                          name="anak_angkat_id"
                          value={adoptingData.isManual ? "NEW_ENTRY" : adoptingData.anak_angkat_id}
                          onChange={handleAdoptingChange}
                          className="select-input"
                          required
                        >
                          <option value="">-- Pilih --</option>
                          <option value="NEW_ENTRY" className="font-bold text-blue-600">
                            + Input Baru
                          </option>
                          {kramaList.map((k) => (
                            <option key={k.id} value={k.id}>
                              {getOrangTuaLabel(k)}
                            </option>
                          ))}
                        </select>
                        <div className="arrow-down">
                          <FaChevronDown />
                        </div>
                      </div>
                    </div>
                    {/* Form Input Manual Anak Baru */}
                    {adoptingData.isManual && (
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded animate-fade-in">
                        <h4 className="font-bold text-blue-800 text-sm mb-3 border-b border-blue-200 pb-2">
                          Data Anak Angkat
                        </h4>
                        <div className="space-y-3">
                          <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-600 mb-1">
                              Nama Lengkap Anak:
                            </label>
                            <input
                              type="text"
                              placeholder="Masukkan nama lengkap anak"
                              value={adoptingData.manualAnak.nama_lengkap}
                              onChange={(e) => handleManualAnakInput("nama_lengkap", e.target.value)}
                              className="field-input"
                              required
                            />
                          </div>
                          <div className="flex flex-col">
                          <label className="text-xs font-bold text-gray-600 mb-1">
                            Nama Panggilan Anak:
                          </label>
                          <input
                            type="text"
                            placeholder="Masukkan nama panggilan anak"
                            value={adoptingData.manualAnak.nama_panggilan}
                            onChange={(e) => handleManualAnakInput("nama_panggilan", e.target.value)}
                            className="field-input"
                            required
                          />
                        </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="flex flex-col">
                              <label className="text-xs font-bold text-gray-600 mb-1">
                                Jenis Kelamin:
                              </label>
                              <select
                                value={adoptingData.manualAnak.jenis_kelamin}
                                onChange={(e) => handleManualAnakInput("jenis_kelamin", e.target.value)}
                                className="select-input"
                              >
                                <option value="Laki-laki">Laki-laki</option>
                                <option value="Perempuan">Perempuan</option>
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs font-bold text-gray-600 mb-1">
                                Status Hidup:
                              </label>
                              <select
                                value={adoptingData.manualAnak.status_hidup}
                                onChange={(e) => handleManualAnakInput("status_hidup", e.target.value)}
                                className="select-input"
                              >
                                <option value="Hidup">Hidup</option>
                                <option value="Meninggal">Meninggal</option>
                              </select>
                            </div>
                            <div className="flex flex-col">
                              <label className="text-xs font-bold text-gray-600 mb-1">
                                Tanggal Lahir:
                              </label>
                              <input
                                type="date"
                                value={adoptingData.manualAnak.tanggal_lahir}
                                onChange={(e) => handleManualAnakInput("tanggal_lahir", e.target.value)}
                                className="field-input"
                                required
                              />
                            </div>
                          </div>
                          <div className="flex flex-col">
                            <label className="text-xs font-bold text-gray-600 mb-1">
                              Alamat Adat:
                            </label>
                            <input
                              type="text"
                              placeholder="Banjar / Desa Adat"
                              value={adoptingData.manualAnak.alamat_adat}
                              onChange={(e) => handleManualAnakInput("alamat_adat", e.target.value)}
                              className="field-input"
                              required
                            />
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Tanggal Pengangkatan */}
                    <div className="flex flex-col">
                      <label className="font-bold text-black text-sm">
                        Tanggal Pengangkatan:
                      </label>
                      <input
                        type="date"
                        name="tanggal_pengangkatan_anak"
                        value={adoptingData.tanggal_pengangkatan_anak}
                        onChange={handleAdoptingChange}
                        className="field-input"
                        required
                      />
                    </div>
                    {/* Tombol Reset */}
                    <button
                      type="button"
                      onClick={() =>
                        setAdoptingData({
                          status_pengangkatan: "Tidak",
                          anak_angkat_id: "",
                          tanggal_pengangkatan_anak: "",
                          isManual: false,
                          manualAnak: {
                            nama_lengkap: "",
                            nama_panggilan: "",
                            jenis_kelamin: "Laki-laki",
                            tanggal_lahir: "",
                            status_hidup: "Hidup",
                            alamat_adat: "",
                          },
                        })
                      }
                      className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-black font-semibold py-2 px-4 rounded transition duration-200 flex items-center justify-center gap-2"
                    >
                      <FaEraser /> Reset Data Anak Angkat
                    </button>
                  </div>
                )}
              </div>
            </div>
            {/* ACTION BUTTONS */}
            <div className="flex justify-center gap-6 mt-10 pt-4">
              <button type="button" onClick={() => navigate("/keluarga")} className="btn-cencel">
                <FaTimes />
                <span>Cancel</span>
              </button>
              <button type="submit" disabled={isLoading} className={`btn-submit ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}>
                {isLoading ? <div className="loading"></div> : <><FaSave /><span>Submit</span></>}
              </button>
            </div>

          </form>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default KeluargaAdd;