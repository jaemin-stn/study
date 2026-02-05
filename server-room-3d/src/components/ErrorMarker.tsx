import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import type { Rack, ErrorLevel } from "../types";
import * as THREE from "three";
import { Html, Billboard } from "@react-three/drei";

const U_HEIGHT = 0.0445;

interface ErrorMarkerProps {
  rack: Rack;
}

const ERROR_COLORS: Record<ErrorLevel, string> = {
  critical: "#ff0000",
  major: "#ff8800",
  minor: "#ffff00",
  warning: "#0088ff",
};

const ERROR_PRIORITY: Record<ErrorLevel, number> = {
  critical: 4,
  major: 3,
  minor: 2,
  warning: 1,
};

export const ErrorMarker = ({ rack }: ErrorMarkerProps) => {
  const selectRack = useStore((state) => state.selectRack);
  const markerRef = useRef<THREE.Group>(null);

  // Calculate highest error
  const highestError = useMemo(() => {
    let maxPriority = 0;
    let pError: ErrorLevel | null = null;

    rack.devices.forEach((d) => {
      d.portStates.forEach((p) => {
        if (p.status === "error" && p.errorLevel) {
          const priority = ERROR_PRIORITY[p.errorLevel] || 0;
          if (priority > maxPriority) {
            maxPriority = priority;
            pError = p.errorLevel;
          }
        }
      });
    });

    return pError;
  }, [rack.devices]);

  // Animation
  useFrame(({ clock }) => {
    if (markerRef.current) {
      // Bounce
      markerRef.current.position.y =
        Math.sin(clock.getElapsedTime() * 3) * 0.15;
    }
  });

  if (!highestError) return null;

  const rackHeight = rack.uHeight * U_HEIGHT;
  // Position relatively: X=0, Z=0, Y=rackHeight + offset
  const position: [number, number, number] = [0, rackHeight + 0.8, 0];

  const color = ERROR_COLORS[highestError];

  return (
    <group position={position}>
      <Billboard follow={true}>
        <group
          ref={markerRef}
          onClick={(e) => {
            e.stopPropagation();
            selectRack(rack.id);
          }}
        >
          {/* Cone pointing down */}
          <mesh
            position={[0, 0, 0]}
            rotation={[Math.PI, 0, 0]}
            renderOrder={1000}
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
          <Html position={[0, 0.5, 0]} center transform={false}>
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
                cursor: "pointer",
                pointerEvents: "auto",
              }}
              onClick={(e) => {
                e.stopPropagation();
                selectRack(rack.id);
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
