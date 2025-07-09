// Message Types vom Backend
export const MESSAGE_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  NOTIFICATION: 'notification'
};

// Success Actions
export const SUCCESS_ACTIONS = {
  JOIN_ROOM: 'joinRoom',
  CREATE_ROOM: 'createRoom',
  VOTE: 'vote',
  REVEAL_CARDS: 'revealCards',
  LEAVE_ROOM: 'leaveRoom',
  BLOCK_USER: 'blockUser',
  UNBLOCK_USER: 'unblockUser'
};

// Notification Actions
export const NOTIFICATION_ACTIONS = {
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  CARDS_REVEALED: 'cardsRevealed',
  USER_BLOCKED: 'userBlocked',
  USER_UNBLOCKED: 'userUnblocked',
  USER_VOTED: 'userVoted',
  STORY_CHANGED: 'storyChanged'
};

export class MessageHandler {
  constructor(component) {
    this.component = component;
    this.handlers = this.initializeHandlers();
  }

  initializeHandlers() {
    return {
      [MESSAGE_TYPES.SUCCESS]: this.handleSuccessMessage.bind(this),
      [MESSAGE_TYPES.ERROR]: this.handleErrorMessage.bind(this),
      [MESSAGE_TYPES.NOTIFICATION]: this.handleNotificationMessage.bind(this)
    };
  }

  async handleMessage(data, ws, role) {
    const handler = this.handlers[data.type];
    if (handler) {
      await handler(data.payload, ws, role);
    } else {
      console.warn('Unknown message type:', data.type);
      this.component.showToast(`Unknown message type: ${data.type}`);
    }
  }

  async handleSuccessMessage(payload, ws, role) {
    const successHandlers = {
      [SUCCESS_ACTIONS.JOIN_ROOM]: async () => {
        await this.component._renderJoinerRoom(payload);
      },
      [SUCCESS_ACTIONS.CREATE_ROOM]: async () => {
        await this.component._renderAdminRoom(payload);
      },
      [SUCCESS_ACTIONS.VOTE]: () => {
        this.component.showToast(`Vote recorded: ${payload.voteValue}`);
        this.updatePlayerVote(payload);
      },
      [SUCCESS_ACTIONS.REVEAL_CARDS]: () => {
        this.component.showToast("Cards revealed!");
        this.revealAllCards(payload);
      },
      [SUCCESS_ACTIONS.LEAVE_ROOM]: () => {
        this.component.showToast("You left the room.");
        this.component.wsManager.disconnect();
        window.location.reload();
      },
      [SUCCESS_ACTIONS.BLOCK_USER]: () => {
        this.component.showToast(`User blocked: ${payload.targetClientId}`);
        this.updateParticipantStatus(payload.targetClientId, true);
      },
      [SUCCESS_ACTIONS.UNBLOCK_USER]: () => {
        this.component.showToast(`User unblocked: ${payload.targetClientId}`);
        this.updateParticipantStatus(payload.targetClientId, false);
      }
    };

    const handler = successHandlers[payload.action];
    if (handler) {
      await handler();
    } else {
      console.warn('Unknown success action:', payload.action);
    }
  }


  handleErrorMessage(payload, ws, role) {
    const message = typeof payload === 'string' ? payload : 'An error occurred';
    this.component.showToast(`Error: ${message}`);
    console.error("Error payload:", payload);
    
    if (message.includes('blocked')) {
      this.handleBlockedUserError();
    } else if (message.includes('room') && message.includes('not exist')) {
      this.handleRoomNotFoundError();
    }
  }

  handleNotificationMessage(payload, ws, role) {
    const notificationHandlers = {
      [NOTIFICATION_ACTIONS.USER_JOINED]: () => {
        this.component.showToast(`${payload.userName} joined the room`);
        this.addParticipantToList(payload);
      },
      [NOTIFICATION_ACTIONS.USER_LEFT]: () => {
        this.component.showToast(`${payload.userName} left the room`);
        this.removeParticipantFromList(payload.userId);
      },
      [NOTIFICATION_ACTIONS.CARDS_REVEALED]: () => {
        this.component.showToast("Cards have been revealed!");
        this.revealAllCards(payload);
      },
      [NOTIFICATION_ACTIONS.USER_BLOCKED]: () => {
        this.component.showToast(`${payload.userName} was blocked`);
        this.updateParticipantStatus(payload.userId, true);
      },
      [NOTIFICATION_ACTIONS.USER_VOTED]: () => {
        this.component.showToast(`${payload.userName} voted`);
        this.updatePlayerVote(payload);
      },
      [NOTIFICATION_ACTIONS.STORY_CHANGED]: () => {
        this.component.showToast(`Story changed to: ${payload.story.title}`);
        this.updateCurrentStory(payload.story);
      }
    };

    const handler = notificationHandlers[payload.action];
    if (handler) {
      handler();
    } else {
      console.warn('Unknown notification action:', payload.action);
    }
  }
  
