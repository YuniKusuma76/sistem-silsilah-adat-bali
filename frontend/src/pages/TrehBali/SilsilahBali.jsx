import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
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

const DEFAULT_AVATAR_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/default-avatar.jpg";
const SUPABASE_STORAGE_URL = "https://kyhffdvfsionoredjbtb.supabase.co/storage/v1/object/public/photo-krama/";

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
    icon: <FaCrown size={10} /> 
  },{ 
    id: 'descendant', 
    type: 'type_data', 
    label: 'Keturunan', 
    className: styles.descendantOrnament, 
    icon: <FaSeedling size={10} /> 
  },{ 
    id: 'spouse', 
    type: 'type_data', 
    label: 'Pasangan/Menantu', 
    className: styles.spouseOrnament,
    icon: <FaUserFriends size={10} /> 
  },{ 
    id: 'spouse_line', 
    type: 'relation', 
    label: 'Garis Perkawinan', 
    lineStyle: 'bg-pink-500'
  },{ 
    id: 'kandung_line', 
    type: 'relation', 
    label: 'Garis Anak Kandung', 
    lineStyle: 'bg-emerald-500'
  },{ 
    id: 'angkat_line', 
    type: 'relation', 
    label: 'Garis Anak Angkat', 
    lineStyle: 'bg-amber-500'
  }
];

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

const isAncestorNode = (node) => node?.tipe_data?.toLowerCase() === 'leluhur';
const isDescendantNode = (node) => node?.tipe_data?.toLowerCase() === 'keturunan';
const isSpouseNode = (node) => node?.tipe_data?.toLowerCase() === 'pasangan';

const ZoomPercentage = () => {
  return (
    <span className="font-mono text-sm font-bold w-12 text-center text-[#3A2000]">
      ZOOM
    </span>
  );
};

// Helper: mengambil semua status aktif di dalam pohon silsilah
const getActiveTreeData = (node, acc = null) => {
  if (!acc) {
    acc = { 
      genders: new Set(), 
      hasAncestor: false, 
      hasDescendant: false,
      hasSpouse: false,
      hasAnakKandung: false,
      hasAnakAngkat: false
    };
  }

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

  const statusRelasi = (node.status_hubungan || node.status_anak)?.toString().toLowerCase();
  if (statusRelasi?.includes('angkat') || statusRelasi?.includes('adopsi')) {
    acc.hasAnakAngkat = true;
  } else if (node.generasi_ke > 1 || isDescendantNode(node)) {
    acc.hasAnakKandung = true;
  }

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

const findTargetNode = (node) => {
  if (!node) return null;
  if (node.is_target) return node;

  if (node.pasangan && node.pasangan.length > 0) {
    const foundSpouse = node.pasangan.find((p) => p.is_target);
    if (foundSpouse) return foundSpouse;
  }

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const foundChild = findTargetNode(child);
      if (foundChild) return foundChild;
    }
  }

  return null;
};

