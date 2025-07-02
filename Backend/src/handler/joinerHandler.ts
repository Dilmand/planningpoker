import { IMessageHandler } from '../core/webSocketServer';
import { WebSocketClient } from '../core/webSocketClient';
import { RoomManager } from '../core/roomManager';
import { WebSocketServer } from '../core/webSocketServer';

export interface JoinerPayload {
    action: 'joinRoom' | 'vote' | 'revealCards' | 'leaveRoom';
    roomId: string;
    userName?: string;
    voteValue?: string;
    storyId?: string;
}

export class JoinerHandler implements IMessageHandler {
    private roomManager: RoomManager;
    private webSocketServer: WebSocketServer;

    constructor(webSocketServer: WebSocketServer) {
        this.roomManager = new RoomManager();
        this.webSocketServer = webSocketServer;
    }

    async handle(client: WebSocketClient, receivedPayload: any): Promise<void> {

        console.log(`Joiner action received from client ${client.id}:`, receivedPayload);
        
        try {
            const payload = this.validatePayload(receivedPayload);
            if (!payload) {
                await this.send(client, 'error', 'Invalid joiner payload. Required fields: action, roomId');
                return;
            }
            
            await this.processJoinerAction(client, payload);
        } catch (error: any) {
            await this.send(client, 'error', `Error processing joiner action: ${error.message}`);
        }
    }
    
    private validatePayload(payload: any): JoinerPayload | null {
    
        return payload as JoinerPayload;
    }
    
    private async processJoinerAction(client: WebSocketClient, payload: JoinerPayload): Promise<void> {
        const actionHandlers: Record<JoinerPayload["action"], () => Promise<void>> = {
            'joinRoom': async () => {
                if (!payload.userName) {
                    console.log(`User name is required for join action from client ${client.id}`);
                    await this.send(client, 'error', 'User name is required for join action');
                    return;
                }
                client.setClientName(payload.userName);
                const roomName = this.roomManager.getRoomName(payload.roomId);
                const joined = this.roomManager.joinRoom(payload.roomId, client.id);
                
                if (joined) {
                    // Get all clients in the room
                    const allClientsInRoom = this.roomManager.getClientsInRoom(payload.roomId);
                    const otherClients = allClientsInRoom.filter(id => id !== client.id);
                    
                    // Get participant details for all existing clients
                    const participants = [];
                    for (const clientId of allClientsInRoom) {
                        const clientObj = this.webSocketServer.getClient(clientId);
                        if (clientObj) {
                            participants.push({
                                userId: clientId,
                                userName: clientObj.getClientName(),
                                isAdmin: this.roomManager.isAdmin(payload.roomId, clientId)
                            });
                        }
                    }
                    
                    // Send success response to the joining client with the current participant list
                    await this.send(client, 'success', {
                        action: 'joinRoom',
                        roomId: payload.roomId,
                        roomName: roomName,
                        userName: payload.userName,
                        participants: participants
                    });
                    
                    // Broadcast to all other clients in the room
                    this.webSocketServer.broadcast(otherClients, {
                        type: 'notification',
                        payload: {
                            action: 'userJoined',
                            roomId: payload.roomId,
                            userName: payload.userName,
                            userId: client.id
                        }
                    });
                } else {
                    await this.send(client, 'error', `Failed to join room ${payload.roomId}`);
                }
            },
            'vote': async () => {
                if (!payload.voteValue || !payload.storyId) {
                    await this.send(client, 'error', 'Vote value and story ID are required for vote action');
                    return;
                }
                // Store the vote for this user and story
                await this.send(client, 'success', {
                    action: 'vote',
                    storyId: payload.storyId,
                    voteValue: payload.voteValue
                });
            },
            'revealCards': async () => {
                if (!payload.storyId) {
                    await this.send(client, 'error', 'Story ID is required for reveal action');
                    return;
                }
                
                // Check if all participants have voted
                const allVoted = true; // This will need actual implementation
                
                if (allVoted) {
                    // Reveal the votes if everyone has voted
                    await this.send(client, 'success', {
                        action: 'revealCards',
                        storyId: payload.storyId
                    });
                } else {
                    await this.send(client, 'error', 'Cannot reveal votes until all participants have voted');
                }
            },
            'leaveRoom': async () => {
                // Notify others before this client leaves
                const allClientsInRoom = this.roomManager.getClientsInRoom(payload.roomId);
                const otherClients = allClientsInRoom.filter(id => id !== client.id);
                
                this.webSocketServer.broadcast(otherClients, {
                    type: 'notification',
                    payload: {
                        action: 'userLeft',
                        roomId: payload.roomId,
                        userName: client.getClientName(),
                        userId: client.id
                    }
                });
                
                this.roomManager.leaveRoom(payload.roomId, client.id);
                await this.send(client, 'success', {
                    action: 'leaveRoom',
                    roomId: payload.roomId
                });
            }
        };
        
        const handler = actionHandlers[payload.action];
        if (handler) {
            await handler();
        } else {
            await this.send(client, 'error', `Unknown joiner action: ${payload.action}`);
        }
    }
    
    private async send(client: WebSocketClient, type: string, message: any): Promise<void> {
        await client.send({ 
            type: type, 
            payload: message 
        });
    }
}