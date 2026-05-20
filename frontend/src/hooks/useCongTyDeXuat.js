import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

export function useDeXuatList(filter = {}) {
  return useQuery({
    queryKey: ['cong-ty-de-xuat', filter],
    queryFn: () => api.get('/cong-ty/de-xuat', { params: filter }),
    staleTime: 30_000,
  });
}

export function useDeXuatDetail(id) {
  return useQuery({
    queryKey: ['cong-ty-de-xuat', 'detail', id],
    queryFn: () => api.get(`/cong-ty/de-xuat/${id}`),
    enabled: !!id,
  });
}

export function usePendingCount() {
  return useQuery({
    queryKey: ['cong-ty-de-xuat', 'pending-count'],
    queryFn: () => api.get('/cong-ty/de-xuat/pending-count'),
    staleTime: 60_000,
  });
}

export function useSubmitDeXuat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/cong-ty/de-xuat', payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cong-ty-de-xuat'] });
    },
  });
}

export function useDuyetDeXuat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ghi_chu_admin }) =>
      api.post(`/cong-ty/de-xuat/${id}/duyet`, { ghi_chu_admin }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cong-ty-de-xuat'] });
      qc.invalidateQueries({ queryKey: ['cong-ty'] });
    },
  });
}

export function useTuChoiDeXuat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ghi_chu_admin }) =>
      api.post(`/cong-ty/de-xuat/${id}/tu-choi`, { ghi_chu_admin }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cong-ty-de-xuat'] });
    },
  });
}
