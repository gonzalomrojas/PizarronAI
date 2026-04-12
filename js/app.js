// ===================== APP.JS — Sprint 3: Auth =====================

let selectedPos = null;

// ===================== PANTALLAS =====================
// La app tiene 3 pantallas: login, onboarding de grupo, y la app principal.

function mostrarLogin() {
  document.getElementById('screen-login').style.display      = 'flex';
  document.getElementById('screen-onboarding').style.display = 'none';
  document.getElementById('screen-app').style.display        = 'none';
}

function mostrarOnboarding() {
  document.getElementById('screen-login').style.display      = 'none';
  document.getElementById('screen-onboarding').style.display = 'flex';
  document.getElementById('screen-app').style.display        = 'none';
}

function mostrarApp() {
  document.getElementById('screen-login').style.display      = 'none';
  document.getElementById('screen-onboarding').style.display = 'none';
  document.getElementById('screen-app').style.display        = 'block';
  renderJugadores();
}

function actualizarHeaderUsuario() {
  const el = document.getElementById('user-email-label');
  if (el && currentUser) el.textContent = currentUser.email;
  const grupoEl = document.getElementById('grupo-label');
  if (grupoEl && grupoId) grupoEl.textContent = '👥 Grupo: ' + grupoId;
}

// ===================== LOGIN / REGISTRO =====================

let modoLogin = 'login';  // 'login' | 'registro'

function toggleModoAuth() {
  modoLogin = modoLogin === 'login' ? 'registro' : 'login';
  const btn      = document.getElementById('btn-submit-auth');
  const toggle   = document.getElementById('btn-toggle-auth');
  const titulo   = document.getElementById('auth-titulo');
  const subtitulo = document.getElementById('auth-subtitulo');
  if (modoLogin === 'login') {
    titulo.textContent    = '👤 Iniciar sesión';
    subtitulo.textContent = '¿No tenés cuenta?';
    btn.textContent       = 'Entrar';
    toggle.textContent    = 'Registrarse';
  } else {
    titulo.textContent    = '✨ Crear cuenta';
    subtitulo.textContent = '¿Ya tenés cuenta?';
    btn.textContent       = 'Crear cuenta';
    toggle.textContent    = 'Iniciar sesión';
  }
  limpiarErrorAuth();
}

function mostrarErrorAuth(msg) {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}

