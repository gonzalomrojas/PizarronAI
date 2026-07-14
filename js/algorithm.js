// ===================== ALGORITMO DE EQUIPOS =====================
//
// Estrategia en 3 pasos:
//
//  PASO 1 — Constraint duro: arqueros
//    Si hay 2+ ARQ convocados, asigna 1 a cada equipo antes de hacer
//    cualquier distribución. Esto garantiza que nunca un equipo queda
//    sin arco. Los ARQ extra van al pool normal.
//
//  PASO 2 — Greedy por rating, posición por posición
//    Para DEF, MED y ATA por separado: ordena ese grupo de mayor a menor
//    rating y lo va alternando al equipo con menor suma acumulada.
//    Hacerlo posición por posición (en vez de mezclar a todos los de
//    campo en una sola bolsa) evita que, por azar, un equipo se quede
//    con todos los delanteros fuertes y el otro con todos los
//    mediocampistas — reparte a los mejores de cada puesto entre los dos.
//
//  PASO 3 — Simulated Annealing (solo dentro de la misma posición)
//    Intenta SA_ITERATIONS swaps aleatorios entre equipos, pero solo
//    entre jugadores de la MISMA posición — así afina el balance de
//    puntos sin deshacer el reparto equitativo por puesto del Paso 2.
//    - Si el swap mejora la diferencia: siempre lo acepta.
//    - Si empeora: lo acepta con probabilidad exp(-Δ/T).
//    La temperatura T baja con cada iteración (SA_COOLING),
//    así empieza explorando mucho y termina refinando.
//    Resultado: escapa de mínimos locales que el greedy no puede.
//
// Complejidad: O(n log n + SA_ITERATIONS) — instantáneo hasta ~50 jugadores.

function generarEquipos() {
  const convocados = state.jugadores.filter(j => state.convocados.includes(j.id));

  if (convocados.length < 2) {
    document.getElementById('equipos-output').innerHTML =
      '<div class="empty">Necesitás al menos 2 jugadores convocados.</div>';
    return;
  }

  const arqs = convocados.filter(j => j.pos === 'ARQ');

  let teamA = [], teamB = [];
  let sumA  = 0,  sumB  = 0;

  // ---- PASO 1: Constraint de arqueros ----
  if (arqs.length >= 2) {
    const sorted = [...arqs].sort((a, b) => b.rating - a.rating);
    // El mejor ARQ al equipo con menos suma (ambos en 0, va A)
    teamA.push(sorted[0]); sumA += sorted[0].rating;
    teamB.push(sorted[1]); sumB += sorted[1].rating;
    // ARQ restantes al pool normal (como cualquier jugador de campo)
    sorted.slice(2).forEach(j => {
      if (sumA <= sumB) { teamA.push(j); sumA += j.rating; }
      else              { teamB.push(j); sumB += j.rating; }
    });
  } else {
    // Sin suficientes ARQ, los mete al pool normal sin restricción
    arqs.forEach(j => {
      if (sumA <= sumB) { teamA.push(j); sumA += j.rating; }
      else              { teamB.push(j); sumB += j.rating; }
    });
  }

  // ---- PASO 2: Greedy por posición (DEF, MED, ATA por separado) ----
  // Reparte cada puesto de a uno por vez para que los mejores de cada
  // posición queden distribuidos entre los dos equipos, en vez de que
  // el rating global termine juntando a todos los delanteros de un lado.
  ['DEF', 'MED', 'ATA'].forEach(pos => {
    const grupo = convocados
      .filter(j => (j.pos || 'MED') === pos)
      .sort((a, b) => b.rating - a.rating);
    grupo.forEach(j => {
      if (sumA <= sumB) { teamA.push(j); sumA += j.rating; }
      else              { teamB.push(j); sumB += j.rating; }
    });
  });

  // ---- PASO 3: Simulated Annealing ----
  let temp = SA_TEMP_INITIAL;

  for (let i = 0; i < SA_ITERATIONS; i++) {
    temp *= SA_COOLING;

    const ia = Math.floor(Math.random() * teamA.length);
    const ib = Math.floor(Math.random() * teamB.length);
    const ja = teamA[ia];
    const jb = teamB[ib];

    // No swappear los ARQ titulares (índice 0 de cada equipo cuando hay 2+ ARQ)
    if (arqs.length >= 2 && ja.pos === 'ARQ' && ia === 0) continue;
    if (arqs.length >= 2 && jb.pos === 'ARQ' && ib === 0) continue;

    // Solo permite swaps entre jugadores de la misma posición — así el
    // ajuste fino de puntos no deshace el reparto equitativo por puesto
    // logrado en el Paso 2 (evita volver a juntar todos los delanteros
    // de un lado y todos los mediocampistas del otro).
    if ((ja.pos || 'MED') !== (jb.pos || 'MED')) continue;

    const diffActual = Math.abs(sumA - sumB);
    const nA = sumA - ja.rating + jb.rating;
    const nB = sumB - jb.rating + ja.rating;
    const diffNueva = Math.abs(nA - nB);

    const mejora        = diffNueva < diffActual;
    const probAceptar   = Math.exp(-(diffNueva - diffActual) / temp);

    if (mejora || Math.random() < probAceptar) {
      teamA[ia] = jb;
      teamB[ib] = ja;
      sumA = nA;
      sumB = nB;
    }
  }

  // ---- Guardar resultado en state (IDs + snapshot completo para restaurar vista) ----
  state.equipoA         = teamA.map(j => j.id);
  state.equipoB         = teamB.map(j => j.id);
  state.equipoASnapshot = teamA.map(j => ({...j}));
  state.equipoBSnapshot = teamB.map(j => ({...j}));
  state.sumA            = sumA;
  state.sumB            = sumB;
  saveState();

  renderEquipos(teamA, teamB, sumA, sumB, arqs.length, convocados.length);
}

