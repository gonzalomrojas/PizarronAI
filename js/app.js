// ===================== APP.JS — Dev: Roles + Permisos de votación =====================

let selectedPos = null;

// ===================== PANTALLAS =====================

function mostrarLogin() {
  document.getElementById('screen-login').style.display      = 'flex';
  document.getElementById('screen-onboarding').style.display = 'none';
  document.getElementById('screen-app').style.display        = 'none';
  document.getElementById('bug-trigger').style.display       = 'none';
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
  document.getElementById('bug-trigger').style.display       = 'flex';
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
  document.getElementById('auth-titulo').textContent     = isLogin ? '👤 Iniciar sesión' : '✨ Crear cuenta';
  document.getElementById('auth-subtitulo').textContent  = isLogin ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?';
  document.getElementById('btn-submit-auth').textContent = isLogin ? 'Entrar' : 'Crear cuenta';
  document.getElementById('btn-toggle-auth').textContent = isLogin ? 'Registrarse' : 'Iniciar sesión';
  // Mostrar/ocultar link de recuperar contraseña solo en modo login
  const linkRec = document.getElementById('link-recuperar');
  if (linkRec) linkRec.style.display = isLogin ? 'block' : 'none';
  limpiarErrorAuth();
}

// ===================== RECUPERAR CONTRASEÑA =====================

async function olvideMiContrasena() {
  const email = document.getElementById('input-auth-email').value.trim();
  if (!email) {
    mostrarErrorAuth('Ingresá tu email antes de recuperar la contraseña.');
    document.getElementById('input-auth-email').focus();
    return;
  }

  const btn = document.getElementById('btn-recuperar');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Enviando...'; }
  limpiarErrorAuth();

  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/recover', {
      method:  'POST',
      headers: { 'apikey': SUPABASE_KEY, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email }),
    });
    // Supabase siempre devuelve 200 aunque el email no exista (por seguridad)
    mostrarMensajeAuth(
      '✅ Si ese email está registrado, vas a recibir un link para resetear tu contraseña. Revisá tu bandeja de entrada.',
      'var(--green)'
    );
  } catch(e) {
    mostrarErrorAuth('Error al enviar el email. Intentá de nuevo.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Recuperar contraseña'; }
  }
}

