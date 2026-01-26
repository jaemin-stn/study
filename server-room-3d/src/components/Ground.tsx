import { useStore } from '../store/useStore';
import { GRID_SPACING } from './constants';
import { Plane } from '@react-three/drei';

export const Ground = () => {
    const isDragging = useStore(state => state.isDragging);
    const draggingRackId = useStore(state => state.draggingRackId);

    const updateDragPosition = useStore(state => state.updateDragPosition);
    const setDragging = useStore(state => state.setDragging);
    const moveRack = useStore(state => state.moveRack);

    const handlePointerMove = (e: any) => {
        if (!isDragging || !draggingRackId) return;
        e.stopPropagation();

        if (e.point) {
            updateDragPosition([e.point.x, e.point.z]);
        }
    };

    const handlePointerUp = (e: any) => {
        if (!isDragging || !draggingRackId) return;
        e.stopPropagation();

        const currentDragPos = useStore.getState().dragPosition;

        if (currentDragPos) {
            const gridX = Math.round(currentDragPos[0] / GRID_SPACING);
            const gridZ = Math.round(currentDragPos[1] / GRID_SPACING);

            moveRack(draggingRackId, [gridX, gridZ]);
        }

        setDragging(false, null);
        updateDragPosition(null);
        document.body.style.cursor = 'auto';
    };

    return (
        <group>
            {/* 1. Visible Floor */}
            <Plane
                args={[100, 100]}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[0, -0.01, 0]}
                receiveShadow
            >
                <meshStandardMaterial color="#f8f9fa" roughness={0.8} />
            </Plane>

            {/* 2. Drag Interceptor Plane */}
            {isDragging && (
                <Plane
                    args={[200, 200]}
                    rotation={[-Math.PI / 2, 0, 0]}
                    position={[0, 0.05, 0]} // Slightly higher to ensure it's hit first
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                >
                    <meshBasicMaterial transparent opacity={0} depthWrite={false} />
                </Plane>
            )}
        </group>
    );
};
