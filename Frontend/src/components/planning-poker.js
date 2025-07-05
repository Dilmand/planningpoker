class PlanningPoker extends HTMLElement {
  constructor() {
    super();
    this.loadedStyles = new Set();
    this.attachShadow({ mode: "open" });

    // Bind methods
    this.handleNotification       = this.handleNotification.bind(this);
    this.showToast                = this.showToast.bind(this);
    this.loadTemplate             = this.loadTemplate.bind(this);
    this.renderPage               = this.renderPage.bind(this);
    this._setupHomePageListeners  = this._setupHomePageListeners.bind(this);
    this._handleJoinRoom          = this._handleJoinRoom.bind(this);
    this._handleCreateRoom        = this._handleCreateRoom.bind(this);
    this._setupWebSocketListeners = this._setupWebSocketListeners.bind(this);
    this._handleSuccessMessage    = this._handleSuccessMessage.bind(this);
    this._renderJoinerRoom        = this._renderJoinerRoom.bind(this);
    this._renderAdminRoom         = this._renderAdminRoom.bind(this);

    // initial loading indicator
    this.shadowRoot.innerHTML = '<div>Loading...</div>';
  }

  async connectedCallback() {
    const wsURL = this.getAttribute("ws-url");
    try {
      await this.renderPage('home');
      this._setupHomePageListeners(wsURL);
    } catch (err) {
      console.error("Error rendering home page:", err);
      this.shadowRoot.innerHTML = "<div>Error loading application</div>";
    }
  }

  /** 
   * Centralized: fetch template, render, load main + template CSS 
   */
  async renderPage(templateName, data = {}) {
    const html = await this.loadTemplate(templateName);
    this.shadowRoot.innerHTML = this.renderTemplate(html, data);
    await this.loadMainStyles();
    await this.loadTemplateStyles(templateName);
  }

  async loadMainStyles() {

    try {
      const resp = await fetch('components/styles/mainStyle.css');
      if (!resp.ok) throw new Error(resp.statusText);
      const css = await resp.text();
      const style = document.createElement('style');
      style.setAttribute('data-template', 'main');
      style.textContent = css;
      this.shadowRoot.appendChild(style);
      this.loadedStyles.add('main');
    } catch (e) {
      console.error("Could not load main styles:", e);
    }
  }

  async loadTemplateStyles(templateName) {
    try {
      const resp = await fetch(`components/styles/${templateName}.css`);
      if (!resp.ok) throw new Error(resp.statusText);
      const css = await resp.text();
      const style = document.createElement('style');
      style.setAttribute('data-template', templateName);
      style.textContent = css;
      this.shadowRoot.appendChild(style);
      this.loadedStyles.add(templateName);
    } catch {
      console.log(`No specific styles for template "${templateName}"`);
    }
  }

  async loadTemplate(name) {
    const resp = await fetch(`components/templates/${name}.html`);
    if (!resp.ok) {
      throw new Error(`Failed to load template "${name}": ${resp.status} ${resp.statusText}`);
    }
    return resp.text();
  }

  renderTemplate(tpl, data) {
    return tpl.replace(/\{\{(\w+)\}\}/g, (_, key) =>
      data[key] !== undefined ? data[key] : ''
    );
  }

  // --- Home page setup ---
  _setupHomePageListeners(wsURL) {
    this.shadowRoot.getElementById("joinRoomButton")
      .addEventListener("click", () => this._handleJoinRoom(wsURL));
    this.shadowRoot.getElementById("createRoomButton")
      .addEventListener("click", () => this._handleCreateRoom(wsURL));
  }

  async _handleJoinRoom(wsURL) {
    const roomId   = this.shadowRoot.getElementById("roomCode").value;
    const userName = this.shadowRoot.getElementById("joinerName").value;
    if (!roomId || !userName) {
      this.showToast("Please enter a room code and your name.");
      return;
    }
    this.showToast("Joining room...");
    const ws = new WebSocket(wsURL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "joiner",
        payload: { action: "joinRoom", roomId, userName }
      }));
    };
    this._setupWebSocketListeners(ws, 'joiner');
  }

  async _handleCreateRoom(wsURL) {
    const roomName = this.shadowRoot.getElementById("roomName").value;
    const userName = this.shadowRoot.getElementById("facilitatorName").value;
    if (!roomName || !userName) {
      this.showToast("Please enter a room name and your name.");
      return;
    }
    this.showToast("Creating room...");
    const ws = new WebSocket(wsURL);
    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: "admin",
        payload: { action: "createRoom", roomName, userName }
      }));
    };
    this._setupWebSocketListeners(ws, 'admin');
  }

  // --- WebSocket listeners ---
  _setupWebSocketListeners(ws, role) {
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "error") {
        const msg = typeof data.payload === 'string'
                  ? data.payload
                  : 'An error occurred';
        this.showToast(`Error: ${msg}`);
        console.error("Error payload:", data.payload);
      } else if (data.type === "notification") {
        this.handleNotification(data.payload, ws);
      } else if (data.type === "success") {
        this._handleSuccessMessage(data.payload, ws, role);
      } else {
        console.log("Unknown WS message type:", data.type);
      }
    };
    ws.onclose = () => {
      this.showToast("Disconnected from room.");
    };
    ws.onerror = (e) => {
      console.error("WebSocket error:", e);
      this.showToast("WebSocket connection error.");
    };
  }

  async _handleSuccessMessage(payload, ws, role) {
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
        this.showToast("Cards revealed!");
        break;
      case "leaveRoom":
        this.showToast("You left the room.");
        ws.close();
        window.location.reload();
        break;
      default:
        console.log("Unknown success action:", payload.action);
    }
  }

  // --- Joiner view ---
  async _renderJoinerRoom(payload, ws) {
    await this.renderPage('joiner-room', {
      roomId:   payload.roomId,
      roomName: payload.roomName || ''
    });

    // populate players
    const playersSection = this.shadowRoot.getElementById('playersSection');
    if (playersSection && payload.players) {
      playersSection.innerHTML = '';
      payload.players.forEach((player, i) => {
        const div = document.createElement('div');
        div.className = 'player';
        div.dataset.value = player.value || '?';
        if (player.isOwn) div.dataset.own = 'true';

        const img = document.createElement('img');
        img.src = `avatare/avatar_${i+1}.jpeg`;
        img.alt = player.userName;
        div.appendChild(img);

        const span = document.createElement('span');
        span.textContent = player.userName;
        div.appendChild(span);

        playersSection.appendChild(div);
      });
    }

    // card selection
    this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.card-select button')
          .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const voteValue = btn.dataset.value;
        const own = this.shadowRoot.querySelector('.player[data-own="true"]');
        if (own) own.dataset.value = voteValue;
        ws.send(JSON.stringify({
          type:    "joiner",
          payload: { action: "vote", roomId: payload.roomId, voteValue, storyId: "current" }
        }));
      });
    });

    this.shadowRoot.getElementById('leaveRoomButton')
      .addEventListener('click', () => {
        ws.send(JSON.stringify({
          type:    "joiner",
          payload: { action: "leaveRoom", roomId: payload.roomId }
        }));
      });
  }

  // --- Admin view ---
  async _renderAdminRoom(payload, ws) {
    await this.renderPage('admin-room', {
      roomId:   payload.roomId,
      roomName: payload.roomName
    });

    // populate players
    const playersSection = this.shadowRoot.getElementById('playersSection');
    if (playersSection && payload.players) {
      playersSection.innerHTML = '';
      payload.players.forEach((player, i) => {
        const div = document.createElement('div');
        div.className = 'player';
        div.dataset.value = player.value || '?';
        if (player.isOwn) div.dataset.own = 'true';

        const img = document.createElement('img');
        img.src = `avatare/avatar_${i+1}.jpeg`;
        img.alt = player.userName;
        div.appendChild(img);

        const span = document.createElement('span');
        span.textContent = player.userName;
        div.appendChild(span);

        playersSection.appendChild(div);
      });
    }

    // voting buttons
    this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.card-select button')
          .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        const voteValue = btn.dataset.value;
        const own = this.shadowRoot.querySelector('.player[data-own="true"]');
        if (own) own.dataset.value = voteValue;
        ws.send(JSON.stringify({
          type:    "admin",
          payload: { action: "vote", roomId: payload.roomId, voteValue, storyId: "current" }
        }));
      });
    });

    // reveal cards
    this.shadowRoot.getElementById('revealCardsButton')
      .addEventListener('click', () => {
        ws.send(JSON.stringify({
          type:    "admin",
          payload: { action: "revealCards", roomId: payload.roomId, storyId: "current" }
        }));
        const players = this.shadowRoot.querySelectorAll('.player');
        const values = [];
        players.forEach(p => {
          const v = p.dataset.value;
          const num = parseInt(v);
          // remove avatar
          const img = p.querySelector('img');
          if (img) img.remove();
          // show card value
          const card = document.createElement('div');
          card.className = 'card-value';
          card.innerText = isNaN(num) ? '?' : v;
          p.insertBefore(card, p.querySelector('span'));
          if (!isNaN(num)) values.push(num);
        });
        const avg = values.length
                  ? (values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)
                  : '?';
        const avgDisplay = this.shadowRoot.querySelector('.average-display');
        if (avgDisplay) avgDisplay.textContent = avg;
      });

    // reset
    this.shadowRoot.querySelector('.reset')
      .addEventListener('click', () => {
        this._renderAdminRoom(payload, ws);
      });

    // leave
    this.shadowRoot.getElementById('leaveAdminRoomButton')
      .addEventListener('click', () => {
        ws.send(JSON.stringify({
          type:    "admin",
          payload: { action: "leaveRoom", roomId: payload.roomId }
        }));
      });

    // manage participants
    const participantsList = this.shadowRoot.getElementById('participantsList');
    if (participantsList && payload.participants) {
      participantsList.innerHTML = '';
      payload.participants.forEach(part => {
        const li = document.createElement('li');
        li.dataset.userId = part.userId;
        li.textContent = part.userName + ' ';
        const status = document.createElement('span');
        status.textContent = part.blocked ? '🚫' : '✅';
        li.appendChild(status);

        const sel = document.createElement('select');
        sel.innerHTML = `
          <option>Aktion wählen</option>
          <option>User blockieren</option>
          <option>User entblockieren</option>
        `;
        sel.addEventListener('change', () => {
          if (sel.value === 'User blockieren') {
            status.textContent = '🚫';
            ws.send(JSON.stringify({
              type:    "admin",
              payload: { action: "blockUser", roomId: payload.roomId, targetClientId: part.userId }
            }));
          } else if (sel.value === 'User entblockieren') {
            status.textContent = '✅';
            ws.send(JSON.stringify({
              type:    "admin",
              payload: { action: "unblockUser", roomId: payload.roomId, targetClientId: part.userId }
            }));
          }
          sel.value = 'Aktion wählen';
        });
        li.appendChild(sel);
        participantsList.appendChild(li);
      });
    }
  }

  // --- Notifications & toasts ---
  handleNotification(payload) {
    switch (payload.action) {
      case 'userJoined':
        this.showToast(`${payload.userName} joined the room`);
        {
          const ul = this.shadowRoot.getElementById('participantsList');
          if (ul) {
            const li = document.createElement('li');
            li.dataset.userId = payload.userId;
            li.textContent   = payload.userName;
            ul.appendChild(li);
          }
        }
        break;
      case 'userLeft':
        this.showToast(`${payload.userName} left the room`);
        {
          const el = this.shadowRoot.querySelector(`li[data-user-id="${payload.userId}"]`);
          if (el) el.remove();
        }
        break;
      default:
        console.log('Unknown notification:', payload);
    }
  }

  showToast(message) {
    let toast = this.shadowRoot.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
      `;
      this.shadowRoot.appendChild(toast);
    }
    toast.textContent = message;
    toast.style.opacity = '1';
    setTimeout(() => { toast.style.opacity = '0'; }, 3000);
  }
}

customElements.define("planning-poker", PlanningPoker);
