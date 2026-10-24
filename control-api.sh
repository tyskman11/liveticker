#!/usr/bin/env sh
# Startet bzw. stoppt die Liveticker-JSON-API auf der NAS.
set -eu
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PIDFILE="$ROOT/liveticker-api.pid"
LOGDIR="$ROOT/logs"
PORT=${LIVETICKER_API_PORT:-5056}
ACTION=${1:-start}

running() {
  [ -r "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null && curl -fsS --max-time 2 "http://127.0.0.1:$PORT/api/v1/health" >/dev/null 2>&1
}
start() {
  if running; then echo "Liveticker-API läuft bereits auf Port $PORT."; return; fi
  rm -f "$PIDFILE"; mkdir -p "$LOGDIR"
  PYTHON=${PYTHON:-$(command -v python3 || command -v python || true)}
  [ -n "$PYTHON" ] && [ -x "$PYTHON" ] || { echo 'FEHLER: Python 3 fehlt.' >&2; exit 1; }
  nohup env PORT="$PORT" "$PYTHON" "$ROOT/server.py" >> "$LOGDIR/liveticker-api.stdout.log" 2>> "$LOGDIR/liveticker-api.stderr.log" &
  PID=$!; echo "$PID" > "$PIDFILE"; sleep 1
  if ! running; then rm -f "$PIDFILE"; echo 'FEHLER: Liveticker-API konnte nicht gestartet werden.' >&2; exit 1; fi
  echo "Liveticker-API läuft auf Port $PORT."
}
stop() { if [ -r "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then kill "$(cat "$PIDFILE")"; fi; rm -f "$PIDFILE"; }
case "$ACTION" in start) start;; restart) stop; sleep 1; start;; stop) stop;; *) echo 'usage: control-api.sh start|stop|restart' >&2; exit 2;; esac
