// ===================== APP.JS — Dev: Roles + Permisos de votación =====================

let selectedPos = null;

// ===================== PANTALLAS =====================

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
  aplicarRestriccionesPorRol();
  renderJugadores();
}

// Muestra/oculta elementos según el rol del usuario
function aplicarRestriccionesPorRol() {
  const admin  = esAdmin();
  const votar  = puedeVotar;

  // Solo admin ve botones de gestión de plantilla
  document.querySelectorAll('.solo-admin').forEach(el => {
    el.style.display = admin ? '' : 'none';
  });
  // Solo admin ve panel de miembros
  const panelMiembros = document.getElementById('panel-miembros');
  if (panelMiembros) panelMiembros.style.display = admin ? 'block' : 'none';

  // Badge de rol en header
  const badge = document.getElementById('role-badge');
  if (badge) {
    badge.textContent = admin ? '👑 Admin' : '👤 Member';
    badge.style.color = admin ? 'var(--yellow)' : 'var(--muted)';
  }

  // Tab de votar — visible pero bloqueado si no tiene permiso
  const tabVotar = document.getElementById('tab-btn-votar');
  if (tabVotar) {
    tabVotar.style.opacity = votar ? '1' : '0.4';
    tabVotar.title = votar ? '' : 'El admin debe darte permiso para votar';
  }
}

function actualizarHeaderUsuario() {
  const el = document.getElementById('user-email-label');
  if (el && currentUser) el.textContent = currentUser.email;
  const grupoEl = document.getElementById('grupo-label');
  if (grupoEl && grupoId) grupoEl.textContent = '👥 ' + grupoId;
  aplicarRestriccionesPorRol();
}

// ===================== LOGIN / REGISTRO =====================

let modoLogin = 'login';

function toggleModoAuth() {
  modoLogin = modoLogin === 'login' ? 'registro' : 'login';
  const isLogin = modoLogin === 'login';
  document.getElementById('auth-titulo').textContent    = isLogin ? '👤 Iniciar sesión' : '✨ Crear cuenta';
  document.getElementById('auth-subtitulo').textContent = isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?';
  document.getElementById('btn-submit-auth').textContent = isLogin ? 'Entrar' : 'Crear cuenta';
  document.getElementById('btn-toggle-auth').textContent = isLogin ? 'Registrarse' : 'Iniciar sesión';
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
  btn.disabled = true; btn.textContent = '⏳ Procesando...'; limpiarErrorAuth();
  try {
    if (modoLogin === 'login') {
      await loginEmail(email, password);
    } else {
      const data = await registrarEmail(email, password);
      if (!data.access_token) {
        btn.disabled = false; btn.textContent = 'Crear cuenta';
        mostrarErrorAuth('✅ Revisá tu email para confirmar la cuenta.');
        return;
      }
    }
    const gid = await cargarGrupoDelUsuario();
    btn.disabled = false;
    btn.textContent = modoLogin === 'login' ? 'Entrar' : 'Crear cuenta';
    if (!gid) { mostrarOnboarding(); }
    else {
      await Promise.all([cargarJugadores(), cargarHistorial(), cargarPermisoVotacion()]);
      loadSession(); setSynced(); actualizarHeaderUsuario(); mostrarApp();
    }
  } catch(e) {
    btn.disabled = false;
    btn.textContent = modoLogin === 'login' ? 'Entrar' : 'Crear cuenta';
    let msg = e.message;
    if (msg.includes('Invalid login'))            msg = 'Email o contraseña incorrectos.';
    if (msg.includes('Email not confirmed'))      msg = 'Confirmá tu email antes de entrar.';
    if (msg.includes('User already registered'))  msg = 'Ya existe una cuenta con ese email.';
    mostrarErrorAuth(msg);
  }
}

// ===================== SESIÓN =====================

async function salirSesion() {
  if (!confirm('¿Cerrar sesión?\n\nTus datos quedan guardados en la nube.')) return;
  await cerrarSesion();
  document.getElementById('input-auth-email').value    = '';
  document.getElementById('input-auth-password').value = '';
  document.getElementById('paso-grupo-crear').style.display  = 'block';
  document.getElementById('paso-grupo-creado').style.display = 'none';
  limpiarErrorAuth();
  mostrarLogin();
}

