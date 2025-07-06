import { AdminHandler, AdminPayload } from '../../src/handler/adminHandler';
import { WebSocketClient } from '../../src/core/webSocketClient';
import { WebSocketServer } from '../../src/core/webSocketServer';

describe('AdminHandler', () => {
    let adminHandler: AdminHandler;
    let mockWebSocketServer: WebSocketServer;
    let mockClient: WebSocketClient;

    beforeEach(() => {
        mockWebSocketServer = {
            getClient: jest.fn(),
            broadcast: jest.fn(),
        } as unknown as WebSocketServer;

        mockClient = {
            id: 'client1',
            send: jest.fn(),
            setClientName: jest.fn(),
            getClientName: jest.fn().mockReturnValue('TestUser'),
        } as unknown as WebSocketClient;

        adminHandler = new AdminHandler(mockWebSocketServer);
    });

    it('should handle invalid payload', async () => {
        const invalidPayload = {};
        await adminHandler.handle(mockClient, invalidPayload);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'error',
            payload: 'Invalid admin payload. Required fields: action, roomId',
        });
    });

    it('should handle createRoom action', async () => {
        const payload: AdminPayload = {
            action: 'createRoom',
            userName: 'AdminUser',
            roomName: 'TestRoom',
        };

        jest.spyOn(adminHandler['roomManager'], 'createRoom').mockReturnValue('room1');
        jest.spyOn(adminHandler['roomManager'], 'getClientsInRoom').mockReturnValue(['client1']);
        jest.spyOn(mockWebSocketServer, 'getClient').mockReturnValue(mockClient);
        jest.spyOn(adminHandler['roomManager'], 'isAdmin').mockReturnValue(true);

        await adminHandler.handle(mockClient, payload);

        expect(mockClient.setClientName).toHaveBeenCalledWith('AdminUser');
        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'success',
            payload: {
                action: 'createRoom',
                roomId: 'room1',
                roomName: 'TestRoom',
                participants: [
                    {
                        userId: 'client1',
                        userName: 'TestUser',
                        isAdmin: true,
                    },
                ],
            },
        });
    });

    it('should handle removeRoom action', async () => {
        const payload: AdminPayload = {
            action: 'removeRoom',
            roomId: 'room1',
            targetClientId: 'client2',
        };

        jest.spyOn(adminHandler['roomManager'], 'roomExists').mockReturnValue(true);
        jest.spyOn(adminHandler['roomManager'], 'leaveRoom').mockImplementation();

        await adminHandler.handle(mockClient, payload);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'success',
            payload: {
                action: 'removeRoom',
                roomId: 'room1',
                targetClientId: 'client2',
            },
        });
    });

    it('should handle leaveRoom action', async () => {
        const payload: AdminPayload = {
            action: 'leaveRoom',
            roomId: 'room1',
        };

        jest.spyOn(adminHandler['roomManager'], 'roomExists').mockReturnValue(true);
        jest.spyOn(adminHandler['roomManager'], 'getClientsInRoom').mockReturnValue(['client1', 'client2']);
        jest.spyOn(adminHandler['roomManager'], 'leaveRoom').mockImplementation();

        await adminHandler.handle(mockClient, payload);

        expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(['client2'], {
            type: 'notification',
            payload: {
                action: 'userLeft',
                roomId: 'room1',
                userName: 'TestUser',
                userId: 'client1',
                isAdmin: true,
            },
        });

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'success',
            payload: {
                action: 'leaveRoom',
                roomId: 'room1',
            },
        });
    });

    it('should handle blockUser action', async () => {
        const payload: AdminPayload = {
            action: 'blockUser',
            targetClientId: 'client2',
        };

        await adminHandler.handle(mockClient, payload);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'success',
            payload: {
                action: 'blockUser',
                targetClientId: 'client2',
            },
        });
    });

    it('should handle vote action', async () => {
        const payload: AdminPayload = {
            action: 'vote',
            storyId: 'story1',
            voteValue: '5',
        };

        await adminHandler.handle(mockClient, payload);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'success',
            payload: {
                action: 'vote',
                storyId: 'story1',
                voteValue: '5',
            },
        });
    });

    it('should handle revealCards action', async () => {
        const payload: AdminPayload = {
            action: 'revealCards',
            storyId: 'story1',
        };

        await adminHandler.handle(mockClient, payload);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'success',
            payload: {
                action: 'revealCards',
                storyId: 'story1',
            },
        });
    });

    it('should handle unknown action', async () => {
        const payload: AdminPayload = {
            action: 'unknownAction' as any,
        };

        await adminHandler.handle(mockClient, payload);

        expect(mockClient.send).toHaveBeenCalledWith({
            type: 'error',
            payload: 'Unknown admin action: unknownAction',
        });
    });
});

    