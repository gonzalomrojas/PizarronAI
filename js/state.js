// ===================== STATE =====================
// Sprint 2: sincronización con Supabase.
// Este archivo reemplaza al state.js local sin tocar nada más del proyecto.
//
// ARQUITECTURA:
//   - El state en memoria sigue siendo la fuente de verdad para la UI.
//   - Supabase es la fuente de verdad persistente y compartida.
//   - Cada operación escribe en Supabase Y actualiza el state local.
//   - Al iniciar, carga desde Supabase (no localStorage).
//
// GRUPO_ID:
//   - Código de 6 letras/números (ej: "PICHA1")
//   - Se guarda en localStorage del dispositivo
//   - Todos los amigos que usan el mismo código ven los mismos datos

let state = {
  jugadores:  [],
  convocados: [],
  equipoA:    [],
  equipoB:    [],
  historial:  [],
};

let grupoId = null;

// ---- Helpers de UI de sync ----
function setSyncStatus(texto, color) {
  const el = document.getElementById('sync-status');
  if (el) { el.textContent = texto; el.style.color = color || 'var(--muted)'; }
}
function setSyncing()   { setSyncStatus('🔄 Sincronizando...', 'var(--yellow)'); }
function setSynced()    { setSyncStatus('☁️ ' + new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}), 'var(--green)'); }
function setSyncError() { setSyncStatus('❌ Error de sync', 'var(--red)'); }

// ===================== SUPABASE REST API =====================

async function sbFetch(path, options = {}) {
  const url = SUPABASE_URL + '/rest/v1/' + path;
  const prefer = options.prefer !== undefined ? options.prefer : 'return=representation';
  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + SUPABASE_KEY,
    'Content-Type':  'application/json',
  };
  if (prefer) headers['Prefer'] = prefer;
  Object.assign(headers, options.headers || {});
  const res = await fetch(url, { method: options.method || 'GET', headers, body: options.body });
  if (!res.ok) {
    const err = await res.text();
    throw new Error('Supabase ' + res.status + ': ' + err);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ===================== JUGADORES =====================

function jugadorToRow(j) {
  return {
    id: j.id, grupo_id: grupoId, nombre: j.nombre, pos: j.pos || 'MED',
    rating: j.rating, attrs: j.attrs || {},
    historial_votos: j.historial_votos || [j.rating],
    historial_votos_attrs: j.historial_votos_attrs || {},
    partidos: j.partidos || 0, votos_count: j.votos_count || 1,
  };
}

function rowToJugador(row) {
  return {
    id: row.id, nombre: row.nombre, pos: row.pos, rating: row.rating,
    attrs: row.attrs || {}, historial_votos: row.historial_votos || [row.rating],
    historial_votos_attrs: row.historial_votos_attrs || {},
    partidos: row.partidos || 0, votos_count: row.votos_count || 1,
  };
}

async function cargarJugadores() {
  const rows = await sbFetch('jugadores?grupo_id=eq.' + grupoId + '&order=created_at.asc');
  state.jugadores = rows.map(rowToJugador);
}

async function syncJugador(j) {
  await sbFetch('jugadores', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=representation',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(jugadorToRow(j)),
  });
}

async function syncJugadores(lista) {
  await Promise.all(lista.map(j => syncJugador(j)));
}

async function borrarJugador(id) {
  await sbFetch('jugadores?id=eq.' + id + '&grupo_id=eq.' + grupoId, { method: 'DELETE', prefer: '' });
}

// ===================== PARTIDOS =====================

function partidoToRow(p) {
  return {
    id: p.id, grupo_id: grupoId, fecha: p.fecha, hora: p.hora,
    goles_a: p.golesA, goles_b: p.golesB, ganador: p.ganador,
    suma_a: p.sumA, suma_b: p.sumB,
    balance_tag: p.balance_tag, resultado_tag: p.resultado_tag,
    equipo_a: p.equipoA, equipo_b: p.equipoB,
    snapshot_jugadores: p.snapshotJugadores || null,
  };
}

function rowToPartido(row) {
  return {
    id: row.id, fecha: row.fecha, hora: row.hora,
    golesA: row.goles_a, golesB: row.goles_b, ganador: row.ganador,
    sumA: row.suma_a, sumB: row.suma_b,
    balance_tag: row.balance_tag, resultado_tag: row.resultado_tag,
    equipoA: row.equipo_a || [], equipoB: row.equipo_b || [],
    snapshotJugadores: row.snapshot_jugadores || null,
  };
}

async function cargarHistorial() {
  const rows = await sbFetch('partidos?grupo_id=eq.' + grupoId + '&order=created_at.desc');
  state.historial = rows.map(rowToPartido);
}

async function syncPartido(p) {
  await sbFetch('partidos', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body: JSON.stringify(partidoToRow(p)),
  });
}

async function borrarPartido(id) {
  await sbFetch('partidos?id=eq.' + id + '&grupo_id=eq.' + grupoId, { method: 'DELETE', prefer: '' });
}

// ===================== SESIÓN LOCAL =====================
// convocados y equipos son datos del organizador — van en localStorage

function saveState() {
  localStorage.setItem(STORAGE_KEY + '_session', JSON.stringify({
    convocados: state.convocados,
    equipoA:    state.equipoA,
    equipoB:    state.equipoB,
  }));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_session');
    if (raw) { const s = JSON.parse(raw); state.convocados = s.convocados||[]; state.equipoA = s.equipoA||[]; state.equipoB = s.equipoB||[]; }
  } catch(e) {}
}

// ===================== HELPERS =====================

function getJugador(id)        { return state.jugadores.find(j => j.id === id) || null; }
function defaultAttrs(pos, r)  { const a = {}; POS_CONFIG[pos].attrs.forEach(x => { a[x.key] = r; }); return a; }
function posBadge(pos)         { const c = POS_CONFIG[pos]||POS_CONFIG.MED; return `<span class="pos-badge badge-${pos}">${c.icon} ${c.label}</span>`; }

// ===================== GRUPO ID =====================

function getGrupoId()    { return localStorage.getItem(GRUPO_STORAGE_KEY) || null; }
function setGrupoId(id)  { grupoId = id.toUpperCase().trim(); localStorage.setItem(GRUPO_STORAGE_KEY, grupoId); }
function generarGrupoId(){ const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }

// ===================== INIT =====================

async function initSupabase() {
  setSyncStatus('⏳ Conectando...', 'var(--yellow)');
  const saved = getGrupoId();
  if (!saved) { grupoId = null; return false; }  // Necesita onboarding
  grupoId = saved;
  try {
    await cargarJugadores();
    await cargarHistorial();
    loadSession();
    setSynced();
    return true;
  } catch(e) {
    console.error('[supabase]', e);
    // Fallback offline desde localStorage viejo
    try { const r = localStorage.getItem(STORAGE_KEY); if(r){const o=JSON.parse(r); state.jugadores=o.jugadores||[]; state.historial=o.historial||[];} } catch(_){}
    loadSession();
    setSyncStatus('⚠️ Sin conexión', 'var(--orange)');
    return true;
  }
}
