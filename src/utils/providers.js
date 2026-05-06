// src/utils/providers.js — TMDB provider_id → direct streaming URL

const PROVIDER_URLS = {
  8:   'https://www.netflix.com/search?q={title}',
  9:   'https://www.amazon.com/s?k={title}&i=instant-video',
  337: 'https://www.disneyplus.com/search/{title}',
  1899:'https://www.max.com/search?q={title}',
  384: 'https://www.max.com/search?q={title}',
  15:  'https://www.hulu.com/search?q={title}',
  531: 'https://www.paramountplus.com/search/{title}',
  350: 'https://tv.apple.com/search?term={title}',
  2:   'https://tv.apple.com/search?term={title}',
  386: 'https://www.peacocktv.com/search?q={title}',
  43:  'https://www.starz.com/us/en/search?q={title}',
  // MGM+  (all variants)
  34:  'https://www.mgmplus.com/search?q={title}',
  521: 'https://www.mgmplus.com/search?q={title}',
  583: 'https://www.amazon.com/s?k={title}+mgm&i=instant-video',  // MGM+ Amazon Channel
  636: 'https://www.mgmplus.com/search?q={title}',                 // MGM Plus Roku
  // Fubo
  207: 'https://www.fubo.tv/welcome',
  257: 'https://www.fubo.tv/welcome',
  // Philo
  73:  'https://www.philo.com',
  509: 'https://www.philo.com',
  67:  'https://www.philo.com',
  // Tubi
  58:  'https://tubitv.com/search?q={title}',
  613: 'https://tubitv.com/search?q={title}',
  // BET+
  237: 'https://www.betplus.com',
  422: 'https://www.betplus.com',
  // Plex
  444: 'https://watch.plex.tv/search?q={title}',
  538: 'https://watch.plex.tv/search?q={title}',
  // AMC+
  191: 'https://www.amcplus.com',
  526: 'https://www.amcplus.com',
  // MUBI
  11:  'https://mubi.com/search?q={title}',
  // Spectrum
  486: 'https://watch.spectrum.net',
  551: 'https://watch.spectrum.net',
  // Philo (all variants)
  // Netflix with Ads
  1796:'https://www.netflix.com/search?q={title}',
  // HBO Max / Max (all variants)
  1825:'https://www.amazon.com/s?k={title}+hbo&i=instant-video',
  // Philo (all variants)
  2383:'https://www.philo.com',
  // Amazon Prime with Ads
  2100:'https://www.amazon.com/s?k={title}&i=instant-video',
  // Shudder
  99:  'https://www.shudder.com',
  // Sundance Now
  123: 'https://www.sundancenow.com',
  // Discovery+
  584: 'https://www.discoveryplus.com/search?q={title}',
  // ESPN+
  149: 'https://plus.espn.com',
}

export function getProviderUrl(provider, showTitle, fallback) {
  const tmpl = PROVIDER_URLS[provider.provider_id]
  if (!tmpl) return fallback || '#'
  return tmpl.replace('{title}', encodeURIComponent(showTitle || ''))
}
