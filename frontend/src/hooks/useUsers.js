import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

// Danh sách user tối thiểu (id, ho_ten, vai_tro) — mọi user authenticated dùng được
export function useAssignableUsers() {
  return useQuery({
    queryKey: ['users', 'assignable'],
    queryFn:  () => api.get('/users/assignable').then((r) => r.data ?? []),
    staleTime: 60_000,
  });
}

export function useUserList(params = {}, options = {}) {
  return useQuery({
    queryKey: ['users', params],
    queryFn:  () => api.get('/users', { params }),
    staleTime: 30_000,
    ...options,
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

export function useThanhToanCongTacVien() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }) => api.post(`/users/cong-tac-vien/${id}/thanh-toan`, data),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['users'] }),
  });
}
