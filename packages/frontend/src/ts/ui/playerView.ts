import { apiService } from '../api/apiService';
import { socketService } from '../api/socketService';
import { Participant, Estimate, EstimatesRevealedEvent } from '../models';

// Card values for planning poker
const CARD_VALUES = ['0', '1', '2', '3', '5', '8', '13', '20', '?', '☕'];

export class PlayerView {
  private roomId: string = '';
  private participantId: string = '';
  private participants: Participant[] = [];
  private participantsWhoVoted: string[] = [];
  private selectedCard: string | null = null;
  private estimatesRevealed: boolean = false;
  private currentStoryName: string = '';
  private estimates: Estimate[] = [];

  // DOM elements
  private joinView: HTMLElement;
  private roomView: HTMLElement;
  private roomIdInput: HTMLInputElement;
  private participantNameInput: HTMLInputElement;
  private joinButton: HTMLButtonElement;
  private joinError: HTMLElement;
  private teamName: HTMLElement;
  private currentStory: HTMLElement;
  private storyButton: HTMLButtonElement;
  private revealButton: HTMLButtonElement;
  private resetButton: HTMLButtonElement;
  private inviteButton: HTMLButtonElement;
  private issuesButton: HTMLButtonElement;
  private cardDeck: HTMLElement;
  private participantsContainer: HTMLElement;
  private tableCenter: HTMLElement;
  private issuesPanel: HTMLElement;
  private issuesList: HTMLElement;
  private closeIssuesBtn: HTMLButtonElement;
  private storyModal: HTMLElement;
  private storyNameInput: HTMLInputElement;
  private storyDescriptionInput: HTMLTextAreaElement;
  private saveStoryBtn: HTMLButtonElement;
  private cancelStoryBtn: HTMLButtonElement;
  private closeModalBtn: HTMLButtonElement;

  constructor() {
    // Get DOM elements
    this.joinView = document.getElementById('join-view') as HTMLElement;
    this.roomView = document.getElementById('room-view') as HTMLElement;
    this.roomIdInput = document.getElementById('roomId') as HTMLInputElement;
    this.participantNameInput = document.getElementById('participantName') as HTMLInputElement;
    this.joinButton = document.getElementById('joinButton') as HTMLButtonElement;
    this.joinError = document.getElementById('joinError') as HTMLElement;
    this.teamName = document.getElementById('team-name') as HTMLElement;
    this.currentStory = document.getElementById('current-story') as HTMLElement;
    this.storyButton = document.getElementById('storyButton') as HTMLButtonElement;
    this.revealButton = document.getElementById('revealButton') as HTMLButtonElement;
    this.resetButton = document.getElementById('resetButton') as HTMLButtonElement;
    this.inviteButton = document.getElementById('inviteButton') as HTMLButtonElement;
    this.issuesButton = document.getElementById('issuesButton') as HTMLButtonElement;
    this.cardDeck = document.getElementById('card-deck') as HTMLElement;
    this.participantsContainer = document.getElementById('participants-container') as HTMLElement;
    this.tableCenter = document.getElementById('table-center') as HTMLElement;
    this.issuesPanel = document.getElementById('issues-panel') as HTMLElement;
    this.issuesList = document.getElementById('issues-list') as HTMLElement;
    this.addIssueBtn = document.getElementById('addIssueBtn') as HTMLButtonElement;
    this.refreshIssuesBtn = document.getElementById('refreshIssuesBtn') as HTMLButtonElement;
    this.closeIssuesBtn = document.getElementById('closeIssuesBtn') as HTMLButtonElement;
    this.storyModal = document.getElementById('story-modal') as HTMLElement;
    this.storyNameInput = document.getElementById('storyNameInput') as HTMLInputElement;
    this.storyDescriptionInput = document.getElementById('storyDescriptionInput') as HTMLTextAreaElement;
    this.saveStoryBtn = document.getElementById('saveStoryBtn') as HTMLButtonElement;
    this.cancelStoryBtn = document.getElementById('cancelStoryBtn') as HTMLButtonElement;
    this.closeModalBtn = document.getElementById('closeModalBtn') as HTMLButtonElement;

    // Set up event listeners
    this.joinButton.addEventListener('click', () => this.handleJoinRoom());
    this.storyButton.addEventListener('click', () => this.openStoryModal());
    this.revealButton.addEventListener('click', () => this.handleRevealEstimates());
    this.resetButton.addEventListener('click', () => this.handleClearEstimates());
    this.inviteButton.addEventListener('click', () => this.handleInvitePlayers());
    this.issuesButton.addEventListener('click', () => this.toggleIssuesPanel());
    this.closeIssuesBtn.addEventListener('click', () => this.toggleIssuesPanel(false));
    this.closeModalBtn.addEventListener('click', () => this.closeStoryModal());
    this.saveStoryBtn.addEventListener('click', () => this.handleSetStoryName());
    this.cancelStoryBtn.addEventListener('click', () => this.closeStoryModal());

    // Initialize card deck
    this.initializeCardDeck();

    // Check for room ID in URL
    this.checkUrlForRoomId();

    // Set up socket event listeners
    this.setupSocketListeners();

    // Try to restore session
    this.restoreSession();
  }

