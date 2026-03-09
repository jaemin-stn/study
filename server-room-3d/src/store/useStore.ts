import { create } from "zustand";
import type {
  Rack,
  Device,
  ImportedModel,
  GroupName,
  RegisteredDevice,
} from "../types";
import { GRID_SPACING, RACK_WIDTH_STANDARD } from "../components/constants";
import {
  getFrontDirection,
  getEffectiveDimensions,
} from "../utils/rackGeometry";
import * as THREE from "three";

export interface AppState {
  racks: Rack[];
  registeredDevices: RegisteredDevice[];
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
  deviceRegistrationModalOpen: boolean;
  activeGroup: GroupName;

  // Camera reference for viewport-center spawning
  _cameraRef: THREE.Camera | null;
  _controlsRef: any | null;

  // Imported 3D Models
  importedModels: ImportedModel[];
  selectedModelId: string | null;
  draggingModelId: string | null;
  modelDragPosition: [number, number] | null;
  modelDragOffset: [number, number] | null;

  // Actions
  setCameraRef: (camera: THREE.Camera, controls: any) => void;
  setHoveredRack: (id: string | null) => void;
  setActiveGroup: (group: GroupName) => void;
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

  // Registered Device Management
  setDeviceRegistrationModalOpen: (open: boolean) => void;
  addRegisteredDevice: (device: Omit<RegisteredDevice, "id">) => void;
  removeRegisteredDevice: (id: string) => void;

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
    offset?: [number, number] | null,
  ) => void;
  updateModelDragPosition: (pos: [number, number] | null) => void;
  endModelDrag: (id: string, position: [number, number]) => void;
  toggleModelMove: (id: string) => void;

  // Data Persistence
  loadState: (
    racks: Rack[],
    models?: ImportedModel[],
    registeredDevices?: RegisteredDevice[],
  ) => void;
  replaceGroupData: (
    groupName: GroupName | "ALL",
    newRacks: Rack[],
    newRegisteredDevices?: RegisteredDevice[],
  ) => void;
}

// Helper to check collision using AABB (Axis-Aligned Bounding Box)
const checkCollision = (
  racks: Rack[],
  idToExclude: string | null,
  pos: [number, number],
  width: number,
  orientation: 0 | 90 | 180 | 270 = 180,
): boolean => {
  const { effectiveWidth: w1, effectiveDepth: d1 } = getEffectiveDimensions(
    width,
    orientation,
  );
  const x1 = pos[0] * GRID_SPACING;
  const z1 = pos[1] * GRID_SPACING;

  return racks.some((r) => {
    if (r.id === idToExclude) return false;

    const { effectiveWidth: w2, effectiveDepth: d2 } = getEffectiveDimensions(
      r.width,
      r.orientation ?? 180,
    );
    const x2 = r.position[0] * GRID_SPACING;
    const z2 = r.position[1] * GRID_SPACING;

    // AABB overlap check
    const overlapX = Math.abs(x1 - x2) < (w1 + w2) / 2 - 0.01; // Small buffer
    const overlapZ = Math.abs(z1 - z2) < (d1 + d2) / 2 - 0.01;

    return overlapX && overlapZ;
  });
};

// Helper to check front clearance violation (combined Rule A + Rule B)
export const checkFrontClearanceViolation = (
  racks: Rack[],
  movedRackId: string,
  newPos: [number, number],
  movedRackOrientation?: 0 | 90 | 180 | 270,
  movedRackWidth?: number,
): boolean => {
  const CLEARANCE = 1.5;

  const movedRack = racks.find((r) => r.id === movedRackId);
  const placedOrientation =
    movedRackOrientation ?? movedRack?.orientation ?? 180;
  const placedWidth = movedRackWidth ?? movedRack?.width ?? RACK_WIDTH_STANDARD;

  const placedFrontDir = getFrontDirection(placedOrientation);
  const placedDims = getEffectiveDimensions(placedWidth, placedOrientation);

  const isInFront = (
    frontDir: { x: number; z: number },
    sourceDims: { effectiveWidth: number; effectiveDepth: number },
    otherDims: { effectiveWidth: number; effectiveDepth: number },
    deltaX: number,
    deltaZ: number,
  ): boolean => {
    if (frontDir.x !== 0) {
      const inFront = frontDir.x > 0 ? deltaX > 0 : deltaX < 0;
      const withinClearance = Math.abs(deltaX) <= CLEARANCE;
      const aligned =
        Math.abs(deltaZ) <
        (sourceDims.effectiveDepth + otherDims.effectiveWidth) / 2;
      if (inFront && withinClearance && aligned) return true;
    }
    if (frontDir.z !== 0) {
      const inFront = frontDir.z > 0 ? deltaZ > 0 : deltaZ < 0;
      const withinClearance = Math.abs(deltaZ) <= CLEARANCE;
      const aligned =
        Math.abs(deltaX) <
        (sourceDims.effectiveWidth + otherDims.effectiveWidth) / 2;
      if (inFront && withinClearance && aligned) return true;
    }
    return false;
  };

  for (const otherRack of racks) {
    if (otherRack.id === movedRackId) continue;

    const otherOrientation = otherRack.orientation ?? 180;
    const otherDims = getEffectiveDimensions(otherRack.width, otherOrientation);
    const deltaToOtherX = otherRack.position[0] - newPos[0];
    const deltaToOtherZ = otherRack.position[1] - newPos[1];

    if (
      isInFront(
        placedFrontDir,
        placedDims,
        otherDims,
        deltaToOtherX,
        deltaToOtherZ,
      )
    ) {
      return true;
    }

    const otherFrontDir = getFrontDirection(otherOrientation);
    const deltaFromOtherX = newPos[0] - otherRack.position[0];
    const deltaFromOtherZ = newPos[1] - otherRack.position[1];

    if (
      isInFront(
        otherFrontDir,
        otherDims,
        placedDims,
        deltaFromOtherX,
        deltaFromOtherZ,
      )
    ) {
      return true;
    }
  }

  return false;
};

