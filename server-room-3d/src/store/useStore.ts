import { create } from "zustand";
import type {
  Rack,
  Device,
  ImportedModel,
  HierarchyNode,
  RegisteredDevice,
} from "../types";
import { GRID_SPACING, RACK_WIDTH_STANDARD } from "../components/constants";
import {
  getFrontDirection,
  getEffectiveDimensions,
} from "../utils/rackGeometry";
import { migrateGroupNameToNodeId } from "../utils/nodeUtils";
import * as THREE from "three";
import { layoutsEqual } from "../utils/comparison";

export interface CameraState {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

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
  deviceDeleteConfirm: { id: string; deviceName: string; rackName?: string } | null;
  setDeviceDeleteConfirm: (confirm: { id: string; deviceName: string; rackName?: string } | null) => void;
  highlightedDeviceId: string | null;
  blinkTimeoutId: number | null; // Track current blink timer to clear it if needed
  showEquipmentInTree: boolean;
  preFocusCameraState: CameraState | null;

  // Hierarchy
  nodes: HierarchyNode[];
  activeNodeId: string | null;
  expandedNodeIds: Set<string>;
  isHierarchyCollapsed: boolean;

  // Node-Specific 3D Layouts
  layouts: Record<string, { racks: Rack[]; importedModels: ImportedModel[] }>;

  // Camera reference for viewport-center spawning
  _cameraRef: THREE.Camera | null;
  _controlsRef: any | null;

  // Imported 3D Models
  importedModels: ImportedModel[];
  selectedModelId: string | null;
  draggingModelId: string | null;
  modelDragPosition: [number, number] | null;
  modelDragOffset: [number, number] | null;

  // Toast Notification
  toast: { message: string; type: "success" | "error" } | null;
  showToast: (message: string, type: "success" | "error") => void;

  // Unsaved Changes & Undo
  baselineRacks: Rack[] | null;
  baselineModels: ImportedModel[] | null;
  baselineNodes: HierarchyNode[] | null;
  undoStack: { racks: Rack[]; importedModels: ImportedModel[]; nodes: HierarchyNode[] }[];
  showUnsavedDialog: boolean;
  pendingAction:
    | { type: "node"; value: string | null }
    | { type: "editMode"; value: boolean }
    | null;

  // Editor Transform State
  transformMode: "translate" | "rotate" | "scale";
  setTransformMode: (mode: "translate" | "rotate" | "scale") => void;

  // Actions
  reparentNode: (nodeId: string, newParentId: string | null) => void;
  setCameraRef: (camera: THREE.Camera, controls: any) => void;
  setHoveredRack: (id: string | null) => void;
  setActiveNode: (nodeId: string | null) => void;
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
  setPreFocusCameraState: (state: CameraState | null) => void;
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
  /** Returns { rackId, nodeId, deviceId } if the registeredDeviceId is already mounted somewhere, else null */
  findExistingMount: (registeredDeviceId: string) => { rackId: string; nodeId: string; deviceId: string; rackName?: string } | null;
  updateRack: (
    id: string,
    updates: Partial<Omit<Rack, "id" | "position">>,
  ) => void;

  // Registered Device Management
  setDeviceRegistrationModalOpen: (open: boolean) => void;
  setHighlightedDevice: (id: string | null, duration?: number) => void;
  setShowEquipmentInTree: (show: boolean) => void;
  addRegisteredDevice: (device: Omit<RegisteredDevice, "id">) => void;
  removeRegisteredDevice: (id: string) => void;
  updateRegisteredDevice: (
    id: string,
    updates: Partial<RegisteredDevice>,
  ) => void;
  upsertRegisteredDevices: (devices: Omit<RegisteredDevice, "id">[]) => {
    added: number;
    updated: number;
  };

  // Import/Export flow enhancements
  pendingImportFile: File | null;
  setPendingImportFile: (file: File | null) => void;

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

  // Hierarchy Node Management
  addNode: (node: Omit<HierarchyNode, "nodeId">) => string;
  renameNode: (nodeId: string, name: string) => void;
  deleteNode: (nodeId: string) => void;
  locateDevice: (registeredDeviceId: string) => boolean;
  upsertNodes: (
    nodes: HierarchyNode[],
    overwrite: boolean,
    dryRun?: boolean,
  ) => Record<string, string>;
  setExpandedNodeIds: (ids: Set<string>) => void;
  toggleNodeExpansion: (nodeId: string, expand?: boolean) => void;
  expandNodePath: (nodeId: string | null) => void;
  setHierarchyCollapsed: (collapsed: boolean) => void;
  reorderNode: (nodeId: string, targetNodeId: string, position: "before" | "after" | "inside") => void;

  // Data Persistence
  loadState: (
    racks: Rack[],
    models?: ImportedModel[],
    registeredDevices?: RegisteredDevice[],
    nodes?: HierarchyNode[],
  ) => void;
  replaceNodeData: (
    nodeId: string | "ALL",
    newRacks: Rack[],
    newRegisteredDevices?: RegisteredDevice[],
  ) => void;
  replaceMultipleNodesData: (
    data: Record<
      string,
      { racks: Rack[]; registeredDevices: RegisteredDevice[] }
    >,
  ) => void;

  // Edit Session Actions
  pushUndoState: () => void;
  undo: () => void;
  saveChanges: () => void;
  discardChanges: () => void;
  cancelConfirmation: () => void;
  getIsDirty: () => boolean;
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
  nodes: [],
  activeNodeId: null,
  expandedNodeIds: new Set(),
  isHierarchyCollapsed: false,
  layouts: {},
  importExportModalRackId: null,
  deviceRegistrationModalOpen: false,
  deviceDeleteConfirm: null,
  setDeviceDeleteConfirm: (confirm) => set({ deviceDeleteConfirm: confirm }),
  highlightedDeviceId: null,
  blinkTimeoutId: null,
  showEquipmentInTree: false,
  preFocusCameraState: null,
  pendingImportFile: null,
  setPendingImportFile: (file) => set({ pendingImportFile: file }),

