"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { getVisibleTileData } from "@/lib/map/tilemap";
import { getTile } from "@/lib/map/tileset";
import { getVisibleObjects, getCollidableObjects } from "@/lib/world/worldObjects";
import { checkUserObjectCollision } from "@/lib/world/WorldObject";

interface User {
  userId: string;
  color: string;
  position: { x: number; y: number };
}

const MAP_WIDTH = 4000;
const MAP_HEIGHT = 4000;
const USER_RADIUS = 15;
const COLLISION_DISTANCE = USER_RADIUS * 2;
const MOVE_SPEED = 3; // pixels per frame for smooth movement

export default function Home() {
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState<string>("");
  const [position, setPosition] = useState({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const [cameraOffset, setCameraOffset] = useState({ x: 0, y: 0 });
  // Initialize with default values to avoid hydration mismatch
  const [viewportSize, setViewportSize] = useState({ width: 1200, height: 800 });
  const [isClient, setIsClient] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const positionRef = useRef({ x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 });
  const keysPressedRef = useRef<Set<string>>(new Set());
  const animationFrameRef = useRef<number | null>(null);
  const lastUpdateTimeRef = useRef<number>(0); // Reset to 0 to ensure first update
  const lastStateUpdateTimeRef = useRef<number>(0); // Separate timer for state updates
  const currentUserIdRef = useRef<string | null>(null);
  const usersRef = useRef<Map<string, User>>(new Map());

  // Set client-side flag and initialize viewport size after mount
  useEffect(() => {
    setIsClient(true);
    setViewportSize({ width: window.innerWidth, height: window.innerHeight });
  }, []);

  useEffect(() => {
    // Only connect to WebSocket on client side
    if (!isClient) return;
    
    // Connect to WebSocket server
    const ws = new WebSocket("ws://localhost:8080");
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log("[WS RECEIVE] Message type:", message.type, "userId:", message.userId, "myUserId:", currentUserIdRef.current);

      if (message.type === "connected") {
        const userId = message.userId;
        const pos = message.position;
        console.log("[CONNECTED] Setting current user:", userId, "position:", pos);
        currentUserIdRef.current = userId; // Update ref immediately
        setCurrentUserId(userId);
        setCurrentColor(message.color);
        positionRef.current = pos;
        setPosition(pos);
        // Camera will update automatically via useEffect when position state updates
      } else if (message.type === "userJoined") {
        // Add other users - safety check to never add ourselves
        const myUserId = currentUserIdRef.current;
        console.log("[USER_JOINED] userId:", message.userId, "myUserId:", myUserId);
        if (message.userId === myUserId) {
          console.warn("[USER_JOINED] Received own userJoined message, ignoring");
          return;
        }
        
        setUsers((prev) => {
          const newUsers = new Map(prev);
          // Double-check we're not adding ourselves
          if (message.userId !== myUserId) {
            console.log("[USER_JOINED] Adding user to map:", message.userId, "position:", message.position);
            newUsers.set(message.userId, {
              userId: message.userId,
              color: message.color,
              position: message.position,
            });
          } else {
            console.warn("[USER_JOINED] Blocked adding self to users map");
          }
          return newUsers;
        });
      } else if (message.type === "userMoved") {
        // Update OTHER users' positions ONLY - never update our own position from server
        // Use ref to get current userId to avoid stale closure issues
        const myUserId = currentUserIdRef.current;
        console.log("[USER_MOVED] Received move for userId:", message.userId, "myUserId:", myUserId, "position:", message.position);
        
        if (message.userId === myUserId) {
          // Safety check: we should never receive our own movement messages
          console.warn("[USER_MOVED] ERROR: Received own userMoved message, ignoring!");
          return;
        }
        
        setUsers((prev) => {
          console.log("[USER_MOVED] Current users in map:", Array.from(prev.keys()));
          const newUsers = new Map(prev);
          const user = newUsers.get(message.userId);
          console.log("[USER_MOVED] Found user in map:", user ? "yes" : "no");
          
          // Double-check again using ref
          if (user && user.userId !== myUserId) {
            console.log("[USER_MOVED] Updating user position:", message.userId, "from", user.position, "to", message.position);
            user.position = message.position;
            newUsers.set(message.userId, user);
          } else {
            console.warn("[USER_MOVED] Blocked update - user not found or is self");
          }
          return newUsers;
        });
      } else if (message.type === "userLeft") {
        console.log("[USER_LEFT] userId:", message.userId);
        setUsers((prev) => {
          const newUsers = new Map(prev);
          newUsers.delete(message.userId);
          return newUsers;
        });
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
  }, [isClient]);

  const sendPosition = useCallback((x: number, y: number) => {
    const myUserId = currentUserIdRef.current;
    console.log("[SEND_POSITION] Sending position for userId:", myUserId, "position:", { x, y });
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: "move",
          position: { x, y },
        })
      );
    } else {
      console.warn("[SEND_POSITION] WebSocket not open, readyState:", wsRef.current?.readyState);
    }
  }, []);

  // Keep usersRef in sync with users state
  useEffect(() => {
    usersRef.current = users;
  }, [users]);

  // Check collision with other users AND world objects

  const checkCollision = useCallback((newX: number, newY: number): boolean => {
    const myUserId = currentUserIdRef.current;
    
    // Check collision with other users (use ref to get latest without dependency)
    const allUsers = Array.from(usersRef.current.values());
    for (const user of allUsers) {
      // Skip collision check with ourselves
      if (user.userId === myUserId) continue;
      
      const dx = newX - user.position.x;
      const dy = newY - user.position.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < COLLISION_DISTANCE) {
        return true; // Collision detected with another user
      }
    }
    
    // Check collision with world objects (static, no dependency needed)
    const collidableObjects = getCollidableObjects();
    
    for (const obj of collidableObjects) {
      if (checkUserObjectCollision(newX, newY, USER_RADIUS, obj)) {
        return true; // Collision detected with world object
      }
    }
    
    return false;
  }, []); // No dependencies - uses refs and static functions

  // Camera follows LOCAL user position - updates whenever local position or viewport changes
  useEffect(() => {
    if (!currentUserId || !isClient) return;
    
    // Calculate camera position directly without separate callback to avoid dependency issues
    const width = viewportSize.width;
    const height = viewportSize.height;
    let cameraX = position.x - width / 2;
    let cameraY = position.y - height / 2;

    // Clamp camera at map edges
    cameraX = Math.max(0, Math.min(cameraX, MAP_WIDTH - width));
    cameraY = Math.max(0, Math.min(cameraY, MAP_HEIGHT - height));

    setCameraOffset({ x: cameraX, y: cameraY });
  }, [position.x, position.y, viewportSize.width, viewportSize.height, currentUserId, isClient]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      const newSize = { width: window.innerWidth, height: window.innerHeight };
      setViewportSize(newSize);
      // Update camera with new viewport size (following local user)
      const pos = positionRef.current;
      let cameraX = pos.x - newSize.width / 2;
      let cameraY = pos.y - newSize.height / 2;
      cameraX = Math.max(0, Math.min(cameraX, MAP_WIDTH - newSize.width));
      cameraY = Math.max(0, Math.min(cameraY, MAP_HEIGHT - newSize.height));
      setCameraOffset({ x: cameraX, y: cameraY });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Smooth movement with animation frame
  useEffect(() => {
    if (!currentUserId || !isClient) return;

    const moveUser = () => {
      const keys = keysPressedRef.current;
      let newX = positionRef.current.x;
      let newY = positionRef.current.y;
      let moved = false;

      if (keys.has("ArrowUp")) {
        newY = Math.max(USER_RADIUS, newY - MOVE_SPEED);
        moved = true;
      }
      if (keys.has("ArrowDown")) {
        newY = Math.min(MAP_HEIGHT - USER_RADIUS, newY + MOVE_SPEED);
        moved = true;
      }
      if (keys.has("ArrowLeft")) {
        newX = Math.max(USER_RADIUS, newX - MOVE_SPEED);
        moved = true;
      }
      if (keys.has("ArrowRight")) {
        newX = Math.min(MAP_WIDTH - USER_RADIUS, newX + MOVE_SPEED);
        moved = true;
      }

      if (moved) {
        const myUserId = currentUserIdRef.current;
        console.log("[MOVE_USER] Attempting to move userId:", myUserId, "from", positionRef.current, "to", { x: newX, y: newY });
        
        // Check collision before moving (only check other users, not ourselves)
        const hasCollision = checkCollision(newX, newY);
        console.log("[MOVE_USER] Collision check result:", hasCollision);
        
        if (!hasCollision) {
          positionRef.current = { x: newX, y: newY };
          
          const now = Date.now();
          
          // Throttle position state updates to avoid excessive re-renders
          // Only update state every ~16ms (~60fps) to reduce camera update frequency
          if (now - lastStateUpdateTimeRef.current > 16) {
            setPosition({ x: newX, y: newY }); // This will trigger camera update via useEffect
            lastStateUpdateTimeRef.current = now;
          }
          
          // Throttle position updates to server (every ~50ms)
          if (now - lastUpdateTimeRef.current > 50) {
            sendPosition(newX, newY);
            lastUpdateTimeRef.current = now;
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(moveUser);
    };

    animationFrameRef.current = requestAnimationFrame(moveUser);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentUserId, isClient, checkCollision, sendPosition]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        keysPressedRef.current.add(e.key);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        keysPressedRef.current.delete(e.key);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Calculate visible tiles for rendering (memoized for performance)
  // Only calculate if client-side to avoid hydration issues
  const visibleTiles = useMemo(() => {
    if (!isClient) return [];
    return getVisibleTileData(
      cameraOffset.x,
      cameraOffset.y,
      viewportSize.width,
      viewportSize.height
    );
  }, [cameraOffset.x, cameraOffset.y, viewportSize.width, viewportSize.height, isClient]);

  // Calculate visible world objects for rendering (memoized for performance)
  // Only calculate if client-side to avoid hydration issues
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
      className="relative overflow-hidden"
      style={{ 
        width: "100vw", 
        height: "100vh",
        margin: 0,
        padding: 0,
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
        {/* Current user */}
        {currentUserId && (
          <div
            className="absolute rounded-full border-2 border-black dark:border-white"
            style={{
              left: position.x,
              top: position.y,
              width: USER_RADIUS * 2,
              height: USER_RADIUS * 2,
              backgroundColor: currentColor,
              transform: "translate(-50%, -50%)",
            }}
          />
        )}
        {/* Other users - filter out current user as safety measure */}
        {(() => {
          const otherUsers = Array.from(users.values()).filter((user) => user.userId !== currentUserId);
          console.log("[RENDER] Current userId:", currentUserId);
          console.log("[RENDER] Users in map:", Array.from(users.keys()));
          console.log("[RENDER] Other users to render:", otherUsers.map(u => ({ userId: u.userId, position: u.position, color: u.color })));
          console.log("[RENDER] Current user position:", position);
          console.log("[RENDER] Camera offset:", cameraOffset);
          
          return otherUsers.map((user) => {
            const screenX = user.position.x - cameraOffset.x;
            const screenY = user.position.y - cameraOffset.y;
            console.log(`[RENDER] Rendering user ${user.userId} at map position (${user.position.x}, ${user.position.y}), screen position (${screenX}, ${screenY})`);
            
            return (
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
            );
          });
        })()}
      </div>
      
      {/* UI Overlay */}
      <div className="absolute top-4 left-4 z-10">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50 mb-1">
          Metaverse - Real-time Movement
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Use arrow keys to move. Your color: {currentColor || "connecting..."}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
          Users online: {users.size + (currentUserId ? 1 : 0)}
        </p>
      </div>
    </div>
  );
}
