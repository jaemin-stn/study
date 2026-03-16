import type { Rack, RegisteredDevice, HierarchyNode } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
import { 
  getDefaultNodes, 
  migrateGroupNameToNodeId,
  getNodeName, 
  getNodeDepth, 
  getFullPath,
  resolvePathToNodeId
} from "./nodeUtils";
import * as XLSX from "xlsx";
import {
  RACK_WIDTH_STANDARD,
  RACK_WIDTH_WIDE,
  GRID_SPACING,
} from "../components/constants";

// ─── Data Flattening Helpers ─────────────────────────────────────────────────

/** Flatten rack objects into export-friendly rows */
const flattenRacks = (racks: Rack[]) =>
  racks.map((r) => ({
    rackId: r.id,
    nodeId: r.nodeId,
    uHeight: r.uHeight,
    width: r.width,
    posX: r.position[0],
    posZ: r.position[1],
    orientation: r.orientation,
  }));

/** Flatten devices (with parent rackId) into export-friendly rows */
const flattenDevices = (racks: Rack[]) => {
  const rows: Record<string, unknown>[] = [];
  for (const r of racks) {
    for (const d of r.devices) {
      rows.push({
        deviceId: d.id,
        rackId: r.id,
        nodeId: r.nodeId,
        name: d.name,
        type: d.type,
        uSize: d.uSize,
        uPosition: d.uPosition,
        imageUrl: d.imageUrl || "",
        modelName: d.modelName || "",
        ip: d.ip || "",
        mac: d.mac || "",
        vendor: d.vendor || "",
      });
    }
  }
  return rows;
};

