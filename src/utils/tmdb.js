const API_BASE = 'https://qg0x31ranc.execute-api.us-east-1.amazonaws.com/prod';

export async function tmdbFetch(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params }).toString();
  const res = await fetch(`${API_BASE}/tmdb-proxy?${qs}`);
  if (!res.ok) throw new Error(`TMDB proxy ${res.status}: ${path}`);
  return res.json();
}

export const tmdbShow           = (id)          => tmdbFetch(`/tv/${id}`, { language: 'en-US' });
export const tmdbContentRatings = (id)          => tmdbFetch(`/tv/${id}/content_ratings`);
export const tmdbSeason         = (id, n)       => tmdbFetch(`/tv/${id}/season/${n}`, { language: 'en-US' });
export const tmdbVideos         = (id)          => tmdbFetch(`/tv/${id}/videos`);
export const tmdbSearchTV       = (q, page = 1) => tmdbFetch('/search/tv', { query: encodeURIComponent(q), page, language: 'en-US' });
export const tmdbTrending       = (w = 'week')  => tmdbFetch(`/trending/tv/${w}`, { language: 'en-US' });
export const tmdbPopular        = (page = 1)    => tmdbFetch('/tv/popular', { language: 'en-US', page });
export const tmdbDiscover       = (params = {}) => tmdbFetch('/discover/tv', { language: 'en-US', ...params });
export const tmdbCredits        = (id) => tmdbFetch(`/tv/${id}/credits`);
export const tmdbProviders      = (id) => tmdbFetch(`/tv/${id}/watch/providers`);
export const tmdbRecommendations= (id) => tmdbFetch(`/tv/${id}/recommendations`, { language: 'en-US', page: 1 });

export async function fetchCuratedPremieres() {
  try {
    const res = await fetch(`${API_BASE}/curated/premieres`);
    if (!res.ok) return []
    const data = await res.json()
    return data.shows || []
  } catch (e) {
    console.error('fetchCuratedPremieres error:', e)
    return []
  }
}
export const tmdbOnTheAir       = (page = 1) => tmdbFetch('/tv/on_the_air', { page });