function limpiarErrorAuth() {
  const el = document.getElementById('auth-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

async function submitAuth() {
  const email    = document.getElementById('input-auth-email').value.trim();
  const password = document.getElementById('input-auth-password').value;
  const btn      = document.getElementById('btn-submit-auth');

  if (!email || !password) { mostrarErrorAuth('Completá email y contraseña.'); return; }
  if (password.length < 6) { mostrarErrorAuth('La contraseña debe tener al menos 6 caracteres.'); return; }

  btn.disabled    = true;
  btn.textContent = '⏳ Procesando...';
  limpiarErrorAuth();

  try {
    if (modoLogin === 'login') {
      await loginEmail(email, password);
    } else {
      const data = await registrarEmail(email, password);
      // Si Supabase pide confirmar email
      if (!data.access_token) {
        btn.disabled    = false;
        btn.textContent = 'Crear cuenta';
        mostrarErrorAuth('✅ Revisá tu email para confirmar la cuenta, luego iniciá sesión.');
        return;
      }
    }

    // Login exitoso → cargar grupo
    setSyncStatus('⏳ Cargando...', 'var(--yellow)');
    const gid = await cargarGrupoDelUsuario();
    btn.disabled    = false;
    btn.textContent = modoLogin === 'login' ? 'Entrar' : 'Crear cuenta';

    if (!gid) {
      mostrarOnboarding();
    } else {
      await cargarJugadores();
      await cargarHistorial();
      loadSession();
      setSynced();
      actualizarHeaderUsuario();
      mostrarApp();
    }
  } catch(e) {
    btn.disabled    = false;
    btn.textContent = modoLogin === 'login' ? 'Entrar' : 'Crear cuenta';
    // Traducir errores comunes de Supabase al español
    let msg = e.message;
    if (msg.includes('Invalid login'))         msg = 'Email o contraseña incorrectos.';
    if (msg.includes('Email not confirmed'))   msg = 'Confirmá tu email antes de entrar.';
    if (msg.includes('User already registered')) msg = 'Ya existe una cuenta con ese email. Iniciá sesión.';
    mostrarErrorAuth(msg);
  }
}

// ===================== SALIR DE SESIÓN =====================

async function salirSesion() {
  if (!confirm('¿Cerrar sesión?\n\nTus datos quedan guardados en la nube.')) return;
  await cerrarSesion();
  // Resetear UI
  document.getElementById('input-auth-email').value    = '';
  document.getElementById('input-auth-password').value = '';
  document.getElementById('paso-grupo-crear').style.display  = 'block';
  document.getElementById('paso-grupo-creado').style.display = 'none';
  limpiarErrorAuth();
  mostrarLogin();
}

// ===================== CAMBIAR DE GRUPO =====================

async function cambiarGrupo() {
  if (!confirm('¿Cambiar de grupo?\n\nTus datos quedan guardados. Podés volver ingresando el mismo código.')) return;
  // Limpiar grupo local y estado
  grupoId    = null;
  state      = { jugadores:[], convocados:[], equipoA:[], equipoB:[], historial:[] };
  localStorage.removeItem(STORAGE_KEY + '_session');
  // Mostrar onboarding sin cerrar sesión
  document.getElementById('paso-grupo-crear').style.display  = 'block';
  document.getElementById('paso-grupo-creado').style.display = 'none';
  mostrarOnboarding();
}

// ===================== ONBOARDING DE GRUPO =====================

async function crearGrupo() {
  const id = generarGrupoId();
  grupoId   = id;
  document.getElementById('grupo-creado-codigo').textContent = id;
  document.getElementById('paso-grupo-crear').style.display  = 'none';
  document.getElementById('paso-grupo-creado').style.display = 'block';
}

async function confirmarGrupoCreado() {
  const btn = document.getElementById('btn-confirmar-grupo');
  btn.disabled    = true;
  btn.textContent = '⏳ Guardando...';
  try {
    await guardarGrupoDelUsuario(grupoId);
    await cargarJugadores();
    await cargarHistorial();
    loadSession();
    setSynced();
    actualizarHeaderUsuario();
    mostrarApp();
  } catch(e) {
    btn.disabled    = false;
    btn.textContent = '¡Listo, entrar!';
    alert('Error al guardar grupo: ' + e.message);
  }
}

async function unirseGrupo() {
  const val = document.getElementById('input-codigo-grupo').value.trim().toUpperCase();
  if (val.length < 4) { alert('Ingresá un código válido (mínimo 4 caracteres).'); return; }
  const btn = document.getElementById('btn-unirse-grupo');
  btn.disabled    = true;
  btn.textContent = '⏳ Verificando...';
  try {
    // Verificar que el grupo existe buscando jugadores con ese ID
    const url = SUPABASE_URL + '/rest/v1/jugadores?grupo_id=eq.' + val + '&limit=1';
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (authToken || SUPABASE_KEY) }
    });
    if (!res.ok) throw new Error('Error al verificar el grupo.');
    // Guardar grupo para este usuario
    await actualizarGrupoDelUsuario(val);
    await cargarJugadores();
    await cargarHistorial();
    loadSession();
    setSynced();
    actualizarHeaderUsuario();
    mostrarApp();
  } catch(e) {
    btn.disabled    = false;
    btn.textContent = 'Entrar';
    alert('Error: ' + e.message);
  }
}

function mostrarCodigo() {
  if (grupoId) alert('Código de tu grupo:\n\n' + grupoId + '\n\nCompartilo con tus amigos.');
}

