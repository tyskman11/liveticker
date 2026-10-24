// Gemeinsamer Web- und API-Server fuer den Liveticker.
//   node api-server.js            -> http://localhost:5056/
// Die API liegt unter /api/v1/. Antworten werden 8 s gecacht.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { buildAll, TEAMS } = require('./data.js');
const PORT = process.env.PORT || 5056;
const ROOT = __dirname;
const LOG_DIR = path.join(ROOT, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'liveticker-api.log');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml' };

function log(level, message, meta) {
  const entry = { time: new Date().toISOString(), level, message, ...(meta ? { meta } : {}) };
  const line = JSON.stringify(entry);
  console[level === 'error' ? 'error' : 'log'](line);
  fs.mkdir(LOG_DIR, { recursive: true }, err => {
    if (err) return console.error('Logger-Verzeichnis nicht verfügbar:', err.message);
    fs.appendFile(LOG_FILE, line + '\n', err2 => { if (err2) console.error('Logger-Datei nicht beschreibbar:', err2.message); });
  });
}

let snap = { t: 0, v: null, p: null };
async function data() {
  if (snap.v && Date.now() - snap.t < 8000) return snap.v;
  if (!snap.p) snap.p = buildAll().then(v => {
    const failures = v.teams.filter(t => t.error).map(t => ({ team: t.id, error: t.error }));
    if (failures.length) log('error', 'Datenquellen mit Fehlern', { failures });
    snap = { t: Date.now(), v, p: null };
    return v;
  }).catch(e => { snap.p = null; log('error', 'Ticker-Aktualisierung fehlgeschlagen', { error: String(e.message || e) }); if (snap.v) return snap.v; throw e; });
  return snap.p;
}
const DOCS = {
  name: 'Liveticker API', version: '1.2.0',
  endpoints: {
    'GET /api/v1/ticker': 'alle Mannschaften mit live, next, upcoming, last, form',
    'GET /api/v1/teams': 'Liste der Mannschaften (ohne Spieldaten)',
    'GET /api/v1/teams/{id}': 'eine Mannschaft komplett; ids: ' + TEAMS.map(t => t.id).join(', '),
    'GET /api/v1/live': 'nur Mannschaften, die gerade spielen',
    'GET /api/v1/next': 'je Mannschaft das naechste Spiel, nach Anpfiff sortiert',
    'GET /api/v1/health': 'Status',
  },
  game: 'status: live|next|final; start: ISO-UTC; home/away: {name, short, logo, score, me}; goals: [{time, side, player, score, tag}]',
};
function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(obj, null, 1));
}
function serveStatic(res, pathname) {
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
  const file = path.resolve(ROOT, rel);
  if (!file.startsWith(ROOT + path.sep) || !MIME[path.extname(file)]) return send(res, 404, { error: 'nicht gefunden' });
  fs.readFile(file, (err, body) => {
    if (err) return send(res, err.code === 'ENOENT' ? 404 : 500, { error: 'Datei nicht verfügbar' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)], 'Cache-Control': 'no-cache', 'X-Content-Type-Options': 'nosniff' });
    res.end(body);
  });
}
http.createServer(async (req, res) => {
  const started = Date.now();
  if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET' }); return res.end(); }
  if (req.method !== 'GET') { log('error', 'Ungültige HTTP-Methode', { method: req.method, url: req.url }); return send(res, 405, { error: 'nur GET' }); }
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === '/liveticker') {
    res.writeHead(301, { Location: '/liveticker/' });
    return res.end();
  }
  const p = pathname.replace(/\/+$/, '').replace(/^\/liveticker/, '');
  try {
    if (p === '/api' || p === '/api/v1') return send(res, 200, DOCS);
    if (p === '/api/v1/health') return send(res, 200, { ok: true, updated: snap.v?.updated || null });
    const d = await data();
    if (p === '/api/v1/ticker' || p === '/api/ticker') return send(res, 200, d);
    if (p === '/api/v1/teams') return send(res, 200, d.teams.map(({ id, name, short, sport, league, color, logo }) => ({ id, name, short, sport, league, color, logo })));
    if (p === '/api/v1/live') return send(res, 200, { updated: d.updated, teams: d.teams.filter(t => t.live) });
    if (p === '/api/v1/next') return send(res, 200, { updated: d.updated, games: d.teams.filter(t => t.next).map(t => ({ team: t.id, ...t.next })).sort((a, b) => a.start.localeCompare(b.start)) });
    const m = p.match(/^\/api\/v1\/teams\/([a-z0-9_-]+)$/);
    if (m) { const t = d.teams.find(x => x.id === m[1]); return t ? send(res, 200, { updated: d.updated, ...t }) : send(res, 404, { error: 'unbekannte Mannschaft' }); }
    if (p.startsWith('/api')) return send(res, 404, { error: 'nicht gefunden', docs: '/api/v1' });
    // Funktioniert sowohl direkt auf / als auch hinter einem Proxy unter /liveticker/.
    const staticPath = pathname === '/liveticker' ? '/' : pathname.replace(/^\/liveticker(?=\/)/, '');
    serveStatic(res, staticPath);
  } catch (e) { log('error', 'HTTP-Anfrage fehlgeschlagen', { url: req.url, error: String(e.message || e) }); send(res, 502, { error: String(e.message || e) }); }
  finally { log('info', 'HTTP-Anfrage', { method: req.method, url: req.url, durationMs: Date.now() - started }); }
}).listen(PORT, '0.0.0.0', () => log('info', `Liveticker bereit auf http://localhost:${PORT}/`, { port: Number(PORT) }));