  // Restore session from localStorage
  private async restoreSession(): Promise<void> {
    const savedRoomId = localStorage.getItem('roomId');
    const savedParticipantId = localStorage.getItem('participantId');
    const savedParticipantName = localStorage.getItem('participantName');

    if (savedRoomId && savedParticipantId && savedParticipantName) {
      try {
        // Pre-fill the form
        this.roomIdInput.value = savedRoomId;
        this.participantNameInput.value = savedParticipantName;

        // Attempt to rejoin the room
        await this.handleJoinRoom();
      } catch (error) {
        // If rejoining fails, clear the saved session
        this.clearSession();
      }
    }
  }

  // Clear session data
  private clearSession(): void {
    localStorage.removeItem('roomId');
    localStorage.removeItem('participantId');
    localStorage.removeItem('participantName');
    
    // Disconnect from socket
    socketService.leaveRoom();
  }

  // Handle joining a room
  private async handleJoinRoom(): Promise<void> {
    const roomId = this.roomIdInput.value.trim();
    const participantName = this.participantNameInput.value.trim();

    if (!roomId) {
      this.showJoinError('Please enter a Room ID');
      return;
    }

    if (!participantName) {
      this.showJoinError('Please enter your name');
      return;
    }

    try {
      // Clear any existing session before joining
      this.clearSession();
      
      const response = await apiService.joinRoom(roomId, participantName);
      
      this.roomId = response.room.id;
      this.participantId = response.participant.id;
      this.participants = response.participants;
      this.currentStoryName = response.room.currentStoryName || '';
      
      // Save session data
      localStorage.setItem('roomId', roomId);
      localStorage.setItem('participantId', this.participantId);
      localStorage.setItem('participantName', participantName);
      
      // Update URL with room ID
      window.history.pushState({}, '', `?roomId=${response.room.uniqueLinkIdentifier}`);
      
      // Update room view
      this.teamName.textContent = response.room.uniqueLinkIdentifier || 'Team Room';
      this.currentStory.textContent = this.currentStoryName || 'Select a story';
      
      // Show room view
      this.joinView.classList.add('hidden');
      this.roomView.classList.remove('hidden');
      
      // Connect to WebSocket and join room
      socketService.connect();
      socketService.joinRoom(this.roomId, this.participantId);
      
      console.log('Connected to room:', this.roomId);
      
      // Update UI
      this.renderParticipantsCircle();
      this.updateRevealButtonState();
    } catch (error: any) {
      this.showJoinError(error.response?.data?.error?.message || 'Failed to join the room');
      // Clear session data if join fails
      this.clearSession();
    }
  }

  // Initialize the card deck with the available values
  private initializeCardDeck(): void {
    CARD_VALUES.forEach(value => {
      const card = document.createElement('div');
      card.className = 'poker-card';
      card.textContent = value;
      card.addEventListener('click', () => this.handleCardSelection(value, card));
      this.cardDeck.appendChild(card);
    });
  }

  // Check if room ID is in the URL
  private checkUrlForRoomId(): void {
    const urlParams = new URLSearchParams(window.location.search);
    const roomId = urlParams.get('roomId');
    if (roomId) {
      this.roomIdInput.value = roomId;
    }
  }

