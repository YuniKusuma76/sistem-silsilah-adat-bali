import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { GrDocumentUpdate } from "react-icons/gr";
import { 
  MdNotificationsNone,
  MdOutlineForwardToInbox,
  MdHelpOutline 
} from 'react-icons/md';
import { 
  FaInbox, 
  FaSearch, 
  FaFilter, 
  FaCalendarAlt, 
  FaUser, 
  FaEnvelope, 
  FaMapMarkerAlt,
  FaInfoCircle,
  FaSpinner,
  FaCheck,
  FaUserShield,
  FaTimes,
  FaChevronDown,
  FaTrash
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './DaftarPesanMasuk.module.css';

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

const DaftarPesanMasuk = ({ user }) => {
  const navigate = useNavigate();
  const [listPesan, setListPesan] = useState([]);
  const [pesanTerpilih, setPesanTerpilih] = useState(null);
  const [loading, setLoading] = useState(true);

  // STATE WILAYAH ADAT:
  const [desaList, setDesaList] = useState([]);
  const [kecamatanList, setKecamatanList] = useState([]);
  const [kabupatenList, setKabupatenList] = useState([]);
  const [provinsiList, setProvinsiList] = useState([]);
  
  const notifDropdownRef = useRef(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterKategori, setFilterKategori] = useState('Semua');

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  const [isModalStatusOpen, setIsModalStatusOpen] = useState(false);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [isModalDeleteOpen, setIsModalDeleteOpen] = useState(false);
  const [deletingPesan, setDeletingPesan] = useState(false);

  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const VALID_KATEGORI_PESAN = [
    "Semua",
    "Umum",
    "Korelasi Aturan Adat Bali",
    "Pusat Bantuan Akun Pengguna",
    "Pengaduan & Kendala Sistem",
    "Pusat Bantuan Krama Adat"
  ];

  const VALID_STATUS_PESAN = [
    "Menunggu", 
    "Diproses", 
    "Selesai"
  ];

  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const [resPesan, resDesa, resKec, resKab, resProv] = await Promise.all([
          axiosInstance.get('/pesan-laporan'),
          axiosInstance.get('/desa-adat'),
          axiosInstance.get('/kecamatan'),
          axiosInstance.get('/kabupaten'),
          axiosInstance.get('/provinsi')
        ]);
        
        setListPesan(resPesan.data.data || []);
        setDesaList(resDesa.data.data || []);
        setKecamatanList(resKec.data.data || []);
        setKabupatenList(resKab.data.data || []);
        setProvinsiList(resProv.data.data || []);
      } catch (error) {
        console.error(error);
        setAlert({
          show: true,
          type: 'error',
          message: error.response?.data?.message || "Terjadi kesalahan pada sistem. Periksa kembali koneksi Anda."
        });
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
  }, []);

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
      desa: desa.nama_desa_adat || "-",
      kecamatan: kec?.nama_kecamatan || "-",
      kabupaten: kab?.nama_kabupaten || "-",
      provinsi: prov?.nama_provinsi || "BALI"
    };
  };

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

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!pesanTerpilih) return;

    setUpdatingStatus(true);
    try {
      await axiosInstance.patch(`/pesan-laporan/update-status/${pesanTerpilih.id}`, {
        status_pesan: statusUpdate
      });
      setListPesan(prevList =>
        prevList.map(p => p.id === pesanTerpilih.id ? { ...p, status_pesan: statusUpdate } : p)
      );
      setPesanTerpilih(prev => ({ ...prev, status_pesan: statusUpdate }));
      setAlert({
        show: true,
        type: 'success',
        message: 'Status pesan/laporan berhasil diperbarui!'
      });
      setIsModalStatusOpen(false);
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || "Terjadi kesalahan ketika memperbarui status pesan. Periksa koneksi Anda."
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeletePesan = async () => {
    if (!pesanTerpilih) return;

    setDeletingPesan(true);
    try {
      await axiosInstance.delete(`/pesan-laporan/${pesanTerpilih.id}`);
      setListPesan(prevList => prevList.filter(p => p.id !== pesanTerpilih.id));
      setPesanTerpilih(null);
      setAlert({
        show: true,
        type: 'success',
        message: 'Pesan/laporan berhasil dihapus dari sistem!'
      });
      setIsModalDeleteOpen(false);
    } catch (error) {
      console.error(error);
      setAlert({
        show: true,
        type: 'error',
        message: error.response?.data?.message || "Terjadi kesalahan ketika menghapus pesan/laporan. Periksa koneksi Anda."
      });
    } finally {
      setDeletingPesan(false);
    }
  };

  const filteredPesan = useMemo(() => {
    return listPesan.filter(pesan => {
      const namaPengirim = pesan.user_pengirim?.full_name || pesan.nama_pengirim || '';
      const isiPesan = pesan.pesan || '';
      const matchSearch = namaPengirim.toLowerCase().includes(searchTerm.toLowerCase()) ||isiPesan.toLowerCase().includes(searchTerm.toLowerCase());
      const matchKategori = filterKategori === 'Semua' || pesan.kategori_pesan === filterKategori;
      return matchSearch && matchKategori;
    });
  }, [listPesan, searchTerm, filterKategori]);

  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  const getStatusClass = (status) => {
    switch (status) {
      case 'Selesai':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'Diproses':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'Menunggu':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getDetailStatusClass = (status) => {
    switch (status) {
      case 'Selesai':
        return 'bg-emerald-100 text-emerald-800';
      case 'Diproses':
        return 'bg-blue-100 text-blue-800';
      case 'Menunggu':
      default:
        return 'bg-amber-100 text-amber-800';
    }
  };

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Laporan & Pesan Masuk
          </h2>
          <p className={styles.navSubtitle}>
            Daftar aspirasi, kendala teknis, dan laporan krama adat Bali yang masuk.
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
          <div className={styles.notifWrapper} onClick={() => navigate('/pesan-masuk/pusat-bantuan')}>
            <MdHelpOutline size={23} className={styles.notifIcon} />
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
      <div className={styles.contentArea}>
        <div className={styles.controlPanel}>
          <div className={styles.searchWrapper}>
            <FaSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Cari nama pengirim atau isi pesan..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          <div className={styles.filterWrapper}>
            <FaFilter className={`${styles.filterIcon} mt-0.5`} />
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className={styles.filterSelect}>
              {VALID_KATEGORI_PESAN.map((kat, idx) => (
                <option key={idx} value={kat}>{kat}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          {loading ? (
            <div className={styles.stateMessage}>
              <div className={`${styles.loadSpinner} animate-spin`}></div>
              <span>Memuat data...</span>
            </div>
          ) : filteredPesan.length === 0 ? (
            <div className={styles.stateMessage}>
              <FaInfoCircle className={styles.infoDataIcon} />
              <p className="text-sm font-medium text-gray-500 italic">
                {searchTerm ? `Pesan "${searchTerm}" tidak ditemukan` : "Tidak ada pesan atau laporan masuk"}
              </p>
            </div>
          ) : (
            <div className={styles.splitGrid}>
              <div className={styles.messageListColumn}>
                {filteredPesan.map((pesan) => {
                  const wilayah = getWilayahLengkap(pesan.desa_adat_id);
                  const namaTampil = pesan.user_pengirim?.full_name || pesan.nama_pengirim || 'Tamu Anonim';
                  const roleTampil = pesan.user_pengirim ? pesan.user_pengirim.role : 'Guest';

                  return (
                    <div
                      key={pesan.id}
                      className={`${styles.pesanCard} ${
                        pesanTerpilih?.id === pesan.id ? styles.pesanCardActive : ''
                      }`}
                      onClick={() => setPesanTerpilih(pesan)}>
                      <div className="flex justify-between items-start mb-2 gap-2">
                        <span className={styles.badgeKategori}>
                          {pesan.kategori_pesan}
                        </span>
                        <span className={styles.dateText}>
                          {new Date(pesan.createdAt).toLocaleString('id-ID', {
                            dateStyle: 'medium',
                            timeStyle: 'short'
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                        <h4 className="text-sm font-bold text-gray-800 truncate flex-1">
                          {namaTampil}
                        </h4>
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border ${getStatusClass(pesan.status_pesan)}`}>
                          {pesan.status_pesan || 'Menunggu'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-1 uppercase tracking-wider">
                        <span className="text-slate-700 font-semibold">
                          {roleTampil}
                        </span>
                      </p>
                      {pesan.desa_adat_id && wilayah && (
                        <div className={styles.locationPesan}>
                          <FaMapMarkerAlt className="mr-1 mb-0.5 flex-shrink-0" />
                          <span className="truncate">
                            {wilayah.desa} • {wilayah.kecamatan}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-end items-center pt-1 gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setPesanTerpilih(pesan);
                            setIsModalDeleteOpen(true);
                          }}
                          className={styles.iconTrash}
                          title="Hapus Laporan">
                          <FaTrash size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className={styles.messageDetailColumn}>
                {pesanTerpilih ? (
                  <div className={styles.detailCard}>
                    <div className={styles.detailHeader}>
                      <div className="flex flex-col">
                        <h3 className="text-base font-bold text-gray-800">
                          Detail Laporan & Pesan Masuk
                        </h3>
                        <span className="text-[11px] text-slate-400 italic">
                          {pesanTerpilih.kategori_pesan}
                        </span>
                      </div>
                      <div className="flex gap-2 items-center">
                        {pesanTerpilih.status_pesan !== "Selesai" && (
                          <button 
                            className={styles.btnSubmit}
                            onClick={() => {
                              setStatusUpdate(pesanTerpilih.status_pesan || 'Menunggu');
                              setIsModalStatusOpen(true);
                            }}>
                            Tindak Lanjuti
                          </button>
                        )}
                        <span className={`${styles.statusStyle} ${getDetailStatusClass(pesanTerpilih.status_pesan)}`}>
                          {(!pesanTerpilih.status_pesan || pesanTerpilih.status_pesan === 'Menunggu') && (
                            <span className="flex h-2 w-2 relative">
                              <span className={styles.dotPulse}></span>
                              <span className={styles.dotPulseLine}></span>
                            </span>
                          )}
                          {pesanTerpilih.status_pesan === 'Diproses' && (
                            <FaSpinner className="animate-spin text-sm" />
                          )}
                          {pesanTerpilih.status_pesan === 'Selesai' && (
                            <FaCheck className="text-sm" />
                          )}
                          <span>{pesanTerpilih.status_pesan || 'Menunggu'}</span>
                        </span>
                      </div>
                    </div>
                    {/* Identitas Pengirim */}
                    <div className={styles.detailMetaGrid}>
                      <div className={styles.columnContainer}>
                        <FaUser className="text-gray-400 w-4" />
                        <div>
                          <p className="text-[10px] uppercase text-gray-400">
                            Pengirim
                          </p>
                          <p className="font-semibold">
                            {pesanTerpilih.user_pengirim?.full_name || pesanTerpilih.nama_pengirim}</p>
                        </div>
                      </div>
                      <div className={styles.columnContainer}>
                        <FaEnvelope className="text-gray-400 w-4" />
                        <div>
                          <p className="text-[10px] uppercase text-gray-400">
                            E-mail
                          </p>
                          <p className="font-bold">
                            {pesanTerpilih.user_pengirim?.email || pesanTerpilih.email_address}
                          </p>
                        </div>
                      </div>
                      <div className={styles.columnContainer}>
                        <FaUserShield className="text-gray-400 w-4 text-base" />
                        <div>
                          <p className="text-[10px] uppercase text-gray-400">
                            Role Pengirim
                          </p>
                          <p className="font-semibold text-slate-700">
                            {pesanTerpilih.user_pengirim?.role || 'Guest'}
                          </p>
                        </div>
                      </div>
                      <div className={styles.columnContainer}>
                        <FaCalendarAlt className="text-gray-400 w-4" />
                        <div>
                          <p className="text-[10px] uppercase text-gray-400">
                            Tanggal Masuk
                          </p>
                          <p className="font-semibold">
                            {new Date(pesanTerpilih.createdAt).toLocaleString('id-ID', { 
                              dateStyle: 'long', timeStyle: 'short' 
                            })}
                          </p>
                        </div>
                      </div>
                      {/* Desa Adat Tujuan */}
                      {pesanTerpilih.desa_adat_id && (() => {
                        const w = getWilayahLengkap(pesanTerpilih.desa_adat_id);
                        if (!w) return null;
                        
                        return (
                          <div className={styles.columnWilayah}>
                            <div className={styles.headerColumnWilayah}>
                              <FaMapMarkerAlt />
                              <span className="uppercase text-[10px] tracking-wider">
                                Wilayah Adat Tujuan
                              </span>
                            </div>
                            <div className={styles.gridWilayah}>
                              <div className="pr-2 flex-1">
                                <p className="text-[9px] uppercase text-slate-400 font-medium">
                                  Desa Adat
                                </p>
                                <p className="font-bold text-amber-900 truncate">
                                  {w.desa}
                                </p>
                              </div>
                              <div className="pl-4 pr-2 flex-1">
                                <p className="text-[9px] uppercase text-slate-400 font-medium">
                                  Kecamatan
                                </p>
                                <p className="font-semibold truncate">
                                  {w.kecamatan}
                                </p>
                              </div>
                              <div className="pl-4 pr-2 flex-1">
                                <p className="text-[9px] uppercase text-slate-400 font-medium">
                                  Kabupaten
                                </p>
                                <p className="font-semibold truncate">
                                  {w.kabupaten}
                                </p>
                              </div>
                              <div className="pl-4 flex-1">
                                <p className="text-[9px] uppercase text-slate-400 font-medium">
                                  Provinsi
                                </p>
                                <p className="font-semibold truncate">
                                  {w.provinsi}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <hr className="my-4 border-slate-100" />
                    <div className="space-y-1">
                      <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Pesan/Laporan
                      </h4>
                      <div className={styles.isiPesanBox}>
                        {pesanTerpilih.pesan}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className={styles.emptyDetailState}>
                    <MdOutlineForwardToInbox  className="text-7xl text-slate-300 mb-2 animate-pulse" />
                    <p className="text-sm text-slate-400 italic">
                      Pilih salah satu pesan untuk melihat isi laporan secara utuh
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* MODAL UPDATE STATUS */}
      {isModalStatusOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} animate-fade-in`}>
            <div className={styles.headerModal}>
              <h3>
                <GrDocumentUpdate size={17} className="mr-1" />
                Perbarui Status Laporan Masuk
              </h3>
              <button onClick={() => setIsModalStatusOpen(false)} className={styles.iconClose}>
                <FaTimes className="text-sm" />
              </button>
            </div>
            <form onSubmit={handleUpdateStatus} className="mt-4 space-y-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                  Status Tindak Lanjut <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                    className={styles.inputSelect}
                    required>
                    {VALID_STATUS_PESAN.map((status, idx) => (
                      <option key={idx} value={status}>{status}</option>
                    ))}
                  </select>
                  <div className={styles.selectIcon}>
                    <FaChevronDown />
                  </div>
                </div>
              </div>
              <div className={styles.noteConf}>
                * Pastikan bahwa pesan/laporan ini memang benar sudah ditindak lanjuti.
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalStatusOpen(false)} className={styles.btnCancel} disabled={updatingStatus}>
                  Batal
                </button>
                <button type="submit" className={styles.btnSaveModal} disabled={updatingStatus}>
                  {updatingStatus ? (
                    <>
                      <FaSpinner className="animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Simpan Perubahan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* MODAL KONFIRMASI DELETE */}
      {isModalDeleteOpen && (
        <div className={styles.modalOverlay}>
          <div className={`${styles.modalContent} text-center animate-fade-in`}>
            <div className={styles.elipsis}>
              <FaTrash size={20} />
            </div>
            <h3 className="text-base font-bold text-slate-800 mb-1">
              Hapus Laporan Ini?
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed px-2">
              Apakah Anda yakin ingin menghapus laporan dari <span className="font-semibold text-slate-700">{pesanTerpilih?.user_pengirim?.full_name || pesanTerpilih?.nama_pengirim}</span>? Tindakan ini bersifat permanen dan data tidak dapat dikembalikan.
            </p>
            <div className="flex justify-center gap-2 mt-6 pt-4">
              <button type="button" onClick={() => setIsModalDeleteOpen(false)} className={styles.btnCancel} disabled={deletingPesan}>
                Batal
              </button>
              <button type="button" onClick={handleDeletePesan} className={styles.btnRejectModal} disabled={deletingPesan}>
                {deletingPesan ? (
                  <>
                    <FaSpinner className="animate-spin" /> Menghapus...
                  </>
                ) : (
                  'Ya, Hapus'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </div>
  );
};

export default DaftarPesanMasuk;