-- ================================================================
-- PIZARRÓN AI — Fixes incrementales sobre base existente
-- Aplicar sobre una DB ya creada SIN perder datos.
--
-- Ejecutar en: Supabase Dashboard → SQL Editor → New query
-- Es idempotente: se puede correr más de una vez sin problema.
-- ================================================================


-- ----------------------------------------------------------------
-- FIX 1: jugadores — agregar NOT NULL + defaults faltantes
-- ----------------------------------------------------------------

ALTER TABLE jugadores
  ALTER COLUMN attrs                 SET NOT NULL,
  ALTER COLUMN attrs                 SET DEFAULT '{}',
  ALTER COLUMN historial_votos       SET NOT NULL,
  ALTER COLUMN historial_votos       SET DEFAULT '{}',
  ALTER COLUMN historial_votos_attrs SET NOT NULL,
  ALTER COLUMN historial_votos_attrs SET DEFAULT '{}',
  ALTER COLUMN partidos              SET NOT NULL,
  ALTER COLUMN partidos              SET DEFAULT 0,
  ALTER COLUMN votos_count           SET NOT NULL,
  ALTER COLUMN votos_count           SET DEFAULT 1,
  ALTER COLUMN created_at            SET NOT NULL,
  ALTER COLUMN created_at            SET DEFAULT now();

-- Corregir filas con NULL heredados antes del fix
UPDATE jugadores SET
  attrs                 = COALESCE(attrs,                 '{}'),
  historial_votos       = COALESCE(historial_votos,       '{}'),
  historial_votos_attrs = COALESCE(historial_votos_attrs, '{}'),
  partidos              = COALESCE(partidos,              0),
  votos_count           = COALESCE(votos_count,           1)
WHERE attrs IS NULL
   OR historial_votos IS NULL
   OR historial_votos_attrs IS NULL
   OR partidos IS NULL
   OR votos_count IS NULL;

-- CHECK: posición solo puede ser ARQ/DEF/MED/ATA
ALTER TABLE jugadores
  DROP CONSTRAINT IF EXISTS jugadores_pos_check;
ALTER TABLE jugadores
  ADD CONSTRAINT jugadores_pos_check
  CHECK (pos IN ('ARQ', 'DEF', 'MED', 'ATA'));

-- CHECK: rating entre 1 y 10
ALTER TABLE jugadores
  DROP CONSTRAINT IF EXISTS jugadores_rating_range;
ALTER TABLE jugadores
  ADD CONSTRAINT jugadores_rating_range
  CHECK (rating >= 1.0 AND rating <= 10.0);


-- ----------------------------------------------------------------
-- FIX 2: partidos — agregar NOT NULL en columnas críticas
--         y CHECK constraints en campos de tags
-- ----------------------------------------------------------------

ALTER TABLE partidos
  ALTER COLUMN equipo_a   SET NOT NULL,
  ALTER COLUMN equipo_a   SET DEFAULT '[]',
  ALTER COLUMN equipo_b   SET NOT NULL,
  ALTER COLUMN equipo_b   SET DEFAULT '[]',
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

-- Corregir filas con NULL
UPDATE partidos SET
  equipo_a = COALESCE(equipo_a, '[]'),
  equipo_b = COALESCE(equipo_b, '[]')
WHERE equipo_a IS NULL OR equipo_b IS NULL;

-- CHECK: ganador solo puede ser A, B o Empate
ALTER TABLE partidos
  DROP CONSTRAINT IF EXISTS partidos_ganador_check;
ALTER TABLE partidos
  ADD CONSTRAINT partidos_ganador_check
  CHECK (ganador IN ('A', 'B', 'Empate') OR ganador IS NULL);

-- CHECK: balance_tag valores válidos
ALTER TABLE partidos
  DROP CONSTRAINT IF EXISTS partidos_balance_check;
ALTER TABLE partidos
  ADD CONSTRAINT partidos_balance_check
  CHECK (balance_tag IN ('parejos', 'algo_desiguales', 'desiguales') OR balance_tag IS NULL);

