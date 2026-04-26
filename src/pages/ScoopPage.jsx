// src/pages/ScoopPage.jsx — v4.0
// Editorial magazine layout: hero + featured row + filterable grid

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

const MANIFEST_URL = 'https://airdate.tv/scoop/stories.json'

const CATS = {
  premieres:     { label:'Premiere Dates',     icon:'calendar-star',  color:'#22d3ee' },
  renewals:      { label:'Renewals',           icon:'rotate',         color:'#4ade80' },
  cancellations: { label:'Cancellations',      icon:'ban',            color:'#f87171' },
  casting:       { label:'Casting News',       icon:'user-plus',      color:'#c084fc' },
  production:    { label:'Production Updates', icon:'clapperboard',   color:'#fb923c' },
}

const SOURCE_COLORS = {
  'variety.com':           '#9b59b6',
  'deadline.com':          '#e74c3c',
  'hollywoodreporter.com': '#3498db',
  'ew.com':                '#2ecc71',
  'tvline.com':            '#f39c12',
  'indiewire.com':         '#1abc9c',
  'thewrap.com':           '#e67e22',
  'blexmedia.com':         '#f59e0b',
  'collider.com':          '#8b5cf6',
  'vulture.com':           '#ec4899',
  'avclub.com':            '#06b6d4',
  'collider.com':          '#8b5cf6',
}

function formatSource(s) {
  const map = {
    'variety.com':'Variety','deadline.com':'Deadline',
    'hollywoodreporter.com':'THR','tvline.com':'TVLine',
    'indiewire.com':'IndieWire','thewrap.com':'The Wrap',
    'ew.com':'EW','blexmedia.com':'Blex Media',
    'collider.com':'Collider','vulture.com':'Vulture',
    'avclub.com':'AV Club',
  }
  return map[s] || (s||'').replace(/\.com$/,'')
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso), diff = Date.now() - d.getTime()
    const h = Math.floor(diff/3600000), days = Math.floor(diff/86400000)
    if (h < 1) return 'Just now'
    if (h < 24) return `${h}h ago`
    if (days < 7) return `${days}d ago`
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  } catch { return '' }
}

function CatBadge({ cat, small }) {
  const conf = CATS[cat] || CATS.premieres
  return (
    <span className={`inline-flex items-center gap-1 font-black uppercase tracking-widest ${small ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'} rounded-full`}
      style={{background:`${conf.color}20`, color:conf.color, border:`1px solid ${conf.color}30`}}>
      <i className={`fa-solid fa-${conf.icon}`} style={{fontSize:'8px'}}></i>
      {conf.label}
    </span>
  )
}

// ─── HERO CARD (top story, full-width cinematic) ──────────────────────────────
function HeroCard({ item }) {
  const navigate = useNavigate()
  const cat = item.category || 'premieres'
  const conf = CATS[cat] || CATS.premieres
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="relative w-full rounded-3xl overflow-hidden cursor-pointer group"
      style={{height:'480px'}}
    >
      {/* Background */}
      {poster
        ? <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
        : <div className="absolute inset-0" style={{background:`linear-gradient(135deg, #0f172a 0%, #1e293b 100%)`}}/>
      }

      {/* Gradient overlays */}
      <div className="absolute inset-0" style={{background:'linear-gradient(to top, rgba(2,6,23,0.98) 0%, rgba(2,6,23,0.7) 40%, rgba(2,6,23,0.1) 100%)'}}/>
      <div className="absolute inset-0" style={{background:'linear-gradient(to right, rgba(2,6,23,0.5) 0%, transparent 60%)'}}/>

      {/* TOP label */}
      <div className="absolute top-5 left-5 flex items-center gap-3">
        <span className="flex items-center gap-1.5 bg-cyan-400 text-slate-950 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full">
          <i className="fa-solid fa-fire text-[9px]"></i> Top Story
        </span>
        <CatBadge cat={cat}/>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-8">
        {item.show_title && (
          <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-2">{item.show_title}</p>
        )}
        <h2 className="text-white font-black leading-tight mb-3 group-hover:text-cyan-50 transition-colors"
          style={{fontSize:'clamp(1.4rem, 2.5vw, 2rem)', maxWidth:'640px'}}>
          {item.headline}
        </h2>
        {item.summary && (
          <p className="text-slate-300 text-sm leading-relaxed mb-4 line-clamp-2" style={{maxWidth:'540px'}}>
            {item.summary}
          </p>
        )}
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-cyan-400 text-xs font-black">
            <i className="fa-solid fa-sparkles text-[10px]"></i>AirDate Original
          </span>
          <span className="text-slate-500 text-xs">•</span>
          <span className="text-slate-400 text-xs">{formatTime(item.published_at)}</span>
          <span className="ml-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white text-xs font-bold px-4 py-2 rounded-xl transition-all border border-white/10 group-hover:border-cyan-500/40">
            Read Story <i className="fa-solid fa-arrow-right text-[10px]"></i>
          </span>
        </div>
      </div>
    </article>
  )
}

