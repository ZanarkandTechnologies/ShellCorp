"use client";

/**
 * WALL ART
 * ========
 * Lightweight fixed-slot painting renderer for office decor.
 *
 * KEY CONCEPTS:
 * - Wall art is cosmetic and anchors from `metadata.wallSlotId` instead of freeform dragging.
 * - Render stays lightweight by using generated canvas textures instead of uploaded assets.
 *
 * USAGE:
 * - Render from `OfficeObjectRenderer` for `wall-art` objects.
 *
 * MEMORY REFERENCES:
 * - MEM-0169
 */

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import {
  getPaintingPreset,
  getWallArtSlots,
  type OfficePaintingPresetId,
  type WallArtSlotId,
} from "@/lib/office-decor";
import type { OfficeFootprint } from "@/lib/office-footprint";

function buildPaintingTexture(presetId: OfficePaintingPresetId): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const preset = getPaintingPreset(presetId);
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 384;
  const context = canvas.getContext("2d");
  if (!context) return null;

  const [base, accent, contrast] = preset.colors;
  context.fillStyle = base;
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (presetId === "sunrise_blocks") {
    context.fillStyle = accent;
    context.fillRect(32, 64, 180, 160);
    context.fillRect(250, 42, 210, 120);
    context.fillStyle = contrast;
    context.fillRect(120, 210, 290, 110);
    context.beginPath();
    context.arc(376, 110, 54, 0, Math.PI * 2);
    context.fillStyle = "#fff2c6";
    context.fill();
  } else if (presetId === "night_geometry") {
    context.fillStyle = accent;
    context.beginPath();
    context.moveTo(32, 332);
    context.lineTo(180, 48);
    context.lineTo(282, 332);
    context.closePath();
    context.fill();
    context.fillStyle = contrast;
    context.fillRect(304, 58, 140, 248);
    context.fillStyle = "#11161e";
    context.fillRect(344, 90, 58, 184);
  } else {
    context.strokeStyle = contrast;
    context.lineWidth = 12;
    context.beginPath();
    context.moveTo(48, 86);
    context.lineTo(450, 86);
    context.moveTo(82, 150);
    context.lineTo(404, 314);
    context.moveTo(120, 48);
    context.lineTo(248, 332);
    context.stroke();
    context.fillStyle = accent;
    context.fillRect(68, 220, 104, 66);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export default function WallArt(props: {
  metadata?: Record<string, unknown>;
  officeFootprint: OfficeFootprint;
  fallbackPosition: [number, number, number];
  fallbackRotation?: [number, number, number];
}): JSX.Element {
  const { metadata, officeFootprint, fallbackPosition, fallbackRotation } = props;
  const slotId =
    metadata && typeof metadata.wallSlotId === "string"
      ? (metadata.wallSlotId as WallArtSlotId)
      : "back-center";
  const presetId =
    metadata && typeof metadata.paintingPresetId === "string"
      ? (metadata.paintingPresetId as OfficePaintingPresetId)
      : "sunrise_blocks";
  const slot = getWallArtSlots(officeFootprint).find((entry) => entry.id === slotId);
  const preset = getPaintingPreset(presetId);
  const texture = useMemo(() => buildPaintingTexture(preset.id), [preset.id]);

  useEffect(
    () => () => {
      texture?.dispose();
    },
    [texture],
  );

  const position = slot?.position ?? fallbackPosition;
  const rotation = slot?.rotation ?? fallbackRotation ?? [0, 0, 0];
  const [width, height] = slot?.size ?? [2.6, 1.8];

  return (
    <group position={position} rotation={rotation}>
      <mesh position={[0, 0, -0.03]} castShadow>
        <boxGeometry args={[width + 0.22, height + 0.22, 0.08]} />
        <meshStandardMaterial color={preset.frameColor} roughness={0.8} />
      </mesh>
      <mesh castShadow receiveShadow>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture ?? undefined} color="#ffffff" roughness={0.9} />
      </mesh>
    </group>
  );
}
