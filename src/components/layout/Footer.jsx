import { Link } from 'react-router-dom'

const SOCIAL = [
  { icon: 'fa-brands fa-instagram', href: 'https://www.instagram.com/airdatetv/', label: 'Instagram' },
  { icon: 'fa-brands fa-facebook',  href: 'https://www.facebook.com/people/AirDate-TV/61590161696097/',       label: 'Facebook'  },
  { icon: 'fa-brands fa-tiktok',    href: 'https://tiktok.com/@airdatetv',        label: 'TikTok'    },
  { icon: 'fa-brands fa-youtube',   href: 'https://youtube.com/@AirDateTV_Premieres',       label: 'YouTube'   },
  { icon: 'fa-brands fa-x-twitter', href: 'https://x.com/AirdatetvF42317',        label: 'X'         },
  { icon: 'fa-brands fa-linkedin', href: 'https://www.linkedin.com/company/airdate-tv',        label: 'LinkedIn'         }
]

export function Footer() {
  let isAuthenticated = false
  try {
    const s = localStorage.getItem('airdate_session')
    if (s) { const p = JSON.parse(s); isAuthenticated = !!(p && p.AccessToken) }
  } catch (_) {}
  return (
    <footer className="w-full py-6 mt-16 border-t border-white/10 text-[11px] font-medium text-slate-200 uppercase tracking-widest bg-[#03060b]">
      <div className="flex flex-col md:flex-row justify-between items-center md:items-end gap-6 px-8 mb-2">
        <div style={{display:'flex',alignItems:'center',gap:'20px'}}>
          <Link to="/" className="flex flex-col items-center md:items-start flex-none">
            <img src="/assets/images/adtv-logo.png" alt="AirDate" className="h-10 w-auto object-contain mb-1" />
            <p className="text-slate-200 text-[9px] font-normal tracking-wider lowercase opacity-70">track tv premieres before they trend.</p>
          </Link>
          <div style={{display:'flex',gap:'10px'}}>
            {SOCIAL.map(s => (
              <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}
                style={{width:'32px',height:'32px',borderRadius:'8px',display:'flex',alignItems:'center',
                        justifyContent:'center',background:'rgba(30,41,59,0.6)',
                        border:'1px solid rgba(255,255,255,0.1)',color:'#CBD5E1',textDecoration:'none'}}>
                <i className={s.icon} style={{fontSize:'14px'}}></i>
              </a>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-8 gap-y-2 justify-center md:justify-end text-slate-200">
          <Link to="/trending"  className="hover:text-cyan-400 transition-colors">Trending</Link>
          <Link to="/premieres" className="hover:text-cyan-400 transition-colors">Premieres</Link>
          <Link to="/scoop"     className="hover:text-cyan-400 transition-colors">The Scoop</Link>
          {isAuthenticated && <Link to="/persona" className="hover:text-cyan-400 transition-colors">My Persona</Link>}
        </div>
      </div>
      <div className="flex flex-col md:flex-row justify-between items-center gap-x-6 gap-y-4 px-8 border-t border-white/5 pt-3">
        <div className="flex flex-wrap items-center gap-x-2 text-center md:text-left text-slate-200/80">
          <span className="font-bold text-slate-200">© 2026 AirDate.TV.</span>
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
        <div className="flex gap-8 justify-center md:justify-end text-slate-200">
          <Link to="/vision"  className="hover:text-cyan-400 transition-colors">Vision</Link>
          <Link to="/terms"   className="hover:text-cyan-400 transition-colors">Terms</Link>
          <Link to="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
          <Link to="/faq"     className="hover:text-cyan-400 transition-colors">FAQ</Link>
          <Link to="/contact" className="hover:text-cyan-400 transition-colors">Contact</Link>
        </div>
      </div>
    </footer>
  )
}

// v1779054460
// FOOTER_MARKER_12345
