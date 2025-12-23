"use client";

import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignInButton, SignUpButton } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sparkles,
  Users,
  Globe,
  Zap,
  Shield,
  ArrowRight,
  Map,
  Gamepad2,
  MessageSquare,
  Lock,
} from "lucide-react";

export default function Home() {
  const router = useRouter();

  const features = [
    {
      icon: Globe,
      title: "Virtual Spaces",
      description: "Create and customize your own virtual spaces. Build unique environments where you can interact with others.",
    },
    {
      icon: Users,
      title: "Real-time Multiplayer",
      description: "Connect with friends and strangers in real-time. See others move, interact, and explore together.",
    },
    {
      icon: Map,
      title: "Large World Maps",
      description: "Explore vast 4000x4000 pixel worlds with tile-based maps and interactive objects.",
    },
    {
      icon: Zap,
      title: "Instant Connection",
      description: "Join spaces instantly with unique codes. No downloads, no waiting - just pure connection.",
    },
    {
      icon: Gamepad2,
      title: "Smooth Movement",
      description: "Navigate with arrow keys through beautifully rendered worlds with collision detection.",
    },
    {
      icon: MessageSquare,
      title: "Live Updates",
      description: "Experience real-time position updates and see other users move smoothly across the space.",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your spaces are secure. Control who can join and when with unique access codes.",
    },
    {
      icon: Lock,
      title: "User Authentication",
      description: "Secure login with Clerk authentication. Your identity is protected and verified.",
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background" />
        <div className="container relative mx-auto px-4 py-24 md:py-32">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 flex justify-center">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="size-12 text-primary" />
              </div>
            </div>
            <h1 className="mb-6 text-5xl font-bold tracking-tight md:text-6xl lg:text-7xl">
              Welcome to the
              <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                {" "}
                Metaverse
              </span>
            </h1>
            <p className="mb-8 text-xl text-muted-foreground md:text-2xl">
              Create, explore, and connect in immersive virtual spaces. Build your world, invite friends, and
              experience the future of social interaction.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <SignedIn>
                <Button
                  size="lg"
                  onClick={() => router.push("/dashboard")}
                  className="text-lg px-8"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </SignedIn>
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button size="lg" className="text-lg px-8">
                    Get Started
                    <ArrowRight className="ml-2 size-5" />
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Sign In
                  </Button>
                </SignInButton>
              </SignedOut>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold tracking-tight">Powerful Features</h2>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Everything you need to create and explore virtual spaces with friends and communities.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="border-2 transition-all hover:border-primary/50 hover:shadow-lg">
                <CardHeader>
                  <div className="mb-4 flex size-12 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="size-6 text-primary" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-24">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight">How It Works</h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Get started in three simple steps
            </p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                1
              </div>
              <h3 className="mb-2 text-2xl font-semibold">Sign Up</h3>
              <p className="text-muted-foreground">
                Create your account with secure authentication. It only takes a minute to get started.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                2
              </div>
              <h3 className="mb-2 text-2xl font-semibold">Create or Join</h3>
              <p className="text-muted-foreground">
                Create your own virtual space or join an existing one using a unique space code.
              </p>
            </div>
            <div className="text-center">
              <div className="mb-4 inline-flex size-16 items-center justify-center rounded-full bg-primary text-2xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="mb-2 text-2xl font-semibold">Explore & Connect</h3>
              <p className="text-muted-foreground">
                Navigate through the world, interact with objects, and connect with other users in real-time.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
          <CardContent className="px-8 py-16 text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight">Ready to Get Started?</h2>
            <p className="mb-8 mx-auto max-w-2xl text-lg text-muted-foreground">
              Join thousands of users exploring the metaverse. Create your space today and start your journey.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <SignedIn>
                <Button
                  size="lg"
                  onClick={() => router.push("/dashboard")}
                  className="text-lg px-8"
                >
                  Go to Dashboard
                  <ArrowRight className="ml-2 size-5" />
                </Button>
              </SignedIn>
              <SignedOut>
                <SignUpButton mode="modal">
                  <Button size="lg" className="text-lg px-8">
                    Create Account
                    <ArrowRight className="ml-2 size-5" />
                  </Button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <Button size="lg" variant="outline" className="text-lg px-8">
                    Sign In
                  </Button>
                </SignInButton>
              </SignedOut>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
