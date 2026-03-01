"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"

import { Button } from "@/components/ui/button"

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [isTransitioning, setIsTransitioning] = React.useState(false)

    const handleThemeToggle = () => {
        setIsTransitioning(true)

        // Create animated overlay element
        const overlay = document.createElement('div')
        overlay.className = 'theme-transition-overlay'
        document.body.appendChild(overlay)

        // Trigger fade in animation
        requestAnimationFrame(() => {
            overlay.style.opacity = '1'
        })

        // Change theme at peak of fade
        setTimeout(() => {
            setTheme(theme === "light" ? "dark" : "light")
        }, 400)

        // Fade out overlay
        setTimeout(() => {
            overlay.style.opacity = '0'
            setTimeout(() => {
                document.body.removeChild(overlay)
                setIsTransitioning(false)
            }, 400)
        }, 800)
    }

    return (
        <Button
            variant="outline"
            size="icon"
            onClick={handleThemeToggle}
            disabled={isTransitioning}
        >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}

