"use client";

/**
 * USE EMPLOYEE LOCOMOTION
 * =======================
 * Encapsulates employee pathing, idle wandering, and debug path visualization.
 *
 * KEY CONCEPTS:
 * - Keep locomotion state local to each employee instance
 * - Heartbeat state can override raw busy status for desk-routing decisions
 * - Debug overlays are throttled to avoid per-frame React churn
 *
 * MEMORY REFERENCES:
 * - MEM-0144
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import type { Group } from "three";
import * as THREE from "three";

import { IDLE_DESTINATIONS, TOTAL_HEIGHT } from "@/constants";
import type { Id } from "@/lib/entity-types";
import type { AgentState } from "@/lib/openclaw-types";
import { getRandomItem } from "@/lib/utils";
import { findPathAStar } from "@/features/nav-system/pathfinding/a-star-pathfinding";
import {
  findAvailableDestination,
  releaseEmployeeReservations,
} from "@/features/nav-system/pathfinding/destination-registry";

type DebugPathData = {
  originalPath: THREE.Vector3[] | null;
  remainingPath: THREE.Vector3[] | null;
};

type UseEmployeeLocomotionOptions = {
  id: Id<"employees">;
  position: [number, number, number];
  isBusy?: boolean;
  isCEO?: boolean;
  wantsToWander: boolean;
  heartbeatState?: AgentState;
  debugMode: boolean;
};

type UseEmployeeLocomotionResult = {
  groupRef: React.RefObject<Group | null>;
  debugPathData: DebugPathData;
  debugDeskDecision: string;
  isGoingToDesk: boolean;
};

export function useEmployeeLocomotion({
  id,
  position,
  isBusy,
  isCEO,
  wantsToWander,
  heartbeatState,
  debugMode,
}: UseEmployeeLocomotionOptions): UseEmployeeLocomotionResult {
  const groupRef = useRef<Group>(null);
  const initialPositionRef = useRef<THREE.Vector3>(
    new THREE.Vector3(position[0], TOTAL_HEIGHT / 2, position[2]),
  );

  const [path, setPath] = useState<THREE.Vector3[] | null>(null);
  const [pathIndex, setPathIndex] = useState(0);
  const [currentDestination, setCurrentDestination] = useState<THREE.Vector3 | null>(null);
  const [idleState, setIdleState] = useState<"wandering" | "waiting">("wandering");
  const [isGoingToDesk, setIsGoingToDesk] = useState(false);
  const [debugPathData, setDebugPathData] = useState<DebugPathData>({
    originalPath: null,
    remainingPath: null,
  });
  const [debugDeskDecision, setDebugDeskDecision] = useState("");

  const idleTimerRef = useRef(0);
  const debugPathUpdateRef = useRef(0);

  const movementSpeed = 1.5;
  const arrivalThreshold = 0.1;

  useEffect(() => {
    return () => {
      releaseEmployeeReservations(id);
    };
  }, [id]);

  useEffect(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(initialPositionRef.current);
    }
  }, []);

  const chooseNewIdleDestination = useCallback(() => {
    const currentPos = groupRef.current?.position;
    if (!currentPos) return null;

    let newDest: THREE.Vector3;
    do {
      newDest = getRandomItem(IDLE_DESTINATIONS).clone();
      newDest.y = TOTAL_HEIGHT / 2;
    } while (newDest.distanceTo(currentPos) < 1 && IDLE_DESTINATIONS.length > 1);

    return findAvailableDestination(newDest, id);
  }, [id]);

  const getRandomWaitTime = useCallback(() => Math.random() * 4 + 4, []);

  const findAndSetPath = useCallback(
    (startPos: THREE.Vector3, endPos: THREE.Vector3, goingToDesk = false) => {
      const finalDestination = goingToDesk ? endPos : findAvailableDestination(endPos, id);
      const newPath = findPathAStar(startPos, finalDestination);

      if (newPath) {
        if (goingToDesk && newPath.length > 0) {
          const lastPoint = newPath[newPath.length - 1];
          if (lastPoint.distanceTo(endPos) > 0.1) {
            newPath.push(endPos.clone());
          }
        }

        setPath(newPath);
        setPathIndex(0);
      }

      return newPath;
    },
    [id],
  );

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    const currentPos = groupRef.current.position;
    const desiredY = TOTAL_HEIGHT / 2;
    currentPos.y = desiredY;

    let targetPathNode: THREE.Vector3 | null = null;
    let isMoving = false;

    const hasHeartbeatState = typeof heartbeatState === "string";
    const heartbeatRequiresDesk =
      heartbeatState === "running" ||
      heartbeatState === "planning" ||
      heartbeatState === "executing" ||
      heartbeatState === "blocked" ||
      heartbeatState === "error";
    const shouldBeAtDesk =
      Boolean(isCEO) ||
      !wantsToWander ||
      (hasHeartbeatState ? heartbeatRequiresDesk : Boolean(isBusy));

    if (debugMode) {
      const nextDecision = `${heartbeatState ?? "none"} -> ${
        shouldBeAtDesk ? "desk" : "wander"
      }`;
      setDebugDeskDecision((prev) => (prev === nextDecision ? prev : nextDecision));
    }

    if (
      shouldBeAtDesk &&
      !path &&
      !isGoingToDesk &&
      currentDestination === null &&
      currentPos.distanceTo(initialPositionRef.current) <= arrivalThreshold
    ) {
      return;
    }

    if (shouldBeAtDesk) {
      if (idleState !== "wandering") {
        setIdleState("wandering");
      }
      idleTimerRef.current = 0;

      const deskPosition = initialPositionRef.current;
      const distanceToDesk = currentPos.distanceTo(deskPosition);

      if (distanceToDesk > arrivalThreshold) {
        const needsNewPath = !path || !isGoingToDesk;
        if (needsNewPath) {
          if (!isGoingToDesk) {
            setIsGoingToDesk(true);
          }
          findAndSetPath(currentPos.clone(), deskPosition.clone(), true);
          setCurrentDestination(deskPosition);
        }

        if (path && pathIndex < path.length) {
          targetPathNode = path[pathIndex];
          isMoving = true;
        }
      } else {
        if (path) {
          setPath(null);
          releaseEmployeeReservations(id);
        }
        if (isGoingToDesk) {
          setIsGoingToDesk(false);
        }
        if (currentDestination !== null) {
          setCurrentDestination(null);
        }
        if (currentPos.distanceTo(deskPosition) > 0.01) {
          currentPos.lerp(deskPosition, 0.1);
        }
      }
    } else if (idleState === "wandering") {
      if (!path) {
        const newDest = chooseNewIdleDestination();
        if (newDest) {
          if (isGoingToDesk) {
            setIsGoingToDesk(false);
          }
          const newPath = findAndSetPath(currentPos, newDest);
          setCurrentDestination(newDest);
          if (!newPath) {
            console.warn(`Employee ${id} could not find path to new destination.`);
          }
        }
      } else if (pathIndex < path.length) {
        targetPathNode = path[pathIndex];
        isMoving = true;
      } else {
        setPath(null);
        setCurrentDestination(null);
        setIdleState("waiting");
        idleTimerRef.current = getRandomWaitTime();
      }
    } else if (idleState === "waiting") {
      idleTimerRef.current = Math.max(0, idleTimerRef.current - delta);
      if (idleTimerRef.current <= 0) {
        releaseEmployeeReservations(id);
        setIdleState("wandering");
      }
    }

    if (isMoving && targetPathNode) {
      targetPathNode = targetPathNode.clone();
      targetPathNode.y = desiredY;

      const direction = new THREE.Vector3().subVectors(targetPathNode, currentPos);
      const distance = direction.length();

      if (distance < arrivalThreshold) {
        setPathIndex((prev) => prev + 1);
      } else {
        direction.normalize();
        const moveDistance = movementSpeed * delta;
        groupRef.current.position.add(direction.multiplyScalar(Math.min(moveDistance, distance)));
      }
    }

    if (debugMode && path && path.length > 0) {
      const now = performance.now();
      if (now - debugPathUpdateRef.current > 500) {
        debugPathUpdateRef.current = now;

        const currentPosClone = groupRef.current.position.clone();
        const newRemainPath =
          path.length > pathIndex ? [currentPosClone, ...path.slice(pathIndex)] : null;

        if (newRemainPath && newRemainPath.length > 1) {
          setDebugPathData((prev) => {
            if (prev.remainingPath?.length === newRemainPath.length) {
              return prev;
            }
            return { originalPath: null, remainingPath: newRemainPath };
          });
        }
      }
    }
  });

  useEffect(() => {
    if (!debugMode) {
      setDebugPathData({ originalPath: null, remainingPath: null });
    }
  }, [debugMode]);

  return { groupRef, debugPathData, debugDeskDecision, isGoingToDesk };
}
