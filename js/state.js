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
let refreshToken = null;  // Token para renovar la sesión
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

async function sbFetch(path, options = {}, _isRetry = false) {
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
    // Si el JWT expiró y tenemos refresh token, renovamos y reintentamos UNA vez
    if (res.status === 401 && err.includes('JWT expired') && !_isRetry && refreshToken) {
      const renovado = await refreshSession();
      if (renovado) {
        return sbFetch(path, options, true);  // reintento con token nuevo
      }
    }
    throw new Error('Supabase ' + res.status + ': ' + err);
  }
  if (res.status === 204) return null;
  return res.json();
}

// Renueva la sesión usando el refresh token. Devuelve true si tuvo éxito.
async function refreshSession() {
  if (!refreshToken) return false;
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/token?grant_type=refresh_token', {
      method:  'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) {
      // El refresh token también expiró — hay que volver a loguearse
      console.warn('[auth] Refresh token inválido, requiere login');
      return false;
    }
    const data = await res.json();
    authToken    = data.access_token;
    refreshToken = data.refresh_token;
    // Actualizar localStorage con los tokens nuevos
    localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
      token:        authToken,
      refreshToken: refreshToken,
      user:         currentUser,
      expiry:       Date.now() + (data.expires_in * 1000),
    }));
    return true;
  } catch(e) {
    console.error('[auth] Error al renovar sesión:', e);
    return false;
  }
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
  authToken    = data.access_token;
  refreshToken = data.refresh_token;
  currentUser  = { id: data.user.id, email: data.user.email };
  localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
    token:        authToken,
    refreshToken: refreshToken,
    user:         currentUser,
    expiry:       Date.now() + (data.expires_in * 1000),
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
    authToken    = data.access_token;
    refreshToken = data.refresh_token;
    currentUser  = { id: data.user.id, email: data.user.email };
    localStorage.setItem(STORAGE_KEY + '_auth', JSON.stringify({
      token:        authToken,
      refreshToken: refreshToken,
      user:         currentUser,
      expiry:       Date.now() + (data.expires_in * 1000),
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
  authToken    = null;
  refreshToken = null;
  currentUser  = null;
  grupoId      = null;
  currentRole  = null;
  puedeVotar   = false;
  state       = { jugadores:[], convocados:[], equipoA:[], equipoB:[], historial:[] };
  localStorage.removeItem(STORAGE_KEY + '_auth');
  localStorage.removeItem(STORAGE_KEY + '_session');
}

function loadAuthFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY + '_auth');
    if (!raw) return false;
    const saved = JSON.parse(raw);
    authToken    = saved.token;
    refreshToken = saved.refreshToken || null;
    currentUser  = saved.user;
    // Si el token expiró pero tenemos refresh token, lo renovamos en initApp.
    // Si no hay refresh token y expiró, requiere login.
    if (saved.expiry && Date.now() > saved.expiry - 60000) {
      if (!refreshToken) {
        localStorage.removeItem(STORAGE_KEY + '_auth');
        return false;
      }
      // hay refresh token — marcamos que necesita renovación
      return 'needs_refresh';
    }
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

  // 4. Ver qué jugadores ya están vinculados
  const vinculacionMap = {};
  state.jugadores.forEach(j => {
    if (j.auth_user_id) vinculacionMap[j.auth_user_id] = j;
  });

  return miembros.map(m => ({
    user_id:       m.user_id,
    role:          m.role || 'member',
    puedeVotar:    m.role === 'admin' || permisosSet.has(m.user_id),
    esYo:          m.user_id === currentUser.id,
    label:         emailMap[m.user_id] ||
                   (m.user_id === currentUser.id ? currentUser.email : '···' + m.user_id.slice(-8)),
    jugadorVinc:   vinculacionMap[m.user_id] || null,  // jugador vinculado a esta cuenta
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
    attrs_generales: j.attrs_generales || {},
    historial_votos: j.historial_votos || [j.rating],
    historial_votos_attrs: j.historial_votos_attrs || {},
    partidos: j.partidos || 0, votos_count: j.votos_count || 1,
    auth_user_id: j.auth_user_id || null,
  };
}

function rowToJugador(row) {
  return {
    id: row.id, nombre: row.nombre, pos: row.pos, rating: row.rating,
    attrs: row.attrs || {},
    attrs_generales: row.attrs_generales || {},
    historial_votos: row.historial_votos || [row.rating],
    historial_votos_attrs: row.historial_votos_attrs || {},
    partidos: row.partidos || 0, votos_count: row.votos_count || 1,
    auth_user_id: row.auth_user_id || null,
  };
}

async function cargarJugadores() {
  const rows = await sbFetch('jugadores?grupo_id=eq.' + grupoId + '&order=created_at.asc');
  state.jugadores = rows.map(rowToJugador);
  // Descarta convocados "fantasma": IDs que quedaron guardados localmente
  // pero ya no corresponden a ningún jugador real (borrado, otro dispositivo, etc.)
  const idsValidos = new Set(state.jugadores.map(j => j.id));
  state.convocados = state.convocados.filter(id => idsValidos.has(id));
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
    mvp_abierto:        p.mvp_abierto        || false,
    mvp_jugador_id:     p.mvp_jugador_id     || null,
    mvp_jugador_nombre: p.mvp_jugador_nombre || null,
    votacion_rendimiento_abierta: p.votacion_rendimiento_abierta || false,
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
    // MVP
    mvp_abierto:        row.mvp_abierto        || false,
    mvp_jugador_id:     row.mvp_jugador_id     || null,
    mvp_jugador_nombre: row.mvp_jugador_nombre || null,
    // Votación rendimiento
    votacion_rendimiento_abierta: row.votacion_rendimiento_abierta || false,
  };
}

async function cargarHistorial() {
  // Columnas explícitas — garantiza que votacion_rendimiento_abierta viene aunque sea null
  const cols = [
    'id','grupo_id','fecha','hora','goles_a','goles_b','ganador',
    'suma_a','suma_b','balance_tag','resultado_tag',
    'equipo_a','equipo_b','snapshot_jugadores','created_at',
    'mvp_abierto','mvp_jugador_id','mvp_jugador_nombre',
    'votacion_rendimiento_abierta'
  ].join(',');
  const rows = await sbFetch('partidos?grupo_id=eq.' + grupoId + '&order=created_at.desc&select=' + cols);
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

// ===================== PARTIDOS PENDIENTES DE RESULTADO =====================
// Un partido "pendiente" es un registro de historial ya guardado (equipos +
// snapshot) pero sin resultado cargado todavía (ganador == null). Se crea al
// compartir el emparejamiento por WhatsApp, así el armado no depende de que
// la sesión del navegador siga viva cuando volvés a cargar el resultado.

function idsIguales(a, b) {
  if (a.length !== b.length) return false;
  const sa = [...a].sort(), sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function buscarPendienteActual() {
  if (!state.equipoA.length) return null;
  return state.historial.find(p =>
    p.ganador == null &&
    idsIguales((p.equipoA || []).map(j => j.id), state.equipoA) &&
    idsIguales((p.equipoB || []).map(j => j.id), state.equipoB)
  ) || null;
}

function buscarFinalizadoActual() {
  if (!state.equipoA.length) return null;
  return state.historial.find(p =>
    p.ganador != null &&
    idsIguales((p.equipoA || []).map(j => j.id), state.equipoA) &&
    idsIguales((p.equipoB || []).map(j => j.id), state.equipoB)
  ) || null;
}

// Crea (si no existe ya) el registro pendiente para el emparejamiento actual.
async function asegurarPartidoPendiente() {
  if (!state.equipoA.length) return null;
  const existente = buscarPendienteActual();
  if (existente) return existente;

  const jugA = state.jugadores.filter(j => state.equipoA.includes(j.id));
  const jugB = state.jugadores.filter(j => state.equipoB.includes(j.id));
  const partido = {
    id:      Date.now().toString(),
    fecha:   new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'}),
    hora:    new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}),
    equipoA: jugA.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    equipoB: jugB.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    sumA: state.sumA || 0, sumB: state.sumB || 0,
    golesA: null, golesB: null, ganador: null, balance_tag: null, resultado_tag: null,
    snapshotJugadores: JSON.parse(JSON.stringify(state.jugadores)),
  };
  state.historial.unshift(partido);
  saveState();
  try { await syncPartido(partido); } catch(e) { /* se resincroniza al reintentar */ }
  return partido;
}

// Calcula ganador / tags de balance y resultado a partir de los goles cargados
function calcularResultadoPartido(sumA, sumB, ga, gb) {
  const diff        = Math.abs(sumA - sumB);
  const ganador     = ga > gb ? 'A' : gb > ga ? 'B' : 'Empate';
  const balance_tag = diff < 1.5 ? 'parejos' : diff < 3.5 ? 'algo_desiguales' : 'desiguales';
  let resultado_tag = 'empate';
  if (ganador !== 'Empate') {
    const fav = sumA > sumB ? 'A' : 'B';
    resultado_tag = ganador === fav ? 'gano_favorito' : 'sorpresa';
  }
  return { ganador, balance_tag, resultado_tag };
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
function defaultAttrs(pos, r) {
  const a = {};
  POS_CONFIG[pos].attrs.forEach(x => { a[x.key] = r; });
  return a;
}
function defaultAttrsGenerales(r) {
  const a = {};
  ATTRS_GENERALES.forEach(x => { a[x.key] = r; });
  return a;
}
function posBadge(pos)        { const c = POS_CONFIG[pos]||POS_CONFIG.MED; return `<span class="pos-badge badge-${pos}">${c.icon} ${c.label}</span>`; }
function generarGrupoId()     { const c='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>c[Math.floor(Math.random()*c.length)]).join(''); }
function esAdmin()            { return currentRole === 'admin'; }



// ===================== VINCULACIÓN JUGADOR ↔ CUENTA =====================
// El admin puede asociar un jugador existente con una cuenta de usuario.
// Esto permite que la app sepa quién es quién y evite el auto-voto en MVP.

// Vincular jugador con una cuenta de usuario (solo admin)
async function vincularJugadorAUsuario(jugadorId, authUserId) {
  // Verificar que ese usuario no esté ya vinculado a otro jugador en el grupo
  const existente = state.jugadores.find(
    j => j.auth_user_id === authUserId && j.id !== jugadorId
  );
  if (existente) {
    throw new Error(
      'Ese usuario ya está vinculado al jugador "' + existente.nombre + '".'
    );
  }
  await sbFetch('jugadores?id=eq.' + jugadorId + '&grupo_id=eq.' + grupoId, {
    method: 'PATCH',
    prefer: 'return=representation',
    body:   JSON.stringify({ auth_user_id: authUserId }),
  });
  // Actualizar state local
  const j = state.jugadores.find(p => p.id === jugadorId);
  if (j) j.auth_user_id = authUserId;
}

// Desvincular jugador de su cuenta
async function desvincularJugador(jugadorId) {
  await sbFetch('jugadores?id=eq.' + jugadorId + '&grupo_id=eq.' + grupoId, {
    method: 'PATCH',
    prefer: 'return=representation',
    body:   JSON.stringify({ auth_user_id: null }),
  });
  const j = state.jugadores.find(p => p.id === jugadorId);
  if (j) j.auth_user_id = null;
}

// Obtener el jugador vinculado al usuario actual (si existe)
function getJugadorDelUsuarioActual() {
  if (!currentUser) return null;
  return state.jugadores.find(j => j.auth_user_id === currentUser.id) || null;
}

// Retorna true si el jugador está vinculado al usuario actual
function esJugadorPropio(jugadorId) {
  if (!currentUser) return false;
  const j = state.jugadores.find(p => p.id === jugadorId);
  return j && j.auth_user_id === currentUser.id;
}


// ===================== VOTACIÓN DE RENDIMIENTO POR PARTIDO =====================

async function abrirVotacionRendimiento(partidoId) {
  await sbFetch('partidos?id=eq.' + partidoId + '&grupo_id=eq.' + grupoId, {
    method: 'PATCH',
    prefer: 'return=representation',
    body:   JSON.stringify({ votacion_rendimiento_abierta: true }),
  });
  const p = state.historial.find(h => h.id === partidoId);
  if (p) p.votacion_rendimiento_abierta = true;
}

async function yaVoteRendimiento(partidoId) {
  if (!currentUser) return true;
  const rows = await sbFetch(
    'votos_rendimiento_sesion?partido_id=eq.' + partidoId +
    '&voter_id=eq.' + currentUser.id + '&select=id'
  );
  return rows && rows.length > 0;
}

async function guardarVotosRendimiento(partidoId, votosMap) {
  const inserts = Object.entries(votosMap).map(([jugadorId, data]) => ({
    partido_id:  partidoId,
    grupo_id:    grupoId,
    voter_id:    currentUser.id,
    jugador_id:  jugadorId,
    attrs_votos: data.attrs_votos,
    promedio:    data.promedio,
  }));
  await Promise.all(inserts.map(row =>
    sbFetch('votos_rendimiento', {
      method:  'POST',
      headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
      body:    JSON.stringify(row),
    })
  ));
  // Marcar sesión completa — bloquea reingreso
  await sbFetch('votos_rendimiento_sesion', {
    method:  'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:    JSON.stringify({ partido_id: partidoId, grupo_id: grupoId, voter_id: currentUser.id }),
  });
}

async function aplicarVotosRendimientoAJugadores(partidoId) {
  const votos = await sbFetch(
    'votos_rendimiento?partido_id=eq.' + partidoId + '&select=jugador_id,attrs_votos,promedio'
  );
  if (!votos || !votos.length) return;

  const porJugador = {};
  votos.forEach(v => {
    if (!porJugador[v.jugador_id]) porJugador[v.jugador_id] = [];
    porJugador[v.jugador_id].push(v);
  });

  const actualizados = [];
  Object.entries(porJugador).forEach(([jugId, votosJug]) => {
    const j = state.jugadores.find(p => p.id === jugId);
    if (!j) return;
    const cfg = POS_CONFIG[j.pos || 'MED'];
    if (!j.historial_votos_attrs) j.historial_votos_attrs = {};
    if (!j.attrs_generales)       j.attrs_generales = defaultAttrsGenerales(j.rating);

    // Atributos de posición
    cfg.attrs.forEach(a => {
      const vals = votosJug.map(v => v.attrs_votos[a.key]).filter(x => x != null);
      if (!vals.length) return;
      const avg = vals.reduce((s,x) => s+x, 0) / vals.length;
      if (!j.historial_votos_attrs[a.key]) j.historial_votos_attrs[a.key] = [j.attrs[a.key] || j.rating];
      j.historial_votos_attrs[a.key].push(avg);
      const va = j.historial_votos_attrs[a.key], na = va.length;
      let sp=0, sv=0;
      va.forEach((v,i) => { const pw=i>=na-RECENT_N?RECENT_WEIGHT:1; sp+=pw; sv+=v*pw; });
      j.attrs[a.key] = sv/sp;
    });

    // Atributos generales
    ATTRS_GENERALES.forEach(a => {
      const vals = votosJug.map(v => v.attrs_votos[a.key]).filter(x => x != null);
      if (!vals.length) return;
      const avg  = vals.reduce((s,x) => s+x, 0) / vals.length;
      const hkey = 'gen_' + a.key;
      if (!j.historial_votos_attrs[hkey]) j.historial_votos_attrs[hkey] = [j.attrs_generales[a.key] || j.rating];
      j.historial_votos_attrs[hkey].push(avg);
      const va = j.historial_votos_attrs[hkey], na = va.length;
      let sp=0, sv=0;
      va.forEach((v,i) => { const pw=i>=na-RECENT_N?RECENT_WEIGHT:1; sp+=pw; sv+=v*pw; });
      j.attrs_generales[a.key] = sv/sp;
    });

    const promGen = votosJug.reduce((s,v) => s+v.promedio, 0) / votosJug.length;
    if (!j.historial_votos) j.historial_votos = [j.rating];
    j.historial_votos.push(promGen);
    j.rating      = calcRatingConDecaimiento(j);
    j.votos_count = (j.votos_count||0) + 1;
    j.partidos    = (j.partidos||0) + 1;
    actualizados.push(j);
  });

  if (actualizados.length) await syncJugadores(actualizados);
}

async function abrirVotacionMVP(partidoId) {
  await sbFetch('partidos?id=eq.' + partidoId + '&grupo_id=eq.' + grupoId, {
    method: 'PATCH',
    prefer: 'return=representation',
    body:   JSON.stringify({ mvp_abierto: true, mvp_jugador_id: null, mvp_jugador_nombre: null }),
  });
  const idx = state.historial.findIndex(p => p.id === partidoId);
  if (idx !== -1) { state.historial[idx].mvp_abierto = true; state.historial[idx].mvp_jugador_id = null; }
}

// Cerrar votación MVP y grabar ganador (solo admin)
async function cerrarVotacionMVP(partidoId) {
  // Calcular ganador contando votos
  const votos = await sbFetch('votos_mvp?partido_id=eq.' + partidoId + '&select=jugador_id');
  if (!votos || !votos.length) throw new Error('No hay votos todavía.');

  // Contar votos por jugador
  const conteo = {};
  votos.forEach(v => { conteo[v.jugador_id] = (conteo[v.jugador_id] || 0) + 1; });
  const ganadorId = Object.entries(conteo).sort((a,b) => b[1]-a[1])[0][0];

  // Buscar nombre del jugador
  const partido   = state.historial.find(p => p.id === partidoId);
  const todosJug  = [...(partido?.equipoA||[]), ...(partido?.equipoB||[])];
  const ganadorNombre = todosJug.find(j => j.id === ganadorId)?.nombre || ganadorId;

  await sbFetch('partidos?id=eq.' + partidoId + '&grupo_id=eq.' + grupoId, {
    method: 'PATCH',
    prefer: 'return=representation',
    body:   JSON.stringify({ mvp_abierto: false, mvp_jugador_id: ganadorId, mvp_jugador_nombre: ganadorNombre }),
  });
  if (partido) { partido.mvp_abierto = false; partido.mvp_jugador_id = ganadorId; partido.mvp_jugador_nombre = ganadorNombre; }
  return { ganadorId, ganadorNombre, conteo };
}

// Votar MVP (todos los miembros del grupo)
async function votarMVP(partidoId, jugadorId) {
  await sbFetch('votos_mvp', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=merge-duplicates,return=representation' },
    body:   JSON.stringify({ partido_id: partidoId, grupo_id: grupoId, voter_id: currentUser.id, jugador_id: jugadorId }),
  });
}

// Verificar si el usuario ya votó en este partido
async function yaVoteMVP(partidoId) {
  const rows = await sbFetch('votos_mvp?partido_id=eq.' + partidoId + '&voter_id=eq.' + currentUser.id + '&select=id');
  return rows && rows.length > 0;
}

// Cargar conteo de votos de un partido
async function cargarVotosMVP(partidoId) {
  const rows = await sbFetch('votos_mvp?partido_id=eq.' + partidoId + '&select=jugador_id');
  const conteo = {};
  (rows||[]).forEach(v => { conteo[v.jugador_id] = (conteo[v.jugador_id] || 0) + 1; });
  return conteo;
}

// Recargar historial desde Supabase (para ver votos en tiempo real)
async function refrescarHistorial() {
  await cargarHistorial();
}

// ===================== ESTADÍSTICAS =====================

// Calcula stats completas de un jugador a partir del historial
function calcularStatsJugador(jugadorId) {
  const stats = {
    partidos:  0,
    ganados:   0,
    perdidos:  0,
    empatados: 0,
    mvps:      0,
    rachaActual:   0,
    rachaMejor:    0,
    evolucionRating: [],  // últimos 10 partidos [{ fecha, rating }]
  };

  // Ordenar historial de más viejo a más nuevo para calcular racha
  const historialOrdenado = [...state.historial].reverse();

  let rachaTemp  = 0;
  let rachaActiva = true;

  historialOrdenado.forEach(p => {
    const enA = (p.equipoA||[]).some(j => j.id === jugadorId);
    const enB = (p.equipoB||[]).some(j => j.id === jugadorId);
    if (!enA && !enB) return;

    stats.partidos++;

    // Resultado
    const miEquipo = enA ? 'A' : 'B';
    if (p.ganador === 'Empate')         stats.empatados++;
    else if (p.ganador === miEquipo)    { stats.ganados++;  rachaTemp++; }
    else                                { stats.perdidos++; if (rachaActiva) { stats.rachaActual = rachaTemp; rachaActiva = false; } rachaTemp = 0; }

    if (rachaTemp > stats.rachaMejor) stats.rachaMejor = rachaTemp;

    // MVP
    if (p.mvp_jugador_id === jugadorId) stats.mvps++;

    // Evolución de rating — tomar rating del snapshot del partido
    const snap = (p.snapshotJugadores||[]).find(j => j.id === jugadorId);
    if (snap && stats.evolucionRating.length < 10) {
      stats.evolucionRating.push({ fecha: p.fecha, rating: snap.rating });
    }
  });

  // Si nunca perdió en el historial disponible, racha activa es rachaTemp
  if (rachaActiva) stats.rachaActual = rachaTemp;

  return stats;
}

// Stats generales del grupo (para rankings)
function calcularStatsGrupo() {
  return state.jugadores.map(j => ({
    ...j,
    stats: calcularStatsJugador(j.id),
  })).sort((a, b) => b.rating - a.rating);
}

// ===================== INIT =====================

async function initApp() {
  setSyncStatus('⏳ Conectando...', 'var(--yellow)');
  const tieneAuth = loadAuthFromStorage();
  if (!tieneAuth) { mostrarLogin(); return; }

  // Si el token está vencido pero hay refresh token, renovamos primero
  if (tieneAuth === 'needs_refresh') {
    setSyncStatus('🔄 Renovando sesión...', 'var(--yellow)');
    const renovado = await refreshSession();
    if (!renovado) {
      localStorage.removeItem(STORAGE_KEY + '_auth');
      mostrarLogin();
      return;
    }
  }

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
