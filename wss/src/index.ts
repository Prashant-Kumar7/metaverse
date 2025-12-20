import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { UserManager } from "./managers/UserManager.js";
import { SpaceManager } from "./managers/SpaceManager.js";

const app = express();

const httpServer = app.listen(8080, () => {
    console.log("WebSocket server running on port 8080");
});

const wss = new WebSocketServer({ server: httpServer });

const userManager = new UserManager();
const spaceManager = new SpaceManager();

wss.on("connection", async function connection(ws: WebSocket) {
    // Add user
    const user = userManager.addUser(ws);
    spaceManager.addUserToSpace(user);

    console.log(`User ${user.id} connected (${user.color})`);

    // Send current user info and all existing users
    ws.send(JSON.stringify({
        type: "connected",
        userId: user.id,
        color: user.color,
        position: { x: user.x, y: user.y }
    }));

    // Send all existing users to the new user
    const existingUsers = spaceManager.getSpaceUsers();
    console.log(`[SERVER] New user ${user.id} connected. Existing users:`, existingUsers.map(u => u.id));
    existingUsers.forEach(existingUser => {
        if (existingUser.id !== user.id) {
            console.log(`[SERVER] Sending existing user ${existingUser.id} to new user ${user.id}`);
            ws.send(JSON.stringify({
                type: "userJoined",
                userId: existingUser.id,
                color: existingUser.color,
                position: { x: existingUser.x, y: existingUser.y }
            }));
        }
    });

    // Broadcast new user to all other users
    console.log(`[SERVER] Broadcasting new user ${user.id} to all other users`);
    spaceManager.broadcastToSpace({
        type: "userJoined",
        userId: user.id,
        color: user.color,
        position: { x: user.x, y: user.y }
    }, user.id);

    // Handle messages
    ws.on("message", (data: Buffer) => {
        try {
            const message = JSON.parse(data.toString());
            
            if (message.type === "move") {
                const { x, y } = message.position;
                console.log(`[SERVER] Received move from user ${user.id}, updating position to (${x}, ${y})`);
                
                // Update user position
                if (userManager.updateUserPosition(user.id, x, y)) {
                    console.log(`[SERVER] Broadcasting move for user ${user.id} to all other users`);
                    // Broadcast movement to all other users
                    spaceManager.broadcastToSpace({
                        type: "userMoved",
                        userId: user.id,
                        position: { x, y }
                    }, user.id);
                } else {
                    console.warn(`[SERVER] Failed to update position for user ${user.id}`);
                }
            }
        } catch (error) {
            console.error("Error parsing message:", error);
        }
    });

    // Handle disconnect
    ws.on("close", () => {
        console.log(`User ${user.id} disconnected`);
        spaceManager.broadcastToSpace({
            type: "userLeft",
            userId: user.id
        }, user.id);
        
        userManager.removeUser(user.id);
        spaceManager.removeUserFromSpace(user.id);
    });

    ws.on("error", (error) => {
        console.error(`WebSocket error for user ${user.id}:`, error);
    });
});

