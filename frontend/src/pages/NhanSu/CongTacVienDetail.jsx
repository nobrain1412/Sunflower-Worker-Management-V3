/**
 * Trang chi tiết Cộng tác viên — admin/quản lý click vào tên CTV
 * sẽ thấy danh sách công nhân CTV đó tuyển kèm:
 *   - số giờ làm (tổng và tháng hiện tại)
 *   - đủ điều kiện thanh toán 1 lần hay chưa (>=26 ngày công)
 *   - đã thanh toán mot_lan chưa
 *   - các kỳ thanh toán hàng tháng đã chi
 *   - số tiền cần thanh toán
 */
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../../hooks/useApi';

function fmt(n) { return Number(n || 0).toLocaleString('vi-VN') + 'đ'; }

function useCtvCongNhan(id) {
  return useQuery({
    queryKey: ['cong-tac-vien', id, 'cong-nhan'],
    queryFn:  () => api.get(`/users/cong-tac-vien/${id}/cong-nhan`),
    enabled:  !!id,
    staleTime: 15_000,
  });
}

export default function CongTacVienDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useCtvCongNhan(id);
  const ctv     = data?.data?.ctv ?? null;
  const cnList  = data?.data?.cong_nhan ?? [];
  const tong    = data?.data?.tong ?? {};

  if (isLoading) return <div style={s.center}>Đang tải...</div>;
  if (isError || !ctv) return (
    <div style={s.center}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>😕</div>
      <div style={{ color: 'var(--text1)', fontSize: 15 }}>Không tìm thấy cộng tác viên</div>
      <button className="btn-ghost" style={{ marginTop: 12 }} onClick={() => navigate('/nhan-su')}>← Quay lại</button>
    </div>
  );

  return (
    <div style={s.root}>
      <div style={s.breadcrumb}>
        <button style={s.back} onClick={() => navigate('/nhan-su')}>← Cộng tác viên</button>
        <span style={s.sep}>/</span>
        <span style={s.current}>{ctv.ho_ten}</span>
      </div>

      <div style={s.card}>
        <div style={s.profileRow}>
          <div style={s.avatar}>{ctv.ho_ten?.[0] ?? '?'}</div>
          <div style={{ flex: 1 }}>
            <div style={s.name}>{ctv.ho_ten}</div>
            <div style={s.sub}>
              {ctv.hinh_thuc_thanh_toan === 'hang_thang' ? '💸 Nhận hàng tháng' : '💰 Lấy 1 lần'}
              {' · '}Tiền công/người: <b>{fmt(ctv.tien_cong_moi_nguoi)}</b>
              {ctv.hinh_thuc_thanh_toan === 'hang_thang' && (
                <> · Đơn giá theo giờ: <b>{fmt(Math.round(ctv.don_gia_theo_gio))}</b></>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={s.kpiGrid}>
        <KpiCard label="Tổng CN tuyển"            value={tong.so_cn} color="var(--accent)" />
        <KpiCard label="Đủ điều kiện 1 lần"        value={tong.so_du_dieu_kien_mot_lan} color="var(--teal)" />
        <KpiCard label="Cần thanh toán 1 lần"      value={tong.so_can_thanh_toan_mot_lan} sub={fmt(tong.tong_tien_mot_lan)} color="var(--green)" />
        {ctv.hinh_thuc_thanh_toan === 'hang_thang' && (
          <KpiCard label="Cần TT tháng này" value={tong.so_can_thanh_toan_thang_nay} sub={fmt(tong.tong_tien_thang_nay)} color="var(--amber)" />
        )}
      </div>

      <div style={s.card}>
        <div style={s.cardTitle}>Danh sách công nhân ({cnList.length})</div>
        {cnList.length === 0 ? (
          <div style={s.empty}>Cộng tác viên này chưa tuyển công nhân nào.</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={s.table}>
              <thead>
                <tr>
                  {['Công nhân','Công ty','Trạng thái','Tổng giờ','Ngày công','Tháng này','Đủ ĐK 1 lần','TT 1 lần','TT hàng tháng','Cần TT'].map((h, i) => (
                    <th key={i} style={s.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cnList.map((cn) => (
                  <tr key={cn.id} style={s.tr}
                      onClick={() => navigate(`/cong-nhan/${cn.id}`)}>
                    <td style={s.td}>
                      <b style={{ color: 'var(--text1)' }}>{cn.ho_ten}</b>
                      {cn.so_dien_thoai && <div style={{ ...s.subText, fontSize: 10 }}>{cn.so_dien_thoai}</div>}
                    </td>
                    <td style={s.td}><span style={s.subText}>{cn.ten_cong_ty || '—'}</span></td>
                    <td style={s.td}>
                      <span className={`pill ${PILL_STATUS[cn.trang_thai] || 'pill-blue'}`}>
                        {LABEL_STATUS[cn.trang_thai] || cn.trang_thai}
                      </span>
                    </td>
                    <td style={s.td}><span style={s.mono}>{Number(cn.tong_gio).toFixed(1)}h</span></td>
                    <td style={s.td}><span style={s.mono}>{Number(cn.ngay_cong).toFixed(1)}</span></td>
                    <td style={s.td}><span style={s.mono}>{Number(cn.gio_thang_nay).toFixed(1)}h</span></td>
                    <td style={s.td}>
                      <span className={`pill ${cn.du_dieu_kien_mot_lan ? 'pill-green' : 'pill-blue'}`}>
                        {cn.du_dieu_kien_mot_lan ? '✓ Đủ' : 'Chưa'}
                      </span>
                    </td>
                    <td style={s.td}>
                      {cn.da_thanh_toan_mot_lan ? (
                        <span style={{ color: 'var(--green)', fontSize: 12 }}>✓ Đã trả</span>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 12 }}>Chưa</span>
                      )}
                    </td>
                    <td style={s.td}>
                      {cn.thanh_toan_hang_thang?.length > 0 ? (
                        <details>
                          <summary style={{ cursor: 'pointer', fontSize: 11, color: 'var(--text2)' }}>
                            {cn.thanh_toan_hang_thang.length} kỳ
                          </summary>
                          <div style={{ marginTop: 4 }}>
                            {cn.thanh_toan_hang_thang.map((t, i) => (
                              <div key={i} style={{ fontSize: 11, color: 'var(--text2)' }}>
                                T{t.thang}/{t.nam}: {fmt(t.so_tien)}
                              </div>
                            ))}
                          </div>
                        </details>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                    <td style={s.td}>
                      {(cn.so_tien_mot_lan + cn.so_tien_thang_nay) > 0 ? (
                        <span style={{ ...s.mono, color: 'var(--green)', fontWeight: 700 }}>
                          {fmt(cn.so_tien_mot_lan + cn.so_tien_thang_nay)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text3)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div style={{ ...s.kpiCard, borderTop: `3px solid ${color}` }}>
      <div style={s.kpiLabel}>{label}</div>
      <div style={{ ...s.kpiValue, color }}>{Number(value || 0)}</div>
      {sub && <div style={s.kpiSub}>{sub}</div>}
    </div>
  );
}

const PILL_STATUS = {
  dang_lam:  'pill-green',
  moi_vao:   'pill-blue',
  nghi_phep: 'pill-amber',
  nghi_viec: 'pill-red',
};
const LABEL_STATUS = {
  dang_lam: 'Đang làm', moi_vao: 'Mới vào', nghi_phep: 'Nghỉ phép', nghi_viec: 'Nghỉ việc',
};

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  center: { padding: '60px 24px', textAlign: 'center' },
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 8 },
  back: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text2)',
    fontSize: 13, fontFamily: "'Be Vietnam Pro', sans-serif" },
  sep: { color: 'var(--text3)' },
  current: { fontSize: 13, color: 'var(--text1)', fontWeight: 600 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: 18 },
  profileRow: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff' },
  name: { fontSize: 17, fontWeight: 700, color: 'var(--text1)' },
  sub: { fontSize: 12, color: 'var(--text2)', marginTop: 4 },
  kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 },
  kpiCard: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 },
  kpiLabel: { fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  kpiValue: { fontSize: 26, fontWeight: 700, fontFamily: "'JetBrains Mono', monospace", marginTop: 6 },
  kpiSub: { fontSize: 12, color: 'var(--text2)', marginTop: 4 },
  cardTitle: { fontSize: 13, fontWeight: 700, color: 'var(--text1)',
    marginBottom: 14, paddingBottom: 12, borderBottom: '1px solid var(--border)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase',
    letterSpacing: '0.06em', textAlign: 'left', padding: '0 12px 10px 0', borderBottom: '1px solid var(--border)' },
  tr: { borderBottom: '1px solid var(--border)', cursor: 'pointer' },
  td: { padding: '10px 12px 10px 0', verticalAlign: 'middle', fontSize: 12, color: 'var(--text2)' },
  subText: { fontSize: 12, color: 'var(--text2)' },
  mono: { fontSize: 12, color: 'var(--text1)', fontFamily: "'JetBrains Mono', monospace" },
  empty: { padding: 30, textAlign: 'center', color: 'var(--text3)', fontSize: 13 },
};
