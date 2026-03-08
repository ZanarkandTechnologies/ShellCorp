export const DEFAULT_INTERACTIVE_OBJECT_POSITION: [number, number, number] = [0, 0, 0];
export const DEFAULT_INTERACTIVE_OBJECT_ROTATION: [number, number, number] = [0, 0, 0];
export const DEFAULT_INTERACTIVE_OBJECT_SCALE: [number, number, number] = [1, 1, 1];

export function tuple3Equals(
    left: [number, number, number],
    right: [number, number, number],
): boolean {
    return left[0] === right[0] && left[1] === right[1] && left[2] === right[2];
}

export function syncTuple3(
    current: [number, number, number],
    next: [number, number, number],
): [number, number, number] {
    return tuple3Equals(current, next) ? current : next;
}
