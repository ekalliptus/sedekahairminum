-- 0020_penerima_status_selesai.sql
-- Allow a 'selesai' status on penerima (rendered red = "Selesai tersalurkan").
-- Requested in CATATAN UPDATE 2026: PP KI Ageng Wonokusumo is finished/closed
-- and must be shown in red while remaining in the table.
alter table public.penerima
  drop constraint if exists penerima_status_check;
alter table public.penerima
  add constraint penerima_status_check
  check (status in ('tersalurkan','proses','pengajuan','arsip','selesai'));
