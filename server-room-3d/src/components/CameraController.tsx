import { useEffect, useRef } from "react";
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

  // Pre-allocated objects for render loop stability
  const savedState = useRef<CameraState | null>(null);
  const lastProcessedRackId = useRef<string | null>(null);

  const vTargetPos = useRef(new THREE.Vector3());
  const vTargetLookAt = useRef(new THREE.Vector3());
  const vTargetZoom = useRef(1);

  // Use ref for animation flag to avoid React re-renders during interpolation
  const isAnimating = useRef(false);

  // Common function to set up animation to a rack
  const setupFocus = (rackId: string | null) => {
    // Only process if the target rack has actually changed
    if (rackId === lastProcessedRackId.current) return;
    lastProcessedRackId.current = rackId;

    if (!rackId) {
      if (savedState.current) {
        vTargetPos.current.copy(savedState.current.position);
        vTargetLookAt.current.copy(savedState.current.target);
        vTargetZoom.current = savedState.current.zoom;
        isAnimating.current = true;
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
    vTargetLookAt.current.set(rackX, targetCenterY, rackZ);

    const orientation = rack.orientation ?? 180;
    const orientationRad = ((180 - orientation) * Math.PI) / 180;
    const effectiveDistance = distance + 0.5;

    const offsetX = Math.sin(orientationRad) * effectiveDistance;
    const offsetZ = Math.cos(orientationRad) * effectiveDistance;
    const cameraHeight = rackHeight * 0.6 + distance * 0.3;

    vTargetPos.current.set(rackX + offsetX, cameraHeight, rackZ + offsetZ);
    vTargetZoom.current = 1;

    isAnimating.current = true;
  };

  // Handle initial selection/focus
  useEffect(() => {
    const rackId = selectedRackId || focusedRackId;
    const { isDragging } = useStore.getState();

    // Focus if a rack is identified AND we are NOT in edit mode AND we are NOT currently dragging
    if (!isEditMode && !isDragging) {
      setupFocus(rackId);
    }
  }, [selectedRackId, focusedRackId, isEditMode]);

  useFrame((state, delta) => {
    if (!isAnimating.current || !controls) return;

    const orbitControls = controls as unknown as OrbitControls;

    // Stabilize with a fixed time-based easing (independent of FPS fluctuations)
    // Using a smoothing factor that feels snappy but consistent
    const alpha = 1 - Math.exp(-8 * delta);

    // Atomic update of position and target to prevent jitter
    camera.position.lerp(vTargetPos.current, alpha);
    orbitControls.target.lerp(vTargetLookAt.current, alpha);

    // Smooth zoom update
    if (Math.abs(state.camera.zoom - vTargetZoom.current) > 0.001) {
      state.camera.zoom = THREE.MathUtils.lerp(
        state.camera.zoom,
        vTargetZoom.current,
        alpha,
      );
      state.camera.updateProjectionMatrix();
    }

    orbitControls.update();

    // Check completion threshold
    const posDist = camera.position.distanceTo(vTargetPos.current);
    const targetDist = orbitControls.target.distanceTo(vTargetLookAt.current);

    if (posDist < 0.005 && targetDist < 0.005) {
      // Snap to exact target values on completion
      state.camera.position.copy(vTargetPos.current);
      orbitControls.target.copy(vTargetLookAt.current);
      state.camera.zoom = vTargetZoom.current;
      state.camera.updateProjectionMatrix();
      orbitControls.update();

      isAnimating.current = false;

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
