// ===================== TABS + WIZARD =====================

const TABS = ['jugadores', 'partido', 'equipos', 'votar', 'historial'];

function goTab(tab) {
  document.querySelectorAll('.tab').forEach((t, i) =>
    t.classList.toggle('active', TABS[i] === tab)
  );
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');

  // Scroll al top al cambiar de tab — fix para móvil
  window.scrollTo({ top: 0, behavior: 'instant' });

  if (tab === 'jugadores') renderJugadores();
  if (tab === 'partido')   renderPartido();
  if (tab === 'equipos')   restaurarEquipos();   // ← KEY FIX: restaura la vista si ya hay equipos
  if (tab === 'votar')     prepararVotacion();
  if (tab === 'historial') renderHistorial();

  updateWizard(tab);
}

// Restaura la vista de equipos desde el snapshot guardado en state
// Se llama cada vez que el usuario vuelve al tab Equipos
function restaurarEquipos() {
  const A = state.equipoASnapshot || [];
  const B = state.equipoBSnapshot || [];
  if (!A.length || !B.length) {
    // No hay equipos generados todavía
    document.getElementById('equipos-output').innerHTML =
      '<div class="empty">Convocá jugadores y generá los equipos desde la pestaña Convocar.</div>';
    document.getElementById('seccion-resultado').style.display = 'none';
    return;
  }
  // Hay equipos → restaurar la vista completa
  const sumA = state.sumA || A.reduce((s,j) => s+j.rating, 0);
  const sumB = state.sumB || B.reduce((s,j) => s+j.rating, 0);
  renderEquipos(A, B, sumA, sumB, A.filter(j=>j.pos==='ARQ').length + B.filter(j=>j.pos==='ARQ').length, A.length+B.length);
}

function updateWizard(activeTab) {
  const activeIdx = TABS.indexOf(activeTab);
  TABS.forEach((s, i) => {
    const el  = document.querySelector(`.wstep:nth-child(${i + 1})`);
    const dot = el ? el.querySelector('.wdot') : null;
    if (!el) return;
    el.className = 'wstep';
    if (i < activeIdx) el.classList.add('done');
    if (i === activeIdx) el.classList.add('active');
    if (dot) dot.textContent = i < activeIdx ? '✓' : i + 1;
  });
}

// ===================== JUGADORES =====================

