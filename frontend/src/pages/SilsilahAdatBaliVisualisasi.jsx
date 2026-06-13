import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaTimes, 
  FaSearchPlus, 
  FaSearchMinus, 
  FaInfoCircle, 
  FaSitemap,
  FaUserAlt
} from 'react-icons/fa';
import axiosInstance from '../api/axiosInstance.js';
import Footer from '../components/Footer/Footer.jsx';

// SUB-COMPONENT: KARTU ANGGOTA
const NodeCard = ({ data, onClick, isTarget }) => (
  <div 
    onClick={() => onClick(data)} 
    className={`tree-card ${isTarget ? 'is-target' : ''}`}
  >
    <div className="card-name">{data.nama_panggilan || data.nama_lengkap}</div>
  </div>
);

// SUB-COMPONENT: MODAL DETAIL
const KramaDetailModal = ({ krama, isOpen, onClose, onVisualize, onViewDetail }) => {
  if (!isOpen || !krama) return null;

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
        onClick={onClose}
      ></div>
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md animate-fade-in-up overflow-hidden">
        {/* Header */}
        <div className="bg-[#3d2616] p-4 flex justify-between items-center text-white">
          <h3 className="font-bold flex items-center gap-2">
            <FaInfoCircle /> Ringkasan Anggota
          </h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform">
            <FaTimes />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="text-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">{krama.nama_lengkap}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm border-t border-b py-4 mb-6">
            <div>
              <p className="text-gray-500">Peran Adat</p>
              <p className="font-semibold text-gray-800">{krama.status_peran_adat || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Jenis Kelamin</p>
              <p className="font-semibold text-gray-800">{krama.jenis_kelamin}</p>
            </div>
            <div>
              <p className="text-gray-500">Status Perkawinan</p>
              <p className="font-semibold text-gray-800">{krama.status_perkawinan || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500">Jenis Perkawinan</p>
              <p className="font-semibold text-gray-800">{krama.jenis_perkawinan || '-'}</p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3">
            <button 
              onClick={() => onViewDetail(krama.id)} 
              className="w-full py-3 bg-white border-2 border-[#3d2616] text-[#3d2616] rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2 text-sm font-bold transition-colors"
            >
              <FaUserAlt /> Lihat Profil Detail
            </button>
            <button 
              onClick={() => onVisualize(krama.id)} 
              className="w-full py-3 bg-[#3d2616] text-white rounded-lg hover:bg-[#5a3a23] flex items-center justify-center gap-2 text-sm font-bold transition-colors"
            >
              <FaSitemap /> Visualisasikan Silsilah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SilsilahAdatBaliVisualisasi = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [treeData, setTreeData] = useState(null);
  const [selectedKrama, setSelectedKrama] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);

  useEffect(() => {
    const fetchTree = async () => {
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/silsilah/${id}`);
        if (response.data?.data) setTreeData(response.data.data);
      } catch (error) {
        console.error("Fetch Error:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTree();
  }, [id]);

  const handleNodeClick = (krama) => {
    setSelectedKrama(krama);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedKrama(null), 300);
  };

  const handleVisualize = (targetId) => {
    closeModal();
    navigate(`/silsilah-bali/visualisasi/${targetId}`);
    setZoomScale(1);
  };

  const handleViewDetail = (targetId) => {
    navigate(`/silsilah-bali/detail/${targetId}`);
  };

  const renderTree = (node) => {
    if (!node) return null;
    const hasChildren = node.children && node.children.length > 0;
    const hasPasangan = node.pasangan && node.pasangan.length > 0;

    return (
      <li key={node.id} className={hasChildren ? 'has-children' : ''}>
        <div className="tree-node-wrapper">
          <div className="couple-container">
            <NodeCard 
              data={node} 
              onClick={handleNodeClick} 
              isTarget={node.is_target} 
            />
            {hasPasangan && node.pasangan.map((p) => (
              <React.Fragment key={p.id}>
                <div className="marriage-line"></div>
                <NodeCard 
                  data={p} 
                  onClick={handleNodeClick} 
                  isTarget={false} 
                />
              </React.Fragment>
            ))}
          </div>
        </div>
        {hasChildren && (
          <ul>
            {node.children?.map((child) => renderTree(child))}
          </ul>
        )}
      </li>
    );
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#3d2616] border-t-transparent"></div>
      </div>
    );
  }

  if (!treeData) {
    return (
      <div className="flex h-screen items-center justify-center text-red-500 font-bold">
        Data tidak ditemukan atau terjadi kesalahan server.
      </div>
    );
  }

  return (
    <div className="main-container bg-gray-50 min-h-screen flex flex-col">
      {/* Header Navigasi */}
      <div className="p-6 bg-white shadow-md flex justify-between items-center z-50">
        <div>
          <h2 className="text-xl font-bold text-[#3d2616]">Visualisasi Silsilah Keluarga</h2>
          <p className="text-sm text-gray-500 font-medium">Garis Keturunan Utama: {treeData.nama_lengkap}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button 
              onClick={() => setZoomScale(s => Math.max(0.4, s - 0.1))} 
              className="p-2 hover:bg-white rounded shadow-sm transition-all"
            >
              <FaSearchMinus />
            </button>
            <span className="px-3 font-mono text-sm font-bold min-w-[60px] text-center">
              {Math.round(zoomScale * 100)}%
            </span>
            <button 
              onClick={() => setZoomScale(s => Math.min(1.8, s + 0.1))} 
              className="p-2 hover:bg-white rounded shadow-sm transition-all"
            >
              <FaSearchPlus />
            </button>
          </div>
          <button 
            onClick={() => navigate(-1)} 
            className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2 hover:bg-red-700 transition-colors shadow-lg shadow-red-200 text-sm font-bold"
          >
            <FaArrowLeft /> Kembali
          </button>
        </div>
      </div>

      {/* Area Pohon Silsilah */}
      <div className="flex-1 overflow-auto bg-[radial-gradient(#e5e7eb_1.5px,transparent_1.5px)] [background-size:24px_24px] cursor-grab active:cursor-grabbing">
        <div 
          className="tree p-20 min-w-max flex justify-center origin-top transition-transform duration-300 ease-out" 
          style={{ transform: `scale(${zoomScale})` }}
        >
          <ul>{renderTree(treeData)}</ul>
        </div>
      </div>
      
      {/* Modal Detail */}
      <KramaDetailModal 
        isOpen={isModalOpen} 
        krama={selectedKrama} 
        onClose={closeModal} 
        onVisualize={handleVisualize} 
        onViewDetail={handleViewDetail}
      />
      
      <Footer />
    </div>
  );
}

export default SilsilahAdatBaliVisualisasi;