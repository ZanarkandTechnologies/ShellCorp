import * as THREE from 'three';
import { getGridData } from '@/features/nav-system/pathfinding/a-star-pathfinding';

/**
 * DRAGGABLE CONTROLLER
 * ====================
 * 
 * Handles all drag-and-drop logic for 3D objects in the office scene.
 * This class encapsulates the dragging state and calculations, making it:
 * - Testable (can unit test without React)
 * - Reusable (not tied to React Three Fiber)
 * - Clear separation of concerns (logic vs rendering)
 * 
 * @example
 * ```typescript
 * const controller = new DraggableController(
 *   object3D,
 *   camera,
 *   canvas,
 *   (newPos) => saveToDatabase(newPos)
 * );
 * 
 * // Start drag on button press
 * controller.startDrag(mouseEvent);
 * 
 * // Controller automatically handles mousemove and mouseup
 * ```
 */
export class DraggableController {
    private isDragging: boolean = false;
    private dragOffset: THREE.Vector3 = new THREE.Vector3();
    private raycaster: THREE.Raycaster = new THREE.Raycaster();
    private plane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    private planeIntersect: THREE.Vector3 = new THREE.Vector3();
    
    // Event listeners for cleanup
    private mouseMoveListener: ((e: MouseEvent) => void) | null = null;
    private mouseUpListener: ((e: MouseEvent) => void) | null = null;

    constructor(
        private object3D: THREE.Group,
        private camera: THREE.Camera,
        private canvas: HTMLCanvasElement,
        private onDragEnd: (newPosition: THREE.Vector3) => void,
        private onDragStateChange?: (isDragging: boolean) => void
    ) {}

    /**
     * Start dragging the object
     * @param mouseEvent - The mouse event that initiated the drag
     */
    startDrag(mouseEvent: MouseEvent): void {
        if (this.isDragging) return;

        const mousePos = this.getMousePosition(mouseEvent);
        
        // Calculate plane intersection for drag offset
        this.raycaster.setFromCamera(mousePos, this.camera);
        this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect);

        // Calculate drag offset so object doesn't jump
        this.dragOffset.subVectors(this.object3D.position, this.planeIntersect);

        this.isDragging = true;
        this.onDragStateChange?.(true);
        this.canvas.style.cursor = 'grabbing';

        // Attach global event listeners
        this.mouseMoveListener = (e: MouseEvent) => this.updateDrag(e);
        this.mouseUpListener = () => this.endDrag();

        window.addEventListener('mousemove', this.mouseMoveListener);
        window.addEventListener('mouseup', this.mouseUpListener);
    }

    /**
     * Update the object position during drag
     */
    private updateDrag(mouseEvent: MouseEvent): void {
        if (!this.isDragging) return;

        const mousePos = this.getMousePosition(mouseEvent);
        
        // Calculate new position
        this.raycaster.setFromCamera(mousePos, this.camera);
        this.raycaster.ray.intersectPlane(this.plane, this.planeIntersect);

        const newPosition = new THREE.Vector3().addVectors(
            this.planeIntersect,
            this.dragOffset
        );

        // Snap to grid
        const snappedPosition = this.snapToGrid(newPosition);
        this.object3D.position.copy(snappedPosition);
    }

    /**
     * End the drag operation
     */
    private endDrag(): void {
        if (!this.isDragging) return;

        this.isDragging = false;
        this.onDragStateChange?.(false);
        this.canvas.style.cursor = 'default';

        // Clean up event listeners
        if (this.mouseMoveListener) {
            window.removeEventListener('mousemove', this.mouseMoveListener);
            this.mouseMoveListener = null;
        }
        if (this.mouseUpListener) {
            window.removeEventListener('mouseup', this.mouseUpListener);
            this.mouseUpListener = null;
        }

        // Notify parent of final position
        this.onDragEnd(this.object3D.position.clone());
    }

    /**
     * Convert mouse event to normalized device coordinates
     */
    private getMousePosition(event: MouseEvent): THREE.Vector2 {
        const rect = this.canvas.getBoundingClientRect();
        return new THREE.Vector2(
            ((event.clientX - rect.left) / rect.width) * 2 - 1,
            -((event.clientY - rect.top) / rect.height) * 2 + 1
        );
    }

    /**
     * Snap position to pathfinding grid
     */
    private snapToGrid(position: THREE.Vector3): THREE.Vector3 {
        const { cellSize, worldOffsetX, worldOffsetZ } = getGridData();

        if (cellSize === 0) {
            return position.clone();
        }

        const gridX = Math.round((position.x + worldOffsetX) / cellSize);
        const gridZ = Math.round((position.z + worldOffsetZ) / cellSize);

        const snappedX = gridX * cellSize - worldOffsetX;
        const snappedZ = gridZ * cellSize - worldOffsetZ;

        return new THREE.Vector3(snappedX, position.y, snappedZ);
    }

    /**
     * Check if currently dragging
     */
    get isActive(): boolean {
        return this.isDragging;
    }

    /**
     * Clean up resources when controller is no longer needed
     */
    destroy(): void {
        if (this.isDragging) {
            this.endDrag();
        }
    }
}


