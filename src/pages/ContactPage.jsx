// src/pages/ContactPage.jsx — v2.0
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { API_BASE } from '@/config/aws'

const INQUIRY_TYPES = [
  { value: 'general',     label: 'General Inquiry' },
  { value: 'partnership', label: 'Partnership & B2B' },
  { value: 'support',     label: 'Account Support' },
  { value: 'press',       label: 'Press & Media' },
  { value: 'error',       label: 'Report an Issue' },
]

const CONTACT_CARDS = [
  {
    icon:    'fa-solid fa-envelope',
    color:   'text-cyan-400',
    bg:      'bg-cyan-500/10',
    border:  'border-cyan-500/20',
    label:   'General Inquiries',
    value:   'hello@airdate.tv',
    href:    'mailto:hello@airdate.tv',
  },
  {
    icon:    'fa-solid fa-handshake',
    color:   'text-purple-400',
    bg:      'bg-purple-500/10',
    border:  'border-purple-500/20',
    label:   'Partnerships',
    value:   'partners@airdate.tv',
    href:    'mailto:partners@airdate.tv',
  },
  {
    icon:    'fa-solid fa-circle-question',
    color:   'text-pink-400',
    bg:      'bg-pink-500/10',
    border:  'border-pink-500/20',
    label:   'Support',
    value:   'support@airdate.tv',
    href:    'mailto:support@airdate.tv',
  },
]

