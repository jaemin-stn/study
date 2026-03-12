import type { HierarchyNode } from "../types";

// ─── Default Node IDs (고정 상수) ──────────────────────────────────────────────

// depth 1
export const ROOT_NODE_ID = "stn-root";
// depth 2
export const SUDOGWON_NODE_ID = "sudogwon";
export const CHUNGCHEONG_NODE_ID = "chungcheong";
// depth 3
export const GYEONGGI_NODE_ID = "gyeonggi";
export const DAEJEON_CITY_NODE_ID = "daejeon-city";
// depth 4
export const GWACHEON_CENTER_NODE_ID = "gwacheon-center";
export const DAEJEON_CENTER_NODE_ID = "daejeon-center";
// depth 5 (rooms)
export const GWACHEON_NODE_ID = "gwacheon-room-1f"; // Keep same var name for backwards compat
export const GWACHEON_ROOM_2F_NODE_ID = "gwacheon-room-2f"; 
export const DAEJEON_NODE_ID = "daejeon-room-1f"; // Keep same var name for backwards compat

// ─── Default Tree ──────────────────────────────────────────────────────────────

/** 5-Depth Tree: STN \> 지역 \> 도시 \> 센터 \> 서버실 */
export const getDefaultNodes = (): HierarchyNode[] => [
  // Depth 1
  { nodeId: ROOT_NODE_ID, parentId: null, name: "STN", type: "root", order: 0 },
  // Depth 2
  { nodeId: SUDOGWON_NODE_ID, parentId: ROOT_NODE_ID, name: "수도권", type: "group", order: 0 },
  { nodeId: CHUNGCHEONG_NODE_ID, parentId: ROOT_NODE_ID, name: "충청권", type: "group", order: 1 },
  // Depth 3
  { nodeId: GYEONGGI_NODE_ID, parentId: SUDOGWON_NODE_ID, name: "경기", type: "group", order: 0 },
  { nodeId: DAEJEON_CITY_NODE_ID, parentId: CHUNGCHEONG_NODE_ID, name: "대전", type: "group", order: 0 },
  // Depth 4
  { nodeId: GWACHEON_CENTER_NODE_ID, parentId: GYEONGGI_NODE_ID, name: "과천센터", type: "group", order: 0 },
  { nodeId: DAEJEON_CENTER_NODE_ID, parentId: DAEJEON_CITY_NODE_ID, name: "대전센터", type: "group", order: 0 },
  // Depth 5
  { nodeId: GWACHEON_NODE_ID, parentId: GWACHEON_CENTER_NODE_ID, name: "1층 서버실", type: "group", order: 0 },
  { nodeId: GWACHEON_ROOM_2F_NODE_ID, parentId: GWACHEON_CENTER_NODE_ID, name: "2층 통신실", type: "group", order: 1 },
  { nodeId: DAEJEON_NODE_ID, parentId: DAEJEON_CENTER_NODE_ID, name: "1층 서버실", type: "group", order: 0 },
];

// ─── Tree Traversal Utilities ──────────────────────────────────────────────────

/** 직계 자식 노드 반환 (order 순 정렬) */
export const getChildren = (
  nodes: HierarchyNode[],
  parentId: string | null,
): HierarchyNode[] =>
  nodes
    .filter((n) => n.parentId === parentId)
    .sort((a, b) => a.order - b.order);

/** 지정 노드 + 하위 전체 nodeId 집합 반환 (자기 포함) */
export const getSubtreeNodeIds = (
  nodes: HierarchyNode[],
  nodeId: string,
): Set<string> => {
  const result = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    result.add(current);
    for (const child of nodes) {
      if (child.parentId === current && !result.has(child.nodeId)) {
        stack.push(child.nodeId);
      }
    }
  }
  return result;
};

/** root까지 조상 경로 배열 반환 [root, ..., parent, self] (breadcrumb용) */
export const getAncestorPath = (
  nodes: HierarchyNode[],
  nodeId: string,
): HierarchyNode[] => {
  const path: HierarchyNode[] = [];
  let current = nodes.find((n) => n.nodeId === nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId
      ? nodes.find((n) => n.nodeId === current!.parentId)
      : undefined;
  }
  return path;
};

/** root 노드 찾기 */
export const getRootNode = (
  nodes: HierarchyNode[],
): HierarchyNode | undefined => nodes.find((n) => n.parentId === null);

/** 노드 ID로 노드 찾기 */
export const findNode = (
  nodes: HierarchyNode[],
  nodeId: string,
): HierarchyNode | undefined => nodes.find((n) => n.nodeId === nodeId);

/** 특정 노드가 leaf인지 (자식 없는지) 확인 */
export const isLeafNode = (
  nodes: HierarchyNode[],
  nodeId: string,
): boolean => !nodes.some((n) => n.parentId === nodeId);

// ─── Migration Helpers ─────────────────────────────────────────────────────────

/** 이전 groupName → nodeId 매핑 (하위 호환) */
export const migrateGroupNameToNodeId = (
  groupName: string,
): string => {
  switch (groupName) {
    case "과천":
    case "gwacheon":
      return GWACHEON_NODE_ID;
    case "대전":
    case "daejeon":
      return DAEJEON_NODE_ID;
    default:
      return groupName; // return as is if not a known legacy name
  }
};

/** 노드 ID를 기반으로 노드 이름을 로버스트하게 반환 (fallback 포함) */
export const getNodeName = (
  nodes: HierarchyNode[],
  nodeId: string,
): string => {
  if (!nodeId) return "Unknown";
  
  // 1. Direct match
  const direct = findNode(nodes, nodeId);
  if (direct) return direct.name;
  
  // 2. Try migration mapping
  const migratedId = migrateGroupNameToNodeId(nodeId);
  if (migratedId !== nodeId) {
    const migrated = findNode(nodes, migratedId);
    if (migrated) return migrated.name;
  }
  
  // 3. Known ID logic
  if (nodeId === GWACHEON_NODE_ID || nodeId === "gwacheon") return "1층 서버실";
  if (nodeId === DAEJEON_NODE_ID || nodeId === "daejeon") return "1층 서버실";
  
  return nodeId; // Final fallback
};
