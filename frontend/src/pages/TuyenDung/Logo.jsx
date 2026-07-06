// Logo Sunflower — ngọn lửa gradient (vàng → cam → hồng) + chữ "Sunflower".
// Copy nguyên path SVG từ file thiết kế.

export default function Logo({ size = 30, fontSize = 21 }) {
  const h = Math.round((size / 30) * 36);
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 9 }}>
      <svg width={size} height={h} viewBox="0 0 34 40" fill="none" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
        <defs>
          <linearGradient id="sfFlame" x1="17" y1="1" x2="17" y2="39" gradientUnits="userSpaceOnUse">
            <stop stopColor="#f7c948" />
            <stop offset=".55" stopColor="#f0a63a" />
            <stop offset="1" stopColor="#e58fb0" />
          </linearGradient>
        </defs>
        <path d="M19 1 C 17 9, 9 13, 9 23 C 9 31, 15 37, 20 39 C 17 33, 22 30, 22 24 C 26 27, 27 32, 25 37 C 30 33, 32 26, 29 19 C 27 14, 21 12, 19 1 Z" fill="url(#sfFlame)" />
        <path d="M12 20 C 10 26, 12 32, 17 36 C 13 30, 15 25, 12 20 Z" fill="#e58fb0" opacity=".65" />
      </svg>
      <span style={{ fontSize, fontWeight: 800, color: 'var(--sf-navy)', letterSpacing: '-.3px' }}>
        Sunflower
      </span>
    </span>
  );
}
