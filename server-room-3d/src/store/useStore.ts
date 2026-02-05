import { create } from "zustand";
import type { Rack, Device } from "../types";
import { GRID_SPACING } from "../components/constants";

interface AppState {
  racks: Rack[];
  selectedRackId: string | null;
  selectedDeviceId: string | null;
  highlightedPortId: string | null;
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
  selectDevice: (id: string | null, portId?: string | null) => void;
  focusRack: (id: string | null) => void;
  setDragging: (
    isDragging: boolean,
    rackId?: string | null,
    offset?: [number, number] | null,
  ) => void;
  updateDragPosition: (pos: [number, number] | null) => void;
  endDrag: (id: string, newPosition: [number, number]) => boolean;
  updateRackOrientation: (id: string, orientation: 0 | 90 | 180 | 270) => void;
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

// Helper to check front clearance violation (combined Rule A + Rule B)
// Rule A: Any OTHER rack is within 1.0 unit in front of the PLACED rack's front face
// Rule B: The PLACED rack would be within 1.0 unit in front of any OTHER rack's front face
export const checkFrontClearanceViolation = (
  racks: Rack[],
  movedRackId: string,
  newPos: [number, number],
  movedRackOrientation?: 0 | 90 | 180 | 270,
): boolean => {
  const CLEARANCE = 1.0; // 1.0 unit clearance from front face

  // Find the moved rack to get its orientation
  const movedRack = racks.find((r) => r.id === movedRackId);
  const placedOrientation =
    movedRackOrientation ?? movedRack?.orientation ?? 180;

  // Calculate the front direction of the PLACED rack
  let placedFrontDirX = 0;
  let placedFrontDirZ = 0;
  switch (placedOrientation) {
    case 0:
      placedFrontDirZ = -1;
      break;
    case 90:
      placedFrontDirX = 1;
      break;
    case 180:
      placedFrontDirZ = 1;
      break;
    case 270:
      placedFrontDirX = -1;
      break;
  }

  for (const otherRack of racks) {
    if (otherRack.id === movedRackId) continue;

    const otherRackX = otherRack.position[0];
    const otherRackZ = otherRack.position[1];
    const otherOrientation = otherRack.orientation ?? 180;

    // Delta from placed rack to other rack
    const deltaToOtherX = otherRackX - newPos[0];
    const deltaToOtherZ = otherRackZ - newPos[1];

    // ===== Rule A: Check if OTHER rack is in front of PLACED rack's front face =====
    if (placedFrontDirX !== 0) {
      const inFront =
        placedFrontDirX > 0 ? deltaToOtherX > 0 : deltaToOtherX < 0;
      const withinClearance = Math.abs(deltaToOtherX) <= CLEARANCE;
      const aligned = Math.abs(deltaToOtherZ) < 0.5;
      if (inFront && withinClearance && aligned) {
        console.warn(
          `Rule A violation: rack at [${otherRackX}, ${otherRackZ}] is within 1.0 unit in front of placed rack at [${newPos[0]}, ${newPos[1]}]`,
        );
        return true;
      }
    }
    if (placedFrontDirZ !== 0) {
      const inFront =
        placedFrontDirZ > 0 ? deltaToOtherZ > 0 : deltaToOtherZ < 0;
      const withinClearance = Math.abs(deltaToOtherZ) <= CLEARANCE;
      const aligned = Math.abs(deltaToOtherX) < 0.5;
      if (inFront && withinClearance && aligned) {
        console.warn(
          `Rule A violation: rack at [${otherRackX}, ${otherRackZ}] is within 1.0 unit in front of placed rack at [${newPos[0]}, ${newPos[1]}]`,
        );
        return true;
      }
    }

    // ===== Rule B: Check if PLACED rack is in front of OTHER rack's front face =====
    let otherFrontDirX = 0;
    let otherFrontDirZ = 0;
    switch (otherOrientation) {
      case 0:
        otherFrontDirZ = -1;
        break;
      case 90:
        otherFrontDirX = 1;
        break;
      case 180:
        otherFrontDirZ = 1;
        break;
      case 270:
        otherFrontDirX = -1;
        break;
    }

    // Delta from other rack to placed rack
    const deltaFromOtherX = newPos[0] - otherRackX;
    const deltaFromOtherZ = newPos[1] - otherRackZ;

    if (otherFrontDirX !== 0) {
      const inFront =
        otherFrontDirX > 0 ? deltaFromOtherX > 0 : deltaFromOtherX < 0;
      const withinClearance = Math.abs(deltaFromOtherX) <= CLEARANCE;
      const aligned = Math.abs(deltaFromOtherZ) < 0.5;
      if (inFront && withinClearance && aligned) {
        console.warn(
          `Rule B violation: placed rack at [${newPos[0]}, ${newPos[1]}] is within 1.0 unit in front of rack at [${otherRackX}, ${otherRackZ}]`,
        );
        return true;
      }
    }
    if (otherFrontDirZ !== 0) {
      const inFront =
        otherFrontDirZ > 0 ? deltaFromOtherZ > 0 : deltaFromOtherZ < 0;
      const withinClearance = Math.abs(deltaFromOtherZ) <= CLEARANCE;
      const aligned = Math.abs(deltaFromOtherX) < 0.5;
      if (inFront && withinClearance && aligned) {
        console.warn(
          `Rule B violation: placed rack at [${newPos[0]}, ${newPos[1]}] is within 1.0 unit in front of rack at [${otherRackX}, ${otherRackZ}]`,
        );
        return true;
      }
    }
  }

  return false;
};

export const useStore = create<AppState>((set, get) => ({
  racks: [],
  selectedRackId: null,
  selectedDeviceId: null,
  highlightedPortId: null,
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
      orientation: 180,
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
    // If we are dragging, ensure we stop and save the position before changing selection
    if (state.isDragging && state.draggingRackId && state.dragPosition) {
      const gridX = Math.round((state.dragPosition[0] / GRID_SPACING) * 2) / 2;
      const gridZ = Math.round((state.dragPosition[1] / GRID_SPACING) * 2) / 2;
      state.endDrag(state.draggingRackId, [gridX, gridZ]);
    } else if (state.isDragging) {
      set({
        isDragging: false,
        draggingRackId: null,
        dragPosition: null,
        dragOffset: null,
      });
    }

    set({
      selectedRackId: id,
      focusedRackId: null,
      selectedDeviceId: null,
    });
  },
  selectDevice: (id, portId = null) =>
    set({ selectedDeviceId: id, highlightedPortId: portId }),
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
    const frontClearanceViolation = checkFrontClearanceViolation(
      racks,
      id,
      newPosition,
    );

    if (colliding || frontClearanceViolation) {
      if (colliding) {
        console.warn(
          `Collision at [${newPosition[0]}, ${newPosition[1]}], reverting.`,
        );
      }
      // Revert: do not update position, just reset drag state
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

  updateRackOrientation: (id, orientation) => {
    const { racks } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) return;

    // Validate rotation: check if any rack is within 1 unit in front after rotation
    const frontClearanceViolation = checkFrontClearanceViolation(
      racks,
      id,
      rack.position,
      orientation,
    );

    if (frontClearanceViolation) {
      console.warn(
        `Rotation blocked: another rack is within 1.0 unit in front at orientation ${orientation}°`,
      );
      return; // Rollback: do not apply rotation
    }

    set((state) => ({
      racks: state.racks.map((r) => (r.id === id ? { ...r, orientation } : r)),
    }));
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
