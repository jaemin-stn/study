import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, Html, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import type { ImportedModel } from "../types";
import {
  DEFAULT_WALL_PARAMS,
  DEFAULT_PARTITION_PARAMS,
} from "../utils/builtinModels";

interface ImportedModelMeshProps {
  model: ImportedModel;
}
/* ------------------------------------------------------------------ */
/*  Wall mesh — procedural box with parametric dimensions              */
/* ------------------------------------------------------------------ */
const WallMesh = ({ model }: { model: ImportedModel }) => {
  const params = model.wallParams ?? DEFAULT_WALL_PARAMS;
  return (
    <mesh position={[0, params.height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[params.length, params.height, params.thickness]} />
      <meshStandardMaterial
        color={params.color}
        roughness={0.85}
        metalness={0.05}
      />
    </mesh>
  );
};

/* ------------------------------------------------------------------ */
/*  Partition mesh — framed two-panel divider with base and feet       */
/* ------------------------------------------------------------------ */
const PartitionMesh = ({ model }: { model: ImportedModel }) => {
  const params = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;
  const isTransparent = params.visibilityMode === "transparent";

  const { height: H, length: L, thickness: T } = params;

  // Design constants
  const frameWidth = 0.04;
  const feetHeight = 0.04;
  const feetWidth = 0.08;
  const baseHeight = 0.22;
  const dividerHeight = 0.02;

  // Calculate inner panel area
  const innerStartH = feetHeight + baseHeight;
  const totalInnerH = H - innerStartH - frameWidth;
  const topPanelH = totalInnerH * 0.35;
  const bottomPanelH = totalInnerH * 0.65 - dividerHeight;

  // Colors based on reference
  const frameColor = "#4a5568"; // Slate gray
  const topPanelColor = "#2d3748"; // Darker fabric gray
  const bottomPanelColor = "#718096"; // Lighter fabric gray
  const baseColor = "#1a202c"; // Darkest gray for plinth
  const plateColor = "#cbd5e0"; // Light gray for the small label plate

  const panelOpacity = isTransparent ? 0.45 : 1.0;

  return (
    <group>
      {/* 1. Feet */}
      <mesh position={[-L / 2 + feetWidth, feetHeight / 2, 0]}>
        <boxGeometry args={[feetWidth, feetHeight, T + 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>
      <mesh position={[L / 2 - feetWidth, feetHeight / 2, 0]}>
        <boxGeometry args={[feetWidth, feetHeight, T + 0.02]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} />
      </mesh>

      {/* 2. Base / Plinth */}
      <mesh
        position={[0, feetHeight + baseHeight / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L, baseHeight, T + 0.01]} />
        <meshStandardMaterial color={baseColor} roughness={0.7} />
      </mesh>

      {/* 3. Small label plate on base */}
      <mesh position={[-L / 4, feetHeight + baseHeight / 2, T / 2 + 0.01]}>
        <boxGeometry args={[0.1, 0.04, 0.005]} />
        <meshStandardMaterial color={plateColor} />
      </mesh>

      {/* 4. Outer Frames (Left, Right, Top) */}
      {/* Left */}
      <mesh
        position={[
          -L / 2 + frameWidth / 2,
          innerStartH + (H - innerStartH) / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[frameWidth, H - innerStartH, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>
      {/* Right */}
      <mesh
        position={[
          L / 2 - frameWidth / 2,
          innerStartH + (H - innerStartH) / 2,
          0,
        ]}
        castShadow
      >
        <boxGeometry args={[frameWidth, H - innerStartH, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>
      {/* Top */}
      <mesh position={[0, H - frameWidth / 2, 0]} castShadow>
        <boxGeometry args={[L, frameWidth, T]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} />
      </mesh>

      {/* 5. Panels */}
      {/* Bottom Panel (Lighter) */}
      <mesh
        position={[0, innerStartH + bottomPanelH / 2, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L - frameWidth * 2, bottomPanelH, T * 0.8]} />
        <meshStandardMaterial
          color={bottomPanelColor}
          transparent={isTransparent}
          opacity={panelOpacity}
          roughness={0.9}
        />
      </mesh>

      {/* Divider Rail */}
      <mesh
        position={[0, innerStartH + bottomPanelH + dividerHeight / 2, 0]}
        castShadow
      >
        <boxGeometry args={[L - frameWidth * 2, dividerHeight, T * 0.9]} />
        <meshStandardMaterial color={baseColor} roughness={0.3} />
      </mesh>

      {/* Top Panel (Darker) */}
      <mesh
        position={[
          0,
          innerStartH + bottomPanelH + dividerHeight + topPanelH / 2,
          0,
        ]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[L - frameWidth * 2, topPanelH, T * 0.8]} />
        <meshStandardMaterial
          color={topPanelColor}
          transparent={isTransparent}
          opacity={panelOpacity}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
};

/* ------------------------------------------------------------------ */
/*  GLB mesh — loads from dataUrl (base64 or public URL)               */
/* ------------------------------------------------------------------ */
const GltfMesh = ({ url }: { url: string }) => {
  const { scene: gltfScene } = useGLTF(url);
  const [clonedScene, setClonedScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (gltfScene) {
      const clone = gltfScene.clone(true);

      // Calculate bounding box for auto-centering
      const box = new THREE.Box3().setFromObject(clone);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Center X, Z and set bottom (min Y) to 0 so it sits on the floor
      clone.position.set(-center.x, -box.min.y, -center.z);

      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      setClonedScene(clone);
    }
    return () => {
      if (clonedScene) {
        clonedScene.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.geometry?.dispose();
            if (Array.isArray(mesh.material)) {
              mesh.material.forEach((m) => m.dispose());
            } else {
              mesh.material?.dispose();
            }
          }
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltfScene]);

  if (!clonedScene) return null;
  return <primitive object={clonedScene} />;
};

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export const ImportedModelMesh = ({ model }: ImportedModelMeshProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const isEditMode = useStore((s) => s.isEditMode);
  const draggingModelId = useStore((s) => s.draggingModelId);
  const modelDragPosition = useStore((s) => s.modelDragPosition);
  const isSelected = selectedModelId === model.id;
  const isDragging = draggingModelId === model.id;
  const isMoveEnabled = model.isMoveEnabled ?? false;

  const isWall = model.builtinType === "Wall";
  const isPartition = model.builtinType === "Partition";

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new THREE.Vector3(), []);

  // Edit-mode drag — only when isMoveEnabled
  useFrame(() => {
    if (isDragging && isEditMode && isMoveEnabled) {
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
        const { modelDragOffset } = useStore.getState();
        const offsetX = modelDragOffset ? modelDragOffset[0] : 0;
        const offsetZ = modelDragOffset ? modelDragOffset[1] : 0;
        const newX = tempPoint.x - offsetX;
        const newZ = tempPoint.z - offsetZ;
        useStore.getState().updateModelDragPosition([newX, newZ]);
      }
    }
  });

  const handlePointerDown = (e: ThreeEvent<PointerEvent>) => {
    const {
      isEditMode: editMode,
      selectRack,
      selectModel,
    } = useStore.getState();

    if (!editMode) {
      selectRack(null);
      return;
    }

    e.stopPropagation();
    selectModel(model.id);

    if (isMoveEnabled) {
      const { setModelDragging } = useStore.getState();
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
        const offsetX = tempPoint.x - model.position[0];
        const offsetZ = tempPoint.z - model.position[2];
        setModelDragging(
          model.id,
          [model.position[0], model.position[2]],
          [offsetX, offsetZ],
        );
        document.body.style.cursor = "grabbing";
      }
    }
  };

  // Display position
  const displayPos: [number, number, number] =
    isDragging && modelDragPosition
      ? [modelDragPosition[0], model.position[1], modelDragPosition[1]]
      : model.position;

  // Visual feedback
  const highlightColor = isMoveEnabled ? "#4ade80" : "#f97316";
  const highlightOpacity = isMoveEnabled ? 0.5 : 0.35;

  // Highlight box size — use Wall dimensions if applicable
  const wp = model.wallParams ?? DEFAULT_WALL_PARAMS;
  const pp = model.partitionParams ?? DEFAULT_PARTITION_PARAMS;

  const hlArgs: [number, number, number] = isWall
    ? [wp.length + 0.1, wp.height + 0.1, wp.thickness + 0.1]
    : isPartition
      ? [pp.length + 0.1, pp.height + 0.1, pp.thickness + 0.1]
      : [1.1, 1.1, 1.1];

  const hlCenter: [number, number, number] = isWall
    ? [0, wp.height / 2, 0]
    : isPartition
      ? [0, pp.height / 2, 0]
      : [0, 0, 0];

  return (
    <group
      ref={groupRef}
      position={displayPos}
      rotation={model.rotation}
      scale={model.scale}
      onPointerDown={handlePointerDown}
      onPointerOver={() => {
        if (isEditMode) {
          document.body.style.cursor = isMoveEnabled ? "grab" : "pointer";
        }
      }}
      onPointerOut={() => {
        if (
          document.body.style.cursor === "grab" ||
          document.body.style.cursor === "pointer"
        ) {
          document.body.style.cursor = "auto";
        }
      }}
    >
      {/* Render appropriate mesh */}
      {isWall ? (
        <WallMesh model={model} />
      ) : isPartition ? (
        <PartitionMesh model={model} />
      ) : (
        <GltfMesh url={model.dataUrl} />
      )}

      {/* Selection highlight box */}
      {isSelected && (
        <mesh position={hlCenter}>
          <boxGeometry args={hlArgs} />
          <meshBasicMaterial
            color={highlightColor}
            wireframe
            transparent
            opacity={highlightOpacity}
          />
        </mesh>
      )}
      {/* Lock/Unlock status label */}
      {isSelected && isEditMode && (
        <Billboard
          position={[
            0,
            isWall ? wp.height + 0.4 : isPartition ? pp.height + 0.4 : 1.4,
            0,
          ]}
        >
          <Html center zIndexRange={[0, 10]}>
            <div
              style={{
                background: isMoveEnabled
                  ? "rgba(74, 222, 128, 0.9)"
                  : "rgba(249, 115, 22, 0.9)",
                color: "#fff",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "11px",
                fontWeight: 700,
                fontFamily: "Inter, system-ui, sans-serif",
                whiteSpace: "nowrap",
                pointerEvents: "none",
                userSelect: "none",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
              }}
            >
              {isMoveEnabled ? "🔓 Unlocked" : "🔒 Locked"}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  );
};
