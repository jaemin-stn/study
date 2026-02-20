import { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
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
      // Ensure shadows
      clone.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      setClonedScene(clone);
    }
    return () => {
      // Cleanup on unmount
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

  // Edit-mode drag
  useFrame(() => {
    if (isDragging && isEditMode) {
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
    const { isEditMode: editMode, selectRack } = useStore.getState();
    if (!editMode) {
      selectRack(null);
      return;
    }

    e.stopPropagation();
    const { selectModel, setModelDragging } = useStore.getState();

    selectModel(model.id);

    raycaster.setFromCamera(mouse, camera);
    if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
      setModelDragging(model.id, [tempPoint.x, tempPoint.z]);
      document.body.style.cursor = "grabbing";
    }
  };

  // Compute display position
  const displayPos: [number, number, number] =
    isDragging && modelDragPosition
      ? [modelDragPosition[0], model.position[1], modelDragPosition[1]]
      : model.position;

  if (!clonedScene) return null;

  return (
    <group
      ref={groupRef}
      position={displayPos}
      rotation={model.rotation}
      scale={model.scale}
      onPointerDown={handlePointerDown}
    >
      <primitive object={clonedScene} />
      {/* Selection highlight box */}
      {isSelected && (
        <mesh>
          <boxGeometry args={[1.1, 1.1, 1.1]} />
          <meshBasicMaterial
            color="#6e9fff"
            wireframe
            transparent
            opacity={0.5}
          />
        </mesh>
      )}
    </group>
  );
};
