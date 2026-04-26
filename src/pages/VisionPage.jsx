// src/pages/VisionPage.jsx
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
            <h1 className="text-5xl font-black tracking-tighter text-white mb-3 italic">The Invisible Engine.</h1>
            <p className="text-slate-200 text-lg leading-relaxed">Redefining metadata orchestration for the content supply chain.</p>
          </div>

          <div className="space-y-10 text-slate-200 leading-relaxed text-base">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-red-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-triangle-exclamation text-red-400 text-sm"></i>
                  </div>
                  <h2 className="text-white font-black text-xl tracking-tight">The Challenge: Scheduling Volatility</h2>
                </div>
                <p>In the modern streaming landscape, metadata is high-entropy. Authoritative databases often suffer from "Knowledge Latency"—a gap between real-world production shifts and systemic updates. This creates data fragmentation, name ambiguity, and title collisions that degrade the user discovery experience.</p>
              </section>
              <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8 flex flex-col">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-cyan-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <i className="fa-solid fa-signal text-cyan-400 text-sm"></i>
                  </div>
                  <h2 className="text-white font-black text-xl tracking-tight">The Solution: Signal Intelligence</h2>
                </div>
                <p>AirDate is a serverless <strong className="text-white">Metadata Orchestration Platform</strong>. We harmonize static, authoritative metadata with transient, unstructured production signals through a parallel RAG architecture. By synthesizing live studio markers and trade intelligence in real-time, we deliver a high-fidelity <strong className="text-white">"Network Signal"</strong> that bypasses traditional training-data cutoffs.</p>
              </section>
            </div>

            <section className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
              <h2 className="text-white font-black text-xl tracking-tight mb-6">The Mechanism</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {[
                  { icon: 'fa-lock', color: 'text-cyan-400', bg: 'bg-cyan-500/10', title: 'ID-Locked Precision', desc: 'Strict ID-aware disambiguation layer to resolve multi-version title collisions and eliminate hallucinations.' },
                  { icon: 'fa-brain', color: 'text-purple-400', bg: 'bg-purple-500/10', title: 'Neural Synthesis', desc: 'Amazon Bedrock quantifies sentiment and community hype into actionable performance metrics.' },
                  { icon: 'fa-fire', color: 'text-orange-400', bg: 'bg-orange-500/10', title: 'Anticipation Tracking', desc: 'Track what you\'re waiting for, not just what you\'ve watched. The only platform built for pre-premiere intelligence.' },
                  { icon: 'fa-calendar-check', color: 'text-green-400', bg: 'bg-green-500/10', title: 'Premiere Calendar', desc: 'Real premiere dates verified by signal scanning — not rumors, not user submissions.' },
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

            <div className="text-center py-8">
              <p className="italic text-slate-200 text-lg">Our goal is to make discovery technology invisible, intelligent, and invincible.</p>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
