// ===================== STATE =====================
// Dev branch: roles de admin/member + permisos de votación

let state = {
  jugadores:       [],
  convocados:      [],
  equipoA:         [],   // IDs
  equipoB:         [],   // IDs
  equipoASnapshot: [],   // Objetos completos — para restaurar la vista al volver al tab
  equipoBSnapshot: [],   // Objetos completos
  sumA:            0,
  sumB:            0,
  historial:       [],
};

let grupoId     = null;
let currentUser = null;   // { id, email }
let authToken   = null;   // JWT Supabase
let currentRole = null;   // 'admin' | 'member'
let puedeVotar  = false;  // true si es admin O tiene permiso explícito

// ===================== SYNC STATUS =====================

function setSyncStatus(texto, color) {
  const el = document.getElementById('sync-status');
  if (el) { el.textContent = texto; el.style.color = color || 'var(--muted)'; }
}
function setSyncing()   { setSyncStatus('🔄 Sync...', 'var(--yellow)'); }
function setSynced()    { setSyncStatus('☁️ ' + new Date().toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}), 'var(--green)'); }
function setSyncError() { setSyncStatus('❌ Error', 'var(--red)'); }

// ===================== SUPABASE REST =====================

async function sbFetch(path, options = {}) {
  const url    = SUPABASE_URL + '/rest/v1/' + path;
  const bearer = authToken || SUPABASE_KEY;
  const prefer = options.prefer !== undefined ? options.prefer : 'return=representation';
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
  localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
    token:  authToken,
    user:   currentUser,
    expiry: Date.now() + (data.expires_in * 1000),
  }));
  // Guardar/actualizar email en user_profiles para que otros usuarios lo vean
  try {
    await sbFetch('user_profiles', {
      method:  'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify({ user_id: currentUser.id, email: currentUser.email }),
    });
  } catch(e) { console.warn('[profiles] No se pudo guardar email:', e); }
  return currentUser;
}

async function registrarEmail(email, password) {
  const data = await sbAuth('signup', { email, password });
  if (data.access_token) {
    authToken   = data.access_token;
    currentUser = { id: data.user.id, email: data.user.email };
    localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
      token:  authToken,
      user:   currentUser,
      expiry: Date.now() + (data.expires_in * 1000),
    }));
    // Guardar email en user_profiles
    try {
      await sbFetch('user_profiles', {
        method:  'POST',
        headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
        body:    JSON.stringify({ user_id: currentUser.id, email: currentUser.email }),
      });
    } catch(e) { console.warn('[profiles] No se pudo guardar email:', e); }
  } else {
    currentUser = { id: data.user?.id, email: data.user?.email };
  }
  return data;
}

async function cerrarSesion() {
  if (authToken) {
    try {
      await fetch(SUPABASE_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + authToken },
      });
    } catch(e) {}
  }
  authToken   = null;
  currentUser = null;
  grupoId     = null;
  currentRole = null;
  puedeVotar  = false;
  state       = { jugadores:[], convocados:[], equipoA:[], equipoB:[], historial:[] };
  localStorage.removeItem(STORAGE_KEY + '_auth');
  localStorage.removeItem(STORAGE_KEY + '_session');
}

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_auth');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (saved.expiry && Date.now() > saved.expiry - 300000) {
      localStorage.removeItem(STORAGE_KEY + '_auth');
      return false;
    }
    authToken   = saved.token;
    currentUser = saved.user;
    return true;
  } catch(e) { return false; }
}

// ===================== GRUPO + ROLES =====================

async function cargarGrupoDelUsuario() {
  if (!currentUser) return null;
  try {
    const rows = await sbFetch('user_grupos?user_id=eq.' + currentUser.id + '&select=grupo_id,role');
    if (rows && rows.length > 0) {
      grupoId     = rows[0].grupo_id;
      currentRole = rows[0].role || 'member';
      return grupoId;
    }
    return null;
  } catch(e) {
    console.warn('[auth] No se pudo cargar grupo:', e);
    return null;
  }
}

// Crea grupo nuevo — el creador es admin
async function guardarGrupoDelUsuario(gid) {
  if (!currentUser) return;
  await sbFetch('user_grupos', {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify({ user_id: currentUser.id, grupo_id: gid, role: 'admin' }),
  });
  currentRole = 'admin';
}

// Unirse a grupo existente — siempre como member
async function actualizarGrupoDelUsuario(gid) {
  if (!currentUser) return;
  await sbFetch('user_grupos', {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify({ user_id: currentUser.id, grupo_id: gid, role: 'member' }),
  });
  grupoId     = gid;
  currentRole = 'member';
}

