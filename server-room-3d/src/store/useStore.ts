import { create } from 'zustand';
import type { Rack, Device } from '../types';

interface AppState {
    racks: Rack[];
    selectedRackId: string | null;
    focusedRackId: string | null;
    isDragging: boolean;
    draggingRackId: string | null;
    dragPosition: [number, number] | null;
    dragOffset: [number, number] | null;
    gridSize: number;
    isEditMode: boolean;

    // Actions
    addRack: (uHeight: 24 | 32 | 48, position: [number, number]) => void;
    moveRack: (id: string, newPosition: [number, number]) => boolean; // returns success
    deleteRack: (id: string) => void;
    selectRack: (id: string | null) => void;
    focusRack: (id: string | null) => void;
    setDragging: (isDragging: boolean, rackId?: string | null, offset?: [number, number] | null) => void;
    updateDragPosition: (pos: [number, number] | null) => void;
    endDrag: (id: string, newPosition: [number, number]) => boolean;
    setEditMode: (enabled: boolean) => void;

    addDevice: (rackId: string, device: Omit<Device, 'id'>) => boolean;
    removeDevice: (rackId: string, deviceId: string) => void;

    // Data Persistence
    loadState: (racks: Rack[]) => void;
}

// Helper to check collision
const checkCollision = (racks: Rack[], idToExclude: string | null, pos: [number, number]): boolean => {
    return racks.some(r => r.id !== idToExclude && r.position[0] === pos[0] && r.position[1] === pos[1]);
};

export const useStore = create<AppState>((set, get) => ({
    racks: [],
    selectedRackId: null,
    focusedRackId: null,
    isDragging: false,
    draggingRackId: null,
    dragPosition: null,
    dragOffset: null,
    gridSize: 1.5,
    isEditMode: false,

    addRack: (uHeight, position) => {
        const { racks } = get();
        if (checkCollision(racks, null, position)) {
            console.warn('Collision detected, cannot add rack here');
            return;
        }

        const newRack: Rack = {
            id: crypto.randomUUID(),
            uHeight,
            position,
            devices: []
        };

        set({ racks: [...racks, newRack], selectedRackId: newRack.id });
    },

    moveRack: (id, newPosition) => {
        const { racks } = get();
        if (checkCollision(racks, id, newPosition)) {
            return false;
        }

        set({
            racks: racks.map(r => r.id === id ? { ...r, position: newPosition } : r)
        });
        return true;
    },

    deleteRack: (id) => {
        set((state) => ({
            racks: state.racks.filter(r => r.id !== id),
            selectedRackId: state.selectedRackId === id ? null : state.selectedRackId,
            focusedRackId: state.focusedRackId === id ? null : state.focusedRackId
        }));
    },

    selectRack: (id) => set({ selectedRackId: id }),
    focusRack: (id) => set({ focusedRackId: id }),
    setDragging: (isDragging, rackId = null, offset = null) =>
        set({ isDragging, draggingRackId: isDragging ? rackId : null, dragOffset: offset }),
    updateDragPosition: (pos) => set({ dragPosition: pos }),

    endDrag: (id, newPosition) => {
        const { racks } = get();
        if (checkCollision(racks, id, newPosition)) {
            set({ isDragging: false, draggingRackId: null, dragPosition: null, dragOffset: null });
            return false;
        }

        set({
            racks: racks.map(r => r.id === id ? { ...r, position: newPosition } : r),
            isDragging: false,
            draggingRackId: null,
            dragPosition: null,
            dragOffset: null
        });
        return true;
    },

    setEditMode: (enabled) => set({ isEditMode: enabled }),

    addDevice: (rackId, deviceData) => {
        const { racks } = get();
        const rack = racks.find(r => r.id === rackId);
        if (!rack) return false;

        // Check bounds
        if (deviceData.uPosition < 1 || deviceData.uPosition + deviceData.uSize - 1 > rack.uHeight) {
            console.warn('Device out of rack bounds');
            return false;
        }

        // Check overlap
        const collision = rack.devices.some(d => {
            const dStart = d.uPosition;
            const dEnd = d.uPosition + d.uSize - 1;
            const newStart = deviceData.uPosition;
            const newEnd = deviceData.uPosition + deviceData.uSize - 1;
            return (dStart <= newEnd && dEnd >= newStart);
        });

        if (collision) {
            console.warn('Device collision in rack');
            return false;
        }

        const newDevice: Device = {
            ...deviceData,
            id: crypto.randomUUID(),
            portStates: deviceData.portStates || []
        };

        set({
            racks: racks.map(r => r.id === rackId ? { ...r, devices: [...r.devices, newDevice] } : r)
        });
        return true;
    },

    removeDevice: (rackId, deviceId) => {
        set((state) => ({
            racks: state.racks.map(r =>
                r.id === rackId
                    ? { ...r, devices: r.devices.filter(d => d.id !== deviceId) }
                    : r
            )
        }));
    },

    loadState: (newRacks) => set({ racks: newRacks, selectedRackId: null, focusedRackId: null })
}));
