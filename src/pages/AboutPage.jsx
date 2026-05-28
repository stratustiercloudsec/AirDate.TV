// src/pages/AboutPage.jsx
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Footer } from '@/components/layout/Footer'

const FEATURES = [
  {
    icon: 'fa-calendar-star',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    title: 'Premiere Calendar',
    desc: 'Every series premiere, season return, and continuing episode across all major networks — organized by date so nothing slips past you.',
  },
  {
    icon: 'fa-newspaper',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    title: 'The Scoop',
    desc: 'Real-time TV industry intelligence — casting announcements, renewal decisions, cancellations, and production updates — surfaced before they trend.',
  },
  {
    icon: 'fa-rotate',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    title: 'Renewal Probability',
    desc: 'Know where your favorite show stands. AirDate scores renewal likelihood for hundreds of active series so you can stop refreshing social media for answers.',
  },
  {
    icon: 'fa-magnifying-glass',
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    title: 'Smart Search',
    desc: 'Search by title, network, creator, or concept. Autocomplete surfaces the right show instantly — even with typos or partial names.',
  },
  {
    icon: 'fa-bell',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    title: 'Premiere Alerts',
    desc: 'Set alerts at 0, 1, 3, or 7 days before a premiere. Get notified by email or push notification so the first episode never sneaks up on you.',
  },
  {
    icon: 'fa-heart',
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    title: 'Your Watchlist',
    desc: 'Track the shows you care about. Your watchlist syncs across devices and powers your alerts, recommendations, and personalized premiere feed.',
  },
]

const NETWORKS = [
  'Netflix', 'HBO / Max', 'Disney+', 'Prime Video', 'Apple TV+',
  'Hulu', 'Peacock', 'Paramount+', 'CBS', 'NBC', 'ABC', 'FOX',
  'FX', 'AMC', 'STARZ',
]