// ===================== JUGADORES =====================

function selectPos(pos) {
  selectedPos = pos;
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  document.getElementById('pos-' + pos).classList.add('selected-' + pos);
}

async function agregarJugador() {
  const nombre = document.getElementById('input-nombre').value.trim();
  if (!nombre)      { alert('Ingresá un nombre.'); return; }
  if (!selectedPos) { alert('Elegí una posición.'); return; }
  if (state.jugadores.find(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Ya existe ese jugador.'); return;
  }
  const rating  = parseFloat(document.getElementById('input-rating').value);
  const jugador = {
    id: Date.now().toString(), nombre, pos: selectedPos, rating,
    attrs: defaultAttrs(selectedPos, rating),
    partidos: 0, historial_votos: [rating], votos_count: 1,
  };
  state.jugadores.push(jugador);
  document.getElementById('input-nombre').value = '';
  document.getElementById('input-rating').value = 5;
  document.getElementById('val-rating').textContent = '5.0';
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  selectedPos = null;
  renderJugadores();
  setSyncing();
  try { await syncJugador(jugador); setSynced(); }
  catch(e) { setSyncError(); console.error(e); }
}

async function eliminarJugador(id) {
  if (!confirm('¿Eliminar este jugador?')) return;
  state.jugadores  = state.jugadores.filter(j => j.id !== id);
  state.convocados = state.convocados.filter(c => c !== id);
  saveState();
  renderJugadores();
  setSyncing();
  try { await borrarJugador(id); setSynced(); }
  catch(e) { setSyncError(); }
}

async function guardarEdicion() {
  const j = getJugador(editandoId); if (!j) return;
  const pos = j.pos || 'MED';
  const cfg = POS_CONFIG[pos];
  const newRating = parseFloat(document.getElementById('edit-rating').value);
  j.rating = newRating;
  if (!j.historial_votos) j.historial_votos = [];
  j.historial_votos[j.historial_votos.length - 1] = newRating;
  if (!j.attrs) j.attrs = {};
  cfg.attrs.forEach(a => { j.attrs[a.key] = parseFloat(document.getElementById('edit-attr-' + a.key).value); });
  cerrarModal();
  renderJugadores();
  setSyncing();
  try { await syncJugador(j); setSynced(); }
  catch(e) { setSyncError(); }
}

// ===================== PARTIDO =====================

function toggleConvocado(id) {
  const idx = state.convocados.indexOf(id);
  if (idx === -1) state.convocados.push(id);
  else            state.convocados.splice(idx, 1);
  saveState();
  renderPartido();
}

// ===================== GUARDAR PARTIDO =====================

async function guardarPartido() {
  if (!state.equipoA.length) { alert('Primero generá los equipos.'); return; }
  const ga   = parseInt(document.getElementById('goles-a').value) || 0;
  const gb   = parseInt(document.getElementById('goles-b').value) || 0;
  const jugA = state.jugadores.filter(j => state.equipoA.includes(j.id));
  const jugB = state.jugadores.filter(j => state.equipoB.includes(j.id));
  const sumA = jugA.reduce((s,j) => s+j.rating, 0);
  const sumB = jugB.reduce((s,j) => s+j.rating, 0);
  const diff = Math.abs(sumA - sumB);
  const ganador     = ga > gb ? 'A' : gb > ga ? 'B' : 'Empate';
  const balance_tag = diff < 1.5 ? 'parejos' : diff < 3.5 ? 'algo_desiguales' : 'desiguales';
  let resultado_tag = 'empate';
  if (ganador !== 'Empate') {
    const fav = sumA > sumB ? 'A' : 'B';
    resultado_tag = ganador === fav ? 'gano_favorito' : 'sorpresa';
  }
  const snapshotJugadores = JSON.parse(JSON.stringify(state.jugadores));
  const partido = {
    id:      Date.now().toString(),
    fecha:   new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'}),
    hora:    new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}),
    equipoA: jugA.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    equipoB: jugB.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    sumA, sumB, golesA:ga, golesB:gb, ganador, balance_tag, resultado_tag, snapshotJugadores,
  };
  state.historial.unshift(partido);
  saveState();
  document.getElementById('seccion-resultado').style.display = 'none';
  document.getElementById('equipos-output').innerHTML +=
    '<div class="alert alert-green" style="margin-top:8px">✅ Partido guardado.</div>';
  updateWizard('historial');
  setSyncing();
  try { await syncPartido(partido); setSynced(); }
  catch(e) { setSyncError(); }
}

