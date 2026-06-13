import React, { useState } from 'react';
import { FaExclamationTriangle, FaSignInAlt } from 'react-icons/fa';

const AccessDeniedModal = ({ isOpen, onClose, onConfirmLogin }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-container">
        <div className="p-6">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className="elipsis-icon-warn">
              <FaExclamationTriangle className="icon-warn" />
            </div>
          </div>
          {/* Text */}
          <div className="text-center">
            <h3 className="text-lg font-bold text-black mb-2">Akses Dibatasi</h3>
            <p className="text-sm text-bali-brown">
              Maaf, fitur <strong>Krama Bali</strong> hanya dapat diakses oleh User yang login. Silakan login untuk melanjutkan.
            </p>
          </div>
          {/* Buttons */}
          <div className="mt-6 flex gap-3 justify-center">
            <button onClick={onClose} className="btn-cencel-confirm">
              Nanti Saja
            </button>
            <button type="button"onClick={onConfirmLogin} className="btn-start">
              <FaSignInAlt />
              Login Sekarang
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const GuestKrama = ({ onOpenLogin }) => {
  const [showModal, setShowModal] = useState(false);
    
  // Helper to close warning modal dan open main login modal
  const handleSwitchToLogin = () => {
    setShowModal(false); 
    if (onOpenLogin) {
      onOpenLogin(); 
    }
  };

  return (
    <div className="ml-72 bg-white min-h-screen flex flex-col items-center justify-center p-10">
      <div className="text-center max-w-lg">
        <h1 className="text-3xl font-bold mb-4 text-[#3e2713]">
          Halaman Guest Krama Bali
        </h1>
        <p className="mb-8 text-gray-600 leading-relaxed">
          Selamat datang di Krama Bali. Untuk menjaga privasi dan validitas data krama, 
          kami membatasi akses detail seluruh krama hanya untuk anggota terverifikasi.
        </p>
        <button onClick={() => setShowModal(true)} className="btn-oke">
          Ayo Mulai!
        </button>
      </div>
      {/* Access Denied Modal */}
      <AccessDeniedModal 
        isOpen={showModal} 
        onClose={() => setShowModal(false)} 
        onConfirmLogin={handleSwitchToLogin} 
      />
    </div>
  );
};

export default GuestKrama;