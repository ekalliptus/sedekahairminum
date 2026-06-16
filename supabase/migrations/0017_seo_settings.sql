-- 0017_seo_settings.sql
-- Global SEO configuration (à la Rank Math): title templates, default meta,
-- verification tags, analytics IDs, sitemap/robots toggles, and social/OG
-- defaults. Single-row design (key = 'site'); edited from /admin/seo.

create table if not exists public.seo_settings (
  key        text primary key default 'site',
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger trg_seo_settings_updated
  before update on public.seo_settings
  for each row execute function public.set_updated_at();

-- Public read (the site renders these into <head>); admin write.
alter table public.seo_settings enable row level security;
create policy seo_settings_public_read on public.seo_settings
  for select using (true);
create policy seo_settings_admin_write on public.seo_settings
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.seo_settings (key, value) values
  ('site', jsonb_build_object(
    'title_separator', '|',
    'homepage_title', 'Sedekah Air Minum — Gerakan Wakaf Air Bersih untuk Indonesia',
    'homepage_description', 'Wakaf air bersih untuk masjid, pesantren, dan lembaga pendidikan Islam di seluruh Indonesia. Sedekah jariyah yang terus mengalir.',
    'default_og_image', '',
    'twitter_handle', '',
    'facebook_app_id', '',
    'gsc_verification', '',
    'bing_verification', '',
    'ga4_id', '',
    'sitemap_enabled', true,
    'robots_index', true
  ))
on conflict (key) do nothing;