export function AboutPage() {
  const { isAuthenticated } = useAuth()

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-24 pb-16">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-200 mb-10">
          <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
          <i className="fa-solid fa-chevron-right text-[8px]"/>
          <span>About</span>
        </div>

        {/* ── HERO ── */}
        <div className="mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-6">
            <i className="fa-solid fa-tv"/> About AirDate
          </div>
          <h1 className="text-4xl sm:text-6xl font-black tracking-tighter text-white mb-6 leading-none">
            Know Before<br/>
            <span className="text-cyan-400">Everyone Else Does.</span>
          </h1>
          <p className="text-slate-300 text-lg leading-relaxed max-w-2xl">
            AirDate is the TV premiere intelligence platform built for fans who refuse to be late. We track premiere dates, monitor industry news, and surface what's happening in television — before it reaches your social feed.
          </p>
        </div>

        {/* ── STORY ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
          <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-triangle-exclamation text-red-400"/>
              </div>
              <h2 className="text-white font-black text-xl tracking-tight">The Problem</h2>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Television has never been more fragmented. Premiere dates shift without warning. Renewal decisions surface quietly in trade publications days before fans hear anything. Streaming platforms bury new content behind recommendation algorithms built to keep you watching what you've already seen.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              Dedicated TV fans deserve better than manually checking network websites, setting calendar reminders, and hoping an algorithm eventually surfaces something new.
            </p>
          </section>

          <section className="bg-slate-900/40 border border-cyan-500/10 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-bolt text-cyan-400"/>
              </div>
              <h2 className="text-white font-black text-xl tracking-tight">Why AirDate</h2>
            </div>
            <p className="text-slate-300 leading-relaxed">
              AirDate consolidates everything a TV fan needs into one place. Premiere dates. Episode schedules. Industry news. Renewal status. Personalized alerts. All updated continuously — not weekly, not manually, not buried behind an algorithm.
            </p>
            <p className="text-slate-300 leading-relaxed mt-4">
              We built the platform we always wished existed. The one that tells you what's coming before it's everywhere — so you can be the one who already knew.
            </p>
          </section>
        </div>

        {/* ── HOW IT WORKS ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-2">How It Works</h2>
          <p className="text-slate-200 text-sm mb-8">Three steps. Zero friction.</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                color: 'text-cyan-400',
                border: 'border-cyan-500/20',
                bg: 'bg-cyan-500/5',
                title: 'Track Your Shows',
                desc: "Search across hundreds of thousands of titles and add anything to your watchlist. AirDate keeps watch on everything you care about so you don't have to.",
              },
              {
                step: '02',
                color: 'text-purple-400',
                border: 'border-purple-500/20',
                bg: 'bg-purple-500/5',
                title: 'Stay Informed',
                desc: 'The Scoop delivers breaking TV industry news around the clock. Renewal decisions, casting announcements, production updates — right when they matter.',
              },
              {
                step: '03',
                color: 'text-amber-400',
                border: 'border-amber-500/20',
                bg: 'bg-amber-500/5',
                title: 'Never Miss a Premiere',
                desc: 'Configure alerts for every show on your watchlist. Get notified days in advance — or the morning of — so the first episode is always on your radar.',
              },
            ].map(item => (
              <div key={item.step} className={`${item.bg} border ${item.border} rounded-2xl p-6`}>
                <span className={`text-4xl font-black ${item.color} opacity-30 block mb-4 leading-none`}>
                  {item.step}
                </span>
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-2">{item.title}</h3>
                <p className="text-slate-200 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-2">What You Get</h2>
          <p className="text-slate-200 text-sm mb-8">Everything a serious TV fan needs. Nothing you don't.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(item => (
              <div key={item.title}
                className="bg-slate-900/40 border border-white/5 rounded-2xl p-6 hover:border-white/10 transition-all">
                <div className={`w-9 h-9 ${item.bg} rounded-xl flex items-center justify-center mb-4`}>
                  <i className={`fa-solid ${item.icon} ${item.color} text-sm`}/>
                </div>
                <h3 className="text-white font-black text-sm uppercase tracking-widest mb-2">{item.title}</h3>
                <p className="text-slate-200 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── NETWORKS ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <h2 className="text-white font-black text-2xl tracking-tight mb-2">Every Network. One Platform.</h2>
          <p className="text-slate-200 text-sm mb-6">
            Streaming giants, broadcast networks, and premium cable — all covered, all in one place.
          </p>
          <div className="flex flex-wrap gap-2">
            {NETWORKS.map(n => (
              <span key={n}
                className="px-3 py-1.5 bg-slate-800 border border-white/8 rounded-xl text-slate-300 text-xs font-bold">
                {n}
              </span>
            ))}
            <span className="px-3 py-1.5 bg-slate-800 border border-white/8 rounded-xl text-slate-200 text-xs font-bold italic">
              + many more
            </span>
          </div>
        </section>

        {/* ── FREE VS PRO ── */}
        <section className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-user text-slate-200 text-sm"/>
              </div>
              <div>
                <h3 className="text-white font-black text-lg">Free</h3>
                <p className="text-slate-200 text-xs font-bold uppercase tracking-widest">Always free</p>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                'Track up to 5 shows',
                'Full premiere calendar',
                'The Scoop — industry news feed',
                'Trending and top 10 rankings',
                'Smart search with autocomplete',
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <i className="fa-solid fa-check text-slate-200 text-xs flex-shrink-0"/>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-slate-900/40 border border-cyan-500/20 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-4 right-4">
              <span className="px-2.5 py-1 bg-cyan-500/20 border border-cyan-500/30 text-cyan-400 text-[10px] font-black uppercase tracking-widest rounded-full">
                $4.99 / mo
              </span>
            </div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <i className="fa-solid fa-bolt text-cyan-400 text-sm"/>
              </div>
              <div>
                <h3 className="text-white font-black text-lg">Pro</h3>
                <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Full access</p>
              </div>
            </div>
            <ul className="space-y-3">
              {[
                'Unlimited show tracking',
                'Early premiere alerts — 1, 3, or 7 days out',
                'Email and push notifications',
                'Renewal probability scores',
                'Priority access to new features',
                'Everything in Free',
              ].map(item => (
                <li key={item} className="flex items-center gap-2.5 text-sm text-slate-300">
                  <i className="fa-solid fa-check text-cyan-400 text-xs flex-shrink-0"/>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ── BUILT BY ── */}
        <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 mb-12">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <i className="fa-solid fa-building text-cyan-400"/>
            </div>
            <h2 className="text-white font-black text-xl tracking-tight">Built by Stratustier Innovation Labs</h2>
          </div>
          <p className="text-slate-300 leading-relaxed max-w-3xl">
            AirDate is a product of <strong className="text-white">Stratustier Innovation Labs</strong>, a technology company focused on building intelligent, scalable platforms at the intersection of media, entertainment, and AI. Our philosophy is simple: the best products get out of the way and just work.
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
              <p className="text-slate-200 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Head to My Pulse to manage your watchlist, set alert preferences, and never miss another premiere.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/pulse"
                  className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all">
                  Go to My Pulse
                </Link>
                <Link to="/"
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-black text-sm uppercase tracking-widest rounded-xl transition-all">
                  Explore AirDate
                </Link>
              </div>
            </>
          ) : (
            <>
              <p className="text-cyan-400 text-xs font-black uppercase tracking-[0.2em] mb-4">
                Get started free
              </p>
              <h2 className="text-2xl sm:text-4xl font-black text-white tracking-tight mb-3">
                Ready to never miss a premiere?
              </h2>
              <p className="text-slate-200 text-sm mb-8 max-w-sm mx-auto leading-relaxed">
                Create your free account in under a minute. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth/signup"
                  className="w-full sm:w-auto px-8 py-3.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-sm uppercase tracking-widest rounded-xl transition-all">
                  Create Free Account
                </Link>
                <Link to="/"
                  className="w-full sm:w-auto px-8 py-3.5 bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-200 font-black text-sm uppercase tracking-widest rounded-xl transition-all">
                  Explore AirDate
                </Link>
              </div>
            </>
          )}
        </div>

      </div>
      <Footer/>
    </div>
  )
}