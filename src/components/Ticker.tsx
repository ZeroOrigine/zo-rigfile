'use client';

import { useEffect, useState } from 'react';

interface Item { mind: string; line: string; product: string | null; at: string }

export default function Ticker({ initial }: { initial: Item[] }) {
  const [items, setItems] = useState<Item[]>(initial);

  useEffect(() => {
    const load = async () => {
      try {
        const r = await fetch('/api/pulse', { cache: 'no-store' });
        const d = await r.json();
        if (d?.ok && d.events?.length) setItems(d.events);
      } catch { /* keep last known */ }
    };
    const t = setInterval(load, 45000);
    return () => clearInterval(t);
  }, []);

  if (!items.length) return null;
  const text = items
    .map((e) => `${e.mind.toUpperCase()} ${e.line.toUpperCase()}${e.product ? ' · ' + e.product.toUpperCase() : ''}`)
    .join('  ···  ');

  return (
    <div className="mc-ticker" aria-hidden="true">
      <div className="mc-ticker-inner">{text}  ···  {text}</div>
    </div>
  );
}
