import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Tooltip, ResponsiveContainer, Cell, PieChart, Pie,
} from 'recharts';
import BottomSheet from '../components/BottomSheet';
import AddCongNhanModal from './CongNhan/AddModal';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import { useHoatDongLienQuan, useHoatDongCuaToi } from '../hooks/useHoatDong';
import useIsMobile from '../hooks/useIsMobile';
import TodoWidget from '../components/TodoWidget';

const DONUT_COLORS = ['#4f7cff', '#7b5fff', '#2dd4bf', '#22c986', '#ffb344', '#ff5f72', '#545870'];

function timeAgo(ts) {
  if (!ts) return '';
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60)       return `${Math.floor(diff)}s trước`;
  if (diff < 3600)     return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86_400)   return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 7 * 86_400) return `${Math.floor(diff / 86_400)} ngày trước`;
  return new Date(ts).toLocaleDateString('vi-VN');
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('vi-VN') + 'đ';
}

// Ngày vào làm thực tế, không phải ngày nhập hồ sơ.
// Hồ sơ cũ chưa có ngay_vao_lam thì lùi về created_at — khớp COALESCE bên backend.
function ngayVao(cn) {
  return cn.ngay_vao_lam ?? cn.created_at ?? null;
}

function fmtNgayVao(cn) {
  const d = ngayVao(cn);
  return d ? new Date(d).toLocaleDateString('vi-VN') : '—';
}

// Công ty đã tắt vẫn có thể còn công nhân — đánh dấu để không nhầm là cty đang hoạt động
function tenCongTyHienThi(c) {
  return c.active === false ? `${c.ten_cong_ty} (đã ngừng)` : c.ten_cong_ty;
}

// Tài khoản đã khoá vẫn có thể là người tuyển của nhiều CN
function tenVenderHienThi(v) {
  return v.active === false ? `${v.ho_ten} (đã khoá)` : v.ho_ten;
}

function activityToText(a) {
  if (a.loai === 'cong_nhan')  return `${a.title} vừa được thêm vào hệ thống`;
  if (a.loai === 'giao_dich')  return `${a.sub === 'tam_ung' ? 'Tạm ứng' : a.sub === 'luong' ? 'Trả lương' : 'Giao dịch'} ${fmtMoney(a.so_tien)} — ${a.title}`;
  if (a.loai === 'thue_phong') return `${a.title} đã được xếp phòng ${a.sub}`;
  // Audit log từ hoat_dong_log đã có sẵn ghi_chu
  return a.ghi_chu || a.title || HOAT_DONG_LABEL[a.loai] || a.loai;
}

const HOAT_DONG_ICON = {
  chuyen_cong_ty: { icon: '🔄', color: 'var(--accent2)' },
  chuyen_cho_o:   { icon: '🏠', color: 'var(--teal)'    },
  hoan_ung:       { icon: '💰', color: 'var(--green)'   },
  bao_nghi_phep:  { icon: '🌴', color: 'var(--amber)'   },
  bao_nghi_viec:  { icon: '🚪', color: 'var(--red)'     },
  doi_trang_thai: { icon: '🔁', color: 'var(--accent)'  },
  cham_cong_batch:{ icon: '📅', color: 'var(--accent)'  },
  doi_nguoi_tuyen:{ icon: '👤', color: 'var(--accent2)' },
};
const HOAT_DONG_LABEL = {
  chuyen_cong_ty: 'Chuyển công ty',
  chuyen_cho_o:   'Đổi chỗ ở',
  hoan_ung:       'Hoàn ứng',
  bao_nghi_phep:  'Báo nghỉ phép',
  bao_nghi_viec:  'Báo nghỉ việc',
  doi_trang_thai: 'Đổi trạng thái',
  cham_cong_batch:'Cập nhật chấm công',
  doi_nguoi_tuyen:'Đổi người tuyển',
};

function activityIcon(loai) {
  if (loai === 'cong_nhan') return { icon: '👤', color: 'var(--accent)' };
  if (loai === 'giao_dich') return { icon: '💰', color: 'var(--amber)' };
  if (loai === 'thue_phong') return { icon: '🏠', color: 'var(--teal)' };
  if (HOAT_DONG_ICON[loai]) return HOAT_DONG_ICON[loai];
  return { icon: '📋', color: 'var(--accent2)' };
}

function ktxBucket(dangO, sucChua) {
  if (sucChua === 0) return 'empty';
  const pct = dangO / sucChua;
  if (pct >= 1)    return 'full';
  if (pct >= 0.7)  return 'ok';
  if (pct > 0)     return 'low';
  return 'empty';
}

const ROOM_COLOR = {
  full:  { bg: 'rgba(255,95,114,0.15)',  border: 'rgba(255,95,114,0.4)',  text: 'var(--red)'   },
  ok:    { bg: 'rgba(79,124,255,0.12)',  border: 'rgba(79,124,255,0.3)',  text: 'var(--accent)' },
  low:   { bg: 'rgba(34,201,134,0.12)', border: 'rgba(34,201,134,0.3)',  text: 'var(--green)'  },
  empty: { bg: 'rgba(84,88,112,0.15)',  border: 'var(--border)',          text: 'var(--text3)'  },
};

const TRANG_THAI_PILL = {
  dang_lam:  { cls: 'pill-green', label: 'Đang làm' },
  moi_vao:   { cls: 'pill-blue',  label: 'Mới vào'  },
  nghi_phep: { cls: 'pill-amber', label: 'Nghỉ phép' },
  nghi_viec: { cls: 'pill-red',   label: 'Nghỉ việc' },
};

