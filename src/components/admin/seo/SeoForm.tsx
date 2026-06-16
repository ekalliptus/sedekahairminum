import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Icon } from '../icon';
import { createSupabaseBrowser } from '@/lib/supabase/browser';
import type { SeoSettings } from '@/lib/seo';

export default function SeoForm({ initial }: { initial: SeoSettings }) {
  const [s, setS] = React.useState<SeoSettings>(initial);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof SeoSettings>(k: K, v: SeoSettings[K]) {
    setS((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    const supabase = createSupabaseBrowser();
    const { error } = await supabase
      .from('seo_settings')
      .upsert({ key: 'site', value: s } as never);
    if (error) toast.error(error.message);
    else toast.success('Setelan SEO disimpan');
    setSaving(false);
  }

  return (
    <div className="max-w-3xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Rank Math SEO</h1>
        <p className="text-sm text-muted-foreground">Setelan SEO global situs — default judul, meta, verifikasi, analitik, dan sosial.</p>
      </div>

      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">Umum</TabsTrigger>
          <TabsTrigger value="verify">Verifikasi</TabsTrigger>
          <TabsTrigger value="analytics">Analitik</TabsTrigger>
          <TabsTrigger value="social">Sosial</TabsTrigger>
        </TabsList>

        {/* General */}
        <TabsContent value="general" className="space-y-4 pt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Judul &amp; Deskripsi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Pemisah judul (title separator)</Label>
                <Input value={s.title_separator} onChange={(e) => set('title_separator', e.target.value)} placeholder="|" className="max-w-[120px]" />
                <p className="text-xs text-muted-foreground">Dipakai di seluruh judul halaman: "Judul {s.title_separator || '|'} Sedekah Air Minum".</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Judul Beranda (homepage)</Label>
                <Input value={s.homepage_title} onChange={(e) => set('homepage_title', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Deskripsi Beranda</Label>
                <Textarea rows={3} value={s.homepage_description} onChange={(e) => set('homepage_description', e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Gambar OG default (URL)</Label>
                <Input value={s.default_og_image} onChange={(e) => set('default_og_image', e.target.value)} placeholder="https://…/og-default.webp" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Sitemap &amp; Robots</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Aktifkan sitemap</p>
                  <p className="text-xs text-muted-foreground">sitemap-index.xml &amp; sitemap-articles.xml</p>
                </div>
                <Switch checked={s.sitemap_enabled} onCheckedChange={(v) => set('sitemap_enabled', v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Boleh diindeks mesin pencari</p>
                  <p className="text-xs text-muted-foreground">robots_index global (matikan untuk staging)</p>
                </div>
                <Switch checked={s.robots_index} onCheckedChange={(v) => set('robots_index', v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Verification */}
        <TabsContent value="verify" className="space-y-4 pt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Verifikasi Mesin Pencari</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Google Search Console (kode verifikasi)</Label>
                <Input value={s.gsc_verification} onChange={(e) => set('gsc_verification', e.target.value)} placeholder="kode dari Search Console" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Bing Webmaster (kode verifikasi)</Label>
                <Input value={s.bing_verification} onChange={(e) => set('bing_verification', e.target.value)} placeholder="kode dari Bing" />
              </div>
              <p className="text-xs text-muted-foreground">Meta verifikasi disisipkan ke &lt;head&gt; seluruh halaman publik.</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Analytics */}
        <TabsContent value="analytics" className="space-y-4 pt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Analitik</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Google Analytics 4 — Measurement ID</Label>
                <Input value={s.ga4_id} onChange={(e) => set('ga4_id', e.target.value)} placeholder="G-XXXXXXXXXX" />
                <p className="text-xs text-muted-foreground">Kosongkan untuk menonaktifkan. Skrip GA4 disisipkan jika diisi.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Social */}
        <TabsContent value="social" className="space-y-4 pt-3">
          <Card>
            <CardHeader><CardTitle className="text-sm">Sosial &amp; Open Graph</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Twitter handle</Label>
                <Input value={s.twitter_handle} onChange={(e) => set('twitter_handle', e.target.value)} placeholder="@akun" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Facebook App ID</Label>
                <Input value={s.facebook_app_id} onChange={(e) => set('facebook_app_id', e.target.value)} placeholder="123456789" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Icon name="loader-circle" className="animate-spin" />}
          Simpan Setelan SEO
        </Button>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
