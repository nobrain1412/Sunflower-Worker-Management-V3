import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUserDetail } from '../../hooks/useUsers';
import QRModal from '../../components/QRModal';
import UserRatesPanel from './UserRatesPanel';

const ROLE_LABEL = {
  admin: 'Quản trị', quan_ly: 'Quản lý', vender: 'Vender',
  cong_tac_vien: 'Cộng tác viên', ke_toan: 'Kế toán',
};

const CO_QR_ROLES = ['vender', 'cong_tac_vien'];

export default function NhanVienDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: res, isLoading } = useUserDetail(parseInt(id, 10));
  const u = res?.data;
  const [qrModal, setQrModal] = useState(false);

  if (isLoading) return <div style={{ padding: 40, color: 'var(--text2)' }}>Đang tải...</div>;
  if (!u)        return <div style={{ padding: 40, color: 'var(--text3)' }}>Không tìm thấy.</div>;

  const showQrBtn = CO_QR_ROLES.includes(u.vai_tro);

  return (
    <div style={s.root}>
      <button className="btn-ghost" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start', fontSize: 12 }}>
        ← Quay lại
      </button>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.avatar}>{u.ho_ten?.[0] ?? '?'}</div>
          <div style={{ flex: 1 }}>
            <div style={s.name}>{u.ho_ten}</div>
            <div style={s.role}>{ROLE_LABEL[u.vai_tro] ?? u.vai_tro}</div>
          </div>
          {showQrBtn && (
            <button className="btn-ghost" style={{ fontSize: 12 }} onClick={() => setQrModal(true)}>
              📲 QR nhận tiền
            </button>
          )}
        </div>
        <div style={s.grid}>
          <Field label="Tên đăng nhập" value={u.ten_dang_nhap} />
          <Field label="SĐT" value={u.so_dien_thoai} />
          <Field label="Trạng thái" value={u.active ? 'Hoạt động' : 'Đã khoá'} />
          <Field label="Ngân hàng" value={u.ngan_hang} />
          <Field label="Số tài khoản" value={u.so_tai_khoan} mono />
          <Field label="Tên chủ TK" value={u.ten_chu_tk} />
        </div>
      </div>

      {(u.vai_tro === 'vender' || u.vai_tro === 'cong_tac_vien') && (
        <div style={s.card}>
          <UserRatesPanel userId={u.id} vaiTro={u.vai_tro} />
        </div>
      )}

      {qrModal && (
        <QRModal
          nganHang={u.ngan_hang}
          soTK={u.so_tai_khoan}
          tenChuTK={u.ten_chu_tk}
          tenNguoiNhan={u.ho_ten}
          onClose={() => setQrModal(false)}
        />
      )}
    </div>
  );
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div style={s.label}>{label}</div>
      <div style={{ ...s.value, fontFamily: mono ? "'JetBrains Mono', monospace" : undefined }}>
        {value || '—'}
      </div>
    </div>
  );
}

const s = {
  root: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: 'var(--bg1)', border: '1px solid var(--border)', borderRadius: 14, padding: '20px 24px' },
  header: { display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--border)' },
  avatar: { width: 56, height: 56, borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' },
  name: { fontSize: 18, fontWeight: 700, color: 'var(--text1)' },
  role: { fontSize: 13, color: 'var(--text3)', marginTop: 3 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px 24px' },
  label: { fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 },
  value: { fontSize: 14, color: 'var(--text1)' },
};
