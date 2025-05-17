import { io, Socket } from 'socket.io-client';
import { Participant, RoomInfo, EstimatesRevealedEvent } from '../models';

// Define event handlers
type ParticipantJoinedHandler = (participant: { participant: Participant }) => void;
type ParticipantDisconnectedHandler = (data: { participantId: string }) => void;
type RoomInfoHandler = (roomInfo: RoomInfo) => void;
type EstimateReceivedHandler = (data: { participantId: string }) => void;
type EstimatesRevealedHandler = (data: EstimatesRevealedEvent) => void;
type EstimatesClearedHandler = (data: { storyName?: string }) => void;
type StoryNameUpdatedHandler = (data: { storyName: string }) => void;
type ErrorHandler = (data: { message: string }) => void;
type RoomDeletedHandler = (data: { roomId: string; message: string }) => void;
type ParticipantRemovedHandler = (data: { message: string }) => void;

class SocketService {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private participantId: string | null = null;

  // Event handlers
  private participantJoinedHandlers: ParticipantJoinedHandler[] = [];
  private participantDisconnectedHandlers: ParticipantDisconnectedHandler[] = [];
  private roomInfoHandlers: RoomInfoHandler[] = [];
  private estimateReceivedHandlers: EstimateReceivedHandler[] = [];
  private estimatesRevealedHandlers: EstimatesRevealedHandler[] = [];
  private estimatesClearedHandlers: EstimatesClearedHandler[] = [];
  private storyNameUpdatedHandlers: StoryNameUpdatedHandler[] = [];
  private errorHandlers: ErrorHandler[] = [];
  private roomDeletedHandlers: RoomDeletedHandler[] = [];
  private participantRemovedHandlers: ParticipantRemovedHandler[] = [];

