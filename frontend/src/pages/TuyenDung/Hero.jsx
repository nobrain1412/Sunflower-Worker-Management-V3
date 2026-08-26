import { LOCATIONS, fmtStat } from './tuyenDungData';

// Hero + ô tìm việc + thống kê thật.
// `thongKe` lấy từ /api/tuyen-dung/thong-ke — số công ty đang tuyển & tổng công nhân.
export default function Hero({ thongKe }) {
  // Chỉ dựng ô thống kê từ dữ liệu thật; chưa có số liệu thì không hiển thị khối này.
  const stats = thongKe
    ? [
        { value: fmtStat(thongKe.so_cong_ty_tuyen_dung), label: 'Công ty đang tuyển' },
        { value: fmtStat(thongKe.tong_cong_nhan), label: 'Công nhân đã kết nối' },
      ]
    : [];

  return (
    <section style={s.hero}>
      <div style={s.inner}>
        <h1 style={s.h1}>
          Tìm việc làm nhanh, <span style={{ color: 'var(--sf-navy)' }}>việc làm mới</span> khắp toàn quốc
        </h1>
        <p style={s.sub}>
          Kết nối trực tiếp với các doanh nghiệp đang tuyển dụng công nhân, minh bạch và nhanh chóng
        </p>

        <div style={s.searchBox}>
          <input placeholder="Vị trí tuyển dụng, tên công ty…" style={s.input} />
          <select style={s.select} defaultValue={LOCATIONS[0]}>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button className="sf-btn-navy" style={s.searchBtn}>Tìm kiếm</button>
        </div>

        {stats.length > 0 && (
          <div style={s.stats}>
            {stats.map((st) => (
              <div key={st.label}>
                <div style={s.statValue}>{st.value}</div>
                <div style={{ fontSize: 13, color: 'var(--sf-muted)' }}>{st.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

const s = {
  hero: { background: 'var(--sf-herobg)', borderBottom: '1px solid var(--sf-brd)' },
  inner: {
    maxWidth: 1180, margin: '0 auto',
    padding: 'clamp(36px,6vw,72px) 20px clamp(32px,5vw,56px)', textAlign: 'center',
  },
  h1: {
    margin: '0 0 12px', fontSize: 'clamp(26px,4vw,44px)', fontWeight: 800,
    lineHeight: 1.2, letterSpacing: '-.5px', color: 'var(--sf-text)',
  },
  sub: {
    margin: '0 auto 28px', maxWidth: 640, fontSize: 'clamp(14px,1.6vw,17px)',
    color: 'var(--sf-muted)', lineHeight: 1.6,
  },
  searchBox: {
    maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'var(--sf-search-dir)',
    gap: 10, background: 'var(--sf-surface)', border: '1px solid var(--sf-brd)',
    borderRadius: 14, padding: 10, boxShadow: '0 8px 30px rgba(44,74,138,.10)',
  },
  input: {
    flex: 2.2, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
    color: 'var(--sf-text)', fontSize: 15, padding: '12px 14px', fontFamily: 'inherit',
  },
  select: {
    flex: 1, border: 'none', outline: 'none', background: 'var(--sf-surface2)',
    color: 'var(--sf-text)', fontSize: 14.5, padding: '12px 14px', borderRadius: 9,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  searchBtn: {
    border: 'none', borderRadius: 10, background: 'var(--sf-navy)', color: 'var(--sf-navy-ink)',
    fontSize: 15, fontWeight: 700, padding: '12px 28px', cursor: 'pointer', fontFamily: 'inherit',
  },
  stats: {
    marginTop: 32, display: 'flex', gap: 'clamp(20px,5vw,64px)',
    justifyContent: 'center', flexWrap: 'wrap',
  },
  statValue: { fontSize: 'clamp(20px,2.6vw,28px)', fontWeight: 800, color: 'var(--sf-navy)' },
};
