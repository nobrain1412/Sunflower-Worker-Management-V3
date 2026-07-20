/**
 * Trang tra cứu ngày công CÔNG KHAI — công nhân tự nhập mã vân tay để xem ngày công.
 * Không cần đăng nhập. UI theo nhận diện Sunflower (token --sf-*), tái dùng Header/Footer
 * của trang tuyển dụng để đồng bộ giao diện homepage.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import api from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { ThemeScope } from '../context/ThemeContext';
import Header from './TuyenDung/Header';
import Footer from './TuyenDung/Footer';

// Chuẩn hoá header: bỏ dấu, đ→d, lowercase (khớp normalizeKey của BE).
function norm(raw) {
  return String(raw ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Cột danh tính — hiển thị 1 lần trên đầu bảng, không lặp lại từng dòng.
const INFO_FIELDS = [
  ['ten',    ['ho va ten', 'ho ten', 'ten']],
  ['ma',     ['ma the', 'ma the cham cong', 'ma van tay', 'ma cham cong']],
  ['boPhan', ['bo phan', 'phong ban', 'to', 'to nhom']],
];

// Giờ hành chính: ca ngày + ca đêm + chủ nhật + ngày lễ (gộp 1 cột).
const HC_KEYS = ['ca ngay', 'ca dem', 'chu nhat', 'ngay le', 'gio hanh chinh', 'gio cong'];

// Giờ tăng ca: mọi biến thể TC (trc/sau 9:45, đêm, chủ nhật, ngày lễ).
const isTangCa = (k) => k.startsWith('tang ca') || k === 'trc 9 45' || k === 'sau 9 45' || k === 'ot';

// Ô giờ → số (bỏ qua text/rỗng) để cộng dồn.
function toNum(v) {
  if (v == null || v === '') return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

const fmtGio = (n) => (n ? String(Math.round(n * 100) / 100) : '');

/** Tách headers của 1 nhóm thành: cột danh tính, cột ngày/trạng thái/lịch sử, 2 bucket giờ. */
function classify(headers) {
  const map = {}; // vai trò -> header gốc
  const hc = [];
  const tc = [];
  for (const h of headers) {
    const k = norm(h);
    const info = INFO_FIELDS.find(([, keys]) => keys.includes(k));
    if (info) { map[info[0]] ??= h; continue; }
    if (k === 'ngay') { map.ngay ??= h; continue; }
    if (k === 'trang thai') { map.trangThai ??= h; continue; }
    if (k.includes('lich su') || k === 'thoi gian cham') { map.lichSu ??= h; continue; }
    if (HC_KEYS.includes(k)) { hc.push(h); continue; }
    if (isTangCa(k)) tc.push(h);
  }
  return { map, hc, tc };
}

