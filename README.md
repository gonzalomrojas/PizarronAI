# ⚽ Pizarrón AI

> App web para organizar partidos de fútbol entre amigos — equipos balanceados por IA, ratings evolutivos y sincronización en la nube.

**Demo:** [gonzalomrojas.github.io/PizarronAI](https://gonzalomrojas.github.io/PizarronAI/)
**Backend:** [Supabase](https://supabase.com) — PostgreSQL + Auth + REST API

---

## Funcionalidades

### Autenticación
- Registro e inicio de sesión con email y contraseña (Supabase Auth)
- Sesión persistente con JWT
- Cerrar sesión y cambio de grupo sin perder datos

### Roles por grupo
- **Admin** — crea el grupo. Gestiona jugadores, resultados y permisos
- **Member** — se une con el código. El admin puede habilitarlo para votar

### Sistema de grupos
- Código de 6 caracteres compartible (ej: `HKXR72`)
- Panel de Miembros (admin): ver emails, dar/quitar permiso de votación

### Jugadores (solo admin)
- Tarjetas FIFA con OVR (rating × 10)
- 4 posiciones con atributos específicos (ARQ / DEF / MED / ATA)

### Algoritmo de equipos
- Constraint duro: 1 arquero por equipo
- Simulated Annealing 400 iteraciones
- Equipos persisten aunque navegues o recargues

### Rating con decaimiento temporal
- Últimos 5 partidos pesan 3× más
- Indicador de tendencia: ↑ ↓ →

### Historial (solo admin edita)
- Guardar resultado después de jugar
- Carga manual de partidos anteriores
- Editar resultado y jugadores de cualquier partido guardado
- Deshacer el último partido con reversión de ratings

---

## Estructura

```
PizarronAI/
├── index.html
├── css/styles.css
├── js/
│   ├── config.js      ← Supabase keys, POS_CONFIG, constantes
│   ├── state.js       ← State + Supabase API + Auth + Roles
│   ├── rating.js      ← Decaimiento temporal y tendencia
│   ├── algorithm.js   ← Simulated Annealing
│   ├── ui.js          ← Render y navegación
│   └── app.js         ← Acciones del usuario y flujo de auth
├── sql/
│   ├── supabase-master.sql  ← Crear todo desde cero
│   └── supabase-fixes.sql   ← Fixes sobre DB existente
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CHANGELOG.md
│   └── SUPABASE_SETUP.md
└── .gitignore
```

---

## Setup

```bash
# 1. Supabase: ejecutar sql/supabase-master.sql
# 2. Pegar URL y anon key en js/config.js
# 3. Correr localmente
npx serve .
```

## Roadmap

| Sprint | Estado | Descripción |
|--------|--------|-------------|
| Sprint 1 | ✅ | Algoritmo SA, rating, undo, wizard |
| Sprint 2 | ✅ | Supabase sync, grupos |
| Sprint 3 | ✅ | Login, roles admin/member, permisos de votación |
| Sprint 4 | 📋 | Estadísticas, gráfico de evolución de rating |
| Sprint 5 | 📋 | RSVP, compartir por WhatsApp |
actualizacion del sql
