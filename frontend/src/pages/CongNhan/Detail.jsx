import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCongNhanDetail, useCapNhatCongNhan, useNoiOCongNhan, useTongUngCongNhan } from '../../hooks/useCongNhan';
import { useGiaoDichCongNhan, useTaoGiaoDich } from '../../hooks/useTaiChinh';
import { useLichSuPhong } from '../../hooks/useKtx';
import { useAuth } from '../../context/AuthContext';
import ProvinceSelect from '../../components/ProvinceSelect';
import api from '../../hooks/useApi';
import { useQueryClient } from '@tanstack/react-query';

const TRANG_THAI_PILL = {
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

// ─── Modal tạm ứng ────────────────────────────────────────
function TamUngModal({ cn, onClose }) {
  const tao = useTaoGiaoDich();
  const [form, setForm] = useState({ so_tien: '', ghi_chu: '', ngay: new Date().toISOString().split('T')[0] });
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    if (!form.so_tien || parseFloat(form.so_tien) <= 0) { setErr('Nhập số tiền hợp lệ'); return; }
    try {
      await tao.mutateAsync({
        cong_nhan_id: cn.id,
        loai: 'tam_ung',
        so_tien: parseFloat(form.so_tien),
        ngay: form.ngay,
        ghi_chu: form.ghi_chu || undefined,
      });
      onClose();
    } catch (e) { setErr(e?.response?.data?.error?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Cho ứng — {cn.ho_ten}</div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Số tiền *</label>
          <input className="form-input" type="number" placeholder="500000" value={form.so_tien} onChange={(e) => setForm((f) => ({ ...f, so_tien: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Ngày</label>
          <input className="form-input" type="date" value={form.ngay} onChange={(e) => setForm((f) => ({ ...f, ngay: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Nội dung</label>
          <input className="form-input" placeholder="Ứng tiền ăn, đi lại..." value={form.ghi_chu} onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))} />
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Xác nhận ứng'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal upload ảnh ─────────────────────────────────────
function UploadAnhModal({ cn, onClose }) {
  const qc = useQueryClient();
  const [files, setFiles] = useState({ cccd_mat_truoc: null, cccd_mat_sau: null, anh_chan_dung: null });
  const [previews, setPreviews] = useState({});
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const labels = {
    cccd_mat_truoc: 'CCCD mặt trước',
    cccd_mat_sau:   'CCCD mặt sau',
    anh_chan_dung:  'Ảnh chân dung',
  };

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
          {Object.keys(labels).map((field) => (
            <label key={field} style={up.card}>
              {previews[field] ? (
                <img src={previews[field]} alt={labels[field]} style={up.preview} />
              ) : cn[field] ? (
                <img src={mediaUrl(cn[field])} alt={labels[field]} style={up.preview} />
              ) : (
                <div style={up.placeholder}>
                  <div style={{ fontSize: 24 }}>📷</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Chọn ảnh</div>
                </div>
              )}
              <div style={up.fieldLabel}>{labels[field]}</div>
              <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => handleFile(field, e.target.files[0])} />
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

// ─── Modal chỉnh sửa ──────────────────────────────────────
function EditModal({ cn, onClose }) {
  const capNhat = useCapNhatCongNhan(cn.id);

  function toInputDate(s) { return s ? s.split('T')[0] : ''; }

  const [form, setForm] = useState({
    ho_ten:           cn.ho_ten ?? '',
    cccd:             cn.cccd   ?? '',
    ngay_sinh:        toInputDate(cn.ngay_sinh),
    gioi_tinh:        cn.gioi_tinh ?? '',
    que_quan:         cn.que_quan  ?? '',
    dia_chi_hien_tai: cn.dia_chi_hien_tai ?? '',
    so_dien_thoai:    cn.so_dien_thoai    ?? '',
    ngay_cap_cccd:    toInputDate(cn.ngay_cap_cccd),
    noi_cap_cccd:     cn.noi_cap_cccd ?? '',
    trang_thai:       cn.trang_thai   ?? 'moi_vao',
    ngay_vao_lam:     toInputDate(cn.ngay_vao_lam),
    ngay_nghi_viec:   toInputDate(cn.ngay_nghi_viec),
    ghi_chu:          cn.ghi_chu ?? '',
    da_tra_dong_phuc: cn.da_tra_dong_phuc ?? false,
    da_viet_don_nghi: cn.da_viet_don_nghi ?? false,
  });
  const [showProvinceSelect, setShowProvinceSelect] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  }

  async function handleSave() {
    setErr('');
    setSaving(true);
    try {
      const payload = {};
      for (const [k, v] of Object.entries(form)) {
        payload[k] = v === '' ? null : v;
      }
      await capNhat.mutateAsync(payload);
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Lỗi không xác định');
    } finally { setSaving(false); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Chỉnh sửa — {cn.ho_ten}</div>

        <div style={m.section}>Thông tin cá nhân</div>
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
          {/* Quê quán với province select */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Quê quán</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input className="form-input" style={{ flex: 1 }} value={form.que_quan} onChange={handleChange} name="que_quan" placeholder="Nhập thủ công hoặc chọn bên phải" />
              <button type="button" className="btn-ghost" style={{ whiteSpace: 'nowrap', fontSize: 12, padding: '6px 10px' }} onClick={() => setShowProvinceSelect(!showProvinceSelect)}>
                {showProvinceSelect ? '✕' : '🗺 Chọn'}
              </button>
            </div>
            {showProvinceSelect && (
              <div style={{ marginTop: 6 }}>
                <ProvinceSelect onChange={(val) => { setForm((f) => ({ ...f, que_quan: val })); setShowProvinceSelect(false); }} />
              </div>
            )}
          </div>
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Địa chỉ hiện tại</label>
            <input className="form-input" name="dia_chi_hien_tai" value={form.dia_chi_hien_tai} onChange={handleChange} />
          </div>
        </div>

        <div style={{ ...m.section, marginTop: 14 }}>Thông tin CCCD</div>
        <div className="cn-edit-grid" style={m.grid}>
          {[['ngay_cap_cccd','Ngày cấp','date'],['noi_cap_cccd','Nơi cấp','text']].map(([name, label, type]) => (
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
  const { isAdmin, isQuanLy } = useAuth();
  const { data, isLoading, isError } = useCongNhanDetail(id);
  const cn = data?.data;

  const { data: gdRes }    = useGiaoDichCongNhan(cn?.id);
  const { data: ktxRes }   = useLichSuPhong(cn?.id);
  const { data: noiORes }  = useNoiOCongNhan(cn?.id);
  const { data: tongUngRes } = useTongUngCongNhan(cn?.id);
  const gdList  = gdRes?.data  ?? [];
  const ktxList = ktxRes?.data ?? [];
  const currentRoom = ktxList.find((k) => !k.ngay_ra) ?? null;
  const noiO       = noiORes?.data ?? {};
  const phongTroNow = noiO?.phong_tro ?? null;
  const tongUng     = tongUngRes?.data ?? { tong_ung: 0, con_no: 0 };

  const [editModal,   setEditModal]   = useState(false);
  const [tamUngModal, setTamUngModal] = useState(false);
  const [anhModal,    setAnhModal]    = useState(false);

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

  // Tính khấu trừ tự động
  const khauTruDongPhuc = !cn.da_tra_dong_phuc ? Number(cn.tien_dong_phuc ?? 0) : 0;
  const khauTruPhat     = !cn.da_viet_don_nghi  ? Number(cn.tien_phat_nghi ?? 0) : 0;
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
            <span>{cn.ho_ten[0]}</span>
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
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setTamUngModal(true)}>💰 Cho ứng</button>
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
      {(cn.anh_cccd_truoc || cn.anh_cccd_sau || cn.anh_chan_dung) && (
        <div style={s.card}>
          <div style={s.cardTitle}>Ảnh đính kèm</div>
          <div className="cn-attachment-grid" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[['anh_cccd_truoc','CCCD mặt trước'],['anh_cccd_sau','CCCD mặt sau'],['anh_chan_dung','Ảnh chân dung']].map(([field, label]) =>
              cn[field] ? (
                <div key={field} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <img
                    src={mediaUrl(cn[field])}
                    alt={label}
                    style={{ width: 140, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }}
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
            <Field label="Quê quán" value={cn.que_quan} />
            <Field label="Địa chỉ hiện tại" value={cn.dia_chi_hien_tai} />
          </div>
        </div>

        {/* Thông tin CCCD */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Thông tin CCCD</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Số CCCD" value={cn.cccd} />
            <Field label="Ngày cấp" value={cn.ngay_cap_cccd ? new Date(cn.ngay_cap_cccd).toLocaleDateString('vi-VN') : null} />
            <Field label="Nơi cấp" value={cn.noi_cap_cccd} />
          </div>
        </div>

        {/* Thông tin công việc */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Thông tin công việc</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Trạng thái" value={pill.label} />
            <Field label="Công ty" value={cn.ten_cong_ty} />
            <Field label="Ngày vào làm" value={cn.ngay_vao_lam ? new Date(cn.ngay_vao_lam).toLocaleDateString('vi-VN') : null} />
            <Field label="Ngày nghỉ việc" value={cn.ngay_nghi_viec ? new Date(cn.ngay_nghi_viec).toLocaleDateString('vi-VN') : null} />
            <Field label="Người tuyển" value={cn.nguoi_tuyen_ho_ten} />
            <Field label="Ghi chú" value={cn.ghi_chu} />
          </div>
        </div>

        {/* Khấu trừ */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Khấu trừ tự động</div>
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
          {tongKhauTru > 0 && (
            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(255,95,114,0.08)', borderRadius: 8, border: '1px solid rgba(255,95,114,0.2)', fontSize: 13, color: 'var(--red)', fontWeight: 700, fontFamily: "'JetBrains Mono', monospace" }}>
              Tổng khấu trừ: -{fmt(tongKhauTru)}
            </div>
          )}
        </div>

        {/* Nơi ở: KTX hoặc Phòng trọ */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Nơi ở hiện tại</div>
          {currentRoom ? (
            <div className="cn-detail-fields" style={s.fields}>
              <Field label="Loại" value="🏠 Ký túc xá" />
              <Field label="Khu" value={currentRoom.ktx_ten} />
              <Field label="Phòng" value={currentRoom.ten_phong} />
              <Field label="Giường số" value={currentRoom.so_thu_tu} />
              <Field label="Ngày vào" value={currentRoom.ngay_vao ? new Date(currentRoom.ngay_vao).toLocaleDateString('vi-VN') : null} />
            </div>
          ) : phongTroNow ? (
            <div className="cn-detail-fields" style={s.fields}>
              <Field label="Loại" value="🏘️ Phòng trọ" />
              <Field label="Tên phòng trọ" value={phongTroNow.ten} />
              <Field label="Địa chỉ" value={phongTroNow.dia_chi} />
              <Field label="Chủ trọ" value={phongTroNow.chu_tro} />
              <Field label="SĐT chủ trọ" value={phongTroNow.sdt_chu_tro} />
              <Field label="Ngày vào" value={phongTroNow.ngay_vao ? new Date(phongTroNow.ngay_vao).toLocaleDateString('vi-VN') : null} />
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

        {/* Tổng tạm ứng */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Tạm ứng</div>
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
                          {!isThu && (
                            <span style={{ fontSize: 11, color: g.da_hoan_tien ? 'var(--green)' : 'var(--text3)' }}>
                              {g.da_hoan_tien ? '✓ Đã hoàn' : 'Chưa hoàn'}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Hệ thống */}
        <div className="cn-detail-card" style={s.card}>
          <div style={s.cardTitle}>Hệ thống</div>
          <div className="cn-detail-fields" style={s.fields}>
            <Field label="Ngày tạo" value={new Date(cn.created_at).toLocaleString('vi-VN')} />
            <Field label="Cập nhật" value={new Date(cn.updated_at).toLocaleString('vi-VN')} />
          </div>
        </div>
      </div>

      {editModal   && <EditModal    cn={cn} onClose={() => setEditModal(false)} />}
      {tamUngModal && <TamUngModal  cn={cn} onClose={() => setTamUngModal(false)} />}
      {anhModal    && <UploadAnhModal cn={cn} onClose={() => setAnhModal(false)} />}
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
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  fields: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
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
