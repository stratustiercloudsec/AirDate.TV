// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Context providers
import { AuthProvider }         from '@/context/AuthContext'
import SubscribeModal from '@/components/SubscribeModal'
import { WatchlistProvider }    from '@/context/WatchlistContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { CuratedProvider }     from '@/context/CuratedContext'

// Layout
import { Navbar } from '@/components/layout/Navbar'

// Auth guard
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// ── Public pages ────────────────────────────────────────────────────────────
import { HomePage }              from '@/pages/HomePage'          // ← new landing page
import { SearchPage }            from '@/pages/SearchPage'        // ← old homepage (search/browse)
import { TrendingPage }          from '@/pages/TrendingPage'
import { PremieresCalendarPage } from '@/pages/PremieresCalendarPage'
import { TrailersPage }          from '@/pages/TrailersPage'
import { ScoopPage }             from '@/pages/ScoopPage'
import { ScoopStoryPage }        from '@/pages/ScoopStoryPage'
import { ScoopArchivePage }      from '@/pages/ScoopArchivePage'
import { ShowDetailPage }        from '@/pages/ShowDetailPage'
import { ContactPage }           from '@/pages/ContactPage'
import { VisionPage }            from '@/pages/VisionPage'
import { TermsPage }             from '@/pages/TermsPage'
import { PrivacyPage }           from '@/pages/PrivacyPage'
import { UpdatePage }            from '@/pages/UpdatePage'
import { UpdateSuccessPage }     from '@/pages/UpdateSuccessPage'
import { NotFoundPage }          from '@/pages/NotFoundPage'
import { AboutPage }             from '@/pages/AboutPage'
import { FAQPage }               from '@/pages/FAQPage'

// ── Protected pages ─────────────────────────────────────────────────────────
import { MyPersonaPage }     from '@/pages/MyPersonaPage'
import { NotificationsPage } from '@/pages/NotificationsPage'
import { SharePage }         from '@/pages/SharePage'
import { SubscribePage }     from '@/pages/SubscribePage'

// ── Auth pages ──────────────────────────────────────────────────────────────
import { LoginPage }          from '@/pages/auth/LoginPage'
import { SignUpPage }         from '@/pages/auth/SignUpPage'
import { VerifyEmailPage }    from '@/pages/auth/VerifyEmailPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { CallbackPage }       from '@/pages/auth/CallbackPage'
import { AccountPage }        from '@/pages/AccountPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <WatchlistProvider>
          <NotificationProvider>
      <CuratedProvider>
            <Navbar />
            <main>
              <Routes>

                {/* ── Public routes ───────────────────────────────────── */}
                <Route path="/"                element={<HomePage />} />           {/* ← new landing page */}
                <Route path="/search"          element={<SearchPage />} />         {/* ← old homepage */}
                <Route path="/trending"        element={<TrendingPage />} />
                <Route path="/premieres"       element={<PremieresCalendarPage />} />
                <Route path="/trailers"        element={<TrailersPage />} />
                <Route path="/scoop"           element={<ScoopPage />} />
                <Route path="/scoop/archive"   element={<ScoopArchivePage />} />
                <Route path="/scoop/:hash"     element={<ScoopStoryPage />} />
                <Route path="/details/:id"     element={<ShowDetailPage />} />
                <Route path="/contact"         element={<ContactPage />} />
                <Route path="/vision"          element={<VisionPage />} />
                <Route path="/terms"           element={<TermsPage />} />
                <Route path="/privacy"         element={<PrivacyPage />} />
                <Route path="/upgrade"         element={<UpdatePage />} />
                <Route path="/upgrade-success" element={<UpdateSuccessPage />} />
                <Route path="/about"           element={<AboutPage />} />
                <Route path="/faq"             element={<FAQPage />} />

                {/* ── Auth routes ─────────────────────────────────────── */}
                <Route path="/auth/login"           element={<LoginPage />} />
                <Route path="/auth/signup"          element={<SignUpPage />} />
                <Route path="/auth/verify"          element={<VerifyEmailPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/auth/callback"        element={<CallbackPage />} />

                {/* ── Protected routes ─────────────────────────────────── */}
                <Route path="/account" element={
                  <ProtectedRoute><AccountPage /></ProtectedRoute>
                } />
                <Route path="/persona" element={
                  <ProtectedRoute><MyPersonaPage /></ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute><NotificationsPage /></ProtectedRoute>
                } />
                <Route path="/share/:token" element={<SharePage />} />
                <Route path="/subscribe"    element={<SubscribePage />} />

                {/* ── 404 ──────────────────────────────────────────────── */}
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*"    element={<NotFoundPage />} />

              </Routes>
            </main>
          </CuratedProvider>
      </NotificationProvider>
        </WatchlistProvider>
        <SubscribeModal />
      </AuthProvider>
    </BrowserRouter>
  )
}