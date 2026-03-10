import React, { useRef, useState } from "react";
import { useStore } from "../store/useStore";
import type { Rack } from "../types";
import type { ExportOptions, ExportScope } from "../utils/storage";
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
    box-shadow: 0 0 15px rgba(110, 159, 255, 0.2);
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
    replaceGroupData,
    setActiveGroup,
  } = useStore();
  const [format, setFormat] = useState<"json" | "excel">("excel");
  const [selectedFields, setSelectedFields] = useState<ExportOptions>({
    rack: [...RACK_FIELDS],
    device: [...DEVICE_FIELDS],
    port: [...PORT_FIELDS],
  });
  const [exportScope, setExportScope] = useState<ExportScope>("ALL");
  const [importGroup, setImportGroup] = useState<ExportScope>("과천");
  const [importStatus, setImportStatus] = useState<string | null>(null);

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

  const handleLegacyExport = () => {
    if (totalSelected === 0) return;

    if (format === "json") {
      if (isGlobal) {
        saveToJSON(racks, selectedFields);
      } else if (rack) {
        saveRackToJSON(rack, selectedFields);
      }
    } else {
      if (isGlobal) {
        saveToExcel(racks, selectedFields);
      } else if (rack) {
        saveRackToExcel(rack, selectedFields);
      }
    }
  };

  const handleGroupExport = () => {
    exportGroupWorkbook(racks, registeredDevices, exportScope);
  };

  const handleGroupImportClick = () => {
    setImportStatus(null);
    if (groupImportRef.current) {
      groupImportRef.current.value = "";
      groupImportRef.current.click();
    } else {
      setImportStatus("❌ 파일 입력 요소를 찾을 수 없습니다.");
    }
  };

  const handleGroupImportFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    setImportStatus(`⏳ "${file.name}" 파싱 중...`);

    try {
      const result = await importGroupPackage(file, importGroup);

      if (result.racks.length === 0) {
        setImportStatus(
          `⚠️ 파일에서 "${importGroup}" 그룹의 랙 데이터를 찾지 못했습니다 (0건).`,
        );
        e.target.value = "";
        return;
      }

      replaceGroupData(
        importGroup,
        result.racks,
        result.registeredDevices.length > 0
          ? result.registeredDevices
          : undefined,
      );

      setActiveGroup(importGroup === "ALL" ? "과천" : importGroup);

      const deviceCount = result.racks.reduce(
        (sum, r) => sum + r.devices.length,
        0,
      );
      setImportStatus(
        `✅ ${importGroup} 그룹 Import 완료! 랙 ${result.racks.length}개, 장비 ${deviceCount}개`,
      );
    } catch (err) {
      setImportStatus(`❌ Import 실패: ${(err as Error).message}`);
    }

    e.target.value = "";
  };

  const toggleField = (group: keyof ExportOptions, field: string) => {
    setSelectedFields((prev) => {
      const current = prev[group];
      const next = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];

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

      return {
        ...prev,
        [group]:
          group === "device"
            ? finalDevice
            : group === "port"
              ? finalPort
              : next,
      };
    });
  };

  const handleSelectAll = (group: keyof ExportOptions) => {
    const all =
      group === "rack"
        ? RACK_FIELDS
        : group === "device"
          ? DEVICE_FIELDS
          : PORT_FIELDS;
    setSelectedFields((prev) => ({ ...prev, [group]: [...all] }));
  };

  const handleDeselectAll = (group: keyof ExportOptions) => {
    setSelectedFields((prev) => ({ ...prev, [group]: [] }));
  };

  const handleImportClick = () => {
    if (format === "json") {
      jsonInputRef.current?.click();
    } else {
      excelInputRef.current?.click();
    }
  };

  const isRequired = (group: keyof ExportOptions, field: string) => {
    if (group === "device") {
      return (
        (field === "deviceId" || field === "rackId") &&
        selectedFields.device.length > 0
      );
    }
    if (group === "port") {
      return (
        (field === "portId" || field === "deviceId") &&
        selectedFields.port.length > 0
      );
    }
    return false;
  };

  const renderCheckboxes = (
    group: keyof ExportOptions,
    fields: string[],
    label: string,
    emoji: string,
  ) => (
    <div className="options-group">
      <div className="group-header">
        <div className="group-title">
          <span>{emoji}</span> {label}
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="link-btn" onClick={() => handleSelectAll(group)}>
            Select all
          </button>
          <button className="link-btn" onClick={() => handleDeselectAll(group)}>
            Deselect all
          </button>
        </div>
      </div>
      <div className="checkbox-grid">
        {fields.map((f) => {
          const locked = isRequired(group, f);
          return (
            <label
              key={f}
              className={`checkbox-item ${locked ? "disabled" : ""}`}
            >
              <input
                type="checkbox"
                checked={selectedFields[group].includes(f)}
                onChange={() => !locked && toggleField(group, f)}
                disabled={locked}
              />
              {f}
            </label>
          );
        })}
      </div>
    </div>
  );

  const handleFileImport =
    (
      globalLoader: (f: File) => Promise<Rack[]>,
      rackLoader: (f: File) => Promise<Rack | Partial<Rack>>,
    ) =>
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const confirmMsg = isGlobal
        ? "Importing will replace ALL racks and equipment in the room. Continue?"
        : "Importing will replace all equipment in this rack. Continue?";

      if (!window.confirm(confirmMsg)) {
        e.target.value = "";
        return;
      }

      try {
        if (isGlobal) {
          const loadedRacks = await globalLoader(file);
          loadState(loadedRacks);
        } else if (rack) {
          const importedData = await rackLoader(file);
          updateRack(rack.id, {
            uHeight: importedData.uHeight,
            orientation: importedData.orientation,
            devices: importedData.devices as any,
          });
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
      <div className="options-group">
        <div className="group-header">
          <div className="group-title">
            <span>📤</span> Export
          </div>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "var(--text-tertiary)",
            marginBottom: "8px",
          }}
        >
          내보내기 범위를 선택하세요
        </div>
        <div className="scope-selector">
          {(["ALL", "과천", "대전"] as ExportScope[]).map((scope) => (
            <button
              key={scope}
              className={`scope-btn ${exportScope === scope ? "scope-active" : ""}`}
              onClick={() => setExportScope(scope)}
            >
              {scope === "ALL" ? "🌐 전체" : `📦 ${scope}`}
            </button>
          ))}
        </div>

        <div
          style={{
            fontSize: "11px",
            color: "var(--text-tertiary)",
            marginBottom: "10px",
            lineHeight: "1.5",
          }}
        >
          {exportScope === "ALL"
            ? "전체 master 시트만 생성합니다 (과천 + 대전 데이터 포함)."
            : `master 시트 + PKG_${exportScope} 패키지 시트를 생성합니다.`}
        </div>

        <button
          className="grafana-btn grafana-btn-primary"
          style={{
            padding: "10px",
            width: "100%",
            fontSize: "var(--font-size-sm)",
            boxShadow: "0 4px 12px rgba(110, 159, 255, 0.25)",
          }}
          onClick={handleGroupExport}
        >
          🚀 Export {exportScope === "ALL" ? "전체" : exportScope}
        </button>
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
          style={{
            flex: 1,
            height: "1px",
            background: "var(--border-weak)",
          }}
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
          style={{
            flex: 1,
            height: "1px",
            background: "var(--border-weak)",
          }}
        />
      </div>

      <div className="options-group">
        <div className="group-header">
          <div className="group-title">
            <span>📥</span> Import (REPLACE)
          </div>
          <span className="import-mode-badge">🔄 REPLACE</span>
        </div>

        <div
          style={{
            fontSize: "12px",
            color: "var(--text-tertiary)",
            marginBottom: "8px",
          }}
        >
          가져올 그룹을 선택하세요
        </div>
        <div className="scope-selector">
          {(["ALL", "과천", "대전"] as ExportScope[]).map((scope) => (
            <button
              key={scope}
              className={`scope-btn ${importGroup === scope ? "scope-active" : ""}`}
              onClick={() => setImportGroup(scope)}
            >
              {scope === "ALL" ? "🌐 전체" : `📦 ${scope}`}
            </button>
          ))}
        </div>

        <div className="import-warning">
          <span style={{ fontSize: "14px", flexShrink: 0 }}>⚠️</span>
          <span>
            {importGroup === "ALL" ? (
              <>
                <strong>전체(모든 그룹)</strong>의 기존 Rack, Device, Port
                데이터가 모두 삭제되고 파일 데이터로 교체됩니다.
                <br />
                모든 랙 배치가 파일 기준으로 재설정됩니다.
              </>
            ) : (
              <>
                <strong>{importGroup}</strong> 그룹의 기존 Rack, Device, Port
                데이터가 모두 삭제되고 파일 데이터로 교체됩니다.
                <br />
                {importGroup === "과천" ? "대전" : "과천"} 그룹 데이터에는
                영향이 없습니다.
              </>
            )}
          </span>
        </div>

        <button
          className="grafana-btn grafana-btn-secondary"
          style={{
            padding: "10px",
            width: "100%",
            borderStyle: "dashed",
            borderWidth: "2px",
          }}
          onClick={handleGroupImportClick}
        >
          📥 Import {importGroup} (REPLACE)
        </button>

        {importStatus && (
          <div
            style={{
              marginTop: "8px",
              padding: "10px 12px",
              borderRadius: "6px",
              fontSize: "13px",
              fontWeight: 500,
              background: importStatus.startsWith("✅")
                ? "rgba(34,197,94,0.12)"
                : importStatus.startsWith("❌")
                  ? "rgba(239,68,68,0.12)"
                  : importStatus.startsWith("⚠️")
                    ? "rgba(234,179,8,0.12)"
                    : "rgba(59,130,246,0.12)",
              color: importStatus.startsWith("✅")
                ? "#22c55e"
                : importStatus.startsWith("❌")
                  ? "#ef4444"
                  : importStatus.startsWith("⚠️")
                    ? "#eab308"
                    : "#3b82f6",
              border: `1px solid ${
                importStatus.startsWith("✅")
                  ? "rgba(34,197,94,0.3)"
                  : importStatus.startsWith("❌")
                    ? "rgba(239,68,68,0.3)"
                    : importStatus.startsWith("⚠️")
                      ? "rgba(234,179,8,0.3)"
                      : "rgba(59,130,246,0.3)"
              }`,
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
        onChange={handleGroupImportFile}
      />
    </>
  );

  const renderLegacyContent = () => (
    <>
      <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
        {`Configure export fields or import new data for Rack ${rack?.id.substring(0, 8)}.`}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px",
          marginBottom: "16px",
        }}
      >
        <div
          onClick={() => setFormat("json")}
          className={`format-card ${format === "json" ? "active" : ""}`}
          style={{
            padding: "16px",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "4px" }}>{"{ }"}</div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
              color:
                format === "json"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            JSON Format
          </div>
        </div>

        <div
          onClick={() => setFormat("excel")}
          className={`format-card ${format === "excel" ? "active" : ""}`}
          style={{
            padding: "16px",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "24px", marginBottom: "4px" }}>📊</div>
          <div
            style={{
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
              color:
                format === "excel"
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
            }}
          >
            Excel Spreadsheet
          </div>
        </div>
      </div>

      <div
        style={{
          maxHeight: "300px",
          overflowY: "auto",
          marginBottom: "16px",
          paddingRight: "4px",
        }}
      >
        {renderCheckboxes("rack", RACK_FIELDS, "Rack Sheet", "🏢")}
        {renderCheckboxes("device", DEVICE_FIELDS, "Device Sheet", "🖥️")}
        {renderCheckboxes("port", PORT_FIELDS, "Port Sheet", "🔌")}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
        <button
          className="grafana-btn grafana-btn-primary"
          style={{
            padding: "12px",
            fontSize: "var(--font-size-md)",
            boxShadow: "0 4px 12px rgba(110, 159, 255, 0.25)",
            opacity: totalSelected === 0 ? 0.5 : 1,
          }}
          onClick={handleLegacyExport}
          disabled={totalSelected === 0}
        >
          {totalSelected === 0
            ? "⚠️ Select at least one field"
            : "🚀 Export Rack Data"}
        </button>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            margin: "4px 0",
          }}
        >
          <div
            style={{
              flex: 1,
              height: "1px",
              background: "var(--border-weak)",
            }}
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
            style={{
              flex: 1,
              height: "1px",
              background: "var(--border-weak)",
            }}
          />
        </div>
        <button
          className="grafana-btn grafana-btn-secondary"
          style={{
            padding: "10px",
            borderStyle: "dashed",
            borderWidth: "2px",
          }}
          onClick={handleImportClick}
        >
          📥 Import & Overwrite
        </button>
      </div>

      <input
        type="file"
        ref={jsonInputRef}
        style={{ display: "none" }}
        accept=".json"
        onChange={handleJsonImport}
      />
      <input
        type="file"
        ref={excelInputRef}
        style={{ display: "none" }}
        accept=".xlsx"
        onChange={handleExcelImport}
      />
    </>
  );

  return (
    <div
      className="grafana-modal-overlay"
      onClick={() => setImportExportModalRackId(null)}
    >
      <ModalStyles />
      <div
        className="grafana-modal"
        style={{
          width: "520px",
          borderTop: "4px solid var(--theme-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grafana-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💾</span>
            <h2 className="grafana-modal-title">
              {isGlobal ? "STN Data Import / Export" : "Rack Data Operations"}
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
          {isGlobal ? renderGlobalGroupContent() : renderLegacyContent()}
        </div>
      </div>
    </div>
  );
};
