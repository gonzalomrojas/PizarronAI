# Changelog

Todos los cambios significativos del proyecto están documentados acá.

Formato basado en [Keep a Changelog](https://keepachangelog.com/es/1.0.0/).

---

## [Sprint 3] — 2026-04-12 — Sistema de autenticación

### Agregado
- Pantalla de login con email y contraseña (Supabase Auth)
- Pantalla de registro de cuenta nueva
- Sesión persistente mediante JWT — no requiere re-login entre visitas
- Tabla `user_grupos` que vincula cada cuenta con su grupo
- Botón "↔ Grupo" para cambiar de grupo sin cerrar sesión
- Botón "✕ Salir" para cerrar sesión completamente
- Email del usuario visible en el header mientras está logueado
- Traducción de errores de Supabase al español en la UI
- Toggle entre modo login y registro sin cambiar de pantalla

### Modificado
- `state.js`: agregado `authToken`, `currentUser`, funciones de auth y grupo por usuario
- `app.js`: flujo completamente asíncrono con manejo de 3 pantallas (login / onboarding / app)
- `index.html`: reestructurado con `#screen-login`, `#screen-onboarding`, `#screen-app`

### Técnico
- El JWT se adjunta a cada request REST para que RLS de Supabase funcione correctamente
- Fallback offline: si Supabase no responde, carga desde localStorage anterior
- Expiración de token detectada al iniciar — redirige a login automáticamente

---

## [Sprint 2] — 2026-04-10 — Sincronización en la nube

### Agregado
- Integración con Supabase REST API (sin SDK, fetch nativo)
- Sistema de grupos con código de 6 caracteres (ej: `HKXR72`)
- Pantalla de onboarding para crear o unirse a un grupo
- Código del grupo visible en el header, copiable con un tap
- Indicador de sync en tiempo real (🔄 Sincronizando... / ☁️ Guardado / ❌ Error)
- `sbFetch()` — wrapper genérico para Supabase REST API con manejo de errores
- Serialización/deserialización de jugadores y partidos (row ↔ objeto JS)

### Modificado
- `state.js`: reemplazado localStorage por Supabase como fuente de verdad
- `app.js`: todas las acciones son async y sincronizan con Supabase
- Convocados y equipos siguen en localStorage (son datos del dispositivo del organizador)

### Base de datos
- Tabla `jugadores` con `grupo_id`, atributos JSONB, historial de votos como array
- Tabla `partidos` con snapshot de jugadores para UNDO
- Row Level Security habilitado con política de acceso abierto por grupo
- Índices en `grupo_id` para queries rápidas

---

## [Sprint 1] — 2026-04-08 — Base de la aplicación

### Agregado
- Tarjetas de jugador estilo FIFA/EA FC con OVR (rating × 10)
- 4 posiciones con atributos específicos por rol (ARQ, DEF, MED, ATA)
- Selector visual de posición al registrar jugador
- Algoritmo de equipos en 3 pasos:
  1. Constraint duro: 1 arquero por equipo
  2. Distribución greedy por rating
  3. Simulated Annealing (400 iteraciones, temperatura decreciente)
- Rating con decaimiento temporal (últimos 5 partidos pesan 3×)
- Indicador de tendencia: ↑ Mejorando / ↓ Bajando / → Estable
- Votación de atributos por posición después de cada partido
- Preview del nuevo OVR en tiempo real durante la votación
- Historial de partidos con tags automáticos (Parejos / Sorpresa / Favorito)
- Botón "↩ Deshacer" para el último partido — revierte ratings via snapshot
- Wizard de progreso en el header (5 pasos: Plantilla → Convocar → Equipos → Votar → Historial)
- Fix de scroll-to-top al cambiar de tab en móvil
- Soporte de safe-area para iPhone (notch y barra de gestos)

### Arquitectura
- Proyecto separado en 6 módulos JS con responsabilidades únicas
- `config.js` — constantes y configuración
- `state.js` — capa de datos y persistencia
- `rating.js` — lógica de rating y tendencia
- `algorithm.js` — algoritmo de equipos
- `ui.js` — funciones de render y navegación
- `app.js` — punto de entrada y acciones del usuario
