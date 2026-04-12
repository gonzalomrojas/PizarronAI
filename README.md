# ⚽ Pizarrón AI

> App web para organizar partidos de fútbol entre amigos — con equipos balanceados por inteligencia artificial, ratings evolutivos y sincronización en la nube.

**Demo en vivo:** [gonzalomrojas.github.io/PizarronAI](https://gonzalomrojas.github.io/PizarronAI/)  
**Repositorio:** [github.com/gonzalomrojas/PizarronAI](https://github.com/gonzalomrojas/PizarronAI)  
**Backend:** [Supabase](https://supabase.com) — PostgreSQL + Auth + REST API

---

## Índice

- [Demo](#demo)
- [Funcionalidades](#funcionalidades)
- [Arquitectura](#arquitectura)
- [Stack tecnológico](#stack-tecnológico)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Instalación local](#instalación-local)
- [Configuración de Supabase](#configuración-de-supabase)
- [Roadmap](#roadmap)
- [Convención de commits](#convención-de-commits)

---

## Funcionalidades

### Sistema de usuarios
- Registro e inicio de sesión con email y contraseña (Supabase Auth)
- Sesión persistente con JWT — no requiere re-login en cada visita
- Botón de cerrar sesión y cambio de grupo sin perder datos

### Sistema de grupos
- Código de 6 caracteres compartible (ej: `HKXR72`)
- Todos los miembros del grupo ven los mismos jugadores, partidos y ratings en tiempo real
- Un usuario puede cambiar de grupo sin perder su cuenta

### Gestión de jugadores
- Tarjetas estilo FIFA/EA FC con OVR (rating × 10) prominente
- 4 posiciones con atributos específicos por rol:
  - 🧤 **Arquero** — Reflejos, Posicionamiento, Manejo, Salida
  - 🛡️ **Defensa** — Marcación, Anticipo, Juego aéreo, Velocidad
  - 🎯 **Mediocampista** — Pase, Visión, Recuperación, Regate
  - ⚡ **Ataque** — Definición, Velocidad, Regate, Cabezazo

### Algoritmo de equipos
- **Constraint duro:** garantiza al menos 1 arquero por equipo cuando hay 2+ disponibles
- **Greedy inicial:** distribución por rating de mayor a menor
- **Simulated Annealing:** 400 iteraciones con temperatura decreciente para escapar mínimos locales
- Muestra la diferencia de puntos y un tag de balance (Muy parejos / Aceptable / Desbalanceados)

### Rating con decaimiento temporal
- Los últimos 5 partidos pesan 3× más que los anteriores
- Evita que el rating quede "congelado" en jugadores con muchos partidos
- Indicador de tendencia: ↑ Mejorando / ↓ Bajando / → Estable

### Historial
- Todos los partidos guardados con resultado, equipos y diferencia de ratings
- Botón "↩ Deshacer" en el último partido — revierte ratings a snapshot previo
- Tags automáticos: Ganó el favorito / Sorpresa / Empate

---

## Arquitectura

```
Browser (Vanilla JS)
    │
    ├── index.html         Estructura y pantallas (Login / Onboarding / App)
    ├── css/styles.css     Estilos (dark theme, componentes)
    └── js/
        ├── config.js      Credenciales Supabase, POS_CONFIG, constantes
        ├── state.js       State en memoria + toda la comunicación con Supabase REST API
        ├── rating.js      Algoritmo de decaimiento temporal y tendencia
        ├── algorithm.js   Simulated Annealing para balance de equipos
        ├── ui.js          Funciones de render, navegación, tabs, wizard
        └── app.js         Punto de entrada, handlers, flujo de autenticación

Supabase (Backend as a Service)
    ├── Auth               Email/password, JWT, sesiones
    ├── jugadores          Tabla con jugadores por grupo
    ├── partidos           Tabla con historial de partidos
    └── user_grupos        Tabla que vincula usuario ↔ grupo
```

**Flujo de datos:**
1. Usuario inicia sesión → Supabase Auth devuelve JWT
2. JWT se adjunta a cada request REST → Supabase valida via RLS
3. App carga jugadores y partidos del grupo del usuario
4. Cada acción (agregar jugador, guardar partido, etc.) escribe en Supabase y actualiza el state local
5. Estado de sesión (convocados, equipos) persiste en localStorage del dispositivo

---

## Stack tecnológico

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Frontend | HTML + CSS + Vanilla JS | Sin build step, deploy instantáneo en GitHub Pages |
| Backend | Supabase (PostgreSQL) | Auth, REST API y tiempo real sin servidor propio |
| Hosting | GitHub Pages | Gratuito, deploys automáticos desde main |
| Algoritmo | Simulated Annealing | Mejor que greedy, sin necesidad de solver externo |
| Auth | Supabase Auth (JWT) | Session management, RLS, sin backend propio |

---


## Estructura del proyecto

```
PizarronAI/

│
├── index.html                 ← Punto de entrada. Contiene las 3 pantallas:
│                                  Login, Onboarding de grupo, App principal
│
├── css/
│   └── styles.css             ← Todos los estilos. Dark theme, componentes
│                                  reutilizables, responsive mobile-first
│
├── js/
│   ├── config.js              ← Credenciales Supabase, POS_CONFIG (posiciones
│   │                             y atributos), constantes del algoritmo SA
│   │
│   ├── state.js               ← State global + toda la capa de datos:
│   │                             • sbFetch() — wrapper de Supabase REST API
│   │                             • Auth: loginEmail, registrarEmail, cerrarSesion
│   │                             • Jugadores: cargarJugadores, syncJugador, borrarJugador
│   │                             • Partidos: cargarHistorial, syncPartido, borrarPartido
│   │                             • Grupos: cargarGrupoDelUsuario, guardarGrupoDelUsuario
│   │                             • initApp() — punto de entrada async
│   │
│   ├── rating.js              ← Sistema de rating con decaimiento temporal:
│   │                             • calcRatingConDecaimiento() — media ponderada
│   │                             • calcTrend() — tendencia últimos 3 partidos
│   │                             • simularNuevoRating() — preview en votación
│   │
│   ├── algorithm.js           ← Generación de equipos balanceados:
│   │                             • Paso 1: constraint duro de arqueros
│   │                             • Paso 2: distribución greedy por rating
│   │                             • Paso 3: Simulated Annealing (400 iter.)
│   │                             • renderEquipos() — UI de resultado
│   │
│   ├── ui.js                  ← Todas las funciones de render:
│   │                             • goTab() — navegación con scroll-to-top móvil
│   │                             • renderFifaCard() — tarjeta FIFA por jugador
│   │                             • renderJugadores(), renderPartido(), renderHistorial()
│   │                             • prepararVotacion(), actualizarVotoPreview()
│   │                             • abrirEditar(), cerrarModal()
│   │                             • updateWizard() — barra de progreso
│   │
│   └── app.js                 ← Punto de entrada y acciones del usuario:
│                                  • Auth: submitAuth, salirSesion, cambiarGrupo
│                                  • Grupo: crearGrupo, unirseGrupo, confirmarGrupoCreado
│                                  • CRUD jugadores: agregarJugador, eliminarJugador
│                                  • Partidos: guardarPartido, deshacerPartido
│                                  • Votos: guardarVotos
│                                  • DOMContentLoaded init
│
├── sql/
│   └── supabase-setup.sql     ← Script completo para crear las tablas en Supabase:
│                                  jugadores, partidos, user_grupos
│                                  Índices, RLS policies
│
├── docs/
│   ├── ARCHITECTURE.md        ← Diagrama de arquitectura detallado
│   ├── CHANGELOG.md           ← Historial de cambios por sprint
│   └── SUPABASE_SETUP.md      ← Guía paso a paso para configurar Supabase
│
├── .gitignore                 ← node_modules, .env, keys de Supabase
└── README.md                  ← Este archivo
```

---

## Instalación local

No requiere instalación. Abrí `index.html` directamente en el browser.

Si el browser bloquea scripts por CORS (Chrome con archivos locales):

```bash
# Con Node.js
npx serve .

# Con Python
python3 -m http.server 8080
```

Luego abrí `http://localhost:8080`

---

## Configuración de Supabase

Ver guía detallada en [`docs/SUPABASE_SETUP.md`](docs/SUPABASE_SETUP.md)

**Resumen rápido:**
1. Crear proyecto en [supabase.com](https://supabase.com)
2. SQL Editor → ejecutar `sql/supabase-setup.sql`
3. Authentication → Providers → Email habilitado
4. Authentication → Settings → desactivar "Confirm email" (desarrollo)
5. Copiar URL y anon key a `js/config.js`

---


## Roadmap

| Sprint | Estado | Descripción |
|--------|--------|-------------|

| Sprint 1 | ✅ Completo | Algoritmo SA, rating con decaimiento, undo, wizard de progreso |
| Sprint 2 | ✅ Completo | Supabase sync, sistema de grupos compartidos |
| Sprint 3 | ✅ Completo | Login/registro, sesiones JWT, cambio de grupo, cerrar sesión |
| Sprint 4 | 📋 Planificado | Estadísticas por jugador, gráfico de evolución de rating |
| Sprint 5 | 📋 Planificado | RSVP de convocatoria, compartir equipos por WhatsApp |

---


## Convención de commits

```

feat:     nueva funcionalidad
fix:      corrección de bug
refactor: reorganización sin cambio de comportamiento
style:    cambios de UI/CSS sin lógica
docs:     actualización de documentación
chore:    tareas de mantenimiento (deps, config)
```

**Ejemplos:**
```bash
git commit -m "feat: sistema de login con Supabase Auth"
git commit -m "fix: scroll to top en cambio de tab en móvil"
git commit -m "refactor: separar state.js en módulos independientes"
```

---

## Autor

**Gonzalo M. Rojas**  
Proyecto personal — Pizarrón AI  
[github.com/gonzalomrojas](https://github.com/gonzalomrojas)

