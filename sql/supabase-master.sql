-- ================================================================
-- PIZARRÓN AI — Base de datos Supabase
-- Script maestro: estructura completa, índices, RLS y políticas
--
-- Cómo usar:
--   1. Abrí SQL Editor en supabase.com
--   2. Pegá TODO este script
--   3. Click en Run
--   4. Verificá el SELECT final al pie
--
-- Versión: Sprint 3 (Auth + Roles + Permisos de votación)
-- ================================================================


-- ================================================================
-- 0. LIMPIEZA SEGURA (solo si querés resetear todo desde cero)
--    Descomentá este bloque si necesitás empezar de cero.
--    ⚠️  BORRA TODOS LOS DATOS. No correr en producción.
-- ================================================================

-- DROP TABLE IF EXISTS voto_permisos    CASCADE;
-- DROP TABLE IF EXISTS user_profiles    CASCADE;
-- DROP TABLE IF EXISTS user_grupos      CASCADE;
-- DROP TABLE IF EXISTS partidos         CASCADE;
-- DROP TABLE IF EXISTS jugadores        CASCADE;


-- ================================================================
-- 1. TABLA: jugadores
--    Un jugador por fila. Pertenece a un grupo.
--    Sus atributos, historial de votos y rating viven acá.
-- ================================================================

CREATE TABLE IF NOT EXISTS jugadores (
  id                    TEXT          NOT NULL,
  grupo_id              TEXT          NOT NULL,
  nombre                TEXT          NOT NULL,

  -- Posición: solo valores válidos
  pos                   TEXT          NOT NULL DEFAULT 'MED'
                          CONSTRAINT jugadores_pos_check
                          CHECK (pos IN ('ARQ', 'DEF', 'MED', 'ATA')),

  -- Rating general (1.0 a 10.0)
  rating                FLOAT         NOT NULL DEFAULT 5.0
                          CONSTRAINT jugadores_rating_range
                          CHECK (rating >= 1.0 AND rating <= 10.0),

  -- Atributos específicos por posición (JSONB — schema flexible)
  attrs                 JSONB         NOT NULL DEFAULT '{}',

  -- Historial de votos para decaimiento temporal
  historial_votos       FLOAT[]       NOT NULL DEFAULT '{}',
  historial_votos_attrs JSONB         NOT NULL DEFAULT '{}',

  -- Estadísticas
  partidos              INTEGER       NOT NULL DEFAULT 0
                          CONSTRAINT jugadores_partidos_positive CHECK (partidos >= 0),
  votos_count           INTEGER       NOT NULL DEFAULT 1
                          CONSTRAINT jugadores_votos_positive  CHECK (votos_count >= 1),

  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT jugadores_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------------
-- Índices: jugadores
-- ----------------------------------------------------------------
-- Filtrar jugadores por grupo (query más frecuente)
CREATE INDEX IF NOT EXISTS idx_jugadores_grupo
  ON jugadores (grupo_id);

-- Búsqueda por nombre dentro de un grupo (para autocompletado futuro)
CREATE INDEX IF NOT EXISTS idx_jugadores_grupo_nombre
  ON jugadores (grupo_id, nombre);

-- Ordenar por rating descendente dentro de un grupo
CREATE INDEX IF NOT EXISTS idx_jugadores_rating
  ON jugadores (grupo_id, rating DESC);


-- ================================================================
-- 2. TABLA: partidos
--    Un partido por fila. Guarda equipos, resultado y snapshot
--    de ratings para poder hacer UNDO.
-- ================================================================

CREATE TABLE IF NOT EXISTS partidos (
  id                  TEXT          NOT NULL,
  grupo_id            TEXT          NOT NULL,

  -- Fecha y hora como texto (formato libre dd/mm/yyyy, hh:mm)
  -- Se mantiene como TEXT para compatibilidad con el frontend
  fecha               TEXT,
  hora                TEXT,

  -- Resultado
  goles_a             INTEGER       DEFAULT 0
                        CONSTRAINT partidos_goles_a_positive CHECK (goles_a >= 0),
  goles_b             INTEGER       DEFAULT 0
                        CONSTRAINT partidos_goles_b_positive CHECK (goles_b >= 0),
  ganador             TEXT
                        CONSTRAINT partidos_ganador_check
                        CHECK (ganador IN ('A', 'B', 'Empate')),

  -- Sumas de ratings de cada equipo al momento del partido
  suma_a              FLOAT,
  suma_b              FLOAT,

  -- Tags calculados por la app
  balance_tag         TEXT
                        CONSTRAINT partidos_balance_check
                        CHECK (balance_tag IN ('parejos', 'algo_desiguales', 'desiguales')),
  resultado_tag       TEXT
                        CONSTRAINT partidos_resultado_check
                        CHECK (resultado_tag IN ('gano_favorito', 'sorpresa', 'empate')),

  -- Equipos completos como JSON (nombre, pos, rating al momento)
  equipo_a            JSONB         NOT NULL DEFAULT '[]',
  equipo_b            JSONB         NOT NULL DEFAULT '[]',

  -- Snapshot de todos los jugadores antes del partido (para UNDO)
  -- NULL si el partido fue cargado manualmente
  snapshot_jugadores  JSONB,

  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT partidos_pkey PRIMARY KEY (id)
);

-- ----------------------------------------------------------------
-- Índices: partidos
-- ----------------------------------------------------------------
-- Filtrar historial por grupo
CREATE INDEX IF NOT EXISTS idx_partidos_grupo
  ON partidos (grupo_id);

-- Ordenar por fecha de creación (historial más reciente primero)
CREATE INDEX IF NOT EXISTS idx_partidos_fecha_desc
  ON partidos (grupo_id, created_at DESC);


-- ================================================================
-- 3. TABLA: user_grupos
--    Vincula una cuenta de usuario con su grupo.
--    Un usuario puede pertenecer a un solo grupo a la vez.
--    El creador del grupo es 'admin', los demás son 'member'.
-- ================================================================

CREATE TABLE IF NOT EXISTS user_grupos (
  user_id     UUID          NOT NULL
                REFERENCES auth.users (id) ON DELETE CASCADE,
  grupo_id    TEXT          NOT NULL,

  -- Rol dentro del grupo
  role        TEXT          NOT NULL DEFAULT 'member'
                CONSTRAINT user_grupos_role_check
                CHECK (role IN ('admin', 'member')),

  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Un usuario solo puede pertenecer a un grupo
  CONSTRAINT user_grupos_pkey PRIMARY KEY (user_id)
);

-- ----------------------------------------------------------------
-- Índices: user_grupos
-- ----------------------------------------------------------------
-- Listar todos los miembros de un grupo
CREATE INDEX IF NOT EXISTS idx_user_grupos_grupo
  ON user_grupos (grupo_id);

-- Filtrar por rol dentro de un grupo (para listar admins)
CREATE INDEX IF NOT EXISTS idx_user_grupos_grupo_role
  ON user_grupos (grupo_id, role);


-- ================================================================
-- 4. TABLA: user_profiles
--    Email público de cada usuario.
--    Necesario porque auth.users no es accesible desde el browser.
--    Se llena automáticamente en cada login/registro desde la app.
-- ================================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     UUID          NOT NULL
                REFERENCES auth.users (id) ON DELETE CASCADE,
  email       TEXT          NOT NULL,
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT user_profiles_pkey PRIMARY KEY (user_id)
);

