import express from "express";
import { WebSocketServer, WebSocket } from "ws";
import { UserManager } from "./managers/UserManager.js";

const app = express();

app.get("/", (_, res) => {
    res.json("hello from metaverse websocket server");
});

const httpServer = app.listen(8080, () => {
    console.log("WebSocket server running on port 8080");
});

const wss = new WebSocketServer({ server: httpServer });
const userManager = new UserManager();

// Single global ping interval instead of per-connection intervals
const pingInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: "PING" }));
        }
    });
}, 30000);

wss.on("connection", function connection(ws: WebSocket) {
    userManager.addUser(ws);
    
    // Handle connection cleanup when WebSocket closes
    ws.on("close", () => {
        // Cleanup is handled in UserManager.addHandler
    });
    
    ws.on("error", () => {
        // Cleanup is handled in UserManager.addHandler
    });
});

// Cleanup on server shutdown
process.on("SIGINT", () => {
    console.log("Shutting down servers...");
    clearInterval(pingInterval);
    wss.close();
    httpServer.close();
    process.exit(0);
});
