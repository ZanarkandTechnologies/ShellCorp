"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SpeedDialItem {
    id: string;
    icon: LucideIcon;
    label: string;
    onClick: () => void;
    badge?: number;
    color?: string;
    disabled?: boolean;
    component?: 'button' | React.ReactNode;
}

interface SpeedDialProps {
    items: SpeedDialItem[];
    position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    direction?: 'vertical' | 'horizontal';
    triggerIcon?: LucideIcon;
    triggerColor?: string;
    className?: string;
    positioning?: 'fixed' | 'absolute';
    tooltipDirection?: 'left' | 'right';
}

export function SpeedDial({
    items,
    position = 'bottom-right',
    direction = 'vertical',
    triggerIcon: TriggerIcon = Plus,
    triggerColor = "bg-primary hover:bg-primary/90 text-primary-foreground",
    className,
    positioning = 'fixed',
    tooltipDirection,
}: SpeedDialProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Calculate position classes
    const positionClasses = {
        'top-left': 'top-4 left-4',
        'top-right': 'top-4 right-4',
        'bottom-left': 'bottom-4 left-4',
        'bottom-right': 'bottom-4 right-4',
    };

    // Calculate item positioning based on direction and position
    const getItemsContainerClasses = () => {
        const baseClasses = "absolute";

        if (direction === 'vertical') {
            if (position.includes('top')) {
                // Center items relative to trigger button
                if (position.includes('right')) {
                    return `${baseClasses} top-14 right-1 space-y-2`; // Offset to center with trigger
                } else {
                    return `${baseClasses} top-14 left-1 space-y-2`; // Offset to center with trigger
                }
            } else {
                // For bottom positions, center items relative to trigger button
                if (position.includes('right')) {
                    return `${baseClasses} bottom-14 right-1 space-y-2`; // Offset to center with trigger
                } else {
                    return `${baseClasses} bottom-14 left-1 space-y-2`; // Offset to center with trigger
                }
            }
        } else {
            if (position.includes('left')) {
                return `${baseClasses} left-14 space-x-2 flex`;
            } else {
                return `${baseClasses} right-14 space-x-2 flex`;
            }
        }
    };

    // Calculate animation direction
    const getItemAnimation = (index: number) => {
        // Reverse animation order for bottom positions (bottom items appear first)
        const animateDelay = position.includes('bottom')
            ? (items.length - 1 - index) * 0.05
            : index * 0.05;
        const exitDelay = position.includes('bottom')
            ? index * 0.05
            : (items.length - 1 - index) * 0.05;

        if (direction === 'vertical') {
            const yDirection = position.includes('top') ? 20 : -20;
            return {
                initial: { opacity: 0, y: yDirection, scale: 0.8 },
                animate: {
                    opacity: 1,
                    y: 0,
                    scale: 1,
                    transition: {
                        delay: animateDelay,
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30
                    }
                },
                exit: {
                    opacity: 0,
                    y: yDirection,
                    scale: 0.8,
                    transition: {
                        delay: exitDelay,
                        duration: 0.1
                    }
                }
            };
        } else {
            const xDirection = position.includes('left') ? 20 : -20;
            return {
                initial: { opacity: 0, x: xDirection, scale: 0.8 },
                animate: {
                    opacity: 1,
                    x: 0,
                    scale: 1,
                    transition: {
                        delay: animateDelay,
                        type: "spring" as const,
                        stiffness: 400,
                        damping: 30
                    }
                },
                exit: {
                    opacity: 0,
                    x: xDirection,
                    scale: 0.8,
                    transition: {
                        delay: exitDelay,
                        duration: 0.1
                    }
                }
            };
        }
    };

    // Get total badge count for main button
    const totalBadgeCount = items.reduce((total, item) => total + (item.badge || 0), 0);

    return (
        <div className={cn(positioning, "z-50", positionClasses[position], className)}>
            <div className="relative">
                {/* Main FAB Button */}
                <motion.div
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                >
                    <Button
                        onClick={() => setIsOpen(!isOpen)}
                        size="icon"
                        className={cn(
                            "h-12 w-12 rounded-full shadow-lg transition-all duration-200",
                            triggerColor,
                            isOpen && "rotate-45"
                        )}
                    >
                        {isOpen ? <X className="h-5 w-5" /> : <TriggerIcon className="h-5 w-5" />}
                    </Button>
                </motion.div>

                {/* Notification Badge for total items */}
                <AnimatePresence>
                    {totalBadgeCount > 0 && !isOpen && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute -top-2 -right-2"
                        >
                            <Badge
                                variant="destructive"
                                className="h-6 w-6 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
                            >
                                {totalBadgeCount > 99 ? "99+" : totalBadgeCount}
                            </Badge>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Speed Dial Items */}
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className={getItemsContainerClasses()}
                        >
                            {items.map((item, index) => {
                                // Calculate tooltip animation delay
                                const tooltipDelay = position.includes('bottom')
                                    ? (items.length - 1 - index) * 0.05 + 0.1
                                    : index * 0.05 + 0.1;

                                return (
                                    <motion.div
                                        key={item.id}
                                        {...getItemAnimation(index)}
                                        className={direction === 'vertical' ? '' : 'flex items-center gap-3'}
                                    >
                                        <div className={cn(
                                            "flex items-center gap-3",
                                            // For right-side positions or explicit left tooltip, reverse the layout
                                            (tooltipDirection === 'left' || position.includes('right')) && direction === 'vertical' ? 'flex-row-reverse' : ''
                                        )}>
                                            <div className="relative">
                                                {typeof item.component === 'object' && item.component !== null ? (
                                                    item.component
                                                ) : (
                                                    <Button
                                                        onClick={() => {
                                                            if (!item.disabled) {
                                                                item.onClick();
                                                                setIsOpen(false);
                                                            }
                                                        }}
                                                        size="icon"
                                                        disabled={item.disabled}
                                                        className={cn(
                                                            "h-10 w-10 rounded-full shadow-lg transition-all duration-200",
                                                            item.color || "bg-primary hover:bg-primary/90 text-primary-foreground",
                                                            item.disabled && "opacity-50 cursor-not-allowed"
                                                        )}
                                                    >
                                                        <item.icon className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {/* Item Badge */}
                                                {item.badge && (
                                                    <Badge
                                                        variant="destructive"
                                                        className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                                                    >
                                                        {item.badge > 99 ? "99+" : item.badge}
                                                    </Badge>
                                                )}
                                            </div>

                                            {/* Label */}
                                            <motion.div
                                                initial={direction === 'vertical'
                                                    ? {
                                                        opacity: 0,
                                                        x: (tooltipDirection === 'left' || position.includes('right')) ? 10 : -10
                                                    }
                                                    : { opacity: 0, y: -10 }
                                                }
                                                animate={direction === 'vertical'
                                                    ? {
                                                        opacity: 1,
                                                        x: 0,
                                                        transition: { delay: tooltipDelay }
                                                    }
                                                    : {
                                                        opacity: 1,
                                                        y: 0,
                                                        transition: { delay: tooltipDelay }
                                                    }
                                                }
                                                exit={direction === 'vertical'
                                                    ? {
                                                        opacity: 0,
                                                        x: (tooltipDirection === 'left' || position.includes('right')) ? 10 : -10
                                                    }
                                                    : { opacity: 0, y: -10 }
                                                }
                                                className="bg-background/95 backdrop-blur-sm px-3 py-1 rounded-md shadow-md border text-sm font-medium whitespace-nowrap"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <span>{item.label}</span>
                                                    {item.disabled && (
                                                        <span className="text-xs text-muted-foreground">
                                                            (Coming Soon)
                                                        </span>
                                                    )}
                                                </div>
                                            </motion.div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

