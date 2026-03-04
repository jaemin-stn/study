import type { BuiltinModelType, WallParams } from "../types";

export interface BuiltinModelDef {
  type: BuiltinModelType;
  label: string;
  emoji: string;
  /** Public URL path to GLB, empty string for procedural models (Wall) */
  assetUrl: string;
  fileName: string;
}

/** Default wall parameters */
export const DEFAULT_WALL_PARAMS: WallParams = {
  height: 3,
  length: 5,
  thickness: 0.15,
  color: "#8a8a8a",
};

/** List of all built-in models available in the palette */
export const BUILTIN_MODELS: BuiltinModelDef[] = [
  {
    type: "Wall",
    label: "Wall",
    emoji: "🧱",
    assetUrl: "", // procedural — no GLB
    fileName: "__builtin_wall",
  },
  {
    type: "Chair",
    label: "Chair",
    emoji: "🪑",
    assetUrl: "/assets/3D/Chair.glb",
    fileName: "__builtin_chair.glb",
  },
  {
    type: "Desk",
    label: "Desk",
    emoji: "🖥️",
    assetUrl: "/assets/3D/Desk.glb",
    fileName: "__builtin_desk.glb",
  },
  {
    type: "Desk2",
    label: "Desk 2",
    emoji: "📐",
    assetUrl: "/assets/3D/Desk2.glb",
    fileName: "__builtin_desk2.glb",
  },
];
