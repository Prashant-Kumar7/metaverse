"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Video, VideoOff, Mic, MicOff, X } from "lucide-react";
import { useWebSocket } from "@/contexts/WebSocketContext";
import { toast } from "sonner";

interface PeerConnection {
  userId: string;
  pc: RTCPeerConnection;
  remoteStream: MediaStream | null;
}

interface WebRTCVideoChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string | null;
  userIds: string[];
  currentUserId: string;
  spaceId: string;
}

export function WebRTCVideoChatModal({
  open,
  onOpenChange,
  roomId,
  userIds,
  currentUserId,
  spaceId,
}: WebRTCVideoChatModalProps) {
  const [peerConnections, setPeerConnections] = useState<Map<string, PeerConnection>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const { sendMessage, addMessageListener } = useWebSocket();
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidateQueueRef = useRef<Map<string, RTCIceCandidate[]>>(new Map());
  const remoteDescriptionSetRef = useRef<Map<string, boolean>>(new Map());

  // Initialize local video stream
  const initializeLocalStream = useCallback(async () => {
    // Don't re-initialize if stream already exists
    if (localStreamRef.current) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast.error("Failed to access camera/microphone");
    }
  }, []);

  // Set local video stream to video element (separate effect to prevent flickering)
  useEffect(() => {
    if (localVideoRef.current && localStreamRef.current) {
      // Only set if it's different to prevent unnecessary updates
      if (localVideoRef.current.srcObject !== localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
        localVideoRef.current.play().catch(console.error);
      }
    }
  }, [localStream]);

  // Create peer connection for a specific user
  const createPeerConnection = useCallback((targetUserId: string) => {
    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
      ],
    });

    // Add local tracks to peer connection (must be done after stream is ready)
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        if (localStreamRef.current) {
          pc.addTrack(track, localStreamRef.current);
        }
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage(
          JSON.stringify({
            type: "iceCandidate",
            spaceId: spaceId,
            targetUserId: targetUserId,
            candidate: event.candidate,
          })
        );
      }
    };

    // Use onnegotiationneeded to create offer (like the working code)
    pc.onnegotiationneeded = () => {
      console.log(`[WebRTC] onnegotiationneeded triggered for ${targetUserId}`);
      if (pc.signalingState === "stable") {
        pc.createOffer()
          .then((offer) => {
            return pc.setLocalDescription(offer);
          })
          .then(() => {
            if (pc.localDescription) {
              sendMessage(
                JSON.stringify({
                  type: "createOffer",
                  spaceId: spaceId,
                  targetUserId: targetUserId,
                  offer: pc.localDescription,
                })
              );
              console.log(`[WebRTC] Offer sent via onnegotiationneeded to ${targetUserId}`);
            }
          })
          .catch((error) => {
            console.error(`[WebRTC] Error in onnegotiationneeded for ${targetUserId}:`, error);
          });
      }
    };

    // Handle remote stream
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      setPeerConnections((prev) => {
        const newMap = new Map(prev);
        const existing = newMap.get(targetUserId);
        if (existing) {
          existing.remoteStream = remoteStream;
        } else {
          newMap.set(targetUserId, {
            userId: targetUserId,
            pc: pc,
            remoteStream: remoteStream,
          });
        }
        return newMap;
      });

      // Update remote video element
      const videoElement = remoteVideosRef.current.get(targetUserId);
      if (videoElement) {
        videoElement.srcObject = remoteStream;
        videoElement.play().catch(console.error);
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${targetUserId}:`, pc.connectionState);
      if (pc.connectionState === "connected") {
        setIsConnected(true);
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        setIsConnected(false);
      }
    };

    peerConnectionsRef.current.set(targetUserId, pc);
    return pc;
  }, [spaceId, sendMessage]);

  // Initialize local stream when modal opens
  useEffect(() => {
    if (!open) return;

    initializeLocalStream();

    return () => {
      // Don't stop stream here - let cleanup effect handle it
    };
  }, [open, initializeLocalStream]);

  // Initialize WebRTC connections when users enter proximity and stream is ready
  useEffect(() => {
    if (!open || !roomId || userIds.length === 0 || !localStreamRef.current) {
      return;
    }

    let isMounted = true;

    const initializeConnections = () => {
      if (!isMounted || !localStreamRef.current) return;

      // Create peer connections for all users in proximity
      // The onnegotiationneeded event will trigger offer creation
      userIds.forEach((targetUserId) => {
        if (targetUserId !== currentUserId && !peerConnectionsRef.current.has(targetUserId)) {
          console.log(`[WebRTC] Creating peer connection for ${targetUserId}`);
          const pc = createPeerConnection(targetUserId);
          // onnegotiationneeded will fire automatically after addTrack
        }
      });
    };

    initializeConnections();

    return () => {
      isMounted = false;
    };
  }, [open, roomId, userIds, currentUserId, spaceId, createPeerConnection]);

  // Handle WebRTC messages
  useEffect(() => {
    if (!open) return;

    const offWebRTCConnected = addMessageListener("webrtc_connected", (message) => {
      console.log("[WebRTC] Connected message:", message);
      if (message.roomId === roomId) {
        // Re-initialize connections if needed
        const newUserIds = message.userIds.filter((id: string) => id !== currentUserId);
        newUserIds.forEach((targetUserId: string) => {
          if (!peerConnectionsRef.current.has(targetUserId)) {
            const pc = createPeerConnection(targetUserId);
            pc.createOffer()
              .then((offer) => {
                return pc.setLocalDescription(offer).then(() => offer);
              })
              .then((offer) => {
                sendMessage(
                  JSON.stringify({
                    type: "createOffer",
                    spaceId: spaceId,
                    targetUserId: targetUserId,
                    offer: offer,
                  })
                );
              })
              .catch((error) => {
                console.error(`[WebRTC] Error creating offer for ${targetUserId} in webrtc_connected:`, error);
              });
          }
        });
      }
    });

    const offWebRTCDisconnected = addMessageListener("webrtc_disconnected", (message) => {
      console.log("[WebRTC] Disconnected message:", message);
      if (message.roomId === roomId) {
        if (message.disconnectedUserId) {
          // Close connection with disconnected user
          const pc = peerConnectionsRef.current.get(message.disconnectedUserId);
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(message.disconnectedUserId);
            setPeerConnections((prev) => {
              const newMap = new Map(prev);
              newMap.delete(message.disconnectedUserId);
              return newMap;
            });
          }
        }
      }
    });

    const offCreateOffer = addMessageListener("createOffer", async (message) => {
      console.log(`[WebRTC] Received offer from ${message.senderUserId}, roomId: ${message.roomId}, current roomId: ${roomId}`);
      if (message.roomId === roomId && message.senderUserId) {
        const senderUserId = message.senderUserId;
        let pc = peerConnectionsRef.current.get(senderUserId);

        if (!pc) {
          console.log(`[WebRTC] Creating new peer connection for ${senderUserId}`);
          pc = createPeerConnection(senderUserId);
        }

        if (!message.offer) {
          console.error(`[WebRTC] No offer in message from ${senderUserId}`);
          return;
        }

        try {
          // Check signaling state before setting remote description (like working code)
          if (pc.signalingState === "stable") {
            console.log(`[WebRTC] Setting remote description (offer) from ${senderUserId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(message.offer));
            remoteDescriptionSetRef.current.set(senderUserId, true);
            
            // Process queued ICE candidates
            const queuedCandidates = iceCandidateQueueRef.current.get(senderUserId) || [];
            console.log(`[WebRTC] Processing ${queuedCandidates.length} queued ICE candidates from ${senderUserId}`);
            for (const candidate of queuedCandidates) {
              try {
                await pc.addIceCandidate(candidate);
              } catch (error) {
                console.warn(`[WebRTC] Error adding queued ICE candidate from ${senderUserId}:`, error);
              }
            }
            iceCandidateQueueRef.current.delete(senderUserId);
            
            console.log(`[WebRTC] Creating answer for ${senderUserId}`);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            console.log(`[WebRTC] Answer created and local description set for ${senderUserId}`);

            // Add any pending ICE candidates after setting local description
            const remainingCandidates = iceCandidateQueueRef.current.get(senderUserId) || [];
            while (remainingCandidates.length > 0) {
              const candidate = remainingCandidates.shift();
              if (candidate) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (error) {
                  console.warn(`[WebRTC] Error adding remaining ICE candidate:`, error);
                }
              }
            }
            iceCandidateQueueRef.current.delete(senderUserId);

            const answerMessage = {
              type: "createAnswer",
              spaceId: spaceId,
              targetUserId: senderUserId,
              answer: answer,
            };
            console.log(`[WebRTC] Sending answer to ${senderUserId}`);
            sendMessage(JSON.stringify(answerMessage));
          } else {
            console.warn(`[WebRTC] Skipping duplicate offer from ${senderUserId}, signaling state: ${pc.signalingState}`);
          }
        } catch (error) {
          console.error(`[WebRTC] Error handling offer from ${senderUserId}:`, error);
        }
      } else {
        console.warn(`[WebRTC] Offer message ignored - roomId mismatch or missing senderUserId`, {
          messageRoomId: message.roomId,
          currentRoomId: roomId,
          senderUserId: message.senderUserId
        });
      }
    });

    const offCreateAnswer = addMessageListener("createAnswer", async (message) => {
      console.log(`[WebRTC] Received answer from ${message.senderUserId}, roomId: ${message.roomId}, current roomId: ${roomId}`);
      if (message.roomId === roomId && message.senderUserId) {
        const senderUserId = message.senderUserId;
        const pc = peerConnectionsRef.current.get(senderUserId);

        if (!pc) {
          console.error(`[WebRTC] No peer connection found for ${senderUserId} when receiving answer`);
          return;
        }

        if (!message.answer) {
          console.error(`[WebRTC] No answer in message from ${senderUserId}`);
          return;
        }

        try {
          // Check signaling state before setting (like working code)
          if (pc.signalingState !== "stable") {
            console.log(`[WebRTC] Setting remote description (answer) from ${senderUserId}`);
            await pc.setRemoteDescription(new RTCSessionDescription(message.answer));
            remoteDescriptionSetRef.current.set(senderUserId, true);
            
            // Process queued ICE candidates
            const queuedCandidates = iceCandidateQueueRef.current.get(senderUserId) || [];
            console.log(`[WebRTC] Processing ${queuedCandidates.length} queued ICE candidates from ${senderUserId}`);
            while (queuedCandidates.length > 0) {
              const candidate = queuedCandidates.shift();
              if (candidate) {
                try {
                  await pc.addIceCandidate(candidate);
                } catch (error) {
                  console.warn(`[WebRTC] Error adding queued ICE candidate from ${senderUserId}:`, error);
                }
              }
            }
            iceCandidateQueueRef.current.delete(senderUserId);
            console.log(`[WebRTC] Successfully set remote description and processed candidates for ${senderUserId}`);
          } else {
            console.warn(`[WebRTC] Skipping duplicate answer from ${senderUserId}, signaling state: ${pc.signalingState}`);
          }
        } catch (error) {
          console.error(`[WebRTC] Error handling answer from ${senderUserId}:`, error);
        }
      } else {
        console.warn(`[WebRTC] Answer message ignored - roomId mismatch or missing senderUserId`, {
          messageRoomId: message.roomId,
          currentRoomId: roomId,
          senderUserId: message.senderUserId
        });
      }
    });

    const offIceCandidate = addMessageListener("iceCandidate", async (message) => {
      if (message.roomId === roomId && message.senderUserId) {
        const senderUserId = message.senderUserId;
        const pc = peerConnectionsRef.current.get(senderUserId);

        if (!pc || !message.candidate) {
          return;
        }

        const candidate = new RTCIceCandidate(message.candidate);
        
        // Check if remote description is set (like working code)
        try {
          if (pc.remoteDescription && pc.remoteDescription.type) {
            await pc.addIceCandidate(candidate);
          } else {
            console.warn(`[WebRTC] ICE candidate received before SDP from ${senderUserId}, storing for later`);
            // Queue candidate until remote description is set
            if (!iceCandidateQueueRef.current.has(senderUserId)) {
              iceCandidateQueueRef.current.set(senderUserId, []);
            }
            iceCandidateQueueRef.current.get(senderUserId)!.push(candidate);
          }
        } catch (error) {
          console.error(`[WebRTC] Failed to add ICE Candidate from ${senderUserId}:`, error);
        }
      }
    });

    const offCloseConn = addMessageListener("close_conn", (message) => {
      if (message.roomId === roomId && message.senderUserId) {
        const senderUserId = message.senderUserId;
        const pc = peerConnectionsRef.current.get(senderUserId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(senderUserId);
          setPeerConnections((prev) => {
            const newMap = new Map(prev);
            newMap.delete(senderUserId);
            return newMap;
          });
        }
      }
    });

    return () => {
      offWebRTCConnected();
      offWebRTCDisconnected();
      offCreateOffer();
      offCreateAnswer();
      offIceCandidate();
      offCloseConn();
    };
  }, [open, roomId, spaceId, currentUserId, createPeerConnection, sendMessage, addMessageListener]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      // Close all peer connections
      peerConnectionsRef.current.forEach((pc, userId) => {
        pc.close();
        sendMessage(
          JSON.stringify({
            type: "close_conn",
            spaceId: spaceId,
            targetUserId: userId,
          })
        );
      });
      peerConnectionsRef.current.clear();
      iceCandidateQueueRef.current.clear();
      remoteDescriptionSetRef.current.clear();
      setPeerConnections(new Map());

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }
      setLocalStream(null);
      setIsConnected(false);

      // Clear video elements
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null;
      }
      remoteVideosRef.current.forEach((video) => {
        video.srcObject = null;
      });
      remoteVideosRef.current.clear();
    }
  }, [open, spaceId, sendMessage]);

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  };

  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  };

  const handleClose = () => {
    // Close all connections
    peerConnectionsRef.current.forEach((pc, userId) => {
      pc.close();
      sendMessage(
        JSON.stringify({
          type: "close_conn",
          spaceId: spaceId,
          targetUserId: userId,
        })
      );
    });
    peerConnectionsRef.current.clear();

    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    onOpenChange(false);
  };

  // Set ref for remote video elements
  const setRemoteVideoRef = (userId: string, element: HTMLVideoElement | null) => {
    if (element) {
      remoteVideosRef.current.set(userId, element);
      // If we already have a stream for this user, set it
      const peerConn = peerConnections.get(userId);
      if (peerConn?.remoteStream) {
        element.srcObject = peerConn.remoteStream;
        element.play().catch(console.error);
      }
    } else {
      remoteVideosRef.current.delete(userId);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Video Chat - {userIds.length} participant{userIds.length !== 1 ? 's' : ''}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Local Video */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-64 h-48 rounded-lg border-2 border-primary bg-black object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror the video for better UX
              />
              <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                You
              </div>
            </div>
          </div>

          {/* Remote Videos Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {userIds.map((userId) => {
              if (userId === currentUserId) return null;
              const peerConn = peerConnections.get(userId);
              return (
                <div key={userId} className="relative">
                  <video
                    ref={(el) => setRemoteVideoRef(userId, el)}
                    autoPlay
                    playsInline
                    className="w-full h-48 rounded-lg border-2 border-border bg-black"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-xs">
                    User {userId.slice(-4)}
                  </div>
                  {peerConn?.pc.connectionState !== "connected" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                      <div className="text-white text-sm">Connecting...</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-4 pt-4 border-t">
            <Button
              variant={videoEnabled ? "default" : "destructive"}
              size="icon"
              onClick={toggleVideo}
            >
              {videoEnabled ? <Video className="size-5" /> : <VideoOff className="size-5" />}
            </Button>
            <Button
              variant={audioEnabled ? "default" : "destructive"}
              size="icon"
              onClick={toggleAudio}
            >
              {audioEnabled ? <Mic className="size-5" /> : <MicOff className="size-5" />}
            </Button>
            <Button variant="destructive" onClick={handleClose}>
              <X className="size-5 mr-2" />
              Leave Call
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

