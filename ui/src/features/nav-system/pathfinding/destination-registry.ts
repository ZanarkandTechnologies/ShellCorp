import * as THREE from 'three';

// Minimum distance between employee destinations
const MIN_DESTINATION_DISTANCE = 1.0;

// Interface for destination reservation
interface DestinationReservation {
    id: string;             // Employee ID
    position: THREE.Vector3; // Target position 
    expiresAt: number;      // Timestamp when this reservation expires
}

// Global registry of reserved destinations
const activeDestinations: DestinationReservation[] = [];

// Clean up expired reservations (called automatically)
function cleanupExpiredReservations() {
    const now = Date.now();
    let i = 0;
    while (i < activeDestinations.length) {
        if (activeDestinations[i].expiresAt < now) {
            activeDestinations.splice(i, 1);
        } else {
            i++;
        }
    }
}

/**
 * Check if a destination is too close to any existing reservation
 */
function isDestinationOccupied(position: THREE.Vector3, employeeId: string): boolean {
    cleanupExpiredReservations();

    for (const reservation of activeDestinations) {
        // Skip reservations for this employee
        if (reservation.id === employeeId) continue;

        const distance = position.distanceTo(reservation.position);
        if (distance < MIN_DESTINATION_DISTANCE) {
            return true;
        }
    }

    return false;
}

/**
 * Find an available destination spot near the requested position
 * @param requestedDestination The original desired destination
 * @param employeeId Employee making the request
 * @param maxAttempts Max number of alternative positions to try
 * @returns Either the original destination (if available) or an adjusted position
 */
export function findAvailableDestination(
    requestedDestination: THREE.Vector3,
    employeeId: string,
    maxAttempts = 8
): THREE.Vector3 {
    // Check if the requested destination is already available
    if (!isDestinationOccupied(requestedDestination, employeeId)) {
        // Reserve this destination
        reserveDestination(requestedDestination, employeeId);
        return requestedDestination;
    }

    // Try to find an alternative position in a spiral pattern around the requested destination
    const originalY = requestedDestination.y; // Preserve Y coordinate

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        // Increase radius with each attempt
        const radius = MIN_DESTINATION_DISTANCE * (1 + (attempt * 0.5));

        // Try positions in cardinal directions
        const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5, Math.PI / 4, Math.PI * 3 / 4, Math.PI * 5 / 4, Math.PI * 7 / 4];

        for (const angle of angles) {
            const offsetX = Math.cos(angle) * radius;
            const offsetZ = Math.sin(angle) * radius;

            const alternativePosition = new THREE.Vector3(
                requestedDestination.x + offsetX,
                originalY,
                requestedDestination.z + offsetZ
            );

            if (!isDestinationOccupied(alternativePosition, employeeId)) {
                // Found available spot, reserve it
                reserveDestination(alternativePosition, employeeId);
                return alternativePosition;
            }
        }
    }

    // If we exhaust all alternatives, return original but with a warning
    console.warn(`Employee ${employeeId} couldn't find alternative destination, using original.`);
    reserveDestination(requestedDestination, employeeId);
    return requestedDestination;
}

/**
 * Reserve a destination for an employee
 * @param position The position to reserve
 * @param employeeId The employee reserving the position
 * @param durationMs How long to reserve this destination (15s default)
 */
export function reserveDestination(
    position: THREE.Vector3,
    employeeId: string,
    durationMs = 15000
): void {
    cleanupExpiredReservations();

    // Remove any existing reservations for this employee
    releaseEmployeeReservations(employeeId);

    // Add new reservation
    activeDestinations.push({
        id: employeeId,
        position: position.clone(), // Clone to avoid reference issues
        expiresAt: Date.now() + durationMs
    });
}

/**
 * Release all reservations for a specific employee
 */
export function releaseEmployeeReservations(employeeId: string): void {
    let i = 0;
    while (i < activeDestinations.length) {
        if (activeDestinations[i].id === employeeId) {
            activeDestinations.splice(i, 1);
        } else {
            i++;
        }
    }
}

/**
 * Get all current active destinations (for debugging)
 */
export function getActiveDestinations(): DestinationReservation[] {
    cleanupExpiredReservations();
    return [...activeDestinations];
} 