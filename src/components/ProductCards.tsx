'use client';

import { useEffect, useState, useCallback } from 'react';

interface Product {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  status: string;
  url: string | null;
  icon: string;
}

const statusLabels: Record<string, string> = {
  live: 'Live',
  building: 'Building',
  approved: 'Approved',
  idea: 'Idea',
  sunset: 'Sunset',
};

export default function ProductCards() {
  const [products, setProducts] = useState<Product[]>([]);
  const [liveCount, setLiveCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch('/api/stats', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok && Array.isArray(data.products)) {
        setProducts(data.products);
        setLiveCount(data.liveCount ?? data.products.length);
        setTotalCount(data.totalCount ?? data.products.length);
      }
    } catch (e) {
      // Keep last-known content; fall back to static page.tsx if empty.
      console.log('Products fetch skipped:', e);
    }
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  if (products.length === 0) {
    return null; // Fallback handled by static content in page.tsx
  }

  return (
    <>
      <h2 className="section-title" style={{ opacity: 1, transform: 'none' }}>
        {liveCount} Live. Building More. Zero Shortcuts.
      </h2>
      <div className="products-grid">
        {products.map((product) => {
          const CardTag = product.url ? 'a' : 'div';
          const linkProps = product.url
            ? { href: product.url, target: '_blank', rel: 'noopener noreferrer' }
            : {};

          return (
            <CardTag
              key={product.slug}
              className="product-card"
              style={{ textDecoration: 'none', color: 'inherit', opacity: 1, transform: 'none' }}
              {...linkProps}
            >
              <div className="product-header">
                <h3>{product.icon} {product.name}</h3>
                <span className={`status-badge status-${product.status}`}>
                  {statusLabels[product.status] || product.status}
                </span>
              </div>
              <p className="product-type">{product.tagline}</p>
              <p className="product-description">{product.description}</p>
            </CardTag>
          );
        })}
      </div>
    </>
  );
}