// ─── FEATURED CARD (medium, 2-col row) ────────────────────────────────────────
function FeaturedCard({ item }) {
  const navigate = useNavigate()
  const cat = item.category || 'premieres'
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="relative rounded-2xl overflow-hidden cursor-pointer group flex-1"
      style={{minHeight:'260px'}}
    >
      {poster
        ? <img src={poster} alt="" className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        : <div className="absolute inset-0 bg-slate-800"/>
      }
      <div className="absolute inset-0" style={{background:'linear-gradient(to top, rgba(2,6,23,0.97) 0%, rgba(2,6,23,0.4) 60%, transparent 100%)'}}/>

      <div className="absolute top-3 left-3"><CatBadge cat={cat} small/></div>

      <div className="absolute bottom-0 left-0 right-0 p-5">
        {item.show_title && <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1">{item.show_title}</p>}
        <h3 className="text-white font-black text-sm leading-snug line-clamp-3 group-hover:text-cyan-100 transition-colors mb-2">
          {item.headline}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-cyan-400 text-[10px] font-black flex items-center gap-1">
            <i className="fa-solid fa-sparkles" style={{fontSize:'8px'}}></i>AirDate Original
          </span>
          <span className="text-slate-400 text-[10px]">{formatTime(item.published_at)}</span>
        </div>
      </div>
    </article>
  )
}

