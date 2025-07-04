import { WebSocket, WebSocketServer as WSWebSocketServer } from 'ws';
import { WebSocketClient } from './webSocketClient';
import { IClientMessage } from './webSocketClient';

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

    constructor(port: number = 8080) {
        this.wss = new WSWebSocketServer({ port });
        this.clients = new Set<WebSocketClient>();
        this.messageHandlers = new Map<string, IMessageHandler>();

        this.wss.on('connection', (ws: WebSocket) => this.handleNewConnection(ws));
        this.wss.on('listening', () => console.log(`WebSocket server listening on port ${port}`));
        this.wss.on('error', (error: Error) => console.error('WebSocket server error:', error));
    }

    private handleNewConnection(ws: WebSocket): void {
        const client = new WebSocketClient(ws, this);
        this.clients.add(client);
        console.log(`Client ${client.id} registered. Total clients: ${this.clients.size}`);
    }

    public unregisterClient(client: WebSocketClient): void {
        if (this.clients.delete(client)) {
            console.log(`Client ${client.id} unregistered. Total clients: ${this.clients.size}`);
        }
    }

    public registerMessageHandler(type: string, handler: IMessageHandler): void {
        if (this.messageHandlers.has(type)) {
            console.warn(`Handler for message type "${type}" already registered. Overwriting.`);
        }
        this.messageHandlers.set(type, handler);
        console.log(`Registered handler for message type: "${type}"`);
    }

    public async dispatchMessage(client: WebSocketClient, message: IClientMessage): Promise<void> {
        const handler = this.messageHandlers.get(message.type);
        if (handler) {
            try {
                await handler.handle(client, message.payload);
            } catch (error: any) {
                console.error(`Error handling message type "${message.type}" from client ${client.id}:`, error);
                client.send({ type: 'error', payload: `Error processing your request: ${error.message}` });
            }
        } else {
            console.warn(`No handler registered for message type: "${message.type}"`);
            client.send({ type: 'error', payload: `Unknown message type: "${message.type}"` });
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
            this.clients.forEach(client => client.close());
        });
    }
}