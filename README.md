# Liveticker

Live ticker for Eislöwen (DEL2), Oilers and Golden Knights (NHL), Bayern and Dynamo (football), and MotoGP rider Marc Márquez. It shows live status, the next fixture or session, and the latest result; hockey and football views also include available scorers, assists, and penalties.

The detail view archives the ten most recently completed games. When available, historic games retain their goal, assist, and penalty data.

The folder can be served statically. For a complete local installation, `node api-server.js` starts the website and API together on port 5056. The frontend uses this API when available and falls back to direct data requests when served statically.

## Files

- `index.html`, `style.css`, `app.js` — presentation and browser behaviour
- `data.js` — data retrieval and the `TEAMS` configuration containing team, league, and rider identifiers
- `api-server.js` — combined static web server and JSON API

## Start on a Ugreen NAS

Start the project folder with `sh api-start.sh`, or run `node api-server.js` directly. `api-start.bat` is available on Windows.

The default address is **http://NAS-IP:5056/**. The website is served at `/` and the API at `/api/v1/`. To use `https://tyskman11.duckdns.org/liveticker/`, the upstream web server must proxy `/liveticker/` to this service. The service accepts requests both with and without the `/liveticker/` prefix, so it works with either proxy configuration.

Available API endpoints include `/api/v1/ticker`, `/api/v1/teams`, `/api/v1/teams/{id}`, `/api/v1/live`, `/api/v1/next`, and `/api/v1/health`.

In the browser, `window.Liveticker.buildAll()` refreshes the complete view. Browser errors are kept in local storage and can be reviewed through `window.LivetickerLog.entries()` or cleared through `window.LivetickerLog.clear()`. The server writes structured JSON logs to `logs/liveticker-api.log`.

## Testing and deployment

Open `http://localhost:5056/` locally, or `http://NAS-IP:5056/` on the NAS. The first API request can take a few seconds while remote sports data is fetched. In static mode, NHL, DEL2, and MotoGP requests still require the configured reverse proxies.

Source-file changes are reflected immediately; clear the browser cache if needed. When modifying proxy sources in `gate/native-server.js`, reload the native gate on the NAS with `sh start-websites.sh`. Reloading the webpage alone is not sufficient.
