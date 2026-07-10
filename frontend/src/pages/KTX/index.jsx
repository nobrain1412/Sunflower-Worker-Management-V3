import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useKtxList, useTaoKtx, useCapNhatKtx, useXoaKtx, usePhongList, useTaoPhong, useCapNhatPhong, useXoaPhong, useGiuongList, useCapNhatGiuong, useXepGiuong, useTraPhong, useChuyenPhongKtx, useSuaNgayVaoKtx, useXoaThuePhong, useHoaDonList, useTaoHoaDon, useHoaDonThangTruoc, useUngVienXepPhong } from '../../hooks/useKtx';
import { usePhongTroList, useTaoPhongTro, useCapNhatPhongTro, useXoaPhongTro, usePhongTroThue, useTraPhongTro, useChuyenPhongTro, useSuaNgayVaoPhongTro, useHoaDonPhongTro, useHoaDonThangTruocPhongTro, useTaoHoaDonPhongTro } from '../../hooks/usePhongTro';
import { useAuth } from '../../context/AuthContext';
import { isEmbeddableMapUrl, normalizeMapUrl } from '../../constants/mapUrl';
import MediaUploader from '../../components/MediaUploader';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }
function toMediaArray(v) {
  if (Array.isArray(v)) return v;
  return [];
}

function occupancy(soGiuong, soDangO, sucChua) {
  const used = Number(soGiuong ?? 0);
  const cap  = Number(sucChua ?? 1);
  const pct  = used > 0 ? (soDangO ?? 0) / cap : 0;
  if (pct === 0) return { label: 'Trống',    cls: 'empty', color: 'var(--text3)',  bg: 'rgba(84,88,112,0.12)',   border: 'var(--border)' };
  if (pct >= 1)  return { label: 'Đầy',      cls: 'full',  color: 'var(--red)',    bg: 'rgba(255,95,114,0.1)',   border: 'rgba(255,95,114,0.3)' };
  if (pct >= 0.7) return { label: 'Gần đầy', cls: 'high',  color: 'var(--amber)', bg: 'rgba(255,179,68,0.1)',   border: 'rgba(255,179,68,0.3)' };
  return                 { label: 'Còn chỗ', cls: 'ok',    color: 'var(--accent)', bg: 'rgba(79,124,255,0.1)', border: 'rgba(79,124,255,0.3)' };
}

