/**
 * Tra cứu bảng công vân tay — 1 ô nhập MÃ VÂN TAY, kết quả hiển thị dạng bảng.
 * Quét mọi tháng đã lưu (BE endpoint /bang-van-tay/tra-cuu-ma), mỗi dòng kèm
 * cột "Công ty" và "Tháng" để biết dòng thuộc kỳ nào.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTraCuuVanTay } from '../../hooks/useBangVanTay';

// Cột chứa số giờ → canh phải + font mono cho dễ đọc.
const NUMERIC_HINT = /(gio|ca|tang|ot|so)/i;

export default function TraCuuVanTay() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [ma, setMa] = useState('');            // mã đã submit → kích hoạt query

  const { data: res, isFetching, isError, error } = useTraCuuVanTay(ma);
  const groups = res?.data?.groups ?? [];
  const total = res?.meta?.total ?? 0;

  function handleSubmit(e) {
    e.preventDefault();
    setMa(input.trim());
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Tra cứu bảng công vân tay</div>
          <div style={s.subtitle}>Nhập mã vân tay (mã thẻ) để xem toàn bộ ngày công đã lưu.</div>
        </div>
        <button className="btn-ghost" onClick={() => navigate('/cham-cong')}>← Chấm công</button>
      </div>

      {/* Ô tìm kiếm duy nhất */}
      <form style={s.searchRow} onSubmit={handleSubmit}>
        <input
          className="form-input"
          style={s.search}
          placeholder="Nhập mã vân tay… (VD: 2100002)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          autoFocus
        />
        <button type="submit" className="btn-primary" disabled={!input.trim()}>
          🔍 Tra cứu
        </button>
      </form>

      {/* Kết quả */}
      {!ma ? (
        <div style={s.card}><div style={s.empty}>Nhập mã vân tay rồi bấm Tra cứu.</div></div>
      ) : isFetching ? (
        <div style={s.card}><div style={s.empty}>Đang tra cứu…</div></div>
      ) : isError ? (
        <div style={s.card}><div style={{ ...s.empty, color: 'var(--red)' }}>
          {error?.message || 'Có lỗi khi tra cứu'}
        </div></div>
      ) : groups.length === 0 ? (
        <div style={s.card}><div style={s.empty}>
          Không tìm thấy dữ liệu cho mã “{ma}”.
        </div></div>
      ) : (
        <>
          <div style={s.resultMeta}>
            Tìm thấy <b style={{ color: 'var(--text1)' }}>{total}</b> dòng cho mã “{ma}”
            {groups.length > 1 && ` · ${groups.length} công ty`}
          </div>
          {groups.map((g) => (
            <div key={g.cong_ty} style={s.card}>
              <div style={s.groupTitle}>{g.cong_ty}</div>
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead>
                    <tr>{g.headers.map((h) => <th key={h} style={s.th}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {g.rows.map((row, i) => (
                      <tr key={i} style={i % 2 ? s.trAlt : undefined}>
                        {g.headers.map((h) => {
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
          ))}
        </>
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  subtitle: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  searchRow: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  search: { flex: 1, minWidth: 220, maxWidth: 420, padding: '9px 12px', fontSize: 13 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14 },
  empty: { padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
  resultMeta: { fontSize: 12, color: 'var(--text2)' },
  groupTitle: { fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 10 },
  tableWrap: { overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 },
  table: { borderCollapse: 'collapse', width: '100%', fontSize: 12, whiteSpace: 'nowrap' },
  th: {
    position: 'sticky', top: 0, background: 'var(--bg2)', color: 'var(--text2)',
    fontWeight: 600, textAlign: 'left', padding: '8px 10px',
    borderBottom: '1px solid var(--border2)', fontSize: 11,
  },
  td: { padding: '7px 10px', color: 'var(--text1)', borderBottom: '1px solid var(--border)' },
  tdNum: { textAlign: 'right', fontFamily: "'JetBrains Mono', monospace" },
  trAlt: { background: 'var(--bg2)' },
};
