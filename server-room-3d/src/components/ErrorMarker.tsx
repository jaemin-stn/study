import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import type { Rack } from "../types";
import {
  ERROR_COLORS,
  ERROR_PRIORITY,
  getHighestError,
} from "../utils/errorHelpers";
import type { ErrorLevel } from "../types";
import * as THREE from "three";
import { Html, Billboard } from "@react-three/drei";
import { U_HEIGHT, ERROR_MARKER_HEIGHT } from "./constants";

interface ErrorMarkerProps {
  rack: Rack;
}

export const ErrorMarker = ({ rack }: ErrorMarkerProps) => {
  const selectRack = useStore((state) => state.selectRack);
  const focusRack = useStore((state) => state.focusRack);
  const markerRef = useRef<THREE.Group>(null);

  // Find the highest-severity error across all devices in this rack
  const highestError = useMemo<ErrorLevel | null>(() => {
    let bestLevel: ErrorLevel | null = null;
    let bestPriority = 0;

    for (const d of rack.devices) {
      const err = getHighestError(d.portStates);
      if (err && ERROR_PRIORITY[err.level] > bestPriority) {
        bestPriority = ERROR_PRIORITY[err.level];
        bestLevel = err.level;
      }
    }

    return bestLevel;
  }, [rack.devices]);

  // Animation
  useFrame(({ clock }) => {
    if (markerRef.current) {
      // Bounce
      markerRef.current.position.y =
        Math.sin(clock.getElapsedTime() * 3) * 0.15;
    }
  });

  const isDraggingRack = useStore((state) => state.isDragging);
  const draggingModelId = useStore((state) => state.draggingModelId);
  const isDragging = isDraggingRack || draggingModelId !== null;

  if (!highestError) return null;

  // Calculate position relative to rack center
  const actualRackHeight = rack.uHeight * U_HEIGHT + 0.1;
  const position: [number, number, number] = [
    0,
    ERROR_MARKER_HEIGHT - actualRackHeight / 2,
    0,
  ];

  const color = ERROR_COLORS[highestError];

  return (
    <group position={position}>
      <Billboard follow={true}>
        <group
          ref={markerRef}
          onClick={(e) => {
            if (isDragging) return;
            e.stopPropagation();
            selectRack(rack.id);
            focusRack(rack.id);
          }}
        >
          {/* Cone pointing down */}
          <mesh
            position={[0, 0, 0]}
            rotation={[Math.PI, 0, 0]}
            renderOrder={1000}
            raycast={isDragging ? () => null : undefined}
          >
            <coneGeometry args={[0.2, 0.4, 32]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={1}
              depthTest={false}
              transparent={true}
              opacity={0.9}
            />
          </mesh>

          {/* Error Label UI */}
          <Html
            position={[0, 0.5, 0]}
            center
            transform={false}
            style={{
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                background: "rgba(0, 0, 0, 0.85)",
                color: color,
                padding: "4px 10px",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 800,
                border: `2px solid ${color}`,
                whiteSpace: "nowrap",
                boxShadow: `0 0 15px ${color}88`,
                cursor: isDragging ? "default" : "pointer",
                pointerEvents: isDragging ? "none" : "auto",
                userSelect: "none",
              }}
              onClick={(e) => {
                if (isDragging) return;
                e.stopPropagation();
                selectRack(rack.id);
                focusRack(rack.id);
              }}
            >
              {(highestError as string).toUpperCase()}
            </div>
          </Html>
        </group>
      </Billboard>
    </group>
  );
};
