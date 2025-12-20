import type { User } from "./user.js";

interface Space {
    id: string;
    users: Map<string, User>;
}

export type { Space };