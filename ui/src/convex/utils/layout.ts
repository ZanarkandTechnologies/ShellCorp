const RADIUS_BASE = 1.8;

export function getDeskPosition(
  clusterPosition: [number, number, number],
  deskIndex: number,
  totalDesks: number,
): [number, number, number] {
  const safeTotal = Math.max(1, totalDesks);
  const angle = (Math.PI * 2 * deskIndex) / safeTotal;
  const radius = RADIUS_BASE + Math.floor(deskIndex / safeTotal) * 0.8;
  return [
    clusterPosition[0] + Math.cos(angle) * radius,
    clusterPosition[1],
    clusterPosition[2] + Math.sin(angle) * radius,
  ];
}

export function getDeskRotation(deskIndex: number, totalDesks: number): number {
  const safeTotal = Math.max(1, totalDesks);
  return (Math.PI * 2 * deskIndex) / safeTotal + Math.PI / 2;
}

export function getAbsoluteDeskPosition(
  clusterPosition: [number, number, number],
  deskIndex: number,
  totalDesks: number,
): [number, number, number] {
  return getDeskPosition(clusterPosition, deskIndex, totalDesks);
}

export function getEmployeePositionAtDesk(
  deskPosition: [number, number, number],
  deskRotation: number,
): [number, number, number] {
  const offset = 0.6;
  return [
    deskPosition[0] - Math.cos(deskRotation) * offset,
    deskPosition[1],
    deskPosition[2] - Math.sin(deskRotation) * offset,
  ];
}
