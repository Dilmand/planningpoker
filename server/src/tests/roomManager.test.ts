import { RoomManager } from "../core/roomManager";

describe('RoomManager', () => {
    let roomManager: RoomManager;
    
    beforeEach(() => {
        (RoomManager as any).instance = undefined;
        roomManager = new RoomManager();
    });

    describe('Singleton pattern', () => {
        it('should return the same instance', () => {
            const instance1 = new RoomManager();
            const instance2 = new RoomManager();
            expect(instance1).toBe(instance2);
        });
    });

    describe('createRoom', () => {
        it('should create a room with default story when no stories provided', () => {
            const roomId = roomManager.createRoom('192.168.1.1', 'Test Room', []);
            
            expect(roomId).toBeDefined();
            expect(roomId).toHaveLength(6);
            expect(roomManager.roomExists(roomId)).toBe(true);
            expect(roomManager.getRoomName(roomId)).toBe('Test Room');
            expect(roomManager.isAdmin(roomId, '192.168.1.1')).toBe(true);
            
            const stories = roomManager.getStoriesInRoom(roomId);
            expect(stories).toHaveLength(1);
            expect(stories[0].id).toBe('current');
        });

        it('should create a room with provided stories', () => {
            const stories = [
                { id: 'story1', title: 'Story 1', description: 'First story' },
                { id: 'story2', title: 'Story 2', description: 'Second story' }
            ];
            
            const roomId = roomManager.createRoom('192.168.1.1', 'Test Room', stories);
            
            const roomStories = roomManager.getStoriesInRoom(roomId);
            expect(roomStories).toHaveLength(2);
            expect(roomStories[0].id).toBe('story1');
            expect(roomStories[1].id).toBe('story2');
            
            const currentStory = roomManager.getCurrentStory(roomId);
            expect(currentStory?.id).toBe('story1');
        });

        it('should generate unique room IDs', () => {
            const roomId1 = roomManager.createRoom('192.168.1.1', 'Room 1', []);
            const roomId2 = roomManager.createRoom('192.168.1.2', 'Room 2', []);
            
            expect(roomId1).not.toBe(roomId2);
        });
    });

    describe('joinRoom', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom('192.168.1.1', 'Test Room', []);
        });

        it('should allow client to join existing room', () => {
            const result = roomManager.joinRoom(roomId, '192.168.1.2');
            
            expect(result).toBe(true);
            expect(roomManager.getClientsInRoom(roomId)).toContain('192.168.1.2');
        });

        it('should reject joining non-existent room', () => {
            const result = roomManager.joinRoom('NONEXISTENT', '192.168.1.2');
            
            expect(result).toBe(false);
        });

        it('should reject blocked IP from joining', () => {
            roomManager.blockIPInRoom(roomId, '192.168.1.3');
            const result = roomManager.joinRoom(roomId, '192.168.1.3');
            
            expect(result).toBe(false);
            expect(roomManager.getClientsInRoom(roomId)).not.toContain('192.168.1.3');
        });
    });

    describe('leaveRoom', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom('192.168.1.1', 'Test Room', []);
            roomManager.joinRoom(roomId, '192.168.1.2');
            roomManager.joinRoom(roomId, '192.168.1.3');
        });

        it('should remove client from room', () => {
            roomManager.leaveRoom(roomId, '192.168.1.2');
            
            expect(roomManager.getClientsInRoom(roomId)).not.toContain('192.168.1.2');
        });

        it('should assign new admin when admin leaves', () => {
            roomManager.leaveRoom(roomId, '192.168.1.1');
            
            expect(roomManager.isAdmin(roomId, '192.168.1.1')).toBe(false);
            expect(roomManager.isAdmin(roomId, '192.168.1.2')).toBe(true);
        });

        it('should delete room when last client leaves', () => {
            roomManager.leaveRoom(roomId, '192.168.1.1');
            roomManager.leaveRoom(roomId, '192.168.1.2');
            roomManager.leaveRoom(roomId, '192.168.1.3');
            
            expect(roomManager.roomExists(roomId)).toBe(false);
        });
    });

    describe('story management', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom('192.168.1.1', 'Test Room', []);
        });

        it('should create new story', () => {
            const result = roomManager.createStory(roomId, 'new-story', 'New Story', 'Description');
            
            expect(result).toBe(true);
            
            const story = roomManager.getStory(roomId, 'new-story');
            expect(story).toBeDefined();
            expect(story?.title).toBe('New Story');
            expect(story?.description).toBe('Description');
        });

        it('should not create duplicate story', () => {
            roomManager.createStory(roomId, 'story1', 'Story 1');
            const result = roomManager.createStory(roomId, 'story1', 'Duplicate');
            
            expect(result).toBe(false);
        });

        it('should set current story', () => {
            roomManager.createStory(roomId, 'story1', 'Story 1');
            const result = roomManager.setCurrentStory(roomId, 'story1');
            
            expect(result).toBe(true);
            expect(roomManager.getCurrentStory(roomId)?.id).toBe('story1');
        });

        it('should not set non-existent story as current', () => {
            const result = roomManager.setCurrentStory(roomId, 'non-existent');
            
            expect(result).toBe(false);
        });
    });

    describe('voting system', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom('192.168.1.1', 'Test Room', []);
            roomManager.joinRoom(roomId, '192.168.1.2');
            roomManager.createStory(roomId, 'story1', 'Story 1');
        });

        it('should record vote for client in room', () => {
            const result = roomManager.recordVote(roomId, 'story1', '192.168.1.1', '5');
            
            expect(result).toBe(true);
        });

        it('should not record vote for client not in room', () => {
            const result = roomManager.recordVote(roomId, 'story1', '192.168.1.99', '5');
            
            expect(result).toBe(false);
        });

        it('should not record vote for non-existent story', () => {
            const result = roomManager.recordVote(roomId, 'non-existent', '192.168.1.1', '5');
            
            expect(result).toBe(false);
        });

        it('should check if all clients have voted', () => {
            roomManager.recordVote(roomId, 'story1', '192.168.1.1', '5');
            expect(roomManager.haveAllVoted(roomId, 'story1')).toBe(false);
            
            roomManager.recordVote(roomId, 'story1', '192.168.1.2', '3');
            expect(roomManager.haveAllVoted(roomId, 'story1')).toBe(true);
        });

        it('should reveal votes when all have voted', () => {
            roomManager.recordVote(roomId, 'story1', '192.168.1.1', '5');
            roomManager.recordVote(roomId, 'story1', '192.168.1.2', '3');
            
            const votes = roomManager.revealVotes(roomId, 'story1');
            
            expect(votes).toBeDefined();
            expect(votes?.get('192.168.1.1')).toBe(5);
            expect(votes?.get('192.168.1.2')).toBe(3);
        });

        it('should not reveal votes when not all have voted', () => {
            roomManager.recordVote(roomId, 'story1', '192.168.1.1', '5');
            
            const votes = roomManager.revealVotes(roomId, 'story1');
            
            expect(votes).toBeNull();
        });

        it('should reset votes', () => {
            roomManager.recordVote(roomId, 'story1', '192.168.1.1', '5');
            roomManager.recordVote(roomId, 'story1', '192.168.1.2', '3');
            
            const result = roomManager.resetVotes(roomId, 'story1');
            
            expect(result).toBe(true);
            expect(roomManager.haveAllVoted(roomId, 'story1')).toBe(false);
            
            const story = roomManager.getStory(roomId, 'story1');
            expect(story?.revealed).toBe(false);
        });
    });

    describe('IP blocking', () => {
        let roomId: string;

        beforeEach(() => {
            roomId = roomManager.createRoom('192.168.1.1', 'Test Room', []);
        });

        it('should block IP in room', () => {
            const result = roomManager.blockIPInRoom(roomId, '192.168.1.2');
            
            expect(result).toBe(true);
            expect(roomManager.isIPBlockedInRoom(roomId, '192.168.1.2')).toBe(true);
            expect(roomManager.getBlockedIPsInRoom(roomId)).toContain('192.168.1.2');
        });

        it('should unblock IP in room', () => {
            roomManager.blockIPInRoom(roomId, '192.168.1.2');
            const result = roomManager.unblockIPInRoom(roomId, '192.168.1.2');
            
            expect(result).toBe(true);
            expect(roomManager.isIPBlockedInRoom(roomId, '192.168.1.2')).toBe(false);
        });

        it('should return false when unblocking non-blocked IP', () => {
            const result = roomManager.unblockIPInRoom(roomId, '192.168.1.2');
            
            expect(result).toBe(false);
        });

        it('should remove client by IP', () => {
            roomManager.joinRoom(roomId, '192.168.1.2');
            const result = roomManager.removeClientByIP(roomId, '192.168.1.2');
            
            expect(result).toBe(true);
            expect(roomManager.getClientsInRoom(roomId)).not.toContain('192.168.1.2');
        });

        it('should return false when removing non-existent client', () => {
            const result = roomManager.removeClientByIP(roomId, '192.168.1.99');
            
            expect(result).toBe(false);
        });
    });
});