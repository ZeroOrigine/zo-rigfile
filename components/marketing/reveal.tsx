'use client'
// CANONICAL: components/marketing/reveal.tsx — scroll-into-view fade/rise wrapper (no layout shift, reduced-motion aware, no-JS safe)

import { useEffect, useRef, useState, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  delay?: number
  className?: string
}

export default function Reveal({ children, delay = 0, className = '' }: RevealProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  // Server-rendered state is fully visible: no flash of hidden content if JS is slow or absent,
  // and no cumulative layout shift (translate does not reflow).
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Only animate elements that start below the fold — above-fold content stays visible.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return

    setHidden(true)
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0] && entries[0].isIntersecting) {
          setHidden(false)
          observer.disconnect()
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -8% 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
      className={`transition-all duration-700 ease-out ${hidden ? 'translate-y-6 opacity-0' : 'translate-y-0 opacity-100'} ${className}`}
    >
      {children}
    </div>
  )
}
