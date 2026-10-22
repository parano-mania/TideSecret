'use client'

import { useTideCloak } from '@tidecloak/nextjs'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { LockIcon, ShieldIcon } from '../../components/brand'
import { deleteEncryptedNote, noteStorageKey, readEncryptedNotes, saveEncryptedNote,
  type EncryptedNote } from '../../../lib/encrypted-notes'
import { tidecloakConfig } from '../../../lib/tidecloak'

const TAG = 'secret'

function failureMessage(error: unknown, operation: 'Encryption' | 'Decryption'): string {
  // Do not display arbitrary SDK error payloads, which may contain sensitive
  // data. Recognize actionable categories without logging the error or claims.
  const message = error instanceof Error ? error.message.toLowerCase() : ''
  if (message.includes('not authenticated') || message.includes('token expired')) {
    return `${operation} failed: your session is unavailable. Log out and sign in again.`
  }
  if (message.includes('access') || message.includes('permission') || message.includes('role')) {
    return `${operation} failed: check the committed secret permissions, then sign in again.`
  }
  if (message.includes('cancel') || message.includes('denied')) {
    return `${operation} was cancelled or denied. You can try again.`
  }
  return `${operation} failed in TideCloak. Check your session, QEA, license, and secret permissions before retrying.`
}

export default function E2eePage() {
  const { authenticated, isInitializing, initError, sessionExpired, needsReauth,
    getValueFromIdToken } = useTideCloak()

  if (isInitializing) return <main className="center-page"><p className="auth-state" role="status"><span className="spinner" aria-hidden="true" />Checking your session…</p></main>
  if (initError || !authenticated || sessionExpired || needsReauth) {
    return <main className="center-page"><section className="auth-card"><p className="notice error" role="alert">Sign in with your Tide account to open your vault.</p><Link className="button" href="/">Return to sign-in</Link></section></main>
  }
  const subject: unknown = getValueFromIdToken('sub')
  if (typeof subject !== 'string' || !subject) {
    return <main className="center-page"><section className="auth-card"><p className="notice error" role="alert">We couldn’t identify your signed-in account.</p><Link className="button" href="/">Return to sign-in</Link></section></main>
  }

  // A changed identity remounts the form, dropping in-memory plaintext and
  // loading only the new account's ciphertext namespace.
  const storageKey = noteStorageKey(tidecloakConfig, subject)
  return <E2eeTest key={storageKey} storageKey={storageKey} />
}

