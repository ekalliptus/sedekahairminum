-- 0015_settings_about.sql
-- Adds the editable "about" settings key (currently holds the Visi text shown on
-- /tentang). Idempotent so it can run on existing deploys that already seeded
-- settings before this key existed. Editing happens in Pengaturan → Visi.

insert into public.settings (key, value) values
  ('about', jsonb_build_object(
    'visi','Menjadi gerakan Sedekah Air Minum terbesar dan paling tepercaya di Indonesia, hadir untuk umat di mana pun mereka berada.'))
on conflict (key) do nothing;
