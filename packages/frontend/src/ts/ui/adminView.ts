import { apiService } from '../api/apiService';
import { Room, Participant, BlockedIP, LogFilters, LogEntry } from '../models';

export class AdminView {
  private adminToken: string | null = null;
  private currentTab: 'rooms' | 'ip-blocking' | 'logs' = 'rooms';
  private currentRooms: Room[] = [];
  private currentBlockedIPs: BlockedIP[] = [];
  private currentLogs: LogEntry[] = [];
  private logFilters: LogFilters = {
    page: 1,
    limit: 20
  };
  private totalLogPages: number = 1;

  // DOM elements
  private adminLoginView: HTMLElement;
  private adminView: HTMLElement;
  private usernameInput: HTMLInputElement;
  private passwordInput: HTMLInputElement;
  private loginButton: HTMLButtonElement;
  private loginError: HTMLElement;
  private adminLogoutButton: HTMLButtonElement;
  private roomsTabButton: HTMLButtonElement;
  private ipBlockingTabButton: HTMLButtonElement;
  private logsTabButton: HTMLButtonElement;
  private roomsTab: HTMLElement;
  private ipBlockingTab: HTMLElement;
  private logsTab: HTMLElement;
  private createRoomButton: HTMLButtonElement;
  private roomsList: HTMLElement;
  private ipAddressInput: HTMLInputElement;
  private blockReasonInput: HTMLInputElement;
  private blockIPButton: HTMLButtonElement;
  private blockedIPsList: HTMLElement;
  private logLevelSelect: HTMLSelectElement;
  private dateFromInput: HTMLInputElement;
  private dateToInput: HTMLInputElement;
  private searchTermInput: HTMLInputElement;
  private filterLogsButton: HTMLButtonElement;
  private logsList: HTMLElement;
  private logsPagination: HTMLElement;

  constructor() {
    // Get DOM elements
    this.adminLoginView = document.getElementById('admin-login-view') as HTMLElement;
    this.adminView = document.getElementById('admin-view') as HTMLElement;
    this.usernameInput = document.getElementById('username') as HTMLInputElement;
    this.passwordInput = document.getElementById('password') as HTMLInputElement;
    this.loginButton = document.getElementById('loginButton') as HTMLButtonElement;
    this.loginError = document.getElementById('loginError') as HTMLElement;
    this.adminLogoutButton = document.getElementById('adminLogoutButton') as HTMLButtonElement;
    this.roomsTabButton = document.getElementById('roomsTabButton') as HTMLButtonElement;
    this.ipBlockingTabButton = document.getElementById('ipBlockingTabButton') as HTMLButtonElement;
    this.logsTabButton = document.getElementById('logsTabButton') as HTMLButtonElement;
    this.roomsTab = document.getElementById('roomsTab') as HTMLElement;
    this.ipBlockingTab = document.getElementById('ipBlockingTab') as HTMLElement;
    this.logsTab = document.getElementById('logsTab') as HTMLElement;
    this.createRoomButton = document.getElementById('createRoomButton') as HTMLButtonElement;
    this.roomsList = document.getElementById('roomsList') as HTMLElement;
    this.ipAddressInput = document.getElementById('ipAddress') as HTMLInputElement;
    this.blockReasonInput = document.getElementById('blockReason') as HTMLInputElement;
    this.blockIPButton = document.getElementById('blockIPButton') as HTMLButtonElement;
    this.blockedIPsList = document.getElementById('blockedIPsList') as HTMLElement;
    this.logLevelSelect = document.getElementById('logLevel') as HTMLSelectElement;
    this.dateFromInput = document.getElementById('dateFrom') as HTMLInputElement;
    this.dateToInput = document.getElementById('dateTo') as HTMLInputElement;
    this.searchTermInput = document.getElementById('searchTerm') as HTMLInputElement;
    this.filterLogsButton = document.getElementById('filterLogsButton') as HTMLButtonElement;
    this.logsList = document.getElementById('logsList') as HTMLElement;
    this.logsPagination = document.getElementById('logsPagination') as HTMLElement;

    // Check if admin token exists in localStorage
    this.adminToken = localStorage.getItem('adminToken');
    
    // Set up event listeners
    this.loginButton.addEventListener('click', () => this.handleLogin());
    this.adminLogoutButton.addEventListener('click', () => this.handleLogout());
    this.roomsTabButton.addEventListener('click', () => this.switchTab('rooms'));
    this.ipBlockingTabButton.addEventListener('click', () => this.switchTab('ip-blocking'));
    this.logsTabButton.addEventListener('click', () => this.switchTab('logs'));
    this.createRoomButton.addEventListener('click', () => this.handleCreateRoom());
    this.blockIPButton.addEventListener('click', () => this.handleBlockIP());
    this.filterLogsButton.addEventListener('click', () => this.handleFilterLogs());

    // Initialize view
    this.initialize();
  }

