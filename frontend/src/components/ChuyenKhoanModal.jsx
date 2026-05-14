import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTaoGiaoDich, useDanhMuc } from '../hooks/useTaiChinh';
import { NGAN_HANG_LIST, findNganHang, buildQRUrl } from '../constants/nganHang';

// Multi-step modal: Bước 1 chọn loại + nhập tiền → Bước 2 QR + xác nhận ghi lại
export default function ChuyenKhoanModal({ cn, onClose }) {
  const qc  = useQueryClient();
  const tao = useTaoGiaoDich();
  const { data: dmRes } = useDanhMuc();
  const dmList = dmRes?.data ?? [];

  const today = new Date().toISOString().split('T')[0];
  const [buoc, setBuoc]   = useState(1);
  const [toast, setToast] = useState('');
  const [showBankMenu, setShowBankMenu] = useState(false);
  const [err, setErr]     = useState('');

  const [form, setForm] = useState({
    loai:        'chi',
    danh_muc_id: '',
    so_tien:     '',
    ngay:        today,
    ghi_chu:     '',
  });

  const bank    = findNganHang(cn.ngan_hang);
  const coNH    = !!(cn.ngan_hang && cn.so_tai_khoan);
  const dmFiltered = dmList.filter((d) => !form.loai || d.loai === form.loai);

  // Auto nội dung chuyển khoản
  const noiDung = form.ghi_chu.trim()
    ? form.ghi_chu
    : `${form.loai === 'chi' ? 'Chi' : 'Tieu'} - ${cn.ho_ten}`;

  const qrUrl = coNH ? buildQRUrl({
    nganHang:  cn.ngan_hang,
    soTK:      cn.so_tai_khoan,
    tenChuTK:  cn.ten_chu_tk,
    soTien:    parseFloat(form.so_tien) || 0,
    noiDung,
  }) : '';

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 2200);
  }

  function copyText(text, label) {
    navigator.clipboard?.writeText(text).then(() => showToast(`Đã sao chép ${label}`));
    if (navigator.vibrate) navigator.vibrate(15);
  }

  function openBankApp(nh) {
    setShowBankMenu(false);
    copyText(cn.so_tai_khoan, 'STK');
    setTimeout(() => {
      try { window.location.href = nh.scheme; } catch (_) {}
    }, 300);
  }

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => {
      const next = { ...f, [name]: value };
      if (name === 'loai') next.danh_muc_id = '';
      return next;
    });
  }

  function handleTiepTheo() {
    setErr('');
    if (!form.so_tien || parseFloat(form.so_tien) <= 0) { setErr('Vui lòng nhập số tiền hợp lệ'); return; }
    setBuoc(2);
  }

  async function handleXacNhan() {
    setErr('');
    try {
      await tao.mutateAsync({
        cong_nhan_id: cn.id,
        loai:         form.loai,
        danh_muc_id:  form.danh_muc_id ? parseInt(form.danh_muc_id) : undefined,
        so_tien:      parseFloat(form.so_tien),
        ngay:         form.ngay,
        ghi_chu:      form.ghi_chu.trim() || undefined,
      });
      // Invalidate lịch sử giao dịch của CN trong Detail
      qc.invalidateQueries({ queryKey: ['tai-chinh', 'cn', cn.id] });
      onClose();
    } catch (e) {
      setErr(e?.response?.data?.error?.message ?? 'Lỗi không xác định');
    }
  }

  const fmt = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';
  const loaiLabel = { chi: 'Chi', tieu: 'Tiêu', thu: 'Thu' };

  return (
    <div style={ov} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modal}>

        {/* Header */}
        <div style={hd.wrap}>
          <div style={hd.title}>
            {buoc === 1 ? `Chuyển khoản — ${cn.ho_ten}` : 'Mã QR chuyển khoản'}
          </div>
          <div style={hd.steps}>
            <span style={{ ...hd.step, color: buoc === 1 ? 'var(--accent)' : 'var(--green)', fontWeight: 700 }}>① Thông tin</span>
            <span style={hd.dash}>──</span>
            <span style={{ ...hd.step, color: buoc === 2 ? 'var(--accent)' : 'var(--text3)', fontWeight: buoc === 2 ? 700 : 400 }}>② Mã QR</span>
          </div>
        </div>

        {/* ── Bước 1: Form ── */}
        {buoc === 1 && (
          <div>
            <div style={f.row}>
              <div style={f.col}>
                <label className="form-label">Loại *</label>
                <select className="form-input" name="loai" value={form.loai} onChange={handleChange}>
                  <option value="chi">Chi — khoản chi</option>
                  <option value="tieu">Tiêu — chi tiêu</option>
                  <option value="thu">Thu — thu tiền lại</option>
                </select>
              </div>
              <div style={f.col}>
                <label className="form-label">Danh mục</label>
                <select className="form-input" name="danh_muc_id" value={form.danh_muc_id} onChange={handleChange}>
                  <option value="">— Không chọn —</option>
                  {dmFiltered.map((d) => (
                    <option key={d.id} value={d.id}>{d.ten}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={f.row}>
              <div style={f.col}>
                <label className="form-label">Số tiền *</label>
                <input
                  className="form-input"
                  name="so_tien"
                  type="number"
                  placeholder="500000"
                  value={form.so_tien}
                  onChange={handleChange}
                  style={{ fontFamily: "'JetBrains Mono', monospace" }}
                  autoFocus
                />
              </div>
              <div style={f.col}>
                <label className="form-label">Ngày</label>
                <input className="form-input" name="ngay" type="date" value={form.ngay} onChange={handleChange} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="form-label">Nội dung chuyển khoản</label>
              <input
                className="form-input"
                name="ghi_chu"
                placeholder={`VD: Ung luong T5 ${cn.ho_ten.split(' ').pop()}`}
                value={form.ghi_chu}
                onChange={handleChange}
                maxLength={80}
              />
              <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                Sẽ hiển thị trên QR (tự động rút gọn 25 ký tự khi tạo mã)
              </div>
            </div>

            {!coNH && (
              <div style={warn}>
                ⚠️ Công nhân chưa có thông tin ngân hàng. Vui lòng cập nhật trong Chỉnh sửa trước.
              </div>
            )}

            {err && <div style={errStyle}>{err}</div>}

            <div style={actions}>
              <button className="btn-ghost" onClick={onClose}>Hủy</button>
              <button className="btn-primary" onClick={handleTiepTheo}>
                Tiếp theo →
              </button>
            </div>
          </div>
        )}

        {/* ── Bước 2: QR ── */}
        {buoc === 2 && (
          <div>
            {/* Tóm tắt giao dịch */}
            <div style={qr.summary}>
              <div style={qr.amount}>{fmt(form.so_tien)}</div>
              <div style={qr.meta}>
                {loaiLabel[form.loai]}
                {dmFiltered.find((d) => d.id === parseInt(form.danh_muc_id))
                  ? ` — ${dmFiltered.find((d) => d.id === parseInt(form.danh_muc_id)).ten}`
                  : ''
                }
              </div>
            </div>

            {/* QR hoặc thông báo thiếu bank */}
            {coNH ? (
              <div style={qr.wrap}>
                <img
                  src={qrUrl}
                  alt="QR chuyển khoản"
                  style={qr.img}
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
              </div>
            ) : (
              <div style={qr.noBank}>
                Chưa có thông tin ngân hàng<br />
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Cập nhật trong phần Chỉnh sửa</span>
              </div>
            )}

            {/* Thông tin tài khoản + copy */}
            {coNH && (
              <div style={qr.bankInfo}>
                <div style={qr.bankName}>{bank?.ten ?? cn.ngan_hang}</div>
                <div style={qr.stkRow}>
                  <span style={qr.stk}>{cn.so_tai_khoan}</span>
                  <button style={qr.copyBtn} onClick={() => copyText(cn.so_tai_khoan, 'STK')}>
                    Sao chép STK
                  </button>
                </div>
                {cn.ten_chu_tk && <div style={qr.tenTK}>{cn.ten_chu_tk}</div>}
              </div>
            )}

            {/* Mở app ngân hàng */}
            <div style={{ position: 'relative', marginBottom: 16 }}>
              <button
                style={qr.openAppBtn}
                onClick={() => setShowBankMenu((v) => !v)}
              >
                Mở app ngân hàng ▾
              </button>
              {showBankMenu && (
                <div style={qr.bankMenu}>
                  {NGAN_HANG_LIST.map((nh) => (
                    <button
                      key={nh.ma}
                      style={qr.bankMenuItem}
                      onClick={() => openBankApp(nh)}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg3)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {nh.ten}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 14, textAlign: 'center' }}>
              Sau khi chuyển khoản xong, nhấn nút bên dưới để ghi lại giao dịch.
            </div>

            {err && <div style={errStyle}>{err}</div>}

            <div style={actions}>
              <button className="btn-ghost" onClick={() => { setBuoc(1); setErr(''); }}>← Quay lại</button>
              <button
                className="btn-primary"
                style={{ background: 'var(--green)' }}
                onClick={handleXacNhan}
                disabled={tao.isPending}
              >
                {tao.isPending ? 'Đang lưu...' : '✓ Đã chuyển — Ghi lại'}
              </button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div style={toastStyle}>{toast}</div>
        )}
      </div>
    </div>
  );
}

const ov      = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 200 };
const modal   = { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: '20px 20px 0 0', padding: '24px 20px 32px', width: '100%', maxWidth: 520, maxHeight: '95vh', overflowY: 'auto', position: 'relative' };

const hd = {
  wrap:  { marginBottom: 20 },
  title: { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 8 },
  steps: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 },
  step:  { color: 'var(--text3)' },
  dash:  { color: 'var(--border2)', fontSize: 10 },
};

const f = {
  row: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px', marginBottom: 12 },
  col: { display: 'flex', flexDirection: 'column', gap: 4 },
};

const qr = {
  summary:  { textAlign: 'center', marginBottom: 16 },
  amount:   { fontSize: 28, fontWeight: 800, color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace" },
  meta:     { fontSize: 13, color: 'var(--text2)', marginTop: 2 },
  wrap:     { display: 'flex', justifyContent: 'center', marginBottom: 16 },
  img:      { width: 220, height: 220, borderRadius: 12, border: '1px solid var(--border2)', background: '#fff' },
  noBank:   { textAlign: 'center', padding: '32px 20px', color: 'var(--amber)', fontSize: 14, fontWeight: 600, background: 'rgba(255,179,68,0.08)', borderRadius: 12, marginBottom: 16, lineHeight: 1.6 },
  bankInfo: { background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', marginBottom: 12 },
  bankName: { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 },
  stkRow:   { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  stk:      { fontFamily: "'JetBrains Mono', monospace", fontSize: 16, fontWeight: 700, color: 'var(--text1)', flex: 1 },
  tenTK:    { fontSize: 12, color: 'var(--text2)', marginTop: 4 },
  copyBtn:  { fontSize: 11, padding: '5px 10px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 6, color: 'var(--accent)', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", whiteSpace: 'nowrap' },
  openAppBtn: { width: '100%', padding: '10px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, color: 'var(--text1)', fontSize: 13, cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif", fontWeight: 600, marginTop: 4 },
  bankMenu:   { position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 10, zIndex: 10, maxHeight: 240, overflowY: 'auto', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', marginTop: 4 },
  bankMenuItem: { display: 'block', width: '100%', padding: '10px 14px', background: 'transparent', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text1)', fontSize: 13, cursor: 'pointer', textAlign: 'left', fontFamily: "'Be Vietnam Pro', sans-serif", transition: 'background 0.1s' },
};

const actions   = { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 };
const errStyle  = { color: 'var(--red)', fontSize: 12, marginBottom: 10 };
const warn      = { fontSize: 12, color: 'var(--amber)', background: 'rgba(255,179,68,0.08)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 };
const toastStyle = { position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 20, padding: '8px 18px', fontSize: 13, color: 'var(--text1)', zIndex: 300, pointerEvents: 'none', whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.4)' };