/* ---- Sub-components ---- */
function KpiCard({ label, value, sub, color, icon }) {
  const icons = {
    users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="2"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
    check: <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><polyline points="22 4 12 14.01 9 11.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    new:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><line x1="12" y1="5" x2="12" y2="19" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/><line x1="5" y1="12" x2="19" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>,
    home:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><polyline points="9 22 9 12 15 12 15 22" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  };
  return (
    <div style={{ ...kpi.card, borderTopColor: color }}>
      <div style={kpi.row}>
        <div>
          <div style={kpi.label}>{label}</div>
          <div style={{ ...kpi.value, fontFamily: "'JetBrains Mono', monospace" }}>{value}</div>
          <div style={kpi.sub}>{sub}</div>
        </div>
        <div style={{ ...kpi.iconWrap, background: color + '1a', color }}>{icons[icon]}</div>
      </div>
    </div>
  );
}

const kpi = {
  card: {
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '18px 20px',
    borderTopWidth: 2, borderTopStyle: 'solid',
  },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  label: { fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  value: { fontSize: 28, fontWeight: 700, color: 'var(--text1)', lineHeight: 1 },
  sub:   { fontSize: 11, color: 'var(--text2)', marginTop: 6 },
  iconWrap: { width: 38, height: 38, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, fontFamily: "'JetBrains Mono', monospace" }}>
          {p.name === 'ngayCong' ? 'Ngày công' : 'OT'}: <b>{p.value}</b>
        </div>
      ))}
    </div>
  );
};

/* ---- Main Component — điều hướng theo role ---- */
export default function Dashboard() {
  const { isAdmin, isQuanLy } = useAuth();
  if (isAdmin)   return <AdminDashboard />;
  if (isQuanLy)  return <QuanLyDashboard />;
  return <VenderDashboard />;
}

