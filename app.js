(() => {
  const TZ = 'Europe/Berlin';
  const $ = id => document.getElementById(id);
  const savedRefresh = (() => { try { return Number(localStorage.getItem('liveticker:refresh-ms')) || 45000; } catch { return 45000; } })();
  const state = { data: null, filter: 'all', apiMode: 'checking', refreshMs: [15000, 45000, 90000].includes(savedRefresh) ? savedRefresh : 45000, refreshTimer: null, loading: false };
  const loggedErrors = new Set();
  const SPORT = { hockey: 'Eishockey', football: 'Fußball', motorsport: 'Motorsport' };

  // Browser-Fehler bleiben für die Diagnose erhalten, auch wenn die Konsole geschlossen war.
  const LOG_KEY = 'liveticker:log';
  function log(level, message, meta) {
    const entry = { time: new Date().toISOString(), level, message, ...(meta ? { meta } : {}) };
    console[level === 'error' ? 'error' : 'log']('[Liveticker]', entry);
    try {
      const entries = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
      entries.push(entry); localStorage.setItem(LOG_KEY, JSON.stringify(entries.slice(-50)));
    } catch { /* lokaler Speicher ist optional */ }
  }
  window.LivetickerLog = { entries: () => { try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; } }, clear: () => localStorage.removeItem(LOG_KEY) };
  window.addEventListener('error', e => log('error', 'Unbehandelter Browserfehler', { message: e.message, source: e.filename, line: e.lineno }));
  window.addEventListener('unhandledrejection', e => log('error', 'Unbehandelte Promise-Ablehnung', { error: String(e.reason) }));

  const fmtDay = d => new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TZ }).format(d);
  const fmtTime = d => new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(d);
  const fmtLong = d => new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', timeZone: TZ }).format(d);

  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const img = (src, cls) => src ? `<img class="${cls || ''}" src="${esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.visibility='hidden'">` : `<span class="${cls || ''}"></span>`;

  function countdown(iso) {
    const ms = new Date(iso) - Date.now();
    if (ms <= 0) return 'Beginn steht bevor';
    const m = Math.floor(ms / 60000), h = Math.floor(m / 60), d = Math.floor(h / 24);
    if (d >= 2) return `in ${d} Tagen`;
    if (d === 1) return `in 1 Tag ${h % 24} Std.`;
    if (h >= 1) return `in ${h} Std. ${m % 60} Min.`;
    return `in ${m} Min.`;
  }

  // ---------- Ereignisse: Tore mit Vorlagen, Strafen ----------
  function eventsOf(g, newestFirst, limit) {
    const ev = [...(g.goals || []).map(o => ({ ...o, k: 'goal' })), ...(g.penalties || []).map(o => ({ ...o, k: 'pen' }))].sort((a, b) => (a.s || 0) - (b.s || 0));
    if (newestFirst) ev.reverse();
    return limit ? ev.slice(0, limit) : ev;
  }
  function eventRow(g, o) {
    const sd = g.kind ? '' : `<i class="sd">${esc(g[o.side]?.short || '')}</i>`;
    if (o.k === 'pen') return `<div class="ev pen ${o.side}"><span class="tm">${esc(o.time)}</span><span class="who">${sd}Strafe ${o.minutes ? o.minutes + ' Min. ' : ''}· ${esc(o.player)}<small>${esc(o.reason)}</small></span><span class="sc">⏱</span></div>`;
    return `<div class="ev goal ${o.side}"><span class="tm">${esc(o.time)}</span><span class="who">${sd}<b>${esc(o.player || 'Tor')}</b>${o.tag ? `<em>${esc(o.tag)}</em>` : ''}${o.assists?.length ? `<small>Vorlage: ${esc(o.assists.join(', '))}</small>` : ''}</span><span class="sc">${esc(o.score)}</span></div>`;
  }
  const eventsHtml = (g, limit) => eventsOf(g, true, limit).map(o => eventRow(g, o)).join('');

  // ---------- MotoGP ----------
  function motoBlock(g, live) {
    const r = g.rider;
    const pos = `<div class="pos">${r ? 'P' + r.pos : '–'}</div>`;
    if (live) {
      const gap = r ? (r.pit ? 'In der Box' : r.pos === 1 ? 'Führend' : r.gap ? '+' + esc(r.gap) : '') : '';
      return `<div class="moto">${pos}<div class="minfo"><b>${esc(g.session)}</b><span>${esc([g.period, g.clock].filter(Boolean).join(' · ') || 'läuft')}</span><span>${gap}${r?.lastLap ? ' · Letzte Runde ' + esc(r.lastLap) : ''}</span></div></div>`;
    }
    if (g.status === 'final') {
      const d = r ? (r.pos === 1 ? esc(r.time) : r.gap ? '+' + esc(r.gap) : esc(r.time)) : '';
      return `<div class="moto">${pos}<div class="minfo"><b>${esc(g.session)}</b><span>${esc(g.competition)}</span><span>${d}${r?.points ? ' · ' + r.points + ' Pkt' : ''}</span></div></div>`;
    }
    return `<div class="moto next"><div class="minfo"><b>${esc(g.session)}</b><span>${esc(g.competition)}</span></div></div>`;
  }

  function matchBlock(team, g, live) {
    if (g.kind === 'moto') return motoBlock(g, live);
    const mine = s => s.me ? ' me' : '';
    const hasScore = g.home.score != null && g.away.score != null;
    const mid = hasScore
      ? `<div class="score">${g.home.score}:${g.away.score}</div>${live ? `<div class="sub">${esc([g.period, g.clock].filter(Boolean).join(' · ') || 'LIVE')}</div>` : (g.note ? `<div class="sub" style="color:var(--mut)">${esc(g.note)}</div>` : '')}`
      : `<div class="vs">vs</div>`;
    return `<div class="match">
      <div class="side${mine(g.home)}">${img(g.home.logo)}<span>${esc(g.home.name)}</span></div>
      <div class="mid">${mid}</div>
      <div class="side${mine(g.away)}">${img(g.away.logo)}<span>${esc(g.away.name)}</span></div></div>`;
  }

  function lastLine(team) {
    const g = team.last;
    if (!g) return '<span class="last">Noch kein Spiel</span>';
    if (g.kind === 'moto') return `<span class="last">Letztes Rennen/Session <b>${g.rider ? 'P' + g.rider.pos : '–'}</b> · ${esc(g.session)} ${esc(g.competition)}</span>`;
    return `<span class="last">Zuletzt <b>${esc(g.home.short)} ${g.home.score}:${g.away.score} ${esc(g.away.short)}</b>${g.note ? ' ' + esc(g.note) : ''}</span>`;
  }

  const formChip = f => typeof f === 'number'
    ? `<i class="${f <= 3 ? 'W' : f <= 10 ? 'D' : 'L'}">${f}</i>`
    : `<i class="${f}">${f === 'W' ? 'S' : f === 'L' ? 'N' : 'U'}</i>`;

  function card(team) {
    const live = team.live;
    const g = live || team.next;
    let pill = '<span class="pill">KEIN TERMIN</span>', body = `<div class="empty">${team.sport === 'motorsport' ? 'Keine Session angesetzt.' : 'Kein Spiel angesetzt.'}</div>`;
    if (team.pending) { pill = '<span class="pill">QUELLE</span>'; body = '<div class="empty">Offizieller Spielplan wird gerade angebunden.</div>'; }
    else if (team.notice) { pill = '<span class="pill">VORGEMERKT</span>'; body = `<div class="empty">${esc(team.notice)}</div>`; }
    if (live) pill = '<span class="pill live">● LIVE</span>';
    else if (g) pill = `<span class="pill">${esc(fmtDay(new Date(g.start)))}</span>`;
    if (g) {
      body = matchBlock(team, g, !!live);
      if (live && (g.goals?.length || g.penalties?.length)) body += `<div class="mini">${eventsHtml(g, 2)}</div>`;
      const d = new Date(g.start);
      body += live
        ? `<div class="when"><span>${esc(g.competition)}</span><b>${esc(g.venue)}</b></div>`
        : `<div class="when"><b>${esc(fmtTime(d))} Uhr</b><span class="cd" data-cd="${esc(g.start)}">${countdown(g.start)}</span><span>${esc(g.kind ? g.venue : g.competition)}</span></div>`;
    }
    return `<button class="card${live ? ' is-live' : ''}" data-id="${team.id}" style="--c:${team.color};--c2:${team.color2};--c3:${team.color3}">
      <div class="ch">${img(team.logo, 'logo')}<div><h3>${esc(team.name)}</h3><p>${esc(team.role || 'Team')} · ${esc(team.league)} · ${SPORT[team.sport] || ''}</p></div>${pill}</div>
      ${body}
      <div class="foot">${lastLine(team)}<div class="form" title="${team.sport === 'motorsport' ? 'Letzte Rennen' : 'Letzte Spiele'}">${team.form.map(formChip).join('')}</div></div>
      ${team.standing ? `<div class="stand">WM-Stand <b>P${team.standing.pos}</b> · ${team.standing.points} Pkt · ${team.standing.wins} Siege</div>` : ''}
      ${team.pending ? `<div class="empty" style="margin-top:8px">Offizielle Quelle wird angebunden</div>` : ''}${team.error ? `<div class="empty" style="margin-top:8px">⚠ Daten gerade nicht erreichbar</div>` : ''}
    </button>`;
  }

  function visible(t) {
    const f = state.filter;
    return f === 'all' || (f === 'live' && t.live) || t.sport === f;
  }

  function render() {
    const d = state.data; if (!d) return;
    const nextAt = t => t.live?.start || t.next?.start || '9999-12-31T23:59:59Z';
    const teams = d.teams.slice().sort((a, b) => Number(!!b.live) - Number(!!a.live) || nextAt(a).localeCompare(nextAt(b)) || a.name.localeCompare(b.name, 'de'));
    const liveTeams = d.teams.filter(t => t.live);
    $('liveCount').textContent = liveTeams.length;
    $('grid').setAttribute('aria-busy', 'false');
    const banner = $('liveBanner');
    banner.hidden = !liveTeams.length;
    if (liveTeams.length) {
      banner.innerHTML = `<h3>● JETZT LIVE</h3><div class="banner-row">${liveTeams.map(t => {
        const g = t.live;
        if (g.kind === 'moto') return `<button class="chip" data-id="${t.id}">${img(t.logo)}<span class="sc">${g.rider ? 'P' + g.rider.pos : '–'}</span><small>${esc(t.short)} · ${esc(g.session)} · ${esc(g.competition)}</small></button>`;
        return `<button class="chip" data-id="${t.id}">${img(g.home.logo)}<span class="sc">${g.home.score ?? 0}:${g.away.score ?? 0}</span>${img(g.away.logo)}<small>${esc(g.home.short)} – ${esc(g.away.short)} · ${esc(g.period || 'LIVE')}</small></button>`;
      }).join('')}</div>`;
    }
    const shown = teams.filter(visible);
    $('grid').innerHTML = shown.length ? shown.map(card).join('') : '<div class="empty">Aktuell läuft kein Spiel.</div>';

    const ag = d.teams.flatMap(t => t.upcoming.slice(0, t.sport === 'motorsport' ? 2 : 4).map(g => ({ t, g }))).sort((a, b) => a.g.start.localeCompare(b.g.start)).slice(0, 8);
    $('agenda').innerHTML = ag.map(({ t, g }) => {
      const dt = new Date(g.start);
      const title = g.kind === 'moto' ? `${esc(t.short)} · ${esc(g.session)}` : `${esc(g.home.name)} – ${esc(g.away.name)}`;
      return `<button class="ag" data-id="${t.id}" style="--c:${t.color};--c2:${t.color2};--c3:${t.color3}">
        <div class="d"><b>${esc(new Intl.DateTimeFormat('de-DE', { day: '2-digit', timeZone: TZ }).format(dt))}</b><span>${esc(new Intl.DateTimeFormat('de-DE', { month: 'short', timeZone: TZ }).format(dt))}</span></div>
        <div class="t">${title}<small>${esc(fmtTime(dt))} Uhr · ${esc(g.competition)}</small></div></button>`;
    }).join('') || '<div class="empty">Keine Spiele angesetzt.</div>';
    $('upd').textContent = 'Stand ' + fmtTime(new Date(d.updated)) + ' Uhr';
    const mode = $('apiState');
    if (mode) { mode.textContent = state.apiMode === 'server' ? 'API-Server verbunden' : 'Direktabruf aktiv'; mode.className = 'api-state ' + (state.apiMode === 'server' ? 'ok' : 'fallback'); }
    const base = $('apiBase');
    if (base) { const root = location.pathname.replace(/[^/]*$/, ''); base.textContent = root + 'api/v1/'; }
    const refresh = $('refreshEvery'); if (refresh) refresh.value = String(state.refreshMs);
  }

  function openSheet(id) {
    const t = state.data?.teams.find(x => x.id === id); if (!t) return;
    state.openId = id;
    const moto = t.sport === 'motorsport';
    const evs = g => eventsOf(g, false).map(o => eventRow(g, o)).join('') || '<div class="empty">Noch keine Tore oder Strafen.</div>';
    const when = x => esc(fmtDay(new Date(x.start))) + ' · ' + esc(fmtTime(new Date(x.start)));
    let h = `<button class="x" aria-label="Schließen">×</button><h3 id="sheetTitle">${esc(t.name)}</h3><p class="sheet-meta">${esc(t.role || 'Team')} · ${esc(t.league)}</p>`;
    if (t.standing) h += `<div class="when"><span>WM-Stand</span><b>P${t.standing.pos} · ${t.standing.points} Pkt · ${t.standing.wins} Siege · ${t.standing.podiums} Podien</b></div>`;
    if (t.live) {
      h += `<h4>Live · ${esc(t.live.competition)}</h4>${matchBlock(t, t.live, true)}`;
      if (!moto && t.live.home.sog != null) h += `<div class="when"><span>Schüsse</span><b>${t.live.home.sog} : ${t.live.away.sog}</b></div>`;
      h += moto
        ? `<h4>Top 8 live</h4>${t.live.grid.map(r => `<div class="ev ${r.me ? 'goal home' : ''}"><span class="tm">P${r.pos}</span><span class="who">${r.me ? '<b>' + esc(r.name) + '</b>' : esc(r.name)}<small>#${esc(r.number)}</small></span><span class="sc">${r.pos === 1 ? '' : '+' + esc(r.gap)}</span></div>`).join('')}`
        : `<h4>Tore &amp; Strafen</h4>${evs(t.live)}`;
    }
    if (t.last) {
      h += `<h4>${moto ? 'Zuletzt' : 'Letztes Spiel'} · ${esc(fmtLong(new Date(t.last.start)))}</h4>${matchBlock(t, t.last, false)}`;
      if (!moto) h += `<div style="margin-top:10px">${evs(t.last)}</div>`;
    }
    const archive = (t.history || []).filter(g => g.id !== t.last?.id);
    if (archive.length) h += `<h4>Spielarchiv</h4><div class="ups">${archive.map(g => `<div class="row"><span>${esc(fmtDay(new Date(g.start)))} · ${esc(g.home.short)} – ${esc(g.away.short)}</span><b>${g.home.score ?? '–'}:${g.away.score ?? '–'}</b></div>`).join('')}</div>`;
    if (t.upcoming.length) h += `<h4>${moto ? 'Nächste Sessions' : 'Nächste Spiele'}</h4><div class="ups">${t.upcoming.map(x => `<div class="row"><span>${moto ? esc(x.session) + ' · ' + esc(x.competition) : esc(x.home.short) + ' – ' + esc(x.away.short)}</span><span>${when(x)}</span></div>`).join('')}</div>`;
    $('sheet').innerHTML = h; $('sheet').hidden = false; $('sheetBg').hidden = false;
    document.body.style.overflow = 'hidden';
    $('sheet').focus();
  }
  function closeSheet() { state.openId = null; $('sheet').hidden = true; $('sheetBg').hidden = true; document.body.style.overflow = ''; }

  document.addEventListener('click', e => {
    const action = e.target.closest('[data-action]')?.dataset.action;
    if (action === 'toggle-api') { const panel = $('apiPanel'); panel.hidden = !panel.hidden; const button = e.target.closest('[data-action]'); button.setAttribute('aria-expanded', String(!panel.hidden)); return; }
    if (action === 'refresh-now') { load(true); return; }
    const f = e.target.closest('#filters button');
    if (f) { state.filter = f.dataset.f; document.querySelectorAll('#filters button').forEach(b => b.classList.toggle('on', b === f)); return render(); }
    if (e.target.closest('.x') || e.target === $('sheetBg')) return closeSheet();
    const c = e.target.closest('[data-id]'); if (c) openSheet(c.dataset.id);
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });
  $('refreshEvery')?.addEventListener('change', e => {
    state.refreshMs = Number(e.target.value);
    try { localStorage.setItem('liveticker:refresh-ms', String(state.refreshMs)); } catch { }
    log('info', 'Aktualisierungsintervall geändert', { milliseconds: state.refreshMs });
    load(true);
  });

  function scheduleLoad() {
    clearTimeout(state.refreshTimer);
    const delay = state.data?.teams.some(t => t.live) ? 12000 : state.refreshMs;
    state.refreshTimer = setTimeout(load, delay);
  }
  async function load() {
    // Sichtbarkeitswechsel, der manuelle Knopf und der Timer dürfen niemals
    // zwei parallele Datenaufbauten auslösen.
    if (state.loading) return;
    clearTimeout(state.refreshTimer); state.loading = true;
    try {
      const root = location.pathname.replace(/[^/]*$/, '');
      const response = await fetch(root + 'api/v1/ticker', { signal: AbortSignal.timeout(12000), cache: 'no-store' });
      if (!response.ok) throw new Error('API antwortet mit HTTP ' + response.status);
      state.data = await response.json();
      state.apiMode = 'server';
      for (const team of state.data.teams.filter(t => t.error)) {
        const signature = team.id + ':' + team.error;
        if (!loggedErrors.has(signature)) { loggedErrors.add(signature); log('error', 'Datenquelle nicht erreichbar', { team: team.id, error: team.error }); }
      }
      render();
      // Detailfenster live mitaktualisieren
      if (!$('sheet').hidden && state.openId) { const top = $('sheet').scrollTop; openSheet(state.openId); $('sheet').scrollTop = top; }
    } catch (apiError) {
      const apiSignature = 'api:' + String(apiError.message || apiError);
      if (!loggedErrors.has(apiSignature)) {
        loggedErrors.add(apiSignature);
        log('error', 'API-Abruf fehlgeschlagen; Direktabruf wird versucht', { error: String(apiError.message || apiError) });
      }
      try { state.data = await window.buildAll(); state.apiMode = 'fallback'; render(); }
      catch (fallbackError) { log('error', 'Auch Direktabruf fehlgeschlagen', { error: String(fallbackError.message || fallbackError) }); $('upd').textContent = 'Verbindung gestört …'; }
    }
    finally { state.loading = false; scheduleLoad(); }
  }

  setInterval(() => {
    $('clock').textContent = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: TZ }).format(new Date());
    document.querySelectorAll('[data-cd]').forEach(el => { el.textContent = countdown(el.dataset.cd); });
  }, 1000);
  // Beim Zurückkehren in einen zuvor offenen Tab sofort nachladen, statt bis
  // zum nächsten 45-Sekunden-Takt einen alten Spielstand stehen zu lassen.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) load(true); });
  load();
})();
