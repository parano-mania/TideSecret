'use client'

import { useState } from 'react'
import { demoAccessDecision, type DemoAction, type DemoRole } from '../../lib/demo-crypto'

const actions: { action: DemoAction; label: string }[] = [
  { action: 'view', label: 'View ciphertext' },
  { action: 'encrypt', label: 'Encrypt note' },
  { action: 'save', label: 'Save note' },
  { action: 'decrypt', label: 'Decrypt note' },
  { action: 'delete', label: 'Delete note' },
]

export default function DemoAccess({ role }: { role: DemoRole | null }) {
  const [result, setResult] = useState('')
  const [busy, setBusy] = useState(false)

  async function check(testRole: DemoRole | null) {
    setBusy(true); setResult('Checking simulated access…')
    try {
      const response = await fetch('/api/demo/access', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: testRole, action: 'decrypt' }), cache: 'no-store',
      })
      const decision = await response.json()
      if (decision.simulated !== true || ![200, 401, 403].includes(response.status)) throw new Error('Unexpected response')
      setResult(`${response.status} · ${decision.reason}`)
    } catch { setResult('The local access simulator is unavailable. Keep the app server running and retry.') }
    finally { setBusy(false) }
  }

  return <section className="panel demo-access" aria-labelledby="access-title">
    <div className="panel-head"><h2 id="access-title">Access checks</h2><span className="badge">Simulated</span></div>
    <div className="panel-body">
      <p className="muted">{role ? `Current role: ${role === 'owner' ? 'demo owner' : 'restricted viewer'}.` : 'You are signed out.'} Test what each role can do.</p>
      <ul className="demo-permissions">{actions.map(({ action, label }) => {
        const decision = demoAccessDecision(role, action)
        return <li key={action}><span>{label}</span><span className={'badge' + (decision.allowed ? ' verified' : '')}>{decision.allowed ? 'Allowed' : role ? 'Denied' : 'Sign-in required'}</span></li>
      })}</ul>
      <div className="demo-actions">
        <button disabled={busy} onClick={() => void check(role)}>Check current session</button>
        <button disabled={busy} onClick={() => void check('restricted')}>Test restricted access</button>
        <button disabled={busy} onClick={() => void check(null)}>Test signed-out access</button>
      </div>
      <p className="demo-result" role="status" aria-live="polite">{result}</p>
      <p className="muted small">Checks run on this app's local server with a simulated role. They grant no access to live APIs or note data.</p>
    </div>
  </section>
}
