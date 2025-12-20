# Metaverse Real-time Movement Application

## Project Overview

This is a real-time multiplayer metaverse application where multiple users can join a shared 2D space and see each other's movements synchronized in real-time. The application demonstrates a minimalistic approach to building a collaborative virtual space with WebSocket-based communication.

## Project Intention

The primary goal of this project is to create a foundation for a metaverse experience with the following core features:

1. **Real-time Synchronization**: Multiple users can move simultaneously in a shared space, with all movements reflected across all connected clients in real-time.

2. **User Isolation**: Each user can only control their own avatar. The system ensures that movements from one user don't affect another user's local control.

3. **Camera System**: Each client has an independent camera that follows only their own user, similar to 2D game mechanics. The camera centers on the user and clamps at map boundaries.

4. **Collision Detection**: Users cannot overlap with each other - they act as obstacles, preventing movement when too close.

5. **Scalable Architecture**: The codebase is structured to allow for future expansion with features like multiple spaces, user authentication, chat, and more complex interactions.

## Architecture

### Technology Stack

**Backend (WebSocket Server)**:
- **Node.js** with **TypeScript**
- **Express.js** - HTTP server
- **ws** (WebSocket library) - Real-time communication
- **ES Modules** - Modern JavaScript module system

**Frontend (Client Application)**:
- **Next.js 16** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Styling
- **WebSocket Client API** - Real-time communication

### Project Structure

```
meta-app/
├── wss/                          # WebSocket Server (Backend)
│   ├── src/
│   │   ├── index.ts              # Main server entry point
│   │   ├── managers/             # Business logic managers
│   │   │   ├── UserManager.ts    # User lifecycle and position management
│   │   │   └── SpaceManager.ts   # Space/room management and broadcasting
│   │   └── types/                # TypeScript type definitions
│   │       ├── user.ts           # User interface
│   │       └── space.ts          # Space interface
│   ├── dist/                     # Compiled JavaScript output
│   ├── package.json
│   └── tsconfig.json
│
└── next-app/                     # Next.js Client (Frontend)
    ├── app/
    │   ├── page.tsx              # Main metaverse view component
    │   ├── layout.tsx            # Root layout
    │   └── globals.css           # Global styles
    ├── components/               # UI components (shadcn/ui)
    ├── lib/                      # Utility functions
    ├── prisma/                   # Database schema (not currently used)
    ├── package.json
    └── tsconfig.json
```

## Core Components

### Backend Components

#### 1. WebSocket Server (`wss/src/index.ts`)

The main server that handles:
- WebSocket connections on port 8080
- User connection/disconnection lifecycle
- Message routing (move, userJoined, userLeft)
- Broadcasting user movements to all connected clients

**Key Responsibilities**:
- Accepts new WebSocket connections
- Creates and assigns unique user IDs
- Manages user lifecycle (join, move, leave)
- Broadcasts state changes to all relevant clients

#### 2. UserManager (`wss/src/managers/UserManager.ts`)

Manages all user-related operations:

**Key Methods**:
- `addUser(ws: WebSocket)`: Creates a new user with unique ID and color
- `removeUser(userId: string)`: Removes a user from the system
- `updateUserPosition(userId, x, y)`: Updates a user's position
- `getUser(userId)`: Retrieves user by ID
- `getAllUsers()`: Returns all active users

**User Properties**:
- `id`: Unique identifier (e.g., "user_1", "user_2")
- `ws`: WebSocket connection
- `x, y`: Position coordinates
- `color`: Visual identifier (red "#ef4444" or blue "#3b82f6")

#### 3. SpaceManager (`wss/src/managers/SpaceManager.ts`)

Manages spaces (currently single "default_space"):

**Key Methods**:
- `addUserToSpace(user, spaceId)`: Adds user to a space
- `removeUserFromSpace(userId, spaceId)`: Removes user from space
- `getSpaceUsers(spaceId)`: Gets all users in a space
- `broadcastToSpace(message, excludeUserId, spaceId)`: Broadcasts messages to all users in space except the sender

**Current Implementation**:
- Single shared space where all users join
- All users can see each other
- Designed to support multiple spaces in future

### Frontend Components

#### 1. Main Page Component (`next-app/app/page.tsx`)

The core client-side component that handles:

**State Management**:
- `users`: Map of other users in the space
- `currentUserId`: ID of the local user
- `currentColor`: Color assigned to local user
- `position`: Current position of local user
- `cameraOffset`: Camera position for viewport
- `viewportSize`: Browser window dimensions

**Key Features**:

1. **WebSocket Connection**:
   - Connects to `ws://localhost:8080`
   - Handles connection lifecycle
   - Processes incoming messages (connected, userJoined, userMoved, userLeft)

2. **Movement System**:
   - Arrow key input detection
   - Smooth movement using `requestAnimationFrame`
   - Collision detection before movement
   - Throttled position updates to server (50ms intervals)

3. **Camera System**:
   - Follows local user position
   - Centers on user with edge clamping
   - Updates dynamically when user moves
   - Independent per client (each browser follows its own user)

4. **Rendering**:
   - Renders local user (colored circle)
   - Renders other users (colored circles)
   - Map viewport with camera transform
   - UI overlay showing status information

**Movement Constants**:
- `MAP_WIDTH`: 4000px
- `MAP_HEIGHT`: 4000px
- `USER_RADIUS`: 15px
- `COLLISION_DISTANCE`: 30px (2 × USER_RADIUS)
- `MOVE_SPEED`: 3 pixels per frame

