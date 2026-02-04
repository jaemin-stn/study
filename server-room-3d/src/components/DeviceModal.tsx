import { useStore } from "../store/useStore";
import type { Device } from "../types";

// Severity badge class mapping
const severityBadgeClass: Record<string, string> = {
  critical: "grafana-badge-critical",
  major: "grafana-badge-major",
  minor: "grafana-badge-minor",
  warning: "grafana-badge-warning",
};

export const DeviceModal = () => {
  const { racks, selectedDeviceId, highlightedPortId, selectDevice } =
    useStore();

  if (!selectedDeviceId) return null;

  // Find the device and its rack
  let device: Device | undefined;
  let rackId: string | undefined;

  for (const r of racks) {
    device = r.devices.find((d) => d.id === selectedDeviceId);
    if (device) {
      rackId = r.id;
      break;
    }
  }

  if (!device) return null;

  const renderPort = (portIndex: number) => {
    const portId = `p${portIndex + 1}`;
    const error = device?.portStates.find((p) => p.portId === portId);
    const isHighlighted = highlightedPortId === portId;

    return (
      <div
        key={portId}
        style={{
          width: "32px",
          height: "32px",
          backgroundColor: "var(--bg-tertiary)",
          border: isHighlighted
            ? "2px solid var(--severity-minor)"
            : error
              ? "1px solid var(--severity-critical)"
              : "1px solid var(--border-medium)",
          borderRadius: "var(--radius-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
          boxShadow: isHighlighted
            ? "0 0 15px rgba(242, 204, 12, 0.5)"
            : error
              ? "0 0 8px var(--severity-critical-bg)"
              : "none",
          transform: isHighlighted ? "scale(1.15)" : "scale(1)",
          transition: "all 0.2s",
          zIndex: isHighlighted ? 10 : 1,
        }}
        title={
          error ? `${portId}: ${error.errorMessage}` : `${portId}: Operational`
        }
      >
        <div
          style={{
            width: "12px",
            height: "10px",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "2px",
            border: "1px solid var(--border-medium)",
          }}
        />
        {/* Status LED */}
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "4px",
            height: "4px",
            borderRadius: "50%",
            backgroundColor: error
              ? "var(--severity-critical)"
              : "var(--severity-success)",
            boxShadow: error
              ? "0 0 4px var(--severity-critical)"
              : "0 0 4px var(--severity-success)",
          }}
        />
        {/* Port label for highlighted port */}
        {isHighlighted && (
          <div
            style={{
              position: "absolute",
              bottom: "-16px",
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: "var(--font-size-xs)",
              color: "var(--severity-minor)",
              fontWeight: 700,
              whiteSpace: "nowrap",
            }}
          >
            {portId}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grafana-modal-overlay" onClick={() => selectDevice(null)}>
      <div
        className="grafana-modal"
        style={{ width: "600px" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="grafana-modal-header">
          <div>
            <h2 className="grafana-modal-title">{device.name}</h2>
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "4px",
              }}
            >
              <span
                className="grafana-badge grafana-badge-success"
                style={{ textTransform: "capitalize" }}
              >
                {device.type}
              </span>
              Rack: {rackId?.substring(0, 4)}
            </span>
          </div>
          <button
            className="grafana-modal-close"
            onClick={() => selectDevice(null)}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="grafana-modal-content">
          {/* Port Grid */}
          <div
            style={{
              backgroundColor: "var(--bg-secondary)",
              padding: "20px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-weak)",
              display: "grid",
              gridTemplateColumns: "repeat(12, 1fr)",
              gap: "8px",
              justifyItems: "center",
            }}
          >
            {Array.from({ length: 24 }).map((_, i) => renderPort(i))}
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              gap: "24px",
              marginTop: "16px",
              fontSize: "var(--font-size-sm)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div className="grafana-status-dot grafana-status-dot-active" />
              <span style={{ color: "var(--text-secondary)" }}>
                Operational
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "50%",
                  backgroundColor: "var(--severity-critical)",
                  boxShadow: "0 0 6px var(--severity-critical)",
                }}
              />
              <span style={{ color: "var(--text-secondary)" }}>Error</span>
            </div>
          </div>

          {/* Active Faults */}
          {device.portStates.length > 0 && (
            <div
              style={{
                marginTop: "16px",
                padding: "16px",
                backgroundColor: "var(--severity-critical-bg)",
                borderLeft: "4px solid var(--severity-critical)",
                borderRadius: "var(--radius-md)",
              }}
            >
              <h4
                style={{
                  color: "var(--severity-critical-text)",
                  margin: "0 0 12px 0",
                  fontSize: "var(--font-size-md)",
                  fontWeight: "var(--font-weight-semibold)",
                }}
              >
                Active Faults
              </h4>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {device.portStates.map((err, idx) => (
                  <div
                    key={idx}
                    style={{
                      color: "var(--text-primary)",
                      fontSize: "var(--font-size-sm)",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <strong style={{ color: "var(--severity-critical-text)" }}>
                      {err.portId}
                    </strong>
                    <span>{err.errorMessage}</span>
                    <span
                      className={`grafana-badge ${severityBadgeClass[err.errorLevel] || ""}`}
                    >
                      {err.errorLevel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
