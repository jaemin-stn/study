import type { Rack, RegisteredDevice, HierarchyNode, Device } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
import { 
  getDefaultNodes, 
  migrateGroupNameToNodeId,
  getNodeName, 
  getNodeDepth, 
  getFullPath,
  resolvePathToNodeId,
  getAncestorPath,
  getSubtreeNodeIds,
  isLeafNode,
  GWACHEON_NODE_ID,
  NONE_NODE_ID
} from "./nodeUtils";
import * as XLSX from "xlsx";
import {
  RACK_WIDTH_STANDARD,
  RACK_WIDTH_WIDE,
  GRID_SPACING,
} from "../components/constants";

/** Data Flattening Helpers (Unified) */

const flattenRacks = (racks: Rack[], nodes?: HierarchyNode[]) =>
  racks.map((r) => ({
    rackId: r.rackId,
    rackName: r.rackTitle || r.rackId.substring(0, 8),
    nodeId: r.mapId,
    ...(nodes && {
      groupName: getNodeName(nodes, r.mapId),
      depth: getNodeDepth(nodes, r.mapId),
      nodePath: getFullPath(nodes, r.mapId),
    }),
    rackSize: r.rackSize,
    width: r.width,
    posX: r.position[0],
    posZ: r.position[1],
    orientation: r.orientation ?? 180,
  }));

const flattenDevices = (racks: Rack[], nodes?: HierarchyNode[], registeredDevices?: RegisteredDevice[]) => {
  const rows: Record<string, unknown>[] = [];
  for (const r of racks) {
    for (const d of r.devices) {
      const regDev = registeredDevices?.find((rd) => rd.deviceId === d.deviceId);
      rows.push({
        itemId: d.itemId,
        deviceId: d.deviceId,
        title: regDev ? regDev.title : d.title,
        rackId: r.rackId,
        rackName: r.rackTitle || r.rackId.substring(0, 8),
        nodeId: r.mapId,
        ...(nodes && {
          groupName: getNodeName(nodes, r.mapId),
          depth: getNodeDepth(nodes, r.mapId),
          nodePath: getFullPath(nodes, r.mapId),
        }),
        type: d.type,
        size: d.size,
        position: d.position,
        
        modelName: d.modelName || "",
        IPAddr: d.IPAddr || "",
        macAddr: d.macAddr || "",
        vendor: d.vendor || "",
      });
    }
  }
  return rows;
};

const flattenPorts = (racks: Rack[], nodes?: HierarchyNode[], registeredDevices?: RegisteredDevice[]) => {
  const rows: Record<string, unknown>[] = [];
  for (const r of racks) {
    for (const d of r.devices) {
      const regDev = registeredDevices?.find((rd) => rd.deviceId === d.deviceId);
      for (const p of d.portStates) {
        rows.push({
          portId: p.portId,
          deviceId: d.deviceId,
          title: regDev ? regDev.title : d.title,
          rackId: r.rackId,
          rackName: r.rackTitle || r.rackId.substring(0, 8),
          nodeId: r.mapId,
          ...(nodes && {
            groupName: getNodeName(nodes, r.mapId),
          }),
          status: p.status,
          errorLevel: p.errorLevel || "",
          errorMessage: p.errorMessage || "",
        });
      }
    }
  }
  return rows;
};

/** Trigger a browser download for a Blob */
const downloadBlob = (blob: Blob, filename: string) => {
  if (typeof window === "undefined") return;
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.style.display = "none";
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  // Use a longer timeout to ensure the browser registers the download with the filename
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 2000);
};

/** UUID fallback helper */
const generateUUID = () => {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return (
    Math.random().toString(36).substring(2, 12) +
    Math.random().toString(36).substring(2, 12)
  );
};

/** yyyy_mm_dd format for filenames */
const getFormattedDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}_${m}_${d}`;
};

const EXCEL_MIME =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// ─── Export Functions ────────────────────────────────────────────────────────

/** Prepare (optionally filtered) rows from a set of racks */
const prepareExportData = (racks: Rack[], options?: ExportOptions) => {
  const rackRaw = flattenRacks(racks);
  const deviceRaw = flattenDevices(racks);
  const portRaw = flattenPorts(racks);

  return {
    rackData: options ? filterData(rackRaw, options.rack) : rackRaw,
    deviceData: options ? filterData(deviceRaw, options.device) : deviceRaw,
    portData: options ? filterData(portRaw, options.port) : portRaw,
  };
};

export const saveToJSON = (
  racks: Rack[],
  options?: ExportOptions,
  filename?: string,
) => {
  const { rackData, deviceData, portData } = prepareExportData(racks, options);
  const json = JSON.stringify(
    { Rack: rackData, Equipment: deviceData, Ports: portData },
    null,
    2,
  );
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    filename || `server-room-${Date.now()}.json`,
  );
};

export const loadFromJSON = (file: File): Promise<Rack[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (Array.isArray(json)) {
          resolve(json as Rack[]);
        } else {
          reject(new Error("Invalid JSON format"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export interface ExportOptions {
  rack: string[];
  device: string[];
  port: string[];
}

const filterData = (data: any[], selectedFields: string[]) => {
  if (selectedFields.length === 0) return [];
  return data.map((item) => {
    const filtered: any = {};
    selectedFields.forEach((field) => {
      if (item.hasOwnProperty(field)) {
        filtered[field] = item[field];
      }
    });
    return filtered;
  });
};

export const saveToExcel = (
  racks: Rack[],
  options?: ExportOptions,
  filename?: string,
) => {
  const { rackData, deviceData, portData } = prepareExportData(racks, options);
  const wb = XLSX.utils.book_new();
  if (rackData.length > 0)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rackData), "Rack");
  if (deviceData.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(deviceData),
      "Equipment",
    );
  if (portData.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(portData),
      "Ports",
    );
  try {
    const u8 = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([u8], { type: EXCEL_MIME });
    downloadBlob(blob, filename || `ALL_${getFormattedDate()}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
  }
};

