import { WebSocket, WebSocketServer as WSWebSocketServer } from "ws";
import { WebSocketClient } from "./webSocketClient";
import { IClientMessage } from "./webSocketClient";
import * as http from "http";
import { IncomingMessage } from "http";

export interface IServerMessage {
    type: string;
    payload?: any;
    senderId?: string;
}

export interface IMessageHandler {
    handle(client: WebSocketClient, message: any): Promise<void>;
}

export class WebSocketServer {
    private wss: WSWebSocketServer;
    private clients: Set<WebSocketClient>;
    private messageHandlers: Map<string, IMessageHandler>;
    private blockedIPs: Set<string>;
    private blockedClientMapping: Map<string, string>; // clientId -> IP mapping

    constructor(port: number = 8080) {
        this.wss = new WSWebSocketServer({ port });
        this.clients = new Set<WebSocketClient>();
        this.messageHandlers = new Map<string, IMessageHandler>();
        this.blockedIPs = new Set<string>();
        this.blockedClientMapping = new Map<string, string>(); // Initialize mapping

        this.wss.on(
            "connection",
            (ws: WebSocket, req: http.IncomingMessage) => {
                const ip = this.extractIP(req);
                if (this.isBlocked(ip)) {
                    console.warn(`Blocked IP ${ip} attempted to connect.`);
                    ws.close(1008, "Your IP is blocked.");
                    return;
                }
                const client = new WebSocketClient(ws, this, ip);
                this.handleNewConnection(client, req);
            }
        );

        this.wss.on(
            "listening",
            () => console.log(`WebSocket server listening on port ${port}`),
        );
        this.wss.on(
            "error",
            (error: Error) => console.error("WebSocket server error:", error),
        );
    }

    public blockIP(ip: string, clientId?: string): void {
        this.blockedIPs.add(ip);
        if (clientId) {
            this.blockedClientMapping.set(clientId, ip);
        }
        console.log(`IP ${ip} has been blocked.`);
    }

    public unblockIP(ip: string): void {
        if (this.blockedIPs.delete(ip)) {
            // Remove from client mapping as well
            for (const [clientId, mappedIP] of this.blockedClientMapping.entries()) {
                if (mappedIP === ip) {
                    this.blockedClientMapping.delete(clientId);
                }
            }
            console.log(`IP ${ip} has been unblocked.`);
        } else {
            console.warn(`IP ${ip} was not blocked.`);
        }
    }

    public isBlocked(ip: string): boolean {
        return this.blockedIPs.has(ip);
    }

    public getIPByClientId(clientId: string): string | null {
        return this.blockedClientMapping.get(clientId) || null;
    }

    private extractIP(request: IncomingMessage): string {
        const forwardedFor = request.headers['x-forwarded-for'];
        if (typeof forwardedFor === 'string') {
            return forwardedFor.split(',')[0].trim();
        }
        return request.socket.remoteAddress || 'unknown';
    }

    private handleNewConnection(
        client: WebSocketClient,
        _req: http.IncomingMessage,
    ): void {
        this.clients.add(client);
        console.log(
            `Client ${client.id} registered. Total clients: ${this.clients.size}`,
        );
    }

    public unregisterClient(client: WebSocketClient): void {
        if (this.clients.delete(client)) {
            console.log(
                `Client ${client.id} unregistered. Total clients: ${this.clients.size}`,
            );
        }
    }

    public registerMessageHandler(
        type: string,
        handler: IMessageHandler,
    ): void {
        if (this.messageHandlers.has(type)) {
            console.warn(
                `Handler for message type "${type}" already registered. Overwriting.`,
            );
        }
        this.messageHandlers.set(type, handler);
        console.log(`Registered handler for message type: "${type}"`);
    }

    public async dispatchMessage(
        client: WebSocketClient,
        message: IClientMessage,
    ): Promise<void> {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            try {
                await handler.handle(client, message.payload);
            } catch (error: any) {
                console.error(
                    `Error handling message type "${message.type}" from client ${client.id}:`,
                    error,
                );
                client.send({
                    type: "error",
                    payload: `Error processing your request: ${error.message}`,
                });
            }
        } else {
            console.warn(
                `No handler registered for message type: "${message.type}"`,
            );
            client.send({
                type: "error",
                payload: `Unknown message type: "${message.type}"`,
            });
        }
    }

    public getClient(clientId: string): WebSocketClient | undefined {
        for (const client of this.clients) {
            if (client.id === clientId) {
                return client;
            }
        }
        return undefined;
    }

    public broadcast(clientIds: string[], message: IServerMessage): void {
        for (const clientId of clientIds) {
            const client = this.getClient(clientId);
            if (client) {
                client.send(message);
            }
        }
    }

    public close(): void {
        console.log("Shutting down WebSocket server...");
        this.wss.close(() => {
            console.log("WebSocket server closed.");
            this.clients.forEach((client) => client.close());
        });
    }
}
