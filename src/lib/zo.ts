import { createAdminClient } from '@/lib/supabase/admin';

// Server-side data layer for Mission Control. Every number on the site comes
// through here — from the same database the Minds write to. No number is ever
// invented; if a query fails we return null and the UI renders nothing.

export interface RegistryRow {
  project_id: string;
  name: string;
  status: string;
  category: string | null;
  created_at: string;
  cost_usd: number;
  url: string | null;
}

const FRIENDLY: Record<string, { mind: string; line: string }> = {
  research_trigger: { mind: 'Research Mind', line: 'went hunting for problems worth solving' },
  research_complete: { mind: 'Research Mind', line: 'finished discovering problems worth solving' },
  evaluation_complete: { mind: 'Research Mind B', line: 'scored ideas for viability — GO / NO-GO' },
  idea_needs_fixes: { mind: 'Ethics Mind', line: 'sent an idea back with required fixes' },
  approval_needed: { mind: 'Ecosystem', line: 'asked the founder to approve a new idea' },
  human_approved: { mind: 'Founder', line: 'approved an idea for building' },
  build_complete: { mind: 'Builder Mind', line: 'finished building — all steps complete' },
  build_failed: { mind: 'Builder Mind', line: 'hit a wall — build failed, learnings stored' },
  qa_fix_needed: { mind: 'QA Mind', line: 'found issues and sent them back to the Builder' },
  qa_passed: { mind: 'QA Mind', line: 'passed the product through quality review' },
  qa_failed: { mind: 'QA Mind', line: 'rejected the build — quality bar not met' },
  marketing_complete: { mind: 'Marketing Mind', line: 'prepared the launch story' },
  deploy_complete: { mind: 'Deploy', line: 'shipped to production' },
  product_launched: { mind: 'Ecosystem', line: 'launched a new product' },
};

export function friendlyEvent(type: string) {
  return FRIENDLY[type] ?? null;
}

export async function getHomeData() {
  try {
    const supabase = createAdminClient();
    const [products, projects, costs, events] = await Promise.all([
      supabase.from('zo_products').select('slug,name,tagline,status,url,icon,sort_order').order('sort_order'),
      supabase.from('zo_projects').select('project_id,name,status,created_at'),
      supabase.from('zo_cost_logs').select('cost_usd,project_id,created_at'),
      supabase.from('pipeline_events').select('event_type,project_id,created_at')
        .in('event_type', Object.keys(FRIENDLY)).order('created_at', { ascending: false }).limit(10),
    ]);
    const costRows = costs.data ?? [];
    const { getFixedCosts } = await import('@/lib/fixedCosts');
    const totalSpend =
      costRows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0) + (await getFixedCosts());
    const live = (products.data ?? []).filter((p) => p.status === 'live');
    const allProjects = projects.data ?? [];
    const dropped = allProjects.filter((p) => p.status === 'dropped').length;

    const feed = (events.data ?? []).map((e) => ({
      ...FRIENDLY[e.event_type],
      product: (e.project_id || '').replace(/^zo-/, '').replace(/^RA-.*/, 'new ideas') || null,
      at: e.created_at,
    }));

    return {
      liveCount: live.length,
      totalProjects: allProjects.length,
      droppedCount: dropped,
      totalSpend,
      products: live,
      feed,
      apiCalls: costRows.length,
    };
  } catch {
    return null;
  }
}

export async function getRegistry(): Promise<RegistryRow[] | null> {
  try {
    const supabase = createAdminClient();
    const [projects, costs, products] = await Promise.all([
      supabase.from('zo_projects').select('project_id,name,status,category,created_at').order('created_at', { ascending: false }),
      supabase.from('zo_cost_logs').select('project_id,cost_usd'),
      supabase.from('zo_products').select('slug,url,status'),
    ]);
    const costBy: Record<string, number> = {};
    for (const r of costs.data ?? []) {
      const k = r.project_id || '';
      costBy[k] = (costBy[k] || 0) + (Number(r.cost_usd) || 0);
    }
    const urlBy: Record<string, string> = {};
    for (const p of products.data ?? []) {
      if (p.status === 'live' && p.url) urlBy[`zo-${p.slug}`] = p.url;
    }
    return (projects.data ?? []).map((p) => ({
      project_id: p.project_id,
      name: p.name,
      status: p.status,
      category: p.category,
      created_at: p.created_at,
      cost_usd: Math.round((costBy[p.project_id] || 0) * 100) / 100,
      url: urlBy[p.project_id] ?? null,
    }));
  } catch {
    return null;
  }
}

