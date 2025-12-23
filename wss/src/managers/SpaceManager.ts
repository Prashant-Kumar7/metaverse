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
}

export class SpaceManager {
    private host : Host;
    private participants : Participant;
    public spaceId : string;
    private spaceName : string;
    private playerList : Player[];
    

    constructor(socket : WebSocket, spaceId : string, userId : string, spaceName : string, username : string){
        this.spaceId = spaceId;
        this.spaceName = spaceName;
        this.host = {
            socket : socket,
            userId : userId
        }
        this.participants = {
            [this.host.userId] : this.host.socket
        }
        this.playerList = [{ userId: this.host.userId, username: username }]
    }

    joinSpace(socket : WebSocket, message : any){
        if(this.playerList.some(p => p.userId === message.userId)){
            this.participants[message.userId] = socket
            return
        }

        if(this.playerList.length >= 6){
            this.sendJoinSpaceFailure(socket, "full")
            return
        }
        // socket.send(JSON.stringify({type : "room_seat_available", userId : message.userId}))

        this.participants[message.userId] = socket
        this.playerList.push({ userId: message.userId, username: message.username || "" })
        this.sendJoinSpaceEvents(socket, message.userId)
    }

    sendChat(message : any){
        this.playerList.forEach(player => {
            if (this.participants[player.userId]) {
                this.participants[player.userId]?.send(JSON.stringify({type : "CHAT", chat : message.chat, userId : message.userId}))
            }
        })
    }


    getJoinEvents(socket : WebSocket, message : any){
        if(this.playerList.some(p => p.userId === message.userId)){
            this.sendJoinSpaceEvents(socket, message.userId, true)
        } else {
            this.sendJoinSpaceEvents(socket, message.userId, false)
        }
    }
    
    sendJoinSpaceEvents(socket: WebSocket, userId: string, isReconnect: boolean = false) {
        if (isReconnect) {
            socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : true, message : "You are already in the space", spaceId : this.spaceId}))
        } else {
            socket.send(JSON.stringify({type : "JOIN_SPACE_RESPONSE", status : true, message : "You have joined the space successfully", spaceId : this.spaceId}))
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

    move(socket : WebSocket, message : any){
        this.playerList.forEach(player => {
            if (this.participants[player.userId] !== socket) {
                this.participants[player.userId]?.send(JSON.stringify({type : "MOVE", position : message.position, userId : message.userId}))
            }
        })
    }  
}