import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaEdit, 
  FaSitemap, 
  FaUser, 
  FaVenusMars, 
  FaBirthdayCake, 
  FaMapMarkerAlt, 
  FaHeart, 
  FaUserFriends, 
  FaCheckCircle, 
  FaTimesCircle, 
  FaIdCard,
  FaUsers
} from 'react-icons/fa';
import { MdHistory } from "react-icons/md";
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// Helper Format Tanggal
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });
};

// Halper Style Badge
const getStatusBadge = (isActive) => {
  if (isActive) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 text-xs font-medium border border-green-200">
        <FaCheckCircle size={10} /> Aktif
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-red-50 text-red-700 text-xs font-medium border border-red-200">
      <FaTimesCircle size={10} /> Non-Aktif
    </span>
  );
};

const KeluargaDetail = () => {
  // State ID
  const { id } = useParams();

  // State Navigasi
  const navigate = useNavigate();
  const location = useLocation(); 

  // State Data Detail Krama Bali
  const [krama, setKrama] = useState(null);
  const [perkawinan, setPerkawinan] = useState([]);
  const [listRelasiOrangTua, setListRelasiOrangTua] = useState([]); 
  const [riwayatKeluarga, setRiwayatKeluarga] = useState([]);
  const [riwayatPeranAdat, setRiwayatPeranAdat] = useState([]);
  const [kepalaKeluargaMap, setKepalaKeluargaMap] = useState({});

  // State UI
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setIsLoading(true);
        const kramaId = parseInt(id);

        const [
          resKramaBali,
          resPerkawinan,
          resRelasiOrangtua,
          resRiwayatKeluarga,
          resRiwayatPeranAdat
        ] = await Promise.all([
          axiosInstance.get(`/krama-bali/${id}`), 
          axiosInstance.get('/perkawinan'),     
          axiosInstance.get('/relasi-orangtua'), 
          axiosInstance.get('/riwayat-keluarga'), 
          axiosInstance.get('/riwayat-peran-adat')
        ]);
        setKrama(resKramaBali.data.data);

        // Set data perkawinan
        const isPerkawinan = resPerkawinan.data.data.filter(
          kawin => kawin.suami_id === kramaId || kawin.istri_id === kramaId
        );
        setPerkawinan(isPerkawinan);

        // Set relasi dengan orang tua
        const allRelasi = resRelasiOrangtua.data.data.filter(
          anak => anak.anak_id === kramaId
        );
        setListRelasiOrangTua(allRelasi);

        // Set riwayat keluarga
        const myRiwayatKeluarga = resRiwayatKeluarga.data.data.filter(
          riwayat => riwayat.krama_id === kramaId
        );
        setRiwayatKeluarga(myRiwayatKeluarga);

        // Set nama kepala keluarga
        const uniqueKepalaIds = [...new Set(myRiwayatKeluarga.map(r => r.keluarga?.kepala_keluarga_id).filter(Boolean))];
        const kepalaMap = {};

        await Promise.all(uniqueKepalaIds.map(async (kepalaId) => {
          try {
            const res = await axiosInstance.get(`/krama-bali/${kepalaId}`);
            if (res.data && res.data.data) {
              kepalaMap[kepalaId] = res.data.data.nama_lengkap;
            }
          } catch (error) {
            console.error(`Gagal fetch kepala keluarga ${kepalaId}`, error);
            kepalaMap[kepalaId] = "Tidak Diketahui";
          }
        }));
        setKepalaKeluargaMap(kepalaMap);

        // Set riwayat peran adat
        const isRiwayatPeranAdat = resRiwayatPeranAdat.data.data.filter(
          riwayat => riwayat.krama_id === kramaId
        );
        setRiwayatPeranAdat(isRiwayatPeranAdat);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    if (id) {
      fetchDetail();
    }
  }, [id]);

  const getLastItem = (array) => (array && array.length > 0 ? array[array.length - 1] : null);
  const lastKawin = getLastItem(perkawinan);
  
  let namaPasangan = "-";

  if (lastKawin) {
    if (lastKawin.suami_id === krama?.id) {
      namaPasangan = lastKawin.istri?.nama_lengkap || "Istri";
    } else {
      namaPasangan = lastKawin.suami?.nama_lengkap || "Suami";
    }
  }

  const orangTuaKandung = listRelasiOrangTua.find(r => r.status_hubungan === 'Anak Kandung');
  const orangTuaAngkatList = listRelasiOrangTua.filter(r => r.status_hubungan === 'Anak Angkat');

  const handleBack = () => {
    if (location.key !== "default") {
      navigate(-1);
    } else {
      navigate('/keluarga');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen ml-72">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#3d2616]"></div>
      </div>
    );
  }

  if (!krama) {
    return <div className="p-8 ml-72 text-center text-gray-500">
      Data krama bali tidak ditemukan
    </div>;
  }

  return (
    <div className="main-container">
      <div className="p-8 flex-1">
        <div className="main-title">
          <h2 className="main-title-h2">
            Detail Anggota Keluarga
          </h2>
          <p className="text-gray-600 text-md mb-5">
            Informasi lengkap mengenai Krama Bali yang termasuk ke dalam silsilah Adat Bali
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Kolom Kiri */}
          <div className="lg:col-span-2 space-y-6 mb-5">
            {/* Card 1: Identitas Krama Bali */}
            <ModernCard title="Identitas Krama Bali" icon={<FaUser className="text-white" />}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <InfoItem 
                  label="Nama Lengkap" 
                  value={krama.nama_lengkap} 
                  icon={<FaIdCard/>} 
                />
                <InfoItem 
                  label="Nama Panggilan" 
                  value={krama.nama_panggilan} 
                  icon={<FaUser/>} 
                />
                <InfoItem 
                  label="Jenis Kelamin" 
                  value={krama.jenis_kelamin} 
                  icon={<FaVenusMars/>} 
                />
                <InfoItem 
                  label="Tanggal Lahir" 
                  value={formatDate(krama.tanggal_lahir)} 
                  icon={<FaBirthdayCake className="mb-1" />} 
                />
                <InfoItem 
                  label="Status Hidup" 
                  value={
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${krama.status_hidup === 'Hidup' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {krama.status_hidup}
                    </span>
                  }
                  icon={<FaHeart className="mb-0.5" />}
                />
                <div className="md:col-span-2">
                  <InfoItem 
                    label="Alamat Adat" 
                    value={krama.alamat_adat} 
                    icon={<FaMapMarkerAlt className="mb-1" />} 
                  />
                </div>
              </div>
            </ModernCard>
            {/* Card 2: Hubungan Keluarga */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-[#3A2000] flex items-center gap-2">
                <FaUsers className="text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Hubungan Keluarga
                </h3>
              </div>
              <div className={`p-6 grid gap-6 ${orangTuaAngkatList.length > 0 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                {/* Blok Orang Tua Kandung */}
                <div className="h-full">
                  <BeigeBlock title="Orang Tua Kandung">
                    <div className="space-y-3">
                      <SimpleRow 
                        label="Ayah" 
                        value={orangTuaKandung?.ayah?.nama_lengkap} />
                      <SimpleRow 
                        label="Ibu" 
                        value={orangTuaKandung?.ibu?.nama_lengkap} />
                      {orangTuaKandung?.urutan_lahir && (
                      <SimpleRow 
                          label="Urutan Lahir" 
                          value={`Anak ke-${orangTuaKandung.urutan_lahir}`} 
                        />
                      )}
                    </div>
                  </BeigeBlock>
                </div>
                {/* Blok Orang Tua Angkat (Looping) */}
                {orangTuaAngkatList.map((angkat, idx) => (
                  <div key={idx} className="h-full">
                    <BeigeBlock title={`Orang Tua Angkat ${orangTuaAngkatList.length > 1 ? `#${idx + 1}` : ''}`}>
                      <div className="space-y-3">
                        <SimpleRow 
                          label="Ayah Angkat" 
                          value={angkat.ayah?.nama_lengkap} 
                        />
                        <SimpleRow 
                          label="Ibu Angkat" 
                          value={angkat.ibu?.nama_lengkap} 
                        />
                        <SimpleRow 
                          label="Tanggal Pengangkatan" 
                          value={formatDate(angkat.tanggal_pengangkatan)} 
                        />
                        {angkat?.urutan_lahir && (
                          <SimpleRow 
                            label="Urutan Lahir" 
                            value={`Anak ke-${angkat.urutan_lahir}`} 
                          />
                        )}
                      </div>
                    </BeigeBlock>
                  </div>
                ))}
              </div>
            </div>
            {/* Card 3: Data Perkawinan Terakhir */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-100 bg-[#3A2000] flex items-center gap-2">
                <FaUserFriends className="text-white" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">
                  Informasi Perkawinan
                </h3>
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Status Perkawinan */}
                  <div className="md:col-span-2">
                    <InfoItem 
                      label="Status Saat Ini" 
                      value={
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${lastKawin ? 'bg-pink-100 text-pink-700' : 'bg-gray-100 text-gray-600'}`}>
                          {lastKawin?.status_perkawinan || "Belum Kawin"}
                        </span>
                      }
                    />
                  </div>
                  {/* Detail Perkawinan */}
                  {lastKawin && lastKawin.status_perkawinan !== "Belum Kawin" && (
                    <>
                      <InfoItem 
                        label="Jenis Perkawinan" 
                        value={lastKawin.jenis_perkawinan} 
                      />
                      <InfoItem 
                        label="Nama Pasangan" 
                        value={namaPasangan} 
                      />
                      <InfoItem 
                        label="Tanggal Perkawinan" 
                        value={formatDate(lastKawin.tanggal_perkawinan)} 
                      />
                      <InfoItem 
                        label="Tanggal Perceraian" 
                        value={
                          <span className="text-red-600 font-semibold">
                            {formatDate(lastKawin.tanggal_cerai)}
                          </span>
                        }
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Kolom Kanan */}
          <div className="space-y-6">
            {/* Card: Riwayat Peran Adat */}
            <ModernCard title="Riwayat Peran Adat" icon={<MdHistory className="text-white" />}>
              <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {riwayatPeranAdat.length === 0 ? (
                  <p className="text-gray-400 text-sm italic text-center py-4">Tidak ada data peran adat.</p>
                ) : (
                  riwayatPeranAdat.map((peran, idx) => (
                    <TimelineItem 
                      key={idx}
                      title={peran.status_peran_adat}
                      date={formatDate(peran.mulai_tanggal)}
                      desc={peran.dasar_keputusan}
                      badge={getStatusBadge(!peran.selesai_tanggal)}
                    />
                  ))
                )}
              </div>
            </ModernCard>
            {/* Card: Riwayat Keluarga & Kedudukan */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-4 flex items-center gap-2">
                <FaSitemap className="mb-1" /> Riwayat Keluarga
              </h3>
              <div className="space-y-4">
                {riwayatKeluarga.length === 0 ? (
                  <p className="text-gray-400 text-sm italic">
                    Belum terdaftar dalam keluarga
                  </p>
                ) : (
                  riwayatKeluarga.map((kel, idx) => {
                    const isActive = kel.akhir_masuk === null;
                    const namaKepala = kepalaKeluargaMap[kel.keluarga?.kepala_keluarga_id] || "...";
                    
                    let jenisKeluarga = kel.keluarga?.jenis_keluarga || "Anggota Keluarga";
                    
                    if (['Biasa', 'Nyentana', 'Pade Gelahang'].includes(jenisKeluarga)) {
                      jenisKeluarga = `Keluarga Perkawinan ${jenisKeluarga}`;
                    }
                    return (
                      <div key={idx} className="border-l-2 border-gray-200 pl-4 pb-4 last:pb-0 relative">
                        <div className={`absolute -left-[5px] top-0 w-2.5 h-2.5 rounded-full ${isActive ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                        <p className="text-xs text-gray-500 mb-1">
                          {formatDate(kel.awal_masuk)} - {isActive ? 'Sekarang' : formatDate(kel.akhir_masuk)}
                        </p>
                        <h4 className="text-sm font-bold text-gray-800">
                          {jenisKeluarga}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Kepala Keluarga: <span className="font-semibold">{namaKepala}</span>
                        </p>
                        <p className="text-xs text-[#3A2000] mt-1 font-medium bg-orange-50 inline-block px-2 py-0.5 rounded">
                          {kel.kedudukan}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Action Buttons */}
        <div className="mt-12 pt-6 flex flex-wrap items-center justify-center gap-4">
          <button 
            onClick={handleBack} 
            className="btn-cencel"
          >
            <FaArrowLeft /> Kembali
          </button>
          <button 
            onClick={() => navigate(`/keluarga/visualisasi/${id}`)} 
            className="btn-visualisasi"
          >
            <FaSitemap /> Visualisasi
          </button>
          <button 
            onClick={() => 
            navigate(`/keluarga/edit/${id}`)} 
            className="btn-update"
          >
            <FaEdit /> Update
          </button>
        </div>
      </div>
      <Footer />
    </div>
  );
};

// SUB-COMPONENT STYLE
const ModernCard = ({ title, icon, children }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
    <div className="p-4 border-b border-gray-100 bg-[#3A2000] flex items-center gap-2">
      {icon}
      <h3 className="text-sm font-bold text-white uppercase tracking-wide">
        {title}
      </h3>
    </div>
    <div className="p-6">
      {children}
    </div>
  </div>
);

const InfoItem = ({ label, value, icon }) => (
  <div className="flex flex-col">
    <div className="flex items-center gap-2 mb-1">
      {icon && <span className="text-gray-400 text-xs">{icon}</span>}
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">
        {label}
      </label>
    </div>
    <div className="text-base font-semibold text-gray-800 break-words">
      {value || "-"}
    </div>
  </div>
);

// Blok Warna Krem 
const BeigeBlock = ({ title, children }) => (
  <div className="bg-[#f9f5f0] p-4 rounded-lg border border-[#e6dccf] hover:shadow-sm transition h-full flex flex-col">
    <p className="text-xs text-[#3A2000] uppercase font-bold mb-3 border-b border-[#dbcab0] pb-1">
      {title}
    </p>
    {children}
  </div>
);

// Baris Simpel untuk BeigeBlock
const SimpleRow = ({ label, value }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-xs text-gray-500 font-medium uppercase min-w-[80px]">
      {label}
    </span>
    <span className="text-sm font-bold text-gray-800 text-right">
      {value || "-"}
    </span>
  </div>
);

// Item Timeline untuk Riwayat
const TimelineItem = ({ title, date, desc, badge }) => (
  <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
    <h4 className="text-sm font-bold text-gray-800 mb-1 leading-tight">
      {title}
    </h4>
    <p className="text-xs text-gray-500 mb-2">
      {date}
    </p>
    {desc && (
      <p className="text-xs mb-2 text-gray-600 bg-gray-50 p-2 rounded italic border border-gray-100">
        {desc}
      </p>
    )}
    <div>{badge}</div>
  </div>
);

export default KeluargaDetail;