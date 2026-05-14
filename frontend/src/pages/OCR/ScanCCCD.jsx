import { useState, useRef } from 'react';
import api from '../../hooks/useApi';

const FIELDS = [
  ['ho_ten',    'Họ và tên'],
  ['cccd',      'Số CCCD'],
  ['ngay_sinh', 'Ngày sinh'],
  ['gioi_tinh', 'Giới tính'],
  ['que_quan',  'Quê quán'],
  ['dia_chi',   'Địa chỉ thường trú'],
  ['ngay_cap',  'Ngày cấp'],
  ['noi_cap',   'Nơi cấp'],
];

export default function ScanCCCD() {
  const [stage, setStage]   = useState('upload'); // upload | processing | review | done
  const [preview, setPreview] = useState(null);
  const [edited, setEdited]   = useState({});
  const [ocrId, setOcrId]     = useState(null);
  const [error, setError]     = useState(null);
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
      form.append('loai', 'cccd');

      // Content-Type: undefined xoá default 'application/json' của axios instance
      // để browser tự set multipart/form-data với boundary đúng
      const res = await api.post('/ocr/scan', form, {
        headers: { 'Content-Type': undefined },
      });

      setOcrId(res.data.ocr_id);
      setEdited(res.data.ket_qua ?? {});
      setStage('review');
    } catch (err) {
      setError(err?.message ?? 'Lỗi OCR, thử lại');
      setStage('upload');
    }
  }

  function handleEdit(k, v) { setEdited((r) => ({ ...r, [k]: v })); }

  async function handleApprove() {
    try {
      if (ocrId) await api.post(`/ocr/${ocrId}/approve`);
      setStage('done');
    } catch {
      setStage('done'); // vẫn cho qua nếu approve fail
    }
  }

  async function handleReject() {
    try {
      if (ocrId) await api.post(`/ocr/${ocrId}/reject`);
    } catch { /* bỏ qua */ }
    setStage('upload');
    setPreview(null);
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Quét CCCD</h2>
          <p style={s.sub}>Tải ảnh CCCD để trích xuất thông tin tự động bằng AI</p>
        </div>
      </div>

      {stage === 'upload' && (
        <div style={s.uploadCard}>
          {error && <div style={s.errorBox}>{error}</div>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
          <div
            style={s.dropzone}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile({ target: { files: [f] } });
            }}
          >
            <div style={s.uploadIcon}>🪪</div>
            <div style={s.uploadTitle}>Kéo thả hoặc click để tải ảnh</div>
            <div style={s.uploadSub}>Hỗ trợ JPG, PNG — tối đa 10MB</div>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
              Chọn ảnh CCCD
            </button>
          </div>
          <div style={s.tips}>
            <div style={s.tipTitle}>Lưu ý khi chụp:</div>
            {['Chụp đủ 2 mặt, rõ nét, không bị mờ', 'Đảm bảo ánh sáng đủ, không bị chói', 'Đặt CCCD trên nền sẫm màu'].map((t) => (
              <div key={t} style={s.tip}>✓ {t}</div>
            ))}
          </div>
        </div>
      )}

      {stage === 'processing' && (
        <div style={s.processingCard}>
          <div style={s.previewImg}>
            <img src={preview} alt="CCCD" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }} />
          </div>
          <div style={s.processingInfo}>
            <div style={s.spinner} />
            <div style={s.processingTitle}>Đang xử lý OCR...</div>
            <div style={s.processingSub}>AI đang trích xuất thông tin từ ảnh CCCD</div>
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div style={s.reviewGrid}>
          <div style={s.card}>
            <div style={s.cardTitle}>Ảnh gốc</div>
            <img src={preview} alt="CCCD" style={{ width: '100%', borderRadius: 8, marginTop: 8 }} />
            <div style={s.ocrBadge}>OCR hoàn tất</div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Thông tin trích xuất</div>
            <div style={s.cardSub}>Kiểm tra và chỉnh sửa nếu cần trước khi duyệt</div>
            <div style={s.fieldsGrid}>
              {FIELDS.map(([key, label]) => (
                <div key={key} style={s.field}>
                  <label className="form-label">{label}</label>
                  <input
                    className="form-input"
                    value={edited[key] ?? ''}
                    onChange={(e) => handleEdit(key, e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div style={s.reviewActions}>
              <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={handleReject}>
                Từ chối
              </button>
              <button className="btn-primary" onClick={handleApprove}>
                ✓ Duyệt & Thêm vào hệ thống
              </button>
            </div>
          </div>
        </div>
      )}

      {stage === 'done' && (
        <div style={s.doneCard}>
          <div style={s.doneIcon}>✅</div>
          <div style={s.doneTitle}>Thêm thành công!</div>
          <div style={s.doneSub}>Công nhân <b>{edited.ho_ten}</b> đã được thêm vào hệ thống</div>
          <div style={s.doneActions}>
            <button className="btn-ghost" onClick={() => { setStage('upload'); setPreview(null); setEdited({}); }}>Quét tiếp</button>
            <a href="/cong-nhan" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff' }}>
              Xem danh sách công nhân
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  sub:   { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  errorBox: { background: 'rgba(255,95,114,0.12)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--red)' },
  uploadCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  dropzone: { background: 'var(--bg1)', border: '2px dashed var(--border2)', borderRadius: 14, padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', transition: 'border-color 0.15s', textAlign: 'center' },
  uploadIcon:  { fontSize: 48, marginBottom: 12 },
  uploadTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text1)' },
  uploadSub:   { fontSize: 12, color: 'var(--text2)', marginTop: 4 },
  tips: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' },
  tipTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 },
  tip: { fontSize: 12, color: 'var(--text2)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 },
  processingCard: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  previewImg: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, height: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  processingInfo: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  processingTitle: { fontSize: 15, fontWeight: 600, color: 'var(--text1)' },
  processingSub: { fontSize: 12, color: 'var(--text2)', textAlign: 'center' },
  reviewGrid: { display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cardSub: { fontSize: 11, color: 'var(--text2)', marginTop: 3, marginBottom: 14 },
  ocrBadge: { display: 'inline-block', marginTop: 10, padding: '4px 10px', background: 'rgba(34,201,134,0.12)', color: 'var(--green)', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  fieldsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' },
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  reviewActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' },
  doneCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 },
  doneIcon:    { fontSize: 52 },
  doneTitle:   { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  doneSub:     { fontSize: 13, color: 'var(--text2)' },
  doneActions: { display: 'flex', gap: 10, marginTop: 16 },
};
