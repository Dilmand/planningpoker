import { WebSocketClient } from "../core/webSocketClient";
import { IMessageHandler } from "../core/webSocketServer";
import { RoomManager } from "../core/roomManager";
import { WebSocketServer } from "../core/webSocketServer";

export interface BasePayload {
    action: string;
    roomId?: string;
    roomName?: string;
    userName?: string;
    voteValue?: string;
    storyId?: string;
}

export abstract class BaseHandler implements IMessageHandler {
    protected roomManager: RoomManager;
    protected webSocketServer: WebSocketServer;

    constructor(webSocketServer: WebSocketServer) {
        this.roomManager = new RoomManager();
        this.webSocketServer = webSocketServer;
    }

    abstract handle(
        client: WebSocketClient,
        receivedPayload: any,
    ): Promise<void>;

    protected validatePayload(payload: any): BasePayload | null {
        if (!payload) {
            return null;
        }
        return payload as BasePayload;
    }

    protected async sendError(
        client: WebSocketClient,
        message: string,
    ): Promise<void> {
        await client.send({
            type: "error",
            payload: message,
        });
    }

    protected async sendSuccess(
        client: WebSocketClient,
        message: any,
    ): Promise<void> {
        await client.send({
            type: "success",
            payload: message,
        });
    }

    protected validateRequiredFields(
        payload: BasePayload,
        fields: (keyof BasePayload)[],
    ): { isValid: boolean; missingField?: string } {
        for (const field of fields) {
            if (!payload[field]) {
                return { isValid: false, missingField: field };
            }
        }
        return { isValid: true };
    }

    protected async handleVote(
        client: WebSocketClient,
        payload: BasePayload,
    ): Promise<void> {
        const validation = this.validateRequiredFields(payload, [
            "voteValue",
            "storyId",
        ]);
        if (!validation.isValid) {
            await this.sendError(
                client,
                `${validation.missingField} is required for vote action`,
            );
            return;
        }
        if (!this.roomManager.roomExists(payload.roomId!)) {
            await this.sendError(
                client,
                `Room ${payload.roomId} does not exist`,
            );
            return;
        }

        await this.sendSuccess(client, {
            action: "vote",
            storyId: payload.storyId,
            voteValue: payload.voteValue,
        });
    }

    protected async handleRevealCards(
        client: WebSocketClient,
        payload: BasePayload,
    ): Promise<void> {
        if (!payload.storyId) {
            await this.sendError(
                client,
                "Story ID is required for reveal action",
            );
            return;
        }
        await this.sendSuccess(client, {
            action: "revealCards",
            storyId: payload.storyId,
        });
    }

    protected async handleLeaveRoom(
        client: WebSocketClient,
        payload: BasePayload,
    ): Promise<void> {
        const roomId = payload.roomId;
        if (!roomId) {
            await this.sendError(client, "Room ID is required to leave a room");
            return;
        }
        if (!this.roomManager.roomExists(roomId)) {
            await this.sendError(client, `Room ${roomId} does not exist`);
            return;
        }

        const clientName = client.getClientName();
        const allClientsInRoom = this.roomManager.getClientsInRoom(roomId);
        const otherClients = allClientsInRoom.filter((id) => id !== client.id);
        const isAdmin = this.roomManager.isAdmin(roomId, client.id);

        // Broadcast to all other clients that user is leaving
        this.webSocketServer.broadcast(otherClients, {
            type: "notification",
            payload: {
                action: "userLeft",
                roomId: roomId,
                userName: clientName,
                userId: client.id,
                isAdmin: isAdmin,
            },
        });

        this.roomManager.leaveRoom(roomId, client.id);
        await this.sendSuccess(client, {
            action: "leaveRoom",
            roomId: roomId,
        });
    }

    protected getParticipantsInRoom(
        roomId: string,
    ): Array<{ userId: string; userName: string; isAdmin: boolean }> {
        const allClientsInRoom = this.roomManager.getClientsInRoom(roomId);
        if (!allClientsInRoom || allClientsInRoom.length === 0) {
            return [];
        }

        return allClientsInRoom
            .map((clientId) => {
                const clientObj = this.webSocketServer.getClient(clientId);
                if (!clientObj) return null;

                return {
                    userId: clientId,
                    userName: clientObj.getClientName(),
                    isAdmin: this.roomManager.isAdmin(roomId, clientId),
                };
            })
            .filter((
                participant,
            ): participant is {
                userId: string;
                userName: string;
                isAdmin: boolean;
            } => participant !== null);
    }

    protected async handleJoinRoomSuccess(
        client: WebSocketClient,
        payload: BasePayload,
    ): Promise<void> {
        const roomId = payload.roomId!;
        const roomName = this.roomManager.getRoomName(roomId);
        const allClientsInRoom = this.roomManager.getClientsInRoom(roomId);
        const otherClients = allClientsInRoom.filter((id) => id !== client.id);
        const participants = this.getParticipantsInRoom(roomId);

        // Send success response to the joining client
        await this.sendSuccess(client, {
            action: "joinRoom",
            roomId: roomId,
            roomName: roomName,
            userName: payload.userName,
            participants: participants,
        });

        // Broadcast to all other clients in the room
        this.webSocketServer.broadcast(otherClients, {
            type: "notification",
            payload: {
                action: "userJoined",
                roomId: roomId,
                userName: payload.userName,
                userId: client.id,
            },
        });
    }

    protected async handleCreateRoomSuccess(
        client: WebSocketClient,
        payload: BasePayload,
    ): Promise<void> {
        const roomId = this.roomManager.createRoom(
            client.id,
            payload.roomName!,
        );
        const participants = this.getParticipantsInRoom(roomId);

        await this.sendSuccess(client, {
            action: "createRoom",
            roomId: roomId,
            roomName: payload.roomName,
            participants: participants,
        });
    }

    protected validateRoomExists(roomId: string): boolean {
        return this.roomManager.roomExists(roomId);
    }
}
