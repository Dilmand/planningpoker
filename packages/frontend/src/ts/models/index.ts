// Room
export interface Room {
  id: string;
  uniqueLinkIdentifier: string;
  currentStoryName?: string;
  createdAt?: string;
}

// Participant
export interface Participant {
  id: string;
  name: string;
  roomId?: string;
  isActive?: boolean;
  socketId?: string;
}

// Estimate
export interface Estimate {
  participantId: string;
  participantName: string;
  value: string;
}

// JoinRoomResponse
export interface JoinRoomResponse {
  room: Room;
  participant: Participant;
  participants: Participant[];
}

// API Error
export interface ApiError {
  error: {
    message: string;
    status: number;
    details?: any;
  };
}

// Room Info from WebSocket
export interface RoomInfo {
  room: Room;
  participants: Participant[];
  participantsWhoVoted: string[];
}

// Estimates Revealed Event
export interface EstimatesRevealedEvent {
  estimates: Estimate[];
  storyName?: string;
}

// Admin
export interface AdminUser {
  id: string;
  username: string;
}

// Admin Login Response
export interface AdminLoginResponse {
  token: string;
  user: AdminUser;
}

// BlockedIP
export interface BlockedIP {
  id: string;
  ipAddress: string;
  reason?: string;
  createdAt: string;
}

// Log Entry
export interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  message: string;
  meta?: any;
}

// Log Response
export interface LogsResponse {
  logs: LogEntry[];
  pagination: {
    page: number;
    limit: number;
    totalLogs: number;
    totalPages: number;
  };
}

// Log Filters
export interface LogFilters {
  level?: string;
  dateFrom?: string;
  dateTo?: string;
  searchTerm?: string;
  page?: number;
  limit?: number;
} 