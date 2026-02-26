import React, { useState } from "react";
import { Button } from "../components/ui/button";
import { Gamepad2, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { InviteCodeModal } from "../components/invite/invite-code-modal";
import { BackgroundImage } from "../components/theme/background-image";
import { ThemeToggle } from "../components/theme/theme-toggle";

export function LandingPage(): React.JSX.Element {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="min-h-screen relative flex flex-col">
      {/* Background Images */}
      <div className="absolute inset-0 -z-10">
        {/* Light mode background */}
        <BackgroundImage
          src="/light bg edited.PNG"
          alt="Light mode background"
          priority
          className="dark:hidden"
        />
        {/* Dark mode background */}
        <BackgroundImage
          src="/dark bg-2 edited.PNG"
          alt="Dark mode background"
          priority
          className="hidden dark:block"
        />
        {/* Gradient overlay - solid at top to protect text, transparent at bottom to show buildings */}
        <div className="absolute inset-0 bg-gradient-to-b from-background from-0% via-background via-38% to-transparent transition-colors duration-500" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3">
            <img src="/zanarkand-logo.png" alt="ShellCorp Logo" className="h-10 w-auto" />
            <div className="flex flex-col">
              <span className="text-3xl font-bold">ShellCorp</span>
              <span className="text-sm text-muted-foreground">by Zanarkand</span>
            </div>
          </Link>
          <nav className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => setShowInviteModal(true)}>
              Access
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Hero Section */}
        <div className="max-w-4xl mx-auto text-center space-y-8 py-20">
          <div className="space-y-6">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
              Your AI office
              <br />
              <span className="text-primary">with OpenClaw.</span>
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground max-w-3xl mx-auto">
              Observe your agent&apos;s work and make you money.
            </p>
          </div>

          {/* Key Features */}
          <div className="max-w-3xl mx-auto mt-16 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <p className="text-base font-medium">Live Agent Office</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <p className="text-base font-medium">OpenClaw Native</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Gamepad2 className="h-6 w-6 text-primary" />
                <p className="text-base font-medium">Gamified Controls</p>
              </div>
            </div>
            <p className="text-base text-muted-foreground">Observe • Decide • Scale</p>
          </div>

          {/* CTA */}
          <div className="mt-12">
            <Button
              size="lg"
              className="h-16 px-10 text-xl"
              onClick={() => setShowInviteModal(true)}
            >
              Get Started
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t mt-auto py-4 bg-background/75 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center text-base text-foreground/70">
          <p>© 2026 ShellCorp by Zanarkand. All rights reserved.</p>
        </div>
      </footer>

      {/* Invite Code Modal */}
      <InviteCodeModal open={showInviteModal} onOpenChange={setShowInviteModal} />
    </div>
  );
}
