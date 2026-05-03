// src/pages/ScoopPage.jsx — v4.0
// Editorial magazine layout: hero + featured row + filterable grid
// v2.38 mobile fixes: hero+sidebar stack vertically, hero scales, featured stacks

import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

import { SCOOP_MANIFEST_URL } from '../config/aws'
const MANIFEST_URL = SCOOP_MANIFEST_URL

const CATS = {
  premieres:     { label:'Premiere Dates',     icon:'calendar-star',  color:'#22d3ee' },
  renewals:      { label:'Renewals',           icon:'rotate',         color:'#4ade80' },
  cancellations: { label:'Cancellations',      icon:'ban',            color:'#f87171' },
  casting:       { label:'Casting News',       icon:'user-plus',      color:'#c084fc' },
  production:    { label:'Production Updates', icon:'clapperboard',   color:'#fb923c' },
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
    <span
      className={`inline-flex items-center gap-1 font-black uppercase tracking-widest rounded-full
        ${small ? 'text-[9px] px-2 py-0.5' : 'text-[10px] px-2.5 py-1'}`}
      style={{background:`${conf.color}20`, color:conf.color, border:`1px solid ${conf.color}30`}}>
      <i className={`fa-solid fa-${conf.icon}`} style={{fontSize:'8px'}}/>
      {conf.label}
    </span>
  )
}

// ─── HERO CARD ────────────────────────────────────────────────────────────────
// Mobile: 320px tall, full width. Desktop: 480px tall.
function HeroCard({ item }) {
  const navigate = useNavigate()
  const cat    = item.category || 'premieres'
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="relative w-full rounded-3xl overflow-hidden cursor-pointer group"
      style={{height:'clamp(320px, 40vw, 480px)'}}
    >
      {poster
        ? <img src={poster} alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"/>
        : <div className="absolute inset-0" style={{background:'linear-gradient(135deg,#0f172a 0%,#1e293b 100%)'}}/>
      }
      <div className="absolute inset-0" style={{background:'linear-gradient(to top,rgba(2,6,23,0.98) 0%,rgba(2,6,23,0.7) 40%,rgba(2,6,23,0.1) 100%)'}}/>
      <div className="absolute inset-0" style={{background:'linear-gradient(to right,rgba(2,6,23,0.5) 0%,transparent 60%)'}}/>

      {/* Badges */}
      <div className="absolute top-4 left-4 sm:top-5 sm:left-5 flex items-center gap-2 sm:gap-3">
        <span className="flex items-center gap-1.5 bg-cyan-400 text-slate-950 text-[9px] sm:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full">
          <i className="fa-solid fa-fire text-[8px]"/> Top Story
        </span>
        <CatBadge cat={cat}/>
      </div>

      {/* Content */}
      <div className="absolute bottom-0 left-0 right-0 p-5 sm:p-8">
        {item.show_title && (
          <p className="text-cyan-400 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] mb-1.5 sm:mb-2">
            {item.show_title}
          </p>
        )}
        <h2 className="text-white font-black leading-tight mb-2 sm:mb-3 group-hover:text-cyan-50 transition-colors"
          style={{fontSize:'clamp(1.1rem, 2.5vw, 2rem)', maxWidth:'640px'}}>
          {item.headline}
        </h2>
        {item.summary && (
          <p className="hidden sm:block text-slate-300 text-sm leading-relaxed mb-4 line-clamp-2" style={{maxWidth:'540px'}}>
            {item.summary}
          </p>
        )}
        <div className="flex items-center gap-3 sm:gap-4">
          <span className="flex items-center gap-1.5 text-cyan-400 text-[10px] sm:text-xs font-black">
            <i className="fa-solid fa-sparkles text-[9px]"/>AirDate Original
          </span>
          <span className="text-slate-500 text-xs">•</span>
          <span className="text-slate-400 text-[10px] sm:text-xs">{formatTime(item.published_at)}</span>
          <span className="ml-auto flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur text-white text-[10px] sm:text-xs font-bold px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition-all border border-white/10 group-hover:border-cyan-500/40 whitespace-nowrap">
            Read Story <i className="fa-solid fa-arrow-right text-[9px]"/>
          </span>
        </div>
      </div>
    </article>
  )
}

