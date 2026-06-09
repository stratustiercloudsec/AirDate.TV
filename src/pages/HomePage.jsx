// src/pages/HomePage.jsx
// ─────────────────────────────────────────────────────────────
//  AirDate.tv  ·  Landing / Marketing Homepage  (v2 GTM rewrite)
//  GTM changes:
//    • Hero headline rewritten — leads with the problem (fragmentation)
//    • Eyebrow de-jargoned — instant orientation for a first-time visitor
//    • Feature order: Calendar → Watchlist → Scoop → Persona
//    • Stats bar: "Daily" and "Free" replaced with specific, credible metrics
//    • "How It Works" reframed as a 3-step product overview (not just Persona)
//    • Free plan: "free — forever" promoted to card headline
//    • Social proof: founder quote in final CTA section
//    • "Join thousands" removed until real numbers can support it
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef }   from 'react'
import { Link, useNavigate }   from 'react-router-dom'
import { useAuth }             from '@/context/AuthContext'
import './HomePage.css'
import { Footer } from '@/components/layout/Footer'

// ── Hero banner  (place hero-banner-v1.png in src/assets/images/)
const heroBanner = '/assets/images/hero-banner-v1.png'

// ── Feature cards — reordered for GTM: immediate pain → habit → differentiator → depth
const FEATURES = [
  {
    id: 'calendar',
    icon: '◈',
    eyebrow: 'PREMIERE CALENDAR',
    headline: 'Every premiere, every network, one calendar',
    body:
      "New seasons, returning favorites, and first-run series — all in one filterable calendar. No more hunting across apps or missing a premiere because you didn't know it was coming.",
    cta: 'Browse Premieres',
    href: '/premieres',
    accent: 'teal',
  },
  {
    id: 'watchlist',
    icon: '◎',
    eyebrow: 'WATCHLIST + ALERTS',
    headline: 'Track shows. Get notified. Never miss a drop.',
    body:
      'Add any show to your watchlist and AirDate handles the rest — renewal odds, premiere alerts, and weekly digests sent directly to your inbox. Set it and stay current.',
    cta: 'Start Tracking',
    href: '/auth/signup',
    accent: 'purple',
  },
  {
    id: 'scoop',
    icon: '◉',
    eyebrow: 'THE SCOOP',
    headline: 'Renewal & cancellation intel, powered by AI',
    body:
      "AirDate's autonomous journalism pipeline scans trade sources every four hours and synthesizes the latest renewal, cancellation, and casting news. Real stories. Real sources. No fluff.",
    cta: 'Read The Scoop',
    href: '/scoop',
    accent: 'red',
  },
  {
    id: 'persona',
    icon: '✦',
    eyebrow: 'MY PERSONA',
    headline: 'TV recommendations built around you',
    body:
      'Most platforms recommend based on what you watched. AirDate asks what you love. Set your networks, genres, and custom tastes — "psychological thrillers," "Black comedies," "British crime dramas" — and get recommendations that actually fit.',
    cta: 'Build Your Persona',
    href: '/persona',
    accent: 'gold',
  },
]

// ── Stats — specific and credibility-building
const STATS = [
  { value: '500K+', label: 'Shows & Episodes'       },
  { value: '200+',  label: 'Networks Tracked'        },
  { value: 'Every 4hrs', label: 'Scoop Refreshes'   },
  { value: '8',     label: 'Major Streaming Platforms' },
]

// ── 3-step "How It Works" — full product, not just Persona
const HOW_IT_WORKS = [
  {
    step: '01',
    headline: 'Tell AirDate what you watch',
    body: 'Pick your streaming platforms, favorite genres, and custom taste tags. Takes about 60 seconds.',
  },
  {
    step: '02',
    headline: 'We track every network for you',
    body: 'Premieres, renewals, cancellations — AirDate monitors 200+ networks so you never have to.',
  },
  {
    step: '03',
    headline: 'Get alerts. Never miss a premiere again.',
    body: 'Weekly digests, AI recommendations, and renewal odds delivered straight to your inbox.',
  },
]

