// CANONICAL: Root layout for RigFile — fonts, metadata, viewport, global CSS.
// Renders only <html>/<body>: page chrome belongs to each route group's own layout.
import type { Metadata, Viewport } from 'next'
import { Inter, Plus_Jakarta_Sans } from 'next/font/google'
import './globals.css'

const bodyFont = Inter({
  subsets: ['latin'],
  variable: '--font-body',
  display: 'swap',
})

const displayFont = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#0f172a',
}

export const metadata: Metadata = {
  title: {
    default: 'RigFile — DOT compliance calendar for owner-operators',
    template: '%s · RigFile',
  },
  description:
    'Track all 18 driver qualification file items, get warned before anything expires, and generate an audit-ready DQF PDF in one click. Built for owner-operators and fleets of 1–10 trucks.',
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'
  ),
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${displayFont.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  )
}
