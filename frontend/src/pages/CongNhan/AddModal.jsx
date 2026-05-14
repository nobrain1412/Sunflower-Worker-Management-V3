import { useState, useMemo } from 'react';
import { useTaoMoiCongNhan, useCongTyList, useVenders, useNoiOTruyCap } from '../../hooks/useCongNhan';
import { usePhongList, useGiuongList } from '../../hooks/useKtx';
import { useAuth } from '../../context/AuthContext';
import ProvinceSelect from '../../components/ProvinceSelect';
import api from '../../hooks/useApi';

function todayDMY() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

const INIT = {
  ho_ten: '', cccd: '', ngay_sinh: '', gioi_tinh: '',
  que_quan: '', dia_chi_hien_tai: '', so_dien_thoai: '',
  ngay_cap_cccd: '', noi_cap_cccd: '',
  trang_thai: 'moi_vao', ngay_vao_lam: todayDMY(), ghi_chu: '',
  cong_ty_id: '',
  nguoi_tuyen_id: '',
  // Thông tin tài khoản ngân hàng
  ngan_hang: '', so_tai_khoan: '', ten_chu_tk: '',
  // Trạng thái CCCD & mượn xe
  cccd_da_tra: false,
  trang_thai_noi_o: 'chua_co_phong',
  ktx_id: '',
  phong_id: '',
  giuong_id: '',
  phong_tro_id: '',
  muon_xe: false, loai_xe: '',
};

// Convert dd/mm/yyyy → yyyy-mm-dd cho payload backend
function toIso(s) {
  if (!s) return '';
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return '';
  const dd = m[1].padStart(2, '0');
  const mm = m[2].padStart(2, '0');
  return `${m[3]}-${mm}-${dd}`;
}

