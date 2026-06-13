import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  FaArrowLeft, 
  FaSearchPlus, 
  FaSearchMinus, 
  FaUndo,
  FaInfoCircle,
  FaTimes,
  FaSitemap,
  FaCrown,
  FaSeedling 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import styles from './TrehBali.module.css';

// Deklarasi Global: Jenis Kelamin dan Ornamen Tipe Data
const LEGEND_DATA = [
  { 
    id: 'male', 
    type: 'gender', 
    label: 'Laki-laki', 
    className: styles.genderMale 
  },{ 
    id: 'female', 
    type: 'gender', 
    label: 'Perempuan', 
    className: styles.genderFemale 
  },{ 
    id: 'unknown', 
    type: 'gender', 
    label: 'Tidak Diketahui', 
    className: styles.genderUnknown 
  },{ 
    id: 'ancestor', 
    type: 'type_data', 
    label: 'Leluhur', 
    className: styles.ancestorOrnament, 
    icon: <FaCrown className={styles.crownIcon} size={11} /> 
  },
  { 
    id: 'descendant', 
    type: 'type_data', 
    label: 'Keturunan', 
    className: styles.descendantOrnament, 
    icon: <FaSeedling className={styles.seedlingIcon} size={11} /> 
  }
];

// Helper: Membuat slug url
const createSlug = (text) => {
  return text
    .toLowerCase()
    .replace(/ /g, '-')
    .replace(/[^\w-]+/g, '');
};

// Helper: Enkripsi id ke Base64
const encodeId = (id) => btoa(id.toString()).replace(/=/g, '');
const decodeId = (encoded) => {
  try {
    return atob(encoded);
  } catch (error) {
    console.log(error);
    return "akar";
  }
};

const isAncestorNode = (node) => node?.tipe_data?.toLowerCase() === 'leluhur';
const isDescendantNode = (node) => node?.tipe_data?.toLowerCase() === 'keturunan';

// Helper: Mengambil semua status aktif di dalam silsilah tree
const getActiveTreeData = (node, acc = { 
  genders: new Set(), 
  hasAncestor: false, 
  hasDescendant: false 
}) => {
  if (!node) return acc;

  const targetGender = node.jenis_kelamin || node.attributes?.jenis_kelamin;
  const gender = targetGender?.toLowerCase();
  
  if (gender === 'laki-laki' || gender === 'l') {
    acc.genders.add('male');
  } else if (gender === 'perempuan' || gender === 'p') {
    acc.genders.add('female');
  } else {
    acc.genders.add('unknown');
  }

  if (isAncestorNode(node)) acc.hasAncestor = true;
  if (isDescendantNode(node)) acc.hasDescendant = true;

  if (node.pasangan && node.pasangan.length > 0) {
    node.pasangan.forEach(p => {
      const pTargetGender = p.jenis_kelamin || p.attributes?.jenis_kelamin;
      const pGender = pTargetGender?.toLowerCase();

      if (pGender === 'laki-laki' || pGender === 'l') {
        acc.genders.add('male');
      } else if (pGender === 'perempuan' || pGender === 'p') {
        acc.genders.add('female');
      } else {
        acc.genders.add('unknown');
      }
      
      if (isAncestorNode(p)) acc.hasAncestor = true;
      if (isDescendantNode(p)) acc.hasDescendant = true;
    });
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => getActiveTreeData(child, acc));
  }
  return acc;
};