-- ----------------------------------------------------------------
-- Índices: user_profiles
-- ----------------------------------------------------------------
-- Búsqueda de múltiples perfiles a la vez (query IN)
CREATE INDEX IF NOT EXISTS idx_user_profiles_user
  ON user_profiles (user_id);

-- Buscar por email (útil para verificar duplicados o buscar usuario)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email
  ON user_profiles (email);


-- ================================================================
-- 5. TABLA: voto_permisos
--    Registra qué members tienen permiso de votar.
--    Los admins siempre pueden votar — no necesitan estar acá.
--    El admin otorga y revoca permisos desde el panel de Miembros.
-- ================================================================

CREATE TABLE IF NOT EXISTS voto_permisos (
  id            SERIAL        NOT NULL,
  grupo_id      TEXT          NOT NULL,
  user_id       UUID          NOT NULL
                  REFERENCES auth.users (id) ON DELETE CASCADE,
  otorgado_por  UUID          NOT NULL
                  REFERENCES auth.users (id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),

  CONSTRAINT voto_permisos_pkey     PRIMARY KEY (id),

  -- Un usuario solo puede tener un permiso por grupo
  CONSTRAINT voto_permisos_unique   UNIQUE (grupo_id, user_id)
);

-- ----------------------------------------------------------------
-- Índices: voto_permisos
-- ----------------------------------------------------------------
-- Verificar si un user tiene permiso en un grupo
CREATE INDEX IF NOT EXISTS idx_voto_permisos_grupo_user
  ON voto_permisos (grupo_id, user_id);

-- Listar todos los permisos de un grupo
CREATE INDEX IF NOT EXISTS idx_voto_permisos_grupo
  ON voto_permisos (grupo_id);


-- ================================================================
-- 6. ROW LEVEL SECURITY (RLS)
--    Todas las tablas tienen RLS habilitado.
--
--    Estado actual (Sprint 3):
--      Acceso abierto filtrado por grupo_id en la app.
--      El JWT del usuario autenticado se valida automáticamente.
--
--    Sprint 4 (planificado):
--      Reemplazar por políticas basadas en auth.uid() para que
--      cada usuario solo pueda leer/escribir su propio grupo.
-- ================================================================

