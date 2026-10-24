# Liveticker  →  https://tyskman11.duckdns.org/liveticker/

Eislöwen (DEL2), Oilers & Golden Knights (NHL), Bayern & Dynamo (Fußball) sowie MotoGP-Fahrer Marc Márquez: live, nächstes Spiel/Session, letztes Ergebnis; bei Eishockey/Fußball mit Torschützen, Vorlagen und Strafen.

Die Detailansicht enthält ein Archiv der letzten zehn abgeschlossenen Spiele; verfügbare Tore, Vorlagen und Strafen werden auch für vergangene Spiele angezeigt.

Für den Produktivbetrieb kann der Ordner weiterhin statisch ausgeliefert werden. Für einen vollständigen lokalen Betrieb startet `node api-server.js` jetzt Webseite **und** API gemeinsam auf Port 5056. Das Frontend verwendet dann die API; bei rein statischem Hosting fällt es auf den bisherigen Direktabruf zurück.

## Dateien
- `index.html`, `style.css`, `app.js` – Aussehen und Anzeige
- `data.js` – Datenabruf; Teams/Fahrer und Ligen: `TEAMS` ganz oben (OpenLigaDB-, ESPN- und NHL-IDs). Fällt OpenLigaDB aus, wird für Bayern und Dynamo ESPN als unabhängige Rückfallquelle genutzt; DEL2 hat bereits die offizielle DEL2-Seite und OpenLigaDB als Fallback.

## Start auf Ugreen NAS / JSON-Schnittstelle
Der Node-Prozess ist der gemeinsame Webserver: Er liefert Webseite und API aus demselben Prozess und lauscht auf allen Netzwerkadressen (`0.0.0.0`). Auf der Ugreen NAS im Projektordner starten mit `sh api-start.sh` (oder direkt `node api-server.js`). Unter Windows steht `api-start.bat` bereit.

Standardmäßig liegt die Anwendung danach auf **http://NAS-IP:5056/**; die Webseite liegt auf `/`, die API unter `/api/v1/`. Für `https://tyskman11.duckdns.org/liveticker/` muss der vorgeschaltete Webserver `/liveticker/` an diesen Dienst weiterleiten. Der Dienst verarbeitet dabei sowohl weitergereichte Pfade mit dem Präfix `/liveticker/` als auch Pfade, bei denen der Proxy das Präfix entfernt. Sie nutzt dieselbe `data.js`:
`/ticker`, `/teams`, `/teams/{id}` (eisloewen, oilers, vegas, bayern, dynamo), `/live`, `/next`, `/health`. Die Übersicht liefert `/api/v1` selbst.
Im Browser steht zusätzlich `window.Liveticker.buildAll()` zur Verfügung. Browserfehler werden in `localStorage` gespeichert und sind über `window.LivetickerLog.entries()` abrufbar; `window.LivetickerLog.clear()` leert sie. Der Server schreibt strukturierte JSON-Zeilen nach `logs/liveticker-api.log`.

## Testen
Lokal `http://localhost:5056/` bzw. auf der NAS `http://NAS-IP:5056/` öffnen. Die API benötigt beim ersten Datenabruf einige Sekunden. Beim statischen Betrieb braucht NHL/DEL2/MotoGP weiterhin die genannten Reverse-Proxies.
Änderungen an den Dateien sind sofort online (ggf. Browser-Cache leeren).

Der frühere Node-Server liegt als Archiv in `gate\_archiv_node\liveticker-*`.

### Gate nach einer Quellenänderung neu laden

Der statische Betrieb verwendet für Quellen ohne Browser-Freigabe gezielte
Durchreicher im nativen Gate – darunter den offiziellen Spielplan der Straubing
Tigers. Nach Änderungen an `gate/native-server.js` muss auf der NAS einmal im
Projektordner `sh start-websites.sh` ausgeführt werden. Ein bloßes Neuladen der
Webseite reicht dafür nicht; danach arbeitet die Seite ohne Browser-Cache weiter.

## JSON-API

Der NAS-Startpunkt startet zusätzlich `liveticker/control-api.sh start`. Die API
bleibt bei aktiviertem Schutz unter demselben Liveticker-Token erreichbar:

- `GET api/v1/ticker` – komplette Ticker-Daten
- `GET api/v1/teams` und `GET api/v1/teams/{id}` – Teams
- `GET api/v1/live`, `GET api/v1/next`, `GET api/v1/health` – Teilausgaben und Status

Die API-Seite im Liveticker erklärt die Endpunkte und bietet eine pro Browser
speicherbare Aktualisierungs-Einstellung. Sie zeigt auch an, ob die Website
gerade den API-Server oder den eingebauten Direktabruf verwendet.
