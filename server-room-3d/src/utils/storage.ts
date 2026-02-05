import type { Rack } from "../types";
import { DEVICE_TEMPLATES } from "./deviceTemplates";

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
