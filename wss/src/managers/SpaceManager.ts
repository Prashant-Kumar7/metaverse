import WebSocket from "ws";
import { ProximityManager } from "./ProximityManager.js";

interface Host{
    socket : WebSocket,
    userId : string
}

interface Participant{
    [key : string] : WebSocket
}

interface Player{
    userId : string,
    username : string,
    userColour : string
}

/**
 * Generates a random hex color
 * @returns A random hex color string (e.g., "#FF5733")
 */
function generateRandomColor(): string {
    // Generate a random color with good visibility (avoiding very dark colors)
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}

interface UserPosition {
    userId: string;
    position: { x: number; y: number };
}

export class SpaceManager {
    private host : Host;
    private participants : Participant;
    public spaceId : string;
    private spaceName : string;
    private playerList : Player[];
    private userPositions : Map<string, { x: number; y: number }>;
    private proximityManager : ProximityManager;
    private readonly MAP_WIDTH = 4000;
    private readonly MAP_HEIGHT = 4000;
    private readonly USER_RADIUS = 15;
    private readonly COLLISION_DISTANCE = 30; // USER_RADIUS * 2

    constructor(socket : WebSocket, spaceId : string, userId : string, spaceName : string, username : string, userColour : string){
        this.spaceId = spaceId;
        this.spaceName = spaceName;
        this.host = {
            socket : socket,
            userId : userId
        }
        this.participants = {
            [this.host.userId] : this.host.socket
        }
        this.userPositions = new Map();
        this.proximityManager = new ProximityManager(this.participants, this.spaceId, this.COLLISION_DISTANCE);
        // Always assign color server-side (ignore any color from client)
        const assignedColor = generateRandomColor();
        this.playerList = [{ userId: this.host.userId, username: username, userColour : assignedColor }]
        // Set initial position for host (center of map)
        this.userPositions.set(this.host.userId, { x: this.MAP_WIDTH / 2, y: this.MAP_HEIGHT / 2 });
    }

    private findAvailablePosition(): { x: number; y: number } {
        // Try to find a position that doesn't collide with existing users
        const centerX = this.MAP_WIDTH / 2;
        const centerY = this.MAP_HEIGHT / 2;
        const minDistance = this.COLLISION_DISTANCE * 3; // Increased spacing
        
        // Start from a minimum radius to avoid center collisions
        const startRadius = this.COLLISION_DISTANCE * 2;
        
        // Try positions in a spiral pattern around center
        for (let radius = startRadius; radius < 1000; radius += minDistance) {
            for (let angle = 0; angle < 360; angle += 20) { // More angles for better coverage
                const rad = (angle * Math.PI) / 180;
                const x = centerX + radius * Math.cos(rad);
                const y = centerY + radius * Math.sin(rad);
                
                // Clamp to map bounds
                const clampedX = Math.max(this.USER_RADIUS, Math.min(x, this.MAP_WIDTH - this.USER_RADIUS));
                const clampedY = Math.max(this.USER_RADIUS, Math.min(y, this.MAP_HEIGHT - this.USER_RADIUS));
                
                // Check if this position collides with any existing user
                let hasCollision = false;
                for (const [userId, pos] of this.userPositions.entries()) {
                    const dx = clampedX - pos.x;
                    const dy = clampedY - pos.y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    if (distance < this.COLLISION_DISTANCE * 1.5) { // Slightly more lenient check
                        hasCollision = true;
                        break;
                    }
                }
                
                if (!hasCollision) {
                    return { x: clampedX, y: clampedY };
                }
            }
        }
        
        // Fallback: random position with better spacing if spiral search fails
        let attempts = 0;
        while (attempts < 50) {
            const x = this.USER_RADIUS + Math.random() * (this.MAP_WIDTH - this.USER_RADIUS * 2);
            const y = this.USER_RADIUS + Math.random() * (this.MAP_HEIGHT - this.USER_RADIUS * 2);
            
            let hasCollision = false;
            for (const [userId, pos] of this.userPositions.entries()) {
                const dx = x - pos.x;
                const dy = y - pos.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < this.COLLISION_DISTANCE * 1.5) {
                    hasCollision = true;
                    break;
                }
            }
            
            if (!hasCollision) {
                return { x, y };
            }
            attempts++;
        }
        