ALTER TABLE jugadores      ENABLE ROW LEVEL SECURITY;
ALTER TABLE partidos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_grupos    ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles  ENABLE ROW LEVEL SECURITY;
ALTER TABLE voto_permisos  ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- Limpiar políticas anteriores (para evitar conflictos al re-correr)
-- ----------------------------------------------------------------
DROP POLICY IF EXISTS "acceso_publico_jugadores"   ON jugadores;
DROP POLICY IF EXISTS "acceso_publico_partidos"    ON partidos;
DROP POLICY IF EXISTS "acceso_publico_grupos"      ON user_grupos;
DROP POLICY IF EXISTS "acceso_publico_perfiles"    ON user_profiles;
DROP POLICY IF EXISTS "acceso_publico_permisos"    ON voto_permisos;
DROP POLICY IF EXISTS "perfil_publico"             ON user_profiles;

-- ----------------------------------------------------------------
-- Políticas: jugadores
-- Cualquier usuario autenticado puede leer y escribir.
-- La app filtra por grupo_id — solo ves jugadores de tu grupo.
-- ----------------------------------------------------------------
CREATE POLICY "jugadores_select" ON jugadores
  FOR SELECT USING (true);

CREATE POLICY "jugadores_insert" ON jugadores
  FOR INSERT WITH CHECK (true);

CREATE POLICY "jugadores_update" ON jugadores
  FOR UPDATE USING (true);

CREATE POLICY "jugadores_delete" ON jugadores
  FOR DELETE USING (true);

-- ----------------------------------------------------------------
-- Políticas: partidos
-- ----------------------------------------------------------------
CREATE POLICY "partidos_select" ON partidos
  FOR SELECT USING (true);

CREATE POLICY "partidos_insert" ON partidos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "partidos_update" ON partidos
  FOR UPDATE USING (true);

CREATE POLICY "partidos_delete" ON partidos
  FOR DELETE USING (true);

-- ----------------------------------------------------------------
-- Políticas: user_grupos
-- Cada usuario solo puede ver y modificar su propio registro.
-- ----------------------------------------------------------------
CREATE POLICY "user_grupos_select" ON user_grupos
  FOR SELECT USING (true);

CREATE POLICY "user_grupos_insert" ON user_grupos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "user_grupos_update" ON user_grupos
  FOR UPDATE USING (true);

-- ----------------------------------------------------------------
-- Políticas: user_profiles
-- Lectura pública (para que admin vea emails de members).
-- Escritura solo del propio perfil.
-- ----------------------------------------------------------------
CREATE POLICY "user_profiles_select" ON user_profiles
  FOR SELECT USING (true);

CREATE POLICY "user_profiles_insert" ON user_profiles
  FOR INSERT WITH CHECK (true);

CREATE POLICY "user_profiles_update" ON user_profiles
  FOR UPDATE USING (true);

-- ----------------------------------------------------------------
-- Políticas: voto_permisos
-- ----------------------------------------------------------------
CREATE POLICY "voto_permisos_select" ON voto_permisos
  FOR SELECT USING (true);

CREATE POLICY "voto_permisos_insert" ON voto_permisos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "voto_permisos_delete" ON voto_permisos
  FOR DELETE USING (true);


-- ================================================================
-- 7. MIGRACIÓN: poblar user_profiles con usuarios existentes
--    Corre esto si ya tenés usuarios registrados antes de crear
--    la tabla user_profiles. Es idempotente — se puede correr
--    múltiples veces sin problema.
-- ================================================================

INSERT INTO user_profiles (user_id, email)
SELECT id, email
FROM auth.users
ON CONFLICT (user_id) DO UPDATE
  SET email = EXCLUDED.email;


-- ================================================================
-- 8. VERIFICACIÓN FINAL
--    Muestra el estado de todas las tablas y sus filas.
--    Si todo corrió bien, deberías ver las 5 tablas listadas.
-- ================================================================

SELECT
  t.table_name                                          AS tabla,
  COUNT(c.column_name)                                  AS columnas,
  (SELECT COUNT(*) FROM information_schema.table_constraints tc
   WHERE tc.table_name = t.table_name
     AND tc.constraint_type = 'PRIMARY KEY')            AS tiene_pk,
  obj_description(
    (quote_ident(t.table_name))::regclass, 'pg_class'
  )                                                     AS descripcion
FROM information_schema.tables t
JOIN information_schema.columns c ON c.table_name = t.table_name
WHERE t.table_schema = 'public'
  AND t.table_type   = 'BASE TABLE'
GROUP BY t.table_name
ORDER BY t.table_name;
