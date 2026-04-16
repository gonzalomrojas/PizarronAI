-- =====================================================
-- Pizarrón AI — Bug Reports System
-- Sprint: Mantenimiento
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- =====================================================

-- ── TABLA PRINCIPAL ──────────────────────────────────
create table if not exists bug_reports (
  id           bigserial    primary key,
  ticket_id    text         not null unique,          -- "BUG-AK72PX"
  grupo_id     text         not null default 'unknown',
  categoria    text         not null                  -- sync | equipos | votos | visual | performance | otro
                            check (categoria in ('sync','equipos','votos','visual','performance','otro')),
  severidad    text         not null default 'media'  -- baja | media | alta | critica
                            check (severidad in ('baja','media','alta','critica')),
  descripcion  text         not null,
  pasos        text,                                  -- pasos para reproducir (opcional)
  screenshot   text,                                  -- URL futura (ej: Supabase Storage)

  -- contexto técnico capturado automáticamente
  user_agent   text,
  url_actual   text,
  viewport     text,
  timestamp    timestamptz,                           -- timestamp del lado del cliente

  -- estado del ticket (workflow del developer)
  estado       text         not null default 'nuevo'
                            check (estado in ('nuevo','revisando','resuelto','cerrado')),
  nota_dev     text,                                  -- nota interna del developer
  resuelto_en  timestamptz,                           -- cuando se marcó como resuelto

  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- ── ÍNDICES ──────────────────────────────────────────
create index if not exists idx_bug_grupo    on bug_reports(grupo_id);
create index if not exists idx_bug_estado   on bug_reports(estado);
create index if not exists idx_bug_sev      on bug_reports(severidad);
create index if not exists idx_bug_created  on bug_reports(created_at desc);
create index if not exists idx_bug_ticket   on bug_reports(ticket_id);

-- ── AUTO-UPDATE updated_at ───────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  -- si cambia a resuelto, registrar cuándo
  if new.estado = 'resuelto' and old.estado != 'resuelto' then
    new.resuelto_en = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bug_updated_at on bug_reports;
create trigger trg_bug_updated_at
  before update on bug_reports
  for each row execute function update_updated_at();

-- ── ROW LEVEL SECURITY ──────────────────────────────
alter table bug_reports enable row level security;

-- Usuarios (anon): solo pueden INSERTAR nuevos reportes
-- No pueden leer ni editar los de otros grupos → privacidad
drop policy if exists "bugs_insert_public"   on bug_reports;
drop policy if exists "bugs_read_admin"      on bug_reports;
drop policy if exists "bugs_update_admin"    on bug_reports;
drop policy if exists "bugs_delete_admin"    on bug_reports;

-- INSERT: cualquier usuario anon puede crear un reporte
create policy "bugs_insert_public" on bug_reports
  for insert
  with check (true);

-- SELECT / UPDATE / DELETE: solo service_role (dashboard de admin)
-- Cuando uses el dashboard, usá la SERVICE_ROLE key, no la anon key.
-- Las siguientes políticas son para auth.role() = 'service_role'
create policy "bugs_read_admin" on bug_reports
  for select
  using (auth.role() = 'service_role');

create policy "bugs_update_admin" on bug_reports
  for update
  using (auth.role() = 'service_role');

create policy "bugs_delete_admin" on bug_reports
  for delete
  using (auth.role() = 'service_role');

-- ── VISTA RESUMIDA (útil para el dashboard) ──────────
create or replace view bug_stats as
select
  count(*)                                               as total,
  count(*) filter (where estado = 'nuevo')               as nuevos,
  count(*) filter (where estado = 'revisando')           as revisando,
  count(*) filter (where estado = 'resuelto')            as resueltos,
  count(*) filter (where severidad = 'critica')          as criticos,
  count(*) filter (where severidad = 'alta')             as alta_sev,
  count(*) filter (where created_at > now() - interval '7 days') as ultimos_7d,
  round(
    count(*) filter (where estado = 'resuelto')::numeric /
    nullif(count(*),0) * 100, 1
  )                                                      as pct_resueltos,
  avg(
    extract(epoch from (resuelto_en - created_at))/3600
  ) filter (where resuelto_en is not null)               as avg_horas_resolucion
from bug_reports;

-- ── VERIFICACIÓN ─────────────────────────────────────
select 'bug_reports creada ✅' as status, count(*) as filas from bug_reports;
select * from bug_stats;
