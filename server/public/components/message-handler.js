// Message Types vom Backend
export const MESSAGE_TYPES = {
  ERROR: 'error',
  NOTIFICATION: 'notification'
};


// Notification Actions
export const NOTIFICATION_ACTIONS = {
  USER_JOINED: 'userJoined',
  USER_LEFT: 'userLeft',
  CARDS_REVEALED: 'cardsRevealed',
  USER_BLOCKED: 'userBlocked',
  USER_UNBLOCKED: 'userUnblocked',
  USER_VOTED: 'userVoted',
  STORY_CHANGED: 'storyChanged',
  ROOM_CREATED: 'roomCreated',
  USER_REMOVED: 'userRemoved',
  USER_BLOCK_SUCCESS: 'userBlockSuccess',
  USER_UNBLOCK_SUCCESS: 'userUnblockSuccess',
  BLOCKED_USERS_INFO: 'blockedUsersInfo'
};

export class MessageHandler {
  constructor(component) {
    this.component = component;
    this.handlers = this.initializeHandlers();
  }

  initializeHandlers() {
    return {
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
    console.log('Handling notification:', payload.action, payload);
    
    const notificationHandlers = {
      [NOTIFICATION_ACTIONS.USER_JOINED]: () => {
        // Handle both joining as a new user and getting the full room state
        if (payload.isOwnAction) {
          // This is my own join - render the room
          this.component._renderJoinerRoom(payload);
        } else {
          // Someone else joined - just add them to the participant list and players section
          // DO NOT re-render the entire room as this would lose admin privileges
          this.component.showToast(`${payload.userName} joined the room`);
          this.addParticipantToList(payload);
        }
      },
      [NOTIFICATION_ACTIONS.USER_LEFT]: () => {
        if (payload.isOwnAction) {
          // This is my own leave action
          this.component.showToast("You left the room.");
          this.component.wsManager.disconnect();
          window.location.reload();
        } else {
          // Someone else left
          this.component.showToast(`${payload.userName} left the room`);
          this.removeParticipantFromList(payload.userId);
        }
      },
      [NOTIFICATION_ACTIONS.CARDS_REVEALED]: () => {
        this.component.showToast("Cards have been revealed!");
        this.revealAllCards(payload);
      },
      [NOTIFICATION_ACTIONS.USER_BLOCKED]: () => {
        this.component.showToast(`${payload.blockedUserName || 'User'} was blocked and removed`);
        // Remove the blocked user from the players section (avatar area) but keep in participants list
        const blockedUserId = payload.blockedUserIP;
        if (blockedUserId) {
          // Remove from players section (avatar area)
          const playerElement = this.component.shadowRoot.querySelector(`#playersSection [data-user-id="${blockedUserId}"]`);
          if (playerElement) playerElement.remove();
          
          // Update status in participants list to show blocked
          this.updateParticipantStatus(blockedUserId, true);
        }
      },
      [NOTIFICATION_ACTIONS.USER_UNBLOCKED]: () => {
        this.component.showToast(`IP ${payload.unblockedUserIP || 'Unknown'} was unblocked`);

        const unblockedUserId = payload.unblockedUserIP;
        if (unblockedUserId) {
          // Remove from participants list completely
          const listElement = this.component.shadowRoot.querySelector(`#participantsList [data-user-id="${unblockedUserId}"]`);
          if (listElement) {
            listElement.remove();
          }
          
          // User can now rejoin with fresh entry in the participants list
        }
      },
      [NOTIFICATION_ACTIONS.USER_VOTED]: () => {

        this.component.showToast(`${payload.userName} voted`);
        this.updatePlayerVote(payload);
      },
      [NOTIFICATION_ACTIONS.STORY_CHANGED]: () => {
        const isSameStory = payload.story.id === this.component.currentStoryId;

        this.updateCurrentStory(payload.story);

        const message = isSameStory
            ? "Cards have been reset!"
            : `Story changed to: ${payload.story.title}`;

        this.component.showToast(message);
      },
      [NOTIFICATION_ACTIONS.ROOM_CREATED]: () => {
        // Handle room creation success
        console.log('Room created successfully:', payload);
        this.component.showToast(`Room "${payload.roomName}" created successfully!`);
        this.component._renderAdminRoom(payload);
      },
      [NOTIFICATION_ACTIONS.USER_REMOVED]: () => {
        this.component.showToast(`User ${payload.targetClientIp} was removed from the room`);
        this.removeParticipantFromList(payload.targetClientIp);
      },
      [NOTIFICATION_ACTIONS.USER_BLOCK_SUCCESS]: () => {
        this.component.showToast(`IP ${payload.targetIP || payload.targetClientIp} blocked successfully`);
      },
      [NOTIFICATION_ACTIONS.USER_UNBLOCK_SUCCESS]: () => {
        this.component.showToast(`User unblocked: ${payload.targetClientIp}`);
      },
      [NOTIFICATION_ACTIONS.BLOCKED_USERS_INFO]: () => {
        // Handle blocked users info response
        console.log('Blocked users:', payload.blockedUsers);
        // You could update a UI component here to show the blocked users list
      }
    };

    const handler = notificationHandlers[payload.action];
    if (handler) {
      handler();
    } else {
      console.warn('Unknown notification action:', payload.action, 'Available actions:', Object.keys(NOTIFICATION_ACTIONS));
      // Fallback for room creation if action name doesn't match exactly
      if (payload.action === 'roomCreated' || payload.roomId) {
        console.log('Attempting fallback room creation handler');
        this.component.showToast(`Room "${payload.roomName || 'Unnamed'}" created successfully!`);
        this.component._renderAdminRoom(payload);
      }
    }
  }
  
  updatePlayerVote(payload) {
    const player = this.component.shadowRoot.querySelector(`[data-user-id="${payload.userId}"]`);
    if (player) {
      player.dataset.value = payload.voteValue;
      
      // Update vote card color to indicate vote was cast
      const voteCard = player.querySelector('.vote-card');
      if (voteCard) {
        voteCard.style.backgroundColor = 'var(--primary-color)';
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
    // Update participants list (admin view only)
    const ul = this.component.shadowRoot.getElementById('participantsList');
    if (ul) {
      // Check if participant already exists
      const existingParticipant = ul.querySelector(`[data-user-id="${payload.userId}"]`);
      if (!existingParticipant) {
        // Create new participant using the same method as the admin room setup
        const participantData = {
          userId: payload.userId,
          userName: payload.userName,
          isAdmin: payload.isAdmin || false,
          blocked: false
        };
        const li = this.component._createParticipantElement(participantData);
        ul.appendChild(li);
      }
    }

    // Update players section with avatar (for both admin and joiner views)
    const playersSection = this.component.shadowRoot.getElementById('playersSection');
    if (playersSection) {
      // Check if player already exists
      const existingPlayer = playersSection.querySelector(`[data-user-id="${payload.userId}"]`);
      if (!existingPlayer) {
        const existingPlayers = playersSection.querySelectorAll('.player');
        const avatarIndex = Math.min(existingPlayers.length + 1, 9); // Max 9 avatars
        
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
          border: 2px solid var(--primary-color);
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
    // Find the participant element
    const participantElement = this.component.shadowRoot.querySelector(`#participantsList [data-user-id="${userId}"]`);
    if (participantElement) {
      // Update the status indicator (green/red dot)
      const statusIndicator = participantElement.children[2]; // Third child is the status indicator
      if (statusIndicator) {
        statusIndicator.style.background = isBlocked ? '#dc3545' : '#28a745';
      }
      
      // Update the action button if it exists (4th child)
      const actionButton = participantElement.children[3];
      if (actionButton && actionButton.tagName === 'BUTTON') {
        if (isBlocked) {
          // Change to unblock button
          actionButton.innerHTML = '🛡️';
          actionButton.style.borderColor = '#28a745';
          actionButton.style.background = '#28a745';
          actionButton.title = 'Unblock User';
          
          // Remove old event listeners and add new one
          actionButton.replaceWith(actionButton.cloneNode(true));
          const newButton = participantElement.children[3];
          newButton.addEventListener('click', () => {
            this.component.wsManager.unblockUser(userId);
          });
        } else {
          // Change to block button
          actionButton.innerHTML = '🚫';
          actionButton.style.borderColor = '#dc3545';
          actionButton.style.background = '#dc3545';
          actionButton.title = 'Block User';
          
          // Remove old event listeners and add new one
          actionButton.replaceWith(actionButton.cloneNode(true));
          const newButton = participantElement.children[3];
          newButton.addEventListener('click', () => {
            this.component.wsManager.blockUser(userId);
          });
        }
      }
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
