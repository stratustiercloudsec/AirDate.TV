// src/App.jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider }         from '@/context/AuthContext'
import { WatchlistProvider }    from '@/context/WatchlistContext'
import { NotificationProvider } from '@/context/NotificationContext'
import { Navbar }               from '@/components/layout/Navbar'
import { ProtectedRoute }       from '@/components/guards/index'

// Pages
import { HomePage }              from '@/pages/HomePage'
import { TrendingPage }          from '@/pages/TrendingPage'
import { PremieresCalendarPage } from '@/pages/PremieresCalendarPage'
import { ScoopPage }             from '@/pages/ScoopPage'
import { AccountPage }           from '@/pages/AccountPage'
import { MyPulsePage }           from '@/pages/AccountPage'
import { NotificationsPage }     from '@/pages/NotificationsPage'
import { ShowDetailPage }        from '@/pages/ShowDetailPage'
import { ContactPage }           from '@/pages/ContactPage'
import { VisionPage }            from '@/pages/VisionPage'
import { TermsPage }             from '@/pages/TermsPage'
import { PrivacyPage }           from '@/pages/PrivacyPage'
import { CallbackPage }          from '@/pages/CallbackPage'
import { UpdatePage }            from '@/pages/UpdatePage'
import { UpdateSuccessPage }     from '@/pages/UpdateSuccessPage'
import { NotFoundPage }          from '@/pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <WatchlistProvider>
          <NotificationProvider>
            <Navbar />
            <main>
              <Routes>

                {/* ── Public routes ─────────────────────────────────── */}
                <Route path="/"               element={<HomePage />} />
                <Route path="/trending"       element={<TrendingPage />} />
                <Route path="/premieres"      element={<PremieresCalendarPage />} />
                <Route path="/scoop"          element={<ScoopPage />} />
                <Route path="/details/:id"    element={<ShowDetailPage />} />
                <Route path="/contact"        element={<ContactPage />} />
                <Route path="/vision"         element={<VisionPage />} />
                <Route path="/terms"          element={<TermsPage />} />
                <Route path="/privacy"        element={<PrivacyPage />} />
                <Route path="/upgrade"        element={<UpdatePage />} />
                <Route path="/upgrade-success" element={<UpdateSuccessPage />} />
                <Route path="/callback"       element={<CallbackPage />} />

                {/* ── Protected routes ──────────────────────────────── */}
                <Route path="/account" element={
                  <ProtectedRoute><AccountPage /></ProtectedRoute>
                } />
                <Route path="/pulse" element={
                  <ProtectedRoute><MyPulsePage /></ProtectedRoute>
                } />
                <Route path="/notifications" element={
                  <ProtectedRoute><NotificationsPage /></ProtectedRoute>
                } />

                {/* ── 404 ───────────────────────────────────────────── */}
                <Route path="/404"  element={<NotFoundPage />} />
                <Route path="*"     element={<NotFoundPage />} />

              </Routes>
            </main>
          </NotificationProvider>
        </WatchlistProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}