-- CHECK: resultado_tag valores válidos
ALTER TABLE partidos
  DROP CONSTRAINT IF EXISTS partidos_resultado_check;
ALTER TABLE partidos
  ADD CONSTRAINT partidos_resultado_check
  CHECK (resultado_tag IN ('gano_favorito', 'sorpresa', 'empate') OR resultado_tag IS NULL);


-- ----------------------------------------------------------------
-- FIX 3: user_grupos — role NOT NULL con CHECK y PRIMARY KEY
-- ----------------------------------------------------------------

-- Primero corregir filas con role NULL
UPDATE user_grupos
  SET role = 'member'
  WHERE role IS NULL;

-- Agregar NOT NULL y CHECK
ALTER TABLE user_grupos
  ALTER COLUMN role SET NOT NULL,
  ALTER COLUMN role SET DEFAULT 'member';

ALTER TABLE user_grupos
  DROP CONSTRAINT IF EXISTS user_grupos_role_check;
ALTER TABLE user_grupos
  ADD CONSTRAINT user_grupos_role_check
  CHECK (role IN ('admin', 'member'));

-- Agregar PRIMARY KEY si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'user_grupos'
      AND constraint_type = 'PRIMARY KEY'
  ) THEN
    ALTER TABLE user_grupos ADD CONSTRAINT user_grupos_pkey PRIMARY KEY (user_id);
  END IF;
END $$;

-- NOT NULL en created_at
ALTER TABLE user_grupos
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();


-- ----------------------------------------------------------------
-- FIX 4: voto_permisos — agregar UNIQUE si no existe
-- ----------------------------------------------------------------

ALTER TABLE voto_permisos
  DROP CONSTRAINT IF EXISTS voto_permisos_unique;
ALTER TABLE voto_permisos
  ADD CONSTRAINT voto_permisos_unique UNIQUE (grupo_id, user_id);

ALTER TABLE voto_permisos
  ALTER COLUMN created_at SET NOT NULL,
  ALTER COLUMN created_at SET DEFAULT now();

-- Paso 1: Limpiar los NULL primero
UPDATE user_grupos
SET role = 'member'
WHERE role IS NULL;

-- Paso 2: Verificar que no queden NULL
SELECT role, COUNT(*) as cantidad
FROM user_grupos
GROUP BY role;
-- Ver qué valores tiene role actualmente
SELECT role, COUNT(*) as cantidad
FROM user_grupos
GROUP BY role
ORDER BY cantidad DESC;

-- ----------------------------------------------------------------
-- FIX 5: Índices faltantes
-- ----------------------------------------------------------------

-- jugadores
CREATE INDEX IF NOT EXISTS idx_jugadores_grupo
  ON jugadores (grupo_id);
CREATE INDEX IF NOT EXISTS idx_jugadores_grupo_nombre
  ON jugadores (grupo_id, nombre);
CREATE INDEX IF NOT EXISTS idx_jugadores_rating
  ON jugadores (grupo_id, rating DESC);

-- partidos
CREATE INDEX IF NOT EXISTS idx_partidos_grupo
  ON partidos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_partidos_fecha_desc
  ON partidos (grupo_id, created_at DESC);

-- user_grupos
CREATE INDEX IF NOT EXISTS idx_user_grupos_grupo
  ON user_grupos (grupo_id);
CREATE INDEX IF NOT EXISTS idx_user_grupos_grupo_role
  ON user_grupos (grupo_id, role);

-- user_profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_user
  ON user_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON user_profiles (email);

-- voto_permisos
CREATE INDEX IF NOT EXISTS idx_voto_permisos_grupo_user
  ON voto_permisos (grupo_id, user_id);
CREATE INDEX IF NOT EXISTS idx_voto_permisos_grupo
  ON voto_permisos (grupo_id);

-- Limpiar todas las políticas antes de recrearlas
DROP POLICY IF EXISTS "jugadores_select"      ON jugadores;
DROP POLICY IF EXISTS "jugadores_insert"      ON jugadores;
DROP POLICY IF EXISTS "jugadores_update"      ON jugadores;
DROP POLICY IF EXISTS "jugadores_delete"      ON jugadores;

