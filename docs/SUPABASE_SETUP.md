# Guía de configuración — Supabase

Instrucciones completas para configurar el backend de Pizarrón AI desde cero.

---

## 1. Crear el proyecto

1. Ir a [supabase.com](https://supabase.com) y crear una cuenta
2. Click en **New project**
3. Completar:
   - **Name:** PizarronAI (o el nombre que prefieras)
   - **Database password:** guardar en un lugar seguro
   - **Region:** elegir la más cercana (South America para Argentina)
4. Esperar ~2 minutos a que el proyecto inicialice

---

## 2. Crear las tablas

1. En el sidebar izquierdo → **SQL Editor**
2. Click en **New query**
3. Copiar y pegar el contenido completo de `sql/supabase-setup.sql`
4. Click en **Run** (o Ctrl+Enter)
5. Verificar que aparezcan las tablas en **Table Editor**

Las tablas creadas son:

| Tabla | Descripción |
|-------|-------------|
| `jugadores` | Jugadores del grupo con ratings y atributos |
| `partidos` | Historial de partidos con equipos y resultado |
| `user_grupos` | Vinculación entre cuenta de usuario y grupo |

---

## 3. Configurar autenticación

1. Sidebar → **Authentication** → **Providers**
2. Verificar que **Email** esté habilitado (viene activado por defecto)
3. Sidebar → **Authentication** → **Settings**
4. En la sección **Email Auth**:
   - Desactivar **"Confirm email"** para desarrollo (los usuarios pueden entrar sin confirmar)
   - Activarlo en producción cuando quieras mayor seguridad

---

## 4. Obtener las credenciales

1. Sidebar → **Settings** → **API Keys**
2. Copiar los dos valores:
   - **Project URL** → `https://xxxxxxxxxxxx.supabase.co`
   - **Clave publicable (anon key)** → `sb_publishable_...`

> ⚠️ **IMPORTANTE:** Nunca uses la **llave secreta** (`sb_secret_...`) en el frontend.
> Solo la clave publicable va en el código del browser.

---

## 5. Pegar las credenciales en el código

Abrir `js/config.js` y reemplazar:

```js
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';
const SUPABASE_KEY = 'sb_publishable_TU_CLAVE_PUBLICA';
```

---

## 6. Verificar Row Level Security (RLS)

Las tablas tienen RLS habilitado con política de acceso abierto por grupo.
Para verificar:

1. **Table Editor** → seleccionar tabla `jugadores`
2. Click en **RLS** → verificar que hay una policy activa

La política actual permite lectura y escritura a cualquiera que tenga el `grupo_id` correcto.
En una versión futura se reemplazará por políticas basadas en `auth.uid()`.

---

## 7. Estructura de la base de datos

```sql
jugadores
├── id                    TEXT PRIMARY KEY
├── grupo_id              TEXT NOT NULL          -- código del grupo
├── nombre                TEXT NOT NULL
├── pos                   TEXT                   -- ARQ | DEF | MED | ATA
├── rating                FLOAT                  -- 1.0 a 10.0
├── attrs                 JSONB                  -- atributos por posición
├── historial_votos       FLOAT[]                -- array de votos históricos
├── historial_votos_attrs JSONB                  -- historial por atributo
├── partidos              INT                    -- partidos jugados
├── votos_count           INT
└── created_at            TIMESTAMPTZ

partidos
├── id                    TEXT PRIMARY KEY
├── grupo_id              TEXT NOT NULL
├── fecha                 TEXT
├── hora                  TEXT
├── goles_a               INT
├── goles_b               INT
├── ganador               TEXT                   -- A | B | Empate
├── suma_a                FLOAT                  -- suma de ratings equipo A
├── suma_b                FLOAT
├── balance_tag           TEXT                   -- parejos | algo_desiguales | desiguales
├── resultado_tag         TEXT                   -- gano_favorito | sorpresa | empate
├── equipo_a              JSONB                  -- array de jugadores
├── equipo_b              JSONB
├── snapshot_jugadores    JSONB                  -- estado antes del partido (para UNDO)
└── created_at            TIMESTAMPTZ

user_grupos
├── user_id               UUID PRIMARY KEY       -- referencia a auth.users
├── grupo_id              TEXT NOT NULL
└── created_at            TIMESTAMPTZ
```

---

## 8. Comandos SQL útiles para administración

```sql
-- Ver todos los grupos existentes
SELECT DISTINCT grupo_id, COUNT(*) as jugadores
FROM jugadores
GROUP BY grupo_id
ORDER BY jugadores DESC;

-- Ver todos los usuarios registrados
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at DESC;

-- Ver qué grupo tiene cada usuario
SELECT u.email, g.grupo_id, g.created_at
FROM auth.users u
JOIN user_grupos g ON u.id = g.user_id
ORDER BY g.created_at DESC;

-- Borrar todos los datos de un grupo (útil para testing)
DELETE FROM jugadores WHERE grupo_id = 'CODIGO';
DELETE FROM partidos  WHERE grupo_id = 'CODIGO';
```
