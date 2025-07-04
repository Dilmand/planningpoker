import { JoinerHandler, JoinerPayload } from '../handler/joinerHandler';
import { RoomManager } from '../core/roomManager';
import { WebSocketServer } from '../core/webSocketServer';
import { WebSocketClient } from '../core/webSocketClient';

describe('JoinerHandler', () => {
  let joinerHandler: JoinerHandler;
  let mockRoomManager: jest.Mocked<RoomManager>;
  let mockWebSocketServer: jest.Mocked<WebSocketServer>;
  let mockClient: jest.Mocked<WebSocketClient>;

  beforeEach(() => {
    mockRoomManager = {
      joinRoom: jest.fn(),
      getRoomName: jest.fn(),
      getClientsInRoom: jest.fn(),
      haveAllVoted: jest.fn(),
      isAdmin: jest.fn(),
      leaveRoom: jest.fn(),
    } as unknown as jest.Mocked<RoomManager>;

    mockWebSocketServer = {
      getClient: jest.fn(),
      broadcast: jest.fn(),
    } as unknown as jest.Mocked<WebSocketServer>;

    mockClient = {
      id: 'client1',
      send: jest.fn(),
      setClientName: jest.fn(),
      getClientName: jest.fn().mockReturnValue('TestUser'),
    } as unknown as jest.Mocked<WebSocketClient>;

    joinerHandler = new JoinerHandler(mockWebSocketServer);
    (joinerHandler as any).roomManager = mockRoomManager;
  });

  describe('handle invalid payload', () => {
    it('should send error for completely empty payload', async () => {
      const invalidPayload = {};
      await joinerHandler.handle(mockClient, invalidPayload);

      expect(mockClient.send).toHaveBeenCalledWith({
        type: 'error',
        payload: 'Invalid joiner payload. Required fields: action, roomId',
      });
    });

    it('should send error for unknown action', async () => {
      const unknownPayload = { action: 'foobar', roomId: 'room1' } as any;
      await joinerHandler.handle(mockClient, unknownPayload);

      expect(mockClient.send).toHaveBeenCalledWith({
        type: 'error',
        payload: 'Unknown joiner action: foobar',
      });
    });
  });

  it('should handle joinRoom action successfully', async () => {
    const payload: JoinerPayload = {
      action: 'joinRoom',
      roomId: 'room1',
      userName: 'John',
    };

    mockRoomManager.getRoomName.mockReturnValue('Test Room');
    mockRoomManager.joinRoom.mockReturnValue(true);
    mockRoomManager.getClientsInRoom.mockReturnValue(['client1', 'client2']);
    mockRoomManager.isAdmin.mockReturnValue(false);
    mockWebSocketServer.getClient.mockImplementation((id) => {
      if (id === 'client1') return mockClient;
      if (id === 'client2') return {
        id: 'client2',
        getClientName: () => undefined,
      } as any;
      return null;
    });

    await joinerHandler.handle(mockClient, payload);

    expect(mockClient.setClientName).toHaveBeenCalledWith('John');

    expect(mockClient.send).toHaveBeenCalledWith({
      type: 'success',
      payload: {
        action: 'joinRoom',
        roomId: 'room1',
        roomName: 'Test Room',
        userName: 'John',
        participants: [
          { userId: 'client1', userName: 'TestUser', isAdmin: false },
          { userId: 'client2', userName: undefined, isAdmin: false },
        ],
      },
    });

    expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(['client2'], {
      type: 'notification',
      payload: {
        action: 'userJoined',
        roomId: 'room1',
        userName: 'John',
        userId: 'client1',
      },
    });
  });

  it('should send error if userName missing on joinRoom', async () => {
    const payload: JoinerPayload = {
      action: 'joinRoom',
      roomId: 'room1',
    };

    await joinerHandler.handle(mockClient, payload);

    expect(mockClient.send).toHaveBeenCalledWith({
      type: 'error',
      payload: 'User name is required for join action',
    });
  });

  it('should handle vote action successfully', async () => {
    const payload: JoinerPayload = {
      action: 'vote',
      roomId: 'room1',
      storyId: 'story1',
      voteValue: '5',
    };

    await joinerHandler.handle(mockClient, payload);

    expect(mockClient.send).toHaveBeenCalledWith({
      type: 'success',
      payload: {
        action: 'vote',
        storyId: 'story1',
        voteValue: '5',
      },
    });
  });

  it('should send error for vote action missing fields', async () => {
    const payload1: JoinerPayload = {
      action: 'vote',
      roomId: 'room1',
      storyId: 'story1',
    };
    const payload2: JoinerPayload = {
      action: 'vote',
      roomId: 'room1',
      voteValue: '3',
    };

    await joinerHandler.handle(mockClient, payload1);
    await joinerHandler.handle(mockClient, payload2);

    expect(mockClient.send).toHaveBeenCalledWith({
      type: 'error',
      payload: 'Vote value and story ID are required for vote action',
    });
  });

  describe('revealCards action', () => {
    it('should send error if storyId is missing', async () => {
      const payload: JoinerPayload = {
        action: 'revealCards',
        roomId: 'room1',
      };

      await joinerHandler.handle(mockClient, payload);

      expect(mockClient.send).toHaveBeenCalledWith({
        type: 'error',
        payload: 'Story ID is required for reveal action',
      });
    });

    it('should send success when not all voted (current handler logic)', async () => {
      mockRoomManager.haveAllVoted.mockReturnValue(false);

      const payload: JoinerPayload = {
        action: 'revealCards',
        roomId: 'room1',
        storyId: 'story1',
      };

      await joinerHandler.handle(mockClient, payload);

      expect(mockClient.send).toHaveBeenCalledWith({
        type: 'success',
        payload: {
          action: 'revealCards',
          storyId: 'story1',
        },
      });
    });

    it('should send success when all voted', async () => {
      mockRoomManager.haveAllVoted.mockReturnValue(true);

      const payload: JoinerPayload = {
        action: 'revealCards',
        roomId: 'room1',
        storyId: 'story1',
      };

      await joinerHandler.handle(mockClient, payload);

      expect(mockClient.send).toHaveBeenCalledWith({
        type: 'success',
        payload: {
          action: 'revealCards',
          storyId: 'story1',
        },
      });
    });
  });

  it('should handle leaveRoom action successfully', async () => {
    const payload: JoinerPayload = {
      action: 'leaveRoom',
      roomId: 'room1',
    };

    mockRoomManager.getClientsInRoom.mockReturnValue(['client1', 'client2']);
    mockClient.getClientName.mockReturnValue('John');

    await joinerHandler.handle(mockClient, payload);

    expect(mockWebSocketServer.broadcast).toHaveBeenCalledWith(['client2'], {
      type: 'notification',
      payload: {
        action: 'userLeft',
        roomId: 'room1',
        userName: 'John',
        userId: 'client1',
      },
    });

    expect(mockRoomManager.leaveRoom).toHaveBeenCalledWith('room1', 'client1');

    expect(mockClient.send).toHaveBeenCalledWith({
      type: 'success',
      payload: {
        action: 'leaveRoom',
        roomId: 'room1',
      },
    });
  });
});