export function ContactPage() {
  const [form, setForm]       = useState({ name: '', email: '', type: 'general', message: '' })
  const [submitting, setSub]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  function handleChange(e) {
    const key = e.target.id.replace('form-', '')
    setForm(f => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSub(true); setError('')
    try {
      await fetch(`${API_BASE}/contact`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      setSuccess(true)
    } catch {
      setError('Something went wrong. Email us directly at hello@airdate.tv')
    } finally {
      setSub(false)
    }
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1400px] mx-auto px-6 pt-28 pb-20">

        {/* ── Breadcrumb ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 mb-16">
          <Link to="/" className="hover:text-slate-300 transition-colors">Home</Link>
          <i className="fa-solid fa-chevron-right text-[7px]"></i>
          <span className="text-slate-400">Contact</span>
        </div>

        {/* ── Page header ────────────────────────────────────────────── */}
        <div className="mb-16">
          <div className="flex items-center gap-3 mb-4">
            <span className="w-10 h-px bg-cyan-400"></span>
            <span className="text-cyan-400 text-[10px] font-black uppercase tracking-[0.3em]">Get in Touch</span>
          </div>
          <h1 className="text-white font-black tracking-tight leading-none mb-4"
            style={{fontSize:'clamp(2.8rem, 7vw, 3.5rem)', letterSpacing:'-0.02em'}}>
            Let's Talk.
          </h1>
          <p className="text-slate-400 text-lg leading-relaxed max-w-xl">
            Whether you're a network, streamer, journalist, or fan — we want to hear from you.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-12">

          {/* ── Left column ────────────────────────────────────────────── */}
          <div className="lg:col-span-2 space-y-10">

            {/* Contact cards */}
            <div className="space-y-4">
              {CONTACT_CARDS.map(card => (
                <a key={card.value} href={card.href}
                  className={`flex items-center gap-4 p-5 bg-slate-900/50 border ${card.border} rounded-2xl hover:bg-slate-900/80 transition-all group`}>
                  <div className={`w-11 h-11 ${card.bg} border ${card.border} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <i className={`${card.icon} ${card.color} text-base`}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-0.5">{card.label}</p>
                    <p className={`text-sm font-bold ${card.color} group-hover:underline truncate`}>{card.value}</p>
                  </div>
                  <i className="fa-solid fa-arrow-up-right text-slate-600 text-[10px] ml-auto group-hover:text-slate-400 transition-colors"></i>
                </a>
              ))}
            </div>

            {/* Divider */}
            <div className="h-px bg-white/5"></div>

            {/* Response time note */}
            <div className="flex items-start gap-3 px-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse mt-1.5 flex-shrink-0"></span>
              <p className="text-slate-500 text-xs leading-relaxed">
                We typically respond within <span className="text-slate-300 font-bold">1–2 business days</span>.
                For urgent data issues, use the "Report an Issue" type and we'll prioritize it.
              </p>
            </div>

            {/* Social links */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-4">Find Us</p>
              <div className="flex gap-3">
                {[
                  { icon:'fa-brands fa-x-twitter', href:'https://x.com/airdatetv',     label:'X' },
                  { icon:'fa-brands fa-instagram',  href:'https://instagram.com/airdatetv', label:'Instagram' },
                  { icon:'fa-brands fa-linkedin',   href:'https://linkedin.com/company/airdatetv', label:'LinkedIn' },
                ].map(s => (
                  <a key={s.label} href={s.href} target="_blank" rel="noreferrer"
                    className="w-10 h-10 bg-slate-800/60 hover:bg-slate-700 border border-white/5 hover:border-cyan-500/20 rounded-xl flex items-center justify-center text-slate-400 hover:text-cyan-400 transition-all">
                    <i className={`${s.icon} text-sm`}></i>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* ── Right column — Form ─────────────────────────────────────── */}
          <div className="lg:col-span-3">
            {success ? (
              <div className="h-full flex flex-col items-center justify-center text-center bg-slate-900/40 border border-green-500/20 rounded-3xl p-16">
                <div className="w-16 h-16 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center mb-6">
                  <i className="fa-solid fa-circle-check text-green-400 text-2xl"></i>
                </div>
                <h2 className="text-white font-black text-2xl uppercase tracking-tight mb-3">Message Sent</h2>
                <p className="text-slate-400 text-sm mb-1">We'll follow up at</p>
                <p className="text-cyan-400 font-bold text-sm mb-8">{form.email}</p>
                <button onClick={() => { setSuccess(false); setForm({ name:'', email:'', type:'general', message:'' }) }}
                  className="text-slate-500 text-xs font-bold uppercase tracking-widest hover:text-slate-300 transition-colors">
                  Send another →
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit}
                className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 md:p-10 space-y-6">

                {/* Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <label htmlFor="form-name"
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
                      Your Name <span className="text-cyan-500">*</span>
                    </label>
                    <input id="form-name" type="text" placeholder="Jane Smith"
                      required value={form.name} onChange={handleChange}
                      className="w-full bg-slate-950/60 border border-white/8 hover:border-white/15 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"/>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="form-email"
                      className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
                      Email <span className="text-cyan-500">*</span>
                    </label>
                    <input id="form-email" type="email" placeholder="jane@company.com"
                      required value={form.email} onChange={handleChange}
                      className="w-full bg-slate-950/60 border border-white/8 hover:border-white/15 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors"/>
                  </div>
                </div>

                {/* Inquiry type */}
                <div className="space-y-2">
                  <label htmlFor="form-type"
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
                    Inquiry Type
                  </label>
                  <div className="relative">
                    <select id="form-type" value={form.type} onChange={handleChange}
                      className="w-full bg-slate-950/60 border border-white/8 hover:border-white/15 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-white focus:outline-none transition-colors appearance-none cursor-pointer">
                      {INQUIRY_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down text-slate-500 text-[10px] absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none"></i>
                  </div>
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <label htmlFor="form-message"
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 block">
                    Message <span className="text-cyan-500">*</span>
                  </label>
                  <textarea id="form-message" rows="6"
                    placeholder="Tell us what's on your mind..."
                    required value={form.message} onChange={handleChange}
                    className="w-full bg-slate-950/60 border border-white/8 hover:border-white/15 focus:border-cyan-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none transition-colors resize-none"/>
                </div>

                {error && (
                  <p className="text-red-400 text-xs font-bold flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>{error}
                  </p>
                )}

                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-cyan-500 hover:bg-cyan-400 active:scale-[0.99] text-slate-950 font-black uppercase tracking-[0.25em] text-[11px] rounded-xl transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2.5 disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting
                    ? <><i className="fa-solid fa-spinner fa-spin text-xs"></i> Sending...</>
                    : <><span>Send Message</span><i className="fa-solid fa-paper-plane text-xs"></i></>
                  }
                </button>

                <p className="text-slate-600 text-[10px] text-center">
                  By submitting you agree to our{' '}
                  <Link to="/privacy" className="text-slate-500 hover:text-slate-300 transition-colors">Privacy Policy</Link>.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}