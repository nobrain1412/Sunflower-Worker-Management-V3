import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { ThemeScope } from '../context/ThemeContext';
import ThemeToggle from '../components/ThemeToggle';

// Trang tuyển dụng CÔNG KHAI — dùng làm homepage để chạy quảng cáo tuyển dụng.
// Thông tin công ty lấy từ database qua endpoint công khai /api/tuyen-dung.

function fmtLuong(n) {
  const v = Number(n || 0);
  if (v <= 0) return null;
  return v.toLocaleString('vi-VN') + 'đ';
}

function toArr(v) {
  return Array.isArray(v) ? v : [];
}

export default function TuyenDung() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tuyen-dung'],
    queryFn: () => api.get('/tuyen-dung'),
    staleTime: 5 * 60 * 1000,
  });

  const congTyList = toArr(data?.data);

  return (
    <ThemeScope storageKey="theme_tuyen_dung" style={{ minHeight: 'auto' }}>
    <div style={s.root}>
      {/* Nền gradient mờ */}
      <div style={s.bgBlob1} />
      <div style={s.bgBlob2} />

      {/* Header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <div style={s.logo}>
            <div style={s.logoIcon}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="9" cy="7" r="4" stroke="#fff" strokeWidth="2"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div style={s.logoText}>WorkerOS</div>
              <div style={s.logoSub}>Tuyển dụng công nhân</div>
            </div>
          </div>

          {/* Đổi giao diện + nút quản lý/đăng nhập */}
          <div style={s.headerActions}>
            <ThemeToggle />
            {isLoggedIn ? (
              <button style={s.manageBtn} onClick={() => navigate('/quan-ly')}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2"/>
                  <rect x="14" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2"/>
                  <rect x="3" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2"/>
                  <rect x="14" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2"/>
                </svg>
                Vào trang quản lý
              </button>
            ) : (
              <button style={s.loginBtn} onClick={() => navigate('/login')}>
                Đăng nhập
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section style={s.hero}>
        <div style={s.heroBadge}>ĐANG TUYỂN DỤNG</div>
        <h1 style={s.heroTitle}>Tìm việc làm công nhân — thu nhập ổn định</h1>
        <p style={s.heroSub}>
          Nhiều vị trí đang cần tuyển tại các công ty đối tác. Xem chi tiết công việc,
          mức lương và liên hệ ứng tuyển ngay hôm nay.
        </p>
      </section>

      {/* Danh sách công ty */}
      <main style={s.main}>
        {isLoading && (
          <div style={s.stateBox}>Đang tải danh sách tuyển dụng...</div>
        )}
        {isError && (
          <div style={{ ...s.stateBox, color: 'var(--red)' }}>
            Không tải được danh sách tuyển dụng. Vui lòng thử lại sau.
          </div>
        )}
        {!isLoading && !isError && congTyList.length === 0 && (
          <div style={s.stateBox}>Hiện chưa có vị trí tuyển dụng nào.</div>
        )}

        <div style={s.grid}>
          {congTyList.map((ct) => (
            <CongTyCard key={ct.id} congTy={ct} />
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer style={s.footer}>
        © {new Date().getFullYear()} WorkerOS — Hệ thống tuyển dụng &amp; quản lý công nhân
      </footer>
    </div>
    </ThemeScope>
  );
}

function CongTyCard({ congTy }) {
  const media = toArr(congTy.media_urls);
  const anh = media[0];
  const luongCoBan = fmtLuong(congTy.luong_co_ban);
  const luongGio = fmtLuong(congTy.luong_theo_gio);

  return (
    <article style={s.card}>
      {anh ? (
        <div style={s.cardImgWrap}>
          <img src={anh} alt={congTy.ten_cong_ty} style={s.cardImg} loading="lazy" />
        </div>
      ) : (
        <div style={{ ...s.cardImgWrap, ...s.cardImgPlaceholder }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="7" width="20" height="14" rx="2" stroke="var(--text3)" strokeWidth="2"/>
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" stroke="var(--text3)" strokeWidth="2"/>
          </svg>
        </div>
      )}

      <div style={s.cardBody}>
        <h3 style={s.cardTitle}>{congTy.ten_cong_ty}</h3>

        {congTy.dia_chi && (
          <div style={s.cardRow}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={s.rowIcon}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke="currentColor" strokeWidth="2"/>
              <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2"/>
            </svg>
            <span>{congTy.dia_chi}</span>
          </div>
        )}

        {(luongCoBan || luongGio) && (
          <div style={s.luongWrap}>
            {luongCoBan && (
              <div style={s.luongChip}>
                <span style={s.luongLabel}>Lương cơ bản</span>
                <span style={s.luongValue}>{luongCoBan}</span>
              </div>
            )}
            {luongGio && (
              <div style={s.luongChip}>
                <span style={s.luongLabel}>Lương/giờ</span>
                <span style={s.luongValue}>{luongGio}</span>
              </div>
            )}
          </div>
        )}

        {congTy.mo_ta_cong_viec && (
          <p style={s.cardDesc}>{congTy.mo_ta_cong_viec}</p>
        )}

        {congTy.so_dien_thoai && (
          <a href={`tel:${congTy.so_dien_thoai}`} style={s.contactBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.98.36 1.94.68 2.86a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.22-1.22a2 2 0 0 1 2.11-.45c.92.32 1.88.55 2.86.68A2 2 0 0 1 22 16.92z" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Liên hệ ứng tuyển: {congTy.so_dien_thoai}
          </a>
        )}
      </div>
    </article>
  );
}

const s = {
  root: {
    minHeight: '100vh',
    background: 'var(--bg0)',
    color: 'var(--text1)',
    position: 'relative',
    overflow: 'hidden',
    fontFamily: "'Be Vietnam Pro', sans-serif",
    paddingBottom: 40,
  },
  bgBlob1: {
    position: 'absolute', top: '-140px', left: '-120px',
    width: 460, height: 460, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(79,124,255,0.12) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  bgBlob2: {
    position: 'absolute', top: '120px', right: '-120px',
    width: 400, height: 400, borderRadius: '50%',
    background: 'radial-gradient(circle, rgba(123,95,255,0.1) 0%, transparent 70%)',
    pointerEvents: 'none',
  },
  header: {
    position: 'relative', zIndex: 2,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg1)',
  },
  headerActions: { display: 'flex', alignItems: 'center', gap: 10 },
  headerInner: {
    maxWidth: 1120, margin: '0 auto',
    padding: '14px 24px',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon: {
    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  logoText: { fontSize: 16, fontWeight: 700, color: 'var(--text1)', letterSpacing: '-0.3px' },
  logoSub: { fontSize: 11, color: 'var(--text3)', marginTop: 1 },
  manageBtn: {
    display: 'flex', alignItems: 'center', gap: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  loginBtn: {
    background: 'var(--bg2)', color: 'var(--text1)',
    border: '1px solid var(--border2)', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  hero: {
    position: 'relative', zIndex: 1,
    maxWidth: 760, margin: '0 auto',
    padding: '56px 24px 40px',
    textAlign: 'center',
  },
  heroBadge: {
    display: 'inline-block',
    background: 'rgba(34,201,134,0.12)',
    color: 'var(--green)',
    border: '1px solid rgba(34,201,134,0.25)',
    borderRadius: 999, padding: '5px 14px',
    fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
    marginBottom: 18,
  },
  heroTitle: {
    fontSize: 34, fontWeight: 800, lineHeight: 1.2,
    color: 'var(--text1)', margin: '0 0 14px',
    letterSpacing: '-0.5px',
  },
  heroSub: {
    fontSize: 15, color: 'var(--text2)', lineHeight: 1.6, margin: 0,
  },
  main: {
    position: 'relative', zIndex: 1,
    maxWidth: 1120, margin: '0 auto', padding: '0 24px',
  },
  stateBox: {
    textAlign: 'center', color: 'var(--text2)',
    padding: '48px 20px', fontSize: 14,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
    gap: 20,
  },
  card: {
    background: 'var(--bg1)',
    border: '1px solid var(--border)',
    borderRadius: 14,
    overflow: 'hidden',
    display: 'flex', flexDirection: 'column',
  },
  cardImgWrap: {
    width: '100%', aspectRatio: '16 / 9',
    background: 'var(--bg3)', overflow: 'hidden',
  },
  cardImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cardImgPlaceholder: {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardBody: {
    padding: '18px 18px 20px',
    display: 'flex', flexDirection: 'column', gap: 12, flex: 1,
  },
  cardTitle: {
    fontSize: 17, fontWeight: 700, color: 'var(--text1)', margin: 0,
    letterSpacing: '-0.2px',
  },
  cardRow: {
    display: 'flex', alignItems: 'flex-start', gap: 8,
    fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
  },
  rowIcon: { color: 'var(--text3)', flexShrink: 0, marginTop: 2 },
  luongWrap: { display: 'flex', flexWrap: 'wrap', gap: 8 },
  luongChip: {
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '7px 12px',
    display: 'flex', flexDirection: 'column', gap: 2,
  },
  luongLabel: { fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.04em' },
  luongValue: {
    fontSize: 14, fontWeight: 700, color: 'var(--green)',
    fontFamily: "'JetBrains Mono', monospace",
  },
  cardDesc: {
    fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, margin: 0,
    whiteSpace: 'pre-line',
    display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
  },
  contactBtn: {
    marginTop: 'auto',
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', borderRadius: 8, padding: '10px 14px',
    fontSize: 13, fontWeight: 600, textDecoration: 'none',
  },
  footer: {
    position: 'relative', zIndex: 1,
    textAlign: 'center', color: 'var(--text3)',
    fontSize: 12, marginTop: 48, padding: '0 24px',
  },
};
