// src/pages/HomePage.jsx
// ─────────────────────────────────────────────────────────────
//  AirDate.tv  ·  Landing / Marketing Homepage
//  Replaces the old search-centric homepage.
//  Old homepage content lives in SearchPage.jsx → /search
// ─────────────────────────────────────────────────────────────

import { useEffect, useRef }   from 'react'
import { Link, useNavigate }   from 'react-router-dom'
import { useAuth }             from '@/context/AuthContext'
import './HomePage.css'
import { Footer } from '@/components/layout/Footer'

// ── Hero banner  (place hero-banner-v1.png in src/assets/images/)
const heroBanner = '/assets/images/hero-banner-v1.png'

// ── Network / platform logos (reference existing assets)
const NETWORKS = [
  { name: 'Netflix',     id: 'netflix'    },
  { name: 'Max',         id: 'max'        },
  { name: 'Hulu',        id: 'hulu'       },
  { name: 'Apple TV+',   id: 'appletv'    },
  { name: 'Peacock',     id: 'peacock'    },
  { name: 'Prime Video', id: 'prime'      },
  { name: 'Paramount+',  id: 'paramount'  },
  { name: 'Disney+',     id: 'disney'     },
]

const FEATURES = [
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
]

const STATS = [
  { value: '500K+',  label: 'Shows & Episodes'   },
  { value: '200+',   label: 'Networks Tracked'    },
  { value: 'Daily',  label: 'Scoop Updates'       },
  { value: 'Free',   label: 'To Get Started'      },
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
      <section className="hp-hero" ref={heroRef}>

        {/* Text block */}
        <div className="hp-hero__copy">
          <span className="hp-hero__eyebrow">AI-NATIVE TV INTELLIGENCE</span>
          <h1 className="hp-hero__headline">
            Discover Your<br />
            <em>Next Favorite</em><br />
            Show
          </h1>
          <p className="hp-hero__sub">
            Track premieres, build your viewing persona, and get AI-powered
            alerts across every streaming platform — all in one place.
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
      <div className="hp-stats">
        {STATS.map(s => (
          <div key={s.label} className="hp-stats__item">
            <span className="hp-stats__value">{s.value}</span>
            <span className="hp-stats__label">{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── FEATURES ──────────────────────────────────────────────── */}
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

      {/* ── PERSONA SPOTLIGHT ─────────────────────────────────────── */}
      <section className="hp-persona-spot">
        <div className="hp-persona-spot__inner">
          <div className="hp-persona-spot__text">
            <span className="hp-persona-spot__eyebrow">HOW IT WORKS</span>
            <h2 className="hp-persona-spot__headline">
              Your taste profile.<br />Your discovery engine.
            </h2>
            <p className="hp-persona-spot__body">
              Traditional platforms track what you click. AirDate learns what you
              love. Combine preferred networks, genres, and open-ended tastes into
              a Persona that drives every recommendation.
            </p>
            <Link to={user ? '/persona' : '/auth/signup'} className="hp-btn hp-btn--primary">
              {user ? 'View My Persona' : 'Get Started — It\'s Free'}
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
      <section className="hp-plans">
        <div className="hp-plans__inner">
          <h2 className="hp-plans__headline">Start free. Upgrade when you're ready.</h2>
          <p className="hp-plans__sub">
            Watchlists, premiere alerts, and Scoop access are free — forever.
            Unlock advanced Persona settings, AI recommendations, and priority alerts with Pro.
          </p>
          <div className="hp-plans__cards">

            <div className="hp-plan hp-plan--free">
              <span className="hp-plan__tier">FREE</span>
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
                <li>Priority & push alerts</li>
              </ul>
              <Link to="/upgrade" className="hp-btn hp-btn--primary hp-plan__cta">
                Upgrade to Pro
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ─────────────────────────────────────────────── */}
      <section className="hp-final-cta">
        <h2 className="hp-final-cta__headline">
          Television deserves a smarter home base.
        </h2>
        <p className="hp-final-cta__sub">
          Join thousands of viewers who never miss a premiere, a renewal, or a cancellation.
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
