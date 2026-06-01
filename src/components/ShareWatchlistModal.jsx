import { useState } from 'react'
import { useAuth }  from '@/context/AuthContext'
import { API_BASE } from '@/config/aws'

export function ShareWatchlistModal({ watchlist, persona, onClose }) {
  const { token, idToken, user } = useAuth()

  // Fallback: read IdToken directly from localStorage if useAuth idToken is null
  function cleanName(raw) {
    if (!raw) return 'Someone'
    // Strip URL-encoded JSON garbage from Google OAuth names
    if (raw.includes('%7B') || raw.includes('{')) {
      try {
        const decoded = decodeURIComponent(raw)
        const parsed = JSON.parse(decoded)
        // Google OAuth name sometimes stored as array of name objects
        if (Array.isArray(parsed)) {
          const primary = parsed.find(n => n?.metadata?.primary) || parsed[0]
          return primary?.value || primary?.displayName || 'Someone'
        }
        return parsed?.value || parsed?.displayName || 'Someone'
      } catch { return 'Someone' }
    }
    return raw
  }

  function getAuthToken() {
    if (idToken) return idToken
    try {
      const s = JSON.parse(localStorage.getItem('airdate_session') || '{}')
      return s.IdToken || s.id_token || token || ''
    } catch { return token || '' }
  }
  const [step,         setStep]        = useState('idle')
  const [shareUrl,     setShareUrl]    = useState('')
  const [smsUrl,       setSmsUrl]      = useState('')
  const [shareToken,   setShareToken]  = useState('')
  const [copied,       setCopied]      = useState(false)
  const [emailInput,   setEmailInput]  = useState('')
  const [emailSending, setEmailSending]= useState(false)
  const [emailSent,    setEmailSent]   = useState(false)
  const [emailError,   setEmailError]  = useState('')
  const [showEmailForm,setShowEmailForm]= useState(false)
  const sub = user?.sub ?? ''

  async function generateLink() {
    if (!token || !sub || !watchlist?.length) return
    setStep('generating')
    try {
      const res = await fetch(`${API_BASE}/user/${sub}/share`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${getAuthToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          watchlist,
          persona_label: persona?.persona_label || '',
          user_name:     cleanName(user?.name) || user?.email?.split('@')[0] || 'Someone',
          user_avatar:   user?.picture || '',
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setShareUrl(data.share_url)
      setSmsUrl(data.sms_url)
      setShareToken(data.token)
      setStep('ready')
    } catch { setStep('error') }
  }

  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl) }
    catch {
      const el = document.createElement('textarea')
      el.value = shareUrl; document.body.appendChild(el)
      el.select(); document.execCommand('copy'); document.body.removeChild(el)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  async function sendEmail() {
    if (!emailInput || !emailInput.includes('@')) { setEmailError('Enter a valid email address'); return }
    setEmailSending(true); setEmailError('')
    try {
      const res = await fetch(`${API_BASE}/share/${shareToken}/email`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipient_email: emailInput }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setEmailSent(true); setEmailInput('')
    } catch(e) { setEmailError(e.message || 'Failed to send email') }
    finally { setEmailSending(false) }
  }

  const shareText = encodeURIComponent(`Check out the ${watchlist?.length || 0} shows I'm tracking on AirDate!`)
  const shareEnc  = encodeURIComponent(shareUrl)

  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  const SHARE_OPTIONS = [
    {
      label: 'X (Twitter)',
      icon: 'fa-brands fa-x-twitter',
      bg: 'bg-black',
      href: () => `https://twitter.com/intent/tweet?text=${shareText}&url=${shareEnc}`,
    },
    {
      label: 'Facebook',
      icon: 'fa-brands fa-facebook-f',
      bg: 'bg-[#1877F2]',
      href: () => `https://www.facebook.com/sharer/sharer.php?u=${shareEnc}`,
    },
    {
      label: 'WhatsApp',
      icon: 'fa-brands fa-whatsapp',
      bg: 'bg-[#25D366]',
      href: () => `https://wa.me/?text=${shareText}%20${shareEnc}`,
    },
    {
      label: 'SMS',
      icon: 'fa-solid fa-comment-sms',
      bg: 'bg-green-600',
      href: () => smsUrl,
    },
    {
      label: 'Email',
      icon: 'fa-solid fa-envelope',
      bg: 'bg-slate-600',
      href: null,
      onClick: () => setShowEmailForm(v => !v),
    },
    {
      label: copied ? 'Copied!' : 'Copy Link',
      icon: copied ? 'fa-solid fa-check' : 'fa-solid fa-link',
      bg: copied ? 'bg-green-600' : 'bg-slate-700',
      href: null,
      onClick: copyLink,
    },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-slate-900 border border-white/10 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-md shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-cyan-500/15 border border-cyan-500/20 rounded-xl flex items-center justify-center">
              <i className="fa-solid fa-share-nodes text-cyan-400 text-sm"/>
            </div>
            <div>
              <h2 className="text-white font-black text-sm uppercase tracking-widest">Share Watchlist</h2>
              <p className="text-slate-400 text-[10px]">{watchlist?.length || 0} shows · link expires in 7 days</p>
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-all">
            <i className="fa-solid fa-xmark text-xs"/>
          </button>
        </div>

        <div className="px-6 py-5">

          {/* IDLE */}
          {step === 'idle' && (
            <div className="space-y-4">
              <p className="text-slate-300 text-sm leading-relaxed">
                Generate a shareable link — friends can browse your tracked shows, premiere dates, and viewer persona without an account.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {(watchlist || []).slice(0, 5).map(s => (
                  <span key={s.id} className="px-2.5 py-1 bg-slate-800 border border-white/8 rounded-full text-slate-300 text-[10px] font-bold truncate max-w-[130px]">{s.name}</span>
                ))}
                {(watchlist?.length || 0) > 5 && (
                  <span className="px-2.5 py-1 bg-slate-800 border border-white/8 rounded-full text-slate-400 text-[10px]">+{watchlist.length - 5} more</span>
                )}
              </div>
              <button onClick={generateLink}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-black uppercase tracking-widest rounded-2xl transition-all">
                <i className="fa-solid fa-link"/> Generate Share Link
              </button>
            </div>
          )}

          {/* GENERATING */}
          {step === 'generating' && (
            <div className="py-10 text-center">
              <i className="fa-solid fa-circle-notch fa-spin text-cyan-400 text-2xl mb-3 block"/>
              <p className="text-slate-300 text-sm">Generating your share link…</p>
            </div>
          )}

          {/* ERROR */}
          {step === 'error' && (
            <div className="py-8 text-center">
              <i className="fa-solid fa-triangle-exclamation text-red-400 text-2xl mb-3 block"/>
              <p className="text-red-400 text-sm font-bold mb-4">Could not generate link</p>
              <button onClick={() => setStep('idle')}
                className="px-5 py-2.5 bg-slate-800 border border-white/10 rounded-xl text-slate-200 text-xs font-bold uppercase tracking-widest hover:bg-slate-700 transition-all">
                Try Again
              </button>
            </div>
          )}

          {/* READY */}
          {step === 'ready' && (
            <div className="space-y-5">

              {/* URL bar */}
              <div className="flex items-center gap-2 p-3 bg-slate-800/60 border border-white/8 rounded-xl">
                <i className="fa-solid fa-link text-slate-500 text-xs flex-shrink-0"/>
                <span className="text-slate-300 text-[11px] truncate flex-1 font-mono">{shareUrl}</span>
              </div>

              {/* Share grid — matches show detail style */}
              <div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-3">Share Using</p>
                <div className="grid grid-cols-3 gap-3">
                  {SHARE_OPTIONS.filter(opt => !opt.mobileOnly || isMobile).map(opt => (
                    opt.href ? (
                      <a key={opt.label}
                        href={opt.href()}
                        target={opt.label !== 'SMS' ? '_blank' : undefined}
                        rel="noopener noreferrer"
                        className="flex flex-col items-center gap-2 p-3 bg-slate-800/60 hover:bg-slate-800 border border-white/8 hover:border-white/15 rounded-2xl transition-all cursor-pointer">
                        <div className={`w-11 h-11 ${opt.bg} rounded-full flex items-center justify-center`}>
                          <i className={`${opt.icon} text-white text-base`}/>
                        </div>
                        <span className="text-slate-300 text-[10px] font-bold text-center leading-tight">{opt.label}</span>
                      </a>
                    ) : (
                      <button key={opt.label}
                        onClick={opt.onClick}
                        className="flex flex-col items-center gap-2 p-3 bg-slate-800/60 hover:bg-slate-800 border border-white/8 hover:border-white/15 rounded-2xl transition-all">
                        <div className={`w-11 h-11 ${opt.bg} rounded-full flex items-center justify-center`}>
                          <i className={`${opt.icon} text-white text-base`}/>
                        </div>
                        <span className="text-slate-300 text-[10px] font-bold text-center leading-tight">{opt.label}</span>
                      </button>
                    )
                  ))}
                </div>
              </div>

              {/* Inline email form */}
              {showEmailForm && (
                <div className="border-t border-white/5 pt-4 space-y-2">
                  {emailSent ? (
                    <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                      <i className="fa-solid fa-check text-green-400 text-xs"/>
                      <span className="text-green-400 text-xs font-bold">Email sent!</span>
                      <button onClick={() => setEmailSent(false)} className="ml-auto text-[10px] text-slate-400 hover:text-slate-200">Send another →</button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input type="email" value={emailInput}
                        onChange={e => { setEmailInput(e.target.value); setEmailError('') }}
                        onKeyDown={e => e.key === 'Enter' && sendEmail()}
                        placeholder="friend@email.com"
                        className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-slate-200 text-xs font-bold placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 transition-colors"/>
                      <button onClick={sendEmail} disabled={emailSending}
                        className="px-4 py-2.5 bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 rounded-xl text-cyan-400 text-xs font-black uppercase tracking-widest transition-all disabled:opacity-50 flex-shrink-0">
                        {emailSending ? <i className="fa-solid fa-spinner fa-spin"/> : 'Send'}
                      </button>
                    </div>
                  )}
                  {emailError && <p className="text-red-400 text-[10px]">{emailError}</p>}
                </div>
              )}

              <p className="text-slate-600 text-[10px] text-center">Rich previews appear when shared to airdate.tv</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
