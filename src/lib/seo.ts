// Global SEO settings (Rank Math-style). Single-row table `seo_settings`,
// key 'site'. Public read; admin-written. Rendered into <head> by Layout.astro.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase/types';

export interface SeoSettings {
  title_separator: string;
  homepage_title: string;
  homepage_description: string;
  default_og_image: string;
  twitter_handle: string;
  facebook_app_id: string;
  gsc_verification: string;
  bing_verification: string;
  ga4_id: string;
  sitemap_enabled: boolean;
  robots_index: boolean;
}

const DEFAULTS: SeoSettings = {
  title_separator: '|',
  homepage_title: 'Sedekah Air Minum — Gerakan Wakaf Air Bersih untuk Indonesia',
  homepage_description: 'Wakaf air bersih untuk masjid, pesantren, dan lembaga pendidikan Islam di seluruh Indonesia. Sedekah jariyah yang terus mengalir.',
  default_og_image: '',
  twitter_handle: '',
  facebook_app_id: '',
  gsc_verification: '',
  bing_verification: '',
  ga4_id: '',
  sitemap_enabled: true,
  robots_index: true,
};

/** Merge stored SEO settings over the defaults (DB may lag the schema). */
export async function getSeoSettings(
  client: SupabaseClient<Database> | null,
): Promise<SeoSettings> {
  if (!client) return DEFAULTS;
  const { data } = await client
    .from('seo_settings')
    .select('value')
    .eq('key', 'site')
    .maybeSingle<{ value: SeoSettings }>();
  const merged = { ...DEFAULTS, ...((data?.value as Partial<SeoSettings>) ?? {}) };
  // The GA4 id is interpolated into an inline <script>; keep it canonical.
  merged.ga4_id = sanitizeGa4Id(merged.ga4_id);
  return merged;
}

/** Build a <title> string from a page title + the global separator template. */
export function buildTitle(pageTitle: string | undefined, seo: SeoSettings): string {
  const sep = seo.title_separator?.trim() || '|';
  if (!pageTitle) return seo.homepage_title;
  return `${pageTitle} ${sep} Sedekah Air Minum`;
}

/**
 * GA4 Measurement IDs are interpolated into an inline <script>. Even though the
 * source is admin-controlled, harden against a stray quote/breakout by allowing
 * only the canonical G-XXXXXXXXXX shape.
 */
export function sanitizeGa4Id(raw: string): string {
  const m = (raw || '').trim().match(/^(G-[A-Z0-9]{6,})$/i);
  return m ? m[1] : '';
}
