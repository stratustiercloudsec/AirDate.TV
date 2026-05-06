// src/components/layout/Footer.jsx
import { Link } from 'react-router-dom'

export function Footer() {
  return (
    <footer className="w-full py-6 mt-16 border-t border-white/10 text-[11px] font-medium text-slate-400 uppercase tracking-widest bg-[#03060b]">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 px-8 mb-2">
        <Link to="/" className="flex flex-col items-center md:items-start flex-none">
          <img src="/assets/images/official-airdate-logo.png" alt="AirDate" className="h-10 w-auto object-contain mb-1" />
          <p className="text-slate-400 text-[9px] font-normal tracking-wider lowercase opacity-70">track tv premieres before they trend.</p>
        </Link>
        <div className="flex flex-wrap gap-x-8 gap-y-2 justify-center md:justify-end text-slate-400">
          <Link to="/trending"  className="hover:text-cyan-400 transition-colors">Trending</Link>
          <Link to="/premieres" className="hover:text-cyan-400 transition-colors">Premieres</Link>
          <Link to="/scoop"     className="hover:text-cyan-400 transition-colors">The Scoop</Link>
          <Link to="/account"   className="hover:text-cyan-400 transition-colors">My Pulse</Link>
        </div>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center gap-x-6 gap-y-4 px-8 border-t border-white/5 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 text-center md:text-left text-slate-400/80">
          <span className="font-bold text-slate-400">© 2026 AirDate.</span>
          <span>All Rights Reserved.</span>
          <span className="mx-1 opacity-20">|</span>
          <span>Metadata Orchestration Platform</span>
          <span className="mx-2 opacity-20 text-white">|</span>
          <a href="https://stratustierlabs.com" target="_blank" rel="noreferrer" className="group">
            ENGINEERED BY{' '}
            <span className="text-white font-black group-hover:text-cyan-400 transition-colors">STRATUSTIER</span>{' '}
            <span className="text-cyan-400">INNOVATION LABS</span>
          </a>
        </div>
        <div className="flex gap-8 justify-center md:justify-end text-slate-400">
          <Link to="/vision"  className="hover:text-cyan-400 transition-colors">Vision</Link>
          <Link to="/terms"   className="hover:text-cyan-400 transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
          <Link to="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  )
}
