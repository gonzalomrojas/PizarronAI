-- =====================================================
-- Pizarrón AI — Bug Reports System
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- Idempotente: si la tabla ya existe (versión vieja del sistema),
-- solo le agrega las columnas que falten, sin tocar datos existentes.
-- =====================================================

create table if not exists bug_reports (
  id           bigserial    primary key,
  ticket_id    text         not null unique,          -- "BUG-AK72PX"
  grupo_id     text         not null default 'unknown',
  categoria    text         not null
                            check (categoria in ('sync','equipos','votos','visual','performance','otro')),
  severidad    text         not null default 'media'
                            check (severidad in ('baja','media','alta','critica')),
  descripcion  text         not null,
  pasos        text,

  -- contexto técnico capturado automáticamente
  user_agent   text,
  url_actual   text,
  viewport     text,

  -- estado del ticket (workflow del developer)
  estado       text         not null default 'nuevo'
                            check (estado in ('nuevo','revisando','resuelto','cerrado')),
  nota_dev     text,
  resuelto_en  timestamptz,

  created_at   timestamptz  not null default now(),
  updated_at   timestamptz  not null default now()
);

-- columnas nuevas (no existían en la versión vieja del sistema)
alter table bug_reports add column if not exists user_id    uuid references auth.users(id) on delete set null;
alter table bug_reports add column if not exists user_email text;

create index if not exists idx_bug_grupo    on bug_reports(grupo_id);
create index if not exists idx_bug_estado   on bug_reports(estado);
create index if not exists idx_bug_sev      on bug_reports(severidad);
create index if not exists idx_bug_created  on bug_reports(created_at desc);

create or replace function update_bug_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  if new.estado = 'resuelto' and old.estado != 'resuelto' then
    new.resuelto_en = now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_bug_updated_at on bug_reports;
create trigger trg_bug_updated_at
  before update on bug_reports
  for each row execute function update_bug_updated_at();

-- ── ROW LEVEL SECURITY ──────────────────────────────
alter table bug_reports enable row level security;

-- limpia políticas de una versión anterior del sistema, si existían
drop policy if exists "bugs_insert_public" on bug_reports;
drop policy if exists "bugs_read_admin"    on bug_reports;
drop policy if exists "bugs_update_admin"  on bug_reports;
drop policy if exists "bugs_delete_admin"  on bug_reports;
drop policy if exists "bugs_insert_authenticated" on bug_reports;

-- INSERT: igual que el resto de las tablas de este proyecto (jugadores,
-- partidos, etc.), se usa una policy permisiva con el anon key — el control
-- de quién ve el botón de "Reportar problema" queda a nivel app (solo
-- usuarios logueados). auth.uid() no se usa porque no resuelve de forma
-- confiable vía la REST API con las claves de firma actuales del proyecto.
-- No hay policy de SELECT/UPDATE/DELETE → solo accesible desde
-- el Supabase Dashboard (que usa la service_role, que bypassea RLS).
create policy "bugs_insert_authenticated" on bug_reports
  for insert
  with check (true);

-- ── VERIFICACIÓN ─────────────────────────────────────
select 'bug_reports creada ✅' as status, count(*) as filas from bug_reports;
