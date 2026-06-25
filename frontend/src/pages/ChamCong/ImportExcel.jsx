import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../hooks/useApi';
import { useCongTyList } from '../../hooks/useCongNhan';

const CA_LAM_LABEL = {
  lam:       { label: 'Đi làm',   color: 'var(--green)' },
  nghi_phep: { label: 'Báo nghỉ', color: 'var(--amber)' },
  nghi_viec: { label: 'Nghỉ việc', color: 'var(--red)' },
};

export default function ImportChamCongExcel() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [congTyId, setCongTyId] = useState('');
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  const congTyArr = useCongTyList().data?.data ?? [];

  async function downloadTemplate() {
    if (!congTyId) { setError('Chọn công ty trước'); return; }
    setDownloading(true);
    setError('');
    try {
      const blob = await api.get('/cham-cong/import-excel/template', {
        params: { cong_ty_id: congTyId },
        responseType: 'blob',
      });
      const ct = congTyArr.find((c) => String(c.id) === String(congTyId));
      const name = (ct?.ten_cong_ty || 'cong-ty')
        .normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mau-cham-cong_${name}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Tải file mẫu thất bại');
    } finally {
      setDownloading(false);
    }
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  function onFileChange(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
  }

  async function doPreview() {
    if (!file) { setError('Chưa chọn file'); return; }
    if (!congTyId) { setError('Chọn công ty trước'); return; }
    setParsing(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('cong_ty_id', congTyId);
      // KHÔNG tự set Content-Type — để trình duyệt tự thêm boundary cho multipart.
      const res = await api.post('/cham-cong/import-excel/preview', fd);
      setPreview(res.data);
    } catch (err) {
      setError(err?.message || 'Parse Excel thất bại');
    } finally {
      setParsing(false);
    }
  }

  async function doCommit() {
    if (!preview) return;
    if (!window.confirm(
      `Sắp UPSERT ${preview.summary.ready} dòng chấm công. ${preview.summary.skipRows} dòng skip (CN không thuộc công ty). Dữ liệu cùng ngày sẽ bị ĐÈ. Tiếp tục?`
    )) return;

    setCommitting(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('cong_ty_id', congTyId);
      // KHÔNG tự set Content-Type — để trình duyệt tự thêm boundary cho multipart.
      const res = await api.post('/cham-cong/import-excel/commit', fd);
      setResult(res.data);
    } catch (err) {
      setError(err?.message || 'Import thất bại');
    } finally {
      setCommitting(false);
    }
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Import chấm công từ máy vân tay</h1>
          <p style={s.subtitle}>
            Upload file Excel xuất từ máy vân tay → match Mã thẻ → tự tính so_gio + so_gio_ot.
            Dữ liệu cùng phan_cong + ngày sẽ bị đè.
          </p>
        </div>
        <button onClick={() => navigate('/cham-cong')} style={s.btnGhost}>
          ← Quay lại
        </button>
      </div>

      {/* Step 1: chọn công ty */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <div style={s.stepNumber}>1</div>
          <div style={s.sectionTitle}>Chọn công ty của file vân tay</div>
        </div>
        <div style={s.tip}>
          Mỗi file vân tay thuộc 1 công ty và có <strong>định dạng riêng theo công ty</strong>.
          Tải file mẫu đúng định dạng công ty đó rồi điền dữ liệu vào. CN nào không có phân công
          công ty này tại ngày tương ứng sẽ bị skip (báo trong preview).
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-input"
            value={congTyId}
            onChange={(e) => { setCongTyId(e.target.value); setPreview(null); }}
            style={{ maxWidth: 400 }}
          >
            <option value="">-- Chọn công ty --</option>
            {congTyArr.map((ct) => (
              <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>
            ))}
          </select>
          {congTyId && (
            <button onClick={downloadTemplate} disabled={downloading} style={s.btnGhost}>
              {downloading ? 'Đang tải...' : '⬇ Tải file mẫu'}
            </button>
          )}
        </div>
      </div>

      {/* Step 2: upload */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <div style={s.stepNumber}>2</div>
          <div style={s.sectionTitle}>Upload file Excel vân tay</div>
        </div>
        <div style={s.tip}>
          <strong>Cột bắt buộc:</strong> Mã thẻ, Ngày. <br />
          <strong>Định dạng theo công ty</strong> — dùng đúng cột trong file mẫu vừa tải.
          Có thể kèm cột <strong>Giờ đến, Nghỉ trưa, Giờ về</strong> để hiện khi bấm vào 1 ngày. <br />
          Các cột không nhận diện (Lịch sử chấm vân tay, Đang hoạt động, Đề xuất tăng ca...) sẽ được bỏ qua.
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm"
          onChange={onFileChange}
          style={{ display: 'none' }}
        />

        {!file ? (
          <button onClick={pickFile} style={s.uploadBox}>
            <div style={s.uploadIcon}>📂</div>
            <div style={s.uploadText}>Bấm để chọn file Excel</div>
            <div style={s.uploadHint}>Hỗ trợ .xlsx, tối đa 10MB</div>
          </button>
        ) : (
          <div style={s.fileBox}>
            <div style={s.fileIcon}>📄</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={s.fileName}>{file.name}</div>
              <div style={s.fileSize}>{(file.size / 1024).toFixed(1)} KB</div>
            </div>
            <button onClick={reset} style={s.btnGhost}>✕</button>
          </div>
        )}

        {file && congTyId && !preview && !result && (
          <button onClick={doPreview} disabled={parsing} style={s.btnPrimary}>
            {parsing ? 'Đang xử lý...' : 'Xem preview →'}
          </button>
        )}
      </div>

      {error && <div style={s.errorBox}>⚠ {error}</div>}

      {/* Step 3: preview */}
      {preview && !result && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <div style={s.stepNumber}>3</div>
            <div style={s.sectionTitle}>Preview & xác nhận</div>
          </div>

          <div style={s.summary}>
            <SummaryItem label="Tổng dòng" value={preview.summary.total} color="var(--text1)" />
            <SummaryItem label="Sẽ ghi (insert/update)" value={preview.summary.ready} color="var(--green)" />
            <SummaryItem label="Skip" value={preview.summary.skipRows} color="var(--amber)" />
            <SummaryItem label="Có lỗi" value={preview.summary.errorRows} color="var(--red)" />
          </div>

          <PreviewTable rows={preview.rows} />

          <div style={s.commitRow}>
            <button onClick={reset} style={s.btnGhost}>Huỷ, chọn file khác</button>
            <button
              onClick={doCommit}
              disabled={committing || preview.summary.ready === 0}
              style={s.btnPrimary}
            >
              {committing ? 'Đang import...' : `Xác nhận import ${preview.summary.ready} dòng`}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: result */}
      {result && (
        <div style={s.section}>
          <div style={s.successBox}>
            <div style={s.successIcon}>✓</div>
            <div>
              <div style={s.successTitle}>Import xong</div>
              <div style={s.successText}>
                <b>Thêm:</b> {result.inserted} · <b>Cập nhật:</b> {result.updated} · <b>Skip:</b> {result.skipped}
                {result.errorRows > 0 && ` · Lỗi: ${result.errorRows}`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={reset} style={s.btnGhost}>Import file khác</button>
            <button onClick={() => navigate('/cham-cong')} style={s.btnPrimary}>
              Về bảng chấm công →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryItem({ label, value, color }) {
  return (
    <div style={s.summaryItem}>
      <div style={{ ...s.summaryValue, color }}>{value}</div>
      <div style={s.summaryLabel}>{label}</div>
    </div>
  );
}

function PreviewTable({ rows }) {
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Trạng thái</th>
            <th style={s.th}>Mã thẻ</th>
            <th style={s.th}>Họ tên (DB)</th>
            <th style={s.th}>Bộ phận</th>
            <th style={s.th}>Ngày</th>
            <th style={s.th}>Đến</th>
            <th style={s.th}>Trưa</th>
            <th style={s.th}>Về</th>
            <th style={s.th}>Giờ</th>
            <th style={s.th}>OT</th>
            <th style={s.th}>Ca làm</th>
            <th style={s.th}>Vấn đề</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hasError = r.errors.length > 0;
            const willSkip = r.skip;
            let statusLabel = 'OK', statusColor = 'var(--green)';
            if (hasError) { statusLabel = 'Lỗi'; statusColor = 'var(--red)'; }
            else if (willSkip) { statusLabel = 'Skip'; statusColor = 'var(--amber)'; }

            const caLam = CA_LAM_LABEL[r.ca_lam] ?? { label: r.ca_lam ?? '—', color: 'var(--text2)' };

            return (
              <tr key={r.rowNumber} style={hasError ? s.rowError : willSkip ? s.rowSkip : null}>
                <td style={s.td}>{r.rowNumber}</td>
                <td style={s.td}>
                  <span style={{ ...s.pill, color: statusColor, borderColor: statusColor }}>
                    {statusLabel}
                  </span>
                </td>
                <td style={s.tdMono}>{r.ma_van_tay ?? '—'}</td>
                <td style={s.td}>{r.cong_nhan_ho_ten ?? <span style={{ color: 'var(--text3)' }}>{r.display_name ?? '—'}</span>}</td>
                <td style={s.td}>{r.bo_phan ?? '—'}</td>
                <td style={s.tdMono}>{r.ngay ?? '—'}</td>
                <td style={s.tdMono}>{r.gio_den ?? '—'}</td>
                <td style={s.tdMono}>{r.gio_nghi_trua ?? '—'}</td>
                <td style={s.tdMono}>{r.gio_ve ?? '—'}</td>
                <td style={s.tdMono}>{r.so_gio}</td>
                <td style={s.tdMono}>{r.so_gio_ot}</td>
                <td style={s.td}>
                  <span style={{ color: caLam.color, fontWeight: 600, fontSize: 11 }}>
                    {caLam.label}
                  </span>
                </td>
                <td style={s.td}>
                  {[...r.errors, ...r.warnings].map((m, i) => (
                    <div key={i} style={{
                      fontSize: 11,
                      color: r.errors.includes(m) ? 'var(--red)' : 'var(--amber)',
                    }}>{m}</div>
                  ))}
                  {r.errors.length === 0 && r.warnings.length === 0 && '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const s = {
  root: { padding: 24, maxWidth: 1300, fontFamily: "'Be Vietnam Pro', sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text2)' },

  section: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 16 },
  sectionHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 },
  stepNumber: {
    width: 24, height: 24, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', fontSize: 12, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },

  tip: {
    background: 'var(--bg3)', border: '1px solid var(--border)',
    borderRadius: 8, padding: '10px 14px', fontSize: 12,
    color: 'var(--text2)', lineHeight: 1.6, marginBottom: 12,
  },

  uploadBox: {
    width: '100%', minHeight: 140,
    background: 'var(--bg3)', border: '2px dashed var(--border2)',
    borderRadius: 12, cursor: 'pointer',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  uploadHint: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },

  fileBox: { display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 10, padding: '12px 14px' },
  fileIcon: { fontSize: 22 },
  fileName: { fontSize: 13, fontWeight: 600, color: 'var(--text1)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  fileSize: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },

  btnPrimary: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '10px 16px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', marginTop: 14,
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 8,
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  errorBox: {
    background: 'rgba(255,95,114,0.1)', border: '1px solid rgba(255,95,114,0.3)',
    color: '#ff5f72', borderRadius: 8, padding: '10px 14px', fontSize: 12, marginBottom: 16,
  },
  summary: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 },
  summaryItem: { background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px', textAlign: 'center' },
  summaryValue: { fontSize: 22, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" },
  summaryLabel: { fontSize: 11, color: 'var(--text3)', marginTop: 2 },

  tableWrap: { overflowX: 'auto', marginBottom: 16, border: '1px solid var(--border)', borderRadius: 8 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: {
    background: 'var(--bg2)', color: 'var(--text2)',
    fontWeight: 600, fontSize: 10, letterSpacing: '0.05em',
    textTransform: 'uppercase', textAlign: 'left',
    padding: '10px 12px', borderBottom: '1px solid var(--border)',
    whiteSpace: 'nowrap',
  },
  td: { padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text1)', verticalAlign: 'top' },
  tdMono: { padding: '8px 12px', borderBottom: '1px solid var(--border)', color: 'var(--text1)', verticalAlign: 'top', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
  rowError: { background: 'rgba(255,95,114,0.04)' },
  rowSkip:  { background: 'rgba(255,179,68,0.04)' },
  pill: { display: 'inline-block', padding: '2px 8px', border: '1px solid', borderRadius: 12, fontSize: 10, fontWeight: 600 },

  commitRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  successBox: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(34,201,134,0.08)', border: '1px solid rgba(34,201,134,0.3)',
    borderRadius: 10, padding: 16,
  },
  successIcon: {
    width: 40, height: 40, borderRadius: '50%',
    background: 'var(--green)', color: '#fff',
    fontSize: 22, fontWeight: 700,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  successTitle: { fontSize: 14, fontWeight: 700, color: 'var(--text1)' },
  successText:  { fontSize: 12, color: 'var(--text2)', marginTop: 2 },
};
