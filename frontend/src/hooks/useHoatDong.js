import { useQuery } from '@tanstack/react-query';
import api from './useApi';

export function useHoatDongCongNhan(congNhanId, limit = 50) {
  return useQuery({
    queryKey: ['hoat-dong', 'cn', congNhanId, limit],
    queryFn:  () => api.get(`/hoat-dong/cong-nhan/${congNhanId}`, { params: { limit } }),
    enabled:  !!congNhanId,
    staleTime: 30_000,
  });
}

// Hoạt động của các CN do user đang đăng nhập tuyển (cho dashboard vender/CTV)
export function useHoatDongCuaToi(limit = 20) {
  return useQuery({
    queryKey: ['hoat-dong', 'cua-toi', limit],
    queryFn:  () => api.get('/hoat-dong/cua-toi', { params: { limit } }),
    staleTime: 30_000,
  });
}
