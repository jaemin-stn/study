import { useEffect, useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { useStore } from '../store/useStore';
import * as THREE from 'three';
import { OrbitControls } from 'three-stdlib';

const GRID_SPACING = 1.5;

export const CameraController = () => {
    const { camera, controls } = useThree();
    const focusedRackId = useStore((state) => state.focusedRackId);
    const racks = useStore((state) => state.racks);

    // Target position and lookAt vectors
    const targetPos = useRef<THREE.Vector3 | null>(null);
    const targetLookAt = useRef<THREE.Vector3 | null>(null);
    const isAnimating = useRef(false);

    useEffect(() => {
        if (focusedRackId) {
            const rack = racks.find(r => r.id === focusedRackId);
            if (rack) {
                // Calculate target position (e.g., offset by [3, 3, 3] from rack)
                const rackX = rack.position[0] * GRID_SPACING;
                const rackZ = rack.position[1] * GRID_SPACING;
                // Center of rack roughly
                const center = new THREE.Vector3(rackX, 1, rackZ);

                targetLookAt.current = center;
                targetPos.current = new THREE.Vector3(rackX + 4, 4, rackZ + 4);
                isAnimating.current = true;
            }
        }
    }, [focusedRackId, racks]);

    useFrame((_, delta) => {
        if (!isAnimating.current || !targetPos.current || !targetLookAt.current) return;

        const step = 4 * delta; // speed

        camera.position.lerp(targetPos.current, step);

        // Update controls target
        if (controls) {
            const orbitControls = controls as unknown as OrbitControls;
            orbitControls.target.lerp(targetLookAt.current, step);
            orbitControls.update();
        }

        // Check if close enough to stop "animation" (though lerp never truly finishes, just getting close)
        if (camera.position.distanceTo(targetPos.current) < 0.1) {
            isAnimating.current = false;
        }
    });

    return null;
};
