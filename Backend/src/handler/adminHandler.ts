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
        | "leaveRoom";
    targetClientId?: string;
}

export class AdminHandler extends BaseHandler {
    async handle(client: WebSocketClient, receivedPayload: any): Promise<void> {
        const handlerType = this.getHandlerType();
        console.log(
            `${handlerType} action received from client ${client.id}:`,
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
            if (!this.roomManager.isAdmin(payload.roomId, client.id)) {
                await this.sendError(
                    client,
                    "Only the admin of this room can execute admin commands",
                );
                console.log(
                    `Unauthorized admin action attempt: Client ${client.id} (${client.getClientName()}) tried to execute ${payload.action} in room ${payload.roomId}`,
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
                `User name is required for create room action from client ${client.id}`,
            );
            await this.sendError(
                client,
                "User name is required for create room action",
            );
            return;
        }
        if (!payload.roomName) {
            console.log(
                `Room name is required for create room action from client ${client.id}`,
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
        if (!payload.targetClientId) {
            await this.sendError(
                client,
                "Target client ID is required for remove action",
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

        this.roomManager.leaveRoom(payload.roomId!, payload.targetClientId);
        await this.sendSuccess(client, {
            action: "removeRoom",
            roomId: payload.roomId,
            targetClientId: payload.targetClientId,
        });
    }

    private async processBlockUser(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        if (!payload.targetClientId || !payload.roomId) {
            await this.sendError(
                client,
                "Room ID and target client ID are required for block action",
            );
            return;
        }

        // Check if the admin is trying to block themselves
        if (payload.targetClientId === client.id) {
            await this.sendError(client, "You cannot block yourself");
            return;
        }

        // Check if the target user exists
        const targetClient = this.webSocketServer.getClient(
            payload.targetClientId,
        );
        if (!targetClient) {
            await this.sendError(client, "Target user not found");
            return;
        }
        const targetIP = targetClient.getIP();
        if (!targetIP) {
            await this.sendError(client, "Target user IP not found");
            return;
        }

        // Block the IP in the room
        this.roomManager.blockIPInRoom(payload.roomId, targetIP);
        // Remove all clients with this IP from the room
        const removedClientIds = this.roomManager.removeClientByIP(
            payload.roomId,
            targetIP,
            (id) => this.webSocketServer.getClient(id) || { getIP: () => "" },
        );
        // Notify and disconnect all affected clients
        for (const clientId of removedClientIds) {
            const c = this.webSocketServer.getClient(clientId);
            if (c) {
                await this.sendError(
                    c,
                    "You have been blocked by an administrator (IP block)",
                );
                c.close();
            }
        }
        // Send success response to admin
        await this.sendSuccess(client, {
            action: "blockUser",
            targetClientId: payload.targetClientId,
            targetIP,
            removedClientIds,
            message:
                `IP ${targetIP} has been blocked in room ${payload.roomId} and ${removedClientIds.length} client(s) removed.`,
        });
        console.log(
            `Admin ${client.getClientName()} blocked IP ${targetIP} in room ${payload.roomId}`,
        );
    }

    private async processUnblockUser(
        client: WebSocketClient,
        payload: AdminPayload,
    ): Promise<void> {
        if (!payload.targetClientId || !payload.roomId) {
            await this.sendError(
                client,
                "Room ID and target client ID are required for unblock action",
            );
            return;
        }
        // Check if the target user exists
        const targetClient = this.webSocketServer.getClient(
            payload.targetClientId,
        );
        if (!targetClient) {
            await this.sendError(client, "Target user not found");
            return;
        }
        const targetIP = targetClient.getIP();
        if (!targetIP) {
            await this.sendError(client, "Target user IP not found");
            return;
        }
        // Unblock the IP in the room
        const wasBlocked = this.roomManager.unblockIPInRoom(
            payload.roomId,
            targetIP,
        );
        if (!wasBlocked) {
            await this.sendError(client, "IP was not blocked");
            return;
        }
        await this.sendSuccess(client, {
            action: "unblockUser",
            targetClientId: payload.targetClientId,
            targetIP,
            message:
                `IP ${targetIP} has been unblocked in room ${payload.roomId}`,
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
            // Find all clients with this IP in the room
            const clientsWithIP = this.roomManager.getClientsInRoom(
                payload.roomId!,
            )
                .filter((clientId) => {
                    const client = this.webSocketServer.getClient(clientId);
                    return client && client.getIP() === ip;
                });

            return {
                ip: ip,
                clientIds: clientsWithIP,
                clientNames: clientsWithIP.map((clientId) => {
                    const client = this.webSocketServer.getClient(clientId);
                    return client ? client.getClientName() : "Unknown User";
                }),
                isOnline: clientsWithIP.some((clientId) => {
                    const client = this.webSocketServer.getClient(clientId);
                    return !!client;
                }),
            };
        });

        await this.sendSuccess(client, {
            action: "getBlockedUsers",
            roomId: payload.roomId,
            blockedUsers: blockedUsersInfo,
            count: blockedIPs.length,
        });

        console.log(
            `Admin ${client.getClientName()} requested blocked users list for room ${payload.roomId} (${blockedIPs.length} IPs blocked)`,
        );
    }
}