  // Handle card selection
  private handleCardSelection(value: string, cardElement: HTMLElement): void {
    // Clear previously selected card
    const selectedCards = this.cardDeck.querySelectorAll('.poker-card.selected');
    selectedCards.forEach(card => card.classList.remove('selected'));
    
    // Select new card
    cardElement.classList.add('selected');
    this.selectedCard = value;
    
    console.log('Submitting estimate:', value);
    
    // Submit estimate via WebSocket
    socketService.submitEstimate(value, this.currentStoryName);
    
    // Add yourself to the list locally for immediate UI feedback
    if (!this.participantsWhoVoted.includes(this.participantId)) {
      this.participantsWhoVoted.push(this.participantId);
      
      // Update the UI
      this.renderParticipantsCircle();
      this.updateRevealButtonState();
    }
  }

  // Open story modal
  private openStoryModal(): void {
    this.storyNameInput.value = this.currentStoryName;
    this.storyDescriptionInput.value = '';
    this.storyModal.classList.remove('hidden');
  }

  // Close story modal
  private closeStoryModal(): void {
    this.storyModal.classList.add('hidden');
  }

  // Handle setting a story name
  private handleSetStoryName(): void {
    const storyName = this.storyNameInput.value.trim();
    if (storyName) {
      this.currentStoryName = storyName;
      this.currentStory.textContent = storyName;
      
      console.log('Setting story name:', storyName);
      
      socketService.setStoryName(storyName);
      this.closeStoryModal();
    }
  }

  // Handle revealing estimates
  private handleRevealEstimates(): void {
    // Only allow revealing if all participants have voted
    if (this.allParticipantsVoted()) {
      console.log('Revealing estimates for all participants');
      socketService.revealEstimates();
    }
  }

  // Check if all participants have voted
  private allParticipantsVoted(): boolean {
    return this.participants.length > 0 && this.participantsWhoVoted.length >= this.participants.length;
  }

  // Show voting results
  private showResults(): void {
    // Get all estimates
    const values: number[] = [];
    
    // Collect numeric estimates
    this.estimates.forEach(estimate => {
      if (!isNaN(Number(estimate.value))) {
        values.push(Number(estimate.value));
      }
    });
    
    // Calculate statistics
    const average = values.length > 0 ? 
      (values.reduce((sum, val) => sum + val, 0) / values.length).toFixed(1) : 'N/A';
    
    const min = values.length > 0 ? Math.min(...values).toString() : 'N/A';
    const max = values.length > 0 ? Math.max(...values).toString() : 'N/A';
    
    // Update table center with results
    this.tableCenter.innerHTML = `
      <h3>Results</h3>
      <p>Average: ${average}</p>
      <p>Min: ${min} - Max: ${max}</p>
      <p>Total votes: ${this.participantsWhoVoted.length}</p>
    `;
  }

  // Clear all estimates
  private clearEstimates(): void {
    // Clear data
    this.participantsWhoVoted = [];
    this.estimatesRevealed = false;
    this.selectedCard = null;
    this.estimates = [];
    
    // Clear UI
    const selectedCards = this.cardDeck.querySelectorAll('.poker-card.selected');
    selectedCards.forEach(card => card.classList.remove('selected'));
    
    this.renderParticipantsCircle();
    this.tableCenter.innerHTML = '<p>Waiting for players to vote...</p>';
    
    // Update button state
    this.updateRevealButtonState();
  }

  // Handle clearing estimates
  private handleClearEstimates(): void {
    console.log('Clearing all estimates');
    socketService.clearEstimates();
  }

  // Handle invite players
  private handleInvitePlayers(): void {
    const roomLink = window.location.origin + window.location.pathname + '?roomId=' + this.roomId;
    navigator.clipboard.writeText(roomLink)
      .then(() => {
        alert('Room link copied to clipboard!');
      })
      .catch(() => {
        prompt('Share this link with your team:', roomLink);
      });
  }

