import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

export function usePhongTroList(active) {
  return useQuery({
    queryKey: ['phong-tro', { active }],
    queryFn:  () => api.get('/phong-tro', { params: active !== undefined ? { active } : {} }),
    staleTime: 30_000,
  });
}

export function useTaoPhongTro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/phong-tro', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['phong-tro'] }),
  });
}

export function useCapNhatPhongTro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/phong-tro/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['phong-tro'] }),
  });
}

export function useXoaPhongTro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/phong-tro/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['phong-tro'] }),
  });
}

export function usePhongTroThue(id) {
  return useQuery({
    queryKey: ['phong-tro', id, 'thue'],
    queryFn:  () => api.get(`/phong-tro/${id}/thue`),
    enabled:  !!id,
    staleTime: 15_000,
  });
}

export function useGanCongNhanPhongTro(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/phong-tro/${id}/thue`, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['phong-tro', id, 'thue'] });
      qc.invalidateQueries({ queryKey: ['phong-tro'] });
    },
  });
}

export function useTraPhongTro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thueId, ngay_ra }) => api.put(`/phong-tro/thue/${thueId}/tra`, { ngay_ra }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['phong-tro'] });
      qc.invalidateQueries({ queryKey: ['cong-nhan'] });
    },
  });
}

export function useChuyenPhongTro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ thueId, ...data }) => api.post(`/phong-tro/thue/${thueId}/chuyen-phong`, data),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['phong-tro'] });
      qc.invalidateQueries({ queryKey: ['cong-nhan'] });
    },
  });
}

export function useHoaDonPhongTro(id) {
  return useQuery({
    queryKey: ['phong-tro', id, 'hoa-don'],
    queryFn:  () => api.get(`/phong-tro/${id}/hoa-don`),
    enabled:  !!id,
    staleTime: 30_000,
  });
}

export function useHoaDonThangTruocPhongTro(id, thang, nam) {
  return useQuery({
    queryKey: ['phong-tro', id, 'thang-truoc', thang, nam],
    queryFn:  () => api.get(`/phong-tro/${id}/hoa-don/thang-truoc`, { params: { thang, nam } }),
    enabled:  !!id && !!thang && !!nam,
    staleTime: 30_000,
  });
}

export function useTaoHoaDonPhongTro(id) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post(`/phong-tro/${id}/hoa-don`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['phong-tro', id, 'hoa-don'] }),
  });
}