function renderFifaCard(j, clickable = false) {
  const pos       = j.pos || 'MED';
  const cfg       = POS_CONFIG[pos];
  const trend     = calcTrend(j);
  const nVotos    = j.historial_votos ? j.historial_votos.length : 1;

  const trendHtml = trend === 'up' ? '<span class="trend trend-up">↑ Mejorando</span>'
    : trend === 'dn' ? '<span class="trend trend-dn">↓ Bajando</span>'
    : trend === 'eq' ? '<span class="trend trend-eq">→ Estable</span>'
    : '';

  const attrsHtml = cfg.attrs.map(a => {
    const val = (j.attrs && j.attrs[a.key] !== undefined) ? j.attrs[a.key] : j.rating;
    const pct = (val / 10) * 100;
    return `<div class="fifa-attr">
      <span class="fifa-attr-val">${Math.round(val * 10)}</span>
      <div style="flex:1">
        <div class="fifa-attr-name">${a.label}</div>
        <div class="fifa-attr-bar">
          <div class="fifa-attr-fill fill-${pos}" style="width:${pct}%"></div>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
    <div class="fifa-card fifa-card-${pos} pos-${pos}">
      <div class="fifa-card-top">
        <div class="fifa-ovr">
          <span class="fifa-ovr-num">${Math.round(j.rating * 10)}</span>
          <span class="fifa-ovr-pos">${cfg.label.substring(0, 3).toUpperCase()}</span>
        </div>
        <div class="fifa-avatar fifa-avatar-${pos}">${j.nombre[0].toUpperCase()}</div>
        <div class="fifa-info">
          <div class="fifa-name">${j.nombre}</div>
          <div class="fifa-meta">${j.partidos || 0} partido${(j.partidos || 0) !== 1 ? 's' : ''} · ${cfg.icon} ${cfg.label}</div>
          <div class="decay-info">${trendHtml}<span style="margin-left:auto">${nVotos} votos</span></div>
        </div>
      </div>
      <div class="fifa-attrs">${attrsHtml}</div>
      ${clickable ? `
        <div class="fifa-card-actions">
          <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:12px"
            onclick="abrirEditar('${j.id}')">✏️ Editar</button>
          <button class="btn btn-danger" style="padding:8px 12px;font-size:16px"
            onclick="eliminarJugador('${j.id}')">×</button>
        </div>` : ''}
    </div>`;
}

function renderJugadores() {
  const lista = document.getElementById('lista-jugadores');
  if (!state.jugadores.length) {
    lista.innerHTML = '<div class="empty">Agregá el primer jugador arriba.</div>';
    return;
  }
  const order = ['ARQ', 'DEF', 'MED', 'ATA'];
  let html = '';
  order.forEach(pos => {
    const grupo = state.jugadores
      .filter(j => (j.pos || 'MED') === pos)
      .sort((a, b) => b.rating - a.rating);
    if (!grupo.length) return;
    const cfg = POS_CONFIG[pos];
    html += `<div style="font-family:'Bebas Neue';font-size:14px;letter-spacing:1px;color:var(--muted);margin:12px 0 6px">
      ${cfg.icon} ${cfg.label.toUpperCase()} (${grupo.length})
    </div>`;
    grupo.forEach(j => { html += renderFifaCard(j, true); });
  });
  lista.innerHTML = html;
}

// ===================== PARTIDO (CONVOCAR) =====================

function renderPartido() {
  const lista    = document.getElementById('lista-convocados');
  const floatBar = document.getElementById('float-convocados');

  if (!state.jugadores.length) {
    lista.innerHTML = '<div class="empty">Primero agregá jugadores.</div>';
    floatBar.style.display = 'none';
    return;
  }

  const order = ['ARQ', 'DEF', 'MED', 'ATA'];
  let html = '';
  order.forEach(pos => {
    const grupo = state.jugadores
      .filter(j => (j.pos || 'MED') === pos)
      .sort((a, b) => b.rating - a.rating);
    if (!grupo.length) return;
    const cfg = POS_CONFIG[pos];
    html += `<div style="font-family:'Bebas Neue';font-size:13px;letter-spacing:1px;color:var(--muted);margin:10px 0 5px">
      ${cfg.icon} ${cfg.label.toUpperCase()}
    </div>`;
    grupo.forEach(j => {
      const sel = state.convocados.includes(j.id);
      html += `<div class="player-card clickable ${sel ? 'selected' : ''}" onclick="toggleConvocado('${j.id}')">
        <div style="font-size:18px">${sel ? '✅' : '⬜'}</div>
        <div class="avatar avatar-${pos}">${j.nombre[0].toUpperCase()}</div>
        <div style="flex:1">
          <div class="player-name">${j.nombre}</div>
          <div class="player-sub">${cfg.icon} ${cfg.label} · ${j.rating.toFixed(1)} OVR</div>
        </div>
        <div class="player-score">${j.rating.toFixed(1)}</div>
      </div>`;
    });
  });

  lista.innerHTML = html;

  const n    = state.convocados.length;
  const nArq = state.convocados.filter(id => {
    const j = getJugador(id);
    return j && j.pos === 'ARQ';
  }).length;

  document.getElementById('count-convocados').textContent = n;
  document.getElementById('warn-arq').classList.toggle('show', n >= 2 && nArq < 2);
  floatBar.style.display = n >= 2 ? 'flex' : 'none';
}

// ===================== VOTAR =====================

function prepararVotacion() {
  const contenedor = document.getElementById('votar-contenido');
  if (!contenedor) return;

  // Sin permiso → pantalla de bloqueo
  if (typeof puedeVotar !== 'undefined' && !puedeVotar) {
    contenedor.innerHTML = `
      <div class="vote-locked">
        <div class="vote-locked-icon">🔒</div>
        <div class="vote-locked-title">Sin permiso de votación</div>
        <div class="vote-locked-msg">
          El admin todavía no te habilitó para votar.<br><br>
          Pedile que abra el panel <strong>Miembros</strong> y te active el permiso.
        </div>
      </div>`;
    return;
  }

  const convocados = state.jugadores.filter(j => state.convocados.includes(j.id));

  if (!convocados.length) {
    contenedor.innerHTML = '<div class="empty">No hay jugadores convocados.<br><br>Volvé a Convocar y tildá los jugadores.</div>';
    return;
  }

  contenedor.innerHTML = '<div id="lista-votos"></div><div id="btn-guardar-votos" style="margin-top:4px"><button class="btn btn-primary btn-full" onclick="guardarVotos()">✅ Guardar votos</button></div>';
  const lista = document.getElementById('lista-votos');

  lista.innerHTML = convocados.map(j => {
    const pos = j.pos || 'MED';
    const cfg = POS_CONFIG[pos];
    const attrsHtml = cfg.attrs.map(a => {
      const cur = (j.attrs && j.attrs[a.key] !== undefined) ? j.attrs[a.key] : j.rating;
      return `<div class="attr-vote-row">
        <span class="attr-vote-label">${a.label}</span>
        <input type="range" id="vote-${j.id}-${a.key}" min="1" max="10" step="0.5" value="${cur.toFixed(1)}"
          oninput="document.getElementById('vv-${j.id}-${a.key}').textContent=parseFloat(this.value).toFixed(1);
                   actualizarVotoPreview('${j.id}')">
        <span class="attr-vote-val" id="vv-${j.id}-${a.key}">${cur.toFixed(1)}</span>
      </div>`;
    }).join('');

    return `<div class="vote-player">
      <div style="display:flex;align-items:center;gap:9px;margin-bottom:9px">
        <div class="avatar avatar-${pos}" style="width:38px;height:38px;font-size:16px">${j.nombre[0].toUpperCase()}</div>
        <div>
          <div class="vote-name">${j.nombre}</div>
          <div style="font-size:11px;color:var(--muted)">
            ${cfg.icon} ${cfg.label} · OVR actual: <span style="color:var(--yellow)">${j.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
      ${attrsHtml}
      <div style="margin-top:9px;text-align:right;font-size:11px;color:var(--muted)">
        Nuevo OVR (con decaimiento):
        <span id="preview-ovr-${j.id}" style="color:var(--yellow);font-family:'Bebas Neue';font-size:16px">
          ${j.rating.toFixed(1)}
        </span>
      </div>
    </div>`;
  }).join('');


}

function actualizarVotoPreview(id) {
  const j   = getJugador(id); if (!j) return;
  const pos = j.pos || 'MED';
  const cfg = POS_CONFIG[pos];
  let sum   = 0;
  cfg.attrs.forEach(a => {
    const el = document.getElementById('vote-' + id + '-' + a.key);
    if (el) sum += parseFloat(el.value);
  });
  const avg       = sum / cfg.attrs.length;
  const simulado  = simularNuevoRating(j, avg);
  const el        = document.getElementById('preview-ovr-' + id);
  if (el) el.textContent = simulado.toFixed(1);
}

// ===================== HISTORIAL =====================

function renderHistorial() {
  const lista = document.getElementById('lista-historial');
  const admin = typeof esAdmin === 'function' && esAdmin();

  // Botón de cargar partido manual — solo admin
  const btnManual = admin ? `
    <button class="btn btn-secondary btn-full" style="margin-bottom:12px" onclick="abrirModalPartidoManual()">
      📝 Cargar partido manualmente
    </button>` : '';

  if (!state.historial.length) {
    lista.innerHTML = btnManual + `<div class="empty">Todavía no hay partidos guardados.<br><br>
      Cargá el resultado desde la pestaña Equipos o con el botón de arriba.</div>`;
    return;
  }

  const tagBalance = t => {
    if (t === 'parejos')         return '<span class="tag tag-green">⚖️ Parejos</span>';
    if (t === 'algo_desiguales') return '<span class="tag tag-yellow">〜 Algo desiguales</span>';
    return '<span class="tag tag-red">❗ Desiguales</span>';
  };
  const tagResultado = t => {
    if (t === 'sorpresa')      return '<span class="tag tag-yellow">🔄 Sorpresa</span>';
    if (t === 'gano_favorito') return '<span class="tag tag-green">📊 Ganó el favorito</span>';
    return '<span class="tag tag-blue">🤝 Empate</span>';
  };

  const cards = state.historial.map((p, idx) => {
    const esUltimo    = idx === 0;
    const puedeUndo   = admin && esUltimo && !p.esManual && p.snapshotJugadores;
    const manualBadge = p.esManual ? '<span class="tag tag-blue" style="font-size:10px">✍️ Manual</span>' : '';

    const botonesAdmin = admin ? `
      <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
        <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:11px"
          onclick="abrirEditarResultado('${p.id}')">✏️ Editar resultado</button>
        <button class="btn btn-secondary" style="flex:1;justify-content:center;font-size:11px"
          onclick="abrirEditarJugadoresPartido('${p.id}')">👥 Editar jugadores</button>
        ${puedeUndo ? `<button class="undo-btn" style="align-self:center" onclick="deshacerPartido('${p.id}')">↩ Deshacer</button>` : ''}
      </div>` : '';

    return `
    <div class="partido-hist">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;flex-wrap:wrap;gap:4px">
        <div class="partido-fecha">📅 ${p.fecha}${p.hora ? ' · ' + p.hora : ''}</div>
        ${manualBadge}
      </div>
      <div class="partido-resultado">
        <span style="color:var(--green)">${p.golesA}</span>
        <span style="color:var(--muted);font-size:22px"> – </span>
        <span style="color:var(--blue)">${p.golesB}</span>
      </div>
      <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:8px">
        ${p.ganador === 'Empate' ? '🤝 Empate' : p.ganador === 'A' ? '🟢 Ganó Equipo A' : '🔵 Ganó Equipo B'}
      </div>
      <div class="partido-equipos">
        <div style="color:var(--green)">
          <div class="partido-team-label">🟢 Equipo A · Σ${(p.sumA||0).toFixed(1)}</div>
          ${(p.equipoA||[]).map(j => `<div class="partido-jugador">
            ${(POS_CONFIG[j.pos||'MED']||POS_CONFIG.MED).icon} ${j.nombre}
          </div>`).join('')}
        </div>
        <div style="color:var(--blue)">
          <div class="partido-team-label">🔵 Equipo B · Σ${(p.sumB||0).toFixed(1)}</div>
          ${(p.equipoB||[]).map(j => `<div class="partido-jugador">
            ${(POS_CONFIG[j.pos||'MED']||POS_CONFIG.MED).icon} ${j.nombre}
          </div>`).join('')}
        </div>
      </div>
      <div class="partido-balance">
        ${tagBalance(p.balance_tag)} ${tagResultado(p.resultado_tag)}
        <span style="color:var(--muted)"> · Dif. ${Math.abs((p.sumA||0)-(p.sumB||0)).toFixed(1)} pts</span>
      </div>
      ${botonesAdmin}
    </div>`;
  }).join('');

  lista.innerHTML = btnManual + cards;
}

// ===================== MODAL EDITAR JUGADOR =====================

let editandoId = null;

function abrirEditar(id) {
  const j = getJugador(id); if (!j) return;
  editandoId = id;
  const pos = j.pos || 'MED';
  const cfg = POS_CONFIG[pos];
  document.getElementById('modal-nombre').textContent = `✏️ ${j.nombre}`;

  let html = `
    <div style="margin-bottom:12px">${posBadge(pos)}</div>
    <div class="rating-row" style="margin-bottom:4px">
      <span class="rating-label">Rating general</span>
      <input type="range" id="edit-rating" min="1" max="10" step="0.5" value="${j.rating.toFixed(1)}"
        oninput="document.getElementById('edit-rating-val').textContent=parseFloat(this.value).toFixed(1)">
      <span class="rating-val" id="edit-rating-val">${j.rating.toFixed(1)}</span>
    </div>
    <hr style="margin:14px 0">
    <div style="font-family:'Bebas Neue';font-size:16px;letter-spacing:1px;color:var(--muted);margin-bottom:10px">ATRIBUTOS</div>`;

  cfg.attrs.forEach(a => {
    const val = (j.attrs && j.attrs[a.key] !== undefined) ? j.attrs[a.key] : j.rating;
    html += `<div class="attr-edit-row">
      <span class="attr-edit-label">${a.label}</span>
      <input type="range" id="edit-attr-${a.key}" min="1" max="10" step="0.5" value="${val.toFixed(1)}"
        oninput="document.getElementById('ev-${a.key}').textContent=parseFloat(this.value).toFixed(1)">
      <span class="attr-edit-val" id="ev-${a.key}">${val.toFixed(1)}</span>
    </div>`;
  });

  document.getElementById('modal-contenido').innerHTML = html;
  document.getElementById('modal-editar').classList.add('open');
}

function cerrarModal() {
  document.getElementById('modal-editar').classList.remove('open');
  editandoId = null;
}
