import { WebSocketClient, IClientMessage } from "../core/webSocketClient";
import { WebSocketServer, IServerMessage } from "../core/webSocketServer";
import { WebSocket } from "ws";

// Mock uuid
jest.mock("uuid", () => ({
    v4: jest.fn(() => "mock-uuid-123")
}));

describe('WebSocketClient', () => {
    let webSocketClient: WebSocketClient;
    let mockWs: any;
    let mockServer: any;
    const testIP = "192.168.1.100";

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockWs = {
            on: jest.fn(),
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.OPEN
        };
        
        mockServer = {
            dispatchMessage: jest.fn(),
            unregisterClient: jest.fn()
        };

        webSocketClient = new WebSocketClient(
            mockWs as unknown as WebSocket,
            mockServer as unknown as WebSocketServer,
            testIP
        );
    });

    describe('initialization', () => {
        it('should initialize with correct properties', () => {
            expect(webSocketClient.id).toBe("mock-uuid-123");
            expect(webSocketClient.getIP()).toBe(testIP);
            expect(webSocketClient.getPrimaryId()).toBe(testIP);
            expect(mockWs.on).toHaveBeenCalledTimes(3);
        });
    });

    describe('client name management', () => {
        it('should set and get client name', () => {
            webSocketClient.setClientName("John Doe");
            expect(webSocketClient.getClientName()).toBe("John Doe");
        });

        it('should return anonymous name when no name is set', () => {
            expect(webSocketClient.getClientName()).toBe("Anonymous-192-168-1-100");
        });
    });

    describe('message sending', () => {
        it('should send message successfully', async () => {
            const message: IServerMessage = { type: "test", payload: { data: "test" } };
            
            await webSocketClient.send(message);
            
            expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(message));
        });

        it('should handle send errors', async () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            mockWs.send.mockImplementation(() => { throw new Error("Send failed"); });

            await webSocketClient.send({ type: "test" });

            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('message receiving', () => {
        let messageHandler: Function;

        beforeEach(() => {
            messageHandler = mockWs.on.mock.calls.find((call: string[]) => call[0] === 'message')[1];
        });

        it('should parse and dispatch valid messages', async () => {
            const message: IClientMessage = { type: "join-room", payload: { roomId: "ABC123" } };

            await messageHandler(JSON.stringify(message));

            expect(mockServer.dispatchMessage).toHaveBeenCalledWith(webSocketClient, message);
        });

        it('should handle invalid JSON', async () => {
            const sendSpy = jest.spyOn(webSocketClient, 'send').mockResolvedValue();

            await messageHandler("invalid-json");

            expect(sendSpy).toHaveBeenCalledWith({
                type: "error",
                payload: "Invalid message format."
            });
            sendSpy.mockRestore();
        });
    });

    describe('connection events', () => {
        it('should handle close events', () => {
            const closeHandler = mockWs.on.mock.calls.find((call: string[]) => call[0] === 'close')[1];
            
            closeHandler(1000, "Normal closure");
            
            expect(mockServer.unregisterClient).toHaveBeenCalledWith(webSocketClient);
        });

        it('should handle error events', () => {
            const errorHandler = mockWs.on.mock.calls.find((call: string[]) => call[0] === 'error')[1];
            
            errorHandler(new Error("Connection error"));
            
            expect(mockServer.unregisterClient).toHaveBeenCalledWith(webSocketClient);
        });
    });

    describe('close method', () => {
        it('should close WebSocket when open', () => {
            mockWs.readyState = WebSocket.OPEN;
            
            webSocketClient.close();
            
            expect(mockWs.close).toHaveBeenCalled();
        });

        it('should not close WebSocket when not open', () => {
            mockWs.readyState = WebSocket.CLOSED;
            
            webSocketClient.close();
            
            expect(mockWs.close).not.toHaveBeenCalled();
        });
    });
});