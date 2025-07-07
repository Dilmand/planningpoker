import { MessageHandler } from './message-handler.js';
import { WebSocketManager, CLIENT_ROLES } from './websocket-manager.js';

class PlanningPoker extends HTMLElement {
  constructor() {
    super();
    this.loadedStyles = new Set();
    this.attachShadow({ mode: "open" });

    this.messageHandler = new MessageHandler(this);
    this.wsManager = new WebSocketManager(this, this.messageHandler);

    this.showToast                = this.showToast.bind(this);
    this.loadTemplate             = this.loadTemplate.bind(this);
    this.renderPage               = this.renderPage.bind(this);
    this._setupHomePageListeners  = this._setupHomePageListeners.bind(this);
    this._handleJoinRoom          = this._handleJoinRoom.bind(this);
    this._handleCreateRoom        = this._handleCreateRoom.bind(this);
    this._renderJoinerRoom        = this._renderJoinerRoom.bind(this);
    this._renderAdminRoom         = this._renderAdminRoom.bind(this);
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

  async renderPage(templateName, data = {}) {
    const html = await this.loadTemplate(templateName);
    this.shadowRoot.innerHTML = this.renderTemplate(html, data);
    await this.loadMainStyles();
    await this.loadTemplateStyles(templateName);

    if (data.isAdmin === false) {
      this.shadowRoot.querySelectorAll('.admin-only').forEach(el => {
        el.remove(); // entfernt das ganze Element vollständig aus dem DOM
      });
    }


    const toggleBtn = this.shadowRoot.getElementById('toggleSidebarBtn');
    const sidebar = this.shadowRoot.querySelector('aside.admin-only');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });
    }


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
    
    try {
      await this.wsManager.connect(wsURL, CLIENT_ROLES.JOINER);
      this.wsManager.joinRoom(roomId, userName);
    } catch (error) {
      console.error("Failed to connect or join room:", error);
      this.showToast("Failed to connect to server");
    }
  }

  async _handleCreateRoom(wsURL) {
    const roomName = this.shadowRoot.getElementById("roomName").value;
    const userName = this.shadowRoot.getElementById("facilitatorName").value;
    
    if (!roomName || !userName) {
      this.showToast("Please enter a room name and your name.");
      return;
    }

    this.showToast("Creating room...");
    
    try {
      await this.wsManager.connect(wsURL, CLIENT_ROLES.ADMIN);
      this.wsManager.createRoom(roomName, userName);
    } catch (error) {
      console.error("Failed to connect or create room:", error);
      this.showToast("Failed to connect to server");
    }
  }

  async _renderJoinerRoom(payload) {
    await this.renderPage('room', {
      roomId:   payload.roomId,
      roomName: payload.roomName || '',
      isAdmin: false
    });

    this.wsManager.currentRoom = payload.roomId;

    const playersSection = this.shadowRoot.getElementById('playersSection');
    if (playersSection && payload.participants) {
      playersSection.innerHTML = '';
      payload.participants.forEach((participant, i) => {
        const div = document.createElement('div');
        div.className = 'player';
        div.dataset.value = '?';
        div.dataset.userId = participant.userId;
        if (participant.userName === payload.userName) div.dataset.own = 'true';

        const img = document.createElement('img');
        img.src = `avatare/avatar_${i+1}.jpeg`;
        img.alt = participant.userName;
        div.appendChild(img);

        // Add empty vote card next to avatar
        const voteCard = document.createElement('div');
        voteCard.className = 'vote-card';
        voteCard.style.cssText = `
          width: 30px;
          height: 40px;
          border: 2px solid #ddd;
          border-radius: 5px;
          background: white;
          margin: 0 5px;
          transition: background-color 0.3s ease;
        `;
        div.appendChild(voteCard);

        const span = document.createElement('span');
        span.textContent = participant.userName;
        div.appendChild(span);

        playersSection.appendChild(div);
      });
    }

    this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.card-select button')
          .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        const voteValue = btn.dataset.value;
        const own = this.shadowRoot.querySelector('.player[data-own="true"]');
        if (own) {
          own.dataset.value = voteValue;
          // Update own vote card color
          const ownVoteCard = own.querySelector('.vote-card');
          if (ownVoteCard) {
            ownVoteCard.style.backgroundColor = '#4285f4';
            ownVoteCard.style.borderColor = '#4285f4';
          }
        }
        
        this.wsManager.vote(voteValue);
      });
    });

    this.shadowRoot.getElementById('leaveRoomButton')
      .addEventListener('click', () => {
        this.wsManager.leaveRoom();
      });
  }

  async _renderAdminRoom(payload) {
    await this.renderPage('room', {
      roomId:   payload.roomId,
      roomName: payload.roomName,
      isAdmin: true
    });

    this.wsManager.currentRoom = payload.roomId;

    const playersSection = this.shadowRoot.getElementById('playersSection');
    if (playersSection && payload.participants) {
      playersSection.innerHTML = '';
      payload.participants.forEach((participant, i) => {
        const div = document.createElement('div');
        div.className = 'player';
        div.dataset.value = '?';
        div.dataset.userId = participant.userId;
        if (participant.userName === payload.userName) div.dataset.own = 'true';

        const img = document.createElement('img');
        img.src = `avatare/avatar_${i+1}.jpeg`;
        img.alt = participant.userName;
        div.appendChild(img);

        // Add empty vote card next to avatar
        const voteCard = document.createElement('div');
        voteCard.className = 'vote-card';
        voteCard.style.cssText = `
          width: 30px;
          height: 40px;
          border: 2px solid #ddd;
          border-radius: 5px;
          background: white;
          margin: 0 5px;
          transition: background-color 0.3s ease;
        `;
        div.appendChild(voteCard);

        const span = document.createElement('span');
        span.textContent = participant.userName;
        div.appendChild(span);

        playersSection.appendChild(div);
      });
    }

    this.shadowRoot.querySelectorAll('.card-select button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.shadowRoot.querySelectorAll('.card-select button')
          .forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        
        const voteValue = btn.dataset.value;
        const own = this.shadowRoot.querySelector('.player[data-own="true"]');
        if (own) {
          own.dataset.value = voteValue;
          // Update own vote card color
          const ownVoteCard = own.querySelector('.vote-card');
          if (ownVoteCard) {
            ownVoteCard.style.backgroundColor = '#4285f4';
            ownVoteCard.style.borderColor = '#4285f4';
          }
        }
        
        this.wsManager.vote(voteValue);
      });
    });

    this.shadowRoot.getElementById('revealCardsButton')
      .addEventListener('click', () => {
        this.wsManager.revealCards();
      });

    this.shadowRoot.querySelector('.reset')
      .addEventListener('click', () => {
        this._renderAdminRoom(payload);
      });

    this.shadowRoot.getElementById('leaveAdminRoomButton')
      .addEventListener('click', () => {
        this.wsManager.leaveRoom();
      });

    this._setupParticipantManagement(payload.participants);
  }

  _setupParticipantManagement(participants) {
    const participantsList = this.shadowRoot.getElementById('participantsList');
    if (!participantsList || !participants) return;

    participantsList.innerHTML = '';
    participants.forEach(participant => {
      const li = this._createParticipantElement(participant);
      participantsList.appendChild(li);
    });
  }

  _createParticipantElement(participant) {
    const li = document.createElement('li');
    li.dataset.userId = participant.userId;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'participant-name';
    nameSpan.textContent = participant.userName;

    const status = document.createElement('span');
    status.className = 'participant-status';
    status.textContent = participant.blocked ? '🚫' : '✅';

    const actionSelect = this._createParticipantActionSelect(participant);
    actionSelect.className = 'participant-select';

    li.appendChild(nameSpan);
    li.appendChild(status);
    li.appendChild(actionSelect);

    return li;
  }


  _createParticipantActionSelect(participant) {
    const select = document.createElement('select');
    select.innerHTML = `
      <option>Aktion wählen</option>
      <option value="block">User blockieren</option>
      <option value="unblock">User entblockieren</option>
    `;
    
    select.addEventListener('change', () => {
      const action = select.value;
      const status = select.parentElement.querySelector('span');
      
      if (action === 'block') {
        this.wsManager.blockUser(participant.userId);
      } else if (action === 'unblock') {
        this.wsManager.unblockUser(participant.userId);
      }
      
      select.value = 'Aktion wählen';
    });
    
    return select;
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

  disconnectedCallback() {
    if (this.wsManager) {
      this.wsManager.disconnect();
    }
  }
}

customElements.define("planning-poker", PlanningPoker);
