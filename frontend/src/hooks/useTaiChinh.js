import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

// ─── DANH MỤC ─────────────────────────────────────────────
export function useDanhMuc(loai) {
  return useQuery({
    queryKey: ['tai-chinh', 'danh-muc', loai],
    queryFn:  () => api.get('/tai-chinh/danh-muc', { params: loai ? { loai } : {} }),
    staleTime: 5 * 60_000,
  });
}

export function useTaoDanhMuc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/tai-chinh/danh-muc', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tai-chinh', 'danh-muc'] }),
  });
}

export function useCapNhatDanhMuc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/tai-chinh/danh-muc/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['tai-chinh', 'danh-muc'] }),
  });
}

// ─── GIAO DỊCH ────────────────────────────────────────────
export function useGiaoDichList(params = {}) {
  return useQuery({
    queryKey: ['tai-chinh', 'giao-dich', params],
    queryFn:  () => api.get('/tai-chinh', { params }),
    staleTime: 15_000,
  });
}

// ADMIN — giám sát khoản chi của kế toán & nhân viên (không gồm 'tieu').
export function useGiamSatChi(params = {}, options = {}) {
  return useQuery({
    queryKey: ['tai-chinh', 'giam-sat-chi', params],
    queryFn:  () => api.get('/tai-chinh/giam-sat-chi', { params }),
    staleTime: 15_000,
    ...options,
  });
}

export function useTongThang(thang, nam) {
  return useQuery({
    queryKey: ['tai-chinh', 'tong', thang, nam],
    queryFn:  () => api.get('/tai-chinh/tong-thang', { params: { thang, nam } }),
    staleTime: 30_000,
  });
}

export function useTaoGiaoDich() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/tai-chinh', data),
    onSuccess:  () => {
      // Sync mọi view tài chính: list chung, tổng, theo CN, tổng tạm ứng CN
      qc.invalidateQueries({ queryKey: ['tai-chinh'] });
      qc.invalidateQueries({ queryKey: ['cong-nhan'] });
    },
  });
}

// Giao dịch của 1 công nhân cụ thể (dùng trong CN Detail)
export function useGiaoDichCongNhan(congNhanId) {
  return useQuery({
    queryKey: ['tai-chinh', 'cn', congNhanId],
    queryFn:  () => api.get(`/tai-chinh/cong-nhan/${congNhanId}`),
    enabled:  !!congNhanId,
    staleTime: 15_000,
  });
}

export function useXoaGiaoDich() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/tai-chinh/${id}`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['tai-chinh', 'giao-dich'] });
      qc.invalidateQueries({ queryKey: ['tai-chinh', 'tong'] });
    },
  });
}

// Cập nhật số tiền đã hoàn (luỹ kế) — cho phép hoàn 1 phần
export function useCapNhatHoanTien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, so_tien_da_hoan }) => api.patch(`/tai-chinh/${id}/hoan-tien`, { so_tien_da_hoan }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['tai-chinh', 'giao-dich'] });
      qc.invalidateQueries({ queryKey: ['tai-chinh', 'tong'] });
      qc.invalidateQueries({ queryKey: ['tai-chinh', 'cn'] });
      qc.invalidateQueries({ queryKey: ['cong-nhan'] });
    },
  });
}
