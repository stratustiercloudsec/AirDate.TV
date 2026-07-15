import { correctAirDate } from './airdate';

const API_BASE = 'https://qg0x31ranc.execute-api.us-east-1.amazonaws.com/prod';

export async function tmdbFetch(path, params = {}) {
  const qs = new URLSearchParams({ path, ...params }).toString();
  const res = await fetch(`${API_BASE}/tmdb-proxy?${qs}`);
  if (!res.ok) throw new Error(`TMDB proxy ${res.status}: ${path}`);
  return res.json();
}

// Centralized date correction — applied once here so every caller of tmdbShow/tmdbSeason
// gets right dates automatically. NOTE: this only covers endpoints that return a
// `networks` array (show detail, season detail). List endpoints (discover/search/
// trending/popular) do NOT include networks in TMDB's response, so correction can't
// happen here for those — callers of those endpoints must still apply correctAirDate
// themselves once they know the network (e.g. after a follow-up tmdbShow call).
function correctShowDates(data) {
  if (!data) return data;
  const net = data.networks?.[0]?.name || '';
  if (data.first_air_date) data.first_air_date = correctAirDate(data.first_air_date, net);
  if (data.next_episode_to_air?.air_date) {
    data.next_episode_to_air.air_date = correctAirDate(data.next_episode_to_air.air_date, net);
  }
  if (data.last_episode_to_air?.air_date) {
    data.last_episode_to_air.air_date = correctAirDate(data.last_episode_to_air.air_date, net);
  }
  if (Array.isArray(data.seasons)) {
    data.seasons = data.seasons.map(s => s.air_date ? { ...s, air_date: correctAirDate(s.air_date, net) } : s);
  }
  return data;
}

function correctSeasonDates(data, networkName) {
  if (!data) return data;
  if (data.air_date) data.air_date = correctAirDate(data.air_date, networkName);
  if (Array.isArray(data.episodes)) {
    data.episodes = data.episodes.map(ep => ep.air_date ? { ...ep, air_date: correctAirDate(ep.air_date, networkName) } : ep);
  }
  return data;
}

export const tmdbShow           = async (id) => correctShowDates(await tmdbFetch(`/tv/${id}`, { language: 'en-US' }));
export const tmdbContentRatings = (id)          => tmdbFetch(`/tv/${id}/content_ratings`);
export const tmdbSeason         = async (id, n, networkName = '') => correctSeasonDates(await tmdbFetch(`/tv/${id}/season/${n}`, { language: 'en-US' }), networkName);
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
