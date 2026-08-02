/**
 * Xuất bảng công theo KHUÔN công ty.
 * Upload file mẫu của công ty → đối chiếu với hệ thống → đổ số vào khuôn → tải file.
 * Không dựng lại bảng: giữ nguyên bố cục/thứ tự/công thức trong file gốc.
 */
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../hooks/useApi';
import { useCongTyList } from '../../hooks/useCongNhan';

export default function XuatBangCong() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [congTyId, setCongTyId] = useState('');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [chon, setChon] = useState(() => new Set()); // id CN được tick để nghỉ việc
  const [nghiViecing, setNghiViecing] = useState(false);
  const [nghiViecMsg, setNghiViecMsg] = useState('');

  const congTyArr = useCongTyList().data?.data ?? [];

  function reset() {
    setFile(null); setPreview(null); setError('');
    setChon(new Set()); setNghiViecMsg('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setPreview(null); setError(''); setChon(new Set()); setNghiViecMsg('');
  }

  async function doPreview() {
    if (!file) { setError('Chưa chọn file khuôn'); return; }
    if (!congTyId) { setError('Chọn công ty trước'); return; }
    setParsing(true); setError(''); setNghiViecMsg('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('cong_ty_id', congTyId);
      const res = await api.post('/bao-cao/xuat-bang-cong/preview', fd);
      setPreview(res.data);
      setChon(new Set());
    } catch (err) {
      setError(err?.message || 'Phân tích khuôn thất bại');
    } finally {
      setParsing(false);
    }
  }

  async function doDownload() {
    setDownloading(true); setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('cong_ty_id', congTyId);
      const blob = await api.post('/bao-cao/xuat-bang-cong', fd, { responseType: 'blob' });
      const ct = congTyArr.find((c) => String(c.id) === String(congTyId));
      const name = (ct?.ten_cong_ty || 'cong-ty')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `bang-cong_${name}.xlsx`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Xuất file thất bại');
    } finally {
      setDownloading(false);
    }
  }

  async function doNghiViec() {
    const ids = [...chon];
    if (ids.length === 0) return;
    if (!window.confirm(`Chuyển ${ids.length} công nhân sang trạng thái NGHỈ VIỆC?`)) return;
    setNghiViecing(true); setError('');
    try {
      const res = await api.post('/bao-cao/xuat-bang-cong/nghi-viec', { ids });
      const done = new Set(res.data.ids || ids);
      setPreview((p) => !p ? p : ({
        ...p,
        doi_chieu: {
          ...p.doi_chieu,
          goi_y_nghi_viec: p.doi_chieu.goi_y_nghi_viec.filter((x) => !done.has(x.id)),
        },
      }));
      setChon(new Set());
      setNghiViecMsg(`Đã chuyển ${res.data.da_cap_nhat} công nhân sang nghỉ việc.`);
    } catch (err) {
      setError(err?.message || 'Chuyển nghỉ việc thất bại');
    } finally {
      setNghiViecing(false);
    }
  }

  const dc = preview?.doi_chieu;
  const tk = preview?.tong_ket;
  const goiY = dc?.goi_y_nghi_viec ?? [];
  const allChosen = goiY.length > 0 && goiY.every((x) => chon.has(x.id));

  function toggle(id) {
    setChon((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }
  function toggleAll() {
    setChon(allChosen ? new Set() : new Set(goiY.map((x) => x.id)));
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Xuất bảng công theo khuôn công ty</h1>
          <p style={s.subtitle}>
            Upload file mẫu của công ty → hệ thống đổ số công vào đúng dòng theo mã vân tay,
            giữ nguyên bố cục & công thức. Người không khớp được giữ nguyên.
          </p>
        </div>
        <button onClick={() => navigate('/cham-cong')} style={s.btnGhost}>← Quay lại</button>
      </div>

      {/* Step 1 */}
      <div style={s.section}>
        <div style={s.sectionHeader}><div style={s.stepNumber}>1</div>
          <div style={s.sectionTitle}>Chọn công ty</div></div>
        <select className="form-input" value={congTyId} style={{ maxWidth: 400 }}
          onChange={(e) => { setCongTyId(e.target.value); setPreview(null); }}>
          <option value="">-- Chọn công ty --</option>
          {congTyArr.map((ct) => <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>)}
        </select>
      </div>

      {/* Step 2 */}
      <div style={s.section}>
        <div style={s.sectionHeader}><div style={s.stepNumber}>2</div>
          <div style={s.sectionTitle}>Upload file khuôn (.xlsx)</div></div>
        <div style={s.tip}>
          File khuôn phải có sẵn <strong>tên + mã vân tay</strong> và đúng thứ tự công nhân.
          Kỳ công lấy theo ngày trong file. Mỗi bộ phận = 1 sheet.
        </div>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xlsm" onChange={onFileChange} style={{ display: 'none' }} />
        {!file ? (
          <button onClick={() => fileInputRef.current?.click()} style={s.uploadBox}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>📂</div>
            <div style={s.uploadText}>Bấm để chọn file khuôn</div>
            <div style={s.uploadHint}>.xlsx, tối đa 10MB</div>
          </button>
        ) : (
          <div style={s.fileBox}>
            <div style={{ fontSize: 22 }}>📄</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.fileName}>{file.name}</div>
              <div style={s.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={reset} style={s.btnGhost}>✕</button>
          </div>
        )}
        {file && congTyId && !preview && (
          <button onClick={doPreview} disabled={parsing} style={s.btnPrimary}>
            {parsing ? 'Đang phân tích...' : 'Kiểm tra & xem trước →'}
          </button>
        )}
      </div>

      {error && <div style={s.errorBox}>⚠ {error}</div>}

      {/* Step 3: preview đối chiếu */}
      {preview && (
        <div style={s.section}>
          <div style={s.sectionHeader}><div style={s.stepNumber}>3</div>
            <div style={s.sectionTitle}>Đối chiếu trước khi xuất</div></div>

          <div style={s.kyCong}>
            Kỳ công: <b>{preview.ky_cong?.tu}</b> → <b>{preview.ky_cong?.den}</b> ·
            {' '}{tk?.so_sheet_nhan_dien} bộ phận · {tk?.so_nguoi_trong_file} người trong file
          </div>

          {preview.canh_bao?.length > 0 && (
            <div style={s.warnBox}>
              {preview.canh_bao.map((c, i) => <div key={i}>⚠ {c}</div>)}
            </div>
          )}

          <div style={s.summary}>
            <Stat label="Khớp & có công" value={tk?.so_nguoi_khop_co_cong} color="var(--green)" />
            <Stat label="Trong file, chưa có hồ sơ" value={tk?.so_trong_file_ngoai_he_thong} color="var(--amber)" />
            <Stat label="Trong file, không công" value={tk?.so_trong_file_khong_cong} color="var(--text2)" />
            <Stat label="Có công, thiếu trong file" value={tk?.so_co_cong_thieu_trong_file} color="var(--red)" />
          </div>

          <Group title="① Có trong file nhưng chưa có hồ sơ trong hệ thống" color="var(--amber)"
            count={dc.trong_file_ngoai_he_thong.length}
            cols={['Mã vân tay', 'Họ tên (file)', 'Sheet']}
            rows={dc.trong_file_ngoai_he_thong.map((x) => [x.ma_van_tay, x.ho_ten || '—', x.sheet])} />

          <Group title="② Có trong file + hệ thống nhưng không có công (sẽ để trống)" color="var(--text2)"
            count={dc.trong_file_khong_cong.length}
            cols={['Mã vân tay', 'Họ tên', 'Trạng thái']}
            rows={dc.trong_file_khong_cong.map((x) => [x.ma_van_tay, x.ho_ten, x.trang_thai])} />

          <Group title="③ Có công trong hệ thống nhưng THIẾU tên trong file — dữ liệu sẽ bị bỏ sót!" color="var(--red)"
            count={dc.co_cong_thieu_trong_file.length}
            cols={['Mã vân tay', 'Họ tên', 'Tổng giờ']}
            rows={dc.co_cong_thieu_trong_file.map((x) => [x.ma_van_tay || '—', x.ho_ten, (x.tong_gio ?? 0) + 'h'])} />

          {/* Nhóm 4: có checkbox chuyển nghỉ việc */}
          <div style={s.group}>
            <div style={{ ...s.groupHead, color: 'var(--text1)' }}>
              <span>④ Thuộc công ty, không có công & không trong file — gợi ý nghỉ việc
                <span style={s.badge}>{goiY.length}</span></span>
              {goiY.length > 0 && (
                <button onClick={doNghiViec} disabled={nghiViecing || chon.size === 0} style={s.btnDanger}>
                  {nghiViecing ? 'Đang xử lý...' : `Chuyển ${chon.size} người sang nghỉ việc`}
                </button>
              )}
            </div>
            {nghiViecMsg && <div style={s.okBox}>✓ {nghiViecMsg}</div>}
            {goiY.length === 0 ? (
              <div style={s.emptyRow}>Không có ai.</div>
            ) : (
              <div style={s.tableWrap}>
                <table style={s.table}>
                  <thead><tr>
                    <th style={{ ...s.th, width: 36 }}>
                      <input type="checkbox" checked={allChosen} onChange={toggleAll} />
                    </th>
                    <th style={s.th}>Mã vân tay</th><th style={s.th}>Họ tên</th><th style={s.th}>Trạng thái</th>
                  </tr></thead>
                  <tbody>
                    {goiY.map((x) => (
                      <tr key={x.id} style={chon.has(x.id) ? s.rowSel : null}>
                        <td style={s.td}><input type="checkbox" checked={chon.has(x.id)} onChange={() => toggle(x.id)} /></td>
                        <td style={s.tdMono}>{x.ma_van_tay || '—'}</td>
                        <td style={s.td}>{x.ho_ten}</td>
                        <td style={s.td}>{x.trang_thai}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div style={s.commitRow}>
            <button onClick={reset} style={s.btnGhost}>Huỷ, chọn file khác</button>
            <button onClick={doDownload} disabled={downloading} style={s.btnPrimary}>
              {downloading ? 'Đang xuất...' : '⬇ Tải file bảng công'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div style={s.summaryItem}>
      <div style={{ ...s.summaryValue, color }}>{value ?? 0}</div>
      <div style={s.summaryLabel}>{label}</div>
    </div>
  );
}

function Group({ title, color, count, cols, rows }) {
  const [open, setOpen] = useState(count > 0 && count <= 50);
  return (
    <div style={s.group}>
      <button type="button" onClick={() => setOpen((v) => !v)} style={{ ...s.groupHead, color }}>
        <span>{open ? '▼' : '▶'} {title}<span style={s.badge}>{count}</span></span>
      </button>
      {open && (count === 0 ? <div style={s.emptyRow}>Không có ai.</div> : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead><tr>{cols.map((c) => <th key={c} style={s.th}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{r.map((cell, j) => <td key={j} style={j === 0 ? s.tdMono : s.td}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

const s = {
  root: { padding: 24, maxWidth: 1200, fontFamily: "'Be Vietnam Pro', sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text2)', maxWidth: 720, lineHeight: 1.6 },
  section: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  stepNumber: { width: 24, height: 24, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  tip: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12 },
  uploadBox: { width: '100%', minHeight: 120, background: 'var(--bg3)', border: '2px dashed var(--border2)', borderRadius: 12, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' },
  uploadText: { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  uploadHint: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },
  fileBox: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px' },
  fileName: { fontSize: 13, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileSize: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  btnPrimary: { background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginTop: 14, fontFamily: 'inherit' },
  btnGhost: { background: 'transparent', border: '1px solid var(--border2)', color: 'var(--text2)', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger: { background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  errorBox: { background: 'rgba(255,95,114,0.1)', border: '1px solid rgba(255,95,114,0.3)', color: '#ff5f72', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16 },
  warnBox: { background: 'rgba(255,179,68,0.1)', border: '1px solid rgba(255,179,68,0.3)', color: 'var(--amber)', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 12, lineHeight: 1.6 },
  okBox: { background: 'rgba(34,201,134,0.1)', border: '1px solid rgba(34,201,134,0.3)', color: 'var(--green)', borderRadius: 8, padding: '8px 12px', fontSize: 12, margin: '8px 0' },
  kyCong: { fontSize: 13, color: 'var(--text2)', marginBottom: 12 },
  summary: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 },
  summaryItem: { background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' },
  summaryValue: { fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
  summaryLabel: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  group: { border: '1px solid var(--border)', borderRadius: 10, marginBottom: 10, overflow: 'hidden' },
  groupHead: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, background: 'var(--bg2)', border: 'none', borderBottom: '1px solid var(--border)', padding: '10px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' },
  badge: { display: 'inline-block', marginLeft: 8, background: 'var(--bg3)', color: 'var(--text2)', borderRadius: 10, padding: '1px 8px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace" },
  emptyRow: { padding: '12px 14px', fontSize: 12, color: 'var(--text3)' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { background: 'var(--bg1)', color: 'var(--text3)', fontWeight: 700, fontSize: 10, letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
  td: { padding: '7px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text1)' },
  tdMono: { padding: '7px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
  rowSel: { background: 'rgba(255,95,114,0.06)' },
  commitRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 },
};
