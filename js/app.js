// ===================== PUNTO DE ENTRADA =====================
// Acá viven las acciones del usuario que modifican el state.
// Las funciones de render están en ui.js.
// La lógica de rating está en rating.js.
// El algoritmo de equipos está en algorithm.js.

// ---- Variables de UI ----
let selectedPos = null;

// ===================== JUGADORES =====================

function selectPos(pos) {
  selectedPos = pos;
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  document.getElementById('pos-' + pos).classList.add('selected-' + pos);
}

function agregarJugador() {
  const nombre = document.getElementById('input-nombre').value.trim();
  if (!nombre) { alert('Ingresá un nombre.'); return; }
  if (!selectedPos) { alert('Elegí una posición.'); return; }
  if (state.jugadores.find(j => j.nombre.toLowerCase() === nombre.toLowerCase())) {
    alert('Ya existe ese jugador.');
    return;
  }

  const rating = parseFloat(document.getElementById('input-rating').value);

  state.jugadores.push({
    id:             Date.now().toString(),
    nombre,
    pos:            selectedPos,
    rating,
    attrs:          defaultAttrs(selectedPos, rating),
    partidos:       0,
    historial_votos: [rating],  // El rating inicial es el primer "voto"
    votos_count:    1,
  });

  // Reset formulario
  document.getElementById('input-nombre').value = '';
  document.getElementById('input-rating').value = 5;
  document.getElementById('val-rating').textContent = '5.0';
  document.querySelectorAll('.pos-btn').forEach(b => b.className = 'pos-btn');
  selectedPos = null;

  saveState();
  renderJugadores();
}

function eliminarJugador(id) {
  if (!confirm('¿Eliminar este jugador?')) return;
  state.jugadores  = state.jugadores.filter(j => j.id !== id);
  state.convocados = state.convocados.filter(c => c !== id);
  saveState();
  renderJugadores();
}

