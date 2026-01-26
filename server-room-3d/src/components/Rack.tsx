import { useEffect, useState } from 'react';
import { Text, RoundedBox, useTexture } from '@react-three/drei';
import { animated, useSpring } from '@react-spring/three';
import { useStore } from '../store/useStore';
import type { Rack as RackType } from '../types';
import { ErrorMarker } from './ErrorMarker';
import { U_HEIGHT, GRID_SPACING } from './constants';

export const Rack = ({ id, uHeight, position, devices }: RackType) => {
    const selectedRackId = useStore(state => state.selectedRackId);
    const draggingRackId = useStore(state => state.draggingRackId);
    const dragPosition = useStore(state => state.dragPosition);

    const isSelected = selectedRackId === id;
    const isInternalDragging = draggingRackId === id;

    const height = uHeight * U_HEIGHT + 0.1;
    const width = 0.6;
    const depth = 1.0;
    const frameColor = isSelected ? '#1a73e8' : '#333333';

    // Visual animation - follow real-time drag coordinates if active
    const [{ pos, scale, doorOpacity }, api] = useSpring(() => ({
        pos: [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING],
        scale: 1,
        doorOpacity: 0.2,
        config: { mass: 1, tension: 350, friction: 35 }
    }));

    useEffect(() => {
        if (isInternalDragging && dragPosition) {
            api.start({
                pos: [dragPosition[0], height / 2 + 0.1, dragPosition[1]],
                scale: 1.05,
                doorOpacity: 0.1,
                immediate: true
            });
        } else {
            api.start({
                pos: [position[0] * GRID_SPACING, height / 2, position[1] * GRID_SPACING],
                scale: 1,
                doorOpacity: 0.2,
                immediate: false
            });
        }
    }, [isInternalDragging, dragPosition, position, height, api]);

    const handlePointerDown = (e: any) => {
        e.stopPropagation();
        const { selectRack, setDragging, updateDragPosition, isEditMode } = useStore.getState();

        console.log(`Grabbed rack: ${id}`);
        selectRack(id);

        if (!isEditMode) {
            console.log('Not in Edit Mode, ignoring drag');
            return;
        }

        const rackWorldX = position[0] * GRID_SPACING;
        const rackWorldZ = position[1] * GRID_SPACING;
        const offset: [number, number] = [e.point.x - rackWorldX, e.point.z - rackWorldZ];

        setDragging(true, id, offset);
        updateDragPosition([rackWorldX, rackWorldZ]);
        document.body.style.cursor = 'grabbing';
    };

    const [isHovered, setHovered] = useState(false);
    useEffect(() => {
        const { isEditMode } = useStore.getState();
        if (isHovered && !draggingRackId && isEditMode) {
            document.body.style.cursor = 'grab';
        } else if (!isHovered && !draggingRackId) {
            if (document.body.style.cursor === 'grab') document.body.style.cursor = 'auto';
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
                        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
                    </mesh>
                    <mesh position={[width / 2 - 0.1, 0, 0]}>
                        <boxGeometry args={[0.02, height - 0.1, 0.04]} />
                        <meshStandardMaterial color="#888" metalness={0.9} roughness={0.1} />
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
                <RoundedBox args={[width - 0.04, height - 0.04, 0.02]} radius={0.005} smoothness={4}>
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
                    <DeviceMesh key={device.id} device={device} rackHeight={height} />
                ))}
            </group>

            <ErrorMarker rack={{ id, uHeight, position, devices }} />
        </animated.group>
    );
};

const DeviceMesh = ({ device, rackHeight }: { device: any, rackHeight: number }) => {
    const deviceH = device.uSize * U_HEIGHT;
    const bottomY = -rackHeight / 2;
    const yOffset = (device.uPosition - 1) * U_HEIGHT;
    const centerY = bottomY + yOffset + deviceH / 2 + 0.05;

    return (
        <group position={[0, centerY, 0.01]}>
            <RoundedBox args={[0.54, deviceH - 0.005, 0.1]} radius={0.005} smoothness={2}>
                <meshStandardMaterial color="#222222" roughness={0.4} metalness={0.7} />
            </RoundedBox>

            <group position={[0, 0, 0.051]}>
                {device.imageUrl ? (
                    <ImageFaceplate url={device.imageUrl} width={0.54} height={deviceH - 0.005} />
                ) : (
                    <DeviceFaceplate type={device.type} width={0.54} height={deviceH - 0.005} />
                )}
            </group>
        </group>
    )
}

const ImageFaceplate = ({ url, width, height }: { url: string, width: number, height: number }) => {
    const texture = useTexture(url);
    return (
        <mesh position={[0, 0, 0]}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial map={texture} />
        </mesh>
    );
};

const DeviceFaceplate = ({ type, width, height }: { type: any, width: number, height: number }) => {
    const isServer = type === 'Server';
    const isRouter = type === 'Router';
    const isSwitch = type === 'Switch';

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
                        <mesh key={i} position={[-0.15 + (i % 6) * 0.06, i < 6 ? 0.01 : -0.01, 0]}>
                            <planeGeometry args={[0.04, 0.015]} />
                            <meshStandardMaterial color="#000" />
                        </mesh>
                    ))}
                </group>
            )}
            {isRouter && (
                <group position={[0.05, 0, 0.001]}>
                    <mesh position={[-0.1, 0, 0]}><boxGeometry args={[0.08, height * 0.5, 0.01]} /><meshStandardMaterial color="#333" /></mesh>
                    <mesh position={[0.1, 0, 0]}><boxGeometry args={[0.08, height * 0.5, 0.01]} /><meshStandardMaterial color="#333" /></mesh>
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
