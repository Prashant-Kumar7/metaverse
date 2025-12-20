import type { Space } from "../types/space.js";
import type { User } from "../types/user.js";

class SpaceManager {
    private spaces: Map<string, Space> = new Map();
    private defaultSpaceId = "default_space";

    constructor() {
        // Create default space
        this.spaces.set(this.defaultSpaceId, {
            id: this.defaultSpaceId,
            users: new Map(),
        });
    }

    addUserToSpace(user: User, spaceId: string = this.defaultSpaceId): void {
        const space = this.spaces.get(spaceId);
        if (space) {
            space.users.set(user.id, user);
        }
    }

    removeUserFromSpace(userId: string, spaceId: string = this.defaultSpaceId): void {
        const space = this.spaces.get(spaceId);
        if (space) {
            space.users.delete(userId);
        }
    }

    getSpaceUsers(spaceId: string = this.defaultSpaceId): User[] {
        const space = this.spaces.get(spaceId);
        if (space) {
            return Array.from(space.users.values());
        }
        return [];
    }

    broadcastToSpace(message: object, excludeUserId?: string, spaceId: string = this.defaultSpaceId): void {
        const space = this.spaces.get(spaceId);
        if (space) {
            const messageStr = JSON.stringify(message);
            const msg = message as { userId?: string; type?: string };
            console.log(`[BROADCAST] Broadcasting ${msg.type} for userId ${msg.userId}, excluding ${excludeUserId}`);
            console.log(`[BROADCAST] Users in space:`, Array.from(space.users.keys()));
            
            space.users.forEach((user) => {
                if (user.id !== excludeUserId && user.ws.readyState === 1) { // 1 = OPEN
                    console.log(`[BROADCAST] Sending to user ${user.id}`);
                    user.ws.send(messageStr);
                } else {
                    if (user.id === excludeUserId) {
                        console.log(`[BROADCAST] Skipping user ${user.id} (excluded)`);
                    } else {
                        console.log(`[BROADCAST] Skipping user ${user.id} (WebSocket not open, readyState: ${user.ws.readyState})`);
                    }
                }
            });
        }
    }
}

export { SpaceManager };