/** Flatten port states (with parent deviceId) into export-friendly rows */
const flattenPorts = (racks: Rack[]) => {
  const rows: Record<string, unknown>[] = [];
  for (const r of racks) {
    for (const d of r.devices) {
      for (const p of d.portStates) {
        rows.push({
          portId: p.portId,
          deviceId: d.id,
          nodeId: r.nodeId,
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

/** YYMMDD format for filenames */
const getYYMMDD = () => {
  const now = new Date();
  const y = String(now.getFullYear()).substring(2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
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

export const saveToJSON = (racks: Rack[], options?: ExportOptions) => {
  const { rackData, deviceData, portData } = prepareExportData(racks, options);
  const json = JSON.stringify(
    { Rack: rackData, Equipment: deviceData, Ports: portData },
    null,
    2,
  );
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    `server-room-${Date.now()}.json`,
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

export const saveToExcel = (racks: Rack[], options?: ExportOptions) => {
  const { rackData, deviceData, portData } = prepareExportData(racks, options);
  const wb = XLSX.utils.book_new();
  if (rackData.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rackData),
      "Rack",
    );
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
    downloadBlob(blob, `devices_ALL_${getYYMMDD()}.xlsx`);
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

        const racks: Rack[] = racksFlat.map((r) => {
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
                id: d.deviceId,
                name: d.name,
                type: d.type,
                uSize: Number(d.uSize),
                uPosition: Number(d.uPosition),
                imageUrl: d.imageUrl || undefined,
                portStates: devicePorts,
              };
            });

          return {
            id: r.rackId as string,
            nodeId: (r.nodeId as string) || migrateGroupNameToNodeId((r as any).groupName || "과천"),
            uHeight: Number(r.uHeight) as 24 | 32 | 48,
            width: Number(r.width || RACK_WIDTH_STANDARD),
            position: [Number(r.posX), Number(r.posZ)],
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
  const { rackData, deviceData, portData } = prepareExportData([rack], options);
  const json = JSON.stringify(
    { Rack: rackData, Equipment: deviceData, Ports: portData },
    null,
    2,
  );
  downloadBlob(
    new Blob([json], { type: "application/json" }),
    `rack-${rack.displayName || rack.id.substring(0, 8)}-${Date.now()}.json`,
  );
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
  const { rackData, deviceData, portData } = prepareExportData([rack], options);
  const wb = XLSX.utils.book_new();
  if (rackData.length > 0)
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.json_to_sheet(rackData),
      "Rack",
    );
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
    downloadBlob(
      blob,
      `devices_SELECTED_${getYYMMDD()}.xlsx`,
    );
  } catch (err) {
    console.error("Export failed:", err);
    alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
  }
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
            name: d.name,
            type: d.type,
            uSize: Number(d.uSize),
            uPosition: Number(d.uPosition),
            imageUrl: d.imageUrl || undefined,
            portStates: devicePorts,
          };
        });

        const partialRack: Partial<Rack> = {
          uHeight: Number(r.uHeight) as 24 | 32 | 48,
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

// ─── Group ID Mapping (legacy, for backward-compatible import) ──────────────

export const GROUP_ID_MAP: Record<string, string> = {
  과천: "GW",
  대전: "DJ",
};

const GROUP_NAME_MAP: Record<string, string> = {
  GW: "과천",
  DJ: "대전",
};

const SCHEMA_VERSION = "2.0";

// ─── Group-Scoped Flattening Helpers ────────────────────────────────────────

/** Flatten racks with groupId column */
const flattenRacksWithGroup = (racks: Rack[], nodes: HierarchyNode[]) =>
  racks.map((r) => ({
    rackId: r.id,
    nodeId: r.nodeId,
    groupName: getNodeName(nodes, r.nodeId),
    depth: getNodeDepth(nodes, r.nodeId),
    groupPath: getFullPath(nodes, r.nodeId),
    uHeight: r.uHeight,
    width: r.width,
    posX: r.position[0],
    posZ: r.position[1],
    orientation: r.orientation ?? 180,
  }));

/** Flatten devices with groupId column */
const flattenDevicesWithGroup = (racks: Rack[], nodes: HierarchyNode[]) => {
  const rows: Record<string, unknown>[] = [];
  for (const r of racks) {
    for (const d of r.devices) {
      rows.push({
        deviceId: d.id,
        rackId: r.id,
        nodeId: r.nodeId,
        groupName: getNodeName(nodes, r.nodeId),
        depth: getNodeDepth(nodes, r.nodeId),
        groupPath: getFullPath(nodes, r.nodeId),
        name: d.name,
        type: d.type,
        uSize: d.uSize,
        uPosition: d.uPosition,
        imageUrl: d.imageUrl || "",
        modelName: d.modelName || "",
        ip: d.ip || "",
        mac: d.mac || "",
        vendor: d.vendor || "",
        registeredDeviceId: d.registeredDeviceId || "",
      });
    }
  }
  return rows;
};

/** Flatten ports with groupId column */
const flattenPortsWithGroup = (racks: Rack[]) => {
  const rows: Record<string, unknown>[] = [];
  for (const r of racks) {
    for (const d of r.devices) {
      for (const p of d.portStates) {
        rows.push({
          portId: p.portId,
          deviceId: d.id,
          nodeId: r.nodeId,
          status: p.status,
          errorLevel: p.errorLevel || "",
          errorMessage: p.errorMessage || "",
        });
      }
    }
  }
  return rows;
};

/** Flatten registered devices */
const flattenRegisteredDevices = (devices: RegisteredDevice[], nodes: HierarchyNode[]) =>
  devices.map((d) => {
    return {
      id: d.id,
      nodeId: d.nodeId,
      groupName: getNodeName(nodes, d.nodeId),
      depth: getNodeDepth(nodes, d.nodeId),
      groupPath: getFullPath(nodes, d.nodeId),
      deviceName: d.deviceName,
      modelName: d.modelName,
      type: d.type,
      uSize: d.uSize,
      ip: d.ip,
      mac: d.mac,
      vendor: d.vendor,
    };
  });

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

  // ── Master sheets (always present) ──
  XLSX.utils.book_append_sheet(wb, buildMetaSheet(request), "_META");
  XLSX.utils.book_append_sheet(wb, buildGroupsSheet(nodes), "Groups");

  const allRackRows = flattenRacksWithGroup(racks, nodes);
  const allDeviceRows = flattenDevicesWithGroup(racks, nodes);
  const allPortRows = flattenPortsWithGroup(racks);
  const allRegDevRows = flattenRegisteredDevices(registeredDevices, nodes);

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

  // ── PKG sheets (only when exporting a specific group) ──
  if (request.scopeId !== "ALL") {
    const scope = request.scopeId;
    const groupId = GROUP_ID_MAP[scope] || scope; // nodeId or legacy group mapping
    const groupRacks = allRackRows.filter((r) => (r as any).nodeId === scope || (r as any).groupId === groupId);
    const groupDevices = allDeviceRows.filter((d) => (d as any).nodeId === scope || (d as any).groupId === groupId);
    const groupPorts = allPortRows.filter((p) => (p as any).nodeId === scope || (p as any).groupId === groupId);

    // PKG metadata sheet (use groupId for sheet names to avoid encoding issues)
    const pkgMeta = XLSX.utils.json_to_sheet([
      { key: "packageId", value: generateUUID() },
      { key: "groupId", value: groupId },
      { key: "groupName", value: request.scopeLabel },
      { key: "exportScope", value: "GROUP_ONLY" },
      { key: "schemaVersion", value: SCHEMA_VERSION },
      { key: "exportedAt", value: request.exportedAt },
      { key: "importModeHint", value: "REPLACE" },
      { key: "requestId", value: request.requestId },
    ]);
    XLSX.utils.book_append_sheet(wb, pkgMeta, `PKG_${groupId}`);

    if (groupRacks.length > 0)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(groupRacks),
        `PKG_${groupId}_Racks`,
      );
    if (groupDevices.length > 0)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(groupDevices),
        `PKG_${groupId}_Devices`,
      );
    if (groupPorts.length > 0)
      XLSX.utils.book_append_sheet(
        wb,
        XLSX.utils.json_to_sheet(groupPorts),
        `PKG_${groupId}_Ports`,
      );
  }

  try {
    console.log(`[Export] Generating Workbook Bytes - Request: ${request.requestId}`);
    const u8 = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([u8], { type: EXCEL_MIME });
    
    const isAll = request.scopeId === "ALL";
    const labelPart = isAll ? "ALL" : `SELECTED_${request.scopeLabel.replace(/\s+/g, "_")}`;
    const filename = `devices_${labelPart}_${getYYMMDD()}.xlsx`;
    
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
    const labelPart = isAllScope ? "SELECTED" : `SELECTED_${scope.replace(/\s+/g, "_")}`;
    const filename = `devices_${labelPart}_${getYYMMDD()}.xlsx`;
    
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
  devices: Omit<RegisteredDevice, "id">[];
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
        const parsed: Omit<RegisteredDevice, "id">[] = rows
          .map((r): Omit<RegisteredDevice, "id"> | null => {
            const path = r.groupPath || r.nodePath || r.path;
            const grpName = r.groupName || r.nodeName || r.group || GROUP_NAME_MAP[r.groupId] || "과천";
            
            let nid = "";
            
            // Try to resolve by path first (creates nodes if missing)
            if (path) {
              const { nodeId: resolvedId, newNodes } = resolvePathToNodeId(nodes, String(path), accumulatedNewNodes);
              if (newNodes.length > 0) {
                accumulatedNewNodes.push(...newNodes);
              }
              nid = resolvedId;
            } else if (grpName) {
              const strName = String(grpName);
              // Try to find in current nodes or newly discovered nodes
              const matched = [...nodes, ...accumulatedNewNodes].find(n => n.name === strName);
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
                        accumulatedNewNodes.push(...newNodes);
                    }
                    nid = resolvedId;
                }
              }
            }
            
            // Final fallback to ID if we have it
            if (!nid) nid = String(r.nodeId || r.groupId || "");
            const mac = String(r.mac || "")
              .trim()
              .toUpperCase();
            const ip = String(r.ip || "").trim();
            const modelName = String(r.modelName || "").trim();
            const deviceName = String(r.deviceName || "").trim();
            const vendor = String(r.vendor || "Nokia").trim() as any;

            if (!modelName || !mac || !ip) return null;

            const template = DEVICE_TEMPLATES.find(
              (t) => t.modelName === modelName,
            );
            const type = (r.type ||
              template?.type ||
              "network") as RegisteredDevice["type"];
            const uSize = Number(r.uSize) || template?.uSize || 1;

            return {
              nodeId: nid,
              modelName,
              deviceName,
              ip,
              mac,
              vendor,
              type,
              uSize,
            };
          })
          .filter((d): d is Omit<RegisteredDevice, "id"> => d !== null);

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
  ignoredCount: number;
}

