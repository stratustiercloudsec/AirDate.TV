// src/pages/PrivacyPage.jsx — v3 plain language, no vendor/infra references
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

const SECTIONS = [
  {
    icon: 'fa-user-check', color: 'text-cyan-400', bg: 'bg-cyan-500/10', span: 1,
    title: 'Account & Identity',
    body: (
      <>
        When you create an AirDate account, we collect your email address and a securely hashed password. We never store plaintext passwords, and your credentials are used solely for authentication, watchlist sync, and delivering notifications you've requested.
      </>
    ),
  },
  {
    icon: 'fa-heart', color: 'text-pink-400', bg: 'bg-pink-500/10', span: 1,
    title: 'Watchlist & Personalization',
    body: (
      <>
        Your watchlist, viewing history, and preferences are stored securely on our servers under your account ID. This enables your Pulse to sync across devices and powers personalized show recommendations. You may request full deletion of your account and all associated data at any time by contacting <strong className="text-white">support@airdate.tv</strong>.
      </>
    ),
  },
  {
    icon: 'fa-bell', color: 'text-amber-400', bg: 'bg-amber-500/10', span: 1,
    title: 'Notifications',
    body: (
      <>
        If you enable premiere alerts, your email address is used to deliver those notifications. Web push notifications are handled directly between your browser and our servers — no third-party push service is involved. You can unsubscribe from all alerts at any time from your account settings.
      </>
    ),
  },
  {
    icon: 'fa-credit-card', color: 'text-green-400', bg: 'bg-green-500/10', span: 1,
    title: 'Payments & Billing',
    body: (
      <>
        Pro tier subscriptions are processed by <strong className="text-white">Stripe</strong>, a PCI-compliant payment provider. AirDate never sees, stores, or has access to your credit card number or payment details. Only your subscription status is retained on our end — solely to unlock Pro features.
      </>
    ),
  },
  {
    icon: 'fa-pen-nib', color: 'text-purple-400', bg: 'bg-purple-500/10', span: 1,
    title: 'Editorial Content',
    body: (
      <>
        The Scoop is AirDate's original editorial vertical — covering premieres, renewals, cancellations, casting, and production news across the TV landscape. Stories are researched and written by the AirDate editorial team using a combination of licensed trade sources, network announcements, and industry intelligence. Editorial content is published for informational purposes and does not reflect user-specific data.
      </>
    ),
  },
  {
    icon: 'fa-chart-line', color: 'text-orange-400', bg: 'bg-orange-500/10', span: 1,
    title: 'Hype Telemetry',
    body: (
      <>
        To power the <strong className="text-white">Global Hype Ranking</strong>, AirDate tracks anonymized show interaction signals — including search frequency, watchlist additions, and detail page visits. This data is aggregated by show only, never linked to individual accounts, and used solely to calculate community interest scores.
      </>
    ),
  },
  {
    icon: 'fa-database', color: 'text-slate-300', bg: 'bg-slate-700/60', span: 2,
    title: 'Data Retention & Third-Party Attribution',
    body: (
      <>
        Account data is retained for the lifetime of your account. Anonymized telemetry is retained for 90 days on a rolling basis. Show metadata, imagery, and plot summaries are sourced from <strong className="text-white">TMDB</strong> and remain the property of their respective rights holders — AirDate is not endorsed or certified by TMDB. Real-time news signals are aggregated from licensed third-party sources — no user data is shared with these services. All data is processed and stored in the United States.
      </>
    ),
  },
]

export function PrivacyPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">
        <div className="max-w-6xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">
            <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
            <i className="fa-solid fa-chevron-right text-[8px]"></i>
            <span className="text-slate-400">Privacy Policy</span>
          </div>
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-5">
              <i className="fa-solid fa-shield"></i> Privacy Policy
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3">What We Collect.<br />Why We Collect It.</h1>
            <p className="text-slate-200 text-lg leading-relaxed">
              We collect what we need to deliver a personalized TV intelligence experience — and nothing more. Last updated: April 2026.
            </p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-slate-200 leading-relaxed text-base">
            {SECTIONS.map(s => (
              <section key={s.title} className={`bg-slate-900/40 border border-white/5 rounded-3xl p-8 ${s.span === 2 ? 'lg:col-span-2' : ''}`}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-9 h-9 ${s.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${s.icon} ${s.color} text-sm`}></i>
                  </div>
                  <h2 className="text-white font-black text-xl tracking-tight">{s.title}</h2>
                </div>
                <p>{s.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}