import React, { useState, useEffect, useMemo } from 'react';
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
  FaSeedling,
  FaUserFriends 
} from 'react-icons/fa';
import axiosInstance from '../../api/axiosInstance.js';
import styles from './SilsilahBali.module.css';

// Deklarasi Global: Jenis kelamin dan tipe data untuk legenda
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
  },{ 
    id: 'descendant', 
    type: 'type_data', 
    label: 'Keturunan', 
    className: styles.descendantOrnament, 
    icon: <FaSeedling className={styles.seedlingIcon} size={11} /> 
  },{ 
    id: 'spouse', 
    type: 'type_data', 
    label: 'Pasangan/Menantu', 
    className: styles.spouseOrnament,
    icon: <FaUserFriends className={styles.spouseIcon} size={11} /> 
  }
];

// Helper: Membuat slug url
const createSlug = (namaLengkap, tipeData, id) => {
  const baseName = namaLengkap ? namaLengkap : 'krama';
  const baseType = tipeData ? tipeData : 'keturunan';

  const safeName = baseName
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const safeType = baseType
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const encodedId = btoa(id.toString()).replace(/=/g, '');
  return `${safeName}-${safeType}-${encodedId}`;
};

// Helper: Melihat tipe data krama
const isAncestorNode = (node) => node?.tipe_data?.toLowerCase() === 'leluhur';
const isDescendantNode = (node) => node?.tipe_data?.toLowerCase() === 'keturunan';
const isSpouseNode = (node) => node?.tipe_data?.toLowerCase() === 'pasangan';

// Helper: Mengambil semua status aktif di dalam silsilah tree
const getActiveTreeData = (node, acc = { 
  genders: new Set(), 
  hasAncestor: false, 
  hasDescendant: false,
  hasSpouse: false 
}) => {
  if (!node) return acc;
  const gender = node.jenis_kelamin?.toLowerCase();
  
  if (gender === 'laki-laki' || gender === 'l') {
    acc.genders.add('male');
  } else if (gender === 'perempuan' || gender === 'p') {
    acc.genders.add('female');
  } else {
    acc.genders.add('unknown');
  }

  if (isAncestorNode(node)) acc.hasAncestor = true;
  if (isDescendantNode(node)) acc.hasDescendant = true;
  if (isSpouseNode(node)) acc.hasSpouse = true;

  if (node.pasangan && node.pasangan.length > 0) {
    node.pasangan.forEach(p => {
      const pGender = p.jenis_kelamin?.toLowerCase();
      if (pGender === 'laki-laki' || pGender === 'l') {
        acc.genders.add('male');
      } else if (pGender === 'perempuan' || pGender === 'p') {
        acc.genders.add('female');
      } else {
        acc.genders.add('unknown');
      }
      if (isSpouseNode(p)) acc.hasSpouse = true;
    });
  }
  if (node.children && node.children.length > 0) {
    node.children.forEach(child => getActiveTreeData(child, acc));
  }
  return acc;
};

