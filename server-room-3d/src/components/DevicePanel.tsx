import { useState } from "react";
import { useStore, checkFrontClearanceViolation } from "../store/useStore";
import type { DeviceType, ErrorLevel, PortState } from "../types";
import { DEVICE_TEMPLATES } from "../utils/deviceTemplates";
import type { DeviceTemplate } from "../utils/deviceTemplates";
import { getHighestError } from "../utils/errorHelpers";

/* ---------- Device Tile Image with loading / fallback ---------- */
const DeviceTileImage = ({ src, alt }: { src: string; alt: string }) => {
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    "loading",
  );

  return (
    <div className="device-tile-img-wrap">
      {status === "loading" && (
        <div className="device-tile-img-placeholder">
          <span className="device-tile-img-spinner" />
        </div>
      )}
      {status === "error" && (
        <div className="device-tile-img-placeholder">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="M21 15l-5-5L5 21" />
          </svg>
        </div>
      )}
      <img
        src={src}
        alt={alt}
        className="device-tile-img"
        style={{ opacity: status === "loaded" ? 1 : 0 }}
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        draggable={false}
      />
    </div>
  );
};

const PANEL_STYLES = `
.btn-import-export {
    background: var(--theme-primary) !important;
    color: #ffffff !important;
    border: 1px solid rgba(255,255,255,0.2) !important;
    box-shadow: 0 0 10px rgba(110, 159, 255, 0.3);
    font-weight: 600 !important;
}
.btn-import-export:hover {
    filter: brightness(1.1);
    box-shadow: 0 0 15px rgba(110, 159, 255, 0.5);
    transform: translateY(-1px);
}
.btn-import-export:active {
    transform: translateY(0);
    filter: brightness(0.9);
}
.btn-import-export:disabled {
    background: var(--text-disabled) !important;
    color: var(--text-tertiary) !important;
    opacity: 0.6;
    cursor: not-allowed;
    box-shadow: none;
    transform: none;
}

/* ---------- Device Tile ---------- */
.device-tile {
    position: relative;
    border-radius: var(--radius-sm);
    overflow: hidden;
    cursor: pointer;
    display: flex;
    align-items: stretch;
    transition: box-shadow 0.2s, transform 0.15s;
    margin-bottom: 2px;
}
.device-tile:hover {
    box-shadow: 0 0 0 2px var(--theme-primary), var(--elevation-2);
    z-index: 2;
}

/* Image wrapper */
.device-tile-img-wrap {
    width: 100%;
    height: 100%;
    position: absolute;
    inset: 0;
}
.device-tile-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.3s;
}
.device-tile-img-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--bg-tertiary);
}
@keyframes dt-spin {
    to { transform: rotate(360deg); }
}
.device-tile-img-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid var(--border-medium);
    border-top-color: var(--theme-primary);
    border-radius: 50%;
    animation: dt-spin 0.7s linear infinite;
}

@keyframes dt-error-pulse {
    0% { box-shadow: 0 0 0 0px var(--severity-critical); }
    50% { box-shadow: 0 0 12px 2px var(--severity-critical); }
    100% { box-shadow: 0 0 0 0px var(--severity-critical); }
}
.device-tile.has-error {
    animation: dt-error-pulse 2s infinite;
    border-color: var(--severity-critical) !important;
    z-index: 1;
}

/* Gradient overlay for text legibility */
.device-tile-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.3) 60%, rgba(0,0,0,0.6) 100%);
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    z-index: 1;
}
.device-tile-overlay-plain {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 10px;
    width: 100%;
    z-index: 1;
}

/* Delete button */
.device-tile-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm);
    border: 1px solid rgba(255,60,60,0.4);
    background: rgba(255,100,100,0.1);
    color: #ff8a8a;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    flex-shrink: 0;
    opacity: 0.6; /* Partially visible for discoverability */
}
.device-tile:hover .device-tile-delete {
    opacity: 1;
    background: #ff3c3c;
    color: #fff;
    border-color: #ff3c3c;
    transform: scale(1.1);
    box-shadow: 0 2px 8px rgba(255, 60, 60, 0.4);
}
.device-tile-delete:active {
    transform: scale(0.9);
}
.device-tile-delete:focus-visible {
    outline: 2px solid var(--theme-primary);
    outline-offset: 2px;
    opacity: 1;
}
`;

