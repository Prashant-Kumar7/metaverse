import WebSocket from "ws";

interface ProximityRoom {
    roomId: string;
    userIds: Set<string>;
    intervalId: NodeJS.Timeout | null;
}

interface Participant {
    [key: string]: WebSocket;
}

export class ProximityManager {
    private proximityRooms: Map<string, ProximityRoom>; // Map from groupKey to ProximityRoom
    private userToProximityRoom: Map<string, string>; // Map from userId to groupKey
    private userProximityGroups: Set<string>; // Track which user groups are already in proximity
    private participants: Participant;
    private spaceId: string;
    private readonly PROXIMITY_DISTANCE: number;
    private readonly COLLISION_DISTANCE: number;

    constructor(participants: Participant, spaceId: string, collisionDistance: number) {
        this.proximityRooms = new Map();
        this.userToProximityRoom = new Map();
        this.userProximityGroups = new Set();
        this.participants = participants;
        this.spaceId = spaceId;
        this.COLLISION_DISTANCE = collisionDistance;
        this.PROXIMITY_DISTANCE = collisionDistance * 2; // 60 pixels
    }

    private generateSubRoomId(): string {
        return `subroom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    private sendProximityMessage(room: ProximityRoom) {
        const userIdsArray = Array.from(room.userIds);
        const message = `You are in proximity with ${userIdsArray.join(', ')}`;
        
        userIdsArray.forEach((userId) => {
            const socket = this.participants[userId];
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "PROXIMITY_MESSAGE",
                    roomId: room.roomId,
                    message: message,
                    userIds: userIdsArray
                }));
            }
        });
    }

    private sendWebRTCConnected(room: ProximityRoom) {
        const userIdsArray = Array.from(room.userIds);
        
        userIdsArray.forEach((userId) => {
            const socket = this.participants[userId];
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "webrtc_connected",
                    roomId: room.roomId,
                    userIds: userIdsArray
                }));
            }
        });
    }

    private sendProximityLeftMessage(room: ProximityRoom) {
        const userIdsArray = Array.from(room.userIds);
        
        userIdsArray.forEach((userId) => {
            const socket = this.participants[userId];
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "PROXIMITY_LEFT",
                    roomId: room.roomId,
                    message: "You have left proximity with other users"
                }));
            }
        });
    }

    private sendWebRTCDisconnected(room: ProximityRoom, disconnectedUserId?: string) {
        const userIdsArray = Array.from(room.userIds);
        
        userIdsArray.forEach((userId) => {
            const socket = this.participants[userId];
            if (socket && socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({
                    type: "webrtc_disconnected",
                    roomId: room.roomId,
                    disconnectedUserId: disconnectedUserId
                }));
            }
        });
    }

    private createProximityRoom(groupKey: string, userIds: string[]): ProximityRoom {
        const roomId = this.generateSubRoomId();
        const userIdsSet = new Set(userIds);
        
        const room: ProximityRoom = {
            roomId: roomId,
            userIds: userIdsSet,
            intervalId: null
        };
        
        // Send message every 30 seconds
        room.intervalId = setInterval(() => {
            this.sendProximityMessage(room);
        }, 30000);
        
        // Send initial message immediately
        this.sendProximityMessage(room);
        
        // Notify users to start WebRTC connections
        this.sendWebRTCConnected(room);
        
        return room;
    }

    private destroyProximityRoom(groupKey: string) {
        const room = this.proximityRooms.get(groupKey);
        if (room) {
            // Notify all users that they've left proximity and to close WebRTC connections
            this.sendProximityLeftMessage(room);
            this.sendWebRTCDisconnected(room);
            
            if (room.intervalId) {
                clearInterval(room.intervalId);
            }
            // Remove user mappings
            room.userIds.forEach((userId) => {
                this.userToProximityRoom.delete(userId);
            });
            this.proximityRooms.delete(groupKey);
        }
    }

    private updateProximityRoom(groupKey: string, userIds: string[]) {
        const existingRoom = this.proximityRooms.get(groupKey);
        
        if (existingRoom) {
            // Update existing room
            const newUserIdsSet = new Set(userIds);
            const oldUserIdsSet = new Set(existingRoom.userIds);
            
            // Check if group composition changed
            const added = userIds.filter(id => !oldUserIdsSet.has(id));
            const removed = Array.from(oldUserIdsSet).filter(id => !newUserIdsSet.has(id));
            
            if (added.length > 0 || removed.length > 0) {
                // Group changed - log it
                if (removed.length > 0) {
                    console.log(`[ProximityManager] ${removed.length} user(s) left proximity group: ${removed.join(', ')}. Now ${userIds.length} users in proximity: ${userIds.join(', ')} in space ${this.spaceId}`);
                }
                if (added.length > 0) {
                    console.log(`[ProximityManager] ${added.length} user(s) joined proximity group. Now ${userIds.length} users in proximity: ${userIds.join(', ')} in space ${this.spaceId}`);
                }
                
                // Update room
                existingRoom.userIds = newUserIdsSet;
                
                // Update user mappings
                removed.forEach((userId) => {
                    this.userToProximityRoom.delete(userId);
                });
                added.forEach((userId) => {
                    this.userToProximityRoom.set(userId, groupKey);
                });
                
                // Send updated message
                this.sendProximityMessage(existingRoom);
                
                // If new users joined, notify to establish WebRTC connections
                if (added.length > 0) {
                    this.sendWebRTCConnected(existingRoom);
                }
            }
        } else {
            // Create new room
            const room = this.createProximityRoom(groupKey, userIds);
            this.proximityRooms.set(groupKey, room);
            userIds.forEach((userId) => {
                this.userToProximityRoom.set(userId, groupKey);
            });
        }
    }

    checkUserProximity(userPositions: Map<string, { x: number; y: number }>) {
        const proximitySq = this.PROXIMITY_DISTANCE * this.PROXIMITY_DISTANCE;
        
        // Find all users within proximity distance of each other
        const proximityGraph: Map<string, Set<string>> = new Map();
        
        // Build a graph of users who are close to each other
        userPositions.forEach((position1, userId1) => {
            const neighbors = new Set<string>();
            userPositions.forEach((position2, userId2) => {
                if (userId1 === userId2) return;
                
                const dx = position1.x - position2.x;
                const dy = position1.y - position2.y;
                const distanceSq = dx * dx + dy * dy;
                
                if (distanceSq <= proximitySq) {
                    neighbors.add(userId2);
                }
            });
            if (neighbors.size > 0) {
                proximityGraph.set(userId1, neighbors);
            }
        });
        
        // Find connected components (groups of users all within proximity of each other)
        const visited = new Set<string>();
        const groups: string[][] = [];
        
        proximityGraph.forEach((neighbors, userId) => {
            if (visited.has(userId)) return;
            
            // Find all users in this connected component
            const group: string[] = [userId];
            const toVisit = [userId];
            visited.add(userId);
            
            while (toVisit.length > 0) {
                const current = toVisit.pop()!;
                const currentNeighbors = proximityGraph.get(current) || new Set();
                
                currentNeighbors.forEach((neighbor) => {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        group.push(neighbor);
                        toVisit.push(neighbor);
                    }
                });
            }
            
            // Only process groups with 2 or more users
            if (group.length >= 2) {
                groups.push(group.sort()); // Sort for consistent group key
            }
        });
        
        // Process groups - create/update proximity rooms
        groups.forEach((group) => {
            const groupKey = group.join('-');
            
            if (!this.userProximityGroups.has(groupKey)) {
                // New group formed
                console.log(`[ProximityManager] ${group.length} users came in proximity: ${group.join(', ')} in space ${this.spaceId}`);
                
                // Calculate distances between all pairs in the group for detailed logging
                const distances: string[] = [];
                for (let i = 0; i < group.length; i++) {
                    for (let j = i + 1; j < group.length; j++) {
                        const userId1 = group[i];
                        const userId2 = group[j];
                        if (!userId1 || !userId2) continue;
                        
                        const pos1 = userPositions.get(userId1);
                        const pos2 = userPositions.get(userId2);
                        if (!pos1 || !pos2) continue;
                        
                        const dx = pos1.x - pos2.x;
                        const dy = pos1.y - pos2.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        distances.push(`${userId1} and ${userId2}: ${distance.toFixed(2)}px`);
                    }
                }
                if (distances.length > 0) {
                    console.log(`[ProximityManager] Distances: ${distances.join('; ')}`);
                }
                
                this.userProximityGroups.add(groupKey);
                // Create proximity room
                this.updateProximityRoom(groupKey, group);
            } else {
                // Existing group - update it (in case users joined/left)
                this.updateProximityRoom(groupKey, group);
            }
        });
        
        // Find current group keys
        const currentGroupKeys = new Set(groups.map(g => g.sort().join('-')));
        
        // Remove groups that are no longer in proximity
        this.userProximityGroups.forEach((groupKey) => {
            if (!currentGroupKeys.has(groupKey)) {
                // This group no longer exists - users moved apart
                const groupUsers = groupKey.split('-');
                console.log(`[ProximityManager] Users escaped proximity (${groupUsers.length} users): ${groupUsers.join(', ')} in space ${this.spaceId}`);
                this.userProximityGroups.delete(groupKey);
                // Destroy proximity room
                this.destroyProximityRoom(groupKey);
            }
        });
    }

    removeUser(userId: string) {
        const userRoomKey = this.userToProximityRoom.get(userId);
        if (userRoomKey) {
            const room = this.proximityRooms.get(userRoomKey);
            if (room) {
                // Notify other users that this user disconnected
                this.sendWebRTCDisconnected(room, userId);
                
                room.userIds.delete(userId);
                // If room has less than 2 users, destroy it
                if (room.userIds.size < 2) {
                    this.destroyProximityRoom(userRoomKey);
                    this.userProximityGroups.delete(userRoomKey);
                } else {
                    // Update remaining users
                    const remainingUsers = Array.from(room.userIds);
                    const newGroupKey = remainingUsers.sort().join('-');
                    console.log(`[ProximityManager] User ${userId} left proximity group. Now ${remainingUsers.length} users in proximity: ${remainingUsers.join(', ')} in space ${this.spaceId}`);
                    
                    // Update room key if needed
                    if (newGroupKey !== userRoomKey) {
                        this.proximityRooms.delete(userRoomKey);
                        this.proximityRooms.set(newGroupKey, room);
                        remainingUsers.forEach((uid) => {
                            this.userToProximityRoom.set(uid, newGroupKey);
                        });
                        this.userProximityGroups.delete(userRoomKey);
                        this.userProximityGroups.add(newGroupKey);
                    }
                }
            }
            this.userToProximityRoom.delete(userId);
        }
        
        // Clean up any remaining proximity groups
        this.userProximityGroups.forEach((groupKey) => {
            if (groupKey.includes(userId)) {
                this.userProximityGroups.delete(groupKey);
                this.destroyProximityRoom(groupKey);
            }
        });
    }

    updateParticipants(participants: Participant) {
        this.participants = participants;
    }

    // WebRTC signaling handlers
    handleWebRTCMessage(senderUserId: string, message: any): boolean {
        // Find which proximity room the sender is in
        const userRoomKey = this.userToProximityRoom.get(senderUserId);
        if (!userRoomKey) {
            console.warn(`[ProximityManager] User ${senderUserId} not in any proximity room for WebRTC message`);
            return false;
        }

        const room = this.proximityRooms.get(userRoomKey);
        if (!room) {
            console.warn(`[ProximityManager] Proximity room ${userRoomKey} not found`);
            return false;
        }

        // Verify sender is in this room
        if (!room.userIds.has(senderUserId)) {
            console.warn(`[ProximityManager] User ${senderUserId} not in room ${userRoomKey}`);
            return false;
        }

        // Handle different WebRTC message types
        switch (message.type) {
            case "createOffer": {
                // Relay offer to target user
                const targetUserId = message.targetUserId;
                if (!targetUserId || !room.userIds.has(targetUserId)) {
                    console.warn(`[ProximityManager] Invalid target user ${targetUserId} for offer from ${senderUserId}`);
                    return false;
                }

                const targetSocket = this.participants[targetUserId];
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        type: "createOffer",
                        offer: message.offer,
                        senderUserId: senderUserId,
                        roomId: room.roomId
                    }));
                    console.log(`[ProximityManager] Relayed offer from ${senderUserId} to ${targetUserId}`);
                }
                return true;
            }

            case "createAnswer": {
                // Relay answer to target user
                const targetUserId = message.targetUserId;
                if (!targetUserId || !room.userIds.has(targetUserId)) {
                    console.warn(`[ProximityManager] Invalid target user ${targetUserId} for answer from ${senderUserId}`);
                    return false;
                }

                const targetSocket = this.participants[targetUserId];
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        type: "createAnswer",
                        answer: message.answer,
                        senderUserId: senderUserId,
                        roomId: room.roomId
                    }));
                    console.log(`[ProximityManager] Relayed answer from ${senderUserId} to ${targetUserId}`);
                }
                return true;
            }

            case "iceCandidate": {
                // Relay ICE candidate to target user
                const targetUserId = message.targetUserId;
                if (!targetUserId || !room.userIds.has(targetUserId)) {
                    console.warn(`[ProximityManager] Invalid target user ${targetUserId} for ICE candidate from ${senderUserId}`);
                    return false;
                }

                const targetSocket = this.participants[targetUserId];
                if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                    targetSocket.send(JSON.stringify({
                        type: "iceCandidate",
                        candidate: message.candidate,
                        senderUserId: senderUserId,
                        roomId: room.roomId
                    }));
                }
                return true;
            }

            case "close_conn": {
                // Notify target user that connection is closing
                const targetUserId = message.targetUserId;
                if (targetUserId && room.userIds.has(targetUserId)) {
                    const targetSocket = this.participants[targetUserId];
                    if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
                        targetSocket.send(JSON.stringify({
                            type: "close_conn",
                            senderUserId: senderUserId,
                            roomId: room.roomId
                        }));
                        console.log(`[ProximityManager] Relayed close_conn from ${senderUserId} to ${targetUserId}`);
                    }
                }
                return true;
            }

            default:
                console.warn(`[ProximityManager] Unknown WebRTC message type: ${message.type}`);
                return false;
        }
    }
}

