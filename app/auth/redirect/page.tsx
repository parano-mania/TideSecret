'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useTideCloak } from '@tidecloak/nextjs'

export default function RedirectPage() {
  const { authenticated, isInitializing, initError, sessionExpired, needsReauth } = useTideCloak()
  const router = useRouter()
  const [callbackFailed, setCallbackFailed] = useState(false)

  useEffect(() => {
    // The provider handles OIDC state/PKCE and code exchange. Never copy or log
    // callback codes or tokens; route only after initialization finishes.
    const params = new URLSearchParams(window.location.search)
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    if (params.has('error') || hashParams.has('error') || params.get('auth') === 'failed') {
      setCallbackFailed(true)
      return
    }
    if (!isInitializing && !initError) {
      router.replace(authenticated && !sessionExpired && !needsReauth ? '/home' : '/')
    }
  }, [authenticated, isInitializing, initError, sessionExpired, needsReauth, router])

  if (initError || callbackFailed) {
    return (
      <main>
        <p role="alert">Authentication could not be completed. Please return to login and try again.</p>
        <Link href="/">Return to login</Link>
      </main>
    )
  }

  return <main><p role="status">Finishing authentication…</p></main>
}