// ===================== PERMISOS DE VOTACIÓN =====================

// Carga si el usuario actual puede votar
// Admin siempre puede. Member solo si tiene permiso explícito.
async function cargarPermisoVotacion() {
  if (currentRole === 'admin') { puedeVotar = true; return; }
  try {
    const rows = await sbFetch(
      'voto_permisos?grupo_id=eq.' + grupoId + '&user_id=eq.' + currentUser.id + '&select=id'
    );
    puedeVotar = rows && rows.length > 0;
  } catch(e) { puedeVotar = false; }
}

// Carga lista de todos los miembros del grupo con su permiso y email real
async function cargarMiembrosGrupo() {
  // 1. Todos los users del grupo
  const miembros = await sbFetch(
    'user_grupos?grupo_id=eq.' + grupoId + '&select=user_id,role'
  );
  if (!miembros || !miembros.length) return [];

  // 2. Permisos de votación actuales
  const permisos = await sbFetch(
    'voto_permisos?grupo_id=eq.' + grupoId + '&select=user_id'
  );
  const permisosSet = new Set((permisos || []).map(p => p.user_id));

  // 3. Emails desde user_profiles (tabla pública que llenamos en login/registro)
  const userIds  = miembros.map(m => m.user_id);
  const inFilter = userIds.map(id => '"' + id + '"').join(',');
  let emailMap   = {};
  try {
    const profiles = await sbFetch(
      'user_profiles?user_id=in.(' + userIds.join(',') + ')&select=user_id,email'
    );
    (profiles || []).forEach(p => { emailMap[p.user_id] = p.email; });
  } catch(e) {
    console.warn('[miembros] No se pudieron cargar emails:', e);
  }

  return miembros.map(m => ({
    user_id:    m.user_id,
    role:       m.role || 'member',
    puedeVotar: m.role === 'admin' || permisosSet.has(m.user_id),
    esYo:       m.user_id === currentUser.id,
    // Mostrar email real si está disponible, si no el email propio, si no fragmento del ID
    label:      emailMap[m.user_id] || 
                (m.user_id === currentUser.id ? currentUser.email : '···' + m.user_id.slice(-8)),
  }));
}

// Dar permiso de votación a un member
async function darPermisoVotacion(userId) {
  await sbFetch('voto_permisos', {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify({
      grupo_id:     grupoId,
      user_id:      userId,
      otorgado_por: currentUser.id,
    }),
  });
}

// Quitar permiso de votación a un member
async function quitarPermisoVotacion(userId) {
  await sbFetch(
    'voto_permisos?grupo_id=eq.' + grupoId + '&user_id=eq.' + userId,
    { method: 'DELETE', prefer: '' }
  );
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
    convocados:      state.convocados,
    equipoA:         state.equipoA,
    equipoB:         state.equipoB,
    equipoASnapshot: state.equipoASnapshot || [],
    equipoBSnapshot: state.equipoBSnapshot || [],
    sumA:            state.sumA || 0,
    sumB:            state.sumB || 0,
  }));
}

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_session');
    if (raw) {
      const s = JSON.parse(raw);
      state.convocados      = s.convocados      || [];
      state.equipoA         = s.equipoA         || [];
      state.equipoB         = s.equipoB         || [];
      state.equipoASnapshot = s.equipoASnapshot || [];
      state.equipoBSnapshot = s.equipoBSnapshot || [];
      state.sumA            = s.sumA            || 0;
      state.sumB            = s.sumB            || 0;
    }
  } catch(e) {}
}

// ===================== HELPERS =====================

function getJugador(id)       { return state.jugadores.find(j => j.id === id) || null; }
function defaultAttrs(pos, r) { const a = {}; POS_CONFIG[pos].attrs.forEach(x => { a[x.key] = r; }); return a; }
function posBadge(pos)        { const c = POS_CONFIG[pos]||POS_CONFIG.MED; return `<span class="pos-badge badge-${pos}">${c.icon} ${c.label}</span>`; }
function generarGrupoId()     { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
function esAdmin()            { return currentRole === 'admin'; }

// ===================== INIT =====================

async function initApp() {
  setSyncStatus('⏳ Conectando...', 'var(--yellow)');
  const tieneAuth = loadAuthFromStorage();
  if (!tieneAuth) { mostrarLogin(); return; }

  setSyncStatus('⏳ Cargando...', 'var(--yellow)');
  try {
    const gid = await cargarGrupoDelUsuario();
    if (!gid) { mostrarOnboarding(); return; }
    await Promise.all([cargarJugadores(), cargarHistorial(), cargarPermisoVotacion()]);
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
