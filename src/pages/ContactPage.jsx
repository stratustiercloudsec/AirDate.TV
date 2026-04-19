// src/pages/ContactPage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'
import { API_BASE } from '@/config/aws'

export function ContactPage() {
  const [form, setForm]       = useState({ name: '', email: '', type: 'general', message: '' })
  const [submitting, setSub]  = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')

  function handleChange(e) {
    setForm(f => ({ ...f, [e.target.id.replace('form-', '')]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSub(true)
    setError('')
    try {
      await fetch(`${API_BASE}/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      setSuccess(true)
    } catch {
      setError('Failed to send. Please email operations@stratustierlabs.com directly.')
    } finally {
      setSub(false)
    }
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-32 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">

          {/* Left */}
          <div className="lg:col-span-5">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">
              <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
              <i className="fa-solid fa-chevron-right text-[8px]"></i>
              <span>Contact</span>
            </div>
            <div className="mb-12">
              <h1 className="text-5xl font-black tracking-tighter text-white mb-6 italic">Connect with the Signal.</h1>
              <p className="text-slate-200 text-lg leading-relaxed mb-8">
                Whether you're a viewer tracking your "Pulse," a network seeking metadata harmonization, or a platform interested in our RAG architecture—we're listening.
              </p>
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center text-cyan-400 flex-shrink-0">
                    <i className="fa-solid fa-envelope"></i>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-wider">General Inquiries</h4>
                    <p className="text-slate-200 text-sm">operations@stratustierlabs.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-400 flex-shrink-0">
                    <i className="fa-solid fa-code-branch"></i>
                  </div>
                  <div>
                    <h4 className="text-white font-bold text-sm uppercase tracking-wider">Technical & API</h4>
                    <p className="text-slate-200 text-sm">operations@stratustierlabs.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right — Form */}
          <div className="lg:col-span-7">
            {success ? (
              <div className="bg-slate-900/40 border border-green-500/20 rounded-3xl p-10 text-center">
                <i className="fa-solid fa-circle-check text-green-400 text-4xl mb-4"></i>
                <h2 className="text-white font-black text-2xl mb-2">Transmission Sent</h2>
                <p className="text-slate-200 text-sm">We'll be in touch at {form.email}.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 md:p-10 backdrop-blur-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-2">
                    <label htmlFor="form-name" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Identity</label>
                    <input id="form-name" type="text" placeholder="Your Name" required value={form.name} onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="form-email" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Endpoint</label>
                    <input id="form-email" type="email" placeholder="email@address.com" required value={form.email} onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors" />
                  </div>
                </div>
                <div className="space-y-2 mb-6">
                  <label htmlFor="form-type" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Signal Type</label>
                  <div className="relative">
                    <select id="form-type" value={form.type} onChange={handleChange}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors appearance-none cursor-pointer">
                      <option value="general">General Inquiry</option>
                      <option value="b2b">Metadata Partnership (B2B)</option>
                      <option value="support">Account Support / My Pulse</option>
                      <option value="press">Press & Trade Intelligence</option>
                      <option value="error">Report Data Latency / Error</option>
                    </select>
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-400 text-[8px]">
                      <i className="fa-solid fa-chevron-down"></i>
                    </div>
                  </div>
                </div>
                <div className="space-y-2 mb-8">
                  <label htmlFor="form-message" className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">Transmission</label>
                  <textarea id="form-message" rows="5" placeholder="Your message..." required value={form.message} onChange={handleChange}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-cyan-500/50 transition-colors resize-none" />
                </div>
                {error && <p className="text-red-400 text-xs mb-4">{error}</p>}
                <button type="submit" disabled={submitting}
                  className="w-full py-4 bg-cyan-500 text-slate-950 font-black uppercase tracking-[0.3em] text-[11px] rounded-xl hover:bg-cyan-400 transition-all shadow-lg shadow-cyan-500/20 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60">
                  {submitting
                    ? <><i className="fa-solid fa-spinner fa-spin"></i> Sending...</>
                    : <><span>Push to AirDate</span><i className="fa-solid fa-paper-plane"></i></>
                  }
                </button>
              </form>
            )}
          </div>

        </div>
      </div>
      <Footer />
    </div>
  )
}
