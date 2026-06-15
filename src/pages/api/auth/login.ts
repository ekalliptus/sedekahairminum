export const prerender = false;
import type { APIRoute } from 'astro';
import { z } from 'zod';
import { ok, badRequest } from '@/lib/api';
import { rateLimit, getClientIp } from '@/lib/security';
import { createSupabaseServer } from '@/lib/supabase/server';
import { createSupabaseAdmin } from '@/lib/supabase/admin';

const schema = z.object({
  email: z.email('Email tidak valid'),
  password: z.string().min(1),
});

const LOGIN_RATE = { max: 5, windowMs: 15 * 60 * 1000 };
const PWD_RATE = { max: 3, windowMs: 60 * 1000 };

export const POST: APIRoute = async ({ request, locals, cookies }) => {
  let body: z.infer<typeof schema>;
  try { body = schema.parse(await request.json()); }
  catch (e) { return badRequest(e instanceof z.ZodError ? e.issues[0]?.message ?? 'Invalid' : 'Invalid body'); }

  const ip = getClientIp(request);
  const emailKey = body.email.toLowerCase().trim();

  const ipLimit = rateLimit(`ip:${ip}`, LOGIN_RATE.max, LOGIN_RATE.windowMs);
  if (!ipLimit.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Terlalu banyak percobaan. Coba lagi nanti.' }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(Math.ceil(ipLimit.resetIn / 1000)) } },
    );
  }
  const pwdLimit = rateLimit(`pwd:${emailKey}`, PWD_RATE.max, PWD_RATE.windowMs);
  if (!pwdLimit.ok) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Terlalu banyak percobaan. Tunggu sebentar.' }),
      { status: 429, headers: { 'content-type': 'application/json', 'retry-after': String(Math.ceil(pwdLimit.resetIn / 1000)) } },
    );
  }

  // Per-request cookie-bound client. Its setAll cookie adapter writes the
  // session cookies in the exact Supabase format the middleware reads.
  const supabase = createSupabaseServer(
    cookies,
    locals.runtime?.env as Record<string, string> | undefined,
    request.headers.get('cookie'),
  );

  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: body.email,
    password: body.password,
  });

  if (authError || !authData.user) {
    return new Response(
      JSON.stringify({ ok: false, error: 'Email atau kata sandi salah' }),
      { status: 401, headers: { 'content-type': 'application/json' } },
    );
  }

  // Audit log via service role.
  const admin = createSupabaseAdmin(locals.runtime?.env as Record<string, string> | undefined);
  const { data: profile } = await admin
    .from('profiles')
    .select('role, full_name')
    .eq('id', authData.user.id)
    .single<{ role: string; full_name: string }>();
  await admin.from('activity_log').insert({
    actor_id: authData.user.id,
    action: 'login',
    entity_type: 'auth',
    entity_id: authData.user.id,
    summary: `login ${authData.user.email}`,
    ip,
    user_agent: request.headers.get('user-agent'),
  });

  return ok({
    user: { id: authData.user.id, email: authData.user.email },
    role: profile?.role ?? 'editor',
    full_name: profile?.full_name ?? '',
  });
};
