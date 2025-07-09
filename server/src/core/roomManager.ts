import {BasePayload} from "../handler/baseHandler";


interface Story {
    id: string;
    title?: string;
    description?: string;
    votes: Map<string, Number>; // IP address -> Vote
    revealed: boolean;
}

interface Room {
    id: string;
    adminIP: string;
    roomName: string;
    clients: Set<string>; // Set of IP addresses
    stories: Map<string, Story>; // storyId -> Story
    currentStoryId?: string;
    blockedIPs: Set<string>; // Set of blocked IP addresses
}


export class RoomManager {
    private rooms: Map<string, Room> = new Map(); // roomId -> Room
    static instance: RoomManager;

    constructor() {
        if (RoomManager.instance) {
            return RoomManager.instance;
        }
        RoomManager.instance = this;
    }

    public createRoom(adminIP: string, roomName: string, stories: BasePayload["stories"]): string {
        const roomId = this.generateUniqueRoomId();
        this.rooms.set(roomId, {
            id: roomId,
            adminIP,
            roomName: roomName,
            clients: new Set([adminIP]),
            stories: new Map(),
            blockedIPs: new Set(),
        });
        
        // Create stories from the provided list
        if (stories && stories.length > 0) {
            stories.forEach(story => {
                this.createStory(roomId, story.id, story.title, story.description);
            });
            // Set the first story as current
            this.rooms.get(roomId)!.currentStoryId = stories[0].id;
        } else {
            // Create a default "current" story for immediate use if no stories provided
            this.createStory(roomId, "current", "Current Story");
        }
        
        console.log(`Room created: ${roomId} by admin IP ${adminIP} with ${stories?.length || 0} stories`);
        return roomId;
    }

    public joinRoom(
        roomId: string,
        clientIP: string,
    ): boolean {
        const room = this.rooms.get(roomId);
        if (room) {
            // Check if client's IP is blocked in this room
            if (room.blockedIPs.has(clientIP)) {
                console.warn(
                    `Blocked IP ${clientIP} attempted to join room ${roomId}`,
                );
                return false;
            }
            
            // Ensure default "current" story exists
            if (!room.stories.has("current")) {
                this.createStory(roomId, "current", "Current Story");
            }
            
            room.clients.add(clientIP);
            console.log(`Client IP ${clientIP} joined room ${roomId}`);
            return true;
        } else {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }
    }

    public leaveRoom(roomId: string, clientIP: string): void {
        const room = this.rooms.get(roomId);
        if (room) {
            room.clients.delete(clientIP);
            console.log(`Client IP ${clientIP} left room ${roomId}`);

            // If admin leaves, assign a new admin or close the room
            if (clientIP === room.adminIP && room.clients.size > 0) {
                room.adminIP = [...room.clients][0]; // Assign first remaining client as admin
                console.log(
                    `New admin assigned for room ${roomId}: ${room.adminIP}`,
                );
            } else if (room.clients.size === 0) {
                // Delete room if empty
                this.rooms.delete(roomId);
                console.log(`Room ${roomId} deleted (empty)`);
            }
        } else {
            console.error(`Room ${roomId} does not exist.`);
        }
    }

    public isAdmin(roomId: string, clientIP: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.adminIP === clientIP : false;
    }

    public getRoomName(roomId: string): string {
        const room = this.rooms.get(roomId);
        return room ? room.roomName : "";
    }

