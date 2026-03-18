import React, { useRef, useState, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import { useStore } from "../store/useStore";
import type { Rack, RegisteredDevice, HierarchyNode } from "../types";
import type { ExportScope } from "../utils/storage";
import { getNodeName, getAncestorPath, getNodeEquipmentCount } from "../utils/nodeUtils";
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
    racks,
    registeredDevices,
    importExportModalRackId,
    setImportExportModalRackId,
    setActiveNode,
    nodes,
    upsertNodes,
    replaceMultipleNodesData,
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
    if (selectedScopeId === "ALL") {
      const rackCount = racks.length;
      const deviceCount = getNodeEquipmentCount(registeredDevices, "ALL");
      const portCount = racks.reduce(
        (sum, r) => sum + r.devices.reduce((s, d) => s + d.portStates.length, 0),
        0,
      );
      return { rackCount, deviceCount, portCount };
    }

    const nodeRacks = racks.filter((r) => r.nodeId === selectedScopeId);
    const rackCount = nodeRacks.length;
    const deviceCount = getNodeEquipmentCount(registeredDevices, selectedScopeId);
    const portCount = nodeRacks.reduce(
      (sum, r) => sum + r.devices.reduce((s, d) => s + d.portStates.length, 0),
      0,
    );
    return { rackCount, deviceCount, portCount };
  }, [selectedScopeId, racks, registeredDevices]);

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
      // Small delay to ensure UI updates (disable button) before heavy work
      await new Promise((r) => setTimeout(r, 100));
      exportGroupWorkbook(racks, registeredDevices, nodes, request);
      showToast(`${request.scopeLabel} 내보내기 완료`, "success");
    } finally {
      setIsExporting(false);
    }
  };

  const handleGroupImportClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    console.log("[IEM] Auto Import button clicked");
    setImportStatus(null);
    if (groupImportRef.current) {
      console.log("[IEM] File input ref exists, triggering click");
      groupImportRef.current.value = "";
      groupImportRef.current.click();
    } else {
      console.error("[IEM] File input ref is null!");
    }
  };

  const handleGroupImportFile = async (
    file: File,
  ) => {
    console.log("[IEM] handleGroupImportFile called", file.name);
    setImportStatus(`⏳ "${file.name}" 분석 중...`);

    try {
      // Decouple analysis from UI selection to prevent scope leakage.
      // Always analyze as "ALL" first to see what's in the file.
      const effectiveScope = "ALL";
      
      console.log(`[IEM] Analyzing file "${file.name}"...`);
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
          ...nodeData.racks.map((r) => ({ ...r, nodeId: finalNid })),
        );
        remappedByNode[finalNid].registeredDevices.push(
          ...nodeData.registeredDevices.map((d) => ({ ...d, nodeId: finalNid })),
        );
      });

      // 4. APPLY TO STORE: Unified Merge Architecture
      // We always UPSERT nodes to merge hierarchy (create missing, update existing)
      // and REPLACE data for specific nodes provided in the file to preserve others.
      // This satisfies the "No cross-scope disturbance" requirement.
      
      upsertNodes(finalNodes, overwriteNodes, false);
      replaceMultipleNodesData(remappedByNode);

      // 4. Determine Target Node for Focus/Navigation
      let targetNodeId: string | null = null;
      if (
        importPreview.exportScope.type === "NODE" &&
        importPreview.exportScope.nodeId
      ) {
        targetNodeId =
          nodeIdMap[importPreview.exportScope.nodeId] ||
          importPreview.exportScope.nodeId;
      } else {
        // Fallback: use first node with racks in the imported data
        targetNodeId =
          Object.entries(remappedByNode).find(
            ([_, data]) => data.racks.length > 0,
          )?.[0] || null;
      }

      if (targetNodeId) {
        setActiveNode(targetNodeId);
        setHierarchyCollapsed(false); // Ensure sidebar is visible

        // Ensure browser scrolls the selected node into view
        setTimeout(() => {
          const selectedEl = document.querySelector(".tree-node.selected");
          if (selectedEl) {
            selectedEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }

      const totalRacks = Object.values(remappedByNode).reduce(
        (sum, n) => sum + (n as any).racks.length,
        0,
      );
      const totalDevices = Object.values(remappedByNode).reduce(
        (sum, n) => sum + (n as any).registeredDevices.length,
        0,
      );
      console.log(`[Import] Final verification: Racks=${totalRacks}, RegisteredDevices=${totalDevices}`);
      
      if (totalRacks === 0 && totalDevices === 0) {
        const failMsg = `⚠️ 가져온 데이터가 없습니다. (선택한 범위와 파일의 데이터가 일치하지 않을 수 있습니다.)`;
        setImportStatus(failMsg);
        showToast(failMsg, "error");
        return;
      }

      let successMsg = `✅ Import 완료! (${Object.keys(remappedByNode).length}개 노드: Racks ${totalRacks}개, Devices ${totalDevices}개) [Scope: ${isNodeImport ? "Node" : "ALL"}]`;
      if (importPreview.ignoredCount > 0) {
        successMsg += ` [범위 외 ${importPreview.ignoredCount}건 제외됨]`;
      }
      setImportStatus(successMsg);
      showToast(successMsg, "success");
      setImportPreview(null);
      Object.keys(remappedByNode).forEach(nid => {
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
              : `선택한 노드("${getNodeName(nodes, selectedScopeId)}")에 정의된 데이터만 Export 됩니다. (하위/상위 노드 데이터 제외)`}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            <button
              className="grafana-btn grafana-btn-primary"
              style={{
                flex: 1,
                height: "40px",
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
                  className="grafana-btn grafana-btn-primary"
                  style={{ flex: 1 }}
                  onClick={handleApplyImport}
                >
                  🚀 Confirm & REPLACE
                </button>
                <button
                  className="grafana-btn grafana-btn-secondary"
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
                className="grafana-btn grafana-btn-secondary"
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
