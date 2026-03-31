import { useMemo } from "react";
import { useStore } from "../store/useStore";
import { getAncestorPath } from "../utils/nodeUtils";

const BREADCRUMB_STYLES = `
.breadcrumb-container {
  display: flex;
  align-items: center;
  gap: 2px;
  max-width: clamp(200px, 40vw, 800px);
  overflow: visible;
  flex-shrink: 1;
  position: relative;
}
.breadcrumb-item {
  font-size: var(--font-size-sm);
  font-weight: 500;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 3px 6px;
  border-radius: 4px;
  transition: all 0.15s;
  white-space: nowrap;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  display: inline-block;
  vertical-align: middle;
}
.breadcrumb-item:hover {
  color: var(--text-primary);
  background: var(--hover-bg);
}
.breadcrumb-item.active {
  color: var(--theme-primary);
  font-weight: 700;
  cursor: default;
  max-width: 200px;
}
.breadcrumb-item.active:hover {
  background: none;
}
.breadcrumb-separator {
  color: var(--text-tertiary);
  font-size: var(--font-size-sm);
  user-select: none;
  opacity: 0.6;
  flex-shrink: 0;
}
.breadcrumb-ellipsis {
  color: var(--text-tertiary);
  padding: 0 4px;
  cursor: help;
  font-weight: 700;
  opacity: 0.5;
  position: relative;
  display: flex;
}
.breadcrumb-ellipsis:hover::after {
  content: attr(data-tooltip);
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: #2b2b2b;
  color: #fff;
  padding: 6px 10px;
  border-radius: 4px;
  font-size: 11px;
  white-space: pre-wrap;
  z-index: 1000;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  width: max-content;
  max-width: 300px;
  margin-top: 8px;
  font-family: inherit;
  font-weight: 400;
  line-height: 1.4;
  text-align: center;
  pointer-events: none;
  animation: tooltip-fade 0.15s ease-out;
}
.breadcrumb-ellipsis:hover::before {
  content: "";
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  border: 6px solid transparent;
  border-bottom-color: #2b2b2b;
  margin-top: -4px;
  z-index: 1001;
  pointer-events: none;
}
@keyframes tooltip-fade {
  from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
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

  const MAX_VISIBLE = 5;
  const displayPath = useMemo(() => {
    if (path.length <= MAX_VISIBLE) return path.map(n => ({ ...n, isEllipsis: false }));

    const first = path[0];
    const lastThree = path.slice(-3);

    return [
      { ...first, isEllipsis: false },
      { nodeId: 'ellipsis', name: '...', isEllipsis: true },
      ...lastThree.map(n => ({ ...n, isEllipsis: false }))
    ];
  }, [path]);

  if (path.length === 0) return null;

  return (
    <>
      <style>{BREADCRUMB_STYLES}</style>
      <div className="grafana-toolbar-divider" />
      <div className="breadcrumb-container">
        {displayPath.map((node, idx) => {
          const isLast = idx === displayPath.length - 1 && !node.isEllipsis;

          return (
            <span key={node.nodeId === 'ellipsis' ? `ellipsis-${idx}` : node.nodeId} style={{ display: "flex", alignItems: "center" }}>
              {idx > 0 && <span className="breadcrumb-separator">›</span>}
              {node.isEllipsis ? (
                <span 
                  className="breadcrumb-ellipsis" 
                  data-tooltip={`생략된 경로: ${path.slice(1, -3).map(n => n.name).join(" > ")}`}
                >
                  ...
                </span>
              ) : (
                <span
                  className={`breadcrumb-item ${isLast ? "active" : ""}`}
                  onClick={() => !isLast && setActiveNode(node.nodeId)}
                  title={node.name}
                >
                  {node.name}
                </span>
              )}
            </span>
          );
        })}
      </div>
      <div className="grafana-toolbar-divider" />
    </>
  );
};