// Sub-Component: Legenda pohon silsilah
const Legenda = ({ activeData }) => {
  const visibleLegend = LEGEND_DATA.filter(item => {
    if (item.type === 'gender') {
      return activeData.genders.has(item.id);
    }
    if (item.id === 'ancestor') return activeData.hasAncestor;
    if (item.id === 'descendant') return activeData.hasDescendant;
    if (item.id === 'spouse') return activeData.hasSpouse;
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

// Sub-Component: Node krama bali
const NodeCard = ({ data, onClick, isTarget }) => {
  const isAncestor = isAncestorNode(data);
  const isDescendant = isDescendantNode(data);
  const isSpouse = isSpouseNode(data);

  const getGenderClass = (gender) => {
    if (!gender || gender === '-') {
      return styles.genderUnknown;
    }
    const g = gender.toLowerCase();
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
      onClick={() => onClick(data)} className={`${styles.treeCard} 
        ${getGenderClass(data.jenis_kelamin)} 
        ${isTarget ? styles.isTarget : ''}
        ${isAncestor ? styles.cardAncestor : ''}
        ${isDescendant ? styles.cardDescendant : ''}
        ${isSpouse ? styles.cardSpouse : ''}
      `}
    >
      <div className={styles.cardNameContainer}>
        {isAncestor && <FaCrown className={`${styles.crownIcon} mb-1`} size={17} title="Leluhur" />}
        {isDescendant && <FaSeedling className={`${styles.seedlingIcon} mb-1`} size={17} title="Keturunan" />}
        {isSpouse && <FaUserFriends className={`${styles.spouseIcon} mb-1`} size={17} title="Pasangan/Menantu" />}
        <span className={styles.cardName}>
          {data.nama_panggilan || (() => {
            const words = data.nama_lengkap.trim().split(/\s+/);
            return words.length > 2 ? words.slice(-2).join(' ') : data.nama_lengkap;
          })()}
        </span>
      </div>
    </div>
  );
};

// Sub-component: Modal Detail Krama Bali
const ModalDetail = ({ krama, isOpen, onClose, onVisualize }) => {
  if (!isOpen || !krama) return null;
  const genderDisplay = krama.jenis_kelamin || "Tidak Diketahui";
  const statusHidupDisplay = krama.status_hidup || "Tidak Diketahui";
  const peranAdatDisplay = krama.status_peran_adat || "Tidak Memiliki Status Peran Adat";

  return (
    <div className={styles.modal}>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={`${styles.cardModal} animate-fade-in`}>
        <div className={styles.cardHeader}>
          <h3 className={styles.titleHeader}>
            <FaInfoCircle size={16} className="text-[#c5a059]" /> Detail Data Krama
          </h3>
          <button onClick={onClose} className={styles.iconCloseModal}>
            <FaTimes />
          </button>
        </div>
        <div className="p-8">
          <div className="text-center mb-8">
            <p className={styles.tipeData}>
              {krama.tipe_data || "Krama Bali"}
            </p>
            <h2 className={styles.namaLengkap}>
              {krama.nama_lengkap}
            </h2>
            {krama.nama_panggilan && krama.nama_panggilan !== "-" && (
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
                {genderDisplay}
              </p>
            </div>
            <div>
              <p className={styles.titleDetail}>
                Status Hidup
              </p>
              <p className={styles.textDetail}>
                {statusHidupDisplay}
              </p>
            </div>
            <div>
              <p className={styles.titleDetail}>
                Status Peran Adat
              </p>
              <p className={styles.textDetail}>
                {peranAdatDisplay}
              </p>
            </div>
            <div>
              <p className={styles.titleDetail}>
                Status Perkawinan
              </p>
              <p className={styles.textDetail}>
                {krama.status_perkawinan || "Belum Kawin"}
              </p>
            </div>
            {krama.jenis_perkawinan && krama.jenis_perkawinan !== "-" && (
              <div>
                <p className={styles.titleDetail}>
                  Jenis Perkawinan
                </p>
                <p className={styles.textDetail}>
                  {krama.jenis_perkawinan}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <button 
              onClick={() => {
                onClose();
                const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
                window.location.href = `/krama-bali/detail/${slug}`; 
              }} 
              className={styles.btnDetailTreh}
            >
              <FaInfoCircle size={15} className="mb-0.5" /> LIHAT DETAIL KRAMA
            </button>
            <button onClick={() => onVisualize(krama.id, krama.nama_lengkap)} className={styles.btnTreh}>
              <FaSitemap size={15} /> JADIKAN TARGET TREH
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const SilsilahBali = () => {
  const { id: slugParam } = useParams(); 
  const [isLoading, setIsLoading] = useState(true);

  const [treeData, setTreeData] = useState(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKrama, setSelectedKrama] = useState(null);

  const navigate = useNavigate();
  const [initialTargetId, setInitialTargetId] = useState(null);
  const [initialSlug, setInitialSlug] = useState(null);

  // Helper: Enkripsi dan dekripsi url slug
  const decodeId = (slug) => {
    if (!slug) return null;
    if (!slug.includes('-')) return slug;
    try {
      const parts = slug.split('-');
      const encodedId = parts[parts.length - 1];
      return atob(encodedId);
    } catch {
      return null;
    }
  };

  const encodeId = (id) => btoa(id.toString());
  const createSlug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
  const actualId = useMemo(() => decodeId(slugParam), [slugParam]);

  // Effect: Mengambil data pohon silsilah krama
  useEffect(() => {
    const fetchTree = async () => {
      if (!actualId) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await axiosInstance.get(`/silsilah/krama/${actualId}`);
        if (response.data?.success && response.data?.data) {
          setTreeData(response.data.data);
          if (!initialTargetId) {
            setInitialTargetId(actualId);
            setInitialSlug(slugParam);
          }
        }
      } catch (error) {
        console.error("Gagal memuat pohon silsilah:", error);
        setTreeData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTree();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  // Helper: Menampilkan modal detail krama
  const handleNodeClick = (krama) => {
    setSelectedKrama(krama); 
    setIsModalOpen(true);  
  };

  // Helper: Menangani visualisasi pohon silsilah
  const handleVisualize = (targetId, namaLengkap) => {
    const nameSlug = createSlug(namaLengkap);
    const encryptedId = encodeId(targetId);
    setIsModalOpen(false); 
    navigate(`/krama-bali/detail/silsilah/${nameSlug}-${encryptedId}`);
    setZoomScale(1);
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
  };

  // Effect: Auto-focus layar pada target utama pohon silsilah
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

  // Helper: Rendering node pohon silsilah
  const renderTree = (node) => {
    if (!node) return null;
    const hasChildren = node.children && node.children.length > 0;
    const hasPasangan = node.pasangan && node.pasangan.length > 0;

    return (
      <li key={node.id} className={hasChildren ? styles.hasChildren : ''}>
        <div className={styles.treeNodeWrapper}>
          <div className={styles.coupleContainer}>
            <NodeCard data={node} onClick={handleNodeClick} isTarget={node.is_target} />
            {hasPasangan && node.pasangan.map((p) => (
              <React.Fragment key={p.id}>
                <div className={styles.marriageLine}></div>
                <NodeCard data={p} onClick={handleNodeClick} isTarget={p.is_target} />
              </React.Fragment>
            ))}
          </div>
        </div>
        {hasChildren && (
          <ul>{node.children.map((child) => renderTree(child))}</ul>
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
            MEMUAT SILSILAH...
          </p>
        </div>
      </div>
    );
  }

  const activeData = treeData 
    ? getActiveTreeData(treeData) 
    : { genders: new Set(), hasAncestor: false, hasDescendant: false, hasSpouse: false };

  return (
    <div className={styles.visualisasi}>
      {/* Navbar Section */}
      <div className={styles.navNavigate}>
        <div className={styles.navLeft}>
          <h2 className={styles.titleText}>
            Treh Silsilah Bali
          </h2>
          <p className="text-xs text-gray-600">
            Target Treh: <span className="text-[#937641] font-bold">{treeData?.nama_lengkap || '-'}</span>
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
          {initialTargetId && actualId !== initialTargetId && (
            <button 
              onClick={() => {
                navigate(`/krama-bali/detail/silsilah/${initialSlug}`);
                setZoomScale(1);
              }} 
              className={styles.btnReset}
            >
              <FaUndo size={10} /> RESET
            </button>
          )}
          <button onClick={() => navigate(-1)} className={styles.btnBack}>
            <FaArrowLeft size={11} /> KEMBALI
          </button>
        </div>
      </div>
      {/* Area Pohon Silsilah */}
      <div className={styles.areaVisualisasi}>
        <div className={styles.tree} style={{ transform: `scale(${zoomScale})` }}>
          {treeData ? (
            <ul>{renderTree(treeData)}</ul>
          ) : (
            <p className="text-center text-gray-500 py-10">
              Pohon silsilah tidak ditemukan.
            </p>
          )}
        </div>
      </div>
      {/* Legenda Dinamis */}
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

export default SilsilahBali;