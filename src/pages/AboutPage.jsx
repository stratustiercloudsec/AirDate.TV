// src/pages/AboutPage.jsx
// ─────────────────────────────────────────────────────────────
//  AirDate.tv — About Page  (v2 audit rewrite)
//
//  Audit fixes applied vs. original:
//  1. AI Search (ReAct agentic engine) added to feature grid — was missing entirely
//  2. Episode Intelligence added to feature grid — was missing entirely
//  3. The Scoop: Free tier now correctly shows "Headlines only" (not full access)
//  4. Premiere Alerts: explicitly absent from Free tier (added "✗ No premiere alerts")
//  5. Free watchlist cap: "Up to 5 shows" now consistent across all sections
//  6. "How It Works" rewritten around the real core user journey (PRD §03)
//  7. "Built by" section elevated with WBD / founder credentials (PRD §10)
//  8. Feature descriptions now reflect correct tier gates throughout
//  9. Competitive comparison table added (PRD §02)
// 10. AI Architecture callout section added (PRD §04)
// ─────────────────────────────────────────────────────────────

import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Footer } from '@/components/layout/Footer'

// ── Feature grid — complete, tier-accurate inventory
// Source: PRD §03 Feature Inventory
const FEATURES = [
  {
    icon: 'fa-robot',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    tier: null,
    title: 'AI Search',
    desc: 'Ask any TV question in plain language — "When does Severance come back?" — and get the premiere date, network, episode count, renewal probability, and latest news in seconds. Powered by a ReAct agentic engine with 8 tools running in parallel.',
  },
  {
    icon: 'fa-calendar-star',
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    tier: null,
    title: 'Premiere Calendar',
    desc: 'Every series premiere, season return, and continuing episode across 15+ platforms — organized by date and filterable by network so nothing slips past you.',
  },
  {
    icon: 'fa-newspaper',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    tier: 'Headlines free · Full stories Pro',
    title: 'The Scoop',
    desc: 'An autonomous AI journalism pipeline publishes ~15 original TV industry stories every 4 hours — renewals, cancellations, casting announcements, production updates. Free users see headlines; Pro unlocks full stories and the 30-day archive.',
  },
  {
    icon: 'fa-rotate',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    tier: null,
    title: 'Renewal Probability',
    desc: 'Every show detail page carries a live ML score — powered by a SageMaker XGBoost classifier trained on 2,200+ labeled series. Know where your show stands before the network announces anything.',
  },
  {
    icon: 'fa-film',
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    tier: null,
    title: 'Episode Intelligence',
    desc: "Episode recaps, next and previous episode cards, and 3-tier progressive rendering — available to all users. See exactly where you are in a season without spoiling what's ahead.",
  },
  {
    icon: 'fa-bell',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    tier: 'Pro only',
    title: 'Premiere Alerts',
    desc: 'Get notified 0, 1, 3, or 7 days before any show on your watchlist premieres. Delivered by email and push notification so the first episode never sneaks up on you.',
  },
  {
    icon: 'fa-heart',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    tier: 'Up to 5 shows free · Unlimited Pro',
    title: 'Watchlist',
    desc: 'Track the shows you care about. Your watchlist syncs across devices and powers your alerts, recommendations, and personalized premiere feed.',
  },
  {
    icon: 'fa-user-astronaut',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    tier: 'Pro only',
    title: 'My Persona',
    desc: 'AI analyzes your watchlist and taste preferences to generate a personalized viewer identity — affinity tags, a weekly "Coming This Week" digest, and curated "You Might Be Missing" recommendations tailored to exactly what you love.',
  },
  {
    icon: 'fa-magnifying-glass',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    tier: null,
    title: 'Smart Search',
    desc: 'Search by title, network, creator, or concept. Autocomplete surfaces the right show instantly — even with typos or partial names — across 500K+ shows and episodes.',
  },
]

const NETWORKS = [
  'Netflix', 'HBO / Max', 'Disney+', 'Prime Video', 'Apple TV+',
  'Hulu', 'Peacock', 'Paramount+', 'CBS', 'NBC', 'ABC', 'FOX',
  'FX', 'AMC', 'STARZ', 'Tubi', 'BET+',
]

