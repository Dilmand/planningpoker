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
      const cssUrl = new URL('./planning-poker.css', import.meta.url).toString();
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = cssUrl;
      this.shadowRoot.appendChild(link);
    } catch (e) {
      // Fallback für den Fall, dass import.meta nicht verfügbar ist
      console.log("Using fallback CSS loading method");
      this.loadStylesFallback();
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

  connectedCallback() {
    const wsURL = this.getAttribute("ws-url");

    this.loadTemplate('home').then(template => {
      this.shadowRoot.innerHTML = template;
      this._setupHomePageListeners(wsURL); // Neue Methode für die Listener
    }).catch(err => {
      console.error("Error loading home template:", err);
      this.shadowRoot.innerHTML = "<div>Error loading application</div>";
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

    this.shadowRoot.querySelectorAll('.card').forEach(card => {
      card.addEventListener('click', () => {
        const voteValue = card.getAttribute('data-value');
        ws.send(JSON.stringify({
          type: "joiner",
          payload: { action: "vote", roomId: payload.roomId, voteValue, storyId: "current" }
        }));
      });
    });

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
    
    // Wenn es eine Teilnehmerliste in der Payload gibt, fügen wir sie hinzu
    const participantsList = this.shadowRoot.getElementById('participantsList');
    if (participantsList && payload.participants) {
      // Teilnehmerliste mit vorhandenen Teilnehmern füllen
      payload.participants.forEach(participant => {
        const listItem = document.createElement('li');
        listItem.setAttribute('data-user-id', participant.userId);
        listItem.textContent = participant.userName;
        participantsList.appendChild(listItem);
      });
    }

    this.shadowRoot.getElementById('revealCardsButton').addEventListener('click', () => {
      ws.send(JSON.stringify({
        type: "admin",
        payload: { action: "revealCards", roomId: payload.roomId, storyId: "current" }
      }));
    });

    this.shadowRoot.getElementById('leaveAdminRoomButton').addEventListener('click', () => {
      ws.send(JSON.stringify({
        type: "admin",
        payload: { action: "leaveRoom", roomId: payload.roomId }
      }));
    });
  }
}
customElements.define("planning-poker", PlanningPoker);
