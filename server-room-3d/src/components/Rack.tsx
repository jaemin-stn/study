import { useEffect, useMemo, useRef, forwardRef } from "react";
import { RoundedBox, useTexture, Billboard, Html } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { type ThreeEvent, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import type { AppState } from "../store/useStore";
import { useTheme } from "../contexts/ThemeContext";
import type { Rack as RackType, Device } from "../types";
import { ErrorMarker } from "./ErrorMarker";
import { U_HEIGHT, GRID_SPACING, DEVICE_DEPTH } from "./constants";
import { getHighestError } from "../utils/errorHelpers";

// Snapshot of selectedRackId captured inside handlePointerDown BEFORE selectRack()
// mutates it. Since the Interaction Layer is geometrically closer to the camera,
// handlePointerDown fires FIRST, then DeviceMesh's onClick fires and reads this.
let selectedRackIdBeforePointerDown: string | null = null;

interface RackProps extends RackType {
  draggingRackId: string | null;
  dragPosition: [number, number] | null;
}

export const Rack = ({
  id,
  uHeight,
  width: rackWidth,
  position,
  devices,
  draggingRackId,
  dragPosition,
}: RackProps) => {
  const selectedRackId = useStore((state: AppState) => state.selectedRackId);
  const hoveredRackId = useStore((state: AppState) => state.hoveredRackId);
  const focusedRackId = useStore((state: AppState) => state.focusedRackId);
  const { theme } = useTheme();

  const isSelected = selectedRackId === id;
  const isHovered = hoveredRackId === id;
  const isFocused = focusedRackId === id;
  const isInternalFocused = isSelected || isFocused;
  const isInternalDragging = draggingRackId === id;
  const isDarkMode = theme === "dark";
  const orientation = useStore(
    (state: AppState) =>
      state.racks.find((r: RackType) => r.id === id)?.orientation ?? 180,
  );

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new THREE.Vector3(), []);

  const height = uHeight * U_HEIGHT + 0.1;
  const width = rackWidth;
  const depth = 1.0;

  // Theme-based colors
  const frameColor = isSelected
    ? isDarkMode
      ? "#FFFFFF" // White highlight for dark mode
      : "#1a73e8"
    : isDarkMode
      ? "#2e313b" // Darker than background
      : "#333333";
  const railColor = isDarkMode ? "#aab0be" : "#888";
  const interiorColor = isDarkMode ? "#1a1c23" : "#050505";
  const glassEmissive = isDarkMode
    ? isSelected
      ? "#FFFFFF"
      : "#4d5261"
    : "#1a73e8";
  const rearPanelColor = isDarkMode ? "#24272e" : "#111";

  // Convert orientation to radians with proper mapping:
  // North (0°) should face -Z world (180° rotation)
  // East (90°) should face +X world (90° rotation)
  // South (180°) should face +Z world (0° rotation)
  // West (270°) should face -X world (270° rotation)
  // Formula: (180 - orientation)
  const rotationRad = ((180 - (orientation ?? 0)) * Math.PI) / 180;

  // Declarative animation - Purely reactive to props/state
  const currentTargetPos =
    isInternalDragging && dragPosition
      ? [dragPosition[0], height / 2 + 0.1, dragPosition[1]]
      : [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING];

  const { pos, rot, scale, doorRotation } = useSpring({
    pos: currentTargetPos,
    rot: [0, rotationRad, 0],
    scale: isInternalDragging ? 1.05 : 1,
    doorRotation: isInternalFocused ? -Math.PI / 2 : 0,
    config: { mass: 1, tension: 280, friction: 30 },
    immediate: isInternalDragging, // Use immediate only during active dragging
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const { selectRack, setDragging, updateDragPosition, isEditMode } =
      useStore.getState();

    // Snapshot BEFORE mutation — DeviceMesh onClick reads this for two-step gate
    selectedRackIdBeforePointerDown = useStore.getState().selectedRackId;

    selectRack(id);

    if (!isEditMode) return;

    // Use the camera we already have from the top-level useThree() hook
    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
      const rackWorldX = position[0] * GRID_SPACING;
      const rackWorldZ = position[1] * GRID_SPACING;

      // Offset = ClickedFloorPoint - RackCenter
      const offset: [number, number] = [
        tempPoint.x - rackWorldX,
        tempPoint.z - rackWorldZ,
      ];

      setDragging(true, id, offset);
      updateDragPosition([rackWorldX, rackWorldZ]);
      document.body.style.cursor = "grabbing";
    }
  };

  const setHoveredRack = useStore((state: AppState) => state.setHoveredRack);
  useEffect(() => {
    const { isEditMode } = useStore.getState();
    if (isHovered && !draggingRackId && isEditMode) {
      document.body.style.cursor = "grab";
    } else if (!isHovered && !draggingRackId) {
      if (document.body.style.cursor === "grab")
        document.body.style.cursor = "auto";
    }
  }, [isHovered, draggingRackId]);

  return (
    <animated.group
      position={pos as unknown as THREE.Vector3}
      rotation={rot as unknown as THREE.Euler}
      scale={scale as unknown as THREE.Vector3}
    >
      {/* 1. STRUCTURAL FRAME (Main Skeleton) */}
      <group>
        {/* Main Enclosure (Hollow shell) */}
        {/* Top */}
        <mesh position={[0, height / 2 - 0.01, 0]}>
          <boxGeometry args={[width, 0.03, depth]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Bottom */}
        <mesh position={[0, -height / 2 + 0.01, 0]}>
          <boxGeometry args={[width, 0.03, depth]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Left Side */}
        <mesh position={[-width / 2 + 0.01, 0, 0]}>
          <boxGeometry args={[0.02, height - 0.06, depth]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Right Side */}
        <mesh position={[width / 2 - 0.01, 0, 0]}>
          <boxGeometry args={[0.02, height - 0.06, depth]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>

        {/* Side Ventilation Slots */}
        <mesh
          position={[-width / 2 - 0.005, 0, 0]}
          rotation={[0, -Math.PI / 2, 0]}
        >
          <planeGeometry args={[depth - 0.2, height - 0.4]} />
          <meshStandardMaterial color="#111" roughness={1} wireframe />
        </mesh>
        <mesh
          position={[width / 2 + 0.005, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[depth - 0.2, height - 0.4]} />
          <meshStandardMaterial color="#111" roughness={1} wireframe />
        </mesh>

        <group position={[0, 0, depth / 2 - 0.07]}>
          <mesh position={[0, 0, -depth + 0.12]}>
            <boxGeometry args={[width - 0.08, height - 0.08, 0.05]} />
            <meshStandardMaterial color={interiorColor} roughness={1} />
          </mesh>

          {/* Vertical Mounting Rails */}
          <mesh position={[-width / 2 + 0.08, 0, 0]}>
            <boxGeometry args={[0.03, height - 0.05, 0.03]} />
            <meshStandardMaterial
              color={railColor}
              metalness={1}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[width / 2 - 0.08, 0, 0]}>
            <boxGeometry args={[0.03, height - 0.05, 0.03]} />
            <meshStandardMaterial
              color={railColor}
              metalness={1}
              roughness={0.2}
            />
          </mesh>

          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[width - 0.1, height - 0.1, 0.1]} />
            <meshStandardMaterial
              color="#000"
              transparent
              opacity={0.5}
              emissive={glassEmissive}
              emissiveIntensity={isSelected ? 0.3 : 0.1}
            />
          </mesh>
        </group>
      </group>

      {/* 2. REAR PANEL (Vented look) */}
      <mesh position={[0, 0, -depth / 2 - 0.005]}>
        <planeGeometry args={[width - 0.05, height - 0.05]} />
        <meshStandardMaterial
          color={rearPanelColor}
          roughness={0.9}
          wireframe
        />
      </mesh>

      {/* 3. FRONT HINGED DOOR (Hollow Frame + Glass) */}
      <animated.group
        position={[-width / 2, 0, depth / 2]} // Pivot at exact left edge
        rotation-y={doorRotation as unknown as number}
      >
        {/* Door Frame Border - Top */}
        <mesh position={[width / 2, height / 2 - 0.02, 0.01]}>
          <boxGeometry args={[width, 0.04, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>
        {/* Door Frame Border - Bottom */}
        <mesh position={[width / 2, -height / 2 + 0.02, 0.01]}>
          <boxGeometry args={[width, 0.04, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>
        {/* Door Frame Border - Left */}
        <mesh position={[0.02, 0, 0.01]}>
          <boxGeometry args={[0.04, height - 0.08, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>
        {/* Door Frame Border - Right */}
        <mesh position={[width - 0.02, 0, 0.01]}>
          <boxGeometry args={[0.04, height - 0.08, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.7}
            metalness={0.8}
          />
        </mesh>

        {/* Glass Center Panel - Optimized to MeshStandardMaterial */}
        <mesh position={[width / 2, 0, 0.01]}>
          <planeGeometry args={[width - 0.08, height - 0.08]} />
          <meshStandardMaterial
            transparent
            opacity={0.2}
            color="#ffffff"
            roughness={0}
            metalness={0.5}
          />
        </mesh>
      </animated.group>

      {/* Interaction Layer */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredRack(id);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredRack(null);
        }}
      >
        <boxGeometry args={[width + 0.1, height + 0.1, depth + 0.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {isHovered && (
        <Billboard position={[0, height / 2 + 0.4, 0]}>
          <Html center zIndexRange={[0, 10]}>
            <div
              style={{
                background: isDarkMode
                  ? "rgba(23, 24, 28, 0.85)"
                  : "rgba(255, 255, 255, 0.9)",
                color: isDarkMode ? "#ebedef" : "#202226",
                padding: "4px 12px",
                borderRadius: "16px",
                fontSize: "12px",
                fontWeight: 600,
                border: isDarkMode
                  ? isSelected
                    ? "1px solid #FFFFFF"
                    : "1px solid rgba(255, 255, 255, 0.1)"
                  : isSelected
                    ? "1px solid #1a73e8"
                    : "1px solid rgba(0, 0, 0, 0.08)",
                boxShadow: isDarkMode
                  ? "0 4px 15px rgba(0, 0, 0, 0.4)"
                  : "0 4px 12px rgba(0, 0, 0, 0.1)",
                whiteSpace: "nowrap",
                backdropFilter: "blur(8px)",
                pointerEvents: "none",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  background: isDarkMode
                    ? isSelected
                      ? "#FFFFFF"
                      : "#4d5261"
                    : "#1a73e8",
                  display: "inline-block",
                }}
              />
              <span>{`${uHeight}U`}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>{id.slice(0, 4).toUpperCase()}</span>
            </div>
          </Html>
        </Billboard>
      )}

      <group position={[0, 0, depth / 2 - 0.07]}>
        {/* Removed per-rack pointLight for performance */}
        {devices.map((device) => (
          <DeviceMesh
            key={device.id}
            device={device}
            rackHeight={height}
            rackWidth={width}
            onSelect={() => {
              const { focusRack, selectDevice, isEditMode } =
                useStore.getState();

              if (isEditMode) return;

              // Use the snapshot captured in handlePointerDown (which fires FIRST)
              // to determine if the rack was ALREADY focused before this interaction.
              if (selectedRackIdBeforePointerDown === id) {
                // Rack was already focused → open port modal
                selectDevice(device.id);
              } else {
                // Rack was NOT focused → handlePointerDown already called selectRack(id)
                // Just focus the camera; no modal.
                focusRack(id);
              }
            }}
          />
        ))}
      </group>

      <ErrorMarker rack={{ id, uHeight, position, devices, width }} />
    </animated.group>
  );
};

const DeviceMesh = ({
  device,
  rackHeight,
  rackWidth,
  onSelect,
}: {
  device: Device;
  rackHeight: number;
  rackWidth: number;
  onSelect: () => void;
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const faceplateRef = useRef<THREE.Mesh>(null);

  const deviceH = device.uSize * U_HEIGHT;
  const bottomY = -rackHeight / 2;
  const yOffset = (device.uPosition - 1) * U_HEIGHT;
  const centerY = bottomY + yOffset + deviceH / 2 + 0.05;
  const deviceWidth = rackWidth - 0.06;

  const { hasError, errorColor } = useMemo(() => {
    const err = getHighestError(device.portStates);
    return {
      hasError: err !== null,
      errorColor: err?.color ?? null,
    };
  }, [device.portStates]);

  useFrame(({ clock }) => {
    const bodyMat = meshRef.current?.material;
    const faceMat = faceplateRef.current?.material;

    if (hasError && errorColor) {
      // 1 second interval blink (uniform transition)
      // Pulse intensity between 0 and 0.6 for a subtle, uniform glow
      const intensity =
        0.3 + Math.sin(clock.getElapsedTime() * Math.PI * 2) * 0.3;

      if (bodyMat instanceof THREE.MeshStandardMaterial) {
        bodyMat.emissive.set(errorColor);
        bodyMat.emissiveIntensity = intensity;
      }

      if (faceMat instanceof THREE.MeshStandardMaterial) {
        faceMat.emissive.set(errorColor);
        faceMat.emissiveIntensity = intensity;
      }
    } else {
      if (bodyMat instanceof THREE.MeshStandardMaterial) {
        bodyMat.emissive.set("#000000");
        bodyMat.emissiveIntensity = 0;
        bodyMat.opacity = 1.0;
      }
      if (faceMat instanceof THREE.MeshStandardMaterial) {
        faceMat.emissive.set("#000000");
        faceMat.emissiveIntensity = 0;
        faceMat.opacity = 1.0;
      }
    }
  });

  return (
    <group
      position={[0, centerY, -0.41]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <RoundedBox
        ref={meshRef}
        args={[deviceWidth, deviceH - 0.005, DEVICE_DEPTH]}
        radius={0.005}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#222222"
          roughness={0.4}
          metalness={0.7}
          transparent={hasError}
        />
      </RoundedBox>

      <group position={[0, 0, DEVICE_DEPTH / 2 + 0.001]}>
        {device.imageUrl ? (
          <ImageFaceplate
            url={device.imageUrl}
            width={deviceWidth}
            height={deviceH - 0.005}
            ref={faceplateRef}
            hasError={hasError}
          />
        ) : (
          <DeviceFaceplate
            type={device.type}
            width={deviceWidth}
            height={deviceH - 0.005}
            ref={faceplateRef}
            hasError={hasError}
            errorColor={errorColor}
          />
        )}
      </group>
    </group>
  );
};

const ImageFaceplate = forwardRef<
  THREE.Mesh,
  {
    url: string;
    width: number;
    height: number;
    hasError?: boolean;
  }
>(({ url, width, height, hasError }, ref) => {
  const texture = useTexture(url);
  return (
    <mesh position={[0, 0, 0]} ref={ref}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} transparent={hasError} />
    </mesh>
  );
});

const DeviceFaceplate = forwardRef<
  THREE.Mesh,
  {
    type: Device["type"];
    width: number;
    height: number;
    hasError?: boolean;
    errorColor?: string | null;
  }
>(({ type, width, height, hasError, errorColor }, ref) => {
  const isServer = type === "Server";
  const isRouter = type === "Router";
  const isSwitch = type === "Switch";

  return (
    <group>
      <mesh ref={ref}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          color="#1a1a1a"
          roughness={0.8}
          transparent={hasError}
        />
      </mesh>

      <mesh position={[-width / 2 + 0.04, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial
          color={hasError && errorColor ? errorColor : "#00ff00"}
        />
      </mesh>
      <mesh position={[-width / 2 + 0.06, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial
          color={
            hasError && errorColor
              ? errorColor
              : isServer
                ? "#00ff00"
                : "#ffaa00"
          }
        />
      </mesh>

      {isSwitch && (
        <group position={[0.05, 0, 0.001]}>
          {Array.from({ length: 12 }).map((_, i) => (
            <mesh
              key={i}
              position={[-0.15 + (i % 6) * 0.06, i < 6 ? 0.01 : -0.01, 0]}
            >
              <planeGeometry args={[0.04, 0.015]} />
              <meshStandardMaterial color="#000" />
            </mesh>
          ))}
        </group>
      )}
      {isRouter && (
        <group position={[0.05, 0, 0.001]}>
          <mesh position={[-0.1, 0, 0]}>
            <boxGeometry args={[0.08, height * 0.5, 0.01]} />
            <meshStandardMaterial color="#333" />
          </mesh>
          <mesh position={[0.1, 0, 0]}>
            <boxGeometry args={[0.08, height * 0.5, 0.01]} />
            <meshStandardMaterial color="#333" />
          </mesh>
        </group>
      )}
      {isServer && (
        <group position={[0.05, 0, 0.001]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={i} position={[-0.15 + i * 0.1, 0, 0]}>
              <boxGeometry args={[0.08, height * 0.8, 0.005]} />
              <meshStandardMaterial color="#333" />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});
