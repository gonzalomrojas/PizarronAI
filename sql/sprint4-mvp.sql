-- ================================================================
-- PIZARRÓN AI — Sprint 4: Votación MVP
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- ================================================================

-- ----------------------------------------------------------------
-- 1. TABLA: votos_mvp
--    Un voto por jugador por partido.
--    Cada miembro vota UNA vez por partido.
--    No puede votarse a sí mismo (se valida en la app).
-- ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS votos_mvp (
  id          SERIAL        NOT NULL,
  partido_id  TEXT          NOT NULL,
  grupo_id    TEXT          NOT NULL,
  voter_id    UUID          NOT NULL
                REFERENCES auth.users(id) ON DELETE CASCADE,
  jugador_id  TEXT          NOT NULL,  -- ID del jugador votado
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT votos_mvp_pkey   PRIMARY KEY (id),
  -- Un usuario solo puede votar una vez por partido
  CONSTRAINT votos_mvp_unique UNIQUE (partido_id, voter_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_votos_mvp_partido
  ON votos_mvp (partido_id);
CREATE INDEX IF NOT EXISTS idx_votos_mvp_grupo
  ON votos_mvp (grupo_id);
CREATE INDEX IF NOT EXISTS idx_votos_mvp_jugador
  ON votos_mvp (partido_id, jugador_id);

-- RLS
ALTER TABLE votos_mvp ENABLE ROW LEVEL SECURITY;
CREATE POLICY "votos_mvp_select" ON votos_mvp FOR SELECT USING (true);
CREATE POLICY "votos_mvp_insert" ON votos_mvp FOR INSERT WITH CHECK (true);
CREATE POLICY "votos_mvp_delete" ON votos_mvp FOR DELETE USING (true);

-- ----------------------------------------------------------------
-- 2. COLUMNAS nuevas en partidos
--    mvp_abierto: si la votación está activa
--    mvp_jugador_id: jugador ganador al cerrar
--    mvp_jugador_nombre: nombre del MVP (desnormalizado para historial)
-- ----------------------------------------------------------------

ALTER TABLE partidos
  ADD COLUMN IF NOT EXISTS mvp_abierto       BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mvp_jugador_id    TEXT    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS mvp_jugador_nombre TEXT   DEFAULT NULL;

-- ----------------------------------------------------------------
-- VERIFICACIÓN
-- ----------------------------------------------------------------
SELECT 'votos_mvp' AS tabla, COUNT(*) AS filas FROM votos_mvp
UNION ALL
SELECT 'partidos (con mvp_abierto)', COUNT(*) FROM partidos WHERE mvp_abierto IS NOT NULL;
