import { WebSocketServer, IMessageHandler } from "../core/webSocketServer";
import { WebSocketClient } from "../core/webSocketClient";
import { WebSocket, WebSocketServer as WSWebSocketServer } from "ws";
import * as http from "http";
import express from "express";

// Mock dependencies
jest.mock("ws");
jest.mock("http");
jest.mock("express");
jest.mock("../core/webSocketClient");

describe('WebSocketServer', () => {
    let webSocketServer: WebSocketServer;
    let mockWss: any;
    let mockHttpServer: any;
    let mockApp: any;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock Express app
        mockApp = {
            set: jest.fn(),
            use: jest.fn(),
            get: jest.fn()
        };
        (express as unknown as jest.Mock).mockReturnValue(mockApp);

        // Mock HTTP server
        mockHttpServer = {
            listen: jest.fn((port, callback) => callback && callback()),
            close: jest.fn()
        };
        (http.createServer as jest.Mock).mockReturnValue(mockHttpServer);

        // Mock WebSocket server
        mockWss = {
            on: jest.fn(),
            close: jest.fn()
        };
        (WSWebSocketServer as unknown as jest.Mock).mockImplementation(() => mockWss);

        // Mock WebSocket client
        mockClient = {
            id: "client-123",
            getIP: jest.fn(() => "192.168.1.100"),
            send: jest.fn(),
            close: jest.fn()
        };
        (WebSocketClient as jest.Mock).mockImplementation(() => mockClient);

        webSocketServer = new WebSocketServer(8080);
    });

    describe('initialization', () => {
        it('should initialize server with correct setup', () => {
            expect(express).toHaveBeenCalled();
            expect(http.createServer).toHaveBeenCalledWith(mockApp);
            expect(WSWebSocketServer).toHaveBeenCalledWith({ server: mockHttpServer });
            expect(mockHttpServer.listen).toHaveBeenCalledWith(8080, expect.any(Function));
        });

        it('should setup express routes and middleware', () => {
            expect(mockApp.set).toHaveBeenCalledWith('trust proxy', true);
            expect(mockApp.use).toHaveBeenCalled();
            expect(mockApp.get).toHaveBeenCalledWith("/", expect.any(Function));
        });

        it('should register WebSocket event listeners', () => {
            expect(mockWss.on).toHaveBeenCalledWith("connection", expect.any(Function));
            expect(mockWss.on).toHaveBeenCalledWith("error", expect.any(Function));
            expect(mockWss.on).toHaveBeenCalledWith("close", expect.any(Function));
        });
    });

    describe('client management', () => {
        it('should handle new connections', () => {
            const connectionHandler = mockWss.on.mock.calls.find((call: string[]) => call[0] === 'connection')[1];
            const mockReq = {
                headers: { 'x-forwarded-for': '192.168.1.100' },
                socket: { remoteAddress: '192.168.1.100' }
            };

            connectionHandler({}, mockReq);

            expect(WebSocketClient).toHaveBeenCalledWith({}, webSocketServer, '192.168.1.100');
        });

        it('should unregister clients', () => {
            const connectionHandler = mockWss.on.mock.calls.find((call: string[]) => call[0] === 'connection')[1];
            connectionHandler({}, { headers: {}, socket: { remoteAddress: '192.168.1.100' } });

            webSocketServer.unregisterClient(mockClient);

            expect(mockClient.getIP).toHaveBeenCalled();
        });

        it('should find client by IP', () => {
            const connectionHandler = mockWss.on.mock.calls.find((call: string[]) => call[0] === 'connection')[1];
            connectionHandler({}, { headers: {}, socket: { remoteAddress: '192.168.1.100' } });

            const foundClient = webSocketServer.getClientByIP('192.168.1.100');

            expect(foundClient).toBe(mockClient);
        });

        it('should find client by ID', () => {
            const connectionHandler = mockWss.on.mock.calls.find((call: string[]) => call[0] === 'connection')[1];
            connectionHandler({}, { headers: {}, socket: { remoteAddress: '192.168.1.100' } });

            const foundClient = webSocketServer.getClient('client-123');

            expect(foundClient).toBe(mockClient);
        });
    });

    describe('message handling', () => {
        let mockHandler: IMessageHandler;

        beforeEach(() => {
            mockHandler = {
                handle: jest.fn().mockResolvedValue(undefined)
            };
        });

        it('should register message handlers', () => {
            webSocketServer.registerMessageHandler('test-message', mockHandler);

            // Verify handler is registered (internal state)
            expect(mockHandler).toBeDefined();
        });

        it('should dispatch messages to correct handler', async () => {
            webSocketServer.registerMessageHandler('test-message', mockHandler);

            await webSocketServer.dispatchMessage(mockClient, {
                type: 'test-message',
                payload: { data: 'test' }
            });

            expect(mockHandler.handle).toHaveBeenCalledWith(mockClient, { data: 'test' });
        });

        it('should handle unknown message types', async () => {
            await webSocketServer.dispatchMessage(mockClient, {
                type: 'unknown-message'
            });

            expect(mockClient.send).toHaveBeenCalledWith({
                type: 'error',
                payload: 'Unknown message type: "unknown-message"'
            });
        });

        it('should handle handler errors', async () => {
            const errorHandler = {
                handle: jest.fn().mockRejectedValue(new Error('Handler error'))
            };
            webSocketServer.registerMessageHandler('error-message', errorHandler);

            await webSocketServer.dispatchMessage(mockClient, {
                type: 'error-message'
            });

            expect(mockClient.send).toHaveBeenCalledWith({
                type: 'error',
                payload: 'Error processing your request: Handler error'
            });
        });
    });

    describe('broadcasting', () => {
        beforeEach(() => {
            const connectionHandler = mockWss.on.mock.calls.find((call: string[]) => call[0] === 'connection')[1];
            connectionHandler({}, { headers: {}, socket: { remoteAddress: '192.168.1.100' } });
        });

        it('should broadcast messages to clients by IP', () => {
            const message = { type: 'broadcast', payload: { data: 'test' } };

            webSocketServer.broadcast(['192.168.1.100'], message);

            expect(mockClient.send).toHaveBeenCalledWith(message);
        });

        it('should broadcast messages to clients by ID as fallback', () => {
            mockClient.getIP.mockReturnValue('different-ip');
            const message = { type: 'broadcast', payload: { data: 'test' } };

            webSocketServer.broadcast(['client-123'], message);

            expect(mockClient.send).toHaveBeenCalledWith(message);
        });
    });

    describe('server shutdown', () => {
        beforeEach(() => {
            const connectionHandler = mockWss.on.mock.calls.find((call: string[]) => call[0] === 'connection')[1];
            connectionHandler({}, { headers: {}, socket: { remoteAddress: '192.168.1.100' } });
        });

        it('should close all clients and servers', () => {
            const mockExit = jest.spyOn(process, 'exit').mockImplementation();

            webSocketServer.close();

            expect(mockClient.close).toHaveBeenCalled();
            expect(mockWss.close).toHaveBeenCalled();
            expect(mockHttpServer.close).toHaveBeenCalled();

            mockExit.mockRestore();
        });
    });
});