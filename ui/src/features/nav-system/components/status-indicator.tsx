import { useMemo, useRef, useState, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html, Text } from "@react-three/drei";
import { OrthographicCamera, type Group } from "three";

export type StatusType = "info" | "success" | "question" | "warning" | "none";

interface StatusIndicatorProps {
  status: StatusType;
  message?: string;
  visible: boolean;
  /** Number of notifications (displays badge if > 1) */
  notificationCount?: number;
  mode?: "single" | "heartbeatBubbles";
  bubbles?: Array<{ label: string; weight?: number }>;
  compactOnly?: boolean;
}

// Simple iconic status indicators made from basic shapes
const StatusIcons = {
  // Info icon: vertical bar with dot on top
  info: ({ color }: { color: string }) => (
    <group>
      {/* Vertical bar */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.125, 8]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>

      {/* Dot on top */}
      <mesh position={[0, 0.1, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
    </group>
  ),

  // Success icon (checkmark)
  success: ({ color }: { color: string }) => (
    <group rotation={[Math.PI, 0, 0]}>
      {/* Shorter arm (the upward left part) */}
      <mesh position={[-0.05, 0, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.075, 0.04, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>

      {/* Longer arm (the downward right part) */}
      <mesh position={[0.05, -0.02, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.21, 0.04, 0.04]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
    </group>
  ),

  // Question mark: half circle + bar + dot
  question: ({ color }: { color: string }) => (
    <group>
      {/* Half circle at top */}
      <mesh position={[0, 0.075, 0]}>
        <torusGeometry args={[0.05, 0.025, 8, 16, 1.6 * Math.PI]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>

      {/* Short vertical bar */}
      <mesh position={[0.0, 0, 0]} rotation={[0, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.08, 8]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>

      {/* Dot at bottom */}
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
    </group>
  ),

  // Warning/exclamation: vertical bar with dot at bottom
  warning: ({ color }: { color: string }) => (
    <group>
      {/* Vertical bar */}
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 0.15, 8]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>

      {/* Dot at bottom */}
      <mesh position={[0, -0.08, 0]}>
        <sphereGeometry args={[0.03, 12, 12]} />
        <meshStandardMaterial color={color} roughness={0.2} />
      </mesh>
    </group>
  ),

  // Fallback/none (shouldn't be visible)
  none: () => <group />,
};

// Get color for status type
const getStatusColor = (status: StatusType): string => {
  switch (status) {
    case "info":
      return "#3498db"; // Blue
    case "success":
      return "#2ecc71"; // Green
    case "question":
      return "#f1c40f"; // Yellow
    case "warning":
      return "#e74c3c"; // Red
    default:
      return "#FFFFFF"; // White fallback
  }
};

function getCompactStatusLabel(params: {
  message?: string;
  bubbles: Array<{ label: string; weight?: number }>;
}): string | null {
  const { message, bubbles } = params;
  const baseLabel = message?.trim() || bubbles[0]?.label?.trim();
  if (!baseLabel) return null;
  return baseLabel.length > 16 ? `${baseLabel.slice(0, 15)}…` : baseLabel;
}

export default function StatusIndicator({
  status = "none",
  message,
  visible,
  notificationCount = 1,
  mode = "single",
  bubbles = [],
  compactOnly = false,
}: StatusIndicatorProps) {
  // ALL HOOKS MUST BE CALLED BEFORE ANY EARLY RETURNS
  const groupRef = useRef<Group>(null);
  const messageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [showMessage, setShowMessage] = useState(!!message);
  const [isHovered, setIsHovered] = useState(false);
  const camera = useThree((state) => state.camera);

  // Validate status type
  const validStatuses: StatusType[] = ["info", "success", "question", "warning", "none"];
  const safeStatus = validStatuses.includes(status) ? status : "none";

  // Time offset for different indicators to bob at different times
  const timeOffset = useMemo(() => Math.random() * Math.PI * 2, []);

  // Get color based on status
  const statusColor = useMemo(() => getStatusColor(safeStatus), [safeStatus]);
  const isOrthographicView = camera instanceof OrthographicCamera;
  const useCompactOverlayMode = compactOnly || isOrthographicView;
  const overlayScale = useCompactOverlayMode ? 0.22 : 1;
  const overlayDistanceFactor = useCompactOverlayMode ? 1 : 8;
  const overlayMaxWidth = useCompactOverlayMode ? 96 : 350;
  const heartbeatMaxWidth = useCompactOverlayMode ? 110 : 360;
  const overlayFontSize = useCompactOverlayMode ? "6px" : "11px";
  const overlayIconSize = useCompactOverlayMode ? 12 : 24;
  const badgeFontSize = useCompactOverlayMode ? "6px" : "10px";
  const badgeSize = useCompactOverlayMode ? "10px" : "18px";
  const shouldShowExpandedMessage = showMessage && Boolean(message) && !useCompactOverlayMode;
  const compactLabel = getCompactStatusLabel({ message, bubbles });

  // Whether to pulse (for warning/question)
  const shouldPulse = useMemo(
    () => safeStatus === "warning" || safeStatus === "question",
    [safeStatus],
  );

  // Function to start/restart the message timer
  const startMessageTimer = () => {
    if (messageTimerRef.current) {
      clearTimeout(messageTimerRef.current);
    }

    messageTimerRef.current = setTimeout(() => {
      setShowMessage(false);
    }, 60000); // 60 seconds
  };

  // Initialize: show message initially, then hide after 1 minute
  useEffect(() => {
    if (message) {
      setShowMessage(true);
      startMessageTimer();
    }

    // Cleanup timer on unmount
    return () => {
      if (messageTimerRef.current) {
        clearTimeout(messageTimerRef.current);
      }
    };
  }, [message]);

  // Handle hover events
  const handlePointerEnter = () => {
    setIsHovered(true);
    if (message) {
      setShowMessage(true);
      startMessageTimer();
    }
  };

  const handlePointerLeave = () => {
    setIsHovered(false);
  };

  // Animation frame
  useFrame((state) => {
    if (groupRef.current) {
      const timeElapsed = state.clock.elapsedTime;

      // Vertical bob
      const bobHeight = 0.05;
      const bobSpeed = 1.0;
      groupRef.current.position.y =
        0.65 + Math.sin(timeElapsed * bobSpeed + timeOffset) * bobHeight;

      // Gentle rotation when not showing message
      if (!showMessage) {
        groupRef.current.rotation.y = timeElapsed * 0.5;
      }

      // Pulsing effect for warning/question
      if (shouldPulse && !showMessage) {
        const pulse = 1.0 + Math.sin(timeElapsed * 2 + timeOffset) * 0.1;
        groupRef.current.scale.set(pulse, pulse, pulse);
      } else {
        groupRef.current.scale.set(1, 1, 1);
      }
    }
  });

  // NOW we can do early returns after all hooks are called
  if (!visible) return null;

  if (safeStatus === "none") return null;

  const IconComponent = StatusIcons[safeStatus];
  if (!IconComponent) return null;

  if (useCompactOverlayMode) {
    return (
      <group
        ref={groupRef}
        position={[0, 0.65, 0]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <IconComponent color={statusColor} />
        {compactLabel ? (
          <group position={[0, 0.22, 0]}>
            <mesh position={[0, 0, -0.002]}>
              <planeGeometry args={[0.72, 0.19]} />
              <meshBasicMaterial color="#111827" transparent opacity={0.9} />
            </mesh>
            <Text
              position={[0, 0, 0]}
              fontSize={0.07}
              maxWidth={0.62}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
            >
              {compactLabel}
            </Text>
          </group>
        ) : null}
      </group>
    );
  }

  if (mode === "heartbeatBubbles" && bubbles.length > 0) {
    return (
      <group
        ref={groupRef}
        position={[0, 0.75, 0]}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        <Html center distanceFactor={overlayDistanceFactor} zIndexRange={[2, 0]}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              alignItems: "center",
              pointerEvents: "none",
              transform: `scale(${overlayScale})`,
              transformOrigin: "center center",
            }}
          >
            {shouldShowExpandedMessage ? (
              <div
                style={{
                  background: "rgba(17, 24, 39, 0.94)",
                  color: "white",
                  borderRadius: "10px",
                  padding: "6px 10px",
                  maxWidth: `${heartbeatMaxWidth}px`,
                  fontSize: overlayFontSize,
                  fontWeight: 700,
                  lineHeight: 1.25,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  whiteSpace: "normal",
                  textAlign: "left",
                }}
              >
                {message}
              </div>
            ) : null}
            {!shouldShowExpandedMessage ? (
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    background: "rgba(17, 24, 39, 0.88)",
                    color: "white",
                    borderRadius: "999px",
                    padding: "3px 8px",
                    fontSize: badgeFontSize,
                    fontWeight: 700,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.35)",
                  }}
                >
                  {(bubbles[0]?.label || safeStatus.toUpperCase()).slice(
                    0,
                    isOrthographicView ? 12 : 999,
                  )}
                </span>
              </div>
            ) : null}
          </div>
        </Html>
      </group>
    );
  }

  return (
    <group
      ref={groupRef}
      position={[0, 0.65, 0]}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {shouldShowExpandedMessage ? (
        <Html
          position={[0, 0.15, 0]}
          center
          distanceFactor={overlayDistanceFactor}
          zIndexRange={[1, 0]}
        >
          <div
            style={{
              background: statusColor,
              padding: "8px 12px",
              borderRadius: "12px",
              maxWidth: `${overlayMaxWidth}px`,
              minWidth: isOrthographicView ? "82px" : "125px",
              fontSize: overlayFontSize,
              color: "white",
              fontWeight: "bold",
              boxShadow: "0 2px 5px rgba(0,0,0,0.3)",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transform: `scale(${overlayScale})`,
              transformOrigin: "center center",
            }}
          >
            <div
              style={{
                width: `${overlayIconSize}px`,
                height: `${overlayIconSize}px`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.2)",
                borderRadius: "50%",
                flexShrink: 0,
              }}
            >
              {safeStatus === "info" && "i"}
              {safeStatus === "success" && "✓"}
              {safeStatus === "question" && "?"}
              {safeStatus === "warning" && "!"}
            </div>
            <div
              style={{
                whiteSpace: "normal",
                wordBreak: "normal",
                textAlign: "center",
              }}
            >
              {message}
            </div>
          </div>
        </Html>
      ) : (
        <>
          <IconComponent color={statusColor} />
          {/* Notification count badge - only show if > 1 */}
          {notificationCount > 1 && (
            <Html
              position={[0.12, 0.08, 0]}
              center
              distanceFactor={overlayDistanceFactor}
              zIndexRange={[2, 0]}
              style={{
                pointerEvents: "none",
                transform: `scale(${overlayScale})`,
                transformOrigin: "center center",
              }}
            >
              <div
                style={{
                  background: "#e74c3c",
                  color: "white",
                  borderRadius: "50%",
                  minWidth: badgeSize,
                  height: badgeSize,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: badgeFontSize,
                  fontWeight: "bold",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.4)",
                  border: "2px solid white",
                  padding: "0 4px",
                }}
              >
                {notificationCount > 9 ? "9+" : notificationCount}
              </div>
            </Html>
          )}
        </>
      )}
    </group>
  );
}
