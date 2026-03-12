import type { Rack, RegisteredDevice, HierarchyNode } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
import { getDefaultNodes, GWACHEON_NODE_ID, DAEJEON_NODE_ID, migrateGroupNameToNodeId } from "./nodeUtils";
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

/** Formatted date for filenames: YYYYMMDD_HHMM */
const getFormattedDate = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  return `${y}${m}${d}_${hh}${mm}`;
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
    downloadBlob(blob, `STN_ALL_${getFormattedDate()}.xlsx`);
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
      `Rack_${rack.displayName || rack.id.substring(0, 8)}_${getFormattedDate()}.xlsx`,
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

const SCHEMA_VERSION = "1.0";

// ─── Group-Scoped Flattening Helpers ────────────────────────────────────────

/** Flatten racks with groupId column */
const flattenRacksWithGroup = (racks: Rack[]) =>
  racks.map((r) => ({
    rackId: r.id,
    nodeId: r.nodeId,
    uHeight: r.uHeight,
    width: r.width,
    posX: r.position[0],
    posZ: r.position[1],
    orientation: r.orientation ?? 180,
  }));

/** Flatten devices with groupId column */
const flattenDevicesWithGroup = (racks: Rack[]) => {
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
const flattenRegisteredDevices = (devices: RegisteredDevice[]) =>
  devices.map((d) => ({
    id: d.id,
    nodeId: d.nodeId,
    deviceName: d.deviceName,
    modelName: d.modelName,
    type: d.type,
    uSize: d.uSize,
    ip: d.ip,
    mac: d.mac,
    vendor: d.vendor,
  }));

// ─── Master Sheet Builders ──────────────────────────────────────────────────

const buildMetaSheet = () =>
  XLSX.utils.json_to_sheet([
    { key: "schemaVersion", value: SCHEMA_VERSION },
    { key: "lastExportAt", value: new Date().toISOString() },
  ]);

const buildGroupsSheet = () =>
  XLSX.utils.json_to_sheet(
    Object.entries(GROUP_ID_MAP).map(([name, id]) => ({
      groupId: id,
      groupName: name,
    })),
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
  scope: ExportScope = "ALL",
) => {
  const wb = XLSX.utils.book_new();

  // ── Master sheets (always present) ──
  XLSX.utils.book_append_sheet(wb, buildMetaSheet(), "_META");
  XLSX.utils.book_append_sheet(wb, buildGroupsSheet(), "Groups");

  const allRackRows = flattenRacksWithGroup(racks);
  const allDeviceRows = flattenDevicesWithGroup(racks);
  const allPortRows = flattenPortsWithGroup(racks);
  const allRegDevRows = flattenRegisteredDevices(registeredDevices);

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
  if (scope !== "ALL") {
    const groupId = GROUP_ID_MAP[scope] || scope; // nodeId or legacy group mapping
    const groupRacks = allRackRows.filter((r) => (r as any).nodeId === scope || (r as any).groupId === groupId);
    const groupDevices = allDeviceRows.filter((d) => (d as any).nodeId === scope || (d as any).groupId === groupId);
    const groupPorts = allPortRows.filter((p) => (p as any).nodeId === scope || (p as any).groupId === groupId);

    // PKG metadata sheet (use groupId for sheet names to avoid encoding issues)
    const pkgMeta = XLSX.utils.json_to_sheet([
      { key: "packageId", value: generateUUID() },
      { key: "groupId", value: groupId },
      { key: "groupName", value: scope },
      { key: "exportScope", value: "GROUP_ONLY" },
      { key: "schemaVersion", value: SCHEMA_VERSION },
      { key: "exportedAt", value: new Date().toISOString() },
      { key: "importModeHint", value: "REPLACE" },
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

  const scopeLabel = scope === "ALL" ? "ALL" : scope;
  try {
    const u8 = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([u8], { type: EXCEL_MIME });
    downloadBlob(blob, `STN_${scopeLabel}_${getFormattedDate()}.xlsx`);
  } catch (err) {
    console.error("Export failed:", err);
    alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
  }
};

/**
 * Export selected registered devices to Excel
 */
export const exportRegisteredDevicesToExcel = (
  devices: RegisteredDevice[],
  scope: string, // "ALL" | "과천" | "대전" | "SELECTED"
) => {
  const wb = XLSX.utils.book_new();
  const rows = flattenRegisteredDevices(devices);

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
    downloadBlob(
      blob,
      `STN_registered_devices_${scope}_${getFormattedDate()}.xlsx`,
    );
  } catch (err) {
    console.error("Export failed:", err);
    alert("내보내기에 실패했습니다. 콘솔을 확인해주세요.");
  }
};

/**
 * Import registered devices from a standalone Excel file
 */
export const parseRegisteredDevicesFromExcel = (
  file: File,
): Promise<Omit<RegisteredDevice, "id">[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const sheetName = workbook.SheetNames.includes("RegisteredDevices")
          ? "RegisteredDevices"
          : workbook.SheetNames.includes("Devices")
            ? "Devices"
            : workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];
        if (!sheet) throw new Error("No sheets found in Excel file.");

        const rows = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

        const parsed: Omit<RegisteredDevice, "id">[] = rows
          .map((r): Omit<RegisteredDevice, "id"> | null => {
            const grpName = r.groupName || GROUP_NAME_MAP[r.groupId] || "과천";
            const nid = (r.nodeId as string) || migrateGroupNameToNodeId(grpName);
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

        resolve(parsed);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Import group-scoped data from PKG sheets in a workbook.
 * Returns reconstructed Rack[] for the target group only.
 */
export const importGroupPackage = (
  file: File,
  targetNodeId: string | "ALL",
): Promise<{ racks: Rack[]; registeredDevices: RegisteredDevice[] }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const groupId =
          targetNodeId === "ALL" ? "ALL" : (GROUP_ID_MAP[targetNodeId] || targetNodeId);
        const targetGroup = GROUP_NAME_MAP[groupId] || targetNodeId;

        // ── Try PKG sheets first (groupId then groupName), then master, then legacy ──
        const findSheet = (...candidates: string[]) =>
          candidates.find((name) => workbook.SheetNames.includes(name));

        const rackSheetName =
          targetNodeId === "ALL"
            ? findSheet("Racks", "Rack")
            : findSheet(
                `PKG_${groupId}_Racks`,
                `PKG_${targetGroup}_Racks`,
                "Racks",
                "Rack",
              );
        const deviceSheetName =
          targetNodeId === "ALL"
            ? findSheet("Devices", "Equipment")
            : findSheet(
                `PKG_${groupId}_Devices`,
                `PKG_${targetGroup}_Devices`,
                "Devices",
                "Equipment",
              );
        const portSheetName =
          targetNodeId === "ALL"
            ? findSheet("Ports")
            : findSheet(
                `PKG_${groupId}_Ports`,
                `PKG_${targetGroup}_Ports`,
                "Ports",
              );
        const regDevSheetName = "RegisteredDevices";

        const rackSheet = rackSheetName
          ? workbook.Sheets[rackSheetName]
          : undefined;
        if (!rackSheet)
          throw new Error(
            `Rack sheet not found. Available sheets: ${workbook.SheetNames.join(", ")}`,
          );

        const racksFlat = XLSX.utils.sheet_to_json(rackSheet) as Record<
          string,
          any
        >[];
        const devicesFlat =
          deviceSheetName && workbook.Sheets[deviceSheetName]
            ? (XLSX.utils.sheet_to_json(
                workbook.Sheets[deviceSheetName],
              ) as Record<string, any>[])
            : [];
        const portsFlat =
          portSheetName && workbook.Sheets[portSheetName]
            ? (XLSX.utils.sheet_to_json(
                workbook.Sheets[portSheetName],
              ) as Record<string, any>[])
            : [];
        const regDevFlat = workbook.Sheets[regDevSheetName]
          ? (XLSX.utils.sheet_to_json(
              workbook.Sheets[regDevSheetName],
            ) as Record<string, any>[])
          : [];

        // Filter to target group (in case master sheets are used)
        const filteredRacks =
          targetNodeId === "ALL"
            ? racksFlat
            : racksFlat.filter(
                (r) => r.nodeId === targetNodeId || r.groupId === groupId || r.groupName === targetGroup,
              );

        // Build a set of rack IDs for this group (for device filtering)
        const groupRackIds = new Set(filteredRacks.map((r) => r.rackId));

        // Filter devices: try groupId/groupName first; if none have those fields,
        // fall back to matching by rackId membership (needed for legacy exports)
        const hasDeviceGroupField = devicesFlat.some(
          (d) => d.nodeId !== undefined || d.groupId !== undefined || d.groupName !== undefined,
        );
        const filteredDevices =
          targetNodeId === "ALL"
            ? devicesFlat
            : hasDeviceGroupField
              ? devicesFlat.filter(
                  (d) => d.nodeId === targetNodeId || d.groupId === groupId || d.groupName === targetGroup,
                )
              : devicesFlat.filter((d) => groupRackIds.has(d.rackId));

        // Reconstruct Rack[] from flat rows
        const racks: Rack[] = filteredRacks.map((r) => {
          const rackDevices = filteredDevices
            .filter((d) => d.rackId === r.rackId)
            .map((d) => {
              const devicePorts = portsFlat
                .filter((p) => p.deviceId === d.deviceId)
                .map((p) => ({
                  portId: String(p.portId),
                  status: p.status as "normal" | "error",
                  errorLevel: p.errorLevel || undefined,
                  errorMessage: p.errorMessage || undefined,
                }));

              return {
                id: String(d.deviceId),
                name: String(d.name || ""),
                type: d.type as any,
                uSize: Number(d.uSize),
                uPosition: Number(d.uPosition),
                imageUrl: d.imageUrl || undefined,
                modelName: d.modelName || undefined,
                ip: d.ip || undefined,
                mac: d.mac || undefined,
                vendor: d.vendor || undefined,
                registeredDeviceId: d.registeredDeviceId || undefined,
                portStates: devicePorts,
              };
            });

          return {
            id: String(r.rackId),
            nodeId: (r.nodeId as string) ||
              (targetNodeId === "ALL"
                ? migrateGroupNameToNodeId(r.groupName || GROUP_NAME_MAP[r.groupId] || "과천")
                : targetNodeId),
            uHeight: Number(r.uHeight) as 24 | 32 | 48,
            width: Number(r.width || RACK_WIDTH_STANDARD),
            position: [Number(r.posX), Number(r.posZ)] as [number, number],
            orientation: Number(r.orientation || 180) as 0 | 90 | 180 | 270,
            devices: rackDevices as any,
          };
        });

        // Reconstruct RegisteredDevice[] for the target group
        const registeredDevices: RegisteredDevice[] = regDevFlat
          .filter((d) =>
            targetNodeId === "ALL"
              ? true
              : d.nodeId === targetNodeId || d.groupId === groupId || d.groupName === targetGroup,
          )
          .map((d) => ({
            id: String(d.id),
            nodeId: (d.nodeId as string) ||
              (targetNodeId === "ALL"
                ? migrateGroupNameToNodeId(d.groupName || GROUP_NAME_MAP[d.groupId] || "과천")
                : targetNodeId),
            deviceName: String(d.deviceName || ""),
            modelName: String(d.modelName || ""),
            type: d.type as any,
            uSize: Number(d.uSize),
            ip: String(d.ip || ""),
            mac: String(d.mac || ""),
            vendor: d.vendor as any,
          }));

        resolve({ racks, registeredDevices });
      } catch (err) {
        reject(err);
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

export const sampleRegisteredDevices: RegisteredDevice[] = [
  ...generateRegisteredDevices(GWACHEON_NODE_ID, "과천", 50, "10.10.1.1"),
  ...generateRegisteredDevices(DAEJEON_NODE_ID, "대전", 30, "10.20.1.1"),
];

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

const gwacheonDevices = sampleRegisteredDevices.filter(
  (d) => d.nodeId === GWACHEON_NODE_ID,
);
const daejeonDevices = sampleRegisteredDevices.filter(
  (d) => d.nodeId === DAEJEON_NODE_ID,
);

export const sampleRacks: Rack[] = [
  ...generateGroupRacks(25, GWACHEON_NODE_ID, 5, [3, 12, 19], gwacheonDevices),
  ...generateGroupRacks(15, DAEJEON_NODE_ID, 5, [2, 9, 14], daejeonDevices),
];
