/**
 * Device Asset Image Resolver
 *
 * Dynamically maps modelName → image URL using Vite's import.meta.glob.
 * Asset files in src/assets/ have the naming pattern: "[{uSize}U] {modelName}.png"
 * This module strips the prefix to build a modelName → URL map.
 */

// Eagerly import all PNG images from src/assets/
const assetModules = import.meta.glob<{ default: string }>("../assets/*.png", {
  eager: true,
});

// Build modelName → resolved URL map
// File names: "[13U] 7250 IXR-10.png" → modelName: "7250 IXR-10"
const deviceImageMap = new Map<string, string>();

for (const [path, mod] of Object.entries(assetModules)) {
  // Extract filename from path: "../assets/[13U] 7250 IXR-10.png" → "[13U] 7250 IXR-10.png"
  const filename = path.split("/").pop() ?? "";
  // Remove .png extension
  const nameWithPrefix = filename.replace(/\.png$/i, "");
  // Remove "[XU] " prefix: "[13U] 7250 IXR-10" → "7250 IXR-10"
  const modelName = nameWithPrefix.replace(/^\[\d+U\]\s*/, "");

  if (modelName && mod.default) {
    deviceImageMap.set(modelName, mod.default);
    // Also add lowercase variant for case-insensitive matching
    deviceImageMap.set(modelName.toLowerCase(), mod.default);
  }
}

/**
 * Resolve a device image URL from modelName.
 * Returns the Vite-resolved asset URL or undefined if not found.
 */
export const resolveDeviceImage = (modelName?: string): string | undefined => {
  if (!modelName) return undefined;
  return (
    deviceImageMap.get(modelName) ?? deviceImageMap.get(modelName.toLowerCase())
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
