import { useQuery } from '@tanstack/react-query';
import api from './useApi';

// Timeline 1 CN cho trang chi tiết (tab Hệ thống)
export function useHoatDongCongNhan(congNhanId, limit = 50) {
  return useQuery({
    queryKey: ['hoat-dong', 'cn', congNhanId, limit],
    queryFn:  () => api.get(`/hoat-dong/cong-nhan/${congNhanId}`, { params: { limit } }),
    enabled:  !!congNhanId,
    staleTime: 30_000,
  });
}

// Sổ hoạt động cá nhân — các thao tác do CHÍNH user đăng nhập thực hiện.
export function useHoatDongCuaToi(limit = 50) {
  return useQuery({
    queryKey: ['hoat-dong', 'cua-toi', limit],
    queryFn:  () => api.get('/hoat-dong/cua-toi', { params: { limit } }),
    staleTime: 30_000,
  });
}

// Hoạt động liên quan tới CN do user này tuyển — feed dashboard cho vender/CTV.
export function useHoatDongLienQuan(limit = 20) {
  return useQuery({
    queryKey: ['hoat-dong', 'lien-quan', limit],
    queryFn:  () => api.get('/hoat-dong/lien-quan', { params: { limit } }),
    staleTime: 30_000,
  });
}
