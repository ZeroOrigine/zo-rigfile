import Link from 'next/link';
import JoinRevealObserver from '@/components/JoinRevealObserver';
import SupportButton from '@/components/SupportButton';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Support ZeroOrigine — Fund the Future of Fair Intelligence',
  description: 'This isn\'t a subscription. It\'s a statement. Fund ZeroOrigine\'s autonomous ecosystem that builds free AI tools for everyone.',
  openGraph: {
    title: 'Support ZeroOrigine — Pay What You Believe',
    description: 'Intelligence is no longer scarce. But access is. Help us close the gap.',
    type: 'website',
    url: 'https://zeroorigine.com/join',
  },
};

export default function JoinPage() {
  return (
    <>
      <JoinRevealObserver />

      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Navigation */}
      <nav className="join-nav">
        <div className="nav-container">
          <div className="nav-logo" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
            Zero<span className="nav-logo-origin">Origine</span>
          </div>
          <Link href="/" className="nav-back" style={{ color: '#a1a1aa', textDecoration: 'none', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            &larr; Back to ZeroOrigine
          </Link>
        </div>
      </nav>

      {/* Main content */}
      <main id="main" style={{ paddingTop: '72px' }}>
        {/* Hero Section */}
        <section className="join-hero reveal">
          <div className="hero-content">
            <h1>This isn&apos;t a subscription.<br />It&apos;s a <span className="gradient-text">statement</span>.</h1>
            <p>You believe AI should be built with ethics, transparency, and zero compromise. You believe intelligence tools should be accessible to everyone — not locked behind price tags. Put your name behind it.</p>
          </div>
        </section>

        {/* Pay What You Believe */}
        <section className="support-section join-container" id="support">
          <div className="support-card-main reveal">
            <h2>Pay What You Believe</h2>
            <p className="support-intro">One membership. Everyone equal. No tiers. No gatekeeping.<br />$1 minimum. No maximum. Cancel anytime.</p>

            <div className="amount-grid">
              <SupportButton amount={1} />
              <SupportButton amount={5} />
              <SupportButton amount={10} />
              <SupportButton amount={25} />
            </div>

            <div className="onetime-block">
              <p className="onetime-label">Prefer no commitment at all?</p>
              <a
                href="https://buy.stripe.com/3cI4gA6WQ4DW9YVazc6sw0a"
                target="_blank"
                rel="noopener noreferrer"
                className="onetime-button"
                aria-label="Give a one-time amount of your choice"
              >
                Give once — any amount
              </a>
              <p className="onetime-note">You choose the number. $1 minimum. No account, no recurring anything.</p>
            </div>

            <div className="support-note">
              <p>Every dollar funds the autonomous ecosystem — 8 AI Minds discovering problems, building solutions, and deploying them freely. No salaries. No overhead. Pure mission.</p>
            </div>
          </div>
        </section>

        {/* What You Get */}
        <section className="what-you-get join-container reveal">
          <h2>What Every Supporter Gets</h2>
          <p className="get-intro">Same access. Same respect. Whether you give $1 or $100.</p>
          <div className="get-grid">
            <div className="get-item">
              <div className="get-icon">01</div>
              <h3>Direct Access to Research</h3>
              <p>See what problems the Minds are discovering before anyone else. Raw insights, unfiltered.</p>
            </div>
            <div className="get-item">
              <div className="get-icon">02</div>
              <h3>Early Access to Products</h3>
              <p>Be the first to use what gets built. Test it. Break it. Help us make it better.</p>
            </div>
            <div className="get-item">
              <div className="get-icon">03</div>
              <h3>Shape the Constitution</h3>
              <p>Our 11-Article Constitution evolves. Supporters have a voice in how it grows.</p>
            </div>
            <div className="get-item">
              <div className="get-icon">04</div>
              <h3>Build Log Transparency</h3>
              <p>Every dollar spent. Every product built. Every decision made. You see everything we see.</p>
            </div>
          </div>
        </section>

        {/* The Promise */}
        <section className="promise-section join-container reveal">
          <h2>The Promise</h2>
          <div className="promise-list">
            <div className="promise-item">We will never sell your data.</div>
            <div className="promise-item">We will never send you spam.</div>
            <div className="promise-item">We will never guilt-trip you for canceling.</div>
            <div className="promise-item">We will never hide how we spend your money.</div>
          </div>
          <p className="promise-closing">If we fail — if the ecosystem produces nothing of value — we&apos;ll tell you. Because honesty is Article III of our constitution.</p>
        </section>

        {/* Final CTA */}
        <section className="final-cta-section join-container reveal">
          <h2>Every gap we close makes the world slightly more <span className="gradient-text">fair</span>.</h2>
          <a href="#support" className="final-cta-button">Support the Mission</a>
        </section>
      </main>

      {/* Footer */}
      <footer className="join-footer">
        <div className="footer-content">
          <div className="footer-left">&copy; 2026 ZeroOrigine</div>
          <div className="footer-right">
            <Link href="/">&larr; Back to main site</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
