import { WebSocketClient } from "../core/webSocketClient";
import { BaseHandler, BasePayload } from "./baseHandler";

export interface AdminPayload extends BasePayload {
    action:
        | "createRoom"
        | "removeRoom"
        | "blockUser"
        | "unblockUser"
        | "getBlockedUsers"
        | "vote"
        | "revealCards"
        | "changeCurrentStory"
        | "leaveRoom";
    targetClientIp?: string;
}

export class AdminHandler extends BaseHandler {
    async handle(client: WebSocketClient, receivedPayload: any): Promise<void> {
        const handlerType = this.getHandlerType();
        console.log(
            `${handlerType} action received from client IP ${client.getIP()}:`,
            receivedPayload,
        );

        await this.processMessage(client, receivedPayload, handlerType);
    }

    protected async processMessage(
        client: WebSocketClient,
        receivedPayload: any,
        handlerType: string,
    ): Promise<void> {
        try {
            const payload = this.validatePayload(receivedPayload);
            if (!payload) {
                await this.sendError(
                    client,
                    `Invalid ${handlerType} payload. Required fields: action, roomId`,
                );
                return;
            }

            await this.processAction(client, payload);
        } catch (error: any) {
            await this.sendError(
                client,
                `Error processing ${handlerType} action: ${error.message}`,
            );
        }
    }

    protected getHandlerType(): string {
        return "admin";
    }

    protected async processAction(
        client: WebSocketClient,
        payload: any,
    ): Promise<void> {
        await this.processAdminAction(client, payload as AdminPayload);
    }

    private async processAdminAction(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        // Validate that the client is the admin of the room for all actions except createRoom
        if (payload.action !== "createRoom" && payload.roomId) {
            if (!this.roomManager.isAdmin(payload.roomId, client.getIP())) {
                await this.sendError(
                    client,
                    "Only the admin of this room can execute admin commands",
                );
                console.log(
                    `Unauthorized admin action attempt: Client IP ${client.getIP()} (${client.getClientName()}) tried to execute ${payload.action} in room ${payload.roomId}`,
                );
                return;
            }
        }

        const actionHandlers: Record<
            AdminPayload["action"],
            (client: WebSocketClient, payload: AdminPayload) => Promise<void>
        > = {
            "createRoom": this.processCreateRoom.bind(this),
            "removeRoom": this.processRemoveRoom.bind(this),
            "blockUser": this.processBlockUser.bind(this),
            "unblockUser": this.processUnblockUser.bind(this),
            "getBlockedUsers": this.processGetBlockedUsers.bind(this),
            "vote": this.processVote.bind(this),
            "revealCards": this.processRevealCards.bind(this),
            "changeCurrentStory": this.processChangeCurrentStory.bind(this),
            "leaveRoom": this.processLeaveRoom.bind(this),
        };

        const handler = actionHandlers[payload.action];
        if (handler) {
            await handler(client, payload);
        } else {
            await this.sendError(
                client,
                `Unknown admin action: ${payload.action}`,
            );
        }
    }

    private async processCreateRoom(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        const validation = this.validateRequiredFields(payload, ["userName"]);
        if (!validation.isValid) {
            console.log(
                `User name is required for create room action from client IP ${client.getIP()}`,
            );
            await this.sendError(
                client,
                "User name is required for create room action",
            );
            return;
        }
        if (!payload.roomName) {
            console.log(
                `Room name is required for create room action from client IP ${client.getIP()}`,
            );
            await this.sendError(
                client,
                "Room name is required for create room action",
            );
            return;
        }
        client.setClientName(payload.userName!);
        await this.handleCreateRoomSuccess(client, payload);
    }

    private async processRemoveRoom(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        if (!payload.targetClientIp) {
            await this.sendError(
                client,
                "Target client IP is required for remove action",
            );
            return;
        }

        const validation = this.validateRequiredFields(payload, ["roomId"]);
        if (!validation.isValid) {
            await this.sendError(
                client,
                "Room ID is required for remove action",
            );
            return;
        }

        if (!this.validateRoomExists(payload.roomId!)) {
            await this.sendError(
                client,
                `Room ${payload.roomId} does not exist`,
            );
            return;
        }

        // targetClientIp now represents IP address
        this.roomManager.leaveRoom(payload.roomId!, payload.targetClientIp);
        await this.sendSuccess(client, {
            action: "removeRoom",
            roomId: payload.roomId,
            targetClientIp: payload.targetClientIp,
        });
    }