export const loadFromExcel = (file: File): Promise<Rack[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const rackSheet = workbook.Sheets["Rack"];
        const deviceSheet = workbook.Sheets["Equipment"];
        const portSheet = workbook.Sheets["Ports"];

        if (!rackSheet) throw new Error('Sheet "Rack" not found');

        const racksFlat = XLSX.utils.sheet_to_json(rackSheet) as Record<
          string,
          unknown
        >[];
        const devicesFlat = deviceSheet
          ? (XLSX.utils.sheet_to_json(deviceSheet) as Record<string, unknown>[])
          : [];
        const portsFlat = portSheet
          ? (XLSX.utils.sheet_to_json(portSheet) as Record<string, unknown>[])
          : [];

        const racks = racksFlat.map((r) => {
          const rackDevices = devicesFlat
            .filter((d) => d.rackId === r.rackId)
            .map((d) => {
              const devicePorts = portsFlat
                .filter((p) => p.deviceId === d.deviceId)
                .map((p) => ({
                  portId: String(p.portId),
                  status: p.status as "normal" | "error",
                  errorLevel: (p.errorLevel as any) || undefined,
                  errorMessage: (p.errorMessage as any) || undefined,
                }));

              return {
                itemId: d.deviceId,
                title: d.title,
                type: d.type,
                size: Number(d.size),
                position: Number(d.position),
                imageUrl: d.imageUrl || undefined,
                portStates: devicePorts,
              };
            });

          return {
            rackId: r.rackId as string,
            mapId: (r.mapId as string) || migrateGroupNameToNodeId((r as any).groupName || "과천"),
            rackSize: Number(r.rackSize) as 24 | 32 | 48,
            width: Number(r.width || RACK_WIDTH_STANDARD),
            position: [Number(r.posX), Number(r.posZ)] as [number, number],
            orientation: Number(r.orientation) as 0 | 90 | 180 | 270,
            devices: rackDevices as any,
          };
        });

        resolve(racks);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export const saveRackToJSON = (rack: Rack, options?: ExportOptions) => {
  const filename = `rack-${rack.rackTitle || rack.rackId.substring(0, 8)}-${Date.now()}.json`;
  saveToJSON([rack], options, filename);
};

export const loadRackFromJSON = (file: File): Promise<Rack> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json && typeof json === "object" && !Array.isArray(json)) {
          resolve(json as Rack);
        } else {
          reject(new Error("Invalid JSON format for single rack"));
        }
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
};

export const saveRackToExcel = (rack: Rack, options?: ExportOptions) => {
  const label = (rack.rackTitle || rack.rackId.substring(0, 8)).replace(/[\s\>]+/g, "_");
  const filename = `${label}_${getFormattedDate()}.xlsx`;
  saveToExcel([rack], options, filename);
};

export const loadRackFromExcel = (file: File): Promise<Partial<Rack>> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const rackSheet = workbook.Sheets["Rack"];
        const deviceSheet = workbook.Sheets["Equipment"];
        const portSheet = workbook.Sheets["Ports"];

        if (!rackSheet) throw new Error('Sheet "Rack" not found');

        const racksFlat = XLSX.utils.sheet_to_json(rackSheet) as Record<
          string,
          any
        >[];
        const devicesFlat = deviceSheet
          ? (XLSX.utils.sheet_to_json(deviceSheet) as Record<string, any>[])
          : [];
        const portsFlat = portSheet
          ? (XLSX.utils.sheet_to_json(portSheet) as Record<string, any>[])
          : [];

        if (racksFlat.length === 0)
          throw new Error("No rack data found in Excel");

        const r = racksFlat[0];
        const rackDevices = devicesFlat.map((d) => {
          const devicePorts = portsFlat
            .filter((p) => p.deviceId === d.deviceId)
            .map((p) => ({
              portId: String(p.portId),
              status: p.status as "normal" | "error",
              errorLevel: p.errorLevel || undefined,
              errorMessage: p.errorMessage || undefined,
            }));

          return {
            id: d.deviceId || generateUUID(),
            name: d.title,
            type: d.type,
            size: Number(d.size),
            position: Number(d.position),
            imageUrl: d.imageUrl || undefined,
            portStates: devicePorts,
          };
        });

        const partialRack: Partial<Rack> = {
          rackSize: Number(r.rackSize) as 24 | 32 | 48,
          width: Number(r.width || RACK_WIDTH_STANDARD),
          orientation: Number(r.orientation) as 0 | 90 | 180 | 270,
          devices: rackDevices as any,
        };

        resolve(partialRack);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

const SCHEMA_VERSION = "2.0";

