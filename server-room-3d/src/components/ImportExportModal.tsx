import React, { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import type { Rack, RegisteredDevice, HierarchyNode } from "../types";
import type { ExportScope } from "../utils/storage";
import { getNodeName, getAncestorPath, getNodeEquipmentCount, getSubtreeNodeIds } from "../utils/nodeUtils";
import {
  exportGroupWorkbook,
  importGroupPackage,
} from "../utils/storage";
import type { ExportRequest } from "../utils/storage";

const IMPORT_EXPORT_STYLES = `
.format-card {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    border: 1px solid var(--border-weak);
    background: var(--bg-secondary);
    position: relative;
    overflow: hidden;
}
.format-card.active {
    border: 2px solid var(--theme-primary) !important;
    background: var(--selected-bg) !important;
    box-shadow: 0 0 15px rgba(110, 159, 255, 0.25);
}
.format-card.active::after {
    content: "✓";
    position: absolute;
    top: 8px;
    right: 8px;
    background: var(--theme-primary);
    color: white;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    font-size: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
}
.format-card:hover:not(.active) {
    border-color: var(--border-medium);
    background: var(--hover-bg);
}
/* Export Redesign Styles */
.export-tree-container {
    background: var(--bg-canvas);
    border: 1px solid var(--border-weak);
    border-radius: var(--radius-md);
    margin: 8px 0;
    max-height: 250px;
    overflow-y: auto;
    padding: 6px 0;
}
.export-tree-node {
    display: flex;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 13px;
    color: var(--text-secondary);
    gap: 8px;
    transition: background 0.1s, color 0.1s;
    user-select: none;
}
.export-tree-node:hover {
    background: var(--hover-bg);
    color: var(--text-primary);
}
.export-tree-node.selected {
    background: var(--selected-bg);
    color: var(--theme-primary);
    font-weight: 600;
}
.export-tree-node .node-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.export-tree-toggle {
    width: 16px;
    height: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 10px;
    color: var(--text-tertiary);
    transition: transform 0.15s;
}
.export-tree-toggle.expanded {
    transform: rotate(90deg);
}
.export-selection-preview {
    background: var(--bg-canvas);
    border-radius: var(--radius-md);
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border-weak);
}
.export-breadcrumb {
    font-size: 11px;
    color: var(--theme-primary);
    margin-bottom: 6px;
    font-weight: 700;
    opacity: 0.9;
    display: flex;
    align-items: center;
    gap: 4px;
}
.export-counts-row {
    display: flex;
    gap: 16px;
    font-size: 12px;
    color: var(--text-secondary);
    background: var(--bg-primary);
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px dashed var(--border-medium);
}
.export-counts-row span strong {
    color: var(--text-primary);
    font-weight: 700;
}
.export-helper-text {
    font-size: 11px;
    color: var(--text-tertiary);
    margin-bottom: 12px;
    line-height: 1.4;
    padding: 0 4px;
}
.options-group {
    background: var(--bg-canvas);
    border-radius: var(--radius-md);
    padding: 12px;
    margin-bottom: 12px;
    border: 1px solid var(--border-weak);
}
.group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    border-bottom: 1px solid var(--border-weak);
    padding-bottom: 6px;
}
.group-title {
    font-size: var(--font-size-sm);
    font-weight: 600;
    color: var(--text-primary);
    display: flex;
    align-items: center;
    gap: 6px;
}
.checkbox-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
}
.checkbox-item {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
    cursor: pointer;
    user-select: none;
}
.checkbox-item input {
    cursor: pointer;
    accent-color: var(--theme-primary);
}
.checkbox-item.disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.link-btn {
    background: none;
    border: none;
    color: var(--theme-primary);
    font-size: 11px;
    cursor: pointer;
    padding: 0;
}
.link-btn:hover {
    text-decoration: underline;
}
.import-mode-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    background: rgba(255, 169, 64, 0.15);
    color: #ffa940;
    border: 1px solid rgba(255, 169, 64, 0.3);
}
.import-warning {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
    border-radius: var(--radius-md);
    background: rgba(255, 169, 64, 0.08);
    border: 1px solid rgba(255, 169, 64, 0.2);
    font-size: 12px;
    color: var(--text-secondary);
    margin-bottom: 12px;
    line-height: 1.5;
}
`;

const ModalStyles = React.memo(() => <style>{IMPORT_EXPORT_STYLES}</style>);

export const ImportExportModal = () => {
  const {
    activeNodeId,
    registeredDevices,
    importExportModalRackId,
    setImportExportModalRackId,
    nodes,
    upsertNodes,
    showToast,
    setHierarchyCollapsed,
    pendingImportFile,
    setPendingImportFile,
  } = useStore();

  const [selectedScopeId, setSelectedScopeId] = useState<ExportScope>("ALL");

  // Sync with activeNodeId when modal opens
  useEffect(() => {
    if (importExportModalRackId === "all") {
       setSelectedScopeId(activeNodeId || "ALL");
    }
  }, [importExportModalRackId, activeNodeId]);
  const [isExporting, setIsExporting] = useState(false);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [overwriteNodes, setOverwriteNodes] = useState(true);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    nodes: HierarchyNode[];
    dataByNode: Record<
      string,
      { racks: Rack[]; registeredDevices: RegisteredDevice[] }
    >;
    exportScope: { type: "ALL" | "NODE"; nodeId?: string };
    effectiveScopeId: string | "ALL";
    nodeIdMap: Record<string, string>;
    ignoredCount: number;
  } | null>(null);

  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const selectedNodeCounts = useMemo(() => {
    // Collect all racks from all layouts for global calculation if needed
    const allRacks: Rack[] = [];
    Object.values(useStore.getState().layouts).forEach(l => allRacks.push(...(l.racks || [])));

    if (selectedScopeId === "ALL") {
      const rackCount = allRacks.length;
      const deviceCount = getNodeEquipmentCount(registeredDevices, "ALL");
      const portCount = allRacks.reduce(
        (sum, r) => sum + (r.devices?.reduce((s, d) => s + (d.portStates?.length || 0), 0) || 0),
        0,
      );
      return { rackCount, deviceCount, portCount };
    }

    // Node-specific scope: Include subtree descendants
    const subtreeIds = getSubtreeNodeIds(nodes, selectedScopeId);
    const subtreeRacks = allRacks.filter((r) => subtreeIds.has(r.mapId));
    
    const rackCount = subtreeRacks.length;
    const deviceCount = getNodeEquipmentCount(registeredDevices, selectedScopeId); // This utility already handles subtrees by default or can be updated
    const portCount = subtreeRacks.reduce(
      (sum, r) => sum + (r.devices?.reduce((s, d) => s + (d.portStates?.length || 0), 0) || 0),
      0,
    );
    return { rackCount, deviceCount, portCount };
  }, [selectedScopeId, nodes, registeredDevices]);

  const groupImportRef = useRef<HTMLInputElement>(null);

  // --- Handlers ---

  const handleGroupExport = async () => {
    if (isExporting) return;

    // Create ONE immutable request object at click time
    const currentScope = selectedScopeId;
    const currentLabel =
      currentScope === "ALL" ? "전체" : getNodeName(nodes, currentScope);

    const request: ExportRequest = {
      requestId: crypto.randomUUID(),
      scopeId: currentScope,
      scopeLabel: currentLabel,
      exportedAt: new Date().toISOString(),
    };

    setIsExporting(true);
    try {
      // Aggregate all racks from all layouts to ensure full scope export
      const allRacks: Rack[] = [];
      Object.values(useStore.getState().layouts).forEach(l => {
        if (l.racks) allRacks.push(...l.racks);
      });

      // Small delay to ensure UI updates (disable button) before heavy work
      await new Promise((r) => setTimeout(r, 100));
      exportGroupWorkbook(allRacks, registeredDevices, nodes, request);
      showToast(`${request.scopeLabel} 내보내기 완료`, "success");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGroupImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    setImportStatus(null);
    if (groupImportRef.current) {

      groupImportRef.current.value = "";
      groupImportRef.current.click();
    } else {
      console.error("[IEM] File input ref is null!");
    }
  };

  const handleGroupImportFile = async (
    file: File,
  ) => {

    setImportStatus(`⏳ "${file.name}" 분석 중...`);

    try {
      // Decouple analysis from UI selection to prevent scope leakage.
      // Always analyze as "ALL" first to see what's in the file.
      const effectiveScope = "ALL";
      

      const result = await importGroupPackage(file, nodes, effectiveScope);
      const nodeCount = result.nodes.length;
      const totalRacksInFile = Object.values(result.dataByNode).reduce(
        (sum, n: any) => sum + n.racks.length,
        0,
      );
      const totalDevicesInFile = Object.values(result.dataByNode).reduce(
        (sum, n: any) => sum + n.registeredDevices.length,
        0,
      );

      if (nodeCount === 0 || (totalRacksInFile === 0 && totalDevicesInFile === 0)) {
        setImportStatus(`⚠️ 파일에서 유효한 데이터를 찾지 못했습니다. [제외됨: ${result.ignoredCount}건]`);
        return;
      }

      setImportPreview({
        fileName: file.name,
        nodes: result.nodes,
        dataByNode: result.dataByNode,
        exportScope: result.exportScope,
        effectiveScopeId: result.effectiveScopeId,
        nodeIdMap: result.nodeIdMap,
        ignoredCount: result.ignoredCount,
      });
      setImportStatus(null);
    } catch (err) {
      setImportStatus(`❌ 파일 분석 실패: ${(err as Error).message}`);
    }
  };

  // Auto-trigger analysis if file was provided via toolbar
  const processedFileRef = useRef<File | null>(null);
  useEffect(() => {
    if (pendingImportFile && importExportModalRackId === "all" && pendingImportFile !== processedFileRef.current) {
      processedFileRef.current = pendingImportFile;
      handleGroupImportFile(pendingImportFile);
      setPendingImportFile(null); // Clear after starting
    }
  }, [pendingImportFile, importExportModalRackId]);

  const handleApplyImport = () => {
    if (!importPreview) return;
    setImportStatus("⏳ 데이터 적용 중...");

    try {
      const { nodes: importedRawNodes, dataByNode, nodeIdMap } = importPreview;

      // 1. Determine Scope from File Metadata
      const isNodeImport = importPreview.exportScope.type === "NODE";
      
      // 2. Remap Node Hierarchy to Final System IDs
      const finalNodes = importedRawNodes.map(n => ({
        ...n,
        nodeId: nodeIdMap[n.nodeId] || n.nodeId,
        parentId: n.parentId ? (nodeIdMap[n.parentId] || n.parentId) : null
      }));

      // 3. Remap entity data using the same mapping
      const remappedByNode: Record<
        string,
        { racks: Rack[]; registeredDevices: RegisteredDevice[] }
      > = {};
      
      Object.entries(dataByNode).forEach(([nid, nodeData]) => {
        const finalNid = nodeIdMap[nid] || nid;
        if (!remappedByNode[finalNid]) {
          remappedByNode[finalNid] = { racks: [], registeredDevices: [] };
        }
        remappedByNode[finalNid].racks.push(
          ...nodeData.racks.map((r) => ({ ...r, mapId: finalNid })),
        );
        remappedByNode[finalNid].registeredDevices.push(
          ...nodeData.registeredDevices.map((d) => ({ ...d, deviceGroupId: finalNid })),
        );
      });

      // 4. PREPARE HIERARCHY: Dry run to get mapping and updated nodes array
      const { mapping: upsertMapping, updatedNodes: nextNodes } = upsertNodes(finalNodes, overwriteNodes, true);

      // 5. REMAP ENTITIES: Link racks/devices to final system node IDs
      const finalRemapped: typeof remappedByNode = {};
      Object.entries(remappedByNode).forEach(([nid, nodeData]) => {
        const systemNid = upsertMapping[nid] || nid;
        if (!finalRemapped[systemNid]) {
          finalRemapped[systemNid] = { racks: [], registeredDevices: [] };
        }
        finalRemapped[systemNid].racks.push(
          ...nodeData.racks.map(r => ({ ...r, mapId: systemNid })),
        );
        finalRemapped[systemNid].registeredDevices.push(
          ...nodeData.registeredDevices.map(d => ({ ...d, deviceGroupId: systemNid })),
        );
      });

      // 6. BUILD STATE UPDATES: Prepare updated layouts and registered devices list
      const prevState = useStore.getState();
      const updatedLayouts = { ...prevState.layouts };
      let updatedRegDevices = [...prevState.registeredDevices];
      
      Object.entries(finalRemapped).forEach(([nodeId, nodeData]) => {
        // Replace registered devices for imported nodes
        updatedRegDevices = updatedRegDevices.filter(d => d.deviceGroupId !== nodeId);
        updatedRegDevices.push(...nodeData.registeredDevices);
        
        // Update layouts (preserve existing models)
        updatedLayouts[nodeId] = {
          racks: nodeData.racks,
          importedModels: updatedLayouts[nodeId]?.importedModels || []
        };
      });

      // 7. DETERMINE TARGET NODE: Where to focus after import
      let targetNodeId: string | null = null;
      if (isNodeImport && importPreview.exportScope.nodeId) {
        const rawNodeId = importPreview.exportScope.nodeId;
        const mappedId = nodeIdMap[rawNodeId] || rawNodeId;
        targetNodeId = upsertMapping[mappedId] || mappedId;
      } else {
        // Fallback: Pick first node that has racks
        targetNodeId = Object.entries(finalRemapped).find(([, data]) => data.racks.length > 0)?.[0] || null;
      }
      
      // Secondary fallback: if no racks but we have devices, pick first node with devices
      if (!targetNodeId) {
        targetNodeId = Object.entries(finalRemapped).find(([, data]) => data.registeredDevices.length > 0)?.[0] || null;
      }

      // 8. FINAL ATOMIC UPDATE: Apply everything to store in ONE go
      const targetLayout = targetNodeId ? (updatedLayouts[targetNodeId] || { racks: [], importedModels: [] }) : { racks: [], importedModels: [] };
      
      // Expand target node path before update
      if (targetNodeId) {
        useStore.getState().expandNodePath(targetNodeId);
      }

      useStore.setState((state) => ({
        nodes: nextNodes,
        layouts: updatedLayouts,
        racks: targetLayout.racks,
        importedModels: targetLayout.importedModels,
        registeredDevices: updatedRegDevices,
        activeNodeId: targetNodeId || state.activeNodeId,
        selectedRackId: null,
        focusedRackId: null,
        selectedDeviceId: null,
        // Sync baselines to current state to detect future changes
        baselineRacks: JSON.parse(JSON.stringify(targetLayout.racks)),
        baselineModels: JSON.parse(JSON.stringify(targetLayout.importedModels)),
        baselineNodes: JSON.parse(JSON.stringify(nextNodes)),
        _importDirty: true,
      }));

      // 9. UI FEEDBACK & CLEANUP
      if (targetNodeId) {
        setHierarchyCollapsed(false);
        setTimeout(() => {
          const selectedEl = document.querySelector(".tree-node.selected");
          selectedEl?.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
      }

      const totalRacks = Object.values(finalRemapped).reduce((sum, n) => sum + n.racks.length, 0);
      const totalDevices = Object.values(finalRemapped).reduce((sum, n) => sum + n.registeredDevices.length, 0);
      
      if (totalRacks === 0 && totalDevices === 0) {
        const failMsg = "⚠️ 가져온 데이터가 없습니다. (범위가 일치하지 않을 수 있습니다.)";
        setImportStatus(failMsg);
        showToast(failMsg, "error");
        return;
      }

      showToast(`✅ Import 완료! (${Object.keys(finalRemapped).length}개 노드: Racks ${totalRacks}개, Devices ${totalDevices}개)`, "success");
      setImportPreview(null);



      Object.keys(finalRemapped).forEach(nid => {
        useStore.getState().toggleNodeExpansion(nid, true);
      });
      setTimeout(() => {
         setImportExportModalRackId(null);
      }, 500);
    } catch (err) {
      setImportStatus(`❌ 적용 실패: ${(err as Error).message}`);
    }
  };


  const renderExportTree = (parentId: string | null = null, depth = 0) => {
    const children = nodes
      .filter((n) => n.parentId === parentId)
      .sort((a, b) => a.order - b.order);
    if (children.length === 0) return null;

    return children.map((node) => {
      const isExpanded = expandedNodes.has(node.nodeId);
      const isSelected = selectedScopeId === node.nodeId;
      const subChildren = nodes.filter((n) => n.parentId === node.nodeId);
      const hasChildren = subChildren.length > 0;

      return (
        <React.Fragment key={node.nodeId}>
          <div
            className={`export-tree-node ${isSelected ? "selected" : ""}`}
            style={{ paddingLeft: `${depth * 16 + 12}px` }}
            onClick={() => setSelectedScopeId(node.nodeId)}
            title={node.name}
          >
            <span
              className={`export-tree-toggle ${isExpanded ? "expanded" : ""}`}
              onClick={(e) => {
                e.stopPropagation();
                setExpandedNodes((prev) => {
                  const next = new Set(prev);
                  if (next.has(node.nodeId)) next.delete(node.nodeId);
                  else next.add(node.nodeId);
                  return next;
                });
              }}
              style={{ visibility: hasChildren ? "visible" : "hidden" }}
            >
              ▶
            </span>
            <span style={{ fontSize: "14px", flexShrink: 0 }}>
              {node.type === "root" ? "🏢" : "📦"}
            </span>
            <span className="node-name">{node.name}</span>
          </div>
          {isExpanded && renderExportTree(node.nodeId, depth + 1)}
        </React.Fragment>
      );
    });
  };

  const renderGlobalGroupContent = () => {
    const selectedPath =
      selectedScopeId === "ALL" ? [] : getAncestorPath(nodes, selectedScopeId);

    return (
      <>
        {/* EXPORT SECTION */}
        <div className="options-group">
          <div className="group-header">
            <div className="group-title">
              <span>📤</span> Export Scope Selection
            </div>
          </div>

          <div className="export-tree-container">
            <div
              className={`export-tree-node ${selectedScopeId === "ALL" ? "selected" : ""}`}
              onClick={() => setSelectedScopeId("ALL")}
            >
              <span style={{ width: "16px" }} />
              <span style={{ fontSize: "14px", flexShrink: 0 }}>🌐</span>
              <span className="node-name">전체 (ALL nodes)</span>
            </div>
            {renderExportTree()}
          </div>

          <div className="export-selection-preview">
            <div className="export-breadcrumb">
              📍 Scope:{" "}
              {selectedScopeId === "ALL"
                ? "전체 (전역 데이터)"
                : selectedPath.map((p: any) => p.name).join(" > ")}
            </div>
            <div className="export-counts-row">
              <span>
                Racks: <strong>{selectedNodeCounts.rackCount}</strong>
              </span>
              <span>
                Devices: <strong>{selectedNodeCounts.deviceCount}</strong>
              </span>
              <span>
                Ports: <strong>{selectedNodeCounts.portCount}</strong>
              </span>
            </div>
          </div>

          <div className="export-helper-text">
            💡{" "}
            {selectedScopeId === "ALL"
              ? "전체 노드의 모든 데이터(Racks & Devices)가 하나의 파일로 출력됩니다."
              : `선택한 노드("${getNodeName(nodes, selectedScopeId)}") 및 그 하위 노드(서버실 등)의 모든 데이터가 포함됩니다.`}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="grafana-btn grafana-btn-lg grafana-btn-primary"
              style={{
                flex: 1,
                boxShadow: "0 4px 12px rgba(110, 159, 255, 0.25)",
                cursor: isExporting ? "not-allowed" : "pointer",
                opacity: isExporting ? 0.7 : 1,
              }}
              onClick={handleGroupExport}
              disabled={!selectedScopeId || isExporting}
            >
              {isExporting
                ? "⏳ 생성 중..."
                : `🚀 Export ${selectedScopeId === "ALL" ? "전체" : "선택 노드"}`}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "4px 0",
          }}
        >
          <div
            style={{ flex: 1, height: "1px", background: "var(--border-weak)" }}
          />
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--text-tertiary)",
            }}
          >
            OR
          </span>
          <div
            style={{ flex: 1, height: "1px", background: "var(--border-weak)" }}
          />
        </div>

        {/* AUTOMATIC IMPORT SECTION */}
        <div className="options-group">
          <div className="group-header">
            <div className="group-title">
              <span>📥</span> 자동 가져오기 (Automatic Import)
            </div>
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-tertiary)",
              marginBottom: "12px",
              lineHeight: "1.5",
            }}
          >
            파일 내의 <strong>Groups</strong> 시트를 분석하여 노드 계층을
            복구하고 데이터를 자동으로 반영합니다.
          </div>
          <div className="import-warning">
            <span style={{ fontSize: "14px", flexShrink: 0 }}>ℹ️</span>
            <span>
              노드 내 데이터(Rack/Device/Port)는 파일 기준으로 반영되며, 다른
              노드에는 영향이 없습니다.
            </span>
          </div>

          {importPreview ? (
            <div
              style={{
                background: "var(--selected-bg)",
                border: "1px solid var(--theme-primary)",
                borderRadius: "4px",
                padding: "10px",
                marginBottom: "12px",
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "12px",
                  marginBottom: "8px",
                  color: "var(--theme-primary)",
                }}
              >
                📊 파일 분석 결과: {importPreview.fileName}
              </div>

              <div
                style={{
                  marginBottom: "10px",
                  padding: "8px",
                  background: "rgba(0,0,0,0.2)",
                  borderRadius: "4px",
                  fontSize: "12px",
                }}
              >
                <div
                  style={{ color: "var(--text-tertiary)", marginBottom: "4px" }}
                >
                  대상 범위 (Export Scope):
                </div>
                <div style={{ fontWeight: 600, color: "white" }}>
                  {importPreview.exportScope.type === "ALL"
                    ? "🌐 전체 (ALL)"
                    : `📍 ${getNodeName(nodes, importPreview.exportScope.nodeId || "")} 전용`}
                </div>
              </div>

              <div
                style={{
                  maxHeight: "150px",
                  overflowY: "auto",
                  fontSize: "11px",
                }}
              >
                {Object.entries(importPreview.dataByNode).map(([nid, data]) => {
                  const nodeName = getNodeName(importPreview.nodes, nid);
                  return (
                    <div
                      key={nid}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "4px",
                        padding: "4px",
                        background: "rgba(0,0,0,0.1)",
                      }}
                    >
                      <span>📍 {nodeName}</span>
                      <span style={{ fontWeight: 600 }}>
                        Racks: {data.racks.length} | RegDevs: {data.registeredDevices.length}
                      </span>
                    </div>
                  );
                })}
              </div>

              {importPreview.ignoredCount > 0 && (
                <div
                  style={{
                    marginTop: "10px",
                    color: "#ffa940",
                    fontSize: "11px",
                    display: "flex",
                    gap: "4px",
                  }}
                >
                  <span>⚠️</span>
                  <span>
                    파일 내 범위 밖 데이터 {importPreview.ignoredCount}건은
                    무시되었습니다.
                  </span>
                </div>
              )}
              <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleApplyImport}
                >
                  🚀 Confirm & REPLACE
                </button>
                <button
                  className="grafana-btn grafana-btn-md grafana-btn-secondary"
                  onClick={() => setImportPreview(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: "12px" }}>
                <label
                  className="checkbox-item"
                  style={{ marginBottom: overwriteNodes ? "8px" : "0" }}
                >
                  <input
                    type="checkbox"
                    checked={overwriteNodes}
                    onChange={(e) => setOverwriteNodes(e.target.checked)}
                  />
                  기존 노드 정보(이름/타입) 덮어쓰기
                </label>
                {overwriteNodes && (
                  <div className="import-warning" style={{ marginBottom: "0" }}>
                    <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
                    <span>
                      주의: 체크 시 파일의 노드 정보(이름/타입)가 기존 노드
                      정보에 덮어써집니다.
                    </span>
                  </div>
                )}
              </div>
              <button
                className="grafana-btn grafana-btn-lg grafana-btn-secondary"
                style={{
                  padding: "12px",
                  width: "100%",
                  borderStyle: "dashed",
                  borderWidth: "2px",
                  fontWeight: 600,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center"
                }}
                onClick={handleGroupImportClick}
              >
                📂 Select Excel File for Auto Import
              </button>
            </>
          )}

          {importStatus && (
            <div
              style={{
                marginTop: "12px",
                padding: "10px",
                borderRadius: "6px",
                fontSize: "13px",
                background: importStatus.startsWith("✅")
                  ? "rgba(34,197,94,0.12)"
                  : "rgba(59,130,246,0.12)",
                color: importStatus.startsWith("✅") ? "#22c55e" : "#3b82f6",
                border: `1px solid ${importStatus.startsWith("✅") ? "#22c55e44" : "#3b82f644"}`,
              }}
            >
              {importStatus}
            </div>
          )}
        </div>

        <input
          type="file"
          ref={groupImportRef}
          style={{ display: "none" }}
          accept=".xlsx"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleGroupImportFile(file);
            e.target.value = "";
          }}
        />
      </>
    );
  };

  if (!importExportModalRackId) return null;
  
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="grafana-modal-overlay"
      style={{ zIndex: 2000 }}
      onClick={() => setImportExportModalRackId(null)}
    >
      <ModalStyles />
      <div
        className="grafana-modal"
        style={{
          width: "520px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          borderTop: "4px solid var(--theme-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grafana-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💾</span>
            <h2 className="grafana-modal-title">
              데이터 내보내기 / 가져오기
            </h2>
          </div>
          <button
            className="grafana-modal-close"
            onClick={() => setImportExportModalRackId(null)}
          >
            &times;
          </button>
        </div>
        <div className="grafana-modal-content">
          {renderGlobalGroupContent()}
        </div>
      </div>
    </div>,
    document.body
  );
};
