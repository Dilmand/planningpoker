# Planning Poker - Integrated Backend & Frontend

## Überblick

Das Planning Poker Projekt wurde zu einer **Single-Server-Architektur** umgestaltet. Der Backend-Server (Express.js) stellt jetzt sowohl die WebSocket-API als auch das Frontend bereit.

## Architektur

- **Backend-Server (Port 8699)**:
  - Express.js HTTP-Server
  - WebSocket-Server für Echtzeit-Kommunikation
  - Statische Frontend-Dateien (CSS, JS, HTML)
  - REST-API Endpunkte
  - SPA (Single Page Application) Support

## Schnellstart

### Entwicklung

```bash
# Backend starten (serviert auch Frontend)
cd Backend
npm install
npm run dev
```

Die Anwendung ist dann verfügbar unter: **http://localhost:8699**

### Produktion mit Docker

```bash
# Nur Backend-Container (enthält Frontend)
docker-compose up --build
```

Die Anwendung ist dann verfügbar unter: **http://localhost:8699**

## Verfügbare Endpunkte

### Frontend
- `GET /` - Haupt-Anwendung (index.html)
- `GET /components/*` - JavaScript-Komponenten
- `GET /avatare/*` - Avatar-Bilder

### API
- `GET /api/health` - Gesundheitsstatus des Servers
- `GET /api/clients` - Liste aller verbundenen WebSocket-Clients

### WebSocket
- `ws://localhost:8699` - WebSocket-Verbindung für Echtzeit-Features

## Vorteile der neuen Architektur

1. **Einfacheres Deployment**: Nur ein Container/Server
2. **Keine CORS-Probleme**: Frontend und Backend auf demselben Origin
3. **Bessere Performance**: Weniger Netzwerk-Hops
4. **Einfachere Entwicklung**: Ein Server für alles
5. **Weniger Ressourcenverbrauch**: Ein Container weniger

## Entwicklung

```bash
# Backend entwickeln
cd Backend
npm run dev  # Startet TypeScript-Compiler im Watch-Mode

# Tests ausführen
npm test
```

## Struktur

```
Backend/
├── public/           # Frontend-Dateien (statisch serviert)
│   ├── index.html   # Haupt-HTML-Datei
│   ├── components/  # JavaScript-Komponenten
│   └── avatare/     # Avatar-Bilder
├── src/
│   ├── server.ts    # Einstiegspunkt
│   └── core/        # WebSocket & Express Server
└── package.json
```

## Migration von der alten Architektur

Die alte Zwei-Server-Architektur (Frontend auf Port 8600, Backend auf Port 8699) wurde zu einer Ein-Server-Architektur (nur Port 8699) migriert:

- ✅ Frontend-Container entfernt
- ✅ nginx-Konfiguration nicht mehr nötig
- ✅ Statische Dateien werden vom Express-Server bereitgestellt
- ✅ WebSocket-URLs automatisch angepasst
- ✅ API-Endpunkte hinzugefügt
