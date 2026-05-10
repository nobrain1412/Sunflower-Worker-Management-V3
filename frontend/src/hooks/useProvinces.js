/**
 * Hook lấy dữ liệu tỉnh/huyện/xã từ API mở Việt Nam
 * https://provinces.open-api.vn/api/
 */
import { useQuery } from '@tanstack/react-query';

const BASE = 'https://provinces.open-api.vn/api';

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Không thể tải dữ liệu hành chính');
  return res.json();
}

export function useTinhList() {
  return useQuery({
    queryKey: ['provinces', 'tinh'],
    queryFn:  () => fetchJson(`${BASE}/?depth=1`),
    staleTime: 60 * 60_000, // 1 giờ
    retry: 2,
  });
}

export function useHuyenList(tinhCode) {
  return useQuery({
    queryKey: ['provinces', 'huyen', tinhCode],
    queryFn:  () => fetchJson(`${BASE}/p/${tinhCode}?depth=2`),
    enabled:  !!tinhCode,
    staleTime: 60 * 60_000,
    retry: 2,
    select: (d) => d?.districts ?? [],
  });
}

export function useXaList(huyenCode) {
  return useQuery({
    queryKey: ['provinces', 'xa', huyenCode],
    queryFn:  () => fetchJson(`${BASE}/d/${huyenCode}?depth=2`),
    enabled:  !!huyenCode,
    staleTime: 60 * 60_000,
    retry: 2,
    select: (d) => d?.wards ?? [],
  });
}