    public getClientsInRoom(roomId: string): string[] {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room.clients) : [];
    }

    public getStoriesInRoom(roomId: string): Array<Story> {
        const room = this.rooms.get(roomId);
        if (!room) return [];
        return Array.from(room.stories.values());
    }

    public setCurrentStory(roomId: string, storyId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;
        
        if (!room.stories.has(storyId)) return false;
        
        room.currentStoryId = storyId;
        return true;
    }

    public getStory(roomId: string, storyId: string): Story | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        return room.stories.get(storyId) || null;
    }

    public getCurrentStory(roomId: string): Story | null {
        const room = this.rooms.get(roomId);
        if (!room) return null;
        
        if (room.currentStoryId) {
            return room.stories.get(room.currentStoryId) || null;
        }
        
        // Fall back to first story if no current story is set
        const stories = Array.from(room.stories.values());
        return stories.length > 0 ? stories[0] : null;
    }

    public blockClient(clientIP: string): void {
        // Remove blocked client from all rooms
        this.rooms.forEach((room, roomId) => {
            if (room.clients.has(clientIP)) {
                this.leaveRoom(roomId, clientIP);
            }
        });
    }

    public createStory(
        roomId: string,
        storyId: string,
        title?: string,
        description?: string,
    ): boolean {
        const room = this.rooms.get(roomId);
        if (room) {
            if (!room.stories.has(storyId)) {
                room.stories.set(storyId, {
                    id: storyId,
                    title,
                    description,
                    votes: new Map(),
                    revealed: false,
                });
                if (!room.currentStoryId) {
                    room.currentStoryId = storyId;
                }
                return true;
            } else {
                console.warn(
                    `Story ${storyId} already exists in room ${roomId}`,
                );
                return false;
            }
        } else {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }
    }

    public recordVote(
        roomId: string,
        storyId: string,
        clientIP: string,
        voteValue: string,
    ): boolean {
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

        if (!room.clients.has(clientIP)) {
            console.error(`Client IP ${clientIP} is not in room ${roomId}`);
            return false;
        }

        story.votes.set(clientIP, Number(voteValue));
        console.log(
            `Vote recorded for client IP ${clientIP} in story ${storyId}: ${voteValue}`,
        );
        return true;
    }

    public revealVotes(
        roomId: string,
        storyId: string,
    ): Map<string, Number> | null {
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

        console.log(room.stories)
        if (!this.haveAllVoted(roomId, storyId)) {
            console.warn(
                `Not all clients have voted for story ${storyId} in room ${roomId}`,
            );
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

    public haveAllVoted(roomId: string, storyId: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) return false;

        const story = room.stories.get(storyId);
        if (!story) return false;

        // Check if all clients in the room have voted
        return [...room.clients].every((clientIP) => story.votes.has(clientIP));
    }

    private generateUniqueRoomId(): string {
        // Generate a 6-character alphanumeric code
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let result = "";

        let isUnique = false;
        while (!isUnique) {
            result = "";
            for (let i = 0; i < 6; i++) {
                result += chars.charAt(
                    Math.floor(Math.random() * chars.length),
                );
            }
            // ensure it's not already in use
            isUnique = !this.roomExists(result);
        }

        return result;
    }

    public roomExists(roomId: string): boolean {
        return this.rooms.has(roomId);
    }

    public blockIPInRoom(roomId: string, ipAddress: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }

        room.blockedIPs.add(ipAddress);
        console.log(`IP ${ipAddress} blocked in room ${roomId}`);

        // Remove all clients with this IP from the room
        // Note: This would require tracking client IPs, which we'll need to implement
        return true;
    }

    public unblockIPInRoom(roomId: string, ipAddress: string): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }

        const wasBlocked = room.blockedIPs.has(ipAddress);
        room.blockedIPs.delete(ipAddress);

        if (wasBlocked) {
            console.log(`IP ${ipAddress} unblocked in room ${roomId}`);
        }

        return wasBlocked;
    }

    public isIPBlockedInRoom(roomId: string, ipAddress: string): boolean {
        const room = this.rooms.get(roomId);
        return room ? room.blockedIPs.has(ipAddress) : false;
    }

    public getBlockedIPsInRoom(roomId: string): string[] {
        const room = this.rooms.get(roomId);
        return room ? Array.from(room.blockedIPs) : [];
    }

    public removeClientByIP(
        roomId: string,
        ipAddress: string,
    ): boolean {
        const room = this.rooms.get(roomId);
        if (!room) {
            console.error(`Room ${roomId} does not exist.`);
            return false;
        }

        if (room.clients.has(ipAddress)) {
            this.leaveRoom(roomId, ipAddress);
            console.log(`Removed client with IP ${ipAddress} from room ${roomId}`);
            return true;
        }

        return false;
    }
}
