import { WebSocketClient } from '../core/webSocketClient';
import { WebSocketServer } from '../core/webSocketServer';
import { WebSocket } from 'ws';

jest.mock('ws');
jest.mock('uuid', () => ({
    v4: jest.fn(() => 'mocked-uuid'),
}));

describe('WebSocketClient', () => {
    let mockWebSocket: jest.Mocked<WebSocket>;
    let mockServer: jest.Mocked<WebSocketServer>;
    let client: WebSocketClient;

    beforeEach(() => {
        mockWebSocket = {
            on: jest.fn(),
            send: jest.fn(),
            close: jest.fn(),
            readyState: WebSocket.OPEN,
        } as unknown as jest.Mocked<WebSocket>;

        mockServer = {
            dispatchMessage: jest.fn(),
            unregisterClient: jest.fn(),
        } as unknown as jest.Mocked<WebSocketServer>;

        client = new WebSocketClient(mockWebSocket, mockServer);
    });

    it('should initialize with a unique id and set up event listeners', () => {
        expect(client.id).toBe('mocked-uuid');
        expect(mockWebSocket.on).toHaveBeenCalledWith('message', expect.any(Function));
        expect(mockWebSocket.on).toHaveBeenCalledWith('close', expect.any(Function));
        expect(mockWebSocket.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should set and get client name correctly', () => {
        client.setClientName('TestClient');
        expect(client.getClientName()).toBe('TestClient');

        client.setClientName('');
        expect(client.getClientName()).toBe(`Anonymous-${client.id.substring(0, 8)}`);
    });

    describe('send', () => {
        it('should send a message successfully', async () => {
            const message = { type: 'test', payload: 'data' };
            await client.send(message);
            expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(message));
        });

        it('should handle errors during message sending', async () => {
            mockWebSocket.send.mockImplementation(() => {
                throw new Error('Send error');
            });
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

            const message = { type: 'test', payload: 'data' };
            await client.send(message);

            expect(consoleSpy).toHaveBeenCalledWith(
                `[Client mocked-uuid] Error sending message:`,
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });
    });

    describe('handleIncomingMessage', () => {
        it('should parse and dispatch valid messages', async () => {
            const message = JSON.stringify({ type: 'test', payload: 'data' });
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            await client['handleIncomingMessage'](message);

            expect(consoleSpy).toHaveBeenCalledWith(`[Client mocked-uuid] Received:`, {
                type: 'test',
                payload: 'data',
            });
            expect(mockServer.dispatchMessage).toHaveBeenCalledWith(client, {
                type: 'test',
                payload: 'data',
            });
            consoleSpy.mockRestore();
        });

        it('should handle invalid messages gracefully', async () => {
            const invalidMessage = 'invalid-json';
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const sendSpy = jest.spyOn(client, 'send').mockImplementation();

            await client['handleIncomingMessage'](invalidMessage);

            expect(consoleSpy).toHaveBeenCalledWith(
                `[Client mocked-uuid] Error parsing message or dispatching:`,
                expect.any(Error)
            );
            expect(sendSpy).toHaveBeenCalledWith({
                type: 'error',
                payload: 'Invalid message format.',
            });
            consoleSpy.mockRestore();
            sendSpy.mockRestore();
        });
    });

    describe('handleClose', () => {
        it('should log and unregister client on close', () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

            client['handleClose'](1000, 'Normal closure');

            expect(consoleSpy).toHaveBeenCalledWith(
                `[Client mocked-uuid] Disconnected. Code: 1000, Reason: Normal closure`
            );
            expect(mockServer.unregisterClient).toHaveBeenCalledWith(client);
            consoleSpy.mockRestore();
        });
    });

    describe('handleError', () => {
        it('should log and unregister client on error', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const error = new Error('Test error');

            client['handleError'](error);

            expect(consoleSpy).toHaveBeenCalledWith(`[Client mocked-uuid] Error:`, error);
            expect(mockServer.unregisterClient).toHaveBeenCalledWith(client);
            consoleSpy.mockRestore();
        });
    });

    describe('close', () => {
        it('should close the WebSocket if it is open', () => {
            client.close();
            expect(mockWebSocket.close).toHaveBeenCalled();
        });

        it('should not close the WebSocket if it is not open', () => {
            Object.defineProperty(mockWebSocket, 'readyState', {
                value: WebSocket.CLOSED,
            });
            client.close();
            expect(mockWebSocket.close).not.toHaveBeenCalled();
        });
    });
});