## Communication Protocol

### Message Types

#### Client → Server

**Move Message**:
```json
{
  "type": "move",
  "position": { "x": 2000, "y": 2000 }
}
```

#### Server → Client

**Connected Message** (sent on initial connection):
```json
{
  "type": "connected",
  "userId": "user_1",
  "color": "#ef4444",
  "position": { "x": 2000, "y": 2000 }
}
```

**User Joined Message** (sent when another user connects):
```json
{
  "type": "userJoined",
  "userId": "user_2",
  "color": "#3b82f6",
  "position": { "x": 1850, "y": 2000 }
}
```

**User Moved Message** (sent when a user moves):
```json
{
  "type": "userMoved",
  "userId": "user_2",
  "position": { "x": 1900, "y": 2000 }
}
```

**User Left Message** (sent when a user disconnects):
```json
{
  "type": "userLeft",
  "userId": "user_2"
}
```

## Key Features & Implementation Details

### 1. Real-time Movement Synchronization

- **Client-side prediction**: Local movement is immediate for responsive feel
- **Server authority**: Server receives and validates positions
- **Broadcast pattern**: Server broadcasts validated movements to all other clients
- **Throttling**: Position updates sent every 50ms to reduce network traffic

### 2. User Isolation & Control

- **Ref-based user tracking**: Uses `currentUserIdRef` to avoid stale closures
- **Explicit user checks**: Multiple safety checks prevent cross-user control
- **Separate state**: Local user position stored separately from other users
- **Server-side exclusion**: Server excludes sender when broadcasting

### 3. Camera System

- **Viewport-based**: Camera shows a window into the larger map
- **Edge clamping**: Camera stops at map boundaries to prevent showing empty space
- **Reactive updates**: Camera updates via `useEffect` watching local position
- **Independent per client**: Each browser has its own camera that follows only its user

### 4. Collision Detection

- **Distance-based**: Checks if new position is within `COLLISION_DISTANCE` of other users
- **Pre-movement check**: Validates before updating position
- **Prevents overlap**: Users cannot move closer than 30px to each other
- **Obstacle behavior**: Users act as solid obstacles

### 5. Initial User Positioning

Currently configured for testing:
- User 1 starts at (2000, 2000) - center of map
- User 2 starts at (1850, 2000) - 150px left of User 1
- Both positions are within viewport for easy testing

## Running the Application

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Backend Setup

```bash
cd wss
npm install
npm run build
npm start
```

The WebSocket server will start on `http://localhost:8080`

### Frontend Setup

```bash
cd next-app
npm install
npm run dev
```

The Next.js app will start on `http://localhost:3000`

### Development Mode

For development with auto-reload:

**Backend**:
```bash
cd wss
npm run dev  # TypeScript watch mode
```

**Frontend**:
```bash
cd next-app
npm run dev  # Next.js development server
```

## Testing

1. Start the WebSocket server
2. Start the Next.js application
3. Open multiple browser windows/tabs to `http://localhost:3000`
4. Use arrow keys to move your user
5. Observe real-time synchronization across all windows

## Future Enhancements

The architecture supports the following potential enhancements:

1. **Multiple Spaces/Rooms**: Extend SpaceManager to support multiple isolated spaces
2. **User Authentication**: Add login system with user profiles
3. **Chat System**: Real-time messaging between users
4. **Database Integration**: Persist user data and space states
5. **Avatars**: Customizable user representations beyond colored circles
6. **Objects & Interactions**: Add interactive objects in the space
7. **Optimizations**: 
   - Interpolation for smoother remote user movement
   - Spatial partitioning for collision detection
   - Message compression
8. **Deployment**: Production deployment with proper error handling and monitoring

## Design Decisions

### Why WebSockets?

WebSockets provide full-duplex communication, allowing the server to push updates to clients without polling. This is essential for real-time applications where latency matters.

### Why Separate Backend?

Separating the WebSocket server from the Next.js app allows:
- Independent scaling
- Easier deployment
- Clear separation of concerns
- Ability to add other clients (mobile apps, etc.)

### Why TypeScript?

TypeScript provides:
- Type safety across client and server
- Better IDE support
- Easier refactoring
- Self-documenting code

### Why React Hooks?

Modern React hooks pattern:
- Cleaner code organization
- Better state management
- Easier to reason about component lifecycle
- Built-in optimization opportunities

## Security Considerations

Current implementation is minimal for development. Production should include:
- Input validation on server
- Rate limiting
- Authentication/authorization
- CORS configuration
- HTTPS/WSS encryption
- Sanitization of user inputs

## Performance Considerations

- **Throttling**: Position updates throttled to 50ms intervals
- **RequestAnimationFrame**: Smooth 60fps movement rendering
- **Efficient Updates**: Only updates changed user positions
- **Map size**: Large map (4000x4000) with viewport culling

## Logging & Debugging

The application includes comprehensive logging:

- `[SERVER]`: Server-side operations
- `[BROADCAST]`: Broadcasting operations
- `[WS RECEIVE]`: Received WebSocket messages
- `[CONNECTED]`: User connection events
- `[USER_JOINED]`: User join events
- `[USER_MOVED]`: Movement events
- `[MOVE_USER]`: Local movement processing
- `[SEND_POSITION]`: Position transmission
- `[RENDER]`: Rendering information

## License

ISC

## Author

Created as a foundation for a metaverse application with real-time multiplayer capabilities.

