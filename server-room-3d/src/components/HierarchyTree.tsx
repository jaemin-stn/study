import { useState, useCallback, useRef, useEffect } from "react";
import { useStore } from "../store/useStore";
import type { HierarchyNode } from "../types";
import { getChildren, getAncestorPath } from "../utils/nodeUtils";

// ─── Inline Styles ───────────────────────────────────────────────────────────

const TREE_STYLES = `
.hierarchy-tree {
  width: 100%;
  background: var(--bg-primary);
  border: 1px solid var(--border-weak);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  transition: max-height 0.3s ease;
}
.hierarchy-tree.expanded {
  max-height: 40vh;
}
.hierarchy-tree.collapsed {
  max-height: 42px; /* Just the header */
}
.hierarchy-tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-weak);
  font-size: var(--font-size-sm);
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: 0.03em;
}
.hierarchy-tree-body {
  overflow-y: auto;
  padding: 6px 0;
  flex: 1;
}
.tree-node {
  display: flex;
  align-items: center;
  padding: 5px 10px;
  cursor: pointer;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  transition: background 0.15s, color 0.15s;
  user-select: none;
  gap: 4px;
  border-left: 2px solid transparent;
}
.tree-node:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}
.tree-node.selected {
  background: var(--selected-bg);
  color: var(--theme-primary);
  border-left-color: var(--theme-primary);
  font-weight: 600;
}
.tree-node-toggle {
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: var(--text-tertiary);
  flex-shrink: 0;
  transition: transform 0.15s;
  border-radius: 3px;
}
.tree-node-toggle:hover {
  background: var(--hover-bg);
}
.tree-node-toggle.expanded {
  transform: rotate(90deg);
}
.tree-node-icon {
  font-size: 13px;
  flex-shrink: 0;
}
.tree-node-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tree-node-count {
  font-size: 10px;
  color: var(--text-tertiary);
  background: var(--bg-secondary);
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}
.tree-add-btn {
  background: none;
  border: none;
  color: var(--text-tertiary);
  font-size: 14px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: color 0.15s, background 0.15s;
  line-height: 1;
}
.tree-add-btn:hover {
  color: var(--theme-primary);
  background: rgba(110, 159, 255, 0.1);
}
.tree-inline-input {
  flex: 1;
  background: var(--bg-secondary);
  border: 1px solid var(--theme-primary);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: var(--font-size-sm);
  padding: 2px 6px;
  outline: none;
}
.tree-context-menu {
  position: fixed;
  z-index: 10000;
  background: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
  padding: 4px 0;
  min-width: 140px;
}
.tree-context-item {
  padding: 6px 14px;
  font-size: var(--font-size-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: background 0.1s;
}
.tree-context-item:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}
.tree-context-item.danger {
  color: var(--severity-critical);
}
.tree-context-item.danger:hover {
  background: rgba(224, 47, 68, 0.1);
}
.tree-collapse-btn {
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: background 0.15s, color 0.15s;
}
.tree-collapse-btn:hover {
  background: var(--hover-bg);
  color: var(--text-primary);
}
.tree-breadcrumb-preview {
  font-size: 11px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-left: 8px;
  font-weight: 500;
}
`;

const NODE_ICONS: Record<string, string> = {
  root: "🏢",
  group: "📦",
  site: "📍",
  room: "🚪",
  zone: "📐",
};

// ─── Tree Node Component ─────────────────────────────────────────────────────

interface TreeNodeItemProps {
  node: HierarchyNode;
  depth: number;
  nodes: HierarchyNode[];
  activeNodeId: string;
  expandedIds: Set<string>;
  rackCounts: Map<string, number>;
  isEditMode: boolean;
  onToggle: (nodeId: string) => void;
  onSelect: (nodeId: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string) => void;
}

