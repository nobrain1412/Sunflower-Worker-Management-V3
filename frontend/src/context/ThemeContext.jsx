import { createContext, useContext, useState, useCallback } from 'react';

// Theme độc lập theo từng khu vực: mỗi ThemeScope có `storageKey` riêng
// (vd 'theme_tuyen_dung' vs 'theme_quan_ly') nên đổi theme khu vực này
// KHÔNG ảnh hưởng khu vực kia. Mặc định là 'light'.

const ThemeContext = createContext(null);

function readTheme(storageKey) {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  } catch {
    return 'light';
  }
}

/**
 * Bọc một khu vực UI và áp theme qua thuộc tính data-theme.
 * Mọi CSS var (--bg0, --text1, ...) của phần tử con sẽ lấy theo theme này.
 */
export function ThemeScope({ storageKey, children, style, className }) {
  const [theme, setTheme] = useState(() => readTheme(storageKey));

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try { localStorage.setItem(storageKey, next); } catch { /* ignore */ }
      return next;
    });
  }, [storageKey]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        data-theme={theme}
        className={className}
        style={{ minHeight: '100vh', background: 'var(--bg0)', ...style }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme phải dùng bên trong ThemeScope');
  return ctx;
}