async function cambiarGrupo() {
  if (!confirm('¿Cambiar de grupo?\n\nTus datos quedan guardados. Podés volver con el mismo código.')) return;
  grupoId = null; currentRole = null; puedeVotar = false;
  state   = { jugadores:[], convocados:[], equipoA:[], equipoB:[], historial:[] };
  localStorage.removeItem(STORAGE_KEY + '_session');
  document.getElementById('paso-grupo-crear').style.display  = 'block';
  document.getElementById('paso-grupo-creado').style.display = 'none';
  mostrarOnboarding();
}

// ===================== ONBOARDING GRUPO =====================

async function crearGrupo() {
  grupoId = generarGrupoId();
  document.getElementById('grupo-creado-codigo').textContent = grupoId;
  document.getElementById('paso-grupo-crear').style.display  = 'none';
  document.getElementById('paso-grupo-creado').style.display = 'block';
}

async function confirmarGrupoCreado() {
  const btn = document.getElementById('btn-confirmar-grupo');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';
  try {
    await guardarGrupoDelUsuario(grupoId);  // role: admin
    await Promise.all([cargarJugadores(), cargarHistorial(), cargarPermisoVotacion()]);
    loadSession(); setSynced(); actualizarHeaderUsuario(); mostrarApp();
  } catch(e) {
    btn.disabled = false; btn.textContent = '¡Listo, entrar!';
    alert('Error: ' + e.message);
  }
}

async function unirseGrupo() {
  const val = document.getElementById('input-codigo-grupo').value.trim().toUpperCase();
  if (val.length < 4) { alert('Código inválido.'); return; }
  const btn = document.getElementById('btn-unirse-grupo');
  btn.disabled = true; btn.textContent = '⏳ Verificando...';
  try {
    const url = SUPABASE_URL + '/rest/v1/jugadores?grupo_id=eq.' + val + '&limit=1';
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + (authToken || SUPABASE_KEY) }
    });
    if (!res.ok) throw new Error('No se pudo verificar el grupo.');
    await actualizarGrupoDelUsuario(val);  // role: member
    await Promise.all([cargarJugadores(), cargarHistorial(), cargarPermisoVotacion()]);
    loadSession(); setSynced(); actualizarHeaderUsuario(); mostrarApp();
  } catch(e) {
    btn.disabled = false; btn.textContent = 'Entrar';
    alert('Error: ' + e.message);
  }
}

function mostrarCodigo() {
  if (grupoId) alert('Código del grupo:\n\n' + grupoId + '\n\nCompartilo con tus amigos.');
}

// ===================== PANEL DE MIEMBROS (solo admin) =====================

async function abrirPanelMiembros() {
  if (!esAdmin()) return;
  const modal   = document.getElementById('modal-miembros');
  const cuerpo  = document.getElementById('miembros-lista');
  modal.classList.add('open');
  cuerpo.innerHTML = '<div style="color:var(--muted);font-size:13px;padding:10px 0">⏳ Cargando miembros...</div>';

  try {
    const miembros = await cargarMiembrosGrupo();
    if (!miembros.length) { cuerpo.innerHTML = '<div class="empty">No hay otros miembros en el grupo todavía.</div>'; return; }

    cuerpo.innerHTML = miembros.map(m => `
      <div class="miembro-row">
        <div class="miembro-info">
          <span class="miembro-label">${m.label}${m.esYo ? ' <em style="color:var(--muted)">(vos)</em>' : ''}</span>
          <span class="role-chip ${m.role === 'admin' ? 'role-admin' : 'role-member'}">
            ${m.role === 'admin' ? '👑 Admin' : '👤 Member'}
          </span>
        </div>
        ${!m.esYo && m.role !== 'admin' ? `
          <div class="miembro-accion">
            <span style="font-size:11px;color:var(--muted);margin-right:8px">
              ${m.puedeVotar ? '⭐ Puede votar' : '🔒 Sin permiso'}
            </span>
            ${m.puedeVotar
              ? `<button class="btn-permiso btn-quitar" onclick="togglePermiso('${m.user_id}', false, this)">Quitar permiso</button>`
              : `<button class="btn-permiso btn-dar"   onclick="togglePermiso('${m.user_id}', true,  this)">Dar permiso</button>`
            }
          </div>` : ''}
      </div>`).join('');
  } catch(e) {
    cuerpo.innerHTML = '<div style="color:var(--red);font-size:13px">Error al cargar miembros.</div>';
  }
}

