'use client';

import { useState } from 'react';

interface DonateButtonProps {
  amount: number;
  label: string;
  className?: string;
}

const RAILWAY_URL = process.env.NEXT_PUBLIC_RAILWAY_URL || 'https://zo-langgraph-production-3c96.up.railway.app';

export default function DonateButton({ amount, label, className = '' }: DonateButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAILWAY_URL}/donations/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount }),
      });

      if (!res.ok) {
        throw new Error('Failed to create checkout session');
      }

      const data = await res.json();
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`tier-button ${className}`}
      style={{ opacity: loading ? 0.7 : 1 }}
      aria-label={`Choose ${label} tier at ${amount} dollar${amount === 1 ? '' : 's'} per month`}
    >
      {loading ? 'Redirecting...' : `Choose ${label}`}
    </button>
  );
}
