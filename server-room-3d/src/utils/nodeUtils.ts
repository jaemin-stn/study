import type { HierarchyNode } from "../types";

// ─── Default Node IDs (고정 상수) ──────────────────────────────────────────────

export const ROOT_NODE_ID = "stn-root";
export const GWACHEON_NODE_ID = "gwacheon";
export const DAEJEON_NODE_ID = "daejeon";

// ─── Default Tree ──────────────────────────────────────────────────────────────

/** 기본 트리: STN(root) > 과천, 대전 */
export const getDefaultNodes = (): HierarchyNode[] => [
  {
    nodeId: ROOT_NODE_ID,
    parentId: null,
    name: "STN",
    type: "root",
    order: 0,
  },
  {
    nodeId: GWACHEON_NODE_ID,
    parentId: ROOT_NODE_ID,
    name: "과천",
    type: "group",
    order: 0,
  },
  {
    nodeId: DAEJEON_NODE_ID,
    parentId: ROOT_NODE_ID,
    name: "대전",
    type: "group",
    order: 1,
  },
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
      return GWACHEON_NODE_ID;
    case "대전":
      return DAEJEON_NODE_ID;
    default:
      return GWACHEON_NODE_ID; // fallback
  }
};
