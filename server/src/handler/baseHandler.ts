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
    stories?: Array<{
        id: string;
        title?: string;
        description?: string;
    }>;
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

        const voteRecorded = this.roomManager.recordVote(
            payload.roomId!,
            payload.storyId!,
            client.getIP(),
            payload.voteValue!
        );

        if (!voteRecorded) {
            await this.sendError(
                client,
                `Failed to record vote for story ${payload.storyId}`,
            );
            return;
        }

        // Broadcast to ALL clients in the room that someone voted (including the voter)
        await this.broadcastNotification(
            payload.roomId!,
            "userVoted",
            {
                userId: client.getIP(),
                userName: client.getClientName(),
                voteValue: payload.voteValue,
                storyId: payload.storyId,
                isOwnVote: true, // This will be true for the voting client
            }
        );
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
        if (!this.roomManager.roomExists(payload.roomId!)) {
            await this.sendError(
                client,
                `Room ${payload.roomId} does not exist`,
            );
            return;
        }
        if (!this.roomManager.haveAllVoted(payload.roomId!, payload.storyId!)) {
            await this.sendError(
                client,
                `Not all clients have voted for story ${payload.storyId} in room ${payload.roomId}`,
            );
            return;
        }
        const Votes = this.roomManager.revealVotes(payload.roomId!, payload.storyId);
        if (!Votes) {
            await this.sendError(
                client,
                `Failed to reveal votes for story ${payload.storyId} in room ${payload.roomId}`,
            );
            return;
        }

        // Broadcast to ALL clients in the room that cards were revealed
        await this.broadcastNotification(
            payload.roomId!,
            "cardsRevealed",
            {
                storyId: payload.storyId,
                votes: Votes,
                initiatorName: client.getClientName(),
                initiatorId: client.getIP(),
            }
        );


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

        // Broadcast to all other clients that user is leaving
        await this.broadcastUserAction(roomId, "userLeft", client);

        this.roomManager.leaveRoom(roomId, client.getIP());
        
        // Send separate notification to the leaving client
        await client.send({
            type: "notification",
            payload: {
                action: "userLeft",
                userName: client.getClientName(),
                userId: client.getIP(),
                isAdmin: this.roomManager.isAdmin(roomId, client.getIP()),
                isOwnAction: true,
                roomId: roomId,
            },
        });
    }

    protected getParticipantsInRoom(
        roomId: string,
    ): Array<{ userId: string; userName: string; isAdmin: boolean }> {
        const allClientIPsInRoom = this.roomManager.getClientsInRoom(roomId);
        if (!allClientIPsInRoom || allClientIPsInRoom.length === 0) {
            return [];
        }

        return allClientIPsInRoom
            .map((clientIP) => {
                const clientObj = this.webSocketServer.getClientByIP(clientIP);
                if (!clientObj) return null;

                return {
                    userId: clientIP, // Use IP as userId
                    userName: clientObj.getClientName(),
                    isAdmin: this.roomManager.isAdmin(roomId, clientIP),
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
        const participants = this.getParticipantsInRoom(roomId);

        // Send notification to the joining client with their own perspective
        await client.send({
            type: "notification",
            payload: {
                action: "userJoined",
                userName: payload.userName,
                userId: client.getIP(),
                isAdmin: this.roomManager.isAdmin(roomId, client.getIP()),
                roomId: roomId,
                roomName: roomName,
                participants: participants,
                stories: this.roomManager.getStoriesInRoom(roomId),
                currentStory: this.roomManager.getCurrentStory(roomId),
                isOwnAction: true,
            },
        });

        // Broadcast to ALL OTHER clients in the room about the new user
        await this.broadcastUserAction(roomId, "userJoined", client);
    }

    protected async handleCreateRoomSuccess(
        client: WebSocketClient,
        payload: BasePayload,
    ): Promise<void> {
        const roomId = this.roomManager.createRoom(
            client.getIP(),
            payload.roomName!,
            payload.stories || [], // Pass stories to room creation
        );
        const participants = this.getParticipantsInRoom(roomId);

        // Broadcast to the admin client about successful room creation
        await this.broadcastNotification(
            roomId,
            "roomCreated",
            {
                roomId: roomId,
                roomName: payload.roomName,
                participants: participants,
                stories: this.roomManager.getStoriesInRoom(roomId),
                currentStory: this.roomManager.getCurrentStory(roomId),
                adminId: client.getIP(),
                adminName: client.getClientName(),
            }
        );
    }

    protected validateRoomExists(roomId: string): boolean {
        return this.roomManager.roomExists(roomId);
    }

    protected async broadcastNotification(
        roomId: string,
        action: string,
        notificationData: any,
        excludeClientId?: string,
    ): Promise<void> {
        const allClientsInRoom = this.roomManager.getClientsInRoom(roomId);
        const targetClients = excludeClientId 
            ? allClientsInRoom.filter((id) => id !== excludeClientId)
            : allClientsInRoom;

        this.webSocketServer.broadcast(targetClients, {
            type: "notification",
            payload: {
                action: action,
                roomId: roomId,
                ...notificationData,
            },
        });
    }

    protected async broadcastUserAction(
        roomId: string,
        action: "userJoined" | "userLeft" | "userBlocked" | "userUnblocked",
        client: WebSocketClient,
        additionalData?: any,
    ): Promise<void> {
        const userName = client.getClientName();
        const userIP = client.getIP();
        const isAdmin = this.roomManager.isAdmin(roomId, userIP);

        await this.broadcastNotification(roomId, action, {
            userName,
            userId: userIP,
            isAdmin,
            ...additionalData,
        }, action === "userJoined" ? userIP : undefined); // Exclude the joining client
    }


}