  _cameraRef: null,
  _controlsRef: null,

  importedModels: [],
  selectedModelId: null,
  draggingModelId: null,
  modelDragPosition: null,
  modelDragOffset: null,

  toast: null,
  showToast: (message, type) => {
    set({ toast: { message, type } });
    setTimeout(() => {
      const current = get().toast;
      if (current?.message === message) {
        set({ toast: null });
      }
    }, 3000);
  },

  baselineRacks: null,
  baselineModels: null,
  baselineNodes: null,
  undoStack: [],
  showUnsavedDialog: false,
  pendingAction: null,

  transformMode: "translate",
  setTransformMode: (mode) => set({ transformMode: mode }),

  getIsDirty: () => {
    const { racks, importedModels, nodes, baselineRacks, baselineModels, baselineNodes } = get();
    if (!baselineRacks || !baselineModels || !baselineNodes) return false;

    // Robust field-by-field comparison with epsilon tolerance
    return (
      !layoutsEqual(racks, baselineRacks) ||
      !layoutsEqual(importedModels, baselineModels) ||
      !layoutsEqual(nodes, baselineNodes)
    );
  },

  pushUndoState: () => {
    const { isEditMode, racks, importedModels, nodes, undoStack } = get();
    if (!isEditMode) return;

    const newEntry = {
      racks: JSON.parse(JSON.stringify(racks)),
      importedModels: JSON.parse(JSON.stringify(importedModels)),
      nodes: JSON.parse(JSON.stringify(nodes)),
    };

    set({
      undoStack: [...undoStack, newEntry].slice(-50), // Limit to 50 entries
    });
  },

  undo: () => {
    const { isEditMode, undoStack } = get();
    if (!isEditMode || undoStack.length === 0) return;

    const newStack = [...undoStack];
    const prevState = newStack.pop();

    if (prevState) {
      set({
        racks: prevState.racks,
        importedModels: prevState.importedModels,
        nodes: prevState.nodes,
        undoStack: newStack,
      });
    }
  },

  saveChanges: () => {
    const { pendingAction, racks, importedModels, setActiveNode, setEditMode, activeNodeId } =
      get();

    set((state) => {
      const updatedLayouts = activeNodeId ? {
        ...state.layouts,
        [activeNodeId]: { racks, importedModels }
      } : state.layouts;

      return {
        layouts: updatedLayouts,
        baselineRacks: JSON.parse(JSON.stringify(racks)),
        baselineModels: JSON.parse(JSON.stringify(importedModels)),
        baselineNodes: JSON.parse(JSON.stringify(state.nodes)),
        undoStack: [],
        showUnsavedDialog: false,
        pendingAction: null,
      };
    });

    if (pendingAction) {
      if (pendingAction.type === "node") {
        setActiveNode(pendingAction.value);
      } else if (pendingAction.type === "editMode") {
        setEditMode(pendingAction.value);
      }
    }
  },

  discardChanges: () => {
    const {
      pendingAction,
      baselineRacks,
      baselineModels,
      baselineNodes,
      setActiveNode,
      setEditMode,
      activeNodeId,
    } = get();

    if (baselineRacks && baselineModels && baselineNodes) {
      // Restore from baseline
      set({
        racks: JSON.parse(JSON.stringify(baselineRacks)),
        importedModels: JSON.parse(JSON.stringify(baselineModels)),
        nodes: JSON.parse(JSON.stringify(baselineNodes)),
        undoStack: [],
        showUnsavedDialog: false,
        pendingAction: null,
      });
      
      // If we are discarding while in a node, ensure layouts map is also refreshed if it was used as runtime cache
      if (activeNodeId) {
        set((state) => ({
          layouts: {
            ...state.layouts,
            [activeNodeId]: {
              racks: JSON.parse(JSON.stringify(baselineRacks)),
              importedModels: JSON.parse(JSON.stringify(baselineModels)),
            }
          }
        }));
      }
    } else {
      set({
        undoStack: [],
        showUnsavedDialog: false,
        pendingAction: null,
      });
    }

    if (pendingAction) {
      if (pendingAction.type === "node") {
        setActiveNode(pendingAction.value);
      } else if (pendingAction.type === "editMode") {
        setEditMode(pendingAction.value);
      }
    }
  },

  cancelConfirmation: () => {
    set({ showUnsavedDialog: false, pendingAction: null });
  },

