import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from './useApi';

// Danh sách đề xuất nghỉ việc đang chờ duyệt (lọc theo scope ở backend).
export function useDeXuatNghiViecList(trangThai = 'cho_duyet') {
  return useQuery({
    queryKey: ['de-xuat-nghi-viec', trangThai],
    queryFn:  () => api.get('/de-xuat-nghi-viec', { params: { trang_thai: trangThai } }),
    staleTime: 15_000,
  });
}

// Danh sách tháng đã có bảng vân tay cho 1 công ty (để chọn kỳ phân tích).
export function useThangVanTay(congTyId) {
  return useQuery({
    queryKey: ['bang-van-tay', 'thang', congTyId],
    queryFn:  () => api.get('/bang-van-tay/thang', { params: { cong_ty_id: congTyId } }),
    enabled:  !!congTyId,
    staleTime: 30_000,
  });
}

// Dò ứng viên nghỉ việc (không ghi DB) — trả kết quả để review trước.
export function usePhanTichNghiViec() {
  return useMutation({
    mutationFn: ({ cong_ty_id, thang, nam }) =>
      api.post('/de-xuat-nghi-viec/phan-tich', { cong_ty_id, thang, nam }),
  });
}

// Tạo đề xuất cho các CN được chọn (bỏ trống cong_nhan_ids = tất cả ứng viên).
export function useTaoDeXuatNghiViec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post('/de-xuat-nghi-viec/tao', payload),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['de-xuat-nghi-viec'] }),
  });
}

// Gán mã vân tay cho 1 CN chưa có mã rồi đối chiếu kỳ (lưu hồ sơ + kiểm tra nghỉ việc).
export function useGanMaVanTay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cong_ty_id, thang, nam, cong_nhan_id, ma_van_tay }) =>
      api.post('/de-xuat-nghi-viec/gan-ma', { cong_ty_id, thang, nam, cong_nhan_id, ma_van_tay }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

// Gán mã + kiểm tra HÀNG LOẠT cho nhiều CN chưa có mã trong 1 lần bấm.
export function useGanMaHangLoat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cong_ty_id, thang, nam, items }) =>
      api.post('/de-xuat-nghi-viec/gan-ma-hang-loat', { cong_ty_id, thang, nam, items }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['cong-nhan'] }),
  });
}

// Duyệt nghỉ việc TRỰC TIẾP cho các CN được tích chọn (không qua hàng đợi đề xuất).
export function useDuyetTrucTiep() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ cong_ty_id, thang, nam, cong_nhan_ids }) =>
      api.post('/de-xuat-nghi-viec/duyet-truc-tiep', { cong_ty_id, thang, nam, cong_nhan_ids }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['de-xuat-nghi-viec'] });
      qc.invalidateQueries({ queryKey: ['cong-nhan'] });
    },
  });
}

export function useDuyetNghiViec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => api.post(`/de-xuat-nghi-viec/${id}/duyet`),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: ['de-xuat-nghi-viec'] });
      qc.invalidateQueries({ queryKey: ['cong-nhan'] });
    },
  });
}

export function useTuChoiNghiViec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ghi_chu }) => api.post(`/de-xuat-nghi-viec/${id}/tu-choi`, { ghi_chu: ghi_chu ?? null }),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['de-xuat-nghi-viec'] }),
  });
}
