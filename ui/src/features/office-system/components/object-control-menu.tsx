import { Html } from '@react-three/drei';
import { useState, useEffect } from 'react';
import { Trash2, Move, RotateCw, RotateCcw, Settings, X, MessageSquare, Monitor, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ObjectControlMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onDelete?: () => void;
    onRotateLeft?: () => void;
    onRotateRight?: () => void;
    onSettings?: () => void;
    onChat?: () => void;
    onViewComputer?: () => void;
    onManage?: () => void;
    onMove?: () => void;
    currentRotation: number; // in degrees
    objectName?: string;
}

export function ObjectControlMenu({
    isOpen,
    onClose,
    onDelete,
    onRotateLeft,
    onRotateRight,
    onSettings,
    onChat,
    onViewComputer,
    onManage,
    onMove,
    currentRotation,
    objectName = "Object"
}: ObjectControlMenuProps) {
    const [mode, setMode] = useState<'main' | 'rotate' | 'delete'>('main');

    useEffect(() => {
        if (isOpen) {
            setMode('main');
        }
    }, [isOpen, objectName]);

    if (!isOpen) return null;

    const handleClose = (e?: React.MouseEvent) => {
        e?.stopPropagation();
        setMode('main');
        onClose();
    };

    // Animation classes
    const buttonBaseClass = "w-10 h-10 rounded-full shadow-lg transition-all duration-200 hover:scale-110 border-2 flex items-center justify-center";
    const labelClass = "absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-black/50 px-2 py-0.5 rounded backdrop-blur-sm whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity";

    const isFurniture = !!onRotateLeft;

    const renderMain = () => (
        <div className="relative flex items-center justify-center w-0 h-0">
            {/* Center Close Button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute left-0 top-0 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 hover:bg-black/60 text-white backdrop-blur-sm z-10 shadow-md border border-white/20"
                onClick={handleClose}
            >
                <X className="w-4 h-4" />
            </Button>

            {/* Top Button: Move (Furniture) or Chat (Agent) */}
            <div className="absolute" style={{ left: '0px', top: '-64px', transform: 'translate(-50%, -50%)' }}>
                {isFurniture ? (
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-blue-500 hover:bg-blue-400 border-blue-300 text-white")}
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onMove) onMove();
                                else handleClose(e);
                            }}
                        >
                            <Move className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>Move</span>
                    </div>
                ) : onChat ? (
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-blue-500 hover:bg-blue-400 border-blue-300 text-white")}
                            onClick={(e) => { e.stopPropagation(); onChat(); }}
                        >
                            <MessageSquare className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>Chat</span>
                    </div>
                ) : null}
            </div>

            {/* Right Button: Rotate (Furniture) or View Computer (Agent) */}
            <div className="absolute" style={{ left: '64px', top: '0px', transform: 'translate(-50%, -50%)' }}>
                {isFurniture ? (
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-green-500 hover:bg-green-400 border-green-300 text-white")}
                            onClick={(e) => { e.stopPropagation(); setMode('rotate'); }}
                        >
                            <RotateCw className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>Rotate</span>
                    </div>
                ) : onViewComputer ? (
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-green-500 hover:bg-green-400 border-green-300 text-white")}
                            onClick={(e) => { e.stopPropagation(); onViewComputer(); }}
                        >
                            <Monitor className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>View PC</span>
                    </div>
                ) : null}
            </div>

            {/* Bottom Button: Delete (Furniture) or Manage (Agent) */}
            <div className="absolute" style={{ left: '0px', top: '64px', transform: 'translate(-50%, -50%)' }}>
                {isFurniture && onDelete ? (
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-red-500 hover:bg-red-400 border-red-300 text-white")}
                            onClick={(e) => { e.stopPropagation(); setMode('delete'); }}
                        >
                            <Trash2 className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>Delete</span>
                    </div>
                ) : onManage ? (
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-amber-500 hover:bg-amber-400 border-amber-300 text-white")}
                            onClick={(e) => { e.stopPropagation(); onManage(); }}
                        >
                            <UserCog className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>Manage</span>
                    </div>
                ) : null}
            </div>

            {/* Settings - Left (if enabled) */}
            {onSettings && (
                <div className="absolute" style={{ left: '-64px', top: '0px', transform: 'translate(-50%, -50%)' }}>
                    <div className="relative group">
                        <Button
                            variant="secondary"
                            size="icon"
                            className={cn(buttonBaseClass, "bg-gray-500 hover:bg-gray-400 border-gray-300 text-white")}
                            onClick={(e) => { e.stopPropagation(); onSettings(); }}
                        >
                            <Settings className="w-5 h-5" />
                        </Button>
                        <span className={labelClass}>Settings</span>
                    </div>
                </div>
            )}
        </div>
    );

    const renderRotate = () => (
        <div className="flex flex-col items-center gap-2 bg-black/80 backdrop-blur-md p-3 rounded-xl border border-white/20 shadow-2xl min-w-[200px]">
            <div className="flex justify-between w-full items-center border-b border-white/10 pb-2 mb-1">
                <span className="text-xs font-bold text-white uppercase tracking-wider">Rotate</span>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-white/70 hover:text-white" onClick={() => setMode('main')}>
                    <X className="h-3 w-3" />
                </Button>
            </div>

            <div className="flex gap-3 w-full">
                {onRotateLeft && (
                    <Button
                        variant="outline"
                        className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                        onClick={onRotateLeft}
                    >
                        <RotateCcw className="h-4 w-4 mr-1" />
                    </Button>
                )}
                {onRotateRight && (
                    <Button
                        variant="outline"
                        className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
                        onClick={onRotateRight}
                    >
                        <RotateCw className="h-4 w-4 mr-1" />
                    </Button>
                )}
            </div>

            <div className="text-[10px] text-white/60">
                Angle: <span className="text-green-400 font-mono">{Math.round(currentRotation)}°</span>
            </div>
        </div>
    );

    const renderDelete = () => (
        <div className="flex flex-col items-center gap-2 bg-black/80 backdrop-blur-md p-3 rounded-xl border border-red-500/30 shadow-2xl min-w-[200px]">
            <div className="text-center space-y-1 pb-2 border-b border-white/10 w-full">
                <div className="text-xs font-bold text-red-400 uppercase tracking-wider">Delete Object?</div>
                <div className="text-[10px] text-white/70">Cannot be undone</div>
            </div>

            <div className="flex gap-2 w-full pt-1">
                <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white h-8 text-xs"
                    onClick={() => setMode('main')}
                >
                    Cancel
                </Button>
                {onDelete && (
                    <Button
                        variant="destructive"
                        size="sm"
                        className="flex-1 bg-red-600 hover:bg-red-500 h-8 text-xs"
                        onClick={onDelete}
                    >
                        Confirm
                    </Button>
                )}
            </div>
        </div>
    );

    return (
        <Html position={[0, 1.0, 0]} center zIndexRange={[1000, 0]} style={{ pointerEvents: 'none' }}>
            <div className="pointer-events-auto relative flex justify-center items-center">
                {mode === 'main' && renderMain()}
                {mode === 'rotate' && renderRotate()}
                {mode === 'delete' && renderDelete()}
            </div>
        </Html>
    );
}
