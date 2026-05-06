// src/pages/ShowDetailPage.jsx — v116.6 (React port)
// 3-tier progressive rendering matching details.js v116.6 exactly:
//   Tier 1: Hero visible     ~1–1.5s  (Lambda /get-premieres tmdb_id POST)
//   Tier 2: Secondary data   ~1–3s    (cast, trailer, recs, episode intel — parallel)
//   Tier 3: Scoop            ~3–6s    (Bedrock /generate-recap — never blocks)

import { useEffect, useState, useRef } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE, IMAGE_BASE } from '@/config/aws'
import { usePoster, createDefaultPoster } from '@/utils/poster'
import { getProviderUrl } from '@/utils/providers'

const TMDB_KEY = '9e7202516e78494f2b18ec86d29a4309'
const TMDB     = 'https://api.themoviedb.org/3'

function gw(raw) {
  if (!raw) return {}
  return raw.body ? (typeof raw.body==='string' ? JSON.parse(raw.body) : raw.body) : raw
}

// ─── Timezone-safe date utils (matches details.js) ────────────────────────────
function todayLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function daysBetween(a,b) {
  return Math.round((new Date(b+'T12:00:00')-new Date(a+'T12:00:00'))/86400000)
}
function formatDate(s) {
  if (!s||s==='TBA'||s==='TBD') return 'TBA'
  try {
    const dt = new Date((/^\d{4}-\d{2}-\d{2}$/.test(s)?s+'T12:00:00':s))
    return isNaN(dt.getTime()) ? 'TBA' : dt.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})
  }
  catch { return 'TBA' }
}
function formatScoop(raw) {
  if (!raw || typeof raw !== 'string') return raw
  let text = raw.trim()
  text = text.replace(/^Here(?:'s| is) a[^:]{0,250}:\s*/i, '')
  text = text.replace(/^Here(?:'s| is) a[^.!?\n]*[.!?]\s*/i, '')
  return text.trim()
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function SkeletonHero() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-96 bg-slate-800/50 rounded-3xl"></div>
      <div className="space-y-3"><div className="h-6 bg-slate-800/50 rounded w-1/2"></div><div className="h-4 bg-slate-800/50 rounded w-3/4"></div><div className="h-4 bg-slate-800/50 rounded w-full"></div></div>
    </div>
  )
}

// ─── Cast ─────────────────────────────────────────────────────────────────────
function CastGrid({ cast }) {
  const withImages = (cast||[]).filter(c=>c.profile_path)
  if (!withImages.length) return null
  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-slate-700/50 rounded-lg"><i className="fa-solid fa-users text-slate-300 text-xl"></i></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Cast</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {withImages.slice(0,12).map(c=>(
          <div key={c.id} className="flex-shrink-0 flex flex-col items-center gap-1.5 w-20">
            <img src={`${IMAGE_BASE}/t/p/w185${c.profile_path}`} alt={c.name}
              onError={e=>{e.currentTarget.src=createDefaultPoster(c.name)}}
              className="w-16 h-16 rounded-2xl object-cover bg-slate-800"/>
            <p className="text-white text-[10px] font-bold text-center leading-tight line-clamp-2">{c.name}</p>
            {c.character&&<p className="text-slate-400 text-[9px] text-center line-clamp-1">{c.character}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

// Email builder — outside component to avoid JSX template literal conflicts
function buildOutlookEmail(title, network, premiere, overview, posterUrl, url) {
  const ov = (overview || '').slice(0, 160) + ((overview || '').length > 160 ? '…' : '')
  const rows = [
    posterUrl
      ? `<img src="${posterUrl}" width="440" style="display:block;width:100%;max-width:440px;border-radius:10px;margin-bottom:18px"/>`
      : '',
    `<p style="color:#67e8f9;font-size:10px;font-weight:bold;text-transform:uppercase;letter-spacing:3px;margin:0 0 8px">AirDate.tv</p>`,
    `<h2 style="color:#fff;font-size:20px;font-weight:900;margin:0 0 10px;line-height:1.2">${title}</h2>`,
    network  ? `<p style="color:#94a3b8;margin:4px 0;font-size:13px"><b style="color:#e2e8f0">Network:</b> ${network}</p>`   : '',
    premiere ? `<p style="color:#94a3b8;margin:4px 0;font-size:13px"><b style="color:#e2e8f0">Premiere:</b> ${premiere}</p>` : '',
    ov       ? `<p style="color:#cbd5e1;margin:14px 0;line-height:1.7;font-size:13px">${ov}</p>` : '',
    `<a href="${url}" style="display:inline-block;background:#06b6d4;color:#0f172a;font-weight:900;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:13px;margin-top:6px">Track on AirDate.tv →</a>`,
    `<p style="color:#475569;font-size:11px;margin-top:18px">Track TV premieres before they trend · airdate.tv</p>`,
  ].join('')

  const html =
    '<html><body style="font-family:Arial,sans-serif;background:#0f172a;padding:24px">' +
    '<table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:14px;padding:28px;border:1px solid #334155">' +
    '<tr><td>' + rows + '</td></tr></table></body></html>'

  return encodeURIComponent(html)
}

function ShareModal({ url, title, show, posterUrl, onClose }) {
  const [copied, setCopied] = useState(false)
  const showId    = url.split('/details/')[1]?.split('?')[0]
  // OG proxy URL — for social crawlers (FB/LinkedIn/Twitter)
  const ogUrl     = showId
    ? `https://21ave5trw7.execute-api.us-east-1.amazonaws.com/og/${showId}`
    : url
  const encoded   = encodeURIComponent(ogUrl)   // social shares use OG proxy
  const encDirect = encodeURIComponent(url)      // copy + email use real URL
  const network     = show?.networks?.[0]?.name || show?.network || ''
  const premiere    = show?.first_air_date ? (() => {
    try { const d=new Date(show.first_air_date+'T12:00:00'); return isNaN(d)?'':d.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) } catch { return '' }
  })() : ''
  const overview    = (show?.overview||'').slice(0,200) + ((show?.overview||'').length>200?'…':'')

  // Rich share text for social
  const tweetText   = encodeURIComponent(`🎬 ${title}${network?' on '+network:''}${premiere?' — premiering '+premiere:''} | Track it on AirDate.tv`)
  const emailSubj = encodeURIComponent(`${title} | AirDate.tv`)

  const emailBody = encodeURIComponent(
    `Check out ${title} on AirDate.tv!\n\n` +
    (network  ? `Network: ${network}\n`   : '') +
    (premiere ? `Premiere: ${premiere}\n` : '') +
    (overview ? `\n${overview}\n`        : '') +
    (posterUrl ? `\n🖼️ Poster: ${posterUrl}\n` : '') +
    `\n🔗 ${url}\n\nTrack TV premieres before they trend at AirDate.tv`
  )

  const outlookBody = buildOutlookEmail(title, network, premiere, overview, posterUrl, url)

  async function copyLink() {
    try { await navigator.clipboard.writeText(url) } catch {
      const el = document.createElement('input'); el.value = url
      document.body.appendChild(el); el.select()
      document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(()=>{setCopied(false);onClose()},1500)
  }

  const ogEncoded   = encodeURIComponent(ogUrl)
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(ogUrl)}`

  const options = [
    { icon:'fa-brands fa-x-twitter', label:'X (Twitter)', bg:'bg-black',     href:`https://twitter.com/intent/tweet?url=${encoded}&text=${tweetText}` },
    { icon:'fa-brands fa-facebook',  label:'Facebook',    bg:'bg-blue-600',   href:`https://www.facebook.com/sharer/sharer.php?u=${ogEncoded}` },
    { icon:'fa-brands fa-linkedin',  label:'LinkedIn',    bg:'bg-blue-700',   href:linkedInUrl },
    { icon:'fa-brands fa-whatsapp',  label:'WhatsApp',    bg:'bg-green-600',  href:`https://wa.me/?text=${encodeURIComponent('🎬 '+title+(network?' on '+network:'')+(premiere?' premiering '+premiere:'')+' — '+url)}` },
    { icon:'fa-regular fa-envelope', label:'Email',       bg:'bg-slate-600',  href:`mailto:?subject=${emailSubj}&body=${emailBody}` },
    { icon:'fa-brands fa-microsoft', label:'Outlook',     bg:'bg-blue-500',   href:`https://outlook.live.com/mail/0/deeplink/compose?subject=${emailSubj}&body=${outlookBody}` },
  ]

  return (
    <div className="fixed inset-0 z-[1001] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-slate-900 border border-white/20 w-full max-w-sm rounded-3xl p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-share-nodes text-cyan-400"></i>
            <h3 className="text-lg font-black text-white">Share</h3>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">×</button>
        </div>

        {/* Rich preview card */}
        <div className="flex gap-3 p-3 bg-slate-800/60 rounded-2xl border border-white/10 mb-4">
          {posterUrl && (
            <img src={posterUrl} alt={title}
              className="w-12 h-16 object-cover rounded-xl flex-shrink-0 shadow-lg"/>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-black leading-tight line-clamp-2 mb-1">{title}</p>
            {network && <p className="text-cyan-400 text-[10px] font-bold mb-0.5">{network}</p>}
            {premiere && <p className="text-slate-400 text-[10px]">{premiere}</p>}
            <p className="text-slate-500 text-[9px] truncate mt-1">airdate.tv</p>
          </div>
          <button onClick={copyLink}
            className={`self-start flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
              ${copied?'bg-green-500/20 text-green-400 border border-green-500/30':'bg-slate-700 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-400 border border-white/10'}`}>
            <i className={`fa-solid ${copied?'fa-check':'fa-copy'} text-[10px]`}></i>
            {copied?'✓':'Copy'}
          </button>
        </div>

        <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-3">Share using</p>
        <div className="grid grid-cols-3 gap-2">
          {options.map(o=>(
            <a key={o.label} href={o.href} target="_blank" rel="noreferrer noopener" onClick={onClose}
              className="flex flex-col items-center gap-2 p-3 bg-slate-800/40 hover:bg-slate-700/60 border border-white/5 hover:border-white/20 rounded-2xl transition-all group">
              <div className={`w-10 h-10 rounded-2xl ${o.bg} flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform`}>
                <i className={`${o.icon} text-white text-lg`}></i>
              </div>
              <span className="text-slate-300 text-[9px] font-bold text-center leading-tight">{o.label}</span>
            </a>
          ))}
        </div>

        {/* OG meta note */}
        <p className="text-slate-600 text-[9px] text-center mt-4 font-medium">
          Rich previews appear when shared to airdate.tv
        </p>
      </div>
    </div>
  )
}

function ShareButton({ url, title, show, posterUrl }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={()=>setOpen(true)}
        className="flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 rounded-xl text-white font-bold transition-all">
        <i className="fa-solid fa-share-nodes"></i>
        <span>Share</span>
      </button>
      {open&&<ShareModal url={url} title={title} show={show} posterUrl={posterUrl} onClose={()=>setOpen(false)}/>}
    </>
  )
}

// ─── Providers ────────────────────────────────────────────────────────────────
function ProvidersGrid({ providers, watchLink, showTitle }) {
  if (!providers?.length) return (
    <div className="bg-slate-800/30 rounded-2xl p-6 border border-white/5 text-center">
      <p className="text-slate-400 text-sm">Streaming info not available</p>
      {watchLink&&<a href={watchLink} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-2 text-cyan-400 text-xs font-bold hover:underline">Check JustWatch →</a>}
    </div>
  )
  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-3">
        {providers.map(p=>{
          const href=getProviderUrl(p,showTitle||'',watchLink)
          return (
            <a key={p.provider_id} href={href} target="_blank" rel="noreferrer noopener" className="flex flex-col items-center gap-2 group">
              <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-800 border border-white/10 group-hover:border-cyan-500/40 group-hover:shadow-lg group-hover:shadow-cyan-500/10 transition-all">
                {p.logo_path?<img src={`${IMAGE_BASE}/t/p/w92${p.logo_path}`} alt={p.provider_name} className="w-full h-full object-cover"/>
                  :<div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-tv text-slate-400"></i></div>}
              </div>
              <p className="text-slate-400 text-[10px] font-bold text-center w-16 truncate group-hover:text-cyan-400 transition-colors">{p.provider_name}</p>
            </a>
          )
        })}
      </div>
      {watchLink&&<p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest"><i className="fa-solid fa-circle-info mr-1"></i>Availability may vary · <a href={watchLink} target="_blank" rel="noreferrer" className="text-cyan-500 hover:underline">Full options on JustWatch</a></p>}
    </div>
  )
}

// ─── Calendar modal ───────────────────────────────────────────────────────────
function CalendarModal({ show, onClose }) {
  const title   = show.name||'TV Show'
  const pd      = show.first_air_date
  const network = show.networks?.[0]?.name||show.network||'Streaming'
  const overview= show.overview||''
  function google() {
    const s=new Date(pd+'T20:00:00'),e=new Date(s.getTime()+3600000)
    const fmt=d=>d.toISOString().replace(/[-:]/g,'').split('.')[0]+'Z'
    const p=new URLSearchParams({action:'TEMPLATE',text:`${title} Premiere`,dates:`${fmt(s)}/${fmt(e)}`,details:overview,location:network,trp:'false'})
    window.open(`https://calendar.google.com/calendar/render?${p}`,'_blank');onClose()
  }
  function outlook() {
    const s=new Date(pd+'T20:00:00'),e=new Date(s.getTime()+3600000)
    const p=new URLSearchParams({path:'/calendar/action/compose',rru:'addevent',subject:`${title} Premiere`,startdt:s.toISOString(),enddt:e.toISOString(),body:overview,location:network})
    window.open(`https://outlook.live.com/calendar/0/deeplink/compose?${p}`,'_blank');onClose()
  }
  function ics() {
    if (!pd||pd==='TBA'){alert('Premiere date not available');return}
    const d=new Date(pd+'T20:00:00')
    const fmt=d=>`${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}${String(d.getSeconds()).padStart(2,'0')}`
    const content=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//AirDate.tv//TV Premiere Reminder//EN','CALSCALE:GREGORIAN','METHOD:PUBLISH','BEGIN:VEVENT',
      `DTSTART:${fmt(d)}`,`DTEND:${fmt(new Date(d.getTime()+3600000))}`,`DTSTAMP:${fmt(new Date())}`,`SUMMARY:${title} Premiere`,
      `DESCRIPTION:${overview.replace(/\n/g,'\\n')}`,`LOCATION:${network}`,'STATUS:CONFIRMED',
      'BEGIN:VALARM','TRIGGER:-PT24H','ACTION:DISPLAY',`DESCRIPTION:${title} premieres tomorrow on ${network}!`,
      'END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n')
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/calendar;charset=utf-8'}))
    a.download=`${title.replace(/[^a-z0-9]/gi,'_')}_premiere.ics`;document.body.appendChild(a);a.click();document.body.removeChild(a);onClose()
  }
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="bg-slate-900 border border-white/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-black text-white">Save to Calendar</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">×</button>
        </div>
        <p className="text-slate-400 text-sm mb-6">{title} — {pd?formatDate(pd):'TBA'}</p>
        <div className="space-y-3">
          {[
            {icon:'fa-brands fa-google',   label:'Google Calendar', color:'text-red-400',   fn:google},
            {icon:'fa-brands fa-apple',    label:'Apple Calendar',  color:'text-slate-200', fn:ics},
            {icon:'fa-brands fa-microsoft',label:'Outlook',         color:'text-blue-400',  fn:outlook},
            {icon:'fa-solid fa-calendar-arrow-down',label:'Download .ics',color:'text-purple-400',fn:ics},
          ].map(o=>(
            <button key={o.label} onClick={o.fn} className="w-full flex items-center gap-4 p-4 bg-slate-800/60 hover:bg-slate-800 border border-white/10 hover:border-cyan-500/30 rounded-2xl transition-all">
              <i className={`${o.icon} ${o.color} text-lg w-6`}></i>
              <span className="text-white font-bold text-sm">{o.label}</span>
              <i className="fa-solid fa-chevron-right text-slate-600 text-xs ml-auto"></i>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── SageMaker Renewal Badge ──────────────────────────────────────────────────
// ─── SageMaker Renewal Badge (v2.37 — NOT YET DEPLOYED) ─────────────────────
//
// Root cause of the console error:
//   GET /renewal/319934 → 404 (SageMaker renewal classifier is v2.37 roadmap)
//   API Gateway 404s have no CORS headers → browser reports CORS error
//
// Fix: Feature-flag the fetch so it only runs when the endpoint exists.
// Flip RENEWAL_ENABLED = true after deploying the renewal Lambda + API route.
//
// REPLACE the existing RenewalBadge function in ShowDetailPage.jsx with this.

const RENEWAL_ENABLED = false   // ← flip to true when v2.37 /renewal endpoint is live

function RenewalBadge({ showId }) {
  const [data, setData] = useState(null)
 
  useEffect(() => {
    if (!showId || !RENEWAL_ENABLED) return   // ← add !RENEWAL_ENABLED check
    let cancelled = false
 
    // Correct route: GET /renewal/{show_id} — confirmed in API Gateway route table
    fetch(`${API_BASE}/renewal/${showId}`, {
      method:  'GET',
      headers: { 'Content-Type': 'application/json' },
    })
      .then(r => r.ok ? r.json() : null)
      .then(raw => {
        if (cancelled || !raw) return
        const d   = gw(raw)
        const pct = parseFloat(d.probability || d.renewal_probability)
        if (!isNaN(pct)) setData({ pct, updated: d.updated || d.updated_at })
      })
      .catch(() => {})  // silently swallow network errors
 
    return () => { cancelled = true }
  }, [showId])
 
  if (!data) return null
 
  const { pct, updated } = data
  const isHigh  = pct >= 70
  const isMid   = pct >= 40
  const color   = isHigh
    ? 'text-green-400 border-green-500/30 bg-green-500/10'
    : isMid
    ? 'text-amber-400 border-amber-500/30 bg-amber-500/10'
    : 'text-red-400 border-red-500/30 bg-red-500/10'
  const icon = isHigh ? '🟢' : isMid ? '🟡' : '🔴'
 
  return (
    <div className="mt-4 pt-4 border-t border-white/5">
      <div className="flex items-center gap-2">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-widest">
          Renewal Probability
        </span>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-black ${color}`}>
          {icon} {pct}%
        </span>
      </div>
      {updated && (
        <p className="text-slate-500 text-[10px] mt-1">
          Model updated{' '}
          {new Date(updated).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </p>
      )}
    </div>
  )
}

// ─── Episode Card ─────────────────────────────────────────────────────────────
function EpisodeCard({ episode, role, recapHtml='' }) {
  const isNext=role==='next'
  const sn=String(episode.season_number||'?').padStart(2,'0')
  const en=String(episode.episode_number||'?').padStart(2,'0')
  const epLabel=`S${sn} E${en}`
  const airedOn=episode.air_date?formatDate(episode.air_date):'TBA'
  const accent=isNext?'border-cyan-500/20 hover:border-cyan-500/40':'border-purple-500/20 hover:border-purple-500/40'
  const epColor=isNext?'bg-cyan-500/20 text-cyan-400':'bg-purple-500/20 text-purple-400'
  const headerColor=isNext?'text-cyan-400':'text-purple-400'
  const headerLabel=isNext?'Next / Current Episode':'Previous Episode'
  let airStatus=null
  if (isNext&&episode.air_date) {
    const diff=daysBetween(todayLocal(),episode.air_date)
    if (diff===0)  airStatus={label:'🔴 Airing Today',cls:'bg-red-500/20 text-red-400 border border-red-500/30'}
    else if (diff===1) airStatus={label:'⏰ Tomorrow',cls:'bg-amber-500/20 text-amber-400 border border-amber-500/30'}
    else if (diff>1)   airStatus={label:`In ${diff}d`,cls:'bg-slate-700/60 text-slate-200 border border-white/10'}
    else if (diff===-1) airStatus={label:'Aired Yesterday',cls:'bg-slate-700/60 text-slate-200 border border-white/10'}
    else airStatus={label:`${Math.abs(diff)}d ago`,cls:'bg-slate-700/60 text-slate-200 border border-white/10'}
  }
  const bodyText=isNext?(episode.overview||'Episode details not yet available.'):(recapHtml||episode.overview||'No recap available.')
  const stillSrc=episode.still_path?`${IMAGE_BASE}/t/p/w400${episode.still_path}`:null
  return (
    <div className={`bg-slate-800/40 rounded-2xl border ${accent} overflow-hidden transition-all`}>
      <div className="relative aspect-video bg-slate-900/60 overflow-hidden">
        {stillSrc?<img src={stillSrc} alt={episode.name||''} className="w-full h-full object-cover"/>
          :<div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-film text-slate-700 text-4xl"></i></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 to-transparent pointer-events-none"></div>
        <div className="absolute bottom-3 left-3 flex flex-wrap items-center gap-2">
          <span className={`px-2 py-0.5 rounded-md ${epColor} text-[11px] font-black uppercase tracking-wider`}>{epLabel}</span>
          {airStatus&&<span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${airStatus.cls}`}>{airStatus.label}</span>}
        </div>
      </div>
      <div className="p-5">
        <p className={`text-[10px] font-black uppercase tracking-widest ${headerColor} mb-1.5`}>{headerLabel}</p>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="text-white font-black text-base leading-snug">{episode.name||`Episode ${episode.episode_number}`}</h3>
          <span className="text-slate-400 text-xs font-medium shrink-0 mt-0.5">{airedOn}</span>
        </div>
        {episode.vote_average>0&&<div className="flex items-center gap-1 mb-3"><i className="fa-solid fa-star text-yellow-400 text-[11px]"></i><span className="text-yellow-400 text-xs font-bold">{episode.vote_average.toFixed(1)}</span><span className="text-slate-400 text-xs">/10</span></div>}
        <div className="text-slate-200 text-sm leading-relaxed" dangerouslySetInnerHTML={{__html:bodyText}}/>
      </div>
    </div>
  )
}

// ─── Episode Intelligence ─────────────────────────────────────────────────────
function EpisodeIntelligence({ showId, showTitle, showData }) {
  const [eps, setEps]       = useState(null)
  const [recap, setRecap]   = useState('')

  useEffect(()=>{
    if (!showId) return
    ;(async()=>{
      try {
        let currentSeason = showData?.next_episode_to_air?.season_number || showData?.last_episode_to_air?.season_number || null
        if (!currentSeason) {
          try {
            const r=await fetch(`${TMDB}/tv/${showId}?api_key=${TMDB_KEY}`)
            const d=await r.json()
            currentSeason=d.last_episode_to_air?.season_number||d.number_of_seasons||1
          } catch { currentSeason=1 }
        }
        const seasons=currentSeason>1?[currentSeason-1,currentSeason]:[currentSeason]
        const fetched=await Promise.all(seasons.map(n=>
          fetch(`${TMDB}/tv/${showId}/season/${n}?api_key=${TMDB_KEY}`)
            .then(r=>r.ok?r.json():{episodes:[]})
            .then(d=>(d.episodes||[]).sort((a,b)=>a.episode_number-b.episode_number).map(ep=>{
              if (!ep.air_date) return ep
              const d2=new Date(ep.air_date+'T12:00:00');d2.setDate(d2.getDate()+1)
              return {...ep,air_date:`${d2.getFullYear()}-${String(d2.getMonth()+1).padStart(2,'0')}-${String(d2.getDate()).padStart(2,'0')}`}
            })).catch(()=>[])
        ))
        const all=fetched.flat()
        if (!all.length){setEps({lastAired:null,nextAiring:null});return}
        const today=todayLocal()
        let last=null,next=null
        for (const ep of all) {
          if (!ep.air_date) continue
          const cmp=ep.air_date.localeCompare(today)
          if (cmp<=0){if (!last||ep.air_date.localeCompare(last.air_date)>=0) last=ep}
          else{if (!next||ep.air_date.localeCompare(next.air_date)<0) next=ep}
        }
        if (last&&last.air_date===today) {
          next=last
          const idx=all.findIndex(e=>e.season_number===last.season_number&&e.episode_number===last.episode_number)
          last=idx>0?all[idx-1]:null
        }
        setEps({lastAired:last,nextAiring:next})
        if (last&&showTitle) {
          fetch(`${API_BASE}/generate-recap`,{method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({series_title:`${showTitle} Season ${last.season_number} Episode ${last.episode_number}: ${last.name}`})})
            .then(r=>r.json()).then(raw=>{
              const d=gw(raw);const r=d.recap||null
              if (r&&r.length>(last.overview?.length||0)+40) setRecap(r)
            }).catch(()=>{})
        }
      } catch(e) { console.warn('[AirDate] Episode intelligence failed:',e);setEps({lastAired:null,nextAiring:null}) }
    })()
  },[showId])

  if (!eps) return (
    <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="h-48 bg-slate-800/50 rounded-2xl"></div>
      <div className="h-48 bg-slate-800/50 rounded-2xl"></div>
    </div>
  )
  if (!eps.lastAired&&!eps.nextAiring) return null
  const isAiringToday = eps.nextAiring?.air_date === todayLocal()
  const todayLabel = isAiringToday
    ? `S${String(eps.nextAiring.season_number||'?').padStart(2,'0')}E${String(eps.nextAiring.episode_number||'?').padStart(2,'0')}: ${eps.nextAiring.name||''}`
    : ''
  return (
    <section>
      {/* NEW EPISODE TODAY banner */}
      {isAiringToday && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl px-5 py-3 flex items-center gap-4 mb-6">
          <span className="flex items-center gap-2 text-red-400 font-black text-sm shrink-0">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            NEW EPISODE TODAY
          </span>
          <span className="text-slate-200 text-xs font-medium truncate">{todayLabel}</span>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-cyan-500/10 rounded-lg"><i className="fa-solid fa-clapperboard text-cyan-400 text-xl"></i></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Episode Intelligence</h2>
        {isAiringToday && (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-[10px] font-black uppercase tracking-widest">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
            Live
          </span>
        )}
      </div>
      <div className={`grid gap-6 ${eps.nextAiring&&eps.lastAired?'grid-cols-1 md:grid-cols-2':'grid-cols-1 max-w-lg'}`}>
        {eps.nextAiring&&<EpisodeCard episode={eps.nextAiring} role="next"/>}
        {eps.lastAired&&<EpisodeCard episode={eps.lastAired} role="last" recapHtml={recap}/>}
      </div>
    </section>
  )
}

// ─── Scoop (Tier 3 — never blocks) ───────────────────────────────────────────
function ScoopSection({ showId, showTitle }) {
  const [html, setHtml] = useState(null)
  useEffect(()=>{
    if (!showTitle) return
    fetch(`${API_BASE}/generate-recap`,{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({series_title:showTitle,tmdb_id:showId})})
      .then(r=>r.json()).then(raw=>{
        const d=gw(raw);const text=d.recap||d.intel||null
        setHtml(text?formatScoop(text):'')
      }).catch(()=>setHtml(''))
  },[showId,showTitle])
  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg"><i className="fa-solid fa-sparkles text-purple-400 text-xl"></i></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">The Scoop</h2>
      </div>
      <div className="bg-slate-800/40 rounded-2xl p-6 border border-white/10 min-h-[80px]">
        {html===null?(
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-400 rounded-full animate-spin"></div>
            <span className="text-slate-400 text-sm">Generating intel…</span>
          </div>
        ):html===''?(
          <p className="text-slate-400 text-sm">Intel unavailable for this title.</p>
        ):(
          <div dangerouslySetInnerHTML={{__html:html}}/>
        )}
      </div>
    </section>
  )
}

// ─── Lazy Trailer ─────────────────────────────────────────────────────────────
function LazyTrailer({ youtubeId }) {
  const ref=useRef(null)
  const [loaded,setLoaded]=useState(false)
  useEffect(()=>{
    if (!youtubeId||!ref.current) return
    const obs=new IntersectionObserver(entries=>{if(entries[0].isIntersecting){setLoaded(true);obs.disconnect()}},{threshold:0.1})
    obs.observe(ref.current);return()=>obs.disconnect()
  },[youtubeId])
  if (!youtubeId) return null
  return (
    <section id="trailer-anchor">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-500/10 rounded-lg"><i className="fa-solid fa-play-circle text-red-400 text-xl"></i></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Trailer</h2>
      </div>
      <div ref={ref} className="relative rounded-2xl overflow-hidden bg-black aspect-video">
        {loaded
          ?<iframe className="w-full h-full" src={`https://www.youtube.com/embed/${youtubeId}`} frameBorder="0" allowFullScreen title="trailer"/>
          :<div className="w-full h-full flex items-center justify-center cursor-pointer bg-slate-900" onClick={()=>setLoaded(true)}>
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-2xl hover:bg-red-500 transition-colors">
              <i className="fa-solid fa-play text-white text-2xl ml-1"></i>
            </div>
          </div>
        }
      </div>
    </section>
  )
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="w-full py-6 mt-16 border-t border-white/10 text-[11px] font-medium text-slate-400 uppercase tracking-widest">
      <div className="flex flex-col md:flex-row justify-between items-center gap-6 px-2 mb-2">
        <a href="/" className="flex flex-col items-center md:items-start">
          <img src="/assets/images/official-airdate-logo.png" alt="AirDate" className="h-10 w-auto object-contain mb-1"/>
          <p className="text-[9px] font-normal tracking-wider lowercase opacity-70">track tv premieres before they trend.</p>
        </a>
        <div className="flex flex-wrap gap-x-8 gap-y-2 justify-center md:justify-end">
          {[['Trending','/trending'],['Premieres','/premieres'],['The Scoop','/scoop'],['My Pulse','/account']].map(([l,h])=>(
            <a key={h} href={h} className="hover:text-cyan-400 transition-colors">{l}</a>
          ))}
        </div>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 px-2 border-t border-white/5 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 text-slate-400/80">
          <span className="font-bold text-slate-400">© 2026 AirDate.</span><span>All Rights Reserved.</span>
          <span className="mx-1 opacity-20">|</span>
          <a href="https://stratustierlabs.com" target="_blank" rel="noreferrer" className="group">
            ENGINEERED BY <span className="text-white font-black group-hover:text-cyan-400 transition-colors">STRATUSTIER</span>{' '}<span className="text-cyan-400">INNOVATION LABS</span>
          </a>
        </div>
        <div className="flex gap-8">
          {[['Vision','/vision'],['Terms','/terms'],['Privacy','/privacy'],['Contact','/contact']].map(([l,h])=>(
            <a key={h} href={h} className="hover:text-cyan-400 transition-colors">{l}</a>
          ))}
        </div>
      </div>
    </footer>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export function ShowDetailPage() {
  const { id }       = useParams()
  const navigate     = useNavigate()
  const { token, isAuthenticated } = useAuth()
  const { toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [show,        setShow]        = useState(null)
  const [cast,        setCast]        = useState([])
  const [providers,   setProviders]   = useState([])
  const [watchLink,   setWatchLink]   = useState('')
  const [recs,        setRecs]        = useState([])
  const [featured,    setFeatured]    = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [youtubeId,   setYoutubeId]   = useState(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(false)
  const [calendarOpen,setCalendar]    = useState(false)

  const headers = token ? { Authorization:`Bearer ${token}` } : {}

  useEffect(()=>{
    if (!id) return
    setLoading(true);setError(false)

    // ── TIER 1: Core show data — Lambda /get-premieres with tmdb_id ───────────
    const cacheKey=`airdate_show_${id}`
    let cachedData=null
    try { const raw=sessionStorage.getItem(cacheKey);if(raw) cachedData=JSON.parse(raw) } catch {}

    const fetchCore = cachedData
      ? Promise.resolve(cachedData)
      : fetch(`${API_BASE}/get-premieres`,{
          method:'POST',headers:{'Content-Type':'application/json',...headers},
          body:JSON.stringify({tmdb_id:parseInt(id),page:1,per_page:10})
        }).then(r=>r.json()).then(raw=>{
          const d=gw(raw)
          try{sessionStorage.setItem(cacheKey,JSON.stringify(d));setTimeout(()=>sessionStorage.removeItem(cacheKey),5*60*1000)}catch{}
          return d
        })

    fetchCore.then(data=>{
      const results=data.results||data.shows||[]
      if (!results.length){setError(true);setLoading(false);return}
      const s=results[0]
      const show={
        ...s,
        id:          s.id,
        name:        s.title||s.seriesTitle||s.name||'',
        overview:    s.description||s.overview||'',
        poster_path: s.poster_path||null,
        poster:      s.poster||null,
        backdrop_path: s.backdrop_path||null,
        first_air_date: s.premiereDate||s.premiere||s.first_air_date||null,
        genres:      s.genre?[{name:s.genre}]:(s.genres||[]),
        status:      s.status||'',
        networks:    s.network?[{name:s.network}]:(s.networks||[]),
        vote_average:s.user_score?s.user_score/10:(s.vote_average||0),
        created_by:  s.creator?[{name:s.creator}]:(s.created_by||[]),
        number_of_seasons:  s.seasons||s.number_of_seasons,
        number_of_episodes: s.episodes||s.number_of_episodes,
        next_episode_to_air: s.next_episode_to_air,
        last_episode_to_air: s.last_episode_to_air,
      }
      setShow(show)
      setFeatured(data.featured||[])
      setLeaderboard(data.leaderboard||[])
      setLoading(false)  // ← TIER 1 complete — page visible
      document.title=`${show.name} | AirDate`

      // ── Dynamic OG meta tags for rich social previews ─────────────────────
      const posterUrl = s.poster || (s.poster_path ? `https://image.tmdb.org/t/p/w500${s.poster_path}` : '')
      const desc = (s.description||s.overview||'').slice(0,200)
      const canonical = window.location.href
      const setMeta = (prop, val, isName=false) => {
        const attr = isName ? 'name' : 'property'
        let el = document.querySelector(`meta[${attr}="${prop}"]`)
        if (!el) { el=document.createElement('meta'); el.setAttribute(attr,prop); document.head.appendChild(el) }
        el.setAttribute('content', val)
      }
      // Open Graph
      setMeta('og:title',       `${show.name} | AirDate`)
      setMeta('og:description', desc || `Track ${show.name} on AirDate.tv`)
      setMeta('og:image',       posterUrl)
      setMeta('og:image:width', '500')
      setMeta('og:image:height','750')
      setMeta('og:url',         canonical)
      setMeta('og:type',        'video.tv_show')
      setMeta('og:site_name',   'AirDate.tv')
      // Twitter Card
      setMeta('twitter:card',        'summary_large_image', true)
      setMeta('twitter:title',       `${show.name} | AirDate.tv`, true)
      setMeta('twitter:description', desc || `Track ${show.name} on AirDate.tv`, true)
      setMeta('twitter:image',       posterUrl, true)
      setMeta('twitter:site',        '@airdatetv', true)
      // Cleanup on unmount handled by React router navigation

      // ── TIER 2: All secondary data in parallel ─────────────────────────────
      Promise.all([
        // Credits — TMDB direct (Lambda credits returns empty results)
        fetch(`${TMDB}/tv/${id}/credits?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>({})),
        // Providers — Lambda first, fall back to TMDB if empty
        fetch(`${API_BASE}/show/${id}/providers`).then(r=>r.json()).then(gw).catch(()=>({})),
        // Recommendations — Lambda first, fall back to TMDB if empty
        fetch(`${API_BASE}/show/${id}/recommendations`).then(r=>r.json()).then(gw).catch(()=>({})),
        // Videos — direct TMDB (no Lambda route for this)
        fetch(`${TMDB}/tv/${id}/videos?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>({})),
        // TMDB providers fallback
        fetch(`${TMDB}/tv/${id}/watch/providers?api_key=${TMDB_KEY}`).then(r=>r.json()).catch(()=>({})),
        // TMDB recommendations fallback
        fetch(`${TMDB}/tv/${id}/recommendations?api_key=${TMDB_KEY}&language=en-US&page=1`).then(r=>r.json()).catch(()=>({})),
      ]).then(([castData,provData,recsData,videoData,tmdbProv,tmdbRecs])=>{
        // Cast
        setCast(castData.cast||[])

        // Providers — Lambda response uses results.US.flatrate, TMDB uses results.US.flatrate too
        const lambdaProviders = Array.isArray(provData.results) ? [] : (provData.results?.US?.flatrate||provData.providers||[])
        const tmdbProviders   = tmdbProv.results?.US?.flatrate||[]
        const finalProviders  = lambdaProviders.length ? lambdaProviders : tmdbProviders
        setProviders(finalProviders)
        const lambdaLink = Array.isArray(provData.results) ? '' : (provData.results?.US?.link||provData.link||'')
        const tmdbLink   = tmdbProv.results?.US?.link||''
        setWatchLink(lambdaLink||tmdbLink)

        // Recommendations — Lambda returns results:[]; fall back to TMDB
        const lambdaRecs = Array.isArray(recsData.results) && recsData.results.length ? recsData.results : (recsData.shows||[])
        const tmdbRecsArr = tmdbRecs.results||[]
        const finalRecs = (lambdaRecs.length ? lambdaRecs : tmdbRecsArr).slice(0,10).map(r=>({
          ...r,
          name:        r.title||r.name||r.seriesTitle||'',
          poster_path: r.poster_path||null,
          poster:      r.poster||null,
        }))
        setRecs(finalRecs)

        // Trailer
        const vid=videoData.results?.find(v=>v.type==='Trailer'&&v.site==='YouTube')||videoData.results?.find(v=>v.site==='YouTube')
        if (vid) setYoutubeId(vid.key)
      }).catch(()=>{})

    }).catch(()=>{setError(true);setLoading(false)})
  },[id,token])

  function handleTrack() {
    if (!show) return
    const r=toggleWatchlist({id:show.id,name:show.name,poster_path:show.poster_path,poster:show.poster,first_air_date:show.first_air_date,network:show.networks?.[0]?.name||''})
    if (r?.error==='FREEMIUM_LIMIT') navigate('/upgrade')
  }

  const tracked    = show?isTracked(show.id):false
  const rating     = show?.vote_average?show.vote_average.toFixed(1):null
  const creator    = show?.created_by?.[0]?.name??'—'
  const network    = show?.networks?.[0]?.name??show?.network??''
  const posterImg  = usePoster(show?.poster_path||show?.poster,show?.name||'',342)
  const backdropUrl= show?.backdrop_path?`${IMAGE_BASE}/t/p/w1280${show.backdrop_path}`:null

  if (loading) return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16"><SkeletonHero/></div>
    </div>
  )

  if (error||!show) return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex items-center justify-center">
      <div className="text-center max-w-md">
        <i className="fa-solid fa-triangle-exclamation text-red-500 text-5xl mb-6"></i>
        <h3 className="text-2xl font-black text-white mb-4">Show Not Found</h3>
        <p className="text-slate-400 mb-8">We couldn't load the details for this show.</p>
        <Link to="/" className="inline-block bg-cyan-500 text-slate-950 font-black px-8 py-3 rounded-xl uppercase text-sm hover:bg-cyan-400 transition-all">Back to Search</Link>
      </div>
    </div>
  )

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 xl:grid-cols-5 gap-10">

          {/* ── Main ── */}
          <div className="lg:col-span-3 xl:col-span-4 space-y-12">

            {/* HERO */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900/40 border border-white/10">
              {backdropUrl&&<div className="absolute inset-0 opacity-20"><img src={backdropUrl} alt="" className="w-full h-full object-cover"/></div>}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
              <div className="relative z-10 p-8 md:p-12">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="shrink-0">
                    <div className="relative w-52 md:w-64">
                      <img {...posterImg} alt={show.name} className="w-full rounded-2xl shadow-2xl"/>
                      {rating&&<div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2"><i className="fa-solid fa-star text-yellow-400"></i><span className="text-white font-bold">{rating}</span></div>}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">{show.name}</h1>
                    <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
                      {show.first_air_date&&<span className="text-slate-200 font-bold">{show.first_air_date.split('-')[0]}</span>}
                      {show.genres?.length>0&&<><span className="text-slate-500">•</span><span className="text-slate-200 font-bold">{show.genres.map(g=>g.name).join(', ')}</span></>}
                      {show.status&&<><span className="text-slate-500">•</span><span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 font-black uppercase text-xs tracking-wider">{show.status}</span></>}
                      {show.number_of_seasons&&<><span className="text-slate-500">•</span><span className="text-slate-400 text-xs">{show.number_of_seasons} Season{show.number_of_seasons>1?'s':''}</span></>}
                    </div>
                    <div className="flex flex-wrap gap-3 mb-8">
                      <button onClick={handleTrack} disabled={!tracked&&atLimit}
                        className={`flex items-center gap-2 px-6 py-3 border rounded-xl font-bold transition-all ${tracked?'bg-cyan-500 border-cyan-400 text-slate-950':'bg-slate-800/60 border-white/10 hover:bg-pink-500/20 hover:border-pink-500/30 text-white'}`}>
                        <i className={`fa-${tracked?'solid':'regular'} fa-heart`}></i><span>{tracked?'Tracking':'+ Track'}</span>
                      </button>
                      <ShareButton url={window.location.href} title={show.name} show={show} posterUrl={show?.poster||(show?.poster_path?`https://image.tmdb.org/t/p/w500${show.poster_path}`:null)}/>
                        {show.first_air_date && daysBetween(todayLocal(), show.first_air_date) >= 0 && (
                        <button onClick={()=>setCalendar(true)} className="flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-xl text-white font-bold transition-all">
                          <i className="fa-solid fa-calendar-plus"></i><span>Save to Calendar</span>
                        </button>
                      )}
                      {youtubeId&&(
                        <a href="#trailer-anchor" onClick={e=>{e.preventDefault();document.getElementById('trailer-anchor')?.scrollIntoView({behavior:'smooth'})}}
                          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-500 rounded-xl text-white font-black transition-all">
                          <i className="fa-solid fa-play"></i><span>Watch Trailer</span>
                        </a>
                      )}
                    </div>
                    {show.overview&&<div className="mb-6"><h2 className="text-lg font-black text-white uppercase tracking-wide mb-3">Overview</h2><p className="text-slate-200 leading-relaxed">{show.overview}</p></div>}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Creator</p><p className="text-white font-bold truncate">{creator}</p></div>
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Premiere</p><p className="text-cyan-400 font-black">{(()=>{
  const d=show.first_air_date
  if(!d) return 'TBA'
  try{const dt=new Date(d+'T12:00:00');return isNaN(dt.getTime())?'TBA':dt.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}
  catch{return 'TBA'}
})()}</p></div>
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Network</p><p className="text-white font-bold">{network||'—'}</p></div>
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Rating</p><p className="text-pink-400 font-black">{rating?`★ ${rating}`:'—'}</p></div>
                    </div>
                    {/* SageMaker ML Renewal Probability */}
                    <RenewalBadge showId={id}/>
                  </div>
                </div>
              </div>
            </div>

            {/* TIER 2: Episode Intelligence */}
            <EpisodeIntelligence showId={id} showTitle={show.name} showData={show}/>

            {/* TIER 3: The Scoop — Bedrock RAG, never blocks */}
            <ScoopSection showId={id} showTitle={show.name}/>

            {/* Where to Watch */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/10 rounded-lg"><i className="fa-solid fa-tv text-cyan-400 text-xl"></i></div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Where to Watch</h2>
              </div>
              <ProvidersGrid providers={providers} watchLink={watchLink} showTitle={show?.name||''}/>
            </section>

            {/* Cast */}
            <CastGrid cast={cast}/>

            {/* Lazy Trailer */}
            <LazyTrailer youtubeId={youtubeId}/>

            {/* Recommendations */}
            {recs.length>0&&(
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-slate-700/50 rounded-lg"><i className="fa-solid fa-film text-slate-300 text-xl"></i></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">You Might Also Like</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-5">
                  {recs.map(r=>(
                    <div key={r.id} className="cursor-pointer group" onClick={()=>navigate(`/details/${r.id}`)}>
                      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-2 bg-slate-800">
                        <img {...usePoster(r.poster_path||r.poster,r.name,185)} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-2">{r.name}</h3>
                      {r.network&&<p className="text-xs text-slate-400 mt-0.5">{r.network}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* ── Sidebar ── */}
          <aside className="space-y-10">
            {featured.length>0&&(
              <section>
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20"><i className="fa-solid fa-calendar-check text-cyan-400 text-lg"></i></div>
                  <div><h2 className="text-sm font-black uppercase tracking-wide text-cyan-400 mb-0.5">Confirmed Premieres</h2><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Upcoming Series 2026</p></div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {featured.slice(0,6).map(s=>(
                    <div key={s.id} className="relative overflow-hidden rounded-2xl aspect-[2/3] cursor-pointer group" onClick={()=>navigate(`/details/${s.id}`)}>
                      <img {...usePoster(s.poster_path||s.poster,s.title||s.name,185)} alt={s.title||s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent"/>
                      <div className="absolute bottom-0 left-0 right-0 p-2"><p className="text-white text-[10px] font-black leading-tight line-clamp-2">{s.title||s.name}</p></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {leaderboard.length>0&&(
              <section>
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20"><i className="fa-solid fa-fire text-pink-400 text-lg"></i></div>
                  <div><h2 className="text-sm font-black uppercase tracking-wide text-pink-400 mb-0.5">Global Hype Ranking</h2><p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Top Tracked Series</p></div>
                </div>
                <div className="space-y-3">
                  {leaderboard.slice(0,8).map((s,i)=>(
                    <div key={s.id??i} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-2xl hover:border-pink-500/20 transition-all cursor-pointer" onClick={()=>navigate(`/details/${s.id}`)}>
                      <span className="w-6 text-center text-[10px] font-black text-slate-400">{i+1}</span>
                      <img {...usePoster(s.poster_path||s.poster,s.title||s.name,92)} alt={s.title||s.name} className="w-8 h-10 object-cover rounded-lg flex-shrink-0"/>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{s.title||s.name}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-pink-400 mt-0.5">{s.hype?`${Number(s.hype).toLocaleString()} tracking`:s.tracked_count?`${s.tracked_count.toLocaleString()} tracking`:'Trending'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>

        </div>
      </div>
      <Footer/>
      {calendarOpen&&<CalendarModal show={show} onClose={()=>setCalendar(false)}/>}
    </div>
  )
}