export default function TraCuuCong() {
  const navigate = useNavigate();
  const { isLoggedIn } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [input, setInput] = useState('');
  const [ma, setMa] = useState('');

  const { data: res, isFetching, isError, error } = useQuery({
    queryKey: ['tra-cuu-cong', ma],
    queryFn: () => api.get('/tra-cuu-cong', { params: { ma } }),
    enabled: !!ma,
    staleTime: 15_000,
  });

  const groups = res?.data?.groups ?? [];
  const total = res?.meta?.total ?? 0;

  function handleSubmit(e) {
    e.preventDefault();
    setMa(input.trim());
  }

  return (
    <ThemeScope storageKey="theme_tuyen_dung" className="sf-home" style={root}>
      <Header
        isLoggedIn={isLoggedIn}
        onNav={navigate}
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
      />

      <main style={s.main}>
        <div style={s.hero}>
          <h1 style={s.title}>Tra cứu ngày công</h1>
          <p style={s.subtitle}>Nhập mã vân tay (mã thẻ chấm công) của bạn để xem ngày công đã ghi nhận.</p>

          <form style={s.searchRow} onSubmit={handleSubmit}>
            <input
              style={s.search}
              placeholder="Nhập mã vân tay của bạn…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              autoFocus
            />
            <button type="submit" className="sf-btn-navy" style={s.btn} disabled={!input.trim()}>
              Tra cứu
            </button>
          </form>
        </div>

        {!ma ? null : isFetching ? (
          <div style={s.card}><div style={s.empty}>Đang tra cứu…</div></div>
        ) : isError ? (
          <div style={s.card}><div style={{ ...s.empty, color: '#c0392b' }}>
            {error?.message || 'Có lỗi khi tra cứu, vui lòng thử lại.'}
          </div></div>
        ) : groups.length === 0 ? (
          <div style={s.card}><div style={s.empty}>
            Không tìm thấy ngày công cho mã “{ma}”. Kiểm tra lại mã vân tay của bạn.
          </div></div>
        ) : (
          <>
            <div style={s.resultMeta}>
              Tìm thấy <b style={{ color: 'var(--sf-text)' }}>{total}</b> ngày công cho mã “{ma}”
              {groups.length > 1 && ` · ${groups.length} công ty`}
            </div>
            {groups.map((g) => {
              const { map, hc, tc } = classify(g.headers);
              const first = g.rows[0] || {};
              return (
                <div key={g.cong_ty} style={s.card}>
                  <div style={s.groupTitle}>{g.cong_ty}</div>

                  {/* Thông tin công nhân — ghi 1 lần, không lặp lại trong bảng */}
                  <div style={s.info}>
                    {map.ten && <span style={s.infoName}>{first[map.ten]}</span>}
                    {map.ma && <span style={s.infoItem}>Mã thẻ <b style={s.infoVal}>{first[map.ma]}</b></span>}
                    {map.boPhan && <span style={s.infoItem}>Bộ phận <b style={s.infoVal}>{first[map.boPhan]}</b></span>}
                  </div>

                  <div style={s.tableWrap}>
                    <table style={s.table}>
                      <thead>
                        <tr>
                          <th style={s.th}>Ngày</th>
                          <th style={s.th}>Trạng thái</th>
                          <th style={s.th}>Lịch sử chấm</th>
                          <th style={{ ...s.th, ...s.thNum }}>Hành chính</th>
                          <th style={{ ...s.th, ...s.thNum, ...s.lastCol }}>Tăng ca</th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((row, i) => {
                          const gioHc = hc.reduce((sum, h) => sum + toNum(row[h]), 0);
                          const gioTc = tc.reduce((sum, h) => sum + toNum(row[h]), 0);
                          return (
                            <tr key={i} style={i % 2 ? s.trAlt : undefined}>
                              <td style={{ ...s.td, ...s.tdMono }}>{row[map.ngay] ?? ''}</td>
                              <td style={{ ...s.td, ...s.tdStatus }}>{row[map.trangThai] ?? ''}</td>
                              <td style={s.td}>{row[map.lichSu] ?? ''}</td>
                              <td style={{ ...s.td, ...s.tdNum }}>{fmtGio(gioHc)}</td>
                              <td style={{ ...s.td, ...s.tdNum, ...s.tdOt, ...s.lastCol }}>{fmtGio(gioTc)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
          </>
        )}
      </main>

      <Footer />
    </ThemeScope>
  );
}

const root = {
  minHeight: '100vh',
  background: 'var(--sf-bg)',
  color: 'var(--sf-text)',
  fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
};

const s = {
  main: { maxWidth: 1180, margin: '0 auto', padding: '28px 20px 48px', display: 'flex', flexDirection: 'column', gap: 20 },
  hero: {
    background: 'var(--sf-herobg)', border: '1px solid var(--sf-brd)', borderRadius: 18,
    padding: '32px 24px', textAlign: 'center',
  },
  title: { fontSize: 26, fontWeight: 800, color: 'var(--sf-text)', margin: 0 },
  subtitle: { fontSize: 14, color: 'var(--sf-muted)', margin: '8px 0 20px' },
  searchRow: { display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' },
  search: {
    flex: '1 1 320px', maxWidth: 420, padding: '12px 16px', fontSize: 15,
    background: 'var(--sf-surface)', border: '1.5px solid var(--sf-brd)', borderRadius: 10,
    color: 'var(--sf-text)', fontFamily: 'inherit', outline: 'none',
  },
  btn: { padding: '12px 24px', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', border: 'none' },
  card: { background: 'var(--sf-surface)', border: '1px solid var(--sf-brd)', borderRadius: 16, padding: 16, boxShadow: 'var(--sf-shadow)' },
  empty: { padding: 40, textAlign: 'center', color: 'var(--sf-muted)', fontSize: 14 },
  resultMeta: { fontSize: 13, color: 'var(--sf-muted)' },
  groupTitle: { fontSize: 15, fontWeight: 800, color: 'var(--sf-navy)', marginBottom: 10 },
  info: {
    display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 18px',
    padding: '10px 14px', marginBottom: 12, borderRadius: 10,
    background: 'var(--sf-surface2)', border: '1px solid var(--sf-brd)',
    fontSize: 13, color: 'var(--sf-muted)',
  },
  infoName: { fontSize: 16, fontWeight: 800, color: 'var(--sf-text)' },
  infoItem: { display: 'inline-flex', gap: 6 },
  infoVal: { color: 'var(--sf-text)', fontWeight: 700 },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--sf-brd)', borderRadius: 12 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13, whiteSpace: 'nowrap' },
  th: {
    position: 'sticky', top: 0, background: 'var(--sf-surface2)', color: 'var(--sf-muted)',
    fontWeight: 700, textAlign: 'left', padding: '10px 12px', fontSize: 12,
    borderBottom: '1px solid var(--sf-brd)', borderRight: '1px solid var(--sf-brd)',
  },
  thNum: { textAlign: 'right' },
  td: {
    padding: '9px 12px', color: 'var(--sf-text)',
    borderBottom: '1px solid var(--sf-brd)', borderRight: '1px solid var(--sf-brd)',
  },
  tdMono: { fontFamily: "'JetBrains Mono', monospace" },
  tdStatus: { color: 'var(--sf-muted)', fontWeight: 600 },
  tdNum: { textAlign: 'right', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 },
  tdOt: { color: 'var(--sf-navy)' },
  lastCol: { borderRight: 'none' },
  trAlt: { background: 'var(--sf-surface2)' },
};
