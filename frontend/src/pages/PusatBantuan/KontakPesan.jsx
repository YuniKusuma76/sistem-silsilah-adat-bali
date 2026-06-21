import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MdNotificationsNone } from 'react-icons/md';
import { IoIosSend } from "react-icons/io";
import { 
  FaMapMarkerAlt,
  FaChevronDown,
  FaInfoCircle 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance';
import Footer from '../../components/Footer/Footer';
import styles from './KontakPesan.module.css';

const KontakPesan = ({user}) => {
  const [daftarDesa, setDaftarDesa] = useState([]);
  const [daftarKecamatan, setDaftarKecamatan] = useState([]);
  const [daftarKabupaten, setDaftarKabupaten] = useState([]);
  const [daftarProvinsi, setDaftarProvinsi] = useState([]);

  const [jumlahNotif, setJumlahNotif] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef(null);
  const notifDropdownRef = useRef(null);
  
  const [isDropdownNotifOpen, setIsDropdownNotifOpen] = useState(false);
  const [listNotifikasi, setListNotifikasi] = useState([]);

  // STATE KONTAK PESAN
  const [formData, setFormData] = useState({
    nama_pengirim: '',
    email_address: '',
    kategori_pesan: '',
    pesan: '',
    desa_adat_id: ''
  });

  // State alert notifikasi global
  const [alert, setAlert] = useState({ 
    show: false, 
    type: '', 
    message: '' 
  });

  const VALID_KATEGORI_PESAN = [
    "Umum",
    "Korelasi Aturan Adat Bali",
    "Pusat Bantuan Akun Pengguna",
    "Pengaduan & Kendala Sistem",
    "Pusat Bantuan Krama Adat"
  ];

  // Effect: Mengambil data wilayah adat
  useEffect(() => {
    const fetchSemuaWilayah = async () => {
      try {
        const [resDesa, resKec, resKab, resProv] = await Promise.all([
          axiosInstance.get('/desa-adat'),
          axiosInstance.get('/kecamatan'),
          axiosInstance.get('/kabupaten'),
          axiosInstance.get('/provinsi')
        ]);
        setDaftarDesa(resDesa.data.data || []);
        setDaftarKecamatan(resKec.data.data || []);
        setDaftarKabupaten(resKab.data.data || []);
        setDaftarProvinsi(resProv.data.data || []);
      } catch (error) {
        console.error("Gagal memuat data wilayah adat", error);
      }
    };
    fetchSemuaWilayah();
  }, []);

  // Helper: Fungsi filter desa adat berdasarkan search
  const filteredDesa = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return daftarDesa.filter(desa =>
      desa.nama_desa_adat.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [daftarDesa, searchTerm]);

  // Helper: Fungsi mengambil detail wilayah berdasarkan desa adat id
  const getWilayahLengkap = (desaId) => {
    const desa = daftarDesa.find(d => String(d.id) === String(desaId));
    if (!desa) return null;

    const kec = daftarKecamatan.find(k => String(k.id) === String(desa.kecamatan_id));
    const kab = daftarKabupaten.find(kb => String(kb.id) === String(kec?.kabupaten_id));
    const prov = daftarProvinsi.find(p => String(p.id) === String(kab?.provinsi_id));

    return {
      kecamatan: kec ? kec.nama_kecamatan : '-',
      kabupaten: kab ? kab.nama_kabupaten : '-',
      provinsi: prov ? prov.nama_provinsi : '-'
    };
  };

  // Effect: Menutup dropdown ketika klik di luar area input
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
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
      console.error("Gagal mengambil daftar notifikasi", error);
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

  // Effect: Setting detail pengirim pesan
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        nama_pengirim: user.display_name || user.full_name || '',
        email_address: user.email || ''
      }));
    }
  }, [user]);

  // Effect: Auto-close alert
  useEffect(() => {
    if (alert.show && alert.type !== 'loading') {
      const timer = setTimeout(() => {
        setAlert(prev => ({ ...prev, show: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [alert.show, alert.type]);

  // Helper: Menangani perubahan input form kontak pesan
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ 
      ...prev, 
      [name]: value,
      ...(name === 'kategori_pesan' && value !== 'Pusat Bantuan Krama Adat' && { desa_adat_id: '' })
    }));
    if (name === 'kategori_pesan' && value !== 'Pusat Bantuan Krama Adat') {
      setSearchTerm('');
    }
  };

  // Submit Pesan
  const handleSubmit = async (e) => {
    e.preventDefault();
    setAlert({ 
      show: true, 
      type: 'loading', 
      message: 'Sedang mengirim pesan...' 
    });

    try {
      await axiosInstance.post('/pesan-laporan', formData);
      setFormData(prev => ({
        ...prev,
        pesan: '', 
        kategori_pesan: '',
        desa_adat_id: '',
        nama_pengirim: user ? prev.nama_pengirim : '',
        email_address: user ? prev.email_address : ''
      }));
      setSearchTerm('');
      setAlert({
        show: true,
        type: 'success',
        message: 'Pesan Anda berhasil terkirim! Menunggu pesan ditinjau oleh Admin yang bersangkutan.'
      });
    } catch (error) {
      const errorMessage = error.response?.data?.message || "Gagal mengirim pesan. Periksa kembali koneksi Anda.";
      setAlert({
        show: true,
        type: 'error',
        message: errorMessage
      });
    }
  };

  return (
    <div className={styles.mainContainer}>
      {/* Navbar Section */}
      <nav className={styles.navbar}>
        <div className={styles.navLeft}>
          <h2 className={styles.navTitle}>
            Pusat Bantuan
          </h2>
          <p className={styles.navSubtitle}>
            Informasi, kritik, dan saran Anda dapat Anda kirimkan melalui formulir ini
          </p>
        </div>
        <div className={styles.navRight}>
          <div ref={notifDropdownRef} className="relative">
            <div className={styles.notifWrapper} onClick={() => setIsDropdownNotifOpen(!isDropdownNotifOpen)}>
              <MdNotificationsNone className={styles.notifIcon} />
              {jumlahNotif > 0 && <span className={styles.notifBadge}>{jumlahNotif}</span>}
            </div>
            {/* PANEL DROPDOWN NOTIFIKASI MELAYANG */}
            {isDropdownNotifOpen && (
              <div className={styles.notifDropdownMenu}>
                <div className={styles.notifDropdownHeader}>
                  <h3 className="text-sm font-bold text-gray-800">
                    Pemberitahuan Sistem
                  </h3>
                </div>
                <div className={styles.notifDropdownBody}>
                  {!user ? (
                    <div className="text-center py-6 text-gray-400 italic text-xs">
                      Silakan login untuk melihat pemberitahuan.
                    </div>
                  ) : listNotifikasi.length === 0 ? (
                    <div className="text-center py-6 text-gray-400 italic text-xs">
                      Tidak ada pemberitahuan baru.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 max-h-[320px] overflow-y-auto">
                      {listNotifikasi.map((notif) => (
                        <div key={notif.id} className={`${styles.notifItemRow} ${notif.is_read ? styles.rowRead : styles.rowUnread}`}>
                          <div className="flex-1 pr-2">
                            <div className="flex items-center space-x-1.5 mb-1">
                              <span className={styles.badgeKategoriKecil}>
                                {notif.kategori}
                              </span>
                              <h4 className="text-xs font-bold text-gray-900 truncate max-w-[180px]">
                                {notif.judul}
                              </h4>
                            </div>
                            <p className="text-[11px] text-gray-600 leading-normal">
                              {notif.deskripsi}
                            </p>
                            <span className="text-[9px] text-gray-400 block mt-1">
                              {new Date(notif.createdAt).toLocaleDateString('id-ID')}
                            </span>
                          </div>
                          {!notif.is_read && (
                            <button onClick={() => handleTandaiDibaca(notif.id)}className={styles.btnReadKecil}>
                              Baca
                            </button>
                          )}
                        </div>
                      ))}
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
      {/* Content Form Kontak */}
      <div className={styles.contentArea}>
        <div className={styles.mainGridWrapper}>
          <div className={styles.cardContainer}>
            <form onSubmit={handleSubmit} className="w-full max-w-3xl space-y-6">
              <div>
                <label className={styles.labelInputSelect}>
                  Nama Pengirim <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="nama_pengirim"
                  value={formData.nama_pengirim}
                  onChange={handleChange}
                  disabled={!!user}
                  placeholder="Ketikkan nama Anda disini..."
                  className={styles.inputPilihan}
                  required
                />
              </div>
              <div>
                <label className={styles.labelInputSelect}>
                  E-mail Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email_address"
                  value={formData.email_address}
                  onChange={handleChange}
                  disabled={!!user}
                  placeholder="Ketikkan e-mail aktif Anda disini..."
                  className={styles.inputPilihan}
                  required
                />
              </div>
              <div>
                <label className={styles.labelInputSelect}>
                  Kategori Pesan <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    name="kategori_pesan"
                    value={formData.kategori_pesan}
                    onChange={handleChange}
                    className={styles.inputPilihan}
                    required
                  >
                    <option value="" disabled>- Pilih -</option>
                    {VALID_KATEGORI_PESAN.map((kat, idx) => (
                      <option key={idx} value={kat}>{kat}</option>
                    ))}
                  </select>
                  <div className={styles.selectIcon}>
                    <FaChevronDown />
                  </div>
                </div>
              </div>
              {formData.kategori_pesan === "Pusat Bantuan Krama Adat" && (
                <div ref={dropdownRef} className="space-y-4 animate-fade-in">
                  <div>
                    <label className={styles.labelInputSelect}>
                      Desa Adat Tujuan <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        className={styles.inputPilihan}
                        placeholder="Ketikkan nama desa adat..."
                        value={searchTerm}
                        onChange={(e) => {
                          setSearchTerm(e.target.value);
                          setFormData(prev => ({ ...prev, desa_adat_id: '' }));
                          setIsDropdownOpen(true);
                        }}
                        onFocus={() => setIsDropdownOpen(true)}
                      />
                      <div className={styles.selectIcon}>
                        <FaMapMarkerAlt className={searchTerm ? "text-amber-700" : "text-gray-400"} />
                      </div>
                    </div>
                    {/* Dropdown Hasil Pencarian */}
                    {isDropdownOpen && searchTerm && (
                      <div className={styles.dropdownResult}>
                        {filteredDesa.length > 0 ? (
                          filteredDesa.map((desa) => (
                            <div
                              key={desa.id}
                              className={styles.dropdownItems}
                              onClick={() => {
                                setFormData(prev => ({ ...prev, desa_adat_id: desa.id }));
                                setSearchTerm(desa.nama_desa_adat);
                                setIsDropdownOpen(false);
                              }}
                            >
                              <p className="text-sm font-bold text-gray-800">
                                {desa.nama_desa_adat}
                              </p>
                              <p className="text-[10px] text-gray-500 uppercase">
                                {getWilayahLengkap(desa.id)?.kecamatan} • {getWilayahLengkap(desa.id)?.kabupaten}
                              </p>
                            </div>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500 italic">
                            Desa {searchTerm} tidak ditemukan
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Preview Wilayah Adat Otomatis */}
                  {formData.desa_adat_id && (
                    <div className={styles.previewWilayahAdat}>
                      {(() => {
                        const w = getWilayahLengkap(formData.desa_adat_id);
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
              )}
              <div>
                <label className={styles.labelInputSelect}>
                  Pesan Anda <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="pesan"
                  value={formData.pesan}
                  onChange={handleChange}
                  rows="5"
                  placeholder="Tuliskan detail aspirasi atau kendala Anda di sini"
                  className={styles.inputText}
                  required
                ></textarea>
              </div>
              <div className="flex justify-center pt-10 pb-3">
                <button type="submit" disabled={alert.type === 'loading'} className={styles.btnSubmit}>
                  {alert.type === 'loading' ? 'Sedang Mengirim...' : <><IoIosSend size={21} /> Kirim Laporan</>}
                </button>
              </div>
            </form>
          </div>
          <div className={styles.sideInfoPanel}>
            <h3 className={styles.sidePanelTitle}>
              <FaInfoCircle size={15} className="mr-1" /> 
              <span>Panduan Kategori Pesan</span>
            </h3>
            <p className="text-[10px] text-gray-500 mb-3 leading-relaxed">
              Pilihlah klasifikasi kategori pesan yang sesuai agar laporan atau aspirasi Anda dapat diteruskan ke admin yang tepat.
            </p>
            <div className="space-y-2">
              <div className={styles.infoCardItem}>
                <span className={styles.infoCardBadge}>
                  Umum
                </span>
                <p className={styles.infoCardDesc}>
                  Pertanyaan mendasar, pembahasan informasi santai, kritik, atau saran umum di luar teknis sistem silsilah Adat Bali.
                </p>
              </div>
              <div className={styles.infoCardItem}>
                <span className={styles.infoCardBadge}>
                  Korelasi Aturan Adat Bali
                </span>
                <p className={styles.infoCardDesc}>
                  Konsultasi, penjelasan, atau kendala yang berkaitan dengan aturan hukum/awig-awig Adat Bali.
                </p>
              </div>
              <div className={styles.infoCardItem}>
                <span className={styles.infoCardBadge}>
                  Pusat Bantuan Akun Pengguna
                </span>
                <p className={styles.infoCardDesc}>
                  Kendala teknis seputar pembuatan akun baru krama, kegagalan login sistem, masalah reset password, atau aktivasi profil.
                </p>
              </div>
              <div className={styles.infoCardItem}>
                <span className={styles.infoCardBadge}>
                  Pengaduan & Kendala Sistem
                </span>
                <p className={styles.infoCardDesc}>
                  Laporan kerusakan program (bug), tampilan halaman silsilah yang pecah/error, atau sinkronisasi data seeder wilayah yang macet.
                </p>
              </div>
              <div className={styles.infoCardItem}>
                <span className={styles.infoCardBadge}>
                  Pusat Bantuan Krama Adat
                </span>
                <p className={styles.infoCardDesc}>
                  Pengaduan khusus seputaran teknis adat yang akan diteruskan ke dasbor Prajuru/Admin Desa Adat tujuan Anda.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default KontakPesan;