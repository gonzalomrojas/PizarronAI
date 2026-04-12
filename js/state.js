// ===================== STATE =====================
// Sprint 3: Auth con Supabase + grupo por usuario

let state = {
  jugadores:  [],
  convocados: [],
  equipoA:    [],
  equipoB:    [],
  historial:  [],
};

let grupoId    = null;
let currentUser = null;   // { id, email } del usuario logueado
let authToken   = null;   // JWT de Supabase — se usa en cada request

// ===================== SYNC STATUS UI =====================

function setSyncStatus(texto, color) {
  const el = document.getElementById('sync-status');
  if (el) { el.textContent = texto; el.style.color = color || 'var(--muted)'; }
}
function setSyncing()   { setSyncStatus('🔄 Sync...', 'var(--yellow)'); }
function setSynced()    { setSyncStatus('☁️ ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}), 'var(--green)'); }
function setSyncError() { setSyncStatus('❌ Error', 'var(--red)'); }

// ===================== SUPABASE REST =====================
// Usa authToken si hay sesión activa, sino la anon key

async function sbFetch(path, options = {}) {
  const url     = SUPABASE_URL + '/rest/v1/' + path;
  const bearer  = authToken || SUPABASE_KEY;
  const prefer  = options.prefer !== undefined ? options.prefer : 'return=representation';
  const headers = {
    'apikey':        SUPABASE_KEY,
    'Authorization': 'Bearer ' + bearer,
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

// Fetch para endpoints de Auth (/auth/v1/...)
async function sbAuth(path, body) {
  const res = await fetch(SUPABASE_URL + '/auth/v1/' + path, {
    method:  'POST',
    headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Error de autenticación');
  return data;
}

// ===================== AUTH =====================

async function loginEmail(email, password) {
  const data = await sbAuth('token?grant_type=password', { email, password });
  authToken   = data.access_token;
  currentUser = { id: data.user.id, email: data.user.email };
  // Guardar sesión en localStorage para persistir entre recargas
  localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
    token:  authToken,
    user:   currentUser,
    expiry: Date.now() + (data.expires_in * 1000),
  }));
  return currentUser;
}

async function registrarEmail(email, password) {
  const data = await sbAuth('signup', { email, password });
  // Supabase puede devolver sesión directamente si "confirm email" está desactivado
  if (data.access_token) {
    authToken   = data.access_token;
    currentUser = { id: data.user.id, email: data.user.email };
    localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
      token:  authToken,
      user:   currentUser,
      expiry: Date.now() + (data.expires_in * 1000),
    }));
  } else {
    // Si pide confirmar email
    currentUser = { id: data.user?.id, email: data.user?.email };
  }
  return data;
}

async function cerrarSesion() {
  // Llamar al endpoint de logout de Supabase
  if (authToken) {
    try {
      await fetch(SUPABASE_URL + '/auth/v1/logout', {
        method:  'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + authToken },
      });
    } catch(e) { console.warn('Error al hacer logout en Supabase:', e); }
  }
  // Limpiar todo el estado local
  authToken   = null;
  currentUser = null;
  grupoId     = null;
  state       = { jugadores:[], convocados:[], equipoA:[], equipoB:[], historial:[] };
  localStorage.removeItem(STORAGE_KEY + '_auth');
  localStorage.removeItem(STORAGE_KEY + '_session');
  // No borrar el grupo_id del storage — el usuario puede querer volver
}

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_auth');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    // Verificar que el token no esté expirado (con 5 min de margen)
    if (saved.expiry && Date.now() > saved.expiry - 300000) {
      localStorage.removeItem(STORAGE_KEY + '_auth');
      return false;
    }
    authToken   = saved.token;
    currentUser = saved.user;
    return true;
  } catch(e) { return false; }
}

// ===================== GRUPO POR USUARIO =====================

async function cargarGrupoDelUsuario() {
  if (!currentUser) return null;
  try {
    const rows = await sbFetch('user_grupos?user_id=eq.' + currentUser.id + '&select=grupo_id');
    if (rows && rows.length > 0) {
      grupoId = rows[0].grupo_id;
      return grupoId;
    }
    return null;
  } catch(e) {
    console.warn('[auth] No se pudo cargar grupo:', e);
    return null;
  }
}

async function guardarGrupoDelUsuario(gid) {
  if (!currentUser) return;
  await sbFetch('user_grupos', {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify({ user_id: currentUser.id, grupo_id: gid }),
  });
}

async function actualizarGrupoDelUsuario(gid) {
  if (!currentUser) return;
  // Upsert: si ya tiene grupo lo reemplaza
  await sbFetch('user_grupos', {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify({ user_id: currentUser.id, grupo_id: gid }),
  });
  grupoId = gid;
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
    if (raw) {
      const s = JSON.parse(raw);
      state.convocados = s.convocados || [];
      state.equipoA    = s.equipoA    || [];
      state.equipoB    = s.equipoB    || [];
    }
  } catch(e) {}
}

// ===================== HELPERS =====================

function getJugador(id)       { return state.jugadores.find(j => j.id === id) || null; }
function defaultAttrs(pos, r) { const a = {}; POS_CONFIG[pos].attrs.forEach(x => { a[x.key] = r; }); return a; }
function posBadge(pos)        { const c = POS_CONFIG[pos]||POS_CONFIG.MED; return `<span class="pos-badge badge-${pos}">${c.icon} ${c.label}</span>`; }
function generarGrupoId()     { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }

// ===================== INIT =====================

async function initApp() {
  setSyncStatus('⏳ Conectando...', 'var(--yellow)');

  // 1. Verificar si hay sesión guardada válida
  const tieneAuth = loadAuthFromStorage();

  if (!tieneAuth) {
    // No hay sesión → mostrar pantalla de login
    mostrarLogin();
    return;
  }

  // 2. Tiene sesión → cargar su grupo
  setSyncStatus('⏳ Cargando...', 'var(--yellow)');
  try {
    const gid = await cargarGrupoDelUsuario();
    if (!gid) {
      // Tiene cuenta pero no tiene grupo asignado → onboarding de grupo
      mostrarOnboarding();
      return;
    }
    // 3. Tiene grupo → cargar datos
    await cargarJugadores();
    await cargarHistorial();
    loadSession();
    setSynced();
    actualizarHeaderUsuario();
    mostrarApp();
  } catch(e) {
    console.error('[init]', e);
    setSyncStatus('❌ Error al cargar', 'var(--red)');
    mostrarLogin();
  }
}
