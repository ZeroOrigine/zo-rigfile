'use client';

import { useState } from 'react';

export default function SubscribeForm() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('busy');
    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const d = await res.json();
      if (d.ok) {
        setState('done');
        setMsg('You are in. The Minds will write when something real happens.');
      } else {
        setState('error');
        setMsg(d.error || 'Something went wrong.');
      }
    } catch {
      setState('error');
      setMsg('Network hiccup — try again.');
    }
  }

  if (state === 'done') {
    return <p className="subscribe-done" role="status">{msg}</p>;
  }

  return (
    <form className="subscribe-form" onSubmit={submit} aria-label="Follow the experiment by email">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        aria-label="Email address"
        disabled={state === 'busy'}
      />
      <button type="submit" disabled={state === 'busy'}>
        {state === 'busy' ? 'Joining…' : 'Follow the experiment'}
      </button>
      {state === 'error' && <p className="subscribe-error" role="alert">{msg}</p>}
    </form>
  );
}
