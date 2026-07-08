import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

export function useCongNhanList(params = {}) {
  return useQuery({
    queryKey: ['cong-nhan', params],
    queryFn:  () => api.get('/cong-nhan', { params }),
    staleTime: 30_000,
  });
}

export function useCongNhanDetail(id) {
  return useQuery({
    queryKey: ['cong-nhan', id],
    queryFn:  () => api.get(`/cong-nhan/${id}`),
    enabled:  !!id,
  });
}

export function useTaoMoiCongNhan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/cong-nhan', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

export function useCapNhatCongNhan(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.put(`/cong-nhan/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

export function useVenders() {
  return useQuery({
    queryKey: ['users', 'venders'],
    queryFn:  () => api.get('/users/venders'),
    staleTime: 5 * 60_000,
  });
}

export function useCongTyList() {
  return useQuery({
    queryKey: ['cong-ty', 'all'],
    queryFn:  () => api.get('/cong-ty', { params: { limit: 100 } }),
    staleTime: 5 * 60_000,
  });
}

export function useNoiOCongNhan(id) {
  return useQuery({
    queryKey: ['cong-nhan', id, 'noi-o'],
    queryFn:  () => api.get(`/cong-nhan/${id}/noi-o`),
    enabled:  !!id,
    staleTime: 30_000,
  });
}

export function useNoiOTruyCap() {
  return useQuery({
    queryKey: ['cong-nhan', 'noi-o-truy-cap'],
    queryFn: () => api.get('/cong-nhan/noi-o/truy-cap'),
    staleTime: 30_000,
  });
}

export function useTongUngCongNhan(id) {
  return useQuery({
    queryKey: ['cong-nhan', id, 'tong-ung'],
    queryFn:  () => api.get(`/cong-nhan/${id}/tong-ung`),
    enabled:  !!id,
    staleTime: 30_000,
  });
}

export function useDuyetCongNhan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/cong-nhan/${id}/duyet`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

export function useTuChoiCongNhan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ly_do }) => api.post(`/cong-nhan/${id}/tu-choi`, { ly_do: ly_do ?? null }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

export function useXoaCongNhan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/cong-nhan/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

// Gán công ty hàng loạt cho nhiều CN chưa có công ty
export function useGanCongTyHangLoat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/cong-nhan/gan-cong-ty', payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}
