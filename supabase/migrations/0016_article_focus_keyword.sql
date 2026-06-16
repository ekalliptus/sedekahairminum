-- 0016_article_focus_keyword.sql
-- Persist the SEO focus keyword used by the article editor's SEO analyzer.
-- Previously it lived only in React state and was lost on reload/edit.

alter table public.articles
  add column if not exists focus_keyword text;