// ─── Modal thêm KTX ───────────────────────────────────────
function AddKtxModal({ onClose }) {
  const tao = useTaoKtx();
  const [form, setForm] = useState({ ten: '', dia_chi: '', ghi_chu: '' });
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    if (!form.ten.trim()) { setErr('Vui lòng nhập tên khu'); return; }
    try { await tao.mutateAsync(form); onClose(); }
    catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Thêm khu KTX</div>
        {[['ten','Tên khu *'],['dia_chi','Địa chỉ'],['ghi_chu','Ghi chú']].map(([k, lb]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label className="form-label">{lb}</label>
            <input className="form-input" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
          </div>
        ))}
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Thêm khu'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal sửa thông tin KTX ──────────────────────────────
function EditKtxModal({ ktx, onClose }) {
  const capNhat = useCapNhatKtx(ktx.id);
  const [form, setForm] = useState({ ten: ktx.ten ?? '', dia_chi: ktx.dia_chi ?? '', ghi_chu: ktx.ghi_chu ?? '' });
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    if (!form.ten.trim()) { setErr('Vui lòng nhập tên khu'); return; }
    try {
      await capNhat.mutateAsync({ ten: form.ten.trim(), dia_chi: form.dia_chi || undefined, ghi_chu: form.ghi_chu || undefined });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Sửa thông tin khu KTX</div>
        {[['ten','Tên khu *'],['dia_chi','Địa chỉ'],['ghi_chu','Ghi chú']].map(([k, lb]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label className="form-label">{lb}</label>
            <input className="form-input" value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
          </div>
        ))}
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={capNhat.isPending}>{capNhat.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal thêm phòng ─────────────────────────────────────
function AddPhongModal({ ktxId, onClose }) {
  const tao = useTaoPhong(ktxId);
  const [form, setForm] = useState({ ten_phong: '', tang: '1', suc_chua: '6', tien_phong: '0', ghi_chu: '' });
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    if (!form.ten_phong.trim()) { setErr('Vui lòng nhập tên phòng'); return; }
    try {
      await tao.mutateAsync({
        ten_phong: form.ten_phong,
        tang: parseInt(form.tang, 10),
        suc_chua: parseInt(form.suc_chua, 10),
        tien_phong: parseFloat(form.tien_phong),
        ghi_chu: form.ghi_chu || undefined,
      });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Thêm phòng mới</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {[['ten_phong','Tên phòng *','text'],['tang','Tầng','number'],['suc_chua','Sức chứa (giường)','number'],['tien_phong','Tiền phòng (VNĐ/tháng)','number']].map(([k, lb, type]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">{lb}</label>
              <input className="form-input" type={type} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Ghi chú</label>
            <input className="form-input" value={form.ghi_chu} onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))} />
          </div>
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Thêm phòng'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal sửa phòng ──────────────────────────────────────
function EditPhongModal({ phong, ktxId, onClose }) {
  const capNhat = useCapNhatPhong(ktxId);
  const [form, setForm] = useState({
    ten_phong: phong.ten_phong ?? '',
    tang: String(phong.tang ?? 1),
    suc_chua: String(phong.suc_chua ?? 6),
    tien_phong: String(phong.tien_phong ?? 0),
    ghi_chu: phong.ghi_chu ?? '',
  });
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    if (!form.ten_phong.trim()) { setErr('Vui lòng nhập tên phòng'); return; }
    try {
      await capNhat.mutateAsync({
        phongId: phong.id,
        ten_phong: form.ten_phong.trim(),
        tang: parseInt(form.tang, 10),
        suc_chua: parseInt(form.suc_chua, 10),
        tien_phong: parseFloat(form.tien_phong),
        ghi_chu: form.ghi_chu || undefined,
      });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Sửa phòng — {phong.ten_phong}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          {[['ten_phong','Tên phòng *','text'],['tang','Tầng','number'],['suc_chua','Sức chứa (giường)','number'],['tien_phong','Tiền phòng (VNĐ/tháng)','number']].map(([k, lb, type]) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">{lb}</label>
              <input className="form-input" type={type} value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} />
            </div>
          ))}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <label className="form-label">Ghi chú</label>
            <input className="form-input" value={form.ghi_chu} onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))} />
          </div>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
          Tăng sức chứa sẽ tự thêm giường mới. Giảm sức chứa không xoá giường đã có người.
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={capNhat.isPending}>{capNhat.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal sửa giường ─────────────────────────────────────
function EditGiuongModal({ giuong, phongId, onClose }) {
  const capNhat = useCapNhatGiuong(phongId);
  const [form, setForm] = useState({ so_thu_tu: String(giuong.so_thu_tu ?? 1), ghi_chu: giuong.ghi_chu ?? '' });
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    try {
      await capNhat.mutateAsync({
        giuongId: giuong.id,
        so_thu_tu: parseInt(form.so_thu_tu, 10),
        ghi_chu: form.ghi_chu || null,
      });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 360 }}>
        <div style={M.title}>Sửa giường {giuong.so_thu_tu}</div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Số thứ tự giường</label>
          <input className="form-input" type="number" value={form.so_thu_tu} onChange={(e) => setForm((f) => ({ ...f, so_thu_tu: e.target.value }))} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Ghi chú</label>
          <input className="form-input" value={form.ghi_chu} onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))} placeholder="VD: giường tầng trên..." />
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={capNhat.isPending}>{capNhat.isPending ? 'Đang lưu...' : 'Lưu'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal xếp giường ─────────────────────────────────────
function XepGiuongModal({ giuong, phongId, onClose }) {
  const xep = useXepGiuong(phongId);
  const [search, setSearch] = useState('');
  const { data: ungVienRes } = useUngVienXepPhong(search);
  const cnList = ungVienRes?.data ?? [];
  const [congNhanId, setCongNhanId] = useState('');
  const [ngayVao, setNgayVao] = useState(new Date().toISOString().split('T')[0]);
  const [err, setErr] = useState('');

  async function handle() {
    setErr('');
    if (!congNhanId) { setErr('Vui lòng chọn công nhân'); return; }
    try {
      await xep.mutateAsync({ giuongId: giuong.id, cong_nhan_id: parseInt(congNhanId, 10), ngay_vao: ngayVao });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Xếp giường {giuong.so_thu_tu}</div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Tìm công nhân chưa có chỗ ở *</label>
          <input
            className="form-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Nhập tên, CCCD, SĐT..."
          />
          <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
            {cnList.length === 0 ? (
              <div style={{ padding: '10px 12px', fontSize: 12, color: 'var(--text3)' }}>Không có công nhân phù hợp để xếp phòng</div>
            ) : cnList.map((cn) => {
              const active = String(cn.id) === String(congNhanId);
              return (
                <button
                  key={cn.id}
                  type="button"
                  onClick={() => setCongNhanId(String(cn.id))}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    background: active ? 'rgba(79,124,255,0.12)' : 'transparent',
                    border: 'none',
                    borderBottom: '1px solid var(--border)',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    color: 'var(--text1)',
                    fontFamily: "'Be Vietnam Pro', sans-serif",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{cn.ho_ten}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                    {cn.ten_cong_ty ? `${cn.ten_cong_ty} · ` : ''}{cn.cccd ?? 'Không CCCD'} · {cn.so_dien_thoai ?? 'Không SĐT'}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Ngày vào</label>
          <input className="form-input" type="date" value={ngayVao} onChange={(e) => setNgayVao(e.target.value)} />
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={xep.isPending}>{xep.isPending ? 'Đang xếp...' : 'Xác nhận'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal sửa ngày vào (dùng chung KTX + phòng trọ) ──────
// Ngày vào quyết định số ngày ở → ảnh hưởng tiền phòng/điện/nước trên hoá đơn.
function SuaNgayVaoModal({ tenCongNhan, moTaNoiO, ngayVaoHienTai, ngayRa, dangLuu, onSave, onClose }) {
  const toInput = (d) => (d ? new Date(d).toISOString().split('T')[0] : '');
  const [ngayVao, setNgayVao] = useState(toInput(ngayVaoHienTai));
  const [err, setErr] = useState('');

  const ngayRaIso = toInput(ngayRa);
  const khongDoi = ngayVao === toInput(ngayVaoHienTai);

  async function handle() {
    setErr('');
    if (!ngayVao) { setErr('Vui lòng chọn ngày vào'); return; }
    try {
      await onSave(ngayVao);
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={M.modal}>
        <div style={M.title}>Sửa ngày vào — {tenCongNhan}</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
          {moTaNoiO}
          {ngayRaIso && <> · Đã trả phòng ngày <b>{new Date(ngayRa).toLocaleDateString('vi-VN')}</b></>}
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Ngày vào</label>
          <input className="form-input" type="date" value={ngayVao}
            max={ngayRaIso || undefined}
            onChange={(e) => setNgayVao(e.target.value)} />
        </div>
        <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 10 }}>
          ⚠ Đổi ngày vào sẽ làm tiền phòng, điện, nước của các tháng liên quan được chia lại theo số ngày ở.
        </div>
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={dangLuu || khongDoi}>
            {dangLuu ? 'Đang lưu...' : 'Lưu'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal hóa đơn điện nước ──────────────────────────────
function HoaDonModal({ phong, onClose }) {
  const tao = useTaoHoaDon(phong.id);
  const { data: hdRes } = useHoaDonList(phong.id);
  const hoaDonList = hdRes?.data ?? [];
  const now = new Date();
  const [form, setForm] = useState({
    thang: now.getMonth() + 1, nam: now.getFullYear(),
    dien_cu: 0, dien_moi: 0, don_gia_dien: 3000,
    nuoc_cu: 0, nuoc_moi: 0, don_gia_nuoc: 15000,
    tien_phong: phong.tien_phong ?? 0, ghi_chu: '',
  });
  const [tab, setTab] = useState('nhap');
  const [err, setErr] = useState('');

  // Tự động pre-fill dien_cu/nuoc_cu từ tháng trước
  const { data: prevRes } = useHoaDonThangTruoc(
    phong.id,
    parseInt(form.thang, 10),
    parseInt(form.nam, 10),
  );
  useEffect(() => {
    const prev = prevRes?.data;
    if (prev) {
      setForm((f) => ({
        ...f,
        dien_cu: Number(prev.dien_moi ?? 0),
        nuoc_cu: Number(prev.nuoc_moi ?? 0),
      }));
    }
  }, [prevRes]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handle() {
    setErr('');
    try {
      await tao.mutateAsync({
        thang: parseInt(form.thang, 10), nam: parseInt(form.nam, 10),
        dien_cu: parseFloat(form.dien_cu), dien_moi: parseFloat(form.dien_moi),
        don_gia_dien: parseFloat(form.don_gia_dien),
        nuoc_cu: parseFloat(form.nuoc_cu), nuoc_moi: parseFloat(form.nuoc_moi),
        don_gia_nuoc: parseFloat(form.don_gia_nuoc),
        tien_phong: parseFloat(form.tien_phong),
        ghi_chu: form.ghi_chu || undefined,
      });
      setTab('lich-su');
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  const tienDien = (form.dien_moi - form.dien_cu) * form.don_gia_dien;
  const tienNuoc = (form.nuoc_moi - form.nuoc_cu) * form.don_gia_nuoc;
  const tongCong  = tienDien + tienNuoc + Number(form.tien_phong);

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={M.title}>Hóa đơn — {phong.ten_phong}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['nhap','Nhập số'],['lich-su','Lịch sử']].map(([v, lb]) => (
              <button key={v} style={{ ...s.tab, ...(tab === v ? s.tabActive : {}) }} onClick={() => setTab(v)}>{lb}</button>
            ))}
          </div>
        </div>

        {tab === 'nhap' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['thang','Tháng','number'],['nam','Năm','number']].map(([k, lb, type]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label">{lb}</label>
                  <input className="form-input" type={type} name={k} value={form[k]} onChange={handleChange} />
                </div>
              ))}
            </div>
            {/* Điện */}
            <div style={M.section}>⚡ Điện</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['dien_cu','Số cũ (tự động)',true],['dien_moi','Số mới',false],['don_gia_dien','Đơn giá (đ/số)',false]].map(([k, lb, ro]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label">{lb}</label>
                  <input className="form-input" type="number" name={k} value={form[k]} onChange={handleChange}
                    readOnly={ro}
                    style={ro ? { background: 'var(--bg2)', color: 'var(--text3)' } : undefined} />
                </div>
              ))}
            </div>
            <div style={{ ...M.section, marginTop: 0 }}>💧 Nước</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['nuoc_cu','Số cũ (tự động)',true],['nuoc_moi','Số mới',false],['don_gia_nuoc','Đơn giá (đ/m³)',false]].map(([k, lb, ro]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label">{lb}</label>
                  <input className="form-input" type="number" name={k} value={form[k]} onChange={handleChange}
                    readOnly={ro}
                    style={ro ? { background: 'var(--bg2)', color: 'var(--text3)' } : undefined} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">Tiền phòng (đ/tháng)</label>
                <input className="form-input" type="number" name="tien_phong" value={form.tien_phong} onChange={handleChange} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">Ghi chú</label>
                <input className="form-input" name="ghi_chu" value={form.ghi_chu} onChange={handleChange} />
              </div>
            </div>
            {/* Preview tổng */}
            <div style={M.preview}>
              <div style={M.previewRow}><span>Tiền điện ({form.dien_moi - form.dien_cu} số × {Number(form.don_gia_dien).toLocaleString('vi-VN')}đ)</span><span>{fmt(tienDien)}</span></div>
              <div style={M.previewRow}><span>Tiền nước ({form.nuoc_moi - form.nuoc_cu} m³ × {Number(form.don_gia_nuoc).toLocaleString('vi-VN')}đ)</span><span>{fmt(tienNuoc)}</span></div>
              <div style={M.previewRow}><span>Tiền phòng</span><span>{fmt(form.tien_phong)}</span></div>
              <div style={{ ...M.previewRow, fontWeight: 700, color: 'var(--accent)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}><span>Tổng cộng</span><span>{fmt(tongCong)}</span></div>
            </div>
            {err && <div style={M.err}>{err}</div>}
            <div style={M.actions}>
              <button className="btn-ghost" onClick={onClose}>Hủy</button>
              <button className="btn-primary" onClick={handle} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Lưu hóa đơn'}</button>
            </div>
          </>
        )}

        {tab === 'lich-su' && (
          <>
            {hoaDonList.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)' }}>Chưa có hóa đơn nào</div>
            ) : (
              <div className="table-scroll">
                <table style={s.table}>
                  <thead><tr>
                    {['Tháng','Điện','Nước','Tiền phòng','Tổng'].map((h) => <th key={h} style={s.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {hoaDonList.map((hd) => (
                      <tr key={hd.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={s.td}>{hd.thang}/{hd.nam}</td>
                        <td style={s.td}>{fmt(hd.tien_dien)} <span style={{ color: 'var(--text3)', fontSize: 10 }}>({hd.dien_moi - hd.dien_cu} số)</span></td>
                        <td style={s.td}>{fmt(hd.tien_nuoc)} <span style={{ color: 'var(--text3)', fontSize: 10 }}>({hd.nuoc_moi - hd.nuoc_cu} m³)</span></td>
                        <td style={s.td}>{fmt(hd.tien_phong)}</td>
                        <td style={{ ...s.td, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {fmt(Number(hd.tien_dien) + Number(hd.tien_nuoc) + Number(hd.tien_phong))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn-ghost" onClick={onClose}>Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Modal chuyển phòng KTX ───────────────────────────────
function ChuyenPhongKtxModal({ giuong, phong, onClose }) {
  const { data: ktxRes } = useKtxList();
  const ktxList = ktxRes?.data ?? [];
  const [selKtxId, setSelKtxId] = useState('');
  const [selPhongId, setSelPhongId] = useState('');
  const { data: phongRes } = usePhongList(selKtxId || null);
  const phongList = phongRes?.data ?? [];
  const { data: giuongRes } = useGiuongList(selPhongId || null);
  const giuongListMoi = (giuongRes?.data ?? []).filter((g) => !g.cong_nhan_id);
  const [selGiuongId, setSelGiuongId] = useState('');
  const [ngayChuyen, setNgayChuyen] = useState(new Date().toISOString().split('T')[0]);
  const [err, setErr] = useState('');
  const chuyen = useChuyenPhongKtx(phong.id);

  const ngayChuyenDate = new Date(ngayChuyen);
  const soNgay = giuong.ngay_vao
    ? Math.max(0, Math.round((ngayChuyenDate - new Date(giuong.ngay_vao)) / 86_400_000))
    : 0;
  const soNgayThang = new Date(ngayChuyenDate.getFullYear(), ngayChuyenDate.getMonth() + 1, 0).getDate();
  const tienTamTinh = soNgay > 0 ? Math.round(Number(phong.tien_phong || 0) / soNgayThang * soNgay) : 0;

  async function handle() {
    setErr('');
    if (!selGiuongId) { setErr('Vui lòng chọn giường mới'); return; }
    try {
      await chuyen.mutateAsync({ congNhanId: giuong.cong_nhan_id, giuong_id: parseInt(selGiuongId, 10), ngay_chuyen: ngayChuyen });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 520 }}>
        <div style={M.title}>Chuyển phòng KTX — {giuong.cong_nhan_ten}</div>
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
          <span style={{ color: 'var(--text3)' }}>Đang ở:</span> Phòng <b>{phong.ten_phong}</b> · Giường {giuong.so_thu_tu} · Vào {giuong.ngay_vao ? new Date(giuong.ngay_vao).toLocaleDateString('vi-VN') : '—'}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="form-label">Ngày chuyển phòng</label>
          <input className="form-input" type="date" value={ngayChuyen} onChange={(e) => setNgayChuyen(e.target.value)} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-label">Khu KTX mới</label>
            <select className="form-input" value={selKtxId} onChange={(e) => { setSelKtxId(e.target.value); setSelPhongId(''); setSelGiuongId(''); }}>
              <option value="">— Chọn khu —</option>
              {ktxList.map((k) => <option key={k.id} value={k.id}>{k.ten}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Phòng mới</label>
            <select className="form-input" value={selPhongId} onChange={(e) => { setSelPhongId(e.target.value); setSelGiuongId(''); }} disabled={!selKtxId}>
              <option value="">— Chọn phòng —</option>
              {phongList.map((p) => <option key={p.id} value={p.id}>{p.ten_phong} ({p.so_dang_o ?? 0}/{p.suc_chua})</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="form-label">Giường mới *</label>
          <select className="form-input" value={selGiuongId} onChange={(e) => setSelGiuongId(e.target.value)} disabled={!selPhongId}>
            <option value="">— Chọn giường trống —</option>
            {giuongListMoi.map((g) => <option key={g.id} value={g.id}>Giường {g.so_thu_tu}{g.ghi_chu ? ` (${g.ghi_chu})` : ''}</option>)}
          </select>
          {selPhongId && giuongListMoi.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>Phòng này không còn giường trống</div>
          )}
        </div>
        {soNgay > 0 && (
          <div style={M.preview}>
            <div style={M.previewRow}><span>Số ngày ở phòng cũ</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{soNgay} ngày</span></div>
            <div style={M.previewRow}><span>Tiền phòng tạm tính</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmt(tienTamTinh)}</span></div>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>{fmt(phong.tien_phong)}/tháng ÷ {soNgayThang} ngày × {soNgay} ngày. Điện/nước tính riêng qua hóa đơn.</div>
          </div>
        )}
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={chuyen.isPending}>{chuyen.isPending ? 'Đang chuyển...' : 'Chuyển phòng'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal chuyển phòng trọ ───────────────────────────────
function ChuyenPhongTroModal({ thue, phongTroHienTai, onClose }) {
  const { data: ptRes } = usePhongTroList();
  const allPt = (ptRes?.data ?? []).filter((p) => p.id !== thue.phong_tro_id);
  const [selPtId, setSelPtId] = useState('');
  const [ngayChuyen, setNgayChuyen] = useState(new Date().toISOString().split('T')[0]);
  const [ghiChu, setGhiChu] = useState('');
  const [err, setErr] = useState('');
  const chuyen = useChuyenPhongTro();

  const ngayChuyenDate = new Date(ngayChuyen);
  const soNgay = thue.ngay_vao
    ? Math.max(0, Math.round((ngayChuyenDate - new Date(thue.ngay_vao)) / 86_400_000))
    : 0;
  const soNgayThang = new Date(ngayChuyenDate.getFullYear(), ngayChuyenDate.getMonth() + 1, 0).getDate();
  const tienTamTinh = soNgay > 0 && phongTroHienTai?.tien_phong > 0
    ? Math.round(Number(phongTroHienTai.tien_phong) / soNgayThang * soNgay)
    : 0;

  async function handle() {
    setErr('');
    if (!selPtId) { setErr('Vui lòng chọn phòng trọ mới'); return; }
    try {
      await chuyen.mutateAsync({ thueId: thue.id, phong_tro_id: parseInt(selPtId, 10), ngay_chuyen: ngayChuyen, ghi_chu: ghiChu || undefined });
      onClose();
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 460 }}>
        <div style={M.title}>Chuyển phòng trọ — {thue.cong_nhan_ten}</div>
        <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 12, color: 'var(--text2)' }}>
          <span style={{ color: 'var(--text3)' }}>Đang ở:</span> <b>{phongTroHienTai?.ten}</b> · Vào {thue.ngay_vao ? new Date(thue.ngay_vao).toLocaleDateString('vi-VN') : '—'}
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Ngày chuyển</label>
          <input className="form-input" type="date" value={ngayChuyen} onChange={(e) => setNgayChuyen(e.target.value)} />
        </div>
        <div style={{ marginBottom: 10 }}>
          <label className="form-label">Phòng trọ mới *</label>
          <select className="form-input" value={selPtId} onChange={(e) => setSelPtId(e.target.value)}>
            <option value="">— Chọn phòng trọ —</option>
            {allPt.map((p) => <option key={p.id} value={p.id}>{p.ten}{p.dia_chi ? ` · ${p.dia_chi}` : ''}</option>)}
          </select>
          {allPt.length === 0 && <div style={{ fontSize: 11, color: 'var(--amber)', marginTop: 4 }}>Không có phòng trọ nào khác</div>}
        </div>
        <div style={{ marginBottom: 14 }}>
          <label className="form-label">Ghi chú</label>
          <input className="form-input" value={ghiChu} onChange={(e) => setGhiChu(e.target.value)} placeholder="Lý do chuyển phòng..." />
        </div>
        {soNgay > 0 && (
          <div style={M.preview}>
            <div style={M.previewRow}><span>Số ngày ở phòng cũ</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{soNgay} ngày</span></div>
            {tienTamTinh > 0 && <div style={M.previewRow}><span>Tiền phòng tạm tính</span><span style={{ fontFamily: "'JetBrains Mono', monospace", fontWeight: 700 }}>{fmt(tienTamTinh)}</span></div>}
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 4 }}>Điện/nước tính riêng qua hóa đơn.</div>
          </div>
        )}
        {err && <div style={M.err}>{err}</div>}
        <div style={M.actions}>
          <button className="btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn-primary" onClick={handle} disabled={chuyen.isPending}>{chuyen.isPending ? 'Đang chuyển...' : 'Chuyển phòng'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal hóa đơn điện/nước phòng trọ ───────────────────
function HoaDonPhongTroModal({ phongTro, onClose }) {
  const now = new Date();
  const tao = useTaoHoaDonPhongTro(phongTro.id);
  const { data: hdRes } = useHoaDonPhongTro(phongTro.id);
  const hoaDonList = hdRes?.data ?? [];
  const [form, setForm] = useState({
    thang: now.getMonth() + 1, nam: now.getFullYear(),
    dien_cu: 0, dien_moi: 0, don_gia_dien: 3000,
    nuoc_cu: 0, nuoc_moi: 0, don_gia_nuoc: 15000,
    tien_phong: phongTro.tien_phong ?? 0, ghi_chu: '',
  });
  const [tab, setTab] = useState('nhap');
  const [err, setErr] = useState('');

  const { data: prevRes } = useHoaDonThangTruocPhongTro(
    phongTro.id, parseInt(form.thang, 10), parseInt(form.nam, 10),
  );
  useEffect(() => {
    const prev = prevRes?.data;
    if (prev) setForm((f) => ({ ...f, dien_cu: Number(prev.dien_moi ?? 0), nuoc_cu: Number(prev.nuoc_moi ?? 0) }));
  }, [prevRes]);

  function handleChange(e) { const { name, value } = e.target; setForm((f) => ({ ...f, [name]: value })); }

  async function handle() {
    setErr('');
    try {
      await tao.mutateAsync({
        thang: parseInt(form.thang, 10), nam: parseInt(form.nam, 10),
        dien_cu: parseFloat(form.dien_cu), dien_moi: parseFloat(form.dien_moi), don_gia_dien: parseFloat(form.don_gia_dien),
        nuoc_cu: parseFloat(form.nuoc_cu), nuoc_moi: parseFloat(form.nuoc_moi), don_gia_nuoc: parseFloat(form.don_gia_nuoc),
        tien_phong: parseFloat(form.tien_phong), ghi_chu: form.ghi_chu || undefined,
      });
      setTab('lich-su');
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  const tienDien = (form.dien_moi - form.dien_cu) * form.don_gia_dien;
  const tienNuoc = (form.nuoc_moi - form.nuoc_cu) * form.don_gia_nuoc;
  const tongCong  = tienDien + tienNuoc + Number(form.tien_phong);

  return (
    <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...M.modal, maxWidth: 620 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={M.title}>Hóa đơn — {phongTro.ten}</div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[['nhap','Nhập số'],['lich-su','Lịch sử']].map(([v, lb]) => (
              <button key={v} style={{ ...s.tab, ...(tab === v ? s.tabActive : {}) }} onClick={() => setTab(v)}>{lb}</button>
            ))}
          </div>
        </div>
        {tab === 'nhap' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['thang','Tháng','number'],['nam','Năm','number']].map(([k, lb, type]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label">{lb}</label>
                  <input className="form-input" type={type} name={k} value={form[k]} onChange={handleChange} />
                </div>
              ))}
            </div>
            <div style={M.section}>⚡ Điện</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['dien_cu','Số cũ (tự động)',true],['dien_moi','Số mới',false],['don_gia_dien','Đơn giá (đ/số)',false]].map(([k, lb, ro]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label">{lb}</label>
                  <input className="form-input" type="number" name={k} value={form[k]} onChange={handleChange}
                    readOnly={ro} style={ro ? { background: 'var(--bg2)', color: 'var(--text3)' } : undefined} />
                </div>
              ))}
            </div>
            <div style={{ ...M.section, marginTop: 0 }}>💧 Nước</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 14 }}>
              {[['nuoc_cu','Số cũ (tự động)',true],['nuoc_moi','Số mới',false],['don_gia_nuoc','Đơn giá (đ/m³)',false]].map(([k, lb, ro]) => (
                <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label className="form-label">{lb}</label>
                  <input className="form-input" type="number" name={k} value={form[k]} onChange={handleChange}
                    readOnly={ro} style={ro ? { background: 'var(--bg2)', color: 'var(--text3)' } : undefined} />
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">Tiền phòng (đ/tháng)</label>
                <input className="form-input" type="number" name="tien_phong" value={form.tien_phong} onChange={handleChange} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">Ghi chú</label>
                <input className="form-input" name="ghi_chu" value={form.ghi_chu} onChange={handleChange} />
              </div>
            </div>
            <div style={M.preview}>
              <div style={M.previewRow}><span>Tiền điện ({form.dien_moi - form.dien_cu} số × {Number(form.don_gia_dien).toLocaleString('vi-VN')}đ)</span><span>{fmt(tienDien)}</span></div>
              <div style={M.previewRow}><span>Tiền nước ({form.nuoc_moi - form.nuoc_cu} m³ × {Number(form.don_gia_nuoc).toLocaleString('vi-VN')}đ)</span><span>{fmt(tienNuoc)}</span></div>
              <div style={M.previewRow}><span>Tiền phòng</span><span>{fmt(form.tien_phong)}</span></div>
              <div style={{ ...M.previewRow, fontWeight: 700, color: 'var(--accent)', borderTop: '1px solid var(--border)', paddingTop: 8, marginTop: 4 }}><span>Tổng cộng</span><span>{fmt(tongCong)}</span></div>
            </div>
            {err && <div style={M.err}>{err}</div>}
            <div style={M.actions}>
              <button className="btn-ghost" onClick={onClose}>Hủy</button>
              <button className="btn-primary" onClick={handle} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Lưu hóa đơn'}</button>
            </div>
          </>
        )}
        {tab === 'lich-su' && (
          <>
            {hoaDonList.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)' }}>Chưa có hóa đơn nào</div>
            ) : (
              <div className="table-scroll">
                <table style={s.table}>
                  <thead><tr>{['Tháng','Điện','Nước','Tiền phòng','Tổng'].map((h) => <th key={h} style={s.th}>{h}</th>)}</tr></thead>
                  <tbody>
                    {hoaDonList.map((hd) => (
                      <tr key={hd.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={s.td}>{hd.thang}/{hd.nam}</td>
                        <td style={s.td}>{fmt(hd.tien_dien)} <span style={{ color: 'var(--text3)', fontSize: 10 }}>({hd.dien_moi - hd.dien_cu} số)</span></td>
                        <td style={s.td}>{fmt(hd.tien_nuoc)} <span style={{ color: 'var(--text3)', fontSize: 10 }}>({hd.nuoc_moi - hd.nuoc_cu} m³)</span></td>
                        <td style={s.td}>{fmt(hd.tien_phong)}</td>
                        <td style={{ ...s.td, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                          {fmt(Number(hd.tien_dien) + Number(hd.tien_nuoc) + Number(hd.tien_phong))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
              <button className="btn-ghost" onClick={onClose}>Đóng</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Chi tiết phòng ───────────────────────────────────────
function PhongDetail({ phong, ktxId, isAdmin }) {
  const navigate = useNavigate();
  const { data: giuongRes } = useGiuongList(phong.id);
  const giuongList = giuongRes?.data ?? [];
  const traPhong = useTraPhong(phong.id);
  const suaNgayVao = useSuaNgayVaoKtx(phong.id);
  const xoaThuePhong = useXoaThuePhong(phong.id);
  const [xepModal, setXepModal] = useState(null);
  const [editGiuong, setEditGiuong] = useState(null);
  const [editPhong, setEditPhong] = useState(false);
  const [hoaDonModal, setHoaDonModal] = useState(false);
  const [chuyenModal, setChuyenModal] = useState(null); // giuong object
  const [ngayVaoModal, setNgayVaoModal] = useState(null); // giuong object

  async function handleTra(tp) {
    if (!confirm(`Xác nhận trả phòng cho ${tp.cong_nhan_ten}?`)) return;
    await traPhong.mutateAsync({ thuephongId: tp.thue_phong_id, ngay_ra: new Date().toISOString().split('T')[0] });
  }

  // Gỡ = xếp nhầm, xoá hẳn bản ghi. Nói rõ khác biệt với "Trả" để không bấm nhầm.
  async function handleGo(tp) {
    const ok = confirm(
      `Gỡ ${tp.cong_nhan_ten} khỏi giường ${tp.so_thu_tu}?\n\n`
      + 'Dùng khi xếp nhầm phòng: bản ghi bị XOÁ HẲN, không tính tiền phòng những ngày đã ở.\n'
      + 'Nếu công nhân thực sự đã ở rồi mới chuyển đi, hãy dùng nút "Trả" thay vì nút này.',
    );
    if (!ok) return;
    try {
      await xoaThuePhong.mutateAsync({ thuephongId: tp.thue_phong_id });
    } catch (e) {
      alert(e?.message ?? 'Không gỡ được công nhân khỏi giường');
    }
  }

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={s.cardTitle}>Phòng {phong.ten_phong}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2 }}>
            {phong.so_dang_o ?? 0}/{phong.suc_chua} giường · Tiền phòng: {fmt(phong.tien_phong)}/tháng
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {isAdmin && <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditPhong(true)}>✏️ Sửa phòng</button>}
          <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setHoaDonModal(true)}>💡 Hóa đơn</button>
        </div>
      </div>
      <div style={s.bedsGrid}>
        {giuongList.map((g) => (
          <div key={g.id} style={{
            ...s.bed,
            background: g.cong_nhan_id ? 'rgba(79,124,255,0.1)' : 'var(--bg3)',
            border: `1px solid ${g.cong_nhan_id ? 'rgba(79,124,255,0.3)' : 'var(--border)'}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: g.cong_nhan_id ? 'var(--accent)' : 'var(--text3)', marginBottom: 4 }}>Giường {g.so_thu_tu}</div>
              {isAdmin && (
                <button title="Sửa giường" onClick={() => setEditGiuong(g)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1 }}>✏️</button>
              )}
            </div>
            {g.ghi_chu && <div style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 2 }}>{g.ghi_chu}</div>}
            {g.cong_nhan_id ? (
              <>
                <button
                  style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textAlign: 'left', fontFamily: "'Be Vietnam Pro', sans-serif", textDecoration: 'underline dotted' }}
                  onClick={() => navigate(`/cong-nhan/${g.cong_nhan_id}`)}
                >
                  {g.cong_nhan_ten}
                </button>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>Vào: {g.ngay_vao ? new Date(g.ngay_vao).toLocaleDateString('vi-VN') : '—'}</span>
                  <button title="Sửa ngày vào" onClick={() => setNgayVaoModal(g)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>✏️</button>
                </div>
                <div style={{ position: 'absolute', bottom: 10, right: 10, display: 'flex', gap: 5 }}>
                  <button style={{ ...s.assignBtn, position: 'static', color: 'var(--accent)', borderColor: 'rgba(79,124,255,0.3)' }} onClick={() => setChuyenModal(g)}>⇄ Chuyển</button>
                  <button style={{ ...s.assignBtn, position: 'static', color: 'var(--red)', borderColor: 'rgba(255,95,114,0.3)' }} onClick={() => handleTra(g)}>↩ Trả</button>
                  <button title="Gỡ khỏi giường (xếp nhầm)" style={{ ...s.assignBtn, position: 'static', color: 'var(--text3)', borderColor: 'var(--border2)' }} onClick={() => handleGo(g)}>🗑 Gỡ</button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>Trống</div>
                <button style={s.assignBtn} onClick={() => setXepModal(g)}>+ Xếp</button>
              </>
            )}
          </div>
        ))}
      </div>
      {xepModal && <XepGiuongModal giuong={xepModal} phongId={phong.id} onClose={() => setXepModal(null)} />}
      {ngayVaoModal && (
        <SuaNgayVaoModal
          tenCongNhan={ngayVaoModal.cong_nhan_ten}
          moTaNoiO={`Phòng ${phong.ten_phong} · Giường ${ngayVaoModal.so_thu_tu}`}
          ngayVaoHienTai={ngayVaoModal.ngay_vao}
          ngayRa={ngayVaoModal.ngay_ra}
          dangLuu={suaNgayVao.isPending}
          onSave={(ngay_vao) => suaNgayVao.mutateAsync({ thuephongId: ngayVaoModal.thue_phong_id, ngay_vao })}
          onClose={() => setNgayVaoModal(null)}
        />
      )}
      {chuyenModal && <ChuyenPhongKtxModal giuong={chuyenModal} phong={phong} onClose={() => setChuyenModal(null)} />}
      {editGiuong && <EditGiuongModal giuong={editGiuong} phongId={phong.id} onClose={() => setEditGiuong(null)} />}
      {editPhong && <EditPhongModal phong={phong} ktxId={ktxId} onClose={() => setEditPhong(false)} />}
      {hoaDonModal && <HoaDonModal phong={phong} onClose={() => setHoaDonModal(false)} />}
    </div>
  );
}

// ─── Main KTX page ────────────────────────────────────────
export default function KTX({ forcePhongTro = false }) {
  const { isAdmin, isQuanLy, user } = useAuth();
  const canUseKtx = isAdmin && !forcePhongTro;
  const canUsePhongTro = isAdmin || isQuanLy || user?.vai_tro === 'vender';
  const coQuyenXem = canUseKtx || canUsePhongTro;

  const { data: ktxRes, isLoading } = useKtxList(canUseKtx);
  const ktxList = ktxRes?.data ?? [];
  const xoaKtx = useXoaKtx();
  const xoaPhong = useXoaPhong(null);

  const [moduleTab,    setModuleTab]    = useState(forcePhongTro ? 'phong_tro' : 'ktx');  // 'ktx' | 'phong_tro'
  const [selectedKtxId, setSelectedKtxId] = useState(null);
  const [selectedPhongId, setSelectedPhongId] = useState(null);
  const [addKtxModal, setAddKtxModal] = useState(false);
  const [addPhongModal, setAddPhongModal] = useState(false);
  const [editKtxInfo, setEditKtxInfo] = useState(false);
  const [editingKtxMedia, setEditingKtxMedia] = useState(false);
  const [ktxMediaUrls, setKtxMediaUrls] = useState([]);

  const selectedKtx  = ktxList.find((k) => k.id === selectedKtxId) ?? ktxList[0] ?? null;
  const activeKtxId  = selectedKtx?.id ?? null;
  const capNhatKtx = useCapNhatKtx(activeKtxId);

  const { data: phongRes } = usePhongList(activeKtxId);
  const phongList = phongRes?.data ?? [];

  const selectedPhong = phongList.find((p) => p.id === selectedPhongId) ?? null;

  useEffect(() => {
    setKtxMediaUrls(toMediaArray(selectedKtx?.media_urls));
  }, [selectedKtx?.id]);

  // Group by floor
  const floors = [...new Set(phongList.map((p) => p.tang))].sort((a, b) => b - a);

  if (!coQuyenXem) {
    return (
      <div style={{ ...s.card, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, minHeight: 280, justifyContent: 'center' }}>
        <div style={{ fontSize: 36 }}>🔒</div>
        <div style={{ fontSize: 14, color: 'var(--text1)', fontWeight: 600 }}>Bạn chưa được cấp quyền xem ký túc xá</div>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Vui lòng liên hệ quản trị viên để được cấp quyền.</div>
      </div>
    );
  }

  if (isLoading && canUseKtx) return <div style={{ padding: 40, color: 'var(--text2)' }}>Đang tải...</div>;

  if (!canUseKtx && canUsePhongTro) {
    return (
      <div style={s.root}>
        <PhongTroSection canDelete={isAdmin || isQuanLy} />
      </div>
    );
  }

  return (
    <div style={s.root}>
      {/* Module tabs: KTX vs Phòng trọ */}
      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)' }}>
        {[['ktx','🏠 Ký túc xá'],['phong_tro','🏘️ Phòng trọ']].map(([v, lb]) => (
          <button key={v}
            onClick={() => setModuleTab(v)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '10px 16px', fontSize: 13, fontWeight: 600,
              color: moduleTab === v ? 'var(--accent)' : 'var(--text3)',
              borderBottom: moduleTab === v ? '2px solid var(--accent)' : '2px solid transparent',
              fontFamily: "'Be Vietnam Pro', sans-serif",
              marginBottom: -1,
            }}
          >{lb}</button>
        ))}
      </div>

      {moduleTab === 'phong_tro' ? <PhongTroSection canDelete={isAdmin || isQuanLy} /> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* KTX tabs */}
      <div style={s.kanTabs}>
        {ktxList.map((k) => (
          <div key={k.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <button
              style={{ ...s.kanTab, ...(activeKtxId === k.id ? s.kanTabActive : {}) }}
              onClick={() => { setSelectedKtxId(k.id); setSelectedPhongId(null); }}
            >
              🏠 {k.ten}
            </button>
            {isAdmin && activeKtxId === k.id && (
              <button
                title="Vô hiệu hoá khu này"
                onClick={async () => {
                  if (!window.confirm(`Vô hiệu hoá khu "${k.ten}"?`)) return;
                  try { await xoaKtx.mutateAsync(k.id); setSelectedKtxId(null); }
                  catch (e) { alert(e?.message ?? 'Lỗi'); }
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--red)',
                  cursor: 'pointer', fontSize: 14, padding: '4px 6px' }}
              >🗑</button>
            )}
          </div>
        ))}
        {isAdmin && (
          <button className="btn-primary" style={{ marginLeft: 'auto', padding: '7px 12px', fontSize: 12 }} onClick={() => setAddKtxModal(true)}>+ Thêm khu</button>
        )}
      </div>

      {ktxList.length === 0 ? (
        <div style={{ ...s.card, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 200, gap: 10 }}>
          <div style={{ fontSize: 32 }}>🏠</div>
          <div style={{ color: 'var(--text2)' }}>Chưa có khu KTX nào. Nhấn "+ Thêm khu" để tạo.</div>
        </div>
      ) : (
        <div className="ktx-main">
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={s.cardTitle}>Chi tiết khu KTX</div>
              {isAdmin && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditKtxInfo(true)}>✏️ Sửa thông tin</button>
                  <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setEditingKtxMedia((v) => !v)}>
                    {editingKtxMedia ? 'Đóng sửa ảnh' : 'Sửa ảnh KTX'}
                  </button>
                </div>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 8 }}>
              📍 {selectedKtx?.dia_chi || 'Chưa cập nhật địa chỉ'}
            </div>
            {selectedKtx?.ghi_chu && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{selectedKtx.ghi_chu}</div>}
            {Array.isArray(selectedKtx?.media_urls) && selectedKtx.media_urls.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(160px,1fr))', gap: 10, marginBottom: 10 }}>
                {selectedKtx.media_urls.map((url, idx) => (
                  <img key={`${selectedKtx.id}-${idx}`} src={url} alt={`KTX ${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }} />
                ))}
              </div>
            )}
            {isAdmin && editingKtxMedia && (
              <div>
                <label className="form-label">Ảnh KTX</label>
                <MediaUploader value={ktxMediaUrls} onChange={setKtxMediaUrls} folder="ktx" />
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                  <button
                    className="btn-primary"
                    style={{ fontSize: 12, padding: '6px 12px' }}
                    onClick={async () => {
                      await capNhatKtx.mutateAsync({ media_urls: ktxMediaUrls });
                      setEditingKtxMedia(false);
                    }}
                    disabled={capNhatKtx.isPending}
                  >
                    {capNhatKtx.isPending ? 'Đang lưu...' : 'Lưu ảnh KTX'}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Sơ đồ phòng */}
          <div style={s.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={s.cardTitle}>Sơ đồ phòng — {selectedKtx?.ten}</div>
              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => setAddPhongModal(true)}>+ Thêm phòng</button>
            </div>

            {phongList.length === 0 ? (
              <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--text3)' }}>Chưa có phòng nào trong khu này</div>
            ) : (
              floors.map((tang) => (
                <div key={tang} style={s.floorSection}>
                  <div style={s.floorLabel}>Tầng {tang}</div>
                  <div style={s.roomRow}>
                    {phongList.filter((p) => p.tang === tang).map((p) => {
                      const occ = occupancy(p.so_giuong_thuc, p.so_dang_o, p.suc_chua);
                      const isSelected = selectedPhongId === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedPhongId(isSelected ? null : p.id)}
                          style={{
                            ...s.roomCard,
                            background: occ.bg,
                            border: `1px solid ${isSelected ? occ.color : occ.border}`,
                            boxShadow: isSelected ? `0 0 0 2px ${occ.color}40` : 'none',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ ...s.roomId, color: occ.color }}>{p.ten_phong}</div>
                            {isAdmin && (
                              <button
                                title="Xoá phòng"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (!window.confirm(`Xoá phòng "${p.ten_phong}"?`)) return;
                                  try { await xoaPhong.mutateAsync(p.id); }
                                  catch (er) { alert(er?.message ?? 'Lỗi'); }
                                }}
                                style={{ background: 'transparent', border: 'none',
                                  color: 'var(--red)', cursor: 'pointer', fontSize: 12,
                                  padding: 0, lineHeight: 1 }}
                              >🗑</button>
                            )}
                          </div>
                          <div style={{ fontSize: 18, fontWeight: 700, color: occ.color, fontFamily: "'JetBrains Mono', monospace" }}>
                            {p.so_dang_o ?? 0}<span style={{ fontSize: 11, fontWeight: 400 }}>/{p.suc_chua}</span>
                          </div>
                          <div style={{ ...s.roomLabel, color: occ.color }}>{occ.label}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {/* Legend */}
            <div style={s.legend}>
              {[['var(--red)','Đầy'],['var(--amber)','Gần đầy'],['var(--accent)','Còn chỗ'],['var(--text3)','Trống']].map(([c, l]) => (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text2)' }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c, display: 'inline-block' }} />{l}
                </div>
              ))}
            </div>
          </div>

          {/* Chi tiết phòng */}
          {selectedPhong ? (
            <PhongDetail phong={selectedPhong} ktxId={activeKtxId} isAdmin={isAdmin} />
          ) : (
            <div style={{ ...s.card, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, minHeight: 200 }}>
              <div style={{ fontSize: 32 }}>🛏️</div>
              <div style={{ fontSize: 13, color: 'var(--text2)' }}>Chọn một phòng để xem chi tiết</div>
            </div>
          )}
        </div>
      )}

      </div>)}

      {addKtxModal  && <AddKtxModal  onClose={() => setAddKtxModal(false)} />}
      {editKtxInfo && selectedKtx && (
        <EditKtxModal ktx={selectedKtx} onClose={() => setEditKtxInfo(false)} />
      )}
      {addPhongModal && activeKtxId && (
        <AddPhongModal ktxId={activeKtxId} onClose={() => setAddPhongModal(false)} />
      )}
    </div>
  );
}

// ─── Phòng trọ — section dùng API thật ────────────────────
function PhongTroSection({ canDelete }) {
  const { data: ptRes, isLoading } = usePhongTroList();
  const list = ptRes?.data ?? [];
  const tao = useTaoPhongTro();
  const capNhat = useCapNhatPhongTro();
  const xoa = useXoaPhongTro();
  const traPhongTro = useTraPhongTro();
  const suaNgayVaoPt = useSuaNgayVaoPhongTro();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ten: '', dia_chi: '', map_url: '', chu_tro: '', sdt_chu_tro: '', so_phong: 0, ghi_chu: '', media_urls: [] });
  const [editing, setEditing] = useState(null);
  const [selectedPhongTro, setSelectedPhongTro] = useState(null);
  const [chuyenPtState, setChuyenPtState] = useState(null); // { thue, phongTro }
  const [hoaDonPtModal, setHoaDonPtModal] = useState(null); // phongTro object
  const [ngayVaoPtModal, setNgayVaoPtModal] = useState(null); // thue object
  const [err, setErr] = useState('');
  const { data: thueRes } = usePhongTroThue(selectedPhongTro?.id);
  const thueList = thueRes?.data ?? [];

  async function handleAdd() {
    setErr('');
    if (!form.ten.trim()) { setErr('Vui lòng nhập tên phòng trọ'); return; }
    try {
      await tao.mutateAsync({
        ten: form.ten.trim(),
        dia_chi: form.dia_chi || undefined,
        map_url: form.map_url ? normalizeMapUrl(form.map_url) : undefined,
        chu_tro: form.chu_tro || undefined,
        sdt_chu_tro: form.sdt_chu_tro || undefined,
        so_phong: parseInt(form.so_phong, 10) || 0,
        ghi_chu: form.ghi_chu || undefined,
        media_urls: toMediaArray(form.media_urls),
      });
      setForm({ ten: '', dia_chi: '', map_url: '', chu_tro: '', sdt_chu_tro: '', so_phong: 0, ghi_chu: '', media_urls: [] });
      setShowForm(false);
    } catch (e) { setErr(e?.message ?? 'Lỗi'); }
  }

  async function handleSaveEdit() {
    setErr('');
    if (!editing?.ten?.trim()) { setErr('Vui lòng nhập tên phòng trọ'); return; }
    try {
      await capNhat.mutateAsync({
        id: editing.id,
        ten: editing.ten.trim(),
        dia_chi: editing.dia_chi || undefined,
        map_url: editing.map_url ? normalizeMapUrl(editing.map_url) : undefined,
        chu_tro: editing.chu_tro || undefined,
        sdt_chu_tro: editing.sdt_chu_tro || undefined,
        so_phong: parseInt(editing.so_phong, 10) || 0,
        ghi_chu: editing.ghi_chu || undefined,
        media_urls: toMediaArray(editing.media_urls),
      });
      setEditing(null);
    } catch (e) {
      setErr(e?.message ?? 'Không thể cập nhật phòng trọ');
    }
  }

  async function handleXoa(id) {
    if (!confirm('Xóa phòng trọ này?')) return;
    try { await xoa.mutateAsync(id); }
    catch (e) { alert(e?.message ?? 'Lỗi'); }
  }

  return (
    <div style={s.card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={s.cardTitle}>Phòng trọ</div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Quản lý các phòng trọ thuê ngoài để gán công nhân thay vì KTX</div>
        </div>
        <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12 }} onClick={() => { setEditing(null); setShowForm((s) => !s); }}>
          {showForm ? 'Đóng' : '+ Thêm phòng trọ'}
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Tên phòng trọ *</label>
              <input className="form-input" value={form.ten} onChange={(e) => setForm((f) => ({ ...f, ten: e.target.value }))} placeholder="Trọ Anh Tuấn..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Số phòng</label>
              <input className="form-input" type="number" value={form.so_phong} onChange={(e) => setForm((f) => ({ ...f, so_phong: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Địa chỉ</label>
              <input className="form-input" value={form.dia_chi} onChange={(e) => setForm((f) => ({ ...f, dia_chi: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Google Maps URL (embed/share link)</label>
              <input className="form-input" value={form.map_url} onChange={(e) => setForm((f) => ({ ...f, map_url: e.target.value }))} placeholder="https://www.google.com/maps/embed?..." />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Tên chủ trọ</label>
              <input className="form-input" value={form.chu_tro} onChange={(e) => setForm((f) => ({ ...f, chu_tro: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">SĐT chủ trọ</label>
              <input className="form-input" value={form.sdt_chu_tro} onChange={(e) => setForm((f) => ({ ...f, sdt_chu_tro: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Ghi chú</label>
              <input className="form-input" value={form.ghi_chu} onChange={(e) => setForm((f) => ({ ...f, ghi_chu: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Ảnh phòng trọ</label>
              <MediaUploader value={toMediaArray(form.media_urls)} onChange={(urls) => setForm((f) => ({ ...f, media_urls: urls }))} folder="phong-tro" />
            </div>
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 12, marginTop: 8 }}>{err}</div>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
            <button className="btn-ghost" onClick={() => setShowForm(false)}>Hủy</button>
            <button className="btn-primary" onClick={handleAdd} disabled={tao.isPending}>{tao.isPending ? 'Đang lưu...' : 'Lưu'}</button>
          </div>
        </div>
      )}

      {editing && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text1)', marginBottom: 10 }}>Sửa phòng trọ — {editing.ten}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['ten', 'Tên phòng trọ *'], ['so_phong', 'Số phòng'], ['chu_tro', 'Tên chủ trọ'], ['sdt_chu_tro', 'SĐT chủ trọ']].map(([k, lb]) => (
              <div key={k} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label className="form-label">{lb}</label>
                <input className="form-input" value={editing[k] ?? ''} onChange={(e) => setEditing((f) => ({ ...f, [k]: e.target.value }))} />
              </div>
            ))}
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Địa chỉ</label>
              <input className="form-input" value={editing.dia_chi ?? ''} onChange={(e) => setEditing((f) => ({ ...f, dia_chi: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Google Maps URL</label>
              <input className="form-input" value={editing.map_url ?? ''} onChange={(e) => setEditing((f) => ({ ...f, map_url: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Ghi chú</label>
              <input className="form-input" value={editing.ghi_chu ?? ''} onChange={(e) => setEditing((f) => ({ ...f, ghi_chu: e.target.value }))} />
            </div>
            <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label className="form-label">Ảnh phòng trọ</label>
              <MediaUploader value={toMediaArray(editing.media_urls)} onChange={(urls) => setEditing((f) => ({ ...f, media_urls: urls }))} folder="phong-tro" />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 8 }}>
            <button className="btn-ghost" onClick={() => setEditing(null)}>Hủy</button>
            <button className="btn-primary" onClick={handleSaveEdit} disabled={capNhat.isPending}>{capNhat.isPending ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text3)' }}>Đang tải...</div>
      ) : list.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text3)' }}>
          Chưa có phòng trọ nào. Nhấn "+ Thêm phòng trọ" để tạo.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
          {list.map((p) => (
            <div key={p.id} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)' }}>{p.ten}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{p.dia_chi || '—'}</div>
                </div>
                {canDelete && (
                  <button onClick={() => handleXoa(p.id)} style={{ background: 'none', border: 'none', color: 'var(--red)', cursor: 'pointer', fontSize: 12 }}>✕</button>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                <div>👤 Chủ trọ: <b style={{ color: 'var(--text1)' }}>{p.chu_tro || '—'}</b></div>
                <div>📞 SĐT: <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{p.sdt_chu_tro || '—'}</span></div>
                <div>🛏️ Số phòng: {p.so_phong || 0}</div>
              </div>
              {p.map_url && (
                isEmbeddableMapUrl(p.map_url) ? (
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                    <iframe
                      src={normalizeMapUrl(p.map_url)}
                      width="100%" height="160"
                      style={{ border: 0 }}
                      loading="lazy"
                      title={`map-${p.id}`}
                    />
                  </div>
                ) : (
                  <a href={p.map_url} target="_blank" rel="noreferrer" className="btn-ghost">
                    Mở vị trí trên Google Maps
                  </a>
                )
              )}
              {Array.isArray(p.media_urls) && p.media_urls.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {p.media_urls.slice(0, 3).map((url, idx) => (
                    <img key={`${p.id}-thumb-${idx}`} src={url} alt={`Ảnh phòng trọ ${idx + 1}`} style={{ width: '100%', height: 66, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                  ))}
                </div>
              )}
              {p.ghi_chu && <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>{p.ghi_chu}</div>}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 4 }}>
                <button className="btn-ghost" style={{ fontSize: 11, padding: '4px 8px' }} onClick={() => setSelectedPhongTro(p)}>
                  Xem chi tiết
                </button>
                <button
                  className="btn-ghost"
                  style={{ fontSize: 11, padding: '4px 8px' }}
                  onClick={() => {
                    setShowForm(false);
                    setEditing({
                      ...p,
                      media_urls: toMediaArray(p.media_urls),
                    });
                  }}
                >
                  Sửa
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {chuyenPtState && (
        <ChuyenPhongTroModal
          thue={chuyenPtState.thue}
          phongTroHienTai={chuyenPtState.phongTro}
          onClose={() => { setChuyenPtState(null); setSelectedPhongTro(null); }}
        />
      )}
      {hoaDonPtModal && (
        <HoaDonPhongTroModal phongTro={hoaDonPtModal} onClose={() => setHoaDonPtModal(null)} />
      )}
      {selectedPhongTro && (
        <div style={M.overlay} onClick={(e) => e.target === e.currentTarget && setSelectedPhongTro(null)}>
          <div style={{ ...M.modal, maxWidth: 700 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={M.title}>Chi tiết phòng trọ — {selectedPhongTro.ten}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setHoaDonPtModal(selectedPhongTro)}>💡 Hóa đơn</button>
                <button className="btn-ghost" onClick={() => setSelectedPhongTro(null)}>Đóng</button>
              </div>
            </div>
            {Array.isArray(selectedPhongTro.media_urls) && selectedPhongTro.media_urls.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(180px,1fr))', gap: 8, marginBottom: 12 }}>
                {selectedPhongTro.media_urls.map((url, idx) => (
                  <img key={`${selectedPhongTro.id}-media-${idx}`} src={url} alt={`media-${idx + 1}`} style={{ width: '100%', height: 120, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, color: 'var(--text1)', marginBottom: 8, fontWeight: 600 }}>Danh sách công nhân đang ở ({thueList.filter((t) => !t.ngay_ra).length})</div>
            <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
              {thueList.length === 0 ? (
                <div style={{ padding: '12px 14px', color: 'var(--text3)', fontSize: 12 }}>Chưa có công nhân nào trong phòng trọ này.</div>
              ) : thueList.map((t) => (
                <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text1)', fontWeight: 600 }}>{t.cong_nhan_ten}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span>Vào: {t.ngay_vao ? new Date(t.ngay_vao).toLocaleDateString('vi-VN') : '—'}</span>
                      <button title="Sửa ngày vào" onClick={() => setNgayVaoPtModal(t)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 10, padding: 0, lineHeight: 1 }}>✏️</button>
                      <span>· {t.so_dien_thoai || 'Không SĐT'}</span>
                    </div>
                  </div>
                  {!t.ngay_ra ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, color: 'var(--accent)' }}
                        onClick={() => setChuyenPtState({ thue: t, phongTro: selectedPhongTro })}
                      >
                        ⇄ Chuyển
                      </button>
                      <button
                        className="btn-ghost"
                        style={{ fontSize: 11, color: 'var(--red)' }}
                        onClick={async () => {
                          await traPhongTro.mutateAsync({ thueId: t.id, ngay_ra: new Date().toISOString().split('T')[0] });
                        }}
                      >
                        ↩ Trả
                      </button>
                    </div>
                  ) : (
                    <span style={{ fontSize: 11, color: 'var(--text3)' }}>Đã rời {t.ngay_ra ? new Date(t.ngay_ra).toLocaleDateString('vi-VN') : ''}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {/* Đặt sau overlay "Chi tiết phòng trọ" để nổi lên trên nó */}
      {ngayVaoPtModal && (
        <SuaNgayVaoModal
          tenCongNhan={ngayVaoPtModal.cong_nhan_ten}
          moTaNoiO={selectedPhongTro?.ten ?? 'Phòng trọ'}
          ngayVaoHienTai={ngayVaoPtModal.ngay_vao}
          ngayRa={ngayVaoPtModal.ngay_ra}
          dangLuu={suaNgayVaoPt.isPending}
          onSave={(ngay_vao) => suaNgayVaoPt.mutateAsync({ thueId: ngayVaoPtModal.id, ngay_vao })}
          onClose={() => setNgayVaoPtModal(null)}
        />
      )}
    </div>
  );
}

const s = {
  root:    { display: 'flex', flexDirection: 'column', gap: 14 },
  kanTabs: { display: 'flex', gap: 8, alignItems: 'center' },
  kanTab:  { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 600, color: 'var(--text2)', cursor: 'pointer', fontFamily: "'Be Vietnam Pro', sans-serif" },
  kanTabActive: { background: 'rgba(79,124,255,0.1)', borderColor: 'rgba(79,124,255,0.4)', color: 'var(--accent)' },
  card:    { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '18px 20px' },
  cardTitle:{ fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  floorSection: { marginBottom: 16 },
  floorLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 },
  roomRow: { display: 'flex', gap: 10, flexWrap: 'wrap' },
  roomCard: { borderRadius: 10, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s', minWidth: 90, textAlign: 'center' },
  roomId:  { fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', marginBottom: 4 },
  roomLabel: { fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 },
  legend:  { display: 'flex', gap: 14, marginTop: 12 },
  bedsGrid:{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 },
  bed:     { borderRadius: 10, padding: '12px 14px', position: 'relative', minHeight: 80 },
  assignBtn: { position: 'absolute', bottom: 10, right: 10, background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 6, fontSize: 11, color: 'var(--accent)', cursor: 'pointer', padding: '3px 8px', fontFamily: "'Be Vietnam Pro', sans-serif" },
  tab:     { background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--text3)', padding: '5px 10px', borderRadius: 7, fontFamily: "'Be Vietnam Pro', sans-serif" },
  tabActive:{ background: 'var(--bg3)', color: 'var(--text1)' },
  table:   { width: '100%', borderCollapse: 'collapse' },
  th:      { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 12px 10px 0', borderBottom: '1px solid var(--border)', textAlign: 'left' },
  td:      { padding: '10px 12px 10px 0', verticalAlign: 'middle', fontSize: 12, color: 'var(--text1)' },
};

const M = {
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 },
  modal:    { background: 'var(--bg1)', border: '1px solid var(--border2)', borderRadius: 16, padding: '24px 28px', width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' },
  title:    { fontSize: 15, fontWeight: 700, color: 'var(--text1)', marginBottom: 16 },
  section:  { fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  preview:  { background: 'var(--bg3)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 },
  previewRow: { display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text2)', padding: '4px 0' },
  err:      { color: 'var(--red)', fontSize: 12, marginBottom: 8 },
  actions:  { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
};
