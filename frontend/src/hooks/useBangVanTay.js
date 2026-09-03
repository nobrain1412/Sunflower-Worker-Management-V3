import { useQuery } from '@tanstack/react-query';
import api from './useApi';

// Tra cứu bảng công vân tay theo MÃ VÂN TAY (quét mọi tháng đã lưu).
// enabled chỉ khi có mã → không gọi API lúc ô còn trống.
export function useTraCuuVanTay(ma, { congTyId, page = 1, limit = 100 } = {}) {
  return useQuery({
    queryKey: ['bang-van-tay', 'tra-cuu-ma', ma, congTyId, page, limit],
    queryFn: () => {
      const params = { ma, page, limit };
      if (congTyId) params.cong_ty_id = congTyId;
      return api.get('/bang-van-tay/tra-cuu-ma', { params });
    },
    enabled: !!ma,
    staleTime: 15_000,
  });
}

// Danh sách phiếu bù chấm vân tay (dòng thiếu chấm) của 1 kỳ.
// Cần congTyId + thang + nam; ma tuỳ chọn để lọc 1 công nhân. enabled khi đủ kỳ.
export function useBuVanTay({ congTyId, thang, nam, ma } = {}) {
  return useQuery({
    queryKey: ['bang-van-tay', 'bu-cham', congTyId, thang, nam, ma || ''],
    queryFn: () => {
      const params = { cong_ty_id: congTyId, thang, nam };
      if (ma) params.ma = ma;
      return api.get('/bang-van-tay/bu-cham', { params });
    },
    enabled: !!congTyId && !!thang && !!nam,
    staleTime: 15_000,
  });
}
