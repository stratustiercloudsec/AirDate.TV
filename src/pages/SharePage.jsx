import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { API_BASE } from '@/config/aws'
import { Footer }   from '@/components/layout/Footer'

const IMG_BASE = 'https://image.tmdb.org/t/p/w342'

function fmt(raw) {
  try { return raw ? new Date(raw + 'T00:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : 'TBA' }
  catch { return raw || 'TBA' }
}

export function SharePage() {
  const { token }  = useParams()
  const navigate   = useNavigate()
  const [data,     setData]    = useState(null)
  const [loading,  setLoading] = useState(true)
  const [notFound, setNotFound]= useState(false)

  useEffect(() => {
    if (!token) return
    fetch(`${API_BASE}/share/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(d => setData(d))
      .catch(s => { if (s === 404 || s === 410) setNotFound(true) })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) return (
    <div className="bg-slate-950 min-h-screen flex items-center justify-center">
      <div className="text-center">
        <i className="fa-solid fa-circle-notch fa-spin text-cyan-400 text-3xl mb-4 block"/>
        <p className="text-slate-400 text-sm uppercase tracking-widest">Loading watchlist…</p>
      </div>
    </div>
  )

  if (notFound) return (
    <div className="bg-slate-950 min-h-screen flex items-center justify-center p-6">
      <div className="text-center max-w-sm">
        <div className="text-5xl mb-4">📺</div>
        <h1 className="text-white font-black text-xl uppercase tracking-widest mb-3">Link Expired</h1>
        <p className="text-slate-400 text-sm mb-6 leading-relaxed">This watchlist link has expired or doesn't exist. Share links are valid for 7 days.</p>
        <Link to="/" className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 text-xs font-black uppercase tracking-widest rounded-2xl hover:bg-cyan-500/25 transition-all">
          <i className="fa-solid fa-house"/> Go to AirDate
        </Link>
      </div>
    </div>
  )

  const { watchlist=[], persona_label='', user_name='', user_avatar='' } = data || {}

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-16">

        <div className="text-center mb-8">
          <Link to="/"><span className="text-cyan-400 text-2xl font-black tracking-widest">AirDate</span>
            <p className="text-slate-600 text-[10px] uppercase tracking-widest mt-0.5">Track TV Premieres Before They Trend</p>
          </Link>
        </div>

        <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6 sm:p-8 mb-6 text-center">
          {user_avatar ? (
            <img src={user_avatar} alt={user_name} className="w-16 h-16 rounded-full mx-auto mb-4 object-cover border border-white/10"/>
          ) : (
            <div className="w-16 h-16 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-2xl font-black text-white">{(user_name||'?')[0].toUpperCase()}</span>
            </div>
          )}
          <h1 className="text-white font-black text-xl mb-1">{user_name}'s Watchlist</h1>
          <p className="text-slate-400 text-sm mb-3">{watchlist.length} show{watchlist.length!==1?'s':''} tracked</p>
          {persona_label && (
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-full">
              <i className="fa-solid fa-masks-theater text-violet-400 text-xs"/>
              <span className="text-violet-300 text-xs font-bold">{persona_label}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-8">
          {watchlist.map((show, i) => {
            const poster = show.poster || (show.poster_path ? `${IMG_BASE}${show.poster_path}` : '')
            return (
              <div key={show.id||i} onClick={() => show.id && navigate(`/details/${show.id}`)} className="cursor-pointer group">
                <div className="relative overflow-hidden rounded-2xl aspect-[2/3] bg-slate-800 mb-2 shadow-lg">
                  {poster
                    ? <img src={poster} alt={show.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"/>
                    : <div className="w-full h-full flex items-center justify-center"><i className="fa-solid fa-tv text-slate-600 text-2xl"/></div>
                  }
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent opacity-0 group-hover:opacity-100 transition-opacity"/>
                </div>
                <h3 className="text-white text-xs font-bold truncate leading-tight mb-0.5">{show.name}</h3>
                {show.network && <p className="text-slate-400 text-[10px] truncate mb-0.5">{show.network}</p>}
                <p className="text-cyan-400 text-[10px] font-black uppercase tracking-wide">{fmt(show.premiere_date)}</p>
              </div>
            )
          })}
        </div>

        <div className="bg-gradient-to-br from-cyan-600/15 to-blue-600/10 border border-cyan-500/20 rounded-3xl p-6 sm:p-8 text-center">
          <div className="text-4xl mb-4">⚡</div>
          <h2 className="text-white font-black text-lg uppercase tracking-widest mb-2">Track Your Own Premieres</h2>
          <p className="text-slate-300 text-sm mb-6 max-w-sm mx-auto leading-relaxed">
            AirDate tracks every TV premiere before it trends — free to join, no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/auth/login"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-2xl transition-all">
              <i className="fa-solid fa-bolt"/> Join AirDate Free
            </Link>
            <Link to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 border border-white/10 hover:border-white/20 text-slate-200 text-xs font-black uppercase tracking-widest rounded-2xl transition-all">
              Browse Premieres →
            </Link>
          </div>
        </div>
      </div>
      <Footer/>
    </div>
  )
}
