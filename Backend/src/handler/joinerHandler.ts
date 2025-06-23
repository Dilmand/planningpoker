import { IMessageHandler } from '../core/webSocketServer';
import { WebSocketClient } from '../core/webSocketClient';
import { IClientMessage } from '../core/webSocketClient';
import { RoomManager } from '../core/roomManager';

export interface JoinerPayload {
    action: 'join' | 'vote' | 'reveal' | 'leave';
    roomId: string;
    userName?: string;
    voteValue?: string;
    storyId?: string;
}

export class JoinerHandler implements IMessageHandler {
    private roomManager: RoomManager;

    constructor() {
        this.roomManager = new RoomManager();
    }

    async handle(client: WebSocketClient, message: IClientMessage): Promise<void> {

        console.log(`Joiner action received from client ${client.id}:`, message.payload);
        
        try {
            const payload = this.validatePayload(message.payload);
            if (!payload) {
                await this.sendError(client, 'Invalid joiner payload. Required fields: action, roomId');
                return;
            }
            
            await this.processJoinerAction(client, payload);
        } catch (error: any) {
            await this.sendError(client, `Error processing joiner action: ${error.message}`);
        }
    }
    
    private validatePayload(payload: any): JoinerPayload | null {
        if (!payload || !payload.action || !payload.roomId) {
            return null;
        }

        // Validate action-specific required fields
        if (payload.action === 'join' && !payload.userName) {
            return null;
        }
        if (payload.action === 'vote' && (!payload.voteValue || !payload.storyId)) {
            return null;
        }
        if (payload.action === 'reveal' && !payload.storyId) {
            return null;
        }

        return payload as JoinerPayload;
    }
    
    private async processJoinerAction(client: WebSocketClient, payload: JoinerPayload): Promise<void> {
        const actionHandlers: Record<string, () => Promise<void>> = {
            'join': async () => {
                if (!payload.userName) {
                    await this.sendError(client, 'User name is required for join action');
                    return;
                }
                this.roomManager.joinRoom(payload.roomId, client.id);
                await this.sendJoinSuccess(client, payload);
            },
            'vote': async () => {
                if (!payload.voteValue || !payload.storyId) {
                    await this.sendError(client, 'Vote value and story ID are required for vote action');
                    return;
                }
                // Store the vote for this user and story
                await this.sendSuccess(client, `Your vote (${payload.voteValue}) has been recorded`);
            },
            'reveal': async () => {
                if (!payload.storyId) {
                    await this.sendError(client, 'Story ID is required for reveal action');
                    return;
                }
                
                // Check if all participants have voted
                const allVoted = true; // This will need actual implementation
                
                if (allVoted) {
                    // Reveal the votes if everyone has voted
                    await this.sendSuccess(client, `Votes have been revealed for story ${payload.storyId}`);
                } else {
                    await this.sendError(client, 'Cannot reveal votes until all participants have voted');
                }
            },
            'leave': async () => {
                this.roomManager.leaveRoom(payload.roomId, client.id);
                await this.sendSuccess(client, `You have left room ${payload.roomId}`);
            }
        };
        
        const handler = actionHandlers[payload.action];
        if (handler) {
            await handler();
        } else {
            await this.sendError(client, `Unknown joiner action: ${payload.action}`);
        }
    }
    
    private async sendJoinSuccess(client: WebSocketClient, payload: JoinerPayload): Promise<void> {
        await client.send({ 
            type: 'joinSuccess', 
            payload: {
                roomId: payload.roomId,
                userName: payload.userName,
                message: `Room ${payload.roomId} joined as ${payload.userName}`
            }
        });
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