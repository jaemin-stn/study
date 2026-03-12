import React, { useRef, useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { Rack, RegisteredDevice, HierarchyNode } from "../types";
import type { ExportOptions, ExportScope } from "../utils/storage";
import { getNodeName } from "../utils/nodeUtils";
import {
  saveRackToJSON,
  loadRackFromJSON,
  saveRackToExcel,
  loadRackFromExcel,
  saveToExcel,
  saveToJSON,
  loadFromJSON,
  loadFromExcel,
  exportGroupWorkbook,
  importGroupPackage,
} from "../utils/storage";

const RACK_FIELDS = ["rackId", "uHeight", "posX", "posZ", "orientation"];
const DEVICE_FIELDS = [
  "deviceId",
  "rackId",
  "name",
  "type",
  "uSize",
  "uPosition",
  "imageUrl",
  "modelName",
  "ip",
  "mac",
  "vendor"
];
const PORT_FIELDS = [
  "portId",
  "deviceId",
  "status",
  "errorLevel",
  "errorMessage",
];

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
.scope-selector {
    display: flex;
    gap: 8px;
    margin-bottom: 12px;
}
.scope-btn {
    flex: 1;
    padding: 8px 12px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border-weak);
    background: var(--bg-secondary);
    color: var(--text-secondary);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    text-align: center;
}
.scope-btn:hover:not(.scope-active) {
    border-color: var(--border-medium);
    background: var(--hover-bg);
}
.scope-btn.scope-active {
    border-color: var(--theme-primary);
    background: var(--selected-bg);
    color: var(--theme-primary);
    box-shadow: 0 0 8px rgba(110, 159, 255, 0.15);
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
    racks,
    registeredDevices,
    importExportModalRackId,
    setImportExportModalRackId,
    updateRack,
    loadState,
    setActiveNode,
    nodes,
    upsertNodes,
    replaceMultipleNodesData,
  } = useStore();

  const [format, setFormat] = useState<"json" | "excel">("excel");
  const [selectedFields, setSelectedFields] = useState<ExportOptions>({
    rack: [...RACK_FIELDS],
    device: [...DEVICE_FIELDS],
    port: [...PORT_FIELDS],
  });
  const [exportScope, setExportScope] = useState<ExportScope>("ALL");
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [overwriteNodes, setOverwriteNodes] = useState(true);
  const [importPreview, setImportPreview] = useState<{
    fileName: string;
    nodes: HierarchyNode[];
    dataByNode: Record<string, { racks: Rack[]; registeredDevices: RegisteredDevice[] }>;
    exportScope: { type: "ALL" | "NODE"; nodeId?: string };
    ignoredCount: number;
  } | null>(null);

  // Dynamic scope options for EXPORT
  const scopeOptions = useMemo(() => {
    const opts: { value: ExportScope; label: string }[] = [
      { value: "ALL", label: "🌐 전체" },
    ];
    nodes
      .filter((n) => n.parentId !== null)
      .forEach((n) => opts.push({ value: n.nodeId, label: `📦 ${n.name}` }));
    return opts;
  }, [nodes]);

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const groupImportRef = useRef<HTMLInputElement>(null);

  if (!importExportModalRackId) return null;

  const isGlobal = importExportModalRackId === "all";
  const rack = isGlobal
    ? null
    : racks.find((r) => r.id === importExportModalRackId);

  if (!isGlobal && !rack) return null;

  const totalSelected =
    selectedFields.rack.length +
    selectedFields.device.length +
    selectedFields.port.length;

  // --- Handlers ---
  const handleLegacyExport = () => {
    if (totalSelected === 0) return;
    if (format === "json") {
      if (isGlobal) saveToJSON(racks, selectedFields);
      else if (rack) saveRackToJSON(rack, selectedFields);
    } else {
      if (isGlobal) saveToExcel(racks, selectedFields);
      else if (rack) saveRackToExcel(rack, selectedFields);
    }
  };

  const handleGroupExport = () => {
    exportGroupWorkbook(racks, registeredDevices, nodes, exportScope);
  };

  const handleGroupImportClick = () => {
    setImportStatus(null);
    if (groupImportRef.current) {
      groupImportRef.current.value = "";
      groupImportRef.current.click();
    }
  };

  const handleGroupImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportStatus(`⏳ "${file.name}" 분석 중...`);

    try {
      const result = await importGroupPackage(file);
      const nodeCount = result.nodes.length;
      const totalRacksInFile = Object.values(result.dataByNode).reduce((sum, n) => sum + n.racks.length, 0);

      if (nodeCount === 0 && totalRacksInFile === 0) {
        setImportStatus(`⚠️ 파일에서 유효한 데이터를 찾지 못했습니다.`);
        e.target.value = "";
        return;
      }

      setImportPreview({
        fileName: file.name,
        nodes: result.nodes,
        dataByNode: result.dataByNode,
        exportScope: result.exportScope,
        ignoredCount: result.ignoredCount
      });
      setImportStatus(null);
    } catch (err) {
      setImportStatus(`❌ 파일 분석 실패: ${(err as Error).message}`);
    }
    e.target.value = "";
  };

  const handleApplyImport = () => {
    if (!importPreview) return;
    setImportStatus("⏳ 데이터 적용 중...");

    try {
      const { nodes: importedNodes, dataByNode } = importPreview;

      // 1. Upsert nodes
      const idMap = importedNodes.length > 0 ? upsertNodes(importedNodes, overwriteNodes) : {};

      // 2. Remap entity nodeId
      const remappedData: Record<string, { racks: Rack[]; registeredDevices: RegisteredDevice[] }> = {};
      Object.entries(dataByNode).forEach(([oldNid, nodeData]) => {
        const newNid = idMap[oldNid] || oldNid;
        if (!remappedData[newNid]) {
          remappedData[newNid] = { racks: [], registeredDevices: [] };
        }
        remappedData[newNid].racks.push(...nodeData.racks.map(r => ({ ...r, nodeId: newNid })));
        remappedData[newNid].registeredDevices.push(...nodeData.registeredDevices.map(d => ({ ...d, nodeId: newNid })));
      });

      // 3. Store update
      replaceMultipleNodesData(remappedData);

      // 4. Navigate
      const firstNodeWithRacks = Object.entries(remappedData).find(([_, data]) => data.racks.length > 0)?.[0];
      if (firstNodeWithRacks) {
        setActiveNode(firstNodeWithRacks);
      }

      const totalRacks = Object.values(remappedData).reduce((sum, n) => sum + n.racks.length, 0);
      let successMsg = `✅ Import 완료! (대상 노드 ${Object.keys(remappedData).length}개, Racks ${totalRacks}개)`;
      if (importPreview.ignoredCount > 0) {
        successMsg += ` [범위 외 ${importPreview.ignoredCount}건 제외됨]`;
      }
      setImportStatus(successMsg);
      setImportPreview(null);
    } catch (err) {
      setImportStatus(`❌ 적용 실패: ${(err as Error).message}`);
    }
  };

  const toggleField = (group: keyof ExportOptions, field: string) => {
    setSelectedFields((prev) => {
      const current = prev[group];
      const next = current.includes(field) ? current.filter((f) => f !== field) : [...current, field];
      let finalDevice = group === "device" ? next : prev.device;
      let finalPort = group === "port" ? next : prev.port;

      if (finalDevice.length > 0) {
        if (!finalDevice.includes("deviceId")) finalDevice.push("deviceId");
        if (!finalDevice.includes("rackId")) finalDevice.push("rackId");
      }
      if (finalPort.length > 0) {
        if (!finalPort.includes("portId")) finalPort.push("portId");
        if (!finalPort.includes("deviceId")) finalPort.push("deviceId");
      }
      return { ...prev, [group]: group === "device" ? finalDevice : group === "port" ? finalPort : next };
    });
  };

  const handleSelectAll = (group: keyof ExportOptions) => {
    const all = group === "rack" ? RACK_FIELDS : group === "device" ? DEVICE_FIELDS : PORT_FIELDS;
    setSelectedFields((prev) => ({ ...prev, [group]: [...all] }));
  };

  const handleDeselectAll = (group: keyof ExportOptions) => {
    setSelectedFields((prev) => ({ ...prev, [group]: [] }));
  };

  const handleImportClick = () => {
    if (format === "json") jsonInputRef.current?.click();
    else excelInputRef.current?.click();
  };

  const isRequired = (group: keyof ExportOptions, field: string) => {
    if (group === "device") return (field === "deviceId" || field === "rackId") && selectedFields.device.length > 0;
    if (group === "port") return (field === "portId" || field === "deviceId") && selectedFields.port.length > 0;
    return false;
  };

  // --- Sub-renderers ---
  const renderCheckboxes = (group: keyof ExportOptions, fields: string[], label: string, emoji: string) => (
    <div className="options-group">
      <div className="group-header">
        <div className="group-title"><span>{emoji}</span> {label}</div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="link-btn" onClick={() => handleSelectAll(group)}>Select all</button>
          <button className="link-btn" onClick={() => handleDeselectAll(group)}>Deselect all</button>
        </div>
      </div>
      <div className="checkbox-grid">
        {fields.map((f) => {
          const locked = isRequired(group, f);
          return (
            <label key={f} className={`checkbox-item ${locked ? "disabled" : ""}`}>
              <input type="checkbox" checked={selectedFields[group].includes(f)} onChange={() => !locked && toggleField(group, f)} disabled={locked} />
              {f}
            </label>
          );
        })}
      </div>
    </div>
  );

  const handleFileImport = (globalLoader: (f: File) => Promise<Rack[]>, rackLoader: (f: File) => Promise<Rack | Partial<Rack>>) => 
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!window.confirm(isGlobal ? "Replace ALL racks?" : "Replace equipment in this rack?")) {
        e.target.value = "";
        return;
      }
      try {
        if (isGlobal) loadState(await globalLoader(file));
        else if (rack) {
          const imported = await rackLoader(file);
          updateRack(rack.id, { uHeight: imported.uHeight, orientation: imported.orientation, devices: imported.devices as any });
        }
        setImportExportModalRackId(null);
      } catch (err) {
        alert("Import failed: " + (err as Error).message);
      }
      e.target.value = "";
    };

  const handleJsonImport = handleFileImport(loadFromJSON, loadRackFromJSON);
  const handleExcelImport = handleFileImport(loadFromExcel, loadRackFromExcel);

  const renderGlobalGroupContent = () => (
    <>
      {/* EXPORT SECTION */}
      <div className="options-group">
        <div className="group-header">
          <div className="group-title"><span>📤</span> Export</div>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "8px" }}>내보내기 범위를 선택하세요</div>
        <div className="scope-selector">
          {scopeOptions.map(({ value, label }) => (
            <button key={value} className={`scope-btn ${exportScope === value ? "scope-active" : ""}`} onClick={() => setExportScope(value)}>{label}</button>
          ))}
        </div>
        <button
          className="grafana-btn grafana-btn-primary"
          style={{ padding: "10px", width: "100%", fontSize: "var(--font-size-sm)", boxShadow: "0 4px 12px rgba(110, 159, 255, 0.25)" }}
          onClick={handleGroupExport}
        >
          🚀 Export {exportScope === "ALL" ? "전체" : getNodeName(nodes, exportScope)}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "4px 0" }}>
        <div style={{ flex: 1, height: "1px", background: "var(--border-weak)" }} />
        <span style={{ fontSize: "var(--font-size-xs)", color: "var(--text-tertiary)" }}>OR</span>
        <div style={{ flex: 1, height: "1px", background: "var(--border-weak)" }} />
      </div>

      {/* AUTOMATIC IMPORT SECTION */}
      <div className="options-group">
        <div className="group-header">
          <div className="group-title"><span>📥</span> Automatic Import (REPLACE)</div>
          <span className="import-mode-badge">🔄 REPLACE</span>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-tertiary)", marginBottom: "12px", lineHeight: "1.5" }}>
          파일 내의 <strong>Groups</strong> 시트를 분석하여 노드 계층을 복구하고 데이터를 교체합니다.
        </div>
        <div className="import-warning">
          <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
          <span>포함된 노드의 기존 데이터는 삭제되고 파일 내용으로 교체됩니다.</span>
        </div>

        {importPreview ? (
          <div style={{ background: "var(--selected-bg)", border: "1px solid var(--theme-primary)", borderRadius: "4px", padding: "10px", marginBottom: "12px" }}>
            <div style={{ fontWeight: 600, fontSize: "12px", marginBottom: "8px", color: "var(--theme-primary)" }}>
              📊 파일 분석 결과: {importPreview.fileName}
            </div>
            
            <div style={{ marginBottom: "10px", padding: "8px", background: "rgba(0,0,0,0.2)", borderRadius: "4px", fontSize: "12px" }}>
              <div style={{ color: "var(--text-tertiary)", marginBottom: "4px" }}>대상 범위 (Export Scope):</div>
              <div style={{ fontWeight: 600, color: "white" }}>
                {importPreview.exportScope.type === "ALL" 
                  ? "🌐 전체 (ALL)" 
                  : `📍 ${getNodeName(nodes, importPreview.exportScope.nodeId || "")} 전용`}
              </div>
            </div>

            <div style={{ maxHeight: "150px", overflowY: "auto", fontSize: "11px" }}>
              {Object.entries(importPreview.dataByNode).map(([nid, data]) => {
                const nodeName = getNodeName(importPreview.nodes, nid);
                return (
                  <div key={nid} style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", padding: "4px", background: "rgba(0,0,0,0.1)" }}>
                    <span>📍 {nodeName}</span>
                    <span style={{ fontWeight: 600 }}>Racks: {data.racks.length}개</span>
                  </div>
                );
              })}
            </div>

            {importPreview.ignoredCount > 0 && (
              <div style={{ marginTop: "10px", color: "#ffa940", fontSize: "11px", display: "flex", gap: "4px" }}>
                <span>⚠️</span>
                <span>파일 내 범위 밖 데이터 {importPreview.ignoredCount}건은 무시되었습니다.</span>
              </div>
            )}
            <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
              <button className="grafana-btn grafana-btn-primary" style={{ flex: 1 }} onClick={handleApplyImport}>🚀 Confirm & REPLACE</button>
              <button className="grafana-btn grafana-btn-secondary" onClick={() => setImportPreview(null)}>Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: "12px" }}>
              <label className="checkbox-item">
                <input type="checkbox" checked={overwriteNodes} onChange={(e) => setOverwriteNodes(e.target.checked)} />
                기존 노드 정보(이름/타입) 덮어쓰기
              </label>
            </div>
            <button
              className="grafana-btn grafana-btn-secondary"
              style={{ padding: "12px", width: "100%", borderStyle: "dashed", borderWidth: "2px", fontWeight: 600 }}
              onClick={handleGroupImportClick}
            >
              📂 Select Excel File for Auto Import
            </button>
          </>
        )}

        {importStatus && (
          <div style={{
            marginTop: "12px", padding: "10px", borderRadius: "6px", fontSize: "13px",
            background: importStatus.startsWith("✅") ? "rgba(34,197,94,0.12)" : "rgba(59,130,246,0.12)",
            color: importStatus.startsWith("✅") ? "#22c55e" : "#3b82f6",
            border: `1px solid ${importStatus.startsWith("✅") ? "#22c55e44" : "#3b82f644"}`
          }}>
            {importStatus}
          </div>
        )}
      </div>

      <input type="file" ref={groupImportRef} style={{ display: "none" }} accept=".xlsx" onChange={handleGroupImportFile} />
    </>
  );

  const renderLegacyContent = () => (
    <>
      <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>Configure fields for {rack?.displayName || rack?.id.substring(0, 8)}.</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
        <div onClick={() => setFormat("json")} className={`format-card ${format === "json" ? "active" : ""}`} style={{ padding: "16px", borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "4px" }}>{"{ }"}</div>
          <div style={{ fontWeight: 600, fontSize: "12px", color: format === "json" ? "var(--text-primary)" : "var(--text-secondary)" }}>JSON</div>
        </div>
        <div onClick={() => setFormat("excel")} className={`format-card ${format === "excel" ? "active" : ""}`} style={{ padding: "16px", borderRadius: "var(--radius-md)", cursor: "pointer", textAlign: "center" }}>
          <div style={{ fontSize: "24px", marginBottom: "4px" }}>📊</div>
          <div style={{ fontWeight: 600, fontSize: "12px", color: format === "excel" ? "var(--text-primary)" : "var(--text-secondary)" }}>Excel</div>
        </div>
      </div>
      <div style={{ maxHeight: "300px", overflowY: "auto", marginBottom: "16px" }}>
        {renderCheckboxes("rack", RACK_FIELDS, "Rack", "🏢")}
        {renderCheckboxes("device", DEVICE_FIELDS, "Device", "🖥️")}
        {renderCheckboxes("port", PORT_FIELDS, "Port", "🔌")}
      </div>
      <button className="grafana-btn grafana-btn-primary" style={{ padding: "12px", width: "100%", opacity: totalSelected === 0 ? 0.5 : 1 }} onClick={handleLegacyExport} disabled={totalSelected === 0}>🚀 Export</button>
      <button className="grafana-btn grafana-btn-secondary" style={{ padding: "10px", width: "100%", marginTop: "12px", borderStyle: "dashed" }} onClick={handleImportClick}>📥 Import & Overwrite</button>
      <input type="file" ref={jsonInputRef} style={{ display: "none" }} accept=".json" onChange={handleJsonImport} />
      <input type="file" ref={excelInputRef} style={{ display: "none" }} accept=".xlsx" onChange={handleExcelImport} />
    </>
  );

  return (
    <div className="grafana-modal-overlay" onClick={() => setImportExportModalRackId(null)}>
      <ModalStyles />
      <div className="grafana-modal" style={{ width: "520px", borderTop: "4px solid var(--theme-primary)" }} onClick={(e) => e.stopPropagation()}>
        <div className="grafana-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💾</span>
            <h2 className="grafana-modal-title">{isGlobal ? "STN Data Center Management" : "Rack Settings"}</h2>
          </div>
          <button className="grafana-modal-close" onClick={() => setImportExportModalRackId(null)}>&times;</button>
        </div>
        <div className="grafana-modal-content">
          {isGlobal ? renderGlobalGroupContent() : renderLegacyContent()}
        </div>
      </div>
    </div>
  );
};