  updatePlayerVote(payload) {
    const player = this.component.shadowRoot.querySelector(`[data-user-id="${payload.userId}"]`);
    if (player) {
      player.dataset.value = payload.voteValue;
      
      // Update vote card color to indicate vote was cast
      const voteCard = player.querySelector('.vote-card');
      if (voteCard) {
        voteCard.style.backgroundColor = 'var(--primary-color'; // Blue color
        voteCard.style.borderColor = 'var(--primary-color)';
      }
    }
  }

  revealAllCards(payload) {
    const players = this.component.shadowRoot.querySelectorAll('.player');
    const values = [];
    
    players.forEach(player => {
      const value = player.dataset.value;
      const num = parseInt(value);
      
      // Remove avatar
      const img = player.querySelector('img');
      if (img) img.remove();
      
      // Update vote card to show the actual value
      const voteCard = player.querySelector('.vote-card');
      if (voteCard) {
        voteCard.textContent = isNaN(num) ? '?' : value;
        voteCard.style.cssText = `
          width: 50px;
          height: 70px;
          border: 2px solid #4285f4;
          border-radius: 8px;
          background: #4285f4;
          color: white;
          margin: 0 5px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: bold;
          font-size: 18px;
        `;
      }
      
      if (!isNaN(num)) values.push(num);
    });

    // Update average display
    const avg = values.length 
      ? (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
      : '?';
    const avgDisplay = this.component.shadowRoot.querySelector('.average-display');
    if (avgDisplay) avgDisplay.textContent = avg;
  }

  addParticipantToList(payload) {
    const ul = this.component.shadowRoot.getElementById('participantsList');
    if (ul) {
      const li = document.createElement('li');
      li.dataset.userId = payload.userId;
      li.textContent = payload.userName + ' ';
      
      const status = document.createElement('span');
      status.textContent = '✅';
      li.appendChild(status);
      
      const actionSelect = this.component._createParticipantActionSelect({
        userId: payload.userId,
        userName: payload.userName,
        blocked: false
      });
      li.appendChild(actionSelect);
      
      ul.appendChild(li);
    }

    // Update players section with avatar (for both admin and joiner views)
    const playersSection = this.component.shadowRoot.getElementById('playersSection');
    if (playersSection) {
      const existingPlayers = playersSection.querySelectorAll('.player');
      const avatarIndex = existingPlayers.length + 1; // Next available avatar
      
      const div = document.createElement('div');
      div.className = 'player';
      div.dataset.value = '?';
      div.dataset.userId = payload.userId;

      const img = document.createElement('img');
      img.src = `avatare/avatar_${avatarIndex}.jpeg`;
      img.alt = payload.userName;
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
      span.textContent = payload.userName;
      div.appendChild(span);

      playersSection.appendChild(div);
    }
  }

  removeParticipantFromList(userId) {
    // Remove from participants list (admin view)
    const listElement = this.component.shadowRoot.querySelector(`#participantsList [data-user-id="${userId}"]`);
    if (listElement) listElement.remove();
    
    // Remove from players section (both admin and joiner views)
    const playerElement = this.component.shadowRoot.querySelector(`#playersSection [data-user-id="${userId}"]`);
    if (playerElement) playerElement.remove();
  }

  updateParticipantStatus(userId, isBlocked) {
    // Update status in participants list (admin view)
    const listStatusElement = this.component.shadowRoot.querySelector(`#participantsList [data-user-id="${userId}"] span`);
    if (listStatusElement) {
      listStatusElement.textContent = isBlocked ? '🚫' : '✅';
    }
  }

  handleBlockedUserError() {
    // Specific handling for blocked user errors
    this.component.showToast("You have been blocked from this room");
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }

  handleRoomNotFoundError() {
    // Specific handling for room not found errors
    this.component.showToast("Room not found. Redirecting to home...");
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  }

  updateCurrentStory(story) {
    // Update current story ID in the component
    this.component.currentStoryId = story.id;
    
    // Update main area story display
    const currentStoryTitle = this.component.shadowRoot.getElementById('currentStoryTitle');
    const currentStoryDescription = this.component.shadowRoot.getElementById('currentStoryDescription');
    
    if (currentStoryTitle) {
      currentStoryTitle.textContent = story.title || story.id;
    }
    if (currentStoryDescription) {
      currentStoryDescription.textContent = story.description || 'No description available';
    }

    // Update sidebar story display (if admin)
    const storyTitle = this.component.shadowRoot.getElementById('storyTitle');
    const storyDescription = this.component.shadowRoot.getElementById('storyDescription');
    const storySelect = this.component.shadowRoot.getElementById('storySelect');
    
    if (storyTitle) {
      storyTitle.textContent = story.title || story.id;
    }
    if (storyDescription) {
      storyDescription.textContent = story.description || 'No description available';
    }
    if (storySelect) {
      storySelect.value = story.id;
    }

    // Reset voting when story changes
    this.component._resetVoting();
  }
}
