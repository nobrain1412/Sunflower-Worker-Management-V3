import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

export function useUserList(params = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn:  () => api.get('/users', { params }),
    staleTime: 30_000,
  });
}

export function useUserDetail(id) {
  return useQuery({
    queryKey: ['users', 'detail', id],
    queryFn:  () => api.get(`/users/${id}`),
    enabled:  !!id,
  });
}

export function useCongTacVien() {
  return useQuery({
    queryKey: ['users', 'cong-tac-vien'],
    queryFn:  () => api.get('/users/cong-tac-vien'),
    staleTime: 30_000,
  });
}

export function useTaoUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => api.post('/users', data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useCapNhatUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.put(`/users/${id}`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}

export function useXoaUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.delete(`/users/${id}`),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