export const DevicePanel = () => {
  const {
    racks,
    selectedRackId,
    selectRack,
    addDevice,
    removeDevice,
    selectDevice,
    deleteRack,
    isEditMode,
    updateRackOrientation,
    setImportExportModalRackId,
  } = useStore();
  const rack = racks.find((r) => r.id === selectedRackId);

  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<DeviceType>("Server");
  const [newUSize, setNewUSize] = useState(1);
  const [newUPos, setNewUPos] = useState<number | "">("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [simError, setSimError] = useState<ErrorLevel | "none">("none");

  const handleTemplateSelect = (template: DeviceTemplate | "") => {
    if (template === "") {
      setNewName("");
      setNewType("Server");
      setNewUSize(1);
      setNewImageUrl("");
    } else {
      setNewName(template.name);
      setNewType(template.type);
      setNewUSize(template.uSize);
      setNewImageUrl(template.imageUrl);
    }
  };

  if (!rack) return null;

  const handleAdd = () => {
    if (!newUPos) {
      alert("Please select a position (U)");
      return;
    }

    const start = Number(newUPos);
    const end = start + newUSize - 1;

    // Validation
    if (start < 1 || end > rack.uHeight) {
      alert(`Error: Device (${newUSize}U) exceeds rack height.`);
      return;
    }

    const collision = rack.devices.find((d) => {
      const dStart = d.uPosition;
      const dEnd = d.uPosition + d.uSize - 1;
      return start <= dEnd && end >= dStart;
    });

    if (collision) {
      alert(`Error: Collision with "${collision.name}"`);
      return;
    }

    const device = {
      type: newType,
      name: newName || `${newType} ${newUPos}`,
      uSize: newUSize,
      uPosition: start,
      imageUrl: newImageUrl || undefined,
      portStates: [] as PortState[],
    };

    if (simError !== "none") {
      device.portStates.push({
        portId: "p1",
        status: "error",
        errorLevel: simError as ErrorLevel,
        errorMessage: "Simulated Error",
      });
    }

    const success = addDevice(rack.id, device);
    if (success) {
      setNewName("");
      setNewUPos("");
      setNewImageUrl("");
    } else {
      alert("Failed to add device: Unknown error");
    }
  };

  // Device Colors - Unified base color (low-saturation)
  const UNIFIED_DEVICE_BG = "var(--bg-tertiary)";
  const UNIFIED_DEVICE_TEXT = "var(--text-primary)";
  const UNIFIED_DEVICE_BORDER = "var(--border-medium)";

  // Helper to render rack slots
  const renderSlots = () => {
    if (!rack) return null;
    const usedSlots = new Set<number>();
    rack.devices.forEach((d) => {
      for (let i = 0; i < d.uSize; i++) {
        usedSlots.add(d.uPosition + i);
      }
    });

    const rendered = [];
    for (let u = 1; u <= rack.uHeight; u++) {
      const device = rack.devices.find((d) => d.uPosition === u);
      const occupied = usedSlots.has(u);

      if (device) {
        const heightPx = device.uSize * 28;
        const hasImage = !!device.imageUrl;

        // Calculate highest severity error using shared helper
        const errorInfo = getHighestError(device.portStates);
        const hasError = errorInfo !== null;
        const highestSeverity = errorInfo?.level ?? null;

        // Unified low-saturation base color vs Error "Lit" state
        const bg = hasError
          ? `var(--severity-${highestSeverity})`
          : UNIFIED_DEVICE_BG;
        const textColor = hasImage
          ? "#ffffff"
          : hasError
            ? "#ffffff"
            : UNIFIED_DEVICE_TEXT;
        const borderColor = hasError
          ? `var(--severity-${highestSeverity})`
          : UNIFIED_DEVICE_BORDER;

        rendered.push(
          <div
            key={`dev-${u}`}
            className={`device-tile ${hasError ? "has-error" : ""}`}
            style={{
              height: `${heightPx}px`,
              backgroundColor: bg,
              border: hasError
                ? "2px solid var(--severity-critical)"
                : `1px solid ${borderColor}`,
            }}
            onClick={() => selectDevice(device.id)}
          >
            {/* Device faceplate image */}
            {hasImage && (
              <DeviceTileImage src={device.imageUrl!} alt={device.name} />
            )}

            {/* Content overlay (gradient when image, plain otherwise) */}
            <div
              className={
                hasImage ? "device-tile-overlay" : "device-tile-overlay-plain"
              }
              style={{
                color: textColor,
                fontWeight: hasError ? 700 : 500,
                fontSize: "var(--font-size-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  minWidth: 0,
                }}
              >
                {/* Error pulse indicator */}
                {hasError && (
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: `var(--severity-${highestSeverity})`,
                      boxShadow: `0 0 6px var(--severity-${highestSeverity})`,
                      flexShrink: 0,
                    }}
                  />
                )}
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {device.name}
                </span>
                <span
                  style={{
                    opacity: 0.75,
                    fontSize: "var(--font-size-xs)",
                    flexShrink: 0,
                  }}
                >
                  ({device.uSize}U)
                </span>
              </div>

              {/* Delete button – visible on hover */}
              <button
                className="device-tile-delete"
                aria-label={`Delete device ${device.name}`}
                title="Delete device"
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    window.confirm(`"${device.name}" 장비를 삭제하시겠습니까?`)
                  ) {
                    removeDevice(rack.id, device.id);
                  }
                }}
              >
                ✕
              </button>
            </div>
          </div>,
        );
      } else if (!occupied) {
        const isSelected = newUPos === u;

        // Check availability
        let canFit = true;
        if (u + newUSize - 1 > rack.uHeight) {
          canFit = false;
        } else {
          for (let i = 0; i < newUSize; i++) {
            if (usedSlots.has(u + i)) {
              canFit = false;
              break;
            }
          }
        }

        rendered.push(
          <div
            key={`empty-${u}`}
            onClick={() => canFit && setNewUPos(u)}
            style={{
              height: "28px",
              borderBottom: "1px solid var(--border-weak)",
              display: "flex",
              alignItems: "center",
              cursor: canFit ? "pointer" : "not-allowed",
              backgroundColor: isSelected
                ? "var(--selected-bg)"
                : !canFit
                  ? "var(--severity-critical-bg)"
                  : "var(--severity-success-bg)",
              transition: "background 0.1s",
              marginBottom: "2px",
              opacity: canFit ? 1 : 0.6,
              borderRadius: "var(--radius-sm)",
            }}
            title={
              !canFit
                ? "이 위치에는 해당 높이의 장비를 설치할 수 없습니다."
                : ""
            }
          >
            {/* Rail Number Left */}
            <div
              style={{
                width: "30px",
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: isSelected
                  ? "var(--theme-primary)"
                  : canFit
                    ? "var(--text-secondary)"
                    : "var(--severity-critical-text)",
                borderRight: "1px solid var(--border-weak)",
                fontWeight: isSelected ? 700 : 400,
              }}
            >
              {u}
            </div>
            {/* Slot Content */}
            <div
              style={{
                flex: 1,
                paddingLeft: "10px",
                fontSize: "var(--font-size-xs)",
                color: isSelected
                  ? "var(--theme-primary)"
                  : canFit
                    ? "var(--severity-success-text)"
                    : "var(--severity-critical-text)",
                fontWeight: isSelected ? 600 : 400,
              }}
            >
              {isSelected ? "Selected" : canFit ? "Available" : "Unavailable"}
            </div>
            {/* Rail Number Right */}
            <div
              style={{
                width: "30px",
                textAlign: "center",
                fontSize: "var(--font-size-xs)",
                color: isSelected
                  ? "var(--theme-primary)"
                  : canFit
                    ? "var(--text-secondary)"
                    : "var(--severity-critical-text)",
                borderLeft: "1px solid var(--border-weak)",
                fontWeight: isSelected ? 700 : 400,
              }}
            >
              {u}
            </div>
          </div>,
        );
      }
    }
    // Flex column-reverse to put U=1 at bottom
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column-reverse",
          background: "var(--bg-primary)",
          border: "1px solid var(--border-weak)",
          borderRadius: "var(--radius-md)",
          padding: "4px",
          marginTop: "10px",
        }}
      >
        {rendered}
      </div>
    );
  };

  return (
    <div className="grafana-side-panel" style={{ width: "400px" }}>
      <style>{PANEL_STYLES}</style>

      <div className="grafana-side-panel-header">
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "var(--font-size-lg)",
              fontWeight: "var(--font-weight-semibold)",
              color: "var(--text-primary)",
            }}
          >
            Rack {rack.id.substring(0, 4)}
          </h2>
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-secondary)",
            }}
          >
            {rack.uHeight}U Configuration
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            onClick={() => setImportExportModalRackId(rack.id)}
            className="grafana-btn btn-import-export"
            style={{
              padding: "4px 12px",
              fontSize: "var(--font-size-xs)",
              height: "28px",
            }}
            title="Import or Export this rack's data"
          >
            Import/Export
          </button>
          <button
            onClick={() => selectRack(null)}
            className="grafana-modal-close"
            style={{ position: "static", transform: "none" }}
          >
            ×
          </button>
        </div>
      </div>

      <div className="grafana-side-panel-content">
        {/* Orientation Control (Edit Mode Only) */}
        {isEditMode && (
          <div className="grafana-section" style={{ marginBottom: "16px" }}>
            <h3 className="grafana-section-title">Rack Orientation</h3>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              {[
                { label: "North (0°)", value: 0 },
                { label: "East (90°)", value: 90 },
                { label: "South (180°)", value: 180 },
                { label: "West (270°)", value: 270 },
              ].map((dir) => {
                const wouldViolate = checkFrontClearanceViolation(
                  racks,
                  rack.id,
                  rack.position,
                  dir.value as 0 | 90 | 180 | 270,
                );
                const isCurrentDirection = rack.orientation === dir.value;
                const isDisabled = wouldViolate && !isCurrentDirection;

                return (
                  <button
                    key={dir.value}
                    className={`grafana-btn ${isCurrentDirection ? "grafana-btn-primary" : "grafana-btn-secondary"}`}
                    onClick={() =>
                      !isDisabled &&
                      updateRackOrientation(
                        rack.id,
                        dir.value as 0 | 90 | 180 | 270,
                      )
                    }
                    disabled={isDisabled}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                    title={
                      isDisabled
                        ? "이 방향으로 회전하면 다른 장비의 정면 1.5단위 이내에 위치하게 됩니다."
                        : ""
                    }
                  >
                    {dir.label}
                    {isDisabled && " ⛔"}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form Section */}
        <div className="grafana-section">
          <h3 className="grafana-section-title">Add New Device</h3>

          <div className="grafana-field">
            <label className="grafana-label">Quick Template</label>
            <select
              className="grafana-select"
              onChange={(e) => {
                const val = e.target.value;
                if (val === "") handleTemplateSelect("");
                else {
                  const template = DEVICE_TEMPLATES.find((t) => t.name === val);
                  if (template) handleTemplateSelect(template);
                }
              }}
            >
              <option value="">-- Select Template --</option>
              {DEVICE_TEMPLATES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name} ({t.uSize}U)
                </option>
              ))}
            </select>
          </div>

          <div className="grafana-field">
            <label className="grafana-label">Device Name</label>
            <input
              className="grafana-input"
              placeholder="e.g. Core Switch 01"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </div>

          <div className="grafana-field-grid">
            <div className="grafana-field">
              <label className="grafana-label">Type</label>
              <select
                className="grafana-select"
                value={newType}
                onChange={(e) => setNewType(e.target.value as DeviceType)}
              >
                <option value="Switch">Switch</option>
                <option value="Router">Router</option>
                <option value="Server">Server</option>
              </select>
            </div>
            <div className="grafana-field">
              <label className="grafana-label">Status Sim.</label>
              <select
                className="grafana-select"
                value={simError}
                onChange={(e) =>
                  setSimError(e.target.value as ErrorLevel | "none")
                }
              >
                <option value="none">Normal</option>
                <option value="warning">Warning</option>
                <option value="minor">Minor</option>
                <option value="major">Major</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div className="grafana-field">
            <label className="grafana-label">Faceplate Image URL</label>
            <input
              className="grafana-input"
              placeholder="https://... or Data URL"
              value={newImageUrl}
              onChange={(e) => setNewImageUrl(e.target.value)}
            />
          </div>

          <div className="grafana-field-grid">
            <div className="grafana-field">
              <label className="grafana-label">Height (U)</label>
              <input
                className="grafana-input"
                type="number"
                min="1"
                max="8"
                value={newUSize}
                onChange={(e) => setNewUSize(Number(e.target.value))}
              />
            </div>
            <div className="grafana-field">
              <label className="grafana-label">Position (U)</label>
              <input
                className="grafana-input"
                type="number"
                min="1"
                max={rack.uHeight}
                value={newUPos}
                onChange={(e) => setNewUPos(Number(e.target.value))}
                placeholder="Select/Type"
              />
            </div>
          </div>

          <button
            className="grafana-btn grafana-btn-primary"
            onClick={handleAdd}
            style={{ width: "100%" }}
          >
            Add Device
          </button>
        </div>

        {/* Rack View */}
        <div
          className="grafana-section"
          style={{ background: "transparent", border: "none", padding: 0 }}
        >
          <h3 className="grafana-section-title">Rack Layout</h3>
          <div
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--text-tertiary)",
              marginBottom: "8px",
            }}
          >
            Click a slot number below to set position.
          </div>
          {renderSlots()}
        </div>

        {/* Delete Rack Section */}
        <div
          style={{
            marginTop: "20px",
            paddingTop: "20px",
            borderTop: "1px solid var(--severity-critical-bg)",
          }}
        >
          <button
            className="grafana-btn grafana-btn-destructive"
            style={{ width: "100%" }}
            onClick={() => {
              if (
                window.confirm(
                  "이 랙을 삭제하시겠습니까? 내부의 모든 장비도 함께 삭제됩니다.",
                )
              ) {
                deleteRack(rack.id);
              }
            }}
          >
            Rack 삭제
          </button>
        </div>
      </div>
    </div>
  );
};