function mostrarMensajeAuth(msg, color) {
  // Reutiliza el div de error pero con color verde para mensajes de éxito
  const el = document.getElementById('auth-error');
  if (el) {
    el.textContent   = msg;
    el.style.display = 'block';
    el.style.background = color === 'var(--green)' ? '#0a2a0a' : '#2a0a0a';
    el.style.borderColor = color;
    el.style.color       = color;
  }
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

    // Opciones de jugadores sin vincular para el select
    const jugsSinVincular = state.jugadores.filter(j => !j.auth_user_id);

    cuerpo.innerHTML = miembros.map(m => {
      const vinc      = m.jugadorVinc;
      const optsJugs  = jugsSinVincular
        .concat(vinc ? [vinc] : [])   // incluir el ya vinculado en las opciones
        .sort((a,b) => a.nombre.localeCompare(b.nombre))
        .map(j => `<option value="${j.id}" ${vinc && j.id===vinc.id ? 'selected' : ''}>
          ${(POS_CONFIG[j.pos]||POS_CONFIG.MED).icon} ${j.nombre}
        </option>`).join('');

      const seccionVinc = m.role !== 'admin' ? `
        <div class="miembro-vinc" style="margin-top:8px">
          <div style="font-size:11px;color:var(--muted);margin-bottom:5px">
            Jugador vinculado: <strong style="color:var(--text)">${vinc ? vinc.nombre : 'Ninguno'}</strong>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            <select id="vinc-sel-${m.user_id}" style="flex:1;font-size:12px;padding:6px 8px">
              <option value="">— Sin vincular —</option>
              ${optsJugs}
            </select>
            <button class="btn-permiso btn-dar" style="white-space:nowrap"
              onclick="guardarVinculacion('${m.user_id}', this)">
              ${vinc ? '🔄 Cambiar' : '🔗 Vincular'}
            </button>
            ${vinc ? `<button class="btn-permiso btn-quitar"
              onclick="quitarVinculacion('${vinc.id}', this)">✕</button>` : ''}
          </div>
        </div>` : '';

      return `
      <div class="miembro-row" style="flex-direction:column;align-items:stretch">
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <div class="miembro-info" style="flex:1">
            <span class="miembro-label">${m.label}${m.esYo ? ' <em style="color:var(--muted)">(vos)</em>' : ''}</span>
            <span class="role-chip ${m.role === 'admin' ? 'role-admin' : 'role-member'}">
              ${m.role === 'admin' ? '👑 Admin' : '👤 Member'}
            </span>
          </div>
          ${!m.esYo && m.role !== 'admin' ? `
            <div class="miembro-accion">
              <span style="font-size:11px;color:var(--muted);margin-right:6px">
                ${m.puedeVotar ? '⭐ Puede votar' : '🔒 Sin permiso'}
              </span>
              ${m.puedeVotar
                ? `<button class="btn-permiso btn-quitar" onclick="togglePermiso('${m.user_id}', false, this)">Quitar</button>`
                : `<button class="btn-permiso btn-dar"    onclick="togglePermiso('${m.user_id}', true,  this)">Dar permiso</button>`
              }
            </div>` : ''}
        </div>
        ${seccionVinc}
      </div>`;
    }).join('');
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

// ===================== REPORTAR BUG =====================

let bugCatSeleccionada = null;
let bugSevSeleccionada = null;

function abrirReporteBug() {
  document.getElementById('modal-bug').classList.add('open');
}

function cerrarReporteBug() {
  document.getElementById('modal-bug').classList.remove('open');
  setTimeout(resetFormBug, 300);
}

function seleccionarCatBug(el, cat) {
  document.querySelectorAll('#bug-cat-grid .cat-btn').forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
  bugCatSeleccionada = cat;
}

function seleccionarSevBug(el, sev) {
  document.querySelectorAll('#bug-sev-row .sev-btn').forEach(b => b.className = 'sev-btn');
  el.classList.add('sel-' + sev);
  bugSevSeleccionada = sev;
}

function generarTicketId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return 'BUG-' + Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function enviarReporteBug() {
  const desc = document.getElementById('bug-desc').value.trim();

  if (!bugCatSeleccionada) { alert('Elegí qué tipo de problema es.'); return; }
  if (!bugSevSeleccionada) { alert('Elegí el impacto del problema.'); return; }
  if (!desc) { alert('Contanos qué pasó en la descripción.'); document.getElementById('bug-desc').focus(); return; }

  const btn = document.getElementById('bug-submit-btn');
  btn.disabled = true;
  btn.textContent = 'Enviando...';

  const ticketId = generarTicketId();

  try {
    await sbFetch('bug_reports', {
      method: 'POST',
      prefer: 'return=representation',
      body: JSON.stringify({
        ticket_id:   ticketId,
        grupo_id:    grupoId || 'unknown',
        user_id:     currentUser ? currentUser.id : null,
        user_email:  currentUser ? currentUser.email : null,
        categoria:   bugCatSeleccionada,
        severidad:   bugSevSeleccionada,
        descripcion: desc,
        pasos:       document.getElementById('bug-pasos').value.trim() || null,
        user_agent:  navigator.userAgent,
        url_actual:  window.location.href,
        viewport:    window.innerWidth + 'x' + window.innerHeight,
      }),
    });

    document.getElementById('bug-form-state').style.display    = 'none';
    document.getElementById('bug-success-state').style.display = 'block';
    document.getElementById('bug-ticket-id').textContent       = ticketId;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = 'Enviar reporte →';
    alert('No se pudo enviar el reporte: ' + e.message);
  }
}

function resetFormBug() {
  bugCatSeleccionada = null;
  bugSevSeleccionada = null;
  document.querySelectorAll('#bug-cat-grid .cat-btn').forEach(b => b.classList.remove('selected'));
  document.querySelectorAll('#bug-sev-row .sev-btn').forEach(b => b.className = 'sev-btn');
  document.getElementById('bug-desc').value  = '';
  document.getElementById('bug-pasos').value = '';
  document.getElementById('bug-form-state').style.display    = 'block';
  document.getElementById('bug-success-state').style.display = 'none';
  const btn = document.getElementById('bug-submit-btn');
  btn.disabled = false;
  btn.textContent = 'Enviar reporte →';
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
    attrs:           defaultAttrs(selectedPos, rating),
    attrs_generales: defaultAttrsGenerales(rating),
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
  // Guardar atributos generales
  if (!j.attrs_generales) j.attrs_generales = {};
  ATTRS_GENERALES.forEach(a => {
    const el = document.getElementById('edit-gen-' + a.key);
    if (el) j.attrs_generales[a.key] = parseFloat(el.value);
  });
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
  const snapshotJugadores = JSON.parse(JSON.stringify(state.jugadores));

  // Si este emparejamiento ya se compartió por WhatsApp, reutiliza ese
  // registro pendiente en vez de crear uno nuevo duplicado en el historial.
  const pendiente = buscarPendienteActual();
  const partido = pendiente || {
    id:    Date.now().toString(),
    fecha: new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'}),
    hora:  new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}),
  };
  Object.assign(partido, {
    equipoA: jugA.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    equipoB: jugB.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    sumA, sumB, golesA: ga, golesB: gb, snapshotJugadores,
    ...calcularResultadoPartido(sumA, sumB, ga, gb),
  });
  if (!pendiente) state.historial.unshift(partido);
  saveState();
  document.getElementById('seccion-resultado').style.display = 'none';
  document.getElementById('equipos-output').innerHTML +=
    '<div class="alert alert-green" style="margin-top:8px">✅ Partido guardado. Votación de rendimiento abierta automáticamente.</div>';
  updateWizard('historial');
  setSyncing();
  try {
    await syncPartido(partido);
    // Abrir votación de rendimiento automáticamente
    await abrirVotacionRendimiento(partido.id);
    setSynced();
  } catch(e) { setSyncError(); }
}