  // Initialize the admin view
  private async initialize(): Promise<void> {
    // Check if admin is logged in
    if (this.adminToken) {
      this.showAdminDashboard();
      this.loadInitialData();
    } else {
      this.showAdminLogin();
    }
  }

  // Handle admin login
  private async handleLogin(): Promise<void> {
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value.trim();

    if (!username || !password) {
      this.showLoginError('Please enter username and password');
      return;
    }

    try {
      await apiService.adminLogin(username, password);
      this.showAdminDashboard();
      this.loadInitialData();
    } catch (error: any) {
      this.showLoginError(error.response?.data?.error?.message || 'Login failed');
    }
  }

  // Handle admin logout
  private handleLogout(): void {
    apiService.adminLogout();
    this.showAdminLogin();
  }

  // Switch tabs
  private switchTab(tab: 'rooms' | 'ip-blocking' | 'logs'): void {
    // Hide all tabs
    this.roomsTab.classList.add('hidden');
    this.ipBlockingTab.classList.add('hidden');
    this.logsTab.classList.add('hidden');

    // Remove active class from all tab buttons
    this.roomsTabButton.classList.remove('active');
    this.ipBlockingTabButton.classList.remove('active');
    this.logsTabButton.classList.remove('active');

    // Show selected tab
    switch (tab) {
      case 'rooms':
        this.roomsTab.classList.remove('hidden');
        this.roomsTabButton.classList.add('active');
        this.loadRooms();
        break;
      case 'ip-blocking':
        this.ipBlockingTab.classList.remove('hidden');
        this.ipBlockingTabButton.classList.add('active');
        this.loadBlockedIPs();
        break;
      case 'logs':
        this.logsTab.classList.remove('hidden');
        this.logsTabButton.classList.add('active');
        this.loadLogs();
        break;
    }

    this.currentTab = tab;
  }

  // Handle creating a room
  private async handleCreateRoom(): Promise<void> {
    try {
      const roomName = prompt('Enter a room name (optional):') || undefined;
      const identifierHint = prompt('Enter an identifier hint (optional):') || undefined;
      
      const room = await apiService.createRoom(roomName, identifierHint);
      
      // Show room link
      alert(`Room created! Share this link with participants:\n${window.location.origin}?roomId=${room.uniqueLinkIdentifier}`);
      
      // Reload rooms
      this.loadRooms();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to create room');
    }
  }

  // Handle blocking an IP
  private async handleBlockIP(): Promise<void> {
    const ipAddress = this.ipAddressInput.value.trim();
    const reason = this.blockReasonInput.value.trim() || undefined;

    if (!ipAddress) {
      alert('Please enter an IP address');
      return;
    }

    try {
      await apiService.blockIP(ipAddress, reason);
      
      // Clear inputs
      this.ipAddressInput.value = '';
      this.blockReasonInput.value = '';
      
      // Reload blocked IPs
      this.loadBlockedIPs();
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to block IP');
    }
  }

  // Handle filtering logs
  private handleFilterLogs(): void {
    this.logFilters = {
      level: this.logLevelSelect.value || undefined,
      dateFrom: this.dateFromInput.value || undefined,
      dateTo: this.dateToInput.value || undefined,
      searchTerm: this.searchTermInput.value.trim() || undefined,
      page: 1,
      limit: 20
    };
    
    this.loadLogs();
  }

  // Load initial data
  private async loadInitialData(): Promise<void> {
    switch (this.currentTab) {
      case 'rooms':
        this.loadRooms();
        break;
      case 'ip-blocking':
        this.loadBlockedIPs();
        break;
      case 'logs':
        this.loadLogs();
        break;
    }
  }

