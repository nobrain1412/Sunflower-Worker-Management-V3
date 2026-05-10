import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Gắn JWT vào mỗi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Chuẩn hoá lỗi về dạng { code, message, details }
api.interceptors.response.use(
  (res) => res.data,
  (err) => {
    const error = err.response?.data?.error || {
      code: 'NETWORK_ERROR',
      message: 'Lỗi kết nối mạng',
    };
    return Promise.reject(error);
  },
);

export default api;
