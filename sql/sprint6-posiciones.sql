-- ================================================================
-- Sprint 6 — Posiciones secundarias por jugador
-- ----------------------------------------------------------------
-- `pos` sigue siendo la posición principal. `posiciones` guarda las
-- otras en las que suele jugar (ej: {DEF,ATA}). Los atributos de todas
-- las posiciones viven en `attrs` (JSONB), así que no hace falta más.
-- Es aditivo: los jugadores existentes quedan con '{}'.
-- ================================================================

ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS posiciones TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE jugadores DROP CONSTRAINT IF EXISTS jugadores_posiciones_check;
ALTER TABLE jugadores
  ADD CONSTRAINT jugadores_posiciones_check
  CHECK (posiciones <@ ARRAY['ARQ','DEF','MED','ATA']::TEXT[]);
