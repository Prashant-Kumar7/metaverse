"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Plus, Users, LogIn, Sparkles, Zap } from "lucide-react"
import { SignedIn, SignedOut, RedirectToSignIn, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ThemeToggle } from "@/components/theme-toggle"
import { toast } from "sonner"
import { useWebSocket } from "@/contexts/WebSocketContext"
import { useUser } from "@clerk/nextjs"

export default function DashboardPage() {
  const router = useRouter()
  const { user } = useUser()
  const [createSpaceOpen, setCreateSpaceOpen] = useState(false)
  const [joinSpaceOpen, setJoinSpaceOpen] = useState(false)
  const [spaceName, setSpaceName] = useState("")
  const [spaceCode, setSpaceCode] = useState("")
  const [username, setUsername] = useState("")
  const { sendMessage, addMessageListener, isConnected } = useWebSocket()

  // Hide top navigation from layout
  useEffect(() => {
    const header = document.querySelector('header:first-of-type');
    if (header) {
      (header as HTMLElement).style.display = 'none';
    }
    
    return () => {
      // Restore header on unmount
      if (header) {
        (header as HTMLElement).style.display = '';
      }
    };
  }, []);

  // Generate username on mount if not set
  useEffect(() => {
    if (typeof window !== 'undefined' && !username) {
      const stored = localStorage.getItem('metaverse_username');
      if (stored) {
        setUsername(stored);
      } else {
        const defaultUsername = `User${Math.floor(Math.random() * 10000)}`;
        setUsername(defaultUsername);
        localStorage.setItem('metaverse_username', defaultUsername);
      }
    }
  }, [username]);

  useEffect(() => {
    const offSpaceCreated = addMessageListener("spaceCreated", (message) => {
      // Dismiss any existing toasts before showing new one
      toast.dismiss()
      toast.success(`Space created successfully!`, {
        description: `Space ID: ${message.spaceId}`,
        duration: 2000,
      })
      setSpaceName("")
      setCreateSpaceOpen(false)
      // Small delay to let toast show before navigation
      setTimeout(() => {
        router.push(`/space/${message.spaceId}`)
      }, 100)
    })

    const offSpaceJoined = addMessageListener("spaceJoined", (message) => {
      // Dismiss any existing toasts before showing new one
      toast.dismiss()
      toast.success(`Joined space successfully!`, {
        description: `Space ID: ${message.spaceId}`,
        duration: 2000,
      })
      setSpaceCode("")
      setJoinSpaceOpen(false)
      // Small delay to let toast show before navigation
      setTimeout(() => {
        router.push(`/space/${message.spaceId}`)
      }, 100)
    })

    const offCreateSpaceError = addMessageListener("createSpaceError", (message) => {
      toast.error("Failed to create space", {
        description: message.error,
      })
    })

    const offJoinSpaceError = addMessageListener("joinSpaceError", (message) => {
      toast.error("Failed to join space", {
        description: message.error,
      })
    })

    const offQuickJoinResponse = addMessageListener("quickJoinSpaceResponse", (message) => {
      console.log("[QUICK_JOIN_RESPONSE]", message)
      toast.dismiss("quick-join")
      
      if (message.status === true) {
        // Send JOIN_SPACE message to actually join the space
        sendMessage(JSON.stringify({
          type: "JOIN_SPACE",
          userId: user?.id,
          spaceId: message.spaceId,
          username: username || "User"
        }))
        // Navigation will happen via spaceJoined listener
      } else {
        toast.error("Quick Join Failed", {
          description: message.message || "No spaces available. Try creating one!",
        })
      }
    })

    return () => {
      offSpaceCreated()
      offSpaceJoined()
      offCreateSpaceError()
      offJoinSpaceError()
      offQuickJoinResponse()
    }
  }, [addMessageListener, router, sendMessage])

  const handleCreateSpace = () => {
    if (!spaceName.trim()) {
      toast.error("Please enter a space name")
      return
    }
    
    if (!isConnected) {
      toast.error("Not connected to server. Please try again.")
      return
    }
    
    // Generate spaceId (timestamp + random string)
    const spaceId = `space_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    sendMessage(JSON.stringify({
      type: "CREATE_SPACE",
      userId: user?.id,
      spaceId: spaceId,
      spaceName: spaceName.trim(),
      username: username || "User",
    }))
  }

  const handleJoinSpace = () => {
    if (!spaceCode.trim()) {
      toast.error("Please enter a space ID")
      return
    }
    
    if (!isConnected) {
      toast.error("Not connected to server. Please try again.")
      return
    }
    
    // Use spaceCode as spaceId (user enters the full space ID)
    sendMessage(JSON.stringify({
      type: "JOIN_SPACE",
      userId: user?.id,
      spaceId: spaceCode.trim(),
      username: username || "User"
    }))
  }

  const handleQuickJoin = () => {
    if (!isConnected) {
      toast.error("Not connected to server. Please try again.")
      return
    }
    
    toast.loading("Finding available space...", { id: "quick-join" })
    sendMessage(JSON.stringify({
      type: "QUICK_JOIN_SPACE"
    }))
  }

  return (
    <>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <SignedIn>
        <div className="min-h-screen bg-background">
          {/* Header */}
          <header className="border-b bg-card">
            <div className="container mx-auto flex h-16 items-center justify-between px-4">
              <div className="flex items-center gap-2">
                <Sparkles className="size-6 text-primary" />
                <h1 className="text-xl font-bold">Metaverse Dashboard</h1>
              </div>
              <div className="flex items-center gap-4">
                <ThemeToggle />
                <SignedOut>
                  <SignInButton />
                  <SignUpButton />
                </SignedOut>
                <SignedIn>
                  <UserButton />
                </SignedIn>
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="container mx-auto px-4 py-8">
            <div className="mb-8">
              <h2 className="text-3xl font-bold tracking-tight">Welcome Back</h2>
              <p className="text-muted-foreground mt-2">
                Create or join a space to start your metaverse experience
              </p>
            </div>

            {/* Action Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {/* Create Space Card */}
              <Card className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Plus className="size-5 text-primary" />
                    <CardTitle>Create Space</CardTitle>
                  </div>
                  <CardDescription>
                    Start a new space and invite others to join your metaverse experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Customize your space
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Set space permissions
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Share with friends
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Dialog open={createSpaceOpen} onOpenChange={setCreateSpaceOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" size="lg">
                        <Plus className="mr-2 size-4" />
                        Create Space
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Space</DialogTitle>
                        <DialogDescription>
                          Give your space a name. A unique code will be generated for sharing.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="space-name">Space Name</Label>
                          <Input
                            id="space-name"
                            placeholder="My Awesome Space"
                            value={spaceName}
                            onChange={(e) => setSpaceName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleCreateSpace()
                              }
                            }}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setCreateSpaceOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleCreateSpace}>
                          <Plus className="mr-2 size-4" />
                          Create Space
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>

              {/* Join Space Card */}
              <Card className="flex flex-col">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <LogIn className="size-5 text-primary" />
                    <CardTitle>Join Space</CardTitle>
                  </div>
                  <CardDescription>
                    Enter a space code to join an existing metaverse experience
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Enter space code
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Connect instantly
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Start exploring
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Dialog open={joinSpaceOpen} onOpenChange={setJoinSpaceOpen}>
                    <DialogTrigger asChild>
                      <Button className="w-full" size="lg" variant="outline">
                        <LogIn className="mr-2 size-4" />
                        Join Space
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Join Space</DialogTitle>
                        <DialogDescription>
                          Enter the space ID provided by the space creator.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        <div className="space-y-2">
                          <Label htmlFor="space-code">Space ID</Label>
                          <Input
                            id="space-code"
                            placeholder="space_1234567890_abc123"
                            value={spaceCode}
                            onChange={(e) => setSpaceCode(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleJoinSpace()
                              }
                            }}
                            className="text-center text-sm font-mono"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => setJoinSpaceOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleJoinSpace}>
                          <LogIn className="mr-2 size-4" />
                          Join Space
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardFooter>
              </Card>

              {/* Quick Join Card */}
              <Card className="flex flex-col border-2 border-primary/20 bg-linear-to-br from-primary/5 to-background">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="size-5 text-primary" />
                    <CardTitle>Quick Join</CardTitle>
                  </div>
                  <CardDescription>
                    Instantly join a random available space and start exploring
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      No code needed
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Instant connection
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="size-1.5 rounded-full bg-primary" />
                      Meet new people
                    </li>
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    size="lg"
                    onClick={handleQuickJoin}
                    disabled={!isConnected}
                  >
                    <Zap className="mr-2 size-4" />
                    Quick Join
                  </Button>
                </CardFooter>
              </Card>
            </div>

            {/* Recent Spaces Section */}
            <div className="mt-12">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-2xl font-semibold">Recent Spaces</h3>
                <Button variant="ghost" size="sm">
                  View All
                </Button>
              </div>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Users className="size-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">
                      No recent spaces. Create or join a space to get started!
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </main>
        </div>
      </SignedIn>
    </>
  )
}

