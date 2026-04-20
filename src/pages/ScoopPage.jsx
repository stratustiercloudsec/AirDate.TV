// src/pages/ScoopPage.jsx — v2.1 (React port of scoop.js v2.1)
// Full story drawer with Bedrock /get-story, category tabs, source badges

import { useEffect, useState, useCallback, useRef } from 'react'
import { useAuth }   from '@/context/AuthContext'
import { API_BASE }  from '@/config/aws'
import { Footer }    from '@/components/layout/Footer'

const CATS = {
  premieres:     { label:'Premiere Dates',    icon:'calendar-star',  color:'#22d3ee' },
  renewals:      { label:'Renewals',          icon:'rotate',         color:'#4ade80' },
  cancellations: { label:'Cancellations',     icon:'ban',            color:'#f87171' },
  casting:       { label:'Casting News',      icon:'user-plus',      color:'#c084fc' },
  production:    { label:'Production Updates',icon:'clapperboard',   color:'#fb923c' },
}

const SOURCE_COLORS = {
  'variety.com':           '#9b59b6',
  'deadline.com':          '#e74c3c',
  'hollywoodreporter.com': '#3498db',
  'ew.com':                '#2ecc71',
  'tvline.com':            '#f39c12',
  'indiewire.com':         '#1abc9c',
  'thewrap.com':           '#e67e22',
}

function formatSource(s) {
  return (s||'')
    .replace('variety.com','Variety').replace('deadline.com','Deadline')
    .replace('hollywoodreporter.com','THR').replace('tvline.com','TVLine')
    .replace('indiewire.com','IndieWire').replace('thewrap.com','The Wrap')
    .replace('ew.com','EW').replace(/\.com$/,'')
}

function formatTime(iso) {
  if (!iso) return ''
  try {
    const d=new Date(iso),diff=Date.now()-d.getTime(),h=Math.floor(diff/3600000),days=Math.floor(diff/86400000)
    if (h<1) return 'Just now'
    if (h<24) return `${h}h ago`
    if (days<7) return `${days}d ago`
    return d.toLocaleDateString('en-US',{month:'short',day:'numeric'})
  } catch { return '' }
}

