// ===================== STATE =====================
// Única fuente de verdad de la app.
// En Sprint 2 este archivo se reemplaza por supabase.js
// sin tocar nada más del proyecto.

let state = {
  jugadores:  [],   // Array de objetos jugador
  convocados: [],   // Array de IDs convocados para el partido actual
  equipoA:    [],   // Array de IDs del equipo A generado
  equipoB:    [],   // Array de IDs del equipo B generado
  historial:  [],   // Array de partidos jugados (más reciente primero)
};

// ---- Persistencia (localStorage — temporal hasta Supabase) ----

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch (e) {
    console.warn('[state] No se pudo cargar el estado:', e);
  }
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const hora = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('sync-status');
    if (el) el.textContent = '💾 Guardado ' + hora;
  } catch (e) {
    console.error('[state] Error al guardar:', e);
  }
}

// ---- Helpers de jugadores ----

function getJugador(id) {
  return state.jugadores.find(j => j.id === id) || null;
}

function defaultAttrs(pos, rating) {
  const attrs = {};
  POS_CONFIG[pos].attrs.forEach(a => { attrs[a.key] = rating; });
  return attrs;
}

function posBadge(pos) {
  const cfg = POS_CONFIG[pos] || POS_CONFIG.MED;
  return `<span class="pos-badge badge-${pos}">${cfg.icon} ${cfg.label}</span>`;
}

// Inicializar al cargar la página
loadState();
