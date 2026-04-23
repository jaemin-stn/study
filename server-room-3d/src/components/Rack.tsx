import { useEffect, useMemo, useRef, forwardRef, Suspense, memo } from "react";
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
import { resolveDeviceImage } from "../utils/deviceAssets";


// Snapshot of selectedRackId captured inside handlePointerDown BEFORE selectRack()
// mutates it. Since the Interaction Layer is geometrically closer to the camera,
// handlePointerDown fires FIRST, then DeviceMesh's onClick fires and reads this.
let selectedRackIdBeforePointerDown: string | null = null;

interface RackProps extends RackType {
  draggingRackId: string | null;
  dragPosition: [number, number] | null;
}

export const Rack = memo(({
  rackId,
  rackTitle,
  rackSize,
  width: rackWidth,
  position,
  devices,
  mapId,
  orientation: orientationProp,
  draggingRackId,
  dragPosition,
}: RackProps) => {
  // Boolean selectors: only re-render when THIS rack's selection state changes
  const isSelected = useStore((state: AppState) => state.selectedRackId === rackId);
  const isHovered = useStore((state: AppState) => state.hoveredRackId === rackId);
  const isFocused = useStore((state: AppState) => state.focusedRackId === rackId);
  const { theme } = useTheme();

  const isInternalFocused = isSelected || isFocused;
  const isInternalDragging = draggingRackId === rackId;
  const isDarkMode = theme === "dark";
  // Use orientation from props directly instead of searching store.racks
  const orientation = orientationProp ?? 180;

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new THREE.Vector3(), []);

  // Define perforated metal texture for side ventilation panels only
  const perforatedTexture = useMemo(() => {
    const size = 64;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Metal part (white in alphaMap means opaque)
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, size, size);
      // Hole part (black in alphaMap means fully transparent / discarded)
      ctx.fillStyle = "black";
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    // Tiling density matched to the perforated sheet inner opening
    const density = 40;
    const panelW = 1.0 - 0.04; // depth - 0.04
    const panelH = rackSize * U_HEIGHT + 0.1 - 0.06; // height - 0.06
    const railV = 0.08;
    const railW = 0.08;
    const innerW = panelW - railV * 2; // matches planeGeometry width
    const innerH = panelH - railW * 2; // matches planeGeometry height
    tex.repeat.set(innerW * density, innerH * density);
    return tex;
  }, [rackSize]);

  const height = rackSize * U_HEIGHT + 0.1;
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
    // Determine if the raycaster intersected a PivotControls gizmo (or the model it controls)
    const hitGizmo = e.intersections.some((hit) => {
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData && obj.userData.isGizmo) return true;
        obj = obj.parent;
      }
      return false;
    });

    if (hitGizmo) {
      // Do not stop propagation and do not select rack; let the gizmo handle it.
      return;
    }

    e.stopPropagation();
    const { selectRack, setDragging, updateDragPosition, isEditMode } =
      useStore.getState();

    // Snapshot BEFORE mutation — DeviceMesh onClick reads this for two-step gate
    selectedRackIdBeforePointerDown = useStore.getState().selectedRackId;

    selectRack(rackId);

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

      setDragging(true, rackId, offset);
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
        {/* Main Enclosure (Solid frame with better corner joins) */}
        {/* Top */}
        <mesh position={[0, height / 2 - 0.015, 0]}>
          <boxGeometry args={[width, 0.03, depth]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Bottom */}
        <mesh position={[0, -height / 2 + 0.015, 0]}>
          <boxGeometry args={[width, 0.03, depth]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Left Side – corner posts only (no full-depth wall, so perforated holes reveal interior) */}
        <mesh position={[-width / 2 + 0.01, 0, depth / 2 - 0.01]}>
          <boxGeometry args={[0.02, height, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        <mesh position={[-width / 2 + 0.01, 0, -depth / 2 + 0.01]}>
          <boxGeometry args={[0.02, height, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        {/* Right Side – corner posts only */}
        <mesh position={[width / 2 - 0.01, 0, depth / 2 - 0.01]}>
          <boxGeometry args={[0.02, height, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>
        <mesh position={[width / 2 - 0.01, 0, -depth / 2 + 0.01]}>
          <boxGeometry args={[0.02, height, 0.02]} />
          <meshStandardMaterial
            color={frameColor}
            roughness={0.6}
            metalness={0.9}
          />
        </mesh>

        {/* ── LEFT SIDE PANEL (perforated sheet only) ── */}
        {(() => {
          const panelW = depth - 0.04;
          const panelH = height - 0.06;
          const xOff = -width / 2;
          return (
            <group position={[xOff, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
              <mesh>
                <planeGeometry args={[panelW, panelH]} />
                <meshStandardMaterial
                  color={frameColor}
                  roughness={0.7}
                  metalness={0.8}
                  alphaMap={perforatedTexture}
                  transparent
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })()}

        {/* ── RIGHT SIDE PANEL (perforated sheet only) ── */}
        {(() => {
          const panelW = depth - 0.04;
          const panelH = height - 0.06;
          const xOff = width / 2;
          return (
            <group position={[xOff, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
              <mesh>
                <planeGeometry args={[panelW, panelH]} />
                <meshStandardMaterial
                  color={frameColor}
                  roughness={0.7}
                  metalness={0.8}
                  alphaMap={perforatedTexture}
                  transparent
                  alphaTest={0.5}
                  side={THREE.DoubleSide}
                  depthWrite={false}
                />
              </mesh>
            </group>
          );
        })()}

        <group position={[0, 0, 0]}>
          {/* Internal Structural Bracing - Horizontal rails at the back */}
          <mesh position={[0, height / 2 - 0.15, -depth / 2 + 0.1]}>
            <boxGeometry args={[width - 0.04, 0.02, 0.02]} />
            <meshStandardMaterial color={frameColor} roughness={0.8} />
          </mesh>
          <mesh position={[0, -height / 2 + 0.15, -depth / 2 + 0.1]}>
            <boxGeometry args={[width - 0.04, 0.02, 0.02]} />
            <meshStandardMaterial color={frameColor} roughness={0.8} />
          </mesh>

          {/* Vertical Mounting Rails (Front) */}
          <mesh position={[-width / 2 + 0.06, 0, depth / 2 - 0.12]}>
            <boxGeometry args={[0.03, height - 0.08, 0.03]} />
            <meshStandardMaterial
              color={railColor}
              metalness={1}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[width / 2 - 0.06, 0, depth / 2 - 0.12]}>
            <boxGeometry args={[0.03, height - 0.08, 0.03]} />
            <meshStandardMaterial
              color={railColor}
              metalness={1}
              roughness={0.2}
            />
          </mesh>

          {/* Vertical Support Rails (Back) */}
          <mesh position={[-width / 2 + 0.06, 0, -depth / 2 + 0.12]}>
            <boxGeometry args={[0.02, height - 0.08, 0.02]} />
            <meshStandardMaterial color={railColor} roughness={0.5} />
          </mesh>
          <mesh position={[width / 2 - 0.06, 0, -depth / 2 + 0.12]}>
            <boxGeometry args={[0.02, height - 0.08, 0.02]} />
            <meshStandardMaterial color={railColor} roughness={0.5} />
          </mesh>
        </group>
      </group>

      {/* 2. REAR PANEL (Solid opaque plate – no perforation) */}
      <group position={[0, 0, -depth / 2 + 0.02]}>
        {/* Panel Bezel / Frame */}
        <mesh position={[0, 0, -0.005]}>
          <boxGeometry args={[width - 0.02, height - 0.04, 0.01]} />
          <meshStandardMaterial color={frameColor} roughness={0.7} />
        </mesh>
        {/* Solid Rear Plate */}
        <mesh position={[0, 0, 0.001]}>
          <planeGeometry args={[width - 0.08, height - 0.1]} />
          <meshStandardMaterial
            color={rearPanelColor}
            roughness={0.9}
            metalness={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

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
          setHoveredRack(rackId);
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
          <Html center zIndexRange={[0, 10]} style={{ pointerEvents: "none" }}>
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
              <span>{`${rackSize}U`}</span>
              <span style={{ opacity: 0.4 }}>|</span>
              <span>
                {rackTitle || `Rack ${rackId.slice(0, 4).toUpperCase()}`}
              </span>
            </div>
          </Html>
        </Billboard>
      )}

      <group position={[0, 0, depth / 2 - 0.07]}>
        {/* Removed per-rack pointLight for performance */}
        {devices.map((device) => (
          <DeviceMesh
            key={device.itemId}
            device={device}
            rackHeight={height}
            rackWidth={width}
            onSelect={() => {
              const { focusRack, selectDevice, isEditMode } =
                useStore.getState();

              if (isEditMode) return;

              // Use the snapshot captured in handlePointerDown (which fires FIRST)
              // to determine if the rack was ALREADY focused before this interaction.
              if (selectedRackIdBeforePointerDown === rackId) {
                // Rack was already focused → open port modal
                selectDevice(device.itemId);
              } else {
                // Rack was NOT focused → handlePointerDown already called selectRack(rackId)
                // Just focus the camera; no modal.
                focusRack(rackId);
              }
            }}
          />
        ))}
      </group>
      {/* Only mount ErrorMarker when rack has error devices */}
      {devices.some((d) => d.portStates?.some((p) => p.status === "error")) && (
        <ErrorMarker
          rack={{
            rackId,
            rackSize,
            position,
            devices,
            width,
            mapId,
          }}
        />
      )}
    </animated.group>
  );
});

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
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const isHighlighted = highlightedDeviceId === device.itemId || (device.deviceId && highlightedDeviceId === device.deviceId);

  const deviceH = device.size * U_HEIGHT;
  const bottomY = -rackHeight / 2;
  const yOffset = (device.position - 1) * U_HEIGHT;
  const centerY = bottomY + yOffset + deviceH / 2 + 0.05;
  const deviceWidth = rackWidth - 0.06;

  const { hasError, errorColor } = useMemo(() => {
    const err = getHighestError(device.portStates);
    return {
      hasError: err !== null,
      errorColor: err?.color ?? null,
    };
  }, [device.portStates]);

  // 에러 + 선택 모두 애니메이션 필요
  const needsAnimation = isHighlighted || (hasError && !!errorColor);

  // Cache Color objects to avoid per-frame allocation
  const highlightColor = useMemo(() => new THREE.Color("#4dabf7"), []);
  const blackColor = useMemo(() => new THREE.Color("#000000"), []);

  // Reset emissive once when animation stops (instead of every frame)
  useEffect(() => {
    if (!needsAnimation) {
      const bodyMat = meshRef.current?.material;
      const faceMat = faceplateRef.current?.material;
      if (bodyMat instanceof THREE.MeshStandardMaterial) {
        bodyMat.emissive.copy(blackColor);
        bodyMat.emissiveIntensity = 0;
        bodyMat.opacity = 1.0;
      }
      if (faceMat instanceof THREE.MeshStandardMaterial) {
        faceMat.emissive.copy(blackColor);
        faceMat.emissiveIntensity = 0;
        faceMat.opacity = 1.0;
      }
    }
  }, [needsAnimation, blackColor]);

  // Only register useFrame when animation is actually needed
  useFrame(needsAnimation ? ({ clock }) => {
    const bodyMat = meshRef.current?.material;
    const faceMat = faceplateRef.current?.material;

    if (isHighlighted) {
      const pulse =
        0.5 + Math.sin(clock.getElapsedTime() * Math.PI * 1.6) * 0.5;

      if (bodyMat instanceof THREE.MeshStandardMaterial) {
        bodyMat.emissive.copy(highlightColor);
        bodyMat.emissiveIntensity = pulse * 4;
      }
      if (faceMat instanceof THREE.MeshStandardMaterial) {
        faceMat.emissive.copy(highlightColor);
        faceMat.emissiveIntensity = pulse * 4;
      }
    } else if (hasError && errorColor) {
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
    }
  } : () => {});

  return (
    <group
      position={[0, centerY, -0.41]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      {(() => {
        const resolvedUrl =
          resolveDeviceImage(device.modelName);

        const content = (
          <>
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
              {resolvedUrl ? (
                <ImageFaceplate
                  url={resolvedUrl}
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
          </>
        );

        if (resolvedUrl) {
          return <Suspense fallback={null}>{content}</Suspense>;
        }
        return content;
      })()}
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
