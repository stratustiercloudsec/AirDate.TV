// src/pages/VisionPage.jsx -- v2
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

export function VisionPage() {
  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="w-full max-w-[1600px] mx-auto px-6 pt-24 pb-16">
        <div className="max-w-6xl">

          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400 mb-8">
            <Link to="/" className="hover:text-slate-200 transition-colors">Home</Link>
            <i className="fa-solid fa-chevron-right text-[8px]"></i>
            <span className="text-slate-400">Vision</span>
          </div>

          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-widest mb-5">
              <i className="fa-solid fa-rocket"></i> Our Vision
            </div>
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3 italic">Track Before They Trend.</h1>
            <p className="text-slate-200 text-lg leading-relaxed">
              AirDate is the only TV intelligence platform built for what you are waiting for.
            </p>
          </div>

          <div className="space-y-10 text-slate-200 leading-relaxed text-base">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-triangle-exclamation text-red-400 text-sm"></i>
                  </div>
                  <h2 className="text-white font-black text-xl tracking-tight">The Problem</h2>
                </div>
                <p>The streaming era has fractured discovery. Premiere dates shift without warning. Renewal decisions break in trade publications before fans hear about them. Recommendation engines optimize for what you have already seen, leaving the most anticipated shows invisible until it is too late to build genuine excitement.</p>
              </section>
              <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-signal text-cyan-400 text-sm"></i>
                  </div>
                  <h2 className="text-white font-black text-xl tracking-tight">The Platform</h2>
                </div>
                <p>AirDate is a <strong className="text-white">next-generation TV intelligence platform</strong> that harmonizes authoritative metadata with live industry signals. We deliver premiere intelligence, renewal probability, episode context, and personalized recommendations before the rest of the internet catches on.</p>
              </section>
            </div>

            <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
              <h2 className="text-white font-black text-xl tracking-tight mb-6">Core Intelligence Systems</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {[
                  { icon:'fa-brain',           color:'text-purple-400', bg:'bg-purple-500/10', title:'Multi-Source Intelligence',  desc:'A parallel intelligence engine synthesizes live show data from multiple trade and industry sources in real time.' },
                  { icon:'fa-chart-line',       color:'text-pink-400',   bg:'bg-pink-500/10',   title:'Global Hype Ranking',        desc:'Real tracking counts aggregated across the AirDate user base, weighted by velocity and recency.' },
                  { icon:'fa-rotate',           color:'text-green-400',  bg:'bg-green-500/10',  title:'ML Renewal Probability',     desc:'A machine learning classifier scores renewal likelihood for 270+ shows, refreshed on a rolling schedule.' },
                  { icon:'fa-clapperboard',     color:'text-cyan-400',   bg:'bg-cyan-500/10',   title:'Episode Intelligence',       desc:'Timezone-aware episode tracking with editorial recaps and contextual previews for upcoming episodes.' },
                  { icon:'fa-bell',             color:'text-amber-400',  bg:'bg-amber-500/10',  title:'Premiere Alerts',            desc:'Configurable alerts at 0, 1, 3, and 7 days before a premiere via email and web push.' },
                  { icon:'fa-magnifying-glass', color:'text-orange-400', bg:'bg-orange-500/10', title:'Smart Search',               desc:'Intelligent search with autocomplete surfaces the right show even with typos or partial titles.' },
                ].map(item => (
                  <div key={item.title} className="bg-slate-800/40 rounded-2xl p-5 border border-white/5">
                    <div className={`w-8 h-8 ${item.bg} rounded-lg flex items-center justify-center mb-3`}>
                      <i className={`fa-solid ${item.icon} ${item.color} text-xs`}></i>
                    </div>
                    <h3 className="text-cyan-400 font-black uppercase tracking-widest text-[10px] mb-2">{item.title}</h3>
                    <p className="text-sm text-slate-200">{item.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
              <h2 className="text-white font-black text-xl tracking-tight mb-4">Built to Scale</h2>
              <p className="mb-6">Every layer of AirDate is serverless and cloud-native. No infrastructure to manage, no scaling ceilings. Intelligence endpoints respond in real time. Personalization data syncs across devices instantly. Show imagery is served globally from edge locations. The renewal classifier runs on a managed machine learning pipeline. Notifications are delivered directly with no intermediary push services.</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label:'Intelligence Endpoints', value:'15+' },
                  { label:'Shows with Renewal Data', value:'272' },
                  { label:'Scoop Stories',            value:'397' },
                  { label:'Intelligence Sources',     value:'5'   },
                ].map(stat => (
                  <div key={stat.label} className="bg-slate-800/60 rounded-2xl p-4 border border-white/5 text-center">
                    <p className="text-2xl font-black text-cyan-400 mb-1">{stat.value}</p>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-slate-900/40 border border-cyan-500/10 rounded-3xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                  <i className="fa-solid fa-building text-cyan-400 text-sm"></i>
                </div>
                <h2 className="text-white font-black text-xl tracking-tight">Engineered by Stratustier Innovation Labs</h2>
              </div>
              <p>AirDate is a product of <strong className="text-white">Stratustier Innovation Labs</strong>, specializing in scalable intelligence platforms, AI-powered product experiences, and cloud-native media applications. Our engineering philosophy: build systems that are invisible to users and invincible under load.</p>
            </section>

            <div className="text-center py-8">
              <p className="italic text-slate-200 text-lg">Discovery technology should be invisible, intelligent, and invincible.</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
