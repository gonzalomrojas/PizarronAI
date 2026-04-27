// =====================================================
// bug-report.js — Pizarrón AI
// Widget de reporte de errores para usuarios
// Depende de: config.js (SUPABASE_URL, SUPABASE_ANON)
// =====================================================

(function () {
  'use strict';

  // ── Estado interno ──────────────────────────────────
  let _cat = null;
  let _sev = null;

  // ── Inyectar HTML en el DOM ─────────────────────────
  function _injectHTML() {
    const html = `
    <!-- BUG REPORT: botón flotante -->
    <button id="br-trigger" aria-label="Reportar problema">
      <span id="br-dot"></span>
      <span id="br-trigger-label">Reportar problema</span>
    </button>

    <!-- BUG REPORT: overlay + panel -->
    <div id="br-overlay" role="dialog" aria-modal="true" aria-label="Reportar un problema">
      <div id="br-panel">
        <div id="br-drag-handle"></div>

        <!-- FORMULARIO -->
        <div id="br-form">
          <div id="br-header">
            <div>
              <div id="br-title">🐛 Reportar falla</div>
              <div id="br-subtitle">Tu reporte llega directo al developer</div>
            </div>
            <button id="br-close" aria-label="Cerrar">✕</button>
          </div>

          <div class="br-label">¿Qué tipo de problema es?</div>
          <div id="br-cat-grid">
            <div class="br-cat" data-cat="sync">        <span class="br-cat-icon">☁️</span><div><div class="br-cat-name">Sincronización</div><div class="br-cat-desc">Datos no se actualizan</div></div></div>
            <div class="br-cat" data-cat="equipos">     <span class="br-cat-icon">⚖️</span><div><div class="br-cat-name">Equipos / Balanceo</div><div class="br-cat-desc">Algo en el armado</div></div></div>
            <div class="br-cat" data-cat="votos">       <span class="br-cat-icon">⭐</span><div><div class="br-cat-name">Votación</div><div class="br-cat-desc">Votos o ratings</div></div></div>
            <div class="br-cat" data-cat="visual">      <span class="br-cat-icon">🎨</span><div><div class="br-cat-name">Visual / UI</div><div class="br-cat-desc">Se ve mal o roto</div></div></div>
            <div class="br-cat" data-cat="performance"> <span class="br-cat-icon">🐌</span><div><div class="br-cat-name">Lentitud</div><div class="br-cat-desc">Carga lenta o freeze</div></div></div>
            <div class="br-cat" data-cat="otro">        <span class="br-cat-icon">💬</span><div><div class="br-cat-name">Otro / Sugerencia</div><div class="br-cat-desc">Idea o mejora</div></div></div>
          </div>

          <div class="br-label">Impacto del problema</div>
          <div id="br-sev-row">
            <div class="br-sev" data-sev="baja">    😐 Leve</div>
            <div class="br-sev" data-sev="media">   ⚠️ Molesto</div>
            <div class="br-sev" data-sev="alta">    🔥 Bloqueante</div>
            <div class="br-sev" data-sev="critica"> 💀 App rota</div>
          </div>

          <div class="br-label">Descripción</div>
          <textarea id="br-desc" rows="4" placeholder="Contame qué pasó, qué intentabas hacer y qué viste en pantalla..."></textarea>

          <div class="br-label">Pasos para reproducir <span style="color:var(--muted);font-weight:400">(opcional)</span></div>
          <textarea id="br-steps" rows="3" placeholder="1. Fui a Equipos&#10;2. Toqué 'Armar equipos'&#10;3. La app se cerró"></textarea>

          <button id="br-submit">Enviar reporte →</button>
        </div>

        <!-- ÉXITO -->
        <div id="br-success">
          <div id="br-success-emoji">🎉</div>
          <div id="br-success-title">¡Reporte enviado!</div>
          <div id="br-success-sub">Quedó registrado y lo vamos a revisar lo antes posible.</div>
          <div id="br-ticket-display">—</div>
          <div style="font-size:11px;color:var(--muted);margin-top:6px">Ticket ID — guardalo si querés hacer seguimiento</div>
          <button id="br-success-close">Cerrar</button>
        </div>

      </div>
    </div>
    `;
    const wrapper = document.createElement('div');
    wrapper.innerHTML = html;
    document.body.appendChild(wrapper);
  }

  // ── Inyectar CSS ────────────────────────────────────
  function _injectCSS() {
    const css = `
    /* ── TRIGGER ── */
    #br-trigger {
      position: fixed; bottom: 24px; right: 24px; z-index: 900;
      background: var(--surface2, #1e1e1e);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 50px;
      padding: 10px 18px;
      display: flex; align-items: center; gap: 8px;
      cursor: pointer;
      font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 600;
      color: var(--muted, #666);
      transition: all 0.2s;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    #br-trigger:hover {
      border-color: #ff7043; color: #ff7043;
      transform: translateY(-2px);
      box-shadow: 0 6px 24px rgba(255,112,67,0.25);
    }
    #br-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #ff7043;
      animation: br-pulse 2s ease infinite;
      flex-shrink: 0;
    }
    @keyframes br-pulse {
      0%,100% { opacity:1; transform:scale(1); }
      50%      { opacity:0.4; transform:scale(0.75); }
    }

    /* ── OVERLAY ── */
    #br-overlay {
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.75);
      backdrop-filter: blur(4px);
      z-index: 950;
      display: flex; align-items: flex-end; justify-content: center;
      opacity: 0; pointer-events: none;
      transition: opacity 0.25s;
    }
    #br-overlay.br-open { opacity: 1; pointer-events: all; }

    /* ── PANEL ── */
    #br-panel {
      background: var(--surface, #161616);
      border: 1px solid var(--border, #2a2a2a);
      border-bottom: none;
      border-radius: 20px 20px 0 0;
      padding: 24px 20px 36px;
      width: 100%; max-width: 480px;
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1);
      max-height: 92vh; overflow-y: auto;
    }
    #br-overlay.br-open #br-panel { transform: translateY(0); }

    /* ── DRAG HANDLE ── */
    #br-drag-handle {
      width: 40px; height: 4px;
      background: var(--border, #2a2a2a);
      border-radius: 2px;
      margin: 0 auto 22px;
    }

    /* ── HEADER ── */
    #br-header {
      display: flex; justify-content: space-between; align-items: flex-start;
      margin-bottom: 20px;
    }
    #br-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 26px; letter-spacing: 2px; color: #ff7043;
    }
    #br-subtitle { font-size: 11px; color: var(--muted,#666); margin-top: 2px; text-transform: uppercase; letter-spacing: 0.5px; }
    #br-close {
      background: var(--surface2,#1e1e1e);
      border: 1px solid var(--border,#2a2a2a);
      color: var(--muted,#666);
      width: 32px; height: 32px; border-radius: 50%;
      cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      transition: all 0.15s; flex-shrink: 0;
    }
    #br-close:hover { color: var(--text,#f0f0f0); border-color: var(--text,#f0f0f0); }

    /* ── LABELS ── */
    .br-label {
      font-size: 11px; font-weight: 600;
      text-transform: uppercase; letter-spacing: 1px;
      color: var(--muted,#666); margin-bottom: 8px;
    }

    /* ── CATEGORÍAS ── */
    #br-cat-grid {
      display: grid; grid-template-columns: repeat(2,1fr);
      gap: 8px; margin-bottom: 18px;
    }
    .br-cat {
      background: var(--surface2,#1e1e1e);
      border: 1px solid var(--border,#2a2a2a);
      border-radius: 10px; padding: 10px 12px;
      cursor: pointer;
      display: flex; align-items: center; gap: 8px;
      transition: all 0.15s;
    }
    .br-cat:hover { border-color: #ff7043; }
    .br-cat.br-selected { border-color: #ff7043; background: rgba(255,112,67,0.1); }
    .br-cat-icon { font-size: 18px; flex-shrink: 0; }
    .br-cat-name { font-size: 12px; font-weight: 600; color: var(--text,#f0f0f0); }
    .br-cat-desc { font-size: 10px; color: var(--muted,#666); margin-top: 1px; }

    /* ── SEVERIDAD ── */
    #br-sev-row {
      display: flex; gap: 6px; margin-bottom: 18px; flex-wrap: wrap;
    }
    .br-sev {
      flex: 1; min-width: 70px;
      padding: 8px 6px;
      background: var(--surface2,#1e1e1e);
      border: 1px solid var(--border,#2a2a2a);
      border-radius: 8px; cursor: pointer;
      text-align: center; font-size: 11px; font-weight: 600;
      color: var(--muted,#666); transition: all 0.15s;
    }
    .br-sev:hover { border-color: #777; color: var(--text,#f0f0f0); }
    .br-sev.br-sel-baja    { border-color: #00e676; color: #00e676; background: rgba(0,230,118,0.08); }
    .br-sev.br-sel-media   { border-color: #ffd600; color: #ffd600; background: rgba(255,214,0,0.08); }
    .br-sev.br-sel-alta    { border-color: #ff7043; color: #ff7043; background: rgba(255,112,67,0.08); }
    .br-sev.br-sel-critica { border-color: #ff3d3d; color: #ff3d3d; background: rgba(255,61,61,0.08); }

    /* ── SHAKE ── */
    .br-shake { animation: br-shake 0.4s ease; }
    @keyframes br-shake {
      0%,100% { transform:translateX(0); }
      20%     { transform:translateX(-6px); }
      40%     { transform:translateX(6px); }
      60%     { transform:translateX(-4px); }
      80%     { transform:translateX(4px); }
    }

    /* ── TEXTAREA ── */
    #br-desc, #br-steps {
      width: 100%;
      background: var(--surface2,#1e1e1e);
      border: 1px solid var(--border,#2a2a2a);
      border-radius: 10px;
      color: var(--text,#f0f0f0);
      font-family: 'DM Sans', sans-serif; font-size: 14px;
      padding: 12px 14px; outline: none;
      resize: none; margin-bottom: 14px;
      transition: border-color 0.15s;
    }
    #br-desc:focus, #br-steps:focus { border-color: #ff7043; }
    #br-desc::placeholder, #br-steps::placeholder { color: var(--muted,#666); }

    /* ── SUBMIT ── */
    #br-submit {
      width: 100%; padding: 14px;
      background: #ff7043; border: none; border-radius: 12px;
      color: #fff;
      font-family: 'DM Sans', sans-serif; font-size: 15px; font-weight: 700;
      cursor: pointer; transition: all 0.2s; letter-spacing: 0.3px;
    }
    #br-submit:hover { filter: brightness(1.1); transform: translateY(-1px); }
    #br-submit:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

    /* ── SUCCESS ── */
    #br-success {
      display: none; text-align: center; padding: 16px 0;
    }
    #br-success.br-visible { display: block; }
    #br-success-emoji { font-size: 48px; margin-bottom: 14px; }
    #br-success-title {
      font-family: 'Bebas Neue', sans-serif;
      font-size: 28px; letter-spacing: 2px; color: #00e676; margin-bottom: 8px;
    }
    #br-success-sub { font-size: 13px; color: var(--muted,#666); line-height: 1.6; }
    #br-ticket-display {
      display: inline-block; margin-top: 14px;
      padding: 6px 16px;
      background: var(--surface2,#1e1e1e);
      border: 1px solid var(--border,#2a2a2a);
      border-radius: 8px;
      font-family: 'Bebas Neue', sans-serif;
      letter-spacing: 3px; font-size: 20px; color: #ff7043;
    }
    #br-success-close {
      margin-top: 20px; width: 100%; padding: 12px;
      background: var(--surface2,#1e1e1e);
      border: 1px solid var(--border,#2a2a2a);
      border-radius: 12px; color: var(--text,#f0f0f0);
      font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
      cursor: pointer; transition: all 0.15s;
    }
    #br-success-close:hover { border-color: #ff7043; color: #ff7043; }
    `;
    const style = document.createElement('style');
    style.id = 'br-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  // ── Generar ticket ID ───────────────────────────────
  function _genTicket() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    return 'BUG-' + Array.from({length: 6}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  // ── Abrir / cerrar panel ────────────────────────────
  function _open() {
    document.getElementById('br-overlay').classList.add('br-open');
    document.body.style.overflow = 'hidden';
  }

  function _close() {
    document.getElementById('br-overlay').classList.remove('br-open');
    document.body.style.overflow = '';
    setTimeout(_reset, 400);
  }

  function _reset() {
    _cat = null; _sev = null;
    document.querySelectorAll('.br-cat').forEach(b => b.classList.remove('br-selected'));
    document.querySelectorAll('.br-sev').forEach(b => b.className = 'br-sev');
    document.getElementById('br-desc').value = '';
    document.getElementById('br-steps').value = '';
    document.getElementById('br-form').style.display = '';
    document.getElementById('br-success').classList.remove('br-visible');
    const btn = document.getElementById('br-submit');
    btn.disabled = false;
    btn.textContent = 'Enviar reporte →';
  }

  function _shake(id) {
    const el = document.getElementById(id);
    el.classList.remove('br-shake');
    void el.offsetWidth; // reflow
    el.classList.add('br-shake');
    el.addEventListener('animationend', () => el.classList.remove('br-shake'), { once: true });
  }

  // ── Enviar a Supabase ───────────────────────────────
  async function _submit() {
    const desc = document.getElementById('br-desc').value.trim();

    if (!_cat) { _shake('br-cat-grid'); return; }
    if (!_sev) { _shake('br-sev-row'); return; }
    if (!desc) { _shake('br-desc'); document.getElementById('br-desc').focus(); return; }

    const btn = document.getElementById('br-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando...';

    const ticket = _genTicket();

    const payload = {
      ticket_id:   ticket,
      grupo_id:    localStorage.getItem('pizarron_grupo_id') || 'unknown',
      categoria:   _cat,
      severidad:   _sev,
      descripcion: desc,
      pasos:       document.getElementById('br-steps').value.trim() || null,
      user_agent:  navigator.userAgent,
      url_actual:  window.location.href,
      viewport:    window.innerWidth + 'x' + window.innerHeight,
      timestamp:   new Date().toISOString(),
      estado:      'nuevo'
    };

    try {
      // SUPABASE_URL y SUPABASE_ANON vienen de config.js
      const res = await fetch(SUPABASE_URL + '/rest/v1/bug_reports', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'apikey':        SUPABASE_ANON,
          'Authorization': 'Bearer ' + SUPABASE_ANON,
          'Prefer':        'return=minimal'
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error('Supabase ' + res.status + ': ' + err);
      }

      _showSuccess(ticket);

    } catch (err) {
      console.error('[BugReport] Error al enviar:', err);
      // Guardar localmente para reintentar después
      _savePending(payload);
      // Igual mostrar éxito al usuario — no es culpa suya
      _showSuccess(ticket + ' ⚠️');
    }
  }

  function _showSuccess(ticket) {
    document.getElementById('br-form').style.display = 'none';
    document.getElementById('br-success').classList.add('br-visible');
    document.getElementById('br-ticket-display').textContent = ticket;
  }

  // ── Offline fallback ────────────────────────────────
  function _savePending(payload) {
    try {
      const pending = JSON.parse(localStorage.getItem('br_pending') || '[]');
      pending.push(payload);
      localStorage.setItem('br_pending', JSON.stringify(pending));
    } catch (e) { console.warn('[BugReport] No se pudo guardar pending:', e); }
  }

  async function _retryPending() {
    try {
      const pending = JSON.parse(localStorage.getItem('br_pending') || '[]');
      if (!pending.length) return;

      const ok = [];
      for (const p of pending) {
        try {
          const res = await fetch(SUPABASE_URL + '/rest/v1/bug_reports', {
            method: 'POST',
            headers: {
              'Content-Type':  'application/json',
              'apikey':        SUPABASE_ANON,
              'Authorization': 'Bearer ' + SUPABASE_ANON,
              'Prefer':        'return=minimal'
            },
            body: JSON.stringify(p)
          });
          if (res.ok) ok.push(p.ticket_id);
        } catch (_) {}
      }

      if (ok.length) {
        const remaining = pending.filter(p => !ok.includes(p.ticket_id));
        localStorage.setItem('br_pending', JSON.stringify(remaining));
        console.log('[BugReport] Reportes pendientes enviados:', ok);
      }
    } catch (e) { console.warn('[BugReport] Error en retry:', e); }
  }

  // ── Bindear eventos ─────────────────────────────────
  function _bindEvents() {
    // Abrir
    document.getElementById('br-trigger').addEventListener('click', _open);

    // Cerrar
    document.getElementById('br-close').addEventListener('click', _close);
    document.getElementById('br-success-close').addEventListener('click', _close);

    // Click fuera del panel
    document.getElementById('br-overlay').addEventListener('click', function(e) {
      if (e.target === this) _close();
    });

    // Categorías
    document.querySelectorAll('.br-cat').forEach(el => {
      el.addEventListener('click', function() {
        document.querySelectorAll('.br-cat').forEach(b => b.classList.remove('br-selected'));
        this.classList.add('br-selected');
        _cat = this.dataset.cat;
      });
    });

    // Severidad
    document.querySelectorAll('.br-sev').forEach(el => {
      el.addEventListener('click', function() {
        document.querySelectorAll('.br-sev').forEach(b => b.className = 'br-sev');
        _sev = this.dataset.sev;
        this.classList.add('br-sel-' + _sev);
      });
    });

    // Submit
    document.getElementById('br-submit').addEventListener('click', _submit);

    // Escape para cerrar
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && document.getElementById('br-overlay').classList.contains('br-open')) {
        _close();
      }
    });
  }

  // ── Init ────────────────────────────────────────────
  function init() {
    _injectCSS();
    _injectHTML();
    _bindEvents();
    // Reintentar reportes pendientes al cargar
    _retryPending();
    console.log('[BugReport] Widget inicializado ✅');
  }

  // Arrancar cuando el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
