import axios, { AxiosInstance, AxiosResponse } from 'axios';
import {
  JoinRoomResponse,
  Room,
  Participant,
  AdminLoginResponse,
  BlockedIP,
  LogsResponse,
  LogFilters
} from '../models';

class ApiService {
  private api: AxiosInstance;
  private adminToken: string | null = null;

  constructor() {
    this.api = axios.create({
      baseURL: '/api',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Try to get stored token from localStorage
    this.adminToken = localStorage.getItem('adminToken');
  }

  // Set auth token for admin requests
  setAuthToken(token: string | null): void {
    this.adminToken = token;
    if (token) {
      localStorage.setItem('adminToken', token);
    } else {
      localStorage.removeItem('adminToken');
    }
  }

  // Get auth headers for admin requests
  private getAuthHeaders() {
    return this.adminToken ? { Authorization: `Bearer ${this.adminToken}` } : {};
  }

  // Player API

  async joinRoom(uniqueLinkIdentifier: string, participantName: string): Promise<JoinRoomResponse> {
    const response: AxiosResponse<JoinRoomResponse> = await this.api.post('/rooms/join', {
      uniqueLinkIdentifier,
      participantName
    });
    return response.data;
  }

  // Admin API

  async adminLogin(username: string, password: string): Promise<AdminLoginResponse> {
    const response: AxiosResponse<AdminLoginResponse> = await this.api.post('/admin/login', {
      username,
      password
    });
    this.setAuthToken(response.data.token);
    return response.data;
  }

  async adminLogout(): Promise<void> {
    this.setAuthToken(null);
  }

  async createRoom(roomName?: string, identifierHint?: string): Promise<Room> {
    const response: AxiosResponse<Room> = await this.api.post(
      '/admin/rooms',
      { roomName, identifierHint },
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async getAllRooms(): Promise<Room[]> {
    const response: AxiosResponse<Room[]> = await this.api.get('/admin/rooms', {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async getRoomParticipants(roomId: string): Promise<Participant[]> {
    const response: AxiosResponse<Participant[]> = await this.api.get(`/admin/rooms/${roomId}/participants`, {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async removeParticipant(roomId: string, participantId: string): Promise<Participant> {
    const response: AxiosResponse<Participant> = await this.api.delete(
      `/admin/rooms/${roomId}/participants/${participantId}`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async blockIP(ipAddress: string, reason?: string): Promise<BlockedIP> {
    const response: AxiosResponse<BlockedIP> = await this.api.post(
      '/admin/ip-block',
      { ipAddress, reason },
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async getBlockedIPs(): Promise<BlockedIP[]> {
    const response: AxiosResponse<BlockedIP[]> = await this.api.get('/admin/ip-block', {
      headers: this.getAuthHeaders()
    });
    return response.data;
  }

  async unblockIP(ipAddress: string): Promise<{ message: string }> {
    const response: AxiosResponse<{ message: string }> = await this.api.delete(
      `/admin/ip-block/${ipAddress}`,
      { headers: this.getAuthHeaders() }
    );
    return response.data;
  }

  async getLogs(filters: LogFilters = {}): Promise<LogsResponse> {
    const response: AxiosResponse<LogsResponse> = await this.api.get('/admin/logs', {
      headers: this.getAuthHeaders(),
      params: filters
    });
    return response.data;
  }

  async deleteRoom(roomId: string): Promise<void> {
    await this.api.delete(`/admin/rooms/${roomId}`, {
      headers: this.getAuthHeaders()
    });
  }
}

// Export a singleton instance
export const apiService = new ApiService(); 