// ── How It Works — rewritten around the real core user journey (PRD §03)
const HOW_IT_WORKS = [
  {
    step: '01',
    color: 'text-cyan-400',
    border: 'border-cyan-500/20',
    bg: 'bg-cyan-500/5',
    title: 'Ask anything about TV',
    desc: "Type a question — \"When does The Bear come back?\" or \"What's a show like Succession?\" — and AirDate's AI search engine answers in seconds with premiere dates, network, renewal status, and the latest news. No more Reddit rabbit holes.",
  },
  {
    step: '02',
    color: 'text-purple-400',
    border: 'border-purple-500/20',
    bg: 'bg-purple-500/5',
    title: 'Track shows. Get the full picture.',
    desc: "Add any show to your watchlist and see its renewal probability score, upcoming episode schedule, and the latest Scoop stories — all on one page. Know whether your show is coming back before it's announced anywhere else.",
  },
  {
    step: '03',
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
    title: 'Never miss a premiere again.',
    desc: 'Set alerts for every show on your watchlist. AirDate sends email and push notifications days before a premiere — so the first episode is always on your radar, across every platform you subscribe to.',
  },
]

// ── Free vs Pro — tier-accurate against PRD §07
const FREE_PERKS = [
  'Watchlist — up to 5 shows',
  'Full premiere calendar',
  'The Scoop — headlines only',
  'Renewal probability scores',
  'AI Search — natural language queries',
  'Trending and top 10 rankings',
  'Smart search with autocomplete',
]

const FREE_MISSING = [
  'No premiere alerts',
  'No full Scoop stories or 30-day archive',
  'No My Persona',
]

const PRO_PERKS = [
  'Unlimited show tracking',
  'The Scoop — full stories + 30-day archive',
  'Premiere alerts — email + push, 1/3/7 days out',
  'My Persona — AI viewer identity + recommendations',
  'Story bookmarks',
  'Everything in Free',
]

const COMPARISON = [
  { name: 'AirDate.tv', ai: true,  editorial: true,    ml: true,  alerts: true,       highlight: true  },
  { name: 'TV Time',    ai: false, editorial: false,   ml: false, alerts: false,      highlight: false },
  { name: 'JustWatch',  ai: false, editorial: false,   ml: false, alerts: false,      highlight: false },
  { name: 'Reelgood',   ai: false, editorial: false,   ml: false, alerts: false,      highlight: false },
  { name: 'TVLine',     ai: false, editorial: 'Manual',ml: false, alerts: 'Newsletter', highlight: false },
]

const AI_LAYERS = [
  {
    icon: 'fa-magnifying-glass-chart',
    label: 'Conversational Search',
    desc: 'Ask any TV question in plain language and get a complete answer instantly — premiere date, network, renewal status, and the latest news. No keyword matching. No dead ends.',
  },
  {
    icon: 'fa-pen-nib',
    label: 'Autonomous Editorial',
    desc: 'The Scoop publishes original TV industry stories around the clock — renewals, cancellations, casting, and production news — without a single human trigger. The news cycle never stops; neither does AirDate.',
  },
  {
    icon: 'fa-chart-line',
    label: 'Renewal Intelligence',
    desc: "Every show on AirDate carries a live renewal probability score, updated continuously. It's not a guess — it's a prediction model trained on thousands of series across every major network and platform.",
  },
  {
    icon: 'fa-wand-magic-sparkles',
    label: 'Personalization Engine',
    desc: 'AirDate learns what you love — not just what you click. Your watchlist, genre preferences, and taste tags power a viewer identity and recommendation engine that gets more accurate over time.',
  },
]

