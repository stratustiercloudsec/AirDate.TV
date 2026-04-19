// src/pages/ShowDetailPage.jsx
import { useEffect, useState } from 'react'
import { useParams, Link }  from 'react-router-dom'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE, IMAGE_BASE } from '@/config/aws'
import { usePoster } from '@/utils/poster'
import { Footer }       from '@/components/layout/Footer'


function SkeletonHero() {
  return (
    <div className="animate-pulse relative rounded-3xl overflow-hidden bg-slate-900/40 border border-white/10 p-8 md:p-12">
      <div className="flex flex-col md:flex-row gap-8">
        <div className="shrink-0"><div className="w-64 aspect-[2/3] rounded-2xl bg-slate-800/60"></div></div>
        <div className="flex-1 min-w-0 space-y-5 pt-2">
          <div className="h-10 bg-slate-800/60 rounded-xl w-3/4"></div>
          <div className="flex gap-3"><div className="h-5 bg-slate-800/60 rounded-full w-12"></div><div className="h-5 bg-slate-800/60 rounded-full w-20"></div><div className="h-5 bg-slate-800/60 rounded-full w-16"></div></div>
          <div className="space-y-2"><div className="h-4 bg-slate-800/60 rounded-full w-full"></div><div className="h-4 bg-slate-800/60 rounded-full w-5/6"></div><div className="h-4 bg-slate-800/60 rounded-full w-4/5"></div></div>
        </div>
      </div>
    </div>
  )
}

