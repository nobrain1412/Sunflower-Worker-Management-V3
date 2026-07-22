import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries } from '@tanstack/react-query';
import api from '../../../hooks/useApi';
import ToUngVien from './ToUngVien';
import ToDoTuoi from './ToDoTuoi';
import ToDongY from './ToDongY';
import ToAnhCccd from './ToAnhCccd';
import { cacToCanIn } from './utils';
import './print.css';

// Trang in hồ sơ — dùng chung cho 1 công nhân (?ids=5) và in hàng loạt (?ids=5,7,9).
// Render bên ngoài Layout để bản in không dính sidebar/topbar của app.

const TO = {
  ung_vien:  ToUngVien,
  do_tuoi:   ToDoTuoi,
  dong_y:    ToDongY,
  anh_cccd:  ToAnhCccd,
};

/** Đợi mọi ảnh trong bản in tải xong, tránh in ra khung trắng. */
async function doiAnhTai() {
  const imgs = Array.from(document.querySelectorAll('.hs-to img'));
  await Promise.all(imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
      // Không để một ảnh hỏng treo nút In vô hạn
      setTimeout(resolve, 8000);
    });
  }));
}

export default function InHoSo() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [dangIn, setDangIn] = useState(false);

  const ids = useMemo(() => (
    (params.get('ids') ?? '')
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean)
  ), [params]);

  // Ngày in cố định trong suốt phiên để mọi tờ dùng chung một ngày ký
  const ngayIn = useMemo(() => new Date(), []);

  const results = useQueries({
    queries: ids.map((id) => ({
      queryKey: ['cong-nhan', id],
      queryFn:  () => api.get(`/cong-nhan/${id}`),
    })),
  });

  // Nền tối của app không hợp với trang in → ép nền sáng khi ở màn này
  useEffect(() => {
    document.body.classList.add('in-ho-so-body');
    return () => document.body.classList.remove('in-ho-so-body');
  }, []);

  const dangTai = results.some((r) => r.isLoading);
  const danhSach = results.map((r) => r.data?.data).filter(Boolean);

  async function handleIn() {
    setDangIn(true);
    try {
      await doiAnhTai();
      window.print();
    } finally {
      setDangIn(false);
    }
  }

  // Cảnh báo trước khi in: thiếu ảnh CCCD thì tờ 4 sẽ ra khung trống
  const thieuAnh = danhSach.filter((cn) => !cn.anh_cccd_truoc || !cn.anh_cccd_sau);
  const soTo = danhSach.reduce((tong, cn) => tong + cacToCanIn(cn).length, 0);

  return (
    <div className="hs-root">
      <div className="hs-toolbar no-print">
        <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate(-1)}>← Quay lại</button>
        <button className="btn-primary" style={{ fontSize: 12 }} onClick={handleIn} disabled={dangTai || !danhSach.length || dangIn}>
          🖨 {dangIn ? 'Đang chuẩn bị...' : 'In hồ sơ'}
        </button>
        <span className="hs-toolbar-note">
          {dangTai
            ? 'Đang tải hồ sơ...'
            : `${danhSach.length} công nhân · ${soTo} tờ A4`}
        </span>
        {!dangTai && thieuAnh.length > 0 && (
          <span className="hs-toolbar-note" style={{ color: 'var(--amber)' }}>
            ⚠ {thieuAnh.length} hồ sơ thiếu ảnh CCCD: {thieuAnh.map((c) => c.ho_ten).join(', ')}
          </span>
        )}
        <span className="hs-toolbar-note">
          Khi in nhớ chọn khổ A4, tỉ lệ 100% và bật "In nền/hình ảnh".
        </span>
      </div>

      {!dangTai && danhSach.length === 0 && (
        <div className="hs-toolbar no-print" style={{ color: 'var(--red)' }}>
          Không tải được hồ sơ công nhân nào. Kiểm tra lại đường dẫn hoặc quyền truy cập.
        </div>
      )}

      {danhSach.flatMap((cn) => cacToCanIn(cn).map((ma) => {
        const To = TO[ma];
        return <To key={`${cn.id}-${ma}`} cn={cn} ngayIn={ngayIn} />;
      }))}
    </div>
  );
}
