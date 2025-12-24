import { WebSocket } from "ws";
import { SpaceManager } from "./SpaceManager.js";

interface User {
    userId : string,
    socket : WebSocket,
    status : "Idle" | "InSpace"
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

export class UserManager {
    // private rooms : 
    private spaces : Map<string, SpaceManager>;
    private socketToUserId : Map<string, User>;

    constructor(){
        this.spaces = new Map();
        this.socketToUserId = new Map<string, User>();
    }

    addUser(socket : WebSocket){
        this.addHandler(socket)
    }

    /**
     * Ensures unique mapping between userId and socket
     * - If userId already mapped to different socket: removes old mapping
     * - If socket already mapped to different userId: removes old mapping
     * - Then sets the new mapping
     */
    private setUserIdSocketMapping(userId: string, socket: WebSocket): void {
        // Validate socket is still open before mapping
        if (socket.readyState !== WebSocket.OPEN) {
            console.warn(`Cannot map userId ${userId} to closed socket`);
            return;
        }

        // Check if this is a new user or existing user
        const existingUser = this.socketToUserId.get(userId);
        const isNewUser = !existingUser;
        const isReconnect = existingUser && existingUser.socket !== socket;

        // Check if userId is already mapped to a different socket
        if (existingUser && existingUser.socket !== socket) {
            console.log(`User ${userId} reconnected with new socket. Cleaning up old socket mapping.`);
            // Find and remove any userId that was mapped to the old socket
            this.socketToUserId.forEach((socketValue, mappedUserId) => {
                if (socketValue.socket === existingUser.socket) {
                    this.socketToUserId.delete(mappedUserId);
                }
            });
        }

        // Check if socket is already mapped to a different userId
        this.socketToUserId.forEach((socketValue, mappedUserId) => {
            if (socketValue.socket === socket && mappedUserId !== userId) {
                console.log(`Socket reassigned from user ${mappedUserId} to ${userId}. Removing old mapping.`);
                this.socketToUserId.delete(mappedUserId);
            }
        });

        // Set the new mapping - preserve existing status if user already exists
        const preservedStatus = existingUser?.status || "Idle";
        this.socketToUserId.set(userId, { userId, socket , status : preservedStatus});
    }

    removeUser(socket : WebSocket){
        // Find the userId for this socket before removing
        let disconnectedUserId: string | null = null;
        this.socketToUserId.forEach((socketValue, userId) => {
            if(socketValue.socket === socket){
                disconnectedUserId = userId;
            }
        });

        // Find and handle user leaving from all spaces
        this.spaces.forEach(space => {
            if (space instanceof SpaceManager) {
                // Handle disconnection logic if needed
            }
        });
        
        // Remove from mapping
        if(disconnectedUserId){
            this.socketToUserId.delete(disconnectedUserId);
        }
    }

    addHandler(socket : WebSocket){
        socket.on("message" , (data)=>{

            const message = JSON.parse(data.toString())
            console.log("message is :", message)
            // Store socket to userId mapping for any message that contains userId
            // This ensures uniqueness: one userId -> one socket, one socket -> one userId
            if (message.userId) {
                this.setUserIdSocketMapping(message.userId, socket);
            }
            
            switch(message.type){
                case "CREATE_SPACE": {
                    // Always assign color server-side (ignore any color from client)
                    // Color will be assigned in SpaceManager constructor
                    const space = new SpaceManager(socket, message.spaceId, message.userId, message.spaceName, message.username, "")
                    this.spaces.set(message.spaceId, space)
                    // Get the assigned color using the helper method
                    const assignedColor = space.getUserColour(message.userId);
                    socket.send(JSON.stringify({type : "CREATE_SPACE_RESPONSE", status : true, message : "You have created the space successfully", spaceId : message.spaceId, userColour : assignedColor }))
                    console.log("this is the space created", space)
                    break;
                }

                case "JOIN_SPACE": {
                    const space = this.spaces.get(message.spaceId);
                    if(space && space instanceof SpaceManager){
                        space.joinSpace(socket, message)
                    } else {
                        socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : false, message : "Space not found", spaceId : message.spaceId}))
                        socket.send(JSON.stringify({type : "SPACE_NOT_FOUND"}))
                    }
                    break;
                }

                case "QUICK_JOIN_SPACE": {
                    const randomRoom = Array.from(this.spaces.values())[Math.floor(Math.random() * this.spaces.size)]
                    if(randomRoom){
                        socket.send(JSON.stringify({type : "QUICK_JOIN_RESPONSE", status : true, spaceId : randomRoom.spaceId}))
                    }else {
                        socket.send(JSON.stringify({type : "QUICK_JOIN_RESPONSE", status : false, message : "No spaces available"}))
                    }
                    break;
                }

                // case "GET_JOIN_EVENTS": {
                //     const space = this.spaces.get(message.spaceId);
                //     if(space && space instanceof SpaceManager){
                //         space.getJoinEvents(socket, message)
                //     } else {
                //         socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : false, message : "Space not found", spaceId : message.spaceId}))
                //         socket.send(JSON.stringify({type : "SPACE_NOT_FOUND"}))
                //     }
                //     break;
                // }
    
                case "SEND_CHAT": {
                    const space = this.spaces.get(message.spaceId);
                    if(space && space instanceof SpaceManager){
                        space.sendChat(message)
                    } else {
                        socket.send(JSON.stringify({type : "SPACE_NOT_FOUND"}))
                    }
                    break;
                }

                case "MOVE": {
                    const space = this.spaces.get(message.spaceId);
                    if(space && space instanceof SpaceManager){
                        space.move(socket, message)
                    } else {
                        socket.send(JSON.stringify({type : "SPACE_NOT_FOUND"}))
                    }
                    break;
                }

                case "LEAVE_SPACE": {
                    const space = this.spaces.get(message.spaceId);
                    if(space && space instanceof SpaceManager){
                        space.leaveSpace(message.userId)
                    }
                    break;
                }

                default:
                    console.warn("Unhandled message type:", message.type);
                    break;
            }
        })

        socket.on("close", ()=>{
            console.log("socket closed")
            this.removeUser(socket)
            console.log("user removed")
        })
    }
}