function CastGrid({ cast }) {
  if (!cast?.length) return null
  return (
    <section>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-purple-500/10 rounded-lg"><i className="fa-solid fa-users text-purple-400 text-xl"></i></div>
        <h2 className="text-2xl font-black text-white uppercase tracking-tight">Cast</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
        {cast.slice(0, 12).map(person => (
          <div key={person.id} className="text-center">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-slate-800 mx-auto mb-2">
              {person.profile_path
                ? <img {...usePoster(person.profile_path, "", 185)} alt={person.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-user text-slate-600 text-2xl"></i></div>
              }
            </div>
            <p className="text-white text-xs font-bold leading-tight mb-0.5">{person.name}</p>
            <p className="text-slate-400 text-[10px]">{person.character}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProvidersGrid({ providers }) {
  if (!providers?.length) return <p className="text-slate-400 text-sm">Streaming provider data unavailable.</p>
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {providers.map(p => (
        <div key={p.provider_id} className="text-center">
          <div className="aspect-square rounded-xl overflow-hidden bg-slate-800 mb-2">
            {p.logo_path
              ? <img {...usePoster(p.logo_path, "", 92)} alt={p.provider_name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs font-bold">{p.provider_name?.[0]}</div>
            }
          </div>
          <p className="text-xs text-slate-400 font-medium leading-tight">{p.provider_name}</p>
        </div>
      ))}
    </div>
  )
}

// Calendar modal
function CalendarModal({ show, onClose }) {
  const title = encodeURIComponent(show.name)
  const date  = show.first_air_date ?? ''
  const start = date.replace(/-/g, '')
  const end   = start
  const details = encodeURIComponent(`Premieres on AirDate: https://airdate.tv/show/${show.id}`)

  function googleUrl() { return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&details=${details}` }
  function outlookUrl() { return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${date}&body=${details}` }
  function icsContent() {
    return `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${show.name} Premiere\nDTSTART;VALUE=DATE:${start}\nDTEND;VALUE=DATE:${end}\nDESCRIPTION:https://airdate.tv/show/${show.id}\nEND:VEVENT\nEND:VCALENDAR`
  }
  function downloadIcs() {
    const blob = new Blob([icsContent()], { type: 'text/calendar' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${show.name}-premiere.ics`; a.click()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 rounded-3xl border border-white/10 shadow-2xl p-8 w-full max-w-lg">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg"><i className="fa-solid fa-calendar-plus text-purple-400 text-xl"></i></div>
            <h3 className="text-2xl font-black text-white">Add to Calendar</h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><i className="fa-solid fa-times text-xl"></i></button>
        </div>
        <p className="text-slate-400 text-sm mb-6">Choose your preferred calendar service:</p>
        <div className="space-y-3">
          {[
            { label: 'Google Calendar', sub: 'Add to your Google Calendar', icon: <svg viewBox="0 0 24 24" className="w-7 h-7"><path fill="#4285F4" d="M22.46 12.04c0-.82-.07-1.62-.21-2.38H12v4.5h5.85c-.25 1.3-1.01 2.4-2.15 3.14v2.67h3.47c2.04-1.88 3.21-4.65 3.21-7.93z"/><path fill="#34A853" d="M12 23c2.9 0 5.33-.96 7.11-2.6l-3.47-2.67c-.96.64-2.18 1.02-3.64 1.02-2.8 0-5.17-1.89-6.02-4.43H2.37v2.76C4.14 20.94 7.8 23 12 23z"/><path fill="#FBBC04" d="M5.98 14.32C5.76 13.68 5.64 13 5.64 12.3c0-.7.12-1.38.34-2.02V7.52H2.37C1.49 9.27 1 11.09 1 13c0 1.91.49 3.73 1.37 5.48l3.61-2.76z"/><path fill="#EA4335" d="M12 4.75c1.58 0 3 .54 4.12 1.61l3.08-3.08C17.33 1.49 14.9.5 12 .5 7.8.5 4.14 2.56 2.37 5.52l3.61 2.76C6.83 6.64 9.2 4.75 12 4.75z"/></svg>, bg: 'bg-white', action: () => window.open(googleUrl(), '_blank'), hoverBorder: 'hover:border-blue-500/30', hoverText: 'group-hover:text-blue-400' },
            { label: 'Apple Calendar', sub: 'Add to iCal or macOS Calendar', icon: <i className="fa-brands fa-apple text-white text-2xl"></i>, bg: 'bg-gradient-to-br from-slate-700 to-slate-900', action: downloadIcs, hoverBorder: 'hover:border-white/20', hoverText: 'group-hover:text-white' },
            { label: 'Outlook Calendar', sub: 'Add to Outlook.com', icon: <i className="fa-brands fa-microsoft text-white text-xl"></i>, bg: 'bg-blue-600', action: () => window.open(outlookUrl(), '_blank'), hoverBorder: 'hover:border-blue-600/30', hoverText: 'group-hover:text-blue-400' },
            { label: 'Download .ics File', sub: 'For other calendar apps', icon: <i className="fa-solid fa-download text-cyan-400 text-xl"></i>, bg: 'bg-cyan-500/20', action: downloadIcs, hoverBorder: 'hover:border-cyan-500/30', hoverText: 'group-hover:text-cyan-400' },
          ].map(item => (
            <button key={item.label} onClick={item.action}
              className={`group w-full flex items-center gap-4 p-4 bg-slate-800/60 border border-white/10 ${item.hoverBorder} rounded-xl text-white font-bold transition-all`}>
              <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center shrink-0`}>{item.icon}</div>
              <div className="text-left flex-1">
                <div className={`font-black text-white ${item.hoverText} transition-colors`}>{item.label}</div>
                <div className="text-xs text-slate-400">{item.sub}</div>
              </div>
              <i className={`fa-solid fa-arrow-right text-slate-400 ${item.hoverText} transition-colors`}></i>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ShowDetailPage() {
  const { id } = useParams()
  const { token, isAuthenticated } = useAuth()
  const { toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [show, setShow]             = useState(null)
  const [scoop, setScoop]           = useState('')
  const [cast, setCast]             = useState([])
  const [providers, setProviders]   = useState([])
  const [recommendations, setRecs]  = useState([])
  const [featured, setFeatured]     = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState(false)
  const [calendarOpen, setCalendar] = useState(false)

  const headers = token ? { Authorization: `Bearer ${token}` } : {}

  useEffect(() => {
    if (!id) return
    setLoading(true); setError(false)
    Promise.all([
      fetch(`${API_BASE}/show/${id}`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/show/${id}/providers`).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/show/${id}/cast`).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/show/${id}/recommendations`).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/show/${id}/scoop`, { headers }).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/premieres/confirmed`).then(r => r.json()).catch(() => ({})),
      fetch(`${API_BASE}/leaderboard`).then(r => r.json()).catch(() => ({})),
    ]).then(([showData, provData, castData, recsData, scoopData, featData, lbData]) => {
      if (!showData?.id && !showData?.name) { setError(true); return }
      setShow(showData)
      setProviders(provData.providers ?? provData.results ?? [])
      setCast(castData.cast ?? castData.results ?? [])
      setRecs(recsData.shows ?? recsData.results ?? [])
      setScoop(scoopData.scoop ?? scoopData.summary ?? '')
      setFeatured(featData.shows ?? [])
      setLeaderboard(lbData.shows ?? [])
    }).catch(() => setError(true))
    .finally(() => setLoading(false))
  }, [id, token])

  function handleTrack() {
    if (!show) return
    const r = toggleWatchlist(show)
    if (r?.error === 'FREEMIUM_LIMIT') window.location.href = '/upgrade'
  }

  const tracked = show ? isTracked(show.id) : false
  const trailer = show?.videos?.results?.find(v => v.type === 'Trailer' && v.site === 'YouTube')
  const rating  = show?.vote_average ? show.vote_average.toFixed(1) : null
  const creator = show?.created_by?.[0]?.name ?? show?.creator ?? '—'
  const network = show?.networks?.[0]?.name ?? show?.network ?? ''

  const posterImg = usePoster(show?.poster_path, show?.name || '', 342)
  const backdropUrl = show?.backdrop_path ? `${IMAGE_BASE}/t/p/w1280${show.backdrop_path}` : null

  if (loading) return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">
        <SkeletonHero />
      </div>
    </div>
  )

  if (error || !show) return (
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

          {/* Main Column */}
          <div className="lg:col-span-3 xl:col-span-4 space-y-12">

            {/* Hero */}
            <div className="relative rounded-3xl overflow-hidden bg-slate-900/40 border border-white/10">
              {backdropUrl && (
                <div className="absolute inset-0 opacity-20">
                  <img src={backdropUrl} alt="" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/80 to-transparent"></div>
              <div className="relative z-10 p-8 md:p-12">
                <div className="flex flex-col md:flex-row gap-8">
                  <div className="shrink-0">
                    <div className="relative w-64">
                      <img {...posterImg} alt={show.name} className="w-full rounded-2xl shadow-2xl" />
                      {rating && (
                        <div className="absolute top-3 right-3 bg-slate-900/90 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center gap-2">
                          <i className="fa-solid fa-star text-yellow-400"></i>
                          <span className="text-white font-bold">{rating}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">{show.name}</h1>
                    <div className="flex flex-wrap items-center gap-3 mb-6 text-sm">
                      {show.first_air_date && <span className="text-slate-200 font-bold">{show.first_air_date.split('-')[0]}</span>}
                      {show.genres?.length > 0 && <><span className="text-slate-500">•</span><span className="text-slate-200 font-bold">{show.genres.map(g => g.name).join(', ')}</span></>}
                      {show.status && <><span className="text-slate-500">•</span><span className="px-3 py-1 rounded-full bg-cyan-500/20 text-cyan-400 font-black uppercase text-xs tracking-wider">{show.status}</span></>}
                    </div>
                    <div className="flex flex-wrap gap-3 mb-8">
                      <button onClick={handleTrack} disabled={!tracked && atLimit}
                        className={`flex items-center gap-2 px-6 py-3 border rounded-xl font-bold transition-all
                          ${tracked ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'bg-slate-800/60 border-white/10 hover:bg-pink-500/20 hover:border-pink-500/30 text-white'}`}>
                        <i className={`fa-${tracked ? 'solid' : 'regular'} fa-heart`}></i>
                        <span>{tracked ? 'Tracking' : 'Track'}</span>
                      </button>
                      <button onClick={() => { navigator.clipboard?.writeText(window.location.href); alert('Link copied!') }}
                        className="flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-cyan-500/20 border border-white/10 hover:border-cyan-500/30 rounded-xl text-white font-bold transition-all">
                        <i className="fa-solid fa-share-nodes"></i><span>Share</span>
                      </button>
                      {show.first_air_date && (
                        <button onClick={() => setCalendar(true)}
                          className="flex items-center gap-2 px-6 py-3 bg-slate-800/60 hover:bg-purple-500/20 border border-white/10 hover:border-purple-500/30 rounded-xl text-white font-bold transition-all">
                          <i className="fa-solid fa-calendar-plus"></i><span>Save to Calendar</span>
                        </button>
                      )}
                      {trailer && (
                        <a href={`https://youtube.com/watch?v=${trailer.key}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 rounded-xl text-slate-950 font-black transition-all">
                          <i className="fa-solid fa-play"></i><span>Watch Trailer</span>
                        </a>
                      )}
                    </div>
                    {show.overview && (
                      <div className="mb-6">
                        <h2 className="text-lg font-black text-white uppercase tracking-wide mb-3">Overview</h2>
                        <p className="text-slate-200 leading-relaxed">{show.overview}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8">
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Creator</p><p className="text-white font-bold">{creator}</p></div>
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Premiere</p><p className="text-cyan-400 font-black">{show.first_air_date ? new Date(show.first_air_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</p></div>
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Network</p><p className="text-white font-bold">{network || '—'}</p></div>
                      <div><p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Rating</p><p className="text-pink-400 font-black">{rating ? `★ ${rating}` : '—'}</p></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Scoop */}
            {scoop && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-purple-500/10 rounded-lg"><i className="fa-solid fa-sparkles text-purple-400 text-xl"></i></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">The Scoop</h2>
                </div>
                <div className="bg-slate-800/40 rounded-2xl p-6 border border-white/10">
                  <p className="text-slate-200 leading-relaxed">{scoop}</p>
                </div>
              </section>
            )}

            {/* Where to Watch */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-cyan-500/10 rounded-lg"><i className="fa-solid fa-tv text-cyan-400 text-xl"></i></div>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight">Where to Watch</h2>
              </div>
              <ProvidersGrid providers={providers} />
            </section>

            {/* Cast */}
            <CastGrid cast={cast} />

            {/* Trailer */}
            {trailer && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-red-500/10 rounded-lg"><i className="fa-solid fa-play-circle text-red-400 text-xl"></i></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">Trailer</h2>
                </div>
                <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                  <iframe className="w-full h-full" src={`https://www.youtube.com/embed/${trailer.key}`} frameBorder="0" allowFullScreen title="trailer" />
                </div>
              </section>
            )}

            {/* Recommendations */}
            {recommendations.length > 0 && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 bg-cyan-500/10 rounded-lg"><i className="fa-solid fa-film text-cyan-400 text-xl"></i></div>
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight">You Might Also Like</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
                  {recommendations.map(rec => (
                    <div key={rec.id} className="cursor-pointer group" onClick={() => window.location.href = `/show/${rec.id}`}>
                      <div className="relative overflow-hidden rounded-2xl aspect-[2/3] mb-2 bg-slate-800">
                        <img {...usePoster(rec.poster_path, rec.name, 185)} alt={rec.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                      <h3 className="text-sm font-bold text-white line-clamp-2">{rec.name}</h3>
                    </div>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* Sidebar */}
          <aside className="space-y-10">
            {featured.length > 0 && (
              <section>
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                    <i className="fa-solid fa-calendar-check text-cyan-400 text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-cyan-400 mb-0.5">Featured Premieres</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Coming Soon</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {featured.slice(0, 6).map(s => (
                    <div key={s.id} className="relative overflow-hidden rounded-2xl aspect-[2/3] cursor-pointer group" onClick={() => window.location.href = `/show/${s.id}`}>
                      <img {...usePoster(s.poster_path, s.name, 185)} alt={s.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-2"><p className="text-white text-[10px] font-black leading-tight line-clamp-2">{s.name}</p></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {leaderboard.length > 0 && (
              <section>
                <div className="flex items-start gap-3 mb-5">
                  <div className="p-2.5 bg-pink-500/10 rounded-xl border border-pink-500/20">
                    <i className="fa-solid fa-fire text-pink-400 text-lg"></i>
                  </div>
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-wide text-pink-400 mb-0.5">Top Tracked</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Most Hyped</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {leaderboard.slice(0, 8).map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-2xl hover:border-pink-500/20 transition-all cursor-pointer" onClick={() => window.location.href = `/show/${s.id}`}>
                      <span className="w-6 text-center text-[10px] font-black text-slate-400">{i + 1}</span>
                      <img {...usePoster(s.poster_path, s.name, 92)} alt={s.name} className="w-8 h-10 object-cover rounded-lg flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{s.name}</p>
                        <p className="text-[9px] font-bold uppercase tracking-widest text-pink-400 mt-0.5">{s.tracked_count ? `${s.tracked_count.toLocaleString()} tracking` : 'Trending'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>

        </div>
      </div>
      <Footer />
      {calendarOpen && <CalendarModal show={show} onClose={() => setCalendar(false)} />}
    </div>
  )
}