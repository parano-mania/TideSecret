'use client'

import { useCallback, useState } from 'react'
import { useTideCloak } from '@tidecloak/nextjs'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Brand, ShieldIcon } from './components/brand'

export default function LoginPage() {
  const { login, authenticated, isInitializing, initError, isLoading, sessionExpired, needsReauth } = useTideCloak()
  const [loginError, setLoginError] = useState(false)
  const [sessionError, setSessionError] = useState(false)
  const router = useRouter()
  const loginDisabled = isInitializing || Boolean(initError) || isLoading

  const onLogin = useCallback(async () => {
    if (loginDisabled) return
    setLoginError(false)
    try {
      await login()
    } catch {
      setLoginError(true)
    }
  }, [login, loginDisabled])

  useEffect(() => {
    const failed = new URLSearchParams(window.location.search).get('auth') === 'failed'
    setSessionError(failed)
    if (!failed && !isInitializing && !initError && authenticated && !sessionExpired && !needsReauth) {
      router.replace('/home')
    }
  }, [authenticated, isInitializing, initError, sessionExpired, needsReauth, router])

  return (
    <main className="center-page">
        <section className="auth-card" aria-labelledby="login-title">
          <Brand />
          <p className="eyebrow">Your private workspace</p>
          <h1 id="login-title">A little more private.<br />A lot more yours.</h1>
          <p className="auth-description">A quiet place for your secrets, protected through your Tide identity.</p>
          <p className="notice">Plan C demo — TideCloak protections simulated. <a href="/demo">Open offline demo</a></p>
          {initError && (
            <p className="notice error" role="alert">
              TideCloak setup is incomplete or the server is unavailable.
              Complete the official initializer, then refresh this page.
            </p>
          )}
          {loginError && (
            <p className="notice error" role="alert">We couldn’t open sign-in. Please check your connection and try again.</p>
          )}
          {sessionError && <p className="notice error" role="alert">Your session could not be verified. Please sign in again.</p>}
          {isInitializing && <p className="auth-state" role="status"><span className="spinner" aria-hidden="true" />Checking your session…</p>}
          <button
            type="button"
            onClick={onLogin}
            disabled={loginDisabled}
            className="primary full"
          >
            {isLoading && <span className="spinner" aria-hidden="true" />}
            {isInitializing ? 'Connecting…' : isLoading ? 'Opening sign-in…' : 'Sign in with TideCloak'}
          </button>
          <p className="auth-foot">Your identity. Your private vault.</p>
          <div className="badges" style={{ justifyContent: 'center', marginTop: 24 }}><span className="badge"><ShieldIcon /> TideCloak Powered</span></div>
        </section>
    </main>
  )
}
