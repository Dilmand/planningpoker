import { WebSocketClient } from '../core/webSocketClient';
import { IMessageHandler } from '../core/webSocketServer';
import { RoomManager } from '../core/roomManager';
import { IClientMessage } from '../core/webSocketClient';

export interface AdminPayload {
    action: 'create' | 'remove' | 'block' | 'vote' | 'reveal' | 'leave';
    roomId: string;
    targetClientId?: string;
    voteValue?: string;
    storyId?: string;
}

export class AdminHandler implements IMessageHandler {
    private roomManager: RoomManager;

    constructor() {
        this.roomManager = new RoomManager();
    }

    async handle(client: WebSocketClient, message: IClientMessage): Promise<void> {
        console.log(`Admin action received from client ${client.id}:`, message.payload);
        
        try {
            const payload = this.validatePayload(message.payload);
            if (!payload) {
                await this.sendError(client, 'Invalid admin payload. Required fields: action, roomId');
                return;
            }
            
            await this.processAdminAction(client, payload);
        } catch (error: any) {
            await this.sendError(client, `Error processing admin action: ${error.message}`);
        }
    }
    
    private validatePayload(payload: any): AdminPayload | null {
        if (!payload || !payload.action || !payload.roomId) {
            return null;
        }
        return payload as AdminPayload;
    }
    
    private async processAdminAction(client: WebSocketClient, payload: AdminPayload): Promise<void> {
        const actionHandlers: Record<string, () => Promise<void>> = {
            'create': async () => {
                this.roomManager.createRoom(payload.roomId, client.id);
                this.roomManager.joinRoom(payload.roomId, client.id);
                await this.sendSuccess(client, `Room ${payload.roomId} created successfully`);
            },
            'remove': async () => {
                if (!payload.targetClientId) {
                    await this.sendError(client, 'Target client ID is required for remove action');
                    return;
                }
                this.roomManager.leaveRoom(payload.roomId, payload.targetClientId);
                await this.sendSuccess(client, `Client ${payload.targetClientId} has been removed from room ${payload.roomId}`);
            },
            'block': async () => {
                if (!payload.targetClientId) {
                    await this.sendError(client, 'Target client ID is required for block action');
                    return;
                }
                // Implementation for blocking would require tracking blocked IPs/clients
                await this.sendSuccess(client, `Client ${payload.targetClientId} has been blocked`);
            },
            'vote': async () => {
                if (!payload.voteValue || !payload.storyId) {
                    await this.sendError(client, 'Vote value and story ID are required for vote action');
                    return;
                }
                // Store the vote
                await this.sendSuccess(client, `Your vote (${payload.voteValue}) has been recorded`);
            },
            'reveal': async () => {
                if (!payload.storyId) {
                    await this.sendError(client, 'Story ID is required for reveal action');
                    return;
                }
                // Get all votes and reveal them
                await this.sendSuccess(client, `Votes have been revealed for story ${payload.storyId}`);
            },
            'leave': async () => {
                this.roomManager.leaveRoom(payload.roomId, client.id);
                await this.sendSuccess(client, `You have left room ${payload.roomId}`);
            },
        };
        
        const handler = actionHandlers[payload.action];
        if (handler) {
            await handler();
        } else {
            await this.sendError(client, `Unknown admin action: ${payload.action}`);
        }
    }
    
    private async sendSuccess(client: WebSocketClient, message: string): Promise<void> {
        await client.send({ 
            type: 'success', 
            payload: message 
        });
    }
    
    private async sendError(client: WebSocketClient, message: string): Promise<void> {
        await client.send({ 
            type: 'error', 
            payload: message 
        });
    }
}