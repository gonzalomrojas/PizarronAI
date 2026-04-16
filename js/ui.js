// ===================== TABS + WIZARD =====================

const TABS = ['jugadores', 'partido', 'equipos', 'votar', 'historial', 'stats'];

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
  if (tab === 'equipos')   restaurarEquipos();
  if (tab === 'votar')     prepararVotacion();
  if (tab === 'historial') renderHistorial();
  if (tab === 'stats')     renderStats();

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

    // Sección MVP
    const mvpBadge = p.mvp_jugador_nombre
      ? `<div class="mvp-badge">🏆 MVP: <strong>${p.mvp_jugador_nombre}</strong></div>` : '';

    // Votación abierta: form para votar
    const todosJugPart = [...(p.equipoA||[]),...(p.equipoB||[])];
    const opcionesJug  = todosJugPart
      .filter(j => j.id !== currentUser?.id)
      .map(j => `<option value="${j.id}">${j.nombre}</option>`).join('');

    const seccionMVP = p.mvp_jugador_nombre
      ? mvpBadge
      : p.mvp_abierto
        ? `<div class="mvp-section">
            <div style="font-family:'Bebas Neue';font-size:14px;letter-spacing:1px;color:var(--yellow);margin-bottom:8px">🏆 VOTAR MVP</div>
            <div id="mvp-form-${p.id}">
              <select id="mvp-select-${p.id}" style="margin-bottom:8px">
                <option value="">— Elegí el mejor del partido —</option>
                ${opcionesJug}
              </select>
              <button class="btn btn-yellow btn-full" id="btn-votar-mvp-${p.id}"
                onclick="submitVotoMVP('${p.id}')">🏆 Votar MVP</button>
            </div>
            <div id="mvp-votos-${p.id}" style="margin-top:10px"></div>
            <button class="btn btn-secondary btn-full" style="font-size:11px;margin-top:6px"
              onclick="abrirVotosMVPEnPartido('${p.id}')">🔄 Ver votos actuales</button>
            ${admin ? `<button class="btn btn-danger btn-full" style="font-size:11px;margin-top:4px"
              id="btn-mvp-toggle-${p.id}" onclick="toggleVotacionMVP('${p.id}', false)">
              🔒 Cerrar votación y elegir MVP</button>` : ''}
          </div>`
        : admin
          ? `<button class="btn btn-secondary btn-full" style="font-size:11px;margin-top:6px"
              id="btn-mvp-toggle-${p.id}" onclick="toggleVotacionMVP('${p.id}', true)">
              🏆 Abrir votación MVP</button>`
          : '';

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
      ${seccionMVP}
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

// ===================== STATS =====================

function renderStats() {
  const contenedor = document.getElementById('tab-stats');
  if (!contenedor) return;

  if (!state.jugadores.length) {
    contenedor.innerHTML = '<div class="section-title">Estadísticas</div><div class="empty">Todavía no hay jugadores en la plantilla.</div>';
    return;
  }

  const jugadoresConStats = calcularStatsGrupo();

  // MVP global — el más votado de toda la historia
  const mvpTotal = jugadoresConStats.reduce((top, j) =>
    (!top || j.stats.mvps > top.stats.mvps) ? j : top, null);

  // Racha activa más larga
  const mayorRacha = jugadoresConStats.reduce((top, j) =>
    (!top || j.stats.rachaActual > top.stats.rachaActual) ? j : top, null);

  const headerHtml = `
    <div class="section-title">Estadísticas</div>
    <div class="stats-highlights">
      ${mvpTotal && mvpTotal.stats.mvps > 0 ? `
        <div class="stat-highlight">
          <div class="stat-highlight-icon">🏆</div>
          <div class="stat-highlight-label">MVP histórico</div>
          <div class="stat-highlight-val">${mvpTotal.nombre}</div>
          <div class="stat-highlight-sub">${mvpTotal.stats.mvps} vez${mvpTotal.stats.mvps!==1?'es':''}</div>
        </div>` : ''}
      ${mayorRacha && mayorRacha.stats.rachaActual > 1 ? `
        <div class="stat-highlight">
          <div class="stat-highlight-icon">🔥</div>
          <div class="stat-highlight-label">Racha activa</div>
          <div class="stat-highlight-val">${mayorRacha.nombre}</div>
          <div class="stat-highlight-sub">${mayorRacha.stats.rachaActual} partidos ganando</div>
        </div>` : ''}
    </div>`;

  const rankingHtml = `
    <div style="font-family:'Bebas Neue';font-size:16px;letter-spacing:1px;color:var(--muted);margin:14px 0 8px">
      RANKING DE JUGADORES
    </div>` +
    jugadoresConStats.map((j, i) => {
      const s   = j.stats;
      const pos = j.pos || 'MED';
      const cfg = POS_CONFIG[pos];
      const pct = s.partidos > 0 ? Math.round((s.ganados / s.partidos) * 100) : 0;
      return `
        <div class="stat-card" onclick="abrirStatJugador('${j.id}')">
          <div class="stat-card-rank">${i+1}</div>
          <div class="fifa-avatar fifa-avatar-${pos}" style="width:36px;height:36px;font-size:14px;flex-shrink:0">
            ${j.nombre[0].toUpperCase()}
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:600;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${j.nombre}
              ${s.mvps > 0 ? `<span style="font-size:11px;color:var(--yellow)"> 🏆×${s.mvps}</span>` : ''}
              ${s.rachaActual > 1 ? `<span style="font-size:11px;color:var(--orange)"> 🔥${s.rachaActual}</span>` : ''}
            </div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">
              ${cfg.icon} ${cfg.label} · ${s.partidos} PJ · ${s.ganados}G ${s.empatados}E ${s.perdidos}P
            </div>
            <div style="margin-top:4px;height:3px;background:var(--border);border-radius:2px">
              <div style="height:3px;width:${pct}%;background:var(--green);border-radius:2px"></div>
            </div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div style="font-family:'Bebas Neue';font-size:22px;color:var(--yellow)">${Math.round(j.rating*10)}</div>
            <div style="font-size:10px;color:var(--muted)">${pct}% win</div>
          </div>
        </div>`;
    }).join('');

  contenedor.innerHTML = headerHtml + rankingHtml;
}

