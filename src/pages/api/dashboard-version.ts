export const prerender = false;
import type { APIRoute } from 'astro';
import { json, unauthorized } from '@/lib/api';

// Returns the latest activity timestamp. Polled by the dashboard to detect
// changes and prompt a refresh. Uses the server client (middleware-provided,
// RLS-scoped) — admins see all activity, editors see their own writes.
export const GET: APIRoute = async ({ locals }) => {
  if (!locals.user) return unauthorized();

  const { data } = await locals.supabase
    .from('activity_log')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  const latest = (data as any)?.[0]?.created_at ?? null;
  return json({ ts: latest });
};
