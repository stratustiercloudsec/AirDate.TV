// src/pages/TermsPage.jsx — v3 plain language, no vendor/infra references
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

const TERMS = [
  {
    title: '1. Platform Overview',
    body: 'AirDate provides TV premiere intelligence by combining authoritative show metadata with real-time industry signals. All premiere dates, renewal probabilities, and episode data are informational. AirDate is an independent intelligence platform — not affiliated with any network, studio, or streaming service.',
  },
  {
    title: '2. Free & Pro Tiers',
    body: 'Free accounts may track up to 5 shows in their Pulse watchlist. Pro subscribers receive unlimited tracking, advanced notification controls, and access to ML-powered renewal intelligence. Subscriptions are billed monthly via Stripe and may be cancelled at any time. Cancellation takes effect at the end of the current billing period.',
  },
  {
    title: '3. Editorial & Intelligence Content',
    body: 'The Scoop stories, episode recaps, and show intelligence briefings are produced by the AirDate editorial team using licensed trade sources and industry data. AirDate does not guarantee the absolute accuracy of all published content. These outputs are for informational and entertainment purposes only and should not be treated as authoritative production records.',
  },
  {
    title: '4. Notifications & Communications',
    body: 'By enabling premiere alerts, you consent to receive email and/or browser push notifications from AirDate. You may disable all notifications at any time from your account settings. AirDate does not send marketing emails or share your contact information with third parties.',
  },
  {
    title: '5. Platform Integrity',
    body: 'The proprietary systems powering AirDate\'s intelligence engine, renewal classifier, hype ranking, and search are the intellectual property of Stratustier Innovation Labs. Users are prohibited from reverse-engineering, scraping, or programmatically abusing any AirDate endpoint. Violations may result in immediate account termination.',
  },
  {
    title: '6. Limitation of Liability',
    body: 'AirDate is provided "as is" without warranty of any kind. Stratustier Innovation Labs is not liable for premiere date changes, renewal decision inaccuracies, notification delivery failures, or any reliance on editorial content. Streaming availability data is sourced from third-party providers and may not reflect real-time changes.',
  },
  {
    title: '7. Third-Party Services',
    body: 'AirDate integrates with TMDB for show metadata and Stripe for payment processing. Each service operates under its own terms and privacy policy. AirDate is not endorsed or certified by TMDB. All show metadata, imagery, and plot summaries remain the property of their respective rights holders.',
  },
  {
    title: '8. Account Termination & Data',
    body: 'You may delete your AirDate account at any time by contacting support@airdate.tv. Upon deletion, your credentials, watchlist, and preference data will be permanently removed within 30 days. Anonymized, non-identifiable telemetry data may be retained for platform analytics per our Privacy Policy.',
  },
]

export function TermsPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">
        <div className="max-w-6xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">
            <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
            <i className="fa-solid fa-chevron-right text-[8px]"></i>
            <span className="text-slate-400">Terms of Service</span>
          </div>
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-5">
              <i className="fa-solid fa-file-lines"></i> Terms of Service
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3 italic">Platform Terms.</h1>
            <p className="text-slate-200 text-lg leading-relaxed">Usage terms for AirDate's intelligence platform, Pro subscription, and editorial content. Last updated: April 2026.</p>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-slate-200 leading-relaxed text-base">
            {TERMS.map(t => (
              <section key={t.title} className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 flex flex-col">
                <h2 className="text-white font-black text-lg tracking-tight mb-3">{t.title}</h2>
                <p>{t.body}</p>
              </section>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}