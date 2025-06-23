interface Vote {
    clientId: string;
    value: string;
}

interface Story {
    id: string;
    title?: string;
    description?: string;
    votes: Map<string, Vote>; // clientId -> Vote
    revealed: boolean;
}

interface Room {
    id: string;
    adminId: string;
    clients: Set<string>;
    stories: Map<string, Story>; // storyId -> Story
    currentStoryId?: string;
}

export class RoomManager{
    private rooms: Map<string, Room> = new Map(); // roomId -> Room
    private blockedClients: Set<string> = new Set(); // Set of blocked clientIds
    static instance: RoomManager;

    constructor() {
        if (RoomManager.instance) {
            return RoomManager.instance;
        }
        RoomManager.instance = this;
    }

    public createRoom(roomId: string, adminId: string): void {
        if (!this.rooms.has(roomId)) {
            this.rooms.set(roomId, {
                id: roomId,
                adminId,
                clients: new Set(),
                stories: new Map()
            });
            console.log(`Room ${roomId} created with admin ${adminId}`);
        } else {
            console.warn(`Room ${roomId} already exists.`);
        }
    }

    public joinRoom(roomId: string, clientId: string): boolean {
        const room = this.rooms.get(roomId);
        if (room) {
            if (this.blockedClients.has(clientId)) {
                console.warn(`Blocked client ${clientId} attempted to join room ${roomId}`);
                return false;
            }
            room.clients.add(clientId);
            console.log(`Client ${clientId} joined room ${roomId}`);
            return true;
        } else {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }
    }

    public leaveRoom(roomId: string, clientId: string): void {
        const room = this.rooms.get(roomId);
        if (room) {
            room.clients.delete(clientId);
            console.log(`Client ${clientId} left room ${roomId}`);
            
            // If admin leaves, assign a new admin or close the room
            if (clientId === room.adminId && room.clients.size > 0) {
                room.adminId = [...room.clients][0]; // Assign first remaining client as admin
                console.log(`New admin assigned for room ${roomId}: ${room.adminId}`);
            } else if (room.clients.size === 0) {
                // Delete room if empty
                this.rooms.delete(roomId);
                console.log(`Room ${roomId} deleted (empty)`);
            }
        } else {
            console.error(`Room ${roomId} does not exist.`);
        }
    }

    public isAdmin(roomId: string, clientId: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.adminId === clientId : false;
    }

    public blockClient(clientId: string): void {
        this.blockedClients.add(clientId);
        console.log(`Client ${clientId} has been blocked`);
        
        // Remove blocked client from all rooms
        this.rooms.forEach((room, roomId) => {
            if (room.clients.has(clientId)) {
                this.leaveRoom(roomId, clientId);
            }
        });
    }

    public createStory(roomId: string, storyId: string, title?: string, description?: string): boolean {
        const room = this.rooms.get(roomId);
        if (room) {
            if (!room.stories.has(storyId)) {
                room.stories.set(storyId, {
                    id: storyId,
                    title,
                    description,
                    votes: new Map(),
                    revealed: false
                });
                if (!room.currentStoryId) {
                    room.currentStoryId = storyId;
                }
                return true;
            } else {
                console.warn(`Story ${storyId} already exists in room ${roomId}`);
                return false;
            }
        } else {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }
    }

    public recordVote(roomId: string, storyId: string, clientId: string, voteValue: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }
        
        const story = room.stories.get(storyId);
        if (!story) {
            console.error(`Story ${storyId} does not exist in room ${roomId}`);
            return false;
        }
        
        if (!room.clients.has(clientId)) {
            console.error(`Client ${clientId} is not in room ${roomId}`);
            return false;
        }
        
        story.votes.set(clientId, { clientId, value: voteValue });
        console.log(`Vote recorded for client ${clientId} in story ${storyId}: ${voteValue}`);
        return true;
    }

    public revealVotes(roomId: string, storyId: string): Map<string, Vote> | null {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`Room ${roomId} does not exist.`);
            return null;
        }
        
        const story = room.stories.get(storyId);
        if (!story) {
            console.error(`Story ${storyId} does not exist in room ${roomId}`);
            return null;
        }
        
        story.revealed = true;
        return story.votes;
    }

    public resetVotes(roomId: string, storyId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }
        
        const story = room.stories.get(storyId);
        if (!story) {
            console.error(`Story ${storyId} does not exist in room ${roomId}`);
            return false;
        }
        
        story.votes.clear();
        story.revealed = false;
        return true;
    }

    public getClientsInRoom(roomId: string): Set<string> | undefined {
        const room = this.rooms.get(roomId);
        return room?.clients;
    }

    public haveAllVoted(roomId: string, storyId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        
        const story = room.stories.get(storyId);
        if (!story) return false;
        
        // Check if all clients in the room have voted
        return [...room.clients].every(clientId => story.votes.has(clientId));
    }
}