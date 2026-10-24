# Versionsverlauf

## 2.0.0 — 2026-10-24

- Komplettes Server-, API-, Cache-, Datenquellen- und Logging-Backend von Node.js nach Python 3 migriert.
- Die Browser-Oberfläche bezieht ihre Daten ausschließlich aus der Python-API; der frühere Browser-Datenabruf entfällt.
- NAS-Startverwaltung auf `python3 server.py` umgestellt, ohne externe Python-Abhängigkeiten.

## 1.2.0 — 2026-10-20

- API-Bereich mit Status, Einstellungen, Endpunktübersicht und Anleitung direkt
  in die Liveticker-Seite integriert.
- JSON-API wird mit dem NAS-Startablauf gestartet und hinter dem geschützten
  Liveticker-Link an `api/v1/*` durchgereicht.

## 1.1.2 — 2026-10-20

- Geschützte Liveticker-Links leiten nun auch die offiziellen DEB- und
  DFB-Quellen weiter; zuvor endeten diese Abrufe hinter einem Token-Link mit 404.
- Datenabrufe verwenden `no-store`; beim Wechsel zurück in einen Browser-Tab
  wird sofort aktualisiert.
- Das Gate liefert Projektdateien mit `Cache-Control: no-cache`, damit eine
  aktuelle `data.js` und `app.js` nicht im Browser hängen bleibt.

## 1.1.1 — 2026-10-17

- Straubing Tigers nutzt jetzt den offiziellen Vereins-Spielplan statt eines Platzhalters.
- Tappara nutzt die offizielle Liiga-API statt eines Platzhalters.
- Der NAS-Gate enthält dafür eng begrenzte, gecachte Durchreicher; die Spiele
  erscheinen mit kommenden Begegnungen, Ergebnishistorie und verfügbarer Form.

## 1.1.0 — 2026-10-17

- Website und JSON-API können gemeinsam mit `node api-server.js` betrieben werden.
- Linux-Startskript für den gemeinsamen Betrieb auf einer Ugreen NAS ergänzt.
- Das Frontend verwendet bevorzugt `/api/v1/ticker` und nutzt bei statischem Hosting den bisherigen Direktabruf als Rückfall.
- Strukturierte Server-Logs liegen unter `logs/liveticker-api.log`.
- Browserfehler und Probleme einzelner Datenquellen werden in `localStorage` protokolliert und über `window.LivetickerLog.entries()` abrufbar gemacht.
- API, statische Dateiauslieferung und Pfadauflösung gegen Directory-Traversal abgesichert.
- Dokumenttitel, Statusmeldungen, Ladezustand und Detaildialog für bessere Zugänglichkeit korrigiert; ein Aufruf ohne abschließenden Slash wird auf `/liveticker/` umgeleitet.
- Marc Márquez korrekt als MotoGP-Fahrer bezeichnet; ESPN als unabhängige Rückfallquelle für Bayern und Dynamo ergänzt.
- Archiv der letzten zehn abgeschlossenen Spiele je Team in die Detailansicht aufgenommen.

## 1.0.0 — 2026-10-16

- Erste Fassung des Livetickers mit DEL2, NHL, Bundesliga, 2. Bundesliga und MotoGP.
