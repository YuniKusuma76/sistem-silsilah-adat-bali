import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  const navigate = useNavigate();
  const location = useLocation();

  const [isLoading, setIsLoading] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [currentKawinRaw, setCurrentKawinRaw] = useState(null);

  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([]);

  // STATE KRAMA UTAMA:
  const [kramaList, setKramaList] = useState([]);
  const [searchDesaUtama, setSearchDesaUtama] = useState("");

  // STATE PERKAWINAN:
  const [searchDesaPasangan, setSearchDesaPasangan] = useState({});
  const [openDesaDropdownIndex, setOpenDesaDropdownIndex] = useState(null);
  const [searchPasangan, setSearchPasangan] = useState({}); 
  const [openDropdownIndex, setOpenDropdownIndex] = useState(null);
  const [perkawinanlist, setPerkawinanlist] = useState([]);

  const notifDropdownRef = useRef(null);
  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

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
    if (slugParam && realId === null) {
      setAlert({
        show: true,
        type: 'danger',
        message: 'Terjadi kesalahan pada server.'
      });
      const timeout = setTimeout(() => {
        navigate('/krama-bali/my-data', { replace: true });
      }, 2000);
      return () => clearTimeout(timeout);
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
          axiosInstance.get("/krama-bali"),
          axiosInstance.get("/desa-adat"),
          axiosInstance.get("/kecamatan"),
          axiosInstance.get("/kabupaten"),
          axiosInstance.get("/provinsi"),
        ]);

        const resKawin = results[0].status === "fulfilled" ? results[0].value.data?.data : null;
        const dataKrama = results[1].status === "fulfilled" ? results[1].value.data?.data : [];
        const dataDesa = results[2].status === "fulfilled" ? results[2].value.data?.data : [];
        const dataKec = results[3].status === "fulfilled" ? results[3].value.data?.data : [];
        const dataKab = results[4].status === "fulfilled" ? results[4].value.data?.data : [];
        const dataProv = results[5].status === "fulfilled" ? results[5].value.data?.data : [];

        setCurrentKawinRaw(resKawin);
        setKramaList(dataKrama || []);
        setDesaList(dataDesa || []);
        setKecamatanList(dataKec || []);
        setKabupatenList(dataKab || []);
        setProvinsiList(dataProv || []);

        // Tentukan Siapa Krama Utama (Anchor) yang sedang dibuka
        const kramaUtama = resKawin?.Suami || resKawin?.Istri; 

        if (kramaUtama) {
          setKramaData({
            nama_lengkap: kramaUtama.nama_lengkap || "",
            nama_panggilan: kramaUtama.nama_panggilan || "",
            jenis_kelamin: kramaUtama.jenis_kelamin || "",
            tanggal_lahir: kramaUtama.tanggal_lahir ? kramaUtama.tanggal_lahir.substring(0, 10) : "",
            status_hidup: kramaUtama.status_hidup || "",
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
        }

        // Sinkronisasi List Formulir Perkawinan
        if (location.state?.riwayatPerkawinanBawaan) {
          const dataLamaDiformat = location.state.riwayatPerkawinanBawaan.map(p => ({
            id_asli_db: p.id,
            status_perkawinan: p.status_perkawinan,
            jenis_perkawinan: p.jenis_perkawinan,
            tanggal_perkawinan: p.tanggal_perkawinan ? p.tanggal_perkawinan.substring(0, 10) : "",
            pasangan_id: String(p.suami_id) === String(kramaUtama?.id) ? p.istri_id : p.suami_id,
            tanggal_cerai: p.tanggal_cerai ? p.tanggal_cerai.substring(0, 10) : "",
            pihak_meninggal: p.pihak_meninggal || "",
            pilihan_predana: p.pilihan_predana || "Kembali ke Asal",
            isPasanganBaru: false,
            isDataLamaTerunci: true
          }));

          setPerkawinanlist([
            ...dataLamaDiformat,
            {
              id_temp: Date.now(),
              status_perkawinan: "Kawin",
              jenis_perkawinan: "Biasa",
              tanggal_perkawinan: "",
              pasangan_id: "",
              tanggal_cerai: "",
              pihak_meninggal: "",
              pilihan_predana: "Kembali ke Asal",
              isPasanganBaru: false,
              dataPasanganBaru: { 
                nama_lengkap: "", nama_panggilan: "", tanggal_lahir: "", 
                status_hidup: "Hidup", is_bali: true, desa_adat_id: "",
                tempat_asal_khusus: "", alamat_luar: "", tipe_data: "Keturunan"
              }
            }
          ]);
        } else if (resKawin) {
          // Fallback Refresh: Gunakan resKawin untuk mengisi form edit baris ke-0
          const idPasanganDb = kramaUtama?.jenis_kelamin === "Laki-laki" ? resKawin.istri_id : resKawin.suami_id;
          const objekPasangan = dataKrama.find(k => String(k.id) === String(idPasanganDb));
          
          if (objekPasangan) {
            setSearchPasangan({ 0: objekPasangan.nama_lengkap });
          }

          setPerkawinanlist([{
            id_asli_db: resKawin.id,
            status_perkawinan: resKawin.status_perkawinan || "Kawin",
            jenis_perkawinan: resKawin.jenis_perkawinan || "Biasa",
            tanggal_perkawinan: resKawin.tanggal_perkawinan ? resKawin.tanggal_perkawinan.substring(0, 10) : "",
            pasangan_id: idPasanganDb,
            tanggal_cerai: resKawin.tanggal_cerai ? resKawin.tanggal_cerai.substring(0, 10) : "",
            pihak_meninggal: resKawin.pihak_meninggal || "",
            pilihan_predana: resKawin.pilihan_predana || "Kembali ke Asal",
            isPasanganBaru: false,
            isDataLamaTerunci: false
          }]);
        } else {
          setAlert({ show: true, type: 'error', message: 'Data perkawinan tidak ditemukan di sistem.' });
        }

      } catch (error) {
        console.error("Error Loading Master Data:", error);
        setAlert({ show: true, type: 'error', message: 'Gagal memuat server data.' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAllData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realId, user]);

  // Effect: Menutup dropdown ketika klik di luar area input
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(event.target)) {
        setIsDropdownNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper: Mengambil list notifikasi yang masuk
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

  // Helper: Menandai notifikasi telah dibaca
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
      return updatedItem;
    });
    setPerkawinanlist(list);
  };

  // HELPER PERKAWINAN: Menangani perubahan data input pasangan baru
  const handlePasanganBaruChange = (index, field, value) => {
    const list = perkawinanlist.map((item, idx) => {
      if (idx !== index) return item;
      if (field === "dataPasanganBaruUtuh") {
        return { ...item, dataPasanganBaru: value };
      }
      return {
        ...item,
        dataPasanganBaru: { ...item.dataPasanganBaru, [field]: value }
      };
    });
    setPerkawinanlist(list);
  };
  
  // HELPER PERKAWINAN: Menambah kolom input pasangan jika poligami
  const tambahBarisPerkawinan = () => {
    setPerkawinanlist([...perkawinanlist, {
      id_temp: Date.now(),
      status_perkawinan: "Kawin",
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

  // HELPER PERKAWINAN: Membersihkan input form perkawinan
  const clearPerkawinan = (index) => {
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
  
  // SUBMIT DATA 
  const saveKrama = async (e) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const mainId = currentKawinRaw?.suami_id || currentKawinRaw?.istri_id;

      for (const m of perkawinanlist) {
        if (m.isDataLamaTerunci) continue;

        const statusMentah = String(m.status_perkawinan || "").trim().toLowerCase();
        const apakahCerai = statusMentah.includes("cerai");
        const apakahCeraiMati = statusMentah.includes("mati");
        const catatanTambahanAdmin = m.catatan_admin_desa || "";

        if (statusMentah !== "belum kawin" && statusMentah !== "") {
          let spouseId = m.pasangan_id;

          if (m.id_asli_db) {
            // 🌟 PROSES UPDATE DATA PERKAWINAN LAMA YANG AKTIF
            const payloadUpdate = {
              suami_id: kramaData?.jenis_kelamin === "Laki-laki" ? mainId : spouseId,
              istri_id: kramaData?.jenis_kelamin === "Laki-laki" ? spouseId : mainId,
              jenis_perkawinan: m.jenis_perkawinan || "Biasa",
              tanggal_perkawinan: m.tanggal_perkawinan || "",
              status_verifikasi: "Disetujui", 
              catatan_tambahan_admin: catatanTambahanAdmin
            };

            await axiosInstance.put(`/perkawinan/update/${m.id_asli_db}`, payloadUpdate);
          } else {
            // 🌟 PROSES POST ENTRI PERKAWINAN BARU (POLIGAMI/BARU)
            let payloadP = { 
              suami_id: kramaData?.jenis_kelamin === "Laki-laki" ? mainId : spouseId,
              istri_id: kramaData?.jenis_kelamin === "Laki-laki" ? spouseId : mainId,
              status_perkawinan: "Kawin", 
              jenis_perkawinan: m.jenis_perkawinan || "Biasa", 
              tanggal_perkawinan: m.tanggal_perkawinan || "" 
            };

            const mRes = await axiosInstance.post("/perkawinan/kawin", payloadP);
            const marriageId = mRes.data?.data?.id;

            if (apakahCerai && marriageId) {
              const jenisMutasiFinal = apakahCeraiMati ? "Cerai Mati" : "Cerai Hidup";
              const payloadCeraiBersih = {
                status_perkawinan: jenisMutasiFinal,
                tanggal_cerai: m.tanggal_cerai || null,
                pihak_meninggal: apakahCeraiMati ? "Pasangan" : null,
                pilihan_predana: m.pilihan_predana || "Kembali ke Asal"
              };
              await axiosInstance.put(`/perkawinan/cerai/${marriageId}`, payloadCeraiBersih);
            }
          }
        }
      }

      navigate("/krama-bali/my-data", { 
        state: { successMessage: 'Data manajemen perkawinan silsilah berhasil disimpan!' } 
      });

    } catch (error) {
      console.error(error);
      setAlert({ show: true, type: 'error', message: error.response?.data?.message || 'Gagal menyimpan perubahan.' });
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
              Pendaftaran Perkawinan Adat Baru
            </h2>
            <p className={styles.navSubtitle}>
              Lengkapi formulir dengan data yang sebenarnya dan sah
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
                        className={styles.inputSelect} 
                        disabled>
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
                      className={styles.inputText}
                      placeholder="Contoh: I Wayan Sudarsana" 
                      disabled 
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
                      placeholder="Contoh: Sudarsana" 
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
                          disabled>
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
                        disabled
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
                          disabled>
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
                  {perkawinanlist.map((m, index) => {
                    // Fungsi menentukan pihak meninggal
                    const apakahPredanaYangMeninggal = (() => {
                      if (m.status_perkawinan !== "Cerai Mati") return false;
                      const kramaUtamaPerempuan = kramaData.jenis_kelamin === "Perempuan";
                      if (m.jenis_perkawinan === "Nyentana") {
                        return (!kramaUtamaPerempuan && m.pihak_meninggal === "Krama Utama") || (kramaUtamaPerempuan && m.pihak_meninggal === "Pasangan");
                      } else {
                        return (kramaUtamaPerempuan && m.pihak_meninggal === "Krama Utama") || (!kramaUtamaPerempuan && m.pihak_meninggal === "Pasangan");
                      }
                    })();
                    return (
                      <div key={m.id_temp || m.id_asli_db} className={`${styles.cardSection} ${m.isDataLamaTerunci ? 'opacity-70 bg-gray-50 border-gray-300' : 'bg-white'}`}>
                        {perkawinanlist.length > 1 && !m.isDataLamaTerunci && (
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
                                disabled={m.isDataLamaTerunci}
                                required>
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
                          {m.status_perkawinan !== "Belum Kawin" && !m.isDataLamaTerunci && (
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
                                    disabled={m.isDataLamaTerunci}
                                    required>
                                    <option value="Biasa">Biasa</option>
                                    <option value="Nyentana">Nyentana</option>
                                    <option value="Pade Gelahang">Pade Gelahang</option>
                                  </select>
                                  {!m.isDataLamaTerunci && (
                                    <div className={styles.selectIcon}>
                                      <FaChevronDown size={12} />
                                    </div>
                                  )}
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
                                  className={styles.inputCalendar}
                                  disabled={m.isDataLamaTerunci}
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
                                  placeholder="Ketikkan nama pasangan terlebih dahulu..."
                                  value={openDropdownIndex === index ? (searchPasangan[index] || "") 
                                    : m.isPasanganBaru ? " Data Pasangan Baru" 
                                    : (kramaList.find(k => String(k.id) === String(m.pasangan_id))?.nama_lengkap || "")
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
                                  required={m.status_perkawinan !== "Belum Kawin" && !m.isPasanganBaru}
                                  disabled={m.isDataLamaTerunci}
                                />
                                {!m.isDataLamaTerunci && (
                                  <div className={styles.termsIcon}>
                                    <FaChevronDown size={12} className={`transition-transform ${openDropdownIndex === index ? 'rotate-180' : ''}`} />
                                  </div>
                                )}
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
                                        }}>
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
                                            }}>
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
                                  {/* Nama Panggilan Pasangn Baru */}
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
                                          setSearchDesaPasangan(prev => ({ ...prev, [index]: "" }));
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
                                    Tanggal Perceraian
                                  </label>
                                  <input 
                                    type="date" 
                                    value={m.tanggal_cerai || ""} 
                                    onChange={(e) => handlePerkawinanChange(index, "tanggal_cerai", e.target.value)} 
                                    className={styles.inputCalendar}
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
                                            className={styles.inputPilihan} 
                                            disabled={m.isDataLamaTerunci}
                                            required={m.status_perkawinan === "Cerai Mati" && kramaData.tipe_data !== "Leluhur"}>
                                            <option value="Pasangan">Pasangan</option>
                                            <option value="Krama Utama">Krama Utama (Form I)</option>
                                          </select>
                                          {!m.isDataLamaTerunci && (
                                            <div className={styles.selectIcon}>
                                              <FaChevronDown />
                                            </div>
                                          )}
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
                                            disabled={m.isDataLamaTerunci}
                                            required={m.status_perkawinan === "Cerai Mati" && kramaData.tipe_data !== "Leluhur"}>
                                            <option value="Tetap">Tetap di Purusa</option>
                                            <option value="Kembali ke Asal">Kembali ke Asal</option>
                                          </select>
                                          {!m.isDataLamaTerunci && (
                                            <div className={styles.selectIcon}>
                                              <FaChevronDown />
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    {/* Catatan Adat Otomatis */}
                                    {apakahPredanaYangMeninggal && (
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
                    );
                  })}
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

export default DataKramaEditKawin;