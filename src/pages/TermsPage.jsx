// src/pages/TermsPage.jsx
import { Link } from 'react-router-dom'
import { Footer } from '@/components/layout/Footer'

const TERMS = [
  { title: '1. Signal Fidelity & Verification', body: 'AirDate provides a high-fidelity "Network Signal" by harmonizing authoritative metadata—including datasets powered by TMDB—with unstructured industry indicators. All premiere dates and season windows are subject to volatility. AirDate is an orchestration layer, not a network-affiliated scheduling system.' },
  { title: '2. Neural Synthesis Boundaries', body: 'Intelligence briefings and "Recap" summaries are generated through a parallel RAG architecture for informational purposes only. AirDate does not guarantee the absolute accuracy of AI-narrated plot details or character arcs processed via stateless LLM orchestration.' },
  { title: '3. Platform Integrity & Reverse Engineering', body: 'The proprietary logic driving our ID-Locked Precision and Hype Telemetry systems is the intellectual property of Stratustier Innovation Labs. Users are strictly prohibited from bypassing API rate-limiting, reverse-engineering the retrieval engine, or utilizing automated scrapers.' },
  { title: '4. Limitation of Liability', body: 'AirDate is provided "as is" without warranty of any kind. Stratustier Innovation Labs shall not be liable for any decision intelligence failures, data latency issues, or scheduled premiere discrepancies resulting from network-side shifts or technical interference within the global media ecosystem.' },
  { title: '5. Evolution of Protocols', body: 'We reserve the right to refine our signal verification algorithms and update these terms to reflect advancements in our serverless architecture without prior individual notification.' },
  { title: '6. Third-Party Data Attribution', body: 'AirDate utilizes the TMDB API but is not endorsed or certified by TMDB. All cinematic and television metadata, including posters and plot summaries, remain the property of their respective owners.' },
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
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3 italic">Orchestration Protocols.</h1>
            <p className="text-slate-200 text-lg leading-relaxed">Intelligence usage & signal verification policy.</p>
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
