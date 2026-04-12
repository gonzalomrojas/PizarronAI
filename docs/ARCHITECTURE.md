# Arquitectura técnica — Pizarrón AI

---

## Visión general

Pizarrón AI es una **Single Page Application (SPA)** construida con HTML, CSS y JavaScript vanilla, sin frameworks ni herramientas de build. El backend es completamente serverless, usando Supabase como BaaS (Backend as a Service).

```
┌─────────────────────────────────────────────┐
│              Browser (Cliente)              │
│                                             │
│  index.html                                 │
│  ├── #screen-login     (pantalla inicial)   │
│  ├── #screen-onboarding (setup de grupo)    │
│  └── #screen-app       (aplicación)         │
│                                             │
│  js/                                        │
│  ├── config.js    ← constantes y claves     │
│  ├── state.js     ← datos + Supabase API    │
│  ├── rating.js    ← lógica de rating        │
│  ├── algorithm.js ← Simulated Annealing     │
│  ├── ui.js        ← render + navegación     │
│  └── app.js       ← acciones + init         │
└──────────────────┬──────────────────────────┘
                   │ HTTPS / REST API + JWT
                   │
┌──────────────────▼──────────────────────────┐
│              Supabase (Backend)              │
│                                             │
│  Auth ──── JWT ──── RLS                     │
│                                             │
│  PostgreSQL                                 │
│  ├── jugadores      (datos de jugadores)    │
│  ├── partidos       (historial)             │
│  └── user_grupos    (usuario ↔ grupo)       │
└─────────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────┐
│           GitHub Pages (Hosting)            │
│   gonzalomrojas.github.io/PizarronAI        │
└─────────────────────────────────────────────┘
```

---

## Flujo de autenticación

```
Usuario abre la app
        │
        ▼
loadAuthFromStorage()
        │
   ┌────┴────┐
   │ ¿Token  │
   │ válido? │
   └────┬────┘
     No │         Sí
        │          │
        ▼          ▼
   mostrarLogin   cargarGrupoDelUsuario()
        │              │
        │         ┌────┴────┐
        │         │ ¿Tiene  │
        │         │ grupo?  │
        │         └────┬────┘
        │           No │    Sí
        │              │     │
        │              ▼     ▼
        │         mostrar  cargarJugadores()
        │         Onboarding  + cargarHistorial()
        │              │          │
        │              │          ▼
        └──────────────┴───► mostrarApp()
```

---

## Módulos JavaScript

### config.js
Único lugar donde viven las credenciales y la configuración global.
Cambiar `RECENT_N` o `RECENT_WEIGHT` afecta todo el sistema de rating.
Cambiar `SA_ITERATIONS` afecta la calidad del balance de equipos.

### state.js
La capa más importante del proyecto. Responsabilidades:
- Mantener el state en memoria (`jugadores`, `historial`, etc.)
- Proveer `sbFetch()` — wrapper de fetch con auth headers automáticos
- Todas las operaciones CRUD contra Supabase
- Gestión de sesión Auth (login, logout, token persistence)
- Vinculación usuario ↔ grupo (`user_grupos`)
- `initApp()` — orquesta el inicio de la aplicación

### rating.js
Algoritmo de decaimiento temporal:

```
Rating = Σ(voto_i × peso_i) / Σ(peso_i)

donde:
  peso_i = RECENT_WEIGHT  si i está en los últimos RECENT_N partidos
  peso_i = 1              si no
```

Con `RECENT_N=5` y `RECENT_WEIGHT=3`, los últimos 5 partidos
tienen 3 veces más influencia que los anteriores.

### algorithm.js
Simulated Annealing para balance de equipos:

```
1. Separar ARQ del resto
2. Si hay ≥2 ARQ → asignar 1 a cada equipo (constraint duro)
3. Distribuir el resto con greedy (mayor rating al equipo con menor suma)
4. Para i en 0..SA_ITERATIONS:
     temp = SA_TEMP_INITIAL × SA_COOLING^i
     elegir swap aleatorio (ignorar ARQ titulares)
     si mejora → aceptar siempre
     si empeora → aceptar con probabilidad exp(-Δ/temp)
```

La temperatura alta al principio permite explorar soluciones subóptimas
para escapar mínimos locales. Al bajar, solo acepta mejoras.

### ui.js
Renderiza el DOM en respuesta a cambios del state. No modifica datos.
Responsabilidades: `goTab()`, `renderFifaCard()`, `renderJugadores()`,
`renderPartido()`, `prepararVotacion()`, `renderHistorial()`, modales.

### app.js
Punto de entrada. Conecta eventos de usuario → modificaciones de state → sync con Supabase.
Responsabilidades: handlers de auth, CRUD de jugadores, guardar/deshacer partidos,
guardar votos, `DOMContentLoaded` init.

---

## Decisiones de diseño

### ¿Por qué Vanilla JS sin framework?
- Deploy en GitHub Pages sin build step
- Cero dependencias — el ZIP del proyecto pesa 27KB
- Suficiente para la escala del proyecto (< 50 usuarios, < 200 jugadores)
- Fácil de leer y modificar sin conocer ecosistemas específicos

### ¿Por qué Supabase REST API directamente?
- Sin SDK = sin dependencias externas
- `sbFetch()` es un wrapper de 15 líneas que cubre todos los casos
- Fácil de reemplazar por otro backend en el futuro

### ¿Por qué localStorage para convocados y equipos?
- Son datos del organizador del partido, no del grupo completo
- No tiene sentido sincronizar "quién convocaste hoy" entre todos los dispositivos
- Si cierra la app y la vuelve a abrir, recupera la selección

### ¿Por qué snapshot de jugadores en cada partido?
- Permite UNDO completo sin recalcular nada
- El snapshot guarda el estado exacto de todos los ratings antes del partido
- Trade-off: más storage en Supabase, pero la simplicidad del código lo justifica

---

## Seguridad

- La **anon key** de Supabase es pública por diseño — está en el código del browser
- La **secret key** nunca aparece en el frontend ni en el repo
- Row Level Security habilitado en todas las tablas
- En el Sprint actual, la política de RLS es abierta (cualquiera puede leer/escribir)
- En Sprint 4 se endurecerá: solo el dueño del grupo puede modificar datos

---

## Consideraciones de escala

El proyecto está diseñado para grupos de amigos (10-50 usuarios por instancia).
Para escalar a miles de usuarios habría que:

1. Migrar a un framework (React/Vue) para manejo de estado más robusto
2. Agregar caché de queries (actualmente cada tab reload hace fetch a Supabase)
3. Implementar Supabase Realtime para sync instantáneo entre dispositivos
4. Endurecer las políticas RLS para que cada usuario solo vea su grupo
