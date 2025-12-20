import type { WebSocket } from "ws";

interface User {
    id: string;
    ws: WebSocket;
    x: number;
    y: number;
    color: string;
}

export type { User };