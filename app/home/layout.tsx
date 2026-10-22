'use client'

import { useTideCloak } from '@tidecloak/nextjs'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState, type ReactNode } from 'react'
import { Brand } from '../components/brand'

// The existing dashboard's session checks and logout handler live in this
// shared layout so both vault URLs receive the same navigation and protection.
export default function HomeLayout({ children }: { children: ReactNode }) {
  const { authenticated, isInitializing, initError, sessionExpired, needsReauth,
    isLoading, getValueFromIdToken, logout } = useTideCloak()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState(false)
  const hasSession = authenticated && !sessionExpired && !needsReauth

  useEffect(() => {
    if (!isInitializing && !initError && !hasSession && !signingOut) {
      router.replace('/')
    }
  }, [isInitializing, initError, hasSession, signingOut, router])

  async function onLogout() {
    setLogoutError(false)
    setSigningOut(true)
    try {
      await logout()
    } catch {
      setSigningOut(false)
      setLogoutError(true)
    }
  }

  if (initError) {
    return <main className="center-page"><section className="auth-card"><Brand /><p className="notice error" role="alert">We couldn’t connect to your session.</p><Link className="button" href="/">Return to sign-in</Link></section></main>
  }
  if (isInitializing || signingOut || !hasSession) {
    return <main className="center-page"><p className="auth-state" role="status"><span className="spinner" aria-hidden="true" />{signingOut ? 'Signing out…' : 'Checking your session…'}</p></main>
  }

  const claim: unknown = getValueFromIdToken('preferred_username')
  const username = typeof claim === 'string' && claim.trim() ? claim : 'Signed-in user'

  return <>
    <header className="topbar"><nav className="topbar-inner" aria-label="Main navigation">
      <Link href="/home" aria-label="TideSecret home"><Brand /></Link>
      <div className="account"><span className="account-name" title={username}><span className="account-dot" />{username}</span><button className="ghost" onClick={onLogout} disabled={isLoading}>Log out</button></div>
    </nav></header>
    {logoutError && <div className="vault"><p className="notice error" role="alert">We couldn’t finish signing out. Please try again.</p></div>}
    {children}
  </>
}
