"use client";

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 
  (process.env.NODE_ENV === 'production' 
    ? "wss://metaverse-85dk.onrender.com" 
    : "ws://localhost:8080");

interface WebSocketContextType {
  sendMessage: (message: string) => void;
  addMessageListener: (type: string, callback: (data: any) => void) => () => void;
  isConnected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const socketRef = useRef<WebSocket | null>(null);
  const messageListeners = useRef<Map<string, Set<(data: any) => void>>>(new Map());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;
  const baseReconnectDelay = 1000; // 1 second
  const [, forceRender] = useState({}); // To trigger re-renders when needed
  const [isConnected, setIsConnected] = useState(false);

  const connect = useCallback(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN || 
        socketRef.current?.readyState === WebSocket.CONNECTING) {
      return; // Already connected or connecting
    }

    console.log(`Attempting to connect to WebSocket... (attempt ${reconnectAttemptsRef.current + 1})`);
    
    const ws = new WebSocket(WS_URL);
    socketRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket Connected");
      setIsConnected(true);
      reconnectAttemptsRef.current = 0; // Reset attempts on successful connection
      // Server automatically creates user on connection, no need to send app_opened
    };

    ws.onclose = (event) => {
      console.log("WebSocket Disconnected", event.code, event.reason);
      setIsConnected(false);
      
      // Don't reconnect if it was a clean close (code 1000) or if we've exceeded max attempts
      if (event.code === 1000 || reconnectAttemptsRef.current >= maxReconnectAttempts) {
        console.log("WebSocket connection closed permanently or max reconnection attempts reached");
        return;
      }

      // Exponential backoff: delay = baseDelay * 2^attempts (capped at 30 seconds)
      const delay = Math.min(baseReconnectDelay * Math.pow(2, reconnectAttemptsRef.current), 30000);
      reconnectAttemptsRef.current++;
      
      console.log(`Reconnecting in ${delay}ms...`);
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error", error);
      setIsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        // Check if data is valid and not empty
        if (!event.data || typeof event.data !== 'string') {
          console.warn("Received invalid WebSocket message data:", event.data);
          return;
        }

        const dataString = event.data.trim();
        if (!dataString || dataString === '') {
          console.warn("Received empty WebSocket message");
          return;
        }

        const data = JSON.parse(dataString);
        
        // Validate that data is an object and has a type
        if (!data || typeof data !== 'object') {
          console.warn("Received invalid WebSocket message format:", data);
          return;
        }

        const type = data.type;
        // Handle ping/pong messages silently
        if (type === 'PING' || type === 'ping') {
          return;
        }

        // Handle API responses - convert to frontend message format
        if (type === 'CREATE_SPACE_RESPONSE') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'spaceCreated',
            spaceId: data.spaceId,
            status: data.status,
            message: data.message
          };
          if (messageListeners.current.has('spaceCreated')) {
            messageListeners.current.get('spaceCreated')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'JOIN_SPACE_RESPONSE') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'spaceJoined',
            spaceId: data.spaceId,
            status: data.status,
            message: data.message,
            userColour: data.userColour, // Include color from server
            position: data.position // Include initial position from server
          };
          if (messageListeners.current.has('spaceJoined')) {
            messageListeners.current.get('spaceJoined')?.forEach(callback => callback(frontendMessage));
          }
          // Also trigger error handler if status is false
          if (!data.status && messageListeners.current.has('joinSpaceError')) {
            messageListeners.current.get('joinSpaceError')?.forEach(callback => callback({
              type: 'joinSpaceError',
              error: data.message || 'Failed to join space'
            }));
          }
          return;
        }

        if (type === 'PLAYER_LIST') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'playersList',
            playerList: data.playerList || []
          };
          if (messageListeners.current.has('playersList')) {
            messageListeners.current.get('playersList')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'QUICK_JOIN_RESPONSE') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'quickJoinSpaceResponse',
            status: data.status,
            spaceId: data.spaceId,
            message: data.message
          };
          if (messageListeners.current.has('quickJoinSpaceResponse')) {
            messageListeners.current.get('quickJoinSpaceResponse')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'SPACE_NOT_FOUND') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'joinSpaceError',
            error: 'Space not found'
          };
          if (messageListeners.current.has('joinSpaceError')) {
            messageListeners.current.get('joinSpaceError')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'MOVE') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'userMoved',
            userId: data.userId,
            position: data.position,
            userColour: data.userColour // Include color from server
          };
          if (messageListeners.current.has('userMoved')) {
            messageListeners.current.get('userMoved')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'CHAT') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'chat',
            userId: data.userId,
            chat: data.chat
          };
          if (messageListeners.current.has('chat')) {
            messageListeners.current.get('chat')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'USER_POSITIONS') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'userPositions',
            positions: data.positions || []
          };
          if (messageListeners.current.has('userPositions')) {
            messageListeners.current.get('userPositions')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'PROXIMITY_MESSAGE') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'proximityMessage',
            roomId: data.roomId,
            message: data.message,
            userIds: data.userIds || []
          };
          if (messageListeners.current.has('proximityMessage')) {
            messageListeners.current.get('proximityMessage')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        if (type === 'PROXIMITY_LEFT') {
          // Convert to frontend format
          const frontendMessage = {
            type: 'proximityLeft',
            roomId: data.roomId,
            message: data.message
          };
          if (messageListeners.current.has('proximityLeft')) {
            messageListeners.current.get('proximityLeft')?.forEach(callback => callback(frontendMessage));
          }
          return;
        }

        // console.log("WebSocket Message", data);
        if (type && typeof type === 'string' && messageListeners.current.has(type)) {
          messageListeners.current.get(type)?.forEach(callback => callback(data));
        }
      } catch (error) {
        console.error("Error processing WebSocket message:", error, "Data:", event.data);
      }
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      // Don't close the WebSocket when component unmounts
      // Let it stay connected for navigation between pages
    };
  }, [connect]);

  const sendMessage = useCallback((message: string) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(message);
    } else {
      console.warn("WebSocket is not connected. Message queued for when connection is restored.");
      // Optionally, you could queue messages here for when connection is restored
      // For now, we'll just log a warning
    }
  }, []);

  // Server automatically handles user creation on connection
  // No need to send app_opened message

  const addMessageListener = useCallback((type: string, callback: (data: any) => void) => {
    if (!messageListeners.current.has(type)) {
      messageListeners.current.set(type, new Set());
    }
    messageListeners.current.get(type)?.add(callback);

    // Force re-render to ensure components are aware of the updated listeners
    forceRender({});

    return () => {
      messageListeners.current.get(type)?.delete(callback);
      if (messageListeners.current.get(type)?.size === 0) {
        messageListeners.current.delete(type);
      }
      forceRender({});
    };
  }, []);

  return (
    <WebSocketContext.Provider value={{ sendMessage, addMessageListener, isConnected }}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error("useWebSocket must be used within a WebSocketProvider");
  }
  return context;
};

