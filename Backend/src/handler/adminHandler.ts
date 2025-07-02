import { WebSocketClient } from '../core/webSocketClient';
import { IMessageHandler } from '../core/webSocketServer';
import { RoomManager } from '../core/roomManager';
import { WebSocketServer } from '../core/webSocketServer';

export interface AdminPayload {
    action: 'createRoom' | 'removeRoom' | 'blockUser' | 'vote' | 'revealCards' | 'leaveRoom';
    roomId?: string;
    roomName?: string;
    userName?: string;
    targetClientId?: string;
    voteValue?: string;
    storyId?: string;
}

export class AdminHandler implements IMessageHandler {
    private roomManager: RoomManager;
    private webSocketServer: WebSocketServer;

    constructor(webSocketServer: WebSocketServer) {
        this.roomManager = new RoomManager();
        this.webSocketServer = webSocketServer;
    }

    async handle(client: WebSocketClient, receivedPayload: any): Promise<void> {
        console.log(`Admin action received from client ${client.id}:`, receivedPayload);

        try {
            const payload = this.validatePayload(receivedPayload);
            if (!payload) {
                await this.send(client, "error",'Invalid admin payload. Required fields: action, roomId');
                return;
            }

            await this.processAdminAction(client, payload);
        } catch (error: any) {
            await this.send(client,"error" ,`Error processing admin action: ${error.message}`);
        }
    }

    private validatePayload(payload: any): AdminPayload | null {
        if (!payload) {
            return null;
        }
        return payload as AdminPayload;
    }

    private async processAdminAction(client: WebSocketClient, payload: AdminPayload): Promise<void> {
        const actionHandlers: Record<AdminPayload["action"], () => Promise<void>> = {
            'createRoom': async () => {
                if (!payload.userName) {
                    console.log(`User name is required for create room action from client ${client.id}`);
                    await this.send(client,"error" ,'User name is required for create room action');
                    return;
                }
                if (!payload.roomName) {
                    console.log(`Room name is required for create room action from client ${client.id}`);
                    await this.send(client,"error", 'Room name is required for create room action');
                    return;
                }
                client.setClientName(payload.userName);
                const roomId = this.roomManager.createRoom(client.id, payload.roomName);
                
                // Get all clients in the room (should just be the admin at this point)
                const allClientsInRoom = this.roomManager.getClientsInRoom(roomId);
                
                // Get participant details
                const participants = [];
                for (const clientId of allClientsInRoom) {
                    const clientObj = this.webSocketServer.getClient(clientId);
                    if (clientObj) {
                        participants.push({
                            userId: clientId,
                            userName: clientObj.getClientName(),
                            isAdmin: this.roomManager.isAdmin(roomId, clientId)
                        });
                    }
                }
                
                await this.send(client, "success", {
                    action: "createRoom",
                    roomId: roomId,
                    roomName: payload.roomName,
                    participants: participants
                });
            },
            'removeRoom': async () => {
                if (!payload.targetClientId) {
                    await this.send(client, "error",'Target client ID is required for remove action');
                    return;
                }

                if (!payload.roomId) {
                    await this.send(client, "error", 'Room ID is required for remove action');
                    return;
                }

                if (!this.roomManager.roomExists(payload.roomId)) {
                    await this.send(client, "error", `Room ${payload.roomId} does not exist`);
                    return;
                }

                this.roomManager.leaveRoom(payload.roomId, payload.targetClientId);
                await this.send(client,"success" , {
                    action: "removeRoom",
                    roomId: payload.roomId,
                    targetClientId: payload.targetClientId
                });
            },
            'blockUser': async () => {
                if (!payload.targetClientId) {
                    await this.send(client, "error", 'Target client ID is required for block action');
                    return;
                }
                // Implementation for blocking would require tracking blocked IPs/clients
                await this.send(client, "success", {
                    action: "blockUser",
                    targetClientId: payload.targetClientId
                });
            },
            'vote': async () => {
                if (!payload.voteValue || !payload.storyId) {
                    await this.send(client, "error",'Vote value and story ID are required for vote action');
                    return;
                }
                await this.send(client,"success", {
                    action: "vote",
                    storyId: payload.storyId,
                    voteValue: payload.voteValue
                });
            },
            'revealCards': async () => {
                if (!payload.storyId) {
                    await this.send(client,"error",'Story ID is required for reveal action');
                    return;
                }
                // Get all votes and reveal them
                await this.send(client, "success", {
                    action: "revealCards",
                    storyId: payload.storyId
                });
            },
            'leaveRoom': async () => {
                if (!payload.roomId) {
                    await this.send(client, "error",'Room ID is required to leave a room');
                    return;
                }
                if (!this.roomManager.roomExists(payload.roomId)) {
                    await this.send(client,"error",`Room ${payload.roomId} does not exist`);
                    return;
                }
                // Get client info and all clients in the room
                const clientName = client.getClientName();
                const allClientsInRoom = this.roomManager.getClientsInRoom(payload.roomId);
                const otherClients = allClientsInRoom.filter(id => id !== client.id);
                
                // Broadcast to all other clients that admin is leaving
                this.webSocketServer.broadcast(otherClients, {
                    type: 'notification',
                    payload: {
                        action: 'userLeft',
                        roomId: payload.roomId,
                        userName: clientName,
                        userId: client.id,
                        isAdmin: true
                    }
                });
                
                this.roomManager.leaveRoom(payload.roomId, client.id);
                await this.send(client,"success", {
                    action: "leaveRoom",
                    roomId: payload.roomId
                });
            },
        };

        const handler = actionHandlers[payload.action];
        if (handler) {
            await handler();
        } else {
            await this.send(client,"error", `Unknown admin action: ${payload.action}`);
        }
    }

    private async send(client: WebSocketClient, type: string, message: any): Promise<void> {
        await client.send({
            type: type,
            payload: message
        });
    }
}