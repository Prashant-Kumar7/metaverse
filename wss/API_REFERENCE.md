# WebSocket API Reference

## Connection

When a user connects, the WebSocket connection is established. The server automatically maps `userId` to the socket when any message containing `userId` is received. No initial connection message is sent.

**Important:** Include `userId` in your messages to ensure proper socket-to-user mapping.

---

## 1. Creating a Space/Room

### Request
```json
{
  "type": "CREATE_SPACE",
  "userId": "user_1",
  "spaceId": "space_1234567890_abc123",
  "spaceName": "My Awesome Space",
  "username": "John Doe"
}
```

### Success Response
```json
{
  "type": "CREATE_SPACE_RESPONSE",
  "status": true,
  "message": "You have created the space successfully",
  "spaceId": "space_1234567890_abc123"
}
```

---

## 2. Joining a Space/Room

### Request
```json
{
  "type": "JOIN_SPACE",
  "userId": "user_1",
  "spaceId": "space_1234567890_abc123",
  "username": "John Doe"
}
```

### Success Response
You will receive:

1. **Space Joined Event:**
```json
{
  "type": "JOIN_SPACE_RESPONSE",
  "status": true,
  "message": "You have joined the space successfully",
  "spaceId": "space_1234567890_abc123"
}
```

2. **Player List:**
```json
{
  "type": "PLAYER_LIST",
  "playerList": [
    {
      "userId": "user_1",
      "username": "John Doe"
    },
    {
      "userId": "user_2",
      "username": "Jane Smith"
    }
  ]
}
```

### Error Response
```json
{
  "type": "JOIN_SPACE_RESPONSE",
  "status": false,
  "message": "Space not found",
  "spaceId": "space_1234567890_abc123"
}
```

or

```json
{
  "type": "SPACE_NOT_FOUND"
}
```

---

## 3. Quick Join (Join Random Available Space)

### Request
```json
{
  "type": "QUICK_JOIN_SPACE"
}
```

### Success Response
```json
{
  "type": "QUICK_JOIN_RESPONSE",
  "status": true,
  "spaceId": "space_1234567890_abc123"
}
```

### Error Response
```json
{
  "type": "QUICK_JOIN_RESPONSE",
  "status": false,
  "message": "No spaces available"
}
```

**Note:** After receiving a successful QUICK_JOIN_RESPONSE, you still need to send a `JOIN_SPACE` request with the returned `spaceId`.

---

## 4. Sending Messages to Room/Space

### Move User Position

**Request:**
**REQUIRED:** Must include `spaceId` for routing:
```json
{
  "type": "MOVE",
  "userId": "user_1",
  "spaceId": "space_1234567890_abc123",
  "position": {
    "x": 2100,
    "y": 2050
  }
}
```

**Broadcast to Other Users:**
```json
{
  "type": "MOVE",
  "userId": "user_1",
  "position": {
    "x": 2100,
    "y": 2050
  }
}
```

**Error Response:**
```json
{
  "type": "SPACE_NOT_FOUND"
}
```

---

### Send Chat Message

**Request:**
**REQUIRED:** Must include `spaceId` for routing:
```json
{
  "type": "SEND_CHAT",
  "userId": "user_1",
  "spaceId": "space_1234567890_abc123",
  "chat": "Hello everyone!"
}
```

**Broadcast to Other Users:**
```json
{
  "type": "CHAT",
  "userId": "user_1",
  "chat": "Hello everyone!"
}
```

**Error Response:**
```json
{
  "type": "SPACE_NOT_FOUND"
}
```

---

### Get Join Events

**Request:**
**REQUIRED:** Must include `spaceId` for routing:
```json
{
  "type": "GET_JOIN_EVENTS",
  "userId": "user_1",
  "spaceId": "space_1234567890_abc123"
}
```

**Success Response:**
You will receive the same responses as `JOIN_SPACE` (JOIN_SPACE_RESPONSE and PLAYER_LIST).

**Error Response:**
```json
{
  "type": "JOIN_SPACE_RESPONSE",
  "status": false,
  "message": "Space not found",
  "spaceId": "space_1234567890_abc123"
}
```

or

```json
{
  "type": "SPACE_NOT_FOUND"
}
```

---

## 5. Room Events (Received Automatically)

**Space-related events are broadcast to all users in the space.**

### Player List Updated
When the player list changes (user joins/leaves):
```json
{
  "type": "PLAYER_LIST",
  "playerList": [
    {
      "userId": "user_1",
      "username": "John Doe"
    },
    {
      "userId": "user_2",
      "username": "Jane Smith"
    }
  ]
}
```

### User Moved
When another user moves:
```json
{
  "type": "MOVE",
  "userId": "user_2",
  "position": {
    "x": 1900,
    "y": 2100
  }
}
```

### Chat Message
When another user sends a chat message:
```json
{
  "type": "CHAT",
  "userId": "user_2",
  "chat": "Hello everyone!"
}
```

---

## 6. Error Messages

### Space Not Found
If you try to send a message to a space that doesn't exist:
```json
{
  "type": "SPACE_NOT_FOUND"
}
```

### Join Space Error
If joining a space fails:
```json
{
  "type": "JOIN_SPACE_RESPONSE",
  "status": false,
  "message": "Space not found",
  "spaceId": "space_1234567890_abc123"
}
```

or

```json
{
  "type": "JOIN_SPACE_RESPONSE",
  "status": false,
  "message": "Space is full",
  "spaceId": "space_1234567890_abc123"
}
```

---

## 7. Ping/Pong

The server sends ping messages every 30 seconds:
```json
{
  "type": "PING"
}
```

You can ignore these or respond with a pong if needed.

---

## Example Flow

1. **Connect to WebSocket** → Server automatically maps userId to socket when messages contain userId
2. **Create Space:**
   ```json
   { 
     "type": "CREATE_SPACE",
     "userId": "user_1",
     "spaceId": "space_1234567890_abc123",
     "spaceName": "My Room",
     "username": "John Doe"
   }
   ```
   → Receive `CREATE_SPACE_RESPONSE`

3. **Join Space:**
   ```json
   { 
     "type": "JOIN_SPACE",
     "userId": "user_2",
     "spaceId": "space_1234567890_abc123",
     "username": "Jane Smith"
   }
   ```
   → Receive `JOIN_SPACE_RESPONSE` and `PLAYER_LIST`

4. **Or Quick Join:**
   ```json
   { "type": "QUICK_JOIN_SPACE" }
   ```
   → Receive `QUICK_JOIN_RESPONSE` with spaceId, then send `JOIN_SPACE` request

5. **Move around:**
   ```json
   { 
     "type": "MOVE",
     "userId": "user_1",
     "spaceId": "space_1234567890_abc123",
     "position": { "x": 2100, "y": 2050 }
   }
   ```
   → Other users receive `MOVE` event

6. **Send chat:**
   ```json
   { 
     "type": "SEND_CHAT",
     "userId": "user_1",
     "spaceId": "space_1234567890_abc123",
     "chat": "Hello!"
   }
   ```
   → Other users receive `CHAT` event

7. **Receive updates** about other users moving/chatting/joining/leaving

