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

const NUMERIC_HINT = /(gio|ca|tang|ot|so)/i;

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

  const headers = res?.data?.headers ?? [];
  const rows = res?.data?.rows ?? [];
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
        ) : rows.length === 0 ? (
          <div style={s.card}><div style={s.empty}>
            Không tìm thấy ngày công cho mã “{ma}”. Kiểm tra lại mã vân tay của bạn.
          </div></div>
        ) : (
          <div style={s.card}>
            <div style={s.resultMeta}>
              Tìm thấy <b style={{ color: 'var(--sf-text)' }}>{total}</b> ngày công cho mã “{ma}”
              {total > rows.length && ` (hiển thị ${rows.length} dòng đầu)`}
            </div>
            <div style={s.tableWrap}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {headers.map((h) => <th key={h} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i} style={i % 2 ? s.trAlt : undefined}>
                      {headers.map((h) => {
                        const v = row[h];
                        const numeric = NUMERIC_HINT.test(h);
                        return (
                          <td key={h} style={{ ...s.td, ...(numeric ? s.tdNum : {}) }}>
                            {v == null || v === '' ? '' : String(v)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
  resultMeta: { fontSize: 13, color: 'var(--sf-muted)', marginBottom: 12 },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--sf-brd)', borderRadius: 12 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 13, whiteSpace: 'nowrap' },
  th: {
    position: 'sticky', top: 0, background: 'var(--sf-surface2)', color: 'var(--sf-muted)',
    fontWeight: 700, textAlign: 'left', padding: '10px 12px',
    borderBottom: '1px solid var(--sf-brd)', fontSize: 12,
  },
  td: { padding: '9px 12px', color: 'var(--sf-text)', borderBottom: '1px solid var(--sf-brd)' },
  tdNum: { textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" },
  trAlt: { background: 'var(--sf-surface2)' },
};
