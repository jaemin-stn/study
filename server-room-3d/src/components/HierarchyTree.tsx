import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { HierarchyNode } from "../types";
import {
  getChildren,
  getAncestorPath,
  getSubtreeEquipmentCount,
  getSubtreeDevices,
  isLeafNode,
} from "../utils/nodeUtils";

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
.tree-sidebar-container {
  position: relative;
  width: 100%;
}
.equipment-detail-panel {
  position: absolute;
  left: calc(100% + 12px);
  top: 0;
  width: 280px;
  min-width: 280px;
  flex-shrink: 0;
  background: #181b1f; /* Fallback dark theme background */
  background-color: var(--bg-primary);
  border: 1px solid var(--border-medium);
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  max-height: 48vh;
  z-index: 10;
  pointer-events: auto;
  animation: slideInRight 0.3s ease-out;
}
@keyframes slideInRight {
  from { transform: translateX(20px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.equipment-panel-header {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-weak);
  background: var(--bg-secondary);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.equipment-panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 0;
}
.equipment-panel-empty {
  padding: 40px 20px;
  text-align: center;
  color: var(--text-tertiary);
  font-size: 13px;
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
.tree-toggle-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--bg-secondary);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--border-weak);
}
.tree-toggle-label {
  font-size: 10px;
  color: var(--text-tertiary);
  font-weight: 700;
  white-space: nowrap;
}
.switch {
  position: relative;
  display: inline-block;
  width: 28px;
  height: 16px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-tertiary);
  transition: .2s;
  border-radius: 16px;
}
.slider:before {
  position: absolute;
  content: "";
  height: 12px;
  width: 12px;
  left: 2px;
  bottom: 2px;
  background-color: white;
  transition: .2s;
  border-radius: 50%;
}
input:checked + .slider {
  background-color: var(--theme-primary);
}
input:checked + .slider:before {
  transform: translateX(12px);
}
.tree-node-equipment {
  color: var(--text-tertiary);
  font-size: 11px;
}
.tree-node-equipment.highlighted {
  color: var(--theme-primary);
  background: rgba(110, 159, 255, 0.15);
  font-weight: 700;
  animation: highlight-pulse 1s infinite alternate;
}
@keyframes highlight-pulse {
  from { box-shadow: inset 0 0 0px var(--theme-primary); }
  to { box-shadow: inset 0 0 4px var(--theme-primary); }
}
.equipment-subgroup {
  margin-bottom: 4px;
}
.equipment-subgroup-header {
  padding: 6px 14px;
  background: var(--bg-tertiary);
  font-size: 10px;
  font-weight: 700;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid var(--border-weak);
  position: sticky;
  top: 0;
  z-index: 1;
  background-color: var(--bg-secondary);
}
.equipment-subgroup-icon {
  font-size: 12px;
  opacity: 0.8;
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
  equipmentCounts: Map<string, number>;
  isEditMode: boolean;
  showEquipment: boolean;
  highlightedDeviceId: string | null;
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
  equipmentCounts,
  isEditMode,
  showEquipment,
  highlightedDeviceId,
  onToggle,
  onSelect,
  onContextMenu,
}: TreeNodeItemProps) => {
  const children = getChildren(nodes, node.nodeId);
  const hasChildren = children.length > 0;
  const isExpanded = expandedIds.has(node.nodeId);
  const isSelected = activeNodeId === node.nodeId;
  const count = equipmentCounts.get(node.nodeId) || 0;

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
        <span className="tree-node-icon">{NODE_ICONS[node.type] || "📁"}</span>

        {/* Name */}
        <span className="tree-node-name">{node.name}</span>

        {/* Rack count badge */}
        {count > 0 && <span className="tree-node-count">{count}</span>}
      </div>

      {/* Children */}
      {isExpanded && (
        <>
          {children.map((child) => (
            <TreeNodeItem
              key={child.nodeId}
              node={child}
              depth={depth + 1}
              nodes={nodes}
              activeNodeId={activeNodeId}
              expandedIds={expandedIds}
              equipmentCounts={equipmentCounts}
              isEditMode={isEditMode}
              showEquipment={showEquipment}
              highlightedDeviceId={highlightedDeviceId}
              onToggle={onToggle}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
            />
          ))}
        </>
      )}
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
  const showEquipment = useStore((s) => s.showEquipmentInTree);
  const setShowEquipment = useStore((s) => s.setShowEquipmentInTree);
  const highlightedDeviceId = useStore((s) => s.highlightedDeviceId);
  const locateDevice = useStore((s) => s.locateDevice);
  const showToast = useStore((s) => s.showToast);
  const registeredDevices = useStore((s) => s.registeredDevices);
  const layouts = useStore((s) => s.layouts);

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

  // Calculate recursive (subtree) equipment counts
  const equipmentCounts = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach((n) => {
      const count = getSubtreeEquipmentCount(nodes, registeredDevices, n.nodeId);
      if (count > 0) counts.set(n.nodeId, count);
    });
    return counts;
  }, [nodes, registeredDevices]);

  // Consolidated racks from all node layouts for accurate equipment mapping in parent nodes
  const allRacksForMapping = useMemo(() => {
    const fromLayouts = Object.entries(layouts)
      .filter(([nid]) => nid !== activeNodeId)
      .flatMap(([_, l]) => l.racks || []);
    return [...fromLayouts, ...racks];
  }, [layouts, racks, activeNodeId]);

  const totalDeviceCount = useMemo(() => {
    if (!activeNodeId) return 0;
    return getSubtreeEquipmentCount(nodes, registeredDevices, activeNodeId);
  }, [nodes, activeNodeId, registeredDevices]);

  const deviceGroups = useMemo(() => {
    if (!activeNodeId) return [];
    // Key fix: Use allRacksForMapping instead of just current racks to find placements in descendant nodes
    const flat = getSubtreeDevices(
      nodes,
      activeNodeId,
      registeredDevices,
      allRacksForMapping,
    );

    // Grouping by actual nodeId
    const groups: Record<string, typeof flat> = {};
    flat.forEach((item) => {
      const nid = item.device.nodeId;
      if (!groups[nid]) groups[nid] = [];
      groups[nid].push(item);
    });

    // Extract ordered list of groups based on node tree order
    const result: {
      nodeId: string;
      nodeName: string;
      devices: typeof flat;
    }[] = [];
    nodes.forEach((n) => {
      if (groups[n.nodeId]) {
        result.push({
          nodeId: n.nodeId,
          nodeName: n.name,
          devices: groups[n.nodeId],
        });
      }
    });

    return result;
  }, [nodes, activeNodeId, registeredDevices, racks]);

  const handleToggle = useCallback(
    (nodeId: string) => {
      toggleNodeExpansion(nodeId);
    },
    [toggleNodeExpansion],
  );

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

  const handleDeviceClick = useCallback(
    (registeredDeviceId: string) => {
      const found = locateDevice(registeredDeviceId);
      if (!found) {
        showToast("배치되지 않은 장비입니다. 랙에 먼저 배치해주세요.", "error");
      }
    },
    [locateDevice, showToast],
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
      renameNode(renamingId as string, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, renameNode]);

  const handleDelete = useCallback(() => {
    if (!contextMenu) return;
    const node = nodes.find((n) => n.nodeId === contextMenu.nodeId);
    if (node && node.parentId !== null) {
      // Do not allow deleting root
      if (
        window.confirm(`"${node.name}" 노드와 하위 데이터를 삭제하시겠습니까?`)
      ) {
        deleteNode(node.nodeId);
      }
    }
    setContextMenu(null);
  }, [contextMenu, nodes, deleteNode]);

  const rootNodes = getChildren(nodes, null);
  const breadcrumbPath = getAncestorPath(nodes, activeNodeId || "");
  const breadcrumbText = breadcrumbPath.map((n) => n.name).join(" > ");

  return (
    <div className="tree-sidebar-container">
      <style>{TREE_STYLES}</style>
      <div
        className={`hierarchy-tree ${isCollapsed ? "collapsed" : "expanded"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="hierarchy-tree-header"
          style={{ cursor: "pointer" }}
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              overflow: "hidden",
            }}
          >
            <button
              className="tree-collapse-btn"
              title={isCollapsed ? "그룹 펼치기" : "그룹 접기"}
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(!isCollapsed);
              }}
            >
              <span
                style={{
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)",
                  transition: "transform 0.2s",
                  display: "inline-block",
                }}
              >
                ▼
              </span>
            </button>
            <span style={{ flexShrink: 0 }}>🗂️ 그룹</span>
            {isCollapsed && breadcrumbPath.length > 0 && (
              <span className="tree-breadcrumb-preview">{breadcrumbText}</span>
            )}
          </div>
          {!isCollapsed && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                className="tree-toggle-item"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="tree-toggle-label">장비</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={showEquipment}
                    onChange={(e) => setShowEquipment(e.target.checked)}
                  />
                  <span className="slider"></span>
                </label>
              </div>
              {isEditMode && (
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
          )}
        </div>

        <div className="hierarchy-tree-body">
          {rootNodes.map((root) => (
            <TreeNodeItem
              key={root.nodeId}
              node={root}
              depth={0}
              nodes={nodes}
              activeNodeId={activeNodeId || ""}
              expandedIds={expandedNodeIds}
              equipmentCounts={equipmentCounts}
              isEditMode={isEditMode}
              showEquipment={showEquipment}
              highlightedDeviceId={highlightedDeviceId}
              onToggle={handleToggle}
              onSelect={handleSelect}
              onContextMenu={handleContextMenu}
            />
          ))}
        </div>
      </div>

      {/* Equipment Detail Side Panel - Absolute positioned to the right */}
      {showEquipment && !isCollapsed && activeNodeId && (
        <div className="equipment-detail-panel">
          {(() => {
            const nodeName =
              nodes.find((n) => n.nodeId === activeNodeId)?.name || "전체";

            return (
              <>
                <div className="equipment-panel-header">
                  📦 장비: {nodeName} ({totalDeviceCount})
                </div>
                <div className="equipment-panel-body">
                  {deviceGroups.length > 0 ? (
                    deviceGroups.map((group) => {
                      const isLeaf = isLeafNode(nodes, activeNodeId);

                      return (
                        <div key={group.nodeId} className="equipment-subgroup">
                          {/* Show header if not a leaf view OR if there are multiple groups (though usually leaf implies 1 group) */}
                          {!isLeaf && (
                            <div className="equipment-subgroup-header">
                              <span className="equipment-subgroup-icon">📂</span>
                              {group.nodeName} ({group.devices.length})
                            </div>
                          )}
                          {group.devices.map(({ device, rackId, instanceId }) => {
                            const rack = rackId
                              ? allRacksForMapping.find((r) => r.id === rackId)
                              : null;

                            const equipmentLabel =
                              device.deviceName || device.modelName || "Device";

                            const rackLabel = rack
                              ? (rack.displayName ||
                                  `Rack-${rack.id.slice(0, 4)}`) +
                                ` (${rack.uHeight}U)`
                              : "미배치 (Inventory)";

                            return (
                              <div
                                key={`${activeNodeId}-${device.id}`}
                                className={`tree-node tree-node-equipment ${highlightedDeviceId === (instanceId || device.id) ? "highlighted" : ""}`}
                                onClick={() => handleDeviceClick(device.id)}
                              >
                                <span className="tree-node-icon">📟</span>
                                <div
                                  className="tree-node-name"
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                  }}
                                >
                                  <span style={{ fontWeight: 600 }}>
                                    {equipmentLabel}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: "9px",
                                      opacity: 0.5,
                                      color: "var(--text-tertiary)",
                                      marginTop: "1px",
                                    }}
                                  >
                                    📍 {rackLabel}
                                  </span>
                                </div>
                                <span className="tree-node-count">
                                  {device.uSize}U
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })
                  ) : (
                    <div className="equipment-panel-empty">
                      표시할 장비가 없습니다.
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>
      )}

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
            <div className="tree-context-item danger" onClick={handleDelete}>
              🗑️ 삭제
            </div>
          )}
        </div>
      )}
    </div>
  );
};
