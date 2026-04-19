// src/pages/PremieresCalendarPage.jsx
import { useEffect, useState, useCallback } from 'react'
import { useAuth }      from '@/context/AuthContext'
import { useWatchlist } from '@/context/WatchlistContext'
import { API_BASE } from '@/config/aws'
import { usePoster } from '@/utils/poster'
import { Footer }       from '@/components/layout/Footer'

const NETWORKS = ['All','Netflix','HBO Max','Disney+','Prime Video','Hulu','Apple TV+','Peacock','Paramount+','CBS','NBC','ABC','FOX','FX','AMC','STARZ']
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getNetworkColor(n) {
  const map = { Netflix: '#E50914', 'HBO Max': '#5822CF', 'Disney+': '#113CCF', Hulu: '#1CE783', 'Apple TV+': '#111', 'Prime Video': '#00A8E0', Peacock: '#000', 'Paramount+': '#0064FF', CBS: '#00205B', NBC: '#CF0A2C', ABC: '#FFCD00', FOX: '#003087', FX: '#000', AMC: '#D4AF37', STARZ: '#333' }
  return map[n] ?? '#22d3ee'
}

export function PremieresCalendarPage() {
  const { token, isAuthenticated } = useAuth()
  const { toggleWatchlist, isTracked, atLimit } = useWatchlist()

  const [view, setView]             = useState('calendar')
  const [network, setNetwork]       = useState('All')
  const [premieres, setPremieres]   = useState([])
  const [loading, setLoading]       = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const headers = token ? { Authorization: `Bearer ${token}` } : {}
  const year  = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const fetchPremieres = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ year, month: month + 1, ...(network !== 'All' && { network }) })
      const res  = await fetch(`${API_BASE}/premieres/calendar?${params}`, { headers })
      const data = await res.json()
      setPremieres(data.premieres ?? data.shows ?? [])
    } catch {}
    finally { setLoading(false) }
  }, [year, month, network, token])

  useEffect(() => { fetchPremieres() }, [fetchPremieres])

  function handleTrack(show) {
    const r = toggleWatchlist(show)
    if (r?.error === 'FREEMIUM_LIMIT') window.location.href = '/upgrade'
  }

  // Build calendar grid
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  const filtered = network === 'All' ? premieres : premieres.filter(p => p.network === network || p.networks?.includes(network))

  function getShowsForDate(dateStr) {
    return filtered.filter(p => p.first_air_date === dateStr || p.premiere_date === dateStr)
  }

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })
  const monthCount = filtered.length

  // Group by date for list view
  const byDate = {}
  filtered.forEach(p => {
    const d = p.first_air_date ?? p.premiere_date ?? ''
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(p)
  })
  const sortedDates = Object.keys(byDate).sort()

  const selectedDateStr = selectedDay
    ? `${year}-${String(month + 1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}`
    : null
  const selectedShows = selectedDateStr ? getShowsForDate(selectedDateStr) : []

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-3">
              <i className="fa-solid fa-calendar-star"></i> AI-Verified Premiere Dates
            </div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-white mb-2">Premiere Calendar</h1>
            <p className="text-slate-400 text-sm max-w-xl">Every confirmed TV premiere across all networks — not internet rumors, not estimates. AI-verified dates only.</p>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {loading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold uppercase tracking-widest">
                <div className="w-3 h-3 border-2 border-slate-600 border-t-cyan-400 rounded-full animate-spin"></div>Loading...
              </div>
            )}
            <div className="flex items-center gap-1 bg-slate-800/60 border border-white/10 rounded-xl p-1">
              <button onClick={() => setView('calendar')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-200 transition-all ${view === 'calendar' ? 'bg-white/8 text-white' : ''}`}>
                <i className="fa-solid fa-calendar-days mr-1"></i>Calendar
              </button>
              <button onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest text-slate-200 transition-all ${view === 'list' ? 'bg-white/8 text-white' : ''}`}>
                <i className="fa-solid fa-list mr-1"></i>List
              </button>
            </div>
          </div>
        </div>

        {/* Network filter */}
        <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex-shrink-0">Filter:</span>
          {NETWORKS.map(n => (
            <button key={n} onClick={() => setNetwork(n)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all
                ${network === n ? 'bg-cyan-500/10 border-cyan-500/35 text-cyan-400' : 'text-slate-400 border-white/10 hover:text-white'}`}>
              {n}
            </button>
          ))}
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-sm font-bold text-slate-200 hover:text-white transition-all">
            <i className="fa-solid fa-chevron-left text-xs"></i> Prev
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-black text-white tracking-tight">{monthLabel}</h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-0.5">{monthCount} Premieres</p>
          </div>
          <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800/60 hover:bg-slate-800 border border-white/10 rounded-xl text-sm font-bold text-slate-200 hover:text-white transition-all">
            Next <i className="fa-solid fa-chevron-right text-xs"></i>
          </button>
        </div>

        {/* Calendar View */}
        {view === 'calendar' && (
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2">
              <div className="grid grid-cols-7 mb-2">
                {DOW.map(d => <div key={d} className="text-center text-[10px] font-black uppercase tracking-widest text-slate-400 py-2">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} className="aspect-square rounded-xl bg-slate-900/20 opacity-30"></div>)}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const day = i + 1
                  const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
                  const shows = getShowsForDate(dateStr)
                  const isToday = dateStr === todayStr
                  const isSelected = selectedDay === day
                  return (
                    <div key={day} onClick={() => setSelectedDay(day)}
                      className={`min-h-[90px] rounded-xl border p-1.5 cursor-pointer transition-all
                        ${isSelected ? 'border-cyan-500/40 bg-cyan-500/4' : 'border-white/5 hover:border-white/10 bg-slate-900/30'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black mb-1
                        ${isToday ? 'bg-cyan-400 text-slate-950' : 'text-slate-400'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {shows.slice(0, 3).map((show, idx) => (
                          <div key={idx} className="flex items-center gap-1">
                            <div className="premiere-dot w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: getNetworkColor(show.network) }}></div>
                            <span className="text-[8px] text-slate-300 truncate leading-tight">{show.name}</span>
                          </div>
                        ))}
                        {shows.length > 3 && <span className="text-[8px] text-slate-500">+{shows.length - 3} more</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Day detail panel */}
            <div className="xl:col-span-1">
              <div className="bg-slate-900/50 border border-white/8 rounded-3xl p-5 sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto">
                {!selectedDay ? (
                  <div className="text-center py-12">
                    <i className="fa-solid fa-calendar-day text-slate-700 text-4xl mb-3"></i>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-widest">Select a date</p>
                    <p className="text-slate-700 text-xs mt-1">to see what's premiering</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-black text-white">
                          {new Date(year, month, selectedDay).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{selectedShows.length} premiere{selectedShows.length !== 1 ? 's' : ''}</p>
                      </div>
                      {selectedDateStr === todayStr && (
                        <span className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-[10px] font-black uppercase tracking-widest">Today</span>
                      )}
                    </div>
                    {selectedShows.length === 0 ? (
                      <p className="text-slate-500 text-sm text-center py-8">No premieres on this date.</p>
                    ) : (
                      <div className="space-y-3">
                        {selectedShows.map(show => (
                          <div key={show.id} className="flex items-center gap-3 p-3 bg-slate-800/40 border border-white/5 rounded-2xl hover:border-cyan-500/20 transition-all cursor-pointer"
                            onClick={() => window.location.href = `/show/${show.id}`}>
                            <img {...usePoster(show.poster_path, show.name, 92)} alt={show.name}
                              className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-bold text-white truncate">{show.name}</h4>
                              {show.network && <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: getNetworkColor(show.network) }}>{show.network}</p>}
                            </div>
                            {isAuthenticated && (
                              <button onClick={e => { e.stopPropagation(); handleTrack(show) }} disabled={!isTracked(show.id) && atLimit}
                                className={`flex-shrink-0 px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all
                                  ${isTracked(show.id) ? 'bg-cyan-500 text-slate-950' : 'bg-slate-700 text-slate-400 hover:bg-cyan-500/20 hover:text-cyan-400'}`}>
                                {isTracked(show.id) ? '✓' : '+'}
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* List View */}
        {view === 'list' && (
          <div className="space-y-8">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="h-4 bg-slate-700/50 rounded w-32 mb-4"></div>
                  <div className="space-y-3">{Array.from({ length: 3 }).map((_, j) => <div key={j} className="h-16 bg-slate-800/40 rounded-2xl"></div>)}</div>
                </div>
              ))
            ) : sortedDates.length === 0 ? (
              <div className="text-center py-20">
                <i className="fa-solid fa-calendar-xmark text-slate-700 text-5xl mb-4"></i>
                <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">No premieres found for {monthLabel}</p>
              </div>
            ) : sortedDates.map(date => (
              <div key={date}>
                <h3 className="text-sm font-black text-white uppercase tracking-widest mb-4 flex items-center gap-3">
                  <span className={`px-3 py-1 rounded-xl text-xs ${date === todayStr ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-200'}`}>
                    {new Date(date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                  </span>
                  <span className="text-slate-500 text-[10px]">{byDate[date].length} premiere{byDate[date].length !== 1 ? 's' : ''}</span>
                </h3>
                <div className="space-y-3">
                  {byDate[date].map(show => (
                    <div key={show.id} className="flex items-center gap-4 bg-slate-800/40 border border-white/5 rounded-2xl p-4 hover:border-cyan-500/20 transition-all cursor-pointer"
                      onClick={() => window.location.href = `/show/${show.id}`}>
                      <img {...usePoster(show.poster_path, show.name, 92)} alt={show.name}
                        className="w-12 h-16 object-cover rounded-xl flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">{show.name}</h4>
                        {show.network && <p className="text-[10px] font-bold uppercase tracking-widest mt-0.5" style={{ color: getNetworkColor(show.network) }}>{show.network}</p>}
                        {show.overview && <p className="text-xs text-slate-400 line-clamp-2 mt-1">{show.overview}</p>}
                      </div>
                      {isAuthenticated && (
                        <button onClick={e => { e.stopPropagation(); handleTrack(show) }} disabled={!isTracked(show.id) && atLimit}
                          className={`flex-shrink-0 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                            ${isTracked(show.id) ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 border border-white/10 text-slate-200 hover:bg-cyan-500/20 hover:border-cyan-500/30 hover:text-cyan-400'}`}>
                          {isTracked(show.id) ? '✓ Tracking' : '+ Track'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
      <Footer />
    </div>
  )
}