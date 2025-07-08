export const CLIENT_ROLES = {
  ADMIN: 'admin',
  JOINER: 'joiner'
};

export const CLIENT_ACTIONS = {
  // Admin Actions
  CREATE_ROOM: 'createRoom',
  REMOVE_ROOM: 'removeRoom',
  BLOCK_USER: 'blockUser',
  UNBLOCK_USER: 'unblockUser',
  GET_BLOCKED_USERS: 'getBlockedUsers',
  REVEAL_CARDS: 'revealCards',
  CHANGE_CURRENT_STORY: 'changeCurrentStory',
  
  // Joiner Actions
  JOIN_ROOM: 'joinRoom',
  
  // Common Actions
  VOTE: 'vote',
  LEAVE_ROOM: 'leaveRoom'
};

export class WebSocketManager {
  constructor(component, messageHandler) {
    this.component = component;
    this.messageHandler = messageHandler;
    this.ws = null;
    this.role = null;
    this.currentRoom = null;
    this.connectionState = 'disconnected';
  }

  async connect(wsURL, role) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.disconnect();
    }

    this.role = role;
    this.connectionState = 'connecting';
    
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(wsURL);
      
      this.ws.onopen = () => {
        this.connectionState = 'connected';
        console.log(`WebSocket connected as ${role}`);
        resolve(this.ws);
      };

      this.ws.onerror = (error) => {
        this.connectionState = 'error';
        console.error('WebSocket connection error:', error);
        this.component.showToast('Connection error');
        reject(error);
      };

      this.ws.onclose = () => {
        this.connectionState = 'disconnected';
        console.log('WebSocket connection closed');
        this.component.showToast('Disconnected from room');
      };

      this.ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          await this.messageHandler.handleMessage(data, this.ws, this.role);
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
          this.component.showToast('Error processing message');
        }
      };
    });
  }

  sendMessage(action, payload = {}) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('WebSocket not connected');
      this.component.showToast('Not connected to server');
      return false;
    }

    const message = {
      type: this.role,
      payload: {
        action,
        ...payload
      }
    };

    try {
      this.ws.send(JSON.stringify(message));
      return true;
    } catch (error) {
      console.error('Error sending message:', error);
      this.component.showToast('Error sending message');
      return false;
    }
  }

  
  // Room Management
  createRoom(roomName, userName, stories = []) {
    return this.sendMessage(CLIENT_ACTIONS.CREATE_ROOM, { 
      roomName, 
      userName, 
      stories 
    });
  }

  joinRoom(roomId, userName) {
    this.currentRoom = roomId;
    return this.sendMessage(CLIENT_ACTIONS.JOIN_ROOM, { roomId, userName });
  }

  leaveRoom() {
    if (!this.currentRoom) return false;
    const success = this.sendMessage(CLIENT_ACTIONS.LEAVE_ROOM, { roomId: this.currentRoom });
    if (success) {
      this.currentRoom = null;
    }
    return success;
  }

  vote(voteValue, storyId = 'current') {
    if (!this.currentRoom) return false;
    return this.sendMessage(CLIENT_ACTIONS.VOTE, { 
      roomId: this.currentRoom, 
      voteValue, 
      storyId 
    });
  }

  // Admin Actions
  revealCards(storyId = 'current') {
    if (!this.currentRoom || this.role !== CLIENT_ROLES.ADMIN) return false;
    return this.sendMessage(CLIENT_ACTIONS.REVEAL_CARDS, { 
      roomId: this.currentRoom, 
      storyId 
    });
  }

  blockUser(targetClientId) {
    if (!this.currentRoom || this.role !== CLIENT_ROLES.ADMIN) return false;
    return this.sendMessage(CLIENT_ACTIONS.BLOCK_USER, { 
      roomId: this.currentRoom, 
      targetClientId 
    });
  }

  unblockUser(targetClientId) {
    if (!this.currentRoom || this.role !== CLIENT_ROLES.ADMIN) return false;
    return this.sendMessage(CLIENT_ACTIONS.UNBLOCK_USER, { 
      roomId: this.currentRoom, 
      targetClientId 
    });
  }

  changeCurrentStory(storyId) {
    if (!this.currentRoom || this.role !== CLIENT_ROLES.ADMIN) return false;
    return this.sendMessage(CLIENT_ACTIONS.CHANGE_CURRENT_STORY, {
      roomId: this.currentRoom,
      storyId
    });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'disconnected';
    this.currentRoom = null;
  }

  isConnected() {
    return this.connectionState === 'connected' && this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  getConnectionState() {
    return this.connectionState;
  }

  getCurrentRoom() {
    return this.currentRoom;
  }

  getRole() {
    return this.role;
  }
}
