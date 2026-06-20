import React, { useState, useEffect, useMemo } from 'react';
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
  FaExclamationTriangle
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import Footer from '../../components/Footer/Footer.jsx';
import styles from './DataKramaBaru.module.css';

const DataKramaEditKrama = () => {
  const { id: slugParam } = useParams();

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  
  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([])
  
  // STATE KRAMA UTAMA:
  const [searchDesaUtama, setSearchDesaUtama] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
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
    const fetchDataKrama = async () => {
      if (!realId) return;
      try {
        setIsLoading(true);
        // Promise.allSettled agar satu error yang lain tidak mati
        const results = await Promise.allSettled([
          axiosInstance.get(`/krama-bali/${realId}`),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
        ]);

        const resKrama = results[0].status === "fulfilled" 
          ? results[0].value.data?.data : null;
        const dataDesa = results[1].status === "fulfilled" 
          ? results[1].value.data?.data : [];
        const dataKec  = results[2].status === "fulfilled" 
          ? results[2].value.data?.data : [];
        const dataKab  = results[3].status === "fulfilled" 
          ? results[3].value.data?.data : [];
        const dataProv = results[4].status === "fulfilled" 
          ? results[4].value.data?.data : [];

        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);

        // Setting data lama ke dalam form
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

          // Setting desa adat id lama ke dalam form
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
          message: 'Gagal memuat data master dari server.' 
        });
      } finally {
        setIsLoading(false);
      }
    };
    fetchDataKrama();
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

  // HELPER WILAYAH ADAT: Melakukan filter desa utama berdasarkan search
  const filteredDesa = useMemo(() => {
    if (!searchDesaUtama.trim()) return [];
    return desaList.filter((d) => 
      d.nama_desa_adat.toLowerCase().includes(searchDesaUtama.toLowerCase())
    );
  }, [desaList, searchDesaUtama]); 
  
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

      await axiosInstance.put(`/krama-bali/${realId}`, payloadKrama);

      navigate(`/krama-bali/my-data/detail/${slugParam}`, { 
        state: { successMessage: 'Perubahan data krama bali berhasil disimpan!' } 
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
            Perbarui Data Krama Bali
          </h2>
          <p className={styles.navSubtitle}>
            Perbaiki data lama krama bali dengan data baru yang sebenarnya dan sah
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
      {/* Form Edit Krama Bali */}
      <div className="p-8 flex-1 flex flex-col items-center">
        <div className="w-full max-w-4xl">
          <form onSubmit={saveKrama} className="w-full space-y-8">
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>
                Data Diri Krama Bali
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
      <Footer />
    </div>
  );
};

export default DataKramaEditKrama;