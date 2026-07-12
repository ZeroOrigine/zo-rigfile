import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getFixedCosts } from '@/lib/fixedCosts';

// Always run at request time — the numbers must be real, never build-time stale.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Public stats for the home page. Uses the service-role client server-side so
 * "Total Products" can include non-live (approved/building) products that anon
 * RLS cannot see. Live products are returned for the product grid.
 * Fail-soft: on any error returns ok:false; the client keeps its last-known
 * values rather than showing wrong numbers.
 */
export async function GET() {
  try {
    const supabase = createAdminClient();

    const [{ count: totalCount }, liveRes, spendRes] = await Promise.all([
      supabase.from('zo_products').select('id', { count: 'exact', head: true }),
      supabase
        .from('zo_products')
        .select('slug, name, tagline, description, status, url, icon, sort_order')
        .eq('status', 'live')
        .order('sort_order', { ascending: true }),
      supabase.from('zo_cost_logs').select('cost_usd'),
    ]);

    if (liveRes.error) throw liveRes.error;

    const live = liveRes.data ?? [];
    const apiSpend = (spendRes.data ?? []).reduce(
      (sum: number, r: { cost_usd: number | null }) => sum + (Number(r.cost_usd) || 0),
      0,
    );
    // Total Invested = variable API spend + fixed costs (subscriptions + one-time R&D)
    const totalSpend = apiSpend + (await getFixedCosts());

    return NextResponse.json(
      {
        ok: true,
        liveCount: live.length,
        totalCount: totalCount ?? live.length,
        totalSpend: Math.round(totalSpend * 100) / 100,
        products: live,
      },
      { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=60' } },
    );
  } catch (e) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }
}
