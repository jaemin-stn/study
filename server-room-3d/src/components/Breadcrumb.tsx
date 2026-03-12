import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { getAncestorPath } from "../utils/nodeUtils";

const BREADCRUMB_STYLES = `
.breadcrumb-container {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 0 4px;
}
.breadcrumb-item {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 3px 8px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  white-space: nowrap;
}
.breadcrumb-item:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
}
.breadcrumb-item.active {
  color: var(--theme-primary);
  font-weight: 700;
  cursor: default;
}
.breadcrumb-item.active:hover {
  background: none;
}
.breadcrumb-separator {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  user-select: none;
  opacity: 0.6;
}
`;

export const Breadcrumb = () => {
  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);

  const path = useMemo(
    () => getAncestorPath(nodes, activeNodeId),
    [nodes, activeNodeId],
  );

  if (path.length === 0) return null;

  return (
    <>
      <style>{BREADCRUMB_STYLES}</style>
      <div className="breadcrumb-container">
        {path.map((node, idx) => {
          const isLast = idx === path.length - 1;
          return (
            <span key={node.nodeId} style={{ display: "flex", alignItems: "center", gap: "2px" }}>
              {idx > 0 && <span className="breadcrumb-separator">›</span>}
              <span
                className={`breadcrumb-item ${isLast ? "active" : ""}`}
                onClick={() => !isLast && setActiveNode(node.nodeId)}
              >
                {node.name}
              </span>
            </span>
          );
        })}
      </div>
    </>
  );
};
