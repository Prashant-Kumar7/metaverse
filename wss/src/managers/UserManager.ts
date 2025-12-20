import type { User } from "../types/user.js";
import type { WebSocket } from "ws";

class UserManager {
    private users: Map<string, User> = new Map();
    private userIdCounter = 0;

    addUser(ws: WebSocket): User {
        const userId = `user_${++this.userIdCounter}`;
        const colors: string[] = ["#ef4444", "#3b82f6"]; // red, blue
        const colorIndex = (this.userIdCounter - 1) % colors.length;
        const color = colors[colorIndex]!;
        
        // For testing: start users in viewport area (visible in typical browser window)
        // Typical viewport is ~1200x800, centered at map center (2000, 2000)
        // So viewport shows roughly (1400-2600, 1600-2400)
        const centerX = 2000; // Center of 4000x4000 map
        const centerY = 2000;
        const spacing = 150; // Space between users for testing
        const startX = centerX - (spacing * (this.userIdCounter - 1)); // Start left of center, spaced horizontally
        const startY = centerY; // Same Y position for all users initially
        
        const user: User = {
            id: userId,
            ws,
            x: startX,
            y: startY,
            color,
        };

        this.users.set(userId, user);
        return user;
    }

    removeUser(userId: string): void {
        this.users.delete(userId);
    }

    getUser(userId: string): User | undefined {
        return this.users.get(userId);
    }

    updateUserPosition(userId: string, x: number, y: number): boolean {
        const user = this.users.get(userId);
        if (user) {
            user.x = x;
            user.y = y;
            return true;
        }
        return false;
    }

    getAllUsers(): User[] {
        return Array.from(this.users.values());
    }

    getUserCount(): number {
        return this.users.size;
    }
}

export { UserManager };