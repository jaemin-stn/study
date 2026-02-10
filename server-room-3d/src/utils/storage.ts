import type { Rack } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";
import * as XLSX from "xlsx";

export const saveToJSON = (racks: Rack[]) => {
  const json = JSON.stringify(racks, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `server-room-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

export const saveToExcel = (racks: Rack[]) => {
  const rackData = racks.map((r) => ({
    rackId: r.id,
    uHeight: r.uHeight,
    posX: r.position[0],
    posZ: r.position[1],
    orientation: r.orientation,
  }));

  const deviceData: Record<string, unknown>[] = [];
  const portData: Record<string, unknown>[] = [];

  racks.forEach((r) => {
    r.devices.forEach((d) => {
      deviceData.push({
        deviceId: d.id,
        rackId: r.id,
        name: d.name,
        type: d.type,
        uSize: d.uSize,
        uPosition: d.uPosition,
        imageUrl: d.imageUrl || "",
      });

      d.portStates.forEach((p) => {
        portData.push({
          portId: p.portId,
          deviceId: d.id,
          status: p.status,
          errorLevel: p.errorLevel || "",
          errorMessage: p.errorMessage || "",
        });
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const rackSheet = XLSX.utils.json_to_sheet(rackData);
  const deviceSheet = XLSX.utils.json_to_sheet(deviceData);
  const portSheet = XLSX.utils.json_to_sheet(portData);

  XLSX.utils.book_append_sheet(wb, rackSheet, "Racks");
  XLSX.utils.book_append_sheet(wb, deviceSheet, "Devices");
  XLSX.utils.book_append_sheet(wb, portSheet, "Ports");

  XLSX.writeFile(wb, `server-room-${Date.now()}.xlsx`);
};

export const loadFromExcel = (file: File): Promise<Rack[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const rackSheet = workbook.Sheets["Racks"];
        const deviceSheet = workbook.Sheets["Devices"];
        const portSheet = workbook.Sheets["Ports"];

        if (!rackSheet) throw new Error('Sheet "Racks" not found');

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
            position: [Number(r.posX), Number(r.posZ)],
            orientation: Number(r.orientation) as 0 | 90 | 180 | 270,
            devices: rackDevices as any, // Cast to any to bypass compatibility check with deep nested structures
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

export const saveRackToJSON = (rack: Rack) => {
  const json = JSON.stringify(rack, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rack-${rack.id.substring(0, 8)}-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
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

export const saveRackToExcel = (rack: Rack) => {
  const rackData = [
    {
      rackName: rack.id, // Or use a name if available
      uHeight: rack.uHeight,
      orientation: rack.orientation,
    },
  ];

  const deviceData = rack.devices.map((d) => ({
    deviceId: d.id,
    name: d.name,
    type: d.type,
    uSize: d.uSize,
    uPosition: d.uPosition,
    imageUrl: d.imageUrl || "",
  }));

  const portData: any[] = [];
  rack.devices.forEach((d) => {
    d.portStates.forEach((p) => {
      portData.push({
        portId: p.portId,
        deviceId: d.id,
        status: p.status,
        errorLevel: p.errorLevel || "",
        errorMessage: p.errorMessage || "",
      });
    });
  });

  const wb = XLSX.utils.book_new();
  const rackSheet = XLSX.utils.json_to_sheet(rackData);
  const deviceSheet = XLSX.utils.json_to_sheet(deviceData);
  const portSheet = XLSX.utils.json_to_sheet(portData);

  XLSX.utils.book_append_sheet(wb, rackSheet, "Rack");
  XLSX.utils.book_append_sheet(wb, deviceSheet, "Equipment");
  XLSX.utils.book_append_sheet(wb, portSheet, "Ports");

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

export const sampleRacks: Rack[] = Array.from({ length: 20 }).map((_, i) => {
  const row = Math.floor(i / 10);
  const col = i % 10;
  const uHeight: 24 | 32 | 48 = i % 3 === 0 ? 24 : i % 3 === 1 ? 32 : 48;

  // Pick 5 devices from all templates
  const devices = [];
  let currentUPos = 1;

  for (let d = 0; d < 5; d++) {
    // Try to find a template that fits in the remaining space
    const remainingU = uHeight - currentUPos + 1;
    const fittingTemplates = DEVICE_TEMPLATES.filter(
      (t) => t.uSize <= remainingU,
    );

    if (fittingTemplates.length === 0) break;

    const template =
      fittingTemplates[Math.floor(Math.random() * fittingTemplates.length)];
    devices.push({
      id: crypto.randomUUID(),
      name: `${template.name}-${i}-${d}`,
      type: template.type,
      uSize: template.uSize,
      uPosition: currentUPos,
      imageUrl: template.imageUrl,
      portStates:
        Math.random() > 0.7
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
    currentUPos += template.uSize + 1; // Leave 1U space
  }

  return {
    id: crypto.randomUUID(),
    uHeight,
    position: [col * 2.5, row * 2.0],
    orientation: 180,
    devices,
  };
});
