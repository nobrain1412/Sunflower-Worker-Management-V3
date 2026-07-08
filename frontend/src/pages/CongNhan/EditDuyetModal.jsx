/**
 * Modal sửa nhanh thông tin công nhân trước khi duyệt vào làm.
 * Dùng trong hàng đợi duyệt (DuyetQueue) — chỉ những trường hay cần chỉnh:
 * họ tên, CCCD, liên hệ, công ty (bắt buộc để duyệt), ghi chú...
 * Lưu qua PUT /cong-nhan/:id (useCapNhatCongNhan), tái dùng scope check ở backend.
 */
import { useState, useEffect, useMemo } from 'react';
import { useCongNhanDetail, useCapNhatCongNhan, useCongTyList } from '../../hooks/useCongNhan';
import { useAuth } from '../../context/AuthContext';

// ISO (yyyy-mm-dd hoặc full timestamp) → dd/mm/yyyy cho input
function isoToDMY(s) {
  if (!s) return '';
  const iso = String(s).slice(0, 10);
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}
// dd/mm/yyyy → yyyy-mm-dd cho payload
function dmyToIso(s) {
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
}
// Auto-format khi gõ số ngày: 02112025 → 02/11/2025
function formatDateInput(v) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function EditDuyetModal({ congNhan, onClose, onSaved }) {
  const { user, isAdmin, isQuanLy } = useAuth();
  const { data: detailRes, isLoading } = useCongNhanDetail(congNhan.id);
  const mutation = useCapNhatCongNhan(congNhan.id);
  const congTyArr = useCongTyList().data?.data ?? [];

  const [form, setForm]     = useState(null);
  const [errors, setErrors] = useState({});

  // Nạp dữ liệu chi tiết vào form khi tải xong
  useEffect(() => {
    const cn = detailRes?.data;
    if (!cn) return;
    setForm({
      ho_ten:           cn.ho_ten ?? '',
      cccd:             cn.cccd ?? '',
      ngay_sinh:        isoToDMY(cn.ngay_sinh),
      gioi_tinh:        cn.gioi_tinh ?? '',
      so_dien_thoai:    cn.so_dien_thoai ?? '',
      dia_chi_hien_tai: cn.dia_chi_hien_tai ?? '',
      cong_ty_id:       cn.cong_ty_id != null ? String(cn.cong_ty_id) : '',
      ngay_vao_lam:     isoToDMY(cn.ngay_vao_lam),
      ghi_chu:          cn.ghi_chu ?? '',
    });
  }, [detailRes]);

  // Quản lý chỉ chọn được công ty mình quản lý
  const congTyOptions = useMemo(() => {
    if (isQuanLy) {
      const ids = user?.cong_ty_ids ?? [];
      return congTyArr.filter((c) => ids.includes(c.id));
    }
    return congTyArr;
  }, [congTyArr, isQuanLy, user]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    if (errors[name]) setErrors((er) => ({ ...er, [name]: '' }));
  }
  function handleDateChange(name) {
    return (e) => {
      setForm((f) => ({ ...f, [name]: formatDateInput(e.target.value) }));
      if (errors[name]) setErrors((er) => ({ ...er, [name]: '' }));
    };
  }

  function validate() {
    const errs = {};
    if (!form.ho_ten.trim()) errs.ho_ten = 'Bắt buộc';
    if (form.cccd && !/^\d{12}$/.test(form.cccd)) errs.cccd = 'CCCD phải đúng 12 chữ số';
    if (form.so_dien_thoai && !/^(0[3578]\d{8}|0[6789]\d{8})$/.test(form.so_dien_thoai))
      errs.so_dien_thoai = 'Số điện thoại không hợp lệ';
    for (const f of ['ngay_sinh', 'ngay_vao_lam']) {
      if (form[f] && !/^\d{2}\/\d{2}\/\d{4}$/.test(form[f])) errs[f] = 'Định dạng dd/mm/yyyy';
    }
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    // Chỉ gửi các field có thể chỉnh; '' → null để backend xoá giá trị
    const payload = {
      ho_ten:           form.ho_ten.trim(),
      cccd:             form.cccd || null,
      gioi_tinh:        form.gioi_tinh || null,
      so_dien_thoai:    form.so_dien_thoai || null,
      dia_chi_hien_tai: form.dia_chi_hien_tai || null,
      ghi_chu:          form.ghi_chu || null,
      cong_ty_id:       form.cong_ty_id ? parseInt(form.cong_ty_id, 10) : null,
      ngay_sinh:        form.ngay_sinh ? dmyToIso(form.ngay_sinh) : null,
      ngay_vao_lam:     form.ngay_vao_lam ? dmyToIso(form.ngay_vao_lam) : null,
    };

    try {
      await mutation.mutateAsync(payload);
      onSaved?.();
      onClose();
    } catch (err) {
      setErrors({ submit: err.message || 'Lưu thất bại' });
    }
  }

  return (
    <div style={o.overlay} onClick={onClose}>
      <div style={o.modal} onClick={(e) => e.stopPropagation()}>
        <div style={o.header}>
          <div>
            <div style={o.title}>Sửa thông tin trước khi duyệt</div>
            <div style={o.sub}>{congNhan.ho_ten}</div>
          </div>
          <button style={o.close} onClick={onClose}>✕</button>
        </div>

        {isLoading || !form ? (
          <div style={o.loading}>Đang tải...</div>
        ) : (
          <div style={o.body}>
            <div style={f.grid}>
              <Field label="Họ và tên *" error={errors.ho_ten}>
                <input className="form-input" name="ho_ten" value={form.ho_ten} onChange={handleChange} placeholder="Nguyễn Văn A" />
              </Field>
              <Field label="Số CCCD" error={errors.cccd}>
                <input className="form-input" name="cccd" value={form.cccd} onChange={handleChange} placeholder="012345678901" maxLength={12} />
              </Field>
              <Field label="Ngày sinh" error={errors.ngay_sinh}>
                <input className="form-input" name="ngay_sinh" value={form.ngay_sinh} onChange={handleDateChange('ngay_sinh')} placeholder="dd/mm/yyyy" maxLength={10} />
              </Field>
              <Field label="Giới tính">
                <select className="form-input" name="gioi_tinh" value={form.gioi_tinh} onChange={handleChange}>
                  <option value="">-- Chọn --</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </Field>
              <Field label="Số điện thoại" error={errors.so_dien_thoai}>
                <input className="form-input" name="so_dien_thoai" value={form.so_dien_thoai} onChange={handleChange} placeholder="0912345678" />
              </Field>
              <Field label="Ngày vào làm (dự kiến)" error={errors.ngay_vao_lam}>
                <input className="form-input" name="ngay_vao_lam" value={form.ngay_vao_lam} onChange={handleDateChange('ngay_vao_lam')} placeholder="dd/mm/yyyy" maxLength={10} />
              </Field>
              <Field label="Địa chỉ thường trú" style={{ gridColumn: 'span 2' }}>
                <input className="form-input" name="dia_chi_hien_tai" value={form.dia_chi_hien_tai} onChange={handleChange} placeholder="Số 123, Đường ABC, Tỉnh..." />
              </Field>
              <Field label="Công ty (bắt buộc để duyệt)" style={{ gridColumn: 'span 2' }}>
                <select className="form-input" name="cong_ty_id" value={form.cong_ty_id} onChange={handleChange}>
                  <option value="">{isAdmin ? '-- Chọn công ty --' : 'Công ty bạn quản lý'}</option>
                  {congTyOptions.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ghi chú" style={{ gridColumn: 'span 2' }}>
                <textarea className="form-input" name="ghi_chu" value={form.ghi_chu} onChange={handleChange} rows={2} placeholder="Ghi chú thêm..." style={{ resize: 'vertical' }} />
              </Field>
            </div>
          </div>
        )}

        {errors.submit && <div style={o.errBox}>{errors.submit}</div>}

        <div style={o.footer}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending || isLoading || !form}>
            {mutation.isPending ? 'Đang lưu...' : '✓ Lưu thay đổi'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, error, children, style }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, ...style }}>
      <label className="form-label">{label}</label>
      {children}
      {error && <span style={{ fontSize: 11, color: 'var(--red)' }}>{error}</span>}
    </div>
  );
}

const o = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(2px)' },
  modal:   { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Be Vietnam Pro', sans-serif" },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' },
  title:   { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  sub:     { fontSize: 12, color: 'var(--text3)', marginTop: 2 },
  close:   { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 16, padding: 4 },
  body:    { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  loading: { padding: 48, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
  errBox:  { margin: '0 24px', padding: '10px 14px', background: 'rgba(255,95,114,0.08)', border: '1px solid rgba(255,95,114,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)' },
  footer:  { display: 'flex', justifyContent: 'flex-end', padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 8 },
};

const f = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' },
};
