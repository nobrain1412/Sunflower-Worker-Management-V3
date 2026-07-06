import { useState, useEffect, useRef, useCallback } from 'react';
import { BANNERS } from './tuyenDungData';

// Banner carousel: 3 slide chồng nhau, tự chuyển mỗi 5s; click nút/dot reset timer.
export default function Carousel() {
  const [idx, setIdx] = useState(0);
  const timer = useRef(null);

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setIdx((i) => (i + 1) % BANNERS.length);
    }, 5000);
  }, []);

  useEffect(() => {
    start();
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [start]);

  const go = (i) => {
    setIdx(((i % BANNERS.length) + BANNERS.length) % BANNERS.length);
    start();
  };

  return (
    <section style={s.section}>
      <div style={s.frame}>
        {BANNERS.map((b, i) => (
          <a
            key={i}
            href="#"
            onClick={(e) => e.preventDefault()}
            style={{
              ...s.slide, background: b.bg,
              opacity: i === idx ? 1 : 0, zIndex: i === idx ? 2 : 1,
            }}
          >
            <div style={{ maxWidth: '62%' }}>
              <div style={{ ...s.kicker, color: b.accent }}>{b.kicker}</div>
              <div style={{ ...s.title, color: b.fg }}>{b.title}</div>
              <div style={{ ...s.subtitle, color: b.fg }}>{b.sub}</div>
            </div>
          </a>
        ))}

        <button onClick={() => go(idx - 1)} aria-label="Trước" style={{ ...s.arrow, left: 12 }}>‹</button>
        <button onClick={() => go(idx + 1)} aria-label="Sau" style={{ ...s.arrow, right: 12 }}>›</button>

        <div style={s.dots}>
          {BANNERS.map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label="Chuyển banner"
              style={{
                ...s.dot,
                width: i === idx ? 24 : 8,
                background: i === idx ? 'var(--sf-navy)' : 'rgba(120,130,150,.45)',
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

const s = {
  section: { maxWidth: 1180, margin: '0 auto', padding: 'clamp(24px,4vw,40px) 20px 0' },
  frame: {
    position: 'relative', height: 'clamp(160px,26vw,260px)', borderRadius: 16,
    overflow: 'hidden', border: '1px solid var(--sf-brd)', boxShadow: 'var(--sf-shadow)',
  },
  slide: {
    position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
    padding: 'clamp(20px,4vw,48px)', textDecoration: 'none', transition: 'opacity .6s ease',
  },
  kicker: { fontSize: 11.5, fontWeight: 700, letterSpacing: '1.2px', textTransform: 'uppercase' },
  title: { marginTop: 7, fontSize: 'clamp(18px,2.8vw,32px)', fontWeight: 800, lineHeight: 1.22 },
  subtitle: { marginTop: 9, fontSize: 'clamp(12px,1.5vw,15px)', lineHeight: 1.5, opacity: .85 },
  arrow: {
    position: 'absolute', top: '50%', transform: 'translateY(-50%)', zIndex: 10,
    width: 38, height: 38, borderRadius: '50%', border: 'none',
    background: 'rgba(255,255,255,.85)', color: '#1d2436', cursor: 'pointer',
    fontSize: 20, lineHeight: 1, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,.15)',
  },
  dots: {
    position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
    zIndex: 10, display: 'flex', gap: 7,
  },
  dot: {
    height: 8, border: 'none', borderRadius: 999, cursor: 'pointer', padding: 0,
    transition: 'width .3s, background .3s',
  },
};