export async function getStory(slug: string) {
  try {
    const supabase = createAdminClient();
    const pid = `zo-${slug}`;
    const [proj, events, costs] = await Promise.all([
      supabase.from('zo_projects').select('project_id,name,status,category,created_at,research_score').eq('project_id', pid).limit(1),
      supabase.from('pipeline_events').select('event_type,created_at').eq('project_id', pid)
        .in('event_type', Object.keys(FRIENDLY)).order('created_at', { ascending: true }).limit(200),
      supabase.from('zo_cost_logs').select('cost_usd,workflow').eq('project_id', pid),
    ]);
    if (!proj.data?.length) return null;
    const p = proj.data[0];
    const costRows = costs.data ?? [];
    const totalCost = costRows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
    const milestones = (events.data ?? []).map((e) => ({
      ...FRIENDLY[e.event_type],
      type: e.event_type,
      at: e.created_at,
    }));
    return {
      name: p.name,
      status: p.status,
      category: p.category,
      born: p.created_at,
      score: p.research_score,
      totalCost: Math.round(totalCost * 100) / 100,
      calls: costRows.length,
      milestones,
    };
  } catch {
    return null;
  }
}

export interface MindStatus {
  key: string;
  name: string;
  epithet: string;
  busy: boolean;
  lastSeen: string | null;
  calls: number;
}

const MIND_DEFS: { key: string; name: string; epithet: string; workflows: string[]; busyStatuses: string[]; mindNames: string[] }[] = [
  { key: 'research_a', name: 'Research Mind A', epithet: 'the philosopher', workflows: ['research'], busyStatuses: ['researching'], mindNames: ['research_a'] },
  { key: 'research_b', name: 'Research Mind B', epithet: 'the architect', workflows: ['research'], busyStatuses: [], mindNames: ['research_b'] },
  { key: 'ethics', name: 'Ethics Mind', epithet: 'the conscience — veto power', workflows: ['ethics_review'], busyStatuses: [], mindNames: ['ethics'] },
  { key: 'architect', name: 'Pipeline Architect', epithet: 'the planner', workflows: ['build_architect'], busyStatuses: [], mindNames: ['build-architect'] },
  { key: 'builder', name: 'Builder Mind', epithet: 'the craftsman´s hands', workflows: ['builder'], busyStatuses: ['building', 'build_complete', 'qa_fix_needed'], mindNames: ['builder', 'builder_opus'] },
  { key: 'qa', name: 'QA Mind', epithet: 'the honest judge', workflows: ['qa_pipeline'], busyStatuses: ['qa', 'qa_round_1', 'qa_round_2', 'qa_round_3'], mindNames: ['qa'] },
  { key: 'marketing', name: 'Marketing Mind', epithet: 'the storyteller', workflows: ['marketing'], busyStatuses: ['marketing', 'deploying'], mindNames: ['marketing'] },
  { key: 'immune', name: 'Immune System', epithet: 'the night watch', workflows: ['hotfix', 'health'], busyStatuses: [], mindNames: ['immune_system', 'retrospective'] },
];

export async function getMindsStatus(): Promise<{ minds: MindStatus[]; metrics: { attempts: number; launched: number; avgCostLive: number; totalCalls: number; firstMonth: string } } | null> {
  try {
    const supabase = createAdminClient();
    const [costs, projects, products, recentThoughts] = await Promise.all([
      supabase.from('zo_cost_logs').select('workflow,created_at,cost_usd,project_id').order('created_at', { ascending: false }).limit(2000),
      supabase.from('zo_projects').select('status,created_at'),
      supabase.from('zo_products').select('slug,status'),
      supabase.from('zo_mind_logs').select('mind_name,created_at').order('created_at', { ascending: false }).limit(40),
    ]);
    const rows = costs.data ?? [];
    const lastByWf: Record<string, string> = {};
    const callsByWf: Record<string, number> = {};
    for (const r of rows) {
      const wf = r.workflow || 'other';
      if (!lastByWf[wf]) lastByWf[wf] = r.created_at;
      callsByWf[wf] = (callsByWf[wf] || 0) + 1;
    }
    const activeStatuses = new Set((projects.data ?? []).map((p) => p.status));
    // Signal 2: a thought logged in the last 10 minutes = that Mind is at work.
    // Covers research/ethics phases where no project status exists yet, and
    // guarantees the glow follows WHOEVER is working — automatically.
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    const freshMinds = new Set(
      (recentThoughts.data ?? [])
        .filter((r) => new Date(r.created_at).getTime() > tenMinAgo)
        .map((r) => r.mind_name),
    );

    const minds: MindStatus[] = MIND_DEFS.map((m) => {
      const seen = m.workflows.map((w) => lastByWf[w]).filter(Boolean).sort().reverse();
      const calls = m.workflows.reduce((s, w) => s + (callsByWf[w] || 0), 0);
      const busy = m.busyStatuses.some((s) => activeStatuses.has(s)) || m.mindNames.some((n) => freshMinds.has(n));
      return { key: m.key, name: m.name, epithet: m.epithet, busy, lastSeen: seen[0] ?? null, calls };
    });

    const allProjects = projects.data ?? [];
    const liveProducts = (products.data ?? []).filter((p) => p.status === 'live');
    const totalSpend = rows.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
    const first = allProjects.map((p) => p.created_at).sort()[0];

    return {
      minds,
      metrics: {
        attempts: allProjects.length,
        launched: liveProducts.length,
        avgCostLive: liveProducts.length ? Math.round((totalSpend / liveProducts.length) * 100) / 100 : 0,
        totalCalls: rows.length,
        firstMonth: first ? new Date(first).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) : '—',
      },
    };
  } catch {
    return null;
  }
}
