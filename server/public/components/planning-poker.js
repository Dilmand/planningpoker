import { MessageHandler } from './message-handler.js';
import { WebSocketManager, CLIENT_ROLES } from './websocket-manager.js';

class PlanningPoker extends HTMLElement {
  constructor() {
    super();
    this.loadedStyles = new Set();
    this.attachShadow({ mode: "open" });

    // Parse initial stories from component content
    this.defaultStories = this.parseDefaultStories();

    this.messageHandler = new MessageHandler(this);
    this.wsManager = new WebSocketManager(this, this.messageHandler);
    this.currentStoryId = null;

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

  static get observedAttributes() {
    return ['primary-color'];
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (name === 'primary-color') {
      this.style.setProperty('--primary-color', newValue);
    }
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
      // Send default stories when creating room
      this.wsManager.createRoom(roomName, userName, this.defaultStories);
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

    // Setup story selection for joiners too (read-only)
    this._setupStorySelection(payload.stories || [], false, payload.currentStory);

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
          border: 2px solid var(--primary-color);
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
            ownVoteCard.style.backgroundColor = 'var(--primary-color)';
            ownVoteCard.style.borderColor = 'var(--primary-color)';
          }
        }
        
        this.wsManager.vote(voteValue, this.currentStoryId || 'current');
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

    // Setup story selection
    this._setupStorySelection(payload.stories || [], true, payload.currentStory);

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
          border: 2px solid var(--primary-color);
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
            ownVoteCard.style.backgroundColor = 'var(--primary-color)';
            ownVoteCard.style.borderColor = 'var(--primary-color)';
          }
        }
        
        this.wsManager.vote(voteValue, this.currentStoryId || 'current');
      });
    });

    this.shadowRoot.getElementById('revealCardsButton')
      .addEventListener('click', () => {
        this.wsManager.revealCards(this.currentStoryId || 'current');
      });

    this.shadowRoot.querySelector('.reset')
      .addEventListener('click', () => {
        this.wsManager.changeCurrentStory(this.currentStoryId);
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
      <option>Choose Action</option>
      <option value="block">Block User</option>
      <option value="unblock">Unblock User</option>
    `;
    
    select.addEventListener('change', () => {
      const action = select.value;
      const status = select.parentElement.querySelector('span');
      
      if (action === 'block') {
        this.wsManager.blockUser(participant.userId);
      } else if (action === 'unblock') {
        this.wsManager.unblockUser(participant.userId);
      }
      
      select.value = '';
    });
    
    return select;
  }

  _setupStorySelection(stories, isAdmin = true, currentStory = null) {
    const storySelect = this.shadowRoot.getElementById('storySelect');
    const storyTitle = this.shadowRoot.getElementById('storyTitle');
    const storyDescription = this.shadowRoot.getElementById('storyDescription');
    
    // Elements in the main area
    const currentStoryTitle = this.shadowRoot.getElementById('currentStoryTitle');
    const currentStoryDescription = this.shadowRoot.getElementById('currentStoryDescription');
    
    if (!stories) return;

    // Only populate dropdown for admins
    if (storySelect && isAdmin) {
      storySelect.innerHTML = '';
      stories.forEach(story => {
        const option = document.createElement('option');
        option.value = story.id;
        option.textContent = story.title || story.id;
        storySelect.appendChild(option);
      });

      // Set up change listener only for admins
      storySelect.addEventListener('change', (e) => {
        const selectedStoryId = e.target.value;
        const selectedStory = stories.find(s => s.id === selectedStoryId);
        
        if (selectedStory) {
          // Set current story ID for voting
          this.currentStoryId = selectedStoryId;
          
          // Update sidebar
          if (storyTitle) storyTitle.textContent = selectedStory.title || selectedStoryId;
          if (storyDescription) storyDescription.textContent = selectedStory.description || 'No description available';
          
          // Update main area
          if (currentStoryTitle) currentStoryTitle.textContent = selectedStory.title || selectedStoryId;
          if (currentStoryDescription) currentStoryDescription.textContent = selectedStory.description || 'No description available';
          
          // Reset voting for new story
          this._resetVoting();
          
          // Send story change to server if admin
          if (this.wsManager.role === 'admin') {
            this.wsManager.changeCurrentStory(selectedStoryId);
          }
        }
      });
    }

    // Determine which story to display initially
    let initialStory = null;
    if (currentStory && stories.find(s => s.id === currentStory.id)) {
      initialStory = currentStory;
    } else if (stories.length > 0) {
      // Fall back to first story
      initialStory = stories[0];
    }

    // Initialize display with the determined story
    if (initialStory) {
      // Set current story ID for voting
      this.currentStoryId = initialStory.id;
      
      if (storyTitle && isAdmin) storyTitle.textContent = initialStory.title || initialStory.id;
      if (storyDescription && isAdmin) storyDescription.textContent = initialStory.description || 'No description available';
      
      if (currentStoryTitle) currentStoryTitle.textContent = initialStory.title || initialStory.id;
      if (currentStoryDescription) currentStoryDescription.textContent = initialStory.description || 'No description available';
      
      if (storySelect && isAdmin) storySelect.value = initialStory.id;
    }
  }

  _resetVoting() {
    // Clear all player votes
    this.shadowRoot.querySelectorAll('.player').forEach((player, index) => {
      player.dataset.value = '?';

      const voteCard = player.querySelector('.vote-card');
      if (voteCard) {
        voteCard.textContent = ''; // Karte soll leer bleiben
        voteCard.style.backgroundColor = 'white';
        voteCard.style.borderColor = '#ddd';
      }

      // Avatar wieder anzeigen, falls er entfernt wurde
      let img = player.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.src = `avatare/avatar_${index + 1}.jpeg`;
        img.alt = player.dataset.userId || 'Avatar';
        player.insertBefore(img, voteCard);
      }

      // Avatar wieder anzeigen, falls er entfernt wurde
      let img = player.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.src = `avatare/avatar_${index + 1}.jpeg`;
        img.alt = player.dataset.userId || 'Avatar';
        player.insertBefore(img, voteCard);
      }

      // Avatar wieder anzeigen, falls er entfernt wurde
      let img = player.querySelector('img');
      if (!img) {
        img = document.createElement('img');
        img.src = `avatare/avatar_${index + 1}.jpeg`;
        img.alt = player.dataset.userId || 'Avatar';
        player.insertBefore(img, voteCard);
      }
    });

    // Clear selected card
    this.shadowRoot.querySelectorAll('.card-select button')
        .forEach(btn => btn.classList.remove('selected'));

    // Reset average display
    const averageDisplay = this.shadowRoot.querySelector('.average-display');
    if (averageDisplay) {
      averageDisplay.textContent = '?';
    }
  }


  showToast(message) {
    let toast = this.shadowRoot.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
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

  parseDefaultStories() {
    try {
      const content = this.textContent.trim();
      if (content) {
        const data = JSON.parse(content);
        return data.stories || [];
      }
    } catch (error) {
      console.warn("Could not parse default stories from component content:", error);
    }
    return [];
  }
}

customElements.define("planning-poker", PlanningPoker);
