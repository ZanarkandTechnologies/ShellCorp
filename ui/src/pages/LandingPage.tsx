/**
 * LANDING PAGE
 * ============
 * Public ShellCorp entry page that explains the founder-control workflow and
 * routes directly into the AI office without an invite gate.
 *
 * KEY CONCEPTS:
 * - The office is the primary product surface, so entry should be one click.
 * - Landing copy should explain what founders do once they enter the office.
 *
 * USAGE:
 * - Mounted at `/` from `AppRouter`.
 *
 * MEMORY REFERENCES:
 * - MEM-0193
 */

import React from "react";
import { ArrowRight, Gamepad2, Sparkles, Zap } from "lucide-react";
import { Link } from "react-router-dom";

import { BackgroundImage } from "../components/theme/background-image";
import { ThemeToggle } from "../components/theme/theme-toggle";
import { Button } from "../components/ui/button";

export function LandingPage(): React.JSX.Element {
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
            <Button asChild variant="default">
              <Link to="/office">Go to office</Link>
            </Button>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 flex-1">
        {/* Hero Section */}
        <div className="max-w-5xl mx-auto text-center space-y-10 py-20">
          <div className="space-y-6">
            <h1 className="text-6xl md:text-7xl font-bold tracking-tight">
              Your AI office
              <br />
              <span className="text-primary">with OpenClaw.</span>
            </h1>
            <p className="text-2xl md:text-3xl text-muted-foreground max-w-3xl mx-auto">
              Run a small autonomous company from one control room instead of
              stitching together logs, chats, and approvals by hand.
            </p>
          </div>

          <div className="mx-auto max-w-4xl rounded-3xl border bg-background/75 p-6 text-left shadow-sm backdrop-blur-sm md:p-8">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  1. Form
                </p>
                <h2 className="text-xl font-semibold">Ask the CEO to build a team</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Start from the office, open the CEO workflow, and generate a focused plan for
                  a new business or project.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  2. Review
                </p>
                <h2 className="text-xl font-semibold">Approve the work that matters</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Human review stays visible so you can inspect proposals, approve execution, and
                  keep the office focused on a small number of active teams.
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">
                  3. Operate
                </p>
                <h2 className="text-xl font-semibold">Watch the office run in real time</h2>
                <p className="text-sm leading-6 text-muted-foreground">
                  Open the office to track agents, inspect sessions and memory, and steer live
                  work without leaving the founder control surface.
                </p>
              </div>
            </div>
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

          <div className="mx-auto max-w-3xl space-y-4 rounded-3xl border bg-background/70 p-6 backdrop-blur-sm">
            <h2 className="text-2xl font-semibold">What to do when you enter</h2>
            <p className="text-base leading-7 text-muted-foreground">
              Open the office, click into the CEO or an active team, and use the shared panels to
              inspect sessions, review work, and move the next decision forward.
            </p>
          </div>

          {/* CTA */}
          <div className="mt-12 flex justify-center">
            <Button asChild size="lg" className="h-16 px-10 text-xl">
              <Link to="/office" aria-label="Go to office from hero">
                Go to office
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative border-t mt-auto py-4 bg-background/75 backdrop-blur-sm">
        <div className="container mx-auto px-4 flex flex-col gap-4 text-center text-base text-foreground/70 md:flex-row md:items-center md:justify-between">
          <p>© 2026 ShellCorp by Zanarkand. All rights reserved.</p>
          <Button asChild variant="outline">
            <Link to="/office">Go to office</Link>
          </Button>
        </div>
      </footer>
    </div>
  );
}