export const GROUP_ID_MAP: Record<string, string> = {
  과천: "GW",
  대전: "DJ",
};

const GROUP_NAME_MAP: Record<string, string> = {
  GW: "과천",
  DJ: "대전",
};

/** Flatten registered devices */
const flattenRegisteredDevices = (
  devices: RegisteredDevice[],
  nodes: HierarchyNode[],
) =>
  devices.map((d) => ({
    id: d.deviceId,
    deviceGroupId: d.deviceGroupId,
    groupName: getNodeName(nodes, d.deviceGroupId || ''),
    nodePath: getFullPath(nodes, d.deviceGroupId || ''),
    depth: getNodeDepth(nodes, d.deviceGroupId || ''),
    title: d.title,
    modelName: d.modelName,
    type: d.type,
    size: d.size,
    IPAddr: d.IPAddr,
    macAddr: d.macAddr,
    vendor: d.vendor,
  }));

// ─── Master Sheet Builders ──────────────────────────────────────────────────

export interface ExportRequest {
  requestId: string;
  scopeId: ExportScope;
  scopeLabel: string;
  exportedAt: string;
}

const buildMetaSheet = (request: ExportRequest) =>
  XLSX.utils.json_to_sheet([
    { key: "schemaVersion", value: SCHEMA_VERSION },
    { key: "lastExportAt", value: request.exportedAt },
    { key: "hierarchyEnabled", value: true },
    { key: "exportScopeType", value: request.scopeId === "ALL" ? "ALL" : "NODE" },
    { key: "exportScopeId", value: request.scopeId },
    { key: "exportScopeLabel", value: request.scopeLabel },
    { key: "requestId", value: request.requestId },
  ]);

const buildGroupsSheet = (nodes: HierarchyNode[]) =>
  XLSX.utils.json_to_sheet(
    nodes.map((n) => ({
      nodeId: n.nodeId,
      parentId: n.parentId || "",
      nodeName: n.name,
      nodeType: n.type,
      sortOrder: n.order,
    }))
  );

// ─── Group-Scoped Export/Import ─────────────────────────────────────────────

export type ExportScope = "ALL" | string; // "ALL" or nodeId

/**
 * Export full workbook with all master sheets.
 * When scope is a specific group, PKG sheets for that group are also included.
 */
export const exportGroupWorkbook = (
  racks: Rack[],
  registeredDevices: RegisteredDevice[],
  nodes: HierarchyNode[],
  request: ExportRequest,
) => {
  console.log(`[Export] Start - Request: ${request.requestId}, ScopeId: ${request.scopeId}, Label: ${request.scopeLabel}`);
  
  const wb = XLSX.utils.book_new();
  const isAllScope = request.scopeId === "ALL";

  // Filter dataset by scope before building sheets: Include subtree (descendants)
  const subtreeIds = isAllScope ? null : getSubtreeNodeIds(nodes, request.scopeId);
  
  const filteredRacks = isAllScope 
    ? racks 
    : racks.filter(r => subtreeIds!.has(r.mapId));
  
  const filteredRegDevices = isAllScope
    ? registeredDevices
    : registeredDevices.filter(d => subtreeIds!.has(d.deviceGroupId || ''));

  // ── Master sheets (always present) ──
  XLSX.utils.book_append_sheet(wb, buildMetaSheet(request), "_META");
  
  // Filter nodes for Groups sheet: Include ancestors AND the entire subtree
  let filteredNodes: HierarchyNode[] = [];
  if (isAllScope) {
    filteredNodes = nodes;
  } else {
    const ancestors = getAncestorPath(nodes, request.scopeId);
    const descendants = nodes.filter(n => subtreeIds!.has(n.nodeId));
    const nodeMap = new Map<string, HierarchyNode>();
    ancestors.forEach(n => nodeMap.set(n.nodeId, n));
    descendants.forEach(n => nodeMap.set(n.nodeId, n));
    filteredNodes = Array.from(nodeMap.values());
  }
  XLSX.utils.book_append_sheet(wb, buildGroupsSheet(filteredNodes), "Groups");

  const allRackRows = flattenRacks(filteredRacks, nodes);
  const allDeviceRows = flattenDevices(filteredRacks, nodes, filteredRegDevices);
  const allPortRows = flattenPorts(filteredRacks, nodes, filteredRegDevices);
  const allRegDevRows = flattenRegisteredDevices(filteredRegDevices, nodes);

  if (allRackRows.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(allRackRows),
      "Racks",
    );
  if (allDeviceRows.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(allDeviceRows),
      "Devices",
    );
  if (allPortRows.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(allPortRows),
      "Ports",
    );
  if (allRegDevRows.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(allRegDevRows),
      "RegisteredDevices",
    );

  try {
    console.log(`[Export] Generating Workbook Bytes - Request: ${request.requestId}`);
    const u8 = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([u8], { type: EXCEL_MIME });
    
    const isAll = request.scopeId === "ALL";
    const labelPart = isAll ? "ALL" : request.scopeLabel.replace(/[\s\>]+/g, "_");
    const filename = `${labelPart}_${getFormattedDate()}.xlsx`;
    
    console.log(`[Export] Triggering Download - Request: ${request.requestId}, Filename: ${filename}`);
    downloadBlob(blob, filename);
  } catch (err) {
    console.error(`[Export] Error - Request: ${request.requestId}`, err);
    alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
  }
};