const TreeNodeItem = ({
  node,
  depth,
  nodes,
  activeNodeId,
  expandedIds,
  rackCounts,
  isEditMode,
  onToggle,
  onSelect,
  onContextMenu,
}: TreeNodeItemProps) => {
  const children = getChildren(nodes, node.nodeId);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.nodeId);
  const isSelected = activeNodeId === node.nodeId;
  const count = rackCounts.get(node.nodeId) || 0;

  return (
    <>
      <div
        className={`tree-node ${isSelected ? "selected" : ""}`}
        style={{ paddingLeft: `${10 + depth * 16}px` }}
        onClick={() => onSelect(node.nodeId)}
        onContextMenu={(e) => isEditMode && onContextMenu(e, node.nodeId)}
      >
        {/* Toggle arrow */}
        <span
          className={`tree-node-toggle ${isExpanded ? "expanded" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle(node.nodeId);
          }}
          style={{ visibility: hasChildren ? "visible" : "hidden" }}
        >
          ▶
        </span>

        {/* Icon */}
        <span className="tree-node-icon">
          {NODE_ICONS[node.type] || "📁"}
        </span>

        {/* Name */}
        <span className="tree-node-name">{node.name}</span>

        {/* Rack count badge */}
        {count > 0 && <span className="tree-node-count">{count}</span>}
      </div>

      {/* Children */}
      {isExpanded &&
        children.map((child) => (
          <TreeNodeItem
            key={child.nodeId}
            node={child}
            depth={depth + 1}
            nodes={nodes}
            activeNodeId={activeNodeId}
            expandedIds={expandedIds}
            rackCounts={rackCounts}
            isEditMode={isEditMode}
            onToggle={onToggle}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
          />
        ))}
    </>
  );
};

// ─── Main HierarchyTree Component ────────────────────────────────────────────

export const HierarchyTree = () => {
  const nodes = useStore((s) => s.nodes);
  const activeNodeId = useStore((s) => s.activeNodeId);
  const setActiveNode = useStore((s) => s.setActiveNode);
  const expandedNodeIds = useStore((s) => s.expandedNodeIds);
  const toggleNodeExpansion = useStore((s) => s.toggleNodeExpansion);
  const isCollapsed = useStore((s) => s.isHierarchyCollapsed);
  const setIsCollapsed = useStore((s) => s.setHierarchyCollapsed);
  const racks = useStore((s) => s.racks);
  const isEditMode = useStore((s) => s.isEditMode);
  const addNode = useStore((s) => s.addNode);
  const renameNode = useStore((s) => s.renameNode);
  const deleteNode = useStore((s) => s.deleteNode);

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    nodeId: string;
  } | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);


  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renamingId]);

  // Calculate rack counts strictly by exact node placement (no subtree tallying)
  const rackCounts = new Map<string, number>();
  nodes.forEach((n) => {
    let count = 0;
    racks.forEach((r) => {
      if (r.nodeId === n.nodeId) count++;
    });
    rackCounts.set(n.nodeId, count);
  });

  const handleToggle = useCallback((nodeId: string) => {
    toggleNodeExpansion(nodeId);
  }, [toggleNodeExpansion]);

  const handleSelect = useCallback(
    (nodeId: string) => {
      if (renamingId) return;
      setActiveNode(nodeId);
    },
    [setActiveNode, renamingId],
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, nodeId });
    },
    [],
  );

  const handleAddChild = useCallback(() => {
    if (!contextMenu) return;
    const parentId = contextMenu.nodeId;
    const siblings = nodes.filter((n) => n.parentId === parentId);
    const newId = addNode({
      parentId,
      name: "New Node",
      type: "group",
      order: siblings.length,
    });
    setContextMenu(null);
    // Expand parent and start renaming
    toggleNodeExpansion(parentId);
    setRenamingId(newId);
    setRenameValue("New Node");
  }, [contextMenu, nodes, addNode]);

  const handleRenameStart = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node) {
      setRenamingId(node.nodeId);
      setRenameValue(node.name);
    }
    setContextMenu(null);
  }, [contextMenu, nodes]);

  const handleRenameConfirm = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      renameNode(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renameNode]);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node && node.parentId !== null) {
      // Do not allow deleting root
      if (window.confirm(`"${node.name}" 노드와 하위 데이터를 삭제하시겠습니까?`)) {
        deleteNode(node.nodeId);
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, deleteNode]);

  const rootNodes = getChildren(nodes, null);
  const breadcrumbPath = getAncestorPath(nodes, activeNodeId);
  const breadcrumbText = breadcrumbPath.map((n) => n.name).join(" > ");

  return (
    <>
      <style>{TREE_STYLES}</style>
      <div className={`hierarchy-tree ${isCollapsed ? "collapsed" : "expanded"}`} onClick={(e) => e.stopPropagation()}>
        <div className="hierarchy-tree-header" style={{ cursor: "pointer" }} onClick={() => setIsCollapsed(!isCollapsed)}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
            <button
              className="tree-collapse-btn"
              title={isCollapsed ? "그룹 펼치기" : "그룹 접기"}
              onClick={(e) => { e.stopPropagation(); setIsCollapsed(!isCollapsed); }}
            >
              <span style={{ transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.2s", display: "inline-block" }}>▼</span>
            </button>
            <span style={{ flexShrink: 0 }}>🗂️ 그룹</span>
            {isCollapsed && breadcrumbPath.length > 0 && (
              <span className="tree-breadcrumb-preview">
                {breadcrumbText}
              </span>
            )}
          </div>
          {!isCollapsed && isEditMode && (
            <button
              className="tree-add-btn"
              title="Add root node"
              onClick={(e) => {
                e.stopPropagation();
                const siblings = nodes.filter((n) => n.parentId === null);
                const newId = addNode({
                  parentId: null,
                  name: "New Root",
                  type: "root",
                  order: siblings.length,
                });
                setRenamingId(newId);
                setRenameValue("New Root");
              }}
            >
              +
            </button>
          )}
        </div>
        
        <div className="hierarchy-tree-body">
          {rootNodes.map((root) => (
            <TreeNodeItem
              key={root.nodeId}
              node={root}
              depth={0}
              nodes={nodes}
              activeNodeId={activeNodeId}
              expandedIds={expandedNodeIds}
              rackCounts={rackCounts}
              isEditMode={isEditMode}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      </div>

      {/* Rename overlay (displayed over the tree node name) */}
      {renamingId && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
          }}
          onClick={handleRenameConfirm}
        >
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "var(--bg-primary)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-md)",
              padding: "16px",
              boxShadow: "var(--elevation-3)",
              zIndex: 10001,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-secondary)",
                marginBottom: "8px",
                fontWeight: 600,
              }}
            >
              노드 이름 변경
            </div>
            <input
              ref={renameInputRef}
              className="tree-inline-input"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRenameConfirm();
                if (e.key === "Escape") setRenamingId(null);
              }}
              style={{ width: "180px", padding: "6px 10px" }}
            />
            <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
              <button
                className="grafana-btn grafana-btn-primary"
                style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                onClick={handleRenameConfirm}
              >
                확인
              </button>
              <button
                className="grafana-btn grafana-btn-secondary"
                style={{ flex: 1, padding: "5px", fontSize: "12px" }}
                onClick={() => setRenamingId(null)}
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu && (
        <div
          className="tree-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="tree-context-item" onClick={handleAddChild}>
            ➕ 하위 노드 추가
          </div>
          <div className="tree-context-item" onClick={handleRenameStart}>
            ✏️ 이름 변경
          </div>
          {nodes.find((n) => n.nodeId === contextMenu.nodeId)?.parentId !==
            null && (
            <div
              className="tree-context-item danger"
              onClick={handleDelete}
            >
              🗑️ 삭제
            </div>
          )}
        </div>
      )}
    </>
  );
};
