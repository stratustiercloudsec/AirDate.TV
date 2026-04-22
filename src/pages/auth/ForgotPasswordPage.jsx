// src/pages/auth/ForgotPasswordPage.jsx
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function ForgotPasswordPage() {
  const { forgotPassword, confirmForgotPassword } = useAuth()
  const navigate = useNavigate()

  const [step,     setStep]     = useState('request')  // 'request' | 'reset'
  const [email,    setEmail]    = useState('')
  const [code,     setCode]     = useState('')
  const [newPw,    setNewPw]    = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const pwOk = newPw.length >= 8 && /[A-Z]/.test(newPw) && /\d/.test(newPw) && /[^A-Za-z0-9]/.test(newPw)

  async function handleRequest(e) {
    e.preventDefault()
    if (!email) { setError('Please enter your email.'); return }
    setError(''); setLoading(true)
    try {
      await forgotPassword(email.trim().toLowerCase())
      setStep('reset')
    } catch (err) {
      const c = err?.code || err?.__type || ''
      if (c === 'UserNotFoundException')   setError('No account found with that email.')
      else if (c === 'LimitExceededException') setError('Too many requests — please wait a few minutes.')
      else setError(err?.message || 'Failed to send reset code.')
    } finally { setLoading(false) }
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!code || code.length < 6) { setError('Please enter the 6-digit code.'); return }
    if (!pwOk) { setError('Password must be 8+ chars with uppercase, number, and special character.'); return }
    setError(''); setLoading(true)
    try {
      await confirmForgotPassword(email.trim().toLowerCase(), code, newPw)
      navigate('/auth/login', { state: { passwordReset: true } })
    } catch (err) {
      const c = err?.code || err?.__type || ''
      if (c === 'CodeMismatchException')     setError('Incorrect code — please try again.')
      else if (c === 'ExpiredCodeException') setError('Code expired — go back and request a new one.')
      else if (c === 'InvalidPasswordException') setError('Password doesn\'t meet requirements.')
      else setError(err?.message || 'Reset failed — please try again.')
    } finally { setLoading(false) }
  }

  return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center px-4 py-12">
      <a href="/" className="flex flex-col items-center mb-10 group">
        <img src="/assets/images/official-airdate-logo.png" alt="AirDate"
          className="h-14 w-auto object-contain mb-1 group-hover:opacity-80 transition-opacity"/>
      </a>

      <div className="w-full max-w-[400px]">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">

          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
            <i className="fa-solid fa-lock-open text-amber-400 text-2xl"/>
          </div>

          {step === 'request' ? (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight mb-1">Reset password</h1>
              <p className="text-slate-400 text-sm mb-7">
                Enter your email and we'll send a verification code.
              </p>

              {error && <ErrorBanner msg={error}/>}

              <form onSubmit={handleRequest} className="space-y-4" noValidate>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="you@example.com" autoComplete="email" required
                    className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"/>Sending…</>
                    : 'Send Reset Code'
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-black text-white tracking-tight mb-1">Set new password</h1>
              <p className="text-slate-400 text-sm mb-1">Code sent to</p>
              <p className="text-amber-400 font-bold text-sm mb-7 truncate">{email}</p>

              {error && <ErrorBanner msg={error}/>}

              <form onSubmit={handleReset} className="space-y-4" noValidate>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    Verification code
                  </label>
                  <input
                    type="text" inputMode="numeric" value={code}
                    onChange={e => setCode(e.target.value.replace(/\D/g,'').slice(0,6))}
                    placeholder="6-digit code" maxLength={6} required
                    className="w-full px-4 py-3 bg-slate-800/60 border border-white/10 focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all tracking-[0.4em] text-center text-lg font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5">
                    New password
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'} value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      placeholder="Min 8 chars · uppercase · number · special"
                      autoComplete="new-password" required
                      className="w-full px-4 py-3 pr-11 bg-slate-800/60 border border-white/10 focus:border-amber-500/40 focus:ring-2 focus:ring-amber-500/10 rounded-xl text-white text-sm placeholder-slate-500 focus:outline-none transition-all"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-500 hover:text-slate-300 transition-colors">
                      <i className={`fa-solid ${showPw ? 'fa-eye-slash' : 'fa-eye'} text-sm`}/>
                    </button>
                  </div>
                  {/* Simple strength signal */}
                  {newPw && (
                    <div className={`mt-2 text-[10px] font-black uppercase tracking-widest ${pwOk ? 'text-cyan-400' : 'text-amber-400'}`}>
                      {pwOk ? '✓ Password looks good' : 'Needs uppercase, number + special char'}
                    </div>
                  )}
                </div>

                <button type="submit" disabled={loading}
                  className="w-full py-3.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"/>Resetting…</>
                    : 'Reset Password'
                  }
                </button>

                <button
                  type="button"
                  onClick={() => { setStep('request'); setCode(''); setNewPw(''); setError('') }}
                  className="w-full text-slate-500 hover:text-slate-300 text-sm font-bold transition-colors"
                >
                  ← Request a new code
                </button>
              </form>
            </>
          )}

          <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-white/8"/></div>
          <p className="text-center">
            <Link to="/auth/login" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
              ← Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

function ErrorBanner({ msg }) {
  return (
    <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
      <i className="fa-solid fa-circle-exclamation text-red-400 text-sm flex-shrink-0 mt-0.5"/>
      <p className="text-red-300 text-sm font-medium">{msg}</p>
    </div>
  )
}
