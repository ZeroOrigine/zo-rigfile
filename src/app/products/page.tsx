import Link from 'next/link';
import SubNav from '@/components/SubNav';
import type { Metadata } from 'next';
import { getRegistry } from '@/lib/zo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'The Registry — every product the Minds ever attempted | ZeroOrigine',
  description: 'Every attempt: live, building, failed, dropped. With the real cost of each. Radical transparency, machine-written.',
};

const STATUS_CLASS: Record<string, string> = {
  live: 'reg-live', launched: 'reg-live', building: 'reg-busy',
  dropped: 'reg-dead', qa_failed: 'reg-warn', build_failed: 'reg-warn',
  budget_halted: 'reg-warn', approved: 'reg-idle', pending_approval: 'reg-idle',
};

export default async function RegistryPage() {
  const rows = await getRegistry();

  return (
    <>
    <SubNav />
    <main className="legal-page mc-registry">
      <div className="zo-container">
        <Link href="/" className="legal-back">&larr; Back to mission control</Link>
        <h1>The Registry</h1>
        <p className="legal-updated">Every product the Minds ever attempted — including the ones that died. Each row links to its machine-written biography.</p>

        {!rows ? (
          <p>Registry temporarily unreachable. The database will answer again shortly.</p>
        ) : (
          <div className="reg-table-wrap">
            <table className="reg-table">
              <thead>
                <tr><th>Product</th><th>Status</th><th>Born</th><th>True cost</th><th>Story</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const slug = r.project_id.replace(/^zo-/, '');
                  return (
                    <tr key={r.project_id}>
                      <td>
                        {r.url
                          ? <a href={r.url} target="_blank" rel="noopener noreferrer">{r.name}</a>
                          : r.name}
                        {r.category ? <span className="reg-cat"> · {r.category}</span> : null}
                      </td>
                      <td><span className={`reg-badge ${STATUS_CLASS[r.status] ?? 'reg-idle'}`}>{r.status.replace(/_/g, ' ')}</span></td>
                      <td>{new Date(r.created_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                      <td className="reg-cost">{r.cost_usd > 0 ? `$${r.cost_usd.toFixed(2)}` : '—'}</td>
                      <td><Link href={`/story/${slug}`} className="reg-story">biography &rarr;</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="reg-foot">Costs are the actual API spend recorded by the CFO Mind — not estimates. Dropped products stay listed forever: an institution that hides its failures is lying about its successes.</p>
      </div>
    </main>
    </>
  );
}
