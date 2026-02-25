import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, Html, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { useStore } from "../store/useStore";
import type { ImportedModel } from "../types";
import { GRID_SPACING } from "./constants";

interface ImportedModelMeshProps {
  model: ImportedModel;
}

export const ImportedModelMesh = ({ model }: ImportedModelMeshProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const selectedModelId = useStore((s) => s.selectedModelId);
  const isEditMode = useStore((s) => s.isEditMode);
  const draggingModelId = useStore((s) => s.draggingModelId);
  const modelDragPosition = useStore((s) => s.modelDragPosition);
  const isSelected = selectedModelId === model.id;
  const isDragging = draggingModelId === model.id;
  const isMoveEnabled = model.isMoveEnabled ?? false;

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new THREE.Vector3(), []);

  // Load GLTF
  const { scene: gltfScene } = useGLTF(model.dataUrl);
  const [clonedScene, setClonedScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    if (gltfScene) {
      const clone = gltfScene.clone(true);
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

  // Edit-mode drag — only when isMoveEnabled
  useFrame(() => {
    if (isDragging && isEditMode && isMoveEnabled) {
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
        const snappedX =
          (Math.round((tempPoint.x / GRID_SPACING) * 4) / 4) * GRID_SPACING;
        const snappedZ =
          (Math.round((tempPoint.z / GRID_SPACING) * 4) / 4) * GRID_SPACING;
        useStore.getState().updateModelDragPosition([snappedX, snappedZ]);
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

    // Select the model on click (no toggle — lock/unlock is UI-panel only)
    selectModel(model.id);

    // Only start drag if model is already move-enabled
    if (isMoveEnabled) {
      const { setModelDragging } = useStore.getState();
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
        setModelDragging(model.id, [tempPoint.x, tempPoint.z]);
        document.body.style.cursor = "grabbing";
      }
    }
  };

  // Compute display position
  const displayPos: [number, number, number] =
    isDragging && modelDragPosition
      ? [modelDragPosition[0], model.position[1], modelDragPosition[1]]
      : model.position;

  if (!clonedScene) return null;

  // Visual feedback colors
  const highlightColor = isMoveEnabled ? "#4ade80" : "#f97316"; // green vs orange
  const highlightOpacity = isMoveEnabled ? 0.5 : 0.35;

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
      <primitive object={clonedScene} />
      {/* Selection highlight box — color indicates move state */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[1.1, 1.1, 1.1]} />
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
        <Billboard position={[0, 1.4, 0]}>
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
