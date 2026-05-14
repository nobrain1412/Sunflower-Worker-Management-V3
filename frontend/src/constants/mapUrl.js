function isGoogleMapHost(hostname) {
  const host = (hostname || '').toLowerCase();
  return host === 'maps.app.goo.gl' || host.endsWith('.google.com') || host === 'google.com';
}

export function normalizeMapUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const parsed = new URL(trimmed);
    if (!isGoogleMapHost(parsed.hostname)) return trimmed;

    const hasEmbedPath = parsed.pathname.includes('/maps/embed');
    const output = parsed.searchParams.get('output');
    if (hasEmbedPath || output === 'embed') return parsed.toString();

    const q = parsed.searchParams.get('q') || parsed.searchParams.get('query');
    const query = q || trimmed;
    return `https://www.google.com/maps?q=${encodeURIComponent(query)}&output=embed`;
  } catch {
    return trimmed;
  }
}

export function isEmbeddableMapUrl(rawUrl) {
  const normalized = normalizeMapUrl(rawUrl);
  if (!normalized) return false;

  try {
    const parsed = new URL(normalized);
    if (!isGoogleMapHost(parsed.hostname)) return false;
    return parsed.pathname.includes('/maps/embed') || parsed.searchParams.get('output') === 'embed';
  } catch {
    return false;
  }
}