// ===================== RENDER EQUIPOS =====================

function renderEquipos(teamA, teamB, sumA, sumB, nArqs, totalJugadores) {
  const diff      = Math.abs(sumA - sumB);
  const diffClass = diff < 1.5 ? 'diff-ok' : diff < 3.5 ? 'diff-warn' : 'diff-bad';
  const diffLabel = diff < 1.5 ? '✅ Muy parejos' : diff < 3.5 ? '⚠️ Aceptable' : '❗ Desbalanceados';
  const admin     = typeof esAdmin === 'function' && esAdmin();

  const renderTeam = (team, sum, cls, label) => `
    <div class="team-card ${cls}">
      <div class="team-label">${label}</div>
      ${team.map(j => {
        const cfg = POS_CONFIG[j.pos || 'MED'];
        return `<div class="team-player">${cfg.icon} ${j.nombre}
          <span style="float:right;opacity:0.5;font-size:11px">${j.rating.toFixed(1)}</span>
        </div>`;
      }).join('')}
      <div class="team-total">Σ ${sum.toFixed(1)} pts</div>
    </div>`;

  const arqWarning = (nArqs < 2 && totalJugadores >= 4)
    ? `<div class="alert alert-orange" style="font-size:12px;margin-top:8px">
        ⚠️ Solo hay ${nArqs} arquero. Los equipos quedaron sin ARQ dedicado.
       </div>` : '';

  // Indicador de que este emparejamiento exacto ya está en el historial
  const finalizado = typeof buscarFinalizadoActual === 'function' ? buscarFinalizadoActual() : null;
  const pendiente   = !finalizado && typeof buscarPendienteActual === 'function' ? buscarPendienteActual() : null;
  const yaGuardado  = !!finalizado;
  const guardadoBanner = finalizado
    ? `<div class="alert alert-green" style="margin-top:8px;font-size:12px">
        ✅ Resultado ya guardado en historial.
       </div>`
    : pendiente
      ? `<div class="alert alert-yellow" style="margin-top:8px;font-size:12px">
          ⏳ Ya guardado en Historial, pendiente de resultado.
         </div>`
      : '';

  document.getElementById('equipos-output').innerHTML = `
    <div class="alert alert-green" style="text-align:center;padding:10px">
      Diferencia: <span class="${diffClass}" style="font-family:'Bebas Neue';font-size:22px">${diff.toFixed(1)} pts</span>
      &nbsp; ${diffLabel}
    </div>
    <div class="teams-grid">
      ${renderTeam(teamA, sumA, 'team-a', '🟢 EQUIPO A')}
      ${renderTeam(teamB, sumB, 'team-b', '🔵 EQUIPO B')}
    </div>
    ${arqWarning}
    ${guardadoBanner}
    <div style="text-align:center;margin-top:8px;font-size:11px;color:var(--muted)">
      ${totalJugadores} jugadores · ${teamA.length} vs ${teamB.length}
    </div>
    <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
      <button class="btn btn-secondary" style="flex:1;justify-content:center" onclick="generarEquipos()">🔀 Mezclar</button>
      <button class="btn btn-yellow"    style="flex:1;justify-content:center" onclick="goTab('votar')">⭐ Votar</button>
    </div>
    <button class="btn" style="width:100%;justify-content:center;margin-top:6px;background:#25D366;color:#fff;font-weight:700"
      onclick="compartirEquiposPorWhatsApp()">
      📲 Compartir por WhatsApp
    </button>`;

  // Sección de resultado — solo visible para admin, persiste al volver al tab
  const seccion = document.getElementById('seccion-resultado');
  if (admin && !yaGuardado) {
    seccion.style.display = 'block';
    document.getElementById('goles-a').value = '';
    document.getElementById('goles-b').value = '';
  } else if (!admin) {
    seccion.style.display = 'none';
  }
}
