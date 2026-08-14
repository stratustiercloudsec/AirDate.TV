"""
Fix: every season card for the same show renders the SAME (latest-season)
poster, because enrichWithNetwork() always grabs detail.seasons[-1] instead
of matching the specific season this row represents.

Run from either the repo root or src/pages/ itself — this will find
SearchPage.jsx in whichever directory it's actually in:
  python3 patch_enrich_with_network.py
"""

import os

candidates = ["src/pages/SearchPage.jsx", "SearchPage.jsx"]
path = next((p for p in candidates if os.path.isfile(p)), None)
if path is None:
    raise FileNotFoundError(
        "Could not find SearchPage.jsx in src/pages/SearchPage.jsx or ./SearchPage.jsx "
        "— run this from the repo root or from src/pages/ directly."
    )
print(f"Found: {path}")

with open(path) as f:
    content = f.read()

old = """      poster_path:    (() => {
        if (detail?.seasons?.length) {
          const valid = detail.seasons.filter(s => s.season_number > 0 && s.poster_path)
          if (valid.length) return valid[valid.length - 1].poster_path
        }
        return detail?.poster_path || s.poster_path || null
      })(),"""

new = """      poster_path:    (() => {
        if (detail?.seasons?.length) {
          // Match THIS row's specific season when we know which one it is —
          // otherwise every season card for the same show falls back to the
          // same (latest) poster, since they all share the same TMDB show id.
          if (s.season_number) {
            const seasonMatch = detail.seasons.find(
              ss => ss.season_number === s.season_number && ss.poster_path
            )
            if (seasonMatch) return seasonMatch.poster_path
          }
          const valid = detail.seasons.filter(ss => ss.season_number > 0 && ss.poster_path)
          if (valid.length) return valid[valid.length - 1].poster_path
        }
        return detail?.poster_path || s.poster_path || null
      })(),"""

assert old in content, "enrichWithNetwork poster_path block not found — file may differ from expected version"
content = content.replace(old, new)

with open(path, "w") as f:
    f.write(content)

print("Patched: enrichWithNetwork() now matches each season card to its own")
print("TMDB season poster instead of always using the latest season's poster.")