  setCameraRef: (camera, controls) =>
    set({ _cameraRef: camera, _controlsRef: controls }),
  setHoveredRack: (id) => set({ hoveredRackId: id }),
  setActiveNode: (nodeId) => {
    const { isEditMode, getIsDirty, expandNodePath, layouts } = get();

    if (isEditMode && getIsDirty() && nodeId !== get().activeNodeId) {
      set({
        showUnsavedDialog: true,
        pendingAction: { type: "node", value: nodeId },
      });
      return;
    }

    expandNodePath(nodeId);
    
    // Switch Layout
    const newNodeLayout = nodeId ? layouts[nodeId] || { racks: [], importedModels: [] } : { racks: [], importedModels: [] };

    set({
      activeNodeId: nodeId,
      racks: newNodeLayout.racks,
      importedModels: newNodeLayout.importedModels,
      // If in edit mode, the new node's layout becomes the new baseline for dirty checks
      baselineRacks: isEditMode ? JSON.parse(JSON.stringify(newNodeLayout.racks)) : get().baselineRacks,
      baselineModels: isEditMode ? JSON.parse(JSON.stringify(newNodeLayout.importedModels)) : get().baselineModels,
      baselineNodes: isEditMode ? JSON.parse(JSON.stringify(get().nodes)) : get().baselineNodes,
      undoStack: [], // Clear undo stack on node switch to prevent mixing node states
      selectedRackId: null,
      focusedRackId: null,
      selectedDeviceId: null,
      isDragging: false,
      draggingRackId: null,
      dragPosition: null,
      dragOffset: null,
      draggingModelId: null,
      modelDragPosition: null,
      modelDragOffset: null,
      preFocusCameraState: null,
    });
  },
  setImportExportModalRackId: (id) => set({ importExportModalRackId: id }),
  setDeviceRegistrationModalOpen: (open) =>
    set({ deviceRegistrationModalOpen: open }),
  setHighlightedDevice: (id, duration) => {
    const { blinkTimeoutId } = get();
    if (blinkTimeoutId) {
      window.clearTimeout(blinkTimeoutId);
    }

    set({ highlightedDeviceId: id, blinkTimeoutId: null });

    if (id && duration) {
      const timeoutId = window.setTimeout(() => {
        if (get().highlightedDeviceId === id) {
          set({ highlightedDeviceId: null, blinkTimeoutId: null });
        }
      }, duration);
      set({ blinkTimeoutId: timeoutId as unknown as number });
    }
  },

  locateDevice: (registeredDeviceId) => {
    const { layouts, setActiveNode, selectRack, focusRack, setHighlightedDevice } = get();
    
    let foundNodeId: string | null = null;
    let foundRackId: string | null = null;
    let foundDeviceId: string | null = null;

    // Global search across all node layouts
    for (const [nodeId, layout] of Object.entries(layouts)) {
      if (!layout.racks) continue;
      for (const rack of layout.racks) {
        const placed = rack.devices.find(d => d.registeredDeviceId === registeredDeviceId);
        if (placed) {
          foundNodeId = nodeId;
          foundRackId = rack.id;
          foundDeviceId = placed.id;
          break;
        }
      }
      if (foundNodeId) break;
    }

    if (foundNodeId && foundRackId && foundDeviceId) {
      // 1. Switch Node if needed
      if (get().activeNodeId !== foundNodeId) {
        setActiveNode(foundNodeId);
      }
      
      // 2. Select and Focus Rack
      selectRack(foundRackId);
      focusRack(foundRackId);
      
      // 3. Highlight Device
      setHighlightedDevice(foundDeviceId, 2500);
      
      return true;
    }
    
    return false;
  },
  setShowEquipmentInTree: (show) => set({ showEquipmentInTree: show }),

  addRegisteredDevice: (deviceData) => {
    const newDevice: RegisteredDevice = {
      ...deviceData,
      id: crypto.randomUUID(),
    };
    set((state) => ({
      registeredDevices: [...state.registeredDevices, newDevice],
    }));
  },

  updateRegisteredDevice: (id: string, updates: Partial<RegisteredDevice>) => {
    set((state) => {
      const updatedRegDevices = state.registeredDevices.map((d) =>
        d.id === id ? { ...d, ...updates } : d,
      );

      // Also update any placed devices in racks that reference this registered device
      const updatedRacks = state.racks.map((rack) => ({
        ...rack,
        devices: rack.devices.map((device) => {
          if (device.registeredDeviceId === id) {
            return {
              ...device,
              name: updates.deviceName ?? device.name,
              ip: updates.ip ?? device.ip,
              mac: updates.mac ?? device.mac,
              vendor: updates.vendor ?? device.vendor,
              modelName: updates.modelName ?? device.modelName,
              uSize: updates.uSize ?? device.uSize,
            };
          }
          return device;
        }),
      }));

      return {
        registeredDevices: updatedRegDevices,
        racks: updatedRacks,
        layouts: state.activeNodeId ? {
          ...state.layouts,
          [state.activeNodeId]: { ...state.layouts[state.activeNodeId], racks: updatedRacks }
        } : state.layouts
      };
    });
  },

  removeRegisteredDevice: (id) => {
    set((state) => {
      const updatedRacks = state.racks.map((rack) => ({
        ...rack,
        devices: rack.devices.filter((d) => d.registeredDeviceId !== id),
      }));
      return {
        registeredDevices: state.registeredDevices.filter((d) => d.id !== id),
        racks: updatedRacks,
        layouts: state.activeNodeId ? {
          ...state.layouts,
          [state.activeNodeId]: { ...state.layouts[state.activeNodeId], racks: updatedRacks }
        } : state.layouts
      };
    });
  },

  upsertRegisteredDevices: (devices) => {
    let added = 0;
    let updated = 0;

    set((state) => {
      const existing = [...state.registeredDevices];
      devices.forEach((newDev) => {
        // Identity Matching Rule (Strictly Node-Scoped):
        // 1. Same Node + Same MAC (Strong match)
        // 2. Same Node + Same Name + Same IP (Secondary match for attribute updates)
        const matchIdx = existing.findIndex(
          (ex) =>
            ex.nodeId === newDev.nodeId &&
            (ex.mac === newDev.mac ||
              (ex.deviceName === newDev.deviceName && ex.ip === newDev.ip)),
        );

        if (matchIdx >= 0) {
          existing[matchIdx] = { ...existing[matchIdx], ...newDev };
          updated++;
        } else {
          existing.push({ ...newDev, id: crypto.randomUUID() });
          added++;
        }
      });
      return { registeredDevices: existing };
    });

    return { added, updated };
  },

