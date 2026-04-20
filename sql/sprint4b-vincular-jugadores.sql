-- ================================================================
-- PIZARRÓN AI — Sprint 4b: Vincular jugadores con cuentas de usuario
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Es idempotente — se puede correr más de una vez sin problema.
-- ================================================================

-- 1. Agregar columna auth_user_id a jugadores
--    NULL = jugador sin cuenta vinculada (válido)
ALTER TABLE jugadores
  ADD COLUMN IF NOT EXISTS auth_user_id UUID DEFAULT NULL
    REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Índice para buscar el jugador de un usuario dentro de un grupo
CREATE INDEX IF NOT EXISTS idx_jugadores_auth_user
  ON jugadores (grupo_id, auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- 3. Constraint: un usuario solo puede estar vinculado a 1 jugador por grupo
--    (evita que el admin vincule el mismo user a dos jugadores)
ALTER TABLE jugadores
  DROP CONSTRAINT IF EXISTS jugadores_unique_auth_user_grupo;
ALTER TABLE jugadores
  ADD CONSTRAINT jugadores_unique_auth_user_grupo
  UNIQUE (grupo_id, auth_user_id);

-- 4. Verificación
SELECT
  j.nombre,
  j.pos,
  j.auth_user_id,
  p.email
FROM jugadores j
LEFT JOIN user_profiles p ON p.user_id = j.auth_user_id
WHERE j.grupo_id IS NOT NULL
ORDER BY j.nombre
LIMIT 20;