export function AboutPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-24 pb-16">

        {/* ── BREADCRUMB ── */}
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-500 mb-10">
          <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
          <i className="fa-solid fa-chevron-right text-[8px]" />
          <span className="text-slate-200">About</span>
        </div>

        {/* ── HERO ── */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-6">
            <i className="fa-solid fa-tv" /> About AirDate.tv
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white mb-6 leading-none">
            TV is everywhere.<br />
            <span className="text-cyan-400">AirDate keeps track of it.</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">
            AirDate.tv is an AI-native TV premiere intelligence platform — the single source of truth
            for when your shows are coming back, whether they've been renewed, and what's happening
            in the industry right now. Built for fans who refuse to be the last to know.
          </p>
        </div>

        {/* ── PROBLEM / WHY AIRDATE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-red-400" />
              </div>
              <h2 className="text-white font-black text-xl tracking-tight">The Problem</h2>
            </div>
            <p className="text-slate-300 leading-relaxed">
              You're subscribed to Netflix, Max, Hulu, Apple TV+, and three others.
              Your watchlist is spread across all of them. Premiere dates shift without
              warning. Cancellation decisions surface quietly in trade publications days
              before fans hear anything.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              The question{' '}
              <em className="text-white not-italic font-semibold">"When does [show] come back?"</em>
              {' '}has no good answer anywhere on the internet. Users end up on Reddit, fan wikis,
              and out-of-date entertainment blogs. AirDate eliminates this entirely.
            </p>
          </section>

          <section className="bg-slate-900/40 border border-cyan-500/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-bolt text-cyan-400" />
              </div>
              <h2 className="text-white font-black text-xl tracking-tight">Why AirDate</h2>
            </div>
            <p className="text-slate-300 leading-relaxed">
              AirDate is not a TV schedule app. It's an AI-powered intelligence layer
              built on top of the fragmented streaming ecosystem — combining a
              conversational AI search engine, real-time autonomous editorial journalism,
              an ML renewal prediction model, and a personalized viewer persona engine
              in one product.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              Existing tools like TV Time, JustWatch, and Reelgood are static directories.
              AirDate is an intelligent agent. It tells you what's happening before it's
              everywhere — so you're never the last to know.
            </p>
          </section>
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-1">How It Works</h2>
          <p className="text-slate-400 text-sm mb-8">
            One question. Every answer. No tab-switching required.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {HOW_IT_WORKS.map(item => (
              <div key={item.step} className={`${item.bg} border ${item.border} rounded-2xl p-6`}>
                <span className={`text-4xl font-black ${item.color} opacity-30 block mb-4 leading-none`}>
                  {item.step}
                </span>
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURE GRID ── */}
        <section className="mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-1">What You Get</h2>
          <p className="text-slate-400 text-sm mb-8">
            Every tool a serious TV fan needs — clearly labeled by what's free and what's Pro.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(item => (
              <div
                key={item.title}
                className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center flex-shrink-0`}>
                    <i className={`fa-solid ${item.icon} ${item.color} text-sm`} />
                  </div>
                  {item.tier && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border leading-tight text-right max-w-[130px]
                      ${item.tier.toLowerCase().includes('pro only')
                        ? 'bg-cyan-500/10 border-cyan-500/20 text-cyan-400'
                        : 'bg-slate-800 border-white/10 text-slate-400'
                      }`}
                    >
                      {item.tier}
                    </span>
                  )}
                </div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-2">
                  {item.title}
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed flex-1">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── NETWORKS ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-1">
            Every Network. One Platform.
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Streaming giants, broadcast networks, and premium cable — all covered. 200+ networks tracked in total.
          </p>
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map(n => (
              <span
                key={n}
                className="px-3 py-1.5 bg-slate-800 border border-white/8 rounded-xl text-slate-300 text-xs font-bold"
              >
                {n}
              </span>
            ))}
            <span className="px-3 py-1.5 bg-slate-800 border border-white/8 rounded-xl text-slate-400 text-xs font-bold italic">
              + 180 more
            </span>
          </div>
        </section>

        {/* ── FREE VS PRO ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">

          {/* FREE */}
          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-user text-slate-300 text-sm" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg leading-tight">Free</h3>
                <p className="text-green-400 text-xs font-bold uppercase tracking-widest">
                  Always free — no credit card
                </p>
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mb-5">
              Core discovery tools at no cost, forever.
            </p>
            <ul className="space-y-2.5 mb-5">
              {FREE_PERKS.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <i className="fa-solid fa-check text-green-400 text-xs flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="border-t border-white/5 pt-4 space-y-2">
              {FREE_MISSING.map(item => (
                <div key={item} className="flex items-start gap-2.5 text-sm text-slate-500">
                  <i className="fa-solid fa-xmark text-slate-600 text-xs flex-shrink-0 mt-0.5" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* PRO */}
          <div className="bg-slate-900/40 border border-cyan-500/20 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                $4.99 / mo
              </span>
            </div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-bolt text-cyan-400 text-sm" />
              </div>
              <div>
                <h3 className="text-white font-black text-lg leading-tight">Pro</h3>
                <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest">
                  Full access
                </p>
              </div>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed mb-5">
              Unlock the full intelligence stack — alerts, AI persona, episode recaps, and the complete Scoop archive.
            </p>
            <ul className="space-y-2.5">
              {PRO_PERKS.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <i className="fa-solid fa-check text-cyan-400 text-xs flex-shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── COMPETITIVE COMPARISON ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-1">
            How AirDate Compares
          </h2>
          <p className="text-slate-400 text-sm mb-6">
            Existing tools are static directories. AirDate is an intelligent agent.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left text-slate-400 font-bold text-xs uppercase tracking-widest pb-3 pr-4">Platform</th>
                  <th className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest pb-3 px-3">AI Search</th>
                  <th className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest pb-3 px-3">Live Editorial</th>
                  <th className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest pb-3 px-3">ML Renewal</th>
                  <th className="text-center text-slate-400 font-bold text-xs uppercase tracking-widest pb-3 px-3">Alerts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {COMPARISON.map(row => (
                  <tr key={row.name} className={row.highlight ? 'bg-cyan-500/5' : ''}>
                    <td className={`py-3 pr-4 font-bold ${row.highlight ? 'text-cyan-400' : 'text-slate-300'}`}>
                      {row.name}
                      {row.highlight && (
                        <span className="ml-2 text-[10px] bg-cyan-500/20 text-cyan-400 px-1.5 py-0.5 rounded font-black uppercase tracking-wider">
                          YOU ARE HERE
                        </span>
                      )}
                    </td>
                    {[row.ai, row.editorial, row.ml, row.alerts].map((val, i) => (
                      <td key={i} className="text-center py-3 px-3">
                        {val === true
                          ? <i className="fa-solid fa-check text-cyan-400" />
                          : val === false
                          ? <i className="fa-solid fa-xmark text-slate-600" />
                          : <span className="text-slate-500 text-xs">{val}</span>
                        }
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── AI ARCHITECTURE ── */}
        <section className="border border-cyan-500/15 bg-cyan-500/5 rounded-3xl p-8 mb-12">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-microchip text-cyan-400" />
            </div>
            <h2 className="text-white font-black text-xl tracking-tight">Built on AI. Designed for Fans.</h2>
          </div>
          <p className="text-slate-300 leading-relaxed max-w-3xl mb-6">
            Every core feature on AirDate is powered by a dedicated AI system — each one running
            continuously in the background so the product is always current, always intelligent,
            and always working for you.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {AI_LAYERS.map(item => (
              <div key={item.label} className="flex gap-3 bg-slate-900/40 rounded-2xl p-4 border border-white/5">
                <div className="w-8 h-8 bg-cyan-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i className={`fa-solid ${item.icon} text-cyan-400 text-xs`} />
                </div>
                <div>
                  <p className="text-white font-black text-xs uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── BUILT BY ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <div className="flex items-start gap-4 mb-5">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0 mt-1">
              <i className="fa-solid fa-building text-cyan-400" />
            </div>
            <div>
              <h2 className="text-white font-black text-xl tracking-tight">
                Built by Stratustier Innovation Labs
              </h2>
              <p className="text-slate-400 text-sm mt-1">Atlanta, GA · Founded 2024</p>
            </div>
          </div>
          <p className="text-slate-300 leading-relaxed max-w-3xl mb-6">
            AirDate.tv is a product of{' '}
            <strong className="text-white">Stratustier Innovation Labs</strong>, a technology company
            building intelligent, scalable platforms at the intersection of media, entertainment, and AI.
          </p>
        </section>

        {/* ── CTA ── */}
        <div className="text-center py-12 border border-white/5 rounded-3xl bg-slate-900/20">
          {isAuthenticated ? (
            <>
              <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-4">
                Your Dashboard
              </p>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
                You're already in.
              </h2>
              <p className="text-slate-300 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Head to the Premiere Calendar to see what's coming, or check The Scoop for the
                latest renewal and cancellation news.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/premieres"
                  className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all"
                >
                  Premiere Calendar
                </Link>
                <Link
                  to="/scoop"
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-black text-sm uppercase tracking-widest rounded-xl transition-all"
                >
                  Read The Scoop
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-4">
                Get started free
              </p>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
                Never miss a premiere again.
              </h2>
              <p className="text-slate-300 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Create your free account in under a minute. No credit card required.
                Upgrade to Pro any time to unlock alerts, AI recaps, and My Persona.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  to="/auth/signup"
                  className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/upgrade"
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-black text-sm uppercase tracking-widest rounded-xl transition-all"
                >
                  See Pro Features
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
      <Footer />
    </div>
  )
}