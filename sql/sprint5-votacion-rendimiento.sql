-- ================================================================
-- PIZARRÓN AI — Sprint 5: Votación de rendimiento por partido
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ----------------------------------------------------------------
-- 1. TABLA: votos_rendimiento
--    Guarda los votos de atributos que cada jugador le da a otro
--    en un partido específico. Un voto por par (voter, jugador).
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS votos_rendimiento (
  id          SERIAL        NOT NULL,
  partido_id  TEXT          NOT NULL,
  grupo_id    TEXT          NOT NULL,

  -- Quién vota (auth_user_id del votante)
  voter_id    UUID          NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,

  -- A quién vota (id del jugador en tabla jugadores)
  jugador_id  TEXT          NOT NULL,

  -- Puntuaciones de atributos (JSONB flexible por posición)
  -- Ej: { "reflejos": 7.5, "manejo": 8, "salida": 6 }
  attrs_votos JSONB         NOT NULL DEFAULT '{}',

  -- Promedio calculado de los atributos votados
  promedio    FLOAT         NOT NULL DEFAULT 5.0,

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT votos_rendimiento_pkey   PRIMARY KEY (id),

  -- Un voter solo puede votar UNA VEZ a cada jugador por partido
  CONSTRAINT votos_rendimiento_unique UNIQUE (partido_id, voter_id, jugador_id)
);

-- ----------------------------------------------------------------
-- 2. TABLA: votos_rendimiento_sesion
--    Registra si un usuario YA COMPLETÓ toda la votación de un partido.
--    Cuando voter_id cierra la votación, se inserta acá.
--    Esto bloquea el reingreso aunque recargue la página.
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS votos_rendimiento_sesion (
  id          SERIAL        NOT NULL,
  partido_id  TEXT          NOT NULL,
  grupo_id    TEXT          NOT NULL,
  voter_id    UUID          NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT vrs_pkey   PRIMARY KEY (id),
  CONSTRAINT vrs_unique UNIQUE (partido_id, voter_id)
);

-- ----------------------------------------------------------------
-- 3. COLUMNAS nuevas en partidos
--    votacion_rendimiento_abierta: se activa al guardar el resultado
-- ----------------------------------------------------------------

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS votacion_rendimiento_abierta BOOLEAN NOT NULL DEFAULT false;

-- ----------------------------------------------------------------
-- Índices
-- ----------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_votos_rend_partido
  ON votos_rendimiento (partido_id);
CREATE INDEX IF NOT EXISTS idx_votos_rend_voter
  ON votos_rendimiento (partido_id, voter_id);
CREATE INDEX IF NOT EXISTS idx_votos_rend_jugador
  ON votos_rendimiento (partido_id, jugador_id);

CREATE INDEX IF NOT EXISTS idx_vrs_partido_voter
  ON votos_rendimiento_sesion (partido_id, voter_id);

-- ----------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------

ALTER TABLE votos_rendimiento         ENABLE ROW LEVEL SECURITY;
ALTER TABLE votos_rendimiento_sesion  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vr_select"  ON votos_rendimiento        FOR SELECT USING (true);
CREATE POLICY "vr_insert"  ON votos_rendimiento        FOR INSERT WITH CHECK (true);
CREATE POLICY "vrs_select" ON votos_rendimiento_sesion FOR SELECT USING (true);
CREATE POLICY "vrs_insert" ON votos_rendimiento_sesion FOR INSERT WITH CHECK (true);

-- ----------------------------------------------------------------
-- VERIFICACIÓN
-- ----------------------------------------------------------------

SELECT 'votos_rendimiento'        AS tabla, COUNT(*) AS filas FROM votos_rendimiento
UNION ALL
SELECT 'votos_rendimiento_sesion', COUNT(*) FROM votos_rendimiento_sesion
UNION ALL
SELECT 'partidos (con col nueva)', COUNT(*) FROM partidos WHERE votacion_rendimiento_abierta IS NOT NULL;
