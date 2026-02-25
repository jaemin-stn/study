import { create } from "zustand";
import type { Rack, Device, ImportedModel } from "../types";
import {
  GRID_SPACING,
  RACK_WIDTH_STANDARD,
  RACK_DEPTH,
} from "../components/constants";
import * as THREE from "three";

export interface AppState {
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
  hoveredRackId: string | null;
  importExportModalRackId: string | null;

  // Camera reference for viewport-center spawning
  _cameraRef: THREE.Camera | null;
  _controlsRef: any | null;

  // Imported 3D Models
  importedModels: ImportedModel[];
  selectedModelId: string | null;
  draggingModelId: string | null;
  modelDragPosition: [number, number] | null;

  // Actions
  setCameraRef: (camera: THREE.Camera, controls: any) => void;
  setHoveredRack: (id: string | null) => void;
  setImportExportModalRackId: (id: string | null) => void;
  addRack: (
    uHeight: 24 | 32 | 48,
    position?: [number, number],
    width?: number,
  ) => void;
  moveRack: (id: string, newPosition: [number, number]) => boolean;
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
  updateRack: (
    id: string,
    updates: Partial<Omit<Rack, "id" | "position">>,
  ) => void;

  // Imported Model Actions
  addImportedModel: (model: Omit<ImportedModel, "id">) => string;
  selectModel: (id: string | null) => void;
  deleteModel: (id: string) => void;
  updateModel: (
    id: string,
    updates: Partial<Omit<ImportedModel, "id">>,
  ) => void;
  setModelDragging: (
    modelId: string | null,
    pos?: [number, number] | null,
  ) => void;
  updateModelDragPosition: (pos: [number, number] | null) => void;
  endModelDrag: (id: string, position: [number, number]) => void;
  toggleModelMove: (id: string) => void;

  // Data Persistence
  loadState: (racks: Rack[], models?: ImportedModel[]) => void;
}

// Helper to check collision using AABB (Axis-Aligned Bounding Box)
const checkCollision = (
  racks: Rack[],
  idToExclude: string | null,
  pos: [number, number],
  width: number,
  orientation: 0 | 90 | 180 | 270 = 180,
): boolean => {
  // We use world units for collision check
  const isRotated = orientation === 90 || orientation === 270;
  const w1 = isRotated ? RACK_DEPTH : width;
  const d1 = isRotated ? width : RACK_DEPTH;
  const x1 = pos[0] * GRID_SPACING;
  const z1 = pos[1] * GRID_SPACING;

  return racks.some((r) => {
    if (r.id === idToExclude) return false;

    const otherOrientation = r.orientation ?? 180;
    const otherIsRotated = otherOrientation === 90 || otherOrientation === 270;
    const w2 = otherIsRotated ? RACK_DEPTH : r.width;
    const d2 = otherIsRotated ? r.width : RACK_DEPTH;
    const x2 = r.position[0] * GRID_SPACING;
    const z2 = r.position[1] * GRID_SPACING;

    // AABB overlap check
    const overlapX = Math.abs(x1 - x2) < (w1 + w2) / 2 - 0.01; // Small buffer
    const overlapZ = Math.abs(z1 - z2) < (d1 + d2) / 2 - 0.01;

    return overlapX && overlapZ;
  });
};

