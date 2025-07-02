class PlanningPoker extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });

    // Bind methods to this
    this.handleNotification = this.handleNotification.bind(this);
    this.showToast = this.showToast.bind(this);
    this.loadTemplate = this.loadTemplate.bind(this);
    this.renderTemplate = this.renderTemplate.bind(this);
    this.loadStyles = this.loadStyles.bind(this);

    // Initial loading indicator
    shadow.innerHTML = '<div>Loading...</div>';

    this.loadStyles();

    // Load the initial template
    this.loadTemplate('home').then(template => {
      this.shadowRoot.innerHTML = template;
    }).catch(err => {
      console.error("Error loading template:", err);
      this.shadowRoot.innerHTML = "<div>Error loading application</div>";
    });
  }

  async loadStyles() {
    try {
      const response = await fetch('components/planning-poker.css');
      const css = await response.text();
      const style = document.createElement('style');
      style.textContent = css;
      this.shadowRoot.appendChild(style);
    } catch (e) {
      console.error("CSS konnte nicht geladen werden:", e);
    }
  }

  // Load an HTML template from the templates directory
  async loadTemplate(templateName) {
    try {
      const response = await fetch(`components/templates/${templateName}.html`);
      if (!response.ok) {
        throw new Error(`Failed to load template: ${response.status} ${response.statusText}`);
      }
      return await response.text();
    } catch (error) {
      console.error(`Error loading template ${templateName}:`, error);
      throw error;
    }
  }

  // Render a template with data
  renderTemplate(template, data = {}) {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] !== undefined ? data[key] : '';
    });
  }

  handleNotification(payload, ws) {
    console.log('Notification received:', payload);

    switch (payload.action) {
      case 'userJoined':
        // Display a toast or some notification that a user joined
        this.showToast(`${payload.userName} joined the room`);

        // If this is an admin view, update the participants list
        const participantsList = this.shadowRoot.getElementById('participantsList');
        if (participantsList) {
          const listItem = document.createElement('li');
          listItem.setAttribute('data-user-id', payload.userId);
          listItem.textContent = payload.userName;
          participantsList.appendChild(listItem);
        }
        break;

      case 'userLeft':
        this.showToast(`${payload.userName} left the room`);

        // Remove from participants list if it exists
        const departedUserElement = this.shadowRoot.querySelector(`li[data-user-id="${payload.userId}"]`);
        if (departedUserElement) {
          departedUserElement.remove();
        }
        break;

      default:
        console.log('Unknown notification action:', payload.action);
    }
  }

  showToast(message) {
    // Create toast if it doesn't exist
    let toast = this.shadowRoot.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: rgba(0,0,0,0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      this.shadowRoot.appendChild(toast);
    }

    // Set message and show toast
    toast.textContent = message;
    toast.style.opacity = '1';

    // Hide after 3 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
    }, 3000);
  }

  async injectStyles() {
    if (!this._styleElement) {
      const response = await fetch('components/planning-poker.css');
      const css = await response.text();
      this._styleElement = document.createElement('style');
      this._styleElement.textContent = css;
    }
    if (this.shadowRoot.firstChild !== this._styleElement) {
      this.shadowRoot.prepend(this._styleElement);
    }
  }

  connectedCallback() {
    const wsURL = this.getAttribute("ws-url");

    this.loadTemplate('home').then(async template => {
      this.shadowRoot.innerHTML = template;
      await this.injectStyles();
      this._setupHomePageListeners(wsURL); // Neue Methode für die Listener
    }).catch(err => {
      console.error("Error loading home template:", err);
      this.shadowRoot.innerHTML = "<div>Error loading application</div>";
      this.injectStyles();
    });
  }

  _setupHomePageListeners(wsURL) {
    this.shadowRoot.getElementById("joinRoomButton").addEventListener("click", () => {
      this._handleJoinRoom(wsURL);
    });

    this.shadowRoot.getElementById("createRoomButton").addEventListener("click", () => {
      this._handleCreateRoom(wsURL);
    });
  }

  async _handleJoinRoom(wsURL) {
    const roomId = this.shadowRoot.getElementById("roomCode").value;
    const userName = this.shadowRoot.getElementById("joinerName").value;

    if (!roomId || !userName) {
      this.showToast("Please enter a room code and your name.");
      return;
    }

    // Show loading indicator
    this.showToast("Joining room...");

    const ws = new WebSocket(wsURL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "joiner",
        payload: { action: "joinRoom", roomId, userName }
      }));
    };
    this._setupWebSocketListeners(ws, 'joiner'); // Allgemeine Listener
  }

  async _handleCreateRoom(wsURL) {
    const roomName = this.shadowRoot.getElementById("roomName").value;
    const userName = this.shadowRoot.getElementById("facilitatorName").value;

    if (!roomName || !userName) {
      this.showToast("Please enter a room name and your name.");
      return;
    }

    // Show loading indicator
    this.showToast("Creating room...");

    const ws = new WebSocket(wsURL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "admin",
        payload: { action: "createRoom", roomName, userName }
      }));
    };
    this._setupWebSocketListeners(ws, 'admin'); // Allgemeine Listener
  }

  _setupWebSocketListeners(ws, role) {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      switch (data.type) {
        case "error":
          this.showToast(`Error: ${typeof data.payload === 'string' ? data.payload : 'An error occurred'}`);
          console.error("Error:", data.payload);
          break;
        case "notification":
          this.handleNotification(data.payload, ws);
          break;
        case "success":
          this._handleSuccessMessage(data.payload, ws, role);
          break;
        default:
          console.log('Unknown message type:', data.type);
      }
    };
    ws.onclose = (event) => {
      console.log("WebSocket connection closed:", event);
      this.showToast("Disconnected from room.");
      // Optionally: Attempt to reconnect or return to home screen
    };
    ws.onerror = (event) => {
      console.error("WebSocket error:", event);
      this.showToast("WebSocket connection error.");
    };
  }

  async _handleSuccessMessage(payload, ws, role) {
    console.log("Success:", payload);
    switch (payload.action) {
      case "joinRoom":
        await this._renderJoinerRoom(payload, ws);
        break;
      case "createRoom":
        await this._renderAdminRoom(payload, ws);
        break;
      case "vote":
        this.showToast(`Vote recorded: ${payload.voteValue}`);
        break;
      case "revealCards":
        this.showToast(`Cards revealed!`);
        break;
      case "leaveRoom":
        this.showToast("You left the room.");
        ws.close();
        window.location.reload();
        break;
      case "removeRoom":
        console.log("Removed client from room:", payload.targetClientId);
        break;
      case "blockUser":
        console.log("Blocked client:", payload.targetClientId);
        break;
      default:
        console.log("Unknown action:", payload.action);
    }
  }

  async _renderJoinerRoom(payload, ws) {
    const template = await this.loadTemplate('joiner-room');
    const renderedTemplate = this.renderTemplate(template, {
      roomId: payload.roomId,
      roomName: payload.roomName || ''
    });
    this.shadowRoot.innerHTML = renderedTemplate;
    await this.injectStyles();

    // Spieler dynamisch rendern (aus Payload, falls vorhanden)
    const playersSection = this.shadowRoot.getElementById('playersSection');
    if (playersSection && payload.players) {
      playersSection.innerHTML = '';
      payload.players.forEach((player, i) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player';
        playerDiv.dataset.value = player.value || '?';
        if (player.isOwn) playerDiv.dataset.own = 'true';
        const img = document.createElement('img');
        img.src = `avatare/avatar_${i + 1}.jpeg`;
        img.alt = player.userName;
        playerDiv.appendChild(img);
        const span = document.createElement('span');
        span.innerText = player.userName;
        playerDiv.appendChild(span);
        playersSection.appendChild(playerDiv);
      });
    }

    // Kartenwahl
    this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.card-select button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // Eigene Karte setzen (Joiner)
        const ownPlayer = this.shadowRoot.querySelector('.player[data-own="true"]');
        if (ownPlayer) {
          ownPlayer.dataset.value = btn.getAttribute('data-value');
        }
        // Vote senden
        const voteValue = btn.getAttribute('data-value');
        ws.send(JSON.stringify({
          type: "joiner",
          payload: { action: "vote", roomId: payload.roomId, voteValue, storyId: "current" }
        }));
      });
    });

    // Leave Room
    this.shadowRoot.getElementById('leaveRoomButton').addEventListener('click', () => {
      ws.send(JSON.stringify({
        type: "joiner",
        payload: { action: "leaveRoom", roomId: payload.roomId }
      }));
    });
  }

  async _renderAdminRoom(payload, ws) {
    const template = await this.loadTemplate('admin-room');
    const renderedTemplate = this.renderTemplate(template, {
      roomId: payload.roomId,
      roomName: payload.roomName
    });
    this.shadowRoot.innerHTML = renderedTemplate;
    await this.injectStyles();

    // Spieler dynamisch rendern (aus Payload, falls vorhanden)
    const playersSection = this.shadowRoot.getElementById('playersSection');
    if (playersSection && payload.players) {
      playersSection.innerHTML = '';
      payload.players.forEach((player, i) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = 'player';
        playerDiv.dataset.value = player.value || '?';
        if (player.isOwn) playerDiv.dataset.own = 'true';
        const img = document.createElement('img');
        img.src = `avatare/avatar_${i + 1}.jpeg`;
        img.alt = player.userName;
        playerDiv.appendChild(img);
        const span = document.createElement('span');
        span.innerText = player.userName;
        playerDiv.appendChild(span);
        playersSection.appendChild(playerDiv);
      });
    }

    // Kartenwahl (nur für Admin selbst)
    this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.card-select button').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        // Eigene Karte setzen (Admin)
        const ownPlayer = this.shadowRoot.querySelector('.player[data-own="true"]');
        if (ownPlayer) {
          ownPlayer.dataset.value = btn.getAttribute('data-value');
        }
        // Vote senden
        const voteValue = btn.getAttribute('data-value');
        ws.send(JSON.stringify({
          type: "admin",
          payload: { action: "vote", roomId: payload.roomId, voteValue, storyId: "current" }
        }));
      });
    });

    // Reveal Cards
    this.shadowRoot.getElementById('revealCardsButton').addEventListener('click', () => {
      ws.send(JSON.stringify({
        type: "admin",
        payload: { action: "revealCards", roomId: payload.roomId, storyId: "current" }
      }));
      // Kartenwerte anzeigen und Durchschnitt berechnen
      const players = this.shadowRoot.querySelectorAll('.player');
      const values = [];
      players.forEach((player, index) => {
        const value = player.dataset.value || '?';
        const num = parseInt(value);
        // Avatar entfernen
        const img = player.querySelector('img');
        if (img) img.remove();
        // Alte Karte entfernen
        const oldCard = player.querySelector('.card-value');
        if (oldCard) oldCard.remove();
        // Neue Karte anzeigen
        const card = document.createElement('div');
        card.className = 'card-value';
        card.innerText = value !== '?' ? value : '?';
        player.insertBefore(card, player.querySelector('span'));
        if (!isNaN(num)) values.push(num);
      });
      // Durchschnitt anzeigen
      const avg = values.length > 0 ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1) : '?';
      const avgDisplay = this.shadowRoot.querySelector('.average-display');
      if (avgDisplay) avgDisplay.innerText = avg;
    });

    // Reset Cards
    this.shadowRoot.querySelector('.reset').addEventListener('click', () => {
      const players = this.shadowRoot.querySelectorAll('.player');
      players.forEach((player, i) => {
        const name = player.querySelector('span')?.innerText || `Spieler ${i + 1}`;
        const imgUrl = `avatare/avatar_${i + 1}.jpeg`;
        // Alte Karte entfernen
        const card = player.querySelector('.card-value');
        if (card) card.remove();
        // Avatar wieder einfügen, wenn nicht vorhanden
        if (!player.querySelector('img')) {
          const img = document.createElement('img');
          img.src = imgUrl;
          player.insertBefore(img, player.querySelector('span'));
        }
        player.dataset.value = '?';
      });
      // Auswahl entfernen
      this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => btn.classList.remove('selected'));
      // Durchschnitt zurücksetzen
      const avgDisplay = this.shadowRoot.querySelector('.average-display');
      if (avgDisplay) avgDisplay.innerText = '?';
    });

    // Leave Room
    this.shadowRoot.getElementById('leaveAdminRoomButton').addEventListener('click', () => {
      ws.send(JSON.stringify({
        type: "admin",
        payload: { action: "leaveRoom", roomId: payload.roomId }
      }));
    });

    // Teilnehmerliste (Status/Block-Logik)
    const participantsList = this.shadowRoot.getElementById('participantsList');
    if (participantsList && payload.participants) {
      participantsList.innerHTML = '';
      payload.participants.forEach(participant => {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-user-id', participant.userId);
        listItem.textContent = participant.userName + ' ';
        // Statusanzeige
        const status = document.createElement('span');
        status.textContent = participant.blocked ? '🚫' : '✅';
        listItem.appendChild(status);
        // Dropdown für Aktionen
        const select = document.createElement('select');
        select.innerHTML = `
          <option>Aktion wählen</option>
          <option>User blockieren</option>
          <option>User entblockieren</option>
        `;
        select.addEventListener('change', () => {
          if (select.value === 'User blockieren') {
            status.textContent = '🚫';
            ws.send(JSON.stringify({
              type: 'admin',
              payload: { action: 'blockUser', roomId: payload.roomId, targetClientId: participant.userId }
            }));
          } else if (select.value === 'User entblockieren') {
            status.textContent = '✅';
            ws.send(JSON.stringify({
              type: 'admin',
              payload: { action: 'unblockUser', roomId: payload.roomId, targetClientId: participant.userId }
            }));
          }
          select.value = 'Aktion wählen';
        });
        listItem.appendChild(select);
        participantsList.appendChild(listItem);
      });
    }
  }
}
customElements.define("planning-poker", PlanningPoker);
