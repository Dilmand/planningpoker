import { AdminHandler, AdminPayload } from "../handler/adminHandler";
import { WebSocketClient } from "../core/webSocketClient";
import { WebSocketServer } from "../core/webSocketServer";
import { RoomManager } from "../core/roomManager";

// Mock dependencies
jest.mock("../core/roomManager");
jest.mock("../core/webSocketServer");

describe('AdminHandler', () => {
    let adminHandler: AdminHandler;
    let mockClient: jest.Mocked<WebSocketClient>;
    let mockServer: jest.Mocked<WebSocketServer>;
    let mockRoomManager: jest.Mocked<RoomManager>;

    beforeEach(() => {
        jest.clearAllMocks();

        mockClient = {
            getIP: jest.fn(() => "192.168.1.100"),
            getClientName: jest.fn(() => "Admin User"),
            setClientName: jest.fn(),
            send: jest.fn().mockResolvedValue(undefined),
            close: jest.fn()
        } as any;

        mockServer = {
            getClientByIP: jest.fn(),
            broadcast: jest.fn()
        } as any;

        mockRoomManager = {
            isAdmin: jest.fn(),
            roomExists: jest.fn(),
            createRoom: jest.fn(),
            leaveRoom: jest.fn(),
            blockIPInRoom: jest.fn(),
            unblockIPInRoom: jest.fn(),
            getBlockedIPsInRoom: jest.fn(),
            getClientsInRoom: jest.fn(),
            setCurrentStory: jest.fn(),
            getStory: jest.fn(),
            recordVote: jest.fn(),
            revealVotes: jest.fn(),
            haveAllVoted: jest.fn(),
            getStoriesInRoom: jest.fn(),
            getCurrentStory: jest.fn()
        } as any;

        (RoomManager as unknown as jest.Mock).mockImplementation(() => mockRoomManager);
        adminHandler = new AdminHandler(mockServer);
    });

    describe('authorization', () => {
        it('should allow admin actions for room admin', async () => {
            mockRoomManager.isAdmin.mockReturnValue(true);
            mockRoomManager.roomExists.mockReturnValue(true);

            const payload: AdminPayload = {
                action: "blockUser",
                roomId: "ABC123",
                targetClientIp: "192.168.1.101"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockRoomManager.isAdmin).toHaveBeenCalledWith("ABC123", "192.168.1.100");
        });

        it('should reject admin actions for non-admin', async () => {
            mockRoomManager.isAdmin.mockReturnValue(false);

            const payload: AdminPayload = {
                action: "blockUser",
                roomId: "ABC123",
                targetClientIp: "192.168.1.101"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Only the admin of this room can execute admin commands"
            });
        });
    });

    describe('createRoom', () => {
        it('should create room with valid payload', async () => {
            mockRoomManager.createRoom.mockReturnValue("ABC123");
            mockRoomManager.getStoriesInRoom.mockReturnValue([]);
            mockRoomManager.getCurrentStory.mockReturnValue(null);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);
            mockRoomManager.isAdmin.mockReturnValue(true);
            mockServer.getClientByIP.mockReturnValue(mockClient as any);

            const payload: AdminPayload = {
                action: "createRoom",
                userName: "Admin User",
                roomName: "Test Room"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.setClientName).toHaveBeenCalledWith("Admin User");
            expect(mockRoomManager.createRoom).toHaveBeenCalled();
        });

        it('should reject create room without userName', async () => {
            const payload: AdminPayload = {
                action: "createRoom",
                roomName: "Test Room"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "User name is required for create room action"
            });
        });

        it('should reject create room without roomName', async () => {
            const payload: AdminPayload = {
                action: "createRoom",
                userName: "Admin User"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room name is required for create room action"
            });
        });
    });

    
    describe('unblockUser', () => {
        beforeEach(() => {
            mockRoomManager.isAdmin.mockReturnValue(true);
            mockRoomManager.roomExists.mockReturnValue(true);
        });

        it('should unblock user successfully', async () => {
            mockRoomManager.unblockIPInRoom.mockReturnValue(true);

            const payload: AdminPayload = {
                action: "unblockUser",
                roomId: "ABC123",
                targetClientIp: "192.168.1.101"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockRoomManager.unblockIPInRoom).toHaveBeenCalledWith("ABC123", "192.168.1.101");
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should handle unblocking non-blocked IP', async () => {
            mockRoomManager.unblockIPInRoom.mockReturnValue(false);

            const payload: AdminPayload = {
                action: "unblockUser",
                roomId: "ABC123",
                targetClientIp: "192.168.1.101"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "IP was not blocked"
            });
        });
    });

    describe('getBlockedUsers', () => {
        beforeEach(() => {
            mockRoomManager.isAdmin.mockReturnValue(true);
        });

        it('should return blocked users info', async () => {
            mockRoomManager.getBlockedIPsInRoom.mockReturnValue(["192.168.1.101", "192.168.1.102"]);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.101"]);
            mockServer.getClientByIP.mockReturnValue(mockClient as any);

            const payload: AdminPayload = {
                action: "getBlockedUsers",
                roomId: "ABC123"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockRoomManager.getBlockedIPsInRoom).toHaveBeenCalledWith("ABC123");
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should require roomId', async () => {
            const payload: AdminPayload = {
                action: "getBlockedUsers"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room ID is required to get blocked users"
            });
        });
    });

    describe('changeCurrentStory', () => {
        beforeEach(() => {
            mockRoomManager.isAdmin.mockReturnValue(true);
        });

        it('should change current story successfully', async () => {
            mockRoomManager.setCurrentStory.mockReturnValue(true);
            mockRoomManager.getStory.mockReturnValue({
                id: "story1",
                title: "Story 1",
                description: "Test story",
                votes: new Map<string, Number>(),
                revealed: false
            });

            const payload: AdminPayload = {
                action: "changeCurrentStory",
                roomId: "ABC123",
                storyId: "story1"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockRoomManager.setCurrentStory).toHaveBeenCalledWith("ABC123", "story1");
            expect(mockServer.broadcast).toHaveBeenCalled();
        });

        it('should handle failed story change', async () => {
            mockRoomManager.setCurrentStory.mockReturnValue(false);

            const payload: AdminPayload = {
                action: "changeCurrentStory",
                roomId: "ABC123",
                storyId: "story1"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Failed to change current story. Story or room not found."
            });
        });

        it('should require roomId and storyId', async () => {
            const payload: AdminPayload = {
                action: "changeCurrentStory",
                roomId: "ABC123"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Room ID and Story ID are required for change current story action"
            });
        });
    });

    describe('vote and revealCards', () => {
        beforeEach(() => {
            mockRoomManager.isAdmin.mockReturnValue(true);
            mockRoomManager.roomExists.mockReturnValue(true);
        });

        it('should handle vote action', async () => {
            mockRoomManager.recordVote.mockReturnValue(true);
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            const payload: AdminPayload = {
                action: "vote",
                roomId: "ABC123",
                storyId: "story1",
                voteValue: "5"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockRoomManager.recordVote).toHaveBeenCalledWith(
                "ABC123", "story1", "192.168.1.100", "5"
            );
        });

        it('should handle revealCards action', async () => {
            mockRoomManager.haveAllVoted.mockReturnValue(true);
            mockRoomManager.revealVotes.mockReturnValue(new Map([["192.168.1.100", 5]]));
            mockRoomManager.getClientsInRoom.mockReturnValue(["192.168.1.100"]);

            const payload: AdminPayload = {
                action: "revealCards",
                roomId: "ABC123",
                storyId: "story1"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockRoomManager.revealVotes).toHaveBeenCalledWith("ABC123", "story1");
        });
    });

    describe('error handling', () => {
        it('should handle invalid payload', async () => {
            await adminHandler.handle(mockClient, null);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Invalid admin payload. Required fields: action, roomId"
            });
        });

        it('should handle unknown action', async () => {
            mockRoomManager.isAdmin.mockReturnValue(true);

            const payload = {
                action: "unknownAction",
                roomId: "ABC123"
            };

            await adminHandler.handle(mockClient, payload);

            expect(mockClient.send).toHaveBeenCalledWith({
                type: "error",
                payload: "Unknown admin action: unknownAction"
            });
        });
    });
});