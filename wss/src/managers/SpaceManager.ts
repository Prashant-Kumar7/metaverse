import WebSocket from "ws";

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

export class SpaceManager {
    private host : Host;
    private participants : Participant;
    public spaceId : string;
    private spaceName : string;
    private playerList : Player[];
    

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
        // Always assign color server-side (ignore any color from client)
        const assignedColor = generateRandomColor();
        this.playerList = [{ userId: this.host.userId, username: username, userColour : assignedColor }]
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
            socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : true, message : "You are already in the space", spaceId : this.spaceId, userColour : userColour}))
        } else {
            socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : true, message : "You have joined the space successfully", spaceId : this.spaceId, userColour : userColour}))
        }
        // socket.send(JSON.stringify({type : "room_state", roomState : this.roomState}))
        
        // Broadcast updated player list to all players
        this.playerList.forEach(player => {
            if (this.participants[player.userId]) {
                this.participants[player.userId]?.send(JSON.stringify({type : "PLAYER_LIST", playerList : this.playerList}))
            }
        })
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
}