DROP POLICY IF EXISTS "partidos_select"       ON partidos;
DROP POLICY IF EXISTS "partidos_insert"       ON partidos;
DROP POLICY IF EXISTS "partidos_update"       ON partidos;
DROP POLICY IF EXISTS "partidos_delete"       ON partidos;

DROP POLICY IF EXISTS "user_grupos_select"    ON user_grupos;
DROP POLICY IF EXISTS "user_grupos_insert"    ON user_grupos;
DROP POLICY IF EXISTS "user_grupos_update"    ON user_grupos;

DROP POLICY IF EXISTS "user_profiles_select"  ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert"  ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update"  ON user_profiles;

DROP POLICY IF EXISTS "voto_permisos_select"  ON voto_permisos;
DROP POLICY IF EXISTS "voto_permisos_insert"  ON voto_permisos;
DROP POLICY IF EXISTS "voto_permisos_delete"  ON voto_permisos;
-- ----------------------------------------------------------------
-- FIX 6: RLS — reemplazar política FOR ALL por políticas granulares
-- ----------------------------------------------------------------

-- Jugadores
DROP POLICY IF EXISTS "acceso_publico_jugadores" ON jugadores;
CREATE POLICY "jugadores_select" ON jugadores FOR SELECT USING (true);
CREATE POLICY "jugadores_insert" ON jugadores FOR INSERT WITH CHECK (true);
CREATE POLICY "jugadores_update" ON jugadores FOR UPDATE USING (true);
CREATE POLICY "jugadores_delete" ON jugadores FOR DELETE USING (true);

-- Partidos
DROP POLICY IF EXISTS "acceso_publico_partidos" ON partidos;
CREATE POLICY "partidos_select" ON partidos FOR SELECT USING (true);
CREATE POLICY "partidos_insert" ON partidos FOR INSERT WITH CHECK (true);
CREATE POLICY "partidos_update" ON partidos FOR UPDATE USING (true);
CREATE POLICY "partidos_delete" ON partidos FOR DELETE USING (true);

-- User grupos
DROP POLICY IF EXISTS "acceso_publico_grupos" ON user_grupos;
CREATE POLICY "user_grupos_select" ON user_grupos FOR SELECT USING (true);
CREATE POLICY "user_grupos_insert" ON user_grupos FOR INSERT WITH CHECK (true);
CREATE POLICY "user_grupos_update" ON user_grupos FOR UPDATE USING (true);

-- User profiles
DROP POLICY IF EXISTS "perfil_publico"             ON user_profiles;
DROP POLICY IF EXISTS "acceso_publico_perfiles"    ON user_profiles;
CREATE POLICY "user_profiles_select" ON user_profiles FOR SELECT USING (true);
CREATE POLICY "user_profiles_insert" ON user_profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "user_profiles_update" ON user_profiles FOR UPDATE USING (true);

-- Voto permisos
DROP POLICY IF EXISTS "acceso_publico_permisos" ON voto_permisos;
CREATE POLICY "voto_permisos_select" ON voto_permisos FOR SELECT USING (true);
CREATE POLICY "voto_permisos_insert" ON voto_permisos FOR INSERT WITH CHECK (true);
CREATE POLICY "voto_permisos_delete" ON voto_permisos FOR DELETE USING (true);


-- ----------------------------------------------------------------
-- FIX 7: Migración user_profiles — poblar emails existentes
-- ----------------------------------------------------------------

INSERT INTO user_profiles (user_id, email)
SELECT id, email FROM auth.users
ON CONFLICT (user_id) DO UPDATE SET email = EXCLUDED.email;


-- ================================================================
-- VERIFICACIÓN FINAL
-- ================================================================

-- Estructura de columnas y constraints
SELECT
  c.table_name                                AS tabla,
  c.column_name                               AS columna,
  c.data_type                                 AS tipo,
  c.is_nullable                               AS nullable,
  c.column_default                            AS default_val
FROM information_schema.columns c
WHERE c.table_schema = 'public'
ORDER BY c.table_name, c.ordinal_position;