  addRack: (uHeight, position, width = RACK_WIDTH_STANDARD) => {
    const { racks, isEditMode, _cameraRef, pushUndoState } = get();

    if (isEditMode) {
      pushUndoState();
    }

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
        const gridX = Math.round((hitPoint.x / GRID_SPACING) * 15) / 15;
        const gridZ = Math.round((hitPoint.z / GRID_SPACING) * 15) / 15;
        spawnPos = [gridX, gridZ];
      } else {
        const dir = new THREE.Vector3();
        _cameraRef.getWorldDirection(dir);
        const fallback = _cameraRef.position.clone().add(dir.multiplyScalar(5));
        const gridX = Math.round((fallback.x / GRID_SPACING) * 15) / 15;
        const gridZ = Math.round((fallback.z / GRID_SPACING) * 15) / 15;
        spawnPos = [gridX, gridZ];
      }
    } else {
      spawnPos = [0, 0];
    }

    const { activeNodeId } = get();
    if (!activeNodeId) {
      get().showToast("노드를 먼저 선택하거나 생성해주세요.", "error");
      return;
    }
    const nodeRacks = racks.filter((r) => r.nodeId === activeNodeId);

    let finalPos = spawnPos;
    if (checkCollision(nodeRacks, null, spawnPos, width)) {
      let found = false;
      for (let radius = 1; radius <= 20; radius++) {
        for (const dx of [-radius, 0, radius]) {
          for (const dz of [-radius, 0, radius]) {
            if (dx === 0 && dz === 0) continue;
            const candidate: [number, number] = [
              spawnPos[0] + dx * (1/15),
              spawnPos[1] + dz * (1/15),
            ];
            if (!checkCollision(nodeRacks, null, candidate, width)) {
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

    const newRack: Rack = {
      id: crypto.randomUUID(),
      nodeId: activeNodeId!,
      uHeight,
      width,
      position: finalPos,
      orientation: 180,
      devices: [],
    };

    if (isEditMode) {
      set((state) => ({
        racks: [...state.racks, newRack],
        selectedRackId: newRack.id,
        layouts: activeNodeId ? {
          ...state.layouts,
          [activeNodeId]: { ...state.layouts[activeNodeId] || { racks: [], importedModels: [] }, racks: [...state.racks, newRack] }
        } : state.layouts
      }));
    } else {
      set((state) => ({
        racks: [...state.racks, newRack],
        layouts: activeNodeId ? {
          ...state.layouts,
          [activeNodeId]: { ...state.layouts[activeNodeId] || { racks: [], importedModels: [] }, racks: [...state.racks, newRack] }
        } : state.layouts
      }));
    }
  },

  moveRack: (id, newPosition) => {
    const { racks, showToast } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) return false;

    const nodeRacks = racks.filter((r) => r.nodeId === rack.nodeId);

    if (
      checkCollision(nodeRacks, id, newPosition, rack.width, rack.orientation)
    ) {
      showToast("겹치는 위치에는 렉을 배치할 수 없습니다.", "error");
      return false;
    }

    const updatedRacks = racks.map((r) =>
      r.id === id ? { ...r, position: newPosition } : r,
    );
    set((state) => ({
      racks: updatedRacks,
      layouts: rack.nodeId ? {
        ...state.layouts,
        [rack.nodeId]: { ...state.layouts[rack.nodeId], racks: updatedRacks }
      } : state.layouts
    }));
    return true;
  },

  deleteRack: (id) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedRacks = state.racks.filter((r) => r.id !== id);
      const rackToDelete = state.racks.find(r => r.id === id);
      const nid = rackToDelete?.nodeId;

      return {
        racks: updatedRacks,
        selectedRackId: state.selectedRackId === id ? null : state.selectedRackId,
        focusedRackId: state.focusedRackId === id ? null : state.focusedRackId,
        layouts: nid ? {
          ...state.layouts,
          [nid]: { ...state.layouts[nid], racks: updatedRacks }
        } : state.layouts
      };
    });
  },

  selectRack: (id) => {
    const state = get();
    if (state.isDragging && state.draggingRackId && state.dragPosition) {
      const gridX = Math.round((state.dragPosition[0] / GRID_SPACING) * 15) / 15;
      const gridZ = Math.round((state.dragPosition[1] / GRID_SPACING) * 15) / 15;
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
  focusRack: (id) => {
    const { _cameraRef, _controlsRef, preFocusCameraState } = get();
    
    // Capture state if starting focus and no state is saved yet
    if (id && !preFocusCameraState && _cameraRef && _controlsRef) {
      const pos = _cameraRef.position;
      const target = (_controlsRef as any).target;
      set({
        preFocusCameraState: {
          position: [pos.x, pos.y, pos.z],
          target: [target.x, target.y, target.z],
          zoom: (_cameraRef as any).zoom ?? 1,
        },
      });
    }

    set({ focusedRackId: id });
  },
  setPreFocusCameraState: (state) => set({ preFocusCameraState: state }),
  setDragging: (isDragging, rackId = null, offset = null) =>
    set({
      isDragging,
      draggingRackId: isDragging ? rackId : null,
      dragOffset: offset,
    }),
  updateDragPosition: (pos) => set({ dragPosition: pos }),

  endDrag: (id, newPosition) => {
    const { racks, isEditMode, pushUndoState } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) return false;

    let finalPosition = [...newPosition] as [number, number];
    const SNAP_THRESHOLD = 0.5;

    const worldX = newPosition[0] * GRID_SPACING;
    const nodeRacks = racks.filter((r) => r.nodeId === rack.nodeId);

    for (const other of nodeRacks) {
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
      nodeRacks,
      id,
      finalPosition,
      rack.width,
      rack.orientation,
    );
    const frontClearanceViolation = checkFrontClearanceViolation(
      nodeRacks,
      id,
      finalPosition,
      rack.orientation,
      rack.width,
    );

    if (colliding || frontClearanceViolation) {
      if (colliding) {
        get().showToast("다른 렉과 겹쳐서 배치할 수 없습니다.", "error");
      } else {
        get().showToast("앞쪽 유지보수 공간이 부족합니다.", "error");
      }
      set({
        isDragging: false,
        draggingRackId: null,
        dragPosition: null,
        dragOffset: null,
      });
      return false;
    }

    const hasMoved = !layoutsEqual(rack.position, finalPosition);

    if (hasMoved && isEditMode) {
      pushUndoState();
    }

    const newRacks = hasMoved
      ? racks.map((r) => (r.id === id ? { ...r, position: finalPosition } : r))
      : racks;

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
    const { racks, showToast, isEditMode, pushUndoState } = get();
    const rack = racks.find((r) => r.id === id);
    if (!rack) return;

    if (rack.orientation === orientation) return;

    if (isEditMode) pushUndoState();

    const nodeRacks = racks.filter((r) => r.nodeId === rack.nodeId);

    const frontClearanceViolation = checkFrontClearanceViolation(
      nodeRacks,
      id,
      rack.position,
      orientation,
      rack.width,
    );

    if (frontClearanceViolation) {
      showToast("해당 방향은 앞쪽 유지보수 공간이 부족합니다.", "error");
      return;
    }

    set((state) => {
      const updatedRacks = state.racks.map((r) => (r.id === id ? { ...r, orientation } : r));
      return {
        racks: updatedRacks,
        layouts: rack.nodeId ? {
          ...state.layouts,
          [rack.nodeId]: { ...state.layouts[rack.nodeId], racks: updatedRacks }
        } : state.layouts
      };
    });
  },

  setEditMode: (enabled) => {
    const {
      isDragging,
      draggingRackId,
      dragPosition,
      endDrag,
      getIsDirty,
      racks,
      importedModels,
    } = get();

    if (enabled) {
      // Entering Edit Mode: Snapshot current state as baseline
      set({
        baselineRacks: JSON.parse(JSON.stringify(racks)),
        baselineModels: JSON.parse(JSON.stringify(importedModels)),
        baselineNodes: JSON.parse(JSON.stringify(get().nodes)),
        undoStack: [],
        isEditMode: true,
      });
      return;
    }

    // Exiting Edit Mode
    if (getIsDirty()) {
      set({
        showUnsavedDialog: true,
        pendingAction: { type: "editMode", value: false },
      });
      return;
    }

    if (isDragging && draggingRackId && dragPosition) {
      const gridX = Math.round((dragPosition[0] / GRID_SPACING) * 15) / 15;
      const gridZ = Math.round((dragPosition[1] / GRID_SPACING) * 15) / 15;
      endDrag(draggingRackId, [gridX, gridZ]);
    }

    set({
      isEditMode: false,
      baselineRacks: null,
      baselineModels: null,
      undoStack: [],
    });
  },

  addDevice: (rackId, deviceData) => {
    const { racks, isEditMode, pushUndoState } = get();
    const rack = racks.find((r) => r.id === rackId);
    if (!rack) return false;

    if (isEditMode) pushUndoState();

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

    // Single-mount enforcement: block if already mounted anywhere in all layouts
    if (deviceData.registeredDeviceId) {
      const alreadyMounted = get().findExistingMount(deviceData.registeredDeviceId);
      if (alreadyMounted && alreadyMounted.rackId !== rackId) {
        // Caller must handle remount flow; store blocks silently
        return false;
      }
    }

    const newDevice: Device = {
      ...deviceData,
      id: crypto.randomUUID(),
      portStates: deviceData.portStates || [],
    };

    const updatedRacks = racks.map((r) =>
      r.id === rackId ? { ...r, devices: [...r.devices, newDevice] } : r,
    );
    set((state) => ({
      racks: updatedRacks,
      layouts: rack.nodeId ? {
        ...state.layouts,
        [rack.nodeId]: { ...state.layouts[rack.nodeId], racks: updatedRacks }
      } : state.layouts
    }));
    return true;
  },

  findExistingMount: (registeredDeviceId) => {
    const { racks, layouts } = get();
    // Search active racks (current node)
    for (const rack of racks) {
      const found = rack.devices.find((d) => d.registeredDeviceId === registeredDeviceId);
      if (found) {
        return {
          rackId: rack.id,
          nodeId: rack.nodeId,
          deviceId: found.id,
          rackName: rack.displayName || `Rack-${rack.id.slice(0, 4).toUpperCase()}`,
        };
      }
    }
    // Search all layouts (other nodes)
    for (const [nodeId, layout] of Object.entries(layouts)) {
      if (!layout.racks) continue;
      for (const rack of layout.racks) {
        const found = rack.devices.find((d) => d.registeredDeviceId === registeredDeviceId);
        if (found) {
          return {
            rackId: rack.id,
            nodeId,
            deviceId: found.id,
            rackName: rack.displayName || `Rack-${rack.id.slice(0, 4).toUpperCase()}`,
          };
        }
      }
    }
    return null;
  },


  removeDevice: (rackId, deviceId) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      // Helper to remove device from a rack list
      const updateRacksList = (rList: Rack[]) =>
        rList.map((r) =>
          r.id === rackId
            ? { ...r, devices: r.devices.filter((d) => d.id !== deviceId) }
            : r,
        );

      // Update current active racks
      const updatedRacks = updateRacksList(state.racks);

      // Update all layouts to ensure data integrity
      const updatedLayouts = { ...state.layouts };
      for (const [nid, layout] of Object.entries(updatedLayouts)) {
        if (layout.racks?.some((r) => r.id === rackId)) {
          updatedLayouts[nid] = {
            ...layout,
            racks: updateRacksList(layout.racks),
          };
          // Note: multiple layouts shouldn't have the same rackId, but we update all just in case
        }
      }

      return {
        racks: updatedRacks,
        layouts: updatedLayouts,
      };
    });
  },

  updateRack: (id, updates) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedRacks = state.racks.map((r) => (r.id === id ? { ...r, ...updates } : r));
      const rack = state.racks.find(r => r.id === id);
      const nid = rack?.nodeId;

      return {
        racks: updatedRacks,
        layouts: nid ? {
          ...state.layouts,
          [nid]: { ...state.layouts[nid], racks: updatedRacks }
        } : state.layouts
      };
    });
  },

  loadState: (newRacks, newModels, newRegisteredDevices, newNodes) => {
    // Migration: groupName → nodeId
    const migratedRacks = newRacks.map((r) => ({
      ...r,
      nodeId:
        r.nodeId || migrateGroupNameToNodeId((r as any).groupName || "과천"),
    }));
    const migratedRegDevices = (newRegisteredDevices ?? []).map((d) => ({
      ...d,
      nodeId:
        d.nodeId || migrateGroupNameToNodeId((d as any).groupName || "과천"),
    }));
    const finalNodes = newNodes && newNodes.length > 0 ? newNodes : [];
    const rootNode = finalNodes.find((n) => n.parentId === null);

    const expandedNodeIds = new Set<string>();
    if (rootNode) expandedNodeIds.add(rootNode.nodeId);

    const activeNodeId = rootNode
      ? rootNode.nodeId
      : finalNodes.length > 0
        ? finalNodes[0].nodeId
        : null;

    // Group racks and models by nodeId
    const layouts: Record<string, { racks: Rack[]; importedModels: ImportedModel[] }> = {};
    
    migratedRacks.forEach(r => {
      if (!layouts[r.nodeId]) layouts[r.nodeId] = { racks: [], importedModels: [] };
      layouts[r.nodeId].racks.push(r);
    });
    
    (newModels ?? []).forEach(m => {
      // If model doesn't have nodeId, we might need a default or use active one.
      // For now assume they have them or assign to active if missing
      const nid = (m as any).nodeId || activeNodeId;
      if (nid) {
        if (!layouts[nid]) layouts[nid] = { racks: [], importedModels: [] };
        layouts[nid].importedModels.push(m);
      }
    });

    const activeLayout = activeNodeId ? layouts[activeNodeId] || { racks: [], importedModels: [] } : { racks: [], importedModels: [] };

    set({
      layouts,
      racks: activeLayout.racks,
      importedModels: activeLayout.importedModels,
      registeredDevices: migratedRegDevices,
      nodes: finalNodes,
      activeNodeId,
      expandedNodeIds,
      selectedRackId: null,
      focusedRackId: null,
      selectedModelId: null,
    });
  },

  replaceNodeData: (nodeId, newRacks, newRegisteredDevices) => {
    set((state) => {
      if (nodeId === "ALL") {
        // Handle ALL - ideally we should group newRacks by nodeId
        const newLayouts: Record<string, { racks: Rack[]; importedModels: ImportedModel[] }> = {};
        newRacks.forEach(r => {
          if (!newLayouts[r.nodeId]) newLayouts[r.nodeId] = { racks: [], importedModels: [] };
          newLayouts[r.nodeId].racks.push(r);
        });
        
        const activeLayout = state.activeNodeId ? newLayouts[state.activeNodeId] || { racks: [], importedModels: [] } : { racks: [], importedModels: [] };

        return {
          layouts: newLayouts,
          racks: activeLayout.racks,
          importedModels: activeLayout.importedModels,
          registeredDevices: newRegisteredDevices || [],
          selectedRackId: null,
          focusedRackId: null,
          selectedDeviceId: null,
        };
      }
      
      const otherRegDevices = state.registeredDevices.filter(
        (d) => d.nodeId !== nodeId,
      );
      
      const updatedLayouts = {
        ...state.layouts,
        [nodeId]: {
          racks: newRacks,
          importedModels: state.layouts[nodeId]?.importedModels || []
        }
      };
      
      const isCurrentNode = state.activeNodeId === nodeId;

      return {
        layouts: updatedLayouts,
        racks: isCurrentNode ? newRacks : state.racks,
        registeredDevices: newRegisteredDevices
          ? [...otherRegDevices, ...newRegisteredDevices]
          : state.registeredDevices,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
      };
    });
  },

  replaceMultipleNodesData: (data) => {
    set((state) => {
      let updatedRegDevices = [...state.registeredDevices];
      let updatedLayouts = { ...state.layouts };

      Object.entries(data).forEach(([nodeId, nodeData]) => {
        updatedRegDevices = updatedRegDevices.filter(
          (d) => d.nodeId !== nodeId,
        );
        updatedRegDevices.push(...nodeData.registeredDevices);
        
        updatedLayouts[nodeId] = {
          racks: nodeData.racks,
          importedModels: updatedLayouts[nodeId]?.importedModels || []
        };
      });

      const activeLayout = state.activeNodeId ? updatedLayouts[state.activeNodeId] || { racks: [], importedModels: [] } : { racks: [], importedModels: [] };

      return {
        layouts: updatedLayouts,
        racks: activeLayout.racks,
        importedModels: activeLayout.importedModels,
        registeredDevices: updatedRegDevices,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
      };
    });
  },

  // Hierarchy Node Management
  addNode: (nodeData) => {
    const { isEditMode, pushUndoState, nodes } = get();
    if (isEditMode) pushUndoState();
    const newId = `node-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Auto-calculate order if not provided
    let finalOrder = nodeData.order;
    if (finalOrder === undefined) {
      const siblings = nodes.filter(n => n.parentId === nodeData.parentId);
      finalOrder = siblings.length > 0 
        ? Math.max(...siblings.map(s => s.order)) + 1 
        : 0;
    }

    const newNode: HierarchyNode = { 
      ...nodeData, 
      nodeId: newId,
      order: finalOrder
    };
    
    set((state) => ({ nodes: [...state.nodes, newNode] }));
    console.log(`[useStore] Node added: ${newNode.name} (${newId})`);
    return newId;
  },

  renameNode: (nodeId, name) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => ({
      nodes: state.nodes.map((n) => (n.nodeId === nodeId ? { ...n, name } : n)),
    }));
  },

  deleteNode: (nodeId) => {
    const { isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      // 1. Delete node and descendant hierarchy structurally
      const toDelete = new Set<string>();
      const queue = [nodeId];
      while (queue.length > 0) {
        const curr = queue.shift()!;
        toDelete.add(curr);
        state.nodes.forEach((n) => {
          if (n.parentId === curr) queue.push(n.nodeId);
        });
      }

      // 2. But for data isolation, only clean data bound *exactly* to nodes being structurally deleted.
      const updatedLayouts = { ...state.layouts };
      toDelete.forEach(id => delete updatedLayouts[id]);

      return {
        nodes: state.nodes.filter((n) => !toDelete.has(n.nodeId)),
        racks: state.racks.filter((r) => !toDelete.has(r.nodeId)),
        registeredDevices: state.registeredDevices.filter(
          (d) => !toDelete.has(d.nodeId),
        ),
        layouts: updatedLayouts,
        activeNodeId:
          state.activeNodeId && toDelete.has(state.activeNodeId)
            ? state.nodes.find((n) => n.parentId === null)?.nodeId || null
            : state.activeNodeId,
      };
    });
  },

  setExpandedNodeIds: (ids) => set({ expandedNodeIds: ids }),
  toggleNodeExpansion: (nodeId, expand) => {
    set((state) => {
      const next = new Set(state.expandedNodeIds);
      const shouldExpand = expand !== undefined ? expand : !next.has(nodeId);

      if (shouldExpand) {
        next.add(nodeId);
      } else {
        next.delete(nodeId);
      }
      return { expandedNodeIds: next };
    });
  },
  expandNodePath: (nodeId) => {
    if (!nodeId) return;
    set((state) => {
      const next = new Set(state.expandedNodeIds);
      const { nodes } = state;
      let curr = nodes.find((n) => n.nodeId === nodeId);
      next.add(nodeId);
      while (curr && curr.parentId) {
        next.add(curr.parentId);
        curr = nodes.find((n) => n.nodeId === curr?.parentId);
      }
      return { expandedNodeIds: next };
    });
  },
  setHierarchyCollapsed: (collapsed) =>
    set({ isHierarchyCollapsed: collapsed }),

  reorderNode: (nodeId, targetNodeId, position) => {
    const { isEditMode, pushUndoState } = get();
    if (nodeId === targetNodeId) return;

    if (isEditMode) pushUndoState();

    set((state) => {
      const sourceNode = state.nodes.find((n) => n.nodeId === nodeId);
      const targetNode = state.nodes.find((n) => n.nodeId === targetNodeId);

      if (!sourceNode || !targetNode) return state;

      // Circularity check: node cannot be parent of its own ancestor
      const getDescendants = (id: string): string[] => {
        const children = state.nodes.filter(n => n.parentId === id);
        return [id, ...children.flatMap(c => getDescendants(c.nodeId))];
      }
      if (getDescendants(nodeId).includes(targetNodeId)) {
        return state;
      }

      let newParentId: string | null = null;
      let newOrder = 0;

      if (position === "inside") {
        newParentId = targetNodeId;
        const siblings = state.nodes.filter((n) => n.parentId === newParentId);
        newOrder = siblings.length > 0 ? Math.max(...siblings.map((s) => s.order)) + 1 : 0;
      } else {
        newParentId = targetNode.parentId;
        newOrder = position === "before" ? targetNode.order : targetNode.order + 1;
      }

      // Re-assign orders for all siblings
      const updatedNodes = state.nodes.map((n) => {
        if (n.nodeId === nodeId) {
          return { ...n, parentId: newParentId, order: newOrder };
        }
        
        // If moving within same parent or into new parent
        if (n.parentId === newParentId) {
          if (n.nodeId !== nodeId) {
            if (n.order >= newOrder) {
              return { ...n, order: n.order + 1 };
            }
          }
        }
        return n;
      });

      // Optional: normalization of orders to 0, 1, 2...
      const normalizeOrders = (nodes: HierarchyNode[], pId: string | null) => {
        const parentSiblings = nodes
          .filter(n => n.parentId === pId)
          .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
        
        parentSiblings.forEach((s, idx) => {
          const match = nodes.find(n => n.nodeId === s.nodeId);
          if (match) match.order = idx;
        });
      };

      // Normalize for both old parent and new parent
      const finalNodes = [...updatedNodes];
      normalizeOrders(finalNodes, sourceNode.parentId);
      normalizeOrders(finalNodes, newParentId);

      return { nodes: finalNodes };
    });
  },

  upsertNodes: (newNodes, overwrite, dryRun = false) => {
    const mapping: Record<string, string> = {};
    const process = (stateNodes: HierarchyNode[]) => {
      const updatedNodes = [...stateNodes];

      newNodes.forEach((n) => {
        mapping[n.nodeId] = n.nodeId;
        const matchIdx = updatedNodes.findIndex((ex) => ex.nodeId === n.nodeId);
        if (matchIdx >= 0) {
          if (overwrite) {
            updatedNodes[matchIdx] = { ...updatedNodes[matchIdx], ...n };
          }
        } else {
          const duplicateIdx = updatedNodes.findIndex(
            (ex) => ex.parentId === n.parentId && ex.name === n.name,
          );
          if (duplicateIdx >= 0) {
            mapping[n.nodeId] = updatedNodes[duplicateIdx].nodeId;
            if (overwrite) {
              updatedNodes[duplicateIdx] = {
                ...updatedNodes[duplicateIdx],
                ...n,
                nodeId: updatedNodes[duplicateIdx].nodeId,
              };
            }
          } else {
            updatedNodes.push(n);
          }
        }
      });
      return updatedNodes;
    };

    if (dryRun) {
      process(get().nodes);
    } else {
      set((state) => ({ nodes: process(state.nodes) }));
    }
    return mapping;
  },

  // Imported Model Actions
  addImportedModel: (modelData) => {
    const { _cameraRef, isEditMode, pushUndoState } = get();
    if (isEditMode) pushUndoState();
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
    const activeNodeId = get().activeNodeId;
    const model: ImportedModel = {
      ...modelData,
      id: newId,
      position: spawnPos,
      isMoveEnabled: modelData.isMoveEnabled ?? false,
    };
    
    set((state) => {
      const updatedModels: ImportedModel[] = [...state.importedModels, model];
      return {
        importedModels: updatedModels,
        layouts: activeNodeId ? {
          ...state.layouts,
          [activeNodeId]: { ...state.layouts[activeNodeId] || { racks: [], importedModels: [] }, importedModels: updatedModels }
        } : state.layouts
      };
    });
    return newId;
  },

  selectModel: (id) =>
    set({
      selectedModelId: id,
      selectedRackId: id ? null : undefined,
      focusedRackId: null,
      selectedDeviceId: null,
    }),

  deleteModel: (id) => {
    const { isEditMode, pushUndoState, activeNodeId } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedModels: ImportedModel[] = state.importedModels.filter((m) => m.id !== id);
      return {
        importedModels: updatedModels,
        selectedModelId:
          state.selectedModelId === id ? null : state.selectedModelId,
        layouts: activeNodeId ? {
          ...state.layouts,
          [activeNodeId]: { ...state.layouts[activeNodeId] || { racks: [], importedModels: [] }, importedModels: updatedModels }
        } : state.layouts
      };
    });
  },

  updateModel: (id, updates) => {
    const { isEditMode, pushUndoState, activeNodeId } = get();
    if (isEditMode) pushUndoState();
    set((state) => {
      const updatedModels: ImportedModel[] = state.importedModels.map((m) =>
        m.id === id ? { ...m, ...updates } : m,
      );
      return {
        importedModels: updatedModels,
        layouts: activeNodeId ? {
          ...state.layouts,
          [activeNodeId]: { ...state.layouts[activeNodeId] || { racks: [], importedModels: [] }, importedModels: updatedModels }
        } : state.layouts
      };
    });
  },

  setModelDragging: (modelId, pos = null, offset = null) =>
    set({
      draggingModelId: modelId,
      modelDragPosition: pos,
      modelDragOffset: offset,
    }),

  updateModelDragPosition: (pos) => set({ modelDragPosition: pos }),

  endModelDrag: (id, position) => {
    const { isEditMode, pushUndoState, activeNodeId, importedModels } = get();
    const model = importedModels.find((m) => m.id === id);
    if (!model) return;

    const finalPos: [number, number, number] = [position[0], model.position[1], position[1]];
    const hasMoved = !layoutsEqual(model.position, finalPos);

    if (hasMoved && isEditMode) {
      pushUndoState();
    }

    set((state) => {
      const updatedModels: ImportedModel[] = hasMoved 
        ? state.importedModels.map((m) => m.id === id ? { ...m, position: finalPos } : m)
        : state.importedModels;
      
      return {
        importedModels: updatedModels,
        draggingModelId: null,
        modelDragPosition: null,
        modelDragOffset: null,
        layouts: activeNodeId ? {
          ...state.layouts,
          [activeNodeId]: { ...state.layouts[activeNodeId] || { racks: [], importedModels: [] }, importedModels: updatedModels }
        } : state.layouts
      };
    });
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

    set((s) => {
      const updatedModels: ImportedModel[] = s.importedModels.map((m) =>
        m.id === id ? { ...m, isMoveEnabled: newEnabled } : m,
      );
      const activeNodeId = s.activeNodeId;
      return {
        importedModels: updatedModels,
        layouts: activeNodeId ? {
          ...s.layouts,
          [activeNodeId]: { ...s.layouts[activeNodeId] || { racks: [], importedModels: [] }, importedModels: updatedModels }
        } : s.layouts
      };
    });
  },

  reparentNode: (nodeId, newParentId) => {
    const { nodes, isEditMode, pushUndoState } = get();
    
    // Safety Checks
    if (nodeId === newParentId) return;
    
    // Check if newParentId is a descendant of nodeId (to prevent circularity)
    // getSubtreeNodeIds already includes nodeId
    const subtreeIds = new Set<string>();
    const stack = [nodeId];
    while (stack.length > 0) {
      const curr = stack.pop()!;
      subtreeIds.add(curr);
      nodes.forEach(n => {
        if (n.parentId === curr) stack.push(n.nodeId);
      });
    }
    
    if (newParentId && subtreeIds.has(newParentId)) {
      get().showToast("Cannot move a node under its own descendant.", "error");
      return;
    }

    if (isEditMode) pushUndoState();

    set((state) => {
      // Find new order: max(order of siblings) + 1
      const siblings = state.nodes.filter(n => n.parentId === newParentId);
      const newOrder = siblings.length > 0 ? Math.max(...siblings.map(s => s.order)) + 1 : 0;

      const updatedNodes = state.nodes.map((n) => {
        if (n.nodeId === nodeId) {
          return { ...n, parentId: newParentId, order: newOrder };
        }
        return n;
      });

      return { nodes: updatedNodes };
    });
  },
}));
