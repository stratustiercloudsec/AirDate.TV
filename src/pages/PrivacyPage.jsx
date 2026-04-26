// src/pages/PrivacyPage.jsx
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

const SECTIONS = [
  { icon: 'fa-user-slash', color: 'text-cyan-400', bg: 'bg-cyan-500/10', title: 'The Zero-Identity Pillar', span: 1, body: 'AirDate is engineered as a stateless metadata platform. We do not maintain centralized user databases, nor do we require account creation, email harvesting, or authentication tokens. Your interaction with the intelligence hub is anonymous by design, ensuring that signal discovery remains private and unlinked to a personal identity.' },
  { icon: 'fa-heart', color: 'text-pink-400', bg: 'bg-pink-500/10', title: 'Edge-Side Intelligence', span: 1, body: (<>All personalized data—including your <strong className="text-white">"Pulse"</strong> watchlist—is stored exclusively on your device using <strong className="text-white">Edge-side Local Storage</strong>. AirDate does not synchronize this data to external servers, meaning your discovery patterns never leave your browser.</>) },
  { icon: 'fa-chart-line', color: 'text-orange-400', bg: 'bg-orange-500/10', title: 'Signal Telemetry', span: 1, body: (<>To power the <strong className="text-white">Global Hype Ranking</strong>, the platform captures anonymous telemetry regarding title search frequency. This data is aggregated and stripped of all device-specific markers, utilized solely to quantify community interest.</>) },
  { icon: 'fa-brain', color: 'text-purple-400', bg: 'bg-purple-500/10', title: 'Synthesis Protocols', span: 1, body: (<>Intelligence briefings generated utilize <strong className="text-white">stateless LLM orchestration (Amazon Bedrock)</strong>. No user input or personally identifiable information (PII) is utilized as context for neural synthesis.</>) },
  { icon: 'fa-arrows-to-circle', color: 'text-slate-400', bg: 'bg-slate-700/60', title: 'Third-Party Signal Boundaries', span: 2, body: 'Interactions with external assets—such as trailer playback—are governed by those respective providers. We utilize Google Analytics to monitor platform health, with IP addresses masked to prioritize user anonymity.' },
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
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3">Data Integrity &<br />Stateless Orchestration</h1>
            <p className="text-slate-200 text-lg leading-relaxed">How AirDate handles your data — which is as little as possible.</p>
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
