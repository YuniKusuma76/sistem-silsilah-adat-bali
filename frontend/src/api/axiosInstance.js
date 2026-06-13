import axios from "axios";

// Get Url Backend
const API_URL = import.meta.env.VITE_API_URL;

// Fungsi agar cookie dikirim otomatis
const axiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true, 
});

// Response Interceptor
axiosInstance.interceptors.response.use((response) => response, async (error) => {
  const originalRequest = error.config;
  if (originalRequest.url.includes('/refresh-token')) {
    return Promise.reject(error);
  }

  // Jika error 401 (Unauthorized) dan belum pernah diretry
  if (error.response?.status === 401 && !originalRequest._retry) {
    originalRequest._retry = true; 

    try {
      await axios.get(`${API_URL}/refresh-token`, { 
        withCredentials: true 
      });
      // Ulangi request awal yang tadi gagal
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      console.error("Session expired.");

      if (window.location.pathname !== '/' && window.location.pathname !== '/home') {
        window.location.href = '/';
      }
      return Promise.reject(refreshError);
    }
  }
  return Promise.reject(error);
});

export default axiosInstance;