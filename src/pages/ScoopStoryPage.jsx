// src/pages/ScoopStoryPage.jsx — v1.0
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

const STORY_BASE = 'https://s3.amazonaws.com/airdate.tv/scoop/stories/'

const SOURCE_COLORS = {
  'variety.com':'#9b59b6','deadline.com':'#e74c3c',
  'hollywoodreporter.com':'#3498db','ew.com':'#2ecc71',
  'tvline.com':'#f39c12','indiewire.com':'#1abc9c',
  'thewrap.com':'#e67e22','blexmedia.com':'#f59e0b',
  'collider.com':'#8b5cf6','vulture.com':'#ec4899',
}

const CATS = {
  premieres:     { label:'Premiere Dates',     icon:'calendar-star', color:'#22d3ee' },
  renewals:      { label:'Renewals',           icon:'rotate',        color:'#4ade80' },
  cancellations: { label:'Cancellations',      icon:'ban',           color:'#f87171' },
  casting:       { label:'Casting News',       icon:'user-plus',     color:'#c084fc' },
  production:    { label:'Production Updates', icon:'clapperboard',  color:'#fb923c' },
}

function renderMarkdown(md) {
  if (!md) return ''
  return md.split(/\n\n+/).map(block => {
    if (/^##\s/.test(block)) return `<h3 class="text-white font-black text-xl mt-8 mb-3">${block.replace(/^##\s+/,'')}</h3>`
    if (/^#\s/.test(block))  return `<h2 class="text-white font-black text-2xl mt-8 mb-3">${block.replace(/^#\s+/,'')}</h2>`
    const html = block
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/\*\*(.+?)\*\*/g,"<strong class='text-white font-bold'>$1</strong>")
      .replace(/\*(.+?)\*/g,"<em class='italic'>$1</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,`<a href="$2" target="_blank" rel="noopener noreferrer" class="text-cyan-400 underline hover:text-cyan-300 transition-colors">$1</a>`)
    return `<p class="text-slate-300 text-base leading-relaxed mb-4">${html}</p>`
  }).join('\n')
}

export function ScoopStoryPage() {
  const { hash }  = useParams()
  const navigate  = useNavigate()
  const [story, setStory]   = useState(null)
  const [error, setError]   = useState(null)

  useEffect(() => {
    fetch(`${STORY_BASE}${hash}.json`)
      .then(r => { if (!r.ok) throw new Error('Story not found'); return r.json() })
      .then(setStory)
      .catch(e => setError(e.message))
  }, [hash])

  if (error) return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-4">
      <i className="fa-solid fa-circle-exclamation text-red-400 text-4xl"></i>
      <p className="text-white font-black text-xl">Story not found</p>
      <button onClick={() => navigate('/scoop')}
        className="text-cyan-400 text-sm hover:underline">
        ← Back to The Scoop
      </button>
    </div>
  )

  if (!story) return (
    <div className="bg-slate-950 min-h-screen flex items-center justify-center">
      <div className="flex gap-1">
        {[0,0.15,0.3].map(d => (
          <span key={d} className="w-3 h-3 rounded-full bg-cyan-400 animate-bounce"
            style={{animationDelay:`${d}s`}}></span>
        ))}
      </div>
    </div>
  )

  const cat      = story.category || 'production'
  const conf     = CATS[cat] || CATS.production
  const keyFacts = story.key_facts || []
  const sources  = story.sources_used || []

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-3xl mx-auto px-6 pt-24 pb-20">

        {/* Back */}
        <button onClick={() => navigate('/scoop')}
          className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-8 transition-colors group">
          <i className="fa-solid fa-arrow-left group-hover:-translate-x-1 transition-transform"></i>
          Back to The Scoop
        </button>

        {/* Hero image */}
        {story.image_url && (
          <div className="relative h-64 sm:h-80 rounded-2xl overflow-hidden mb-8">
            <img src={story.image_url} alt={story.show_title || story.headline}
              className="w-full h-full object-cover"/>
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"/>
            {story.image_source === 'pexels' && (
              <span className="absolute bottom-3 right-3 text-[10px] text-slate-500 bg-slate-950/60 px-2 py-1 rounded-md">
                Photo by Pexels
              </span>
            )}
          </div>
        )}

        {/* Category badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider mb-6"
          style={{background:`${conf.color}22`, color:conf.color, border:`1px solid ${conf.color}33`}}>
          <i className={`fa-solid fa-${conf.icon} text-[10px]`}></i>{conf.label}
        </span>

        {/* Headline */}
        <h1 className="text-white font-black text-3xl sm:text-4xl leading-tight mb-4">
          {story.headline}
        </h1>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-8 text-slate-500 text-sm">
          <span className="flex items-center gap-1.5">
            <i className="fa-solid fa-sparkles text-cyan-400 text-xs"></i>
            AirDate Original
          </span>
          <span>·</span>
          <span>{new Date(story.published_at).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}</span>
        </div>

        {/* Lede */}
        {story.lede && (
          <p className="text-slate-200 text-xl leading-relaxed font-medium border-l-4 border-cyan-400 pl-6 mb-10 italic">
            {story.lede}
          </p>
        )}

        {/* Key facts */}
        {keyFacts.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-10">
            {keyFacts.map((f,i) => (
              <span key={i} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-800/60 border border-white/8 text-slate-200 text-sm font-semibold">
                <i className="fa-solid fa-check text-cyan-400 text-xs"></i>{f}
              </span>
            ))}
          </div>
        )}

        {/* Body */}
        <div className="mb-12"
          dangerouslySetInnerHTML={{__html: renderMarkdown(story.body || '')}}/>

        {/* CTA */}
        <div className="mt-16 pt-8 border-t border-white/5 text-center">
          <button onClick={() => navigate('/scoop')}
            className="bg-cyan-500 text-slate-950 font-black px-8 py-3 rounded-2xl text-sm hover:bg-cyan-400 transition-all">
            ← More from The Scoop
          </button>
        </div>

      </div>
      <Footer/>
    </div>
  )
}