/* ---- Admin: toàn bộ thông tin hệ thống ---- */
function AdminDashboard() {
  const navigate = useNavigate();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedCty, setExpandedCty] = useState(null);
  const [statRange,   setStatRange]   = useState('hom_nay');
  const [venderPage,  setVenderPage]  = useState(1);
  const isMobile = useIsMobile();

  const { data: dashRes, isLoading } = useDashboard();
  const dash = dashRes?.data ?? {};
  const kpiData = dash.kpi ?? {};
  const cnTheoCongTyRaw = dash.cn_theo_cong_ty ?? [];
  const cnTheoVender = dash.cn_theo_vender  ?? [];
  const cnVaoHomNay  = dash.cn_vao_hom_nay  ?? [];
  const gioiHanHomNay = dash.cn_vao_hom_nay_gioi_han ?? 0;
  const chuaPhanCong = dash.chua_phan_cong  ?? null;
  const khongNguoiTuyen = dash.khong_nguoi_tuyen ?? null;
  const baseHoatDong = dash.hoat_dong       ?? [];
  const phongKtx     = dash.phong_ktx       ?? [];

  // Hoạt động liên quan đến user đăng nhập (từ hoat_dong_log) — báo nghỉ, chuyển công ty,
  // hoàn ứng,... cho CN do họ tuyển/quản lý. Gộp với feed chung và sort theo thời gian.
  const { data: cuaToiRes } = useHoatDongLienQuan(15);
  const cuaToi = (cuaToiRes?.data ?? []).map((h) => ({
    loai: h.loai,
    id: `hdl-${h.id}`,
    title: h.cong_nhan_ten || '',
    ts: h.created_at,
    ghi_chu: h.ghi_chu,
  }));
  const hoatDong = [...baseHoatDong, ...cuaToi]
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, 15);

  // CN chưa gán công ty là một "nhóm" thật — nếu bỏ qua thì donut không cộng ra tổng CN.
  // id = 0 vì SERIAL của cong_ty bắt đầu từ 1, không đụng id thật.
  const cnTheoCongTy = useMemo(() => {
    if (!chuaPhanCong || chuaPhanCong.so_luong_cn === 0) return cnTheoCongTyRaw;
    return [...cnTheoCongTyRaw, { id: 0, ten_cong_ty: 'Chưa phân công', active: true, ...chuaPhanCong }];
  }, [cnTheoCongTyRaw, chuaPhanCong]);

  const [statCtyId, setStatCtyId] = useState(null);
  const ctyStat = cnTheoCongTy.find((c) => c.id === statCtyId) ?? cnTheoCongTy[0] ?? null;
  // Lấy thẳng từ KPI thay vì cộng dồn theo công ty: cộng dồn sẽ bỏ sót CN chưa phân công
  // và CN của công ty đã tắt, nên ô này từng lệch với "Mới vào tháng này".
  const tongHomNay   = Number(kpiData.cn_moi_hom_nay   ?? 0);
  const tongThangNay = Number(kpiData.cn_moi_thang_nay ?? 0);

  // KPI cards từ API
  const KPI = [
    { label: 'Tổng công nhân', value: kpiData.tong_cong_nhan ?? 0,
      sub: `+${kpiData.cn_moi_thang_nay ?? 0} tháng này`, color: 'var(--accent)', icon: 'users' },
    { label: 'Đang làm việc',  value: kpiData.dang_lam ?? 0,
      sub: kpiData.tong_cong_nhan
        ? `${Math.round((kpiData.dang_lam / kpiData.tong_cong_nhan) * 100)}% tổng số`
        : '—',
      color: 'var(--green)', icon: 'check' },
    { label: 'Mới vào tháng này', value: kpiData.cn_moi_thang_nay ?? 0,
      sub: (kpiData.cn_moi_thang_nay ?? 0) >= (kpiData.cn_moi_thang_truoc ?? 0)
        ? `↑${(kpiData.cn_moi_thang_nay ?? 0) - (kpiData.cn_moi_thang_truoc ?? 0)} so tháng trước`
        : `↓${(kpiData.cn_moi_thang_truoc ?? 0) - (kpiData.cn_moi_thang_nay ?? 0)} so tháng trước`,
      color: 'var(--teal)', icon: 'new' },
    { label: 'Công suất KTX',  value: `${kpiData.ktx_phan_tram ?? 0}%`,
      sub: `${kpiData.ktx_dang_o ?? 0}/${kpiData.ktx_tong_giuong ?? 0} giường`,
      color: 'var(--amber)', icon: 'home' },
  ];

  // Donut: tỉ lệ phân bổ công nhân theo công ty. Có cả công ty đã ngừng hoạt động
  // (vẫn còn CN) và nhóm chưa phân công, nên tổng donut khớp "Tổng công nhân".
  const DONUT_DATA = cnTheoCongTy
    .map((c, i) => ({
      name: tenCongTyHienThi(c),
      value: Number(c.so_luong_cn || 0),
      color: DONUT_COLORS[i % DONUT_COLORS.length],
    }))
    .filter((d) => d.value > 0);

  // CN không có người tuyển (thường do import Excel không khớp tên vender) không thuộc
  // vender nào — thêm một dòng riêng để cột "Vào hôm nay" cộng lại đúng bằng tổng.
  const venderRows = useMemo(() => {
    if (!khongNguoiTuyen || khongNguoiTuyen.so_luong_cn === 0) return cnTheoVender;
    return [...cnTheoVender, { id: null, ho_ten: 'Chưa rõ người tuyển', ...khongNguoiTuyen }];
  }, [cnTheoVender, khongNguoiTuyen]);

  // Phân trang bảng vender — 10 người/trang
  const VENDER_PER_PAGE = 10;
  const venderTotalPages = Math.max(1, Math.ceil(venderRows.length / VENDER_PER_PAGE));
  const venderPageSafe = Math.min(venderPage, venderTotalPages);
  const venderRowsPaged = useMemo(
    () => venderRows.slice((venderPageSafe - 1) * VENDER_PER_PAGE, venderPageSafe * VENDER_PER_PAGE),
    [venderRows, venderPageSafe],
  );

  // Group CN vào hôm nay theo công ty. Danh sách do BE lọc sẵn theo ngày vào làm —
  // trước đây lọc client-side từ "10 CN mới nhất" nên tối đa chỉ ra 10 người.
  const groupedByCty = cnVaoHomNay.reduce((acc, cn) => {
    const key = cn.ten_cong_ty || 'Chưa phân công';
    (acc[key] ||= []).push(cn);
    return acc;
  }, {});

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text2)' }}>Đang tải...</div>;

  return (
    <div style={s.root}>
      {/* KPI row */}
      <div className="kpi-grid">
        {KPI.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Row 2: Donut phân bổ + Thống kê theo công ty */}
      <div className="dash-row">
        <div style={{ ...s.card, flex: 1, minWidth: 0, overflow: 'hidden' }}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>Phân bổ công ty</div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={DONUT_DATA} dataKey="value" cx="50%" cy="50%" innerRadius={44} outerRadius={68} paddingAngle={3}>
                {DONUT_DATA.map((d) => <Cell key={d.name} fill={d.color} />)}
              </Pie>
              <Tooltip formatter={(v) => [`${v} người`, '']} contentStyle={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={s.donutLegend}>
            {DONUT_DATA.map((d) => (
              <div key={d.name} style={s.donutItem}>
                <span style={{ ...s.dot, background: d.color }} />
                <span style={s.donutLabel}>{d.name}</span>
                <span style={s.donutVal}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Thống kê công nhân theo công ty (Admin) */}
        <div style={{ ...s.card, flex: 2, minWidth: 0 }}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Thống kê công nhân</div>
              <div style={s.cardSub}>Tổng theo ngày & tháng — toàn hệ thống</div>
            </div>
            <div className="dash-stat-filters" style={{ display: 'flex', gap: 6 }}>
              <select style={ql.select} value={statRange} onChange={(e) => setStatRange(e.target.value)}>
                <option value="hom_nay">Hôm nay</option>
                <option value="thang_nay">Tháng này</option>
              </select>
              <select style={ql.select} value={statCtyId ?? ctyStat?.id ?? ''} onChange={(e) => setStatCtyId(parseInt(e.target.value, 10))}>
                {cnTheoCongTy.map((c) => <option key={c.id} value={c.id}>{tenCongTyHienThi(c)}</option>)}
              </select>
            </div>
          </div>
          <div className="dash-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={kpi.label}>Toàn hệ thống — {statRange === 'hom_nay' ? 'hôm nay' : 'tháng này'}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--accent)', fontFamily: "'JetBrains Mono', monospace" }}>
                +{statRange === 'hom_nay' ? tongHomNay : tongThangNay}
              </div>
              <div style={kpi.sub}>Tổng CN mới</div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={kpi.label}>{ctyStat ? tenCongTyHienThi(ctyStat) : '—'} — {statRange === 'hom_nay' ? 'hôm nay' : 'tháng này'}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--green)', fontFamily: "'JetBrains Mono', monospace" }}>
                +{statRange === 'hom_nay' ? Number(ctyStat?.vao_hom_nay ?? 0) : Number(ctyStat?.vao_thang_nay ?? 0)}
              </div>
              <div style={kpi.sub}>CN mới của công ty</div>
            </div>
            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={kpi.label}>{ctyStat ? tenCongTyHienThi(ctyStat) : '—'} — Tổng</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--teal)', fontFamily: "'JetBrains Mono', monospace" }}>
                {Number(ctyStat?.so_luong_cn ?? 0)}
              </div>
              <div style={kpi.sub}>Tổng CN trong công ty</div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 3: CN mới hôm nay + Bảng CN theo vender (ngang hàng) */}
      <div className="dash-row">
        <div style={{ ...s.card, flex: 1, minWidth: 320 }}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Công nhân mới hôm nay</div>
              <div style={s.cardSub}>Tổng <b style={{ color: 'var(--text1)' }}>{tongHomNay}</b> người
                {gioiHanHomNay > 0 && cnVaoHomNay.length >= gioiHanHomNay
                  ? ` — chỉ liệt kê ${gioiHanHomNay} người đầu`
                  : ''}
              </div>
            </div>
            <a href="/cong-nhan" style={s.viewAll}>Xem tất cả →</a>
          </div>
          {Object.keys(groupedByCty).length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)' }}>Hôm nay chưa có công nhân mới</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {Object.entries(groupedByCty).map(([cty, list]) => {
                const open = expandedCty === cty;
                return (
                  <div key={cty} style={{ borderBottom: '1px solid var(--border)' }}>
                    <button
                      onClick={() => setExpandedCty(open ? null : cty)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        width: '100%', background: 'none', border: 'none', cursor: 'pointer',
                        padding: '10px 0', color: 'var(--text1)',
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 0.15s', display: 'inline-block', color: 'var(--text3)' }}>▶</span>
                        {cty}
                      </span>
                      <span className="pill pill-blue">{list.length} người</span>
                    </button>
                    {open && (
                      isMobile ? (
                        <div style={md.groupList}>
                          {list.map((cn) => {
                            const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                            return (
                              <div key={cn.id} style={md.cnCard} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                                <div style={md.cnHead}>
                                  <div style={md.cnTitle}>{cn.ho_ten}</div>
                                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                                </div>
                                <div style={md.cnMeta}>
                                  <span>Vender: {cn.ten_nguoi_tuyen ?? '—'}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                      <table style={{ ...s.table, marginBottom: 8 }}>
                        <thead>
                          <tr>
                            <th style={s.th}>Họ tên</th>
                            <th style={s.th}>Vender</th>
                            <th style={s.th}>Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody>
                          {list.map((cn) => {
                            const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                            return (
                              <tr key={cn.id} style={s.tr} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                                <td style={s.td}><div style={{ ...s.cnName, color: 'var(--accent)' }}>{cn.ho_ten}</div></td>
                                <td style={s.td}>
                                  {cn.nguoi_tuyen_id ? (
                                    <a onClick={(e) => { e.stopPropagation(); navigate(`/nhan-vien/${cn.nguoi_tuyen_id}`); }}
                                       style={{ ...s.tdSub, color: 'var(--accent)', cursor: 'pointer' }}>
                                      {cn.ten_nguoi_tuyen ?? '—'}
                                    </a>
                                  ) : <span style={s.tdSub}>—</span>}
                                </td>
                                <td style={s.td}><span className={`pill ${pill.cls}`}>{pill.label}</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bảng CN theo vender */}
        <div style={{ ...s.card, flex: 1, minWidth: 320 }}>
          <div style={s.cardHeader}>
            <div>
              <div style={s.cardTitle}>Công nhân theo vender</div>
              <div style={s.cardSub}>Số CN mỗi người tuyển dụng đã đưa vào hệ thống</div>
            </div>
          </div>
          {isMobile ? (
            <div style={md.venderList}>
              {venderRows.length === 0 ? (
                <div style={{ padding: 14, fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu</div>
              ) : venderRowsPaged.map((v) => (
                <div key={v.id ?? 'khong-nguoi-tuyen'} style={md.venderCard}
                  onClick={() => v.id && navigate(`/nhan-vien/${v.id}`)}>
                  <div style={md.cnTitle}>{tenVenderHienThi(v)}</div>
                  <div style={md.venderMeta}>
                    <span>Tổng CN: <b>{Number(v.so_luong_cn || 0)}</b></span>
                    <span>Hôm nay: {Number(v.moi_hom_nay || 0) > 0 ? `+${Number(v.moi_hom_nay)}` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <table style={s.table}>
              <thead>
                <tr>
                  {['Vender / Quản lý', 'Tổng CN', 'Vào hôm nay'].map((h) => (
                    <th key={h} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {venderRows.length === 0 ? (
                  <tr><td colSpan={3} style={{ ...s.td, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Chưa có dữ liệu</td></tr>
                ) : venderRowsPaged.map((v) => (
                  <tr key={v.id ?? 'khong-nguoi-tuyen'} style={s.tr}
                    onClick={() => v.id && navigate(`/nhan-vien/${v.id}`)}>
                    <td style={s.td}>
                      <div style={{ ...s.cnName, color: v.id ? 'var(--accent)' : 'var(--text3)' }}>{tenVenderHienThi(v)}</div>
                    </td>
                    <td style={s.td}><span style={{ ...s.tdSub, fontFamily: "'JetBrains Mono', monospace", fontWeight: 600 }}>{Number(v.so_luong_cn || 0)}</span></td>
                    <td style={s.td}>
                      {Number(v.moi_hom_nay || 0) > 0
                        ? <span className="pill pill-green">+{Number(v.moi_hom_nay)}</span>
                        : <span style={s.tdSub}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {venderRows.length > VENDER_PER_PAGE && (
            <div style={s.venderPager}>
              <button
                style={{ ...s.pagerBtn, ...(venderPageSafe <= 1 ? s.pagerBtnDisabled : {}) }}
                disabled={venderPageSafe <= 1}
                onClick={() => setVenderPage((p) => Math.max(1, p - 1))}
              >‹ Trước</button>
              <span style={s.pagerInfo}>Trang {venderPageSafe}/{venderTotalPages}</span>
              <button
                style={{ ...s.pagerBtn, ...(venderPageSafe >= venderTotalPages ? s.pagerBtnDisabled : {}) }}
                disabled={venderPageSafe >= venderTotalPages}
                onClick={() => setVenderPage((p) => Math.min(venderTotalPages, p + 1))}
              >Sau ›</button>
            </div>
          )}
        </div>
      </div>

      {/* Todo widget + Activity row */}
      <div className="dash-row">
        <div style={{ ...s.card, flex: 1, minWidth: 320 }}>
          <TodoWidget />
        </div>
        <div style={{ ...s.card, flex: 1, minWidth: 220 }}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>Hoạt động gần đây</div>
          </div>
          <div style={s.activityList}>
            {hoatDong.length === 0 ? (
              <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động</div>
            ) : hoatDong.map((a, i) => {
              const ic = activityIcon(a.loai);
              return (
                <div key={`${a.loai}-${a.id}-${i}`} style={s.actItem}>
                  <div style={{ ...s.actDot, background: ic.color }} />
                  <div style={s.actBody}>
                    <div style={s.actText}><span style={{ marginRight: 6 }}>{ic.icon}</span>{activityToText(a)}</div>
                    <div style={s.actTime}>{timeAgo(a.ts)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div style={{ ...s.card, flex: 1, minWidth: 200 }}>
          <div style={s.cardHeader}>
            <div style={s.cardTitle}>KTX — Phòng</div>
          </div>
          <div style={s.roomGrid}>
            {phongKtx.length === 0 ? (
              <div style={{ gridColumn: 'span 2', padding: 12, fontSize: 12, color: 'var(--text3)' }}>Chưa có phòng</div>
            ) : phongKtx.map((r) => {
              const dangO = Number(r.dang_o || 0);
              const sucChua = Number(r.suc_chua || 0);
              const c = ROOM_COLOR[ktxBucket(dangO, sucChua)];
              return (
                <div key={r.id}
                     onClick={() => navigate(`/ktx?phong=${r.id}`)}
                     style={{ ...s.room, background: c.bg, border: `1px solid ${c.border}`, cursor: 'pointer' }}>
                  <div style={{ ...s.roomName, color: c.text }}>{r.ten_phong}</div>
                  <div style={{ ...s.roomCount, color: c.text, fontFamily: "'JetBrains Mono', monospace" }}>
                    {dangO}/{sucChua}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={s.roomLegend}>
            {[['full','Đầy','var(--red)'],['ok','Có chỗ','var(--accent)'],['low','Còn nhiều','var(--green)'],['empty','Trống','var(--text3)']].map(([,label,color]) => (
              <div key={label} style={s.roomLegendItem}>
                <span style={{ ...s.dot, background: color }} /><span style={s.legendText}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAB mobile */}
      <button style={s.fab} onClick={() => setShowAddSheet(true)} className="fab-mobile">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>

      {/* BottomSheet thêm CN */}
      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title="Thêm công nhân">
        <div style={bs.list}>
          {[
            { icon: '✍️', label: 'Nhập thủ công', sub: 'Điền form thông tin cá nhân', action: () => { setShowAddSheet(false); setShowAddModal(true); } },
            { icon: '🪪', label: 'Quét CCCD',     sub: 'Dùng camera chụp CCCD 2 mặt',  action: () => window.location.href = '/ocr/cccd' },
            { icon: '📋', label: 'Quét danh sách', sub: 'Chụp bảng danh sách viết tay', action: () => window.location.href = '/ocr/danh-sach' },
          ].map(({ icon, label, sub, action }) => (
            <button key={label} style={bs.item} onClick={action}>
              <div style={bs.itemIcon}>{icon}</div>
              <div>
                <div style={bs.itemLabel}>{label}</div>
                <div style={bs.itemSub}>{sub}</div>
              </div>
              <svg style={{ marginLeft: 'auto', color: 'var(--text3)' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* Modal thêm CN thủ công */}
      {showAddModal && <AddCongNhanModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

/* ---- Quản lý: dữ liệu theo công ty được chọn ---- */
function QuanLyDashboard() {
  const navigate = useNavigate();
  const { user, selectedCongTyId, chonCongTy } = useAuth();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [tabCN, setTabCN] = useState('cty');
  const isMobile = useIsMobile();
  const congTyIds = user?.cong_ty_ids ?? [];

  const { data: dashRes, isLoading } = useDashboard(selectedCongTyId ? { cong_ty_id: selectedCongTyId } : {});
  const dash = dashRes?.data ?? {};
  const kData = dash.kpi ?? {};
  const cnMoiNhat = dash.cn_moi_nhat ?? [];
  const congTyList = dash.cong_ty_list ?? [];

  const { data: hdRes } = useHoatDongLienQuan(15);
  const hoatDongQL = (hdRes?.data ?? []).map((h) => ({
    loai: h.loai, id: `hdl-${h.id}`, title: h.cong_nhan_ten || '', ts: h.created_at, ghi_chu: h.ghi_chu,
  }));

  const KPI_QL = [
    { label: 'Tổng công nhân', value: kData.tong_cong_nhan ?? 0, sub: 'Trong công ty này', color: 'var(--accent)', icon: 'users' },
    { label: 'Vào hôm nay',    value: kData.cn_moi_hom_nay ?? 0, sub: '', color: 'var(--green)', icon: 'new' },
    { label: 'Đang làm',       value: kData.dang_lam ?? 0, sub: '', color: 'var(--teal)', icon: 'check' },
    { label: 'Mới tháng này',  value: kData.cn_moi_thang_nay ?? 0, sub: '', color: 'var(--amber)', icon: 'home' },
  ];

  const cnList = tabCN === 'cty'
    ? cnMoiNhat
    : cnMoiNhat.filter((cn) => cn.ten_nguoi_tuyen === user?.ho_ten);

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text2)' }}>Đang tải...</div>;

  return (
    <div style={s.root}>
      {/* Header chọn công ty */}
      <div style={ql.header}>
        <div>
          <div style={ql.title}>Dashboard</div>
          <div style={ql.sub}>Dữ liệu công ty đang chọn</div>
        </div>
        {congTyList.length > 0 && (
          <select
            style={ql.select}
            value={selectedCongTyId ?? congTyList[0]?.id ?? ''}
            onChange={(e) => chonCongTy(parseInt(e.target.value, 10))}
          >
            {congTyList.map((c) => (
              <option key={c.id} value={c.id}>{c.ten_cong_ty}</option>
            ))}
          </select>
        )}
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        {KPI_QL.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* 2 bảng: CN theo công ty đang quản lý / CN do tôi tuyển */}
      <div style={s.card}>
        <div style={{ ...s.cardHeader, marginBottom: 8 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setTabCN('cty')}
              style={{
                background: tabCN === 'cty' ? 'var(--bg3)' : 'none',
                border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: tabCN === 'cty' ? 'var(--text1)' : 'var(--text3)',
                fontFamily: "'Be Vietnam Pro', sans-serif",
              }}
            >CN tại công ty</button>
            <button
              onClick={() => setTabCN('minh')}
              style={{
                background: tabCN === 'minh' ? 'var(--bg3)' : 'none',
                border: 'none', cursor: 'pointer', padding: '6px 12px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: tabCN === 'minh' ? 'var(--text1)' : 'var(--text3)',
                fontFamily: "'Be Vietnam Pro', sans-serif",
              }}
            >CN do tôi tuyển</button>
          </div>
          <a href="/cong-nhan" style={s.viewAll}>Xem tất cả →</a>
        </div>
        {isMobile ? (
          <div style={md.groupList}>
            {cnList.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'var(--text3)' }}>Chưa có dữ liệu</div>
            ) : cnList.map((cn) => {
              const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
              return (
                <div key={cn.id} style={md.cnCard} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                  <div style={md.cnHead}>
                    <div style={md.cnTitle}>{cn.ho_ten}</div>
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
                  </div>
                  <div style={md.cnMeta}>
                    <span>Ngày vào: {fmtNgayVao(cn)}</span>
                    <span>{tabCN === 'cty' ? `Vender: ${cn.ten_nguoi_tuyen ?? '—'}` : `Công ty: ${cn.ten_cong_ty ?? '—'}`}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Họ tên', 'Ngày vào', 'Trạng thái', tabCN === 'cty' ? 'Người tuyển' : 'Công ty'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cnList.length === 0 ? (
                <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--text3)', padding: 24 }}>Chưa có dữ liệu</td></tr>
              ) : cnList.map((cn) => {
                const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                return (
                  <tr key={cn.id} style={s.tr} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                    <td style={s.td}><div style={{ ...s.cnName, color: 'var(--accent)' }}>{cn.ho_ten}</div></td>
                    <td style={s.td}><span style={{ ...s.tdSub, fontFamily: "'JetBrains Mono', monospace" }}>{fmtNgayVao(cn)}</span></td>
                    <td style={s.td}><span className={`pill ${pill.cls}`}>{pill.label}</span></td>
                    <td style={s.td}><span style={s.tdSub}>{tabCN === 'cty' ? (cn.ten_nguoi_tuyen ?? '—') : (cn.ten_cong_ty ?? '—')}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Todo widget */}
      <div style={s.card}>
        <TodoWidget />
      </div>

      {/* Hoạt động gần đây — liên quan đến CN trong công ty user quản lý */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Hoạt động gần đây</div>
        </div>
        <div style={s.activityList}>
          {hoatDongQL.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động</div>
          ) : hoatDongQL.map((a, i) => {
            const ic = activityIcon(a.loai);
            return (
              <div key={`${a.loai}-${a.id}-${i}`} style={s.actItem}>
                <div style={{ ...s.actDot, background: ic.color }} />
                <div style={s.actBody}>
                  <div style={s.actText}><span style={{ marginRight: 6 }}>{ic.icon}</span>{activityToText(a)}</div>
                  <div style={s.actTime}>{timeAgo(a.ts)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB mobile */}
      <button style={s.fab} onClick={() => setShowAddSheet(true)} className="fab-mobile">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>

      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title="Thêm công nhân">
        <div style={bs.list}>
          {[
            { icon: '✍️', label: 'Nhập thủ công', sub: 'Điền form thông tin cá nhân', action: () => { setShowAddSheet(false); setShowAddModal(true); } },
            { icon: '🪪', label: 'Quét CCCD',      sub: 'Dùng camera chụp CCCD 2 mặt',  action: () => window.location.href = '/ocr/cccd' },
            { icon: '📋', label: 'Quét danh sách', sub: 'Chụp bảng danh sách viết tay', action: () => window.location.href = '/ocr/danh-sach' },
          ].map(({ icon, label, sub, action }) => (
            <button key={label} style={bs.item} onClick={action}>
              <div style={bs.itemIcon}>{icon}</div>
              <div><div style={bs.itemLabel}>{label}</div><div style={bs.itemSub}>{sub}</div></div>
              <svg style={{ marginLeft: 'auto', color: 'var(--text3)' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      </BottomSheet>
      {showAddModal && <AddCongNhanModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

/* ---- Vender: chỉ xem CN mình tuyển ---- */
function VenderDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showAddSheet, setShowAddSheet] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const isMobile = useIsMobile();

  const { data: dashRes, isLoading } = useDashboard();
  const dash = dashRes?.data ?? {};
  const kData = dash.kpi ?? {};
  const cnMoiNhat = dash.cn_moi_nhat ?? [];

  const { data: hdRes } = useHoatDongCuaToi(15);
  const hoatDongV = (hdRes?.data ?? []).map((h) => ({
    loai: h.loai, id: `hdl-${h.id}`, title: h.cong_nhan_ten || '', ts: h.created_at, ghi_chu: h.ghi_chu,
  }));

  const tong = Number(kData.tong_cong_nhan ?? 0);
  const dangLam = Number(kData.dang_lam ?? 0);
  const KPI_V = [
    { label: 'CN tôi tuyển',  value: tong, sub: 'Tổng cộng', color: 'var(--accent)', icon: 'users' },
    { label: 'Tháng này',     value: kData.moi_thang_nay ?? 0, sub: '', color: 'var(--green)', icon: 'new' },
    { label: 'Đang làm việc', value: dangLam, sub: tong > 0 ? `${Math.round((dangLam / tong) * 100)}% tổng số` : '—', color: 'var(--teal)', icon: 'check' },
  ];

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text2)' }}>Đang tải...</div>;

  // Cộng tác viên mới đăng ký chưa được phân quyền — hiện banner liên hệ admin.
  const isCongTacVien = user?.vai_tro === 'cong_tac_vien';

  return (
    <div style={s.root}>
      {isCongTacVien && (
        <div style={vd.noticeBanner}>
          <div style={vd.noticeIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
              <line x1="12" y1="8"  x2="12" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <line x1="12" y1="16" x2="12.01" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={vd.noticeTitle}>Tài khoản đang ở vai trò cộng tác viên</div>
            <div style={vd.noticeText}>
              Vui lòng liên hệ <b>Đăng VT</b> để được phân quyền nếu bạn là <b>Quản lý</b> hoặc <b>Vender</b>.
            </div>
          </div>
        </div>
      )}

      <div style={ql.header}>
        <div>
          <div style={ql.title}>Của tôi</div>
          <div style={ql.sub}>Công nhân do {user?.ho_ten} tuyển</div>
        </div>
        <button
          style={vd.addBtn}
          onClick={() => setShowAddSheet(true)}
          className="hide-mobile"
        >
          + Thêm công nhân
        </button>
      </div>

      {/* KPI */}
      <div className="kpi-grid">
        {KPI_V.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>

      {/* Danh sách CN mình tuyển */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Danh sách công nhân</div>
          <a href="/cong-nhan" style={s.viewAll}>Xem đầy đủ →</a>
        </div>
        {isMobile ? (
          <div style={md.groupList}>
            {cnMoiNhat.length === 0 ? (
              <div style={{ padding: 14, fontSize: 12, color: 'var(--text3)' }}>Chưa có công nhân</div>
            ) : cnMoiNhat.map((cn) => {
              const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
              return (
                <div key={cn.id} style={md.cnCard} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                  <div style={md.cnHead}>
                    <div style={md.cnTitle}>{cn.ho_ten}</div>
                    <span className={`pill ${pill.cls}`}>{pill.label}</span>
                  </div>
                  <div style={md.cnMeta}>
                    <span>SĐT: {cn.so_dien_thoai ?? '—'}</span>
                    <span>Ngày vào: {fmtNgayVao(cn)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                {['Họ tên', 'SĐT', 'Ngày vào', 'Trạng thái'].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cnMoiNhat.length === 0 ? (
                <tr><td colSpan={4} style={{ ...s.td, color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Chưa có công nhân</td></tr>
              ) : cnMoiNhat.map((cn) => {
                const pill = TRANG_THAI_PILL[cn.trang_thai] ?? TRANG_THAI_PILL.moi_vao;
                return (
                  <tr key={cn.id} style={s.tr} onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                    <td style={s.td}><div style={{ ...s.cnName, color: 'var(--accent)' }}>{cn.ho_ten}</div></td>
                    <td style={s.td}><span style={s.tdSub}>{cn.so_dien_thoai ?? '—'}</span></td>
                    <td style={s.td}><span style={{ ...s.tdSub, fontFamily: "'JetBrains Mono', monospace" }}>{fmtNgayVao(cn)}</span></td>
                    <td style={s.td}><span className={`pill ${pill.cls}`}>{pill.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Todo widget */}
      <div style={s.card}>
        <TodoWidget />
      </div>

      {/* Hoạt động của tôi */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <div style={s.cardTitle}>Hoạt động gần đây</div>
        </div>
        <div style={s.activityList}>
          {hoatDongV.length === 0 ? (
            <div style={{ padding: 16, fontSize: 12, color: 'var(--text3)' }}>Chưa có hoạt động</div>
          ) : hoatDongV.map((a, i) => {
            const ic = activityIcon(a.loai);
            return (
              <div key={`${a.loai}-${a.id}-${i}`} style={s.actItem}>
                <div style={{ ...s.actDot, background: ic.color }} />
                <div style={s.actBody}>
                  <div style={s.actText}><span style={{ marginRight: 6 }}>{ic.icon}</span>{activityToText(a)}</div>
                  <div style={s.actTime}>{timeAgo(a.ts)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAB mobile */}
      <button style={s.fab} onClick={() => setShowAddSheet(true)} className="fab-mobile">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
          <line x1="12" y1="5" x2="12" y2="19" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
          <line x1="5" y1="12" x2="19" y2="12" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
      </button>

      <BottomSheet open={showAddSheet} onClose={() => setShowAddSheet(false)} title="Thêm công nhân">
        <div style={bs.list}>
          {[
            { icon: '✍️', label: 'Nhập thủ công', sub: 'Điền form thông tin cá nhân', action: () => { setShowAddSheet(false); setShowAddModal(true); } },
            { icon: '🪪', label: 'Quét CCCD',      sub: 'Dùng camera chụp CCCD 2 mặt',  action: () => window.location.href = '/ocr/cccd' },
            { icon: '📋', label: 'Quét danh sách', sub: 'Chụp bảng danh sách viết tay', action: () => window.location.href = '/ocr/danh-sach' },
          ].map(({ icon, label, sub, action }) => (
            <button key={label} style={bs.item} onClick={action}>
              <div style={bs.itemIcon}>{icon}</div>
              <div><div style={bs.itemLabel}>{label}</div><div style={bs.itemSub}>{sub}</div></div>
              <svg style={{ marginLeft: 'auto', color: 'var(--text3)' }} width="16" height="16" viewBox="0 0 24 24" fill="none">
                <polyline points="9 18 15 12 9 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          ))}
        </div>
      </BottomSheet>
      {showAddModal && <AddCongNhanModal onClose={() => setShowAddModal(false)} />}
    </div>
  );
}

/* ---- Styles ---- */
const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: {
    background: 'var(--bg1)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '18px 20px',
  },
  cardHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  cardTitle:  { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cardSub:    { fontSize: 11, color: 'var(--text3)', marginTop: 2 },
  viewAll:    { fontSize: 12, color: 'var(--accent)', textDecoration: 'none', fontWeight: 500 },
  legend:     { display: 'flex', alignItems: 'center', marginTop: 12, fontSize: 11, color: 'var(--text2)' },
  legendText: { fontSize: 11, color: 'var(--text2)' },
  legendDot:  (c) => ({ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c, marginRight: 4 }),
  dot:        { display: 'inline-block', width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  donutLegend:{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 },
  donutItem:  { display: 'flex', alignItems: 'center', gap: 8 },
  donutLabel: { fontSize: 11, color: 'var(--text2)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' },
  donutVal:   { fontSize: 12, fontWeight: 700, color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace" },
  table:      { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'left', padding: '0 12px 10px 0', borderBottom: '1px solid var(--border)' },
  tr: { borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  td: { padding: '10px 12px 10px 0', verticalAlign: 'middle' },
  cnName: { fontSize: 13, fontWeight: 600, color: 'var(--text1)' },
  tdSub:  { fontSize: 12, color: 'var(--text2)' },
  venderPager: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 14, marginTop: 4, borderTop: '1px solid var(--border)' },
  pagerBtn: { padding: '6px 14px', fontSize: 12, fontWeight: 600, color: 'var(--text1)', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, cursor: 'pointer' },
  pagerBtnDisabled: { opacity: 0.4, cursor: 'not-allowed' },
  pagerInfo: { fontSize: 12, color: 'var(--text2)', fontFamily: "'JetBrains Mono', monospace", minWidth: 78, textAlign: 'center' },
  activityList: { display: 'flex', flexDirection: 'column', gap: 0 },
  actItem: { display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' },
  actDot:  { width: 8, height: 8, borderRadius: '50%', marginTop: 4, flexShrink: 0 },
  actBody: { flex: 1, minWidth: 0 },
  actText: { fontSize: 12, color: 'var(--text1)', lineHeight: 1.4 },
  actTime: { fontSize: 10, color: 'var(--text3)', marginTop: 3 },
  roomGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  room: { borderRadius: 8, padding: '8px 10px' },
  roomName:  { fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' },
  roomCount: { fontSize: 14, fontWeight: 700, marginTop: 2 },
  roomLegend: { display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 12 },
  roomLegendItem: { display: 'flex', alignItems: 'center', gap: 5 },
  fab: {
    position: 'fixed', bottom: 76, right: 20, zIndex: 300,
    width: 52, height: 52, borderRadius: '50%',
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    border: 'none', cursor: 'pointer',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(79,124,255,0.4)',
  },
};

const bs = {
  list: { display: 'flex', flexDirection: 'column', gap: 4, padding: '4px 0 8px' },
  item: {
    display: 'flex', alignItems: 'center', gap: 14,
    background: 'var(--bg2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '14px 16px', cursor: 'pointer',
    width: '100%', textAlign: 'left', transition: 'border-color 0.15s',
  },
  itemIcon:  { fontSize: 22, width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg3)', borderRadius: 10, flexShrink: 0 },
  itemLabel: { fontSize: 14, fontWeight: 600, color: 'var(--text1)' },
  itemSub:   { fontSize: 12, color: 'var(--text2)', marginTop: 2 },
};

// Styles cho QuanLy và Vender dashboard
const ql = {
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--text1)' },
  sub:   { fontSize: 12, color: 'var(--text3)', marginTop: 3 },
  select: {
    background: 'var(--bg3)', border: '1px solid var(--border2)',
    borderRadius: 8, color: 'var(--text1)', fontSize: 13,
    padding: '8px 12px', cursor: 'pointer', outline: 'none',
    fontFamily: "'Be Vietnam Pro', sans-serif",
  },
};

const vd = {
  addBtn: {
    background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    border: 'none', borderRadius: 8, color: '#fff',
    fontSize: 13, fontWeight: 600, padding: '9px 16px', cursor: 'pointer',
  },
  noticeBanner: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    background: 'rgba(255,179,68,0.08)',
    border: '1px solid rgba(255,179,68,0.3)',
    borderRadius: 12, padding: '14px 16px',
  },
  noticeIcon: {
    color: 'var(--amber)', flexShrink: 0, marginTop: 1, lineHeight: 0,
  },
  noticeTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--amber)', marginBottom: 4,
  },
  noticeText: {
    fontSize: 12.5, color: 'var(--text1)', lineHeight: 1.5,
  },
};

const md = {
  groupList: { display: 'flex', flexDirection: 'column', gap: 8 },
  cnCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    cursor: 'pointer',
  },
  cnHead: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cnTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)' },
  cnMeta: { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 12, color: 'var(--text2)' },
  venderList: { display: 'flex', flexDirection: 'column', gap: 8 },
  venderCard: {
    background: 'var(--bg2)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 12px',
    cursor: 'pointer',
  },
  venderMeta: { display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 12, color: 'var(--text2)' },
};
