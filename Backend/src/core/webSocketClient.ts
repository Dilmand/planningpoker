import { WebSocketServer } from "./webSocketServer";
import { WebSocket } from "ws";
import { v4 as uuid } from "uuid";
import { IServerMessage } from "./webSocketServer";

export interface IClientMessage {
    type: string;
    payload?: any;
}
export class WebSocketClient {
    public id: string;
    private ws: WebSocket;
    private server: WebSocketServer;
    private clientName?: string;
    private ip: string;

    constructor(ws: WebSocket, server: WebSocketServer, ip: string) {
        this.id = uuid();
        this.ws = ws;
        this.server = server;
        this.ip = ip;

        this.ws.on('message', (message: string) => this.handleIncomingMessage(message));
        this.ws.on('close', (code: number, reason: string) => this.handleClose(code, reason));
        this.ws.on('error', (error: Error) => this.handleError(error));

        console.log(`[Client ${this.id}] Connected from IP ${this.ip}.`);
    }
    
    public setClientName(name: string): void {
        this.clientName = name;
    }
    
    public getClientName(): string {
        return this.clientName || `Anonymous-${this.id.substring(0, 8)}`;
    }

    public getIP(): string {
        return this.ip;
    }

    public async send<T extends IServerMessage>(message: T): Promise<void> {
        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error(`[Client ${this.id}] Error sending message:`, error);
        }
    }

    private async handleIncomingMessage(message: string): Promise<void> {
        try {
            const parsedMessage: IClientMessage = JSON.parse(message);
            console.log(`[Client ${this.id}] Received:`, parsedMessage);
            await this.server.dispatchMessage(this, parsedMessage);
        } catch (error) {
            console.error(`[Client ${this.id}] Error parsing message or dispatching:`, error);
            this.send({ type: 'error', payload: 'Invalid message format.' });
        }
    }

    private handleClose(code: number, reason: string): void {
        console.log(`[Client ${this.id}] Disconnected. Code: ${code}, Reason: ${reason}`);
        this.server.unregisterClient(this);
    }

    private handleError(error: Error): void {
        console.error(`[Client ${this.id}] Error:`, error);
        this.server.unregisterClient(this);
    }

    public close(): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.close();
        }
    }
}