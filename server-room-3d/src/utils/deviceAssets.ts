/**
 * Device Asset Image Resolver
 *
 * Dynamically maps modelName → image URL using Vite's import.meta.glob.
 * Asset files in src/assets/ have the naming pattern: "[{uSize}U] {modelName}.png"
 *
 * SVG files with port path data are loaded as raw text (?raw) to avoid
 * network fetch and URL encoding issues with special chars in filenames.
 * SVG pattern: "[{uSize}U] {modelName}.svg" with <path id="port-N" ...>
 */

// Eagerly import all PNG images from src/assets/
const assetModules = import.meta.glob<{ default: string }>("../assets/*.png", {
  eager: true,
});

// Eagerly import all SVG files from src/assets/ as raw text
// Using ?raw avoids fetch() and URL-encoding issues with special char filenames.
const svgRawModules = import.meta.glob<{ default: string }>("../assets/*.svg", {
  eager: true,
  query: "?raw",
});

// ── PNG: modelName → resolved URL ──────────────────────────────────────────
const deviceImageMap = new Map<string, string>();
for (const [path, mod] of Object.entries(assetModules)) {
  const filename = path.split("/").pop() ?? "";
  const modelName = filename.replace(/\.png$/i, "").replace(/^\[\d+U\]\s*/, "");
  if (modelName && mod.default) {
    deviceImageMap.set(modelName, mod.default);
    deviceImageMap.set(modelName.toLowerCase(), mod.default);
  }
}

// ── SVG: modelName → raw SVG text ──────────────────────────────────────────
const deviceSvgContentMap = new Map<string, string>();
for (const [path, mod] of Object.entries(svgRawModules)) {
  const filename = path.split("/").pop() ?? "";
  const modelName = filename.replace(/\.svg$/i, "").replace(/^\[\d+U\]\s*/, "");
  if (modelName && mod.default) {
    deviceSvgContentMap.set(modelName, mod.default);
    deviceSvgContentMap.set(modelName.toLowerCase(), mod.default);
  }
}

/**
 * Resolve a device PNG image URL from modelName.
 * Returns the Vite-resolved asset URL or undefined if not found.
 */
export const resolveDeviceImage = (modelName?: string): string | undefined => {
  if (!modelName) return undefined;
  return (
    deviceImageMap.get(modelName) ?? deviceImageMap.get(modelName.toLowerCase())
  );
};

/**
 * Resolve a device SVG raw text content from modelName.
 * Returns the inline SVG string or undefined if no SVG asset exists.
 */
export const resolveDeviceSvgContent = (modelName?: string): string | undefined => {
  if (!modelName) return undefined;
  return (
    deviceSvgContentMap.get(modelName) ??
    deviceSvgContentMap.get(modelName.toLowerCase())
  );
};

/** Get all available model image entries (for debugging) */
export const getAvailableModelImages = (): string[] =>
  Array.from(
    new Set(
      Array.from(deviceImageMap.keys()).filter(
        (k) =>
          k !== k.toLowerCase() ||
          !deviceImageMap.has(k.charAt(0).toUpperCase() + k.slice(1)),
      ),
    ),
  );
