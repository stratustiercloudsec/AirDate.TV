// src/pages/UpdatePage.jsx
// Port of upgrade.html — Stripe checkout, FAQ accordion, Pro detection
import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth }   from '@/context/AuthContext'
import { API_BASE }  from '@/config/aws'
import { AWS_CONFIG } from '@/config/aws'
import { Footer }    from '@/components/layout/Footer'

// ── Stripe price IDs ──────────────────────────────────────────────────────────
const PRICE_MONTHLY = AWS_CONFIG.stripe?.priceIdMonthly ?? ''
const PRICE_ANNUAL  = AWS_CONFIG.stripe?.priceIdAnnual  ?? ''

// ── FAQ data ──────────────────────────────────────────────────────────────────
const FAQS = [
  { q: 'Can I cancel anytime?', a: <>Yes — cancel any time from your account settings or at <a href="mailto:operations@stratustierlabs.com" className="text-cyan-400 hover:underline">operations@stratustierlabs.com</a>. Pro access continues until the end of your billing period. No cancellation fees, ever.</> },
  { q: 'When am I billed?', a: 'Monthly plans are billed every 30 days. Annual plans are billed once upfront at $49.90. All billing is handled securely through Stripe — AirDate never stores your payment details.' },
  { q: 'What happens to my watchlist if I downgrade?', a: 'Your watchlist data is never deleted. You can still view all tracked shows, but you won\'t be able to add new ones beyond the 5-show free limit until you re-upgrade.' },
  { q: "What's included in Full Scoop access?", a: "The Scoop pulls renewal announcements, cancellations, casting news, and production updates from Variety, Deadline, THR, TVLine, and more. Pro members get full unlimited access to every story as it drops." },
  { q: 'Is there a free trial?', a: "AirDate's Free plan gives you full access to the core platform with no time limit — it's a genuine free tier, not a trial. Upgrade to Pro whenever you need unlimited tracking and The Scoop." },
  { q: 'Can I switch between monthly and annual?', a: <>Yes. Switch from monthly to annual at any time — the annual plan starts at your next billing cycle. Contact <a href="mailto:operations@stratustierlabs.com" className="text-cyan-400 hover:underline">operations@stratustierlabs.com</a> for assistance.</> },
  { q: 'Is my payment information secure?', a: 'All payments are processed by Stripe, a PCI-DSS Level 1 certified payment provider. AirDate never sees or stores your credit card details.' },
]

const FREE_FEATURES = [
  { text: 'Track up to 5 shows',    included: true },
  { text: 'Premiere calendar',       included: true },
  { text: 'Trending & Top 10',       included: true },
  { text: 'Unlimited watchlist',     included: false },
  { text: 'Early premiere alerts',   included: false },
  { text: 'Full Scoop access',       included: false },
]

