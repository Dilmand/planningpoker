# Planning Poker Komponente

Eine moderne, webbasierte Planning Poker Anwendung für agile Teams mit Echtzeit-Abstimmung, Story-Management, Multi-User-Support und Docker-Deployment.

## Features

- Echtzeit-Abstimmung via WebSockets
- Multi-User Planning Poker Sessions
- Story-Management mit Titel und Beschreibung
- Admin-Panel zur Benutzer- und Raumverwaltung
- IP-basierte Benutzerblockierung
- Responsive Web Components Design
- Fibonacci-Kartenset (0, 1, 2, 3, 5, 8, 13)
- Automatische Durchschnittsberechnung
- Docker-Container für einfaches Deployment

---

## Voraussetzungen

- **Node.js** ab Version 16.0.0
- **npm** ab Version 8.0.0
- **TypeScript** ab Version 5.1.0
- **Docker** ab Version 20.10.0 (für Container-Deployment)
- **Git** für die Versionsverwaltung

---

## Quick Start

Die Funktionalitäten können, sofern eine Verbindung zum Server der DHBW mittels Cisco-VPN besteht, [hier](http://141.72.13.151:8699/) getestet werden.
Um die Komponente selbst zu integrieren:

### 1. Bereitstellen des Backends

#### 1. Clone Repository
```bash
git clone https://github.com/dilmand/planningpoker.git
cd planningpoker/server
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Build & Start

**Development:**
```bash
npm run dev
```

**Production:**
```bash
npm run build
npm start
```

#### 4. Build Container
```bash
# Build Container
docker build -t planning-poker-app .      
```

#### 5. Container auf dem Server starten
```bash
# Run Container
docker run -d -p 8699:8699 planning-poker-app 
```
*_NOTE:_* Die Docker-Befehle dienen als Beispiel und können natürlich angepasst werden.

### 2. Einbinden der Komponente in eigener Seite

#### 1. Module importieren

```html
<!-- Planning Poker Komponente einbinden -->
<script type="module" src="http://<SERVER_HOST>:8699/components/planning-poker.js"></script>
<script type="module" src="http://<SERVER_HOST>:8699/components/websocket-manager.js"></script>
<script type="module" src="http://<SERVER_HOST>:8699/components/message-handler.js"></script>
```
*_NOTE:_* Ersetze <SERVER_HOST> durch die IP-Adresse deines Serversx

#### 2. Komponente im Body platzieren

```html
<planning-poker server-url="ws://<SERVER_HOST>:8699">
  <div slot="header-content">
    <img src="https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/1f0cf.svg" alt="Planning Poker Icon" class="header-poker-icon" />
    <h1>DHBW Planning Poker</h1>
  </div>
</planning-poker>
```
*_NOTE:_* Ersetze <SERVER_HOST> durch die IP-Adresse deines Servers. Mittels Slot kann die Header-Zeile angepasst werden

#### 3. Komponente anzeigen (z.B. mittels Button)

```html
<button id="open-planning-btn">Planning Poker starten</button>
<script>
  document.getElementById("open-planning-btn").onclick = () => {
    const planningPoker = document.querySelector("planning-poker");
    planningPoker.style.display = "block";
    planningPoker.connect(); // WebSocket-Verbindung aufbauen
  };
</script>
```
*_NOTE:_* Ein Slot für den Trigger-Button ist nicht umgesetzt worden, da der Öffnen-Button flexibel an verschiedenen Stellen der Webseite platziert werden kann und nicht zur Komponente selbst gehört.


## Benutzeranleitung

### Erste Schritte

#### 1. Raum erstellen (als Moderator/Admin)
1. Klicken Sie auf **"Create New Room"**
2. Geben Sie einen **Raumnamen** ein (z.B. "Sprint 15 Planning")  
3. Geben Sie Ihren **Namen** ein
4. Klicken Sie auf **"Create Room"**
5. Sie erhalten einen 6-stelligen Raumcode zum Teilen

#### 2. Raum beitreten (als Teilnehmer)
1. Klicken Sie auf **"Join a Room"**
2. Geben Sie den **6-stelligen Raumcode** ein
3. Geben Sie Ihren **Namen** ein  
4. Klicken Sie auf **"Join Room"**

### Funktionen für alle Teilnehmer

#### Abstimmen
- Wählen Sie eine Karte aus den Fibonacci-Werten (0, 1, 2, 3, 5, 8, 13)
- Ihre Stimme wird in Echtzeit übertragen
- Karten bleiben verdeckt bis zur Aufdeckung durch den Admin

#### Story-Ansicht
- Aktueller Story-Titel und Beschreibung werden oben angezeigt
- Alle Teilnehmer sehen dieselbe Story synchron

#### Teilnehmer-Übersicht
- Avatare aller Teammitglieder im Kreis angeordnet
- Abstimmungsstatus wird durch Farben angezeigt:
  - **Grün**: Hat bereits abgestimmt
  - **Gelb**: Abstimmung steht noch aus
  - **Rot**: Blockiert (nur für Admins sichtbar)

### Zusätzliche Admin-Funktionen

#### Karten-Management
- **"Reveal cards"**: Alle Stimmen gleichzeitig aufdecken
- **"Reset cards"**: Neue Abstimmungsrunde starten
- Automatische Durchschnittsberechnung nach Aufdeckung

#### Story-Management
- Story-Dropdown zur Auswahl verschiedener Stories
- Titel und Beschreibung werden für alle Teilnehmer aktualisiert
- Wechsel zwischen Stories in Echtzeit

#### Teilnehmer-Verwaltung
- Vollständige Teilnehmerliste in der Seitenleiste
- **Benutzer blockieren**: Störende Teilnehmer aus dem Raum entfernen
- **Benutzer freigeben**: Blockierung wieder aufheben
- IP-basierte Blockierung verhindert erneuten Beitritt

### Interface-Übersicht

#### Hauptbereich
- **Story-Titel und -Beschreibung** (oberer Bereich)
- **Durchschnittsanzeige** (nach Kartenaufdeckung)
- **Teilnehmer-Avatare** (kreisförmige Anordnung)
- **Karten-Auswahl** (unterer Bereich)

#### Admin-Seitenleiste
- **Teilnehmerliste** mit Verwaltungsoptionen
- **Story-Auswahl** Dropdown-Menü
- **Story-Details** mit editierbaren Feldern
- **Admin-Kontrollen** (Reveal/Reset Buttons)

---

## Erweiterte Konfiguration

### Custom Events
Die Komponente emittiert Events für externe Integration:

```javascript
// Event Listener hinzufügen
document.querySelector('planning-poker').addEventListener('room-created', (event) => {
  console.log('Raum erstellt:', event.detail.roomCode);
});

document.querySelector('planning-poker').addEventListener('vote-cast', (event) => {
  console.log('Stimme abgegeben:', event.detail.voteValue);
});

document.querySelector('planning-poker').addEventListener('cards-revealed', (event) => {
  console.log('Karten aufgedeckt:', event.detail.average);
});
```

### Attribute-Konfiguration

```html
<planning-poker 
  server-url="ws://localhost:8699"
  auto-connect="true"
  theme="light"
  max-reconnect-attempts="5">
</planning-poker>
```

### Responsive Design
- **Desktop**: Vollständige Seitenleiste und alle Features
- **Tablet**: Ausklappbare Seitenleiste über Toggle-Button  
- **Mobile**: Kompakte Ansicht mit angepasstem Layout