/**
 * Export selected registered devices to Excel
 */
export const exportRegisteredDevicesToExcel = (
  devices: RegisteredDevice[],
  nodes: HierarchyNode[],
  scope: string, // "ALL" | "과천" | "대전" | "SELECTED"
) => {
  const wb = XLSX.utils.book_new();
  const rows = flattenRegisteredDevices(devices, nodes);

  if (rows.length > 0) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rows),
      "RegisteredDevices",
    );
  }

  try {
    const u8 = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([u8], { type: EXCEL_MIME });
    const isAllScope = scope === "ALL";
    const labelPart = isAllScope ? "ALL" : scope.replace(/[\s\>]+/g, "_");
    const filename = `장비_${labelPart}_${getFormattedDate()}.xlsx`;
    
    downloadBlob(
      blob,
      filename,
    );
  } catch (err) {
    console.error("Export failed:", err);
    alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
  }
};

export interface ParsedRegisteredDevicesResult {
  devices: Omit<RegisteredDevice, "deviceId">[];
  newNodes: HierarchyNode[];
}

/**
 * Import registered devices from a standalone Excel file
 */
export const parseRegisteredDevicesFromExcel = (
  file: File,
  nodes: HierarchyNode[],
): Promise<ParsedRegisteredDevicesResult> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames.find(s => 
          ["RegisteredDevices", "Registered Devices", "EquipmentList", "Equipment List", "Devices"].includes(s)
        ) || workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("No sheets found in Excel file.");

        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

        const accumulatedNewNodes: HierarchyNode[] = [];
        const parsed: Omit<RegisteredDevice, "deviceId">[] = rows
          .map((r): Omit<RegisteredDevice, "deviceId"> | null => {
            const nodeIdInFile = r.mapId || r.groupId;
            const path = r.nodePath || r.groupPath || r.path;
            const grpName = r.nodeName || r.groupName || r.group || (nodeIdInFile ? undefined : GROUP_NAME_MAP[r.groupId]);
            
            let nid = nodeIdInFile ? String(nodeIdInFile) : "";
            
            // 1. Try to resolve by path first (Full Hierarchy)
            if (path) {
              const strPath = String(path).trim();
              if (strPath === "없음" || strPath.toLowerCase() === "none") {
                nid = NONE_NODE_ID;
              } else {
                const { nodeId: resolvedId, newNodes } = resolvePathToNodeId(nodes, strPath, accumulatedNewNodes);
                if (newNodes.length > 0) {
                  // Deduplicate before adding to accumulated array
                  newNodes.forEach(nn => {
                      if (!accumulatedNewNodes.some(ex => ex.nodeId === nn.nodeId)) {
                          accumulatedNewNodes.push(nn);
                      }
                  });
                }
                nid = resolvedId;
              }
            } 
            // 2. If no path, but we have a group name, try name-based resolution
            else if (!nid && grpName) {
              const strName = String(grpName).trim();
              if (strName === "없음" || strName.toLowerCase() === "none") {
                nid = NONE_NODE_ID;
              } else {
                // Try to find in current nodes or newly discovered nodes
                const matched = [...nodes, ...accumulatedNewNodes].find(n => n.name.toLowerCase() === strName.toLowerCase());
                if (matched) {
                  nid = matched.nodeId;
                } else {
                  // If not found, try legacy mapping
                  const migrated = migrateGroupNameToNodeId(strName);
                  if (migrated !== strName) {
                      nid = migrated;
                  } else {
                      // Create new node under root as fallback
                      const { nodeId: resolvedId, newNodes } = resolvePathToNodeId(nodes, strName, accumulatedNewNodes);
                      if (newNodes.length > 0) {
                          newNodes.forEach(nn => {
                              if (!accumulatedNewNodes.some(ex => ex.nodeId === nn.nodeId)) {
                                  accumulatedNewNodes.push(nn);
                              }
                          });
                      }
                      nid = resolvedId;
                  }
                }
              }
            }
            
            // 3. Last fallback: use the raw ID from file if still empty
            if (!nid) nid = String(nodeIdInFile || "unassigned");
            const mac = String(r.macAddr || "")
              .trim()
              .toUpperCase();
            const ip = String(r.IPAddr || "").trim();
            const modelName = String(r.modelName || "").trim();
            const deviceName = String(r.title || "").trim();
            const vendor = String(r.vendor || "Nokia").trim() as any;

            if (!modelName || !mac || !ip) return null;

            const template = DEVICE_TEMPLATES.find(
              (t) => t.modelName === modelName,
            );
            const type = (r.type ||
              template?.type ||
              "network") as RegisteredDevice["type"];
            const size = Number(r.size) || template?.uSize || 1;

            return {
              deviceGroupId: nid,
              modelName,
              title: deviceName,
              IPAddr: ip,
              macAddr: mac,
              vendor,
              type,
              size,
            };
          })
          .filter((d): d is Omit<RegisteredDevice, "deviceId"> => d !== null);

        resolve({ devices: parsed, newNodes: accumulatedNewNodes });
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