// ─── STANDARD GRID CARD ───────────────────────────────────────────────────────
function GridCard({ item }) {
  const navigate = useNavigate()
  const cat = item.category || 'premieres'
  const conf = CATS[cat] || CATS.premieres
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="group bg-slate-900/50 border border-white/5 hover:border-cyan-500/20 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col hover:bg-slate-900/80 hover:-translate-y-0.5"
    >
      {poster ? (
        <div className="relative h-36 overflow-hidden flex-shrink-0">
          <img src={poster} alt={item.show_title||''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <div className="absolute inset-0" style={{background:'linear-gradient(to top, rgba(15,23,42,0.9) 0%, transparent 60%)'}}/>
          <div className="absolute top-2.5 left-2.5"><CatBadge cat={cat} small/></div>
          {item.show_title && (
            <div className="absolute bottom-2 left-3 right-3">
              <p className="text-white font-black text-xs line-clamp-1">{item.show_title}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="px-4 pt-4 flex-shrink-0"><CatBadge cat={cat} small/></div>
      )}

      <div className="flex flex-col flex-1 p-4">
        <h3 className="text-white font-black text-xs leading-snug line-clamp-3 mb-2 group-hover:text-cyan-400 transition-colors flex-1">
          {item.headline}
        </h3>
        {item.summary && (
          <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 mb-3">{item.summary}</p>
        )}
        <div className="flex items-center justify-between pt-2.5 border-t border-white/5">
          <span className="text-cyan-400 text-[10px] font-black flex items-center gap-1">
            <i className="fa-solid fa-sparkles" style={{fontSize:'8px'}}></i>AirDate Original
          </span>
          <span className="text-slate-500 text-[10px]">{formatTime(item.published_at)}</span>
        </div>
      </div>
    </article>
  )
}

// ─── LIST ROW (compact sidebar-style) ────────────────────────────────────────
function ListRow({ item, index }) {
  const navigate = useNavigate()
  const cat = item.category || 'premieres'
  const conf = CATS[cat] || CATS.premieres
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="group flex gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5"
    >
      <span className="text-2xl font-black text-slate-700 w-6 shrink-0 leading-tight mt-0.5"
        style={{fontVariantNumeric:'tabular-nums'}}>{String(index+1).padStart(2,'0')}</span>

      {poster && (
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
          <img src={poster} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"/>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <div className="mb-1"><CatBadge cat={cat} small/></div>
        <h4 className="text-white text-xs font-bold leading-snug line-clamp-2 group-hover:text-cyan-400 transition-colors">
          {item.headline}
        </h4>
        <p className="text-slate-500 text-[10px] mt-1">{formatTime(item.published_at)}</p>
      </div>
    </article>
  )
}

function SkeletonHero() {
  return <div className="animate-pulse bg-slate-800/40 rounded-3xl w-full" style={{height:'480px'}}/>
}

function SkeletonGrid({ n=8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({length:n}).map((_,i) => (
        <div key={i} className="animate-pulse bg-slate-800/40 rounded-2xl h-64 border border-white/5" style={{animationDelay:`${i*0.07}s`}}/>
      ))}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export function ScoopPage() {
  const [all,         setAll]         = useState([])
  const [feed,        setFeed]        = useState({})
  const [counts,      setCounts]      = useState({})
  const [activeTab,   setActiveTab]   = useState('all')
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [error,       setError]       = useState(null)

  const loadScoop = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`${MANIFEST_URL}?t=${Date.now()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data  = await res.json()
      const items = (data.items||[]).filter(i => i.story_hash && i.headline)
      items.sort((a,b) => new Date(b.published_at||0) - new Date(a.published_at||0))

      const grouped = {}
      items.forEach(item => {
        const cat = item.category || 'production'
        if (!grouped[cat]) grouped[cat] = []
        grouped[cat].push(item)
      })

      setAll(items)
      setFeed(grouped)
      setCounts(Object.fromEntries(Object.entries(grouped).map(([k,v]) => [k, v.length])))
      if (data.updated_at) setLastUpdated(new Date(data.updated_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))
    } catch(e) {
      console.error('Scoop fetch error:', e)
      setError('Could not load stories. The agent may be mid-run — check back in a moment.')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { loadScoop() }, [loadScoop])
  useEffect(() => {
    const iv = setInterval(loadScoop, 15*60*1000)
    return () => clearInterval(iv)
  }, [loadScoop])

  const displayed = activeTab === 'all' ? all : (feed[activeTab] || [])

  // Partition for editorial layout (only in "all" mode)
  const hero       = displayed[0]
  const featured   = displayed.slice(1, 3)
  const sideTop    = displayed.slice(3, 8)   // numbered list sidebar
  const gridItems  = displayed.slice(8)      // standard grid below

  const isAll = activeTab === 'all'

  return (
    <div className="min-h-screen text-slate-100" style={{background:'#020617'}}>
      <div className="w-full max-w-[1400px] mx-auto px-6 pt-24 pb-20">

        {/* ── PAGE HEADER ─────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            {/* Eyebrow */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-px bg-cyan-400"></span>
              <span className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em]">AI-Synthesized Intelligence</span>
            </div>
            <h1 className="text-white font-black tracking-tight leading-none normal-case"
              style={{fontSize:'clamp(2rem, 4vw, 3rem)', letterSpacing:'-0.02em'}}>
              The Scoop
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">Real-time TV industry intelligence, synthesized by AI</p>
          </div>

          <div className="flex items-center gap-3 mb-1">
            {lastUpdated && (
              <span className="text-slate-500 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block"></span>
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={loadScoop} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50"
            >
              <i className={`fa-solid fa-rotate text-cyan-400 text-xs ${loading?'animate-spin':''}`}></i>Refresh
            </button>
          </div>
        </div>

        {/* ── CATEGORY TABS ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 mb-8 pb-6 border-b border-white/5">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
              activeTab === 'all'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
            }`}
          >
            <i className="fa-solid fa-layer-group text-[10px]"></i>All
            <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">{all.length}</span>
          </button>
          {Object.entries(CATS).map(([key, conf]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                activeTab === key ? 'border-current' : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}
              style={activeTab === key ? {background:`${conf.color}20`, color:conf.color, borderColor:`${conf.color}40`} : {}}
            >
              <i className={`fa-solid fa-${conf.icon} text-[10px]`}></i>{conf.label}
              <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">{counts[key]??0}</span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ──────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-6">
            <SkeletonHero/>
            <SkeletonGrid n={8}/>
          </div>
        ) : error ? (
          <div className="text-center py-32 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4 block"></i>
            <h3 className="text-xl font-black text-white mb-2">Agent mid-run</h3>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button onClick={loadScoop} className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all">
              Try Again
            </button>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-32 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4 block"></i>
            <h3 className="text-xl font-black text-white mb-2">No stories yet</h3>
            <p className="text-slate-400 text-sm mb-6">The agent runs every 4 hours. Check back soon.</p>
            <button onClick={loadScoop} className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all">
              Refresh Feed
            </button>
          </div>

        ) : isAll ? (
          /* ── EDITORIAL LAYOUT (All tab) ─────────────────────────────────── */
          <div className="space-y-6">

            {/* Row 1: Hero + Numbered sidebar */}
            <div className="flex gap-5" style={{alignItems:'stretch'}}>
              {/* Hero */}
              <div className="flex-1 min-w-0">
                {hero && <HeroCard item={hero}/>}
              </div>

              {/* Sidebar: top 5 numbered */}
              <div className="w-72 flex-shrink-0 bg-slate-900/50 border border-white/5 rounded-3xl p-4 flex flex-col">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                  <i className="fa-solid fa-ranking-star text-cyan-400 text-sm"></i>
                  <span className="text-white text-xs font-black uppercase tracking-widest">Trending Now</span>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  {sideTop.map((item, i) => <ListRow key={item.story_hash||i} item={item} index={i}/>)}
                </div>
              </div>
            </div>

            {/* Row 2: 2 featured cards */}
            {featured.length > 0 && (
              <div className="flex gap-5" style={{height:'260px'}}>
                {featured.map((item, i) => <FeaturedCard key={item.story_hash||i} item={item}/>)}
              </div>
            )}

            {/* Section label */}
            {gridItems.length > 0 && (
              <div className="flex items-center gap-4 pt-2">
                <span className="text-white text-xs font-black uppercase tracking-[0.2em]">More Stories</span>
                <div className="flex-1 h-px bg-white/5"></div>
              </div>
            )}

            {/* Row 3+: Standard grid */}
            {gridItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gridItems.map((item, i) => <GridCard key={item.story_hash||i} item={item}/>)}
              </div>
            )}

          </div>
        ) : (
          /* ── FILTERED LAYOUT (category tab) ─────────────────────────────── */
          <div className="space-y-6">
            {displayed.length > 0 && (
              <>
                {/* Hero */}
                <HeroCard item={displayed[0]}/>

                {/* Featured pair */}
                {displayed.length > 1 && (
                  <div className="flex gap-5" style={{height:'260px'}}>
                    {displayed.slice(1,3).map((item,i) => <FeaturedCard key={item.story_hash||i} item={item}/>)}
                  </div>
                )}

                {/* Grid */}
                {displayed.length > 3 && (
                  <>
                    <div className="flex items-center gap-4 pt-2">
                      <span className="text-white text-xs font-black uppercase tracking-[0.2em]">More Stories</span>
                      <div className="flex-1 h-px bg-white/5"></div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {displayed.slice(3).map((item,i) => <GridCard key={item.story_hash||i} item={item}/>)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>
      <Footer/>
    </div>
  )
}