import { useState, useMemo, useRef } from 'react';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useCongTyList, useVenders } from '../../hooks/useCongNhan';
import { ocrCccdFromImage } from '../../utils/ocrCccdImage';

// Quét ảnh VNeID — ảnh chụp màn hình thông tin CCCD trong app VNeID/Zalo (1 ảnh, đủ trường).
// Khác luồng "Quét CCCD": không camera/QR, không cần 2 mặt — chỉ 1 ảnh → OCR → duyệt → lưu.
// Ảnh được lưu vào hồ sơ ở trường anh_vneid (không phải anh_cccd_truoc).

// dd/mm/yyyy → YYYY-MM-DD (DB cần ISO)
function ddmmyyyyToIso(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}
function isoToDdmmyyyy(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
function todayIso() { return new Date().toISOString().slice(0, 10); }
function cleanCccd(s) {
  if (!s) return null;
  const d = String(s).replace(/\D/g, '');
  return /^\d{12}$/.test(d) ? d : null;
}
function formatDateInput(v) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

const EMPTY_FORM = {
  ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
  que_quan: '', dia_chi: '', ngay_cap: '',
  ngay_vao_lam: isoToDdmmyyyy(todayIso()),
  cong_ty_id: '', nguoi_tuyen_id: '', ma_van_tay: '', bo_phan: '',
  trang_thai: '',
};

export default function ScanVNeID() {
  // stage: scan | processing | review | creating | done
  const [stage, setStage] = useState('scan');
  const [form, setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors]       = useState({});
  const [submitErr, setSubmitErr] = useState(null);
  const [dup, setDup]             = useState(null); // trùng CCCD: { message, co_the_kich_hoat_lai, ... }
  const [scanErr, setScanErr]     = useState(null);
  const [createdName, setCreatedName] = useState('');

  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [anhUrl, setAnhUrl]   = useState(null);       // URL ảnh VNeID đã upload
  const [degraded, setDegraded] = useState(false);
  const [source, setSource]   = useState('ocr');      // 'ocr' | 'manual'

  const fileRef = useRef(null);

  const { user, isAdmin, isQuanLy } = useAuth();
  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];
  const canPickVender = isAdmin || isQuanLy;
  const defaultTrangThai = canPickVender ? 'moi_vao' : 'doi_viec';

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

  function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setScanErr(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  // Upload ảnh (không OCR) — dùng khi OCR không đọc được nhưng vẫn muốn lưu ảnh.
  async function uploadAnhOnly(f) {
    const fd = new FormData();
    fd.append('anh', f, f.name || 'vneid.jpg');
    const res = await api.post('/ocr/upload-anh', fd, { headers: { 'Content-Type': undefined } });
    return res.data?.duong_dan_anh ?? null;
  }

  async function handleScan() {
    if (!file) { setScanErr('Vui lòng chọn ảnh VNeID trước khi quét.'); return; }
    setScanErr(null);
    setStage('processing');
    try {
      const { parsed, duongDanAnh, degraded: isDegraded } = await ocrCccdFromImage(file);
      // Backend đã upload ảnh trong lượt OCR → dùng lại URL làm ảnh VNeID.
      setAnhUrl(duongDanAnh);
      if (parsed) {
        setForm((cur) => ({ ...cur, ...parsed, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
        setSource('ocr');
        setDegraded(!!isDegraded);
      } else {
        // Không bóc được thông tin — vẫn giữ ảnh, cho nhập tay.
        setForm((cur) => ({ ...cur, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
        setSource('manual');
        setDegraded(false);
      }
      setStage('review');
    } catch {
      // OCR lỗi (mạng/quota) — vẫn cố upload ảnh để lưu, rồi cho nhập tay.
      let url = null;
      try { url = await uploadAnhOnly(file); } catch { /* bỏ qua */ }
      setAnhUrl(url);
      setForm((cur) => ({ ...cur, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
      setSource('manual');
      setDegraded(false);
      setStage('review');
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

  async function handleApprove({ kichHoatLai = false } = {}) {
    const errs = validateLocal();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const trangThai = form.trang_thai || defaultTrangThai;
    const congTyId = form.cong_ty_id || defaultCongTyId();
    if (['dang_lam', 'moi_vao'].includes(trangThai) && !congTyId) {
      setSubmitErr('Trạng thái "Đang làm" / "Mới vào" bắt buộc phải chọn công ty');
      return;
    }

    setSubmitErr(null);
    setDup(null);
    setErrors({});
    setStage('creating');

    // Đảm bảo ảnh đã upload (nếu vì lý do nào đó chưa có URL)
    let finalAnhUrl = anhUrl;
    if (file && !finalAnhUrl) {
      try { finalAnhUrl = await uploadAnhOnly(file); } catch { /* bỏ qua */ }
    }

    try {
      const payload = {
        ho_ten:           form.ho_ten.trim(),
        cccd:             cleanCccd(form.cccd),
        ngay_sinh:        ddmmyyyyToIso(form.ngay_sinh),
        gioi_tinh:        ['Nam', 'Nữ', 'Khác'].includes(form.gioi_tinh) ? form.gioi_tinh : null,
        que_quan:         form.que_quan || null,
        dia_chi_hien_tai: form.dia_chi  || null,
        ngay_cap_cccd:    ddmmyyyyToIso(form.ngay_cap),
        ngay_vao_lam:     ddmmyyyyToIso(form.ngay_vao_lam),
        ma_van_tay:       form.ma_van_tay || null,
        bo_phan:          form.bo_phan || null,
        anh_vneid:        finalAnhUrl || null,
        trang_thai:       trangThai,
      };
      if (congTyId) payload.cong_ty_id = parseInt(congTyId, 10);
      if (canPickVender && form.nguoi_tuyen_id) payload.nguoi_tuyen_id = parseInt(form.nguoi_tuyen_id, 10);
      // Xác nhận kích hoạt lại CN đã nghỉ việc (trùng CCCD) thay vì báo lỗi
      if (kichHoatLai) payload.kich_hoat_lai = true;

      await api.post('/cong-nhan', payload);
      setCreatedName(payload.ho_ten);
      setStage('done');
    } catch (err) {
      // Trùng CCCD: backend trả kèm thông tin CN cũ (đang làm ở đâu, đã nghỉ chưa)
      // → hiển thị hộp xác nhận trực quan thay vì lỗi chung chung; CN đã nghỉ việc thì cho thêm lại.
      const info = err?.code === 'DUPLICATE_CCCD' ? err?.details?.[0] : null;
      if (info) {
        setDup({ ...info, message: err.message });
      } else {
        // Lỗi nhập liệu (validate): map từng trường về đúng ô để hiện lỗi ngay tại field.
        const det = err?.details ?? err?.response?.data?.error?.details;
        const fieldDet = Array.isArray(det) ? det.filter((d) => d && d.field) : [];
        if (fieldDet.length) {
          const map = { dia_chi_hien_tai: 'dia_chi', ngay_cap_cccd: 'ngay_cap' };
          const fieldErrs = {};
          for (const d of fieldDet) fieldErrs[map[d.field] ?? d.field] = d.message;
          setErrors(fieldErrs);
          setSubmitErr(
            fieldDet.length > 1
              ? `Có ${fieldDet.length} trường chưa hợp lệ — vui lòng kiểm tra các ô được đánh dấu đỏ.`
              : fieldDet[0].message,
          );
        } else {
          setSubmitErr(err?.message ?? 'Không tạo được công nhân');
        }
      }
      setStage('review');
    }
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setErrors({}); setSubmitErr(null); setDup(null); setScanErr(null);
    setFile(null); setPreview(null); setAnhUrl(null);
    setDegraded(false); setSource('ocr');
    setStage('scan');
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>Quét ảnh VNeID</h2>
        <p style={s.sub}>Tải ảnh chụp thông tin CCCD trong app VNeID/Zalo — hệ thống tự đọc thông tin và lưu ảnh vào hồ sơ</p>
      </div>

      {(stage === 'scan' || stage === 'processing') && (
        <div style={s.scanCard}>
          {scanErr && <div style={s.errorBox}>{scanErr}</div>}

          {stage === 'processing' ? (
            <div style={s.processing}>
              <div style={s.spinner} />
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Đang nhận diện thông tin trên ảnh VNeID...</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={s.dropzone} onClick={() => fileRef.current?.click()}>
                {preview ? (
                  <img src={preview} alt="Ảnh VNeID" style={s.dropThumb} />
                ) : (
                  <>
                    <div style={{ fontSize: 34 }}>📱</div>
                    <div style={s.dropTitle}>Chọn ảnh VNeID</div>
                    <div style={s.dropSub}>Ảnh chụp màn hình thông tin CCCD trong app VNeID hoặc Zalo</div>
                  </>
                )}
                <button className="btn-ghost" style={{ marginTop: 8, color: 'var(--accent)', fontSize: 12, padding: '5px 12px' }}
                  onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
                  {preview ? 'Chọn lại' : 'Chọn ảnh'}
                </button>
              </div>
              <button
                className="btn-primary"
                disabled={!file}
                style={{ padding: '10px 16px', fontSize: 13, opacity: file ? 1 : 0.55, cursor: file ? 'pointer' : 'not-allowed' }}
                onClick={handleScan}
              >
                {file ? '🔍 Quét thông tin từ ảnh VNeID' : 'Chọn ảnh để bắt đầu quét'}
              </button>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickFile} />

          <div style={s.tips}>
            <div style={s.tipTitle}>Lưu ý:</div>
            {[
              'Ảnh cần rõ nét, chụp/cắt trọn phần thông tin CCCD',
              'Ảnh VNeID không có "Quê quán" — trường này để trống, nhập nếu cần',
              'Thông tin nhận diện cần đối chiếu lại với ảnh trước khi lưu',
            ].map((t) => <div key={t} style={s.tip}>✓ {t}</div>)}
          </div>
        </div>
      )}

      {stage === 'review' && (
        <div className="cccd-review-grid">
          <div style={s.card}>
            <div style={s.cardTitle}>Ảnh VNeID</div>
            {preview ? (
              <>
                <div style={{ marginTop: 8 }}>
                  <img src={preview} alt="Ảnh VNeID" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                </div>
                <div style={source === 'manual' ? s.ocrBadgeWarn : s.ocrBadge}>
                  {source === 'manual' ? '✎ Nhập tay · ảnh sẽ lưu vào hồ sơ' : '⚠ Nhận diện từ ảnh · ảnh sẽ lưu vào hồ sơ'}
                </div>
              </>
            ) : (
              <div style={s.noImg}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📱</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Chưa có ảnh.</div>
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>
              {source === 'manual' ? 'Nhập thông tin từ ảnh' : 'Thông tin nhận diện từ ảnh'}
            </div>
            <div style={s.cardSub}>
              {source === 'manual'
                ? 'Không đọc được tự động — nhập tay theo ảnh bên cạnh'
                : 'Dữ liệu do máy đọc chữ, hãy đối chiếu kỹ với ảnh trước khi lưu'}
            </div>
            {degraded && (
              <div style={s.degradedBox}>
                ⚠ Dịch vụ nhận diện chính (FPT.AI) không phản hồi — đang dùng OCR dự phòng <b>độ chính xác thấp</b>.
                Hãy kiểm tra kỹ TỪNG trường với ảnh, hoặc thử quét lại sau.
              </div>
            )}
            {submitErr && !dup && <div style={{ ...s.errorBox, marginBottom: 10 }}>{submitErr}</div>}

            {dup && (
              <div style={s.dupBox}>
                <div style={s.dupTitle}>⚠️ CCCD đã tồn tại trong hệ thống</div>
                <div style={s.dupMsg}>{dup.message}</div>
                {dup.co_the_kich_hoat_lai ? (
                  <div style={s.dupActions}>
                    <button className="btn-ghost" onClick={() => setDup(null)}>Đóng</button>
                    <button className="btn-primary" onClick={() => handleApprove({ kichHoatLai: true })}>
                      ↻ Thêm lại vào công ty
                    </button>
                  </div>
                ) : (
                  <div style={s.dupHint}>
                    Công nhân này đang làm việc nên không thể thêm mới. Nếu cần chuyển về
                    công ty của bạn, hãy liên hệ quản trị viên.
                  </div>
                )}
              </div>
            )}

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
                <input className="form-input" value={form.que_quan} onChange={(e) => setField('que_quan', e.target.value)}
                  placeholder="Ảnh VNeID không có quê quán — nhập nếu cần" />
              </Field>
              <Field label="Nơi thường trú" error={errors.dia_chi} span2>
                <input className="form-input" value={form.dia_chi} onChange={(e) => setField('dia_chi', e.target.value)} />
              </Field>
              <Field label="Ngày cấp CCCD" error={errors.ngay_cap}>
                <input className="form-input" value={form.ngay_cap} onChange={(e) => setField('ngay_cap', formatDateInput(e.target.value))} placeholder="dd/mm/yyyy" maxLength={10} />
              </Field>
              <div style={s.divider} />

              <Field label="Công ty" error={errors.cong_ty_id}>
                <select className="form-input" value={form.cong_ty_id || defaultCongTyId()} onChange={(e) => setField('cong_ty_id', e.target.value)}>
                  <option value="">{isAdmin ? '— Chọn công ty —' : 'Không phân công'}</option>
                  {congTyOptions.map((ct) => <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>)}
                </select>
              </Field>
              <Field label="Trạng thái">
                <select className="form-input" value={form.trang_thai || defaultTrangThai} onChange={(e) => setField('trang_thai', e.target.value)}>
                  <option value="doi_viec">Đợi việc (chờ phỏng vấn)</option>
                  <option value="moi_vao">Mới vào</option>
                  <option value="dang_lam">Đang làm</option>
                </select>
              </Field>
              {canPickVender ? (
                <Field label="Người tuyển" error={errors.nguoi_tuyen_id}>
                  <select className="form-input" value={form.nguoi_tuyen_id} onChange={(e) => setField('nguoi_tuyen_id', e.target.value)}>
                    <option value="">— Mặc định: {user?.ho_ten ?? 'tôi'} —</option>
                    {venderArr.map((v) => <option key={v.id} value={v.id}>{v.ho_ten}</option>)}
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
              <Field label="Bộ phận" error={errors.bo_phan}>
                <input className="form-input" value={form.bo_phan} onChange={(e) => setField('bo_phan', e.target.value)} placeholder="VD: Tổ 1 / Đóng gói" maxLength={100} />
              </Field>
            </div>

            <div style={s.reviewActions}>
              <button className="btn-ghost" style={{ color: 'var(--red)' }} onClick={resetAll}>Quét lại</button>
              <button className="btn-primary" onClick={() => handleApprove()}>✓ Thêm vào hệ thống</button>
            </div>
          </div>
        </div>
      )}

      {stage === 'creating' && (
        <div style={s.doneCard}>
          <div style={s.spinner} />
          <div style={s.doneTitle}>Đang thêm công nhân...</div>
          <div style={s.doneSub}>Lưu thông tin và ảnh VNeID vào hồ sơ</div>
        </div>
      )}

      {stage === 'done' && (
        <div style={s.doneCard}>
          <div style={s.doneIcon}>✅</div>
          <div style={s.doneTitle}>Thêm thành công!</div>
          <div style={s.doneSub}>Công nhân <b>{createdName}</b> đã được thêm vào hệ thống cùng ảnh VNeID</div>
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
    <div style={{ ...fst.field, ...(span2 ? { gridColumn: '1 / -1' } : {}) }} className={span2 ? 'cccd-field-span2' : ''}>
      <label className="form-label">{label}</label>
      {children}
      {error && <div style={fst.err}>{error}</div>}
    </div>
  );
}

const fst = {
  field: { display: 'flex', flexDirection: 'column', gap: 5 },
  err:   { fontSize: 11, color: 'var(--red)', marginTop: 3 },
};

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', flexDirection: 'column' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  sub:   { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  errorBox: { background: 'rgba(255,95,114,0.12)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--red)' },
  degradedBox: { background: 'rgba(255,179,68,0.12)', border: '1px solid var(--amber)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 12, lineHeight: 1.5 },
  dupBox: { background: 'rgba(255,179,68,0.10)', border: '1px solid var(--amber)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 },
  dupTitle: { fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 6 },
  dupMsg: { fontSize: 12, color: 'var(--text1)', lineHeight: 1.5 },
  dupHint: { fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, marginTop: 8 },
  dupActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  scanCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  processing: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  dropzone: { background: 'var(--bg1)', border: '2px dashed var(--border2)', borderRadius: 14, padding: '28px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center', gap: 4 },
  dropThumb: { width: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#000' },
  dropTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginTop: 4 },
  dropSub: { fontSize: 12, color: 'var(--text3)' },
  tips: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' },
  tipTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 },
  tip: { fontSize: 12, color: 'var(--text2)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cardSub: { fontSize: 11, color: 'var(--text2)', marginTop: 3, marginBottom: 14 },
  noImg: { marginTop: 8, padding: '28px 14px', background: 'var(--bg2)', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  ocrBadge: { display: 'inline-block', marginTop: 10, padding: '4px 10px', background: 'rgba(255,179,68,0.14)', color: 'var(--amber)', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  ocrBadgeWarn: { display: 'inline-block', marginTop: 10, padding: '4px 10px', background: 'rgba(34,201,134,0.12)', color: 'var(--green)', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  divider: { gridColumn: '1 / -1', height: 1, background: 'var(--border)', margin: '4px 0' },
  reviewActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  doneCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 },
  doneIcon:  { fontSize: 52 },
  doneTitle: { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  doneSub:   { fontSize: 13, color: 'var(--text2)' },
  doneActions: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
};
