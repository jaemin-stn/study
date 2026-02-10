import { useRef, useState } from "react";
import { useStore } from "../store/useStore";
import {
  saveRackToJSON,
  loadRackFromJSON,
  saveRackToExcel,
  loadRackFromExcel,
} from "../utils/storage";

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
`;

export const ImportExportModal = () => {
  const {
    racks,
    importExportModalRackId,
    setImportExportModalRackId,
    updateRack,
  } = useStore();
  const [format, setFormat] = useState<"json" | "excel">("json");
  const jsonInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  if (!importExportModalRackId) return null;

  const rack = racks.find((r) => r.id === importExportModalRackId);
  if (!rack) return null;

  const handleExport = () => {
    if (format === "json") {
      saveRackToJSON(rack);
    } else {
      saveRackToExcel(rack);
    }
  };

  const handleImportClick = () => {
    if (format === "json") {
      jsonInputRef.current?.click();
    } else {
      excelInputRef.current?.click();
    }
  };

  const handleJsonImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (
        window.confirm(
          "Importing will replace all equipment in this rack. Continue?",
        )
      ) {
        try {
          const importedData = await loadRackFromJSON(e.target.files[0]);
          updateRack(rack.id, {
            uHeight: importedData.uHeight,
            orientation: importedData.orientation,
            devices: importedData.devices,
          });
          alert("Rack data imported successfully!");
          setImportExportModalRackId(null);
        } catch (err) {
          alert("Import failed: " + (err as Error).message);
        }
      }
      e.target.value = "";
    }
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      if (
        window.confirm(
          "Importing will replace all equipment in this rack. Continue?",
        )
      ) {
        try {
          const importedData = await loadRackFromExcel(e.target.files[0]);
          updateRack(rack.id, {
            uHeight: importedData.uHeight,
            orientation: importedData.orientation,
            devices: importedData.devices as any,
          });
          alert("Rack data imported successfully!");
          setImportExportModalRackId(null);
        } catch (err) {
          alert("Import failed: " + (err as Error).message);
        }
      }
      e.target.value = "";
    }
  };

  return (
    <div
      className="grafana-modal-overlay"
      onClick={() => setImportExportModalRackId(null)}
    >
      <style>{IMPORT_EXPORT_STYLES}</style>
      <div
        className="grafana-modal"
        style={{
          width: "450px",
          borderTop: "4px solid var(--theme-primary)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="grafana-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "20px" }}>💾</span>
            <h2 className="grafana-modal-title">Rack Data Operations</h2>
          </div>
          <button
            className="grafana-modal-close"
            onClick={() => setImportExportModalRackId(null)}
          >
            &times;
          </button>
        </div>

        <div className="grafana-modal-content">
          <p style={{ color: "var(--text-secondary)", marginBottom: "20px" }}>
            Select format and action for Rack{" "}
            <strong>{rack.id.substring(0, 8)}</strong>. Import will replace
            current equipment but keep position.
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
              marginBottom: "24px",
            }}
          >
            <div
              onClick={() => setFormat("json")}
              className={`format-card ${format === "json" ? "active" : ""}`}
              style={{
                padding: "24px 20px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>
                {"{ }"}
              </div>
              <div
                style={{
                  fontWeight: 600,
                  color:
                    format === "json"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                JSON Format
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--text-tertiary)",
                  marginTop: "4px",
                }}
              >
                Portable & Lightweight
              </div>
            </div>

            <div
              onClick={() => setFormat("excel")}
              className={`format-card ${format === "excel" ? "active" : ""}`}
              style={{
                padding: "24px 20px",
                borderRadius: "var(--radius-md)",
                cursor: "pointer",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "28px", marginBottom: "8px" }}>📊</div>
              <div
                style={{
                  fontWeight: 600,
                  color:
                    format === "excel"
                      ? "var(--text-primary)"
                      : "var(--text-secondary)",
                }}
              >
                Excel Spreadsheet
              </div>
              <div
                style={{
                  fontSize: "var(--font-size-xs)",
                  color: "var(--text-tertiary)",
                  marginTop: "4px",
                }}
              >
                Editable & Readable
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginTop: "8px",
            }}
          >
            <button
              className="grafana-btn grafana-btn-primary"
              style={{
                padding: "14px",
                fontSize: "var(--font-size-md)",
                boxShadow: "0 4px 12px rgba(110, 159, 255, 0.25)",
              }}
              onClick={handleExport}
            >
              🚀 Export Rack Data
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
                padding: "12px",
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
        </div>
      </div>
    </div>
  );
};
