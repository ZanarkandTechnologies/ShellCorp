import { Html } from '@react-three/drei';
import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export interface MenuAction {
    id: string;
    label: string;
    icon: LucideIcon;
    color?: string; // Tailwind color class base (e.g., "blue")
    position?: 'top' | 'right' | 'bottom' | 'left';
    onClick: () => void;
    // Optional: handler that receives the mouse event for drag operations
    onMouseDown?: (e: React.MouseEvent) => void;
}

interface ContextMenuProps {
    isOpen: boolean;
    onClose: () => void;
    actions: MenuAction[];
    title?: string; // Optional title/object name
}

export function ContextMenu({
    isOpen,
    onClose,
    actions,
    title = "Menu"
}: ContextMenuProps) {
    const [deleteConfirmationOpen, setDeleteConfirmationOpen] = useState(false);
    const [deleteAction, setDeleteAction] = useState<MenuAction | null>(null);

    const handleClose = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        onClose();
    };

    const handleActionClick = (e: React.MouseEvent, action: MenuAction) => {
        e.stopPropagation();

        if (action.id === 'delete') {
            setDeleteAction(action);
            setDeleteConfirmationOpen(true);
        } else {
            action.onClick();
        }
    };

    const handleActionMouseDown = (e: React.MouseEvent, action: MenuAction) => {
        e.stopPropagation();
        // For move/drag actions, use mousedown to start dragging immediately
        if (action.onMouseDown) {
            action.onMouseDown(e);
        }
    };

    const confirmDelete = () => {
        if (deleteAction) {
            deleteAction.onClick();
        }
        setDeleteConfirmationOpen(false);
        setDeleteAction(null);
    };

    // Animation classes
    const buttonBaseClass = "w-10 h-10 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border-2 flex items-center justify-center";
    const labelClass = "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-medium text-foreground bg-background/90 px-2 py-0.5 rounded backdrop-blur-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity border border-border";

    // Helper to get position style
    const getPositionStyle = (action: MenuAction, index: number, total: number) => {
        const radius = 56; // Slightly increased radius for more items

        // If explicit position is provided and total <= 4, use it (legacy behavior)
        if (action.position && total <= 4) {
            switch (action.position) {
                case 'top': return { left: '0px', top: `-${radius}px`, transform: 'translate(-50%, -50%)' };
                case 'right': return { left: `${radius}px`, top: '0px', transform: 'translate(-50%, -50%)' };
                case 'bottom': return { left: '0px', top: `${radius}px`, transform: 'translate(-50%, -50%)' };
                case 'left': return { left: `-${radius}px`, top: '0px', transform: 'translate(-50%, -50%)' };
            }
        }

        // Otherwise (or if total > 4), use radial distribution
        // Start from -90deg (top) and go clockwise
        const angleStep = 360 / total;
        const startAngle = -90;
        const angle = startAngle + (index * angleStep);
        const radian = (angle * Math.PI) / 180;

        const x = Math.round(radius * Math.cos(radian));
        const y = Math.round(radius * Math.sin(radian));

        return {
            left: `${x}px`,
            top: `${y}px`,
            transform: 'translate(-50%, -50%)'
        };
    };

    // Theme-aware color mapping with pastel/muted tones
    const colorMap: Record<string, string> = {
        // Primary actions (move, view, etc.)
        blue: 'bg-primary hover:bg-primary/90 border-primary text-primary-foreground',

        // Rotate/refresh actions - Muted gray
        green: 'bg-slate-500 hover:bg-slate-600 border-slate-400 text-white dark:bg-slate-600 dark:hover:bg-slate-700',

        // Destructive actions (delete) - Softer pastel red
        red: 'bg-rose-400 hover:bg-rose-500 border-rose-300 text-white dark:bg-rose-500 dark:hover:bg-rose-600',

        // Warning/important actions (manage, assign)
        amber: 'bg-amber-500 hover:bg-amber-600 border-amber-400 text-white dark:bg-amber-600 dark:hover:bg-amber-700',

        // Special actions
        purple: 'bg-purple-500 hover:bg-purple-600 border-purple-400 text-white dark:bg-purple-600 dark:hover:bg-purple-700',

        // Training/learning actions - Indigo
        indigo: 'bg-indigo-500 hover:bg-indigo-600 border-indigo-400 text-white dark:bg-indigo-600 dark:hover:bg-indigo-700',

        // Neutral/secondary actions
        gray: 'bg-secondary hover:bg-secondary/80 border-border text-secondary-foreground',

        // Default
        default: 'bg-primary hover:bg-primary/90 border-primary text-primary-foreground',
    };

    const getColorClasses = (color: string = 'default') => {
        return colorMap[color] || colorMap.default;
    };

    if (!isOpen) return null;

    return (
        <>
            <Html position={[0, 1.0, 0]} center zIndexRange={[1000, 0]} style={{ pointerEvents: 'none' }}>
                <div className="pointer-events-auto relative flex justify-center items-center w-0 h-0">
                    {/* Center Close Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-muted hover:bg-muted/80 text-muted-foreground backdrop-blur-sm z-10 shadow-md border border-border"
                        onClick={handleClose}
                    >
                        <X className="w-4 h-4" />
                    </Button>

                    {/* Actions */}
                    {actions.map((action, index) => (
                        <div key={action.id} className="absolute" style={getPositionStyle(action, index, actions.length)}>
                            <div className="relative group">
                                <Button
                                    variant="secondary"
                                    size="icon"
                                    className={cn(buttonBaseClass, getColorClasses(action.color))}
                                    onClick={(e) => handleActionClick(e, action)}
                                    onMouseDown={(e) => handleActionMouseDown(e, action)}
                                >
                                    <action.icon className="w-5 h-5" />
                                </Button>
                                <span className={labelClass}>{action.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Html>

            {/* Dialog in separate Html wrapper - Radix UI will portal it to body automatically */}
            <Html position={[0, 0, 0]} style={{ display: 'none', pointerEvents: 'none' }}>
                <Dialog open={deleteConfirmationOpen} onOpenChange={setDeleteConfirmationOpen}>
                    <DialogContent className="sm:max-w-[425px] z-[9999]">
                        <DialogHeader>
                            <DialogTitle>Delete {title}?</DialogTitle>
                            <DialogDescription>
                                Are you sure you want to delete this {title.toLowerCase()}? This action cannot be undone.
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteConfirmationOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="destructive" onClick={confirmDelete}>
                                Delete
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </Html>
        </>
    );
}
