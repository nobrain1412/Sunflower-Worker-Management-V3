import { useEffect } from 'react';

export default function BottomSheet({ open, onClose, title, children }) {
  // Khoá scroll body khi mở
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      document.body.classList.add('sheet-open');
    } else {
      document.body.style.overflow = '';
      document.body.classList.remove('sheet-open');
    }
    return () => {
      document.body.style.overflow = '';
      document.body.classList.remove('sheet-open');
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div style={s.overlay} onClick={onClose} />
      {/* Sheet */}
      <div style={s.sheet}>
        <div style={s.handle} />
        {title && <div style={s.title}>{title}</div>}
        <div style={s.body}>{children}</div>
      </div>
    </>
  );
}

const s = {
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
    zIndex: 400, backdropFilter: 'blur(2px)',
  },
  sheet: {
    position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 401,
    background: 'var(--bg1)', borderRadius: '18px 18px 0 0',
    border: '1px solid var(--border)', borderBottom: 'none',
    maxHeight: '80vh', overflowY: 'auto',
    fontFamily: "'Be Vietnam Pro', sans-serif",
    animation: 'slideUp 0.22s ease-out',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    background: 'var(--border2)', margin: '12px auto 4px',
  },
  title: {
    fontSize: 15, fontWeight: 700, color: 'var(--text1)',
    padding: '8px 20px 12px', borderBottom: '1px solid var(--border)',
  },
  body: { padding: '12px 16px 20px' },
};
