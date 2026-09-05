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

// Trạng thái rỗng khi chưa có công ty thật đang tuyển.
function EmptyState({ text }) {
  return <div style={s.empty}>{text}</div>;
}

// Mục "Việc làm tốt nhất hôm nay" — grid card việc làm (dữ liệu thật).
export function JobsSection({ jobs, saved, onSave, onOpen, emptyText }) {
  return (
    <section style={s.section}>
      <SectionHead title="Việc làm tốt nhất hôm nay" />
      {jobs.length === 0 ? (
        <EmptyState text={emptyText || 'Hiện chưa có công ty nào đang tuyển dụng.'} />
      ) : (
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
      )}
    </section>
  );
}

// Mục "Thương hiệu tuyển dụng hàng đầu" — grid card công ty (dữ liệu thật).
export function CompaniesSection({ companies, onOpen, emptyText }) {
  return (
    <section style={s.section}>
      <SectionHead title="Thương hiệu tuyển dụng hàng đầu" />
      {companies.length === 0 ? (
        <EmptyState text={emptyText || 'Chưa có doanh nghiệp nào đang tuyển dụng.'} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--sf-co-cols)', gap: 14 }}>
          {companies.map((co) => (
            <a key={co.key} href="#" className="sf-card" onClick={(e) => { e.preventDefault(); onOpen(co); }} style={s.coCard}>
              <span style={{ ...s.coAvatar, background: co.color }}>{co.mono}</span>
              <span style={s.coName}>{co.name}</span>
              <span style={s.coSub}>{co.subtitle}</span>
            </a>
          ))}
        </div>
      )}
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
          <p style={s.ctaSub}>Đăng tin tuyển dụng và kết nối trực tiếp với nguồn công nhân sẵn có trên Sunflower.</p>
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

  empty: {
    background: 'var(--sf-surface)', border: '1px dashed var(--sf-brd)', borderRadius: 12,
    padding: 'clamp(28px,4vw,44px)', textAlign: 'center', color: 'var(--sf-muted)', fontSize: 14.5,
  },

  coCard: {
    background: 'var(--sf-surface)', border: '1px solid var(--sf-brd)', borderRadius: 12,
    padding: '20px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 10, textAlign: 'center', textDecoration: 'none', color: 'var(--sf-text)',
    boxShadow: 'var(--sf-shadow)', cursor: 'pointer', minWidth: 0,
  },
  coAvatar: {
    width: 54, height: 54, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 14, fontSize: 17, fontWeight: 800, color: '#fff',
  },
  coName: { fontSize: 14, fontWeight: 700, lineHeight: 1.3, width: '100%', overflowWrap: 'anywhere' },
  coSub: { fontSize: 12.5, color: 'var(--sf-navy)', fontWeight: 600, width: '100%', overflowWrap: 'anywhere' },

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
