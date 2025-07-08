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

        // Send success response to the voting client
        await this.sendSuccess(client, {
            action: "vote",
            storyId: payload.storyId,
            voteValue: payload.voteValue,
            userId: client.getIP(),
        });

        // Broadcast to all OTHER clients in the room that someone voted
        await this.broadcastGameAction(
            payload.roomId!,
            "userVoted",
            client,
            {
                userId: client.getIP(),
                userName: client.getClientName(),
                voteValue: payload.voteValue,
                storyId: payload.storyId,
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

        // Send success response to the admin who initiated the reveal
        await this.sendSuccess(client, {
            action: "revealCards",
            storyId: payload.storyId,
            votes: Votes,
        });

        // Broadcast to all OTHER clients in the room
        await this.broadcastGameAction(
            payload.roomId!,
            "cardsRevealed",
            client,
            {
                storyId: payload.storyId,
                votes: Votes,
            },
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
        await this.sendSuccess(client, {
            action: "leaveRoom",
            roomId: roomId,
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

        // Send success response to the joining client
        await this.sendSuccess(client, {
            action: "joinRoom",
            roomId: roomId,
            roomName: roomName,
            userName: payload.userName,
            participants: participants,
            stories: this.roomManager.getStoriesInRoom(roomId),
            currentStory: this.roomManager.getCurrentStory(roomId),
        });

        // Broadcast to all other clients in the room
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

        await this.sendSuccess(client, {
            action: "createRoom",
            roomId: roomId,
            roomName: payload.roomName,
            participants: participants,
            stories: this.roomManager.getStoriesInRoom(roomId),
            currentStory: this.roomManager.getCurrentStory(roomId),
        });
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
            userId: userIP, // Use IP as userId
            isAdmin,
            ...additionalData,
        }, action === "userJoined" ? userIP : undefined);
    }

    protected async broadcastGameAction(
        roomId: string,
        action: "cardsRevealed" | "cardsReset" | "votingStarted" | "userVoted",
        initiatorClient: WebSocketClient,
        gameData?: any,
    ): Promise<void> {
        const initiatorName = initiatorClient.getClientName();

        await this.broadcastNotification(roomId, action, {
            initiatorName,
            initiatorId: initiatorClient.getIP(), // Use IP instead of client.id
            ...gameData,
        }, initiatorClient.getIP()); // Exclude the initiator from receiving the notification
    }
}
