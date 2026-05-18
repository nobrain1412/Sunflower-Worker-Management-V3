import { useState, useRef, useMemo } from 'react';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useCongTyList, useVenders } from '../../hooks/useCongNhan';

// FPT.AI trả ngày DD/MM/YYYY, DB cần YYYY-MM-DD
function ddmmyyyyToIso(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
function isoToDdmmyyyy(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return s;
  return `${m[3]}/${m[2]}/${m[1]}`;
}
function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
// CCCD parser đôi khi để space/ký tự lạ
function cleanCccd(s) {
  if (!s) return null;
  const d = String(s).replace(/\D/g, '');
  return /^\d{12}$/.test(d) ? d : null;
}
// Auto-format dd/mm/yyyy khi gõ
function formatDateInput(v) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function ScanCCCD() {
  // stage: upload | processing | review | creating | done
  const [stage, setStage]     = useState('upload');
  const [front, setFront]     = useState(null);
  const [back, setBack]       = useState(null);
  const [form, setForm]       = useState({
    ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
    que_quan: '', dia_chi: '', ngay_cap: '', noi_cap: '',
    ngay_vao_lam: isoToDdmmyyyy(todayIso()),
    cong_ty_id: '', nguoi_tuyen_id: '', ma_van_tay: '',
  });
  const [errors, setErrors]   = useState({});
  const [submitErr, setSubmitErr] = useState(null);
  const [createdName, setCreatedName] = useState('');
  const frontRef = useRef();
  const backRef  = useRef();

  const { user, isAdmin, isQuanLy } = useAuth();
  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];
  const canPickVender = isAdmin || isQuanLy;

  // Quản lý chỉ thấy công ty mình quản lý; vender thấy tất cả nhưng default công ty rỗng
  const congTyOptions = useMemo(() => {
    if (isQuanLy) {
      const ids = user?.cong_ty_ids ?? [];
      return congTyArr.filter((c) => ids.includes(c.id));
    }
    return congTyArr;
  }, [congTyArr, isQuanLy, user]);

  // Default cong_ty_id cho quản lý = công ty đầu tiên họ quản lý
  function defaultCongTyId() {
    if (isQuanLy && congTyOptions.length === 1) return String(congTyOptions[0].id);
    return '';
  }

  async function uploadOne(file) {
    const fd = new FormData();
    fd.append('anh', file);
    fd.append('loai', 'cccd');
    const res = await api.post('/ocr/scan', fd, { headers: { 'Content-Type': undefined } });
    return {
      preview: URL.createObjectURL(file),
      anhUrl: res.data.duong_dan_anh,
      ocrId:  res.data.ocr_id,
      ketQua: res.data.ket_qua ?? {},
    };
  }

  function applyOcr(f, b) {
    const fk = f?.ketQua ?? {};
    const bk = b?.ketQua ?? {};
    setForm((cur) => ({
      ...cur,
      ho_ten:    fk.ho_ten    || bk.ho_ten    || cur.ho_ten,
      cccd:      fk.cccd      || bk.cccd      || cur.cccd,
      ngay_sinh: fk.ngay_sinh || bk.ngay_sinh || cur.ngay_sinh,
      gioi_tinh: fk.gioi_tinh || bk.gioi_tinh || cur.gioi_tinh,
      que_quan:  fk.que_quan  || bk.que_quan  || cur.que_quan,
      dia_chi:   fk.dia_chi   || bk.dia_chi   || cur.dia_chi,
      ngay_cap:  bk.ngay_cap  || fk.ngay_cap  || cur.ngay_cap,
      noi_cap:   bk.noi_cap   || fk.noi_cap   || cur.noi_cap,
      cong_ty_id: cur.cong_ty_id || defaultCongTyId(),
    }));
  }

  async function handleFile(e, side) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubmitErr(null);
    setStage('processing');
    try {
      const r = await uploadOne(file);
      if (side === 'truoc') { setFront(r); if (back)  applyOcr(r, back);  setStage(back ? 'review' : 'upload'); }
      else                  { setBack(r);  if (front) applyOcr(front, r); setStage(front ? 'review' : 'upload'); }
    } catch (err) {
      setSubmitErr(err?.response?.data?.error?.message ?? err?.message ?? `Lỗi OCR mặt ${side === 'truoc' ? 'trước' : 'sau'}`);
      setStage('upload');
    }
  }

  function setField(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((er) => ({ ...er, [k]: '' }));
  }

  function validateLocal() {
    const errs = {};
    if (!form.ho_ten.trim()) errs.ho_ten = 'Bắt buộc';
    if (form.cccd && !/^\d{12}$/.test(String(form.cccd).replace(/\D/g, ''))) errs.cccd = 'CCCD phải đúng 12 chữ số';
    for (const f of ['ngay_sinh', 'ngay_cap', 'ngay_vao_lam']) {
      if (form[f] && !/^\d{2}\/\d{2}\/\d{4}$/.test(form[f])) errs[f] = 'Định dạng dd/mm/yyyy';
    }
    return errs;
  }

  async function handleApprove() {
    const errs = validateLocal();
    if (Object.keys(errs).length) { setErrors(errs); return; }
    setSubmitErr(null);
    setErrors({});
    setStage('creating');

    try {
      const payload = {
        ho_ten:           form.ho_ten.trim(),
        cccd:             cleanCccd(form.cccd),
        ngay_sinh:        ddmmyyyyToIso(form.ngay_sinh),
        gioi_tinh:        ['Nam','Nữ','Khác'].includes(form.gioi_tinh) ? form.gioi_tinh : null,
        que_quan:         form.que_quan || null,
        dia_chi_hien_tai: form.dia_chi  || null,
        ngay_cap_cccd:    ddmmyyyyToIso(form.ngay_cap),
        noi_cap_cccd:     form.noi_cap  || null,
        ngay_vao_lam:     ddmmyyyyToIso(form.ngay_vao_lam),
        ma_van_tay:       form.ma_van_tay || null,
        anh_cccd_truoc:   front?.anhUrl   || null,
        anh_cccd_sau:     back?.anhUrl    || null,
      };
      if (form.cong_ty_id)     payload.cong_ty_id     = parseInt(form.cong_ty_id, 10);
      if (canPickVender && form.nguoi_tuyen_id) {
        payload.nguoi_tuyen_id = parseInt(form.nguoi_tuyen_id, 10);
      }

      const created = await api.post('/cong-nhan', payload);
      setCreatedName(payload.ho_ten);

      // Approve các OCR records (best-effort)
      const approves = [];
      if (front?.ocrId) approves.push(api.post(`/ocr/${front.ocrId}/approve`).catch(() => {}));
      if (back?.ocrId)  approves.push(api.post(`/ocr/${back.ocrId}/approve`).catch(() => {}));
      await Promise.all(approves);

      setStage('done');
    } catch (err) {
      const det = err?.response?.data?.error?.details;
      if (Array.isArray(det) && det.length) {
        // Map field-level zod errors về form key
        const map = {
          dia_chi_hien_tai: 'dia_chi',
          ngay_cap_cccd:    'ngay_cap',
          noi_cap_cccd:     'noi_cap',
        };
        const fieldErrs = {};
        for (const d of det) {
          const key = map[d.field] ?? d.field;
          fieldErrs[key] = d.message;
        }
        setErrors(fieldErrs);
        setSubmitErr(`Có ${det.length} lỗi: ${det.map((d) => `${map[d.field] ?? d.field} (${d.message})`).join('; ')}`);
      } else {
        setSubmitErr(err?.response?.data?.error?.message ?? err?.message ?? 'Không tạo được công nhân');
      }
      setStage('review');
    }
  }

  async function handleReject() {
    const rejects = [];
    if (front?.ocrId) rejects.push(api.post(`/ocr/${front.ocrId}/reject`).catch(() => {}));
    if (back?.ocrId)  rejects.push(api.post(`/ocr/${back.ocrId}/reject`).catch(() => {}));
    await Promise.all(rejects);
    resetAll();
  }

  function resetAll() {
    setFront(null); setBack(null);
    setForm({
      ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
      que_quan: '', dia_chi: '', ngay_cap: '', noi_cap: '',
      ngay_vao_lam: isoToDdmmyyyy(todayIso()),
      cong_ty_id: '', nguoi_tuyen_id: '', ma_van_tay: '',
    });
    setErrors({}); setSubmitErr(null);
    setStage('upload');
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>Quét CCCD</h2>
        <p style={s.sub}>Tải đủ 2 mặt CCCD để trích xuất thông tin tự động</p>
      </div>

      {(stage === 'upload' || stage === 'processing') && (
        <div style={s.uploadCard}>
          {submitErr && <div style={s.errorBox}>{submitErr}</div>}
          <div className="cccd-upload-grid">
            <SideSlot title="Mặt trước" hint="Ảnh chân dung, họ tên, CCCD, ngày sinh"
              picked={front} processing={stage === 'processing' && !front}
              onPick={() => frontRef.current?.click()} onClear={() => setFront(null)} />
            <input ref={frontRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e, 'truoc')} />
            <SideSlot title="Mặt sau" hint="Nơi thường trú, ngày cấp, nơi cấp"
              picked={back} processing={stage === 'processing' && !back}
              onPick={() => backRef.current?.click()} onClear={() => setBack(null)} />
            <input ref={backRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(e, 'sau')} />
          </div>
          <div style={s.tips}>
            <div style={s.tipTitle}>Lưu ý khi chụp:</div>
            {['Chụp đủ 2 mặt, rõ nét, không bị mờ', 'Đảm bảo ánh sáng đủ, không bị chói', 'Đặt CCCD trên nền sẫm màu'].map((t) => (
              <div key={t} style={s.tip}>✓ {t}</div>
            ))}
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="cccd-review-grid">
          <div style={s.card}>
            <div style={s.cardTitle}>Ảnh CCCD</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {front?.preview && <ImgWithLabel src={front.preview} label="Mặt trước" />}
              {back?.preview  && <ImgWithLabel src={back.preview}  label="Mặt sau" />}
            </div>
            <div style={s.ocrBadge}>OCR hoàn tất</div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Thông tin trích xuất</div>
            <div style={s.cardSub}>Kiểm tra & bổ sung trước khi thêm vào hệ thống</div>
            {submitErr && <div style={{ ...s.errorBox, marginBottom: 10 }}>{submitErr}</div>}

            <div className="cccd-fields-grid">
              <Field label="Họ và tên *" error={errors.ho_ten}>
                <input className="form-input" value={form.ho_ten} onChange={(e) => setField('ho_ten', e.target.value)} placeholder="Nguyễn Văn A" />
              </Field>
              <Field label="Số CCCD" error={errors.cccd}>
                <input className="form-input" value={form.cccd} onChange={(e) => setField('cccd', e.target.value)} maxLength={12} placeholder="012345678901" />
              </Field>
              <Field label="Ngày sinh" error={errors.ngay_sinh}>
                <input className="form-input" value={form.ngay_sinh} onChange={(e) => setField('ngay_sinh', formatDateInput(e.target.value))} placeholder="dd/mm/yyyy" maxLength={10} />
              </Field>
              <Field label="Giới tính" error={errors.gioi_tinh}>
                <select className="form-input" value={form.gioi_tinh} onChange={(e) => setField('gioi_tinh', e.target.value)}>
                  <option value="">— Chọn —</option>
                  <option value="Nam">Nam</option>
                  <option value="Nữ">Nữ</option>
                  <option value="Khác">Khác</option>
                </select>
              </Field>
              <Field label="Quê quán" error={errors.que_quan} span2>
                <input className="form-input" value={form.que_quan} onChange={(e) => setField('que_quan', e.target.value)} />
              </Field>
              <Field label="Địa chỉ thường trú" error={errors.dia_chi} span2>
                <input className="form-input" value={form.dia_chi} onChange={(e) => setField('dia_chi', e.target.value)} />
              </Field>
              <Field label="Ngày cấp CCCD" error={errors.ngay_cap}>
                <input className="form-input" value={form.ngay_cap} onChange={(e) => setField('ngay_cap', formatDateInput(e.target.value))} placeholder="dd/mm/yyyy" maxLength={10} />
              </Field>
              <Field label="Nơi cấp CCCD" error={errors.noi_cap}>
                <input className="form-input" value={form.noi_cap} onChange={(e) => setField('noi_cap', e.target.value)} />
              </Field>

              <div style={s.divider} />

              <Field label="Công ty" error={errors.cong_ty_id}>
                <select className="form-input" value={form.cong_ty_id || defaultCongTyId()} onChange={(e) => setField('cong_ty_id', e.target.value)}>
                  <option value="">{isAdmin ? '— Chọn công ty —' : 'Không phân công'}</option>
                  {congTyOptions.map((ct) => (
                    <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>
                  ))}
                </select>
              </Field>
              {canPickVender ? (
                <Field label="Người tuyển" error={errors.nguoi_tuyen_id}>
                  <select className="form-input" value={form.nguoi_tuyen_id} onChange={(e) => setField('nguoi_tuyen_id', e.target.value)}>
                    <option value="">— Mặc định: {user?.ho_ten ?? 'tôi'} —</option>
                    {venderArr.map((v) => (
                      <option key={v.id} value={v.id}>{v.ho_ten}</option>
                    ))}
                  </select>
                </Field>
              ) : (
                <Field label="Người tuyển">
                  <input className="form-input" value={user?.ho_ten ?? ''} disabled />
                </Field>
              )}
              <Field label="Ngày vào làm" error={errors.ngay_vao_lam}>
                <input className="form-input" value={form.ngay_vao_lam} onChange={(e) => setField('ngay_vao_lam', formatDateInput(e.target.value))} placeholder="dd/mm/yyyy" maxLength={10} />
              </Field>
              <Field label="Mã vân tay (máy chấm công)" error={errors.ma_van_tay}>
                <input className="form-input" value={form.ma_van_tay} onChange={(e) => setField('ma_van_tay', e.target.value)} placeholder="VD: 1024" maxLength={50} />
              </Field>
            </div>

            <div style={s.reviewActions}>
              <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={handleReject}>Từ chối</button>
              <button className="btn-primary" onClick={handleApprove}>✓ Duyệt & Thêm vào hệ thống</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'creating' && (
        <div style={s.doneCard}>
          <div style={s.spinner} />
          <div style={s.doneTitle}>Đang thêm công nhân...</div>
          <div style={s.doneSub}>Lưu thông tin và ảnh CCCD vào hồ sơ</div>
        </div>
      )}

      {stage === 'done' && (
        <div style={s.doneCard}>
          <div style={s.doneIcon}>✅</div>
          <div style={s.doneTitle}>Thêm thành công!</div>
          <div style={s.doneSub}>Công nhân <b>{createdName}</b> đã được thêm vào hệ thống cùng ảnh CCCD 2 mặt</div>
          <div style={s.doneActions}>
            <button className="btn-ghost" onClick={resetAll}>Quét tiếp</button>
            <a href="/cong-nhan" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 14px', fontSize: 12, fontWeight: 600, borderRadius: 8, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: '#fff' }}>
              Xem danh sách công nhân
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, error, span2, children }) {
  return (
    <div style={{ ...f.field, ...(span2 ? { gridColumn: 'span 2' } : {}) }} className={span2 ? 'cccd-field-span2' : ''}>
      <label className="form-label">{label}</label>
      {children}
      {error && <div style={f.err}>{error}</div>}
    </div>
  );
}

function ImgWithLabel({ src, label }) {
  return (
    <div>
      <img src={src} alt={label} style={{ width: '100%', borderRadius: 8 }} />
      <div style={s.imgCaption}>{label}</div>
    </div>
  );
}

function SideSlot({ title, hint, picked, processing, onPick, onClear }) {
  return (
    <div style={ss.slot}>
      <div style={ss.head}>
        <span style={ss.title}>{title}</span>
        {picked && <button style={ss.clearBtn} onClick={onClear}>Đổi ảnh</button>}
      </div>
      {picked ? (
        <div style={ss.previewWrap}>
          <img src={picked.preview} alt={title} style={ss.previewImg} />
          <div style={ss.okPill}>✓ Đã quét</div>
        </div>
      ) : processing ? (
        <div style={ss.placeholder}>
          <div style={ss.spinner} />
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>Đang xử lý OCR...</div>
        </div>
      ) : (
        <div style={ss.dropzone} onClick={onPick}>
          <div style={{ fontSize: 32 }}>🪪</div>
          <div style={ss.dropTitle}>{title}</div>
          <div style={ss.dropSub}>{hint}</div>
          <button className="btn-primary" style={{ marginTop: 12, padding: '6px 14px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onPick(); }}>Chọn ảnh</button>
        </div>
      )}
    </div>
  );
}

const f = {
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  err:   { fontSize: 11, color: 'var(--red)', marginTop: 3 },
};

const ss = {
  slot:       { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  head:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title:      { fontSize: 12, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  clearBtn:   { background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' },
  previewWrap:{ position: 'relative' },
  previewImg: { width: '100%', borderRadius: 10, border: '1px solid var(--border)' },
  okPill:     { position: 'absolute', top: 8, right: 8, background: 'rgba(34,201,134,0.18)', color: 'var(--green)', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 20 },
  placeholder:{ background: 'var(--bg2)', borderRadius: 10, padding: '32px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 },
  spinner:    { width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  dropzone:   { background: 'var(--bg2)', border: '2px dashed var(--border2)', borderRadius: 10, padding: '24px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center', gap: 4 },
  dropTitle:  { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  dropSub:    { fontSize: 11, color: 'var(--text3)', textAlign: 'center' },
};

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', flexDirection: 'column' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  sub:   { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  errorBox: { background: 'rgba(255,95,114,0.12)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--red)' },
  uploadCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  tips: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' },
  tipTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 },
  tip: { fontSize: 12, color: 'var(--text2)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cardSub: { fontSize: 11, color: 'var(--text2)', marginTop: 3, marginBottom: 14 },
  imgCaption: { fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' },
  ocrBadge: { display: 'inline-block', marginTop: 10, padding: '4px 10px', background: 'rgba(34,201,134,0.12)', color: 'var(--green)', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  divider: { gridColumn: 'span 2', height: 1, background: 'var(--border)', margin: '4px 0' },
  reviewActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  doneCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 },
  doneIcon:    { fontSize: 52 },
  doneTitle:   { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  doneSub:     { fontSize: 13, color: 'var(--text2)' },
  doneActions: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
};
