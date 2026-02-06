import { useEffect, useRef, useState } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import * as THREE from "three";
import { OrbitControls } from "three-stdlib";
import { U_HEIGHT, GRID_SPACING } from "./constants";

interface CameraState {
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  target: THREE.Vector3;
  zoom: number;
}

export const CameraController = () => {
  const { camera, controls } = useThree();
  const selectedRackId = useStore((state) => state.selectedRackId);
  const focusedRackId = useStore((state) => state.focusedRackId);
  const racks = useStore((state) => state.racks);
  const isEditMode = useStore((state) => state.isEditMode);

  const savedState = useRef<CameraState | null>(null);
  const lastProcessedRackId = useRef<string | null>(null);
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const targetZoom = useRef<number>(1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Common function to set up animation to a rack
  const setupFocus = (rackId: string | null) => {
    // Only process if the target rack has actually changed
    if (rackId === lastProcessedRackId.current) return;
    lastProcessedRackId.current = rackId;

    if (!rackId) {
      if (savedState.current) {
        targetPos.current = savedState.current.position;
        targetLookAt.current = savedState.current.target;
        targetZoom.current = savedState.current.zoom;
        setIsAnimating(true);
      }
      return;
    }

    const rack = racks.find((r) => r.id === rackId);
    if (!rack || !controls) return;

    const orbitControls = controls as unknown as OrbitControls;
    const perspectiveCamera = camera as THREE.PerspectiveCamera;

    // Save state ONLY if we are not already focused/animating toward a rack
    if (!savedState.current) {
      savedState.current = {
        position: camera.position.clone(),
        quaternion: camera.quaternion.clone(),
        target: orbitControls.target.clone(),
        zoom: camera.zoom,
      };
    }

    const rackX = rack.position[0] * GRID_SPACING;
    const rackZ = rack.position[1] * GRID_SPACING;
    const rackHeight = rack.uHeight * U_HEIGHT + 0.1;
    const rackWidth = 0.6;

    const fov = perspectiveCamera.fov;
    const aspect = window.innerWidth / window.innerHeight;
    const vFovRad = (fov * Math.PI) / 180;
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    const distHeight = rackHeight / 2 / Math.tan(vFovRad / 2);
    const distWidth = rackWidth / 2 / Math.tan(hFovRad / 2);
    const baseDistance = Math.max(distHeight, distWidth) * 1.1;
    const distance = Math.max(baseDistance, 2.0);

    const targetCenterY = rackHeight * 0.5;
    targetLookAt.current = new THREE.Vector3(rackX, targetCenterY, rackZ);

    const orientation = rack.orientation ?? 180;
    const orientationRad = ((180 - orientation) * Math.PI) / 180;
    const effectiveDistance = distance + 0.5;

    const offsetX = Math.sin(orientationRad) * effectiveDistance;
    const offsetZ = Math.cos(orientationRad) * effectiveDistance;
    const cameraHeight = rackHeight * 0.6 + distance * 0.3;

    targetPos.current = new THREE.Vector3(
      rackX + offsetX,
      cameraHeight,
      rackZ + offsetZ,
    );
    targetZoom.current = 1;

    setIsAnimating(true);
  };

  // Handle initial selection/focus
  useEffect(() => {
    const rackId = selectedRackId || focusedRackId;
    const { isDragging } = useStore.getState();

    // Focus if a rack is identified AND we are NOT in edit mode AND we are NOT currently dragging
    if (!isEditMode && !isDragging) {
      setupFocus(rackId);
    }
  }, [selectedRackId, focusedRackId, racks, isEditMode]);

  useFrame((_, delta) => {
    if (
      !isAnimating ||
      !targetPos.current ||
      !targetLookAt.current ||
      !controls
    )
      return;

    const orbitControls = controls as unknown as OrbitControls;

    // Stabilize with a fixed time-based easing (independent of FPS fluctuations)
    // Using a smoothing factor that feels snappy but consistent
    const alpha = 1 - Math.exp(-8 * delta);

    // Atomic update of position and target to prevent jitter
    camera.position.lerp(targetPos.current, alpha);
    orbitControls.target.lerp(targetLookAt.current, alpha);

    // Smooth zoom update
    if (Math.abs(camera.zoom - targetZoom.current) > 0.001) {
      camera.zoom = THREE.MathUtils.lerp(
        camera.zoom,
        targetZoom.current,
        alpha,
      );
      camera.updateProjectionMatrix();
    }

    orbitControls.update();

    // Check completion threshold
    const posDist = camera.position.distanceTo(targetPos.current);
    const targetDist = orbitControls.target.distanceTo(targetLookAt.current);

    if (posDist < 0.005 && targetDist < 0.005) {
      // Snap to exact target values on completion
      camera.position.copy(targetPos.current);
      orbitControls.target.copy(targetLookAt.current);
      camera.zoom = targetZoom.current;
      camera.updateProjectionMatrix();
      orbitControls.update();

      setIsAnimating(false);

      // If we just finished return-to-base, clear the saved state
      if (!selectedRackId && !focusedRackId) {
        if (savedState.current) {
          camera.quaternion.copy(savedState.current.quaternion);
          orbitControls.update();
        }
        savedState.current = null;
      }
    }
  });

  return null;
};
