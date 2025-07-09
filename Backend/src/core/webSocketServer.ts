import { WebSocket, WebSocketServer as WSWebSocketServer } from "ws";
import { WebSocketClient } from "./webSocketClient";
import { IClientMessage } from "./webSocketClient";
import * as http from "http";
import express from "express";
import * as path from "path";

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
  private httpServer: http.Server;
  private app: express.Application;
  private clients: Set<WebSocketClient>;
  private messageHandlers: Map<string, IMessageHandler>;

  constructor(port: number = 8699) {
    // Create Express app and HTTP server
    this.app = express();
    this.httpServer = http.createServer(this.app);
    this.wss = new WSWebSocketServer({ server: this.httpServer });

    this.clients = new Set<WebSocketClient>();
    this.messageHandlers = new Map<string, IMessageHandler>();

    this.app.set('trust proxy', true);

    // Statische Dateien bereitstellen (CSS, JS, Bilder)
    this.app.use(express.static(path.join(__dirname, "../../public")));

    // Hauptroute für die SPA
    this.app.get("/", (req, res) => {
      res.sendFile(path.join(__dirname, "../../public/index.html"));
    });

    this.wss.on("connection", (ws: any, req: any) =>
      this.handleNewConnection(ws, req)
    );

    this.wss.on("error", (error: Error) =>
      console.error("WebSocket server error:", error)
    );

    this.wss.on("close", () => {
      // remove all clients on server close
      this.clients.forEach((client) => client.close());
      this.clients.clear();
      console.log("WebSocket server closed, all clients disconnected.");
    });

    // Start the HTTP server
    this.httpServer.listen(port, () => {
        console.log(`HTTP server and WebSocket server listening on port ${port}`);
        }
    );
  }

  private handleNewConnection(ws: any, req: any): void {
    const ip = this.extractClientIP(req);
    console.log(`New WebSocket connection from IP: ${ip}`);

    const client = new WebSocketClient(ws, this, ip);
    this.clients.add(client);
    console.log(
      `Client IP ${ip} connected with internal ID ${client.id}. Total clients: ${this.clients.size}`
    );
  }

  private extractClientIP(req: any): string {
    console.log("Extracting client IP from request headers:", req.headers);
    return (
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.headers["x-real-ip"] ||
      req.socket.remoteAddress ||
      req.connection.remoteAddress ||
      "unknown"
    );
  }

  public unregisterClient(client: WebSocketClient): void {
    if (this.clients.delete(client)) {
      console.log(
        `Client IP ${client.getIP()} unregistered. Total clients: ${
          this.clients.size
        }`
      );
    }
  }

  public registerMessageHandler(type: string, handler: IMessageHandler): void {
    if (this.messageHandlers.has(type)) {
      console.warn(
        `Handler for message type "${type}" already registered. Overwriting.`
      );
    }
    this.messageHandlers.set(type, handler);
    console.log(`Registered handler for message type: "${type}"`);
  }

  public async dispatchMessage(
    client: WebSocketClient,
    message: IClientMessage
  ): Promise<void> {
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      try {
        await handler.handle(client, message.payload);
      } catch (error: any) {
        console.error(
          `Error handling message type "${
            message.type
          }" from client IP ${client.getIP()}:`,
          error
        );
        client.send({
          type: "error",
          payload: `Error processing your request: ${error.message}`,
        });
      }
    } else {
      console.warn(`No handler registered for message type: "${message.type}"`);
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

  public getClientByIP(ip: string): WebSocketClient | undefined {
    for (const client of this.clients) {
      if (client.getIP() === ip) {
        return client;
      }
    }
    return undefined;
  }

  public broadcast(clientIds: string[], message: IServerMessage): void {
    for (const clientId of clientIds) {
      // Try to get client by IP first (new approach), then fall back to ID (legacy)
      let client = this.getClientByIP(clientId);
      if (!client) {
        client = this.getClient(clientId);
      }
      if (client) {
        client.send(message);
      }
    }
  }

  public close(): void {
    console.log("Shutting down WebSocket server...");

    // Zuerst alle Clients schließen
    this.clients.forEach((client) => client.close());
    this.clients.clear();

    // Dann WebSocket Server schließen
    this.wss.close(() => {
      console.log("WebSocket server closed.");
    });

    // Zum Schluss HTTP Server schließen
    this.httpServer.close((err) => {
      if (err) {
        console.error("Error closing HTTP server:", err);
        process.exit(1);
      } else {
        console.log("HTTP server closed.");
        process.exit(0);
      }
    });
  }
}
