# Planning Poker - Entwicklerdokumentation

## Projektübersicht

Unser Planning Poker Projekt ist eine WebSocket-basierte Anwendung für agile Teams zur kollaborativen Schätzung von User Stories. Das Projekt verwendet eine Architektur mit TypeScript im Backend und Web Components im Frontend.

## Architektur

### Backend-Architektur

#### Handler-Pattern
Die Anwendung verwendet ein Handler-Pattern mit Vererbung:

```
BaseHandler (abstract)
├── AdminHandler
└── JoinerHandler
```

- **[`BaseHandler`](server/src/handler/baseHandler.ts)**: Abstrakte Basisklasse mit gemeinsamer Funktionalität
- **[`AdminHandler`](server/src/handler/adminHandler.ts)**: Verwaltet Administrator-spezifische Aktionen (Raum erstellen, Benutzer blockieren, Karten aufdecken)
- **[`JoinerHandler`](server/src/handler/joinerHandler.ts)**: Verwaltet Teilnehmer-spezifische Aktionen (Raum beitreten, abstimmen)

#### Core-Module

- **[`WebSocketServer`](server/src/core/webSocketServer.ts)**: Verwaltet WebSocket-Verbindungen und Express-Server
- **[`WebSocketClient`](server/src/core/webSocketClient.ts)**: Wrapper für einzelne WebSocket-Verbindungen
- **[`RoomManager`](server/src/core/roomManager.ts)**: Zentrale Raumverwaltung, Story-Management und Benutzerblockierung

#### Datenstrukturen

```typescript
interface Room {
    id: string;
    adminIP: string;
    roomName: string;
    clients: Set<string>; // IP-Adressen
    stories: Map<string, Story>;
    currentStoryId?: string;
    blockedIPs: Set<string>;
}

interface Story {
    id: string;
    title?: string;
    description?: string;
    votes: Map<string, Number>; // IP -> Vote
    revealed: boolean;
}
```

### Frontend-Architektur

#### Web Components
Das Frontend basiert auf nativen Web Components:

- **[`PlanningPoker`](server/public/components/planning-poker.js)**: Haupt-Component
- **[`WebSocketManager`](server/public/components/websocket-manager.js)**: WebSocket-Kommunikation
- **[`MessageHandler`](server/public/components/message-handler.js)**: Nachrichtenverarbeitung

#### Template-System
- **[`home.html`](server/public/components/templates/home.html)**: Landing Page Template
- **[`room.html`](server/public/components/templates/room.html)**: Hauptanwendung Template

## Installation & Setup

### Voraussetzungen
- Node.js >= 16
- TypeScript
- npm/yarn

### Installation

```bash
cd server
npm install
```

### Entwicklung

```bash
# Development Server starten
npm run dev

# Build
npm run build

# Production
npm start

# Tests
npm test
```

## WebSocket-Kommunikation

### Nachrichtenformat

```typescript
// Client -> Server
{
    type: "admin" | "joiner",
    payload: {
        action: string,
        // weitere action-spezifische Daten
    }
}

// Server -> Client
{
    type: "notification" | "error",
    payload: any
}
```

### Client-Rollen

#### Admin-Aktionen
- `createRoom`: Neuen Raum erstellen
- `removeRoom`: Raum löschen
- `blockUser`: Benutzer blockieren
- `unblockUser`: Benutzer freigeben
- `revealCards`: Karten aufdecken
- `changeCurrentStory`: Aktuelle Story wechseln

#### Joiner-Aktionen
- `joinRoom`: Raum beitreten
- `vote`: Abstimmen
- `leaveRoom`: Raum verlassen

### Notification-Types
- `userJoined`: Benutzer ist beigetreten
- `userLeft`: Benutzer hat verlassen
- `cardsRevealed`: Karten wurden aufgedeckt
- `userBlocked`: Benutzer wurde blockiert
- `storyChanged`: Story wurde gewechselt

## Benutzerblockierung

Die Blockierung erfolgt über IP-Adressen:

