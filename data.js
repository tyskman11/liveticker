// Datenlogik des Livetickers - laeuft komplett im Browser (keine eigene Serveranwendung noetig).
// Fussball: OpenLigaDB direkt. NHL und DEL2 (del-2.org): ueber die Durchreicher "nhl/" und "del2/" des nginx (gate.conf),
// weil beide Seiten keinen Browserzugriff erlauben. Dieselbe Datei laeuft auch unter Node (api-server.js) - dort direkt ohne Durchreicher.
const LT = (() => {
const IN_BROWSER = typeof location !== 'undefined';
const ROOT = IN_BROWSER ? location.pathname.replace(/[^/]*$/, '') : '';
const NHL = IN_BROWSER ? ROOT + 'nhl/' : 'https://api-web.nhle.com/';
const DEL2 = IN_BROWSER ? ROOT + 'del2/' : 'https://www.del-2.org/';
// Die beiden offiziellen Vereins-/Ligaquellen erlauben keinen verlässlichen
// Cross-Origin-Abruf aus dem Browser. Auf dem NAS werden sie daher gezielt
// über die gleichnamigen, eingeschränkten Gate-Pfade durchgereicht.
const STRAUBING = IN_BROWSER ? ROOT + 'straubing/' : 'https://www.straubing-tigers.de/';
const LIIGA = IN_BROWSER ? ROOT + 'liiga/' : 'https://liiga.fi/api/v2/';
// Der DFB erlaubt CORS; dadurch funktionieren seine Termine auch sofort,
// falls das NAS-Gate nach einem Update noch nicht neu gestartet wurde.
const DFB = 'https://www.dfb.de/';
const DEB = IN_BROWSER ? ROOT + 'deb/' : 'https://www.deb-online.de/';
const DE_FLAG = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 3 2"><path d="M0 0h3v.667H0z"/><path fill="#d00" d="M0 .667h3v.666H0z"/><path fill="#ffce00" d="M0 1.333h3v.667H0z"/></svg>');
const TEAMS = [
  { id: 'dfb_men', name: 'Deutschland Männer', short: 'Deutschland', sport: 'football', league: 'DFB-Nationalmannschaft', color: '#111111', color2: '#dd0000', color3: '#ffce00', logo: DE_FLAG, src: 'dfb', path: 'men', role: 'Nationalteam', sourceUrl: 'https://www.dfb.de/maenner/nationalmannschaften/nationalmannschaft/spiele-und-termine' },
  { id: 'dfb_women', name: 'Deutschland Frauen', short: 'Deutschland', sport: 'football', league: 'DFB-Nationalmannschaft', color: '#111111', color2: '#dd0000', color3: '#ffce00', logo: DE_FLAG, src: 'dfb', path: 'women', role: 'Nationalteam', sourceUrl: 'https://www.dfb.de/frauen/nationalmannschaften/nationalmannschaft/spiele-und-termine' },
  { id: 'deb_men', name: 'Deutschland Männer', short: 'Deutschland', sport: 'hockey', league: 'DEB-Nationalmannschaft', color: '#111111', color2: '#dd0000', color3: '#ffce00', logo: DE_FLAG, src: 'deb', path: 'men', role: 'Nationalteam', sourceUrl: 'https://www.deb-online.de/maenner-nationalmannschaft/' },
  { id: 'deb_women', name: 'Deutschland Frauen', short: 'Deutschland', sport: 'hockey', league: 'DEB-Nationalmannschaft', color: '#111111', color2: '#dd0000', color3: '#ffce00', logo: DE_FLAG, src: 'deb', path: 'women', role: 'Nationalteam', sourceUrl: 'https://www.deb-online.de/frauen-nationalmannschaft/' },
  { id: 'straubing', name: 'Straubing Tigers', short: 'Straubing', sport: 'hockey', league: 'PENNY DEL', color: '#002e62', color2: '#ffffff', color3: '#ffffff', logo: 'https://www.straubing-tigers.de/wp-content/themes/straubing-tigers-theme/assets/img/logo.svg', src: 'straubing', club: 'Straubing Tigers', role: 'Team', sourceUrl: 'https://www.straubing-tigers.de/spielplan/' },
  { id: 'tappara', name: 'Tappara', short: 'Tappara', sport: 'hockey', league: 'Liiga', color: '#00539b', color2: '#f58220', src: 'liiga', club: 'Tappara', role: 'Team', sourceUrl: 'https://liiga.fi/en/schedule?joukkue=tappara' },
  { id: 'eisloewen', name: 'Dresdner Eislöwen', short: 'Dresdner', sport: 'hockey', league: 'DEL2', color: '#0054a6', color2: '#ffffff',
    src: 'del2', club: 'Dresdner Eislöwen', teamId: 332, leagues: [['DEL2', 'DEL2', 'hockey']] },
  { id: 'marquez', name: 'Marc Márquez', short: 'Márquez', sport: 'motorsport', league: 'MotoGP', color: '#e10600', color2: '#111111', src: 'motogp',
    logo: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#e10600"/><text x="32" y="43" font-family="Arial Black,Arial,sans-serif" font-size="30" font-weight="900" text-anchor="middle" fill="#fff">93</text></svg>') },
  { id: 'oilers', name: 'Edmonton Oilers', short: 'Edmonton', sport: 'hockey', league: 'NHL', color: '#ff4c00', color2: '#003e7e',
    src: 'nhl', abbr: 'EDM' },
  { id: 'vegas', name: 'Vegas Golden Knights', short: 'Vegas', sport: 'hockey', league: 'NHL', color: '#b4975a', color2: '#333f48',
    src: 'nhl', abbr: 'VGK' },
  { id: 'bayern', name: 'FC Bayern München', short: 'Bayern', sport: 'football', league: 'Bundesliga', color: '#dc052d', color2: '#ffffff',
    src: 'oldb', teamId: 40, espn: { league: 'ger.1', team: 132 }, leagues: [['bl1', 'Bundesliga', 'football'], ['dfb', 'DFB-Pokal', 'football'], ['ucl', 'Champions League', 'football']] },
  { id: 'dynamo', name: 'Dynamo Dresden', short: 'Dresden', sport: 'football', league: '2. Bundesliga', color: '#f2c200', color2: '#111111',
    src: 'oldb', teamId: 177, espn: { league: 'ger.2', team: 7017 }, leagues: [['bl2', '2. Bundesliga', 'football'], ['dfb', 'DFB-Pokal', 'football']] },
];

// ---------- Cache ----------
const cache = new Map();
async function cached(key, ttl, fn) {
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && now - hit.t < ttl) return hit.v;
  if (hit && hit.p) return hit.p; // laufende Anfrage teilen
  const p = fn().then(v => { cache.set(key, { t: Date.now(), v }); return v; })
    .catch(e => { if (hit) { cache.set(key, { t: now - ttl + 10000, v: hit.v }); return hit.v; } throw e; });
  cache.set(key, { t: hit ? hit.t : 0, v: hit ? hit.v : undefined, p });
  return p;
}
async function getRes(url) {
  // Spielstände und Zeitpläne dürfen nicht aus einem Browser-HTTP-Cache kommen.
  const r = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
  if (!r.ok) throw new Error(url + ' -> ' + r.status);
  return r;
}
const getJson = async url => (await getRes(url)).json();
const getText = async url => (await getRes(url)).text();

// ---------- NHL ----------
const nhlSeason = () => { const d = new Date(); const y = d.getUTCFullYear(); return d.getUTCMonth() >= 8 ? `${y}${y + 1}` : `${y - 1}${y}`; };
const NHL_LIVE = new Set(['LIVE', 'CRIT']);
const NHL_FUT = new Set(['FUT', 'PRE']);
const NHL_DONE = new Set(['FINAL', 'OFF']);
const periodName = p => !p ? '' : p.periodType === 'OT' ? (p.number > 4 ? `${p.number - 3}. OT` : 'OT') : p.periodType === 'SO' ? 'SO' : `${p.number}. Drittel`;

function nhlSide(t) {
  return { name: `${t.placeName?.default || ''} ${t.commonName?.default || ''}`.trim(), short: t.abbrev,
    logo: t.darkLogo || t.logo, score: t.score ?? null, sog: t.sog ?? null };
}
function nhlGame(g, comp) {
  const status = NHL_LIVE.has(g.gameState) ? 'live' : NHL_FUT.has(g.gameState) ? 'next' : NHL_DONE.has(g.gameState) ? 'final' : 'next';
  const pt = g.periodDescriptor?.periodType;
  return { id: 'nhl' + g.id, status, start: g.startTimeUTC, venue: g.venue?.default || '',
    competition: g.gameType === 1 ? 'NHL Preseason' : g.gameType === 3 ? 'Stanley Cup Playoffs' : 'NHL',
    home: nhlSide(g.homeTeam), away: nhlSide(g.awayTeam),
    note: status === 'final' ? (pt === 'OT' ? 'n.V.' : pt === 'SO' ? 'n.P.' : '') : '',
    period: '', clock: '', goals: [], penalties: [] };
}
async function nhlLive(g) {
  try {
    const l = await cached('nhl-landing-' + g.id, 10000, () => getJson(`${NHL}v1/gamecenter/${g.id.slice(3)}/landing`));
    g.home.score = l.homeTeam?.score ?? g.home.score; g.away.score = l.awayTeam?.score ?? g.away.score;
    g.home.sog = l.homeTeam?.sog ?? null; g.away.sog = l.awayTeam?.sog ?? null;
    g.period = periodName(l.periodDescriptor);
    g.clock = l.clock?.inIntermission ? 'Pause' : (l.clock?.timeRemaining ? 'noch ' + l.clock.timeRemaining : '');
    if (l.clock?.inIntermission) g.period += ' beendet';
    g.goals = nhlGoals(l); g.penalties = nhlPenalties(l);
  } catch { /* ohne Details weiter */ }
}
function nhlGoals(l) {
  const out = [];
  for (const p of l.summary?.scoring || []) {
    for (const x of p.goals || []) {
      out.push({ time: `${p.periodDescriptor.periodType === 'REG' ? p.periodDescriptor.number + '. Dr.' : p.periodDescriptor.periodType} ${x.timeInPeriod}`,
        side: x.teamAbbrev?.default === l.homeTeam?.abbrev ? 'home' : 'away',
        player: x.name?.default || '', assists: (x.assists || []).map(a => a.name?.default).filter(Boolean), s: nhlSecs(p.periodDescriptor, x.timeInPeriod),
        score: `${x.homeScore}:${x.awayScore}`, tag: x.strength && x.strength !== 'ev' ? x.strength.toUpperCase() : '' });
    }
  }
  return out;
}
const nhlSecs = (pd, t) => { const [m, sec] = String(t || '0:0').split(':').map(Number); return ((pd?.periodType === 'REG' ? pd.number : 3 + (pd?.number - 3 || 1)) - 1) * 1200 + m * 60 + (sec || 0); };
const NHL_PEN = { tripping: 'Beinstellen', hooking: 'Haken', slashing: 'Stockschlag', 'high-sticking': 'Hoher Stock', interference: 'Behinderung', holding: 'Halten', 'cross-checking': 'Check mit Stock', roughing: 'Rempeln', boarding: 'Bandencheck', 'delay-of-game': 'Spielverzögerung', 'too-many-men-on-the-ice': 'Zu viele Spieler', fighting: 'Faustkampf', charging: 'Übertriebene Härte', elbowing: 'Ellbogencheck', kneeing: 'Kniecheck', 'unsportsmanlike-conduct': 'Unsportlichkeit', embellishment: 'Schwalbe', 'illegal-check-to-head': 'Kopfcheck', 'goaltender-interference': 'Torwart-Behinderung', 'holding-the-stick': 'Stockhalten', 'closing-hand-on-puck': 'Hand auf Puck' };
function nhlPenalties(l) {
  const out = [];
  for (const p of l.summary?.penalties || []) {
    for (const x of p.penalties || []) {
      const key = String(x.descKey || '').replace(/-double-minor$|-major$|-minor$/, '');
      const pl = x.committedByPlayer ? `${(x.committedByPlayer.firstName?.default || '')[0] || ''}. ${x.committedByPlayer.lastName?.default || ''}`.trim() : (x.servedBy ? 'Teamstrafe' : 'Team');
      out.push({ time: `${p.periodDescriptor.periodType === 'REG' ? p.periodDescriptor.number + '. Dr.' : p.periodDescriptor.periodType} ${x.timeInPeriod}`, side: x.teamAbbrev?.default === l.homeTeam?.abbrev ? 'home' : 'away',
        player: pl, minutes: x.duration, reason: NHL_PEN[key] || key.replace(/-/g, ' ').replace(/^./, c => c.toUpperCase()), s: nhlSecs(p.periodDescriptor, x.timeInPeriod) });
    }
  }
  return out;
}
async function buildNhl(t) {
  const data = await cached('nhl-' + t.abbr, 30000, () => getJson(`${NHL}v1/club-schedule-season/${t.abbr}/${nhlSeason()}`));
  const games = (data.games || []).map(g => nhlGame(g)).sort((a, b) => a.start.localeCompare(b.start));
  // Der Spielplan hinkt hinterher: Spiele, die laut Zeit laufen koennten, direkt beim Spiel nachfragen
  await Promise.all(games.filter(g => g.status === 'next' && Date.parse(g.start) < Date.now() + 15 * 60000 && Date.parse(g.start) > Date.now() - 5 * 3600000).map(async g => {
    try {
      const l = await cached('nhl-landing-' + g.id, 10000, () => getJson(`${NHL}v1/gamecenter/${g.id.slice(3)}/landing`));
      if (NHL_LIVE.has(l.gameState)) g.status = 'live';
      else if (NHL_DONE.has(l.gameState)) { g.status = 'final'; g.home.score = l.homeTeam?.score ?? null; g.away.score = l.awayTeam?.score ?? null; }
    } catch { }
  }));
  const live = games.find(g => g.status === 'live') || null;
  if (live) await nhlLive(live);
  const upcoming = games.filter(g => g.status === 'next').slice(0, 4);
  const finals = games.filter(g => g.status === 'final');
  const last = finals[finals.length - 1] || null;
  if (last && !last.goals.length) await nhlFinalGoals(last);
  return { live, upcoming, last, history: finals.slice(-10).reverse(), form: finals.slice(-5).map(g => formOf(g, t.abbr, 'short')) };
}
async function nhlFinalGoals(g) {
  try { const l = await cached('nhl-landing-' + g.id, 600000, () => getJson(`${NHL}v1/gamecenter/${g.id.slice(3)}/landing`)); g.goals = nhlGoals(l); g.penalties = nhlPenalties(l); } catch { }
}
function formOf(g, key, field) {
  const home = g.home[field] === key;
  const my = home ? g.home.score : g.away.score, other = home ? g.away.score : g.home.score;
  if (my == null || other == null) return 'D';
  return my > other ? 'W' : my < other ? 'L' : 'D';
}

// ---------- OpenLigaDB ----------
function oldbSeason(shortcut) {
  const d = new Date(), y = d.getUTCFullYear(), m = d.getUTCMonth();
  const start = shortcut === 'DEL2' ? 8 : 7; // Saisonwechsel (Monat, 0-basiert)
  return m >= start - 1 ? y : y - 1;
}
function oldbMatch(m, comp, sport) {
  const finished = !!m.matchIsFinished;
  const start = m.matchDateTimeUTC || (m.matchDateTime + 'Z');
  const dur = sport === 'hockey' ? 160 : 150;
  const elapsed = (Date.now() - Date.parse(start)) / 60000;
  const goals = (m.goals || []).slice().sort((a, b) => a.goalID - b.goalID);
  const hasData = goals.length > 0 || (m.matchResults || []).length > 0;
  // Nicht als beendet markiert, aber Spielzeit laengst um: mit Ergebnis als beendet zeigen
  const status = finished ? 'final' : (elapsed >= 0 && elapsed < dur) ? 'live' : (elapsed >= dur && hasData) ? 'final' : 'next';
  let s1 = null, s2 = null;
  const fin = (m.matchResults || []).find(r => r.resultTypeID === 2);
  if (fin) { s1 = fin.pointsTeam1; s2 = fin.pointsTeam2; }
  else if (status !== 'next') {
    const lg = goals[goals.length - 1];
    const cur = (m.matchResults || []).slice().sort((a, b) => b.resultOrderID - a.resultOrderID)[0];
    if (lg) { s1 = lg.scoreTeam1; s2 = lg.scoreTeam2; } else if (cur) { s1 = cur.pointsTeam1; s2 = cur.pointsTeam2; } else { s1 = 0; s2 = 0; }
  }
  const ot = goals.some(g => g.isOvertime);
  const side = t => ({ name: t.teamName, short: t.shortName || t.teamName, logo: t.teamIconUrl || '', score: null });
  const home = side(m.team1), away = side(m.team2);
  home.score = s1; away.score = s2; home.id = m.team1.teamId; away.id = m.team2.teamId;
  let period = '', clock = '';
  if (status === 'live' && sport === 'football') {
    const lastMin = Math.max(0, ...goals.map(g => g.matchMinute || 0)); // Tore korrigieren die Schaetzung nach oben
    const half = elapsed < 45 ? Math.floor(elapsed) + 1 : elapsed < 62 ? 0 : Math.floor(elapsed - 15) + 1;
    period = half === 0 ? (elapsed < 48 ? '45+. Min.' : 'Halbzeit') : half > 90 ? '90+. Min.' : `${Math.max(half, elapsed < 45 || elapsed >= 62 ? lastMin : 0)}. Min.`;
  } else if (status === 'live') { period = 'Läuft'; }
  return { id: 'ol' + m.matchID, status, start, venue: m.location?.locationStadium || m.location?.locationCity || '',
    competition: comp + (m.group?.groupName ? ' · ' + m.group.groupName : ''),
    home, away, note: status === 'final' && ot && sport === 'hockey' ? 'n.V./n.P.' : '', period, clock,
    penalties: [], goals: goals.map(g => ({ s: (g.matchMinute || 0) * 60, assists: [], time: g.matchMinute != null ? `${g.matchMinute}'` : '', side: (g.scoreTeam1 > (prev1(goals, g))) ? 'home' : 'away',
      player: (g.goalGetterName || '') + (g.isOwnGoal ? ' (ET)' : g.isPenalty ? ' (Elfm.)' : ''), score: `${g.scoreTeam1}:${g.scoreTeam2}`, tag: '' })),
    _matchId: m.matchID };
}
function prev1(goals, g) { const i = goals.indexOf(g); return i > 0 ? goals[i - 1].scoreTeam1 : 0; }

async function buildOldb(t) {
  let all = [];
  let sourceOk = false;
  await Promise.all(t.leagues.map(async ([lg, label, sport]) => {
    try {
      const season = oldbSeason(lg);
      const data = await cached(`oldb-${lg}-${season}`, 60000, () => getJson(`https://api.openligadb.de/getmatchdata/${lg}/${season}`));
      sourceOk = true;
      for (const m of data) if (m.team1.teamId === t.teamId || m.team2.teamId === t.teamId) all.push(oldbMatch(m, label, sport));
    } catch { /* Liga evtl. noch nicht vorhanden */ }
  }));
  if (!sourceOk && t.espn) return buildEspn(t);
  all.sort((a, b) => a.start.localeCompare(b.start));
  const live = all.find(g => g.status === 'live') || null;
  if (live) {
    try {
      const m = await cached('oldb-m-' + live._matchId, 10000, () => getJson('https://api.openligadb.de/getmatchdata/' + live._matchId));
      const fresh = oldbMatch(m, live.competition.split(' · ')[0], t.sport);
      fresh.competition = live.competition; Object.assign(live, fresh);
    } catch { }
  }
  const finals = all.filter(g => g.status === 'final');
  const upcoming = all.filter(g => g.status === 'next').slice(0, 4);
  return { live: live && live.status === 'live' ? live : null, upcoming, last: finals[finals.length - 1] || null, history: finals.slice(-10).reverse(), form: finals.slice(-5).map(g => formOf(g, t.teamId, 'id')) };
}

// Unabhängige Rückfallquelle, falls OpenLigaDB nicht erreichbar ist.
async function buildEspn(t) {
  const d = await cached(`espn-${t.espn.league}-${t.espn.team}`, 60000, () => getJson(`https://site.api.espn.com/apis/site/v2/sports/soccer/${t.espn.league}/teams/${t.espn.team}/schedule`));
  const game = e => {
    const c = e.competitions?.[0] || e, side = x => ({ name: x.team?.displayName || '', short: x.team?.abbreviation || '', logo: x.team?.logo || '', score: x.score == null || x.score === '' ? null : +x.score, id: +x.id });
    const home = side((c.competitors || []).find(x => x.homeAway === 'home') || {}), away = side((c.competitors || []).find(x => x.homeAway === 'away') || {}), state = c.status?.type?.state;
    return { id: 'espn' + e.id, status: state === 'in' ? 'live' : state === 'post' ? 'final' : 'next', start: e.date || c.date, venue: c.venue?.fullName || '', competition: t.league, home, away, note: '', period: c.status?.type?.shortDetail || '', clock: c.status?.displayClock || '', goals: [], penalties: [] };
  };
  const games = (d.events || []).map(game).filter(g => g.start).sort((a, b) => a.start.localeCompare(b.start)), finals = games.filter(g => g.status === 'final');
  return { live: games.find(g => g.status === 'live') || null, upcoming: games.filter(g => g.status === 'next').slice(0, 4), last: finals[finals.length - 1] || null, form: finals.slice(-5).map(g => formOf(g, t.espn.team, 'id')), source: 'ESPN' };
}

// ---------- DEL2 (del-2.org, Seite wird ausgelesen) ----------
const tagless = s => s.replace(/<[^>]+>/g, '').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim();
function berlinToIso(y, mo, d, h, mi) {
  const off = ms => { // Berlin-Versatz zu UTC (Minuten) zum Zeitpunkt ms
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Berlin', hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(ms).map(x => [x.type, +x.value]));
    return (Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - ms) / 60000;
  };
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  return new Date(guess - off(guess - off(guess) * 60000) * 60000).toISOString();
}
const MONTHS_DE = { januar: 1, februar: 2, märz: 3, april: 4, mai: 5, juni: 6, juli: 7, august: 8, september: 9, oktober: 10, november: 11, dezember: 12 };
function officialResult(all, sourceUrl) {
  all.sort((a, b) => a.start.localeCompare(b.start)); const finals = all.filter(g => g.status === 'final');
  return { live: all.find(g => g.status === 'live') || null, upcoming: all.filter(g => g.status === 'next').slice(0, 4), last: finals.at(-1) || null, history: finals.slice(-10).reverse(), form: [], sourceUrl };
}
async function buildDfb(t) {
  const path = t.path === 'men' ? 'maenner/nationalmannschaften/nationalmannschaft/spiele-und-termine' : 'frauen/nationalmannschaften/nationalmannschaft/spiele-und-termine';
  const html = await cached('dfb-' + t.path, 300000, () => getText(DFB + path));
  const all = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => tagless(x[1]).replace(/\u00a0/g, ' '));
    const dm = (cells[0] || '').match(/(\d{2})\.(\d{2})\.(\d{4})/); if (!dm || !cells[2]) continue;
    const hm = (cells[1] || '').match(/(\d{1,2})[.:](\d{2})/); const start = berlinToIso(+dm[3], +dm[2], +dm[1], hm ? +hm[1] : 12, hm ? +hm[2] : 0);
    const pair = cells[2].replace(/\s*\([^)]*\)\s*$/, '').split(/\s+-\s+/); if (pair.length !== 2) continue;
    all.push({ id: `dfb-${t.path}-${dm[3]}${dm[2]}${dm[1]}`, status: 'next', start, venue: cells[3] || '', competition: cells[2].match(/\(([^)]+)\)/)?.[1] || 'Länderspiel',
      home: { name: pair[0], short: pair[0], score: null }, away: { name: pair[1], short: pair[1], score: null }, note: '', period: '', clock: '', goals: [], penalties: [] });
  }
  // Die DFB-Frauen nennt aktuell nur die WM 2027, aber noch keine Paarung.
  // Das ist kein Quellenfehler und wird deshalb nicht als falsches "kein Spiel" ausgegeben.
  if (!all.length) return { live: null, upcoming: [], last: null, history: [], form: [], sourceUrl: t.sourceUrl, notice: 'Der DFB hat derzeit noch keine konkrete Paarung veröffentlicht.' };
  return officialResult(all, t.sourceUrl);
}
async function buildDeb(t) {
  const path = t.path === 'men' ? 'maenner-nationalmannschaft/' : 'frauen-nationalmannschaft/';
  const html = await cached('deb-' + t.path, 300000, () => getText(DEB + (IN_BROWSER ? t.path + '/' : path)));
  const all = [];
  for (const article of html.matchAll(/<article class="mec-event-article[\s\S]*?<\/article>/gi)) {
    const block = article[0], dm = block.match(/mec-start-date-label">(\d{1,2})\.\s*([A-Za-zäöü]+)\s+(\d{4})/i), tm = block.match(/mec-start-time">(\d{1,2}):(\d{2})/);
    const teams = [...block.matchAll(/team-score"><p>([^<]+)<\/p>/gi)].map(x => tagless(x[1])); if (!dm || teams.length < 2) continue;
    const mo = MONTHS_DE[dm[2].toLowerCase()]; if (!mo) continue;
    const start = berlinToIso(+dm[3], mo, +dm[1], tm ? +tm[1] : 12, tm ? +tm[2] : 0);
    all.push({ id: `deb-${t.path}-${dm[3]}${mo}${dm[1]}-${teams.join('-')}`, status: 'next', start, venue: '', competition: 'DEB · ' + (block.match(/mec-label-normal[^>]*>([^<]+)/)?.[1] || 'Länderspiel'),
      home: { name: teams[0] === 'GER' ? 'Deutschland' : teams[0], short: teams[0], score: null }, away: { name: teams[1] === 'GER' ? 'Deutschland' : teams[1], short: teams[1], score: null }, note: '', period: '', clock: '', goals: [], penalties: [] });
  }
  if (!all.length) throw new Error('DEB-Spielplan enthält derzeit keine konkreten Paarungen');
  return officialResult(all, t.sourceUrl);
}
function del2Rows(html) {
  const rows = [];
  for (const chunk of html.split('<div class="games-row ').slice(1)) {
    const sc = chunk.match(/<a href="(\/spiel\/[^"]+)" class="games-score games-score-(\w+)" aria-label="[^"]*? am (\d\d)\.(\d\d)\.(\d{4})(?:, (?:Ergebnis|live): (\d+) zu (\d+))?/);
    const tm = chunk.match(/games-meta-time">(\d\d):(\d\d)/);
    if (!sc || !tm) continue;
    const sides = {};
    for (const m of chunk.matchAll(/<a href="\/clubs\/[^"]*" class="games-team games-team-(home|away)[^"]*" title="([^"]*)">([\s\S]*?)<\/a>/g))
      sides[m[1]] = { name: tagless(m[2]), short: tagless(m[2]), logo: (m[3].match(/<img src="([^"]+)"/) || [])[1] || '', score: null };
    if (!sides.home || !sides.away) continue;
    const status = sc[2] === 'live' ? 'live' : sc[2] === 'played' ? 'final' : 'next';
    if (sc[6] != null) { sides.home.score = +sc[6]; sides.away.score = +sc[7]; }
    rows.push({ id: 'd2' + sc[1].match(/_(\d+)$/)[1], status, path: sc[1].slice(1), start: berlinToIso(+sc[5], +sc[4], +sc[3], +tm[1], +tm[2]),
      venue: tagless((chunk.match(/bi-building"><\/i>([^<]+)/) || [])[1] || ''), competition: 'DEL2', home: sides.home, away: sides.away,
      note: '', period: '', clock: '', goals: [], penalties: [] });
  }
  return rows;
}
async function del2Detail(g, ttl) {
  try {
    const html = await cached('d2-' + g.id + g.status, ttl, () => getText(DEL2 + g.path + (g.status === 'final' ? '/timeline' : '')));
    const sc = html.match(/game-hero-score">(\d+)<span>:<\/span>(\d+)/);
    if (sc) { g.home.score = +sc[1]; g.away.score = +sc[2]; }
    const st = tagless((html.match(/game-hero-status">([^<]*)/) || [])[1] || '');
    if (g.status === 'live') {
      const pm = st.match(/^(.*?)\s*\((\d+:\d+)\)$/);
      g.period = pm ? pm[1] : st; g.clock = pm ? `${Math.floor(+pm[2].split(':')[0]) + 1}. Min.` : '';
      if (/beendet|endstand/i.test(st)) g.status = 'final';
    } else if (/n\.\s?V|Verl/i.test(st)) g.note = 'n.V.';
    else if (/n\.\s?P|Penalty|Shootout/i.test(st)) g.note = 'n.P.';
    const secs = c => { const [m, s] = c.split(':').map(Number); return m * 60 + (s || 0); };
    const events = html.split('<article class="game-timeline-event ').slice(1);
    const nm = x => tagless(x).replace(/#\d+\s*/g, '').trim();
    const grab = (a, re) => (a.match(re) || [])[1] || '';
    g.goals = events.filter(a => /^[^>]*game-timeline-event-goal/.test(a)).map(a => {
      const clock = grab(a, /game-timeline-clock">([^<]+)/);
      const score = tagless(grab(a, /game-timeline-score">([\s\S]*?)<\/span>\s*<\/div>/)).match(/(\d+)\s*:\s*(\d+)/);
      const line = tagless(grab(a, /game-timeline-line1">([\s\S]*?)<\/div>/));
      return { time: clock, side: /^game-timeline-event-home/.test(a) ? 'home' : 'away', player: line.replace(/\s*\([^)]+\)\s*$/, '') || 'Tor',
        assists: tagless(grab(a, /game-timeline-line2">([\s\S]*?)<\/div>/)).split(/\s*,\s*/).map(nm).filter(Boolean),
        score: score ? `${score[1]}:${score[2]}` : '', tag: (line.match(/\(([^)]+)\)\s*$/) || [])[1] || '', s: secs(clock) };
    }).sort((a, b) => a.s - b.s);
    g.penalties = events.filter(a => /^[^>]*game-timeline-event-penalty/.test(a)).map(a => {
      const clock = grab(a, /game-timeline-clock">([^<]+)/);
      return { time: clock, side: /^game-timeline-event-home/.test(a) ? 'home' : 'away', player: nm(grab(a, /game-timeline-line2">([\s\S]*?)<\/div>/)) || 'Team',
        minutes: parseInt(grab(a, /game-timeline-duration">([^<]*)/)) || 0, reason: tagless(grab(a, /game-timeline-line1">([\s\S]*?)<\/div>/)) || 'Strafe', s: secs(clock) };
    }).sort((a, b) => a.s - b.s);
  } catch { /* Spielplan-Daten reichen */ }
}
async function buildDel2(t) {
  let all;
  try {
    // DEL2 leitet /spielplan ohne Slash weiter. Der Token-Proxy kann diese
    // externe 301-Antwort nicht sicher umschreiben; daher direkt die kanonische
    // URL abrufen, damit nicht auf den veralteten OpenLigaDB-Fallback fällt.
    const html = await cached('d2-plan', 30000, () => getText(DEL2 + 'spielplan/'));
    all = del2Rows(html).filter(g => g.home.name === t.club || g.away.name === t.club);
    if (!all.length) throw new Error('keine Spiele gefunden');
  } catch (e) { return buildOldb(t); } // Notloesung: OpenLigaDB (ohne Live-Daten)
  for (const g of all) { g.home.me = g.home.name === t.club; g.away.me = g.away.name === t.club; g.home.id = g.home.name; g.away.id = g.away.name; }
  all.sort((a, b) => a.start.localeCompare(b.start));
  const live = all.find(g => g.status === 'live') || null;
  if (live) await del2Detail(live, 10000);
  const finals = all.filter(g => g.status === 'final');
  const last = finals[finals.length - 1] || null;
  if (last) await del2Detail(last, 600000);
  const upcoming = all.filter(g => g.status === 'next').slice(0, 4);
  return { live: live && live.status === 'live' ? live : null, upcoming, last, history: finals.slice(-10).reverse(), form: finals.slice(-5).map(g => formOf(g, t.club, 'name')) };
}

// ---------- Straubing Tigers (offizieller Spielplan) ----------
const STR_LOGOS = {
  STR: '/wp-content/themes/straubing-tigers-theme/assets/img/tiger-head.svg', WOB: '/wp-content/uploads/2021/02/grizzlys-wolfsburg.svg', KEC: '/wp-content/uploads/2021/02/koelner-haie-logo.png',
  AEV: '/wp-content/uploads/2021/07/logo-augsburger-panther.png', RBM: '/wp-content/uploads/2021/02/ehc_red_bull_muenchen.png', FRA: '/wp-content/uploads/2022/07/loewenfrankfurt.png',
  ING: '/wp-content/uploads/2021/02/erc-ingolstadt.png', MAN: '/wp-content/uploads/2021/02/logo-mannheim.png', BHV: '/wp-content/uploads/2021/02/Logo-FischtownPinguins.png',
  EBB: '/wp-content/uploads/2023/07/berlin-logo.png', DEG: '/wp-content/uploads/2021/02/Duesseldorfer_EG_logo.png', IEC: '/wp-content/uploads/2021/02/roosters-logo.png',
  NIT: '/wp-content/uploads/2021/02/nuernberg-ice-tigers.png', SWW: '/wp-content/uploads/2021/02/Schwenninger_Wild_Wings_Logo_2013.png'
};
const strLogo = code => code && STR_LOGOS[code] ? 'https://www.straubing-tigers.de' + STR_LOGOS[code] : '';
function straubingRows(html) {
  const rows = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(x => tagless(x[1]).replace(/^(Heimmannschaft|Gastmannschaft)\s*/i, ''));
    // Tabelle: Spieltag, Heimteam, Logo, Ergebnis/vs., Logo, Gastteam, Datum …
    if (cells.length < 7 || !/Straubing Tigers/i.test(cells[1] + cells[5])) continue;
    const codes = {};
    for (const x of row[1].matchAll(/<td[^>]*class="logo-(home|guest)"[^>]*>[\s\S]*?<div class="image\s+([A-Z0-9-]+)"/gi)) codes[x[1]] = x[2];
    const dm = cells[6].match(/(\d{2})\.(\d{2})\.(\d{4})\s*(\d{2}):(\d{2})\s*Uhr/i);
    if (!dm) continue;
    const result = cells[3].match(/(\d+)\s*:\s*(\d+)/);
    const start = berlinToIso(+dm[3], +dm[2], +dm[1], +dm[4], +dm[5]);
    const status = result ? 'final' : Date.parse(start) <= Date.now() && Date.now() < Date.parse(start) + 3 * 3600000 ? 'live' : 'next';
    rows.push({ id: `str-${dm[3]}${dm[2]}${dm[1]}-${cells[1]}-${cells[5]}`.replace(/\W/g, ''), status, start,
      venue: '', competition: 'PENNY DEL',
      home: { name: cells[1], short: cells[1], logo: strLogo(codes.home), score: result ? +result[1] : null },
      away: { name: cells[5], short: cells[5], logo: strLogo(codes.guest), score: result ? +result[2] : null },
      note: '', period: status === 'live' ? 'Läuft' : '', clock: '', goals: [], penalties: [] });
  }
  return rows;
}
async function buildStraubing(t) {
  const html = await cached('straubing-plan', 60000, () => getText(STRAUBING + 'spielplan/'));
  const all = straubingRows(html).sort((a, b) => a.start.localeCompare(b.start));
  if (!all.length) throw new Error('Offizieller Straubing-Spielplan enthält keine Spiele');
  const finals = all.filter(g => g.status === 'final');
  return { live: all.find(g => g.status === 'live') || null, upcoming: all.filter(g => g.status === 'next').slice(0, 4),
    last: finals.at(-1) || null, history: finals.slice(-10).reverse(), form: finals.slice(-5).map(g => formOf(g, t.club, 'name')), sourceUrl: t.sourceUrl };
}

// ---------- Tappara / Liiga (offizielle Liiga-API) ----------
function liigaSeason() { const d = new Date(); return d.getUTCFullYear() + (d.getUTCMonth() >= 7 ? 1 : 0); }
function liigaGame(g) {
  const side = x => ({ name: x.teamName, short: x.teamName, logo: x.logos?.lightBg || x.logos?.darkBg || '', score: g.started ? x.goals : null, id: x.teamId });
  const status = g.ended ? 'final' : g.started ? 'live' : 'next';
  const events = [...(g.homeTeam.goalEvents || []).map(x => ({ ...x, side: 'home' })), ...(g.awayTeam.goalEvents || []).map(x => ({ ...x, side: 'away' }))]
    .sort((a, b) => a.gameTime - b.gameTime).map(x => ({ s: x.gameTime || 0, time: `${Math.floor((x.gameTime || 0) / 60)}:${String((x.gameTime || 0) % 60).padStart(2, '0')}`, side: x.side,
      player: [x.scorerPlayer?.firstName, x.scorerPlayer?.lastName].filter(Boolean).join(' ') || 'Tor', assists: (x.assistantPlayers || []).map(a => [a.firstName, a.lastName].filter(Boolean).join(' ')),
      score: `${x.homeTeamScore}:${x.awayTeamScore}`, tag: (x.goalTypes || []).join(', ') }));
  return { id: 'liiga' + g.id, status, start: g.start, venue: g.iceRink?.name || '', competition: 'Liiga', home: side(g.homeTeam), away: side(g.awayTeam),
    note: g.finishedType === 'ENDED_DURING_OVERTIME' ? 'n.V.' : g.finishedType === 'ENDED_DURING_WINNING_SHOT_COMPETITION' ? 'n.P.' : '',
    period: status === 'live' ? `${g.currentPeriod || ''}. Drittel` : '', clock: '', goals: events, penalties: [] };
}
async function buildLiiga(t) {
  const games = await cached('liiga-tappara-' + liigaSeason(), 60000, () => getJson(`${LIIGA}games?tournament=runkosarja&season=${liigaSeason()}`));
  const all = (games || []).filter(g => g.homeTeam?.teamName === t.club || g.awayTeam?.teamName === t.club).map(liigaGame).sort((a, b) => a.start.localeCompare(b.start));
  if (!all.length) throw new Error('Offizieller Liiga-Spielplan enthält keine Tappara-Spiele');
  const finals = all.filter(g => g.status === 'final');
  return { live: all.find(g => g.status === 'live') || null, upcoming: all.filter(g => g.status === 'next').slice(0, 4),
    last: finals.at(-1) || null, history: finals.slice(-10).reverse(), form: finals.slice(-5).map(g => formOf(g, 'Tappara', 'name')), sourceUrl: t.sourceUrl };
}


// ---------- MotoGP (Marc Márquez, offizielle MotoGP-API) ----------
const MG = IN_BROWSER ? ROOT + 'moto/' : 'https://api.motogp.pulselive.com/motogp/v1/';
const mg = p => getJson(MG + p);
const MG_TYPE = { FP: 'Freies Training', PR: 'Practice', Q: 'Qualifying', SPR: 'Sprint', WUP: 'Warm-up', RAC: 'Rennen' };
const mgLabel = s => (MG_TYPE[s.type] || s.type) + ((s.type === 'FP' || s.type === 'Q') && s.number ? ' ' + s.number : '');
const mgTitle = n => 'GP ' + String(n || '').replace(/^GRAND PRIX OF /i, '').toLowerCase().replace(/(^|[\s-])\S/g, c => c.toUpperCase());
const isMarc = r => r && (r.legacy_id === 7444 || r.rider_id === 7444 || /marc\s+m[aá]rquez/i.test(r.full_name || `${r.rider_name || ''} ${r.rider_surname || ''}`));
const mgStatus = s => s.status === 'FINISHED' ? 'final' : s.status === 'NOT-STARTED' ? 'next' : 'live';
const mgGame = (s, ev) => ({ id: 'mg' + s.id, kind: 'moto', status: mgStatus(s), start: new Date(s.date).toISOString(), venue: s.circuit || ev.circuit?.name || '',
  competition: mgTitle(ev.name), session: mgLabel(s), type: s.type, period: '', clock: '', rider: null, grid: [], goals: [], penalties: [], _ev: ev.short_name });
const mgSecs = v => { const n = parseFloat(v); if (!isFinite(n) || n <= 0) return ''; return `noch ${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`; };

async function mgSessions(ev, cat) {
  const list = await cached('mg-ses-' + ev.id, 60000, () => mg(`results/sessions?eventUuid=${ev.id}&categoryUuid=${cat.id}`));
  return list.map(s => mgGame(s, ev)).sort((a, b) => a.start.localeCompare(b.start));
}
async function mgResult(g, sessionId) {
  try {
    const c = await cached('mg-cls-' + sessionId, 600000, () => mg(`results/session/${sessionId}/classification?test=false`));
    const r = (c.classification || []).find(x => isMarc(x.rider));
    if (r) g.rider = { pos: r.position, number: r.rider.number, gap: r.gap?.first || '', time: r.time || '', points: r.points ?? null, laps: r.total_laps ?? null, team: r.team?.name || '', status: r.status || '' };
  } catch { }
}
async function mgLive(g, cat) {
  try {
    const t = await cached('mg-timing', 5000, () => mg('timing-gateway/livetiming-lite'));
    const head = t.head || {}, all = Object.values(t.rider || {}).sort((a, b) => a.pos - b.pos);
    const me = all.find(isMarc);
    if (me) g.rider = { pos: me.pos, number: me.rider_number, gap: me.gap_first, time: me.lap_time, lastLap: me.last_lap_time, lap: me.num_lap, laps: head.num_lap || null, team: me.team_name, pit: !!me.on_pit, status: me.status_name };
    g.grid = all.slice(0, 8).map(r => ({ pos: r.pos, name: r.rider_shortname, number: r.rider_number, gap: r.gap_first, me: isMarc(r) }));
    if (me && !g.grid.some(x => x.me)) g.grid.push({ pos: me.pos, name: me.rider_shortname, number: me.rider_number, gap: me.gap_first, me: true });
    g.period = g.type === 'RAC' || g.type === 'SPR' ? (me && head.num_lap ? `Runde ${me.num_lap}/${head.num_lap}` : 'läuft') : g.session;
    g.clock = g.type === 'RAC' || g.type === 'SPR' ? '' : mgSecs(head.remaining);
  } catch { }
}
async function buildMoto(t) {
  const seasons = await cached('mg-seasons', 3600000, () => mg('results/seasons'));
  const season = seasons.find(s => s.current) || seasons[0];
  const cats = await cached('mg-cats-' + season.id, 3600000, () => mg('results/categories?seasonUuid=' + season.id));
  const cat = cats.find(c => /^MotoGP/.test(c.name));
  const evq = fin => cached('mg-ev-' + fin, 300000, () => mg(`results/events?seasonUuid=${season.id}&isFinished=${fin}`));
  const [open, done] = await Promise.all([evq(false), evq(true)]);
  const byDate = (a, b) => a.date_start.localeCompare(b.date_start);
  const openEv = open.filter(e => !e.test).sort(byDate), doneEv = done.filter(e => !e.test).sort(byDate);

  let upcoming = [], current = [];
  for (const ev of openEv.slice(0, 2)) {
    const ses = await mgSessions(ev, cat);
    if (ev === openEv[0]) current = ses;
    upcoming.push(...ses.filter(s => s.status === 'next'));
    if (upcoming.length >= 4) break;
  }
  // Status-Feld der API kann hinterherhinken: laeuft laut Zeit etwas, beim Zeitdienst nachfragen
  let live = current.find(s => s.status === 'live') || null;
  if (!live) {
    const maybe = current.find(s => s.status === 'next' && Date.parse(s.start) <= Date.now() && Date.now() < Date.parse(s.start) + 2.5 * 3600000);
    if (maybe) {
      try {
        const h = (await cached('mg-timing', 5000, () => mg('timing-gateway/livetiming-lite'))).head || {};
        if (h.event_shortname === maybe._ev && String(h.session_shortname || '').startsWith(maybe.type) && h.session_status_name !== 'F') { maybe.status = 'live'; live = maybe; }
      } catch { }
    }
  }
  if (live) { upcoming = upcoming.filter(s => s !== live); await mgLive(live, cat); }
  const finishedNow = current.filter(s => s.status === 'final');
  let last = finishedNow[finishedNow.length - 1] || null;
  if (last) { const raw = (await cached('mg-ses-' + openEv[0].id, 60000, () => mg(`results/sessions?eventUuid=${openEv[0].id}&categoryUuid=${cat.id}`))).find(s => 'mg' + s.id === last.id); await mgResult(last, raw.id); }
  else if (doneEv.length) {
    const ev = doneEv[doneEv.length - 1];
    const raw = (await cached('mg-ses-' + ev.id, 600000, () => mg(`results/sessions?eventUuid=${ev.id}&categoryUuid=${cat.id}`))).find(s => s.type === 'RAC');
    if (raw) { last = mgGame(raw, ev); await mgResult(last, raw.id); }
  }
  let standing = null, form = [];
  try {
    const st = await cached('mg-stand-' + season.id, 300000, () => mg(`results/standings?seasonUuid=${season.id}&categoryUuid=${cat.id}`));
    const me = (st.classification || []).find(x => isMarc(x.rider));
    if (me) { standing = { pos: me.position, points: me.points, wins: me.race_wins, podiums: me.podiums }; form = Object.values(me.last_positions || {}).reverse(); }
  } catch { }
  const next = upcoming[0] || null;
  return { live, upcoming: upcoming.slice(0, 4), last, history: last ? [last] : [], form, standing };
}

function sourceDeadline(source, ms = 12000) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Datenquelle antwortet nicht innerhalb von ${Math.round(ms / 1000)} Sekunden`)), ms); });
  return Promise.race([Promise.resolve(source), timeout]).finally(() => clearTimeout(timer));
}

async function buildAll() {
  const out = await Promise.all(TEAMS.map(async t => {
    const base = { id: t.id, name: t.name, short: t.short, sport: t.sport, league: t.league, color: t.color, color2: t.color2 || t.color, color3: t.color3 || t.color2 || t.color, role: t.role || (t.id === 'marquez' ? 'MotoGP-Fahrer' : 'Team') };
    try {
      const source = t.src === 'official' ? { live: null, upcoming: [], last: null, history: [], form: [], sourceUrl: t.sourceUrl, pending: true } : t.src === 'dfb' ? buildDfb(t) : t.src === 'deb' ? buildDeb(t) : t.src === 'nhl' ? buildNhl(t) : t.src === 'del2' ? buildDel2(t) : t.src === 'straubing' ? buildStraubing(t) : t.src === 'liiga' ? buildLiiga(t) : t.src === 'motogp' ? buildMoto(t) : buildOldb(t);
      // MotoGP führt mehrere abhängige Abfragen aus und ist damit der einzige
      // Abruf, der den kompletten Ticker merklich verzögern kann. Alle anderen
      // Quellen besitzen bereits einen Einzelabruf-Timeout in getRes().
      const r = t.src === 'motogp' ? await sourceDeadline(source) : await source;
      const strip = g => {
        if (!g || g._done) return g;
        if (g.kind === 'moto') { delete g._ev; return g; }
        Object.defineProperty(g, '_done', { value: true });
        delete g._matchId; delete g.path;
        // IDs dürfen nur verglichen werden, wenn die Team-Konfiguration sie
        // tatsächlich besitzt. `undefined === undefined` markierte sonst bei
        // Straubing und Nationalteams fälschlich beide Seiten als eigenes Team.
        const mineSide = s => t.src === 'nhl' ? s.short === t.abbr :
          (t.teamId != null && s.id === t.teamId) || (t.espn?.team != null && s.id === t.espn.team) || s.name === t.club || s.name === 'Deutschland';
        g.home.me = mineSide(g.home); g.away.me = mineSide(g.away);
        if (g.home.me) g.home.short = t.short;
        if (g.away.me) g.away.short = t.short;
        delete g.home.id; delete g.away.id;
        return g;
      };
      const sample = r.live || r.upcoming[0] || r.last;
      const live = strip(r.live), next = strip(r.upcoming[0] || null), upcoming = r.upcoming.map(strip), last = strip(r.last);
      const logo = t.logo || [sample?.home, sample?.away].find(s => s?.me)?.logo || '';
      // Archivspiele durchlaufen dieselbe Teamzuordnung wie Karte und Details;
      // sonst fehlen dort eigene Kurzbezeichnung/Markierung und es entstehen
      // widersprüchliche Mannschaftsnamen.
      const history = (r.history || []).map(strip);
      return { ...base, logo, live, next, upcoming, last, history, form: r.form, standing: r.standing || null, sourceUrl: r.sourceUrl || null, pending: !!r.pending, notice: r.notice || '', error: null };
    } catch (e) {
      return { ...base, logo: '', live: null, next: null, upcoming: [], last: null, history: [], form: [], error: String(e.message || e) };
    }
  }));
  return { updated: new Date().toISOString(), teams: out };
}return { buildAll, TEAMS };
})();
if (typeof module !== "undefined") module.exports = LT; else { window.buildAll = LT.buildAll; window.Liveticker = LT; }
