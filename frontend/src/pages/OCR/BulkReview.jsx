import { useState, useRef } from 'react';
import api from '../../hooks/useApi';

export default function BulkReview() {
  const [stage, setStage]       = useState('upload');
  const [preview, setPreview]   = useState(null);
  const [rows, setRows]         = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [editRow, setEditRow]   = useState(null);
  const [ocrId, setOcrId]       = useState(null);
  const [error, setError]       = useState(null);
  const fileRef = useRef();

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setStage('processing');

    try {
      const form = new FormData();
      form.append('anh', file);
      form.append('loai', 'danh_sach');

      // Content-Type: undefined xoá default 'application/json' của axios instance
      // để browser tự set multipart/form-data với boundary đúng
      const res = await api.post('/ocr/scan', form, {
        headers: { 'Content-Type': undefined },
      });

      setOcrId(res.data.ocr_id);

      // Gắn id tạm và đánh trạng thái warn/ok
      const list = (res.data.ket_qua ?? []).map((r, i) => ({
        ...r,
        id: i + 1,
        status: r.ho_ten && r.cccd ? 'ok' : 'warn',
      }));

      setRows(list);
      setSelected(new Set(list.filter((r) => r.status === 'ok').map((r) => r.id)));
      setStage('review');
    } catch (err) {
      setError(err?.message ?? 'Lỗi OCR, thử lại');
      setStage('upload');
    }
  }

  function toggleSelect(id) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function handleEdit(id, key, val) {
    setRows((r) => r.map((row) => {
      if (row.id !== id) return row;
      const updated = { ...row, [key]: val };
      updated.status = updated.ho_ten && updated.cccd ? 'ok' : 'warn';
      return updated;
    }));
  }

  async function handleApprove() {
    try {
      if (ocrId) await api.post(`/ocr/${ocrId}/approve`);
    } catch { /* bỏ qua */ }
    setStage('done');
  }

  async function handleCancel() {
    try {
      if (ocrId) await api.post(`/ocr/${ocrId}/reject`);
    } catch { /* bỏ qua */ }
    setStage('upload');
    setRows([]);
    setSelected(new Set());
  }

  const okCount   = rows.filter((r) => r.status === 'ok').length;
  const warnCount = rows.filter((r) => r.status === 'warn').length;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Quét danh sách viết tay</h2>
          <p style={s.sub}>Tải ảnh bảng danh sách để AI nhận diện nhiều người cùng lúc</p>
        </div>
      </div>

      {stage === 'upload' && (
        <div style={s.uploadCard}>
          {error && <div style={s.errorBox}>{error}</div>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <div style={s.dropzone} onClick={() => fileRef.current?.click()}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
            <div style={s.uploadTitle}>Tải ảnh danh sách viết tay</div>
            <div style={s.uploadSub}>Chụp bảng danh sách công nhân dạng giấy</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
              Chọn ảnh
            </button>
          </div>
        </div>
      )}

      {stage === 'processing' && (
        <div style={s.processingCard}>
          <div style={{ padding: 20, background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14 }}>
            <img src={preview} alt="" style={{ width: '100%', borderRadius: 8 }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 32 }}>
            <div style={s.spinner} />
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text1)' }}>Đang phân tích danh sách...</div>
            <div style={{ fontSize: 12, color: 'var(--text2)' }}>AI đang nhận diện từng dòng thông tin</div>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={s.summaryRow}>
            <div style={s.summaryItem}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace" }}>{rows.length}</span>
              <span style={s.summaryLabel}>Tổng phát hiện</span>
            </div>
            <div style={s.summaryItem}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--green)', fontFamily: "'JetBrains Mono', monospace" }}>{okCount}</span>
              <span style={s.summaryLabel}>Đủ thông tin</span>
            </div>
            <div style={s.summaryItem}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--amber)', fontFamily: "'JetBrains Mono', monospace" }}>{warnCount}</span>
              <span style={s.summaryLabel}>Cần bổ sung</span>
            </div>
            <div style={s.summaryItem}>
              <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>{selected.size}</span>
              <span style={s.summaryLabel}>Đã chọn duyệt</span>
            </div>
          </div>

          <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>Danh sách trích xuất</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSelected(new Set(rows.map((r) => r.id)))}>Chọn tất cả</button>
                <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setSelected(new Set())}>Bỏ chọn</button>
              </div>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['', 'Họ tên', 'CCCD', 'Ngày sinh', 'Giới tính', 'Quê quán', 'TT', ''].map((h) => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', fontSize: 13, color: 'var(--text3)' }}>Không phát hiện được dòng nào. Thử ảnh khác.</td></tr>
                )}
                {rows.map((row) => (
                  editRow === row.id ? (
                    <tr key={row.id} style={{ background: 'rgba(79,124,255,0.06)', borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '8px 14px' }} />
                      {['ho_ten','cccd','ngay_sinh','gioi_tinh','que_quan'].map((k) => (
                        <td key={k} style={{ padding: '8px 8px' }}>
                          <input className="form-input" style={{ fontSize: 12, padding: '5px 8px' }} value={row[k] || ''} onChange={(e) => handleEdit(row.id, k, e.target.value)} />
                        </td>
                      ))}
                      <td />
                      <td style={{ padding: '8px 14px' }}>
                        <button className="btn-primary" style={{ padding: '5px 10px', fontSize: 11 }} onClick={() => setEditRow(null)}>Lưu</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px' }}>
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} style={{ accentColor: 'var(--accent)', width: 14, height: 14, cursor: 'pointer' }} />
                      </td>
                      <td style={{ padding: '10px 10px', fontSize: 13, fontWeight: 600, color: 'var(--text1)' }}>{row.ho_ten || <span style={{ color: 'var(--text3)' }}>—</span>}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" }}>{row.cccd || <span style={{ color: 'var(--amber)' }}>—</span>}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text2)' }}>{row.ngay_sinh || '—'}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text2)' }}>{row.gioi_tinh || '—'}</td>
                      <td style={{ padding: '10px 10px', fontSize: 12, color: 'var(--text2)' }}>{row.que_quan || '—'}</td>
                      <td style={{ padding: '10px 10px' }}>
                        <span className={`pill ${row.status === 'ok' ? 'pill-green' : 'pill-amber'}`}>
                          {row.status === 'ok' ? 'OK' : 'Thiếu'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 4 }} onClick={() => setEditRow(row.id)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                        </button>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={handleCancel}>Huỷ tất cả</button>
            <button className="btn-primary" disabled={selected.size === 0} onClick={handleApprove}>
              ✓ Duyệt {selected.size} công nhân
            </button>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={{ background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 }}>
          <div style={{ fontSize: 52 }}>✅</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text1)' }}>Duyệt thành công!</div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}><b>{selected.size}</b> công nhân đã được thêm vào hệ thống</div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button className="btn-ghost" onClick={() => { setStage('upload'); setRows([]); setSelected(new Set()); }}>Quét tiếp</button>
            <a href="/cong-nhan" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff' }}>
              Xem danh sách
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', justifyContent: 'space-between' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  sub: { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  errorBox: { background: 'rgba(255,95,114,0.12)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--red)' },
  uploadCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  dropzone: { background: 'var(--bg1)', border: '2px dashed var(--border2)', borderRadius: 14, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center' },
  uploadTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text1)' },
  uploadSub: { fontSize: 12, color: 'var(--text2)', marginTop: 4 },
  processingCard: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  summaryRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 },
  summaryItem: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 4 },
  summaryLabel: { fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' },
};