function abrirStatJugador(jugadorId) {
  const j = state.jugadores.find(p => p.id === jugadorId); if (!j) return;
  const s = calcularStatsJugador(jugadorId);
  const pos = j.pos || 'MED';
  const cfg = POS_CONFIG[pos];
  const pct = s.partidos > 0 ? Math.round((s.ganados / s.partidos) * 100) : 0;

  // Evolución del rating (línea de puntos)
  const evHtml = s.evolucionRating.length > 1 ? (() => {
    const vals  = s.evolucionRating.map(e => e.rating);
    const min   = Math.max(0, Math.min(...vals) - 0.5);
    const max   = Math.min(10, Math.max(...vals) + 0.5);
    const range = max - min || 1;
    const w     = 280, h = 60, pad = 10;
    const pts   = vals.map((v,i) => {
      const x = pad + (i/(vals.length-1||1))*(w-pad*2);
      const y = h - pad - ((v-min)/range)*(h-pad*2);
      return `${x},${y}`;
    }).join(' ');
    return `
      <div style="margin:12px 0 4px;font-size:11px;color:var(--muted)">Evolución de rating (últimos partidos)</div>
      <svg width="100%" viewBox="0 0 ${w} ${h}" style="overflow:visible">
        <polyline points="${pts}" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        ${vals.map((v,i) => {
          const x = pad + (i/(vals.length-1||1))*(w-pad*2);
          const y = h - pad - ((v-min)/range)*(h-pad*2);
          return `<circle cx="${x}" cy="${y}" r="3" fill="var(--green)"/>`;
        }).join('')}
        <text x="${pad}" y="${h-2}" font-size="9" fill="var(--muted)">${vals[0].toFixed(1)}</text>
        <text x="${w-pad}" y="${h-2}" font-size="9" fill="var(--yellow)" text-anchor="end">${vals[vals.length-1].toFixed(1)}</text>
      </svg>`;
  })() : '';

  document.getElementById('modal-stats-titulo').textContent = j.nombre;
  document.getElementById('modal-stats-cuerpo').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
      <div class="fifa-avatar fifa-avatar-${pos}" style="width:52px;height:52px;font-size:22px">
        ${j.nombre[0].toUpperCase()}
      </div>
      <div>
        <div style="font-size:11px;color:var(--muted)">${cfg.icon} ${cfg.label}</div>
        <div style="font-family:'Bebas Neue';font-size:36px;color:var(--yellow);line-height:1">${Math.round(j.rating*10)}</div>
        <div style="font-size:10px;color:var(--muted)">OVR actual</div>
      </div>
    </div>
    <div class="stats-grid-4">
      <div class="stat-mini"><div class="stat-mini-val">${s.partidos}</div><div class="stat-mini-label">Jugados</div></div>
      <div class="stat-mini"><div class="stat-mini-val" style="color:var(--green)">${s.ganados}</div><div class="stat-mini-label">Ganados</div></div>
      <div class="stat-mini"><div class="stat-mini-val" style="color:var(--muted)">${s.empatados}</div><div class="stat-mini-label">Empatados</div></div>
      <div class="stat-mini"><div class="stat-mini-val" style="color:var(--red)">${s.perdidos}</div><div class="stat-mini-label">Perdidos</div></div>
    </div>
    <div class="stats-grid-3" style="margin-top:8px">
      <div class="stat-mini"><div class="stat-mini-val" style="color:var(--yellow)">🏆 ${s.mvps}</div><div class="stat-mini-label">MVPs</div></div>
      <div class="stat-mini"><div class="stat-mini-val" style="color:var(--orange)">🔥 ${s.rachaActual}</div><div class="stat-mini-label">Racha actual</div></div>
      <div class="stat-mini"><div class="stat-mini-val">${pct}%</div><div class="stat-mini-label">% victorias</div></div>
    </div>
    ${evHtml}`;

  document.getElementById('modal-stats').classList.add('open');
}

function cerrarStats() {
  document.getElementById('modal-stats').classList.remove('open');
}