// ===================== UNDO =====================

async function deshacerPartido(id) {
  const idx = state.historial.findIndex(p => p.id === id);
  if (idx === -1) return;
  if (idx !== 0)  { alert('Solo podés deshacer el último partido.'); return; }
  const partido = state.historial[idx];
  if (!confirm(`¿Deshacer ${partido.golesA}–${partido.golesB} del ${partido.fecha}?\n\nEsto revertirá los ratings.`)) return;
  if (partido.snapshotJugadores) state.jugadores = partido.snapshotJugadores;
  state.historial.splice(idx, 1);
  saveState();
  renderHistorial();
  renderJugadores();
  setSyncing();
  try {
    await Promise.all([borrarPartido(id), syncJugadores(state.jugadores)]);
    setSynced();
    alert('✅ Partido deshecho.');
  } catch(e) { setSyncError(); }
}

// ===================== VOTOS =====================

async function guardarVotos() {
  const convocados = state.jugadores.filter(j => state.convocados.includes(j.id));
  if (!convocados.length) { alert('No hay jugadores convocados.'); return; }
  convocados.forEach(j => {
    const pos = j.pos || 'MED';
    const cfg = POS_CONFIG[pos];
    let sum   = 0;
    cfg.attrs.forEach(a => {
      const el = document.getElementById('vote-' + j.id + '-' + a.key); if(!el) return;
      const voto = parseFloat(el.value); sum += voto;
      if (!j.attrs) j.attrs = {};
      if (!j.historial_votos_attrs) j.historial_votos_attrs = {};
      if (!j.historial_votos_attrs[a.key]) j.historial_votos_attrs[a.key] = [j.attrs[a.key] || j.rating];
      j.historial_votos_attrs[a.key].push(voto);
      const va = j.historial_votos_attrs[a.key], na = va.length;
      let sp=0, sv=0;
      va.forEach((v,i) => { const p=i>=na-RECENT_N?RECENT_WEIGHT:1; sp+=p; sv+=v*p; });
      j.attrs[a.key] = sv/sp;
    });
    const avg = sum / cfg.attrs.length;
    if (!j.historial_votos) j.historial_votos = [j.rating];
    j.historial_votos.push(avg);
    j.rating      = calcRatingConDecaimiento(j);
    j.votos_count = (j.votos_count||0) + 1;
    j.partidos    = (j.partidos||0) + 1;
  });
  state.equipoA = [];
  state.equipoB = [];
  saveState();
  setSyncing();
  try {
    await syncJugadores(convocados);
    setSynced();
    alert('✅ Votos guardados y sincronizados.');
  } catch(e) { setSyncError(); alert('Error de sync: ' + e.message); }
  goTab('jugadores');
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', async () => {
  // Cerrar modal
  document.getElementById('modal-editar').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });
  // Slider rating
  document.getElementById('input-rating').addEventListener('input', function() {
    document.getElementById('val-rating').textContent = parseFloat(this.value).toFixed(1);
  });
  // Enter en formularios de auth
  document.getElementById('input-auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAuth();
  });
  document.getElementById('input-codigo-grupo').addEventListener('keydown', e => {
    if (e.key === 'Enter') unirseGrupo();
  });

  updateWizard('jugadores');
  await initApp();
});
