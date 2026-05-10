import { useQuery } from '@tanstack/react-query';
import api from './useApi';

export function useDashboard(params = {}) {
  return useQuery({
    queryKey: ['dashboard', params],
    queryFn:  () => api.get('/dashboard', { params }),
    staleTime: 30_000,
  });
}

export function useTongTheoThang(soThang = 5) {
  return useQuery({
    queryKey: ['tai-chinh', 'tong-theo-thang', soThang],
    queryFn:  () => api.get('/tai-chinh/tong-theo-thang', { params: { so_thang: soThang } }),
    staleTime: 60_000,
  });
}