async function togglePermiso(userId, dar, btn) {
  btn.disabled = true;
  btn.textContent = '⏳';
  try {
    if (dar) {
      await darPermisoVotacion(userId);
      btn.textContent  = 'Quitar permiso';
      btn.className    = 'btn-permiso btn-quitar';
      btn.onclick      = () => togglePermiso(userId, false, btn);
      btn.previousElementSibling.textContent = '⭐ Puede votar';
    } else {
      await quitarPermisoVotacion(userId);
      btn.textContent  = 'Dar permiso';
      btn.className    = 'btn-permiso btn-dar';
      btn.onclick      = () => togglePermiso(userId, true, btn);
      btn.previousElementSibling.textContent = '🔒 Sin permiso';
    }
    btn.disabled = false;
  } catch(e) {
    btn.disabled = false;
    btn.textContent = 'Error';
    alert('No se pudo cambiar el permiso: ' + e.message);
  }
}

function cerrarPanelMiembros() {
  document.getElementById('modal-miembros').classList.remove('open');
}

// ===================== JUGADORES (solo admin puede agregar/editar/borrar) =====================

function selectPos(pos) {
  selectedPos = pos;
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  document.getElementById('pos-' + pos).classList.add('selected-' + pos);
}

async function agregarJugador() {
  if (!esAdmin()) { alert('Solo el admin puede agregar jugadores.'); return; }
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
  document.getElementById('input-nombre').value     = '';
  document.getElementById('input-rating').value     = 5;
  document.getElementById('val-rating').textContent = '5.0';
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  selectedPos = null;
  renderJugadores();
  setSyncing();
  try { await syncJugador(jugador); setSynced(); } catch(e) { setSyncError(); }
}

async function eliminarJugador(id) {
  if (!esAdmin()) { alert('Solo el admin puede eliminar jugadores.'); return; }
  if (!confirm('¿Eliminar este jugador?')) return;
  state.jugadores  = state.jugadores.filter(j => j.id !== id);
  state.convocados = state.convocados.filter(c => c !== id);
  saveState(); renderJugadores();
  setSyncing();
  try { await borrarJugador(id); setSynced(); } catch(e) { setSyncError(); }
}

async function guardarEdicion() {
  if (!esAdmin()) { alert('Solo el admin puede editar jugadores.'); return; }
  const j = getJugador(editandoId); if (!j) return;
  const pos = j.pos || 'MED';
  const cfg = POS_CONFIG[pos];
  const newRating = parseFloat(document.getElementById('edit-rating').value);
  j.rating = newRating;
  if (!j.historial_votos) j.historial_votos = [];
  j.historial_votos[j.historial_votos.length - 1] = newRating;
  if (!j.attrs) j.attrs = {};
  cfg.attrs.forEach(a => { j.attrs[a.key] = parseFloat(document.getElementById('edit-attr-' + a.key).value); });
  cerrarModal(); renderJugadores();
  setSyncing();
  try { await syncJugador(j); setSynced(); } catch(e) { setSyncError(); }
}

// ===================== PARTIDO =====================

function toggleConvocado(id) {
  const idx = state.convocados.indexOf(id);
  if (idx === -1) state.convocados.push(id);
  else            state.convocados.splice(idx, 1);
  saveState(); renderPartido();
}

async function guardarPartido() {
  if (!esAdmin()) { alert('Solo el admin puede guardar partidos.'); return; }
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
  try { await syncPartido(partido); setSynced(); } catch(e) { setSyncError(); }
}

async function deshacerPartido(id) {
  if (!esAdmin()) { alert('Solo el admin puede deshacer partidos.'); return; }
  const idx = state.historial.findIndex(p => p.id === id);
  if (idx === -1) return;
  if (idx !== 0)  { alert('Solo podés deshacer el último partido.'); return; }
  const partido = state.historial[idx];
  if (!confirm(`¿Deshacer ${partido.golesA}–${partido.golesB} del ${partido.fecha}?`)) return;
  if (partido.snapshotJugadores) state.jugadores = partido.snapshotJugadores;
  state.historial.splice(idx, 1);
  saveState(); renderHistorial(); renderJugadores();
  setSyncing();
  try {
    await Promise.all([borrarPartido(id), syncJugadores(state.jugadores)]);
    setSynced(); alert('✅ Partido deshecho. Ratings revertidos.');
  } catch(e) { setSyncError(); }
}

