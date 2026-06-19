import { useState, useRef, useMemo, useEffect } from 'react';
import QrScanner from 'qr-scanner';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useCongTyList, useVenders } from '../../hooks/useCongNhan';
import { parseCccdQr } from '../../utils/parseCccdQr';

// dd/mm/yyyy → YYYY-MM-DD (DB cần ISO)
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

const EMPTY_FORM = {
  ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
  dia_chi: '', ngay_cap: '',
  ngay_vao_lam: isoToDdmmyyyy(todayIso()),
  cong_ty_id: '', nguoi_tuyen_id: '', ma_van_tay: '',
};

export default function ScanCCCD() {
  // mode: camera | upload   ·   stage: scan | processing | review | creating | done
  const [mode, setMode]   = useState('camera');
  const [stage, setStage] = useState('scan');
  const [form, setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors]       = useState({});
  const [submitErr, setSubmitErr] = useState(null);
  const [scanErr, setScanErr]     = useState(null);
  const [createdName, setCreatedName] = useState('');

  // Ảnh upload — chỉ lưu khi dùng mode upload
  const [preview, setPreview] = useState(null);
  const [anhFile, setAnhFile] = useState(null);
  const [anhUrl, setAnhUrl]   = useState(null);
  const [uploadingAnh, setUploadingAnh] = useState(false);

  const videoRef   = useRef(null);
  const scannerRef = useRef(null);
  const fileRef    = useRef(null);
  const handledRef = useRef(false); // chặn xử lý 1 mã QR nhiều lần

  const { user, isAdmin, isQuanLy } = useAuth();
  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];
  const canPickVender = isAdmin || isQuanLy;

  const congTyOptions = useMemo(() => {
    if (isQuanLy) {
      const ids = user?.cong_ty_ids ?? [];
      return congTyArr.filter((c) => ids.includes(c.id));
    }
    return congTyArr;
  }, [congTyArr, isQuanLy, user]);

  function defaultCongTyId() {
    if (isQuanLy && congTyOptions.length === 1) return String(congTyOptions[0].id);
    return '';
  }

  // ─── Camera lifecycle ──────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'camera' || stage !== 'scan' || !videoRef.current) return;

    handledRef.current = false;
    const scanner = new QrScanner(
      videoRef.current,
      (result) => onDecoded(result?.data ?? result),
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 5,
        returnDetailedScanResult: true,
      },
    );
    scannerRef.current = scanner;
    scanner.start().catch((err) => {
      setScanErr(`Không mở được camera: ${err?.message ?? err}. Hãy cấp quyền camera hoặc dùng tải ảnh.`);
    });

    return () => {
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stage]);

  // ─── Đọc dữ liệu QR → đổ vào form ──────────────────────────────────────────
  function onDecoded(rawData) {
    if (handledRef.current) return;
    const parsed = parseCccdQr(rawData);
    if (!parsed) {
      setScanErr('Mã QR không phải CCCD hợp lệ. Hãy quét đúng QR ở mặt trước CCCD gắn chip.');
      return;
    }
    handledRef.current = true;
    scannerRef.current?.stop();
    setScanErr(null);
    setForm((cur) => ({
      ...cur,
      ...parsed,
      cong_ty_id: cur.cong_ty_id || defaultCongTyId(),
    }));
    setStage('review');
  }

  // ─── Upload ảnh → detect QR + lưu ảnh ───────────────────────────────────────
  async function handleUpload(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // cho phép chọn lại cùng 1 file
    if (!file) return;
    setScanErr(null);
    setStage('processing');
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      const parsed = parseCccdQr(result?.data ?? result);
      if (!parsed) {
        setScanErr('Không tìm thấy QR CCCD hợp lệ trong ảnh.');
        setStage('scan');
        return;
      }
      setForm((cur) => ({ ...cur, ...parsed, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
      setPreview(URL.createObjectURL(file));
      setAnhFile(file);
      setAnhUrl(null);
      setStage('review');
      uploadAnhBackground(file); // lưu ảnh nền, không chặn UI
    } catch (err) {
      setScanErr('Không đọc được QR trong ảnh. Ảnh cần rõ nét và thấy đủ mã QR ở góc CCCD.');
      setStage('scan');
    }
  }

  // Upload ảnh lên Cloudinary, trả URL (best-effort)
  async function uploadAnh(file) {
    const fd = new FormData();
    fd.append('anh', file);
    const res = await api.post('/ocr/upload-anh', fd, { headers: { 'Content-Type': undefined } });
    return res.data?.duong_dan_anh ?? null;
  }
  async function uploadAnhBackground(file) {
    setUploadingAnh(true);
    try { setAnhUrl(await uploadAnh(file)); }
    catch { /* ảnh không bắt buộc — bỏ qua */ }
    finally { setUploadingAnh(false); }
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

    // Đảm bảo ảnh đã upload xong (nếu user duyệt trước khi upload hoàn tất)
    let finalAnhUrl = anhUrl;
    if (anhFile && !finalAnhUrl) {
      try { finalAnhUrl = await uploadAnh(anhFile); } catch { /* bỏ qua */ }
    }

    try {
      const payload = {
        ho_ten:           form.ho_ten.trim(),
        cccd:             cleanCccd(form.cccd),
        ngay_sinh:        ddmmyyyyToIso(form.ngay_sinh),
        gioi_tinh:        ['Nam','Nữ','Khác'].includes(form.gioi_tinh) ? form.gioi_tinh : null,
        dia_chi_hien_tai: form.dia_chi  || null,
        ngay_cap_cccd:    ddmmyyyyToIso(form.ngay_cap),
        ngay_vao_lam:     ddmmyyyyToIso(form.ngay_vao_lam),
        ma_van_tay:       form.ma_van_tay || null,
        anh_cccd_truoc:   finalAnhUrl || null,
      };
      if (form.cong_ty_id) payload.cong_ty_id = parseInt(form.cong_ty_id, 10);
      if (canPickVender && form.nguoi_tuyen_id) {
        payload.nguoi_tuyen_id = parseInt(form.nguoi_tuyen_id, 10);
      }

      await api.post('/cong-nhan', payload);
      setCreatedName(payload.ho_ten);
      setStage('done');
    } catch (err) {
      const det = err?.details ?? err?.response?.data?.error?.details;
      if (Array.isArray(det) && det.length) {
        const map = { dia_chi_hien_tai: 'dia_chi', ngay_cap_cccd: 'ngay_cap' };
        const fieldErrs = {};
        for (const d of det) fieldErrs[map[d.field] ?? d.field] = d.message;
        setErrors(fieldErrs);
        setSubmitErr(`Có ${det.length} lỗi: ${det.map((d) => `${map[d.field] ?? d.field} (${d.message})`).join('; ')}`);
      } else {
        setSubmitErr(err?.message ?? err?.response?.data?.error?.message ?? 'Không tạo được công nhân');
      }
      setStage('review');
    }
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setErrors({}); setSubmitErr(null); setScanErr(null);
    setPreview(null); setAnhFile(null); setAnhUrl(null);
    handledRef.current = false;
    setStage('scan');
  }

  function switchMode(next) {
    if (next === mode) return;
    setScanErr(null);
    setMode(next);
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>Quét QR CCCD</h2>
        <p style={s.sub}>Quét mã QR ở mặt trước CCCD gắn chip để lấy thông tin tự động</p>
      </div>

      {(stage === 'scan' || stage === 'processing') && (
        <div style={s.scanCard}>
          <div style={s.modeTabs}>
            <button style={tabStyle(mode === 'camera')} onClick={() => switchMode('camera')}>📷 Quét bằng camera</button>
            <button style={tabStyle(mode === 'upload')} onClick={() => switchMode('upload')}>🖼️ Tải ảnh CCCD</button>
          </div>

          {scanErr && <div style={s.errorBox}>{scanErr}</div>}

          {mode === 'camera' ? (
            <div style={s.cameraWrap}>
              <video ref={videoRef} style={s.video} muted playsInline />
              <div style={s.scanHint}>Đưa mã QR ở mặt trước CCCD vào khung — hệ thống tự nhận diện</div>
            </div>
          ) : stage === 'processing' ? (
            <div style={s.processing}>
              <div style={s.spinner} />
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Đang đọc mã QR trong ảnh...</div>
            </div>
          ) : (
            <div style={s.dropzone} onClick={() => fileRef.current?.click()}>
              <div style={{ fontSize: 38 }}>🪪</div>
              <div style={s.dropTitle}>Tải ảnh mặt trước CCCD</div>
              <div style={s.dropSub}>Ảnh sẽ được tự động dò mã QR và lưu vào hồ sơ công nhân</div>
              <button className="btn-primary" style={{ marginTop: 12, padding: '7px 16px', fontSize: 12 }}
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>Chọn ảnh</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleUpload} />

          <div style={s.tips}>
            <div style={s.tipTitle}>Lưu ý:</div>
            {[
              'Chỉ CCCD gắn chip (12 số, cấp từ 2021) mới có mã QR',
              'Quét đúng mã QR ở góc trên mặt trước, không phải mã ở mặt sau',
              'Quê quán không có trong QR — bổ sung tay nếu cần',
            ].map((t) => (
              <div key={t} style={s.tip}>✓ {t}</div>
            ))}
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="cccd-review-grid">
          <div style={s.card}>
            <div style={s.cardTitle}>Ảnh CCCD</div>
            {preview ? (
              <>
                <div style={{ marginTop: 8 }}>
                  <img src={preview} alt="Mặt trước CCCD" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                  <div style={s.imgCaption}>Mặt trước</div>
                </div>
                <div style={s.ocrBadge}>
                  {uploadingAnh ? '⏳ Đang lưu ảnh...' : '✓ QR đã đọc · ảnh sẽ lưu vào hồ sơ'}
                </div>
              </>
            ) : (
              <div style={s.noImg}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Quét bằng camera — không lưu ảnh.</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Dùng "Tải ảnh CCCD" nếu muốn lưu ảnh vào hồ sơ.</div>
                <div style={s.ocrBadge}>✓ QR đã đọc</div>
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Thông tin từ QR</div>
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
              <Field label="Địa chỉ thường trú" error={errors.dia_chi} span2>
                <input className="form-input" value={form.dia_chi} onChange={(e) => setField('dia_chi', e.target.value)} />
              </Field>
              <Field label="Ngày cấp CCCD" error={errors.ngay_cap}>
                <input className="form-input" value={form.ngay_cap} onChange={(e) => setField('ngay_cap', formatDateInput(e.target.value))} placeholder="dd/mm/yyyy" maxLength={10} />
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
              <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={resetAll}>Quét lại</button>
              <button className="btn-primary" onClick={handleApprove}>✓ Thêm vào hệ thống</button>
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
          <div style={s.doneSub}>Công nhân <b>{createdName}</b> đã được thêm vào hệ thống{preview ? ' cùng ảnh CCCD mặt trước' : ''}</div>
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

function tabStyle(active) {
  return {
    flex: 1,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 600,
    fontFamily: 'inherit',
    cursor: 'pointer',
    borderRadius: 10,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'rgba(79,124,255,0.14)' : 'var(--bg2)',
    color: active ? 'var(--accent)' : 'var(--text2)',
  };
}

const f = {
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  err:   { fontSize: 11, color: 'var(--red)', marginTop: 3 },
};

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', flexDirection: 'column' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  sub:   { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  errorBox: { background: 'rgba(255,95,114,0.12)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--red)' },
  scanCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  modeTabs: { display: 'flex', gap: 10 },
  cameraWrap: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' },
  video: { width: '100%', maxWidth: 460, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 14, border: '1px solid var(--border)', background: '#000' },
  scanHint: { fontSize: 12, color: 'var(--text2)', textAlign: 'center' },
  processing: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  dropzone: { background: 'var(--bg1)', border: '2px dashed var(--border2)', borderRadius: 14, padding: '40px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center', gap: 4 },
  dropTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginTop: 4 },
  dropSub: { fontSize: 12, color: 'var(--text3)' },
  tips: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' },
  tipTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 },
  tip: { fontSize: 12, color: 'var(--text2)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cardSub: { fontSize: 11, color: 'var(--text2)', marginTop: 3, marginBottom: 14 },
  imgCaption: { fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' },
  noImg: { marginTop: 8, padding: '28px 14px', background: 'var(--bg2)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  ocrBadge: { display: 'inline-block', marginTop: 10, padding: '4px 10px', background: 'rgba(34,201,134,0.12)', color: 'var(--green)', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  divider: { gridColumn: 'span 2', height: 1, background: 'var(--border)', margin: '4px 0' },
  reviewActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  doneCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 },
  doneIcon:    { fontSize: 52 },
  doneTitle:   { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  doneSub:     { fontSize: 13, color: 'var(--text2)' },
  doneActions: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
};
