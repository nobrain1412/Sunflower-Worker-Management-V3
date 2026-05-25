import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../hooks/useApi';

export default function ImportExcel() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [committing, setCommitting] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  // Chuẩn hoá lỗi từ interceptor ({ code, message, details }) thành text dễ hiểu.
  // Lỗi validate (VALIDATION_ERROR) sẽ kèm danh sách field bị sai.
  function describeErr(err, fallback) {
    const base = err?.message || fallback;
    if (err?.code === 'VALIDATION_ERROR' && Array.isArray(err.details) && err.details.length) {
      const lines = err.details
        .map((d) => (d.field ? `• ${d.field}: ${d.message}` : `• ${d.message}`))
        .join('\n');
      return `Dữ liệu không hợp lệ:\n${lines}`;
    }
    return base;
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

  async function downloadTemplate() {
    try {
      const res = await api.get('/cong-nhan/import-excel/template', { responseType: 'blob' });
      // axios với responseType:'blob' trả thẳng res = Blob (vì api interceptor unwrap res.data)
      const blob = res instanceof Blob ? res : new Blob([res]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'template-cong-nhan.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err?.message || 'Không tải được template');
    }
  }

  async function doPreview() {
    if (!file) return;
    setParsing(true);
    setError('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.post('/cong-nhan/import-excel/preview', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setPreview(res.data);
    } catch (err) {
      setError(describeErr(err, 'Parse Excel thất bại'));
    } finally {
      setParsing(false);
    }
  }

  // Payload các dòng (đã có thể sửa tay) gửi cho backend
  function rowsPayload() {
    return (preview?.rows ?? []).map((r) => ({
      rowNumber:    r.rowNumber,
      data:         r.data,
      vender_name:  r.vender_name ?? null,
      cong_ty_name: r.cong_ty_name ?? null,
    }));
  }

  // Sửa 1 ô trong bảng preview
  function editRow(rowNumber, field, value) {
    setPreview((prev) => {
      if (!prev) return prev;
      const rows = prev.rows.map((r) => {
        if (r.rowNumber !== rowNumber) return r;
        if (field === 'vender_name' || field === 'cong_ty_name') {
          return { ...r, [field]: value };
        }
        return { ...r, data: { ...r.data, [field]: value } };
      });
      return { ...prev, rows };
    });
  }

  // Kiểm tra lại các dòng đã sửa (không ghi DB)
  async function doRevalidate() {
    setParsing(true);
    setError('');
    try {
      const res = await api.post('/cong-nhan/import-excel/revalidate', { rows: rowsPayload() });
      setPreview(res.data);
    } catch (err) {
      setError(describeErr(err, 'Kiểm tra lại thất bại'));
    } finally {
      setParsing(false);
    }
  }

  async function doCommit() {
    if (!preview) return;
    if (!window.confirm(
      `Sắp insert ${preview.summary.ready} công nhân vào DB. ${preview.summary.skipRows} dòng sẽ skip (CCCD trùng), ${preview.summary.errorRows} dòng lỗi sẽ bị bỏ qua. Tiếp tục?`
    )) return;

    setCommitting(true);
    setError('');
    try {
      const res = await api.post('/cong-nhan/import-excel/commit-rows', { rows: rowsPayload() });
      setResult(res.data);
    } catch (err) {
      setError(describeErr(err, 'Import thất bại'));
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
          <h1 style={s.title}>Import danh sách công nhân từ Excel</h1>
          <p style={s.subtitle}>
            Upload file .xlsx → xem preview → xác nhận thêm vào DB.
            CCCD đã tồn tại sẽ được tự động skip.
          </p>
        </div>
        <button onClick={() => navigate('/cong-nhan')} style={s.btnGhost}>
          ← Quay lại
        </button>
      </div>

      {/* Step 1: Upload */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <div style={s.stepNumber}>1</div>
          <div style={s.sectionTitle}>Chuẩn bị file Excel</div>
        </div>
        <div style={s.tip}>
          <strong>Cột yêu cầu</strong> (header dòng 1): Họ tên (bắt buộc), CCCD, Ngày sinh, Ngày vào,
          Địa chỉ, SĐT, Mã vân tay, Vender, Công ty, Bộ phận.
          <br />
          <strong>Lưu ý:</strong> Cột Vender có thể ghi <em>họ tên</em> hoặc <em>mã vender</em> của user. Công ty phải khớp <em>tên công ty</em> đã có trong DB. Dòng nào lỗi có thể sửa trực tiếp ở bước preview.
        </div>
        <button onClick={downloadTemplate} style={s.btnSecondary}>
          ⬇ Tải file template mẫu
        </button>
      </div>

      {/* Step 2: Upload */}
      <div style={s.section}>
        <div style={s.sectionHeader}>
          <div style={s.stepNumber}>2</div>
          <div style={s.sectionTitle}>Upload file .xlsx</div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xlsm,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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

        {file && !preview && !result && (
          <button onClick={doPreview} disabled={parsing} style={s.btnPrimary}>
            {parsing ? 'Đang xử lý...' : 'Xem preview →'}
          </button>
        )}
      </div>

      {error && (
        <div style={s.errorBox}>⚠ {error}</div>
      )}

      {/* Step 3: Preview */}
      {preview && !result && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <div style={s.stepNumber}>3</div>
            <div style={s.sectionTitle}>Preview & xác nhận</div>
          </div>

          <div style={s.summary}>
            <SummaryItem label="Tổng dòng" value={preview.summary.total} color="var(--text1)" />
            <SummaryItem label="Sẽ insert" value={preview.summary.ready} color="var(--green)" />
            <SummaryItem label="Skip (trùng CCCD)" value={preview.summary.skipRows} color="var(--amber)" />
            <SummaryItem label="Có lỗi" value={preview.summary.errorRows} color="var(--red)" />
          </div>

          <div style={s.tip}>
            ✏️ Bạn có thể <strong>sửa trực tiếp</strong> các ô trong bảng (đặc biệt là dòng bị lỗi),
            rồi bấm <strong>Kiểm tra lại</strong> để xác thực trước khi import.
          </div>

          <PreviewTable rows={preview.rows} onEdit={editRow} />

          <div style={s.commitRow}>
            <button onClick={reset} style={s.btnGhost}>Huỷ, chọn file khác</button>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={doRevalidate} disabled={parsing} style={s.btnSecondary}>
                {parsing ? 'Đang kiểm tra...' : '↻ Kiểm tra lại'}
              </button>
              <button
                onClick={doCommit}
                disabled={committing || preview.summary.ready === 0}
                style={s.btnPrimary}
              >
                {committing
                  ? 'Đang import...'
                  : `Xác nhận import ${preview.summary.ready} công nhân`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Result */}
      {result && (
        <div style={s.section}>
          <div style={s.successBox}>
            <div style={s.successIcon}>✓</div>
            <div>
              <div style={s.successTitle}>Import thành công</div>
              <div style={s.successText}>
                Đã thêm <b>{result.inserted}</b> công nhân.
                {result.skipped > 0 && ` Skip ${result.skipped} dòng (CCCD trùng).`}
                {result.errorRows > 0 && ` ${result.errorRows} dòng bị lỗi.`}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={reset} style={s.btnGhost}>Import file khác</button>
            <button onClick={() => navigate('/cong-nhan')} style={s.btnPrimary}>
              Về danh sách công nhân →
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

function EditCell({ value, onChange, mono, placeholder }) {
  return (
    <input
      value={value ?? ''}
      placeholder={placeholder ?? ''}
      onChange={(e) => onChange(e.target.value)}
      style={{ ...s.cellInput, ...(mono ? s.cellInputMono : null) }}
    />
  );
}

function PreviewTable({ rows, onEdit }) {
  return (
    <div style={s.tableWrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.th}>#</th>
            <th style={s.th}>Trạng thái</th>
            <th style={s.th}>Họ tên</th>
            <th style={s.th}>CCCD</th>
            <th style={s.th}>Ngày sinh</th>
            <th style={s.th}>SĐT</th>
            <th style={s.th}>Vender (tên/mã)</th>
            <th style={s.th}>Công ty</th>
            <th style={s.th}>Ngày vào</th>
            <th style={s.th}>Vấn đề</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const hasError = r.errors.length > 0;
            const willSkip = r.skip;
            let statusLabel = 'OK';
            let statusColor = 'var(--green)';
            if (hasError) { statusLabel = 'Lỗi'; statusColor = 'var(--red)'; }
            else if (willSkip) { statusLabel = 'Skip'; statusColor = 'var(--amber)'; }

            const venderNotFound = r.vender_name && !r.data.nguoi_tuyen_id;
            const congTyNotFound = r.cong_ty_name && !r.data.cong_ty_id;

            return (
              <tr key={r.rowNumber} style={hasError ? s.rowError : willSkip ? s.rowSkip : null}>
                <td style={s.td}>{r.rowNumber}</td>
                <td style={s.td}>
                  <span style={{ ...s.pill, color: statusColor, borderColor: statusColor }}>
                    {statusLabel}
                  </span>
                </td>
                <td style={s.td}>
                  <EditCell value={r.data.ho_ten} onChange={(v) => onEdit(r.rowNumber, 'ho_ten', v)} />
                </td>
                <td style={s.td}>
                  <EditCell value={r.data.cccd} mono onChange={(v) => onEdit(r.rowNumber, 'cccd', v)} placeholder="12 số" />
                </td>
                <td style={s.td}>
                  <EditCell value={r.data.ngay_sinh} mono onChange={(v) => onEdit(r.rowNumber, 'ngay_sinh', v)} placeholder="YYYY-MM-DD" />
                </td>
                <td style={s.td}>
                  <EditCell value={r.data.so_dien_thoai} mono onChange={(v) => onEdit(r.rowNumber, 'so_dien_thoai', v)} />
                </td>
                <td style={s.td}>
                  <EditCell value={r.vender_name}
                    onChange={(v) => onEdit(r.rowNumber, 'vender_name', v)}
                    placeholder="tên hoặc mã vender" />
                  {venderNotFound && <span style={{ color: 'var(--red)', fontSize: 10 }}>không tìm thấy</span>}
                </td>
                <td style={s.td}>
                  <EditCell value={r.cong_ty_name} onChange={(v) => onEdit(r.rowNumber, 'cong_ty_name', v)} />
                  {congTyNotFound && <span style={{ color: 'var(--red)', fontSize: 10 }}>không tìm thấy</span>}
                </td>
                <td style={s.td}>
                  <EditCell value={r.data.ngay_vao_lam} mono onChange={(v) => onEdit(r.rowNumber, 'ngay_vao_lam', v)} placeholder="YYYY-MM-DD" />
                </td>
                <td style={s.td}>
                  {[...r.errors, ...r.warnings].length === 0 ? '—' : [...r.errors, ...r.warnings].map((m, i) => (
                    <div key={i} style={{
                      fontSize: 11,
                      color: r.errors.includes(m) ? 'var(--red)' : 'var(--amber)',
                    }}>{m}</div>
                  ))}
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
  root: { padding: 24, maxWidth: 1200, fontFamily: "'Be Vietnam Pro', sans-serif" },
  header: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 24 },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text1)', marginBottom: 6 },
  subtitle: { fontSize: 13, color: 'var(--text2)' },

  section: {
    background: 'var(--bg1)',
    border: '1px solid var(--border)',
    borderRadius: 12, padding: 20, marginBottom: 16,
  },
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
    background: 'var(--bg3)',
    border: '2px dashed var(--border2)',
    borderRadius: 12, cursor: 'pointer',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  uploadIcon: { fontSize: 32, marginBottom: 8 },
  uploadText: { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  uploadHint: { fontSize: 11, color: 'var(--text3)', marginTop: 4 },

  fileBox: {
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 10, padding: '12px 14px',
  },
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
  btnSecondary: {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    color: 'var(--text1)', borderRadius: 8,
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 8,
    padding: '8px 14px', fontSize: 12, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },

  errorBox: {
    background: 'rgba(255,95,114,0.1)',
    border: '1px solid rgba(255,95,114,0.3)',
    color: '#ff5f72', borderRadius: 8,
    padding: '10px 14px', fontSize: 12, marginBottom: 16,
    whiteSpace: 'pre-line',
  },

  summary: {
    display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10,
    marginBottom: 16,
  },
  summaryItem: {
    background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px',
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 22, fontWeight: 700,
    fontFamily: "'JetBrains Mono', monospace",
  },
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
  td: {
    padding: '8px 12px', borderBottom: '1px solid var(--border)',
    color: 'var(--text1)', verticalAlign: 'top',
  },
  tdMono: {
    padding: '8px 12px', borderBottom: '1px solid var(--border)',
    color: 'var(--text1)', verticalAlign: 'top',
    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
  },
  cellInput: {
    width: '100%', minWidth: 90,
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 6, padding: '5px 7px', fontSize: 12, color: 'var(--text1)',
    fontFamily: "'Be Vietnam Pro', sans-serif", outline: 'none',
  },
  cellInputMono: { fontFamily: "'JetBrains Mono', monospace", fontSize: 11 },
  rowError: { background: 'rgba(255,95,114,0.04)' },
  rowSkip:  { background: 'rgba(255,179,68,0.04)' },
  pill: {
    display: 'inline-block', padding: '2px 8px',
    border: '1px solid', borderRadius: 12,
    fontSize: 10, fontWeight: 600,
  },

  commitRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },

  successBox: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(34,201,134,0.08)',
    border: '1px solid rgba(34,201,134,0.3)',
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