// Carga el resultado de un partido que quedó pendiente (compartido por
// WhatsApp pero sin resultado todavía) desde la pestaña Historial.
async function guardarResultadoPendiente(id) {
  if (!esAdmin()) { alert('Solo el admin puede guardar el resultado.'); return; }
  const partido = state.historial.find(p => p.id === id);
  if (!partido) return;
  const ga = parseInt(document.getElementById('pend-ga-' + id).value) || 0;
  const gb = parseInt(document.getElementById('pend-gb-' + id).value) || 0;

  Object.assign(partido, { golesA: ga, golesB: gb },
    calcularResultadoPartido(partido.sumA || 0, partido.sumB || 0, ga, gb));

  saveState(); renderHistorial();
  setSyncing();
  try {
    await syncPartido(partido);
    await abrirVotacionRendimiento(partido.id);
    setSynced();
  } catch(e) { setSyncError(); }
}

// Descarta un emparejamiento pendiente sin cargar resultado (p.ej. si al
// final no se jugó).
async function descartarPendiente(id) {
  if (!esAdmin()) { alert('Solo el admin puede descartar el partido pendiente.'); return; }
  if (!confirm('¿Descartar este emparejamiento? No se guardará ningún resultado.')) return;
  state.historial = state.historial.filter(p => p.id !== id);
  saveState(); renderHistorial();
  setSyncing();
  try { await borrarPartido(id); setSynced(); } catch(e) { setSyncError(); }
}