/**
 * Import all data from workbook sheets.
 * Automatically detects nodes from Groups sheet and maps entities to them.
 */
export const importGroupPackage = (
  file: File,
  systemNodes: HierarchyNode[] = [],
  _targetNodeId?: string | "ALL", // Kept for signature compatibility
): Promise<ProcessedImportData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        // --- Parse Metadata ---
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

        // --- Sheet Finding ---
        const findSheet = (...candidates: string[]) =>
          candidates.find((name) => workbook.SheetNames.includes(name));

        const rackSheetName = findSheet("Racks", "Rack");
        const deviceSheetName = findSheet("Devices", "Equipment");
        const portSheetName = findSheet("Ports");
        const regDevSheetName = findSheet("RegisteredDevices", "Registered Devices", "EquipmentList") || "RegisteredDevices";

        const rackSheet = rackSheetName ? workbook.Sheets[rackSheetName] : undefined;
        if (!rackSheet) throw new Error("Rack sheet not found in workbook.");

        const racksFlat = XLSX.utils.sheet_to_json(rackSheet) as Record<string, any>[];
        const devicesFlat = deviceSheetName && workbook.Sheets[deviceSheetName]
          ? (XLSX.utils.sheet_to_json(workbook.Sheets[deviceSheetName]) as Record<string, any>[])
          : [];
        const portsFlat = portSheetName && workbook.Sheets[portSheetName]
          ? (XLSX.utils.sheet_to_json(workbook.Sheets[portSheetName]) as Record<string, any>[])
          : [];
        const regDevFlat = workbook.Sheets[regDevSheetName]
          ? (XLSX.utils.sheet_to_json(workbook.Sheets[regDevSheetName]) as Record<string, any>[])
          : [];

        // --- Parse Groups sheet (Hierarchy) ---
        const groupsSheet = workbook.Sheets["Groups"];
        let rawParsedNodes: HierarchyNode[] = [];
        if (groupsSheet) {
          const rows = XLSX.utils.sheet_to_json(groupsSheet) as Record<string, any>[];
          if (rows.length > 0 && rows[0].nodeId) {
            rawParsedNodes = rows.map((r) => ({
              nodeId: String(r.nodeId),
              parentId: r.parentId ? String(r.parentId) : null,
              name: String(r.nodeName || ""),
              type: (r.nodeType || "group") as any,
              order: Number(r.sortOrder || 0),
            }));
          } else if (rows.length > 0 && (rows[0].groupId || rows[0].groupName)) {
            rawParsedNodes = rows.map((r) => ({
              nodeId: r.groupId ? String(r.groupId) : migrateGroupNameToNodeId(r.groupName || "과천"),
              parentId: "stn-root",
              name: String(r.groupName || r.groupId || ""),
              type: "group",
              order: 0,
            }));
          }
        }

        // --- Filter Nodes based on scope (Ancestors only for NODE scope) ---
        let finalNodes = rawParsedNodes;
        if (exportScopeType === "NODE" && exportScopeNodeId) {
          const keptIds = new Set<string>();
          const findAncestors = (nid: string) => {
            if (keptIds.has(nid)) return;
            keptIds.add(nid);
            const node = rawParsedNodes.find(n => n.nodeId === nid);
            if (node?.parentId) findAncestors(node.parentId);
          };
          
          if (rawParsedNodes.some(n => n.nodeId === exportScopeNodeId)) {
            findAncestors(exportScopeNodeId);
          } else {
            // If target node not in list, keep it as is or fallback
            keptIds.add(exportScopeNodeId);
          }
          finalNodes = rawParsedNodes.filter(n => keptIds.has(n.nodeId));
        }

        // --- Robust Property Access Helpers ---
        const getValue = (row: any, ...synonyms: string[]) => {
          for (const s of synonyms) {
            if (row[s] !== undefined) return row[s];
            const key = Object.keys(row).find((k) => k.toLowerCase() === s.toLowerCase());
            if (key) return row[key];
          }
          return undefined;
        };

        const getRowNodeId = (row: any) => {
          // 1. Try to resolve by Path first (Full Hierarchy)
          const pathStr =
            getValue(row, "groupPath") || getValue(row, "nodePath");
          if (pathStr) {
            const { nodeId: resolvedId, newNodes } = resolvePathToNodeId(
              systemNodes,
              String(pathStr),
              finalNodes,
            );
            if (newNodes.length > 0) {
              finalNodes.push(...newNodes);
            }
            return resolvedId;
          }

          // 2. Try to resolve by Name (Single level or Legacy names)
          const gname =
            getValue(row, "groupName") ||
            getValue(row, "nodeName") ||
            getValue(row, "group");
          if (gname) {
            const strName = String(gname).trim();
            // Try EXACT name + parent match in existing nodes first
            const matched = finalNodes.find((n) => n.name.toLowerCase() === strName.toLowerCase());
            if (matched) return matched.nodeId;
            
            // Try global search in system nodes if not in finalNodes
            const sysMatched = systemNodes.find(n => n.name.toLowerCase() === strName.toLowerCase());
            if (sysMatched) return sysMatched.nodeId;

            // Legacy mapping fallback
            const migrated = migrateGroupNameToNodeId(strName);
            if (migrated !== strName) return migrated;

            // If it's a new name without a path, resolve it (creates under root if ambiguous)
            const { nodeId: resolvedId, newNodes } = resolvePathToNodeId(
              systemNodes,
              strName,
              finalNodes,
            );
            if (newNodes.length > 0) {
              finalNodes.push(...newNodes);
            }
            return resolvedId;
          }

          // 3. Last fallback: Internal ID
          const nid = getValue(row, "nodeId") || getValue(row, "groupId");
          if (nid) return String(nid);

          return undefined;
        };

        // --- Reconstruction ---
        const dataByNode: Record<string, { racks: Rack[]; registeredDevices: RegisteredDevice[] }> = {};
        let ignoredCount = 0;

        const isAllowedNode = (_nid: string) => {
          // During import, we generally want to allow everything in the file
          // to prevent accidental data loss due to scope mismatches.
          return true;
        };

        // Helper to ensure node entry exists
        const ensureNode = (nid: string) => {
          if (!dataByNode[nid]) {
            dataByNode[nid] = { racks: [], registeredDevices: [] };
          }
        };

        // 1. Process Racks
        racksFlat.forEach((r) => {
          const nid = getRowNodeId(r) || "unassigned";
          if (!isAllowedNode(nid)) {
            ignoredCount++;
            return;
          }
          ensureNode(nid);

          const rackId = String(getValue(r, "rackId"));
          const rackDevices = devicesFlat
            .filter((d) => String(getValue(d, "rackId")) === rackId)
            .map((d) => {
              const devId = String(getValue(d, "deviceId"));
              const devicePorts = portsFlat
                .filter((p) => String(getValue(p, "deviceId")) === devId)
                .map((p) => ({
                  portId: String(getValue(p, "portId")),
                  status: (getValue(p, "status") as "normal" | "error") || "normal",
                  errorLevel: getValue(p, "errorLevel") || undefined,
                  errorMessage: getValue(p, "errorMessage") || undefined,
                }));

              return {
                id: devId,
                name: String(getValue(d, "name", "deviceName") || ""),
                type: getValue(d, "type") as any,
                uSize: Number(getValue(d, "uSize")),
                uPosition: Number(getValue(d, "uPosition")),
                imageUrl: getValue(d, "imageUrl") || undefined,
                modelName: getValue(d, "modelName") || undefined,
                ip: getValue(d, "ip") || undefined,
                mac: getValue(d, "mac") || undefined,
                vendor: getValue(d, "vendor") || undefined,
                registeredDeviceId: getValue(d, "registeredDeviceId") || undefined,
                portStates: devicePorts,
              };
            });

          dataByNode[nid].racks.push({
            id: rackId,
            nodeId: nid,
            uHeight: Number(getValue(r, "uHeight")) as 24 | 32 | 48,
            width: Number(getValue(r, "width") || RACK_WIDTH_STANDARD),
            position: [Number(getValue(r, "posX")), Number(getValue(r, "posZ"))] as [number, number],
            orientation: Number(getValue(r, "orientation") || 180) as 0 | 90 | 180 | 270,
            devices: rackDevices as any,
          });
        });

        // 2. Process Registered Devices
        regDevFlat.forEach((d) => {
          const nid = getRowNodeId(d) || "unassigned";
          if (!isAllowedNode(nid)) {
            ignoredCount++;
            return;
          }
          ensureNode(nid);

          dataByNode[nid].registeredDevices.push({
            id: String(getValue(d, "id", "registeredDeviceId")),
            nodeId: nid,
            deviceName: String(getValue(d, "deviceName", "name") || ""),
            modelName: String(getValue(d, "modelName") || ""),
            type: getValue(d, "type") as any,
            uSize: Number(getValue(d, "uSize")),
            ip: String(getValue(d, "ip") || ""),
            mac: String(getValue(d, "mac") || ""),
            vendor: getValue(d, "vendor") || undefined,
          });
        });

        resolve({ 
          nodes: finalNodes, 
          dataByNode, 
          exportScope: { type: exportScopeType, nodeId: exportScopeNodeId },
          ignoredCount 
        });
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