        // Last resort: far from center
        return {
            x: this.MAP_WIDTH * 0.75,
            y: this.MAP_HEIGHT * 0.75
        };
    }

    joinSpace(socket : WebSocket, message : any){
        if(this.playerList.some(p => p.userId === message.userId)){
            this.participants[message.userId] = socket
            // Send join events for reconnecting user
            const existingPlayer = this.playerList.find(p => p.userId === message.userId);
            if(existingPlayer){
                this.sendJoinSpaceEvents(socket, message.userId, true, existingPlayer.userColour)
            }
            return
        }

        if(this.playerList.length >= 6){
            this.sendJoinSpaceFailure(socket, "full")
            return
        }
        // socket.send(JSON.stringify({type : "room_seat_available", userId : message.userId}))

        this.participants[message.userId] = socket
        // Always assign color server-side (ignore any color from client)
        const assignedColor = generateRandomColor();
        this.playerList.push({ userId: message.userId, username: message.username || "", userColour : assignedColor })
        
        // Assign a position that doesn't collide with existing users
        const initialPosition = this.findAvailablePosition();
        this.userPositions.set(message.userId, initialPosition);
        
        // Update proximity manager with latest participants
        this.proximityManager.updateParticipants(this.participants);
        
        this.sendJoinSpaceEvents(socket, message.userId, false, assignedColor)
    }

    sendChat(message : any){
        this.playerList.forEach(player => {
            if (this.participants[player.userId]) {
                this.participants[player.userId]?.send(JSON.stringify({type : "CHAT", chat : message.chat, userId : message.userId}))
            }
        })
    }


    getJoinEvents(socket : WebSocket, message : any, userColour : string){
        if(this.playerList.some(p => p.userId === message.userId)){
            this.sendJoinSpaceEvents(socket, message.userId, true, userColour)
        } else {
            this.sendJoinSpaceEvents(socket, message.userId, false, userColour)
        }
    }
    
    sendJoinSpaceEvents(socket: WebSocket, userId: string, isReconnect: boolean = false, userColour : string) {
        if (isReconnect) {
            const userPosition = this.userPositions.get(userId);
            socket.send(JSON.stringify({
                type : "JOIN_SPACE_RESPONSE", 
                status : true, 
                message : "You are already in the space", 
                spaceId : this.spaceId, 
                userColour : userColour,
                position: userPosition || { x: this.MAP_WIDTH / 2, y: this.MAP_HEIGHT / 2 }
            }))
        } else {
            const userPosition = this.userPositions.get(userId);
            if (!userPosition) {
                console.error(`[SpaceManager] No position found for user ${userId} when sending join events`);
            }
            console.log(`[SpaceManager] Sending position to user ${userId}:`, userPosition);
            socket.send(JSON.stringify({
                type : "JOIN_SPACE_RESPONSE", 
                status : true, 
                message : "You have joined the space successfully", 
                spaceId : this.spaceId, 
                userColour : userColour,
                position: userPosition || { x: this.MAP_WIDTH / 2, y: this.MAP_HEIGHT / 2 }
            }))
        }
        // socket.send(JSON.stringify({type : "room_state", roomState : this.roomState}))
        
        // Send all existing user positions to the newly joined user
        const allPositions: UserPosition[] = [];
        this.userPositions.forEach((position, uid) => {
            if (uid !== userId) { // Don't send the new user's own position
                allPositions.push({ userId: uid, position });
            }
        });
        if (allPositions.length > 0) {
            socket.send(JSON.stringify({type : "USER_POSITIONS", positions : allPositions}))
        }
        
        // Broadcast updated player list to all players
        this.playerList.forEach(player => {
            if (this.participants[player.userId]) {
                this.participants[player.userId]?.send(JSON.stringify({type : "PLAYER_LIST", playerList : this.playerList}))
            }
        })
        
        // If this is a new user joining (not reconnecting), send their position to all existing users
        if (!isReconnect) {
            const newUserPosition = this.userPositions.get(userId);
            if (newUserPosition) {
                const newUserColour = this.getUserColour(userId);
                // Send new user's position to all existing users
                this.playerList.forEach(player => {
                    if (player.userId !== userId && this.participants[player.userId]) {
                        // Send as USER_POSITIONS message so existing users can add the new user
                        this.participants[player.userId]?.send(JSON.stringify({
                            type : "USER_POSITIONS", 
                            positions : [{ userId: userId, position: newUserPosition }]
                        }))
                    }
                })
            }
        }
    }

    sendJoinSpaceFailure(socket: WebSocket, reason: "full" | "not_found") {
        if (reason === "full") {
            socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : false, message : "Space is full", spaceId : this.spaceId}))
        } else {
            socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : false, message : "Space not found", spaceId : this.spaceId}))
        }
    }

    getUserColour(userId: string): string {
        const player = this.playerList.find(p => p.userId === userId);
        return player?.userColour || "#888888";
    }

    move(socket : WebSocket, message : any){
        // Update position on server
        if (message.position && message.userId) {
            this.userPositions.set(message.userId, message.position);
            
            // Update proximity manager with latest participants
            this.proximityManager.updateParticipants(this.participants);
            
            // Check if user is close to other users
            this.proximityManager.checkUserProximity(this.userPositions);
        }
        
        // Find the moving user's color from playerList
        const userColour = this.getUserColour(message.userId);
        
        this.playerList.forEach(player => {
            if (this.participants[player.userId] !== socket) {
                this.participants[player.userId]?.send(JSON.stringify({
                    type : "MOVE", 
                    position : message.position, 
                    userId : message.userId,
                    userColour : userColour
                }))
            }
        })
    }

    leaveSpace(userId: string) {
        // Remove user from player list
        this.playerList = this.playerList.filter(p => p.userId !== userId);
        
        // Remove user from participants
        delete this.participants[userId];
        
        // Remove user position
        this.userPositions.delete(userId);
        
        // Update proximity manager and remove user from proximity
        this.proximityManager.updateParticipants(this.participants);
        this.proximityManager.removeUser(userId);
        
        // Broadcast updated player list to remaining players
        this.playerList.forEach(player => {
            if (this.participants[player.userId]) {
                this.participants[player.userId]?.send(JSON.stringify({
                    type : "PLAYER_LIST", 
                    playerList : this.playerList
                }))
            }
        })
        
        console.log(`[SpaceManager] User ${userId} left space ${this.spaceId}. Remaining players: ${this.playerList.length}`);
    }
}