// Auto-format khi gõ số: 02112025 → 02/11/2025
function formatDateInput(v) {
  const digits = v.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export default function AddCongNhanModal({ onClose }) {
  const [form, setForm]     = useState(INIT);
  const [errors, setErrors] = useState({});
  const [done, setDone]     = useState(false);
  const mutation = useTaoMoiCongNhan();
  const { user, isAdmin, isQuanLy } = useAuth();
  const congTyArr = useCongTyList().data?.data ?? [];
  const venderArr = useVenders().data?.data ?? [];
  const noiOTruyCap = useNoiOTruyCap().data?.data ?? { ktx: [], phong_tro: [] };
  const { data: phongRes } = usePhongList(form.ktx_id ? parseInt(form.ktx_id, 10) : null);
  const phongList = phongRes?.data ?? [];
  const { data: giuongRes } = useGiuongList(form.phong_id ? parseInt(form.phong_id, 10) : null);
  const giuongList = (giuongRes?.data ?? []).filter((g) => !g.cong_nhan_id);
  const canPickVender = isAdmin || isQuanLy;

  // Quản lý chỉ thấy công ty mình quản lý
  const congTyOptions = useMemo(() => {
    if (isQuanLy) {
      const ids = user?.cong_ty_ids ?? [];
      return congTyArr.filter((c) => ids.includes(c.id));
    }
    return congTyArr;
  }, [congTyArr, isQuanLy, user]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
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
    if (errors[name]) setErrors((er) => ({ ...er, [name]: '' }));
  }

  function handleDateChange(name) {
    return (e) => {
      const formatted = formatDateInput(e.target.value);
      setForm((f) => ({ ...f, [name]: formatted }));
      if (errors[name]) setErrors((er) => ({ ...er, [name]: '' }));
    };
  }

  function validate() {
    const errs = {};
    if (!form.ho_ten.trim()) errs.ho_ten = 'Bắt buộc';
    if (form.cccd && !/^\d{12}$/.test(form.cccd)) errs.cccd = 'CCCD phải đúng 12 chữ số';
    if (form.so_dien_thoai && !/^(0[3578]\d{8}|0[6789]\d{8})$/.test(form.so_dien_thoai))
      errs.so_dien_thoai = 'Số điện thoại không hợp lệ';
    for (const f of ['ngay_sinh', 'ngay_cap_cccd', 'ngay_vao_lam']) {
      if (form[f] && !/^\d{2}\/\d{2}\/\d{4}$/.test(form[f])) errs[f] = 'Định dạng dd/mm/yyyy';
    }
    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = { ho_ten: form.ho_ten, trang_thai: form.trang_thai };
    ['cccd','gioi_tinh','que_quan','dia_chi_hien_tai','so_dien_thoai','noi_cap_cccd','ghi_chu',
     'ngan_hang','so_tai_khoan','ten_chu_tk']
      .forEach((k) => { if (form[k]) payload[k] = form[k]; });
    payload.cccd_da_tra = !!form.cccd_da_tra;
    payload.trang_thai_noi_o = form.trang_thai_noi_o;
    payload.muon_xe     = !!form.muon_xe;
    if (form.muon_xe && form.loai_xe) payload.loai_xe = form.loai_xe;
    ['ngay_sinh','ngay_cap_cccd','ngay_vao_lam'].forEach((k) => {
      const iso = toIso(form[k]);
      if (iso) payload[k] = iso;
    });
    if (form.cong_ty_id) payload.cong_ty_id = parseInt(form.cong_ty_id, 10);
    if (canPickVender && form.nguoi_tuyen_id) {
      payload.nguoi_tuyen_id = parseInt(form.nguoi_tuyen_id, 10);
    }

    if (form.trang_thai_noi_o === 'ktx' && !form.giuong_id) {
      setErrors({ submit: 'Vui lòng chọn cụ thể KTX / phòng / giường' });
      return;
    }
    if (form.trang_thai_noi_o === 'phong_tro' && !form.phong_tro_id) {
      setErrors({ submit: 'Vui lòng chọn phòng trọ cụ thể' });
      return;
    }

    try {
      const created = await mutation.mutateAsync(payload);
      const congNhanId = created?.data?.data?.id;
      const ngayVao = payload.ngay_vao_lam || new Date().toISOString().split('T')[0];
      if (congNhanId && form.trang_thai_noi_o === 'ktx' && form.giuong_id) {
        await api.post(`/ktx/giuong/${parseInt(form.giuong_id, 10)}/xep`, {
          cong_nhan_id: congNhanId,
          ngay_vao: ngayVao,
        });
      }
      if (congNhanId && form.trang_thai_noi_o === 'phong_tro' && form.phong_tro_id) {
        await api.post(`/phong-tro/${parseInt(form.phong_tro_id, 10)}/thue`, {
          cong_nhan_id: congNhanId,
          ngay_vao: ngayVao,
        });
      }
      setDone(true);
    } catch (err) {
      setErrors({ submit: err.message || 'Có lỗi xảy ra' });
    }
  }

  if (done) return (
    <div style={o.overlay} onClick={onClose}>
      <div style={o.modal} onClick={(e) => e.stopPropagation()}>
        <div style={sc.root}>
          <div style={sc.icon}>✅</div>
          <div style={sc.title}>Thêm thành công!</div>
          <div style={sc.sub}>Công nhân <b>{form.ho_ten}</b> đã được thêm vào hệ thống</div>
          <div style={sc.actions}>
            <button className="btn-ghost" onClick={() => { setForm(INIT); setDone(false); }}>Thêm tiếp</button>
            <button className="btn-primary" onClick={onClose}>Hoàn tất</button>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div style={o.overlay} onClick={onClose}>
      <div style={o.modal} onClick={(e) => e.stopPropagation()}>
        <div style={o.header}>
          <div>
            <div style={o.title}>Thêm công nhân</div>
            <div style={o.sub}>Điền thông tin cá nhân & phân công</div>
          </div>
          <button style={o.close} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div style={o.body}>
          <div style={f.grid}>
            <FormField label="Họ và tên *" error={errors.ho_ten}>
              <input className="form-input" name="ho_ten" value={form.ho_ten} onChange={handleChange} placeholder="Nguyễn Văn A" />
            </FormField>
            <FormField label="Số CCCD" error={errors.cccd}>
              <input className="form-input" name="cccd" value={form.cccd} onChange={handleChange} placeholder="012345678901" maxLength={12} />
            </FormField>
            <FormField label="Ngày sinh" error={errors.ngay_sinh}>
              <input className="form-input" name="ngay_sinh" value={form.ngay_sinh} onChange={handleDateChange('ngay_sinh')} placeholder="dd/mm/yyyy" maxLength={10} />
            </FormField>
            <FormField label="Giới tính">
              <select className="form-input" name="gioi_tinh" value={form.gioi_tinh} onChange={handleChange}>
                <option value="">-- Chọn --</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </FormField>
            <FormField label="Số điện thoại" error={errors.so_dien_thoai}>
              <input className="form-input" name="so_dien_thoai" value={form.so_dien_thoai} onChange={handleChange} placeholder="0912345678" />
            </FormField>
            <FormField label="Ngày cấp CCCD" error={errors.ngay_cap_cccd}>
              <input className="form-input" name="ngay_cap_cccd" value={form.ngay_cap_cccd} onChange={handleDateChange('ngay_cap_cccd')} placeholder="dd/mm/yyyy" maxLength={10} />
            </FormField>
            <FormField label="Quê quán" style={{ gridColumn: 'span 2' }}>
              <ProvinceSelect
                onChange={(val) => setForm((f) => ({ ...f, que_quan: val }))}
              />
              {form.que_quan && (
                <div style={{ fontSize: 11, color: 'var(--accent)', marginTop: 4 }}>✓ {form.que_quan}</div>
              )}
            </FormField>
            <FormField label="Địa chỉ hiện tại" style={{ gridColumn: 'span 2' }}>
              <input className="form-input" name="dia_chi_hien_tai" value={form.dia_chi_hien_tai} onChange={handleChange} placeholder="Số 123, Đường ABC..." />
            </FormField>
            <FormField label="Nơi cấp CCCD" style={{ gridColumn: 'span 2' }}>
              <input className="form-input" name="noi_cap_cccd" value={form.noi_cap_cccd} onChange={handleChange} placeholder="Cục CS QLHC về TTXH" />
            </FormField>

            <div style={{ gridColumn: 'span 2', height: 1, background: 'var(--border)', margin: '4px 0' }} />

            <FormField label="Công ty">
              <select className="form-input" name="cong_ty_id" value={form.cong_ty_id} onChange={handleChange}>
                <option value="">{isAdmin ? '-- Chọn công ty --' : 'Công ty bạn quản lý'}</option>
                {congTyOptions.map((ct) => (
                  <option key={ct.id} value={ct.id}>{ct.ten_cong_ty}</option>
                ))}
              </select>
            </FormField>
            {canPickVender && (
              <FormField label="Vender / Người tuyển">
                <select className="form-input" name="nguoi_tuyen_id" value={form.nguoi_tuyen_id} onChange={handleChange}>
                  <option value="">— Mặc định: {user?.ho_ten ?? 'tôi'} —</option>
                  {venderArr.map((v) => (
                    <option key={v.id} value={v.id}>{v.ho_ten}</option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="Trạng thái">
              <select className="form-input" name="trang_thai" value={form.trang_thai} onChange={handleChange}>
                <option value="moi_vao">Mới vào</option>
                <option value="dang_lam">Đang làm</option>
              </select>
            </FormField>
            <FormField label="Trạng thái phòng">
              <select className="form-input" name="trang_thai_noi_o" value={form.trang_thai_noi_o} onChange={handleChange}>
                <option value="chua_co_phong">Chưa có phòng</option>
                <option value="tu_tuc">Tự túc chỗ ở</option>
                {noiOTruyCap.ktx?.length > 0 && <option value="ktx">Ở KTX</option>}
                <option value="phong_tro">Ở nhà trọ</option>
              </select>
            </FormField>
            {form.trang_thai_noi_o === 'ktx' && (
              <>
                <FormField label="KTX cụ thể">
                  <select className="form-input" name="ktx_id" value={form.ktx_id} onChange={handleChange}>
                    <option value="">— Chọn KTX —</option>
                    {(noiOTruyCap.ktx ?? []).map((k) => <option key={k.id} value={k.id}>{k.ten}</option>)}
                  </select>
                </FormField>
                <FormField label="Phòng">
                  <select className="form-input" name="phong_id" value={form.phong_id} onChange={handleChange} disabled={!form.ktx_id}>
                    <option value="">— Chọn phòng —</option>
                    {phongList.map((p) => <option key={p.id} value={p.id}>{p.ten_phong} (Tầng {p.tang})</option>)}
                  </select>
                </FormField>
                <FormField label="Giường" style={{ gridColumn: 'span 2' }}>
                  <select className="form-input" name="giuong_id" value={form.giuong_id} onChange={handleChange} disabled={!form.phong_id}>
                    <option value="">— Chọn giường trống —</option>
                    {giuongList.map((g) => <option key={g.id} value={g.id}>Giường {g.so_thu_tu}</option>)}
                  </select>
                </FormField>
              </>
            )}
            {form.trang_thai_noi_o === 'phong_tro' && (
              <FormField label="Phòng trọ cụ thể" style={{ gridColumn: 'span 2' }}>
                <select className="form-input" name="phong_tro_id" value={form.phong_tro_id} onChange={handleChange}>
                  <option value="">— Chọn phòng trọ —</option>
                  {(noiOTruyCap.phong_tro ?? []).map((p) => <option key={p.id} value={p.id}>{p.ten}</option>)}
                </select>
              </FormField>
            )}
            <FormField label="Ngày vào làm" error={errors.ngay_vao_lam}>
              <input className="form-input" name="ngay_vao_lam" value={form.ngay_vao_lam} onChange={handleDateChange('ngay_vao_lam')} placeholder="dd/mm/yyyy" maxLength={10} />
            </FormField>
            <FormField label="Ghi chú" style={{ gridColumn: 'span 2' }}>
              <textarea className="form-input" name="ghi_chu" value={form.ghi_chu} onChange={handleChange} rows={2} placeholder="Ghi chú thêm..." style={{ resize: 'vertical' }} />
            </FormField>

            <div style={{ gridColumn: 'span 2', height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ gridColumn: 'span 2', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tài khoản ngân hàng
            </div>
            <FormField label="Ngân hàng">
              <input className="form-input" name="ngan_hang" value={form.ngan_hang} onChange={handleChange} placeholder="Vietcombank" />
            </FormField>
            <FormField label="Số tài khoản">
              <input className="form-input" name="so_tai_khoan" value={form.so_tai_khoan} onChange={handleChange} placeholder="0123456789" />
            </FormField>
            <FormField label="Tên chủ tài khoản" style={{ gridColumn: 'span 2' }}>
              <input className="form-input" name="ten_chu_tk" value={form.ten_chu_tk} onChange={handleChange} placeholder="NGUYEN VAN A" />
            </FormField>

            <div style={{ gridColumn: 'span 2', height: 1, background: 'var(--border)', margin: '4px 0' }} />
            <div style={{ gridColumn: 'span 2', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              CCCD & mượn xe
            </div>
            <FormField label="Nơi ở user có quyền truy cập" style={{ gridColumn: 'span 2' }}>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <div><b style={{ color: 'var(--text1)' }}>KTX:</b> {noiOTruyCap.ktx?.length ? noiOTruyCap.ktx.map((k) => k.ten).join(', ') : 'Không có'}</div>
                <div><b style={{ color: 'var(--text1)' }}>Nhà trọ:</b> {noiOTruyCap.phong_tro?.length ? noiOTruyCap.phong_tro.map((p) => p.ten).join(', ') : 'Không có'}</div>
              </div>
            </FormField>
            <FormField label="Trạng thái CCCD">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.cccd_da_tra}
                  onChange={(e) => setForm((f) => ({ ...f, cccd_da_tra: e.target.checked }))} />
                Đã trả CCCD cho công nhân
              </label>
            </FormField>
            <FormField label="Mượn xe">
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)', cursor: 'pointer' }}>
                <input type="checkbox" checked={form.muon_xe}
                  onChange={(e) => setForm((f) => ({ ...f, muon_xe: e.target.checked, loai_xe: e.target.checked ? f.loai_xe : '' }))} />
                Có mượn xe
              </label>
            </FormField>
            {form.muon_xe && (
              <FormField label="Loại phương tiện" style={{ gridColumn: 'span 2' }}>
                <select className="form-input" name="loai_xe" value={form.loai_xe} onChange={handleChange}>
                  <option value="">— Chọn loại xe —</option>
                  <option value="xe_dap">Xe đạp</option>
                  <option value="xe_dien">Xe điện</option>
                  <option value="xe_may">Xe máy</option>
                </select>
              </FormField>
            )}
          </div>
        </div>

        {errors.submit && <div style={o.errBox}>{errors.submit}</div>}

        <div style={o.footer}>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            <button className="btn-ghost" onClick={onClose}>Hủy</button>
            <button className="btn-primary" onClick={handleSubmit} disabled={mutation.isPending}>
              {mutation.isPending ? 'Đang lưu...' : '✓ Lưu công nhân'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, error, children, style }) {
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
  modal:   { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 580, maxHeight: '90vh', display: 'flex', flexDirection: 'column', fontFamily: "'Be Vietnam Pro', sans-serif" },
  header:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 24px 16px', borderBottom: '1px solid var(--border)' },
  title:   { fontSize: 16, fontWeight: 700, color: 'var(--text1)' },
  sub:     { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  close:   { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)', padding: 4 },
  body:    { flex: 1, overflowY: 'auto', padding: '20px 24px' },
  errBox:  { margin: '0 24px', padding: '10px 14px', background: 'rgba(255,95,114,0.08)', border: '1px solid rgba(255,95,114,0.2)', borderRadius: 8, fontSize: 12, color: 'var(--red)' },
  footer:  { display: 'flex', padding: '16px 24px', borderTop: '1px solid var(--border)', gap: 8 },
};

const f = {
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px 20px' },
};

const sc = {
  root:    { padding: '40px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' },
  icon:    { fontSize: 48, marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  sub:     { fontSize: 13, color: 'var(--text2)', marginTop: 6 },
  actions: { display: 'flex', gap: 10, marginTop: 24 },
};
