import { HOT_KEYWORDS, STATS, LOCATIONS } from './tuyenDungData';

// Hero + ô tìm việc + từ khóa nổi bật + thống kê.
export default function Hero() {
  return (
    <section style={s.hero}>
      <div style={s.inner}>
        <h1 style={s.h1}>
          Tìm việc làm nhanh, <span style={{ color: 'var(--sf-navy)' }}>việc làm mới</span> khắp toàn quốc
        </h1>
        <p style={s.sub}>
          Tiếp cận 50.000+ tin tuyển dụng mỗi ngày từ hàng nghìn doanh nghiệp uy tín tại Việt Nam
        </p>

        <div style={s.searchBox}>
          <input placeholder="Vị trí tuyển dụng, tên công ty…" style={s.input} />
          <select style={s.select} defaultValue={LOCATIONS[0]}>
            {LOCATIONS.map((l) => <option key={l}>{l}</option>)}
          </select>
          <button className="sf-btn-navy" style={s.searchBtn}>Tìm kiếm</button>
        </div>

        <div style={s.keywords}>
          <span style={{ fontSize: 13, color: 'var(--sf-muted)' }}>Từ khóa nổi bật:</span>
          {HOT_KEYWORDS.map((kw) => (
            <a key={kw} href="#" className="sf-chip" onClick={(e) => e.preventDefault()} style={s.chip}>{kw}</a>
          ))}
        </div>

        <div style={s.stats}>
          {STATS.map((st) => (
            <div key={st.label}>
              <div style={s.statValue}>{st.value}</div>
              <div style={{ fontSize: 13, color: 'var(--sf-muted)' }}>{st.label}</div>
            </div>
          ))}
        </div>
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
  keywords: {
    marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8,
    justifyContent: 'center', alignItems: 'center',
  },
  chip: {
    fontSize: 13, color: 'var(--sf-text)', textDecoration: 'none', background: 'var(--sf-surface)',
    border: '1px solid var(--sf-brd)', borderRadius: 999, padding: '5px 12px',
  },
  stats: {
    marginTop: 32, display: 'flex', gap: 'clamp(20px,5vw,64px)',
    justifyContent: 'center', flexWrap: 'wrap',
  },
  statValue: { fontSize: 'clamp(20px,2.6vw,28px)', fontWeight: 800, color: 'var(--sf-navy)' },
};