// ─── FEATURED CARD ────────────────────────────────────────────────────────────
function FeaturedCard({ item }) {
  const navigate = useNavigate()
  const cat    = item.category || 'premieres'
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="relative rounded-2xl overflow-hidden cursor-pointer group flex-1"
      style={{minHeight:'200px'}}
    >
      {poster
        ? <img src={poster} alt=""
            className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
        : <div className="absolute inset-0 bg-slate-800"/>
      }
      <div className="absolute inset-0" style={{background:'linear-gradient(to top,rgba(2,6,23,0.97) 0%,rgba(2,6,23,0.4) 60%,transparent 100%)'}}/>

      <div className="absolute top-3 left-3"><CatBadge cat={cat} small/></div>

      <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
        {item.show_title && (
          <p className="text-cyan-400 text-[10px] font-black uppercase tracking-widest mb-1">{item.show_title}</p>
        )}
        <h3 className="text-white font-black text-xs sm:text-sm leading-snug line-clamp-3 group-hover:text-cyan-100 transition-colors mb-2">
          {item.headline}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-cyan-400 text-[10px] font-black flex items-center gap-1">
            <i className="fa-solid fa-sparkles" style={{fontSize:'8px'}}/>AirDate Original
          </span>
          <span className="text-slate-400 text-[10px]">{formatTime(item.published_at)}</span>
        </div>
      </div>
    </article>
  )
}