  // Load rooms
  private async loadRooms(): Promise<void> {
    try {
      this.currentRooms = await apiService.getAllRooms();
      this.renderRooms();
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  }

  // Load blocked IPs
  private async loadBlockedIPs(): Promise<void> {
    try {
      this.currentBlockedIPs = await apiService.getBlockedIPs();
      this.renderBlockedIPs();
    } catch (error) {
      console.error('Failed to load blocked IPs:', error);
    }
  }

  // Load logs
  private async loadLogs(): Promise<void> {
    try {
      const response = await apiService.getLogs(this.logFilters);
      this.currentLogs = response.logs;
      this.totalLogPages = response.pagination.totalPages;
      this.renderLogs();
      this.renderLogsPagination();
    } catch (error) {
      console.error('Failed to load logs:', error);
    }
  }

  // Set log page
  private setLogPage(page: number): void {
    this.logFilters.page = page;
    this.loadLogs();
  }

  // Render rooms
  private renderRooms(): void {
    this.roomsList.innerHTML = '';
    
    if (this.currentRooms.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No rooms available';
      this.roomsList.appendChild(emptyMessage);
      return;
    }
    
    this.currentRooms.forEach(room => {
      const roomItem = document.createElement('div');
      roomItem.className = 'room-item';
      
      const roomHeader = document.createElement('div');
      roomHeader.className = 'room-header';
      
      const roomStory = document.createElement('h3');
      roomStory.textContent = room.currentStoryName || 'No story set';
      
      const roomInfo = document.createElement('div');
      
      const roomLink = document.createElement('div');
      roomLink.className = 'room-link';
      roomLink.textContent = `${window.location.origin}?roomId=${room.uniqueLinkIdentifier}`;
      
      const roomDate = document.createElement('div');
      roomDate.textContent = `Created: ${new Date(room.createdAt!).toLocaleString()}`;
      
      const buttonContainer = document.createElement('div');
      buttonContainer.className = 'room-buttons';
      
      const viewParticipantsButton = document.createElement('button');
      viewParticipantsButton.className = 'btn secondary-btn';
      viewParticipantsButton.textContent = 'View Participants';
      viewParticipantsButton.addEventListener('click', async () => {
        try {
          const participants = await apiService.getRoomParticipants(room.id);
          this.showParticipantsModal(room, participants);
        } catch (error) {
          alert('Failed to load participants');
        }
      });
      
      const deleteRoomButton = document.createElement('button');
      deleteRoomButton.className = 'btn danger-btn';
      deleteRoomButton.textContent = 'Delete Room';
      deleteRoomButton.addEventListener('click', async () => {
        if (confirm('Are you sure you want to delete this room? This will remove all participants and their estimates.')) {
          try {
            await apiService.deleteRoom(room.id);
            this.loadRooms(); // Refresh the room list
          } catch (error: any) {
            alert(error.response?.data?.error?.message || 'Failed to delete room');
          }
        }
      });
      
      buttonContainer.appendChild(viewParticipantsButton);
      buttonContainer.appendChild(deleteRoomButton);
      
      roomHeader.appendChild(roomStory);
      roomInfo.appendChild(roomLink);
      roomInfo.appendChild(roomDate);
      roomItem.appendChild(roomHeader);
      roomItem.appendChild(roomInfo);
      roomItem.appendChild(buttonContainer);
      this.roomsList.appendChild(roomItem);
    });
  }

  // Show participants modal
  private showParticipantsModal(room: Room, participants: Participant[]): void {
    // Create modal
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    
    const modalHeader = document.createElement('div');
    modalHeader.className = 'modal-header';
    
    const modalTitle = document.createElement('h3');
    modalTitle.textContent = `Room: ${room.uniqueLinkIdentifier}`;
    
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.className = 'modal-close';
    closeButton.addEventListener('click', () => {
      document.body.removeChild(modal);
    });
    
    const participantsList = document.createElement('ul');
    participantsList.className = 'participants-list';
    
    if (participants.length === 0) {
      const emptyMessage = document.createElement('li');
      emptyMessage.textContent = 'No participants in this room';
      participantsList.appendChild(emptyMessage);
    } else {
      participants.forEach(participant => {
        const participantItem = document.createElement('li');
        participantItem.className = 'participant-item';
        
        const participantName = document.createElement('span');
        participantName.textContent = participant.name;
        
        const removeButton = document.createElement('button');
        removeButton.className = 'btn secondary-btn';
        removeButton.textContent = 'Remove';
        removeButton.addEventListener('click', async () => {
          try {
            await apiService.removeParticipant(room.id, participant.id);
            participantItem.remove();
          } catch (error) {
            alert('Failed to remove participant');
          }
        });
        
        participantItem.appendChild(participantName);
        participantItem.appendChild(removeButton);
        participantsList.appendChild(participantItem);
      });
    }
    
    modalHeader.appendChild(modalTitle);
    modalHeader.appendChild(closeButton);
    modalContent.appendChild(modalHeader);
    modalContent.appendChild(participantsList);
    modal.appendChild(modalContent);
    
    document.body.appendChild(modal);
  }

  // Render blocked IPs
  private renderBlockedIPs(): void {
    this.blockedIPsList.innerHTML = '';
    
    if (this.currentBlockedIPs.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No blocked IPs';
      this.blockedIPsList.appendChild(emptyMessage);
      return;
    }
    
    this.currentBlockedIPs.forEach(blockedIP => {
      const blockedIPItem = document.createElement('div');
      blockedIPItem.className = 'blocked-ip-item';
      
      const ipAddress = document.createElement('div');
      ipAddress.className = 'ip-address';
      ipAddress.textContent = blockedIP.ipAddress;
      
      const reason = document.createElement('div');
      reason.className = 'ip-reason';
      reason.textContent = blockedIP.reason || 'No reason provided';
      
      const dateBlocked = document.createElement('div');
      dateBlocked.className = 'ip-date';
      dateBlocked.textContent = `Blocked: ${new Date(blockedIP.createdAt).toLocaleString()}`;
      
      const unblockButton = document.createElement('button');
      unblockButton.className = 'btn secondary-btn';
      unblockButton.textContent = 'Unblock';
      unblockButton.addEventListener('click', async () => {
        try {
          await apiService.unblockIP(blockedIP.ipAddress);
          blockedIPItem.remove();
        } catch (error) {
          alert('Failed to unblock IP');
        }
      });
      
      blockedIPItem.appendChild(ipAddress);
      blockedIPItem.appendChild(reason);
      blockedIPItem.appendChild(dateBlocked);
      blockedIPItem.appendChild(unblockButton);
      this.blockedIPsList.appendChild(blockedIPItem);
    });
  }

  // Render logs
  private renderLogs(): void {
    this.logsList.innerHTML = '';
    
    if (this.currentLogs.length === 0) {
      const emptyMessage = document.createElement('div');
      emptyMessage.textContent = 'No logs found';
      this.logsList.appendChild(emptyMessage);
      return;
    }
    
    this.currentLogs.forEach(log => {
      const logItem = document.createElement('div');
      logItem.className = `log-item log-${log.level.toLowerCase()}`;
      
      const logHeader = document.createElement('div');
      logHeader.className = 'log-header';
      
      const logLevel = document.createElement('span');
      logLevel.className = 'log-level';
      logLevel.textContent = log.level;
      
      const logTimestamp = document.createElement('span');
      logTimestamp.className = 'log-timestamp';
      logTimestamp.textContent = new Date(log.timestamp).toLocaleString();
      
      const logMessage = document.createElement('div');
      logMessage.className = 'log-message';
      logMessage.textContent = log.message;
      
      logHeader.appendChild(logLevel);
      logHeader.appendChild(logTimestamp);
      logItem.appendChild(logHeader);
      logItem.appendChild(logMessage);
      
      if (log.meta) {
        const logMeta = document.createElement('pre');
        logMeta.className = 'log-meta';
        logMeta.textContent = JSON.stringify(log.meta, null, 2);
        logItem.appendChild(logMeta);
      }
      
      this.logsList.appendChild(logItem);
    });
  }

  // Render logs pagination
  private renderLogsPagination(): void {
    this.logsPagination.innerHTML = '';
    
    if (this.totalLogPages <= 1) {
      return;
    }
    
    const currentPage = this.logFilters.page || 1;
    
    // Previous button
    if (currentPage > 1) {
      const prevButton = document.createElement('button');
      prevButton.className = 'pagination-btn';
      prevButton.textContent = '←';
      prevButton.addEventListener('click', () => {
        this.setLogPage(currentPage - 1);
      });
      this.logsPagination.appendChild(prevButton);
    }
    
    // Page buttons
    for (let i = 1; i <= this.totalLogPages; i++) {
      if (
        i === 1 ||
        i === this.totalLogPages ||
        (i >= currentPage - 2 && i <= currentPage + 2)
      ) {
        const pageButton = document.createElement('button');
        pageButton.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        pageButton.textContent = i.toString();
        pageButton.addEventListener('click', () => {
          this.setLogPage(i);
        });
        this.logsPagination.appendChild(pageButton);
      } else if (
        i === currentPage - 3 ||
        i === currentPage + 3
      ) {
        const ellipsis = document.createElement('span');
        ellipsis.className = 'pagination-ellipsis';
        ellipsis.textContent = '...';
        this.logsPagination.appendChild(ellipsis);
      }
    }
    
    // Next button
    if (currentPage < this.totalLogPages) {
      const nextButton = document.createElement('button');
      nextButton.className = 'pagination-btn';
      nextButton.textContent = '→';
      nextButton.addEventListener('click', () => {
        this.setLogPage(currentPage + 1);
      });
      this.logsPagination.appendChild(nextButton);
    }
  }

  // Show admin login
  private showAdminLogin(): void {
    this.adminLoginView.classList.remove('hidden');
    this.adminView.classList.add('hidden');
  }

  // Show admin dashboard
  private showAdminDashboard(): void {
    this.adminLoginView.classList.add('hidden');
    this.adminView.classList.remove('hidden');
    this.switchTab('rooms');
  }

  // Show login error
  private showLoginError(message: string): void {
    this.loginError.textContent = message;
    setTimeout(() => {
      this.loginError.textContent = '';
    }, 5000);
  }
} 