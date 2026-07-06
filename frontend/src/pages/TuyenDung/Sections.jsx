import JobCard from './JobCard';

// Header của một section: tiêu đề + link "Xem tất cả →".
function SectionHead({ title }) {
  return (
    <div style={s.head}>
      <h2 style={s.h2}>{title}</h2>
      <a href="#" className="sf-link" onClick={(e) => e.preventDefault()} style={s.seeAll}>Xem tất cả →</a>
    </div>
  );
}

// Mục "Ngành nghề nổi bật" — grid card ngành nghề (dữ liệu mẫu).
export function CategoriesSection({ categories, onOpen }) {
  return (
    <section style={s.section}>
      <SectionHead title="Ngành nghề nổi bật" />
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--sf-cat-cols)', gap: 14 }}>
        {categories.map((ct) => (
          <a key={ct.key} href="#" className="sf-card" onClick={(e) => { e.preventDefault(); onOpen(ct); }} style={s.catCard}>
            <span style={{ ...s.catAvatar, background: ct.color }}>{ct.mono}</span>
            <span style={{ minWidth: 0 }}>
              <span style={s.catName}>{ct.name}</span>
              <span style={s.catCount}>{ct.count} việc làm</span>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

// Mục "Việc làm tốt nhất hôm nay" — grid card việc làm.
export function JobsSection({ jobs, saved, onSave, onOpen }) {
  return (
    <section style={s.section}>
      <SectionHead title="Việc làm tốt nhất hôm nay" />
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--sf-job-cols)', gap: 14 }}>
        {jobs.map((jb) => (
          <JobCard
            key={jb.id}
            job={jb}
            saved={!!saved[jb.id]}
            onSave={() => onSave(jb.id)}
            onOpen={() => onOpen(jb)}
          />
        ))}
      </div>
    </section>
  );
}

// Mục "Thương hiệu tuyển dụng hàng đầu" — grid card công ty (dọc, căn giữa).
export function CompaniesSection({ companies, onOpen }) {
  return (
    <section style={s.section}>
      <SectionHead title="Thương hiệu tuyển dụng hàng đầu" />
      <div style={{ display: 'grid', gridTemplateColumns: 'var(--sf-co-cols)', gap: 14 }}>
        {companies.map((co) => (
          <a key={co.key} href="#" className="sf-card" onClick={(e) => { e.preventDefault(); onOpen(co); }} style={s.coCard}>
            <span style={{ ...s.coAvatar, background: co.color }}>{co.mono}</span>
            <span style={s.coName}>{co.name}</span>
            <span style={s.coSub}>{co.subtitle}</span>
          </a>
        ))}
      </div>
    </section>
  );
}

// CTA nhà tuyển dụng.
export function EmployerCta({ onCta }) {
  return (
    <section style={s.section}>
      <div style={s.cta}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <h2 style={s.ctaTitle}>Bạn là nhà tuyển dụng?</h2>
          <p style={s.ctaSub}>Đăng tin miễn phí và tiếp cận hơn 5 triệu hồ sơ ứng viên chất lượng trên Sunflower.</p>
        </div>
        <a href="#" className="sf-btn-flame" onClick={(e) => { e.preventDefault(); onCta(); }} style={s.ctaBtn}>Đăng tuyển &amp; tìm hồ sơ</a>
      </div>
    </section>
  );
}

const s = {
  section: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(36px,5vw,60px) 20px 0' },
  head: { display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 20 },
  h2: { margin: 0, fontSize: 'clamp(19px,2.4vw,26px)', fontWeight: 800, color: 'var(--sf-text)' },
  seeAll: { fontSize: 14, fontWeight: 600, color: 'var(--sf-navy)', textDecoration: 'none', whiteSpace: 'nowrap' },

  catCard: {
    display: 'flex', alignItems: 'center', gap: 14, background: 'var(--sf-surface)',
    border: '1px solid var(--sf-brd)', borderRadius: 12, padding: 16, textDecoration: 'none',
    color: 'var(--sf-text)', boxShadow: 'var(--sf-shadow)', cursor: 'pointer',
  },
  catAvatar: {
    width: 44, height: 44, flex: 'none', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: 12, fontSize: 14, fontWeight: 800, color: '#fff',
  },
  catName: { display: 'block', fontSize: 14.5, fontWeight: 700, lineHeight: 1.3 },
  catCount: { display: 'block', fontSize: 12.5, color: 'var(--sf-muted)', marginTop: 2 },

  coCard: {
    background: 'var(--sf-surface)', border: '1px solid var(--sf-brd)', borderRadius: 12,
    padding: '20px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, textAlign: 'center', textDecoration: 'none', color: 'var(--sf-text)',
    boxShadow: 'var(--sf-shadow)', cursor: 'pointer',
  },
  coAvatar: {
    width: 54, height: 54, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, fontSize: 17, fontWeight: 800, color: '#fff',
  },
  coName: { fontSize: 14, fontWeight: 700, lineHeight: 1.3 },
  coSub: { fontSize: 12.5, color: 'var(--sf-navy)', fontWeight: 600 },

  cta: {
    borderRadius: 16, background: 'linear-gradient(120deg,var(--sf-navy) 0%,#3a5ea6 100%)',
    color: '#fff', padding: 'clamp(28px,4vw,48px)', display: 'flex', flexWrap: 'wrap',
    alignItems: 'center', gap: 24,
  },
  ctaTitle: { margin: '0 0 10px', fontSize: 'clamp(20px,2.6vw,28px)', fontWeight: 800, lineHeight: 1.3 },
  ctaSub: { margin: 0, fontSize: 14.5, lineHeight: 1.6, opacity: .85, maxWidth: 520 },
  ctaBtn: {
    flex: 'none', background: 'linear-gradient(135deg,var(--sf-flame1),var(--sf-flame2))',
    color: '#5a340c', fontWeight: 800, fontSize: 15, textDecoration: 'none',
    borderRadius: 10, padding: '14px 28px',
  },
};
