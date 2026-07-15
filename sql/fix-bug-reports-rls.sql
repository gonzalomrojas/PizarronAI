-- =====================================================
-- Fix: RLS deshabilitado en bug_reports / bug_stats
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- 1) bug_reports: habilitar RLS + policy insert-only
--    (esto ya estaba en sql/bug-reports-migration.sql pero
--    nunca se corrió contra la base de producción)

alter table bug_reports enable row level security;

drop policy if exists "bugs_insert_public"        on bug_reports;
drop policy if exists "bugs_read_admin"           on bug_reports;
drop policy if exists "bugs_update_admin"         on bug_reports;
drop policy if exists "bugs_delete_admin"         on bug_reports;
drop policy if exists "bugs_insert_authenticated" on bug_reports;

-- Solo INSERT vía anon key (el form de "Reportar problema").
-- No hay policy de SELECT/UPDATE/DELETE → esas operaciones solo
-- son posibles desde el Dashboard (usa service_role, bypassea RLS).
create policy "bugs_insert_authenticated" on bug_reports
  for insert
  with check (true);

-- 2) bug_stats: es una vista sobre bug_reports, creada a mano en el
--    Dashboard. Las vistas corren con los permisos de quien las creó,
--    no del que consulta, así que RLS en bug_reports no alcanza para
--    protegerla. Le sacamos el acceso a las API keys públicas.

revoke select on bug_stats from anon, authenticated;

-- ── VERIFICACIÓN ─────────────────────────────────────
select
  relname                          as tabla,
  relrowsecurity                   as rls_habilitado
from pg_class
where relname in ('bug_reports', 'bug_stats');
