import { useState } from "react";
import { useStore, checkFrontClearanceViolation } from "../store/useStore";
import type { DeviceType, ErrorLevel } from "../types";
import { DEVICE_TEMPLATES } from "../utils/deviceTemplates";
import type { DeviceTemplate } from "../utils/deviceTemplates";

const ERROR_PULSE_STYLE = `
@keyframes error-pulse {
    0% { border-color: var(--severity-critical); box-shadow: 0 0 2px var(--severity-critical); }
    50% { border-color: var(--severity-critical); box-shadow: 0 0 12px var(--severity-critical); }
    100% { border-color: var(--severity-critical); box-shadow: 0 0 2px var(--severity-critical); }
}
.device-error-pulse {
    animation: error-pulse 1.5s infinite ease-in-out;
    border: 2px solid var(--severity-critical) !important;
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
      portStates: [] as any[],
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

  // Device Colors
  const typeColors: Record<string, string> = {
    Switch: "var(--severity-success)",
    Router: "var(--severity-major)",
    Server: "var(--theme-primary)",
  };

  // Helper to render rack slots
  const renderSlots = () => {
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
        const bg = typeColors[device.type] || "var(--text-tertiary)";
        const hasError = device.portStates.some((p) => p.status === "error");

        rendered.push(
          <div
            key={`dev-${u}`}
            style={{
              height: `${heightPx}px`,
              backgroundColor: bg,
              borderRadius: "var(--radius-sm)",
              border: hasError
                ? "2px solid var(--severity-critical)"
                : "1px solid rgba(0,0,0,0.1)",
              marginBottom: "2px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              color: "#fff",
              fontWeight: 500,
              fontSize: "var(--font-size-sm)",
              boxShadow: "var(--elevation-1)",
              position: "relative",
              cursor: "pointer",
            }}
            className={hasError ? "device-error-pulse" : ""}
            onClick={() => selectDevice(device.id)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span>{device.name}</span>
              <span style={{ opacity: 0.8, fontSize: "var(--font-size-xs)" }}>
                ({device.uSize}U)
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeDevice(rack.id, device.id);
              }}
              style={{
                background: "rgba(0,0,0,0.2)",
                border: "none",
                color: "white",
                width: "20px",
                height: "20px",
                borderRadius: "50%",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "var(--font-family)",
              }}
            >
              ×
            </button>
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
      <style>{ERROR_PULSE_STYLE}</style>

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
        <button
          onClick={() => selectRack(null)}
          className="grafana-modal-close"
        >
          ×
        </button>
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
                // Check if this direction would violate front clearance
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
                      updateRackOrientation(rack.id, dir.value as any)
                    }
                    disabled={isDisabled}
                    style={{
                      fontSize: "var(--font-size-xs)",
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                    title={
                      isDisabled
                        ? "이 방향으로 회전하면 다른 랙의 정면 1단위 이내에 위치하게 됩니다."
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
                onChange={(e) => setNewType(e.target.value as any)}
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
                onChange={(e) => setSimError(e.target.value as any)}
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
