/**
 * Trang Quản lý nhân sự — admin có 3 tab:
 *   - Tất cả user (quản lý role, CRUD)
 *   - Nhân viên (admin/quan_ly/ke_toan/vender) — kèm công ty quản lý + tổng CN
 *   - Cộng tác viên — kèm số người tuyển + tiền công
 */
import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useUserList, useCongTacVien, useTaoUser, useCapNhatUser, useXoaUser, useThanhToanCongTacVien } from '../../hooks/useUsers';
import { useCongTyList } from '../../hooks/useCongNhan';
import useIsMobile from '../../hooks/useIsMobile';
import { useAuth } from '../../context/AuthContext';

const ROLE_LABEL = {
  admin: 'Quản trị',
  quan_ly: 'Quản lý',
  vender: 'Vender',
  cong_tac_vien: 'Cộng tác viên',
  ke_toan: 'Kế toán',
};

const ROLE_PILL = {
  admin: 'pill-red',
  quan_ly: 'pill-blue',
  vender: 'pill-amber',
  cong_tac_vien: 'pill-green',
  ke_toan: 'pill-blue',
};

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ';
}

function UserModal({ user, onClose }) {
  const isEdit = !!user;
  const { isAdmin, isQuanLy } = useAuth();
  const isManagerMode = isQuanLy && !isAdmin;
  const congTyArr = useCongTyList().data?.data ?? [];
  const tao = useTaoUser();
  const capNhat = useCapNhatUser();
  const [form, setForm] = useState({
    ten_dang_nhap: user?.ten_dang_nhap ?? '',
    mat_khau: '',
    ho_ten: user?.ho_ten ?? '',
    vai_tro: user?.vai_tro ?? 'vender',
    so_dien_thoai: user?.so_dien_thoai ?? '',
    ma_vender: user?.ma_vender ?? '',
    ngan_hang: user?.ngan_hang ?? '',
    so_tai_khoan: user?.so_tai_khoan ?? '',
    ten_chu_tk: user?.ten_chu_tk ?? '',
    hinh_thuc_thanh_toan: user?.hinh_thuc_thanh_toan ?? 'mot_lan',
    quyen_ktx: user?.quyen_ktx ?? false,
    cong_ty_ids: user?.cong_ty_ids ?? [],
  });
  const [err, setErr] = useState('');

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((f) => ({
      ...f,
      [name]: type === 'checkbox' ? checked
        : type === 'number' ? (value === '' ? '' : Number(value))
        : value,
    }));
  }

  function toggleCty(id) {
    setForm((f) => ({
      ...f,
      cong_ty_ids: f.cong_ty_ids.includes(id)
        ? f.cong_ty_ids.filter((x) => x !== id)
        : [...f.cong_ty_ids, id],
    }));
  }

  async function handleSubmit() {
    setErr('');
    if (!form.ho_ten || !form.ten_dang_nhap) { setErr('Tên đăng nhập và họ tên là bắt buộc'); return; }
    if (!isEdit && !form.mat_khau) { setErr('Mật khẩu là bắt buộc khi tạo mới'); return; }
    if (form.mat_khau && form.mat_khau.length < 6) { setErr('Mật khẩu chỉ cần tối thiểu 6 ký tự'); return; }

    const payload = {
      ho_ten: form.ho_ten,
      vai_tro: form.vai_tro,
      so_dien_thoai: form.so_dien_thoai || undefined,
      ma_vender: form.ma_vender || '',
      ngan_hang: form.ngan_hang || undefined,
      so_tai_khoan: form.so_tai_khoan || undefined,
      ten_chu_tk: form.ten_chu_tk || undefined,
      hinh_thuc_thanh_toan: form.vai_tro === 'cong_tac_vien' ? form.hinh_thuc_thanh_toan : undefined,
      cong_ty_ids: form.vai_tro === 'quan_ly' ? form.cong_ty_ids : [],
    };
    // Chỉ admin được cấp quyền KTX
    if (isAdmin) payload.quyen_ktx = !!form.quyen_ktx;
    if (form.mat_khau) payload.mat_khau = form.mat_khau;

    try {
      if (isEdit) {
        // Admin được đổi tên đăng nhập; chỉ gửi khi thực sự thay đổi
        if (isAdmin && form.ten_dang_nhap && form.ten_dang_nhap !== user.ten_dang_nhap) {
          payload.ten_dang_nhap = form.ten_dang_nhap;
        }
        await capNhat.mutateAsync({ id: user.id, ...payload });
      } else {
        await tao.mutateAsync({ ten_dang_nhap: form.ten_dang_nhap, ...payload });
      }
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>{isEdit ? 'Sửa user' : 'Thêm user mới'}</div>
        <div className="nhan-su-form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div style={F.col}>
            <label className="form-label">Tên đăng nhập *</label>
            <input className="form-input" name="ten_dang_nhap" value={form.ten_dang_nhap}
              onChange={handleChange} disabled={isEdit && !isAdmin} />
          </div>
          <div style={F.col}>
            <label className="form-label">Mật khẩu {isEdit ? '(để trống nếu không đổi)' : '*'}</label>
            <input className="form-input" type="password" name="mat_khau" value={form.mat_khau} onChange={handleChange} />
          </div>
          <div style={F.col}>
            <label className="form-label">Họ tên *</label>
            <input className="form-input" name="ho_ten" value={form.ho_ten} onChange={handleChange} />
          </div>
          <div style={F.col}>
            <label className="form-label">Vai trò *</label>
            <select className="form-input" name="vai_tro" value={form.vai_tro} onChange={handleChange} disabled={isManagerMode}>
              {(isManagerMode
                ? [['cong_tac_vien', 'Cộng tác viên']]
                : Object.entries(ROLE_LABEL)
              ).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div style={F.col}>
            <label className="form-label">SĐT</label>
            <input className="form-input" name="so_dien_thoai" value={form.so_dien_thoai} onChange={handleChange} />
          </div>
          <div style={F.col}>
            <label className="form-label">Mã vender</label>
            <input className="form-input" name="ma_vender" value={form.ma_vender} onChange={handleChange}
              placeholder="Dùng để import Excel nhận diện vender" />
          </div>
          {form.vai_tro === 'cong_tac_vien' && (
            <div style={{ ...F.col, gridColumn: 'span 2' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', padding: '4px 0' }}>
                Tiền công / người tuyển nay đặt riêng theo từng công ty — chỉnh trong trang Công ty hoặc Chi tiết user.
              </div>
            </div>
          )}
          {form.vai_tro === 'cong_tac_vien' && (
            <div style={F.col}>
              <label className="form-label">Hình thức thanh toán</label>
              <select className="form-input" name="hinh_thuc_thanh_toan" value={form.hinh_thuc_thanh_toan} onChange={handleChange}>
                <option value="mot_lan">Lấy 1 lần (đủ 26 ngày công)</option>
                <option value="hang_thang">Nhận hàng tháng (đơn giá giờ)</option>
              </select>
            </div>
          )}
          <div style={F.col}>
            <label className="form-label">Ngân hàng</label>
            <input className="form-input" name="ngan_hang" value={form.ngan_hang} onChange={handleChange} />
          </div>
          <div style={F.col}>
            <label className="form-label">Số tài khoản</label>
            <input className="form-input" name="so_tai_khoan" value={form.so_tai_khoan} onChange={handleChange} />
          </div>
          <div style={{ ...F.col, gridColumn: 'span 2' }}>
            <label className="form-label">Tên chủ tài khoản</label>
            <input className="form-input" name="ten_chu_tk" value={form.ten_chu_tk} onChange={handleChange} />
          </div>
          {isAdmin && (
            <div style={{ ...F.col, gridColumn: 'span 2' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text1)' }}>
                <input type="checkbox" name="quyen_ktx" checked={form.quyen_ktx} onChange={handleChange} />
                Cho phép sử dụng chức năng Ký túc xá
              </label>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                User được tick sẽ thấy và quản lý được module Ký túc xá (admin luôn có quyền).
              </div>
            </div>
          )}
          {form.vai_tro === 'quan_ly' && isAdmin && (
            <div style={{ ...F.col, gridColumn: 'span 2' }}>
              <label className="form-label">Công ty quản lý</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {congTyArr.map((ct) => {
                  const active = form.cong_ty_ids.includes(ct.id);
                  return (
                    <button key={ct.id} type="button"
                      onClick={() => toggleCty(ct.id)}
                      style={{
                        background: active ? 'rgba(79,124,255,0.15)' : 'var(--bg3)',
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        color: active ? 'var(--accent)' : 'var(--text2)',
                        borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
                      }}>
                      {ct.ten_cong_ty}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handleSubmit}
            disabled={tao.isPending || capNhat.isPending}>
            {(tao.isPending || capNhat.isPending) ? 'Đang lưu...' : (isEdit ? 'Cập nhật' : 'Tạo user')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function NhanSu() {
  const navigate = useNavigate();
  const { isAdmin, isQuanLy } = useAuth();
  const defaultTab = isAdmin ? 'user' : 'ctv';
  const [tab, setTab] = useState(defaultTab);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const { data: userRes }  = useUserList({}, { enabled: isAdmin });
  const { data: ctvRes }   = useCongTacVien();
  const xoa = useXoaUser();
  const thanhToanCtv = useThanhToanCongTacVien();

  // Lọc theo ?q= từ thanh search Topbar (tên / đăng nhập / SĐT / mã vender)
  const [urlParams, setUrlParams] = useSearchParams();
  const q = (urlParams.get('q') ?? '').trim().toLowerCase();
  const matchQ = (u) => !q ||
    [u.ho_ten, u.ten_dang_nhap, u.so_dien_thoai, u.ma_vender]
      .some((v) => v && String(v).toLowerCase().includes(q));

  const users = (isAdmin ? (userRes?.data ?? []) : []).filter(matchQ);
  const ctvs  = (ctvRes?.data ?? []).filter(matchQ);
  const isMobile = useIsMobile();

  // Nhân viên = mọi role trừ cộng tác viên (theo nghĩa nội bộ)
  const nhanVien = users.filter((u) => ['admin','quan_ly','ke_toan','vender'].includes(u.vai_tro));

  async function handleXoa(u) {
    if (!window.confirm(`Xoá vĩnh viễn user "${u.ho_ten}"?`)) return;
    await xoa.mutateAsync(u.id);
  }

  async function handleThanhToan(u) {
    const isHangThang = u.hinh_thuc_thanh_toan === 'hang_thang';
    const now = new Date();
    const payload = isHangThang
      ? { hinh_thuc: 'hang_thang', thang: now.getMonth() + 1, nam: now.getFullYear() }
      : { hinh_thuc: 'mot_lan' };

    const text = isHangThang
      ? `Tạo kỳ thanh toán tháng ${payload.thang}/${payload.nam} cho CTV "${u.ho_ten}"?`
      : `Tạo thanh toán 1 lần cho CTV "${u.ho_ten}" (chỉ công nhân đủ 26 ngày công và chưa từng nhận)?`;
    if (!window.confirm(text)) return;

    try {
      const res = await thanhToanCtv.mutateAsync({ id: u.id, ...payload });
      const kq = res?.data ?? {};
      alert(`Đã tạo thanh toán: ${Number(kq.so_luong || 0)} công nhân, tổng ${fmtMoney(kq.tong_tien || 0)}`);
    } catch (e) {
      alert(e?.response?.data?.error?.message ?? 'Không thể tạo kỳ thanh toán');
    }
  }

  return (
    <div style={s.root}>
      <div style={{ ...s.header, ...(isMobile ? s.headerMobile : {}) }}>
        <div style={{ ...s.tabs, ...(isMobile ? s.tabsMobile : {}) }}>
          {(isAdmin
            ? [['user','Tất cả user'],['nhan-vien','Nhân viên'],['ctv','Cộng tác viên']]
            : [['ctv','Cộng tác viên']]
          ).map(([v, l]) => (
            <button key={v} style={{ ...s.tab, ...(tab === v ? s.tabActive : {}) }}
              onClick={() => setTab(v)}>{l}</button>
          ))}
        </div>
        <button className="btn-primary" style={isMobile ? s.addBtnMobile : undefined} onClick={() => { setEditing(null); setShowAdd(true); }}>
          {isAdmin ? '+ Thêm user' : '+ Thêm cộng tác viên'}
        </button>
      </div>

      {q && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text2)' }}>
          Đang lọc theo: <b style={{ color: 'var(--text1)' }}>{urlParams.get('q')}</b>
          <button className="btn-ghost" style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => { urlParams.delete('q'); setUrlParams(urlParams, { replace: true }); }}>
            ✕ Xoá lọc
          </button>
        </div>
      )}

      <div style={s.card}>
        {tab === 'user' && (
          isMobile ? (
            <div style={m.list}>
              {users.length === 0 ? (
                <div style={s.empty}>Chưa có user</div>
              ) : users.map((u) => (
                <div key={u.id} style={m.card} onClick={() => isAdmin && navigate(`/nhan-vien/${u.id}`)}>
                  <div style={m.head}>
                    <b style={{ color: 'var(--text1)', fontSize: 14 }}>{u.ho_ten}</b>
                    <span className={`pill ${ROLE_PILL[u.vai_tro] ?? 'pill-blue'}`}>{ROLE_LABEL[u.vai_tro] ?? u.vai_tro}</span>
                  </div>
                  <div style={m.metaGrid}>
                    <div style={m.metaItem}><span style={m.metaLabel}>Đăng nhập</span><span style={s.mono}>{u.ten_dang_nhap}</span></div>
                    <div style={m.metaItem}><span style={m.metaLabel}>SĐT</span><span style={s.sub}>{u.so_dien_thoai ?? '—'}</span></div>
                    <div style={m.metaItem}><span style={m.metaLabel}>Trạng thái</span>
                      <span className={`pill ${u.active ? 'pill-green' : 'pill-red'}`}>{u.active ? 'Hoạt động' : 'Đã khoá'}</span>
                    </div>
                  </div>
                  <div style={m.actions}>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); setEditing(u); setShowAdd(true); }}>Sửa</button>
                    <button style={{ ...s.delBtn, marginLeft: 4 }} onClick={(e) => { e.stopPropagation(); handleXoa(u); }}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={s.table}>
              <thead><tr>{['Tên','Đăng nhập','Vai trò','SĐT','Trạng thái',''].map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {users.length === 0 ? <tr><td colSpan={6} style={s.empty}>Chưa có user</td></tr> :
                  users.map((u) => (
                    <tr key={u.id} style={{ ...s.tr, cursor: isAdmin ? 'pointer' : 'default' }} onClick={() => isAdmin && navigate(`/nhan-vien/${u.id}`)}>
                      <td style={s.td}><b style={{ color: 'var(--text1)' }}>{u.ho_ten}</b></td>
                      <td style={s.td}><span style={s.mono}>{u.ten_dang_nhap}</span></td>
                      <td style={s.td}><span className={`pill ${ROLE_PILL[u.vai_tro] ?? 'pill-blue'}`}>{ROLE_LABEL[u.vai_tro] ?? u.vai_tro}</span></td>
                      <td style={s.td}><span style={s.sub}>{u.so_dien_thoai ?? '—'}</span></td>
                      <td style={s.td}>
                        <span className={`pill ${u.active ? 'pill-green' : 'pill-red'}`}>
                          {u.active ? 'Hoạt động' : 'Đã khoá'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={(e) => { e.stopPropagation(); setEditing(u); setShowAdd(true); }}>Sửa</button>
                        <button style={{ ...s.delBtn, marginLeft: 4 }} onClick={(e) => { e.stopPropagation(); handleXoa(u); }}>🗑</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'nhan-vien' && (
          isMobile ? (
            <div style={m.list}>
              {nhanVien.length === 0 ? (
                <div style={s.empty}>Chưa có nhân viên</div>
              ) : nhanVien.map((u) => (
                <div key={u.id} style={m.card} onClick={() => isAdmin && navigate(`/nhan-vien/${u.id}`)}>
                  <div style={m.head}>
                    <b style={{ color: 'var(--text1)', fontSize: 14 }}>{u.ho_ten}</b>
                    <span className={`pill ${ROLE_PILL[u.vai_tro] ?? 'pill-blue'}`}>{ROLE_LABEL[u.vai_tro]}</span>
                  </div>
                  <div style={m.metaGrid}>
                    <div style={m.metaItem}>
                      <span style={m.metaLabel}>Tổng CN đang làm</span>
                      <span style={s.mono}>{u.vai_tro === 'quan_ly' ? Number(u.so_cn_quan_ly || 0) : Number(u.so_cn_tuyen || 0)}</span>
                    </div>
                    <div style={{ ...m.metaItem, gridColumn: 'span 2' }}>
                      <span style={m.metaLabel}>Công ty quản lý</span>
                      <span style={s.sub}>{u.cong_ty_quan_ly_ten || '—'}</span>
                    </div>
                  </div>
                  <div style={m.actions}>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={(e) => { e.stopPropagation(); setEditing(u); setShowAdd(true); }}>Sửa</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={s.table}>
              <thead><tr>{['Tên','Vai trò','Tổng CN đang làm','Công ty quản lý',''].map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {nhanVien.length === 0 ? <tr><td colSpan={5} style={s.empty}>Chưa có nhân viên</td></tr> :
                  nhanVien.map((u) => (
                    <tr key={u.id} style={{ ...s.tr, cursor: isAdmin ? 'pointer' : 'default' }} onClick={() => isAdmin && navigate(`/nhan-vien/${u.id}`)}>
                      <td style={s.td}><b style={{ color: 'var(--text1)' }}>{u.ho_ten}</b></td>
                      <td style={s.td}><span className={`pill ${ROLE_PILL[u.vai_tro] ?? 'pill-blue'}`}>{ROLE_LABEL[u.vai_tro]}</span></td>
                      <td style={s.td}>
                        <span style={s.mono}>
                          {u.vai_tro === 'quan_ly' ? Number(u.so_cn_quan_ly || 0) : Number(u.so_cn_tuyen || 0)}
                        </span>
                      </td>
                      <td style={s.td}><span style={s.sub}>{u.cong_ty_quan_ly_ten || '—'}</span></td>
                      <td style={s.td}>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={(e) => { e.stopPropagation(); setEditing(u); setShowAdd(true); }}>Sửa</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )
        )}

        {tab === 'ctv' && (
          isMobile ? (
            <div style={m.list}>
              {ctvs.length === 0 ? (
                <div style={s.empty}>Chưa có cộng tác viên</div>
              ) : ctvs.map((u) => (
                <div key={u.id} style={{ ...m.card, cursor: 'pointer' }} onClick={() => navigate(`/cong-tac-vien/${u.id}`)}>
                  <div style={m.head}>
                    <b style={{ color: 'var(--text1)', fontSize: 14 }}>{u.ho_ten}</b>
                    <span className="pill pill-green">CTV</span>
                  </div>
                  <div style={m.metaGrid}>
                    <div style={m.metaItem}><span style={m.metaLabel}>SĐT</span><span style={s.sub}>{u.so_dien_thoai ?? '—'}</span></div>
                    <div style={m.metaItem}><span style={m.metaLabel}>Số người tuyển</span><span style={s.mono}>{Number(u.so_cn_tuyen || 0)}</span></div>
                    <div style={m.metaItem}><span style={m.metaLabel}>Đã thanh toán</span><span style={{ ...s.mono, color: 'var(--teal)', fontWeight: 700 }}>{Number(u.so_cn_da_thanh_toan || 0)} người</span></div>
                    <div style={m.metaItem}><span style={m.metaLabel}>Hình thức</span><span style={s.sub}>{u.hinh_thuc_thanh_toan === 'hang_thang' ? 'Nhận hàng tháng' : 'Lấy 1 lần'}</span></div>
                    {u.hinh_thuc_thanh_toan !== 'hang_thang' && (
                      <div style={m.metaItem}><span style={m.metaLabel}>Đủ điều kiện 1 lần</span><span style={s.mono}>{Number(u.so_cn_du_dieu_kien_mot_lan || 0)} người</span></div>
                    )}
                    <div style={m.metaItem}><span style={m.metaLabel}>Dự kiến thanh toán</span><span style={{ ...s.mono, color: 'var(--green)', fontWeight: 700 }}>{fmtMoney(u.du_kien_thanh_toan)}</span></div>
                  </div>
                  <div style={m.actions} onClick={(e) => e.stopPropagation()}>
                    <button
                      className="btn-primary"
                      style={{ fontSize: 11, padding: '4px 8px' }}
                      onClick={() => handleThanhToan(u)}
                      disabled={thanhToanCtv.isPending}
                    >
                      Thanh toán
                    </button>
                    <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => { setEditing(u); setShowAdd(true); }}>Sửa</button>
                    <button style={{ ...s.delBtn, marginLeft: 4 }} onClick={() => handleXoa(u)}>🗑</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={s.table}>
              <thead><tr>{['Tên','SĐT','Số người tuyển','Đã thanh toán','Hình thức','Đủ điều kiện 1 lần','Dự kiến thanh toán',''].map((h, i) => <th key={i} style={s.th}>{h}</th>)}</tr></thead>
              <tbody>
                {ctvs.length === 0 ? <tr><td colSpan={8} style={s.empty}>Chưa có cộng tác viên</td></tr> :
                  ctvs.map((u) => (
                    <tr key={u.id} style={{ ...s.tr, cursor: 'pointer' }} onClick={() => navigate(`/cong-tac-vien/${u.id}`)}>
                      <td style={s.td}><b style={{ color: 'var(--text1)' }}>{u.ho_ten}</b></td>
                      <td style={s.td}><span style={s.sub}>{u.so_dien_thoai ?? '—'}</span></td>
                      <td style={s.td}><span style={s.mono}>{Number(u.so_cn_tuyen || 0)}</span></td>
                      <td style={s.td}>
                        <span style={{ ...s.mono, color: 'var(--teal)', fontWeight: 700 }}>{Number(u.so_cn_da_thanh_toan || 0)}</span>
                        {Number(u.tong_da_thanh_toan || 0) > 0 && (
                          <span style={{ ...s.sub, marginLeft: 6 }}>({fmtMoney(u.tong_da_thanh_toan)})</span>
                        )}
                      </td>
                      <td style={s.td}><span style={s.sub}>{u.hinh_thuc_thanh_toan === 'hang_thang' ? 'Nhận hàng tháng' : 'Lấy 1 lần'}</span></td>
                      <td style={s.td}>
                        <span style={s.mono}>
                          {u.hinh_thuc_thanh_toan === 'hang_thang' ? '—' : `${Number(u.so_cn_du_dieu_kien_mot_lan || 0)} người`}
                        </span>
                      </td>
                      <td style={s.td}><span style={{ ...s.mono, color: 'var(--green)', fontWeight: 700 }}>{fmtMoney(u.du_kien_thanh_toan)}</span></td>
                      <td style={s.td} onClick={(e) => e.stopPropagation()}>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px', marginRight: 4 }}
                          onClick={() => navigate(`/cong-tac-vien/${u.id}`)}>📊 Chi tiết</button>
                        <button
                          className="btn-primary"
                          style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => handleThanhToan(u)}
                          disabled={thanhToanCtv.isPending}
                        >
                          Thanh toán
                        </button>
                        <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }}
                          onClick={() => { setEditing(u); setShowAdd(true); }}>Sửa</button>
                        <button style={{ ...s.delBtn, marginLeft: 4 }} onClick={() => handleXoa(u)}>🗑</button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )
        )}
      </div>

      {showAdd && (
        <UserModal user={editing}
          onClose={() => { setShowAdd(false); setEditing(null); }} />
      )}
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerMobile: { flexDirection: 'column', alignItems: 'stretch', gap: 10 },
  tabs: { display: 'flex', gap: 4 },
  tabsMobile: { overflowX: 'auto', paddingBottom: 4 },
  tab: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    color: 'var(--text3)', padding: '8px 14px', borderRadius: 8, fontFamily: "'Be Vietnam Pro', sans-serif" },
  tabActive: { background: 'var(--bg3)', color: 'var(--text1)' },
  addBtnMobile: { width: '100%', justifyContent: 'center' },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', padding: '0 12px 10px 0', borderBottom: '1px solid var(--border)' },
  tr: { borderBottom: '1px solid var(--border)' },
  td: { padding: '10px 12px 10px 0', verticalAlign: 'middle', fontSize: 13, color: 'var(--text2)' },
  sub: { fontSize: 12, color: 'var(--text2)' },
  mono: { fontSize: 12, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace" },
  empty: { padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
  delBtn: { background: 'transparent', border: '1px solid var(--border)', borderRadius: 6,
    padding: '4px 8px', fontSize: 11, color: 'var(--red)', cursor: 'pointer' },
};

const F = {
  col: { display: 'flex', flexDirection: 'column', gap: 4 },
};

const M = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal: { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 16,
    padding: '24px 28px', width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 16 },
  err: { color: 'var(--red)', fontSize: 12, marginBottom: 8 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
};

const m = {
  list: { display: 'flex', flexDirection: 'column', gap: 10 },
  card: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  metaGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  metaItem: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  metaLabel: { fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' },
  actions: { display: 'flex', justifyContent: 'flex-end' },
};
