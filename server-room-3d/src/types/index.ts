// 에러 레벨
export type ErrorLevel = "critical" | "major" | "minor" | "warning";

// 그룹 이름 (STN 하위)
export type GroupName = "과천" | "대전";

// 벤더 이름
export type VendorName =
  | "코위버PTN"
  | "CISCO"
  | "Huawei"
  | "Nokia"
  | "유비쿼스";

// 포트 상태
export interface PortState {
  portId: string;
  status: "normal" | "error";
  errorLevel?: ErrorLevel;
  errorMessage?: string;
}

// 장비 타입
export type DeviceType = "Switch" | "Router" | "Server";

// 장비
export interface Device {
  id: string;
  type: DeviceType;
  name: string;
  uSize: number; // 1U, 2U 등 (높이)
  uPosition: number; // 렉 내부 위치 (1부터 시작, 아래에서 위로)
  imageUrl?: string; // Custom faceplate image URL
  modelName?: string; // 모델명 (assets 폴더 내 이미지 매핑)
  ip?: string;
  mac?: string;
  vendor?: VendorName;
  registeredDeviceId?: string; // 등록 장비 참조 ID
  portStates: PortState[];
}

// 등록 장비 (그룹별 실제 장비 인벤토리)
export interface RegisteredDevice {
  id: string;
  groupName: GroupName;
  deviceName: string; // 사용자 지정 장비명
  modelName: string; // e.g. "7250 IXR-R6"
  type: DeviceType;
  uSize: number;
  ip: string;
  mac: string;
  vendor: VendorName;
}

// 렉 방향
export type Orientation = 0 | 90 | 180 | 270;

// 렉
export interface Rack {
  id: string;
  groupName: GroupName; // STN 하위 그룹 (과천/대전)
  uHeight: 24 | 32 | 48; // 렉 높이 옵션
  width: number; // 렉 너비 (0.6, 1.0 등)
  position: [number, number]; // 그리드 좌표 [x, z]
  orientation?: Orientation; // Rotation angle in degrees
  devices: Device[];
}

export interface DraggedItem {
  type: "rk"; // rack
}

// Built-in 모델 종류
export type BuiltinModelType =
  | "Wall"
  | "Chair"
  | "Desk"
  | "Desk2"
  | "Partition";

// 가시성 모드 (투명 유리 vs 불투명)
export type VisibilityMode = "transparent" | "opaque";

// Partition 파라메트릭 파라미터
export interface PartitionParams {
  height: number;
  length: number;
  thickness: number;
  color: string;
  visibilityMode: VisibilityMode;
}

// Wall 파라메트릭 파라미터
export interface WallParams {
  height: number; // Y축 높이 (미터)
  length: number; // X축 길이 (미터)
  thickness: number; // Z축 두께 (미터)
  color: string; // hex color
}

// 임포트된 3D 모델
export interface ImportedModel {
  id: string;
  name: string;
  fileName: string;
  /** Base64 data URL of the GLB file, or public URL path for built-in models */
  dataUrl: string;
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles in radians
  scale: [number, number, number];
  /** Per-model movement toggle: true = movable, false = locked (default: false) */
  isMoveEnabled?: boolean;
  /** If set, this model is a built-in default model */
  builtinType?: BuiltinModelType;
  /** Wall-specific parametric dimensions (only when builtinType === "Wall") */
  wallParams?: WallParams;
  /** Partition-specific parametric dimensions (only when builtinType === "Partition") */
  partitionParams?: PartitionParams;
}
