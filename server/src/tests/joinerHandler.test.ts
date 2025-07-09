import { JoinerHandler, JoinerPayload } from "../handler/joinerHandler";
import { WebSocketClient } from "../core/webSocketClient";
import { WebSocketServer } from "../core/webSocketServer";
import { RoomManager } from "../core/roomManager";

// Mock dependencies
jest.mock("../core/roomManager");
jest.mock("../core/webSocketServer");

describe('JoinerHandler', () => {
    let joinerHandler: JoinerHandler;
    let mockClient: jest.Mocked<WebSocketClient>;
    let mockServer: jest.Mocked<WebSocketServer>;
    let mockRoomManager: jest.Mocked<RoomManager>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockClient = {
            getIP: jest.fn(() => "192.168.1.100"),
            getClientName: jest.fn(() => "Test User"),
            setClientName: jest.fn(),
            send: jest.fn().mockResolvedValue(undefined)
        } as any;

        mockServer = {
            getClientByIP: jest.fn(),
            broadcast: jest.fn()
        } as any;

        mockRoomManager = {
            joinRoom: jest.fn(),
            roomExists: jest.fn(),
            isAdmin: jest.fn(),
            recordVote: jest.fn(),
            leaveRoom: jest.fn(),
            getClientsInRoom: jest.fn(),
            getRoomName: jest.fn(),
            getStoriesInRoom: jest.fn(),
            getCurrentStory: jest.fn()
        } as any;

        (RoomManager as unknown as jest.Mock).mockImplementation(() => mockRoomManager);
        joinerHandler = new JoinerHandler(mockServer);
    });

    describe('joinRoom', () => {
        it('should join room successfully with valid payload', async () => {
            mockRoomManager.joinRoom.mockReturnValue(true);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);
            mockRoomManager.getRoomName.mockReturnValue("Test Room");
            mockRoomManager.getStoriesInRoom.mockReturnValue([]);
            mockRoomManager.getCurrentStory.mockReturnValue(null);
            mockRoomManager.isAdmin.mockReturnValue(false);
            mockServer.getClientByIP.mockReturnValue(mockClient as any);

            const payload: JoinerPayload = {
                action: "joinRoom",
                userName: "John Doe",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.setClientName).toHaveBeenCalledWith("John Doe");
            expect(mockRoomManager.joinRoom).toHaveBeenCalledWith("ABC123", "192.168.1.100");
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should reject join without userName', async () => {
            const payload: JoinerPayload = {
                action: "joinRoom",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "userName is required for join action"
            });
        });

        it('should reject join without roomId', async () => {
            const payload: JoinerPayload = {
                action: "joinRoom",
                userName: "John Doe"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "roomId is required for join action"
            });
        });

        it('should handle failed room join', async () => {
            mockRoomManager.joinRoom.mockReturnValue(false);

            const payload: JoinerPayload = {
                action: "joinRoom",
                userName: "John Doe",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Failed to join room ABC123"
            });
        });
    });

    describe('vote', () => {
        it('should handle vote action successfully', async () => {
            mockRoomManager.roomExists.mockReturnValue(true);
            mockRoomManager.recordVote.mockReturnValue(true);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            const payload: JoinerPayload = {
                action: "vote",
                roomId: "ABC123",
                storyId: "story1",
                voteValue: "5"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockRoomManager.recordVote).toHaveBeenCalledWith(
                "ABC123", "story1", "192.168.1.100", "5"
            );
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should reject vote without required fields', async () => {
            const payload: JoinerPayload = {
                action: "vote",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "voteValue is required for vote action"
            });
        });

        it('should handle vote when room does not exist', async () => {
            mockRoomManager.roomExists.mockReturnValue(false);

            const payload: JoinerPayload = {
                action: "vote",
                roomId: "ABC123",
                storyId: "story1",
                voteValue: "5"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room ABC123 does not exist"
            });
        });
    });

    describe('leaveRoom', () => {
        it('should handle leave room successfully', async () => {
            mockRoomManager.roomExists.mockReturnValue(true);
            mockRoomManager.isAdmin.mockReturnValue(false);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            const payload: JoinerPayload = {
                action: "leaveRoom",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

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

        it('should handle leave room when room does not exist', async () => {
            mockRoomManager.roomExists.mockReturnValue(false);

            const payload: JoinerPayload = {
                action: "leaveRoom",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room ABC123 does not exist"
            });
        });

        
    });

    describe('error handling', () => {
        it('should handle invalid payload', async () => {
            await joinerHandler.handle(mockClient, null);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Invalid joiner payload. Required fields: action, roomId"
            });
        });

        it('should handle unknown action', async () => {
            const payload = {
                action: "unknownAction",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Unknown joiner action: unknownAction"
            });
        });

        it('should handle processing errors', async () => {
            const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
            mockRoomManager.joinRoom.mockImplementation(() => {
                throw new Error("Database error");
            });

            const payload: JoinerPayload = {
                action: "joinRoom",
                userName: "John Doe",
                roomId: "ABC123"
            };

            await joinerHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Error processing joiner action: Database error"
            });
            
            consoleSpy.mockRestore();
        });
    });

    describe('handler type', () => {
        it('should return correct handler type', () => {
            expect(joinerHandler['getHandlerType']()).toBe("joiner");
        });
    });
});