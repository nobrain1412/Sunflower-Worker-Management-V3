/**
 * Form đề xuất chung (loai = 'khac') — mọi user gửi cho admin duyệt.
 * Nội dung tự do, không tác động dữ liệu khi duyệt.
 */
import { useState } from 'react';
import { useSubmitDeXuat } from '../../hooks/useCongTyDeXuat';

export default function DeXuatChungModal({ onClose }) {
  const submit = useSubmitDeXuat();
  const [tieuDe, setTieuDe] = useState('');
  const [noiDung, setNoiDung] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!noiDung.trim()) { setError('Vui lòng nhập nội dung đề xuất'); return; }
    try {
      await submit.mutateAsync({
        loai: 'khac',
        du_lieu: {
          tieu_de: tieuDe.trim() || undefined,
          noi_dung: noiDung.trim(),
        },
      });
      setSuccess(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err?.message || 'Gửi đề xuất thất bại');
    }
  }

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.header}>
          <div>
            <h2 style={s.title}>Đề xuất chung</h2>
            <p style={s.subtitle}>Gửi đề xuất tự do cho admin xem xét</p>
          </div>
          <button style={s.closeBtn} onClick={onClose} aria-label="Đóng">✕</button>
        </div>

        {success ? (
          <div style={s.successBox}>
            <div style={s.successIcon}>✓</div>
            <div>
              <div style={s.successTitle}>Đã gửi đề xuất</div>
              <div style={s.successText}>Admin sẽ xem xét và phản hồi sớm</div>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={s.form}>
            <div style={s.field}>
              <label style={s.label}>Tiêu đề (tuỳ chọn)</label>
              <input
                className="form-input"
                value={tieuDe}
                maxLength={200}
                onChange={(e) => setTieuDe(e.target.value)}
                placeholder="Vd: Đề xuất mua thêm thiết bị chấm công"
              />
            </div>
            <div style={s.field}>
              <label style={s.label}>Nội dung đề xuất *</label>
              <textarea
                className="form-input"
                rows={6}
                value={noiDung}
                maxLength={5000}
                onChange={(e) => setNoiDung(e.target.value)}
                placeholder="Mô tả chi tiết đề xuất của bạn..."
              />
            </div>

            {error && <div style={s.errorBox}>⚠ {error}</div>}

            <div style={s.actions}>
              <button type="button" onClick={onClose} style={s.btnGhost} disabled={submit.isPending}>
                Huỷ
              </button>
              <button type="submit" style={s.btnPrimary} disabled={submit.isPending}>
                {submit.isPending ? 'Đang gửi...' : 'Gửi đề xuất'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: 16, overflow: 'auto',
  },
  card: {
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '92vh',
    overflow: 'auto', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
  },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 },
  subtitle: { fontSize: 12, color: 'var(--text2)' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, fontSize: 18, lineHeight: 1,
  },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 14 },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 10, fontWeight: 700, color: 'var(--text2)', letterSpacing: '0.05em' },
  errorBox: {
    background: 'rgba(255,95,114,0.1)', border: '1px solid rgba(255,95,114,0.3)',
    color: '#ff5f72', borderRadius: 8, padding: '10px 14px', fontSize: 12,
  },
  actions: {
    display: 'flex', gap: 10, justifyContent: 'flex-end',
    paddingTop: 8, borderTop: '1px solid var(--border)',
  },
  btnGhost: {
    background: 'transparent', border: '1px solid var(--border2)',
    color: 'var(--text2)', borderRadius: 8,
    padding: '9px 18px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    color: '#fff', border: 'none', borderRadius: 8,
    padding: '9px 24px', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  successBox: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'rgba(34,201,134,0.08)', border: '1px solid rgba(34,201,134,0.3)',
    borderRadius: 10, padding: 20, margin: 20,
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
