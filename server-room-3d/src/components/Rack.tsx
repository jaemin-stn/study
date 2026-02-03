import { useEffect, useState, useMemo } from "react";
import { Text, RoundedBox, useTexture } from "@react-three/drei";
import { animated, useSpring } from "@react-spring/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import type { Rack as RackType } from "../types";
import { ErrorMarker } from "./ErrorMarker";
import { U_HEIGHT, GRID_SPACING } from "./constants";

interface RackProps extends RackType {
  draggingRackId: string | null;
  dragPosition: [number, number] | null;
}

export const Rack = ({
  id,
  uHeight,
  position,
  devices,
  draggingRackId,
  dragPosition,
}: RackProps) => {
  const selectedRackId = useStore((state: any) => state.selectedRackId);

  const isSelected = selectedRackId === id;
  const isInternalDragging = draggingRackId === id;

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new THREE.Vector3(), []);

  const height = uHeight * U_HEIGHT + 0.1;
  const width = 0.6;
  const depth = 1.0;
  const frameColor = isSelected ? "#1a73e8" : "#333333";

  // Declarative animation - Purely reactive to props/state
  const currentTargetPos =
    isInternalDragging && dragPosition
      ? [dragPosition[0], height / 2 + 0.1, dragPosition[1]]
      : [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING];

  const { pos, scale, doorOpacity } = useSpring({
    pos: currentTargetPos,
    scale: isInternalDragging ? 1.05 : 1,
    doorOpacity: isInternalDragging ? 0.1 : 0.2,
    config: { mass: 1, tension: 350, friction: 35 },
    immediate: isInternalDragging, // Use immediate only during active dragging
  });

  const handlePointerDown = (e: any) => {
    e.stopPropagation();
    const { selectRack, setDragging, updateDragPosition, isEditMode } =
      useStore.getState();

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

  const [isHovered, setHovered] = useState(false);
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
    <animated.group position={pos as any} scale={scale as any}>
      {/* 1. STRUCTURAL FRAME (Main Skeleton) */}
      <group>
        <RoundedBox args={[width, height, depth]} radius={0.01} smoothness={4}>
          <meshPhysicalMaterial
            color={frameColor}
            roughness={0.2}
            metalness={0.8}
            reflectivity={0.5}
            clearcoat={1}
            clearcoatRoughness={0.1}
          />
        </RoundedBox>

        <group position={[0, 0, 0.05]}>
          <mesh position={[0, 0, -0.1]}>
            <boxGeometry args={[width - 0.08, height - 0.08, 0.05]} />
            <meshStandardMaterial color="#050505" roughness={1} />
          </mesh>

          <mesh position={[-width / 2 + 0.1, 0, 0]}>
            <boxGeometry args={[0.02, height - 0.1, 0.04]} />
            <meshStandardMaterial
              color="#888"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>
          <mesh position={[width / 2 - 0.1, 0, 0]}>
            <boxGeometry args={[0.02, height - 0.1, 0.04]} />
            <meshStandardMaterial
              color="#888"
              metalness={0.9}
              roughness={0.1}
            />
          </mesh>

          <mesh position={[0, 0, -0.05]}>
            <boxGeometry args={[width - 0.1, height - 0.1, 0.1]} />
            <meshStandardMaterial
              color="#000"
              transparent
              opacity={0.5}
              emissive="#1a73e8"
              emissiveIntensity={isSelected ? 0.3 : 0.1}
            />
          </mesh>
        </group>
      </group>

      {/* 2. REAR PANEL (Vented look) */}
      <mesh position={[0, 0, -depth / 2 - 0.005]}>
        <planeGeometry args={[width - 0.05, height - 0.05]} />
        <meshStandardMaterial color="#111" roughness={0.9} wireframe />
      </mesh>

      {/* 3. FRONT GLASS DOOR */}
      <group position={[0, 0, depth / 2 + 0.01]}>
        <RoundedBox
          args={[width - 0.04, height - 0.04, 0.02]}
          radius={0.005}
          smoothness={4}
        >
          <animated.meshPhysicalMaterial
            transparent
            opacity={doorOpacity as any}
            color="#ffffff"
            metalness={0.1}
            roughness={0.05}
            transmission={0.95}
            thickness={0.05}
            envMapIntensity={1}
          />
        </RoundedBox>
      </group>

      {/* Interaction Layer */}
      <mesh
        onPointerDown={handlePointerDown}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={() => setHovered(false)}
      >
        <boxGeometry args={[width + 0.1, height + 0.1, depth + 0.1]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      <Text
        position={[0, height / 2 + 0.4, 0]}
        rotation={[-Math.PI / 4, 0, 0]}
        fontSize={0.22}
        color="#000"
        anchorX="center"
        anchorY="bottom"
      >
        {`${uHeight}U - ${id.slice(0, 4)}`}
      </Text>

      <group position={[0, 0, depth / 2 - 0.02]}>
        {devices.map((device) => (
          <DeviceMesh
            key={device.id}
            device={device}
            rackHeight={height}
            onSelect={() => {
              const {
                focusRack,
                selectRack,
                selectDevice,
                selectedRackId,
                isEditMode,
              } = useStore.getState();

              // 1) Select the parent rack
              if (selectedRackId !== id) {
                selectRack(id);
              }

              // 2) Focus only if NOT in edit mode
              if (!isEditMode) {
                focusRack(id);
              }

              // 3) Close modal if open
              selectDevice(null);
            }}
          />
        ))}
      </group>

      <ErrorMarker rack={{ id, uHeight, position, devices }} />
    </animated.group>
  );
};

const DeviceMesh = ({
  device,
  rackHeight,
  onSelect,
}: {
  device: any;
  rackHeight: number;
  onSelect: () => void;
}) => {
  const deviceH = device.uSize * U_HEIGHT;
  const bottomY = -rackHeight / 2;
  const yOffset = (device.uPosition - 1) * U_HEIGHT;
  const centerY = bottomY + yOffset + deviceH / 2 + 0.05;

  return (
    <group
      position={[0, centerY, 0.01]}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <RoundedBox
        args={[0.54, deviceH - 0.005, 0.1]}
        radius={0.005}
        smoothness={2}
      >
        <meshStandardMaterial color="#222222" roughness={0.4} metalness={0.7} />
      </RoundedBox>

      <group position={[0, 0, 0.051]}>
        {device.imageUrl ? (
          <ImageFaceplate
            url={device.imageUrl}
            width={0.54}
            height={deviceH - 0.005}
          />
        ) : (
          <DeviceFaceplate
            type={device.type}
            width={0.54}
            height={deviceH - 0.005}
          />
        )}
      </group>
    </group>
  );
};

const ImageFaceplate = ({
  url,
  width,
  height,
}: {
  url: string;
  width: number;
  height: number;
}) => {
  const texture = useTexture(url);
  return (
    <mesh position={[0, 0, 0]}>
      <planeGeometry args={[width, height]} />
      <meshStandardMaterial map={texture} />
    </mesh>
  );
};

const DeviceFaceplate = ({
  type,
  width,
  height,
}: {
  type: any;
  width: number;
  height: number;
}) => {
  const isServer = type === "Server";
  const isRouter = type === "Router";
  const isSwitch = type === "Switch";

  return (
    <group>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.8} />
      </mesh>

      <mesh position={[-width / 2 + 0.04, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial color="#00ff00" />
      </mesh>
      <mesh position={[-width / 2 + 0.06, 0, 0.001]}>
        <circleGeometry args={[0.006, 16]} />
        <meshBasicMaterial color={isServer ? "#00ff00" : "#ffaa00"} />
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
};
