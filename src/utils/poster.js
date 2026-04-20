const CF = 'https://dmg16wbx5pi4h.cloudfront.net'

export function createDefaultPoster(name = '') {
  const letter = (name || '?')[0].toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="#1e293b"/><rect x="1" y="1" width="298" height="448" fill="none" stroke="#334155" stroke-width="2"/><text x="150" y="245" font-family="Inter,sans-serif" font-size="120" font-weight="900" fill="#475569" text-anchor="middle" dominant-baseline="middle">${letter}</text></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
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