export interface ProcessedImportData {
  nodes: HierarchyNode[];
  dataByNode: Record<string, { racks: Rack[]; registeredDevices: RegisteredDevice[] }>;
  exportScope: {
    type: "ALL" | "NODE";
    nodeId?: string;
  };
  effectiveScopeId: string | "ALL";
  ignoredCount: number;
  nodeIdMap: Record<string, string>;
}

/**
 * Import all data from workbook sheets.
 * Automatically detects nodes from Groups sheet and maps entities to them.
 */
// --- Refactored Import Architecture: Row-Driven & Robust ---
export const importGroupPackage = (
  file: File,
  systemNodes: HierarchyNode[] = [],
  targetNodeId: string | "ALL" = "ALL",
): Promise<ProcessedImportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        console.group("[Import Flow]");
        console.log("Workbook loaded. Sheets:", workbook.SheetNames);

        // 1. Metadata & Scope Parsing
        const metaSheet = workbook.Sheets["_META"];
        let exportScopeType: "ALL" | "NODE" = "ALL";
        let exportScopeNodeId = "";
        if (metaSheet) {
          const metaRows = XLSX.utils.sheet_to_json(metaSheet) as Record<string, any>[];
          const typeRow = metaRows.find(r => r.key === "exportScopeType");
          const idRow = metaRows.find(r => r.key === "exportScopeId" || r.key === "exportScopeNodeId");
          if (typeRow) exportScopeType = typeRow.value as any;
          if (idRow) exportScopeNodeId = String(idRow.value || "");
        }

        // 2. Load Raw Sheet Data
        const findS = (...c: string[]) => c.find(n => workbook.SheetNames.includes(n));
        const rackSN = findS("Racks", "Rack");
        const devSN = findS("Devices", "Equipment");
        const portSN = findS("Ports");
        const regDevSN = findS("RegisteredDevices", "Registered Devices", "EquipmentList") || "RegisteredDevices";

        const racksRaw = rackSN ? (XLSX.utils.sheet_to_json(workbook.Sheets[rackSN]) as any[]) : [];
        const devsRaw = devSN ? (XLSX.utils.sheet_to_json(workbook.Sheets[devSN]) as any[]) : [];
        const portsRaw = portSN ? (XLSX.utils.sheet_to_json(workbook.Sheets[portSN]) as any[]) : [];
        const regDevsRaw = workbook.Sheets[regDevSN] ? (XLSX.utils.sheet_to_json(workbook.Sheets[regDevSN]) as any[]) : [];

        console.log(`Counts: Racks=${racksRaw.length}, PlacedDevices=${devsRaw.length}, RegDevices=${regDevsRaw.length}`);

        // 3. Load Groups/Hierarchy
        const groupsSheet = workbook.Sheets["Groups"];
        let fileNodes: HierarchyNode[] = [];
        if (groupsSheet) {
          const rows = XLSX.utils.sheet_to_json(groupsSheet) as any[];
          fileNodes = rows.map(r => ({
            nodeId: String(r.nodeId || r.mapId || r.groupId || generateUUID()),
            parentId: r.parentId ? String(r.parentId) : null,
            name: String(r.nodeName || r.groupName || ""),
            type: (r.nodeType || "group") as any,
            order: Number(r.sortOrder || r.order || 0)
          }));
        }

        const getValue = (row: any, ...syns: string[]) => {
          for (const s of syns) {
            if (row[s] !== undefined) return row[s];
            const key = Object.keys(row).find(k => k.toLowerCase() === s.toLowerCase());
            if (key) return row[key];
          }
          return undefined;
        };

        const getRowInfo = (row: any) => {
          const path = getValue(row, "groupPath") || getValue(row, "nodePath");
          const nid = getValue(row, "nodeId") || getValue(row, "mapId") || getValue(row, "groupId") || getValue(row, "id") || getValue(row, "deviceGroupId");
          const name = getValue(row, "groupName") || getValue(row, "nodeName");
          return { path: path ? String(path) : undefined, nid: nid ? String(nid) : undefined, name: name ? String(name) : undefined };
        };

        let isTargeted = targetNodeId && targetNodeId !== "ALL";

        const targetPath = isTargeted ? getFullPath(systemNodes, targetNodeId) : null;
        console.log(`[Import] Target: ${targetNodeId}, Path: ${targetPath}, isTargeted: ${isTargeted}`);

        // --- PRE-RESOLUTION PASS: Map all file nodes to system IDs ---
        const nodeIdMap: Record<string, string> = {};
        const resolutionNodes = isTargeted && targetNodeId && targetNodeId !== "ALL"
          ? getAncestorPath(systemNodes, targetNodeId)
          : [...systemNodes];

        const getFileNodePath = (nid: string): string => {
           const pathArr: string[] = [];
           let currId: string | null = nid;
           const visited = new Set<string>();
           while (currId && !visited.has(currId)) {
             visited.add(currId);
             const n = fileNodes.find(fn => fn.nodeId === currId);
             if (!n) break;
             pathArr.unshift(n.name);
             currId = n.parentId;
           }
           return pathArr.join(" > ");
        };

        // Resolution: Top-down to ensure parents exist
        const sortedFileNodes = [...fileNodes].sort((a, b) => getFileNodePath(a.nodeId).split(">").length - getFileNodePath(b.nodeId).split(">").length);
        
        sortedFileNodes.forEach(fn => {
           const fullPath = getFileNodePath(fn.nodeId);
           const { nodeId: resId, newNodes } = resolvePathToNodeId(systemNodes, fullPath, resolutionNodes);
           nodeIdMap[fn.nodeId] = resId;
           newNodes.forEach(nn => {
             if (!resolutionNodes.some(sn => sn.nodeId === nn.nodeId)) resolutionNodes.push(nn);
           });
        });

        let ignoredCount = 0;

        const resolveRowToNodeId = (info: { path?: string, nid?: string, name?: string }): string => {
          const { path, nid, name } = info;
          
          if (path) {
            const strPath = String(path).trim();
            if (strPath === "없음" || strPath.toLowerCase() === "none") return NONE_NODE_ID;
            const { nodeId: resId, newNodes } = resolvePathToNodeId(systemNodes, strPath, resolutionNodes);
            newNodes.forEach(nn => {
               if (!resolutionNodes.some(ex => ex.nodeId === nn.nodeId)) resolutionNodes.push(nn);
            });
            return resId;
          }

          if (nid && nodeIdMap[String(nid)]) return nodeIdMap[String(nid)];

          if (name) {
             const strName = String(name).trim();
             if (strName === "없음" || strName.toLowerCase() === "none") return NONE_NODE_ID;
             const match = resolutionNodes.find(n => n.name.toLowerCase() === strName.toLowerCase());
             if (match) return match.nodeId;
          }

          return "unassigned";
        };

        const dataByNode: Record<string, { racks: Rack[]; registeredDevices: RegisteredDevice[] }> = {};
        const ensureNode = (id: string) => {
          if (!dataByNode[id]) dataByNode[id] = { racks: [], registeredDevices: [] };
        };

        const targetSubtree = (isTargeted && targetNodeId) ? getSubtreeNodeIds(resolutionNodes, targetNodeId) : null;

        const isTargetMatch = (info: { path?: string, nid?: string }) => {
          if (!isTargeted) return true;
          const { path, nid } = info;
          if (path && targetPath) {
             return path === targetPath || path.startsWith(targetPath + " > ");
          }
          if (nid) {
             const resolvedId = nodeIdMap[String(nid)] || nid;
             return resolvedId === targetNodeId || (targetSubtree?.has(resolvedId) ?? false);
          }
          return false;
        };

        racksRaw.forEach((r) => {
          const info = getRowInfo(r);
          
          if (!isTargetMatch(info)) {
             ignoredCount++;
             return;
          }

          const nodeTarget = resolveRowToNodeId(info);
          ensureNode(nodeTarget);

          const rId = String(getValue(r, "rackId") || generateUUID());
          const rDevices = devsRaw
            .filter(d => String(getValue(d, "rackId")) === String(getValue(r, "rackId")))
            .map(d => {
              const dItemId = String(getValue(d, "itemId") || generateUUID());
              const dDeviceId = getValue(d, "deviceId") || undefined;
              const dPorts = portsRaw
                .filter(p => String(getValue(p, "deviceId")) === String(dDeviceId || dItemId))
                .map(p => ({
                  portId: String(getValue(p, "portId")),
                  status: (getValue(p, "status") || "normal") as any,
                  errorLevel: getValue(p, "errorLevel"),
                  errorMessage: getValue(p, "errorMessage")
                }));
              
              return {
                itemId: dItemId,
                title: String(getValue(d, "title", "deviceName", "name") || ""),
                type: (getValue(d, "type") || "Server") as any,
                size: Number(getValue(d, "size") || 1),
                position: Number(getValue(d, "position") || 1),
                modelName: getValue(d, "modelName"),
                IPAddr: getValue(d, "IPAddr", "ip"),
                macAddr: getValue(d, "macAddr", "mac"),
                vendor: getValue(d, "vendor"),
                deviceId: dDeviceId,
                portStates: dPorts
              };
            });

          dataByNode[nodeTarget].racks.push({
            rackId: rId,
            mapId: nodeTarget,
            rackTitle: String(getValue(r, "rackName", "rackTitle") || `Rack`),
            rackSize: Number(getValue(r, "rackSize") || 48) as any,
            width: Number(getValue(r, "width") || RACK_WIDTH_STANDARD),
            position: [Number(getValue(r, "posX") || 0), Number(getValue(r, "posZ") || 0)],
            orientation: Number(getValue(r, "orientation") || 0) as any,
            devices: rDevices as any
          });
        });

        regDevsRaw.forEach((d) => {
          const info = getRowInfo(d);
          
          // Strict filtering: If targeted, only allow rows matching targetNodeId or DESCENDANTS
          if (!isTargetMatch(info)) {
             ignoredCount++;
             return;
          }

          const nodeTarget = resolveRowToNodeId(info);
          ensureNode(nodeTarget);

          dataByNode[nodeTarget].registeredDevices.push({
            deviceId: String(getValue(d, "deviceId", "id", "registeredDeviceId") || generateUUID()),
            deviceGroupId: nodeTarget,
            title: String(getValue(d, "title", "deviceName", "name") || ""),
            modelName: String(getValue(d, "modelName") || ""),
            type: (getValue(d, "type") || "Server") as any,
            size: Number(getValue(d, "size") || 1),
            IPAddr: String(getValue(d, "IPAddr", "ip") || ""),
            macAddr: String(getValue(d, "macAddr", "mac") || ""),
            vendor: getValue(d, "vendor")
          });
        });

        // 5. Final Hierarchy Cleanup
        // If targeted, only include nodes in the direct ancestor path of the target node or its subtree.
        let resultNodes = resolutionNodes;
        if (isTargeted && targetNodeId) {
          // Ancestors must come from systemNodes OR file ancestors
          const ancestors = getAncestorPath(resolutionNodes, targetNodeId);
          const ancIds = new Set(ancestors.map(a => a.nodeId));
          
          // Subtree (target + descendants)
          const subtreeIds = getSubtreeNodeIds(resolutionNodes, targetNodeId);
          
          resultNodes = resolutionNodes.filter(n => {
             return ancIds.has(n.nodeId) || subtreeIds.has(n.nodeId);
          });
        }

        console.log(`[Import] Final Summary: ${Object.keys(dataByNode).length} targeted nodes identified. Ignored ${ignoredCount} rows.`);
        console.groupEnd();

        resolve({
          nodes: resultNodes,
          dataByNode,
          exportScope: { type: exportScopeType, nodeId: exportScopeNodeId },
          effectiveScopeId: targetNodeId,
          nodeIdMap,
          ignoredCount
        });
      } catch (err) {
        console.error("[Import] Failure:", err);
        console.groupEnd();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ─── Sample Data Generation ─────────────────────────────────────────────────
// ─── Sample Data Generation ─────────────────────────────────────────────────

const generateRegisteredDevices = (
  nodeId: string,
  nodeName: string,
  count: number,
  ipBase: string,
  nodeIdx: number,
): RegisteredDevice[] =>
  Array.from({ length: count }).map((_, i) => {
    const template = DEVICE_TEMPLATES[i % DEVICE_TEMPLATES.length];
    const ipParts = ipBase.split(".");
    const lastOctet = (parseInt(ipParts[3]) + i) % 255;
    const thirdOctet = parseInt(ipParts[2]) + Math.floor((parseInt(ipParts[3]) + i) / 255);
    
    const macSuffix = ((nodeIdx << 8) | i).toString(16).padStart(4, "0");
    const formattedMacSuffix = `${macSuffix.slice(0, 2)}:${macSuffix.slice(2, 4)}`;

    return {
      deviceId: generateUUID(),
      deviceGroupId: nodeId,
      title: `${template.modelName}-${nodeName}-${i + 1}`,
      modelName: template.modelName,
      type: template.type,
      size: template.uSize,
      IPAddr: `${ipParts[0]}.${ipParts[1]}.${thirdOctet}.${lastOctet}`,
      macAddr: `00:00:5E:00:${formattedMacSuffix}`.toUpperCase(),
      vendor: "Nokia",
    };
  });

export const sampleNodes: HierarchyNode[] = getDefaultNodes();

// Varying equipment counts per node based on depth and index
export const sampleRegisteredDevices: RegisteredDevice[] = sampleNodes.flatMap((node, idx) => {
  const depth = getNodeDepth(sampleNodes, node.nodeId);
  // Root node gets no equipment, but sites, centers and rooms get them
  if (depth === 1) return []; // STN (root)
  
  let count = 0;
  if (node.nodeId === GWACHEON_NODE_ID) {
    count = 800; // Lots of devices for the main server room
  } else if (isLeafNode(sampleNodes, node.nodeId)) {
    count = 400 + (idx % 10) * 20; // 400+ to fill 30+ racks
  } else if (depth >= 2) {
    count = 40 + (idx % 5) * 5; // Regions/centers: small amount
  }
  return generateRegisteredDevices(node.nodeId, node.name, count, `10.${idx + 1}.1.1`, idx);
});

const generateGroupRacks = (
  count: number,
  nodeId: string,
  colsPerRow: number,
  errorIndexes: number[],
  regDevices: RegisteredDevice[],
  faceToFace: boolean = false,
): Rack[] => {
  const racks: Rack[] = [];
  let deviceIdx = 0;

  for (let localIdx = 0; localIdx < count; localIdx++) {
    const row = Math.floor(localIdx / colsPerRow);
    const col = localIdx % colsPerRow;

    const isWide = col === 4 || col === 9;
    const width = isWide ? RACK_WIDTH_WIDE : RACK_WIDTH_STANDARD;
    const rackSize: 24 | 32 | 48 =
      localIdx % 3 === 0 ? 24 : localIdx % 3 === 1 ? 32 : 48;

    const hasError = errorIndexes.includes(localIdx);
    const devices: Device[] = [];
    let currentUPos = 1;

    // Fill rack until we run out of height or available devices for this node
    while (currentUPos <= rackSize && deviceIdx < regDevices.length) {
      const regDevice = regDevices[deviceIdx];
      
      // Check if it fits in remaining space
      if (currentUPos + (regDevice.size || 1) - 1 <= rackSize) {
        const shouldAddError = hasError && devices.length === 0;
        
        devices.push({
          itemId: generateUUID(),
          title: regDevice.title,
          type: regDevice.type || "Server",
          size: (regDevice.size || 1),
          position: currentUPos,
          modelName: regDevice.modelName,
          vendor: regDevice.vendor,
          deviceId: regDevice.deviceId,
          portStates: shouldAddError
            ? [
                {
                  portId: `p${Math.floor(Math.random() * 24) + 1}`,
                  status: "error" as const,
                  errorLevel: (
                    ["warning", "minor", "major", "critical"] as const
                  )[Math.floor(Math.random() * 4)],
                  errorMessage: "Link down",
                },
              ]
            : [],
        });
        
        currentUPos += (regDevice.size || 1) + 1; // 1U gap between devices
        deviceIdx++; // Move to next unique device
      } else {
        // Doesn't fit, stop filling this rack
        break;
      }
    }

    let worldX = 0;
    for (let j = 0; j < col; j++) {
      const prevIsWide = j === 4 || j === 9;
      worldX += (prevIsWide ? RACK_WIDTH_WIDE : RACK_WIDTH_STANDARD); // Remove extra gap
    }
    const stateX = (worldX + width / 2) / GRID_SPACING;
    
    // Aisle arrangement: face-to-face pairs with 1.75 unit front gap
    let posZ = row * 4.0;
    let orient = 180;
    
    if (faceToFace) {
      // Hot/cold aisle layout:
      // Row 0: orient=180, z = baseY         (앞면이 아래를 향함)
      // Row 1: orient=0,   z = baseY + 1.75  (앞면이 위를 향함) -> cold aisle = 1.75칸
      // Row 2: orient=180, z = baseY + 4.75  (다음 페어, hot aisle gap = 3.0)
      // Row 3: orient=0,   z = baseY + 6.5   ...
      const pair = Math.floor(row / 2);
      const isSecondInPair = row % 2 !== 0;
      
      const pairSpacing = 4.75; // 1.75 cold + 3.0 hot
      const baseY = pair * pairSpacing;
      posZ = baseY + (isSecondInPair ? 1.75 : 0);
      orient = isSecondInPair ? 0 : 180;
    }

    racks.push({
      rackId: generateUUID(),
      mapId: nodeId,
      rackSize,
      width,
      position: [stateX, posZ],
      orientation: orient as any,
      devices,
    });
  }
  return racks;
};

// 수도권 과천 랙에 삽입할 7250 IXR-X1 장비 (포트 에러 포함)
const IX1_PORT_ERROR_DEVICE: Device = {
  itemId: "iXR-X1-demo-device-001",
  deviceId: "iXR-X1-demo-registered-001",
  title: "7250 IXR-X1 (Demo)",
  type: "Router",
  modelName: "7250 IXR-X1",
  vendor: "Nokia",
  size: 1,
  position: 1, // U1 위치에 탑재
  // port-5 (critical), port-13 (major), port-21 (warning) 에러
  portStates: [
    { portId: "port-5",  status: "error", errorLevel: "critical", errorMessage: "Link down - Physical layer failure" },
    { portId: "port-13", status: "error", errorLevel: "major",    errorMessage: "CRC error rate exceeded threshold" },
    { portId: "port-21", status: "error", errorLevel: "warning",  errorMessage: "High latency detected" },
    { portId: "port-1",  status: "normal" },
    { portId: "port-3",  status: "normal" },
    { portId: "port-7",  status: "normal" },
    { portId: "port-9",  status: "normal" },
    { portId: "port-11", status: "normal" },
    { portId: "port-15", status: "normal" },
    { portId: "port-17", status: "normal" },
    { portId: "port-19", status: "normal" },
    { portId: "port-23", status: "normal" },
  ],
};

export const sampleRacks: Rack[] = (() => {
  const racks = sampleNodes.flatMap((node, idx) => {
    const nodeDevices = sampleRegisteredDevices.filter((d) => d.deviceGroupId === node.nodeId);
    const depth = getNodeDepth(sampleNodes, node.nodeId);

    if (depth < 2) return []; // Exclude Root (STN)

    const isLeaf = isLeafNode(sampleNodes, node.nodeId);

    if (node.nodeId === GWACHEON_NODE_ID) {
      // Showcase room: 60 racks, 15 per row, face-to-face
      return generateGroupRacks(60, node.nodeId, 15, [1, 5, 12, 20, 25, 30, 45, 55], nodeDevices, true);
    }

    if (isLeaf) {
      // All server rooms: 30+ racks, face-to-face aisle layout
      const rackCount = 30 + (idx % 10);
      return generateGroupRacks(rackCount, node.nodeId, 10, [2, 8, 15, 22], nodeDevices, true);
    }

    // Middle hierarchy nodes (regions, centers): small number, no face-to-face
    const rackCount = 5 + (idx % 4);
    return generateGroupRacks(rackCount, node.nodeId, 5, [1], nodeDevices, false);
  });

  // 수도권(과천) 첫 번째 랙에 IXR-X1 데모 장비 삽입
  const gwacheonRackIdx = racks.findIndex((r) => r.mapId === GWACHEON_NODE_ID);
  if (gwacheonRackIdx !== -1) {
    const targetRack = racks[gwacheonRackIdx];
    // 기존 디바이스들의 position을 2U부터 밀어서 U1에 IXR-X1 삽입
    const shiftedDevices = targetRack.devices.map((d) => ({
      ...d,
      position: d.position + 2, // IXR-X1(1U) + 1U gap 확보
    }));
    racks[gwacheonRackIdx] = {
      ...targetRack,
      devices: [IX1_PORT_ERROR_DEVICE, ...shiftedDevices],
    };
  }

  return racks;
})();
