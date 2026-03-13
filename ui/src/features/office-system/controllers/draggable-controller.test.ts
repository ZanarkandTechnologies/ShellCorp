import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import { DraggableController } from "./draggable-controller";

describe("DraggableController", () => {
  it("uses the explicit constraint callback instead of raw nav-grid snapping", () => {
    const object3D = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 10, 10);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    const canvas = {
      style: { cursor: "default" },
      getBoundingClientRect: () => ({
        left: 0,
        top: 0,
        width: 200,
        height: 200,
      }),
    } as HTMLCanvasElement;
    const constrainPosition = vi.fn(() => new THREE.Vector3(9, 0, 7));

    const controller = new DraggableController(
      object3D,
      camera,
      canvas,
      vi.fn(),
      undefined,
      constrainPosition,
    );
    const harness = controller as unknown as {
      isDragging: boolean;
      getMousePosition: () => THREE.Vector2;
      updateDrag: (event: MouseEvent) => void;
    };

    harness.isDragging = true;
    harness.getMousePosition = () => new THREE.Vector2(0, 0);
    harness.updateDrag({} as MouseEvent);

    expect(constrainPosition).toHaveBeenCalledTimes(1);
    expect(object3D.position.toArray()).toEqual([9, 0, 7]);
  });
});
