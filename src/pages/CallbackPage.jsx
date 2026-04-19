// src/pages/CallbackPage.jsx
// Handles Cognito OAuth redirect callback using Amplify

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getSession } from '@/services/authService'

export function CallbackPage() {
  const [status, setStatus] = useState('Finalizing secure connection...')
  const navigate = useNavigate()

  useEffect(() => {
    // Amplify handles the code exchange automatically on session load
    // We just need to wait for it and redirect
    async function handleCallback() {
      try {
        // Give Amplify time to process the URL params
        await new Promise(r => setTimeout(r, 500))
        const session = await getSession()
        if (session) {
          setStatus('Success! Redirecting...')
          navigate('/', { replace: true })
        } else {
          throw new Error('No session after callback')
        }
      } catch (err) {
        console.error('Auth callback error:', err)
        setStatus('Authentication failed. Redirecting...')
        setTimeout(() => navigate('/?error=auth_failed', { replace: true }), 2000)
      }
    }
    handleCallback()
  }, [navigate])

  return (
    <div style={{ background: '#020617', color: 'white', display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p id="status-text">{status}</p>
      </div>
    </div>
  )
}