// ===================== VOTOS (admin + members con permiso) =====================

async function guardarVotos() {
  if (!puedeVotar) {
    alert('No tenés permiso para votar.\n\nPedile al admin del grupo que te lo habilite.');
    return;
  }
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
  state.equipoA = []; state.equipoB = [];
  saveState(); setSyncing();
  try {
    await syncJugadores(convocados); setSynced();
    alert('✅ Votos guardados y sincronizados.');
  } catch(e) { setSyncError(); alert('Error de sync: ' + e.message); }
  goTab('jugadores');
}


// ===================== CARGA MANUAL DE PARTIDO (historial) =====================
// El admin puede registrar un partido viejo o corregir un resultado.

function abrirModalPartidoManual() {
  if (!esAdmin()) { alert('Solo el admin puede cargar partidos manualmente.'); return; }
  const modal = document.getElementById('modal-partido-manual');
  if (!modal) { alert('Modal no encontrado.'); return; }

  // Poblar selectores de jugadores disponibles
  const opts = state.jugadores
    .sort((a,b) => a.nombre.localeCompare(b.nombre))
    .map(j => `<option value="${j.id}">${j.nombre} (${(POS_CONFIG[j.pos]||POS_CONFIG.MED).icon} ${j.rating.toFixed(1)})</option>`)
    .join('');

  document.getElementById('manual-jugadores-a').innerHTML = opts;
  document.getElementById('manual-jugadores-b').innerHTML = opts;
  document.getElementById('manual-fecha').value = new Date().toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'});
  document.getElementById('manual-goles-a').value = '';
  document.getElementById('manual-goles-b').value = '';

  modal.classList.add('open');
}

function cerrarModalManual() {
  const modal = document.getElementById('modal-partido-manual');
  if (modal) modal.classList.remove('open');
}

async function guardarPartidoManual() {
  if (!esAdmin()) return;

  const fecha  = document.getElementById('manual-fecha').value.trim();
  const ga     = parseInt(document.getElementById('manual-goles-a').value);
  const gb     = parseInt(document.getElementById('manual-goles-b').value);

  if (!fecha) { alert('Ingresá una fecha.'); return; }
  if (isNaN(ga) || isNaN(gb)) { alert('Ingresá el resultado.'); return; }

  // Obtener jugadores seleccionados de cada equipo
  const selA = Array.from(document.getElementById('manual-jugadores-a').selectedOptions).map(o => o.value);
  const selB = Array.from(document.getElementById('manual-jugadores-b').selectedOptions).map(o => o.value);

  if (!selA.length || !selB.length) { alert('Seleccioná al menos un jugador por equipo (mantené Ctrl/Cmd para seleccionar varios).'); return; }

  // Verificar que no haya jugadores en ambos equipos
  const duplicados = selA.filter(id => selB.includes(id));
  if (duplicados.length) { alert('Hay jugadores en ambos equipos. Cada jugador debe estar en uno solo.'); return; }

  const jugA = state.jugadores.filter(j => selA.includes(j.id));
  const jugB = state.jugadores.filter(j => selB.includes(j.id));
  const sumA = jugA.reduce((s,j) => s+j.rating, 0);
  const sumB = jugB.reduce((s,j) => s+j.rating, 0);
  const diff = Math.abs(sumA-sumB);
  const ganador     = ga > gb ? 'A' : gb > ga ? 'B' : 'Empate';
  const balance_tag = diff < 1.5 ? 'parejos' : diff < 3.5 ? 'algo_desiguales' : 'desiguales';
  let resultado_tag = 'empate';
  if (ganador !== 'Empate') {
    const fav = sumA > sumB ? 'A' : 'B';
    resultado_tag = ganador === fav ? 'gano_favorito' : 'sorpresa';
  }

  const partido = {
    id:      'manual_' + Date.now().toString(),
    fecha,
    hora:    document.getElementById('manual-hora').value || '',
    equipoA: jugA.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    equipoB: jugB.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    sumA, sumB, golesA:ga, golesB:gb, ganador, balance_tag, resultado_tag,
    snapshotJugadores: null,  // manual no tiene snapshot para undo
    esManual: true,
  };

  const btn = document.getElementById('btn-guardar-manual');
  btn.disabled = true; btn.textContent = '⏳ Guardando...';

  state.historial.unshift(partido);
  cerrarModalManual();
  try {
    await syncPartido(partido); setSynced();
    alert('✅ Partido cargado en el historial.');
    goTab('historial');
  } catch(e) {
    setSyncError();
    alert('Error al guardar: ' + e.message);
  }
  btn.disabled = false; btn.textContent = '💾 Guardar partido';
}