  // Toggle issues panel
  private toggleIssuesPanel(show?: boolean): void {
    if (show === undefined) {
      this.issuesPanel.classList.toggle('hidden');
    } else if (show) {
      this.issuesPanel.classList.remove('hidden');
    } else {
      this.issuesPanel.classList.add('hidden');
    }

    if (!this.issuesPanel.classList.contains('hidden')) {
      this.loadIssues();
    }
  }

  // Load issues
  private async loadIssues(): Promise<void> {
    try {
      // To be implemented with API call
      // For now, just show a placeholder
      this.issuesList.innerHTML = `
        <div class="issue-item active">
          <h4>Current: ${this.currentStoryName || 'No active story'}</h4>
        </div>
        <div class="issue-item">
          <h4>Add login functionality</h4>
        </div>
        <div class="issue-item">
          <h4>Fix responsive layout</h4>
        </div>
      `;
    } catch (error) {
      console.error('Failed to load issues', error);
    }
  }

  // Update reveal button state
  private updateRevealButtonState(): void {
    if (this.allParticipantsVoted()) {
      this.revealButton.disabled = false;
      this.revealButton.classList.remove('disabled');
    } else {
      this.revealButton.disabled = true;
      this.revealButton.classList.add('disabled');
    }
  }

  // Render participants in a circle
  private renderParticipantsCircle(): void {
    this.participantsContainer.innerHTML = '';
    
    const numberOfParticipants = this.participants.length;
    if (numberOfParticipants === 0) return;

    // Calculate positions in a circle
    const radius = Math.min(this.participantsContainer.clientWidth, this.participantsContainer.clientHeight) * 0.4;
    const centerX = this.participantsContainer.clientWidth / 2;
    const centerY = this.participantsContainer.clientHeight / 2;
    
    this.participants.forEach((participant, index) => {
      // Calculate angle (distribute evenly around the circle)
      const angle = (index / numberOfParticipants) * 2 * Math.PI;
      
      // Calculate position
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      
      // Create participant avatar element
      const avatarElement = document.createElement('div');
      avatarElement.className = 'participant-avatar';
      avatarElement.style.left = `${x}px`;
      avatarElement.style.top = `${y}px`;
      
      // Add status indicator
      const hasVoted = this.participantsWhoVoted.includes(participant.id);
      if (hasVoted) {
        avatarElement.classList.add('voted');
      }
      
      // Add avatar image
      const avatarImg = document.createElement('img');
      avatarImg.src = this.getAvatarUrl(participant.name);
      avatarImg.alt = participant.name;
      avatarElement.appendChild(avatarImg);
      
      // Add participant name
      const nameElement = document.createElement('div');
      nameElement.className = 'participant-name';
      nameElement.textContent = participant.name;
      avatarElement.appendChild(nameElement);
      
      // Add to container
      this.participantsContainer.appendChild(avatarElement);
      
      // Add participant card if voted
      if (hasVoted) {
        const cardElement = document.createElement('div');
        cardElement.className = 'participant-card';
        
        // Position the card in front of the avatar
        const cardAngle = angle + Math.PI / 2; // 90 degrees offset
        const cardDistance = 50;
        const cardX = x + cardDistance * Math.cos(cardAngle);
        const cardY = y + cardDistance * Math.sin(cardAngle);
        
        cardElement.style.left = `${cardX}px`;
        cardElement.style.top = `${cardY}px`;
        
        // If estimates are revealed, show the value
        if (this.estimatesRevealed) {
          const estimate = this.getParticipantEstimate(participant.id);
          if (estimate) {
            cardElement.textContent = estimate.value;
            
            // Add visual styling based on value
            if (estimate.value === '?' || estimate.value === '☕') {
              cardElement.classList.add('special-card');
            } else {
              const numValue = Number(estimate.value);
              if (!isNaN(numValue)) {
                if (numValue <= 3) {
                  cardElement.classList.add('low-value');
                } else if (numValue >= 13) {
                  cardElement.classList.add('high-value');
                }
              }
            }
          }
        } else {
          cardElement.textContent = '?';
        }
        
        this.participantsContainer.appendChild(cardElement);
      }
    });
    
    // Update reveal button state
    this.updateRevealButtonState();
  }

