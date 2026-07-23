import { useState, useRef, useMemo, useEffect } from 'react';
import QrScanner from 'qr-scanner';
import api from '../../hooks/useApi';
import { useAuth } from '../../context/AuthContext';
import { useCongTyList, useVenders } from '../../hooks/useCongNhan';
import { parseCccdQr } from '../../utils/parseCccdQr';
import { decodeCccdQrFromImage } from '../../utils/decodeCccdImage';
import { ocrCccdFromImage, ocrCccdBothSides, captureVideoFrame } from '../../utils/ocrCccdImage';

// Camera quét bao lâu mà không thấy QR thì tự chuyển sang nhận diện ảnh (ms)
const CAM_OCR_DELAY_MS = 12000;
// Số lần tự nhận diện ảnh từ camera cho mỗi phiên quét — tránh gọi OCR vô hạn
const CAM_OCR_MAX_TRIES = 2;

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
  que_quan: '', dia_chi: '', ngay_cap: '',
  ngay_vao_lam: isoToDdmmyyyy(todayIso()),
  cong_ty_id: '', nguoi_tuyen_id: '', ma_van_tay: '',
  trang_thai: '', // '' → suy ra mặc định theo vai trò (defaultTrangThai)
};

// Nhãn bước review theo nguồn dữ liệu — OCR cần nhắc đối chiếu vì có thể sai chữ.
const SOURCE_LABEL = {
  qr: {
    badge: '✓ QR đã đọc',
    title: 'Thông tin từ QR',
    sub:   'Kiểm tra & bổ sung trước khi thêm vào hệ thống',
  },
  ocr: {
    badge: '⚠ Nhận diện từ ảnh',
    title: 'Thông tin nhận diện từ ảnh',
    sub:   'Ảnh không có mã QR — dữ liệu do máy đọc chữ, hãy đối chiếu kỹ với thẻ trước khi lưu',
  },
  manual: {
    badge: '✎ Nhập tay',
    title: 'Nhập thông tin từ ảnh',
    sub:   'Không đọc được tự động — nhập tay theo ảnh bên cạnh',
  },
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
  const [anhUrlSau, setAnhUrlSau] = useState(null);   // URL ảnh mặt sau (quét 2 mặt)
  const [uploadingAnh, setUploadingAnh] = useState(false);

  // Quét CCCD từ ảnh tải lên: bắt buộc đủ 2 mặt trước khi quét
  const [frontFile, setFrontFile]       = useState(null);
  const [frontPreview, setFrontPreview] = useState(null);
  const [backFile, setBackFile]         = useState(null);
  const [backPreview, setBackPreview]   = useState(null);
  const [previewSau, setPreviewSau]     = useState(null); // ảnh mặt sau ở bước review
  const [pendingFile, setPendingFile] = useState(null); // ảnh đọc QR trượt — cho nhập tay
  const [debugInfo, setDebugInfo] = useState(null);      // ảnh đã tiền xử lý (gỡ lỗi)
  const [source, setSource]   = useState('qr');          // 'qr' | 'ocr' — nguồn dữ liệu đang review
  const [degraded, setDegraded] = useState(false);       // true = OCR chạy engine dự phòng (Tesseract) kém chính xác
  const [busyMsg, setBusyMsg] = useState('');            // mô tả việc đang chạy ở stage processing

  const videoRef   = useRef(null);
  const scannerRef = useRef(null);
  const frontRef   = useRef(null);
  const backRef    = useRef(null);
  const handledRef = useRef(false); // chặn xử lý 1 mã QR nhiều lần
  const camTimerRef = useRef(null); // hẹn giờ tự chuyển sang OCR khi quét camera
  const camTriesRef = useRef(0);    // số lần đã tự OCR từ camera trong phiên này

  const { user, isAdmin, isQuanLy } = useAuth();
  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];
  const canPickVender = isAdmin || isQuanLy;
  // Người thêm không phải quản lý (vender) → mặc định "đợi việc" (chưa cần công ty);
  // admin / quản lý → "mới vào" (gán công ty mình quản lý).
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
    scanner.start().then(() => {
      // Quét mãi không thấy QR (CCCD cũ 9 số, thẻ mờ/xước) → tự chụp khung hình
      // hiện tại và nhận diện bằng OCR thay vì bắt người dùng loay hoay.
      if (camTriesRef.current >= CAM_OCR_MAX_TRIES) return;
      camTimerRef.current = setTimeout(autoOcrFromCamera, CAM_OCR_DELAY_MS);
    }).catch((err) => {
      setScanErr(`Không mở được camera: ${err?.message ?? err}. Hãy cấp quyền camera hoặc dùng tải ảnh.`);
    });

    return () => {
      clearTimeout(camTimerRef.current);
      camTimerRef.current = null;
      scanner.stop();
      scanner.destroy();
      scannerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, stage]);

  // Chụp khung hình đang quét → gửi OCR. Thất bại thì quay lại quét QR bình thường.
  async function autoOcrFromCamera() {
    if (handledRef.current || !videoRef.current) return;
    const frame = await captureVideoFrame(videoRef.current);
    if (!frame) return;

    handledRef.current = true; // chặn QR bắn kết quả xen giữa
    camTriesRef.current += 1;
    setScanErr(null);
    setBusyMsg('Chưa thấy mã QR — đang nhận diện thông tin trên ảnh...');
    setStage('processing');   // effect cleanup sẽ tắt camera

    // Giữ lại khung hình: người dùng cần nhìn ảnh gốc để đối chiếu kết quả OCR,
    // và ảnh đã được backend upload sẵn trong lượt OCR này.
    const ok = await applyOcrResult(frame, { keepImage: true });
    if (!ok) {
      handledRef.current = false;
      setScanErr(
        camTriesRef.current >= CAM_OCR_MAX_TRIES
          ? 'Không nhận diện được CCCD từ camera. Hãy dùng "Tải ảnh CCCD" với ảnh chụp rõ nét, hoặc nhập tay.'
          : 'Không nhận diện được CCCD trong khung hình. Đưa trọn thẻ vào khung, giữ máy yên và đủ sáng.',
      );
      setStage('scan');
    }
  }

  // Gửi ảnh sang backend nhận diện (FPT.AI). Trả true nếu đã đổ được vào form.
  // keepImage = true → hiển thị ảnh gốc ở bước review và lưu vào hồ sơ.
  async function applyOcrResult(file, { keepImage }) {
    try {
      const { parsed, duongDanAnh, degraded: isDegraded } = await ocrCccdFromImage(file);
      if (!parsed) return false;

      setForm((cur) => ({ ...cur, ...parsed, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
      setSource('ocr');
      setDegraded(!!isDegraded);
      setPendingFile(null);
      if (keepImage) {
        setPreview(URL.createObjectURL(file));
        setAnhFile(file);
      }
      // Backend đã upload ảnh khi OCR → dùng lại URL, không upload lần hai.
      setAnhUrl(keepImage ? duongDanAnh : null);
      setStage('review');
      return true;
    } catch {
      return false; // OCR lỗi (thiếu API key, mạng, quota...) — người gọi tự xử lý thông báo
    }
  }

  // ─── Đọc dữ liệu QR → đổ vào form ──────────────────────────────────────────
  function onDecoded(rawData) {
    if (handledRef.current) return;
    const parsed = parseCccdQr(rawData);
    if (!parsed) {
      setScanErr('Mã QR không phải CCCD hợp lệ. Hãy quét đúng QR ở mặt trước CCCD gắn chip.');
      return;
    }
    handledRef.current = true;
    clearTimeout(camTimerRef.current);
    scannerRef.current?.stop();
    setScanErr(null);
    setSource('qr');
    setForm((cur) => ({
      ...cur,
      ...parsed,
      cong_ty_id: cur.cong_ty_id || defaultCongTyId(),
    }));
    setStage('review');
  }

  // ─── Upload ĐỦ 2 MẶT → quét gộp ─────────────────────────────────────────────
  // Chọn 1 mặt (trước/sau) — chỉ lưu file & preview, chưa quét vội.
  function pickSide(which, e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setScanErr(null);
    if (which === 'front') { setFrontFile(file); setFrontPreview(URL.createObjectURL(file)); }
    else                   { setBackFile(file);  setBackPreview(URL.createObjectURL(file)); }
  }

  // Chỉ quét khi đã đủ cả 2 mặt. QR mặt trước (nếu có) cho định danh chính xác nhất,
  // FPT.AI đọc cả 2 mặt để bổ sung ngày cấp + các trường còn thiếu.
  async function handleScanBothSides() {
    if (!frontFile || !backFile) {
      setScanErr('Vui lòng tải lên đủ cả 2 mặt CCCD (mặt trước và mặt sau) trước khi quét.');
      return;
    }
    setScanErr(null);
    setDebugInfo(null);
    setBusyMsg('Đang nhận diện thông tin trên 2 mặt CCCD...');
    setStage('processing');

    let qr = null;
    try {
      const r = await decodeCccdQrFromImage(frontFile).catch(() => null);
      qr = r?.parsed ?? null;
    } catch { qr = null; }

    try {
      const { parsed, duongDanAnh, duongDanAnhSau, degraded: isDegraded } = await ocrCccdBothSides(frontFile, backFile);
      // Gộp: OCR làm nền, QR định danh đè lên (QR chính xác hơn), giữ ngày cấp từ OCR mặt sau.
      const data = { ...(parsed ?? {}), ...(qr ?? {}) };
      setSource((data.ho_ten || data.cccd) ? (qr ? 'qr' : 'ocr') : 'manual');
      // QR chính xác tuyệt đối → không cảnh báo dù OCR nền có degraded; chỉ cảnh báo khi dữ liệu thật sự đến từ OCR dự phòng.
      setDegraded(!qr && !!isDegraded);
      setForm((cur) => ({ ...cur, ...data, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
      setPreview(frontPreview);
      setPreviewSau(backPreview);
      setAnhFile(frontFile);
      setAnhUrl(duongDanAnh);
      setAnhUrlSau(duongDanAnhSau);
      setStage('review');
    } catch (err) {
      setScanErr(err?.message ?? 'Không nhận diện được CCCD. Hãy chụp lại rõ nét, đủ sáng, chụp thẳng.');
      setStage('scan');
    }
  }

  // Nhập tay từ ảnh vừa chọn khi QR không đọc được — vẫn lưu ảnh vào hồ sơ.
  function goManualFromPending() {
    const file = pendingFile;
    if (!file) return;
    setSource('manual');
    setForm((cur) => ({ ...cur, cong_ty_id: cur.cong_ty_id || defaultCongTyId() }));
    setPreview(URL.createObjectURL(file));
    setAnhFile(file);
    setAnhUrl(null);
    setScanErr(null);
    setPendingFile(null);
    setStage('review');
    uploadAnhBackground(file);
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

    // "Đang làm" / "Mới vào" bắt buộc gán công ty (đợi việc thì không cần)
    const trangThai = form.trang_thai || defaultTrangThai;
    const congTyId = form.cong_ty_id || defaultCongTyId();
    if (['dang_lam', 'moi_vao'].includes(trangThai) && !congTyId) {
      setSubmitErr('Trạng thái "Đang làm" / "Mới vào" bắt buộc phải chọn công ty');
      return;
    }

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
        que_quan:         form.que_quan || null,
        dia_chi_hien_tai: form.dia_chi  || null,
        ngay_cap_cccd:    ddmmyyyyToIso(form.ngay_cap),
        ngay_vao_lam:     ddmmyyyyToIso(form.ngay_vao_lam),
        ma_van_tay:       form.ma_van_tay || null,
        anh_cccd_truoc:   finalAnhUrl || null,
        anh_cccd_sau:     anhUrlSau || null,
        trang_thai:       trangThai,
      };
      if (congTyId) payload.cong_ty_id = parseInt(congTyId, 10);
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
        setSubmitErr(err?.message ?? 'Không tạo được công nhân');
      }
      setStage('review');
    }
  }

  function resetAll() {
    setForm(EMPTY_FORM);
    setErrors({}); setSubmitErr(null); setScanErr(null);
    setPreview(null); setAnhFile(null); setAnhUrl(null); setAnhUrlSau(null);
    setPreviewSau(null);
    setFrontFile(null); setFrontPreview(null); setBackFile(null); setBackPreview(null);
    setPendingFile(null); setDebugInfo(null);
    setSource('qr'); setDegraded(false); setBusyMsg('');
    handledRef.current = false;
    camTriesRef.current = 0;
    setStage('scan');
  }

  function switchMode(next) {
    if (next === mode) return;
    setScanErr(null);
    setPendingFile(null);
    setDebugInfo(null);
    camTriesRef.current = 0;
    setMode(next);
  }

  return (
    <div style={s.root}>
      <div style={s.header}>
        <h2 style={s.title}>Quét CCCD</h2>
        <p style={s.sub}>Quét mã QR mặt trước CCCD gắn chip — không có QR thì tự nhận diện chữ trên ảnh</p>
      </div>

      {(stage === 'scan' || stage === 'processing') && (
        <div style={s.scanCard}>
          <div style={s.modeTabs}>
            <button style={tabStyle(mode === 'camera')} onClick={() => switchMode('camera')}>📷 Quét bằng camera</button>
            <button style={tabStyle(mode === 'upload')} onClick={() => switchMode('upload')}>🖼️ Tải ảnh CCCD</button>
          </div>

          {scanErr && (
            <div style={s.errorBox}>
              <div>{scanErr}</div>
              {pendingFile && (
                <button
                  className="btn-ghost"
                  style={{ marginTop: 10, color: 'var(--accent)', padding: '6px 12px', fontSize: 12 }}
                  onClick={goManualFromPending}
                >
                  ✎ Nhập tay từ ảnh vừa chọn
                </button>
              )}
            </div>
          )}

          {debugInfo && stage === 'scan' && <DebugPanel debug={debugInfo} />}

          {stage === 'processing' ? (
            <div style={s.processing}>
              <div style={s.spinner} />
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>{busyMsg || 'Đang xử lý ảnh...'}</div>
            </div>
          ) : mode === 'camera' ? (
            <div style={s.cameraWrap}>
              <video ref={videoRef} style={s.video} muted playsInline />
              <div style={s.scanHint}>
                Đưa mặt trước CCCD vào khung — hệ thống tự đọc mã QR,
                nếu không thấy QR sẽ tự nhận diện chữ trên thẻ
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={s.dropSub}>Tải lên <b>đủ 2 mặt</b> CCCD — hệ thống quét khi có đủ cả hai để lấy thông tin chính xác nhất.</div>
              <div className="cccd-upload-grid">
                <SideDrop label="Mặt trước" hint="Ảnh chân dung + họ tên + số CCCD"
                  preview={frontPreview} onPick={() => frontRef.current?.click()} />
                <SideDrop label="Mặt sau" hint="Ngày cấp + đặc điểm nhận dạng"
                  preview={backPreview} onPick={() => backRef.current?.click()} />
              </div>
              <button
                className="btn-primary"
                disabled={!frontFile || !backFile}
                style={{
                  padding: '10px 16px', fontSize: 13,
                  opacity: (frontFile && backFile) ? 1 : 0.55,
                  cursor: (frontFile && backFile) ? 'pointer' : 'not-allowed',
                }}
                onClick={handleScanBothSides}
              >
                {frontFile && backFile ? '🔍 Quét thông tin từ 2 mặt CCCD' : 'Tải đủ 2 mặt để bắt đầu quét'}
              </button>
            </div>
          )}
          <input ref={frontRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickSide('front', e)} />
          <input ref={backRef}  type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => pickSide('back', e)} />

          <div style={s.tips}>
            <div style={s.tipTitle}>Lưu ý:</div>
            {[
              'Tải đủ 2 mặt CCCD — thiếu 1 mặt sẽ không quét được',
              'Mặt trước có mã QR (CCCD gắn chip) sẽ cho thông tin chính xác nhất',
              'Mặt sau cung cấp ngày cấp và đặc điểm nhận dạng',
              'Thông tin nhận diện cần đối chiếu lại với thẻ trước khi lưu',
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
                {previewSau && (
                  <div style={{ marginTop: 10 }}>
                    <img src={previewSau} alt="Mặt sau CCCD" style={{ width: '100%', borderRadius: 8, border: '1px solid var(--border)' }} />
                    <div style={s.imgCaption}>Mặt sau</div>
                  </div>
                )}
                <div style={source === 'ocr' ? s.ocrBadgeWarn : s.ocrBadge}>
                  {uploadingAnh ? '⏳ Đang lưu ảnh...' : `${SOURCE_LABEL[source].badge} · ảnh sẽ lưu vào hồ sơ`}
                </div>
              </>
            ) : (
              <div style={s.noImg}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>📷</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Quét bằng camera — không lưu ảnh.</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>Dùng "Tải ảnh CCCD" nếu muốn lưu ảnh vào hồ sơ.</div>
                <div style={s.ocrBadge}>{SOURCE_LABEL[source].badge}</div>
              </div>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>{SOURCE_LABEL[source].title}</div>
            <div style={s.cardSub}>{SOURCE_LABEL[source].sub}</div>
            {degraded && (
              <div style={s.degradedBox}>
                ⚠ Dịch vụ nhận diện chính (FPT.AI) không phản hồi — đang dùng OCR dự phòng <b>độ chính xác thấp</b>.
                Hãy kiểm tra kỹ TỪNG trường với ảnh thẻ, hoặc thử quét lại sau.
              </div>
            )}
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
                <input className="form-input" value={form.que_quan} onChange={(e) => setField('que_quan', e.target.value)}
                  placeholder={source === 'ocr' ? '' : 'Không có trong QR — nhập nếu cần'} />
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

// Panel gỡ lỗi: hiển thị ảnh sau mỗi lượt tiền xử lý + mã QR thô (nếu đọc được).
// Giúp phát hiện vấn đề: QR có còn rõ sau xử lý không? decoder bắt được mã nào chưa?
function DebugPanel({ debug }) {
  const [open, setOpen] = useState(false);
  const steps = debug?.steps ?? [];
  const withThumb = steps.filter((st) => st.thumb);
  const foundAny = steps.some((st) => st.found);

  return (
    <div style={s.debugBox}>
      <button style={s.debugToggle} onClick={() => setOpen((o) => !o)}>
        <span>🔍 Gỡ lỗi — xem ảnh đã xử lý ({withThumb.length} lượt)</span>
        <span style={{ color: 'var(--text3)' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 12 }}>
          <div style={s.debugMeta}>
            {debug.size && <span>Kích thước ảnh: <b>{debug.size.w}×{debug.size.h}px</b></span>}
            <span>
              QR phát hiện:{' '}
              <b style={{ color: foundAny ? 'var(--green)' : 'var(--red)' }}>
                {foundAny ? 'CÓ' : 'KHÔNG'}
              </b>
            </span>
          </div>

          {debug.lastRaw && (
            <div style={s.debugRaw}>
              <div style={{ color: 'var(--text2)', marginBottom: 4 }}>Chuỗi QR đọc được (không đúng định dạng CCCD):</div>
              <code style={{ wordBreak: 'break-all' }}>{debug.lastRaw}</code>
            </div>
          )}

          <div style={s.debugHint}>
            {foundAny
              ? 'Đã đọc được mã QR nhưng không phải QR CCCD gắn chip (7 trường ngăn bởi "|"). Kiểm tra chuỗi ở trên.'
              : 'Không bắt được mã QR nào. Xem các ảnh bên dưới: nếu mã QR bị mờ/vỡ/mất góc định vị sau khi xử lý thì ảnh gốc chưa đủ rõ — chụp lại gần & thẳng hơn.'}
          </div>

          <div className="cccd-debug-grid">
            {withThumb.map((st, i) => (
              <a key={i} href={st.thumb} target="_blank" rel="noreferrer" style={s.debugCell} title="Bấm để xem to">
                <img src={st.thumb} alt={st.label} style={s.debugImg} />
                <div style={s.debugLabel}>
                  <span>{st.label}</span>
                  <span style={{ color: st.found ? 'var(--green)' : 'var(--text3)' }}>
                    {st.ok ? '✓ CCCD' : st.found ? '● có QR' : '—'}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Ô tải 1 mặt CCCD (trước/sau) — hiện thumbnail khi đã chọn.
function SideDrop({ label, hint, preview, onPick }) {
  return (
    <div style={s.sideDrop} onClick={onPick}>
      {preview ? (
        <img src={preview} alt={label} style={s.sideThumb} />
      ) : (
        <div style={{ fontSize: 30 }}>🪪</div>
      )}
      <div style={s.dropTitle}>{label}{preview ? ' ✓' : ''}</div>
      <div style={s.dropSub}>{hint}</div>
      <button className="btn-ghost" style={{ marginTop: 6, color: 'var(--accent)', fontSize: 12, padding: '5px 12px' }}
        onClick={(e) => { e.stopPropagation(); onPick(); }}>
        {preview ? 'Chọn lại' : 'Chọn ảnh'}
      </button>
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
  degradedBox: { background: 'rgba(255,179,68,0.12)', border: '1px solid var(--amber)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--amber)', marginBottom: 12, lineHeight: 1.5 },
  scanCard: { display: 'flex', flexDirection: 'column', gap: 16 },
  modeTabs: { display: 'flex', gap: 10 },
  cameraWrap: { display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' },
  video: { width: '100%', maxWidth: 460, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 14, border: '1px solid var(--border)', background: '#000' },
  scanHint: { fontSize: 12, color: 'var(--text2)', textAlign: 'center' },
  processing: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '48px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 },
  dropzone: { background: 'var(--bg1)', border: '2px dashed var(--border2)', borderRadius: 14, padding: '40px 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center', gap: 4 },
  dropTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text1)', marginTop: 4 },
  dropSub: { fontSize: 12, color: 'var(--text3)' },
  sideDrop: { background: 'var(--bg1)', border: '2px dashed var(--border2)', borderRadius: 14, padding: '18px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', textAlign: 'center', gap: 4 },
  sideThumb: { width: '100%', maxHeight: 140, objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: '#000' },
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
  ocrBadgeWarn: { display: 'inline-block', marginTop: 10, padding: '4px 10px', background: 'rgba(255,179,68,0.14)', color: 'var(--amber)', borderRadius: 20, fontSize: 11, fontWeight: 600 },
  divider: { gridColumn: 'span 2', height: 1, background: 'var(--border)', margin: '4px 0' },
  reviewActions: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' },
  doneCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '56px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 8 },
  doneIcon:    { fontSize: 52 },
  doneTitle:   { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  doneSub:     { fontSize: 13, color: 'var(--text2)' },
  doneActions: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  debugBox: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 16px' },
  debugToggle: { width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', padding: 0 },
  debugMeta: { display: 'flex', gap: 18, flexWrap: 'wrap', fontSize: 12, color: 'var(--text2)', marginBottom: 10 },
  debugRaw: { background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: 'var(--amber)', marginBottom: 10 },
  debugHint: { fontSize: 12, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 12 },
  debugCell: { display: 'block', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', textDecoration: 'none', background: 'var(--bg2)' },
  debugImg: { width: '100%', display: 'block', aspectRatio: '4 / 3', objectFit: 'contain', background: '#000' },
  debugLabel: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, padding: '5px 8px', fontSize: 10, color: 'var(--text2)' },
};