// ─── Sample Data Generation ─────────────────────────────────────────────────

const generateRegisteredDevices = (
  nodeId: string,
  nodeName: string,
  count: number,
  ipBase: string,
): RegisteredDevice[] =>
  Array.from({ length: count }).map((_, i) => {
    const template = DEVICE_TEMPLATES[i % DEVICE_TEMPLATES.length];
    const ipParts = ipBase.split(".");
    const lastOctet = parseInt(ipParts[3]) + i;
    return {
      id: generateUUID(),
      nodeId,
      deviceName: `${template.modelName}-${nodeName}-${i + 1}`,
      modelName: template.modelName,
      type: template.type,
      uSize: template.uSize,
      ip: `${ipParts[0]}.${ipParts[1]}.${ipParts[2]}.${lastOctet}`,
      mac: `00:00:5e:00:53:${localIdxToMac(i)}`,
      vendor: "Nokia",
    };
  });

const localIdxToMac = (idx: number) => {
  const hex = idx.toString(16).padStart(2, "0");
  return hex;
};

export const sampleNodes: HierarchyNode[] = getDefaultNodes();

export const sampleRegisteredDevices: RegisteredDevice[] = sampleNodes.flatMap((node, idx) =>
  generateRegisteredDevices(node.nodeId, node.name, 20, `10.${idx + 1}.1.1`)
);

