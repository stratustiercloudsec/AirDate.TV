import { useState, useEffect } from 'react'

const API = 'https://qg0x31ranc.execute-api.us-east-1.amazonaws.com/prod'
const _cache = {}

export default function PredictionBadge({ showId, premiereDate, compact = false }) {
  const [pred, setPred] = useState(null)

  const isTBA = !premiereDate ||
    ['tba','tbd','','null','none'].includes(String(premiereDate).toLowerCase().trim())

  useEffect(() => {
    if (!isTBA || !showId) return
    const id = String(showId)
    if (_cache[id]) { setPred(_cache[id]); return }
    fetch(`${API}/predictions/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (d?.predicted_label && d.predicted_label !== 'Not Returning') {
          _cache[id] = d
          setPred(d)
        }
      })
      .catch(() => {})
  }, [showId, isTBA])

  if (!isTBA || !pred) return null

  const conf = parseFloat(pred.confidence || 0)
  const cls  = conf >= 0.70
    ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
    : conf >= 0.50
    ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10'
    : 'text-amber-400 border-amber-500/30 bg-amber-500/10'

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-wider ${cls}`}>
        <i className="fa-solid fa-wand-magic-sparkles text-[8px]"/>
        {pred.predicted_label} · {pred.confidence_label}
      </span>
    )
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-xl border text-[10px] font-black uppercase tracking-wider mt-1 ${cls}`}>
      <i className="fa-solid fa-wand-magic-sparkles text-[9px]"/>
      <span>{pred.predicted_label}</span>
      <span className="opacity-60">·</span>
      <span>{pred.confidence_label}</span>
    </div>
  )
}
