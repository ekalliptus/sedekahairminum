import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Icon } from '../icon';
import { createSupabaseBrowser } from '@/lib/supabase/browser';

interface SettingsMap {
  contact: { whatsapp?: string; email?: string; address?: string; hours?: string };
  social: { instagram?: string; facebook?: string; youtube?: string; tiktok?: string; whatsapp?: string };
  about: { visi?: string };
}

export default function SettingsForm({ initial }: { initial: SettingsMap }) {
  const [contact, setContact] = React.useState(initial.contact ?? {});
  const [social, setSocial] = React.useState(initial.social ?? {});
  const [about, setAbout] = React.useState(initial.about ?? {});
  const [saving, setSaving] = React.useState(false);
  const supabase = createSupabaseBrowser();

  function setC<K extends keyof SettingsMap['contact']>(k: K, v: string) {
    setContact((prev) => ({ ...prev, [k]: v }));
  }
  function setS<K extends keyof SettingsMap['social']>(k: K, v: string) {
    setSocial((prev) => ({ ...prev, [k]: v }));
  }

  async function save() {
    setSaving(true);
    // upsert so a key that doesn't exist yet (e.g. 'about'/visi on older DBs)
    // is created rather than silently no-op'd by update().
    const [r1, r2, r3] = await Promise.all([
      supabase.from('settings').upsert({ key: 'contact', value: contact } as never),
      supabase.from('settings').upsert({ key: 'social', value: social } as never),
      supabase.from('settings').upsert({ key: 'about', value: about } as never),
    ]);
    if (r1.error || r2.error || r3.error) toast.error('Gagal menyimpan');
    else toast.success('Pengaturan disimpan');
    setSaving(false);
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Pengaturan</h1>
        <p className="text-sm text-muted-foreground">Informasi kontak & sosial media situs.</p>
      </div>

      <Tabs defaultValue="contact">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="contact">Kontak</TabsTrigger>
          <TabsTrigger value="social">Sosial Media</TabsTrigger>
          <TabsTrigger value="about">Visi</TabsTrigger>
        </TabsList>

        <TabsContent value="contact">
          <Card>
            <CardHeader><CardTitle className="text-sm">Informasi Kontak</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5"><Label className="text-xs">WhatsApp (tanpa +)</Label><Input value={contact.whatsapp ?? ''} onChange={(e) => setC('whatsapp', e.target.value)} placeholder="6285319480974" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Email</Label><Input type="email" value={contact.email ?? ''} onChange={(e) => setC('email', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Alamat</Label><Input value={contact.address ?? ''} onChange={(e) => setC('address', e.target.value)} /></div>
              <div className="space-y-1.5"><Label className="text-xs">Jam Operasional</Label><Input value={contact.hours ?? ''} onChange={(e) => setC('hours', e.target.value)} /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social">
          <Card>
            <CardHeader><CardTitle className="text-sm">Sosial Media</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {(['instagram', 'facebook', 'youtube', 'tiktok'] as const).map((platform) => (
                <div key={platform} className="space-y-1.5">
                  <Label className="text-xs capitalize">{platform}</Label>
                  <Input value={(social as Record<string, string>)[platform] ?? ''} onChange={(e) => setS(platform, e.target.value)} placeholder={`URL ${platform}`} />
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader><CardTitle className="text-sm">Visi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Isi Visi (tampil di halaman Tentang Kami)</Label>
                <Textarea
                  rows={4}
                  value={about.visi ?? ''}
                  onChange={(e) => setAbout({ visi: e.target.value })}
                  placeholder="Menjadi gerakan Sedekah Air Minum terbesar dan paling tepercaya di Indonesia…"
                />
                <p className="text-xs text-muted-foreground">Misi diatur terpisah di menu Konten Situs → Misi.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving && <Icon name="loader-circle" className="animate-spin" />}
          Simpan Pengaturan
        </Button>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}
