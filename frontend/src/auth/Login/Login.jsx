import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaEnvelope, 
  FaLock, 
  FaEye, 
  FaEyeSlash 
} from 'react-icons/fa';
import { IoMdClose } from 'react-icons/io';
import axiosInstance from '../../api/axiosInstance';
import styles from './Login.module.css';

const Login = ({ onClose, onSwitchRegister, onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleCardClick = (e) => {
    e.stopPropagation();
  };

  // Effect: Load Remember Me & Lock Scroll
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    document.body.classList.add("no-scroll");
    return () => {
      document.body.classList.remove("no-scroll");
    };
  }, []);

  // Effect: Reset error message saat user mengetik
  useEffect(() => {
    if (message) {
      setMessage('');
      setMessageType('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  // SUBMIT DATA
  const submitLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');
    setMessageType('');

    try {
      const response = await axiosInstance.post(`/login`, {
        email: email,
        password: password
      });

      const { user } = response.data; 

      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }

      if (onLoginSuccess) {
        onLoginSuccess(user);
      }

      onClose();
      if (user.role === "Super Admin" || user.role === "Admin Desa") {
        navigate('/dashboard');
      } else {
        navigate('/home');
      }
    } catch (error) {
      if (error.response && error.response.data && error.response.data.message) {
        setMessage(error.response.data.message);
      } else {
        setMessage("E-mail atau password salah!");
      }
      setMessageType('error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={!isLoading ? onClose : undefined}>
      <div className={`${styles.cardLogin} animate-fade-in`} onClick={handleCardClick}>
        {/* Button Close */}
        <button 
          onClick={!isLoading ? onClose : undefined} 
          className={`${styles.xButton} ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
          aria-label="Close Modal"
          disabled={isLoading}
        >
          <IoMdClose size={24} className="hover:rotate-90 transition-transform duration-300" />
        </button>
        <div className="mb-8 flex flex-col items-center">
          <img src="/logo.webp" alt="Sistem Silsilah Adat Bali" className="w-48 h-48 object-contain" />
        </div>
        <form className="w-full" onSubmit={submitLogin}>
          {/* Email Input */}
          <div className={styles.inputGroup}>
            <div className={styles.iconWrapper}>
              <FaEnvelope size={20} />
            </div>
            <input 
              type="email" 
              placeholder="E-mail" 
              className={`${styles.authInput} disabled:opacity-50`} 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
            />
          </div>
          {/* Password Input */}
          <div className={`${styles.inputGroup} relative`}>
            <div className={styles.iconWrapper}>
              <FaLock size={20} />
              </div>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              className={`${styles.authInput} disabled:opacity-50`} 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading} 
              required
            />
            <button
              type="button"
              className={styles.eyePassword} 
              disabled={isLoading}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <FaEyeSlash size={18}/> : <FaEye size={18}/>}
            </button>
          </div>
          {/* Remember Me*/}
          <div className={styles.checkbox}>
            <label className={styles.labelRememberMe}>
              <input 
                type="checkbox" 
                className={styles.checkboxInput}
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={isLoading}
              />
              <span className="ml-2">
                Remember me
              </span>
            </label>
          </div>
          {/* Message Display */}
          {message && (
            <div className={`p-2 text-xs mb-3 text-center font-bold ${messageType === 'error' ? 'text-red-600' : 'text-green-600'}`}>
              {message}
            </div>
          )}
          {/* Button Login */}
          <button 
            type="submit" 
            disabled={isLoading} 
            className={`${styles.btnLogin} ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:opacity-90'}`}
          >
            {isLoading ? (
              <>
                <span className={styles.spinner}></span>
                LOGGING IN...
              </>
            ) : "LOGIN"}
          </button>
          <div className="mt-4 text-center text-white text-xs mb-4">
            <span>Belum mempunyai akun? </span>
            <button 
              type="button" 
              onClick={ onSwitchRegister } 
              className={styles.switchModal}
              disabled={isLoading}
            >
              Register Here
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;