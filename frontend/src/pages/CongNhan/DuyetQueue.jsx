/**
 * Trang hàng đợi duyệt công nhân "đợi việc" (chờ phỏng vấn).
 *   - Admin: thấy tất cả CN đang đợi việc
 *   - Quản lý: chỉ thấy CN đợi việc thuộc công ty mình (backend tự lọc theo scope)
 * Bấm "Duyệt vào làm" → CN chuyển sang trạng thái "mới vào".
 */
import { useCongNhanList, useDuyetCongNhan } from '../../hooks/useCongNhan';
import { useAuth } from '../../context/AuthContext';

function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s);
  if (isNaN(d)) return '—';
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export default function DuyetQueue() {
  const { isAdmin } = useAuth();
  // 2 nhóm cần duyệt: 'doi_viec' (phỏng vấn đạt) và 'cho_duyet' (import trùng CCCD thêm mới).
  const doiViecQ  = useCongNhanList({ trang_thai: 'doi_viec',  limit: 100 });
  const choDuyetQ = useCongNhanList({ trang_thai: 'cho_duyet', limit: 100 });
  const isLoading = doiViecQ.isLoading || choDuyetQ.isLoading;
  const rows = [
    ...(choDuyetQ.data?.data ?? []),
    ...(doiViecQ.data?.data ?? []),
  ];

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Duyệt công nhân</h1>
          <p style={s.subtitle}>
            {isAdmin
              ? 'Công nhân đợi việc (chờ phỏng vấn) và trùng CCCD thêm mới — chờ duyệt'
              : 'Công nhân đợi việc / trùng CCCD thuộc công ty bạn quản lý'}
          </p>
        </div>
        <span style={s.countBadge}>{rows.length} đang chờ</span>
      </div>

      {isLoading ? (
        <div style={s.empty}>Đang tải...</div>
      ) : rows.length === 0 ? (
        <div style={s.empty}>Không có công nhân nào chờ duyệt.</div>
      ) : (
        <div style={s.list}>
          {rows.map((cn) => <DuyetCard key={cn.id} cn={cn} />)}
        </div>
      )}
    </div>
  );
}

function DuyetCard({ cn }) {
  const duyet = useDuyetCongNhan();

  async function handleDuyet() {
    if (!window.confirm(
      `Duyệt "${cn.ho_ten}" vào làm tại ${cn.ten_cong_ty ?? 'công ty'}? `
      + 'Công nhân sẽ chuyển sang trạng thái "Mới vào".',
    )) return;
    try {
      await duyet.mutateAsync(cn.id);
    } catch (err) {
      alert(err?.response?.data?.error?.message ?? err?.message ?? 'Duyệt thất bại');
    }
  }

  return (
    <div style={s.card}>
      <div style={s.avatar}>{cn.ho_ten?.[0]?.toUpperCase() ?? '?'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={s.name}>
          {cn.ho_ten}
          {cn.trang_thai === 'cho_duyet' && <span style={s.dupBadge}>Trùng CCCD</span>}
        </div>
        <div style={s.meta}>
          <span>🏭 {cn.ten_cong_ty ?? 'Chưa chọn công ty'}</span>
          <span>· 👤 {cn.nguoi_tuyen_ho_ten ?? '—'}</span>
        </div>
        <div style={s.meta}>
          <span>📞 {cn.so_dien_thoai ?? '—'}</span>
          <span>· 🎂 {fmtDate(cn.ngay_sinh)}</span>
          <span>· Tạo: {fmtDate(cn.created_at)}</span>
        </div>
      </div>
      <button onClick={handleDuyet} style={s.btnApprove} disabled={duyet.isPending}>
        {duyet.isPending ? 'Đang duyệt...' : '✓ Duyệt vào làm'}
      </button>
    </div>
  );
}

const s = {
  root: { padding: 24, maxWidth: 1000, fontFamily: "'Be Vietnam Pro', sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text2)' },
  countBadge: {
    fontSize: 12, fontWeight: 700, color: 'var(--accent2)',
    background: 'rgba(123,95,255,0.12)', borderRadius: 12, padding: '5px 12px',
  },
  empty: {
    padding: 60, textAlign: 'center', color: 'var(--text3)',
    background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12,
  },
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 12, padding: 16,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, fontWeight: 700, color: '#fff',
  },
  name: { fontSize: 14, fontWeight: 700, color: 'var(--text1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 },
  dupBadge: {
    fontSize: 10, fontWeight: 700, color: 'var(--amber)',
    background: 'rgba(255,179,68,0.14)', borderRadius: 6, padding: '2px 7px',
  },
  meta: { fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 },
  btnApprove: {
    flexShrink: 0,
    background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 18px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};