// ─── GRID CARD ────────────────────────────────────────────────────────────────
function GridCard({ item }) {
  const navigate = useNavigate()
  const cat    = item.category || 'premieres'
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="group bg-slate-900/50 border border-white/5 hover:border-cyan-500/20 rounded-2xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col hover:bg-slate-900/80 hover:-translate-y-0.5"
    >
      {poster ? (
        <div className="relative h-36 overflow-hidden flex-shrink-0">
          <img src={poster} alt={item.show_title||''}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <div className="absolute inset-0" style={{background:'linear-gradient(to top,rgba(15,23,42,0.9) 0%,transparent 60%)'}}/>
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
            <i className="fa-solid fa-sparkles" style={{fontSize:'8px'}}/>AirDate Original
          </span>
          <span className="text-slate-500 text-[10px]">{formatTime(item.published_at)}</span>
        </div>
      </div>
    </article>
  )
}

// ─── LIST ROW (sidebar numbered list) ─────────────────────────────────────────
function ListRow({ item, index }) {
  const navigate = useNavigate()
  const cat    = item.category || 'premieres'
  const poster = item.image_url || item.poster_url || item.poster

  return (
    <article
      onClick={() => item.story_hash && navigate(`/scoop/${item.story_hash}`)}
      className="group flex gap-3 p-3 rounded-xl hover:bg-white/5 cursor-pointer transition-all border border-transparent hover:border-white/5"
    >
      <span className="text-2xl font-black text-slate-700 w-6 shrink-0 leading-tight mt-0.5"
        style={{fontVariantNumeric:'tabular-nums'}}>
        {String(index+1).padStart(2,'0')}
      </span>
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
  return <div className="animate-pulse bg-slate-800/40 rounded-3xl w-full" style={{height:'clamp(320px,40vw,480px)'}}/>
}

function SkeletonGrid({ n=8 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({length:n}).map((_,i) => (
        <div key={i} className="animate-pulse bg-slate-800/40 rounded-2xl h-64 border border-white/5"
          style={{animationDelay:`${i*0.07}s`}}/>
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
      if (data.updated_at) setLastUpdated(
        new Date(data.updated_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
      )
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

  const hero      = displayed[0]
  const featured  = displayed.slice(1, 3)
  const sideTop   = displayed.slice(3, 8)
  const gridItems = displayed.slice(8)
  const isAll     = activeTab === 'all'

  return (
    <div className="min-h-screen text-slate-100" style={{background:'#020617'}}>
      <div className="w-full max-w-[1400px] mx-auto px-4 sm:px-6 pt-24 pb-20">

        {/* ── PAGE HEADER ── */}
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-8 h-px bg-cyan-400"/>
              <span className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em]">
                AI-Synthesized Intelligence
              </span>
            </div>
            <h1 className="text-white font-black tracking-tight leading-none"
              style={{fontSize:'clamp(2rem, 6vw, 4.5rem)', letterSpacing:'-0.02em'}}>
              The Scoop
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">Real-time TV industry intelligence, synthesized by AI</p>
          </div>

          <div className="flex items-center gap-3 mb-1">
            {lastUpdated && (
              <span className="text-slate-500 text-xs flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block"/>
                Updated {lastUpdated}
              </span>
            )}
            <button
              onClick={loadScoop} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50">
              <i className={`fa-solid fa-rotate text-cyan-400 text-xs ${loading?'animate-spin':''}`}/>
              Refresh
            </button>
          </div>
        </div>

        {/* ── CATEGORY TABS — horizontal scroll on mobile ── */}
        <div className="flex gap-2 mb-8 pb-6 border-b border-white/5 overflow-x-auto"
          style={{scrollbarWidth:'none', WebkitOverflowScrolling:'touch'}}>
          <button
            onClick={() => setActiveTab('all')}
            className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
              activeTab === 'all'
                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400'
                : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
            }`}>
            <i className="fa-solid fa-layer-group text-[10px]"/>All
            <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
              {all.length}
            </span>
          </button>
          {Object.entries(CATS).map(([key, conf]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${
                activeTab === key ? 'border-current' : 'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'
              }`}
              style={activeTab === key
                ? {background:`${conf.color}20`, color:conf.color, borderColor:`${conf.color}40`}
                : {}}>
              <i className={`fa-solid fa-${conf.icon} text-[10px]`}/>
              {conf.label}
              <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">
                {counts[key]??0}
              </span>
            </button>
          ))}
        </div>

        {/* ── CONTENT ── */}
        {loading ? (
          <div className="space-y-6">
            <SkeletonHero/>
            <SkeletonGrid n={8}/>
          </div>

        ) : error ? (
          <div className="text-center py-32 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4 block"/>
            <h3 className="text-xl font-black text-white mb-2">Agent mid-run</h3>
            <p className="text-slate-400 text-sm mb-6">{error}</p>
            <button onClick={loadScoop}
              className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all">
              Try Again
            </button>
          </div>

        ) : displayed.length === 0 ? (
          <div className="text-center py-32 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4 block"/>
            <h3 className="text-xl font-black text-white mb-2">No stories yet</h3>
            <p className="text-slate-400 text-sm mb-6">The agent runs every 4 hours. Check back soon.</p>
            <button onClick={loadScoop}
              className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all">
              Refresh Feed
            </button>
          </div>

        ) : isAll ? (
          /* ── EDITORIAL LAYOUT (All tab) ── */
          <div className="space-y-5 sm:space-y-6">

            {/* Row 1: Hero + sidebar
                Mobile: hero full width, sidebar below as horizontal scroll list
                Desktop (lg+): side-by-side flex row */}
            <div className="flex flex-col lg:flex-row gap-5" style={{alignItems:'stretch'}}>

              {/* Hero — full width on mobile */}
              <div className="flex-1 min-w-0">
                {hero && <HeroCard item={hero}/>}
              </div>

              {/* Sidebar — hidden on mobile, visible lg+ */}
              <div className="hidden lg:flex w-72 flex-shrink-0 bg-slate-900/50 border border-white/5 rounded-3xl p-4 flex-col">
                <div className="flex items-center gap-2 mb-4 pb-3 border-b border-white/5">
                  <i className="fa-solid fa-ranking-star text-cyan-400 text-sm"/>
                  <span className="text-white text-xs font-black uppercase tracking-widest">Trending Now</span>
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  {sideTop.map((item, i) => (
                    <ListRow key={item.story_hash||i} item={item} index={i}/>
                  ))}
                </div>
              </div>
            </div>

            {/* Mobile: Trending Now as compact numbered list below hero */}
            {sideTop.length > 0 && (
              <div className="lg:hidden bg-slate-900/50 border border-white/5 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3 pb-3 border-b border-white/5">
                  <i className="fa-solid fa-ranking-star text-cyan-400 text-sm"/>
                  <span className="text-white text-xs font-black uppercase tracking-widest">Trending Now</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                  {sideTop.map((item, i) => (
                    <ListRow key={item.story_hash||i} item={item} index={i}/>
                  ))}
                </div>
              </div>
            )}

            {/* Row 2: Featured pair
                Mobile: stacks vertically (flex-col), each card full width at 220px
                Desktop: side-by-side at 260px */}
            {featured.length > 0 && (
              <div className="flex flex-col sm:flex-row gap-4 sm:gap-5"
                style={{minHeight:'200px'}}>
                {featured.map((item, i) => (
                  <FeaturedCard key={item.story_hash||i} item={item}/>
                ))}
              </div>
            )}

            {/* More Stories label */}
            {gridItems.length > 0 && (
              <div className="flex items-center gap-4 pt-2">
                <span className="text-white text-xs font-black uppercase tracking-[0.2em]">More Stories</span>
                <div className="flex-1 h-px bg-white/5"/>
              </div>
            )}

            {/* Grid */}
            {gridItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {gridItems.map((item, i) => (
                  <GridCard key={item.story_hash||i} item={item}/>
                ))}
              </div>
            )}
          </div>

        ) : (
          /* ── FILTERED LAYOUT (category tab) ── */
          <div className="space-y-5 sm:space-y-6">
            {displayed.length > 0 && (
              <>
                <HeroCard item={displayed[0]}/>

                {displayed.length > 1 && (
                  <div className="flex flex-col sm:flex-row gap-4 sm:gap-5" style={{minHeight:'200px'}}>
                    {displayed.slice(1,3).map((item,i) => (
                      <FeaturedCard key={item.story_hash||i} item={item}/>
                    ))}
                  </div>
                )}

                {displayed.length > 3 && (
                  <>
                    <div className="flex items-center gap-4 pt-2">
                      <span className="text-white text-xs font-black uppercase tracking-[0.2em]">More Stories</span>
                      <div className="flex-1 h-px bg-white/5"/>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {displayed.slice(3).map((item,i) => (
                        <GridCard key={item.story_hash||i} item={item}/>
                      ))}
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