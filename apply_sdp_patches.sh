#!/bin/bash
# Run this on the EC2 server to patch ShowDetailPage.jsx
# Usage: bash apply_sdp_patches.sh
# File: /var/www/html/airdate-react/src/pages/ShowDetailPage.jsx

FILE="/var/www/html/airdate-react/src/pages/ShowDetailPage.jsx"

# Backup
cp "$FILE" "${FILE}.bak.$(date +%Y%m%d_%H%M%S)"
echo "Backup created"

# Patch 1: add useSearchParams to import
sed -i "s/import { useParams, Link, useNavigate } from 'react-router-dom'/import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom'/" "$FILE"
echo "Patch 1 applied: useSearchParams import"

# Patch 2: add requestedSeason after useNavigate (use python for multi-line)
python3 << 'PYEOF'
import re

with open('/var/www/html/airdate-react/src/pages/ShowDetailPage.jsx', 'r') as f:
    src = f.read()

# Patch 2: inject requestedSeason after navigate
old = "  const navigate     = useNavigate()\n  const { token"
new = "  const navigate       = useNavigate()\n  const [searchParams]   = useSearchParams()\n  const requestedSeason  = parseInt(searchParams.get('season')) || null\n  const { token"
src = src.replace(old, new, 1)

# Patch 3: season-aware cache key
old = "    const cacheKey=`airdate_show_${id}`"
new = "    const cacheKey=`airdate_show_${id}_s${requestedSeason||'latest'}`"
src = src.replace(old, new, 1)

# Patch 4: season-aware result selection
old = "      const s=results[0]"
new = """      // Pick the season matching ?season=N, else fall back to results[0]
      const s = requestedSeason
        ? results.find(r =>
            r.season_number === requestedSeason ||
            (r.title||'').includes(`Season ${requestedSeason}`) ||
            (r.name||'').includes(`Season ${requestedSeason}`)
          ) || results[0]
        : results[0]"""
src = src.replace(old, new, 1)

# Patch 5: season selector tabs — insert after number_of_seasons span, before action buttons
old = "                    <div className=\"flex flex-wrap gap-3 mb-8\">"
new = """                    {/* Season selector — links each season to ?season=N */}
                    {show.number_of_seasons > 1 && (
                      <div className="flex flex-wrap gap-2 mb-4">
                        {Array.from({length: show.number_of_seasons}, (_, i) => i + 1).map(n => (
                          <a
                            key={n}
                            href={`/details/${show.id}?season=${n}`}
                            className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest border transition-all ${
                              (requestedSeason || show.number_of_seasons) === n
                                ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                                : 'bg-slate-800/60 border-white/10 text-slate-300 hover:border-cyan-500/30 hover:text-cyan-400'
                            }`}
                          >
                            S{String(n).padStart(2,'0')}
                          </a>
                        ))}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 mb-8">"""
src = src.replace(old, new, 1)

with open('/var/www/html/airdate-react/src/pages/ShowDetailPage.jsx', 'w') as f:
    f.write(src)

print("All 5 patches applied successfully")
PYEOF

echo "All patches done"
echo "Now rebuild: cd /var/www/html/airdate-react && npm run build"
