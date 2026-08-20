'use client'

// #1057: self-contained password reset page. Session arrives either via the
// root-layout fragment bridge (implicit flow) or an existing cookie session.
import { useEffect, useState, type FormEvent } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function client() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string
  )
}

export default function ResetPasswordPage() {
  const [status, setStatus] = useState<'checking' | 'ready' | 'expired'>('checking')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const supabase = client()
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const p = new URLSearchParams(hash.slice(1))
      const access_token = p.get('access_token')
      const refresh_token = p.get('refresh_token')
      if (access_token && refresh_token) {
        supabase.auth.setSession({ access_token, refresh_token }).then(({ error: sessErr }) => {
          window.history.replaceState(null, '', window.location.pathname)
          setStatus(sessErr ? 'expired' : 'ready')
        })
        return
      }
    }
    supabase.auth.getSession().then(({ data }) => setStatus(data.session ? 'ready' : 'expired'))
  }, [])

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (loading) return
    setError(null)
    if (password.length < 8) { setError('Use at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setLoading(true)
    const { error: upErr } = await client().auth.updateUser({ password })
    setLoading(false)
    if (upErr) { setError('Could not update the password. Request a fresh link and try again.'); return }
    setDone(true)
  }

  const box: React.CSSProperties = { maxWidth: 420, margin: '80px auto', padding: 32, fontFamily: 'Inter, system-ui, sans-serif' }
  const input: React.CSSProperties = { display: 'block', width: '100%', padding: '10px 12px', margin: '8px 0 16px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15 }
  const btn: React.CSSProperties = { width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer' }

  if (status === 'checking') return <main style={box}><p>Checking your link…</p></main>
  if (status === 'expired')
    return (
      <main style={box}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Link expired</h1>
        <p style={{ color: '#475569', marginTop: 8 }}>That link has expired or was already used. Request a fresh one from the sign-in page.</p>
        <p style={{ marginTop: 16 }}><a href="/forgot-password" style={{ color: '#0f172a', fontWeight: 600 }}>Request a new link</a></p>
      </main>
    )
  if (done)
    return (
      <main style={box}>
        <h1 style={{ fontSize: 22, fontWeight: 700 }}>Password updated</h1>
        <p style={{ color: '#475569', marginTop: 8 }}>You are signed in with your new password.</p>
        <p style={{ marginTop: 16 }}><a href="/" style={{ color: '#0f172a', fontWeight: 600 }}>Continue</a></p>
      </main>
    )
  return (
    <main style={box}>
      <h1 style={{ fontSize: 22, fontWeight: 700 }}>Choose a new password</h1>
      {error ? <p style={{ color: '#b91c1c', marginTop: 8 }}>{error}</p> : null}
      <form onSubmit={onSubmit} style={{ marginTop: 16 }}>
        <label>New password</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        <label>Confirm password</label>
        <input style={input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
        <button style={btn} type="submit" disabled={loading}>{loading ? 'Saving…' : 'Set new password'}</button>
      </form>
    </main>
  )
}
