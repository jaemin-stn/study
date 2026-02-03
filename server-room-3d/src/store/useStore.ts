import { create } from "zustand";
import type { Rack, Device } from "../types";
import { GRID_SPACING } from "../components/constants";

interface AppState {
  racks: Rack[];
  selectedRackId: string | null;
  selectedDeviceId: string | null;
  focusedRackId: string | null;
  isDragging: boolean;
  draggingRackId: string | null;
  dragPosition: [number, number] | null;
  dragOffset: [number, number] | null;
  isEditMode: boolean;

  // Actions
  addRack: (uHeight: 24 | 32 | 48, position: [number, number]) => void;
  moveRack: (id: string, newPosition: [number, number]) => boolean; // returns success
  deleteRack: (id: string) => void;
  selectRack: (id: string | null) => void;
  selectDevice: (id: string | null) => void;
  focusRack: (id: string | null) => void;
  setDragging: (
    isDragging: boolean,
    rackId?: string | null,
    offset?: [number, number] | null,
  ) => void;
  updateDragPosition: (pos: [number, number] | null) => void;
  endDrag: (id: string, newPosition: [number, number]) => boolean;
  setEditMode: (enabled: boolean) => void;

  addDevice: (rackId: string, device: Omit<Device, "id">) => boolean;
  removeDevice: (rackId: string, deviceId: string) => void;

  // Data Persistence
  loadState: (racks: Rack[]) => void;
}

// Helper to check collision
const checkCollision = (
  racks: Rack[],
  idToExclude: string | null,
  pos: [number, number],
): boolean => {
  return racks.some(
    (r) =>
      r.id !== idToExclude &&
      r.position[0] === pos[0] &&
      r.position[1] === pos[1],
  );
};

export const useStore = create<AppState>((set, get) => ({
  racks: [],
  selectedRackId: null,
  selectedDeviceId: null,
  focusedRackId: null,
  isDragging: false,
  draggingRackId: null,
  dragPosition: null,
  dragOffset: null,
  isEditMode: false,

  addRack: (uHeight, position) => {
    const { racks } = get();
    if (checkCollision(racks, null, position)) {
      console.warn("Collision detected, cannot add rack here");
      return;
    }

    const newRack: Rack = {
      id: crypto.randomUUID(),
      uHeight,
      position,
      devices: [],
    };

    set({ racks: [...racks, newRack], selectedRackId: newRack.id });
  },

  moveRack: (id, newPosition) => {
    const { racks } = get();
    if (checkCollision(racks, id, newPosition)) {
      return false;
    }

    set({
      racks: racks.map((r) =>
        r.id === id ? { ...r, position: newPosition } : r,
      ),
    });
    return true;
  },

  deleteRack: (id) => {
    set((state) => ({
      racks: state.racks.filter((r) => r.id !== id),
      selectedRackId: state.selectedRackId === id ? null : state.selectedRackId,
      focusedRackId: state.focusedRackId === id ? null : state.focusedRackId,
    }));
  },

  selectRack: (id) => {
    const state = get();
    // If we are deselecting (id === null), ensure we stop any active drag
    if (id === null && state.isDragging) {
      if (state.draggingRackId && state.dragPosition) {
        // Snap to current grid position and finish drag
        const gridX =
          Math.round((state.dragPosition[0] / GRID_SPACING) * 2) / 2;
        const gridZ =
          Math.round((state.dragPosition[1] / GRID_SPACING) * 2) / 2;
        state.endDrag(state.draggingRackId, [gridX, gridZ]);
      } else {
        set({
          isDragging: false,
          draggingRackId: null,
          dragPosition: null,
          dragOffset: null,
        });
      }
    }
    set({
      selectedRackId: id,
      focusedRackId: null,
      selectedDeviceId: null,
    });
  },
  selectDevice: (id) => set({ selectedDeviceId: id }),
  focusRack: (id) => set({ focusedRackId: id }),
  setDragging: (isDragging, rackId = null, offset = null) =>
    set({
      isDragging,
      draggingRackId: isDragging ? rackId : null,
      dragOffset: offset,
    }),
  updateDragPosition: (pos) => set({ dragPosition: pos }),

  endDrag: (id, newPosition) => {
    const { racks } = get();
    const colliding = checkCollision(racks, id, newPosition);

    if (colliding) {
      console.warn(
        `Collision at [${newPosition[0]}, ${newPosition[1]}], reverting.`,
      );
      set({
        isDragging: false,
        draggingRackId: null,
        dragPosition: null,
        dragOffset: null,
      });
      return false;
    }

    const newRacks = racks.map((r) =>
      r.id === id ? { ...r, position: newPosition } : r,
    );
    console.log(
      `State updated. Rack ${id} position is now [${newPosition[0]}, ${newPosition[1]}]`,
    );

    set({
      racks: newRacks,
      isDragging: false,
      draggingRackId: null,
      dragPosition: null,
      dragOffset: null,
    });
    return true;
  },

  setEditMode: (enabled) => {
    const { isDragging, draggingRackId, dragPosition, endDrag } = get();

    // If disabling edit mode while dragging, finalize the position
    if (!enabled && isDragging && draggingRackId && dragPosition) {
      const gridX = Math.round((dragPosition[0] / GRID_SPACING) * 2) / 2;
      const gridZ = Math.round((dragPosition[1] / GRID_SPACING) * 2) / 2;
      console.log(
        `Mode toggled OFF while dragging. Finalizing to [${gridX}, ${gridZ}]`,
      );
      endDrag(draggingRackId, [gridX, gridZ]);
    }

    set({ isEditMode: enabled });
  },

  addDevice: (rackId, deviceData) => {
    const { racks } = get();
    const rack = racks.find((r) => r.id === rackId);
    if (!rack) return false;

    // Check bounds
    if (
      deviceData.uPosition < 1 ||
      deviceData.uPosition + deviceData.uSize - 1 > rack.uHeight
    ) {
      console.warn("Device out of rack bounds");
      return false;
    }

    // Check overlap
    const collision = rack.devices.some((d) => {
      const dStart = d.uPosition;
      const dEnd = d.uPosition + d.uSize - 1;
      const newStart = deviceData.uPosition;
      const newEnd = deviceData.uPosition + deviceData.uSize - 1;
      return dStart <= newEnd && dEnd >= newStart;
    });

    if (collision) {
      console.warn("Device collision in rack");
      return false;
    }

    const newDevice: Device = {
      ...deviceData,
      id: crypto.randomUUID(),
      portStates: deviceData.portStates || [],
    };

    set({
      racks: racks.map((r) =>
        r.id === rackId ? { ...r, devices: [...r.devices, newDevice] } : r,
      ),
    });
    return true;
  },

  removeDevice: (rackId, deviceId) => {
    set((state) => ({
      racks: state.racks.map((r) =>
        r.id === rackId
          ? { ...r, devices: r.devices.filter((d) => d.id !== deviceId) }
          : r,
      ),
    }));
  },

  loadState: (newRacks) =>
    set({ racks: newRacks, selectedRackId: null, focusedRackId: null }),
}));
