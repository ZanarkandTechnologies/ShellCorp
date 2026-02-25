import { useState } from "react";
import { Gamepad2, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { InviteCodeModal } from "@/components/invite/invite-code-modal";
import { BackgroundImage } from "@/components/theme/background-image";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

export function LandingPage(): JSX.Element {
  const [showInviteModal, setShowInviteModal] = useState(false);

  return (
    <div className="min-h-screen relative">
      <div className="absolute inset-0 -z-10">
        <BackgroundImage src="/favicon.svg" alt="Light mode background" className="dark:hidden opacity-20" />
        <BackgroundImage src="/favicon.svg" alt="Dark mode background" className="hidden dark:block opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-background from-0% via-background via-38% to-transparent transition-colors duration-500" />
      </div>

      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="flex items-center gap-3">
            <img src="/favicon.svg" alt="Zanarkand Logo" className="h-10 w-10 rounded" />
            <div className="flex flex-col">
              <span className="text-2xl font-bold">Zanarkand</span>
              <span className="text-xs text-muted-foreground">by Nomous Labs</span>
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

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center space-y-8 py-20">
          <div className="space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
              Build Your Business
              <br />
              <span className="text-primary">With Zanarkand</span>
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
              Command your agents. Build your business. Compete to win.
            </p>
          </div>

          <div className="max-w-3xl mx-auto mt-16 space-y-6">
            <div className="flex flex-col md:flex-row items-center justify-center gap-8 text-center">
              <div className="flex flex-col items-center gap-2">
                <Zap className="h-6 w-6 text-primary" />
                <p className="text-sm font-medium">The Future of Agents</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Sparkles className="h-6 w-6 text-primary" />
                <p className="text-sm font-medium">Intuitive</p>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Gamepad2 className="h-6 w-6 text-primary" />
                <p className="text-sm font-medium">It&apos;s a Game. It&apos;s Fun.</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Reliable • Powerful • Built for Solopreneurs</p>
          </div>

          <div className="mt-12">
            <Button size="lg" className="h-14 px-8 text-lg" onClick={() => setShowInviteModal(true)}>
              Get Started
            </Button>
          </div>
        </div>
      </main>

      <footer className="relative border-t mt-20 py-4 bg-background/75 backdrop-blur-sm">
        <div className="container mx-auto px-4 text-center text-sm text-foreground/70">
          <p>© 2026 Zanarkand by Nomous Labs. All rights reserved.</p>
        </div>
      </footer>

      <InviteCodeModal open={showInviteModal} onOpenChange={setShowInviteModal} />
    </div>
  );
}
