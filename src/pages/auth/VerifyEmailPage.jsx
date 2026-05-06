// src/pages/auth/VerifyEmailPage.jsx
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

export function VerifyEmailPage() {
  const { confirmSignUp, resendCode } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()
  const email     = location.state?.email || ''

  const [digits,    setDigits]    = useState(['', '', '', '', '', ''])
  const [loading,   setLoading]   = useState(false)
  const [resending, setResending] = useState(false)
  const [error,     setError]     = useState('')
  const [resentAt,  setResentAt]  = useState(null)
  const inputRefs = useRef([])

  const RESEND_COOLDOWN = 30
  const fullCode = digits.join('')
  const canResend = !resending && (!resentAt || (Date.now() - resentAt) / 1000 > RESEND_COOLDOWN)

  // Auto-submit when all 6 filled
  useEffect(() => {
    if (digits.every(d => d !== '')) {
      verify(digits.join(''))
    }
  }, [digits])

  function handleInput(idx, value) {
    const raw = value.replace(/\D/g, '')

    // Handle paste of full code into any box
    if (raw.length > 1) {
      const chars = raw.slice(0, 6).split('')
      const next  = ['', '', '', '', '', '']
      chars.forEach((c, i) => { next[i] = c })
      setDigits(next)
      inputRefs.current[Math.min(chars.length - 1, 5)]?.focus()
      return
    }

    const next  = [...digits]
    next[idx]   = raw
    setDigits(next)
    if (raw && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  function handleKeyDown(idx, e) {
    if (e.key === 'Backspace') {
      if (digits[idx]) {
        const next = [...digits]; next[idx] = ''; setDigits(next)
      } else if (idx > 0) {
        inputRefs.current[idx - 1]?.focus()
      }
    }
    if (e.key === 'ArrowLeft'  && idx > 0) inputRefs.current[idx - 1]?.focus()
    if (e.key === 'ArrowRight' && idx < 5) inputRefs.current[idx + 1]?.focus()
  }

  async function verify(code) {
    if (code.length < 6) { setError('Please enter the full 6-digit code.'); return }
    setError(''); setLoading(true)
    try {
      await confirmSignUp(email, code)
      navigate('/auth/login', { state: { verified: true } })
    } catch (err) {
      const c = err?.code || err?.__type || ''
      if (c === 'CodeMismatchException')     setError('Incorrect code — please try again.')
      else if (c === 'ExpiredCodeException') setError('Code expired. Request a new one below.')
      else setError(err?.message || 'Verification failed.')
      setDigits(['', '', '', '', '', ''])
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally { setLoading(false) }
  }

  async function handleResend() {
    if (!email || !canResend) return
    setResending(true); setError('')
    try {
      await resendCode(email)
      setResentAt(Date.now())
    } catch (err) {
      setError('Could not resend code — please try again.')
    } finally { setResending(false) }
  }

  return (
    <div className="bg-slate-950 min-h-screen flex flex-col items-center justify-center px-4">
      <a href="/" className="flex flex-col items-center mb-10 group">
        <img src="/assets/images/official-airdate-logo.png" alt="AirDate"
          className="h-14 w-auto object-contain mb-1 group-hover:opacity-80 transition-opacity"/>
      </a>

      <div className="w-full max-w-[400px]">
        <div className="bg-slate-900 border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6">
            <i className="fa-solid fa-envelope-open-text text-cyan-400 text-2xl"/>
          </div>

          <h1 className="text-2xl font-black text-white tracking-tight mb-1">Check your inbox</h1>
          <p className="text-slate-400 text-sm mb-1">We sent a 6-digit code to</p>
          <p className="text-cyan-400 font-bold text-sm mb-7 truncate">
            {email || 'your email address'}
          </p>

          {/* Error */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
              <i className="fa-solid fa-circle-exclamation text-red-400 text-sm flex-shrink-0 mt-0.5"/>
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          {/* Resent banner */}
          {resentAt && (Date.now() - resentAt) / 1000 < 5 && (
            <div className="mb-5 px-4 py-3 bg-green-500/10 border border-green-500/30 rounded-xl flex items-center gap-3">
              <i className="fa-solid fa-circle-check text-green-400 text-sm flex-shrink-0"/>
              <p className="text-green-300 text-sm font-medium">New code sent — check your inbox.</p>
            </div>
          )}

          {/* OTP boxes — fixed width so they don't stretch */}
          <div className="flex gap-2 justify-center mb-6">
            {digits.map((digit, idx) => (
              <input
                key={idx}
                ref={el => inputRefs.current[idx] = el}
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={digit}
                onChange={e => handleInput(idx, e.target.value)}
                onKeyDown={e => handleKeyDown(idx, e)}
                onFocus={e => e.target.select()}
                disabled={loading}
                className={`w-12 h-14 text-center text-xl font-black rounded-xl border transition-all focus:outline-none
                  ${digit
                    ? 'bg-cyan-500/8 border-cyan-500/40 text-white'
                    : 'bg-slate-800/60 border-white/10 text-white'}
                  focus:border-cyan-500/60 focus:ring-2 focus:ring-cyan-500/10
                  ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              />
            ))}
          </div>

          {/* Verify button */}
          <button
            onClick={() => verify(fullCode)}
            disabled={loading || fullCode.length < 6}
            className="w-full py-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 mb-4"
          >
            {loading
              ? <><div className="w-4 h-4 border-2 border-slate-950/20 border-t-slate-950 rounded-full animate-spin"/>Verifying…</>
              : 'Verify Email'
            }
          </button>

          {/* Resend */}
          <p className="text-center text-sm text-slate-500">
            Didn't receive it?{' '}
            <button
              onClick={handleResend}
              disabled={!canResend}
              className="text-cyan-400 hover:text-cyan-300 font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {resending ? 'Sending…' : 'Resend code'}
            </button>
            {resentAt && !canResend && (
              <ResendCountdown resentAt={resentAt} cooldown={RESEND_COOLDOWN}/>
            )}
          </p>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-white/8"/>
          </div>

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

function ResendCountdown({ resentAt, cooldown }) {
  const [seconds, setSeconds] = useState(cooldown)
  useEffect(() => {
    const t = setInterval(() => {
      const remaining = Math.ceil(cooldown - (Date.now() - resentAt) / 1000)
      setSeconds(Math.max(0, remaining))
    }, 1000)
    return () => clearInterval(t)
  }, [resentAt, cooldown])
  if (seconds <= 0) return null
  return <span className="text-slate-600 text-xs ml-1">({seconds}s)</span>
}