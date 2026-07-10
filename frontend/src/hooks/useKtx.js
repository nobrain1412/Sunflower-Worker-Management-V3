import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

// ─── KY_TUC_XA ────────────────────────────────────────────
export function useKtxList(enabled = true) {
  return useQuery({
    queryKey: ['ktx'],
    queryFn:  () => api.get('/ktx'),
    enabled,
    staleTime: 30_000,
  });
}

export function useTaoKtx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/ktx', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx'] }),
  });
}

export function useCapNhatKtx(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/ktx/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx'] }),
  });
}

export function useXoaKtx() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/ktx/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx'] }),
  });
}

// ─── PHONG ────────────────────────────────────────────────
export function usePhongList(ktxId) {
  return useQuery({
    queryKey: ['ktx', ktxId, 'phong'],
    queryFn:  () => api.get(`/ktx/${ktxId}/phong`),
    enabled:  !!ktxId,
    staleTime: 15_000,
  });
}

export function useTaoPhong(ktxId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/ktx/${ktxId}/phong`, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['ktx', ktxId, 'phong'] });
      qc.invalidateQueries({ queryKey: ['ktx'] });
    },
  });
}

export function useCapNhatPhong(ktxId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phongId, ...data }) => api.put(`/ktx/phong/${phongId}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx', ktxId, 'phong'] }),
  });
}

export function useXoaPhong(ktxId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (phongId) => api.delete(`/ktx/phong/${phongId}`),
    onSuccess:  () => {
      // Invalidate broadly để mọi danh sách phòng cập nhật
      qc.invalidateQueries({ queryKey: ['ktx'] });
      if (ktxId) qc.invalidateQueries({ queryKey: ['ktx', ktxId, 'phong'] });
    },
  });
}

// ─── GIUONG (chi tiết phòng) ──────────────────────────────
export function useGiuongList(phongId) {
  return useQuery({
    queryKey: ['ktx', 'phong', phongId, 'giuong'],
    queryFn:  () => api.get(`/ktx/phong/${phongId}/giuong`),
    enabled:  !!phongId,
    staleTime: 10_000,
  });
}

export function useCapNhatGiuong(phongId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giuongId, ...data }) => api.put(`/ktx/giuong/${giuongId}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx', 'phong', phongId, 'giuong'] }),
  });
}

// ─── THUE_PHONG ────────────────────────────────────────────
export function useXepGiuong(phongId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ giuongId, ...data }) => api.post(`/ktx/giuong/${giuongId}/xep`, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['ktx', 'phong', phongId, 'giuong'] });
      qc.invalidateQueries({ queryKey: ['ktx'] });
    },
  });
}

export function useTraPhong(phongId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thuephongId, ...data }) => api.put(`/ktx/thue-phong/${thuephongId}/tra`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx', 'phong', phongId, 'giuong'] }),
  });
}

// Ngày vào quyết định số ngày ở → hoá đơn tháng đó phải tính lại
export function useSuaNgayVaoKtx(phongId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thuephongId, ngay_vao }) => api.put(`/ktx/thue-phong/${thuephongId}/ngay-vao`, { ngay_vao }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ktx', 'phong', phongId, 'giuong'] });
      qc.invalidateQueries({ queryKey: ['ktx', 'lich-su'] });
    },
  });
}

export function useChuyenPhongKtx(phongId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ congNhanId, ...data }) => api.post(`/ktx/cong-nhan/${congNhanId}/chuyen-phong`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ktx', 'phong', phongId, 'giuong'] });
      qc.invalidateQueries({ queryKey: ['ktx'] });
    },
  });
}

export function useLichSuPhong(congNhanId) {
  return useQuery({
    queryKey: ['ktx', 'lich-su', congNhanId],
    queryFn:  () => api.get(`/ktx/lich-su/${congNhanId}`),
    enabled:  !!congNhanId,
    staleTime: 30_000,
  });
}

export function useUngVienXepPhong(search = '') {
  return useQuery({
    queryKey: ['ktx', 'co-the-xep', search],
    queryFn: () => api.get('/ktx/cong-nhan/co-the-xep', {
      params: {
        search: search || undefined,
        limit: 100,
      },
    }),
    staleTime: 15_000,
  });
}

// ─── HOA_DON ──────────────────────────────────────────────
export function useHoaDonList(phongId) {
  return useQuery({
    queryKey: ['ktx', 'phong', phongId, 'hoa-don'],
    queryFn:  () => api.get(`/ktx/phong/${phongId}/hoa-don`),
    enabled:  !!phongId,
    staleTime: 30_000,
  });
}

// Số điện/nước tháng trước — để pre-fill dien_cu/nuoc_cu
export function useHoaDonThangTruoc(phongId, thang, nam) {
  return useQuery({
    queryKey: ['ktx', 'phong', phongId, 'thang-truoc', thang, nam],
    queryFn:  () => api.get(`/ktx/phong/${phongId}/hoa-don/thang-truoc`, { params: { thang, nam } }),
    enabled:  !!phongId && !!thang && !!nam,
    staleTime: 30_000,
  });
}

export function useTaoHoaDon(phongId) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/ktx/phong/${phongId}/hoa-don`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['ktx', 'phong', phongId, 'hoa-don'] }),
  });
}
