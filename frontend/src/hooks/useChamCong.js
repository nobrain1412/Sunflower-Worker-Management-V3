import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

// Danh sách CN + chấm công tháng (admin/quản lý), có filter
export function useChamCongThang(params) {
  return useQuery({
    queryKey: ['cham-cong', 'thang', params],
    queryFn:  () => api.get('/cham-cong', { params }),
    enabled:  !!params?.thang && !!params?.nam,
    staleTime: 15_000,
  });
}

// Chấm công của 1 CN trong tháng (theo phan_cong)
export function useChamCongCongNhan(congNhanId, thang, nam) {
  return useQuery({
    queryKey: ['cham-cong', 'cn', congNhanId, thang, nam],
    queryFn:  () => api.get(`/cham-cong/cong-nhan/${congNhanId}`, { params: { thang, nam } }),
    enabled:  !!congNhanId && !!thang && !!nam,
    staleTime: 15_000,
  });
}

export function useUpsertChamCong() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ phan_cong_id, entries }) => api.post('/cham-cong/batch', { phan_cong_id, entries }),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['cham-cong'] });
      qc.invalidateQueries({ queryKey: ['hoat-dong'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
