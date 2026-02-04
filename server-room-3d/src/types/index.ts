// 에러 레벨
export type ErrorLevel = "critical" | "major" | "minor" | "warning";

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
  portStates: PortState[];
}

// 렉 방향
export type Orientation = 0 | 90 | 180 | 270;

// 렉
export interface Rack {
  id: string;
  uHeight: 24 | 32 | 48; // 렉 높이 옵션
  position: [number, number]; // 그리드 좌표 [x, z]
  orientation?: Orientation; // Rotation angle in degrees
  devices: Device[];
}

export interface DraggedItem {
  type: "rk"; // rack
}
