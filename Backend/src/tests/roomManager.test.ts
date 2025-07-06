import { RoomManager } from '../core/roomManager';

describe('RoomManager', () => {
    let roomManager: RoomManager;
    let adminId = 'admin1';
    let roomName = 'Test Room';

    beforeEach(() => {
        roomManager = new RoomManager();
    });

    describe('createRoom', () => {
        it('should create a new room with admin and return roomId', () => {
            const roomId = roomManager.createRoom(adminId, roomName);
            expect(typeof roomId).toBe('string');
            expect(roomManager.roomExists(roomId)).toBe(true);

            const clients = roomManager.getClientsInRoom(roomId);
            expect(clients).toContain(adminId);

            expect(roomManager.isAdmin(roomId, adminId)).toBe(true);
            expect(roomManager.getRoomName(roomId)).toBe(roomName);
        });

        it('should create unique room IDs', () => {
            const roomId1 = roomManager.createRoom(adminId, roomName);
            const roomId2 = roomManager.createRoom(adminId, roomName);
            expect(roomId1).not.toBe(roomId2);
        });
    });

    describe('joinRoom', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
        });

        it('should allow client to join existing room', () => {
            const clientId = 'client1';
            const result = roomManager.joinRoom(roomId, clientId);
            expect(result).toBe(true);

            const clients = roomManager.getClientsInRoom(roomId);
            expect(clients).toContain(clientId);
        });

        it('should deny blocked client from joining', () => {
            const blockedClient = 'blockedClient';
            roomManager.blockClient(blockedClient);
            const result = roomManager.joinRoom(roomId, blockedClient);
            expect(result).toBe(false);
            expect(roomManager.getClientsInRoom(roomId)).not.toContain(blockedClient);
        });

        it('should return false for non-existent room', () => {
            const result = roomManager.joinRoom('invalidRoomId', 'clientX');
            expect(result).toBe(false);
        });
    });

    describe('leaveRoom', () => {
        let roomId: string;
        const client1 = 'client1';
        const client2 = 'client2';

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
            roomManager.joinRoom(roomId, client1);
            roomManager.joinRoom(roomId, client2);
        });

        it('should remove client from room', () => {
            roomManager.leaveRoom(roomId, client1);
            const clients = roomManager.getClientsInRoom(roomId);
            expect(clients).not.toContain(client1);
            expect(clients).toContain(client2);
        });

        it('should assign new admin if current admin leaves', () => {
            roomManager.leaveRoom(roomId, adminId);
            const clients = roomManager.getClientsInRoom(roomId);
            expect(clients.length).toBeGreaterThan(0);
            const newAdmin = clients[0];
            expect(roomManager.isAdmin(roomId, newAdmin)).toBe(true);
            expect(roomManager.isAdmin(roomId, adminId)).toBe(false);
        });

        it('should delete room if last client leaves', () => {
            roomManager.leaveRoom(roomId, adminId);
            roomManager.leaveRoom(roomId, client1);
            roomManager.leaveRoom(roomId, client2);
            expect(roomManager.roomExists(roomId)).toBe(false);
        });

        it('should do nothing if client not in room', () => {
            expect(() => roomManager.leaveRoom(roomId, 'notInRoom')).not.toThrow();
            const clients = roomManager.getClientsInRoom(roomId);
            expect(clients.length).toBe(3); // admin + client1 + client2
        });
    });

    describe('blockClient', () => {
        it('should block client and remove them from all rooms', () => {
            const roomId = roomManager.createRoom(adminId, roomName);
            const clientId = 'clientToBlock';
            roomManager.joinRoom(roomId, clientId);

            roomManager.blockClient(clientId);
            expect(roomManager.getClientsInRoom(roomId)).not.toContain(clientId);

            // Blocked client cannot join rooms
            const result = roomManager.joinRoom(roomId, clientId);
            expect(result).toBe(false);
        });

        it('should not affect already blocked clients', () => {
            const clientId = 'alreadyBlocked';
            roomManager.blockClient(clientId);
            roomManager.blockClient(clientId); // Block again
            expect(roomManager.joinRoom('invalidRoomId', clientId)).toBe(false);
        });
    });

    describe('createStory', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
        });

        it('should create a story if it does not exist', () => {
            const storyId = 'story1';
            const created = roomManager.createStory(roomId, storyId, 'Title', 'Desc');
            expect(created).toBe(true);
        });

        it('should not create duplicate story', () => {
            const storyId = 'story1';
            roomManager.createStory(roomId, storyId);
            const createdAgain = roomManager.createStory(roomId, storyId);
            expect(createdAgain).toBe(false);
        });

        it('should return false if room does not exist', () => {
            const created = roomManager.createStory('invalidRoom', 'storyX');
            expect(created).toBe(false);
        });
    });

    describe('recordVote', () => {
        let roomId: string;
        const storyId = 'story1';
        const clientId = 'client1';

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
            roomManager.joinRoom(roomId, clientId);
            roomManager.createStory(roomId, storyId);
        });

        it('should record a vote correctly', () => {
            const success = roomManager.recordVote(roomId, storyId, clientId, '5');
            expect(success).toBe(true);
        });

        it('should not record vote if room does not exist', () => {
            const success = roomManager.recordVote('badRoom', storyId, clientId, '5');
            expect(success).toBe(false);
        });

        it('should not record vote if story does not exist', () => {
            const success = roomManager.recordVote(roomId, 'badStory', clientId, '5');
            expect(success).toBe(false);
        });

        it('should not record vote if client not in room', () => {
            const success = roomManager.recordVote(roomId, storyId, 'notInRoom', '5');
            expect(success).toBe(false);
        });
    });

    describe('haveAllVoted', () => {
        let roomId: string;
        const storyId = 'story1';
        const client1 = 'client1';
        const client2 = 'client2';

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
            roomManager.joinRoom(roomId, client1);
            roomManager.joinRoom(roomId, client2);
            roomManager.createStory(roomId, storyId);
        });

        it('should return false if no one voted', () => {
            expect(roomManager.haveAllVoted(roomId, storyId)).toBe(false);
        });

        it('should return false if only some clients voted', () => {
            roomManager.recordVote(roomId, storyId, client1, '3');
            expect(roomManager.haveAllVoted(roomId, storyId)).toBe(false);
        });

        it('should return true if all clients voted', () => {
            roomManager.recordVote(roomId, storyId, client1, '3');
            roomManager.recordVote(roomId, storyId, client2, '5');
            roomManager.recordVote(roomId, storyId, adminId, '8');

            expect(roomManager.haveAllVoted(roomId, storyId)).toBe(true);
        });
    });

    describe('revealVotes', () => {
        let roomId: string;
        const storyId = 'story1';
        const clientId = 'client1';

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
            roomManager.joinRoom(roomId, clientId);
            roomManager.createStory(roomId, storyId);
            roomManager.recordVote(roomId, storyId, clientId, '5');
        });

        it('should reveal votes and set revealed to true', () => {
            const votes = roomManager.revealVotes(roomId, storyId);
            expect(votes).toBeInstanceOf(Map);

            const room = (roomManager as any).rooms.get(roomId);
            const story = room.stories.get(storyId);
            expect(story.revealed).toBe(true);
        });

        it('should return null if room does not exist', () => {
            expect(roomManager.revealVotes('badRoom', storyId)).toBeNull();
        });

        it('should return null if story does not exist', () => {
            expect(roomManager.revealVotes(roomId, 'badStory')).toBeNull();
        });
    });

    describe('resetVotes', () => {
        let roomId: string;
        const storyId = 'story1';
        const clientId = 'client1';

        beforeEach(() => {
            roomId = roomManager.createRoom(adminId, roomName);
            roomManager.joinRoom(roomId, clientId);
            roomManager.createStory(roomId, storyId);
            roomManager.recordVote(roomId, storyId, clientId, '5');
            roomManager.revealVotes(roomId, storyId);
        });

        it('should clear votes and set revealed to false', () => {
            const reset = roomManager.resetVotes(roomId, storyId);
            expect(reset).toBe(true);

            const room = (roomManager as any).rooms.get(roomId);
            const story = room.stories.get(storyId);
            expect(story.votes.size).toBe(0);
            expect(story.revealed).toBe(false);
        });

        it('should return false if room does not exist', () => {
            expect(roomManager.resetVotes('badRoom', storyId)).toBe(false);
        });

        it('should return false if story does not exist', () => {
            expect(roomManager.resetVotes(roomId, 'badStory')).toBe(false);
        });
    });

    describe('roomExists', () => {
        it('should return true for existing room', () => {
            const roomId = roomManager.createRoom(adminId, roomName);
            expect(roomManager.roomExists(roomId)).toBe(true);
        });

        it('should return false for non-existent room', () => {
            expect(roomManager.roomExists('invalidRoomId')).toBe(false);
        });
    });
});
