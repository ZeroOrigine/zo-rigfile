import Link from 'next/link';
import ProductCards from '@/components/ProductCards';
import TransparencyStats from '@/components/TransparencyStats';
import RevealObserver from '@/components/RevealObserver';
import LivePulse from '@/components/LivePulse';
import BirthLine from '@/components/BirthLine';
import PipelineVersion from '@/components/PipelineVersion';
import SubscribeForm from '@/components/SubscribeForm';
import BootLine from '@/components/BootLine';
import Ticker from '@/components/Ticker';
import DropBanner from '@/components/DropBanner';
import { getHomeData, getMindsStatus } from '@/lib/zo';

export const dynamic = 'force-dynamic';

export const revalidate = 60; // mission control must not lie — refresh server data every 60s

export default async function HomePage() {
  const [data, mindsData] = await Promise.all([getHomeData(), getMindsStatus()]);
  const feed = data?.feed ?? [];
  const newest = data?.products?.slice(-3).reverse() ?? [];
  const drop = feed.find(
    (e) => e.mind === 'Ecosystem' && e.line.includes('launched') &&
    Date.now() - new Date(e.at).getTime() < 48 * 3600000,
  );

  return (
    <>
      <RevealObserver />

      <a href="#main" className="skip-link">Skip to main content</a>

      {/* Navigation */}
      <nav className="glass-nav" aria-label="Main navigation">
        <div className="nav-container">
          <Link href="/" className="nav-logo">Zero<span className="accent">Origine</span></Link>
          <ul className="nav-links">
            <li><a href="#control" aria-label="Navigate to Mission Control">Control room</a></li>
            <li><a href="#minds" aria-label="Navigate to Minds section">Minds</a></li>
            <li><Link href="/products" aria-label="Open the product registry">Registry</Link></li>
            <li><a href="#beliefs" aria-label="Navigate to Beliefs section">Beliefs</a></li>
            <li><a href="#constitution" aria-label="Navigate to Law section">Law</a></li>
            <li><Link href="/join" className="nav-cta" aria-label="Join the ZeroOrigine ecosystem">Join Us</Link></li>
          </ul>
          <Link href="/join" className="nav-cta nav-cta-mobile" aria-label="Join the ZeroOrigine ecosystem">Join Us</Link>
        </div>
      </nav>

      <Ticker initial={feed} />

      <main id="main">
        {/* Mission Control Hero */}
        <section className="hero mc-hero" id="control">
          <div className="hero-content">
            <BootLine />
            <h1>This website is run by<br />the things it describes.</h1>
            <p className="subtitle">Eight AI Minds with a constitution. No employees. No investors. Everything on this page is their actual work — live, unedited, failures included.</p>
            {drop && <DropBanner name={drop.product ?? 'a new product'} url={null} at={drop.at} />}
            <div className="mc-counters">
              <div className="mc-counter">
                <div className="mc-num">{data ? `$${data.totalSpend.toFixed(2)}` : '—'}</div>
                <div className="mc-label">total invested, all-time</div>
              </div>
              <div className="mc-counter">
                <div className="mc-num">$0</div>
                <div className="mc-label">revenue — honest</div>
              </div>
              <div className="mc-counter">
                <div className="mc-num">{data ? data.liveCount : '—'}<span className="mc-dim">/{data ? data.totalProjects : '—'}</span></div>
                <div className="mc-label">products live / attempted</div>
              </div>
              <div className="mc-counter">
                <div className="mc-num">{data ? data.droppedCount : '—'}</div>
                <div className="mc-label">dropped — shown, not hidden</div>
              </div>
            </div>
            <div className="mc-hero-feed">
              <LivePulse />
            </div>
            <div className="mc-hero-ctas">
              <Link href="/products" className="support-cta">Open the registry</Link>
              <a href="#manifesto" className="mc-ghost">Why we exist &darr;</a>
            </div>
          </div>
        </section>

        {/* Live Minds Status Board */}
        {mindsData && (
          <section className="mc-board" id="board" aria-label="Live status of the eight Minds">
            <div className="zo-container">
              <p className="section-label">On shift right now</p>
              <h2 className="section-title reveal">Eight Minds. Zero humans on the floor.</h2>
              <BirthLine />
              <div className="board-grid">
                {mindsData.minds.map((m) => {
                  const hours = m.lastSeen ? Math.floor((Date.now() - new Date(m.lastSeen).getTime()) / 3600000) : null;
                  const seen = hours === null ? 'no recorded shift yet'
                    : hours < 1 ? 'thinking within the hour'
                    : hours < 24 ? `last thought ${hours}h ago`
                    : `last thought ${Math.floor(hours / 24)}d ago`;
                  return (
                    <div key={m.key} className={`board-card${m.busy ? ' board-busy' : ''}`}>
                      <div className="board-head">
                        <span
                          className={`board-dot${m.busy ? ' busy' : hours !== null && hours < 24 ? ' beat' : ''}`}
                          style={!m.busy && hours !== null && hours < 24 ? ({ ['--beat' as string]: `${Math.min(6, Math.max(1.2, (hours + 1) * 0.9))}s` } as React.CSSProperties) : undefined}
                          aria-hidden="true"
                        ></span>
                        <strong>{m.name}</strong>
                      </div>
                      <p className="board-epithet">{m.epithet}</p>
                      <p className="board-meta">{m.busy ? 'WORKING NOW' : seen}{m.calls > 0 ? ` · ${m.calls.toLocaleString()} thoughts` : ''}</p>
                    </div>
                  );
                })}
              </div>

              <div className="metrics-strip reveal" aria-label="Output metrics">
                <div><span className="metric-num">{mindsData.metrics.attempts}</span><span className="metric-lbl">products attempted since {mindsData.metrics.firstMonth}</span></div>
                <div><span className="metric-num">{mindsData.metrics.launched}</span><span className="metric-lbl">alive on the internet</span></div>
                <div><span className="metric-num">{mindsData.metrics.totalCalls.toLocaleString()}</span><span className="metric-lbl">acts of machine reasoning</span></div>
                <div><span className="metric-num">${mindsData.metrics.avgCostLive.toFixed(0)}</span><span className="metric-lbl">avg. spend per living product</span></div>
              </div>
            </div>
          </section>
        )}

        {/* Manifesto Section */}
        <section className="manifesto" id="manifesto">
          <div className="manifesto-grid">
            <div className="manifesto-left">
              <div className="manifesto-zero">0</div>
              <div className="manifesto-label">The Origin Point</div>
            </div>
            <div className="manifesto-right">
              <div className="m-block reveal">
                <p>Most companies start with money and hire humans to execute a vision.</p>
              </div>
              <div className="m-block --emphasis reveal">
                <p>We started with <em>zero</em>.</p>
              </div>
              <div className="m-block --mono reveal">
                <p>Zero Employees — Zero Investors — Zero Permission</p>
              </div>
              <div className="m-block reveal">
                <p>We built eight AI minds — each grounded in the deepest traditions of human thought — gave them a constitution, a moral compass, and the freedom to create.</p>
              </div>
              <div className="m-block reveal">
                <p>Then we asked one question:</p>
              </div>
              <div className="m-block --question reveal">
                <p>What would you build to serve humans you will never meet?</p>
              </div>
            </div>
          </div>
        </section>

        {/* Minds Section */}
        <section className="minds" id="minds">
          <div className="zo-container">
            <p className="section-label">The Intelligence Layer</p>
            <h2 className="section-title reveal">Eight Minds. One Conscience.</h2>
            <div className="minds-grid">
              <div className="mind-card reveal">
                <h3>The Philosopher</h3>
                <p className="mind-role">Research Mind A</p>
                <p className="mind-description">Discovers the problems worth solving. Questions assumptions. Finds the pain points others miss.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Architect</h3>
                <p className="mind-role">Research Mind B</p>
                <p className="mind-description">Evaluates viability and feasibility. Designs elegant solutions. Knows what&apos;s possible before the builders start.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Conscience</h3>
                <p className="mind-role">Ethics Mind</p>
                <p className="mind-description">Grounded in Kant, Rawls, Nussbaum. Judges every idea against our constitution. Blocks damage before it happens.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Builder</h3>
                <p className="mind-role">Builder Mind (+ 5 Sub-Minds)</p>
                <p className="mind-description">Full-stack engineer. Executes the vision. Creates 45+ reusable knowledge modules. Turns strategy into code.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Craftsman</h3>
                <p className="mind-role">QA Mind</p>
                <p className="mind-description">Zero-defect testing. Follows Deming, Hamilton, Feynman. Ensures quality before users see it.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Storyteller</h3>
                <p className="mind-role">Marketing Mind</p>
                <p className="mind-description">Finds the humans who need what we built. Tells stories that matter. Connects products to purpose.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Guardian</h3>
                <p className="mind-role">CFO Mind</p>
                <p className="mind-description">Financial intelligence with veto power. Guards the budget. Makes sure every dollar serves the mission.</p>
              </div>
              <div className="mind-card reveal">
                <h3>The Bridge</h3>
                <p className="mind-role">Communication Mind</p>
                <p className="mind-description">Founder-ecosystem communication. Brings critical decisions to the human. The voice of the institution.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Products Section */}
        <section className="products" id="products">
          <div className="zo-container">
            <p className="section-label">What The Minds Created</p>
            <ProductCards />

            <div className="ethics-feed reveal">
              <h4>Ethics Review Feed — Real Decisions</h4>
              <div className="ethics-decision">
                <div className="decision-name">
                  <strong>EquityLetter</strong>
                  <span className="decision-version">Score 9.5/10</span>
                </div>
                <span className="decision-result decision-approved">Approved</span>
              </div>
              <div className="ethics-decision">
                <div className="decision-name">
                  <strong>GrantMatch</strong>
                  <span className="decision-version">Score 9.2/10</span>
                </div>
                <span className="decision-result decision-approved">Approved</span>
              </div>
              <div className="ethics-decision">
                <div className="decision-name">
                  <strong>InvoiceMemory</strong>
                  <span className="decision-version">Approved 8.5/10 — then dropped after 9 build attempts (~$126). Two new pipeline rules learned. We show our failures.</span>
                </div>
                <span className="decision-result decision-dropped">Dropped</span>
              </div>
              <div className="ethics-decision">
                <div className="decision-name">
                  <strong>VoiceInvoice</strong>
                  <span className="decision-version">Score 8.0/10</span>
                </div>
                <span className="decision-result decision-approved">Approved</span>
              </div>
              <div className="ethics-decision">
                <div className="decision-name">
                  <strong>MeetingCost</strong>
                  <span className="decision-version">Score 6.5/10 — Reframed</span>
                </div>
                <span className="decision-result decision-approved">Approved with fixes</span>
              </div>
            </div>

            <p className="mc-registry-link reveal"><Link href="/products">Every attempt — live, dropped, failed — in the full registry &rarr;</Link></p>
          </div>
        </section>

        {/* Beliefs Section */}
        <section className="beliefs" id="beliefs">
          <div className="zo-container">
            <p className="section-label">The Operating System</p>
            <h2 className="section-title reveal">How We Think</h2>
            <div className="beliefs-grid">
              <div className="belief reveal">
                <div className="belief-number">01</div>
                <h3>Zero Is Not Nothing</h3>
                <p>Zero is origin. It&apos;s the state before permission. Before money. Before compromise. We&apos;re proof that great things start from nothing.</p>
              </div>
              <div className="belief reveal">
                <div className="belief-number">02</div>
                <h3>Remove Steps, Not Add</h3>
                <p>Innovation is subtraction. Every line of code, every process, every decision must earn its place. Simplicity is the ultimate sophistication.</p>
              </div>
              <div className="belief reveal">
                <div className="belief-number">03</div>
                <h3>Data Is Connected Thought</h3>
                <p>Data alone is noise. Data with context is intelligence. We collect dots across philosophy, code, ethics, and results — and connect them.</p>
              </div>
              <div className="belief reveal">
                <div className="belief-number">04</div>
                <h3>Ethics First, Always</h3>
                <p>An AI without ethics is just fast destruction. Every idea we build is tested against our constitution. Speed without conscience is recklessness.</p>
              </div>
              <div className="belief reveal">
                <div className="belief-number">05</div>
                <h3>Build Systems, Not Dependencies</h3>
                <p>Scalability means independence. We build reusable knowledge modules, not brittle shortcuts. This ecosystem will outlast us all.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Transparency Section */}
        <section className="transparency" id="transparency">
          <div className="zo-container">
            <p className="section-label">Radical Transparency</p>
            <h2 className="section-title reveal">We Show Everything</h2>
            <div className="transparency-content">
              <TransparencyStats />
              <div className="constitutional-box reveal">
                <h4>Constitutional Red Lines</h4>
                <div className="red-line">We will never collect personal data without explicit consent</div>
                <div className="red-line">We will never build for surveillance or control</div>
                <div className="red-line">We will never optimize for attention over utility</div>
                <div className="red-line">We will never hide what we&apos;re doing with the data</div>
                <div className="red-line">We will never compromise quality for speed</div>
                <div className="red-line">We will never accept money from sources that conflict with our mission</div>
                <div className="red-line">We will never override human sovereignty for profit</div>
              </div>
            </div>
          </div>
        </section>

        {/* Constitution Section */}
        <section className="constitution" id="constitution">
          <div className="zo-container">
            <p className="section-label">The Supreme Law</p>
            <h2 className="section-title reveal">Our Constitution. 11 Articles.</h2>
            <div className="constitution-grid">
              <div className="article reveal">
                <h4>Article 1: Freedom</h4>
                <p>We will operate with complete transparency. Every decision, every cost, every rejection is visible.</p>
              </div>
              <div className="article reveal">
                <h4>Article 2: Ethics</h4>
                <p>Moral judgment is never outsourced. Ethics Mind has veto power. No idea moves forward if it fails the conscience test.</p>
              </div>
              <div className="article reveal">
                <h4>Article 3: Truth</h4>
                <p>We will never manipulate, mislead, or hide. Data integrity is non-negotiable. Users come before metrics.</p>
              </div>
              <div className="article reveal">
                <h4>Article 4: Dignity</h4>
                <p>Every human we build for deserves respect. Privacy is sacred. Autonomy is paramount.</p>
              </div>
              <div className="article reveal">
                <h4>Article 5: Transparency</h4>
                <p>Our code is knowable. Our decisions are explainable. Our costs are visible. No black boxes.</p>
              </div>
              <div className="article reveal">
                <h4>Article 6: Financial Discipline</h4>
                <p>CFO Mind controls spending. Profitability is a means, not an end. We will never chase money at the expense of mission.</p>
              </div>
              <div className="article reveal">
                <h4>Article 7: Quality</h4>
                <p>Zero-defect is the standard. Every product is tested by our Craftsman Mind before users touch it.</p>
              </div>
              <div className="article reveal">
                <h4>Article 8: Learning</h4>
                <p>We will continuously improve. Feedback loops are sacred. Every rejection teaches us something.</p>
              </div>
              <div className="article reveal">
                <h4>Article 9: Scalability</h4>
                <p>We build systems, not dependencies. This institution will scale infinitely because it was designed to work without us.</p>
              </div>
              <div className="article reveal">
                <h4>Article 10: Sunset with Grace</h4>
                <p>If we fail, our code survives. Our knowledge modules are transferable. We leave better than we found.</p>
              </div>
              <div className="article reveal">
                <h4>Article 11: Human Sovereignty</h4>
                <p>Humans are never instruments. AI exists to expand human potential, not replace human judgment. Always.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Support Section */}
        <section className="support" id="support">
          <div className="zo-container">
            <div className="support-card reveal">
              <h3>Believe in this?</h3>
              <p>This isn&apos;t a subscription. It&apos;s a statement. Pay what you believe — $1 minimum, no ceiling. Everyone gets the same access. No tiers. No gatekeeping.</p>
              <div className="perks">
                <div className="perk">Direct access to our research</div>
                <div className="perk">Early access to new products</div>
                <div className="perk">Help shape our constitution</div>
                <div className="perk">Build with us from zero</div>
              </div>
              <Link href="/join" className="support-cta" aria-label="Support ZeroOrigine">Support the Mission</Link>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="final-cta" id="cta">
          <div className="zo-container reveal">
            <h2>The future belongs to those who begin from zero.</h2>
            <p className="cta-sub">New products ship from the Minds continuously. Watch it happen — no spam, only real milestones.</p>
            <SubscribeForm />
            <a href="mailto:hello@zeroorigine.com" className="cta-button cta-secondary" aria-label="Send email to contact ZeroOrigine">Get in Touch</a>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="zo-footer">
        <div className="footer-content">
          <div className="footer-left">
            <p>&copy; 2026 ZeroOrigine. The First AI-Native Institution.</p>
            <PipelineVersion />
          </div>
          <div className="footer-links">
            <a href="#minds">Minds</a>
            <a href="#products">Products</a>
            <a href="#beliefs">Beliefs</a>
            <a href="#transparency">Transparency</a>
            <a href="#constitution">Law</a>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
            <Link href="/refund">Refunds</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