// ===================== EDITAR RESULTADO DE PARTIDO YA GUARDADO =====================

function abrirEditarResultado(partidoId) {
  if (!esAdmin()) { alert('Solo el admin puede editar resultados.'); return; }
  const p = state.historial.find(h => h.id === partidoId);
  if (!p) return;

  const modal = document.getElementById('modal-editar-resultado');
  modal.dataset.partidoId = partidoId;
  document.getElementById('edit-res-fecha').value   = p.fecha || '';
  document.getElementById('edit-res-hora').value    = p.hora  || '';
  document.getElementById('edit-res-goles-a').value = p.golesA;
  document.getElementById('edit-res-goles-b').value = p.golesB;
  modal.classList.add('open');
}

function cerrarEditarResultado() {
  document.getElementById('modal-editar-resultado').classList.remove('open');
}

async function guardarCambioResultado() {
  if (!esAdmin()) return;
  const modal = document.getElementById('modal-editar-resultado');
  const id    = modal.dataset.partidoId;
  const p     = state.historial.find(h => h.id === id);
  if (!p) return;

  const ga = parseInt(document.getElementById('edit-res-goles-a').value);
  const gb = parseInt(document.getElementById('edit-res-goles-b').value);
  if (isNaN(ga) || isNaN(gb)) { alert('Ingresá el resultado.'); return; }

  p.golesA       = ga;
  p.golesB       = gb;
  p.fecha        = document.getElementById('edit-res-fecha').value || p.fecha;
  p.hora         = document.getElementById('edit-res-hora').value  || p.hora;
  p.ganador      = ga > gb ? 'A' : gb > ga ? 'B' : 'Empate';
  const fav      = p.sumA > p.sumB ? 'A' : 'B';
  p.resultado_tag = p.ganador === 'Empate' ? 'empate' : p.ganador === fav ? 'gano_favorito' : 'sorpresa';

  cerrarEditarResultado();
  setSyncing();
  try {
    await syncPartido(p); setSynced();
    renderHistorial();
    alert('✅ Resultado actualizado.');
  } catch(e) { setSyncError(); alert('Error: ' + e.message); }
}

// ===================== EDITAR JUGADORES DE UN PARTIDO YA GUARDADO =====================

function abrirEditarJugadoresPartido(partidoId) {
  if (!esAdmin()) { alert('Solo el admin puede editar jugadores de un partido.'); return; }
  const p = state.historial.find(h => h.id === partidoId);
  if (!p) return;

  const modal = document.getElementById('modal-editar-jugadores-partido');
  modal.dataset.partidoId = partidoId;

  // Mostrar equipos actuales con opción de quitar/agregar
  const todosIds = [...p.equipoA.map(j=>j.id), ...p.equipoB.map(j=>j.id)];
  const optsDisp = state.jugadores
    .filter(j => !todosIds.includes(j.id))
    .map(j => `<option value="${j.id}">${j.nombre} (${(POS_CONFIG[j.pos]||POS_CONFIG.MED).icon})</option>`)
    .join('');

  document.getElementById('ejp-equipo-a').innerHTML = p.equipoA.map(j =>
    `<div class="ejp-jugador">
      <span>${(POS_CONFIG[j.pos]||POS_CONFIG.MED).icon} ${j.nombre}</span>
      <button class="btn-quitar" onclick="quitarJugadorDeEquipo('${partidoId}','${j.id}','A')">✕</button>
    </div>`).join('') || '<div style="color:var(--muted);font-size:12px">Sin jugadores</div>';

  document.getElementById('ejp-equipo-b').innerHTML = p.equipoB.map(j =>
    `<div class="ejp-jugador">
      <span>${(POS_CONFIG[j.pos]||POS_CONFIG.MED).icon} ${j.nombre}</span>
      <button class="btn-quitar" onclick="quitarJugadorDeEquipo('${partidoId}','${j.id}','B')">✕</button>
    </div>`).join('') || '<div style="color:var(--muted);font-size:12px">Sin jugadores</div>';

  document.getElementById('ejp-disponibles').innerHTML = optsDisp
    ? `<select id="ejp-select-jugador" style="margin-bottom:8px">${optsDisp}</select>
       <div style="display:flex;gap:6px">
         <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:12px" onclick="agregarJugadorAEquipo('${partidoId}','A')">+ A Equipo A</button>
         <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:12px" onclick="agregarJugadorAEquipo('${partidoId}','B')">+ A Equipo B</button>
       </div>`
    : '<div style="color:var(--muted);font-size:12px">Todos los jugadores ya están asignados.</div>';

  modal.classList.add('open');
}

