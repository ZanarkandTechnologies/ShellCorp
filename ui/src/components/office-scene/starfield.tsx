/**
 * Starfield background: dense, soft stars in a sphere for a natural space/galaxy feel.
 * Small pinpricks, muted colors, no harsh glare.
 */
import { useMemo } from 'react';
import * as THREE from 'three';

const STAR_COUNT = 12000;
const SPHERE_RADIUS = 100;
const STAR_SIZE_BASE = 0.35;

/** Soft off-whites and pale tints (real stars aren't pure white). */
const STAR_COLORS = [0xb8bcc8, 0xa0a8b8, 0x9098a8, 0xc0c4d0, 0x8890a0, 0xa8b0c0];

export function Starfield(): JSX.Element {
    const { positions, colors } = useMemo(() => {
        const pos = new Float32Array(STAR_COUNT * 3);
        const col = new Float32Array(STAR_COUNT * 3);
        const r = SPHERE_RADIUS;

        for (let i = 0; i < STAR_COUNT; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
            pos[i * 3 + 2] = r * Math.cos(phi);

            const hex = STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)];
            col[i * 3] = ((hex >> 16) & 0xff) / 255;
            col[i * 3 + 1] = ((hex >> 8) & 0xff) / 255;
            col[i * 3 + 2] = (hex & 0xff) / 255;
        }

        return { positions: pos, colors: col };
    }, []);

    return (
        <points renderOrder={-1}>
            <bufferGeometry>
                <bufferAttribute
                    attach="attributes-position"
                    count={STAR_COUNT}
                    array={positions}
                    itemSize={3}
                />
                <bufferAttribute
                    attach="attributes-color"
                    count={STAR_COUNT}
                    array={colors}
                    itemSize={3}
                />
            </bufferGeometry>
            <pointsMaterial
                size={STAR_SIZE_BASE}
                vertexColors
                transparent
                opacity={0.42}
                sizeAttenuation
                depthWrite={false}
                blending={THREE.NormalBlending}
            />
        </points>
    );
}
