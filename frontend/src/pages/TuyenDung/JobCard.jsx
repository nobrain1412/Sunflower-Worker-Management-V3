// Card việc làm — dùng chung ở mục "Việc làm tốt nhất" và trang chi tiết.
// Nút tim ♡/♥ gọi stopPropagation để không kích hoạt mở trang chi tiết.
export default function JobCard({ job, saved, onSave, onOpen }) {
  return (
    <div className="sf-jobcard" onClick={onOpen} style={s.card}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{ ...s.avatar, background: job.color }}>{job.mono}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.title}>{job.title}</div>
          <div style={s.company}>{job.company}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onSave(); }}
          title="Lưu tin"
          style={{ ...s.heart, color: saved ? '#c9678f' : 'var(--sf-muted)' }}
        >
          {saved ? '♥' : '♡'}
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        <span style={s.salary}>{job.salary}</span>
        <span style={s.meta}>{job.location}</span>
        <span style={s.meta}>{job.tag}</span>
      </div>
    </div>
  );
}

const s = {
  card: {
    background: 'var(--sf-surface)', border: '1px solid var(--sf-brd)', borderRadius: 12,
    padding: 16, display: 'flex', flexDirection: 'column', gap: 12,
    boxShadow: 'var(--sf-shadow)', cursor: 'pointer',
  },
  avatar: {
    width: 46, height: 46, flex: 'none', display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', borderRadius: 10, fontSize: 15, fontWeight: 800, color: '#fff',
  },
  title: { fontSize: 15, fontWeight: 700, lineHeight: 1.35, color: 'var(--sf-text)', overflowWrap: 'anywhere' },
  company: {
    fontSize: 13, color: 'var(--sf-muted)', marginTop: 3,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  heart: { flex: 'none', background: 'none', border: 'none', cursor: 'pointer', fontSize: 19, lineHeight: 1, padding: 2 },
  salary: { fontSize: 12.5, fontWeight: 700, color: 'var(--sf-navy)', background: 'var(--sf-navy-soft)', borderRadius: 6, padding: '4px 9px' },
  meta: { fontSize: 12.5, color: 'var(--sf-muted)', background: 'var(--sf-surface2)', borderRadius: 6, padding: '4px 9px' },
};