  // Connect to the WebSocket server
  connect(): void {
    if (!this.socket) {
      this.socket = io();
      this.registerEventHandlers();

      this.socket.on('disconnect', () => {
        if (this.roomId && this.participantId) {
          fetch('/api/rooms/leave', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              roomId: this.roomId,
              participantId: this.participantId
            })
          }).catch(error => {
            console.error('Error notifying server of disconnect:', error);
          });
        }
      });

      window.addEventListener('beforeunload', () => {
        if (this.socket) {
          this.socket.disconnect();
        }
      });
    }
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.roomId = null;
      this.participantId = null;
    }
  }

  joinRoom(roomId: string, participantId: string): void {
    if (!this.socket) {
      this.connect();
    }

    this.roomId = roomId;
    this.participantId = participantId;

    if (this.socket) {
      this.socket.emit('joinRoom', { roomId, participantId });
    }
  }

  leaveRoom(): void {
    if (this.socket && this.roomId && this.participantId) {
      this.socket.emit('leaveRoom', {
        roomId: this.roomId,
        participantId: this.participantId
      });
      this.socket.disconnect();
      this.socket = null;
      this.roomId = null;
      this.participantId = null;
    }
  }

  // Submit an estimate
  submitEstimate(estimateValue: string, storyName?: string): void {
    if (this.socket && this.roomId && this.participantId) {
      this.socket.emit('submitEstimate', {
        roomId: this.roomId,
        participantId: this.participantId,
        estimateValue,
        storyName
      });
    }
  }

  // Reveal estimates
  revealEstimates(): void {
    if (this.socket && this.roomId) {
      this.socket.emit('revealEstimates', { roomId: this.roomId });
    }
  }

  // Clear estimates
  clearEstimates(): void {
    if (this.socket && this.roomId) {
      this.socket.emit('clearEstimates', { roomId: this.roomId });
    }
  }

  // Set story name
  setStoryName(storyName: string): void {
    if (this.socket && this.roomId) {
      this.socket.emit('setStoryName', { roomId: this.roomId, storyName });
    }
  }

  // Register WebSocket event handlers
  private registerEventHandlers(): void {
    if (!this.socket) return;

    this.socket.on('participantJoined', (data) => {
      this.participantJoinedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('participantDisconnected', (data) => {
      this.participantDisconnectedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('roomInfo', (data) => {
      this.roomInfoHandlers.forEach(handler => handler(data));
    });

    this.socket.on('estimateReceived', (data) => {
      this.estimateReceivedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('estimatesRevealed', (data) => {
      this.estimatesRevealedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('estimatesCleared', (data) => {
      this.estimatesClearedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('storyNameUpdated', (data) => {
      this.storyNameUpdatedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('error', (data) => {
      this.errorHandlers.forEach(handler => handler(data));
    });

    this.socket.on('roomDeleted', (data) => {
      this.roomDeletedHandlers.forEach(handler => handler(data));
    });

    this.socket.on('participantRemoved', (data) => {
      this.participantRemovedHandlers.forEach(handler => handler(data));
    });
  }

  // Add event listeners
  onParticipantJoined(handler: ParticipantJoinedHandler): void {
    this.participantJoinedHandlers.push(handler);
  }

  onParticipantDisconnected(handler: ParticipantDisconnectedHandler): void {
    this.participantDisconnectedHandlers.push(handler);
  }

  onRoomInfo(handler: RoomInfoHandler): void {
    this.roomInfoHandlers.push(handler);
  }

  onEstimateReceived(handler: EstimateReceivedHandler): void {
    this.estimateReceivedHandlers.push(handler);
  }

  onEstimatesRevealed(handler: EstimatesRevealedHandler): void {
    this.estimatesRevealedHandlers.push(handler);
  }

  onEstimatesCleared(handler: EstimatesClearedHandler): void {
    this.estimatesClearedHandlers.push(handler);
  }

  onStoryNameUpdated(handler: StoryNameUpdatedHandler): void {
    this.storyNameUpdatedHandlers.push(handler);
  }

  onError(handler: ErrorHandler): void {
    this.errorHandlers.push(handler);
  }

  onRoomDeleted(handler: RoomDeletedHandler): void {
    this.roomDeletedHandlers.push(handler);
  }

  onParticipantRemoved(handler: ParticipantRemovedHandler): void {
    this.participantRemovedHandlers.push(handler);
  }

  // Remove event listeners
  offParticipantJoined(handler: ParticipantJoinedHandler): void {
    this.participantJoinedHandlers = this.participantJoinedHandlers.filter(h => h !== handler);
  }

  offParticipantDisconnected(handler: ParticipantDisconnectedHandler): void {
    this.participantDisconnectedHandlers = this.participantDisconnectedHandlers.filter(h => h !== handler);
  }

  offRoomInfo(handler: RoomInfoHandler): void {
    this.roomInfoHandlers = this.roomInfoHandlers.filter(h => h !== handler);
  }

  offEstimateReceived(handler: EstimateReceivedHandler): void {
    this.estimateReceivedHandlers = this.estimateReceivedHandlers.filter(h => h !== handler);
  }

  offEstimatesRevealed(handler: EstimatesRevealedHandler): void {
    this.estimatesRevealedHandlers = this.estimatesRevealedHandlers.filter(h => h !== handler);
  }

  offEstimatesCleared(handler: EstimatesClearedHandler): void {
    this.estimatesClearedHandlers = this.estimatesClearedHandlers.filter(h => h !== handler);
  }

  offStoryNameUpdated(handler: StoryNameUpdatedHandler): void {
    this.storyNameUpdatedHandlers = this.storyNameUpdatedHandlers.filter(h => h !== handler);
  }

  offError(handler: ErrorHandler): void {
    this.errorHandlers = this.errorHandlers.filter(h => h !== handler);
  }

  offRoomDeleted(handler: RoomDeletedHandler): void {
    this.roomDeletedHandlers = this.roomDeletedHandlers.filter(h => h !== handler);
  }

  offParticipantRemoved(handler: ParticipantRemovedHandler): void {
    this.participantRemovedHandlers = this.participantRemovedHandlers.filter(h => h !== handler);
  }
}

// Export a singleton instance
export const socketService = new SocketService();