function guardarEdicion() {
  const j = getJugador(editandoId); if (!j) return;
  const pos = j.pos || 'MED';
  const cfg = POS_CONFIG[pos];

  const newRating = parseFloat(document.getElementById('edit-rating').value);
  j.rating = newRating;
  // Reemplaza el último voto en el historial para no inflar el promedio
  if (!j.historial_votos) j.historial_votos = [];
  j.historial_votos[j.historial_votos.length - 1] = newRating;

  if (!j.attrs) j.attrs = {};
  cfg.attrs.forEach(a => {
    j.attrs[a.key] = parseFloat(document.getElementById('edit-attr-' + a.key).value);
  });

  saveState();
  cerrarModal();
  renderJugadores();
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

function guardarPartido() {
  if (!state.equipoA.length) { alert('Primero generá los equipos.'); return; }

  const ga   = parseInt(document.getElementById('goles-a').value) || 0;
  const gb   = parseInt(document.getElementById('goles-b').value) || 0;
  const jugA = state.jugadores.filter(j => state.equipoA.includes(j.id));
  const jugB = state.jugadores.filter(j => state.equipoB.includes(j.id));
  const sumA = jugA.reduce((s, j) => s + j.rating, 0);
  const sumB = jugB.reduce((s, j) => s + j.rating, 0);
  const diff = Math.abs(sumA - sumB);

  const ganador      = ga > gb ? 'A' : gb > ga ? 'B' : 'Empate';
  const balance_tag  = diff < 1.5 ? 'parejos' : diff < 3.5 ? 'algo_desiguales' : 'desiguales';
  let resultado_tag  = 'empate';
  if (ganador !== 'Empate') {
    const fav     = sumA > sumB ? 'A' : 'B';
    resultado_tag = ganador === fav ? 'gano_favorito' : 'sorpresa';
  }

  // Snapshot ANTES de guardar → permite UNDO completo
  const snapshotJugadores = JSON.parse(JSON.stringify(state.jugadores));

  state.historial.unshift({
    id:       Date.now().toString(),
    fecha:    new Date().toLocaleDateString('es-AR',  { day: '2-digit', month: '2-digit', year: 'numeric' }),
    hora:     new Date().toLocaleTimeString('es-AR',  { hour: '2-digit', minute: '2-digit' }),
    equipoA:  jugA.map(j => ({ id: j.id, nombre: j.nombre, rating: j.rating, pos: j.pos || 'MED' })),
    equipoB:  jugB.map(j => ({ id: j.id, nombre: j.nombre, rating: j.rating, pos: j.pos || 'MED' })),
    sumA, sumB, golesA: ga, golesB: gb, ganador, balance_tag, resultado_tag,
    snapshotJugadores,  // ← para undo
  });

  saveState();
  document.getElementById('seccion-resultado').style.display = 'none';
  document.getElementById('equipos-output').innerHTML +=
    '<div class="alert alert-green" style="margin-top:8px">✅ Partido guardado.</div>';
  updateWizard('historial');
}

// ===================== UNDO PARTIDO =====================

function deshacerPartido(id) {
  const idx = state.historial.findIndex(p => p.id === id);
  if (idx === -1) return;
  if (idx !== 0) { alert('Solo podés deshacer el último partido guardado.'); return; }

  const partido = state.historial[idx];
  if (!confirm(`¿Deshacer el partido ${partido.golesA}–${partido.golesB} del ${partido.fecha}?\n\nEsto revertirá los ratings al estado anterior.`)) return;

  if (partido.snapshotJugadores) {
    state.jugadores = partido.snapshotJugadores;
  }
  state.historial.splice(idx, 1);

  saveState();
  renderHistorial();
  renderJugadores();
  alert('✅ Partido deshecho. Ratings revertidos.');
}

// ===================== GUARDAR VOTOS =====================

function guardarVotos() {
  const convocados = state.jugadores.filter(j => state.convocados.includes(j.id));
  if (!convocados.length) { alert('No hay jugadores convocados.'); return; }

  convocados.forEach(j => {
    const pos = j.pos || 'MED';
    const cfg = POS_CONFIG[pos];
    let sum   = 0;

    cfg.attrs.forEach(a => {
      const el = document.getElementById('vote-' + j.id + '-' + a.key);
      if (!el) return;
      const voto = parseFloat(el.value);
      sum += voto;

      // Actualizar historial de cada atributo
      if (!j.attrs) j.attrs = {};
      if (!j.historial_votos_attrs) j.historial_votos_attrs = {};
      if (!j.historial_votos_attrs[a.key]) j.historial_votos_attrs[a.key] = [j.attrs[a.key] || j.rating];
      j.historial_votos_attrs[a.key].push(voto);

      // Recalcular atributo con decaimiento
      const va = j.historial_votos_attrs[a.key];
      const na = va.length;
      let sp = 0, sv = 0;
      va.forEach((v, i) => {
        const peso = i >= na - RECENT_N ? RECENT_WEIGHT : 1;
        sp += peso; sv += v * peso;
      });
      j.attrs[a.key] = sv / sp;
    });

    // Agregar voto promedio al historial general
    const avg = sum / cfg.attrs.length;
    if (!j.historial_votos) j.historial_votos = [j.rating];
    j.historial_votos.push(avg);

    // Recalcular rating general con decaimiento
    j.rating       = calcRatingConDecaimiento(j);
    j.votos_count  = (j.votos_count || 0) + 1;
    j.partidos     = (j.partidos    || 0) + 1;
  });

  // Limpiar equipos (convocados se mantienen hasta el próximo partido)
  state.equipoA = [];
  state.equipoB = [];

  saveState();
  alert('✅ Votos guardados. Ratings actualizados con decaimiento temporal.');
  goTab('jugadores');
}

// ===================== INIT =====================

document.addEventListener('DOMContentLoaded', () => {
  // Cerrar modal al tocar el overlay
  document.getElementById('modal-editar').addEventListener('click', function (e) {
    if (e.target === this) cerrarModal();
  });

  // Slider de rating en el form de agregar jugador
  document.getElementById('input-rating').addEventListener('input', function () {
    document.getElementById('val-rating').textContent = parseFloat(this.value).toFixed(1);
  });

  updateWizard('jugadores');
  renderJugadores();
});
