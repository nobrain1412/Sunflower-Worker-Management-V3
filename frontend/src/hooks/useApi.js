import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

let accessToken = localStorage.getItem('access_token');
let refreshPromise = null;
let unauthorizedHandler = null;
const AUTH_FAILURE_CODES = new Set([
  'NO_REFRESH_TOKEN',
  'INVALID_REFRESH_TOKEN',
  'USER_NOT_FOUND',
  'ACCOUNT_DISABLED',
  'INVALID_REFRESH_RESPONSE',
]);

function normalizeError(err) {
  // Ưu tiên lỗi backend đã chuẩn hoá { code, message, details } — đây mới là
  // nơi chứa message tiếng Việt mô tả đúng field sai (vd "CCCD phải gồm đúng 12 chữ số").
  const apiError = err?.response?.data?.error;
  if (apiError) return apiError;

  // Object lỗi tự tạo (không phải AxiosError) → giữ nguyên.
  // Lưu ý: AxiosError của axios 1.x LUÔN có err.code ('ERR_BAD_REQUEST'...) và err.message
  // ('Request failed with status code 422'), nên phải loại trừ isAxiosError ở đây —
  // nếu không sẽ trả về message thô của axios thay vì message backend.
  if (err?.code && err?.message && !err.isAxiosError) return err;

  return {
    code: 'NETWORK_ERROR',
    message: 'Lỗi kết nối mạng',
  };
}

export function setAccessToken(token) {
  accessToken = token || null;
  if (token) localStorage.setItem('access_token', token);
  else localStorage.removeItem('access_token');
}

export function clearAccessToken() {
  setAccessToken(null);
}

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
}

// Gắn JWT vào mỗi request
api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  // Khi gửi FormData (upload file), phải BỎ Content-Type mặc định (application/json)
  // để trình duyệt tự set multipart/form-data kèm boundary — nếu không server không parse được file.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (config.headers && typeof config.headers.delete === 'function') {
      config.headers.delete('Content-Type');
    } else if (config.headers) {
      delete config.headers['Content-Type'];
    }
  }
  return config;
});

async function refreshAccessToken() {
  const res = await api.post('/auth/refresh', undefined, { skipAuthRefresh: true });
  const token = res?.data?.access_token;
  if (!token) {
    throw {
      code: 'INVALID_REFRESH_RESPONSE',
      message: 'Không nhận được access token mới',
    };
  }

  setAccessToken(token);
  return { token, user: res?.data?.user || null };
}

// Chuẩn hoá lỗi về dạng { code, message, details }
api.interceptors.response.use(
  (res) => res.data,
  async (err) => {
    const status = err?.response?.status;
    const originalRequest = err?.config || {};

    if (status === 401 && !originalRequest._retry && !originalRequest.skipAuthRefresh) {
      originalRequest._retry = true;

      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }

        const { token } = await refreshPromise;
        originalRequest.headers = originalRequest.headers || {};
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch (refreshErr) {
        // Chỉ buộc logout khi refresh token thực sự không còn hợp lệ.
        // Với lỗi tạm thời (network/rate-limit), giữ phiên để user không bị đá ra màn login đột ngột.
        if (AUTH_FAILURE_CODES.has(refreshErr?.code)) {
          clearAccessToken();
          if (unauthorizedHandler) unauthorizedHandler();
        }
        return Promise.reject(normalizeError(refreshErr));
      }
    }

    return Promise.reject(normalizeError(err));
  },
);

export default api;
