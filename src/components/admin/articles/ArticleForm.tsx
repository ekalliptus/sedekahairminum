import * as React from 'react';
import type { JSONContent } from '@tiptap/react';
import TipTapEditor, { type EditorHandle } from '../editor/TipTapEditor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Toaster } from '@/components/ui/sonner';
import { toast } from 'sonner';
import { Icon } from '../icon';
import { toSlug } from '@/lib/slug';
import { uploadMedia } from '@/lib/upload';
import type { ArticleStatus, Category, Tag } from '@/lib/supabase/types';
import SeoAnalyzer from './SeoAnalyzer';

export interface ArticleInitial {
  id: string | null;
  title: string;
  slug: string;
  excerpt: string;
  content: JSONContent | null;
  cover_image: string;
  status: ArticleStatus;
  published_at: string | null;
  category_id: string | null;
  meta_title: string;
  meta_description: string;
  focus_keyword: string;
  og_image: string;
  tag_ids: string[];
}

interface Props {
  initial: ArticleInitial;
  categories: Category[];
  tags: Tag[];
}

const NO_CATEGORY = '__none__';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export default function ArticleForm({ initial, categories, tags }: Props) {
  const [title, setTitle] = React.useState(initial.title);
  const [slug, setSlug] = React.useState(initial.slug);
  const [slugTouched, setSlugTouched] = React.useState(Boolean(initial.slug));
  const [excerpt, setExcerpt] = React.useState(initial.excerpt);
  const [cover, setCover] = React.useState(initial.cover_image);
  const [status, setStatus] = React.useState<ArticleStatus>(initial.status);
  const [publishedAt, setPublishedAt] = React.useState(initial.published_at ?? '');
  const [categoryId, setCategoryId] = React.useState(initial.category_id ?? NO_CATEGORY);
  const [tagIds, setTagIds] = React.useState<string[]>(initial.tag_ids);
  const [metaTitle, setMetaTitle] = React.useState(initial.meta_title);
  const [metaDesc, setMetaDesc] = React.useState(initial.meta_description);
  const [saving, setSaving] = React.useState(false);
  const [focusKeyword, setFocusKeyword] = React.useState(initial.focus_keyword ?? '');
  const [contentText, setContentText] = React.useState('');
  const [contentHtml, setContentHtml] = React.useState('');
  // Autosave indicator: 'idle' | 'saving' | 'saved' | 'error'
  const [autosave, setAutosave] = React.useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastAutosaveAt = React.useRef(0);

  const editorState = React.useRef<{ json: JSONContent | null; html: string; text: string }>({
    json: initial.content,
    html: '',
    text: '',
  });
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const coverInputRef = React.useRef<HTMLInputElement>(null);
  const editorRef = React.useRef<EditorHandle>(null);

  // base-ui Select resolves the trigger label from `items` BEFORE the dropdown
  // is opened. Without it the trigger shows the raw value (e.g. a category UUID
  // or "published") until first open. Build value→label maps once.
  const statusItems = React.useMemo(
    () => ({ draft: 'Draf', published: 'Terbit', scheduled: 'Terjadwal', archived: 'Arsip' }),
    [],
  );
  const categoryItems = React.useMemo(() => {
    const m: Record<string, string> = { [NO_CATEGORY]: 'Tanpa kategori' };
    for (const c of categories) m[c.id] = c.name;
    return m;
  }, [categories]);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(toSlug(value));
  }

  // Smart paste (WordPress/Elementor-style): pasting a whole draft into the
  // title field splits the first line into the title and pours the rest into the
  // editor body. A single-line paste is left untouched (normal behaviour).
  function handleTitlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const html = e.clipboardData.getData('text/html');
    const plain = e.clipboardData.getData('text/plain');

    let firstLine = '';
    let restHtml = '';

    if (html) {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      // Editors like Google Docs wrap everything in a single <b>/<div>; unwrap
      // such single-child wrappers until we reach the real list of blocks.
      let container: Element = doc.body;
      while (true) {
        const kids = Array.from(container.children).filter(
          (el) => (el.textContent ?? '').trim().length > 0,
        );
        if (kids.length === 1 && kids[0].children.length > 0) container = kids[0];
        else break;
      }
      const blocks = Array.from(container.children).filter(
        (el) => (el.textContent ?? '').trim().length > 0,
      );
      if (blocks.length > 1) {
        firstLine = (blocks[0].textContent ?? '').trim();
        restHtml = blocks.slice(1).map((el) => el.outerHTML).join('');
      }
    }

    // Fall back to plain text (also covers HTML that wouldn't split — the plain
    // clipboard flavour from Docs/Word keeps real newlines between paragraphs).
    if ((!firstLine || !restHtml) && plain) {
      const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        firstLine = lines[0];
        restHtml = lines.slice(1).map((l) => `<p>${escapeHtml(l)}</p>`).join('');
      }
    }

    // Nothing to split → let the browser paste normally into the input.
    if (!firstLine || !restHtml) return;

    e.preventDefault();
    onTitleChange(firstLine);
    editorRef.current?.appendContent(restHtml);
    toast.success('Judul & isi terpisah otomatis');
  }

  function toggleTag(id: string) {
    setTagIds((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  }

  async function uploadCover(file: File | undefined) {
    if (!file) return;
    const id = toast.loading('Mengunggah sampul…');
    try {
      const { publicUrl } = await uploadMedia(file, 'covers');
      setCover(publicUrl);
      toast.success('Sampul diunggah', { id });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal', { id });
    }
  }

  // `silent`: autosave path — no toast spam, light status indicator instead.
  // Returns true on success so callers (autosave, manual save) can react.
  async function save(nextStatus?: ArticleStatus, opts: { silent?: boolean } = {}): Promise<boolean> {
    const silent = opts.silent ?? false;
    const effectiveStatus = nextStatus ?? status;
    if (!title.trim()) {
      if (!silent) toast.error('Judul wajib diisi');
      return false;
    }
    if (!silent) setSaving(true); else setAutosave('saving');
    try {
      const res = await fetch('/api/articles/save', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          id: initial.id,
          title,
          slug: slug || toSlug(title),
          excerpt: excerpt || null,
          content: editorState.current.json,
          content_html: editorState.current.html,
          plain_text: editorState.current.text,
          cover_image: cover || null,
          status: effectiveStatus,
          published_at: publishedAt || null,
          category_id: categoryId === NO_CATEGORY ? null : categoryId,
          meta_title: metaTitle || null,
          meta_description: metaDesc || null,
          focus_keyword: focusKeyword || null,
          og_image: cover || null,
          tag_ids: tagIds,
        }),
      });
      const body = (await res.json()) as { ok: boolean; id?: string; slug?: string; error?: string };
      if (!body.ok) {
        if (!silent) toast.error(body.error ?? 'Gagal menyimpan');
        else setAutosave('error');
        return false;
      }
      setStatus(effectiveStatus);
      if (silent) {
        setAutosave('saved');
        lastAutosaveAt.current = Date.now();
      } else {
        toast.success(effectiveStatus === 'published' ? 'Artikel diterbitkan' : 'Tersimpan');
      }
      // On first create, move to the edit URL so subsequent saves update.
      if (!initial.id && body.id) {
        window.history.replaceState(null, '', `/admin/articles/${body.id}`);
        initial.id = body.id;
      }
      return true;
    } catch {
      if (!silent) toast.error('Gagal menyimpan');
      else setAutosave('error');
      return false;
    } finally {
      if (!silent) setSaving(false);
    }
  }

  // Autosave: after the editor pauses, save the current state as a draft so the
  // user never loses work if they forget to click "Simpan Draf". It never
  // downgrades a published/scheduled article — only persists draft copies in the
  // background. Triggered by any tracked field change; debounced 4s.
  const AUTOSAVE_MS = 4000;
  React.useEffect(() => {
    // Nothing to autosave yet (no title = nothing meaningful), and never
    // auto-downgrade an article that's already published/scheduled.
    if (!initial.id && !title.trim()) return;
    if (status === 'published' || status === 'scheduled') return;
    const t = setTimeout(() => { void save('draft', { silent: true }); }, AUTOSAVE_MS);
    return () => clearTimeout(t);
    // editorState is a ref; contentText/contentHtml mirror it for dependency tracking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, slug, excerpt, cover, status, categoryId, tagIds, metaTitle, metaDesc, focusKeyword, contentText, contentHtml, initial.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <a href="/admin/articles" className="text-muted-foreground hover:text-foreground">
            <Icon name="arrow-left" className="size-5" />
          </a>
          <h1 className="text-xl font-semibold">{initial.id ? 'Edit Artikel' : 'Artikel Baru'}</h1>
          <Badge variant="outline" className="capitalize">{status}</Badge>
          <AutosaveBadge state={autosave} />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => save('draft')} disabled={saving}>
            <Icon name="save" /> Simpan Draf
          </Button>
          <Button onClick={() => save('published')} disabled={saving}>
            {saving ? <Icon name="loader-circle" className="animate-spin" /> : <Icon name="send" />}
            Terbitkan
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main column */}
        <div className="space-y-4">
          <Input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onPaste={handleTitlePaste}
            placeholder="Judul artikel… (tempel seluruh draf untuk pisah otomatis)"
            className="h-12 border-0 bg-transparent px-0 text-2xl font-semibold shadow-none focus-visible:ring-0 md:text-3xl"
          />
          <TipTapEditor
            ref={editorRef}
            initialContent={initial.content}
            onChange={(json, html, text) => {
              editorState.current = { json, html, text };
              if (debounceRef.current) clearTimeout(debounceRef.current);
              debounceRef.current = setTimeout(() => {
                setContentText(text);
                setContentHtml(html);
              }, 500);
            }}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Publikasi</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select items={statusItems} value={status} onValueChange={(v: string | null) => { if (v) setStatus(v as ArticleStatus); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draf</SelectItem>
                    <SelectItem value="published">Terbit</SelectItem>
                    <SelectItem value="scheduled">Terjadwal</SelectItem>
                    <SelectItem value="archived">Arsip</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(status === 'scheduled' || status === 'published') && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Tanggal terbit</Label>
                  <Input
                    type="datetime-local"
                    value={publishedAt ? publishedAt.slice(0, 16) : ''}
                    onChange={(e) => setPublishedAt(e.target.value ? new Date(e.target.value).toISOString() : '')}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Sampul</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {cover ? (
                <div className="group relative overflow-hidden rounded-md border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cover} alt="Sampul" className="aspect-video w-full object-cover" />
                  <button
                    onClick={() => setCover('')}
                    className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    aria-label="Hapus sampul"
                  >
                    <Icon name="x" className="size-4" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => coverInputRef.current?.click()}
                  className="flex aspect-video w-full flex-col items-center justify-center gap-1 rounded-md border border-dashed text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <Icon name="image-plus" className="size-6" />
                  <span className="text-xs">Unggah sampul</span>
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadCover(e.target.files?.[0])}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">Kategori & Tag</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Kategori</Label>
                <Select items={categoryItems} value={categoryId} onValueChange={(v: string | null) => setCategoryId(v ?? NO_CATEGORY)}>
                  <SelectTrigger><SelectValue placeholder="Pilih kategori" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CATEGORY}>Tanpa kategori</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tag</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tags.length === 0 && <span className="text-xs text-muted-foreground">Belum ada tag.</span>}
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => toggleTag(t.id)}
                      className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
                        tagIds.includes(t.id)
                          ? 'border-primary bg-primary/15 text-foreground'
                          : 'border-border text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-sm">SEO & Ringkasan</CardTitle></CardHeader>
            <CardContent>
              <Tabs defaultValue="excerpt">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="excerpt">Ringkasan</TabsTrigger>
                  <TabsTrigger value="seo">SEO</TabsTrigger>
                </TabsList>
                <TabsContent value="excerpt" className="space-y-2 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Slug</Label>
                    <Input
                      value={slug}
                      onChange={(e) => { setSlug(toSlug(e.target.value)); setSlugTouched(true); }}
                      placeholder="judul-artikel"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Ringkasan</Label>
                    <Textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3} placeholder="Ringkasan singkat…" />
                  </div>
                </TabsContent>
                <TabsContent value="seo" className="space-y-2 pt-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta title</Label>
                    <Input value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder={title} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Meta description</Label>
                    <Textarea value={metaDesc} onChange={(e) => setMetaDesc(e.target.value)} rows={3} placeholder={excerpt} />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <SeoAnalyzer
            title={title}
            slug={slug}
            metaTitle={metaTitle}
            metaDesc={metaDesc}
            excerpt={excerpt}
            contentText={contentText}
            contentHtml={contentHtml}
            hasCover={Boolean(cover)}
            focusKeyword={focusKeyword}
            onFocusKeywordChange={setFocusKeyword}
          />
        </div>
      </div>
      <Toaster position="top-right" richColors />
    </div>
  );
}

// Compact autosave status shown next to the article status badge. Stays subtle
// (no toasts) so background draft saves don't interrupt writing.
function AutosaveBadge({ state }: { state: 'idle' | 'saving' | 'saved' | 'error' }) {
  if (state === 'idle') return null;
  const map = {
    saving: { text: 'Menyimpan draf…', className: 'text-muted-foreground', icon: 'loader-circle', spin: true },
    saved: { text: 'Draf tersimpan', className: 'text-emerald-500', icon: 'circle-check', spin: false },
    error: { text: 'Gagal menyimpan draf', className: 'text-destructive', icon: 'circle-x', spin: false },
  } as const;
  const s = map[state];
  return (
    <span className={`inline-flex items-center gap-1 text-xs ${s.className}`}>
      <Icon name={s.icon} className={`size-3.5 ${s.spin ? 'animate-spin' : ''}`} />
      {s.text}
    </span>
  );
}

