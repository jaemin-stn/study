import { Suspense, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Grid } from "@react-three/drei";
import { useStore } from "../store/useStore";
import { Rack } from "./Rack";
import { CameraController } from "./CameraController";
import { GRID_SPACING } from "./constants";
import * as THREE from "three";

const DragHandler = () => {
  const isDragging = useStore((state) => state.isDragging);
  const draggingRackId = useStore((state) => state.draggingRackId);
  const updateDragPosition = useStore((state) => state.updateDragPosition);

  const { raycaster, mouse, camera } = useThree();
  const floorPlane = useMemo(
    () => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    [],
  );
  const tempPoint = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (isDragging && draggingRackId) {
      raycaster.setFromCamera(mouse, camera);
      if (raycaster.ray.intersectPlane(floorPlane, tempPoint)) {
        const { dragOffset } = useStore.getState();
        const offsetX = dragOffset ? dragOffset[0] : 0;
        const offsetZ = dragOffset ? dragOffset[1] : 0;

        // Snap to grid immediately for "fixed" feel during movement, supporting 0.5 increments
        const snappedX =
          (Math.round(((tempPoint.x - offsetX) / GRID_SPACING) * 2) / 2) *
          GRID_SPACING;
        const snappedZ =
          Math.round((tempPoint.z - offsetZ) / GRID_SPACING) * GRID_SPACING;
        updateDragPosition([snappedX, snappedZ]);
      }
    }
  });

  return null;
};

export const Scene = () => {
  const racks = useStore((state) => state.racks);
  const isDragging = useStore((state) => state.isDragging);
  const draggingRackId = useStore((state) => state.draggingRackId);
  const dragPosition = useStore((state) => state.dragPosition);

  // Global release handler using native window listener for 100% reliability
  useEffect(() => {
    const handleGlobalUp = () => {
      const state = useStore.getState();
      if (state.isDragging) {
        const dragPos = state.dragPosition;
        const rackId = state.draggingRackId;

        if (rackId && dragPos) {
          // Snap to 0.5 for X, 1.0 for Z
          const gridX = Math.round((dragPos[0] / GRID_SPACING) * 2) / 2;
          const gridZ = Math.round(dragPos[1] / GRID_SPACING);

          console.log(`[Drop] Rack: ${rackId} -> Grid: [${gridX}, ${gridZ}]`);
          state.endDrag(rackId, [gridX, gridZ]);
        } else {
          state.setDragging(false, null);
          state.updateDragPosition(null);
        }
        document.body.style.cursor = "auto";
      }
    };

    window.addEventListener("pointerup", handleGlobalUp);
    return () => window.removeEventListener("pointerup", handleGlobalUp);
  }, []);

  return (
    <Canvas
      shadows
      camera={{ position: [10, 10, 10], fov: 50 }}
      style={{ width: "100%", height: "100vh", background: "#f0f0f0" }}
      onPointerMissed={() => useStore.getState().selectRack(null)}
    >
      <ambientLight intensity={0.5} />
      <directionalLight
        position={[10, 20, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />

      <Suspense fallback={null}>
        <Environment preset="city" />

        {/* Visual Grid */}
        <Grid
          args={[40, 40]}
          cellSize={GRID_SPACING}
          cellColor="#ccc"
          sectionSize={GRID_SPACING * 5}
          sectionColor="#999"
          fadeDistance={50}
          infiniteGrid
        />

        {/* Racks */}
        {racks.map((rack) => (
          <Rack
            key={rack.id}
            {...rack}
            draggingRackId={draggingRackId}
            dragPosition={dragPosition}
          />
        ))}

        {/* The Hidden Drag Engine */}
        <DragHandler />
      </Suspense>

      <OrbitControls
        makeDefault
        minPolarAngle={0}
        maxPolarAngle={Math.PI / 2.1}
        enabled={!isDragging}
      />
      <CameraController />
    </Canvas>
  );
};
