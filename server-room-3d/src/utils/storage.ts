import type { Rack } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
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
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

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
  XLSX.writeFile(wb, `server-room-${Date.now()}.xlsx`);
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
    `rack-${rack.id.substring(0, 8)}-${Date.now()}.json`,
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
  XLSX.writeFile(wb, `rack-${rack.id.substring(0, 8)}-${Date.now()}.xlsx`);
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
            id: d.deviceId || crypto.randomUUID(),
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

export const sampleRacks: Rack[] = Array.from({ length: 40 }).map((_, i) => {
  const row = Math.floor(i / 10);
  const col = i % 10;

  // Mix standard and wide racks: every 5th rack (index 4 and 9 in row) is wide
  const isWide = col === 4 || col === 9;
  const width = isWide ? RACK_WIDTH_WIDE : RACK_WIDTH_STANDARD;
  const uHeight: 24 | 32 | 48 = i % 3 === 0 ? 24 : i % 3 === 1 ? 32 : 48;

  // Define exactly 6 rack indexes that will have an error
  const errorRackIndexes = [3, 12, 19, 24, 31, 37];
  const hasError = errorRackIndexes.includes(i);

  const devices = [];
  let currentUPos = 1;

  for (let d = 0; d < 5; d++) {
    const remainingU = uHeight - currentUPos + 1;
    const fittingTemplates = DEVICE_TEMPLATES.filter(
      (t) => t.uSize <= remainingU,
    );

    if (fittingTemplates.length === 0) break;

    const template =
      fittingTemplates[Math.floor(Math.random() * fittingTemplates.length)];

    // Only add an error to the first device of the designated error racks
    const shouldAddError = hasError && d === 0;

    devices.push({
      id: crypto.randomUUID(),
      name: `${template.name}-${i}-${d}`,
      type: template.type,
      uSize: template.uSize,
      uPosition: currentUPos,
      imageUrl: template.imageUrl,
      portStates: shouldAddError
        ? [
            {
              portId: `p${Math.floor(Math.random() * 24) + 1}`,
              status: "error" as const,
              errorLevel: (["warning", "minor", "major", "critical"] as const)[
                Math.floor(Math.random() * 4)
              ],
              errorMessage: "Port link failure",
            },
          ]
        : [],
    });
    currentUPos += template.uSize + 1;
  }

  // Calculate world X by summing widths of previous racks in the same row
  let worldX = 0;
  for (let j = 0; j < col; j++) {
    const prevCol = j;
    // Same logic as above for width
    const prevIsWide = prevCol === 4 || prevCol === 9;
    worldX += prevIsWide ? RACK_WIDTH_WIDE : RACK_WIDTH_STANDARD;
  }

  // Center X in world units = current accumulated width + (current width / 2)
  // Convert to state units by dividing by GRID_SPACING
  const stateX = (worldX + width / 2) / GRID_SPACING;

  return {
    id: crypto.randomUUID(),
    uHeight,
    width,
    position: [stateX, row * 2.0],
    orientation: 180,
    devices,
  };
});
