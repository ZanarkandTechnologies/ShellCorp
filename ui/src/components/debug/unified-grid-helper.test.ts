import { describe, expect, it } from 'vitest';

import type { OfficeLayoutBounds } from '@/lib/office-layout';

import { getBuilderGridLinePositions } from './builder-grid';

describe('unified builder grid geometry', () => {
  it('matches rectangular layout bounds instead of forcing a square helper', () => {
    const bounds: OfficeLayoutBounds = {
      minTileX: 0,
      maxTileX: 3,
      minTileZ: 0,
      maxTileZ: 1,
      minWorldX: -0.5,
      maxWorldX: 3.5,
      minWorldZ: -0.5,
      maxWorldZ: 1.5,
      centerX: 1.5,
      centerZ: 0.5,
      width: 4,
      depth: 2,
    };

    const positions = getBuilderGridLinePositions(bounds);

    const verticalLines = bounds.width + 1;
    const horizontalLines = bounds.depth + 1;
    expect(positions).toHaveLength((verticalLines + horizontalLines) * 2 * 3);
    expect(Array.from(positions.slice(0, 6))).toEqual([
      -0.5,
      expect.closeTo(0.01, 5),
      -0.5,
      -0.5,
      expect.closeTo(0.01, 5),
      1.5,
    ]);
    expect(Array.from(positions.slice(-6))).toEqual([
      -0.5,
      expect.closeTo(0.01, 5),
      1.5,
      3.5,
      expect.closeTo(0.01, 5),
      1.5,
    ]);
  });
});
