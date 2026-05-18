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

// FPT.AI trả ngày DD/MM/YYYY, DB cần YYYY-MM-DD
function ddmmyyyyToIso(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}
// CCCD parser đôi khi để space/ký tự lạ
function cleanCccd(s) {
  if (!s) return null;
  const d = String(s).replace(/\D/g, '');
  return /^\d{12}$/.test(d) ? d : null;
}

export default function ScanCCCD() {
  // stage: upload | processing | review | creating | done | error
  const [stage, setStage]     = useState('upload');
  const [front, setFront]     = useState(null); // { preview, anhUrl, ocrId, ketQua }
  const [back, setBack]       = useState(null);
  const [edited, setEdited]   = useState({});
  const [error, setError]     = useState(null);
  const [createdName, setCreatedName] = useState('');
  const frontRef = useRef();
  const backRef  = useRef();

  async function uploadOne(file, label) {
    const form = new FormData();
    form.append('anh', file);
    form.append('loai', 'cccd');
    const res = await api.post('/ocr/scan', form, {
      headers: { 'Content-Type': undefined },
    });
    return {
      preview: URL.createObjectURL(file),
      anhUrl: res.data.duong_dan_anh,
      ocrId:  res.data.ocr_id,
      ketQua: res.data.ket_qua ?? {},
      label,
    };
  }

  function mergeAndSet(f, b) {
    // Mặt trước: ho_ten, cccd, ngay_sinh, gioi_tinh, que_quan, dia_chi
    // Mặt sau:   ngay_cap, noi_cap
    const fk = f?.ketQua ?? {};
    const bk = b?.ketQua ?? {};
    setEdited({
      ho_ten:    fk.ho_ten    || bk.ho_ten    || '',
      cccd:      fk.cccd      || bk.cccd      || '',
      ngay_sinh: fk.ngay_sinh || bk.ngay_sinh || '',
      gioi_tinh: fk.gioi_tinh || bk.gioi_tinh || '',
      que_quan:  fk.que_quan  || bk.que_quan  || '',
      dia_chi:   fk.dia_chi   || bk.dia_chi   || '',
      ngay_cap:  bk.ngay_cap  || fk.ngay_cap  || '',
      noi_cap:   bk.noi_cap   || fk.noi_cap   || '',
    });
  }

  async function handleFrontFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStage('processing');
    try {
      const f = await uploadOne(file, 'truoc');
      setFront(f);
      // Nếu mặt sau đã có → merge và sang review; chưa có → quay lại upload chờ mặt sau
      if (back) { mergeAndSet(f, back); setStage('review'); }
      else      { setStage('upload'); }
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Lỗi OCR mặt trước');
      setStage('upload');
    }
  }

  async function handleBackFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setStage('processing');
    try {
      const b = await uploadOne(file, 'sau');
      setBack(b);
      if (front) { mergeAndSet(front, b); setStage('review'); }
      else       { setStage('upload'); }
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Lỗi OCR mặt sau');
      setStage('upload');
    }
  }

  function handleEdit(k, v) { setEdited((r) => ({ ...r, [k]: v })); }

  async function handleApprove() {
    setError(null);
    setStage('creating');
    try {
      // 1. Tạo công nhân với data đã review + 2 URL ảnh CCCD
      const payload = {
        ho_ten:           (edited.ho_ten || '').trim(),
        cccd:             cleanCccd(edited.cccd),
        ngay_sinh:        ddmmyyyyToIso(edited.ngay_sinh),
        gioi_tinh:        ['Nam','Nữ','Khác'].includes(edited.gioi_tinh) ? edited.gioi_tinh : null,
        que_quan:         edited.que_quan || null,
        dia_chi_hien_tai: edited.dia_chi  || null,
        ngay_cap_cccd:    ddmmyyyyToIso(edited.ngay_cap),
        noi_cap_cccd:     edited.noi_cap  || null,
        anh_cccd_truoc:   front?.anhUrl   || null,
        anh_cccd_sau:     back?.anhUrl    || null,
      };
      if (!payload.ho_ten || payload.ho_ten.length < 2) {
        throw new Error('Họ tên trống hoặc dưới 2 ký tự — sửa rồi thử lại');
      }
      await api.post('/cong-nhan', payload);
      setCreatedName(payload.ho_ten);

      // 2. Approve cả 2 OCR records (best-effort, không chặn flow)
      const approves = [];
      if (front?.ocrId) approves.push(api.post(`/ocr/${front.ocrId}/approve`).catch(() => {}));
      if (back?.ocrId)  approves.push(api.post(`/ocr/${back.ocrId}/approve`).catch(() => {}));
      await Promise.all(approves);

      setStage('done');
    } catch (err) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Không tạo được công nhân');
      setStage('review');
    }
  }

  async function handleReject() {
    // Reject cả 2 OCR records (best-effort)
    const rejects = [];
    if (front?.ocrId) rejects.push(api.post(`/ocr/${front.ocrId}/reject`).catch(() => {}));
    if (back?.ocrId)  rejects.push(api.post(`/ocr/${back.ocrId}/reject`).catch(() => {}));
    await Promise.all(rejects);
    resetAll();
  }

  function resetAll() {
    setFront(null); setBack(null); setEdited({}); setError(null);
    setStage('upload');
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Quét CCCD</h2>
          <p style={s.sub}>Tải đủ 2 mặt CCCD để trích xuất thông tin tự động</p>
        </div>
      </div>

      {(stage === 'upload' || stage === 'processing') && (
        <div style={s.uploadCard}>
          {error && <div style={s.errorBox}>{error}</div>}
          <div className="cccd-upload-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {/* Mặt trước */}
            <SideSlot
              title="Mặt trước"
              hint="Có ảnh chân dung, họ tên, CCCD, ngày sinh, quê quán"
              picked={front}
              processing={stage === 'processing' && !front}
              onPick={() => frontRef.current?.click()}
              onClear={() => setFront(null)}
            />
            <input ref={frontRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFrontFile} />

            {/* Mặt sau */}
            <SideSlot
              title="Mặt sau"
              hint="Có ngày cấp + nơi cấp + nơi thường trú (mặt sau chip)"
              picked={back}
              processing={stage === 'processing' && !back}
              onPick={() => backRef.current?.click()}
              onClear={() => setBack(null)}
            />
            <input ref={backRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleBackFile} />
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
        <div style={s.reviewGrid}>
          <div style={s.card}>
            <div style={s.cardTitle}>Ảnh CCCD</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {front?.preview && (
                <div>
                  <img src={front.preview} alt="Mặt trước" style={{ width: '100%', borderRadius: 8 }} />
                  <div style={s.imgCaption}>Mặt trước</div>
                </div>
              )}
              {back?.preview && (
                <div>
                  <img src={back.preview} alt="Mặt sau" style={{ width: '100%', borderRadius: 8 }} />
                  <div style={s.imgCaption}>Mặt sau</div>
                </div>
              )}
            </div>
            <div style={s.ocrBadge}>OCR hoàn tất</div>
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Thông tin trích xuất</div>
            <div style={s.cardSub}>Kiểm tra và chỉnh sửa nếu cần trước khi duyệt</div>
            {error && <div style={{ ...s.errorBox, marginBottom: 10 }}>{error}</div>}
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
          <button className="btn-primary" style={{ marginTop: 12, padding: '6px 14px', fontSize: 12 }} onClick={(e) => { e.stopPropagation(); onPick(); }}>
            Chọn ảnh
          </button>
        </div>
      )}
    </div>
  );
}

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
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)' },
  sub:   { fontSize: 12, color: 'var(--text2)', marginTop: 3 },
  errorBox: { background: 'rgba(255,95,114,0.12)', border: '1px solid var(--red)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--red)' },
  uploadCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  tips: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 18px' },
  tipTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text2)', marginBottom: 8 },
  tip: { fontSize: 12, color: 'var(--text2)', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 8 },
  spinner: { width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--bg3)', borderTopColor: 'var(--accent)', animation: 'spin 0.8s linear infinite' },
  reviewGrid: { display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cardSub: { fontSize: 11, color: 'var(--text2)', marginTop: 3, marginBottom: 14 },
  imgCaption: { fontSize: 10, color: 'var(--text3)', textAlign: 'center', marginTop: 3, textTransform: 'uppercase', letterSpacing: '0.06em' },
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