async function deshacerPartido(id) {
  if (!esAdmin()) { alert('Solo el admin puede deshacer partidos.'); return; }
  const idx = state.historial.findIndex(p => p.id === id);
  if (idx === -1) return;
  // "Último partido" = el más reciente ya finalizado (puede haber un
  // pendiente sin resultado por delante en el historial, eso no cuenta).
  const finalizados = state.historial.filter(p => p.ganador != null);
  if (!finalizados.length || finalizados[0].id !== id) {
    alert('Solo podés deshacer el último partido.'); return;
  }
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


// ===================== MVP — ACCIONES =====================

async function toggleVotacionMVP(partidoId, abrir) {
  if (!esAdmin()) { alert('Solo el admin puede gestionar la votación MVP.'); return; }
  const btn = document.getElementById('btn-mvp-toggle-' + partidoId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    if (abrir) {
      await abrirVotacionMVP(partidoId);
      alert('✅ Votación MVP abierta. Los miembros ya pueden votar.');
    } else {
      const resultado = await cerrarVotacionMVP(partidoId);
      const lineasVotos = Object.entries(resultado.conteo)
        .sort((a,b) => b[1]-a[1])
        .map(([jugId, n]) => {
          const partido = state.historial.find(h =>
            [...(h.equipoA||[]),...(h.equipoB||[])].some(j => j.id === jugId)
          );
          const nombre = partido
            ? [...(partido.equipoA||[]),...(partido.equipoB||[])].find(j => j.id === jugId)?.nombre
            : jugId;
          return (nombre||jugId) + ': ' + n + ' voto' + (n!==1?'s':'');
        }).join('\n');
      alert('🏆 MVP: ' + resultado.ganadorNombre + '\n\n' + lineasVotos);
    }
    await refrescarHistorial();
    renderHistorial();
  } catch(e) {
    alert('Error: ' + e.message);
  }
  if (btn) { btn.disabled = false; }
}

async function submitVotoMVP(partidoId) {
  const sel = document.getElementById('mvp-select-' + partidoId);
  if (!sel || !sel.value) { alert('Elegí un jugador.'); return; }
  // Verificar auto-voto: comparar auth_user_id del jugador seleccionado con el usuario actual
  if (esJugadorPropio(sel.value)) {
    alert('No podés votarte a vos mismo.'); return;
  }

  const btn = document.getElementById('btn-votar-mvp-' + partidoId);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Votando...'; }

  try {
    await votarMVP(partidoId, sel.value);
    // Recargar conteo
    const conteo = await cargarVotosMVP(partidoId);
    renderResultadoVotosMVP(partidoId, conteo, true);
  } catch(e) {
    // Unique constraint = ya votó
    if (e.message.includes('23505') || e.message.includes('unique')) {
      renderResultadoVotosMVP(partidoId, await cargarVotosMVP(partidoId), true);
    } else {
      alert('Error: ' + e.message);
      if (btn) { btn.disabled = false; btn.textContent = '🏆 Votar MVP'; }
    }
  }
}

function renderResultadoVotosMVP(partidoId, conteo, yaVote) {
  const contenedor = document.getElementById('mvp-votos-' + partidoId);
  if (!contenedor) return;
  const partido  = state.historial.find(p => p.id === partidoId);
  const jugadores = [...(partido?.equipoA||[]),...(partido?.equipoB||[])];
  const total    = Object.values(conteo).reduce((a,b)=>a+b, 0);

  if (!total) { contenedor.innerHTML = '<div style="font-size:12px;color:var(--muted)">Sin votos todavía.</div>'; return; }

  contenedor.innerHTML = jugadores
    .filter(j => conteo[j.id])
    .sort((a,b) => (conteo[b.id]||0) - (conteo[a.id]||0))
    .map(j => {
      const n   = conteo[j.id] || 0;
      const pct = Math.round((n/total)*100);
      return `<div style="margin-bottom:6px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:2px">
          <span>${j.nombre}</span>
          <span style="color:var(--yellow);font-family:'Bebas Neue'">${n} voto${n!==1?'s':''}</span>
        </div>
        <div style="height:4px;background:var(--border);border-radius:2px">
          <div style="height:4px;width:${pct}%;background:var(--yellow);border-radius:2px;transition:width 0.4s"></div>
        </div>
      </div>`;
    }).join('') +
    (yaVote ? '<div style="font-size:11px;color:var(--green);margin-top:6px">✅ Ya votaste</div>' : '');
}

async function abrirVotosMVPEnPartido(partidoId) {
  const conteo  = await cargarVotosMVP(partidoId);
  const yaVote  = await yaVoteMVP(partidoId);
  renderResultadoVotosMVP(partidoId, conteo, yaVote);

  // Mostrar/ocultar form de voto
  const form = document.getElementById('mvp-form-' + partidoId);
  if (form) form.style.display = yaVote ? 'none' : 'block';
}

// ===================== WHATSAPP =====================

function compartirEquiposPorWhatsApp() {
  const A = state.equipoASnapshot || [];
  const B = state.equipoBSnapshot || [];
  if (!A.length || !B.length) { alert('Primero generá los equipos.'); return; }

  const sumA = (state.sumA || 0).toFixed(1);
  const sumB = (state.sumB || 0).toFixed(1);
  const url  = 'https://gonzalomrojas.github.io/PizarronAI/';
  const nl   = '\n';

  const lineaA = A.map(j => (POS_CONFIG[j.pos]||POS_CONFIG.MED).icon + ' ' + j.nombre).join(nl);
  const lineaB = B.map(j => (POS_CONFIG[j.pos]||POS_CONFIG.MED).icon + ' ' + j.nombre).join(nl);

  const msg = [
    '\u26bd *PIZARR\u00d3N AI \u2014 Equipos de hoy*',
    '',
    '\ud83d\udfe2 *EQUIPO A* (\u03a3' + sumA + ' pts)',
    lineaA,
    '',
    '\ud83d\udd35 *EQUIPO B* (\u03a3' + sumB + ' pts)',
    lineaB,
    '',
    '\ud83c\udfc6 Vot\u00e1 el MVP despu\u00e9s del partido:',
    url
  ].join(nl);

  const waUrl = 'https://wa.me/?text=' + encodeURIComponent(msg);
  window.open(waUrl, '_blank');

  // Deja el emparejamiento guardado en Historial (pendiente de resultado),
  // así no depende de que la sesión del navegador siga viva cuando volvés
  // de WhatsApp a cargar el resultado. Se hace DESPUÉS de abrir la ventana
  // para no romper el gesto de usuario que necesita window.open (si no,
  // el navegador puede bloquear el popup por el await previo).
  setSyncing();
  asegurarPartidoPendiente()
    .then(() => { setSynced(); if (typeof renderHistorial === 'function') renderHistorial(); })
    .catch(() => setSyncError());
}


async function guardarVinculacion(userId, btn) {
  const sel = document.getElementById('vinc-sel-' + userId);
  if (!sel) return;
  const jugadorId = sel.value;
  btn.disabled = true; btn.textContent = '⏳';
  try {
    if (!jugadorId) {
      // Desvincular: encontrar jugador actual vinculado a este user
      const jugActual = state.jugadores.find(j => j.auth_user_id === userId);
      if (jugActual) await desvincularJugador(jugActual.id);
    } else {
      await vincularJugadorAUsuario(jugadorId, userId);
    }
    await abrirPanelMiembros();   // refrescar panel
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '🔗 Vincular';
    alert('Error: ' + e.message);
  }
}

async function quitarVinculacion(jugadorId, btn) {
  btn.disabled = true; btn.textContent = '⏳';
  try {
    await desvincularJugador(jugadorId);
    await abrirPanelMiembros();   // refrescar panel
  } catch(e) {
    btn.disabled = false;
    btn.textContent = '✕';
    alert('Error al desvincular: ' + e.message);
  }
}


// ===================== VOTAR RENDIMIENTO DESDE HISTORIAL =====================

async function abrirFormVotacionRendimiento(partidoId) {
  const partido = state.historial.find(p => p.id === partidoId);
  if (!partido) return;

  // Verificar que no haya votado ya (primero — es la comprobación más frecuente)
  const yavoto = await yaVoteRendimiento(partidoId);
  if (yavoto) {
    alert('Ya enviaste tu votación para este partido.\nSolo se puede votar una vez por partido.');
    return;
  }

  // Obtener jugador propio (puede ser null si no está vinculado)
  const jp   = getJugadorDelUsuarioActual();
  const todos = [...(partido.equipoA||[]),...(partido.equipoB||[])];

  // Si no es admin y no tiene jugador vinculado: bloquear
  if (!esAdmin() && !jp) {
    alert('Tu cuenta todavía no está vinculada a ningún jugador.\nPedile al admin que te vincule desde el panel de Miembros.');
    return;
  }

  // Si no es admin y su jugador no estuvo en el partido: bloquear
  if (!esAdmin() && jp && !todos.some(j => j.id === jp.id)) {
    alert('No participaste en este partido, no podés votar el rendimiento.');
    return;
  }

  // Armar la lista de jugadores a calificar (excluir al propio)
  const aVotar = todos.filter(j => j.id !== (jp ? jp.id : null));

  const modal     = document.getElementById('modal-votar-rendimiento');
  const titulo    = document.getElementById('vr-titulo');
  const cuerpo    = document.getElementById('vr-cuerpo');
  const btnGuard  = document.getElementById('vr-btn-guardar');

  modal.dataset.partidoId = partidoId;
  titulo.textContent      = 'Votar rendimiento — ' + partido.fecha;
  btnGuard.disabled       = false;
  btnGuard.textContent    = '✅ Enviar votación';

  cuerpo.innerHTML = aVotar.map(j => {
    const pos = j.pos || 'MED';
    const cfg = POS_CONFIG[pos];
    const jState = state.jugadores.find(p => p.id === j.id);

    const attrsHtml = cfg.attrs.map(a => {
      const cur = (jState && jState.attrs && jState.attrs[a.key] != null)
        ? jState.attrs[a.key] : 5;
      return `<div class="attr-vote-row">
        <span class="attr-vote-label">${a.label}</span>
        <input type="range" id="vr-${j.id}-${a.key}"
          min="1" max="10" step="0.5" value="${cur.toFixed(1)}"
          oninput="document.getElementById('vrv-${j.id}-${a.key}').textContent=parseFloat(this.value).toFixed(1)">
        <span class="attr-vote-val" id="vrv-${j.id}-${a.key}">${cur.toFixed(1)}</span>
      </div>`;
    }).join('');

    return `<div class="vote-player" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
        <div class="avatar avatar-${pos}" style="width:36px;height:36px;font-size:14px">
          ${j.nombre[0].toUpperCase()}
        </div>
        <div>
          <div style="font-weight:600;font-size:14px">${j.nombre}</div>
          <div style="font-size:11px;color:var(--muted)">${cfg.icon} ${cfg.label}</div>
        </div>
      </div>
      ${attrsHtml}
    </div>`;
  }).join('');

  if (!aVotar.length) {
    cuerpo.innerHTML = '<div class="empty">No hay otros jugadores para calificar en este partido.</div>';
    btnGuard.style.display = 'none';
  } else {
    btnGuard.style.display = 'block';
  }

  modal.classList.add('open');
}

async function enviarVotosRendimiento() {
  const modal     = document.getElementById('modal-votar-rendimiento');
  const partidoId = modal.dataset.partidoId;
  const partido   = state.historial.find(p => p.id === partidoId);
  if (!partido) return;

  const jp     = getJugadorDelUsuarioActual();
  const todos  = [...(partido.equipoA||[]),...(partido.equipoB||[])];
  const aVotar = todos.filter(j => j.id !== (jp ? jp.id : null));

  if (!aVotar.length) { cerrarVotacionRendimiento(); return; }

  const btn = document.getElementById('vr-btn-guardar');
  btn.disabled = true; btn.textContent = '⏳ Enviando...';

  const votosMap = {};
  aVotar.forEach(j => {
    const pos = j.pos || 'MED';
    const cfg = POS_CONFIG[pos];
    const attrs_votos = {};
    let sum = 0;
    cfg.attrs.forEach(a => {
      const el = document.getElementById('vr-' + j.id + '-' + a.key);
      const val = el ? parseFloat(el.value) : 5;
      attrs_votos[a.key] = val;
      sum += val;
    });
    const promedio = sum / cfg.attrs.length;
    votosMap[j.id] = { attrs_votos, promedio };
  });

  try {
    setSyncing();
    await guardarVotosRendimiento(partidoId, votosMap);
    // Aplicar votos al rating de los jugadores
    await aplicarVotosRendimientoAJugadores(partidoId);
    await cargarJugadores();   // refrescar plantilla
    setSynced();
    cerrarVotacionRendimiento();
    alert('✅ Votación enviada. Ratings actualizados.');
    renderHistorial();
    renderJugadores();
  } catch(e) {
    setSyncError();
    btn.disabled = false;
    btn.textContent = '✅ Enviar votación';
    if (e.message && e.message.includes('23505')) {
      alert('Ya enviaste tu votación para este partido.');
      cerrarVotacionRendimiento();
    } else {
      alert('Error: ' + e.message);
    }
  }
}

function cerrarVotacionRendimiento() {
  document.getElementById('modal-votar-rendimiento').classList.remove('open');
}


// ===================== RESET DE CONTRASEÑA =====================
// Cuando el usuario hace click en el link del email, Supabase redirige
// con el token en el hash de la URL: #access_token=xxx&type=recovery
// Detectamos eso al cargar y mostramos el formulario de nueva contraseña.

function detectarTokenRecovery() {
  const hash   = window.location.hash;
  if (!hash) return false;

  // Parsear el hash como query string
  const params = {};
  hash.replace('#', '').split('&').forEach(pair => {
    const [k, v] = pair.split('=');
    if (k && v) params[decodeURIComponent(k)] = decodeURIComponent(v);
  });

  if (params.type !== 'recovery' || !params.access_token) return false;

  // Guardar el token — lo necesitamos para actualizar la contraseña
  authToken = params.access_token;
  return true;
}

async function submitNuevaContrasena() {
  const pass1 = document.getElementById('input-nueva-pass').value;
  const pass2 = document.getElementById('input-nueva-pass2').value;
  const btn   = document.getElementById('btn-nueva-pass');

  if (!pass1 || pass1.length < 6) {
    mostrarErrorRecovery('La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  if (pass1 !== pass2) {
    mostrarErrorRecovery('Las contraseñas no coinciden.');
    return;
  }

  btn.disabled    = true;
  btn.textContent = '⏳ Guardando...';
  limpiarErrorRecovery();

  try {
    // Actualizar contraseña usando el token del email
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      method:  'PUT',
      headers: {
        'apikey':        SUPABASE_KEY,
        'Authorization': 'Bearer ' + authToken,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ password: pass1 }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al actualizar la contraseña.');
    }

    // Éxito — limpiar el hash de la URL y volver al login
    history.replaceState(null, '', window.location.pathname);
    authToken = null;

    document.getElementById('screen-recovery').style.display = 'none';
    mostrarLogin();

    // Mostrar mensaje de éxito en el login
    setTimeout(() => {
      mostrarMensajeAuth('✅ Contraseña actualizada. Ya podés iniciar sesión.', 'var(--green)');
    }, 100);

  } catch(e) {
    btn.disabled    = false;
    btn.textContent = 'Guardar nueva contraseña';
    mostrarErrorRecovery(e.message || 'Error al guardar. El link puede haber expirado.');
  }
}

function mostrarErrorRecovery(msg) {
  const el = document.getElementById('recovery-error');
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function limpiarErrorRecovery() {
  const el = document.getElementById('recovery-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
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
  document.getElementById('modal-stats').addEventListener('click', function(e) {
    if (e.target === this) cerrarStats();
  });
  document.getElementById('modal-votar-rendimiento').addEventListener('click', function(e) {
    if (e.target === this) cerrarVotacionRendimiento();
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

  // Detectar si venimos de un link de recuperación de contraseña
  if (detectarTokenRecovery()) {
    // Ocultar todo y mostrar pantalla de nueva contraseña
    document.getElementById('screen-login').style.display      = 'none';
    document.getElementById('screen-onboarding').style.display = 'none';
    document.getElementById('screen-app').style.display        = 'none';
    document.getElementById('screen-recovery').style.display   = 'flex';
    return;
  }

  await initApp();
});
