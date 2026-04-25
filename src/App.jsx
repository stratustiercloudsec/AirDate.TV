// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

// Context providers
import { AuthProvider }         from '@/context/AuthContext'
import { WatchlistProvider }    from '@/context/WatchlistContext'
import { NotificationProvider } from '@/context/NotificationContext'

// Layout
import { Navbar } from '@/components/layout/Navbar'

// Auth guard
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'

// ── Public pages ────────────────────────────────────────────────────────────
import { HomePage }              from '@/pages/HomePage'
import { TrendingPage }          from '@/pages/TrendingPage'
import { PremieresCalendarPage } from '@/pages/PremieresCalendarPage'
import { ScoopPage } from '@/pages/ScoopPage'
import { ScoopStoryPage } from '@/pages/ScoopStoryPage'
import { ShowDetailPage }        from '@/pages/ShowDetailPage'
import { ContactPage }           from '@/pages/ContactPage'
import { VisionPage }            from '@/pages/VisionPage'
import { TermsPage }             from '@/pages/TermsPage'
import { PrivacyPage }           from '@/pages/PrivacyPage'
import { UpdatePage }            from '@/pages/UpdatePage'
import { UpdateSuccessPage }     from '@/pages/UpdateSuccessPage'
import { NotFoundPage }          from '@/pages/NotFoundPage'

// ── Protected pages ─────────────────────────────────────────────────────────
import { MyPulsePage }       from '@/pages/AccountPage'
import { NotificationsPage } from '@/pages/NotificationsPage'

// ── Auth pages ──────────────────────────────────────────────────────────────
import { LoginPage }          from '@/pages/auth/LoginPage'
import { SignUpPage }         from '@/pages/auth/SignUpPage'
import { VerifyEmailPage }    from '@/pages/auth/VerifyEmailPage'
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage'
import { CallbackPage }       from '@/pages/auth/CallbackPage'
import { ProfilePage }        from '@/pages/auth/ProfilePage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <WatchlistProvider>
          <NotificationProvider>
            <Navbar />
            <main>
              <Routes>

                {/* ── Public routes ───────────────────────────────────── */}
                <Route path="/"                element={<HomePage />} />
                <Route path="/trending"        element={<TrendingPage />} />
                <Route path="/premieres"       element={<PremieresCalendarPage />} />
                <Route path="/scoop" element={<ScoopPage />} />
              <Route path="/scoop/:hash" element={<ScoopStoryPage />} />
                <Route path="/details/:id"     element={<ShowDetailPage />} />
                <Route path="/contact"         element={<ContactPage />} />
                <Route path="/vision"          element={<VisionPage />} />
                <Route path="/terms"           element={<TermsPage />} />
                <Route path="/privacy"         element={<PrivacyPage />} />
                <Route path="/upgrade"         element={<UpdatePage />} />
                <Route path="/upgrade-success" element={<UpdateSuccessPage />} />

                {/* ── Auth routes (no Navbar wrapper needed — pages are self-contained) */}
                <Route path="/auth/login"           element={<LoginPage />} />
                <Route path="/auth/signup"          element={<SignUpPage />} />
                <Route path="/auth/verify"          element={<VerifyEmailPage />} />
                <Route path="/auth/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/auth/callback"        element={<CallbackPage />} />

                {/* ── Protected routes ─────────────────────────────────── */}
                <Route path="/account" element={
                  <ProtectedRoute><ProfilePage /></ProtectedRoute>
                } />
                <Route path="/pulse" element={
                  <ProtectedRoute><MyPulsePage /></ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute><NotificationsPage /></ProtectedRoute>
                } />

                {/* ── 404 ──────────────────────────────────────────────── */}
                <Route path="/404" element={<NotFoundPage />} />
                <Route path="*"    element={<NotFoundPage />} />

              </Routes>
            </main>
          </NotificationProvider>
        </WatchlistProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}