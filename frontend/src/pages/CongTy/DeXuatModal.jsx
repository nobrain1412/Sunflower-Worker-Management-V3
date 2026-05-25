/**
 * Form đề xuất tạo mới HOẶC sửa thông tin công ty (cho quản lý).
 * Sau khi submit → vào hàng chờ, admin duyệt mới ghi vào bảng cong_ty.
 *
 * Props:
 *   - mode: 'tao_moi' | 'sua_doi'
 *   - congTy: cong_ty object hiện tại (chỉ khi sua_doi) — để prefill form
 *   - onClose: () => void
 */
import { useState } from 'react';
import { useSubmitDeXuat } from '../../hooks/useCongTyDeXuat';

const SECTIONS = [
  {
    title: 'Thông tin chung',
    fields: [
      { key: 'ten_cong_ty',    label: 'Tên công ty *', type: 'text', required: true },
      { key: 'dia_chi',        label: 'Địa chỉ',       type: 'text' },
      { key: 'map_url',        label: 'Link Google Maps', type: 'text', placeholder: 'https://maps.google.com/...' },
    ],
  },
  {
    title: 'Lương cơ bản',
    fields: [
      { key: 'luong_co_ban',    label: 'Lương cơ bản (đ/tháng)', type: 'number' },
      { key: 'luong_theo_gio',  label: 'Lương theo giờ (đ/giờ)', type: 'number' },
      { key: 'ngay_lam_chuan',  label: 'Số ngày làm chuẩn/tháng', type: 'number' },
      { key: 'ngay_chot_cong',  label: 'Ngày chốt công (1-31)', type: 'number' },
    ],
  },
  {
    title: 'Tăng ca chi tiết',
    fields: [
      { key: 'luong_tc_ngay',  label: 'Lương TC ngày (đ/giờ)', type: 'number' },
      { key: 'luong_hc_dem',   label: 'Lương HC đêm (đ/giờ)',  type: 'number' },
      { key: 'luong_tc_dem',   label: 'Lương TC đêm (đ/giờ)',  type: 'number' },
      { key: 'luong_chu_nhat', label: 'Lương chủ nhật (đ/giờ)', type: 'number' },
      { key: 'luong_ngay_le',  label: 'Lương ngày lễ (đ/giờ)',  type: 'number' },
    ],
  },
  {
    title: 'Khấu trừ / Trợ cấp',
    fields: [
      { key: 'tien_dong_phuc', label: 'Tiền đồng phục', type: 'number' },
      { key: 'tien_phat_nghi', label: 'Tiền phạt nghỉ', type: 'number' },
      { key: 'tro_cap',        label: 'Trợ cấp',        type: 'number' },
      { key: 'chuyen_can',     label: 'Chuyên cần',     type: 'number' },
      // Tiền công quản lý do admin nhập, không cho quản lý đề xuất.
    ],
  },
];

export default function DeXuatModal({ mode, congTy, onClose }) {
  const isEdit = mode === 'sua_doi';
  const submit = useSubmitDeXuat();

  // Prefill từ congTy nếu sua_doi
  const [form, setForm] = useState(() => {
    if (!isEdit) return {};
    const o = {};
    for (const sec of SECTIONS) {
      for (const f of sec.fields) {
        const v = congTy?.[f.key];
        if (v != null) o[f.key] = v;
      }
    }
    return o;
  });
  const [ghiChu, setGhiChu] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  function handleChange(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function buildPayload() {
    // Convert giá trị: number fields → Number, empty string → undefined
    const data = {};
    for (const sec of SECTIONS) {
      for (const f of sec.fields) {
        let v = form[f.key];
        if (v === '' || v == null) continue;
        if (f.type === 'number') {
          v = Number(v);
          if (Number.isNaN(v)) continue;
        }
        data[f.key] = v;
      }
    }
    return data;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    const data = buildPayload();

    if (!isEdit && !data.ten_cong_ty) {
      setError('Tên công ty bắt buộc');
      return;
    }
    if (isEdit && Object.keys(data).length === 0) {
      setError('Chưa thay đổi field nào');
      return;
    }

    try {
      await submit.mutateAsync({
        loai: isEdit ? 'sua_doi' : 'tao_moi',
        cong_ty_id: isEdit ? congTy.id : undefined,
        du_lieu: data,
        ghi_chu: ghiChu || undefined,
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
            <h2 style={s.title}>
              {isEdit ? `Đề xuất sửa: ${congTy?.ten_cong_ty}` : 'Đề xuất tạo công ty mới'}
            </h2>
            <p style={s.subtitle}>
              Đề xuất sẽ vào hàng chờ → admin duyệt mới có hiệu lực
            </p>
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
            {SECTIONS.map((sec) => (
              <fieldset key={sec.title} style={s.section}>
                <legend style={s.legend}>{sec.title}</legend>
                <div style={s.grid}>
                  {sec.fields.map((f) => (
                    <div key={f.key} style={f.key === 'ten_cong_ty' || f.key === 'dia_chi' || f.key === 'map_url' ? s.fieldSpan2 : s.field}>
                      <label style={s.label}>{f.label}</label>
                      <input
                        className="form-input"
                        type={f.type}
                        step={f.step}
                        placeholder={f.placeholder ?? ''}
                        value={form[f.key] ?? ''}
                        onChange={(e) => handleChange(f.key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </fieldset>
            ))}

            <div style={s.field}>
              <label style={s.label}>Ghi chú cho admin (tuỳ chọn)</label>
              <textarea
                className="form-input"
                rows={3}
                value={ghiChu}
                onChange={(e) => setGhiChu(e.target.value)}
                placeholder={isEdit
                  ? 'Vd: Công ty thay đổi cấu hình lương từ tháng 6'
                  : 'Vd: Công ty mới ký hợp đồng tuyển 50 CN'}
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
    borderRadius: 14, width: '100%', maxWidth: 700, maxHeight: '92vh',
    overflow: 'auto', fontFamily: "'Be Vietnam Pro', sans-serif",
  },
  header: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
    padding: '16px 20px', borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, background: 'var(--bg1)', zIndex: 1,
  },
  title: { fontSize: 16, fontWeight: 700, color: 'var(--text1)', marginBottom: 4 },
  subtitle: { fontSize: 12, color: 'var(--text2)' },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text3)', padding: 4, fontSize: 18, lineHeight: 1,
  },
  form: { padding: 20, display: 'flex', flexDirection: 'column', gap: 16 },
  section: {
    border: '1px solid var(--border)', borderRadius: 10,
    padding: '12px 16px 16px', margin: 0,
  },
  legend: {
    fontSize: 11, fontWeight: 700, color: 'var(--accent)',
    letterSpacing: '0.05em', textTransform: 'uppercase',
    padding: '0 8px',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  fieldSpan2: { display: 'flex', flexDirection: 'column', gap: 4, gridColumn: 'span 2' },
  label: {
    fontSize: 10, fontWeight: 700, color: 'var(--text2)',
    letterSpacing: '0.05em',
  },
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