// Sub-Component: Legenda Kompak & Dinamis
const Legenda = ({ activeData }) => {
  const visibleLegend = LEGEND_DATA.filter(item => {
    if (item.type === 'gender') {
      return activeData.genders.has(item.id);
    }
    if (item.id === 'ancestor') {
      return activeData.hasAncestor;
    }
    if (item.id === 'descendant') {
      return activeData.hasDescendant;
    }
    return false;
  });
  
  if (visibleLegend.length === 0) return null;

  return (
    <div className={styles.legendContainer}>
      <h4 className={styles.legendTitle}>
        Legenda
      </h4>
      {visibleLegend.map((item) => (
        <div key={item.id} className={styles.legendItem}>
          <div className={`${styles.legendBox} ${item.className}`}>
            {item.icon || null}
          </div>
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// Sub-Component: Kartu krama bali
const NodeCard = ({ data, onClick, isTarget }) => {
  const isAncestor = isAncestorNode(data);
  const isDescendant = isDescendantNode(data);

  const getGenderClass = (gender, attributes) => {
    const targetGender = gender || attributes?.jenis_kelamin;
    if (!targetGender || targetGender === '-') {
      return styles.genderUnknown;
    }
    
    const g = targetGender.toLowerCase();
    if (g === 'laki-laki' || g === 'l') {
      return styles.genderMale;
    }
    if (g === 'perempuan' || g === 'p') {
      return styles.genderFemale;
    }
    return styles.genderUnknown;
  };

  return (
    <div 
      onClick={() => onClick(data)} 
      className={`${styles.treeCard} 
        ${getGenderClass(data.jenis_kelamin, data.attributes)} 
        ${isTarget ? styles.isTarget : ''}
        ${isAncestor ? styles.cardAncestor : ''}
        ${isDescendant ? styles.cardDescendant : ''}
      `}
    >
      <div className={styles.cardNameContainer}>
        {isAncestor && <FaCrown className={`${styles.crownIcon} mb-1`} size={12} title="Leluhur" />}
        {isDescendant && <FaSeedling className={`${styles.seedlingIcon} mb-1`} size={12} title="Keturunan" />}
        <span className={styles.cardName}>
          {data.nama_panggilan || data.nama_lengkap}
        </span>
      </div>
    </div>
  );
};

// Modal detail data krama bali
const ModalDetail = ({ krama, isOpen, onClose, onVisualize }) => {
  if (!isOpen || !krama) return null;
  const genderDisplay = krama.attributes?.jenis_kelamin || krama.jenis_kelamin;

  return (
    <div className={`${styles.modal}`}>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={`${styles.cardModal} animate-fade-in`}>
        <div className={styles.cardHeader}>
          <h3 className={styles.titleHeader}>
            <FaInfoCircle size={16} className="text-[#c5a059]" /> Detail Data Krama
          </h3>
          <button onClick={onClose} className="hover:rotate-90 transition-transform duration-300">
            <FaTimes />
          </button>
        </div>
        <div className="p-8">
          <div className="text-center mb-8">
            <p className={styles.tipeData}>
              {krama.tipe_data}
            </p>
            <h2 className={styles.namaLengkap}>
              {krama.nama_lengkap}
            </h2>
            {krama.nama_panggilan !== "-" && (
              <p className={styles.namaPanggilan}>
                {krama.nama_panggilan}
              </p>
            )}
          </div>
          <div className={styles.detailContent}>
            <div>
              <p className={styles.titleDetail}>
                Jenis Kelamin
              </p>
              <p className={styles.textDetail}>
                {!genderDisplay || genderDisplay === '-' ? "Tidak Diketahui" : genderDisplay}
              </p>
            </div>
            <div>
              <p className={styles.titleDetail}>
                Pasangan
              </p>
              <p className={styles.textDetail}>
                {krama.attributes?.pasangan === "-" || krama.pasangan_nama === "-" 
                  ? "Tidak Diketahui" 
                  : (krama.attributes?.pasangan || krama.pasangan_nama || "Tidak Diketahui")
                }
              </p>
            </div>
            <div className="col-span-2">
              <p className={styles.titleDetail}>
                Tempat Asal
              </p>
              <p className={styles.textDetail}>
                {krama.tempat_asal_khusus !== "-" 
                  ? krama.tempat_asal_khusus 
                  : (krama.desa_adat_id !== "-" ? krama.desa_adat_id : "Tidak Diketahui")
                }
              </p>
            </div>
          </div>
          <button onClick={() => onVisualize(krama.id)} className={styles.btnTreh}>
            <FaSitemap size={15} className="text-[#c5a059] mb-1" /> JADIKAN TARGET TREH
          </button>
        </div>
      </div>
    </div>
  );
};

const TrehBali = () => {
  const { id: slugParam } = useParams(); 
  const [treeData, setTreeData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [zoomScale, setZoomScale] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKrama, setSelectedKrama] = useState(null);
  const navigate = useNavigate();

  // Mengambil ID Krama paling atas
  const getActiveId = () => {
    if (!slugParam) return "akar";
    const parts = slugParam.split('-');
    return decodeId(parts[parts.length - 1]);
  };

  const actualId = getActiveId();

  // Mengambil data silsilah leluhur
  useEffect(() => {
    const fetchTree = async () => {
      const targetId = actualId;
      if (!targetId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/silsilah/leluhur/${targetId}?depth=5`);
        if (response.data?.data) {
          setTreeData(response.data.data);
        }
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTree();
  }, [actualId]);

  const handleNodeClick = (krama) => {
    setSelectedKrama(krama); 
    setIsModalOpen(true);  
  };

  const handleVisualize = (targetId) => {
    const nameSlug = createSlug(selectedKrama.nama_lengkap);
    const encryptedId = encodeId(targetId);
    
    setIsModalOpen(false); 
    navigate(`/treh-bali/${nameSlug}-${encryptedId}`);
    setZoomScale(1);

    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
  };

  useEffect(() => {
    if (treeData && !isLoading) {
      setTimeout(() => {
        const targetElement = document.querySelector(`.${styles.isTarget}`);
        if (targetElement) {
          targetElement.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'center', 
            inline: 'center' 
          });
        }
      }, 500);
    }
  }, [treeData, isLoading]);

  const renderTree = (node) => {
    if (!node) return null;

    const hasChildren = node.children && node.children.length > 0;
    const hasPasangan = node.pasangan && node.pasangan.length > 0;

    return (
      <li key={node.id} className={hasChildren ? styles.hasChildren : ''}>
        <div className={styles.treeNodeWrapper}>
          <div className={styles.coupleContainer}>
            <NodeCard data={node} onClick={handleNodeClick} isTarget={node.isTarget} />
            {hasPasangan && node.pasangan.map((p) => (
              <React.Fragment key={p.id}>
                <div className={styles.marriageLine}></div>
                <NodeCard data={p} onClick={handleNodeClick} isTarget={false} />
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
      <div className={styles.loadContainer}>
        <div className={styles.loadContent}>
          <div className={styles.loadSpinner}></div>
          <p className={styles.loadText}>
            Memuat treh bali...
          </p>
        </div>
      </div>
    );
  }

  const activeData = treeData ? getActiveTreeData(treeData) : { genders: new Set(), hasAncestor: false, hasDescendant: false };

  return (
    <div className={styles.visualisasi}>
      <div className={styles.navNavigate}>
        <div className={styles.navLeft}>
          <h2 className={styles.titleText}>
            Treh Silsilah Bali
          </h2>
          <p className="text-xs text-gray-600">
            Target Treh: <span className="text-[#937641] font-bold">{treeData?.nama_lengkap}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className={styles.zoomInOut}>
            <button onClick={() => setZoomScale(s => Math.max(0.4, s - 0.1))} className="p-2 hover:text-[#604b23]">
              <FaSearchMinus size={14} />
            </button>
            <span className={styles.persentase}>{Math.round(zoomScale * 100)}%</span>
            <button onClick={() => setZoomScale(s => Math.min(1.8, s + 0.1))} className="p-2 hover:text-[#604b23]">
              <FaSearchPlus size={14} />
            </button>
          </div>
          {/* Button Reset */}
          {slugParam && (
            <button onClick={() => navigate('/treh-bali')} className={styles.btnReset}>
              <FaUndo size={10} /> RESET
            </button>
          )}
          {/* Button Back */}
          <button onClick={() => navigate(-1)} className={styles.btnBack}>
            <FaArrowLeft size={11} /> KEMBALI
          </button>
        </div>
      </div>
      {/* Visualisasi Tree */}
      <div className={styles.areaVisualisasi}>
        <div className={styles.tree} style={{ transform: `scale(${zoomScale})` }}>
          {treeData && <ul>{renderTree(treeData)}</ul>}
        </div>
      </div>
      {/* Legenda */}
      <Legenda activeData={activeData} />
      {/* Modal Detail Krama */}
      <ModalDetail 
        isOpen={isModalOpen}
        krama={selectedKrama}
        onClose={() => setIsModalOpen(false)}
        onVisualize={handleVisualize}
      />
    </div>
  );
};

export default TrehBali;