const PRO_FEATURES = [
  'Unlimited watchlist',
  'Early premiere alerts',
  'Full Scoop access',
  'Premiere calendar',
  'Trending & Top 10',
  'show recaps',
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-6 py-5 text-left">
        <span className="text-white font-bold text-sm">{q}</span>
        <i className={`fa-solid fa-plus text-slate-400 text-sm flex-shrink-0 ml-4 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}></i>
      </button>
      {open && (
        <div className="px-6 pb-5">
          <p className="text-slate-200 text-sm leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

export function UpdatePage() {
  const { token, user, isPremium, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  const [loadingMonthly, setLoadingMonthly] = useState(false)
  const [loadingAnnual,  setLoadingAnnual]  = useState(false)
  const [alreadyPro,     setAlreadyPro]     = useState(false)

  // Check Pro status on mount
  useEffect(() => {
    if (isPremium) setAlreadyPro(true)
  }, [isPremium])

  async function startCheckout(cycle) {
    console.log('=== CHECKOUT DEBUG ===')
    console.log('isAuthenticated:', isAuthenticated)
    console.log('token:', token ? token.substring(0, 20) + '...' : 'NULL')
    console.log('PRICE_MONTHLY:', PRICE_MONTHLY)
    console.log('PRICE_ANNUAL:', PRICE_ANNUAL)
    console.log('API_BASE:', API_BASE)
    if (!isAuthenticated) { navigate('/login'); return }

    const isAnnual = cycle === 'annual'
    if (isAnnual) setLoadingAnnual(true); else setLoadingMonthly(true)

    try {
      const priceId = isAnnual ? PRICE_ANNUAL : PRICE_MONTHLY
      const res  = await fetch(`${AWS_CONFIG.apiGateway.checkoutUrl}/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ priceId }),
      })
      const data = await res.json()

      if (data.already_subscribed) { setAlreadyPro(true); return }
      if (data.url) { window.location.href = data.url }
      else throw new Error(data.error ?? 'No checkout URL returned')
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoadingMonthly(false)
      setLoadingAnnual(false)
    }
  }

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">

      {/* Hero */}
      <div className="max-w-5xl mx-auto px-4 pt-28 pb-12 text-center">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-6">
          <i className="fa-solid fa-bolt text-cyan-400 text-xs"></i>
          <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Upgrade Your Intelligence</span>
        </div>
        <h1 className="text-5xl font-black text-white mb-4 leading-tight">
          Track TV Like a<br /><span className="text-cyan-400">Pro</span>
        </h1>
        <p className="text-slate-200 text-lg max-w-xl mx-auto">
          Unlimited watchlist, early premiere alerts, and full access to The Scoop — AirDate's live industry intelligence feed.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="max-w-4xl mx-auto px-4 pb-20">

        {/* Already Pro banner */}
        {alreadyPro && (
          <div className="mb-6 flex items-center gap-3 px-6 py-4 bg-green-500/10 border border-green-500/30 rounded-2xl">
            <i className="fa-solid fa-circle-check text-green-400 text-xl flex-shrink-0"></i>
            <div className="flex-1">
              <p className="text-green-400 font-black text-sm uppercase tracking-widest">You're Already on Pro</p>
              <p className="text-slate-200 text-xs mt-0.5">Your subscription is active. All Pro features are unlocked.</p>
            </div>
            <Link to="/account" className="flex-shrink-0 px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-xl text-green-400 text-xs font-black uppercase tracking-widest hover:bg-green-500/30 transition-all">
              My Account
            </Link>
          </div>
        )}

        <div className="grid md:grid-cols-3 gap-6 pt-6">

          {/* Free */}
          <div className="bg-slate-900/60 border border-white/10 rounded-3xl p-6">
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">Free</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-white">$0</span>
                <span className="text-slate-400 text-sm mb-1">/month</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">No credit card required</p>
            </div>
            <ul className="space-y-3 mb-8">
              {FREE_FEATURES.map(f => (
                <li key={f.text} className={`flex items-center gap-3 text-sm ${f.included ? 'text-slate-200' : 'text-slate-500 line-through'}`}>
                  <i className={`fa-solid ${f.included ? 'fa-check text-slate-400' : 'fa-xmark text-slate-600'} w-4`}></i>
                  {f.text}
                </li>
              ))}
            </ul>
            <div className="w-full h-12 bg-slate-800 border border-white/10 rounded-xl flex items-center justify-center text-xs font-bold uppercase tracking-widest text-slate-400">
              Current Plan
            </div>
          </div>

          {/* Pro Monthly */}
          <div className="relative bg-slate-900 border border-cyan-500/40 rounded-3xl p-6 pt-8" style={{ boxShadow: '0 0 40px rgba(34,211,238,0.15)' }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="bg-cyan-500 text-slate-950 text-xs font-black uppercase tracking-widest px-4 py-1 rounded-full">Most Popular</span>
            </div>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-cyan-400 mb-2">Pro · Monthly</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-white">$4.99</span>
                <span className="text-slate-400 text-sm mb-1">/month</span>
              </div>
              <p className="text-slate-400 text-xs mt-1">Billed monthly · Cancel anytime</p>
            </div>
            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-white">
                  <i className="fa-solid fa-check text-cyan-400 w-4"></i>
                  {f === 'Unlimited watchlist' ? <><strong>Unlimited</strong>&nbsp;watchlist</> : f}
                </li>
              ))}
            </ul>
            <button onClick={() => startCheckout('monthly')} disabled={loadingMonthly || alreadyPro}
              className={`w-full h-12 font-black rounded-xl uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2
                ${alreadyPro
                  ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                  : 'text-slate-950 hover:brightness-110 disabled:opacity-60'}`}
              style={!alreadyPro ? { background: 'linear-gradient(135deg, #0e7490 0%, #0891b2 50%, #06b6d4 100%)' } : {}}>
              {alreadyPro
                ? <><i className="fa-solid fa-check"></i> You're on Pro</>
                : loadingMonthly
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Loading...</>
                  : <><i className="fa-solid fa-bolt"></i> Upgrade Monthly</>
              }
            </button>
          </div>

          {/* Pro Annual */}
          <div className="relative bg-slate-900 border border-violet-500/40 rounded-3xl p-6 pt-8" style={{ boxShadow: '0 0 40px rgba(139,92,246,0.15)' }}>
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
              <span className="bg-violet-500 text-white text-xs font-black uppercase tracking-widest px-4 py-1 rounded-full">Best Value</span>
            </div>
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">Pro · Annual</p>
              <div className="flex items-end gap-1">
                <span className="text-4xl font-black text-white">$4.16</span>
                <span className="text-slate-400 text-sm mb-1">/month</span>
              </div>
              <p className="text-green-400 text-xs font-bold mt-1">Billed $49.90/year — save $9.98</p>
            </div>
            <ul className="space-y-3 mb-8">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-3 text-sm text-white">
                  <i className="fa-solid fa-check text-violet-400 w-4"></i>
                  {f === 'Unlimited watchlist' ? <><strong>Unlimited</strong>&nbsp;watchlist</> : f}
                </li>
              ))}
            </ul>
            <button onClick={() => startCheckout('annual')} disabled={loadingAnnual || alreadyPro}
              className={`w-full h-12 font-black rounded-xl uppercase text-xs tracking-widest transition-all flex items-center justify-center gap-2
                ${alreadyPro
                  ? 'bg-green-500/20 border border-green-500/30 text-green-400 cursor-default'
                  : 'text-white hover:brightness-110 disabled:opacity-60'}`}
              style={!alreadyPro ? { background: 'linear-gradient(135deg, #5b21b6 0%, #7c3aed 50%, #8b5cf6 100%)' } : {}}>
              {alreadyPro
                ? <><i className="fa-solid fa-check"></i> You're on Pro</>
                : loadingAnnual
                  ? <><i className="fa-solid fa-spinner fa-spin"></i> Loading...</>
                  : <><i className="fa-solid fa-calendar-check"></i> Upgrade Annual</>
              }
            </button>
          </div>

        </div>

        {/* Trust signals */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 text-slate-400 text-sm">
          <span className="flex items-center gap-2"><i className="fa-solid fa-lock text-slate-400"></i> Secured by Stripe</span>
          <span className="flex items-center gap-2"><i className="fa-solid fa-rotate-left text-slate-400"></i> Cancel anytime</span>
          <span className="flex items-center gap-2"><i className="fa-solid fa-shield text-slate-400"></i> No hidden fees</span>
        </div>

        {/* FAQ */}
        <div className="mt-20">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-black text-white mb-3">Frequently Asked Questions</h2>
            <p className="text-slate-400 text-sm max-w-lg mx-auto">Everything you need to know about AirDate Pro.</p>
          </div>
          <div className="max-w-2xl mx-auto space-y-3">
            {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
        </div>

        {/* Still have questions */}
        <div className="mt-10 text-center p-8 bg-slate-900/40 border border-white/10 rounded-3xl max-w-2xl mx-auto">
          <i className="fa-solid fa-envelope text-cyan-400 text-2xl mb-3 block"></i>
          <h3 className="text-white font-black text-lg mb-2">Still have questions?</h3>
          <p className="text-slate-400 text-sm mb-4">Our team is happy to help with anything not covered above.</p>
          <Link to="/contact" className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-black uppercase tracking-widest hover:bg-cyan-500/30 transition-all">
            <i className="fa-solid fa-envelope"></i> Contact Us
          </Link>
        </div>

      </div>
      <Footer />
    </div>
  )
}
