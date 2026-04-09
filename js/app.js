// ===================== PUNTO DE ENTRADA =====================
// Sprint 2: todas las acciones ahora son async y sincronizan con Supabase.

let selectedPos = null;

// ===================== JUGADORES =====================

function selectPos(pos) {
  selectedPos = pos;
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  document.getElementById('pos-' + pos).classList.add('selected-' + pos);
}

async function agregarJugador() {
  const nombre = document.getElementById('input-nombre').value.trim();
  if (!nombre)       { alert('Ingresá un nombre.'); return; }
  if (!selectedPos)  { alert('Elegí una posición.'); return; }
  if (state.jugadores.find(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Ya existe ese jugador.'); return;
  }
  const rating = parseFloat(document.getElementById('input-rating').value);
  const jugador = {
    id: Date.now().toString(), nombre, pos: selectedPos, rating,
    attrs: defaultAttrs(selectedPos, rating),
    partidos: 0, historial_votos: [rating], votos_count: 1,
  };
  state.jugadores.push(jugador);
  // Reset form
  document.getElementById('input-nombre').value = '';
  document.getElementById('input-rating').value = 5;
  document.getElementById('val-rating').textContent = '5.0';
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  selectedPos = null;
  renderJugadores();
  // Sync
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
  catch(e) { setSyncError(); console.error(e); }
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
  catch(e) { setSyncError(); console.error(e); }
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
  if (ganador !== 'Empate') { const fav = sumA > sumB ? 'A' : 'B'; resultado_tag = ganador === fav ? 'gano_favorito' : 'sorpresa'; }

  const snapshotJugadores = JSON.parse(JSON.stringify(state.jugadores));
  const partido = {
    id: Date.now().toString(),
    fecha: new Date().toLocaleDateString('es-AR', {day:'2-digit',month:'2-digit',year:'numeric'}),
    hora:  new Date().toLocaleTimeString('es-AR', {hour:'2-digit',minute:'2-digit'}),
    equipoA: jugA.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    equipoB: jugB.map(j => ({id:j.id, nombre:j.nombre, rating:j.rating, pos:j.pos||'MED'})),
    sumA, sumB, golesA:ga, golesB:gb, ganador, balance_tag, resultado_tag, snapshotJugadores,
  };
  state.historial.unshift(partido);
  saveState();
  document.getElementById('seccion-resultado').style.display = 'none';
  document.getElementById('equipos-output').innerHTML += '<div class="alert alert-green" style="margin-top:8px">✅ Partido guardado.</div>';
  updateWizard('historial');
  setSyncing();
  try { await syncPartido(partido); setSynced(); }
  catch(e) { setSyncError(); console.error(e); }
}

// ===================== UNDO PARTIDO =====================

async function deshacerPartido(id) {
  const idx = state.historial.findIndex(p => p.id === id);
  if (idx === -1) return;
  if (idx !== 0)  { alert('Solo podés deshacer el último partido guardado.'); return; }
  const partido = state.historial[idx];
  if (!confirm(`¿Deshacer ${partido.golesA}–${partido.golesB} del ${partido.fecha}?\n\nEsto revertirá los ratings al estado anterior.`)) return;
  if (partido.snapshotJugadores) state.jugadores = partido.snapshotJugadores;
  state.historial.splice(idx, 1);
  saveState();
  renderHistorial();
  renderJugadores();
  setSyncing();
  try {
    await Promise.all([
      borrarPartido(id),
      syncJugadores(state.jugadores),
    ]);
    setSynced();
    alert('✅ Partido deshecho. Ratings revertidos.');
  } catch(e) { setSyncError(); console.error(e); alert('✅ Deshecho localmente. Error de sync: ' + e.message); }
}

// ===================== GUARDAR VOTOS =====================

async function guardarVotos() {
  const convocados = state.jugadores.filter(j => state.convocados.includes(j.id));
  if (!convocados.length) { alert('No hay jugadores convocados.'); return; }
  convocados.forEach(j => {
    const pos = j.pos || 'MED';
    const cfg = POS_CONFIG[pos];
    let sum = 0;
    cfg.attrs.forEach(a => {
      const el = document.getElementById('vote-' + j.id + '-' + a.key); if(!el) return;
      const voto = parseFloat(el.value); sum += voto;
      if (!j.attrs) j.attrs = {};
      if (!j.historial_votos_attrs) j.historial_votos_attrs = {};
      if (!j.historial_votos_attrs[a.key]) j.historial_votos_attrs[a.key] = [j.attrs[a.key] || j.rating];
      j.historial_votos_attrs[a.key].push(voto);
      const va = j.historial_votos_attrs[a.key], na = va.length;
      let sp=0, sv=0;
      va.forEach((v,i) => { const p = i>=na-RECENT_N ? RECENT_WEIGHT : 1; sp+=p; sv+=v*p; });
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
  } catch(e) { setSyncError(); alert('Votos guardados localmente. Error de sync: ' + e.message); }
  goTab('jugadores');
}

// ===================== GRUPO ONBOARDING =====================

function mostrarOnboarding() {
  document.getElementById('onboarding-overlay').style.display = 'flex';
}

function ocultarOnboarding() {
  document.getElementById('onboarding-overlay').style.display = 'none';
}

async function crearGrupo() {
  const id = generarGrupoId();
  setGrupoId(id);
  document.getElementById('grupo-creado-id').textContent = id;
  document.getElementById('paso-crear').style.display    = 'none';
  document.getElementById('paso-creado').style.display   = 'block';
}

async function unirseGrupo() {
  const val = document.getElementById('input-grupo-id').value.trim().toUpperCase();
  if (val.length < 4) { alert('Ingresá un código válido (mínimo 4 caracteres).'); return; }
  // Verificar que el grupo existe buscando jugadores
  try {
    setSyncStatus('⏳ Verificando...', 'var(--yellow)');
    const grupoIdTemp = val;
    // Hacer un fetch directo para verificar
    const url = SUPABASE_URL + '/rest/v1/jugadores?grupo_id=eq.' + grupoIdTemp + '&limit=1';
    const res = await fetch(url, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
    });
    if (!res.ok) throw new Error('No se pudo verificar');
    setGrupoId(val);
    ocultarOnboarding();
    await initSupabase();
    renderJugadores();
    renderPartido();
  } catch(e) {
    alert('Error al conectar: ' + e.message);
    setSyncStatus('❌ Error', 'var(--red)');
  }
}

async function confirmarGrupoCreado() {
  ocultarOnboarding();
  await initSupabase();
  renderJugadores();
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('modal-editar').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });
  document.getElementById('input-rating').addEventListener('input', function() {
    document.getElementById('val-rating').textContent = parseFloat(this.value).toFixed(1);
  });
  // Enter en input de grupo
  const inputGrupo = document.getElementById('input-grupo-id');
  if (inputGrupo) inputGrupo.addEventListener('keydown', e => { if(e.key==='Enter') unirseGrupo(); });

  updateWizard('jugadores');

  const ok = await initSupabase();
  if (!ok) {
    mostrarOnboarding();
  } else {
    renderJugadores();
  }
});
