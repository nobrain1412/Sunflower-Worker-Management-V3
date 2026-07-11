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
