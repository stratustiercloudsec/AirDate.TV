export function ratingColor(rating) {
  if (!rating) return 'border-white/20 text-slate-200'
  if (rating === 'TV-MA')  return 'border-red-500/50 text-red-400'
  if (rating === 'TV-14')  return 'border-orange-500/50 text-orange-400'
  if (rating === 'TV-PG')  return 'border-yellow-500/50 text-yellow-400'
  if (['TV-G','TV-Y','TV-Y7'].includes(rating)) return 'border-green-500/50 text-green-400'
  return 'border-white/20 text-slate-200'
}

export function RatingBadge({ rating }) {
  if (!rating) return null
  return (
    <span className={`absolute bottom-2 right-2 z-10 px-1.5 py-0.5 bg-slate-950/85 border rounded text-[9px] font-black tracking-widest backdrop-blur-sm ${ratingColor(rating)}`}>
      {rating}
    </span>
  )
}
