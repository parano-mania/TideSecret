'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { TideCloakProvider } from '@tidecloak/nextjs'
import tcConfig from '../../tidecloak.json'
import { isTidecloakConfigured } from '../../lib/tidecloak'
import { Brand } from './brand'

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  // Never mount the SDK on the offline route, even when live config exists.
  if (pathname === '/demo' || pathname.startsWith('/demo/')) return children
  if (isTidecloakConfigured) return <TideCloakProvider config={tcConfig}>{children}</TideCloakProvider>
  return <main className="center-page"><section className="auth-card">
    <Brand />
    <p className="eyebrow">Your private workspace</p>
    <h1>Your vault is almost ready.</h1>
    <p className="auth-description">Try the full notes workflow offline while Tide's network recovers.</p>
    <p className="notice">Plan C demo — TideCloak protections simulated.</p>
    <a className="button primary full" href="/demo">Open Plan C demo</a>
    <p className="auth-foot">Live integration</p>
    <p className="notice" role="status">TideCloak setup required for live sign-in. Complete setup and account enrollment, then refresh.</p>
    <a className="button full" href="http://localhost:8080/">Open TideCloak setup</a>
  </section></main>
}
