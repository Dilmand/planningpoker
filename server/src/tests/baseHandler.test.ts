import { BaseHandler, BasePayload } from "../handler/baseHandler";
import { WebSocketClient } from "../core/webSocketClient";
import { WebSocketServer } from "../core/webSocketServer";
import { RoomManager } from "../core/roomManager";

// Mock dependencies
jest.mock("../core/roomManager");
jest.mock("../core/webSocketServer");

// Concrete implementation for testing
class TestHandler extends BaseHandler {
    async handle(client: WebSocketClient, receivedPayload: any): Promise<void> {
        const payload = this.validatePayload(receivedPayload);
        if (!payload) {
            await this.sendError(client, "Invalid payload");
            return;
        }
        // Test implementation
    }
}

describe('BaseHandler', () => {
    let handler: TestHandler;
    let mockClient: jest.Mocked<WebSocketClient>;
    let mockServer: jest.Mocked<WebSocketServer>;
    let mockRoomManager: jest.Mocked<RoomManager>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockClient = {
            getIP: jest.fn(() => "192.168.1.100"),
            getClientName: jest.fn(() => "Test User"),
            send: jest.fn().mockResolvedValue(undefined)
        } as any;

        mockServer = {
            getClientByIP: jest.fn(),
            broadcast: jest.fn()
        } as any;

        mockRoomManager = {
            roomExists: jest.fn(),
            recordVote: jest.fn(),
            revealVotes: jest.fn(),
            haveAllVoted: jest.fn(),
            leaveRoom: jest.fn(),
            getClientsInRoom: jest.fn(),
            getRoomName: jest.fn(),
            isAdmin: jest.fn(),
            createRoom: jest.fn(),
            getStoriesInRoom: jest.fn(),
            getCurrentStory: jest.fn()
        } as any;

        (RoomManager as unknown as jest.Mock).mockImplementation(() => mockRoomManager);

        handler = new TestHandler(mockServer);
    });

    describe('validatePayload', () => {
        it('should return payload when valid', () => {
            const payload = { action: "test" };
            const result = handler['validatePayload'](payload);
            expect(result).toEqual(payload);
        });

        it('should return null when payload is null or undefined', () => {
            expect(handler['validatePayload'](null)).toBeNull();
            expect(handler['validatePayload'](undefined)).toBeNull();
        });
    });

    describe('validateRequiredFields', () => {
        it('should return valid when all required fields are present', () => {
            const payload: BasePayload = { action: "test", roomId: "ABC123" };
            const result = handler['validateRequiredFields'](payload, ["action", "roomId"]);
            expect(result).toEqual({ isValid: true });
        });

        it('should return invalid with missing field', () => {
            const payload: BasePayload = { action: "test" };
            const result = handler['validateRequiredFields'](payload, ["action", "roomId"]);
            expect(result).toEqual({ isValid: false, missingField: "roomId" });
        });
    });

    describe('sendError', () => {
        it('should send error message to client', async () => {
            await handler['sendError'](mockClient, "Test error");

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Test error"
            });
        });
    });

    describe('handleVote', () => {
        const votePayload: BasePayload = {
            action: "vote",
            roomId: "ABC123",
            storyId: "story1",
            voteValue: "5"
        };

        it('should record vote successfully', async () => {
            mockRoomManager.roomExists.mockReturnValue(true);
            mockRoomManager.recordVote.mockReturnValue(true);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            await handler['handleVote'](mockClient, votePayload);

            expect(mockRoomManager.recordVote).toHaveBeenCalledWith(
                "ABC123", "story1", "192.168.1.100", "5"
            );
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should send error when room does not exist', async () => {
            mockRoomManager.roomExists.mockReturnValue(false);

            await handler['handleVote'](mockClient, votePayload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room ABC123 does not exist"
            });
        });

        it('should send error when required fields are missing', async () => {
            const invalidPayload = { action: "vote", roomId: "ABC123" };

            await handler['handleVote'](mockClient, invalidPayload as BasePayload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "voteValue is required for vote action"
            });
        });
    });

    describe('handleRevealCards', () => {
        const revealPayload: BasePayload = {
            action: "reveal",
            roomId: "ABC123",
            storyId: "story1"
        };

        it('should reveal cards successfully', async () => {
            const mockVotes = new Map([["192.168.1.100", 5]]);
            mockRoomManager.roomExists.mockReturnValue(true);
            mockRoomManager.haveAllVoted.mockReturnValue(true);
            mockRoomManager.revealVotes.mockReturnValue(mockVotes);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            await handler['handleRevealCards'](mockClient, revealPayload);

            expect(mockRoomManager.revealVotes).toHaveBeenCalledWith("ABC123", "story1");
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should send error when not all have voted', async () => {
            mockRoomManager.roomExists.mockReturnValue(true);
            mockRoomManager.haveAllVoted.mockReturnValue(false);

            await handler['handleRevealCards'](mockClient, revealPayload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Not all clients have voted for story story1 in room ABC123"
            });
        });
    });

    describe('handleLeaveRoom', () => {
        const leavePayload: BasePayload = {
            action: "leave",
            roomId: "ABC123"
        };

        it('should handle leave room successfully', async () => {
            mockRoomManager.roomExists.mockReturnValue(true);
            mockRoomManager.isAdmin.mockReturnValue(false);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            await handler['handleLeaveRoom'](mockClient, leavePayload);

            expect(mockRoomManager.leaveRoom).toHaveBeenCalledWith("ABC123", "192.168.1.100");
            expect(mockClient.send).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: "notification",
                    payload: expect.objectContaining({
                        action: "userLeft",
                        isOwnAction: true
                    })
                })
            );
        });

        it('should send error when room does not exist', async () => {
            mockRoomManager.roomExists.mockReturnValue(false);

            await handler['handleLeaveRoom'](mockClient, leavePayload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room ABC123 does not exist"
            });
        });
    });

    describe('getParticipantsInRoom', () => {
        it('should return participants with correct data', () => {
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100", "192.168.1.101"]);
            mockRoomManager.isAdmin.mockReturnValue(true);
            
            const mockClient2 = { getClientName: () => "User 2" };
            mockServer.getClientByIP
                .mockReturnValueOnce(mockClient as any)
                .mockReturnValueOnce(mockClient2 as any);

            const participants = handler['getParticipantsInRoom']("ABC123");

            expect(participants).toEqual([
                { userId: "192.168.1.100", userName: "Test User", isAdmin: true },
                { userId: "192.168.1.101", userName: "User 2", isAdmin: true }
            ]);
        });

        it('should return empty array when no clients in room', () => {
            mockRoomManager.getClientsInRoom.mockReturnValue([]);

            const participants = handler['getParticipantsInRoom']("ABC123");

            expect(participants).toEqual([]);
        });
    });

    describe('handleCreateRoomSuccess', () => {
        it('should create room and broadcast notification', async () => {
            const createPayload: BasePayload = {
                action: "create",
                roomName: "Test Room",
                stories: [{ id: "story1", title: "Story 1" }]
            };

            mockRoomManager.createRoom.mockReturnValue("ABC123");
            mockRoomManager.getStoriesInRoom.mockReturnValue([]);
            mockRoomManager.getCurrentStory.mockReturnValue(null);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);
            mockServer.getClientByIP.mockReturnValue(mockClient as any);
            mockRoomManager.isAdmin.mockReturnValue(true);

            await handler['handleCreateRoomSuccess'](mockClient, createPayload);

            expect(mockRoomManager.createRoom).toHaveBeenCalledWith(
                "192.168.1.100",
                "Test Room",
                [{ id: "story1", title: "Story 1" }]
            );
            expect(mockServer.broadcast).toHaveBeenCalled();
        });
    });
});