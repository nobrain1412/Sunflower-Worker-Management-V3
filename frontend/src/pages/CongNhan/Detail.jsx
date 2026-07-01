import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCongNhanDetail, useCapNhatCongNhan, useNoiOCongNhan, useTongUngCongNhan, useNoiOTruyCap, useCongTyList } from '../../hooks/useCongNhan';
import { useGiaoDichCongNhan, useCapNhatHoanTien, useTaoGiaoDich } from '../../hooks/useTaiChinh';
import { useLichSuPhong, usePhongList, useGiuongList } from '../../hooks/useKtx';
import { useChamCongCongNhan } from '../../hooks/useChamCong';
import { cellFromServer, summarize, detailText, cellColor, totalGio } from '../ChamCong/chamCongShared';
import { useHoatDongCongNhan } from '../../hooks/useHoatDong';
import { useAuth } from '../../context/AuthContext';
import ChuyenKhoanModal from '../../components/ChuyenKhoanModal';
import api from '../../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';
import QrScanner from 'qr-scanner';
import { parseCccdQr } from '../../utils/parseCccdQr';

const TRANG_THAI_PILL = {
  cho_duyet: { cls: 'pill-amber', label: 'Chờ duyệt' },
  doi_viec:  { cls: 'pill-purple', label: 'Đợi việc' },
  dang_lam:  { cls: 'pill-green', label: 'Đang làm' },
  moi_vao:   { cls: 'pill-blue',  label: 'Mới vào'  },
  nghi_phep: { cls: 'pill-amber', label: 'Nghỉ phép' },
  nghi_viec: { cls: 'pill-red',   label: 'Nghỉ việc' },
};

const LOAI_LABEL = {
  luong:    { label: 'Lương',      color: 'var(--green)'  },
  thuong:   { label: 'Thưởng',     color: 'var(--green)'  },
  phu_cap:  { label: 'Phụ cấp',   color: 'var(--teal)'   },
  hoan_ung: { label: 'Hoàn ứng',  color: 'var(--teal)'   },
  khau_tru: { label: 'Khấu trừ',  color: 'var(--red)'    },
  tam_ung:  { label: 'Tạm ứng',   color: 'var(--amber)'  },
  tien_phong_ktx: { label: 'KTX', color: 'var(--amber)'  },
  bao_hiem: { label: 'Bảo hiểm',  color: 'var(--red)'    },
  dong_phuc:{ label: 'Đồng phục', color: 'var(--amber)'  },
  phat_nghi:{ label: 'Phạt nghỉ', color: 'var(--red)'    },
  khac:     { label: 'Khác',       color: 'var(--text2)'  },
};
const LOAI_XE_LABEL = {
  xe_may: 'Xe máy',
  xe_dap: 'Xe đạp',
  xe_dien: 'Xe đạp điện',
};
const TRANG_THAI_NOI_O_LABEL = {
  chua_co_phong: 'Chưa có phòng',
  tu_tuc: 'Tự túc chỗ ở',
  ktx: 'Ở KTX',
  phong_tro: 'Ở nhà trọ',
};

const WEEKDAYS_LBL = ['CN','T2','T3','T4','T5','T6','T7'];

const HDL_ICON = {
  chuyen_cong_ty: '🔄',
  chuyen_cho_o:   '🏠',
  hoan_ung:       '💰',
  bao_nghi_phep:  '🌴',
  bao_nghi_viec:  '🚪',
  doi_trang_thai: '🔁',
  cham_cong_batch: '📅',
  them_cn:        '➕',
};
const HDL_LABEL = {
  chuyen_cong_ty: 'Chuyển công ty',
  chuyen_cho_o:   'Đổi chỗ ở',
  hoan_ung:       'Hoàn ứng',
  bao_nghi_phep:  'Báo nghỉ phép',
  bao_nghi_viec:  'Báo nghỉ việc',
  doi_trang_thai: 'Đổi trạng thái',
  cham_cong_batch: 'Cập nhật chấm công',
  them_cn:        'Thêm công nhân',
};

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
function mediaUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return path;
}

function Field({ label, value, children }) {
  return (
    <div style={fs.field}>
      <div style={fs.label}>{label}</div>
      {children ?? <div style={fs.value}>{value || '—'}</div>}
    </div>
  );
}
const fs = {
  field: { display: 'flex', flexDirection: 'column', gap: 4 },
  label: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  value: { fontSize: 13, color: 'var(--text1)', fontWeight: 500, lineHeight: 1.45, overflowWrap: 'anywhere' },
};

// ─── Modal upload ảnh ─────────────────────────────────────
function UploadAnhModal({ cn, onClose }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState({ cccd_mat_truoc: null, cccd_mat_sau: null, anh_chan_dung: null, anh_xe: null });
  const [previews, setPreviews] = useState({});
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const imageFields = [
    { uploadField: 'cccd_mat_truoc', dataField: 'anh_cccd_truoc', label: 'CCCD mặt trước' },
    { uploadField: 'cccd_mat_sau', dataField: 'anh_cccd_sau', label: 'CCCD mặt sau' },
    { uploadField: 'anh_chan_dung', dataField: 'anh_chan_dung', label: 'Ảnh chân dung' },
    // Chỉ cho upload ảnh xe khi công nhân thật sự có mượn xe
    ...(cn.muon_xe ? [{ uploadField: 'anh_xe', dataField: 'anh_xe', label: 'Ảnh xe mượn' }] : []),
  ];

  function handleFile(field, file) {
    if (!file) return;
    setFiles((f) => ({ ...f, [field]: file }));
    const reader = new FileReader();
    reader.onload = (e) => setPreviews((p) => ({ ...p, [field]: e.target.result }));
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    const toUpload = Object.entries(files).filter(([, f]) => f);
    if (!toUpload.length) { setErr('Vui lòng chọn ít nhất 1 ảnh'); return; }
    setErr('');
    setUploading(true);
    try {
      const fd = new FormData();
      toUpload.forEach(([k, f]) => fd.append(k, f));
      await api.post(`/cong-nhan/${cn.id}/upload-anh`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      qc.invalidateQueries({ queryKey: ['cong-nhan', String(cn.id)] });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Upload thất bại');
    } finally { setUploading(false); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 540 }}>
        <div style={M.title}>Upload ảnh — {cn.ho_ten}</div>
        <div className="cn-upload-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 14 }}>
          {imageFields.map(({ uploadField, dataField, label }) => (
            <label key={uploadField} style={up.card}>
              {previews[uploadField] ? (
                <img src={previews[uploadField]} alt={label} style={up.preview} />
              ) : cn[dataField] ? (
                <img src={mediaUrl(cn[dataField])} alt={label} style={up.preview} />
              ) : (
                <div style={up.placeholder}>
                  <div style={{ fontSize: 24 }}>📷</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Chọn ảnh</div>
                </div>
              )}
              <div style={up.fieldLabel}>{label}</div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(uploadField, e.target.files[0])} />
            </label>
          ))}
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handleUpload} disabled={uploading}>{uploading ? 'Đang upload...' : 'Lưu ảnh'}</button>
        </div>
      </div>
    </div>
  );
}