// Helper to check front clearance violation (combined Rule A + Rule B)
// Rule A: Any OTHER rack is within 1.0 unit in front of the PLACED rack's front face
// Rule B: The PLACED rack would be within 1.0 unit in front of any OTHER rack's front face
export const checkFrontClearanceViolation = (
  racks: Rack[],
  movedRackId: string,
  newPos: [number, number],
  movedRackOrientation?: 0 | 90 | 180 | 270,
  movedRackWidth?: number,
): boolean => {
  const CLEARANCE = 1.5; // 1.5 unit clearance from front face

  // Find the moved rack to get its orientation
  const movedRack = racks.find((r) => r.id === movedRackId);
  const placedOrientation =
    movedRackOrientation ?? movedRack?.orientation ?? 180;
  const placedWidth = movedRackWidth ?? movedRack?.width ?? RACK_WIDTH_STANDARD;

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

      // Alignment check (width-aware)
      const otherWidth = otherRack.width;
      const otherOrientation = otherRack.orientation ?? 180;
      const otherIsRotated =
        otherOrientation === 90 || otherOrientation === 270;
      const otherEffWidth = otherIsRotated ? RACK_DEPTH : otherWidth;
      const placedIsRotated =
        placedOrientation === 90 || placedOrientation === 270;
      const placedEffDepth = placedIsRotated ? placedWidth : RACK_DEPTH;

      const aligned =
        Math.abs(deltaToOtherZ) < (placedEffDepth + otherEffWidth) / 2;
      if (inFront && withinClearance && aligned) {
        console.warn(
          `Rule A violation: rack at [${otherRackX}, ${otherRackZ}] is within 1.5 units in front of placed rack at [${newPos[0]}, ${newPos[1]}]`,
        );
        return true;
      }
    }
    if (placedFrontDirZ !== 0) {
      const inFront =
        placedFrontDirZ > 0 ? deltaToOtherZ > 0 : deltaToOtherZ < 0;
      const withinClearance = Math.abs(deltaToOtherZ) <= CLEARANCE;

      // Alignment check (width-aware)
      const otherWidth = otherRack.width;
      const otherOrientation = otherRack.orientation ?? 180;
      const otherIsRotated =
        otherOrientation === 90 || otherOrientation === 270;
      const otherEffWidth = otherIsRotated ? RACK_DEPTH : otherWidth;
      const placedIsRotated =
        placedOrientation === 90 || placedOrientation === 270;
      const placedEffWidth = placedIsRotated ? RACK_DEPTH : placedWidth;

      const aligned =
        Math.abs(deltaToOtherX) < (placedEffWidth + otherEffWidth) / 2;
      if (inFront && withinClearance && aligned) {
        console.warn(
          `Rule A violation: rack at [${otherRackX}, ${otherRackZ}] is within 1.5 units in front of placed rack at [${newPos[0]}, ${newPos[1]}]`,
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
          `Rule B violation: placed rack at [${newPos[0]}, ${newPos[1]}] is within 1.5 units in front of rack at [${otherRackX}, ${otherRackZ}]`,
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
          `Rule B violation: placed rack at [${newPos[0]}, ${newPos[1]}] is within 1.5 units in front of rack at [${otherRackX}, ${otherRackZ}]`,
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
  hoveredRackId: null,
  importExportModalRackId: null,

  _cameraRef: null,
  _controlsRef: null,

  importedModels: [],
  selectedModelId: null,
  draggingModelId: null,
  modelDragPosition: null,

  setCameraRef: (camera, controls) =>
    set({ _cameraRef: camera, _controlsRef: controls }),
  setHoveredRack: (id) => set({ hoveredRackId: id }),
  setImportExportModalRackId: (id) => set({ importExportModalRackId: id }),
  addRack: (uHeight, position, width = RACK_WIDTH_STANDARD) => {
    const { racks, isEditMode, _cameraRef } = get();

    // Compute spawn position: use provided position, or compute from camera viewport center
    let spawnPos: [number, number];
    if (position) {
      spawnPos = position;
    } else if (_cameraRef) {
      // Raycast from NDC (0,0) — viewport center — onto ground plane Y=0
      const raycaster = new THREE.Raycaster();
      const center = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(center, _cameraRef);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        // Convert world coords to grid coords and snap to 0.25
        const gridX = Math.round((hitPoint.x / GRID_SPACING) * 4) / 4;
        const gridZ = Math.round((hitPoint.z / GRID_SPACING) * 4) / 4;
        spawnPos = [gridX, gridZ];
      } else {
        // Edge case: camera looking away from ground — use camera forward at default distance
        const dir = new THREE.Vector3();
        _cameraRef.getWorldDirection(dir);
        const fallback = _cameraRef.position.clone().add(dir.multiplyScalar(5));
        const gridX = Math.round((fallback.x / GRID_SPACING) * 4) / 4;
        const gridZ = Math.round((fallback.z / GRID_SPACING) * 4) / 4;
        spawnPos = [gridX, gridZ];
      }
    } else {
      // No camera available, fallback to origin
      spawnPos = [0, 0];
    }

    console.log(
      `[AddRack] Attempting spawn at [${spawnPos[0]}, ${spawnPos[1]}]`,
    );

    // If collision at spawn point, try nearby positions with increasing offsets
    let finalPos = spawnPos;
    if (checkCollision(racks, null, spawnPos, width)) {
      let found = false;
      // Spiral search: try offsets in increasing distance
      for (let radius = 1; radius <= 20; radius++) {
        for (const dx of [-radius, 0, radius]) {
          for (const dz of [-radius, 0, radius]) {
            if (dx === 0 && dz === 0) continue;
            const candidate: [number, number] = [
              spawnPos[0] + dx * 0.5,
              spawnPos[1] + dz * 0.5,
            ];
            if (!checkCollision(racks, null, candidate, width)) {
              finalPos = candidate;
              found = true;
              break;
            }
          }
          if (found) break;
        }
        if (found) break;
      }
      if (!found) {
        console.warn("[AddRack] No free space found nearby. Placing anyway.");
        // Still place it — user can move it later
      }
      console.log(
        `[AddRack] Collision avoided, moved to [${finalPos[0]}, ${finalPos[1]}]`,
      );
    }

    const newRack: Rack = {
      id: crypto.randomUUID(),
      uHeight,
      width,
      position: finalPos,
      orientation: 180,
      devices: [],
    };

    console.log(
      `[AddRack] Created rack ${newRack.id.slice(0, 8)} at [${finalPos[0]}, ${finalPos[1]}]`,
    );

    // Focus rules: in Edit Mode, select the new rack. Otherwise, do NOT focus/select.
    if (isEditMode) {
      set({ racks: [...racks, newRack], selectedRackId: newRack.id });
    } else {
      set({ racks: [...racks, newRack] });
    }
  },

  moveRack: (id, newPosition) => {
    const { racks } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) return false;

    if (checkCollision(racks, id, newPosition, rack.width, rack.orientation)) {
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

    // If clicking the same rack that is already selected AND we have a focus,
    // do not clear focusedRackId to satisfy "Clicking on the focused rack itself should NOT clear focus".
    if (id && id === state.selectedRackId && state.focusedRackId) {
      return;
    }

    set({
      selectedRackId: id,
      focusedRackId: null,
      selectedDeviceId: null,
      selectedModelId: id ? null : state.selectedModelId,
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
    const rack = racks.find((r) => r.id === id);
    if (!rack) return false;

    // Edge-to-edge snapping logic:
    // If we are close to another rack horizontally, snap to its edge.
    let finalPosition = [...newPosition] as [number, number];
    const SNAP_THRESHOLD = 0.5; // Snap if within 0.5m

    const worldX = newPosition[0] * GRID_SPACING;

    for (const other of racks) {
      if (other.id === id) continue;
      if (Math.abs(other.position[1] - newPosition[1]) > 0.1) continue; // Must be in same row roughly

      const otherWorldX = other.position[0] * GRID_SPACING;
      const gap =
        Math.abs(worldX - otherWorldX) - (rack.width + other.width) / 2;

      if (gap >= -0.1 && gap < SNAP_THRESHOLD) {
        // Snap!
        const direction = worldX > otherWorldX ? 1 : -1;
        const snappedWorldX =
          otherWorldX + (direction * (other.width + rack.width)) / 2;
        finalPosition[0] = snappedWorldX / GRID_SPACING;
        console.log(`Snapped edge-to-edge with rack ${other.id.slice(0, 4)}`);
        break;
      }
    }

    const colliding = checkCollision(
      racks,
      id,
      finalPosition,
      rack.width,
      rack.orientation,
    );
    const frontClearanceViolation = checkFrontClearanceViolation(
      racks,
      id,
      finalPosition,
      rack.orientation,
      rack.width,
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
      r.id === id ? { ...r, position: finalPosition } : r,
    );
    console.log(
      `State updated. Rack ${id} position is now [${finalPosition[0]}, ${finalPosition[1]}]`,
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
      rack.width,
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

  updateRack: (id, updates) => {
    set((state) => ({
      racks: state.racks.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    }));
  },

  loadState: (newRacks, newModels) =>
    set({
      racks: newRacks,
      importedModels: newModels ?? [],
      selectedRackId: null,
      focusedRackId: null,
      selectedModelId: null,
    }),

  // Imported Model Actions
  addImportedModel: (modelData) => {
    const newId = crypto.randomUUID();
    const model: ImportedModel = {
      ...modelData,
      id: newId,
      isMoveEnabled: modelData.isMoveEnabled ?? false,
    };
    set((state) => ({ importedModels: [...state.importedModels, model] }));
    return newId;
  },

  selectModel: (id) =>
    set({
      selectedModelId: id,
      selectedRackId: id ? null : undefined,
      focusedRackId: null,
      selectedDeviceId: null,
    }),

  deleteModel: (id) =>
    set((state) => ({
      importedModels: state.importedModels.filter((m) => m.id !== id),
      selectedModelId:
        state.selectedModelId === id ? null : state.selectedModelId,
    })),

  updateModel: (id, updates) =>
    set((state) => ({
      importedModels: state.importedModels.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      ),
    })),

  setModelDragging: (modelId, pos = null) =>
    set({ draggingModelId: modelId, modelDragPosition: pos }),

  updateModelDragPosition: (pos) => set({ modelDragPosition: pos }),

  endModelDrag: (id, position) => {
    set((state) => ({
      importedModels: state.importedModels.map((m) =>
        m.id === id
          ? { ...m, position: [position[0], m.position[1], position[1]] }
          : m,
      ),
      draggingModelId: null,
      modelDragPosition: null,
    }));
  },

  toggleModelMove: (id) => {
    const state = get();
    const model = state.importedModels.find((m) => m.id === id);
    if (!model) return;

    const newEnabled = !model.isMoveEnabled;
    console.log(
      `[Model] ${id.slice(0, 8)} move ${newEnabled ? "ENABLED" : "LOCKED"}`,
    );

    // If toggling OFF while this model is being dragged, cancel the drag
    if (!newEnabled && state.draggingModelId === id) {
      set({
        draggingModelId: null,
        modelDragPosition: null,
      });
      document.body.style.cursor = "auto";
    }

    set((s) => ({
      importedModels: s.importedModels.map((m) =>
        m.id === id ? { ...m, isMoveEnabled: newEnabled } : m,
      ),
    }));
  },
}));
