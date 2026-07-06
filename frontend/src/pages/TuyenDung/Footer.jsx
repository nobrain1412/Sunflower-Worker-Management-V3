import { FOOTER_COLS } from './tuyenDungData';
import Logo from './Logo';

export default function Footer() {
  return (
    <footer style={s.footer}>
      <div style={s.cols}>
        <div>
          <Logo size={32} fontSize={23} />
          <p style={s.desc}>
            Nền tảng kết nối việc làm hàng đầu, giúp ứng viên và doanh nghiệp tìm thấy nhau
            nhanh chóng, minh bạch.
          </p>
          <p style={s.hotline}>Hotline: 1900 6868 · hotro@sunflower.vn</p>
        </div>
        {FOOTER_COLS.map((fc) => (
          <div key={fc.title}>
            <div style={s.colTitle}>{fc.title}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {fc.links.map((lk) => (
                <a key={lk} href="#" className="sf-footlink" onClick={(e) => e.preventDefault()} style={s.link}>{lk}</a>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ borderTop: '1px solid var(--sf-brd)' }}>
        <div style={s.bottom}>
          <span>© 2026 Sunflower JSC. Bảo lưu mọi quyền.</span>
          <span>Điều khoản · Chính sách bảo mật</span>
        </div>
      </div>
    </footer>
  );
}

const s = {
  footer: { marginTop: 'clamp(40px,6vw,72px)', background: 'var(--sf-surface)', borderTop: '1px solid var(--sf-brd)' },
  cols: {
    maxWidth: 1180, margin: '0 auto', padding: 'clamp(32px,5vw,52px) 20px 24px',
    display: 'grid', gridTemplateColumns: 'var(--sf-footer-cols)', gap: 32,
  },
  desc: { margin: '14px 0 0', fontSize: 13.5, color: 'var(--sf-muted)', lineHeight: 1.7, maxWidth: 340 },
  hotline: { margin: '12px 0 0', fontSize: 13, color: 'var(--sf-muted)' },
  colTitle: { fontSize: 13.5, fontWeight: 800, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '.4px', color: 'var(--sf-text)' },
  link: { fontSize: 13.5, color: 'var(--sf-muted)', textDecoration: 'none' },
  bottom: {
    maxWidth: 1180, margin: '0 auto', padding: '16px 20px', fontSize: 12.5, color: 'var(--sf-muted)',
    display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
  },
};
