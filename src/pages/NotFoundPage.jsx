// src/pages/NotFoundPage.jsx
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

export function NotFoundPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen flex flex-col">
      <div className="flex-1 flex items-center justify-center px-6 py-24">
        <div className="text-center max-w-md">
          <div className="text-8xl font-black text-slate-800 mb-4">404</div>
          <div className="w-16 h-16 bg-cyan-500/10 border border-cyan-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <i className="fa-solid fa-satellite-dish text-cyan-400 text-2xl"></i>
          </div>
          <h1 className="text-3xl font-black text-white mb-3 tracking-tight">Signal Lost</h1>
          <p className="text-slate-400 text-sm mb-8 leading-relaxed">
            This page couldn't be found. The show may have been cancelled, or the URL might be incorrect.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/" className="h-12 px-8 bg-cyan-500 text-slate-950 font-black rounded-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-cyan-400 transition-all">
              <i className="fa-solid fa-house"></i> Back to Home
            </Link>
            <Link to="/trending" className="h-12 px-8 bg-slate-800 border border-white/10 text-white font-bold rounded-xl uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:border-white/30 transition-all">
              <i className="fa-solid fa-fire"></i> See Trending
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
