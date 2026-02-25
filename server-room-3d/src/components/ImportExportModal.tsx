import { useRef, useState } from "react";
import { useStore } from "../store/useStore";
import type { Rack } from "../types";
import type { ExportOptions } from "../utils/storage";
import {
  saveRackToJSON,
  loadRackFromJSON,
  saveRackToExcel,
  loadRackFromExcel,
  saveToExcel,
  saveToJSON,
  loadFromJSON,
  loadFromExcel,
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
`;

export const ImportExportModal = () => {
  const {
    racks,
    importExportModalRackId,
    setImportExportModalRackId,
    updateRack,
    loadState,
  } = useStore();
  const [format, setFormat] = useState<"json" | "excel">("excel");
  const [selectedFields, setSelectedFields] = useState<ExportOptions>({
    rack: [...RACK_FIELDS],
    device: [...DEVICE_FIELDS],
    port: [...PORT_FIELDS],
  });

  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

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

  const handleExport = () => {
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

  const toggleField = (group: keyof ExportOptions, field: string) => {
    // Relationships logic:
    // If ANY device field selected -> deviceId and rackId must stay
    // If ANY port field selected -> portId and deviceId must stay

    setSelectedFields((prev) => {
      const current = prev[group];
      const next = current.includes(field)
        ? current.filter((f) => f !== field)
        : [...current, field];

      // Re-apply constraints
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
    // Relationship: IDs are still mandatory if something is selected,
    // but here we are deselecting ALL, so it's empty.
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

  /** Generic file import handler — eliminates duplication between JSON/Excel import */
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
        alert(
          isGlobal
            ? "Room data imported successfully!"
            : "Rack data imported successfully!",
        );
        setImportExportModalRackId(null);
      } catch (err) {
        alert("Import failed: " + (err as Error).message);
      }

      e.target.value = "";
    };

  const handleJsonImport = handleFileImport(loadFromJSON, loadRackFromJSON);
  const handleExcelImport = handleFileImport(loadFromExcel, loadRackFromExcel);

  return (
    <div
      className="grafana-modal-overlay"
      onClick={() => setImportExportModalRackId(null)}
    >
      <style>{IMPORT_EXPORT_STYLES}</style>
      <div
        className="grafana-modal"
        style={{
          width: "500px",
          borderTop: "4px solid var(--theme-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grafana-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💾</span>
            <h2 className="grafana-modal-title">
              {isGlobal
                ? "Global Room Data Operations"
                : "Rack Data Operations"}
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
          <p style={{ color: "var(--text-secondary)", marginBottom: "16px" }}>
            {isGlobal
              ? "Configure export fields for ALL racks in the room."
              : `Configure export fields or import new data for Rack ${rack?.id.substring(0, 8)}.`}
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
              <div style={{ fontSize: "24px", marginBottom: "4px" }}>
                {"{ }"}
              </div>
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

          {(format === "excel" || format === "json") && (
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
          )}

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
              onClick={handleExport}
              disabled={totalSelected === 0}
            >
              {totalSelected === 0
                ? "⚠️ Select at least one field"
                : isGlobal
                  ? "🚀 Export Room Data"
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
              {isGlobal ? "📥 Import Room Data" : "📥 Import & Overwrite"}
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
        </div>
      </div>
    </div>
  );
};