export const useStore = create<AppState>((set, get) => ({
  racks: [],
  registeredDevices: [],
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
  activeGroup: "과천" as GroupName,
  importExportModalRackId: null,
  deviceRegistrationModalOpen: false,

  _cameraRef: null,
  _controlsRef: null,

  importedModels: [],
  selectedModelId: null,
  draggingModelId: null,
  modelDragPosition: null,
  modelDragOffset: null,

  setCameraRef: (camera, controls) =>
    set({ _cameraRef: camera, _controlsRef: controls }),
  setHoveredRack: (id) => set({ hoveredRackId: id }),
  setActiveGroup: (group) =>
    set({
      activeGroup: group,
      selectedRackId: null,
      focusedRackId: null,
      selectedDeviceId: null,
    }),
  setImportExportModalRackId: (id) => set({ importExportModalRackId: id }),
  setDeviceRegistrationModalOpen: (open) =>
    set({ deviceRegistrationModalOpen: open }),

  addRegisteredDevice: (deviceData) => {
    const newDevice: RegisteredDevice = {
      ...deviceData,
      id: crypto.randomUUID(),
    };
    set((state) => ({
      registeredDevices: [...state.registeredDevices, newDevice],
    }));
  },

  removeRegisteredDevice: (id) => {
    set((state) => ({
      registeredDevices: state.registeredDevices.filter((d) => d.id !== id),
      racks: state.racks.map((rack) => ({
        ...rack,
        devices: rack.devices.filter((d) => d.registeredDeviceId !== id),
      })),
    }));
  },

  addRack: (uHeight, position, width = RACK_WIDTH_STANDARD) => {
    const { racks, isEditMode, _cameraRef } = get();

    let spawnPos: [number, number];
    if (position) {
      spawnPos = position;
    } else if (_cameraRef) {
      const raycaster = new THREE.Raycaster();
      const center = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(center, _cameraRef);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        const gridX = Math.round((hitPoint.x / GRID_SPACING) * 4) / 4;
        const gridZ = Math.round((hitPoint.z / GRID_SPACING) * 4) / 4;
        spawnPos = [gridX, gridZ];
      } else {
        const dir = new THREE.Vector3();
        _cameraRef.getWorldDirection(dir);
        const fallback = _cameraRef.position.clone().add(dir.multiplyScalar(5));
        const gridX = Math.round((fallback.x / GRID_SPACING) * 4) / 4;
        const gridZ = Math.round((fallback.z / GRID_SPACING) * 4) / 4;
        spawnPos = [gridX, gridZ];
      }
    } else {
      spawnPos = [0, 0];
    }

    let finalPos = spawnPos;
    if (checkCollision(racks, null, spawnPos, width)) {
      let found = false;
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
    }

    const { activeGroup } = get();
    const newRack: Rack = {
      id: crypto.randomUUID(),
      groupName: activeGroup,
      uHeight,
      width,
      position: finalPos,
      orientation: 180,
      devices: [],
    };

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

    let finalPosition = [...newPosition] as [number, number];
    const SNAP_THRESHOLD = 0.5;

    const worldX = newPosition[0] * GRID_SPACING;

    for (const other of racks) {
      if (other.id === id) continue;
      if (Math.abs(other.position[1] - newPosition[1]) > 0.1) continue;

      const otherWorldX = other.position[0] * GRID_SPACING;
      const gap =
        Math.abs(worldX - otherWorldX) - (rack.width + other.width) / 2;

      if (gap >= -0.1 && gap < SNAP_THRESHOLD) {
        const direction = worldX > otherWorldX ? 1 : -1;
        const snappedWorldX =
          otherWorldX + (direction * (other.width + rack.width)) / 2;
        finalPosition[0] = snappedWorldX / GRID_SPACING;
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

    const frontClearanceViolation = checkFrontClearanceViolation(
      racks,
      id,
      rack.position,
      orientation,
      rack.width,
    );

    if (frontClearanceViolation) {
      return;
    }

    set((state) => ({
      racks: state.racks.map((r) => (r.id === id ? { ...r, orientation } : r)),
    }));
  },

  setEditMode: (enabled) => {
    const { isDragging, draggingRackId, dragPosition, endDrag } = get();

    if (!enabled && isDragging && draggingRackId && dragPosition) {
      const gridX = Math.round((dragPosition[0] / GRID_SPACING) * 2) / 2;
      const gridZ = Math.round((dragPosition[1] / GRID_SPACING) * 2) / 2;
      endDrag(draggingRackId, [gridX, gridZ]);
    }

    set({ isEditMode: enabled });
  },

  addDevice: (rackId, deviceData) => {
    const { racks } = get();
    const rack = racks.find((r) => r.id === rackId);
    if (!rack) return false;

    if (
      deviceData.uPosition < 1 ||
      deviceData.uPosition + deviceData.uSize - 1 > rack.uHeight
    ) {
      return false;
    }

    const collision = rack.devices.some((d) => {
      const dStart = d.uPosition;
      const dEnd = d.uPosition + d.uSize - 1;
      const newStart = deviceData.uPosition;
      const newEnd = deviceData.uPosition + deviceData.uSize - 1;
      return dStart <= newEnd && dEnd >= newStart;
    });

    if (collision) {
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

  loadState: (newRacks, newModels, newRegisteredDevices) => {
    const migratedRacks = newRacks.map((r) => ({
      ...r,
      groupName: r.groupName || ("과천" as GroupName),
    }));
    set({
      racks: migratedRacks,
      importedModels: newModels ?? [],
      registeredDevices: newRegisteredDevices ?? [],
      selectedRackId: null,
      focusedRackId: null,
      selectedModelId: null,
    });
  },

  replaceGroupData: (groupName, newRacks, newRegisteredDevices) => {
    set((state) => {
      if (groupName === "ALL") {
        return {
          racks: newRacks,
          registeredDevices: newRegisteredDevices || [],
          selectedRackId: null,
          focusedRackId: null,
          selectedDeviceId: null,
        };
      }
      const otherRacks = state.racks.filter((r) => r.groupName !== groupName);
      const otherRegDevices = state.registeredDevices.filter(
        (d) => d.groupName !== groupName,
      );
      return {
        racks: [...otherRacks, ...newRacks],
        registeredDevices: newRegisteredDevices
          ? [...otherRegDevices, ...newRegisteredDevices]
          : state.registeredDevices,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
      };
    });
  },

  // Imported Model Actions
  addImportedModel: (modelData) => {
    const { _cameraRef, importedModels } = get();
    let spawnPos: [number, number, number] = modelData.position;

    if (
      spawnPos[0] === 0 &&
      spawnPos[1] === 0 &&
      spawnPos[2] === 0 &&
      _cameraRef
    ) {
      const raycaster = new THREE.Raycaster();
      const center = new THREE.Vector2(0, 0);
      raycaster.setFromCamera(center, _cameraRef);
      const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      const hitPoint = new THREE.Vector3();

      if (raycaster.ray.intersectPlane(groundPlane, hitPoint)) {
        const gridX =
          (Math.round((hitPoint.x / GRID_SPACING) * 4) / 4) * GRID_SPACING;
        const gridZ =
          (Math.round((hitPoint.z / GRID_SPACING) * 4) / 4) * GRID_SPACING;
        spawnPos = [gridX, 0, gridZ];
      }
    }

    const newId = crypto.randomUUID();
    const model: ImportedModel = {
      ...modelData,
      id: newId,
      position: spawnPos,
      isMoveEnabled: modelData.isMoveEnabled ?? false,
    };
    set({ importedModels: [...importedModels, model] });
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

  setModelDragging: (modelId, pos = null, offset = null) =>
    set({
      draggingModelId: modelId,
      modelDragPosition: pos,
      modelDragOffset: offset,
    }),

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
      modelDragOffset: null,
    }));
  },

  toggleModelMove: (id) => {
    const state = get();
    const model = state.importedModels.find((m) => m.id === id);
    if (!model) return;

    const newEnabled = !model.isMoveEnabled;

    if (!newEnabled && state.draggingModelId === id) {
      set({
        draggingModelId: null,
        modelDragPosition: null,
        modelDragOffset: null,
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