function E2eeTest({ storageKey }: { storageKey: string }) {
  const { doEncrypt, doDecrypt, hasRealmRole, isLoading } = useTideCloak()
  const [plaintext, setPlaintext] = useState('')
  const [ciphertext, setCiphertext] = useState('')
  const [decrypted, setDecrypted] = useState('')
  const [busy, setBusy] = useState<'encrypt' | 'decrypt' | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [notes, setNotes] = useState<EncryptedNote[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [storageState, setStorageState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [pendingDelete, setPendingDelete] = useState<EncryptedNote | null>(null)
  const [roundTripVerified, setRoundTripVerified] = useState(false)
  const mounted = useRef(false)
  const inFlight = useRef(false)
  const deleteDialog = useRef<HTMLDialogElement>(null)
  // A temporary comparison value in memory only; never passed to storage.
  const roundTripInput = useRef<string | null>(null)
  const canEncrypt = hasRealmRole('_tide_secret.selfencrypt')
  const canDecrypt = hasRealmRole('_tide_secret.selfdecrypt')

  useEffect(() => {
    mounted.current = true
    try {
      const restored = readEncryptedNotes(window.localStorage, storageKey)
      setNotes(restored)
      const latest = restored[restored.length - 1]
      if (latest) {
        setSelectedId(latest.id)
        setCiphertext(latest.ciphertext)
      }
      setStorageState('ready')
    } catch {
      setStorageState('error')
      setError('Saved notes could not be read. Check browser storage and refresh. Existing data has not been changed.')
    }
    return () => { mounted.current = false; roundTripInput.current = null }
  }, [storageKey])

  useEffect(() => {
    const dialog = deleteDialog.current
    if (pendingDelete && dialog && !dialog.open) dialog.showModal()
    if (!pendingDelete && dialog?.open) dialog.close()
  }, [pendingDelete])

  function persistCiphertext(payload: string) {
    if (storageState !== 'ready') return
    setError('')
    setSuccess('')
    if (!payload) {
      setError('Encrypt secret text before saving.')
      return
    }
    try {
      const updated = saveEncryptedNote(window.localStorage, storageKey, payload)
      setNotes(updated)
      setSelectedId(updated[updated.length - 1].id)
      setSuccess('Encrypted note saved in this browser. No plaintext was saved.')
    } catch {
      setError('The encrypted note could not be saved. Browser storage may be full, blocked, or damaged. The ciphertext is still available on this page.')
    }
  }

  function saveNote() {
    if (!inFlight.current) persistCiphertext(ciphertext)
  }

  function selectNote(note: EncryptedNote) {
    if (inFlight.current) return
    if (note.ciphertext !== ciphertext) roundTripInput.current = null
    setSelectedId(note.id)
    setCiphertext(note.ciphertext)
    setDecrypted('')
    setError('')
    setSuccess('Saved ciphertext selected. Use Decrypt with TideCloak to read it.')
  }

  function deleteNote(note: EncryptedNote) {
    if (inFlight.current || storageState !== 'ready') return
    setError('')
    setSuccess('')
    try {
      const updated = deleteEncryptedNote(window.localStorage, storageKey, note.id)
      setNotes(updated)
      if (selectedId === note.id) {
        setSelectedId(null)
        setCiphertext('')
        setDecrypted('')
        roundTripInput.current = null
      }
      setSuccess('Encrypted note deleted from this browser.')
    } catch {
      setError('The note could not be deleted from browser storage. Refresh to check the saved state.')
    }
  }

  async function encrypt() {
    if (inFlight.current || isLoading) return
    setError('')
    setSuccess('')
    if (storageState !== 'ready') {
      setError('Your browser storage isn’t ready. Check the storage message before saving a new note.')
      return
    }
    if (!canEncrypt) {
      setError('Missing _tide_secret.selfencrypt. Have the grant approved and committed, then sign in again.')
      return
    }
    if (!plaintext.trim()) {
      setError('Enter secret text before encrypting.')
      return
    }
    inFlight.current = true
    setBusy('encrypt')
    roundTripInput.current = null
    setSelectedId(null)
    setCiphertext('')
    setDecrypted('')
    try {
      const result: unknown = await doEncrypt([{ data: plaintext, tags: [TAG] }])
      if (!Array.isArray(result) || result.length !== 1 || typeof result[0] !== 'string' || !result[0] || result[0] === plaintext) {
        throw new Error('Unexpected TideCloak encryption result')
      }
      if (!mounted.current) return
      setCiphertext(result[0])
      roundTripInput.current = plaintext
      setPlaintext('')
      persistCiphertext(result[0])
    } catch (cause: unknown) {
      if (mounted.current) setError(failureMessage(cause, 'Encryption'))
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(null)
    }
  }

  async function decrypt(savedNote?: EncryptedNote) {
    if (inFlight.current || isLoading) return
    setError('')
    setSuccess('')
    const payload = savedNote?.ciphertext ?? ciphertext
    if (savedNote) { selectNote(savedNote); setSuccess('') }
    if (!canDecrypt) {
      setError('Missing _tide_secret.selfdecrypt. Have the grant approved and committed, then sign in again.')
      return
    }
    if (!payload) {
      setError('Select a saved note or encrypt secret text first; there is no ciphertext to decrypt.')
      return
    }
    inFlight.current = true
    setBusy('decrypt')
    setDecrypted('')
    try {
      // Preserve the actual SDK-returned ciphertext; no encoding or replacement.
      const result: unknown = await doDecrypt([{ encrypted: payload, tags: [TAG] }])
      if (!Array.isArray(result) || result.length !== 1 || typeof result[0] !== 'string') {
        throw new Error('Unexpected TideCloak decryption result')
      }
      if (!mounted.current) return
      setDecrypted(result[0])
      const expected = roundTripInput.current
      roundTripInput.current = null
      if (expected !== null && result[0] !== expected) {
        setRoundTripVerified(false)
        setError('The decrypted text did not match the original. Please stop and check your TideCloak setup.')
        return
      }
      if (expected !== null) setRoundTripVerified(true)
      setSuccess(expected !== null ? 'Decryption complete. The text matches your original exactly.' : 'Note decrypted. Plaintext is visible only in this page session.')
    } catch (cause: unknown) {
      if (mounted.current) {
        setRoundTripVerified(false)
        setError(failureMessage(cause, 'Decryption'))
      }
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(null)
    }
  }

  return (
    <main className="vault">
      <section className="vault-heading" aria-labelledby="vault-title">
        <div><p className="eyebrow">Your secrets belong to you</p><h1 id="vault-title">Your Private Vault</h1><p>Write freely. Encrypt with TideCloak. Keep only ciphertext on this device.</p></div>
        <div className="badges"><span className="badge"><ShieldIcon /> TideCloak Powered</span>
          {roundTripVerified && canEncrypt && canDecrypt ? <span className="badge verified" title="A matching encrypt/decrypt round trip was verified in this page session."><span className="status-dot" />E2EE Enabled</span> : <span className="badge">E2EE not yet verified</span>}
        </div>
      </section>
      {error && <p className="notice error" role="alert">{error}</p>}
      {success && <p className="notice success" role="status">{success}</p>}
      {(!canEncrypt || !canDecrypt) && <p className="notice error" role="alert">Your account needs permission to {[
        !canEncrypt && 'encrypt', !canDecrypt && 'decrypt',
      ].filter(Boolean).join(' and ')}. Have an administrator approve the secret permissions, then sign in again.</p>}
      <div className="vault-grid">
        <section className="panel" aria-labelledby="editor-heading" aria-busy={Boolean(busy)}>
          <div className="panel-head"><div className="panel-title"><LockIcon /><h2 id="editor-heading">Create a secret note</h2></div><span className="badge">Private input</span></div>
          <div className="panel-body">
            <label htmlFor="secret-text">What would you like to keep private?</label>
            <textarea className="editor" id="secret-text" value={plaintext} placeholder="Your next idea, a personal reminder, something just for you?" onChange={(event) => {
              setPlaintext(event.target.value)
              setSuccess('')
              setError('')
            }} rows={7} autoComplete="off" spellCheck={false} disabled={Boolean(busy) || isLoading} />
            <div className="editor-footer"><span className="editor-hint">Only the encrypted payload is saved in your browser.</span><button className="primary" type="button" onClick={encrypt} disabled={Boolean(busy) || isLoading || !canEncrypt || storageState !== 'ready'}>{busy === 'encrypt' ? <><span className="spinner" aria-hidden="true" />Encrypting & saving?</> : <><LockIcon />Encrypt & Save</>}</button></div>
          </div>
        </section>
        <section className="panel" aria-labelledby="saved-heading">
          <div className="panel-head"><div className="panel-title"><ShieldIcon /><h2 id="saved-heading">Saved encrypted notes</h2></div><span className="badge">{notes.length} {notes.length === 1 ? 'note' : 'notes'}</span></div>
          {storageState === 'loading' && <div className="empty"><p role="status">Loading your encrypted notes?</p></div>}
          {storageState === 'error' && <div className="panel-body"><p className="notice error" role="alert">Your saved notes couldn?t be loaded. Refresh after checking browser storage; existing data hasn?t been changed.</p></div>}
          {storageState === 'ready' && notes.length === 0 && <div className="empty"><div className="empty-icon"><LockIcon width="26" height="26" /></div><h3>A little space for your secrets.</h3><p>Encrypt your first note. Its ciphertext will appear here, ready whenever you need it.</p></div>}
          <ul className="note-list">
            {notes.map((note, index) => <li className={selectedId === note.id ? 'note-row selected' : 'note-row'} key={note.id}>
              <div className="note-top"><span className="note-title">Secret note {index + 1}</span><span className="badge"><LockIcon />Encrypted Payload</span></div>
              <time className="note-date" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
              <span className="note-preview">{note.ciphertext.slice(0, 90)}</span>
              <div className="note-actions"><button type="button" onClick={() => { void decrypt(note) }} disabled={Boolean(busy) || isLoading || !canDecrypt}>{busy === 'decrypt' && selectedId === note.id ? <><span className="spinner" aria-hidden="true" />Decrypting?</> : 'Decrypt'}</button><button className="ghost" type="button" onClick={() => selectNote(note)} disabled={Boolean(busy) || isLoading}>View payload</button><button className="danger" type="button" aria-label={'Delete secret note ' + (index + 1)} onClick={() => setPendingDelete(note)} disabled={Boolean(busy) || isLoading || storageState !== 'ready'}>Delete</button></div>
            </li>)}
          </ul>
        </section>
      </div>
      <div className="output-grid">
        <section className="panel" aria-labelledby="payload-heading"><div className="panel-head"><h2 id="payload-heading">Behind the privacy</h2><span className="badge">{ciphertext ? 'Encrypted Payload' : 'Payload preview'}</span></div><div className="panel-body">
          <label htmlFor="ciphertext">Ciphertext</label><textarea id="ciphertext" value={ciphertext} readOnly rows={5} autoComplete="off" spellCheck={false} placeholder="Your TideCloak ciphertext will appear here." />
          <div className="output-foot"><p>The exact payload returned by TideCloak.</p>{ciphertext && selectedId === null && <button type="button" onClick={saveNote} disabled={Boolean(busy) || isLoading || storageState !== 'ready'}>Retry save</button>}</div>
        </div></section>
        <section className="panel" aria-labelledby="decrypted-heading"><div className="panel-head"><h2 id="decrypted-heading">For your eyes</h2><span className="badge">In memory only</span></div><div className="panel-body">
          <label htmlFor="decrypted-text">Decrypted note</label><textarea id="decrypted-text" value={decrypted} readOnly rows={5} autoComplete="off" spellCheck={false} placeholder="Select a note and decrypt it to reveal its contents." />
          <div className="output-foot"><p>Decrypted text is never saved to note storage.</p><button type="button" onClick={() => { void decrypt() }} disabled={Boolean(busy) || isLoading || !canDecrypt || !ciphertext}>{busy === 'decrypt' ? <><span className="spinner" aria-hidden="true" />Decrypting?</> : 'Decrypt note'}</button></div>
        </div></section>
      </div>
      <footer className="vault-footer"><span><ShieldIcon />Powered by TideCloak ? Stored on this device</span><span>No cloud synchronization. Plaintext stays out of note storage.</span></footer>
      <dialog ref={deleteDialog} aria-labelledby="delete-title" aria-describedby="delete-description" onCancel={() => setPendingDelete(null)} onClose={() => setPendingDelete(null)}>
        <h2 id="delete-title">Delete this note?</h2><p id="delete-description">This removes the encrypted note from this browser. It can?t be undone.</p>
        <div className="dialog-actions"><button type="button" autoFocus onClick={() => setPendingDelete(null)}>Keep note</button><button className="danger" type="button" onClick={() => { if (pendingDelete) deleteNote(pendingDelete); setPendingDelete(null) }}>Delete note</button></div>
      </dialog>
    </main>
  )
}
