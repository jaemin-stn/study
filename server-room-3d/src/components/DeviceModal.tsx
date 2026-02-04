import { useStore } from "../store/useStore";
import type { Device } from "../types";

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

  // Use specific layout based on device type or default to 24

  const renderPort = (portIndex: number) => {
    const portId = `p${portIndex + 1}`;
    const error = device?.portStates.find((p) => p.portId === portId);
    const isHighlighted = highlightedPortId === portId;

    const baseColor = error ? "#ef4444" : "#22c55e";
    const shadowColor = error
      ? "rgba(239, 68, 68, 0.4)"
      : "rgba(34, 197, 94, 0.2)";

    return (
      <div
        key={portId}
        style={{
          width: "32px",
          height: "32px",
          backgroundColor: "#111",
          border: isHighlighted
            ? "2px solid #ffc107"
            : `1px solid ${error ? "#ef4444" : "#333"}`,
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          cursor: "pointer",
          boxShadow: isHighlighted
            ? "0 0 15px rgba(255, 193, 7, 0.6)"
            : error
              ? `0 0 10px ${shadowColor}`
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
            backgroundColor: "#222",
            borderRadius: "2px",
            border: "1px solid #444",
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
            backgroundColor: baseColor,
            boxShadow: `0 0 4px ${baseColor}`,
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
              fontSize: "9px",
              color: "#ffc107",
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
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={() => selectDevice(null)}
    >
      <div
        style={{
          width: "600px",
          backgroundColor: "#1a1a1a",
          borderRadius: "12px",
          border: "1px solid #333",
          padding: "24px",
          boxShadow: "0 20px 50px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <h2 style={{ color: "#fff", margin: 0, fontSize: "20px" }}>
              {device.name}
            </h2>
            <span style={{ color: "#888", fontSize: "12px" }}>
              Type: {device.type} | Rack: {rackId?.substring(0, 4)}
            </span>
          </div>
          <button
            onClick={() => selectDevice(null)}
            style={{
              background: "none",
              border: "none",
              color: "#666",
              fontSize: "24px",
              cursor: "pointer",
            }}
          >
            &times;
          </button>
        </div>

        <div
          style={{
            backgroundColor: "#0a0a0a",
            padding: "20px",
            borderRadius: "8px",
            border: "1px solid #222",
            display: "grid",
            gridTemplateColumns: "repeat(12, 1fr)",
            gap: "8px",
            justifyItems: "center",
          }}
        >
          {Array.from({ length: 24 }).map((_, i) => renderPort(i))}
        </div>

        <div style={{ display: "flex", gap: "16px", fontSize: "13px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#22c55e",
              }}
            />
            <span style={{ color: "#aaa" }}>Operational</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#ef4444",
              }}
            />
            <span style={{ color: "#aaa" }}>Error</span>
          </div>
        </div>

        {device.portStates.length > 0 && (
          <div
            style={{
              marginTop: "10px",
              padding: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              borderLeft: "4px solid #ef4444",
              borderRadius: "4px",
            }}
          >
            <h4
              style={{
                color: "#ef4444",
                margin: "0 0 8px 0",
                fontSize: "14px",
              }}
            >
              Active Faults
            </h4>
            {device.portStates.map((err, idx) => (
              <div
                key={idx}
                style={{ color: "#fff", fontSize: "13px", marginBottom: "4px" }}
              >
                <strong>{err.portId}</strong>: {err.errorMessage} (
                {err.errorLevel})
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