function renderMarkdown(md) {
  if (!md) return ''
  return md.split(/\n\n+/).map(block=>{
    if (/^##\s/.test(block)) return `<h3 class="text-white font-black text-base mt-5 mb-2">${block.replace(/^##\s+/,'')}</h3>`
    const html = block
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,"<strong class='text-white font-bold'>$1</strong>")
      .replace(/\*(.+?)\*/g,"<em class='italic'>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,`<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline decoration-cyan-400/30 hover:decoration-cyan-400 transition-all">$1</a>`)
    return `<p>${html}</p>`
  }).join('\n')
}

function gw(raw) {
  if (!raw) return {}
  return raw.body?(typeof raw.body==='string'?JSON.parse(raw.body):raw.body):raw
}

// ─── Cat badge ────────────────────────────────────────────────────────────────
function CatBadge({ cat }) {
  const conf = CATS[cat]||CATS.premieres
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider"
      style={{background:`${conf.color}22`,color:conf.color,border:`1px solid ${conf.color}33`}}>
      <i className={`fa-solid fa-${conf.icon} text-[10px]`}></i>{conf.label}
    </span>
  )
}

// ─── Scoop card ───────────────────────────────────────────────────────────────
function ScoopCard({ item, onClick }) {
  const cat     = item.category||'premieres'
  const conf    = CATS[cat]||CATS.premieres
  const srcColor= SOURCE_COLORS[item.domain]||'#475569'
  const srcLabel= formatSource(item.domain)
  const timeAgo = formatTime(item.published_at)
  const poster  = item.poster_url||item.poster
  return (
    <article className="group bg-slate-900/50 border border-white/5 hover:border-white/10 rounded-3xl overflow-hidden transition-all duration-200 cursor-pointer flex flex-col"
      onClick={()=>onClick(item)}>
      {poster?(
        <div className="relative h-40 overflow-hidden flex-shrink-0">
          <img src={poster} alt={item.show_title||''} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/30 to-transparent"></div>
          <div className="absolute top-3 left-3"><CatBadge cat={cat}/></div>
          {item.show_title&&<div className="absolute bottom-3 left-3 right-3"><p className="text-white font-black text-sm leading-tight line-clamp-1 drop-shadow">{item.show_title}</p></div>}
        </div>
      ):(
        <div className="h-14 flex-shrink-0 flex items-center px-5 pt-4"><CatBadge cat={cat}/></div>
      )}
      <div className={`flex flex-col flex-1 p-5 ${poster?'':'pt-3'}`}>
        <h3 className="text-white font-black text-sm leading-snug line-clamp-3 mb-3 group-hover:text-cyan-400 transition-colors">{item.headline}</h3>
        {item.summary?<p className="text-slate-400 text-xs leading-relaxed line-clamp-2 mb-4 flex-1">{item.summary}</p>:<div className="flex-1"></div>}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
          <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{background:`${srcColor}22`,color:srcColor}}>{srcLabel}</span>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{timeAgo}</span>
            <span className="text-cyan-400 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">Read →</span>
          </div>
        </div>
      </div>
    </article>
  )
}

// ─── Story drawer ─────────────────────────────────────────────────────────────
function StoryDrawer({ item, onClose }) {
  const [story, setStory] = useState(null) // null=loading, {}=error, {headline,...}=loaded
  const drawerRef = useRef(null)

  useEffect(()=>{
    if (!item) return
    setStory(null)
    // Lock body scroll
    document.body.style.overflow='hidden'
    // Fetch story
    fetch(`${API_BASE}/get-story`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        show_title: item.show_title||item.headline?.split(' ').slice(0,5).join(' ')||'',
        headline:   item.headline||'',
        category:   item.category||'general',
        urls:       item.url?[item.url]:[],
        tmdb_id:    item.tmdb_id||null,
      })})
      .then(r=>r.json()).then(raw=>{
        const d=gw(raw)
        if (!d.success||!d.story) throw new Error(d.error||'No story')
        setStory(d.story)
      }).catch(e=>setStory({error:e.message,url:item.url}))
    return ()=>{ document.body.style.overflow='' }
  },[item])

  useEffect(()=>{
    const handler=e=>{ if(e.key==='Escape') onClose() }
    document.addEventListener('keydown',handler)
    return()=>document.removeEventListener('keydown',handler)
  },[])

  if (!item) return null

  const cat  = item.category||'premieres'
  const conf = CATS[cat]||CATS.premieres
  const poster = item.poster_url||item.poster

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" onClick={onClose}/>
      <div ref={drawerRef} className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl bg-slate-950 border-l border-white/8 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-white/8">
          <CatBadge cat={cat}/>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-all">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Poster header */}
          {poster&&(
            <div className="relative -mx-6 -mt-6 h-48 overflow-hidden mb-6">
              <img src={poster} alt="" className="w-full h-full object-cover opacity-60"/>
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
              {item.show_title&&<div className="absolute bottom-4 left-6"><p className="text-white font-black text-xl">{item.show_title}</p></div>}
            </div>
          )}

          {/* Loading skeleton */}
          {story===null&&(
            <>
              <h2 className="text-white font-black text-xl leading-snug">{item.headline}</h2>
              {item.summary&&<p className="text-slate-400 text-sm leading-relaxed">{item.summary}</p>}
              <div className="flex items-center gap-3 py-4">
                <div className="flex gap-1">
                  {[0,0.15,0.3].map(d=><span key={d} className="w-2 h-2 rounded-full bg-cyan-400 animate-bounce" style={{animationDelay:`${d}s`}}></span>)}
                </div>
                <span className="text-slate-400 text-sm">Generating AirDate story…</span>
              </div>
              <div className="space-y-3 mt-2">
                {[95,88,100,72,90,60].map((w,i)=>(
                  <div key={i} className="h-3 rounded-full bg-slate-800 animate-pulse" style={{width:`${w}%`,animationDelay:`${i*0.1}s`}}></div>
                ))}
              </div>
            </>
          )}

          {/* Error */}
          {story?.error&&(
            <>
              <h2 className="text-white font-black text-xl">{item.headline}</h2>
              <div className="flex items-center gap-3 py-4">
                <i className="fa-solid fa-circle-exclamation text-red-400"></i>
                <span className="text-slate-400 text-sm">Could not generate story. {story.error}</span>
              </div>
              {story.url&&(
                <a href={story.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-800 text-white text-sm font-bold hover:bg-slate-700 transition-colors">
                  <i className="fa-solid fa-newspaper text-cyan-400"></i>Read original article
                  <i className="fa-solid fa-arrow-up-right-from-square text-xs text-slate-400"></i>
                </a>
              )}
            </>
          )}

          {/* Loaded story */}
          {story&&!story.error&&(()=>{
            const showMeta  = story.show_meta||{}
            const keyFacts  = story.key_facts||[]
            const citations = story.citations||[]
            const cast      = showMeta.cast||[]
            const networks  = (showMeta.networks||[]).join(', ')
            const backdrop  = showMeta.backdrop_url||showMeta.poster_url||item.poster_url||item.poster||null
            return (
              <>
                {backdrop&&(
                  <div className="relative -mx-6 -mt-6 h-52 overflow-hidden mb-6">
                    <img src={backdrop} alt="" className="w-full h-full object-cover"/>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent"></div>
                    <div className="absolute bottom-0 left-0 right-0 px-6 py-4">
                      {networks&&<p className="text-cyan-400 text-xs font-black uppercase tracking-widest mb-1">{networks}</p>}
                      {item.show_title&&<p className="text-white font-black text-2xl leading-tight">{item.show_title}</p>}
                    </div>
                  </div>
                )}
                <h2 className="text-white font-black text-xl leading-snug mb-1">{story.headline||item.headline}</h2>
                <p className="text-slate-400 text-xs mb-4">
                  <i className="fa-solid fa-sparkles text-cyan-400 mr-1"></i>
                  AirDate Original · synthesized from {citations.length||'multiple'} sources
                </p>
                {story.lede&&<p className="text-slate-200 text-base leading-relaxed font-medium border-l-2 border-cyan-400 pl-4 mb-5">{story.lede}</p>}
                {keyFacts.length>0&&(
                  <div className="flex flex-wrap gap-2 mb-5">
                    {keyFacts.map((f,i)=>(
                      <span key={i} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800/60 border border-white/8 text-slate-200 text-xs font-semibold">
                        <i className="fa-solid fa-check text-cyan-400 text-[10px]"></i>{f}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-slate-200 text-sm leading-relaxed space-y-4 mb-6"
                  dangerouslySetInnerHTML={{__html:renderMarkdown(story.body||'')}}/>
                {cast.length>0&&(
                  <div className="mb-6">
                    <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-3">Cast</p>
                    <div className="flex gap-3 overflow-x-auto pb-1">
                      {cast.map((c,i)=>(
                        <div key={i} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-16">
                          {c.profile_url
                            ?<img src={c.profile_url} alt={c.name} className="w-14 h-14 rounded-2xl object-cover bg-slate-800"/>
                            :<div className="w-14 h-14 rounded-2xl bg-slate-800 flex items-center justify-center"><i className="fa-solid fa-user text-slate-400"></i></div>}
                          <p className="text-white text-[10px] font-bold text-center leading-tight line-clamp-2">{c.name}</p>
                          {c.character&&<p className="text-slate-400 text-[9px] text-center line-clamp-1">{c.character}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {(showMeta.seasons||showMeta.episodes||showMeta.vote_average)&&(
                  <div className="grid grid-cols-3 gap-3 mb-6">
                    {showMeta.seasons&&<div className="bg-slate-800/40 rounded-2xl p-3 text-center border border-white/5"><p className="text-cyan-400 font-black text-lg">{showMeta.seasons}</p><p className="text-slate-400 text-xs">Seasons</p></div>}
                    {showMeta.episodes&&<div className="bg-slate-800/40 rounded-2xl p-3 text-center border border-white/5"><p className="text-cyan-400 font-black text-lg">{showMeta.episodes}</p><p className="text-slate-400 text-xs">Episodes</p></div>}
                    {showMeta.vote_average&&<div className="bg-slate-800/40 rounded-2xl p-3 text-center border border-white/5"><p className="text-cyan-400 font-black text-lg">{Number(showMeta.vote_average).toFixed(1)}</p><p className="text-slate-400 text-xs">TMDB Score</p></div>}
                  </div>
                )}
                {citations.length>0&&(
                  <div className="border-t border-white/8 pt-4">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3">Sources</p>
                    <div className="flex flex-wrap gap-2">
                      {citations.map((c,i)=>{
                        const color=SOURCE_COLORS[c.domain]||'#475569'
                        return (
                          <a key={i} href={c.url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all hover:opacity-80"
                            style={{background:`${color}22`,color,border:`1px solid ${color}33`}}>
                            {c.title?c.title.substring(0,40)+(c.title.length>40?'…':''):c.domain||'Source'}
                            <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                          </a>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            )
          })()}
        </div>
      </div>
    </>
  )
}

// ─── Skeleton cards ───────────────────────────────────────────────────────────
function SkeletonCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
      {Array.from({length:8}).map((_,i)=>(
        <div key={i} className="animate-pulse bg-slate-800/40 rounded-3xl h-72 border border-white/5" style={{animationDelay:`${i*0.08}s`}}></div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function ScoopPage() {
  const { token, isPremium } = useAuth()
  const [all,         setAll]         = useState([])
  const [feed,        setFeed]        = useState({})
  const [counts,      setCounts]      = useState({})
  const [activeTab,   setActiveTab]   = useState('all')
  const [loading,     setLoading]     = useState(true)
  const [lastUpdated, setLastUpdated] = useState('')
  const [drawerItem,  setDrawerItem]  = useState(null)

  const loadScoop = useCallback(async()=>{
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/get-scoop`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({category:'all',max_items:40})
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw  = await res.json()
      const data = gw(raw)
      const items= data.items||data.all||[]
      const grouped={}
      items.forEach(item=>{
        const cat=item.category||'premieres'
        if (!grouped[cat]) grouped[cat]=[]
        grouped[cat].push(item)
      })
      setAll(items)
      setFeed(grouped)
      setCounts(Object.fromEntries(Object.entries(grouped).map(([k,v])=>[k,v.length])))
      if (data.updated_at||items[0]?.published_at) {
        const ts=data.updated_at||items[0]?.published_at
        setLastUpdated(new Date(ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))
      }
    } catch(e) {
      console.error('Scoop fetch error:',e)
    } finally {
      setLoading(false)
    }
  },[token])

  useEffect(()=>{loadScoop()},[loadScoop])

  const displayed = activeTab==='all' ? all : (feed[activeTab]||[])

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">

        {/* Page header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8 border-b border-white/5 pb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-cyan-500/10 rounded-2xl border border-cyan-500/20">
              <i className="fa-solid fa-fire text-cyan-400 text-2xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight uppercase">The Scoop</h1>
              <p className="text-slate-400 text-sm mt-0.5">AI-synthesized TV industry intelligence</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {lastUpdated&&<span className="text-slate-500 text-xs">Updated {lastUpdated}</span>}
            <button onClick={loadScoop} disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50">
              <i className={`fa-solid fa-rotate text-cyan-400 text-xs ${loading?'animate-spin':''}`}></i>Refresh
            </button>
          </div>
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button onClick={()=>setActiveTab('all')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${activeTab==='all'?'bg-cyan-500/20 border-cyan-500/40 text-cyan-400':'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'}`}>
            <i className="fa-solid fa-layer-group text-[10px]"></i>All
            <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">{all.length}</span>
          </button>
          {Object.entries(CATS).map(([key,conf])=>(
            <button key={key} onClick={()=>setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all border ${activeTab===key?'border-current':'bg-slate-800/40 border-white/5 text-slate-400 hover:text-white hover:border-white/10'}`}
              style={activeTab===key?{background:`${conf.color}22`,color:conf.color,borderColor:`${conf.color}40`}:{}}>
              <i className={`fa-solid fa-${conf.icon} text-[10px]`}></i>{conf.label}
              <span className="bg-slate-700/60 text-slate-300 px-1.5 py-0.5 rounded-md text-[10px] font-bold">{counts[key]??0}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <SkeletonCards/>
        ) : displayed.length===0 ? (
          <div className="text-center py-24 border border-dashed border-slate-700/50 rounded-3xl">
            <i className="fa-solid fa-satellite-dish text-slate-600 text-5xl mb-4"></i>
            <h3 className="text-xl font-black text-white mb-2">No stories found</h3>
            <p className="text-slate-400 text-sm mb-6">No stories in this category right now.</p>
            <button onClick={loadScoop} className="bg-cyan-500 text-slate-950 font-black px-6 py-3 rounded-xl text-sm hover:bg-cyan-400 transition-all">Refresh Feed</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
            {displayed.map((item,i)=>(
              <ScoopCard key={`${item.headline}-${i}`} item={item} onClick={setDrawerItem}/>
            ))}
          </div>
        )}

      </div>
      <Footer/>

      {/* Story Drawer */}
      {drawerItem&&<StoryDrawer item={drawerItem} onClose={()=>setDrawerItem(null)}/>}
    </div>
  )
}