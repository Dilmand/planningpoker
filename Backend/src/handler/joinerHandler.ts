import { WebSocketClient } from "../core/webSocketClient";
import { BaseHandler, BasePayload } from "./baseHandler";

export interface JoinerPayload extends BasePayload {
    action: "joinRoom" | "vote" | "leaveRoom";
}

export class JoinerHandler extends BaseHandler {
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
        return "joiner";
    }

    protected async processAction(
        client: WebSocketClient,
        payload: any,
    ): Promise<void> {
        await this.processJoinerAction(client, payload as JoinerPayload);
    }

    private async processJoinerAction(
        client: WebSocketClient,
        payload: JoinerPayload,
    ): Promise<void> {
        const actionHandlers: Record<
            JoinerPayload["action"],
            (client: WebSocketClient, payload: JoinerPayload) => Promise<void>
        > = {
            "joinRoom": this.processJoinRoom.bind(this),
            "vote": this.handleVote.bind(this),
            "leaveRoom": this.processLeaveRoom.bind(this),
        };

        const handler = actionHandlers[payload.action];
        if (handler) {
            await handler(client, payload);
        } else {
            await this.sendError(
                client,
                `Unknown joiner action: ${payload.action}`,
            );
        }
    }

    private async processJoinRoom(
        client: WebSocketClient,
        payload: JoinerPayload,
    ): Promise<void> {
        const validation = this.validateRequiredFields(payload, [
            "userName",
            "roomId",
        ]);
        if (!validation.isValid) {
            console.log(
                `${validation.missingField} is required for join action from client ${client.id}`,
            );
            await this.sendError(
                client,
                `${validation.missingField} is required for join action`,
            );
            return;
        }

        client.setClientName(payload.userName!);
        const joined = this.roomManager.joinRoom(payload.roomId!, client.id);

        if (joined) {
            await this.handleJoinRoomSuccess(client, payload);
        } else {
            await this.sendError(
                client,
                `Failed to join room ${payload.roomId}`,
            );
        }
    }

    private async processLeaveRoom(
        client: WebSocketClient,
        payload: JoinerPayload,
    ): Promise<void> {
        await this.handleLeaveRoom(client, payload);
    }
}