```typescript
// Blockierung im RoomManager
public blockClient(clientIP: string): void {
    this.rooms.forEach((room, roomId) => {
        if (room.clients.has(clientIP)) {
            this.leaveRoom(roomId, clientIP);
        }
    });
}
```

Blockierte IPs werden pro Raum in `room.blockedIPs` gespeichert.

## Frontend-Rendering

### Template-System

```javascript
// Template laden und rendern
async renderPage(templateName, data = {}) {
    const html = await this.loadTemplate(templateName);
    this.shadowRoot.innerHTML = this.renderTemplate(html, data);
    await this.loadMainStyles();
    await this.loadTemplateStyles(templateName);
}
```

### Admin vs. Joiner Views

```javascript
// Admin-spezifische Elemente für Joiner entfernen
if (data.isAdmin === false) {
    this.shadowRoot.querySelectorAll('.admin-only').forEach(el => {
        el.remove();
    });
}
```

## Story-Management

Stories werden im [`RoomManager`](server/src/core/roomManager.ts) verwaltet:

```typescript
// Story erstellen
public createStory(roomId: string, storyId: string, title?: string, description?: string): boolean

// Aktuelle Story setzen
public setCurrentStory(roomId: string, storyId: string): boolean

// Vote aufzeichnen
public recordVote(roomId: string, storyId: string, clientIP: string, voteValue: string): boolean
```

## Broadcasts

Änderungen werden über Broadcasts an alle Clients gesendet:

```typescript
protected async broadcastNotification(
    roomId: string,
    action: string,
    notificationData: any,
    excludeClientId?: string
): Promise<void>
```

## Deployment

### Docker
Das Projekt enthält ein [`Dockerfile`](server/Dockerfile) für Container-Deployment:

```bash
docker build -t planning-poker .
docker run -p 8699:8699 planning-poker
```

### GitHub Actions
Automatisches Build und Deployment über [`.github/workflows/build-and-deploy.yaml`](.github/workflows/build-and-deploy.yaml)

## Ordnerstruktur

```
server/
├── src/
│   ├── server.ts              # Entry Point
│   ├── core/                  # Core-Module
│   │   ├── roomManager.ts
│   │   ├── webSocketServer.ts
│   │   └── webSocketClient.ts
│   ├── handler/               # Request Handler
│   │   ├── baseHandler.ts
│   │   ├── adminHandler.ts
│   │   └── joinerHandler.ts
│   └── tests/                 # Tests
├── public/                    # Frontend Assets
│   ├── index.html
│   ├── components/            # Web Components
│   │   ├── planning-poker.js
│   │   ├── websocket-manager.js
│   │   ├── message-handler.js
│   │   ├── templates/         # HTML Templates
│   │   └── styles/            # CSS Dateien
│   └── avatare/              # Avatar Bilder
├── package.json
├── tsconfig.json
└── Dockerfile
```

## Debugging

### Logging
WebSocket-Nachrichten werden ausführlich geloggt:

```javascript
console.log('WebSocket message received:', data);
```

### Browser DevTools
- WebSocket-Verbindungen in Network Tab überwachen
- Shadow DOM in Elements Tab inspizieren
- Console für Client-Side Fehler

## Erweiterungen

### Neue Handler-Aktionen hinzufügen

1. Action zu Interface hinzufügen ([`adminHandler.ts`](server/src/handler/adminHandler.ts))
2. Handler-Methode implementieren
3. Frontend WebSocketManager erweitern
4. UI-Elemente hinzufügen

### Neue Template-Seiten

1. HTML-Template in [`templates/`](server/public/components/templates/) erstellen
2. CSS in [`styles/`](server/public/components/styles/) hinzufügen
3. Rendering-Logik in [`planning-poker.js`](server/public/components/planning-poker.js) implementieren

## Performance-Optimierungen

- Lazy Loading von Templates und Styles
- WebSocket-Reconnection Logic
- Effiziente DOM-Updates durch gezielte Selektoren
- Avatar-Bilder werden gecacht