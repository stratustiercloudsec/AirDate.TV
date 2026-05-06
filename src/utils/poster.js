const CF = 'https://dmg16wbx5pi4h.cloudfront.net'

export function createDefaultPoster(name) {
  // Strip non-Latin1 chars from the initial before SVG embedding
  // so btoa() doesn't throw on Japanese/Arabic/Korean titles
  const raw     = (name || '?')[0].toUpperCase()
  const initial = raw.codePointAt(0) > 255 ? '?' : raw
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 150">
    <rect width="100" height="150" fill="#1e293b" rx="8"/>
    <text x="50" y="85" font-family="Arial,sans-serif" font-size="48" font-weight="bold"
      fill="#94a3b8" text-anchor="middle">${initial}</text>
  </svg>`
  // Use encodeURIComponent instead of btoa — handles ALL unicode safely
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function usePoster(posterPathOrUrl, name = '', width = 342) {
  const w = [92,154,185,342,500,780].includes(width) ? width : 342
  let src = '/assets/images/no-poster.png'
  if (posterPathOrUrl) {
    if (posterPathOrUrl.startsWith('http')) {
      src = posterPathOrUrl  // already a full URL (e.g. from Lambda response)
    } else if (posterPathOrUrl.startsWith('/')) {
      src = `${CF}/t/p/w${w}${posterPathOrUrl}`  // TMDB path
    }
  }
  return {
    src,
    onError: (e) => { e.currentTarget.onerror = null; e.currentTarget.src = createDefaultPoster(name) },
  }
}
