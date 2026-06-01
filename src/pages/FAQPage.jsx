// src/pages/FAQPage.jsx
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Footer } from '@/components/layout/Footer'

const FAQ_SECTIONS = [
  {
    category: 'Account & Plans',
    icon: 'fa-user-circle',
    color: 'text-cyan-400',
    faqs: [
      { q: 'What is the difference between Free and Pro?', a: 'The Free plan lets you track up to 5 shows, browse the Premiere Calendar, and explore Trending & Top 10. Pro unlocks an unlimited watchlist, early premiere alerts, full access to The Scoop, and AI-powered show recaps.' },
      { q: 'Is there a free trial?', a: "AirDate's Free plan gives you full access to the core platform with no time limit — it's a genuine free tier, not a trial. Upgrade to Pro whenever you need unlimited tracking and The Scoop." },
      { q: 'Can I switch between monthly and annual billing?', a: 'Yes. You can switch from monthly to annual at any time — the annual plan takes effect at your next billing cycle. Contact operations@stratustierlabs.com for assistance.' },
      { q: 'What happens to my watchlist if I downgrade?', a: "Your watchlist data is never deleted. You can still view all tracked shows, but you won't be able to add new ones beyond the 5-show free limit until you re-upgrade. Note: if you remove a tracked show while on the free tier, you won't be able to re-add it until you upgrade again." },
    ],
  },
  {
    category: 'Billing & Payments',
    icon: 'fa-credit-card',
    color: 'text-violet-400',
    faqs: [
      { q: 'When am I billed?', a: 'Monthly plans are billed every 30 days from your sign-up date. Annual plans are billed once upfront at $49.90. All billing is handled securely through Stripe.' },
      { q: 'Is my payment information secure?', a: 'All payments are processed by Stripe, a PCI-DSS Level 1 certified payment provider. AirDate never sees or stores your credit card details.' },
      { q: 'Can I cancel anytime?', a: 'Yes — cancel any time from Account → Membership. Pro access continues until the end of your current billing period. No cancellation fees, ever.' },
      { q: 'How do I cancel my membership?', a: 'Go to Account → Membership → Cancel Membership. Pro access stays active through your paid period. You can also email operations@stratustierlabs.com and we will process the cancellation within 24 hours.' },
      { q: 'Do you offer refunds?', a: 'We handle refund requests case by case. If you were charged in error or experienced a technical issue, contact operations@stratustierlabs.com within 7 days of the charge.' },
    ],
  },
  {
    category: 'The Scoop',
    icon: 'fa-newspaper',
    color: 'text-amber-400',
    faqs: [
      { q: 'What is The Scoop?', a: "The Scoop is AirDate's own TV industry intelligence feed — your digital columnist covering what's happening in the TV world. Updated around the clock with renewal announcements, cancellations, casting news, and production updates, all condensed into concise, readable stories." },
      { q: 'How often is The Scoop updated?', a: 'The Scoop refreshes automatically every 4 hours, continuously scanning for the latest TV industry news. The timestamp on the page shows when it was last updated.' },
      { q: 'Is The Scoop available on the Free plan?', a: 'Free users can browse The Scoop feed and headlines. Full story access and deep dives are a Pro feature.' },
    ],
  },
  {
    category: 'Premiere Alerts',
    icon: 'fa-bell',
    color: 'text-green-400',
    faqs: [
      { q: 'How do premiere alerts work?', a: 'When you track a show, AirDate monitors its upcoming premiere dates. Based on your timing preference (day-of, 1 day before, 3 days before, or 1 week before), you receive an email before the episode airs.' },
      { q: 'How do I enable premiere alerts?', a: 'Go to Account → Preferences → Premiere Alerts and toggle them on. Alerts are a Pro feature.' },
      { q: 'I am not receiving alert emails. What should I check?', a: 'Verify alerts are enabled in Account → Preferences. Check your spam folder for emails from noreply@airdate.tv. If still missing, contact operations@stratustierlabs.com.' },
    ],
  },
  {
    category: "My Persona",
    icon: "fa-masks-theater",
    color: "text-violet-400",
    faqs: [
      { q: "What is My Persona?", a: "My Persona is your AI-powered viewer identity on AirDate. Based on your watchlist and genre preferences, our AI analyzes your taste and generates a personalized viewer persona, along with content affinities, a weekly digest of upcoming shows, and curated recommendations you might be missing." },
      { q: "How is my persona generated?", a: "AirDate analyzes your tracked shows, preferred networks, genre preferences, and custom interests using Claude AI by Anthropic. The AI automatically produces a persona label, affinity tags, a welcome message, and show recommendations. Your persona updates automatically when you save preferences or add shows." },
      { q: "What is the Coming This Week digest?", a: "The Coming This Week section shows shows from your watchlist with premiere dates in the next 7 days, plus AI-matched picks from your persona affinities that you have not yet tracked. It updates automatically each week." },
      { q: "What does You Might Be Missing show?", a: "You Might Be Missing surfaces shows that match your viewer persona but are not on your watchlist yet. These are AI-curated picks based on your content affinities, like a personal talent scout for your taste." },
      { q: "How often does my persona update?", a: "Your persona updates automatically whenever you save preferences or add new shows to your watchlist. No manual refresh needed." },
      { q: "Is My Persona available on the Free plan?", a: "My Persona is a Pro-only feature. Upgrade to Pro to unlock your AI Viewer Persona, Coming Up digest, and AI-matched show recommendations." },
    ],
  },
  {
    category: 'Tracking & Watchlist',
    icon: 'fa-heart',
    color: 'text-rose-400',
    faqs: [
      { q: 'How many shows can I track on the Free plan?', a: 'Free accounts can track up to 5 shows. Upgrade to Pro for an unlimited watchlist.' },
      { q: 'Does AirDate cover all streaming platforms?', a: 'AirDate covers Netflix, Max, Hulu, Disney+, Apple TV+, Peacock, Paramount+, Prime Video, STARZ, Tubi, and major broadcast networks. Coverage expands regularly.' },
    ],
  },
  {
    category: 'Community & Comments',
    icon: 'fa-comments',
    color: 'text-purple-400',
    faqs: [
      { q: 'Can I leave comments on show pages?', a: 'Yes! Any registered AirDate user — including free accounts — can leave comments on show detail pages. Comments are visible to everyone, including visitors who are not signed in.' },
      { q: 'Do I need a Pro account to comment?', a: 'No. Commenting is available to all registered users on the free plan. You just need a free AirDate account to post.' },
      { q: 'What are the community comment rules?', a: 'To keep AirDate a great place for TV fans, all comments must follow these rules:\n\n• Maximum 100 words per comment\n• No profanity, hate speech, or abusive language\n• No spam or off-topic promotional content\n• Keep discussion relevant to the show\n\nAll comments are screened by AI-powered content moderation before posting. Violations are blocked automatically.' },
      { q: 'How long do comments stay visible?', a: 'Comments automatically expire and are removed after 45 days. This keeps show pages fresh and relevant to current seasons.' },
      { q: 'Can I delete my own comment?', a: 'Comment self-deletion is coming in a future update. In the meantime, contact operations@airdate.tv with the show name and your comment text and we will remove it within 24 hours.' },
      { q: 'What happens if my comment is blocked?', a: "If our moderation system detects a policy violation, your comment will not be posted and you'll see a message explaining why. Review the community guidelines, rephrase, and try again. Repeated violations may result in your commenting privileges being restricted." },
      { q: 'Who can see my name on comments?', a: 'Your display name — the name on your AirDate account, or your email prefix if no name is set — is shown publicly next to your comment. It is visible to all visitors including signed-out users.' },
    ],
  },
  {
    category: 'Privacy & Data',
    icon: 'fa-shield-halved',
    color: 'text-slate-200',
    faqs: [
      { q: 'What data does AirDate collect?', a: 'AirDate collects your email, watchlist, and notification preferences to power your experience. We do not sell or share your data with third parties.' },
     { q: 'How do I delete my account?', a: 'Go to Account → scroll to the bottom → Delete Account. You will be asked to confirm before anything is removed. Once confirmed, your account, watchlist, and all personal data are permanently deleted within 24 hours. This action cannot be undone.' },
    ],
  },
]

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-white/5 last:border-0">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start justify-between py-5 text-left gap-4">
        <span className="text-white font-semibold text-sm leading-relaxed">{q}</span>
        <i className={`fa-solid fa-chevron-down text-slate-200 text-xs flex-shrink-0 mt-1 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}></i>
      </button>
      {open && <div className="pb-5"><p className="text-slate-300 text-sm leading-relaxed">{a}</p></div>}
    </div>
  )
}

export function FAQPage() {
  const { isPremium } = useAuth()
  const [activeCategory, setActiveCategory] = useState(null)
  const filtered = activeCategory ? FAQ_SECTIONS.filter(s => s.category === activeCategory) : FAQ_SECTIONS

  return (
    <div className="bg-slate-950 text-slate-100 min-h-screen">
      <div className="max-w-3xl mx-auto px-4 pt-24 pb-10 text-center">
        <div className="inline-flex items-center gap-2 bg-cyan-500/10 border border-cyan-500/30 rounded-full px-4 py-1.5 mb-6">
          <i className="fa-solid fa-circle-question text-cyan-400 text-xs"></i>
          <span className="text-cyan-400 text-xs font-bold uppercase tracking-widest">Help Center</span>
        </div>
        <h1 className="text-4xl font-black text-white mb-4">Frequently Asked Questions</h1>
        <p className="text-slate-200 text-base max-w-lg mx-auto">Everything you need to know about AirDate — from tracking shows to managing your membership.</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-8">
        <div className="flex flex-wrap justify-center gap-2">
          <button onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${!activeCategory ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-slate-900/60 border-white/10 text-slate-200 hover:border-white/20'}`}>
            All Topics
          </button>
          {FAQ_SECTIONS.map(s => (
            <button key={s.category} onClick={() => setActiveCategory(activeCategory === s.category ? null : s.category)}
              className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-widest transition-all border ${activeCategory === s.category ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-400' : 'bg-slate-900/60 border-white/10 text-slate-200 hover:border-white/20'}`}>
              {s.category}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pb-20 space-y-6">
        {filtered.map(section => (
          <div key={section.category} className="bg-slate-900/60 border border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-white/5">
              <i className={`fa-solid ${section.icon} ${section.color} text-sm`}></i>
              <h2 className={`text-sm font-black uppercase tracking-widest ${section.color}`}>{section.category}</h2>
            </div>
            <div className="px-6">
              {section.faqs.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </div>
          </div>
        ))}

        <div className="text-center p-8 bg-slate-900/40 border border-white/10 rounded-3xl">
          <i className="fa-solid fa-envelope text-cyan-400 text-2xl mb-3 block"></i>
          <h3 className="text-white font-black text-lg mb-2">Still have questions?</h3>
          <p className="text-slate-200 text-sm mb-6">Our team typically responds within 24 hours.</p>
          <a href="mailto:operations@stratustierlabs.com"
            className="inline-flex items-center gap-2 px-6 py-3 bg-cyan-500/20 border border-cyan-500/30 rounded-xl text-cyan-400 text-xs font-black uppercase tracking-widest hover:bg-cyan-500/30 transition-all">
            <i className="fa-solid fa-envelope"></i> Contact Support
          </a>
        </div>

        {!isPremium && (
          <div className="p-8 rounded-3xl text-center border border-cyan-500/30"
            style={{ background: 'linear-gradient(135deg, rgba(8,145,178,0.15) 0%, rgba(6,182,212,0.08) 100%)' }}>
            <i className="fa-solid fa-bolt text-cyan-400 text-2xl mb-3 block"></i>
            <h3 className="text-white font-black text-lg mb-2">Ready to go Pro?</h3>
            <p className="text-slate-200 text-sm mb-6">Unlimited watchlist, early premiere alerts, and full Scoop access from $4.99/month.</p>
            <Link to="/upgrade"
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl text-slate-950 font-black text-xs uppercase tracking-widest hover:brightness-110 transition-all"
              style={{ background: 'linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)' }}>
              <i className="fa-solid fa-bolt"></i> Upgrade to Pro
            </Link>
          </div>
        )}
      </div>
      <Footer />
    </div>
  )
}
