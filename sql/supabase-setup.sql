-- =====================================================
-- PichanguApp — Setup de base de datos en Supabase
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- =====================================================

-- ---- Tabla de jugadores ----
create table if not exists jugadores (
  id                    text        primary key,
  grupo_id              text        not null,
  nombre                text        not null,
  pos                   text        not null default 'MED',
  rating                float       not null default 5.0,
  attrs                 jsonb       not null default '{}',
  historial_votos       float[]     not null default '{}',
  historial_votos_attrs jsonb       not null default '{}',
  partidos              int         not null default 0,
  votos_count           int         not null default 1,
  created_at            timestamptz not null default now()
);

-- ---- Tabla de partidos ----
create table if not exists partidos (
  id                   text        primary key,
  grupo_id             text        not null,
  fecha                text,
  hora                 text,
  goles_a              int         default 0,
  goles_b              int         default 0,
  ganador              text,
  suma_a               float,
  suma_b               float,
  balance_tag          text,
  resultado_tag        text,
  equipo_a             jsonb       default '[]',
  equipo_b             jsonb       default '[]',
  snapshot_jugadores   jsonb,
  created_at           timestamptz not null default now()
);

-- ---- Índices ----
create index if not exists idx_jugadores_grupo on jugadores(grupo_id);
create index if not exists idx_partidos_grupo  on partidos(grupo_id);
create index if not exists idx_partidos_fecha  on partidos(created_at desc);

-- ---- Row Level Security ----
-- Por ahora: acceso libre por grupo_id (sin autenticación).
-- En Sprint 3 se reemplaza por políticas basadas en auth.uid().

alter table jugadores enable row level security;
alter table partidos   enable row level security;

-- Política: cualquiera puede leer y escribir (filtrado por grupo_id en la app)
drop policy if exists "acceso_publico_jugadores" on jugadores;
drop policy if exists "acceso_publico_partidos"  on partidos;

create policy "acceso_publico_jugadores" on jugadores for all using (true) with check (true);
create policy "acceso_publico_partidos"  on partidos  for all using (true) with check (true);

-- ---- Verificación ----
select 'jugadores' as tabla, count(*) as filas from jugadores
union all
select 'partidos',           count(*)           from partidos;
