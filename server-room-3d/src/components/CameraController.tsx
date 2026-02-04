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
  const targetPos = useRef<THREE.Vector3 | null>(null);
  const targetLookAt = useRef<THREE.Vector3 | null>(null);
  const targetZoom = useRef<number>(1);
  const [isAnimating, setIsAnimating] = useState(false);

  // Common function to set up animation to a rack
  const setupFocus = (rackId: string) => {
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

    // Calculate distance to fit the whole rack (considering FOV and aspect ratio)
    const fov = perspectiveCamera.fov;
    const aspect = window.innerWidth / window.innerHeight;

    const vFovRad = (fov * Math.PI) / 180;
    const hFovRad = 2 * Math.atan(Math.tan(vFovRad / 2) * aspect);

    // Distance needed to fit height and width
    const distHeight = rackHeight / 2 / Math.tan(vFovRad / 2);
    const distWidth = rackWidth / 2 / Math.tan(hFovRad / 2);

    // Use smaller margin (0.7) to bring the camera closer and frame the rack larger
    const baseDistance = Math.max(distHeight, distWidth) * 0.7;

    // Reduce the distance further for a tighter framing
    const distance = Math.max(baseDistance, 1.5); // Minimum distance to avoid clipping

    // Target is the center of the rack (slightly lower to see more of the front face)
    const targetCenterY = rackHeight * 0.45;
    targetLookAt.current = new THREE.Vector3(rackX, targetCenterY, rackZ);

    // Camera position: higher up and looking down at the rack
    // This steeper angle helps see past front racks when focusing on rear racks
    const cameraHeight = rackHeight * 0.8 + distance * 0.4; // Higher camera position
    const cameraZ = rackZ + distance + 0.5; // Front of rack + distance

    targetPos.current = new THREE.Vector3(rackX, cameraHeight, cameraZ);
    targetZoom.current = 1;

    setIsAnimating(true);
  };

  // Handle initial selection/focus
  useEffect(() => {
    const rackId = selectedRackId || focusedRackId;
    // Focus if a rack is identified AND (we are not in edit mode OR focus was explicitly requested via focusedRackId)
    if (rackId && (!isEditMode || focusedRackId !== null)) {
      setupFocus(rackId);
    } else if (savedState.current) {
      // Deselect: animate back to saved state
      targetPos.current = savedState.current.position;
      targetLookAt.current = savedState.current.target;
      targetZoom.current = savedState.current.zoom;
      setIsAnimating(true);
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
    const step = 5 * delta; // Speed

    // Lerp position
    camera.position.lerp(targetPos.current, step);

    // Lerp target
    orbitControls.target.lerp(targetLookAt.current, step);

    // Lerp zoom
    if (Math.abs(camera.zoom - targetZoom.current) > 0.01) {
      camera.zoom = THREE.MathUtils.lerp(camera.zoom, targetZoom.current, step);
      camera.updateProjectionMatrix();
    }

    orbitControls.update();

    // Check completion
    const posDist = camera.position.distanceTo(targetPos.current);
    const targetDist = orbitControls.target.distanceTo(targetLookAt.current);

    if (posDist < 0.01 && targetDist < 0.01) {
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