  // Get participant's estimate
  private getParticipantEstimate(participantId: string): Estimate | null {
    // Check if we have actual estimates from server
    const serverEstimate = this.estimates.find(e => e.participantId === participantId);
    if (serverEstimate) return serverEstimate;
    
    // If it's the current user, use their selected card
    if (participantId === this.participantId && this.selectedCard) {
      return { 
        participantId, 
        value: this.selectedCard,
        participantName: this.participants.find(p => p.id === participantId)?.name || 'Unknown'
      };
    }
    
    return null;
  }

  // Get avatar URL based on name
  private getAvatarUrl(name: string): string {
    // Use a simple avatar generation service based on initials
    // In a real app, you might want to use a more sophisticated service
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
  }

  // Show join error
  private showJoinError(message: string): void {
    this.joinError.textContent = message;
    this.joinError.classList.remove('hidden');
    
    setTimeout(() => {
      this.joinError.classList.add('hidden');
    }, 3000);
  }

  // Setup socket listeners for real-time communication
  private setupSocketListeners(): void {
    // Handle participant joined event
    socketService.onParticipantJoined((data) => {
      console.log('Participant joined:', data.participant);
      
      // Add participant if not already in the list
      if (!this.participants.some(p => p.id === data.participant.id)) {
        this.participants.push(data.participant);
        this.renderParticipantsCircle();
      }
    });
    
    // Handle participant disconnected event
    socketService.onParticipantDisconnected((data) => {
      console.log('Participant disconnected:', data.participantId);
      
      // Remove the participant from the list
      this.participants = this.participants.filter(p => p.id !== data.participantId);
      
      // Also remove from voted list if they had voted
      this.participantsWhoVoted = this.participantsWhoVoted.filter(id => id !== data.participantId);
      
      this.renderParticipantsCircle();
      this.updateRevealButtonState();
    });
    
    // Handle room info update
    socketService.onRoomInfo((roomInfo) => {
      console.log('Room info updated:', roomInfo);
      
      this.participants = roomInfo.participants;
      this.participantsWhoVoted = roomInfo.participantsWhoVoted || [];
      
      if (roomInfo.room.currentStoryName) {
        this.currentStoryName = roomInfo.room.currentStoryName;
        this.currentStory.textContent = this.currentStoryName;
      }
      
      this.renderParticipantsCircle();
      this.updateRevealButtonState();
    });
    
    // Handle when someone submits an estimate
    socketService.onEstimateReceived((data) => {
      console.log('Estimate received from:', data.participantId);
      
      if (!this.participantsWhoVoted.includes(data.participantId)) {
        this.participantsWhoVoted.push(data.participantId);
        this.renderParticipantsCircle();
        this.updateRevealButtonState();
      }
    });
    
    // Handle estimates revealed event
    socketService.onEstimatesRevealed((data: EstimatesRevealedEvent) => {
      console.log('Estimates revealed:', data);
      
      this.estimatesRevealed = true;
      this.estimates = data.estimates;
      
      this.renderParticipantsCircle();
      this.showResults();
    });
    
    // Handle estimates cleared event
    socketService.onEstimatesCleared(() => {
      console.log('Estimates cleared');
      this.clearEstimates();
    });
    
    // Handle story name updated event
    socketService.onStoryNameUpdated((data) => {
      console.log('Story name updated:', data.storyName);
      
      this.currentStoryName = data.storyName;
      this.currentStory.textContent = data.storyName;
      
      // Clear estimates when story changes
      this.clearEstimates();
    });
    
    // Handle room deleted event
    socketService.onRoomDeleted((data) => {
      console.log('Room deleted:', data);
      
      // Show message to user
      alert(data.message);
      
      // Clear session and return to join view
      this.clearSession();
      this.joinView.classList.remove('hidden');
      this.roomView.classList.add('hidden');
    });
    
    // Handle error event
    socketService.onError((data) => {
      console.error('Socket error:', data.message);
      this.showJoinError(data.message);
    });

    // Handle participant removed event
    socketService.onParticipantRemoved((data) => {
      console.log('Participant has been Removed', data);
      
      // Show message to user
      alert(data.message);
      
      // Clear session and return to join view
      this.clearSession();
      this.joinView.classList.remove('hidden');
      this.roomView.classList.add('hidden');
    });
  }
} 