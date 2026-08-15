"""
Adds a working filter for "Season / Series Premiere" vs "Continuing Episodes"
to the Premiere Calendar page — the legend items become clickable toggles
instead of static labels.

Data already distinguishes the two: continuing episodes carry
_isContinuing: true; premieres (new series, season premieres, static
curated entries) don't. This patch adds an episodeTypeFilter state
('all' | 'premieres' | 'continuing'), derives filteredPremieres via
useMemo, and swaps every read site (byDate, showsForDay, the premiere
count in MonthNav) from `premieres` to `filteredPremieres`.

Run from either the repo root or src/pages/ itself:
  python3 patch_premiere_type_filter.py
"""

import os

candidates = ["src/pages/PremieresCalendarPage.jsx", "PremieresCalendarPage.jsx"]
path = next((p for p in candidates if os.path.isfile(p)), None)
if path is None:
    raise FileNotFoundError(
        "Could not find PremieresCalendarPage.jsx in src/pages/ or the current dir "
        "— run this from the repo root or from src/pages/ directly."
    )
print(f"Found: {path}")

with open(path) as f:
    content = f.read()

# ── 1. Add useMemo to the React import ──────────────────────────────────────
old_import = "import { useEffect, useState, useCallback, useRef } from 'react'"
new_import = "import { useEffect, useState, useCallback, useRef, useMemo } from 'react'"
assert old_import in content, "React import line not found"
content = content.replace(old_import, new_import)

# ── 2. Add filter state + filteredPremieres derivation ──────────────────────
old_state = '''  const filterScrollRef = useRef(null)
  const [view,        setView]        = useState('list')
  const [network,     setNetwork]     = useState('All')
  const [premieres,   setPremieres]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const monthFirst = `${year}-${pad(month)}-01`
  const monthLast  = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`

  const load = useCallback(async () => {'''

new_state = '''  const filterScrollRef = useRef(null)
  const [view,             setView]             = useState('list')
  const [network,          setNetwork]          = useState('All')
  const [premieres,        setPremieres]        = useState([])
  const [loading,          setLoading]          = useState(true)
  const [currentDate,      setCurrentDate]      = useState(new Date())
  const [selectedDay,      setSelectedDay]      = useState(null)
  const [episodeTypeFilter,setEpisodeTypeFilter]= useState('all') // 'all' | 'premieres' | 'continuing'

  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth() + 1

  const monthFirst = `${year}-${pad(month)}-01`
  const monthLast  = `${year}-${pad(month)}-${new Date(year, month, 0).getDate()}`

  const filteredPremieres = useMemo(() => {
    if (episodeTypeFilter === 'premieres')  return premieres.filter(s => !s._isContinuing)
    if (episodeTypeFilter === 'continuing') return premieres.filter(s => s._isContinuing)
    return premieres
  }, [premieres, episodeTypeFilter])

  const load = useCallback(async () => {'''

assert old_state in content, "state declaration block not found"
content = content.replace(old_state, new_state)

# ── 3. Swap byDate / showsForDay to use filteredPremieres ───────────────────
old_bydate = '''  function dateStr(day) { return `${year}-${pad(month)}-${pad(day)}` }
  function showsForDay(day) { return premieres.filter(s=>s.first_air_date===dateStr(day)) }

  const byDate = {}
  premieres.forEach(s=>{
    const d=s.first_air_date||''
    if (d){ if (!byDate[d]) byDate[d]=[]; byDate[d].push(s) }
  })'''

new_bydate = '''  function dateStr(day) { return `${year}-${pad(month)}-${pad(day)}` }
  function showsForDay(day) { return filteredPremieres.filter(s=>s.first_air_date===dateStr(day)) }

  const byDate = {}
  filteredPremieres.forEach(s=>{
    const d=s.first_air_date||''
    if (d){ if (!byDate[d]) byDate[d]=[]; byDate[d].push(s) }
  })'''

assert old_bydate in content, "byDate/showsForDay block not found"
content = content.replace(old_bydate, new_bydate)

# ── 4. Swap the premiere count shown in MonthNav ─────────────────────────────
old_count = '''        <p className="text-xs text-slate-200 font-bold uppercase tracking-widest mt-0.5">
          {loading?'Loading…':`${premieres.length} Premiere${premieres.length!==1?'s':''}`}
        </p>'''

new_count = '''        <p className="text-xs text-slate-200 font-bold uppercase tracking-widest mt-0.5">
          {loading?'Loading…':`${filteredPremieres.length} Premiere${filteredPremieres.length!==1?'s':''}`}
        </p>'''

assert old_count in content, "MonthNav premiere count block not found"
content = content.replace(old_count, new_count)

# ── 5. Turn the static legend into clickable filter buttons ─────────────────
old_legend = '''        {/* Legend */}
        <div className="flex items-center gap-5 mb-6 text-[10px] font-bold uppercase tracking-widest">
          <span className="text-slate-200">Key:</span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"/>
            Season / Series Premiere
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
            Continuing Episodes
          </span>
        </div>'''

new_legend = '''        {/* Episode type filter — click to filter, click again to clear */}
        <div className="flex items-center gap-2.5 mb-6 text-[10px] font-bold uppercase tracking-widest flex-wrap">
          <span className="text-slate-200">Filter:</span>

          <button
            onClick={()=>setEpisodeTypeFilter('all')}
            className={`px-3 py-1.5 rounded-xl border transition-all
              ${episodeTypeFilter==='all'
                ? 'bg-white/10 border-white/25 text-white'
                : 'border-white/10 text-slate-200 hover:text-white hover:border-white/20'}`}>
            All
          </button>

          <button
            onClick={()=>setEpisodeTypeFilter(v=>v==='premieres'?'all':'premieres')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all
              ${episodeTypeFilter==='premieres'
                ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400'
                : 'border-white/10 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/20'}`}>
            <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block"/>
            Season / Series Premiere
          </button>

          <button
            onClick={()=>setEpisodeTypeFilter(v=>v==='continuing'?'all':'continuing')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all
              ${episodeTypeFilter==='continuing'
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                : 'border-white/10 text-slate-200 hover:text-amber-400 hover:border-amber-500/20'}`}>
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"/>
            Continuing Episodes
          </button>
        </div>'''

assert old_legend in content, "legend block not found"
content = content.replace(old_legend, new_legend)

with open(path, "w") as f:
    f.write(content)

print("Patched: legend is now a working filter (All / Premieres / Continuing),")
print("applied to both List and Calendar views via filteredPremieres.")