const up = {
  card:     { display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', borderRadius: 10, border: '1.5px dashed var(--border2)', padding: 8, gap: 4, overflow: 'hidden' },
  preview:  { width: '100%', height: 100, objectFit: 'cover', borderRadius: 8 },
  placeholder: { width: '100%', height: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', borderRadius: 8 },
  fieldLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center' },
};

// dd/mm/yyyy (từ QR CCCD) → YYYY-MM-DD (định dạng input type="date")
function ddmmyyyyToIso(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
// YYYY-MM-DD → dd/mm/yyyy để hiển thị (không qua Date, tránh lệch múi giờ)
function isoToDisplay(s) {
  if (!s) return '';
  const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(s);
}

// ─── Modal chỉnh sửa ──────────────────────────────────────
function EditModal({ cn, onClose, noiOHienTai, isAdmin }) {
  const capNhat = useCapNhatCongNhan(cn.id);
  const noiOTruyCap = useNoiOTruyCap().data?.data ?? { ktx: [], phong_tro: [] };

  function toInputDate(s) { return s ? s.split('T')[0] : ''; }

  const [form, setForm] = useState({
    ho_ten:           cn.ho_ten ?? '',
    cccd:             cn.cccd   ?? '',
    ngay_sinh:        toInputDate(cn.ngay_sinh),
    gioi_tinh:        cn.gioi_tinh ?? '',
    dia_chi_hien_tai: cn.dia_chi_hien_tai ?? '',
    so_dien_thoai:    cn.so_dien_thoai    ?? '',
    ngay_cap_cccd:    toInputDate(cn.ngay_cap_cccd),
    trang_thai:       cn.trang_thai   ?? 'moi_vao',
    ngay_vao_lam:     toInputDate(cn.ngay_vao_lam),
    ngay_nghi_viec:   toInputDate(cn.ngay_nghi_viec),
    ghi_chu:          cn.ghi_chu ?? '',
    da_tra_dong_phuc: cn.da_tra_dong_phuc ?? false,
    da_viet_don_nghi: cn.da_viet_don_nghi ?? false,
    trang_thai_noi_o: cn.trang_thai_noi_o ?? 'chua_co_phong',
    muon_xe:          cn.muon_xe ?? false,
    loai_xe:          cn.loai_xe ?? '',
    xe_da_tra:        cn.xe_da_tra ?? false,
    ngay_muon_xe:     toInputDate(cn.ngay_muon_xe),
    ma_van_tay:       cn.ma_van_tay ?? '',
    bo_phan:          cn.bo_phan ?? '',
    ktx_id:           noiOHienTai?.ktx?.ktx_id ? String(noiOHienTai.ktx.ktx_id) : '',
    phong_id:         noiOHienTai?.ktx?.phong_id ? String(noiOHienTai.ktx.phong_id) : '',
    giuong_id:        noiOHienTai?.ktx?.giuong_id ? String(noiOHienTai.ktx.giuong_id) : '',
    phong_tro_id:     noiOHienTai?.phong_tro?.phong_tro_id ? String(noiOHienTai.phong_tro.phong_tro_id) : '',
  });
  const { data: phongRes } = usePhongList(form.ktx_id ? parseInt(form.ktx_id, 10) : null);
  const phongList = phongRes?.data ?? [];
  const { data: giuongRes } = useGiuongList(form.phong_id ? parseInt(form.phong_id, 10) : null);
  const giuongList = (giuongRes?.data ?? []).filter((g) => !g.cong_nhan_id || g.cong_nhan_id === cn.id);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Quét QR CCCD: tự điền field còn trống, field khác biệt → cho chọn ghi đè/giữ nguyên
  const [cccdFile, setCccdFile]       = useState(null);
  const [cccdPreview, setCccdPreview] = useState(null);
  const [scanStatus, setScanStatus]   = useState(''); // '' | 'scanning' | 'ok' | 'error'
  const [scanErr, setScanErr]         = useState('');
  const [conflicts, setConflicts]     = useState([]);

  async function handleCccdScan(file) {
    if (!file) return;
    setCccdFile(file);
    setScanErr('');
    const reader = new FileReader();
    reader.onload = (e) => setCccdPreview(e.target.result);
    reader.readAsDataURL(file);

    setScanStatus('scanning');
    let parsed = null;
    try {
      const result = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      parsed = parseCccdQr(result?.data ?? result);
    } catch {
      parsed = null;
    }
    if (!parsed) {
      setConflicts([]);
      setScanStatus('error');
      setScanErr('Không đọc được mã QR CCCD trong ảnh. Ảnh vẫn được lưu khi bấm Lưu — bạn có thể tự nhập thông tin.');
      return;
    }

    // Map field QR → field trong form chỉnh sửa
    const mapping = [
      { key: 'cccd',             qr: parsed.cccd,      label: 'Số CCCD',            isDate: false },
      { key: 'ho_ten',           qr: parsed.ho_ten,    label: 'Họ và tên',          isDate: false },
      { key: 'ngay_sinh',        qr: parsed.ngay_sinh, label: 'Ngày sinh',          isDate: true  },
      { key: 'gioi_tinh',        qr: parsed.gioi_tinh, label: 'Giới tính',          isDate: false },
      { key: 'dia_chi_hien_tai', qr: parsed.dia_chi,   label: 'Địa chỉ thường trú', isDate: false },
      { key: 'ngay_cap_cccd',    qr: parsed.ngay_cap,  label: 'Ngày cấp CCCD',      isDate: true  },
    ];

    const autofill = {};
    const newConflicts = [];
    for (const item of mapping) {
      const qrRaw = (item.qr ?? '').toString().trim();
      if (!qrRaw) continue;
      const qrValue = item.isDate ? ddmmyyyyToIso(qrRaw) : qrRaw;
      if (!qrValue) continue; // ngày QR không hợp lệ → bỏ qua
      const currentVal = (form[item.key] ?? '').toString().trim();
      if (!currentVal) {
        autofill[item.key] = qrValue;                 // điền field còn trống
      } else if (currentVal !== String(qrValue)) {
        newConflicts.push({
          key: item.key,
          label: item.label,
          currentDisplay: item.isDate ? isoToDisplay(currentVal) : currentVal,
          qrDisplay: item.isDate ? qrRaw : qrValue,
          qrValue,
        });
      }
    }
    if (Object.keys(autofill).length) setForm((f) => ({ ...f, ...autofill }));
    setConflicts(newConflicts);
    setScanStatus('ok');
  }

  function resolveConflict(c, overwrite) {
    if (overwrite) setForm((f) => ({ ...f, [c.key]: c.qrValue }));
    setConflicts((cs) => cs.filter((x) => x.key !== c.key));
  }

  function resolveAll(overwrite) {
    if (overwrite) {
      setForm((f) => {
        const next = { ...f };
        conflicts.forEach((c) => { next[c.key] = c.qrValue; });
        return next;
      });
    }
    setConflicts([]);
  }

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: type === 'checkbox' ? checked : value };
      if (name === 'trang_thai_noi_o') {
        next.ktx_id = '';
        next.phong_id = '';
        next.giuong_id = '';
        next.phong_tro_id = '';
      }
      if (name === 'ktx_id') {
        next.phong_id = '';
        next.giuong_id = '';
      }
      if (name === 'phong_id') next.giuong_id = '';
      return next;
    });
  }

  async function handleSave() {
    setErr('');
    setSaving(true);
    try {
      // Lưu ảnh CCCD mặt trước (nếu vừa đính kèm/quét) trước khi cập nhật thông tin
      if (cccdFile) {
        const fd = new FormData();
        fd.append('cccd_mat_truoc', cccdFile);
        await api.post(`/cong-nhan/${cn.id}/upload-anh`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        if (['ktx_id', 'phong_id', 'giuong_id', 'phong_tro_id'].includes(k)) continue;
        payload[k] = v === '' ? null : v;
      }
      const today = new Date().toISOString().split('T')[0];
      const targetNoiO = form.trang_thai_noi_o;
      const hadKtx = !!noiOHienTai?.ktx?.thue_phong_id;
      const hadPhongTro = !!noiOHienTai?.phong_tro?.thue_id;

      if (targetNoiO === 'ktx' || targetNoiO === 'phong_tro') {
        delete payload.trang_thai_noi_o;
      }

      await capNhat.mutateAsync(payload);

      if (hadKtx && targetNoiO !== 'ktx') {
        await api.put(`/ktx/thue-phong/${noiOHienTai.ktx.thue_phong_id}/tra`, { ngay_ra: today });
      }
      if (hadPhongTro && targetNoiO !== 'phong_tro') {
        await api.put(`/phong-tro/thue/${noiOHienTai.phong_tro.thue_id}/tra`, { ngay_ra: today });
      }

      if (targetNoiO === 'ktx') {
        if (!form.giuong_id) throw new Error('Vui lòng chọn cụ thể KTX / phòng / giường');
        const isSameBed = noiOHienTai?.ktx?.giuong_id && String(noiOHienTai.ktx.giuong_id) === String(form.giuong_id);
        if (!isSameBed) {
          if (hadKtx) {
            await api.put(`/ktx/thue-phong/${noiOHienTai.ktx.thue_phong_id}/tra`, { ngay_ra: today });
          }
          await api.post(`/ktx/giuong/${parseInt(form.giuong_id, 10)}/xep`, { cong_nhan_id: cn.id, ngay_vao: today });
        }
      }
      if (targetNoiO === 'phong_tro') {
        if (!form.phong_tro_id) throw new Error('Vui lòng chọn phòng trọ cụ thể');
        const isSamePhongTro = noiOHienTai?.phong_tro?.phong_tro_id && String(noiOHienTai.phong_tro.phong_tro_id) === String(form.phong_tro_id);
        if (!isSamePhongTro) {
          if (hadPhongTro) {
            await api.put(`/phong-tro/thue/${noiOHienTai.phong_tro.thue_id}/tra`, { ngay_ra: today });
          }
          await api.post(`/phong-tro/${parseInt(form.phong_tro_id, 10)}/thue`, { cong_nhan_id: cn.id, ngay_vao: today });
        }
      }

      if (targetNoiO === 'tu_tuc' || targetNoiO === 'chua_co_phong') {
        await capNhat.mutateAsync({ trang_thai_noi_o: targetNoiO });
      }
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? e?.message ?? 'Lỗi không xác định');
    } finally { setSaving(false); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Chỉnh sửa — {cn.ho_ten}</div>

        <div style={m.section}>Quét QR CCCD tự điền</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 6 }}>
          <label style={qr.uploadCard}>
            {cccdPreview ? (
              <img src={cccdPreview} alt="CCCD mặt trước" style={qr.preview} />
            ) : (
              <div style={qr.placeholder}>
                <div style={{ fontSize: 22 }}>🪪</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Thêm ảnh CCCD</div>
              </div>
            )}
            <input type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; handleCccdScan(f); }} />
          </label>
          <div style={{ flex: 1, minWidth: 180, fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
            Thêm ảnh mặt trước CCCD gắn chip — hệ thống tự đọc mã QR, điền các trường còn trống và lưu ảnh vào hồ sơ.
            {scanStatus === 'scanning' && <div style={{ marginTop: 6, color: 'var(--accent)' }}>⏳ Đang đọc mã QR...</div>}
            {scanStatus === 'ok' && (
              <div style={{ marginTop: 6, color: 'var(--green)' }}>
                ✓ Đã đọc QR{conflicts.length ? ' — có thông tin khác biệt, chọn xử lý bên dưới' : ' — đã điền các trường còn trống'}
              </div>
            )}
            {scanStatus === 'error' && <div style={{ marginTop: 6, color: 'var(--red)' }}>{scanErr}</div>}
          </div>
        </div>

        {conflicts.length > 0 && (
          <div style={qr.conflictBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--amber)' }}>Thông tin từ CCCD khác với dữ liệu hiện tại</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => resolveAll(true)}>Ghi đè tất cả</button>
                <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }} onClick={() => resolveAll(false)}>Giữ tất cả</button>
              </div>
            </div>
            {conflicts.map((c) => (
              <div key={c.key} style={qr.conflictRow}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{c.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>Hiện tại: <b style={{ color: 'var(--text1)' }}>{c.currentDisplay || '—'}</b></div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>CCCD: <b style={{ color: 'var(--accent)' }}>{c.qrDisplay}</b></div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" className="btn-primary" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => resolveConflict(c, true)}>Ghi đè</button>
                  <button type="button" className="btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => resolveConflict(c, false)}>Giữ nguyên</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...m.section, marginTop: 14 }}>Thông tin cá nhân</div>
        <div className="cn-edit-grid" style={m.grid}>
          {[['ho_ten','Họ và tên *','text'],['cccd','CCCD','text'],['ngay_sinh','Ngày sinh','date'],['so_dien_thoai','Số điện thoại','text']].map(([name, label, type]) => (
            <div key={name} style={m.fieldWrap}>
              <label className="form-label">{label}</label>
              <input className="form-input" name={name} type={type} value={form[name]} onChange={handleChange} />
            </div>
          ))}
          <div style={m.fieldWrap}>
            <label className="form-label">Giới tính</label>
            <select className="form-input" name="gioi_tinh" value={form.gioi_tinh} onChange={handleChange}>
              <option value="">—</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </div>
          <div style={m.fieldWrap}>
            <label className="form-label">Trạng thái</label>
            <select className="form-input" name="trang_thai" value={form.trang_thai} onChange={handleChange}>
              {Object.entries(TRANG_THAI_PILL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Địa chỉ thường trú</label>
            <input className="form-input" name="dia_chi_hien_tai" value={form.dia_chi_hien_tai} onChange={handleChange} />
          </div>
        </div>

        <div style={{ ...m.section, marginTop: 14 }}>Thông tin CCCD</div>
        <div className="cn-edit-grid" style={m.grid}>
          {[['ngay_cap_cccd','Ngày cấp','date']].map(([name, label, type]) => (
            <div key={name} style={m.fieldWrap}>
              <label className="form-label">{label}</label>
              <input className="form-input" name={name} type={type} value={form[name]} onChange={handleChange} />
            </div>
          ))}
        </div>

        <div style={{ ...m.section, marginTop: 14 }}>Thông tin công việc</div>
        <div className="cn-edit-grid" style={m.grid}>
          {[['ngay_vao_lam','Ngày vào làm','date'],['ngay_nghi_viec','Ngày nghỉ việc','date']].map(([name, label, type]) => (
            <div key={name} style={m.fieldWrap}>
              <label className="form-label">{label}</label>
              <input className="form-input" name={name} type={type} value={form[name]} onChange={handleChange} />
            </div>
          ))}
          <div style={m.fieldWrap}>
            <label className="form-label">Mã vân tay (máy chấm công)</label>
            <input className="form-input" name="ma_van_tay" value={form.ma_van_tay} onChange={handleChange} placeholder="VD: 1024" maxLength={50} />
          </div>
          <div style={m.fieldWrap}>
            <label className="form-label">Bộ phận</label>
            <input className="form-input" name="bo_phan" value={form.bo_phan} onChange={handleChange} placeholder="VD: Tổ 1 / Đóng gói" maxLength={100} />
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Ghi chú</label>
            <textarea className="form-input" name="ghi_chu" value={form.ghi_chu} onChange={handleChange} rows={2} style={{ resize: 'vertical' }} />
          </div>
        </div>

        <div style={{ ...m.section, marginTop: 14 }}>Khấu trừ</div>
        <div style={{ display: 'flex', gap: 20, marginBottom: 4 }}>
          {[['da_tra_dong_phuc','Đã trả đồng phục'],['da_viet_don_nghi','Đã viết đơn nghỉ']].map(([name, label]) => (
            <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text1)', cursor: 'pointer' }}>
              <input type="checkbox" name={name} checked={form[name]} onChange={handleChange} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
              {label}
            </label>
          ))}
        </div>

        <div style={{ ...m.section, marginTop: 14 }}>Trạng thái mượn xe</div>
        <div className="cn-edit-grid" style={m.grid}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text1)', cursor: 'pointer' }}>
            <input type="checkbox" name="muon_xe" checked={form.muon_xe} onChange={handleChange} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} />
            Có mượn xe
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text1)', cursor: 'pointer' }}>
            <input type="checkbox" name="xe_da_tra" checked={form.xe_da_tra} onChange={handleChange} style={{ accentColor: 'var(--accent)', width: 14, height: 14 }} disabled={!form.muon_xe} />
            Đã trả xe
          </label>
          <div style={m.fieldWrap}>
            <label className="form-label">Loại xe</label>
            <select className="form-input" name="loai_xe" value={form.loai_xe} onChange={handleChange} disabled={!form.muon_xe}>
              <option value="">Không mượn xe</option>
              <option value="xe_may">Xe máy</option>
              <option value="xe_dap">Xe đạp</option>
              <option value="xe_dien">Xe đạp điện</option>
            </select>
          </div>
          <div style={m.fieldWrap}>
            <label className="form-label">Ngày mượn xe</label>
            <input className="form-input" type="date" name="ngay_muon_xe" value={form.ngay_muon_xe} onChange={handleChange} disabled={!form.muon_xe} />
          </div>
        </div>

        <div style={{ ...m.section, marginTop: 14 }}>Trạng thái phòng</div>
        <div className="cn-edit-grid" style={m.grid}>
          <div style={m.fieldWrap}>
            <label className="form-label">Tình trạng nơi ở</label>
            <select className="form-input" name="trang_thai_noi_o" value={form.trang_thai_noi_o} onChange={handleChange}>
              <option value="chua_co_phong">Chưa có phòng</option>
              <option value="tu_tuc">Tự túc chỗ ở</option>
              <option value="ktx">Ở KTX</option>
              <option value="phong_tro">Ở nhà trọ</option>
            </select>
          </div>
          {form.trang_thai_noi_o === 'ktx' && (
            <>
              <div style={m.fieldWrap}>
                <label className="form-label">KTX cụ thể</label>
                <select className="form-input" name="ktx_id" value={form.ktx_id} onChange={handleChange} disabled={!isAdmin}>
                  <option value="">— Chọn KTX —</option>
                  {(noiOTruyCap.ktx ?? []).map((k) => <option key={k.id} value={k.id}>{k.ten}</option>)}
                </select>
              </div>
              <div style={m.fieldWrap}>
                <label className="form-label">Phòng</label>
                <select className="form-input" name="phong_id" value={form.phong_id} onChange={handleChange} disabled={!form.ktx_id || !isAdmin}>
                  <option value="">— Chọn phòng —</option>
                  {phongList.map((p) => <option key={p.id} value={p.id}>{p.ten_phong} (Tầng {p.tang})</option>)}
                </select>
              </div>
              <div style={{ ...m.fieldWrap, gridColumn: 'span 2' }}>
                <label className="form-label">Giường</label>
                <select className="form-input" name="giuong_id" value={form.giuong_id} onChange={handleChange} disabled={!form.phong_id || !isAdmin}>
                  <option value="">— Chọn giường —</option>
                  {giuongList.map((g) => <option key={g.id} value={g.id}>Giường {g.so_thu_tu}</option>)}
                </select>
              </div>
            </>
          )}
          {form.trang_thai_noi_o === 'phong_tro' && (
            <div style={{ ...m.fieldWrap, gridColumn: 'span 2' }}>
              <label className="form-label">Phòng trọ cụ thể</label>
              <select className="form-input" name="phong_tro_id" value={form.phong_tro_id} onChange={handleChange}>
                <option value="">— Chọn phòng trọ —</option>
                {(noiOTruyCap.phong_tro ?? []).map((p) => <option key={p.id} value={p.id}>{p.ten}</option>)}
              </select>
            </div>
          )}
        </div>

        {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 10 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────
export default function CongNhanDetail() {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { user, isAdmin, isQuanLy } = useAuth();
  const { data, isLoading, isError } = useCongNhanDetail(id);
  const cn = data?.data;

  const { data: gdRes }    = useGiaoDichCongNhan(cn?.id);
  const { data: ktxRes }   = useLichSuPhong(cn?.id);
  const { data: noiORes }  = useNoiOCongNhan(cn?.id);
  const { data: tongUngRes } = useTongUngCongNhan(cn?.id);
  const _now = new Date();
  const [ccThang, setCcThang] = useState(_now.getMonth() + 1);
  const [ccNam, setCcNam]     = useState(_now.getFullYear());
  const { data: ccRes }    = useChamCongCongNhan(cn?.id, ccThang, ccNam);
  const { data: hdlRes }   = useHoatDongCongNhan(cn?.id);
  const gdList  = gdRes?.data  ?? [];
  const ktxList = ktxRes?.data ?? [];
  const ccPhanCongs = ccRes?.data ?? [];
  const hdlList     = hdlRes?.data ?? [];
  const currentRoom = ktxList.find((k) => !k.ngay_ra) ?? null;
  const noiO       = noiORes?.data ?? {};
  const phongTroNow = noiO?.phong_tro ?? null;
  const tongUng     = tongUngRes?.data ?? { tong_ung: 0, con_no: 0 };

  const [editModal,        setEditModal]        = useState(false);
  const [chuyenKhoanModal, setChuyenKhoanModal] = useState(false);
  const [anhModal,         setAnhModal]         = useState(false);
  const [previewImage, setPreviewImage] = useState(null);
  const [choUngModal, setChoUngModal] = useState(false);
  const [doiCtyModal, setDoiCtyModal] = useState(false);
  const capNhatXe = useCapNhatCongNhan(cn?.id);
  const capNhatCty = useCapNhatCongNhan(cn?.id);
  const capNhatHoan = useCapNhatHoanTien();

  async function handleNghiViec() {
    if (!cn) return;
    if (!window.confirm(
      `Xác nhận chuyển ${cn.ho_ten} sang trạng thái NGHỈ VIỆC?\n\n` +
      `- Công ty hiện tại: ${cn.ten_cong_ty ?? '—'} → bỏ trống\n` +
      `- Ngày nghỉ việc: hôm nay\n` +
      `- Bảng công của công ty cũ sẽ được đóng lại.`
    )) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await capNhatCty.mutateAsync({
        trang_thai: 'nghi_viec',
        cong_ty_id: null,
        ngay_nghi_viec: today,
      });
    } catch (e) {
      alert(e?.response?.data?.error?.message ?? 'Không cập nhật được');
    }
  }

  // Hoàn tiền 1 phần: nhập số tiền hoàn thêm; nếu đã hoàn đủ → hỏi bỏ đánh dấu
  async function handleCapNhatHoan(g) {
    const soTien = Number(g.so_tien ?? 0);
    const daHoan = Number(g.so_tien_da_hoan ?? 0);
    const conLai = Math.max(0, soTien - daHoan);
    try {
      if (conLai <= 0) {
        if (!window.confirm('Khoản này đã hoàn đủ. Bỏ đánh dấu hoàn toàn bộ?')) return;
        await capNhatHoan.mutateAsync({ id: g.id, so_tien_da_hoan: 0 });
        return;
      }
      const input = window.prompt(
        `Nhập số tiền hoàn thêm (còn lại ${conLai.toLocaleString('vi-VN')}đ):`,
        String(conLai),
      );
      if (input == null) return;
      const v = parseFloat(input);
      if (!v || v <= 0 || v > conLai) { alert('Số tiền hoàn không hợp lệ'); return; }
      await capNhatHoan.mutateAsync({ id: g.id, so_tien_da_hoan: daHoan + v });
    } catch (e) {
      alert(e?.response?.data?.error?.message ?? 'Không thể cập nhật hoàn tiền');
    }
  }

  async function toggleXeDaTra(nextValue) {
    try {
      await capNhatXe.mutateAsync({ xe_da_tra: nextValue });
    } catch (e) {
      alert(e?.response?.data?.error?.message ?? 'Không thể cập nhật trạng thái xe');
    }
  }

  if (isLoading) return <div style={s.center}>Đang tải...</div>;
  if (isError || !cn) return (
    <div style={s.center}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
      <div style={{ color: 'var(--text1)', fontSize: 15, fontWeight: 600 }}>Không tìm thấy công nhân</div>
      <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate('/cong-nhan')}>← Quay lại</button>
    </div>
  );

  const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
  const canEdit = isAdmin || isQuanLy;

  // Quyền xem 3 thông tin cá nhân (mượn xe / nơi ở / tổng tạm ứng):
  // chỉ admin hoặc người tuyển CN — quản lý cty mà không phải người tuyển KHÔNG xem được.
  const isRecruiter = !!user && cn?.nguoi_tuyen_id === user.id;
  const canViewPrivate = user?.vai_tro === 'admin' || isRecruiter;

  // Quyền sửa cty / nghỉ việc: admin, QL với CN trong cty mình, vender/CTV với CN mình tuyển
  const canDoiCty = (() => {
    if (!user || !cn) return false;
    if (user.vai_tro === 'admin') return true;
    if (user.vai_tro === 'quan_ly') {
      return Array.isArray(user.cong_ty_ids) && user.cong_ty_ids.includes(cn.cong_ty_id);
    }
    if (user.vai_tro === 'vender' || user.vai_tro === 'cong_tac_vien') {
      return cn.nguoi_tuyen_id === user.id;
    }
    return false;
  })();

  // Quyền cho ứng (tạm ứng):
  // - admin   : luôn được
  // - quan_ly : CN thuộc công ty mình quản lý
  // - vender / cong_tac_vien : CN do mình tuyển
  const canChoUng = (() => {
    if (!user || !cn) return false;
    if (user.vai_tro === 'admin') return true;
    if (user.vai_tro === 'quan_ly') {
      return Array.isArray(user.cong_ty_ids) && user.cong_ty_ids.includes(cn.cong_ty_id);
    }
    if (user.vai_tro === 'vender' || user.vai_tro === 'cong_tac_vien') {
      return cn.nguoi_tuyen_id === user.id;
    }
    return false;
  })();

  const daNghi = cn.trang_thai === 'nghi_viec' || !!cn.ngay_nghi_viec;
  const khauTruDongPhuc = daNghi && !cn.da_tra_dong_phuc ? Number(cn.tien_dong_phuc ?? 0) : 0;
  const khauTruPhat     = daNghi && !cn.da_viet_don_nghi  ? Number(cn.tien_phat_nghi ?? 0) : 0;
  const tongKhauTru     = khauTruDongPhuc + khauTruPhat;

  return (
    <div className="cn-detail-root" style={s.root}>
      {/* Breadcrumb */}
      <div style={s.breadcrumb}>
        <button style={s.back} onClick={() => navigate('/cong-nhan')}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline points="15 18 9 12 15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Công nhân
        </button>
        <span style={s.sep}>/</span>
        <span style={s.current}>{cn.ho_ten}</span>
      </div>

      {/* Profile header */}
      <div className="cn-profile-card" style={s.profileCard}>
        {/* Avatar / ảnh chân dung */}
        <div style={s.profileAvatar}>
          {cn.anh_chan_dung ? (
            <img src={mediaUrl(cn.anh_chan_dung)} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
          ) : (
            <span>{cn.ho_ten?.[0] ?? '?'}</span>
          )}
        </div>
        <div className="cn-profile-info" style={s.profileInfo}>
          <div className="cn-profile-name" style={s.profileName}>{cn.ho_ten}</div>
          <div className="cn-profile-meta" style={s.profileMeta}>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text2)' }}>ID #{cn.id}</span>
            <span className={`pill ${pill.cls}`} style={{ marginLeft: 10 }}>{pill.label}</span>
            {cn.ten_cong_ty && <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text2)' }}>🏭 {cn.ten_cong_ty}</span>}
            {Number(tongUng.con_no) > 0 && (
              <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--amber)', fontFamily: "'JetBrains Mono', monospace" }}>
                💰 Còn nợ ứng: {fmt(tongUng.con_no)}
              </span>
            )}
            {(currentRoom || phongTroNow) && (
              <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--text2)' }}>
                🏠 {currentRoom
                  ? `${currentRoom.ktx_ten} / ${currentRoom.ten_phong} - G.${currentRoom.so_thu_tu}`
                  : `${phongTroNow.ten}${phongTroNow.dia_chi ? ` (${phongTroNow.dia_chi})` : ''}`}
              </span>
            )}
          </div>
        </div>
        <div className="cn-profile-actions" style={s.profileActions}>
          {canEdit && (
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setAnhModal(true)}>📷 Ảnh</button>
          )}
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setChuyenKhoanModal(true)}>💳 Chuyển khoản</button>
          {canEdit && (
            <button className="btn-ghost" onClick={() => setEditModal(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Chỉnh sửa
            </button>
          )}
        </div>
      </div>

      {/* Ảnh CCCD */}
      {(cn.anh_cccd_truoc || cn.anh_cccd_sau || cn.anh_chan_dung || cn.anh_xe) && (
        <div style={s.card}>
          <div style={s.cardTitle}>Ảnh đính kèm</div>
          <div className="cn-attachment-grid" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[['anh_cccd_truoc','CCCD mặt trước'],['anh_cccd_sau','CCCD mặt sau'],['anh_chan_dung','Ảnh chân dung'],['anh_xe','Ảnh xe mượn']].map(([field, label]) =>
              cn[field] ? (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <img
                    src={mediaUrl(cn[field])}
                    alt={label}
                    style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)', cursor: 'zoom-in' }}
                    onClick={() => setPreviewImage({ src: mediaUrl(cn[field]), label })}
                  />
                  <div style={{ fontSize: 10, color: 'var(--text3)', textAlign: 'center' }}>{label}</div>
                </div>
              ) : null
            )}
          </div>
        </div>
      )}

      <div className="cn-detail-grid" style={s.grid}>
        {/* Thông tin cá nhân */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Thông tin cá nhân</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Họ và tên" value={cn.ho_ten} />
            <Field label="CCCD" value={cn.cccd} />
            <Field label="Ngày sinh" value={cn.ngay_sinh ? new Date(cn.ngay_sinh).toLocaleDateString('vi-VN') : null} />
            <Field label="Giới tính" value={cn.gioi_tinh} />
            <Field label="Số điện thoại" value={cn.so_dien_thoai} />
            <Field label="Địa chỉ thường trú" value={cn.dia_chi_hien_tai} />
          </div>
        </div>

        {/* Thông tin CCCD */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Thông tin CCCD</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Số CCCD" value={cn.cccd} />
            <Field label="Ngày cấp" value={cn.ngay_cap_cccd ? new Date(cn.ngay_cap_cccd).toLocaleDateString('vi-VN') : null} />
          </div>
        </div>

        {/* Thông tin công việc */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Thông tin công việc</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Trạng thái" value={pill.label} />
            <Field label="Công ty">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span>{cn.ten_cong_ty ?? '—'}</span>
                {canDoiCty && cn.trang_thai !== 'nghi_viec' && (
                  <>
                    <button onClick={() => setDoiCtyModal(true)}
                      style={{ background: 'var(--bg3)', border: '1px solid var(--border2)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--text2)',
                        cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                      ✏️ Đổi
                    </button>
                    <button onClick={handleNghiViec} disabled={capNhatCty.isPending}
                      style={{ background: 'rgba(255,95,114,0.12)', border: '1px solid rgba(255,95,114,0.4)',
                        borderRadius: 6, padding: '3px 8px', fontSize: 11, color: 'var(--red)',
                        cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" }}>
                      🚪 Nghỉ việc
                    </button>
                  </>
                )}
              </div>
            </Field>
            <Field label="Ngày vào làm" value={cn.ngay_vao_lam ? new Date(cn.ngay_vao_lam).toLocaleDateString('vi-VN') : null} />
            <Field label="Ngày nghỉ việc" value={cn.ngay_nghi_viec ? new Date(cn.ngay_nghi_viec).toLocaleDateString('vi-VN') : null} />
            <Field label="Người tuyển" value={cn.nguoi_tuyen_ho_ten} />
            <Field label="Mã vân tay" value={cn.ma_van_tay} />
            <Field label="Bộ phận" value={cn.bo_phan} />
            <Field label="Ghi chú" value={cn.ghi_chu} />
          </div>
        </div>

        {canViewPrivate && (
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Mượn xe</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Trạng thái mượn xe" value={cn.muon_xe ? 'Đang mượn' : 'Không mượn xe'} />
            <Field label="Loại xe" value={cn.muon_xe ? (LOAI_XE_LABEL[cn.loai_xe] ?? '—') : '—'} />
            <Field label="Ngày mượn xe" value={cn.ngay_muon_xe ? new Date(cn.ngay_muon_xe).toLocaleDateString('vi-VN') : '—'} />
            <Field label="Trả xe">
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: canEdit ? 'pointer' : 'default' }}>
                <input
                  type="checkbox"
                  checked={!!cn.xe_da_tra}
                  disabled={!canEdit || !cn.muon_xe || capNhatXe.isPending}
                  onChange={(e) => toggleXeDaTra(e.target.checked)}
                  style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 13, color: !cn.muon_xe ? 'var(--text3)' : (cn.xe_da_tra ? 'var(--green)' : 'var(--amber)'), fontWeight: 600 }}>
                  {!cn.muon_xe ? '—' : (cn.xe_da_tra ? 'Đã trả xe' : 'Chưa trả xe')}
                </span>
              </label>
            </Field>
          </div>
        </div>
        )}

        {/* Khấu trừ */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Khấu trừ tự động (chỉ áp dụng khi đã nghỉ)</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Đồng phục">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: cn.da_tra_dong_phuc ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                  {cn.da_tra_dong_phuc ? '✓ Đã trả' : `Chưa trả — ${fmt(cn.tien_dong_phuc ?? 0)}`}
                </span>
              </div>
            </Field>
            <Field label="Đơn nghỉ">
              <span style={{ fontSize: 13, color: cn.da_viet_don_nghi ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
                {cn.da_viet_don_nghi ? '✓ Đã viết' : `Chưa viết — ${fmt(cn.tien_phat_nghi ?? 0)}`}
              </span>
            </Field>
          </div>
          {!daNghi && (
            <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text3)' }}>
              Công nhân chưa nghỉ việc nên chưa áp dụng khấu trừ.
            </div>
          )}
          {tongKhauTru > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,95,114,0.08)', borderRadius: 8, border: '1px solid rgba(255,95,114,0.2)', fontSize: 13, color: 'var(--red)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              Tổng khấu trừ: -{fmt(tongKhauTru)}
            </div>
          )}
        </div>

        {/* Nơi ở: KTX hoặc Phòng trọ — chỉ admin / người tuyển xem */}
        {canViewPrivate && (
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Nơi ở hiện tại</div>
          <div style={{ marginBottom: 10 }}>
            <span className="pill pill-blue">{TRANG_THAI_NOI_O_LABEL[cn.trang_thai_noi_o] ?? 'Chưa có phòng'}</span>
          </div>
          {currentRoom ? (
            <div className="cn-detail-fields" style={s.fields}>
              <Field label="Loại" value="🏠 Ký túc xá" />
              <Field label="Khu" value={currentRoom.ktx_ten} />
              <Field label="Phòng" value={currentRoom.ten_phong} />
              <Field label="Giường số" value={currentRoom.so_thu_tu} />
              <Field label="Ngày vào" value={currentRoom.ngay_vao ? new Date(currentRoom.ngay_vao).toLocaleDateString('vi-VN') : null} />
              <Field label="Ngày ra">
                <span style={{ fontSize: 13, color: currentRoom.ngay_ra ? 'var(--text1)' : 'var(--green)', fontWeight: 500 }}>
                  {currentRoom.ngay_ra ? new Date(currentRoom.ngay_ra).toLocaleDateString('vi-VN') : 'Đang ở'}
                </span>
              </Field>
            </div>
          ) : phongTroNow ? (
            <div className="cn-detail-fields" style={s.fields}>
              <Field label="Loại" value="🏘️ Phòng trọ" />
              <Field label="Tên phòng trọ" value={phongTroNow.ten} />
              <Field label="Địa chỉ" value={phongTroNow.dia_chi} />
              <Field label="Chủ trọ" value={phongTroNow.chu_tro} />
              <Field label="SĐT chủ trọ" value={phongTroNow.sdt_chu_tro} />
              <Field label="Ngày vào" value={phongTroNow.ngay_vao ? new Date(phongTroNow.ngay_vao).toLocaleDateString('vi-VN') : null} />
              <Field label="Ngày ra">
                <span style={{ fontSize: 13, color: phongTroNow.ngay_ra ? 'var(--text1)' : 'var(--green)', fontWeight: 500 }}>
                  {phongTroNow.ngay_ra ? new Date(phongTroNow.ngay_ra).toLocaleDateString('vi-VN') : 'Đang ở'}
                </span>
              </Field>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Chưa được xếp phòng / phòng trọ</div>
          )}
          {ktxList.length > 1 && (
            <details style={{ marginTop: 12 }}>
              <summary style={{ fontSize: 11, color: 'var(--text3)', cursor: 'pointer' }}>Lịch sử phòng ({ktxList.length})</summary>
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {ktxList.map((k) => (
                  <div key={k.id} style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 8 }}>
                    <span>{k.ktx_ten} / {k.ten_phong} - G.{k.so_thu_tu}</span>
                    <span style={{ color: 'var(--text3)' }}>
                      {new Date(k.ngay_vao).toLocaleDateString('vi-VN')} →
                      {k.ngay_ra ? new Date(k.ngay_ra).toLocaleDateString('vi-VN') : 'nay'}
                    </span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
        )}

        {/* Tổng tạm ứng — chỉ admin / người tuyển xem */}
        {canViewPrivate && (
        <div className="cn-detail-card" style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={s.cardTitle}>Tạm ứng</div>
            {canChoUng && (
              <button className="btn-primary" onClick={() => setChoUngModal(true)}
                style={{ padding: '6px 12px', fontSize: 12 }}>
                + Cho ứng
              </button>
            )}
          </div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Tổng đã ứng">
              <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--amber)', fontFamily: "'JetBrains Mono', monospace" }}>{fmt(tongUng.tong_ung)}</span>
            </Field>
            <Field label="Còn nợ (chưa hoàn)">
              <span style={{ fontSize: 16, fontWeight: 700, color: Number(tongUng.con_no) > 0 ? 'var(--red)' : 'var(--green)', fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt(tongUng.con_no)}
              </span>
            </Field>
            <Field label="Đã hoàn">
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--green)', fontFamily: "'JetBrains Mono', monospace" }}>
                {fmt(Number(tongUng.tong_ung || 0) - Number(tongUng.con_no || 0))}
              </span>
            </Field>
          </div>
        </div>
        )}

        {/* Lịch sử tài chính */}
        <div className="cn-detail-card cn-history-card" style={{ ...s.card, gridColumn: 'span 2' }}>
          <div style={s.cardTitle}>Lịch sử thu/chi ({gdList.length})</div>
          {gdList.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic' }}>Chưa có giao dịch nào</div>
          ) : (
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>
                  {['Loại','Số tiền','Ngày','Ghi chú','Trạng thái'].map((h) => (
                    <th key={h} style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 10px 8px 0', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {gdList.map((g) => {
                    const info = LOAI_LABEL[g.loai];
                    const isThu = ['luong','thuong','phu_cap','hoan_ung'].includes(g.loai);
                    return (
                      <tr key={g.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px 10px 8px 0', verticalAlign: 'middle' }}>
                          <span className="pill" style={{ background: (info?.color ?? 'var(--text3)') + '1a', color: info?.color, fontSize: 11 }}>{info?.label ?? g.loai}</span>
                        </td>
                        <td style={{ padding: '8px 10px 8px 0', fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: isThu ? 'var(--green)' : 'var(--red)' }}>
                          {isThu ? '+' : '-'}{Number(g.so_tien).toLocaleString('vi-VN')}đ
                        </td>
                        <td style={{ padding: '8px 10px 8px 0', fontSize: 12, color: 'var(--text2)' }}>{g.ngay ? new Date(g.ngay).toLocaleDateString('vi-VN') : '—'}</td>
                        <td style={{ padding: '8px 10px 8px 0', fontSize: 12, color: 'var(--text2)' }}>{g.ghi_chu ?? '—'}</td>
                        <td style={{ padding: '8px 10px 8px 0' }}>
                          {!isThu && (() => {
                            const daHoanG = Number(g.so_tien_da_hoan ?? 0);
                            const hoanLabel = g.da_hoan_tien
                              ? `✓ Hoàn đủ ${g.ngay_hoan ? new Date(g.ngay_hoan).toLocaleDateString('vi-VN') : ''}`
                              : daHoanG > 0
                                ? `↩ ${daHoanG.toLocaleString('vi-VN')}/${Number(g.so_tien).toLocaleString('vi-VN')}đ`
                                : 'Chưa hoàn';
                            return canEdit ? (
                              <button
                                onClick={() => handleCapNhatHoan(g)}
                                disabled={capNhatHoan.isPending}
                                title={g.da_hoan_tien
                                  ? 'Đã hoàn đủ — bấm để sửa'
                                  : 'Bấm để cập nhật số tiền đã hoàn (cho phép hoàn 1 phần)'}
                                style={{
                                  background: g.da_hoan_tien ? 'rgba(34,201,134,0.12)' : 'transparent',
                                  border: `1px solid ${g.da_hoan_tien ? 'var(--green)' : daHoanG > 0 ? 'var(--amber)' : 'var(--border2)'}`,
                                  borderRadius: 6, padding: '3px 8px', fontSize: 11,
                                  color: g.da_hoan_tien ? 'var(--green)' : daHoanG > 0 ? 'var(--amber)' : 'var(--text2)',
                                  cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif",
                                }}
                              >
                                {g.da_hoan_tien ? hoanLabel : daHoanG > 0 ? hoanLabel : 'Hoàn tiền'}
                              </button>
                            ) : (
                              <span style={{ fontSize: 11, color: g.da_hoan_tien ? 'var(--green)' : daHoanG > 0 ? 'var(--amber)' : 'var(--text3)' }}>
                                {hoanLabel}
                              </span>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Bảng chấm công — 1 section per phan_cong nếu CN từng chuyển công ty */}
        <div className="cn-detail-card" style={{ ...s.card, gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>
              Bảng chấm công {ccThang}/{ccNam}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <select className="form-input" style={{ padding: '4px 8px', fontSize: 12 }}
                value={ccThang} onChange={(e) => setCcThang(Number(e.target.value))}>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map((m) => <option key={m} value={m}>T{m}</option>)}
              </select>
              <select className="form-input" style={{ padding: '4px 8px', fontSize: 12 }}
                value={ccNam} onChange={(e) => setCcNam(Number(e.target.value))}>
                {[ccNam - 1, ccNam, ccNam + 1].map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>
          {ccPhanCongs.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>
              Chưa có phân công trong tháng {ccThang}/{ccNam}
            </div>
          ) : (
            ccPhanCongs.map((pc) => {
              const days = new Date(ccNam, ccThang, 0).getDate();
              // Dựng cell chuẩn (4 loại giờ) từ bản ghi server để hiển thị giống bảng công chuẩn
              const cellMap = {};
              let tongGio = 0, tongNgay = 0, tongPhep = 0;
              for (const c of (pc.cham_cong || [])) {
                // Lấy ngày từ phần 'YYYY-MM-DD' (BE trả text) — không parse qua Date để
                // tránh lệch múi giờ. c.ngay có thể là 'YYYY-MM-DD' hoặc ISO đầy đủ.
                const d = Number(String(c.ngay).slice(0, 10).slice(8, 10));
                const cell = cellFromServer(c);
                if (!cell) continue;
                cellMap[d] = cell;
                const g = totalGio(cell);
                tongGio += g;
                if (cell.ca_lam === 'nghi_phep') tongPhep++;
                else if (g > 0) tongNgay++;
              }
              return (
                <div key={pc.id} style={{ marginBottom: 14, border: '1px solid var(--border)', borderRadius: 10, padding: 10, background: 'var(--bg2)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <b style={{ color: 'var(--text1)', fontSize: 13 }}>🏭 {pc.ten_cong_ty || '—'}</b>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        Từ {new Date(pc.ngay_bat_dau).toLocaleDateString('vi-VN')}
                        {pc.ngay_ket_thuc ? ` → ${new Date(pc.ngay_ket_thuc).toLocaleDateString('vi-VN')}` : ' → nay'}
                      </div>
                    </div>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: 'var(--text2)' }}>
                      {tongNgay} ngày{tongPhep ? ` · ${tongPhep}P` : ''} · {tongGio.toFixed(1)}h
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(42px, 1fr))', gap: 3 }}>
                    {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
                      const cell = cellMap[d];
                      const dow = new Date(ccNam, ccThang - 1, d).getDay();
                      const col = cellColor(cell);
                      const label = summarize(cell) || '—';
                      return (
                        <div key={d} title={`${d}/${ccThang} (${WEEKDAYS_LBL[dow]}) · ${detailText(cell)}`}
                          style={{
                            background: cell ? col.bg : 'var(--bg3)', color: cell ? col.color : 'var(--text3)',
                            borderRadius: 4, padding: '4px 0', textAlign: 'center',
                            fontSize: 10, fontFamily: "'JetBrains Mono', monospace",
                            border: dow === 0 ? '1px dashed rgba(255,95,114,0.3)' : '1px solid transparent',
                          }}>
                          <div style={{ fontSize: 9, opacity: 0.55 }}>{d}</div>
                          <div>{label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
          {canEdit && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
              Để sửa: vào trang <a href="/cham-cong" style={{ color: 'var(--accent)' }}>Chấm công</a> hoặc nhập trực tiếp tại đây sau khi mở quyền edit (tính năng đang phát triển).
            </div>
          )}
        </div>

        {/* Hệ thống — timeline + audit */}
        <div className="cn-detail-card" style={{ ...s.card, gridColumn: 'span 2' }}>
          <div style={s.cardTitle}>Hệ thống</div>
          <div className="cn-detail-fields" style={{ ...s.fields, marginBottom: 14 }}>
            <Field label="Ngày tạo" value={new Date(cn.created_at).toLocaleString('vi-VN')} />
            <Field label="Cập nhật" value={new Date(cn.updated_at).toLocaleString('vi-VN')} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Timeline hoạt động
          </div>
          {hdlList.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Chưa có hoạt động nào được ghi nhận.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflowY: 'auto' }}>
              {hdlList.map((h) => (
                <div key={h.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 10px', background: 'var(--bg2)', borderRadius: 8, border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 16 }}>{HDL_ICON[h.loai] ?? '📌'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: 'var(--text1)' }}>{h.ghi_chu || HDL_LABEL[h.loai] || h.loai}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>
                      {h.created_by_ten ? `${h.created_by_ten} · ` : ''}{new Date(h.created_at).toLocaleString('vi-VN')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {editModal        && <EditModal          cn={cn} noiOHienTai={noiO} isAdmin={isAdmin} onClose={() => setEditModal(false)} />}
      {chuyenKhoanModal && <ChuyenKhoanModal   cn={cn} onClose={() => setChuyenKhoanModal(false)} />}
      {anhModal         && <UploadAnhModal      cn={cn} onClose={() => setAnhModal(false)} />}
      {choUngModal      && <ChoUngModal         cn={cn} onClose={() => setChoUngModal(false)} />}
      {doiCtyModal      && <DoiCongTyModal      cn={cn} onClose={() => setDoiCtyModal(false)} />}
      {previewImage && (
        <ImageViewer
          src={previewImage.src}
          label={previewImage.label}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

function DoiCongTyModal({ cn, onClose }) {
  const capNhat = useCapNhatCongNhan(cn.id);
  const ctyQuery = useCongTyList();
  const ctys = ctyQuery.data?.data ?? [];
  const [newCtyId, setNewCtyId] = useState('');
  const [err, setErr] = useState('');

  async function submit() {
    setErr('');
    if (!newCtyId) { setErr('Chọn công ty mới'); return; }
    if (Number(newCtyId) === cn.cong_ty_id) { setErr('Vui lòng chọn công ty khác'); return; }

    const newCtyName = ctys.find((c) => c.id === Number(newCtyId))?.ten_cong_ty ?? `#${newCtyId}`;
    if (!window.confirm(
      `Xác nhận chuyển ${cn.ho_ten} sang công ty "${newCtyName}"?\n\n` +
      `- Công ty cũ "${cn.ten_cong_ty ?? '—'}" sẽ được đóng (kết thúc bảng công).\n` +
      `- Bảng công mới bắt đầu từ hôm nay tại "${newCtyName}".\n` +
      `- Hành động này được ghi vào log hoạt động.`
    )) return;
    try {
      await capNhat.mutateAsync({ cong_ty_id: Number(newCtyId) });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Không cập nhật được');
    }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>Đổi công ty — {cn.ho_ten}</div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
          Công ty hiện tại: <b>{cn.ten_cong_ty ?? '— chưa có —'}</b>
        </div>
        <label className="form-label">Công ty mới *</label>
        <select className="form-input" value={newCtyId} onChange={(e) => setNewCtyId(e.target.value)}>
          <option value="">— Chọn công ty —</option>
          {ctys.map((c) => (
            <option key={c.id} value={c.id} disabled={c.id === cn.cong_ty_id}>
              {c.ten_cong_ty}{c.id === cn.cong_ty_id ? ' (đang làm)' : ''}
            </option>
          ))}
        </select>
        {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn-ghost"   onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={submit} disabled={capNhat.isPending || !newCtyId}>
            {capNhat.isPending ? 'Đang chuyển...' : 'Xác nhận chuyển'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ChoUngModal({ cn, onClose }) {
  const tao = useTaoGiaoDich();
  const [soTien, setSoTien] = useState('');
  const [ngay, setNgay]     = useState(new Date().toISOString().slice(0, 10));
  const [ghiChu, setGhiChu] = useState('');
  const [err, setErr]       = useState('');

  async function submit() {
    setErr('');
    const n = Number(soTien);
    if (!Number.isFinite(n) || n <= 0) { setErr('Số tiền phải > 0'); return; }
    try {
      await tao.mutateAsync({
        cong_nhan_id: cn.id,
        loai: 'tam_ung',
        so_tien: n,
        ngay,
        ghi_chu: ghiChu || undefined,
      });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Không tạo được giao dịch');
    }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text1)' }}>
            Cho ứng — {cn.ho_ten}
          </div>
          <button onClick={onClose}
            style={{ background: 'transparent', border: 'none', fontSize: 22, color: 'var(--text2)', cursor: 'pointer' }}>×</button>
        </div>
        <div style={{ display: 'grid', gap: 10 }}>
          <label className="form-label">Số tiền (VNĐ) *</label>
          <input className="form-input" type="number" autoFocus value={soTien}
            onChange={(e) => setSoTien(e.target.value)} placeholder="500000" />
          <label className="form-label">Ngày ứng</label>
          <input className="form-input" type="date" value={ngay} onChange={(e) => setNgay(e.target.value)} />
          <label className="form-label">Ghi chú</label>
          <input className="form-input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)}
            placeholder="Vd: ứng tiền xăng" />
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button className="btn-ghost"   onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={submit} disabled={tao.isPending}>
            {tao.isPending ? 'Đang lưu...' : 'Cho ứng'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ImageViewer({ src, label, onClose }) {
  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 860, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' }}>{label}</div>
          <button className="btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }} onClick={onClose}>Đóng</button>
        </div>
        <img src={src} alt={label} style={{ width: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)' }} />
      </div>
    </div>
  );
}

const s = {
  root:   { display: 'flex', flexDirection: 'column', gap: 16 },
  center: { padding: '80px 24px', textAlign: 'center', color: 'var(--text2)' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8 },
  back: { display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', fontSize: 13, fontFamily: "'Be Vietnam Pro', sans-serif", padding: 0 },
  sep:  { color: 'var(--text3)', fontSize: 13 },
  current: { fontSize: 13, color: 'var(--text1)', fontWeight: 600 },
  profileCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 },
  profileAvatar: { width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0, overflow: 'hidden' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: 700, color: 'var(--text1)' },
  profileMeta: { display: 'flex', alignItems: 'center', marginTop: 4, flexWrap: 'wrap', gap: 4 },
  profileActions: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  grid: { gap: 14 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  fields: { gap: 16 },
};

const M = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:   { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  title:   { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 16 },
  err:     { color: 'var(--red)', fontSize: 12, marginBottom: 8 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
};

const m = {
  section: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  grid:    { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' },
  fieldWrap: { display: 'flex', flexDirection: 'column', gap: 4 },
};

const qr = {
  uploadCard:  { width: 120, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', cursor: 'pointer', borderRadius: 10, border: '1.5px dashed var(--border2)', padding: 8, gap: 4, overflow: 'hidden' },
  preview:     { width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 },
  placeholder: { width: '100%', height: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', borderRadius: 8 },
  conflictBox: { background: 'rgba(255,179,68,0.08)', border: '1px solid rgba(255,179,68,0.3)', borderRadius: 10, padding: '10px 12px', marginBottom: 4 },
  conflictRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: '1px solid var(--border)' },
};