const generateGroupRacks = (
  count: number,
  nodeId: string,
  colsPerRow: number,
  errorIndexes: number[],
  regDevices: RegisteredDevice[],
): Rack[] =>
  Array.from({ length: count }).map((_, localIdx) => {
    const row = Math.floor(localIdx / colsPerRow);
    const col = localIdx % colsPerRow;

    const isWide = col === 4 || col === 9;
    const width = isWide ? RACK_WIDTH_WIDE : RACK_WIDTH_STANDARD;
    const uHeight: 24 | 32 | 48 =
      localIdx % 3 === 0 ? 24 : localIdx % 3 === 1 ? 32 : 48;

    const hasError = errorIndexes.includes(localIdx);

    const devices = [];
    let currentUPos = 1;
    for (let d = 0; d < 5; d++) {
      const remainingU = uHeight - currentUPos + 1;
      const fittingDevices = regDevices.filter((rd) => rd.uSize <= remainingU);
      if (fittingDevices.length === 0) break;

      const regDevice =
        fittingDevices[(localIdx * 7 + d * 3) % fittingDevices.length];
      const shouldAddError = hasError && d === 0;

      devices.push({
        id: generateUUID(),
        name: regDevice.modelName,
        type: regDevice.type,
        uSize: regDevice.uSize,
        uPosition: currentUPos,
        modelName: regDevice.modelName,
        vendor: regDevice.vendor,
        registeredDeviceId: regDevice.id,
        portStates: shouldAddError
          ? [
              {
                portId: `p${Math.floor(Math.random() * 24) + 1}`,
                status: "error" as const,
                errorLevel: (
                  ["warning", "minor", "major", "critical"] as const
                )[Math.floor(Math.random() * 4)],
                errorMessage: "Port link failure",
              },
            ]
          : [],
      });
      currentUPos += regDevice.uSize + 1;
    }

    let worldX = 0;
    for (let j = 0; j < col; j++) {
      const prevIsWide = j === 4 || j === 9;
      worldX += prevIsWide ? RACK_WIDTH_WIDE : RACK_WIDTH_STANDARD;
    }
    const stateX = (worldX + width / 2) / GRID_SPACING;

    return {
      id: generateUUID(),
      nodeId,
      uHeight,
      width,
      position: [stateX, row * 2.0],
      orientation: 180,
      devices,
    };
  });

export const sampleRacks: Rack[] = sampleNodes.flatMap((node, idx) => {
  const nodeDevices = sampleRegisteredDevices.filter((d) => d.nodeId === node.nodeId);
  const rackCount = 8 + (idx % 5);
  return generateGroupRacks(rackCount, node.nodeId, 5, [2, 5], nodeDevices);
});