    private async processBlockUser(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        if (!payload.targetClientIp || !payload.roomId) {
            await this.sendError(
                client,
                "Room ID and target client IP are required for block action",
            );
            return;
        }

        // Check if the admin is trying to block themselves
        if (payload.targetClientIp === client.getIP()) {
            await this.sendError(client, "You cannot block yourself");
            return;
        }

        // targetClientIp now represents the target IP address
        const targetIP = payload.targetClientIp;

        // Check if the target IP is currently in the room
        const clientsInRoom = this.roomManager.getClientsInRoom(payload.roomId);
        const isInRoom = clientsInRoom.includes(targetIP);

        // Block the IP in the room (adds to blockedIPs list)
        const blockSuccess = this.roomManager.blockIPInRoom(payload.roomId, targetIP);
        if (!blockSuccess) {
            await this.sendError(client, "Failed to block IP in room");
            return;
        }
        
        // Remove the client with this IP from the room (removes from clients list)
        if (isInRoom) {
            this.roomManager.leaveRoom(payload.roomId, targetIP);
            
            // Notify and disconnect the affected client
            const targetClient = this.webSocketServer.getClientByIP(targetIP);
            if (targetClient) {
                await this.sendError(
                    targetClient,
                    "You have been blocked by an administrator and removed from the room",
                );
                targetClient.close();
            }

            // Broadcast to ALL clients in the room (including admin) that user was blocked and removed
            await this.broadcastUserAction(payload.roomId, "userBlocked", client, {
                blockedUserIP: targetIP,
                blockedUserName: targetClient ? targetClient.getClientName() : "Unknown User",
                reason: "blocked by admin"
            });
        }
        
        // Send success response to admin
        await this.sendSuccess(client, {
            action: "blockUser",
            targetClientIp: payload.targetClientIp,
            targetIP,
            wasInRoom: isInRoom,
            message: `IP ${targetIP} has been blocked in room ${payload.roomId}${isInRoom ? ' and user was removed from the room' : ''}.`,
        });
        
        console.log(
            `Admin ${client.getClientName()} blocked IP ${targetIP} in room ${payload.roomId}${isInRoom ? ' and removed user from room' : ''}`,
        );
    }

    private async processUnblockUser(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        if (!payload.targetClientIp || !payload.roomId) {
            await this.sendError(
                client,
                "Room ID and target client IP are required for unblock action",
            );
            return;
        }
        
        // targetClientIp now represents the target IP address
        const targetIP = payload.targetClientIp;
        
        // Unblock the IP in the room
        const wasBlocked = this.roomManager.unblockIPInRoom(
            payload.roomId,
            targetIP,
        );
        if (!wasBlocked) {
            await this.sendError(client, "IP was not blocked");
            return;
        }

        // Broadcast to all clients in the room that IP was unblocked
        await this.broadcastUserAction(payload.roomId, "userUnblocked", client, {
            unblockedUserIP: targetIP,
            reason: "unblocked by admin"
        });

        await this.sendSuccess(client, {
            action: "unblockUser",
            targetClientIp: payload.targetClientIp,
            targetIP,
            message: `IP ${targetIP} has been unblocked in room ${payload.roomId}`,
        });
        console.log(
            `Admin ${client.getClientName()} unblocked IP ${targetIP} in room ${payload.roomId}`,
        );
    }

    private async processVote(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        await this.handleVote(client, payload);
    }

    private async processRevealCards(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        await this.handleRevealCards(client, payload);
    }

    private async processLeaveRoom(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        await this.handleLeaveRoom(client, payload);
    }

    private async processGetBlockedUsers(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        if (!payload.roomId) {
            await this.sendError(
                client,
                "Room ID is required to get blocked users",
            );
            return;
        }

        const blockedIPs = this.roomManager.getBlockedIPsInRoom(payload.roomId);

        // Get additional information about blocked IPs
        const blockedUsersInfo = blockedIPs.map((ip) => {
            // Check if there's currently a client with this IP in the room
            const clientsInRoom = this.roomManager.getClientsInRoom(payload.roomId!);
            const isCurrentlyInRoom = clientsInRoom.includes(ip);
            
            // Get client info if they're currently connected
            const client = this.webSocketServer.getClientByIP(ip);
            
            return {
                ip: ip,
                clientIds: [ip], // IP is now the identifier
                clientNames: client ? [client.getClientName()] : ["Unknown User"],
                isOnline: !!client && isCurrentlyInRoom,
            };
        });

        await this.sendSuccess(client, {
            action: "getBlockedUsers",
            roomId: payload.roomId,
            blockedUsers: blockedUsersInfo,
            count: blockedIPs.length,
        });
    }

    private async processChangeCurrentStory(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        const validation = this.validateRequiredFields(payload, ["roomId", "storyId"]);
        if (!validation.isValid) {
            await this.sendError(
                client,
                "Room ID and Story ID are required for change current story action",
            );
            return;
        }

        // Update current story in room
        const success = this.roomManager.setCurrentStory(payload.roomId!, payload.storyId!);
        if (!success) {
            await this.sendError(
                client,
                "Failed to change current story. Story or room not found.",
            );
            return;
        }

        // Get story details
        const story = this.roomManager.getStory(payload.roomId!, payload.storyId!);
        if (!story) {
            await this.sendError(
                client,
                "Story not found after setting as current.",
            );
            return;
        }

        // Broadcast to all clients in the room
        await this.broadcastNotification(
            payload.roomId!,
            "storyChanged",
            {
                storyId: payload.storyId,
                story: {
                    id: story.id,
                    title: story.title,
                    description: story.description,
                }
            }
        );

        await this.sendSuccess(client, {
            action: "changeCurrentStory",
            roomId: payload.roomId,
            storyId: payload.storyId,
            story: {
                id: story.id,
                title: story.title,
                description: story.description,
            }
        });
    }
}