export function HomePage() {
  const { user }   = useAuth()
  const navigate   = useNavigate()
  const heroRef    = useRef(null)

  // Parallax-lite: shift hero text slightly on scroll
  useEffect(() => {
    const hero = heroRef.current
    if (!hero) return
    const onScroll = () => {
      const y = window.scrollY
      if (y < 600) {
        hero.style.setProperty('--scroll-y', `${y * 0.3}px`)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const handlePrimaryCtaClick = () => {
    if (user) {
      navigate('/persona')
    } else {
      navigate('/auth/signup')
    }
  }

  return (
    <div className="hp-root">

      {/* ── HERO ──────────────────────────────────────────────────── */}
      {/*
          GTM change: eyebrow rewritten to orient (not impress).
          H1 leads with the user's pain — fragmentation across apps —
          not the product feature. Subhead carries the "how" naturally.
      */}
      <section className="hp-hero" ref={heroRef}>

        {/* Text block */}
        <div className="hp-hero__copy">
          <span className="hp-hero__eyebrow">YOUR STREAMING COMMAND CENTER</span>
          <h1 className="hp-hero__headline">
            TV is everywhere.<br />
            <em>AirDate keeps</em><br />
            track of it.
          </h1>
          <p className="hp-hero__sub">
            Track premieres across every streaming platform, get renewal and
            cancellation alerts, and build a viewing profile that actually
            reflects your taste — all in one place, starting free.
          </p>
          <div className="hp-hero__ctas">
            <button className="hp-btn hp-btn--primary" onClick={handlePrimaryCtaClick}>
              {user ? 'Go to My Persona' : 'Create Free Account'}
            </button>
            <Link to="/premieres" className="hp-btn hp-btn--ghost">
              Browse Premieres
            </Link>
          </div>
        </div>

        {/* Banner image */}
        <div className="hp-hero__banner-wrap">
          <img
            src={heroBanner}
            alt="Premiering now: The Night Agent, Your Friends & Neighbors, Reasonable Doubt, Paradise, The Lincoln Lawyer"
            className="hp-hero__banner"
            loading="eager"
          />
          <div className="hp-hero__banner-fade" />
        </div>
      </section>

      {/* ── STATS BAR ─────────────────────────────────────────────── */}
      {/*
          GTM change: replaced "Daily" (vague) and "Free" (belongs in
          pricing) with specific, impressive platform metrics.
      */}
      <div className="hp-stats">
        {STATS.map(s => (
          <div key={s.label} className="hp-stats__item">
            <span className="hp-stats__value">{s.value}</span>
            <span className="hp-stats__label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── PROBLEM STATEMENT ─────────────────────────────────────── */}
      {/*
          NEW SECTION: One tight paragraph that names the real problem
          before the product explanation begins. Anchors the rest of
          the page in a shared pain every streaming viewer recognizes.
      */}
      <section className="hp-problem">
        <div className="hp-problem__inner">
          <p className="hp-problem__text">
            You're subscribed to Netflix, Max, Hulu, Apple TV+, and three others.
            Your watchlist is spread across all of them. You missed two season
            premieres last month because you didn't know they were back.
            <strong> AirDate fixes that.</strong>
          </p>
        </div>
      </section>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
      {/*
          GTM change: reordered Calendar → Watchlist → Scoop → Persona.
          Lead with the universally relatable problem (missing premieres),
          build the habit (watchlist), deliver the wow (Scoop AI journalism),
          then close with the deepest engagement feature (Persona).
      */}
      <section className="hp-features">
        <div className="hp-features__grid">
          {FEATURES.map((f, i) => (
            <div key={f.id} className={`hp-feature hp-feature--${f.accent} hp-feature--${i % 2 === 0 ? 'left' : 'right'}`}>
              <div className="hp-feature__icon">{f.icon}</div>
              <span className="hp-feature__eyebrow">{f.eyebrow}</span>
              <h2 className="hp-feature__headline">{f.headline}</h2>
              <p className="hp-feature__body">{f.body}</p>
              <Link to={f.href} className={`hp-feature__cta hp-feature__cta--${f.accent}`}>
                {f.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────────────── */}
      {/*
          GTM change: this section now explains the *full* product in
          3 steps rather than showcasing only the Persona feature flow.
          Renamed from the misleading "HOW IT WORKS" eyebrow that only
          described Persona, to a true product-level orientation.
      */}
      <section className="hp-how">
        <div className="hp-how__inner">
          <span className="hp-how__eyebrow">HOW IT WORKS</span>
          <h2 className="hp-how__headline">
            Set up once.<br />Stay current forever.
          </h2>
          <div className="hp-how__steps">
            {HOW_IT_WORKS.map(s => (
              <div key={s.step} className="hp-how__step">
                <span className="hp-how__step-num">{s.step}</span>
                <h3 className="hp-how__step-headline">{s.headline}</h3>
                <p className="hp-how__step-body">{s.body}</p>
              </div>
            ))}
          </div>
          <Link
            to={user ? '/persona' : '/auth/signup'}
            className="hp-btn hp-btn--primary"
          >
            {user ? 'View My Persona' : 'Get Started — It\'s Free'}
          </Link>
        </div>
      </section>

      {/* ── PERSONA SPOTLIGHT ─────────────────────────────────────── */}
      {/*
          GTM change: eyebrow now correctly scoped to "MY PERSONA" so
          visitors understand this is one feature — not the whole product.
          The tag cloud and recommendation result remain as-is (they work).
      */}
      <section className="hp-persona-spot">
        <div className="hp-persona-spot__inner">
          <div className="hp-persona-spot__text">
            <span className="hp-persona-spot__eyebrow">MY PERSONA</span>
            <h2 className="hp-persona-spot__headline">
              Your taste profile.<br />Your discovery engine.
            </h2>
            <p className="hp-persona-spot__body">
              Traditional platforms track what you click. AirDate learns what you
              love. Combine preferred networks, genres, and open-ended tastes into
              a Persona that drives every recommendation — and gets smarter every
              time you update your watchlist.
            </p>
            <Link to={user ? '/persona' : '/upgrade'} className="hp-btn hp-btn--primary">
              {user ? 'View My Persona' : 'Unlock My Persona'}
            </Link>
          </div>

          <div className="hp-persona-spot__tags-col">
            <div className="hp-persona-spot__tags-group">
              <span className="hp-tag hp-tag--active">HBO Originals</span>
              <span className="hp-tag hp-tag--active">Apple TV+</span>
              <span className="hp-tag hp-tag--active">FX</span>
            </div>
            <div className="hp-persona-spot__tags-group">
              <span className="hp-tag hp-tag--active">Crime Drama</span>
              <span className="hp-tag hp-tag--active">Psychological Thriller</span>
            </div>
            <div className="hp-persona-spot__tags-group">
              <span className="hp-tag hp-tag--custom">+ Documentaries</span>
              <span className="hp-tag hp-tag--custom">+ British Crime Dramas</span>
            </div>
            <div className="hp-persona-spot__arrow">↓</div>
            <div className="hp-persona-spot__result">
              <span className="hp-persona-spot__result-label">AI RECOMMENDATIONS</span>
              <p className="hp-persona-spot__result-text">
                Shows tailored to your exact tastes — not just what's trending.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── PLAN CTA ──────────────────────────────────────────────── */}
      {/*
          GTM change: "Free — forever" promoted to the headline of the
          free plan card (was buried in the intro paragraph).
          The intro paragraph is tightened and the "forever" hook moved up.
      */}
      <section className="hp-plans">
        <div className="hp-plans__inner">
          <h2 className="hp-plans__headline">Start free. Upgrade when you're ready.</h2>
          <p className="hp-plans__sub">
            Core features are free — and stay free. Unlock AI recommendations,
            advanced Persona settings, and priority alerts when you're ready to go deeper.
          </p>
          <div className="hp-plans__cards">

            <div className="hp-plan hp-plan--free">
              {/* GTM change: "Free — forever" is now the tier headline */}
              <span className="hp-plan__tier">FREE — FOREVER</span>
              <ul className="hp-plan__perks">
                <li>Watchlist — unlimited shows</li>
                <li>Premiere Calendar</li>
                <li>The Scoop news feed</li>
                <li>Email premiere alerts</li>
                <li>Basic My Persona</li>
              </ul>
              <Link to="/auth/signup" className="hp-btn hp-btn--ghost hp-plan__cta">
                Create Free Account
              </Link>
            </div>

            <div className="hp-plan hp-plan--pro">
              <span className="hp-plan__badge">MOST POPULAR</span>
              <span className="hp-plan__tier">PRO</span>
              <ul className="hp-plan__perks">
                <li>Everything in Free</li>
                <li>Advanced Persona settings</li>
                <li>Unlimited custom interests</li>
                <li>AI recommendation engine</li>
                <li>Renewal probability scores</li>
                <li>Priority &amp; push alerts</li>
              </ul>
              <Link to="/upgrade" className="hp-btn hp-btn--primary hp-plan__cta">
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      {/*
          GTM changes:
            • "Join thousands" removed — no data to support it at launch
            • Founder quote added as authentic social proof
            • Sub copy is specific and benefit-led, not vague
      */}
      <section className="hp-final-cta">
        <h2 className="hp-final-cta__headline">
          Television deserves a smarter home base.
        </h2>

        {/* Founder social proof — authentic at launch stage */}
        <blockquote className="hp-final-cta__quote">
          "I built AirDate because I was tired of missing premieres and hunting
          across six apps to find out if my favorite show was renewed.
          Everything here is the tool I wished existed."
          <cite className="hp-final-cta__cite">— Kenyon Johnston, Founder</cite>
        </blockquote>

        <p className="hp-final-cta__sub">
          Free to join. No credit card required. Works across every major
          streaming platform.
        </p>
        <div className="hp-final-cta__buttons">
          <button className="hp-btn hp-btn--primary hp-btn--lg" onClick={handlePrimaryCtaClick}>
            {user ? 'Go to My Persona' : 'Join AirDate — Free'}
          </button>
          <Link to="/scoop" className="hp-btn hp-btn--ghost hp-btn--lg">
            Read The Scoop
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}