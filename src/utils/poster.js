// src/utils/poster.js
// Handles both bare TMDB paths (/abc.jpg) and full URLs (https://...)

export function createDefaultPoster(title = '') {
  const label = title.length > 20 ? title.substring(0, 20) + '…' : title
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 750" width="500" height="750">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1"/>
        <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1"/>
      </linearGradient>
    </defs>
    <rect width="500" height="750" fill="url(#grad)"/>
    <g opacity="0.1">
      <circle cx="100" cy="100" r="150" fill="#06b6d4"/>
      <circle cx="400" cy="600" r="200" fill="#ec4899"/>
    </g>
    <g transform="translate(250,350)">
      <circle r="80" fill="none" stroke="#06b6d4" stroke-width="3" opacity="0.3"/>
      <circle r="60" fill="none" stroke="#ec4899" stroke-width="3" opacity="0.3"/>
      <path d="M-30,-20 L30,0 L-30,20 Z" fill="#06b6d4"/>
    </g>
    <text x="250" y="500" font-family="Inter,sans-serif" font-size="32" font-weight="900"
          fill="#ffffff" text-anchor="middle" opacity="0.9">${label}</text>
    <text x="250" y="680" font-family="Inter,sans-serif" font-size="16" font-weight="700"
          fill="#06b6d4" text-anchor="middle" letter-spacing="3">AIRDATE</text>
  </svg>`
  return `data:image/svg+xml,${encodeURIComponent(svg)}`
}

import { IMAGE_BASE } from '@/config/aws'

/**
 * usePoster(posterOrPath, title, width?)
 *
 * Accepts either:
 *   - A bare TMDB path:  "/abc123.jpg"   → prepends IMAGE_BASE/t/p/wNNN
 *   - A full URL:        "https://..."   → used as-is (Lambda already built it)
 *   - null / undefined                  → SVG fallback
 *
 * Returns { src, onError } to spread onto <img>.
 */
export function usePoster(posterOrPath, title = '', width = 342) {
  const fallback = createDefaultPoster(title)
  let src = fallback
  if (posterOrPath) {
    if (posterOrPath.startsWith('http')) {
      // Full URL from Lambda — use directly
      src = posterOrPath
    } else {
      // Bare TMDB path like "/abc123.jpg" — prepend IMAGE_BASE
      src = `${IMAGE_BASE}/t/p/w${width}${posterOrPath}`
    }
  }
  const onError = (e) => { e.currentTarget.onerror = null; e.currentTarget.src = fallback }
  return { src, onError }
}