// Sub-Component: legenda visualisasi silsilah
const Legenda = ({ activeData }) => {
  const visibleLegend = LEGEND_DATA.filter(item => {
    if (item.type === 'gender') {
      return activeData.genders.has(item.id);
    }

    if (item.id === 'ancestor') return activeData.hasAncestor;
    if (item.id === 'descendant') return activeData.hasDescendant;
    if (item.id === 'spouse') return activeData.hasSpouse;
    if (item.id === 'spouse_line') return activeData.hasSpouse;
    if (item.id === 'kandung_line') return activeData.hasAnakKandung;
    if (item.id === 'angkat_line') return activeData.hasAnakAngkat;

    return false;
  });
  
  if (visibleLegend.length === 0) return null;

  return (
    <div className={styles.legendContainer}>
      <h4 className={styles.legendTitle}>Legenda</h4>
      {visibleLegend.map((item) => (
        <div key={item.id} className={styles.legendItem}>
          {item.type === 'relation' ? (
            <div className="w-5 h-1 rounded flex items-center justify-center my-auto">
              <div className={`w-full h-0.5 ${item.lineStyle}`}></div>
            </div>
          ) : (
            <div className={`${styles.legendBox} ${item.className}`}>
              {item.icon || null}
            </div>
          )}
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
};

// Sub-Component: node krama bali
const NodeCard = ({ data, onClick, isTarget, pasanganIndex }) => {
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

  const getAvatarRingClass = () => {
    if (isDescendant) return "border-emerald-500";
    if (isSpouse) return "border-sky-500";
    if (isAncestor) return "border-amber-500";
    return "border-gray-400";
  };

  const getNodeAvatar = (fotoProfile) => {
    if (fotoProfile) {
      return `${SUPABASE_STORAGE_URL}${fotoProfile}`;
    }
    return DEFAULT_AVATAR_URL;
  };

  const getDisplayName = () => {
    if (data.nama_panggilan && data.nama_panggilan !== '-' && data.nama_panggilan.trim() !== '') {
      return data.nama_panggilan;
    }

    const words = (data.nama_lengkap || '').trim().split(/\s+/);
    if (words.length <= 2) {
      return data.nama_lengkap;
    }
    return words.slice(-2).join(' ');
  };

  return (
    <div 
      onClick={() => onClick(data)} 
      className={`${styles.treeCard} 
        ${getGenderClass(data.jenis_kelamin)} 
        ${isTarget ? styles.isTarget : ''}
        ${isAncestor ? styles.cardAncestor : ''}
        ${isDescendant ? styles.cardDescendant : ''}
        ${isSpouse ? styles.cardSpouse : ''}
      `}>
      {isSpouse && pasanganIndex !== undefined && (data.jenis_kelamin?.toLowerCase() === 'perempuan' || data.jenis_kelamin?.toLowerCase() === 'p') && (
        <div className={styles.labelIstri}>
          Istri Ke-{pasanganIndex + 1}
        </div>
      )}
      <div className="relative mt-5 mb-2 flex justify-center items-center">
        <img 
          src={getNodeAvatar(data.foto_profile)} 
          alt={data.nama_lengkap || "Krama Bali"} 
          className={`w-14 h-14 rounded-full object-cover border-2 ${getAvatarRingClass()} ring-1 ring-white shadow-sm`}
          onError={(e) => { e.target.src = DEFAULT_AVATAR_URL; }}
        />
        {isAncestor && (
          <div className={styles.iconLeluhur} title="Leluhur">
            <FaCrown size={10} />
          </div>
        )}
        {isDescendant && (
          <div className={styles.iconKeturunan} title="Keturunan">
            <FaSeedling size={10} />
          </div>
        )}
        {isSpouse && (
          <div className={styles.iconPasangan} title="Pasangan/Menantu">
            <FaUserFriends size={10} />
          </div>
        )}
      </div>
      <span className={styles.nodeDisplayName} title={data.nama_lengkap}>
        {getDisplayName()}
      </span>
      <span className={styles.nodeTipeData}>
        {data.tipe_data || "Krama"}
      </span>
    </div>
  );
};

// Sub-Component: modal detail krama bali
const ModalDetail = ({ krama, isOpen, onClose, onVisualize }) => {
  if (!isOpen || !krama) return null;
  const genderDisplay = krama.jenis_kelamin || "Tidak Diketahui";
  const statusHidupDisplay = krama.status_hidup || "Tidak Diketahui";

  const getBadgeVerifikasiClass = (status) => {
    switch (status) {
      case 'Disetujui':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'Draft':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Ditolak':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const renderFotoProfile = () => {
    if (krama.foto_profile) {
      return `${SUPABASE_STORAGE_URL}${krama.foto_profile}`;
    }
    return DEFAULT_AVATAR_URL;
  };

  return (
    <div className={styles.modal}>
      <div className={styles.overlay} onClick={onClose}></div>
      <div className={`${styles.cardModal} animate-fade-in`}>
        <div className={styles.cardHeader}>
          <h3 className={styles.titleHeader}>
            <FaInfoCircle size={17} /> Informasi Krama Bali
          </h3>
          <button onClick={onClose} className={styles.iconCloseModal}>
            <FaTimes />
          </button>
        </div>
        <div className="p-7">
          <div className="flex flex-col items-center">
            <img 
              src={renderFotoProfile()} 
              alt={krama.nama_lengkap} 
              className={styles.avatarDetail}
              onError={(e) => { e.target.src = DEFAULT_AVATAR_URL; }}
            />
          </div>
          <div className="text-center mb-5">
            <h2 className={styles.namaLengkap}>
              {krama.nama_lengkap}
            </h2>
            {krama.nama_panggilan && krama.nama_panggilan !== "-" && (
              <p className={styles.namaPanggilan}>
                {krama.nama_panggilan}
              </p>
            )}
            <div className="mt-2">
              {krama.status_verifikasi && (
                <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold border ${getBadgeVerifikasiClass(krama.status_verifikasi)}`}>
                  Data {krama.status_verifikasi}
                </span>
              )}
            </div>
          </div>
          <div className={styles.detailContent}>
            <div>
              <p className={styles.titleDetail}>
                Nomor Pendaftaran Krama
              </p>
              <p className={styles.textDetailReg}>
                {krama.nomor_pendaftaran}
              </p>
            </div>
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
                  Perkawinan {krama.jenis_perkawinan}
                </p>
              </div>
            )}
          </div>
          <div className="mt-6 mb-3 grid grid-cols-2 gap-3">
            <button 
              onClick={() => {
                onClose();
                const slug = createSlug(krama.nama_lengkap, krama.tipe_data, krama.id);
                window.location.href = `/krama-bali/detail/${slug}`; 
              }} 
              className={styles.btnDetailTreh}>
              <FaInfoCircle size={15} className="mb-0.5" /> LIHAT DETAIL KRAMA
            </button>
            <button onClick={() => onVisualize(krama.id, krama.nama_lengkap, krama.tipe_data)} className={styles.btnTreh}>
              <FaSitemap size={15} className="mb-0.5" /> JADIKAN TARGET TREH
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedKrama, setSelectedKrama] = useState(null);

  const navigate = useNavigate();
  const [initialTargetId, setInitialTargetId] = useState(null);
  const [initialSlug, setInitialSlug] = useState(null);

  const decodeId = (slug) => {
    if (!slug) return null;
    if (!slug.includes('-')) return slug;
    try {
      const parts = slug.split('-');
      const encodedId = parts[parts.length - 1];
      let base64 = encodedId;
      while (base64.length % 4 !== 0) {
        base64 += '=';
      }
      return atob(base64);
    } catch {
      return null;
    }
  };

  const actualId = useMemo(() => decodeId(slugParam), [slugParam]);

  // Helper: mengambil data pohon silsilah
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
        console.error("Gagal memuat pohon silsilah Adat Bali:", error);
        setTreeData(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchTree();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualId]);

  const targetKrama = useMemo(() => {
    if (!treeData) return null;
    return findTargetNode(treeData) || treeData;
  }, [treeData]);

  const handleNodeClick = (krama) => {
    setSelectedKrama(krama); 
    setIsModalOpen(true);  
  };

  const handleVisualize = (targetId, namaLengkap, tipeData) => {
    const newSlug = createSlug(namaLengkap, tipeData, targetId);
    setIsModalOpen(false); 
    navigate(`/krama-bali/detail/silsilah/${newSlug}`);
    window.scrollTo({ 
      top: 0, 
      behavior: 'smooth' 
    });
  };

  // Helper: memfokuskan pada target silsilah
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

  const getLineColorClass = (statusHubungan) => {
    if (!statusHubungan) return styles.lineAnakKandung;
    const statusStr = String(statusHubungan).toLowerCase();
    
    if (statusStr.includes('angkat') || statusStr.includes('adopsi')) {
      return styles.lineAnakAngkat;
    }
    return styles.lineAnakKandung;
  };

  // Helper: rendering node pohon silsilah
  const renderTree = (node) => {
    if (!node) return null;
    const hasChildren = node.children && node.children.length > 0;
    const hasPasangan = node.pasangan && node.pasangan.length > 0;

    return (
      <li 
        key={node.id} 
        className={`
          ${hasChildren ? styles.hasChildren : ''} 
          ${getLineColorClass(node.status_hubungan || node.status_anak)}
        `}>
        <div className={styles.treeNodeWrapper}>
          <div className={styles.coupleContainer}>
            <NodeCard data={node} onClick={handleNodeClick} isTarget={node.is_target} />
            {hasPasangan && node.pasangan.map((p, index) => (
              <React.Fragment key={p.id}>
                <div className={styles.marriageLine}></div>
                <NodeCard 
                  data={p} 
                  onClick={handleNodeClick} 
                  isTarget={p.is_target} 
                  pasanganIndex={index}
                />
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
      <div className={styles.navNavigate}>
        <div className={styles.navLeft}>
          <h2 className={styles.titleText}>Treh Silsilah Bali</h2>
          <p className="text-xs text-gray-600">
            Target Treh: <span className="text-[#937641] font-bold">{targetKrama?.nama_lengkap || '-'}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {initialTargetId && actualId !== initialTargetId && (
            <button 
              onClick={() => {
                navigate(`/krama-bali/detail/silsilah/${initialSlug}`);
              }} 
              className={styles.btnReset}
              title="Kembali ke target treh awal">
              <FaUndo size={10} /> RESET
            </button>
          )}
          <button onClick={() => navigate(-1)} className={styles.btnBack}>
            <FaArrowLeft size={11} /> KEMBALI
          </button>
        </div>
      </div>
      <div className={styles.areaVisualisasi}>
        <TransformWrapper
          initialScale={0.9}
          minScale={0.2}
          maxScale={2.5}
          centerOnInit={true}
          limitToBounds={false}
          wheel={{ disabled: true }}
          doubleClick={{ disabled: true }}
          panning={{
            velocityDisabled: false,
            smooth: true,
          }}
          zoomAnimation={{ animationTime: 200, animationType: "easeOut" }}>
          {({ zoomIn, zoomOut, resetTransform, state }) => (
            <>
              <div className={styles.zoomCard}>
                <button onClick={() => zoomOut(0.15)} className={styles.zoom} title="Zoom Out">
                  <FaSearchMinus size={13} />
                </button>
                <ZoomPercentage scale={state?.scale} />
                <button onClick={() => zoomIn(0.15)} className={styles.zoom}title="Zoom In">
                  <FaSearchPlus size={13} />
                </button>
                <div className="w-[1px] h-4 bg-gray-300 mx-0.5"></div>
                <button onClick={() => resetTransform()} className={styles.resetZoom} title="Reset Tampilan Zoom">
                  <FaUndo size={11} />
                </button>
              </div>
              <TransformComponent
                wrapperStyle={{
                  width: "100%",
                  height: "100%",
                  overflow: "hidden"
                }}
                contentStyle={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center"
                }}>
                <div className={styles.tree}>
                  {treeData ? (
                    <ul>{renderTree(treeData)}</ul>
                  ) : (
                    <p className="text-center text-gray-500 py-10">
                      Pohon silsilah keluarga tidak ditemukan.
                    </p>
                  )}
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>
      <Legenda activeData={activeData} />
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