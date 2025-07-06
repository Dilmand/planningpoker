import { IServerMessage, WebSocketServer } from '../core/webSocketServer';
import { WebSocketClient } from '../core/webSocketClient';
import { WebSocket } from 'ws';


jest.mock('ws');
jest.mock('../core/webSocketClient');

describe('WebSocketServer', () => {
    let webSocketServer: WebSocketServer;
    let mockWebSocket: jest.Mocked<WebSocket>;
    let mockWebSocketClient: jest.Mocked<WebSocketClient>;

    beforeEach(() => {
        mockWebSocket = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        mockWebSocketClient = new WebSocketClient(mockWebSocket, {} as WebSocketServer) as jest.Mocked<WebSocketClient>;
        jest.spyOn(WebSocketClient.prototype, 'send').mockImplementation(async (message: IServerMessage) => Promise.resolve());
        webSocketServer = new WebSocketServer(8080);
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should initialize WebSocketServer correctly', () => {
        expect(webSocketServer).toBeDefined();
        expect(webSocketServer['clients'].size).toBe(0);
        expect(webSocketServer['messageHandlers'].size).toBe(0);
    });

    it('should handle new connections and register clients', () => {
        const mockWs = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        webSocketServer['handleNewConnection'](mockWs);

        expect(webSocketServer['clients'].size).toBe(1);
        const client = Array.from(webSocketServer['clients'])[0];
        expect(client).toBeInstanceOf(WebSocketClient);
    });

    it('should unregister clients correctly', () => {
        const mockWs = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        const client = new WebSocketClient(mockWs, webSocketServer);
        webSocketServer['clients'].add(client);

        webSocketServer.unregisterClient(client);
        expect(webSocketServer['clients'].size).toBe(0);
    });

    it('should register message handlers and overwrite existing ones', () => {
        const mockHandler = { handle: jest.fn() };
        webSocketServer.registerMessageHandler('testType', mockHandler);

        expect(webSocketServer['messageHandlers'].get('testType')).toBe(mockHandler);

        const newMockHandler = { handle: jest.fn() };
        webSocketServer.registerMessageHandler('testType', newMockHandler);

        expect(webSocketServer['messageHandlers'].get('testType')).toBe(newMockHandler);
    });

    it('should dispatch messages to the correct handler', async () => {
        const mockHandler = { handle: jest.fn().mockResolvedValue(undefined) };
        webSocketServer.registerMessageHandler('testType', mockHandler);

        const mockClient = new WebSocketClient(mockWebSocket, webSocketServer);
        const mockMessage = { type: 'testType', payload: { key: 'value' } };

        await webSocketServer.dispatchMessage(mockClient, mockMessage);

        expect(mockHandler.handle).toHaveBeenCalledWith(mockClient, mockMessage.payload);
    });

    it('should send error if no handler is registered for message type', async () => {
        const mockClient = new WebSocketClient(mockWebSocket, webSocketServer);
        jest.spyOn(mockClient, 'send');

        const mockMessage = { type: 'unknownType', payload: {} };
        await webSocketServer.dispatchMessage(mockClient, mockMessage);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'error',
            payload: 'Unknown message type: "unknownType"',
        });
    });

    it('should retrieve client by ID', () => {
        const mockWs = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        const client = new WebSocketClient(mockWs, webSocketServer);
        client['id'] = 'client1';
        webSocketServer['clients'].add(client);

        const retrievedClient = webSocketServer.getClient('client1');
        expect(retrievedClient).toBe(client);
    });

    it('should broadcast messages to specified clients', () => {
        const mockWs1 = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        const mockWs2 = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        const client1 = new WebSocketClient(mockWs1, webSocketServer);
        const client2 = new WebSocketClient(mockWs2, webSocketServer);

        client1['id'] = 'client1';
        client2['id'] = 'client2';

        webSocketServer['clients'].add(client1);
        webSocketServer['clients'].add(client2);

        jest.spyOn(client1, 'send');
        jest.spyOn(client2, 'send');

        const message = { type: 'broadcast', payload: 'Hello' };
        webSocketServer.broadcast(['client1', 'client2'], message);

        expect(client1.send).toHaveBeenCalledWith(message);
        expect(client2.send).toHaveBeenCalledWith(message);
    });

    it('should close the server and all clients', () => {
        const mockWs = new WebSocket('ws://localhost:8080') as jest.Mocked<WebSocket>;
        const client = new WebSocketClient(mockWs, webSocketServer);
        webSocketServer['clients'].add(client);

        jest.spyOn(client, 'close');
        jest.spyOn(webSocketServer['wss'], 'close');

        webSocketServer.close();

        expect(client.close).toHaveBeenCalled();
        expect(webSocketServer['wss'].close).toHaveBeenCalled();
    });
});