function cerrarEditarJugadoresPartido() {
  document.getElementById('modal-editar-jugadores-partido').classList.remove('open');
}

function quitarJugadorDeEquipo(partidoId, jugadorId, equipo) {
  const p = state.historial.find(h => h.id === partidoId); if (!p) return;
  if (equipo === 'A') p.equipoA = p.equipoA.filter(j => j.id !== jugadorId);
  else                p.equipoB = p.equipoB.filter(j => j.id !== jugadorId);
  abrirEditarJugadoresPartido(partidoId);  // re-render modal
}

function agregarJugadorAEquipo(partidoId, equipo) {
  const p      = state.historial.find(h => h.id === partidoId); if (!p) return;
  const sel    = document.getElementById('ejp-select-jugador'); if (!sel) return;
  const jugId  = sel.value;
  const jugObj = state.jugadores.find(j => j.id === jugId); if (!jugObj) return;
  const entry  = {id:jugObj.id, nombre:jugObj.nombre, rating:jugObj.rating, pos:jugObj.pos||'MED'};
  if (equipo === 'A') p.equipoA.push(entry);
  else                p.equipoB.push(entry);
  abrirEditarJugadoresPartido(partidoId);  // re-render modal
}

async function guardarCambiosJugadoresPartido() {
  const modal = document.getElementById('modal-editar-jugadores-partido');
  const id    = modal.dataset.partidoId;
  const p     = state.historial.find(h => h.id === id); if (!p) return;

  // Recalcular sumas
  p.sumA = p.equipoA.reduce((s,j) => s+j.rating, 0);
  p.sumB = p.equipoB.reduce((s,j) => s+j.rating, 0);
  const diff = Math.abs(p.sumA-p.sumB);
  p.balance_tag = diff < 1.5 ? 'parejos' : diff < 3.5 ? 'algo_desiguales' : 'desiguales';

  cerrarEditarJugadoresPartido();
  setSyncing();
  try {
    await syncPartido(p); setSynced();
    renderHistorial();
    alert('✅ Jugadores del partido actualizados.');
  } catch(e) { setSyncError(); alert('Error: ' + e.message); }
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('modal-editar').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });
  document.getElementById('modal-miembros').addEventListener('click', function(e) {
    if (e.target === this) cerrarPanelMiembros();
  });
  document.getElementById('modal-partido-manual').addEventListener('click', function(e) {
    if (e.target === this) cerrarModalManual();
  });
  document.getElementById('modal-editar-resultado').addEventListener('click', function(e) {
    if (e.target === this) cerrarEditarResultado();
  });
  document.getElementById('modal-editar-jugadores-partido').addEventListener('click', function(e) {
    if (e.target === this) cerrarEditarJugadoresPartido();
  });
  document.getElementById('input-rating').addEventListener('input', function() {
    document.getElementById('val-rating').textContent = parseFloat(this.value).toFixed(1);
  });
  document.getElementById('input-auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitAuth();
  });
  document.getElementById('input-codigo-grupo').addEventListener('keydown', e => {
    if (e.key === 'Enter') unirseGrupo();
  });
  updateWizard('jugadores');
  await initApp();
});
