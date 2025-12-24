"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { getVisibleTileData } from "@/lib/map/tilemap";
import { getTile } from "@/lib/map/tileset";
import { getVisibleObjects, getCollidableObjects } from "@/lib/world/worldObjects";
import { checkUserObjectCollision } from "@/lib/world/WorldObject";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send } from "lucide-react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { useUser } from "@clerk/nextjs";

interface User {
  userId: string;
  color: string;
  position: { x: number; y: number };
}

interface ChatMessage {
  userId: string;
  chat: string;
  timestamp: number;
}

const MAP_WIDTH = 4000;
const MAP_HEIGHT = 4000;
const USER_RADIUS = 15;
const COLLISION_DISTANCE = USER_RADIUS * 2;
const MOVE_SPEED = 3; // pixels per frame for smooth movement

export default function SpacePage() {
  const params = useParams();
  const router = useRouter();
  const spaceId = params.spaceId as string;
  const { user } = useUser();
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [currentColor, setCurrentColor] = useState<string>("");
  const [spaceName, setSpaceName] = useState<string>("");
  const [position, setPosition] = useState({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  // Initialize with default values to avoid hydration mismatch
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const [isClient, setIsClient] = useState(false);
  const [username, setUsername] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState<string>("");
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const { sendMessage, addMessageListener, isConnected } = useWebSocket();
  const positionRef = useRef({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const keysPressedRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0);
  const lastStateUpdateTimeRef = useRef<number>(0);
  const lastCameraUpdateTimeRef = useRef<number>(0);
  const usersRef = useRef<Map<string, User>>(new Map());
  const hasJoinedSpaceRef = useRef(false);
  const cameraOffsetRef = useRef({ x: 0, y: 0 });
  const targetCameraOffsetRef = useRef({ x: 0, y: 0 });
  const collidableObjectsRef = useRef<ReturnType<typeof getCollidableObjects> | null>(null);
  const lastFrameTimeRef = useRef<number>(performance.now());
  const currentUserIdRef = useRef<string | undefined>(user?.id);

  // Set client-side flag and initialize viewport size after mount
  useEffect(() => {
    setIsClient(true);
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });
    
    // Get username from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('metaverse_username');
      if (stored) {
        setUsername(stored);
      } else {
        const defaultUsername = `User${Math.floor(Math.random() * 10000)}`;
        setUsername(defaultUsername);
        localStorage.setItem('metaverse_username', defaultUsername);
      }
    }
    
    // Hide header navigation
    const header = document.querySelector('header');
    if (header) {
      header.style.display = 'none';
    }
    
    // Hide scrollbars
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Restore header and scrollbars on unmount
      if (header) {
        header.style.display = '';
      }
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, []);


  // Handle WebSocket messages
  useEffect(() => {
    if (!isClient || !spaceId) return;

    // Join space when connected
    if (isConnected && !hasJoinedSpaceRef.current && username) {
      console.log("[SPACE_PAGE] Joining space:", spaceId);
      sendMessage(JSON.stringify({
        type: "JOIN_SPACE",
        spaceId: spaceId,
        username: username,
        userId: user?.id
      }));
      hasJoinedSpaceRef.current = true;
    }

    const offSpaceJoined = addMessageListener("spaceJoined", (message) => {
      console.log("[SPACE_JOINED] Space joined:", message);
      setSpaceName("Space"); // Space name is not returned by API, using default
      // Set current user's color from JOIN_SPACE_RESPONSE
      if (message.userColour) {
        setCurrentColor(message.userColour);
      }
      // Set initial position from server if provided
      if (message.position) {
        console.log("[SPACE_JOINED] Setting initial position:", message.position);
        positionRef.current = message.position;
        setPosition(message.position);
      } else {
        console.warn("[SPACE_JOINED] No position received from server, using default");
      }
    });

    // Handle player list from PLAYER_LIST message
    const offPlayersList = addMessageListener("playersList", (message) => {
      console.log("[PLAYERS_LIST] Received player list:", message.playerList);
      
      if (!Array.isArray(message.playerList)) {
        console.warn("[PLAYERS_LIST] Invalid player list format");
        return;
      }
      
      // Build users map from the player list
      // Note: PLAYER_LIST doesn't include positions, so we keep existing positions
      // IMPORTANT: Exclude current user from users map - they're rendered separately
      const newUsers = new Map<string, User>();
      const existingUsers = usersRef.current;
      
      message.playerList.forEach((player: any) => {
        if (player.userId) {
          // Skip current user - they're rendered separately with position/currentColor state
          if (player.userId === user?.id) {
            // Just update current user's color if needed
            if (player.userColour) {
              setCurrentColor(player.userColour);
            }
            return; // Don't add current user to users map
          }
          
          // Keep existing position if user already exists, otherwise use default
          const existingUser = existingUsers.get(player.userId);
          const defaultPosition = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
          
          // Use color from server (userColour field), fallback to existing color if not provided
          const userColor = player.userColour || existingUser?.color || "#888888";
          
          newUsers.set(player.userId, {
            userId: player.userId,
            color: userColor,
            position: existingUser?.position || defaultPosition,
          });
        }
      });
      
      console.log("[PLAYERS_LIST] Setting users map with", newUsers.size, "users");
      setUsers(newUsers);
    });

    const offUserMoved = addMessageListener("userMoved", (message) => {
      if (!message.position || !message.userId) {
        console.warn("[USER_MOVED] Invalid message format:", message);
        return;
      }
      
      setUsers((prev) => {
        const newUsers = new Map(prev);
        const user = newUsers.get(message.userId);
        
        if (user) {
          // Update existing user position and color if provided
          user.position = message.position;
          if (message.userColour) {
            user.color = message.userColour;
          }
          newUsers.set(message.userId, user);
        } else {
          // User not in our list yet, add them with color from message or default
          newUsers.set(message.userId, {
            userId: message.userId,
            color: message.userColour || "#888888", // Use color from server if available
            position: message.position,
          });
        }
        return newUsers;
      });
    });

    const offChat = addMessageListener("chat", (message) => {
      if (!message.chat || !message.userId) {
        console.warn("[CHAT] Invalid message format:", message);
        return;
      }
      
      setChatMessages((prev) => [
        ...prev,
        {
          userId: message.userId,
          chat: message.chat,
          timestamp: Date.now(),
        },
      ]);
    });

    // Note: User leaving is handled via PLAYER_LIST updates (when they're removed from the list)
    // No separate userLeft event is sent by the API

    const offJoinSpaceError = addMessageListener("joinSpaceError", (message) => {
      console.error("[JOIN_SPACE_ERROR]", message.error);
      // Redirect to dashboard on error
      router.push("/dashboard");
    });

    // Handle initial user positions when joining
    const offUserPositions = addMessageListener("userPositions", (message) => {
      console.log("[USER_POSITIONS] Received positions:", message.positions);
      if (!Array.isArray(message.positions)) {
        console.warn("[USER_POSITIONS] Invalid positions format");
        return;
      }
      
      setUsers((prev) => {
        const newUsers = new Map(prev);
        message.positions.forEach((pos: any) => {
          if (pos.userId && pos.position) {
            // Skip current user - they use position state, not users map
            if (pos.userId === user?.id) {
              return;
            }
            
            const existingUser = newUsers.get(pos.userId);
            if (existingUser) {
              // Update position for existing user
              existingUser.position = pos.position;
              newUsers.set(pos.userId, existingUser);
            } else {
              // Add new user with position - color will come from PLAYER_LIST
              newUsers.set(pos.userId, {
                userId: pos.userId,
                color: "#888888", // Default color, will be updated by PLAYER_LIST
                position: pos.position,
              });
            }
          }
        });
        return newUsers;
      });
    });

    return () => {
      // Send leave message when component unmounts
      if (isConnected && spaceId && user?.id && hasJoinedSpaceRef.current) {
        console.log("[SPACE_PAGE] Leaving space:", spaceId);
        sendMessage(JSON.stringify({
          type: "LEAVE_SPACE",
          spaceId: spaceId,
          userId: user.id
        }));
      }
      
      offSpaceJoined();
      offPlayersList();
      offUserMoved();
      offChat();
      offJoinSpaceError();
      offUserPositions();
      hasJoinedSpaceRef.current = false;
    };
  }, [isClient, spaceId, router, addMessageListener, sendMessage, isConnected, username, user?.id]);

  const sendPosition = useCallback((x: number, y: number) => {
    if (isConnected && spaceId && user?.id) {
      sendMessage(
        JSON.stringify({
          type: "MOVE",
          userId: user.id,
          spaceId: spaceId, // Required for routing
          position: { x, y },
        })
      );
    }
  }, [isConnected, sendMessage, spaceId, user]);

  const sendChat = useCallback(() => {
    if (!chatInput.trim() || !isConnected || !spaceId || !user?.id) return;
    
    sendMessage(
      JSON.stringify({
        type: "SEND_CHAT",
        userId: user.id,
        spaceId: spaceId,
        chat: chatInput.trim(),
      })
    );
    
    setChatInput("");
  }, [chatInput, isConnected, spaceId, user, sendMessage]);

  // Auto-scroll chat to bottom when new messages arrive
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Keep usersRef in sync with users state
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Cache collidable objects to avoid recalculating every frame
  useEffect(() => {
    if (collidableObjectsRef.current === null) {
      collidableObjectsRef.current = getCollidableObjects();
    }
  }, []);

  // Keep currentUserIdRef in sync
  useEffect(() => {
    currentUserIdRef.current = user?.id;
  }, [user?.id]);

  // Check collision with other users AND world objects
  const checkCollision = useCallback((newX: number, newY: number): boolean => {
    // Check collision with other users (optimized - skip sqrt for distance check)
    // Exclude current user from collision check
    const allUsers = Array.from(usersRef.current.values()).filter(
      (u) => u.userId !== currentUserIdRef.current
    );
    
    // If no other users, no collision
    if (allUsers.length === 0) {
      return false;
    }
    
    const collisionDistSq = COLLISION_DISTANCE * COLLISION_DISTANCE;
    let validUserCount = 0;
    
    for (const user of allUsers) {
      // Skip users without valid positions
      if (!user.position || user.position.x === undefined || user.position.y === undefined) {
        continue;
      }
      
      validUserCount++;
      const dx = newX - user.position.x;
      const dy = newY - user.position.y;
      const distanceSq = dx * dx + dy * dy;
      
      // Use a more lenient collision check (1.1x) to allow easier movement
      if (distanceSq < collisionDistSq * 1.1) {
        return true;
      }
    }
    
    // If we have users but none have valid positions yet, allow movement
    if (validUserCount === 0) {
      return false;
    }
    
    // Check collision with world objects (use cached list)
    const collidableObjects = collidableObjectsRef.current || [];
    
    // Only check objects near the player position (optimization)
    const checkRadius = USER_RADIUS * 3; // Check objects within 3x radius
    for (const obj of collidableObjects) {
      // Quick distance check before expensive collision check
      const objCenterX = obj.x + obj.width / 2;
      const objCenterY = obj.y + obj.height / 2;
      const dx = newX - objCenterX;
      const dy = newY - objCenterY;
      const maxDist = checkRadius + Math.max(obj.width, obj.height) / 2;
      
      if (dx * dx + dy * dy < maxDist * maxDist) {
        if (checkUserObjectCollision(newX, newY, USER_RADIUS, obj)) {
          return true;
        }
      }
    }
    
    return false;
  }, []);

  // Camera smoothly follows LOCAL user position (updated in animation loop)
  // This useEffect only initializes the camera, actual updates happen in the animation frame

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      setViewportSize(newSize);
      // Camera will update smoothly in the animation loop
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Smooth movement with animation frame and smooth camera following
  useEffect(() => {
    if (!isClient) return;

    const moveUser = (currentTime: number) => {
      // Calculate delta time for frame-independent movement
      const deltaTime = currentTime - lastFrameTimeRef.current;
      lastFrameTimeRef.current = currentTime;
      
      // Normalize movement speed based on frame rate (target 60fps)
      const frameMultiplier = Math.min(deltaTime / 16.67, 2.0); // Cap at 2x for very slow frames
      const adjustedMoveSpeed = MOVE_SPEED * frameMultiplier;

      const keys = keysPressedRef.current;
      let newX = positionRef.current.x;
      let newY = positionRef.current.y;
      let moved = false;

      if (keys.has("ArrowUp")) {
        newY = Math.max(USER_RADIUS, newY - adjustedMoveSpeed);
        moved = true;
      }
      if (keys.has("ArrowDown")) {
        newY = Math.min(MAP_HEIGHT - USER_RADIUS, newY + adjustedMoveSpeed);
        moved = true;
      }
      if (keys.has("ArrowLeft")) {
        newX = Math.max(USER_RADIUS, newX - adjustedMoveSpeed);
        moved = true;
      }
      if (keys.has("ArrowRight")) {
        newX = Math.min(MAP_WIDTH - USER_RADIUS, newX + adjustedMoveSpeed);
        moved = true;
      }

      if (moved) {
        // Check collision
        const hasCollision = checkCollision(newX, newY);
        
        if (!hasCollision) {
          // No collision, move normally
          positionRef.current = { x: newX, y: newY };
          
          const now = Date.now();
          
          // Always update position state (React will handle throttling via requestAnimationFrame)
          setPosition({ x: newX, y: newY });
          lastStateUpdateTimeRef.current = now;
          
          // Send position to server less frequently (20fps)
          if (now - lastUpdateTimeRef.current > 50) {
            sendPosition(newX, newY);
            lastUpdateTimeRef.current = now;
          }
        }
        // If collision detected, don't move - this prevents getting stuck
        // The user will need to move in a different direction
      }

      // Smooth camera following - calculate target camera position
      const width = viewportSize.width;
      const height = viewportSize.height;
      let targetCameraX = positionRef.current.x - width / 2;
      let targetCameraY = positionRef.current.y - height / 2;

      // Clamp camera at map edges
      targetCameraX = Math.max(0, Math.min(targetCameraX, MAP_WIDTH - width));
      targetCameraY = Math.max(0, Math.min(targetCameraY, MAP_HEIGHT - height));

      targetCameraOffsetRef.current = { x: targetCameraX, y: targetCameraY };

      // Smooth interpolation for camera (lerp factor ~0.2 for more responsive following)
      const lerpFactor = 0.2;
      const currentCamX = cameraOffsetRef.current.x;
      const currentCamY = cameraOffsetRef.current.y;
      const newCamX = currentCamX + (targetCameraX - currentCamX) * lerpFactor;
      const newCamY = currentCamY + (targetCameraY - currentCamY) * lerpFactor;

      // Only update camera state if change is significant (reduces re-renders)
      const now = Date.now();
      const oldCamX = cameraOffsetRef.current.x;
      const oldCamY = cameraOffsetRef.current.y;
      const camDeltaX = Math.abs(newCamX - oldCamX);
      const camDeltaY = Math.abs(newCamY - oldCamY);
      
      if (camDeltaX > 0.5 || camDeltaY > 0.5 || now - lastCameraUpdateTimeRef.current > 16) {
        cameraOffsetRef.current = { x: newCamX, y: newCamY };
        setCameraOffset({ x: newCamX, y: newCamY });
        lastCameraUpdateTimeRef.current = now;
      } else {
        // Still update ref even if we don't update state
        cameraOffsetRef.current = { x: newCamX, y: newCamY };
      }

      animationFrameRef.current = requestAnimationFrame(moveUser);
    };

    lastFrameTimeRef.current = performance.now();
    animationFrameRef.current = requestAnimationFrame(moveUser);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isClient, checkCollision, sendPosition, viewportSize.width, viewportSize.height]);

  // Handle keyboard input
  useEffect(() => {
    if (!isClient) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle arrow keys if not typing in an input field
      const target = e.target as HTMLElement;
      const isInputFocused = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!isInputFocused) {
          e.preventDefault();
          keysPressedRef.current.add(e.key);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        keysPressedRef.current.delete(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
    };
  }, [isClient]);

  // Calculate visible tiles for rendering
  const visibleTiles = useMemo(() => {
    if (!isClient) return [];
    return getVisibleTileData(
      cameraOffset.x,
      cameraOffset.y,
      viewportSize.width,
      viewportSize.height
    );
  }, [cameraOffset.x, cameraOffset.y, viewportSize.width, viewportSize.height, isClient]);

  // Calculate visible world objects for rendering
  const visibleObjects = useMemo(() => {
    if (!isClient) return [];
    return getVisibleObjects(
      cameraOffset.x,
      cameraOffset.y,
      viewportSize.width,
      viewportSize.height
    );
  }, [cameraOffset.x, cameraOffset.y, viewportSize.width, viewportSize.height, isClient]);

  return (
    <div 
      className="relative overflow-hidden fixed inset-0"
      style={{ 
        width: "100vw", 
        height: "100vh",
        margin: 0,
        padding: 0,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
      }}
    >
      {/* Map container with camera offset */}
      <div
        className="absolute"
        style={{
          width: MAP_WIDTH,
          height: MAP_HEIGHT,
          transform: `translate(-${cameraOffset.x}px, -${cameraOffset.y}px)`,
        }}
      >
        {/* LAYER 1: Tile Map (Background) */}
        {visibleTiles.map((tile) => {
          const tileDef = getTile(tile.tileId);
          return (
            <div
              key={`tile-${tile.tileX}-${tile.tileY}`}
              className="absolute"
              style={{
                left: tile.worldX,
                top: tile.worldY,
                width: 32,
                height: 32,
                backgroundColor: tileDef.color,
                border: '1px solid rgba(0,0,0,0.1)',
              }}
            />
          );
        })}

        {/* LAYER 2: World Objects (Furniture, etc.) */}
        {visibleObjects.map((obj) => (
          <div
            key={obj.id}
            className="absolute"
            style={{
              left: obj.x,
              top: obj.y,
              width: obj.width,
              height: obj.height,
              backgroundColor: obj.sprite,
              border: '2px solid rgba(0,0,0,0.3)',
              borderRadius: '4px',
            }}
            title={obj.name || obj.id}
          />
        ))}

        {/* LAYER 3: Players */}
        {/* Current user - rendered separately with position/currentColor state */}
        {position && position.x !== undefined && position.y !== undefined && currentColor && (
          <div
            key="current-user"
            className="absolute rounded-full border-2 border-black dark:border-white"
            style={{
              left: position.x,
              top: position.y,
              width: USER_RADIUS * 2,
              height: USER_RADIUS * 2,
              backgroundColor: currentColor,
              transform: "translate(-50%, -50%)",
              zIndex: 10, // Ensure current user is on top
            }}
          />
        )}
        {/* Other users - current user should NOT be in users map */}
        {Array.from(users.values()).map((user) => (
            <div
              key={user.userId}
              className="absolute rounded-full border-2 border-black dark:border-white"
              style={{
                left: user.position.x,
                top: user.position.y,
                width: USER_RADIUS * 2,
                height: USER_RADIUS * 2,
                backgroundColor: user.color,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
      </div>
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10 flex items-start gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push("/dashboard")}
          className="bg-background/90 backdrop-blur-sm border-2"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div className="bg-background/90 backdrop-blur-sm border-2 border-border rounded-lg px-4 py-3 shadow-lg">
          <h1 className="text-xl font-semibold text-foreground mb-1">
            {spaceName || "Metaverse Space"}
          </h1>
          <p className="text-sm text-foreground/80 mb-1">
            Space ID: <span className="font-mono font-semibold">{spaceId}</span>
          </p>
          <p className="text-sm text-foreground/80">
            Use arrow keys to move. Your color: <span className="font-semibold" style={{ color: currentColor || '#888' }}>{currentColor || "connecting..."}</span>
          </p>
          <p className="text-xs text-foreground/70 mt-1">
            Users online: {users.size}
          </p>
        </div>
      </div>

      {/* Chat Section */}
      <div className="absolute bottom-4 right-4 z-10 w-80 bg-background/90 backdrop-blur-sm border-2 border-border rounded-lg shadow-lg flex flex-col max-h-96">
        {/* Chat Header */}
        <div className="px-4 py-2 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Chat</h2>
        </div>
        
        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-4 py-2 space-y-2 min-h-0"
        >
          {chatMessages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              No messages yet. Start chatting!
            </p>
          ) : (
            chatMessages.map((msg, idx) => {
              const userColor = users.get(msg.userId)?.color || "#888888";
              const isCurrentUser = msg.userId === user?.id;
              
              return (
                <div
                  key={idx}
                  className={`flex flex-col ${isCurrentUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`px-3 py-1.5 rounded-lg max-w-[80%] ${
                      isCurrentUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {!isCurrentUser && (
                      <div
                        className="text-xs font-semibold mb-1"
                        style={{ color: userColor }}
                      >
                        User {msg.userId.slice(-4)}
                      </div>
                    )}
                    <div className="text-sm">{msg.chat}</div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        
        {/* Chat Input */}
        <div className="px-4 py-2 border-t border-border flex gap-2">
          <Input
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendChat();
              }
            }}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={sendChat}
            disabled={!chatInput.trim() || !isConnected}
          >
            <Send className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

