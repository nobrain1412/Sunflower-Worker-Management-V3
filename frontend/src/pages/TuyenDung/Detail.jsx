import JobCard from './JobCard';

// Trang chi tiết Công ty / Ngành nghề: header màu thương hiệu + danh sách việc làm.
// `detail` được dựng sẵn ở index.jsx (thật hoặc mẫu). `onBack` về trang chủ.
export default function Detail({ detail, saved, onSave, onBack }) {
  return (
    <div>
      <section style={{ ...s.header, background: detail.bg }}>
        <div style={s.headerInner}>
          <button onClick={onBack} style={s.back}>← Về trang chủ</button>

          <div style={s.identity}>
            <span style={s.avatar}>{detail.mono}</span>
            <div style={{ minWidth: 0 }}>
              <div style={s.kind}>{detail.kindLabel}</div>
              <h1 style={s.title}>{detail.title}</h1>
              <div style={s.meta}>{detail.meta}</div>
            </div>
          </div>

          {detail.desc && <p style={s.desc}>{detail.desc}</p>}

          <div style={s.tags}>
            {detail.tags.map((tg) => <span key={tg} style={s.tag}>{tg}</span>)}
          </div>

          {detail.phone && (
            <a href={`tel:${detail.phone}`} style={s.contact}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.98.36 1.94.68 2.86a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.22-1.22a2 2 0 0 1 2.11-.45c.92.32 1.88.55 2.86.68A2 2 0 0 1 22 16.92z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Liên hệ ứng tuyển: {detail.phone}
            </a>
          )}
        </div>
      </section>

      <section style={s.list}>
        <h2 style={s.listTitle}>{detail.listTitle}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'var(--sf-job-cols)', gap: 14 }}>
          {detail.jobs.map((jb) => (
            <JobCard
              key={jb.id}
              job={jb}
              saved={!!saved[jb.id]}
              onSave={() => onSave(jb.id)}
              onOpen={() => {}}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

const s = {
  header: { color: '#fff', borderBottom: '1px solid var(--sf-brd)' },
  headerInner: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(24px,4vw,44px) 20px clamp(28px,4vw,48px)' },
  back: {
    display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,.16)',
    border: '1px solid rgba(255,255,255,.3)', color: '#fff', borderRadius: 999,
    padding: '7px 15px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
  },
  identity: { display: 'flex', gap: 18, alignItems: 'center', marginTop: 20, flexWrap: 'wrap' },
  avatar: {
    width: 72, height: 72, flex: 'none', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: 18, fontSize: 24, fontWeight: 800, color: '#fff',
    background: 'rgba(255,255,255,.18)', border: '1.5px solid rgba(255,255,255,.35)',
  },
  kind: { fontSize: 12, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', opacity: .8 },
  title: { margin: '4px 0 0', fontSize: 'clamp(22px,3.4vw,36px)', fontWeight: 800, lineHeight: 1.2 },
  meta: { marginTop: 6, fontSize: 14.5, opacity: .9 },
  desc: { margin: '18px 0 0', maxWidth: 640, fontSize: 14.5, lineHeight: 1.65, opacity: .9, whiteSpace: 'pre-line' },
  tags: { marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 },
  tag: {
    fontSize: 12.5, fontWeight: 600, background: 'rgba(255,255,255,.16)',
    border: '1px solid rgba(255,255,255,.28)', borderRadius: 999, padding: '5px 12px',
  },
  contact: {
    marginTop: 18, display: 'inline-flex', alignItems: 'center', gap: 8,
    background: 'rgba(255,255,255,.92)', color: '#1d2436', fontWeight: 700, fontSize: 14,
    textDecoration: 'none', borderRadius: 10, padding: '11px 20px',
  },
  list: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(28px,4vw,44px) 20px 0' },
  listTitle: { margin: '0 0 20px', fontSize: 'clamp(18px,2.2vw,24px)', fontWeight: 800, color: 'var(--sf-text)' },
};
