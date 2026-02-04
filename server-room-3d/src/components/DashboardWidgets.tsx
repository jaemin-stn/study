import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { ErrorLevel } from "../types";

// Sensor data type (mock for now)
interface SensorData {
  temperature: number | null;
  humidity: number | null;
}

// Error item for table display
interface ErrorItem {
  rackId: string;
  rackName: string;
  deviceId: string;
  deviceName: string;
  portNumber: string;
  severity: ErrorLevel;
}

// Severity config for display
const severityConfig: Record<
  ErrorLevel,
  { label: string; color: string; bgColor: string }
> = {
  critical: { label: "Critical", color: "#fff", bgColor: "#d32f2f" },
  major: { label: "Major", color: "#fff", bgColor: "#f57c00" },
  minor: { label: "Minor", color: "#000", bgColor: "#ffc107" },
  warning: { label: "Warning", color: "#000", bgColor: "#90caf9" },
};

export const DashboardWidgets = () => {
  const racks = useStore((state) => state.racks);
  const selectRack = useStore((state) => state.selectRack);
  const selectDevice = useStore((state) => state.selectDevice);
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorLevel | null>(
    "critical",
  );

  // Collect all errors from all racks/devices/ports
  const allErrors = useMemo<ErrorItem[]>(() => {
    const errors: ErrorItem[] = [];
    racks.forEach((rack) => {
      rack.devices.forEach((device) => {
        device.portStates.forEach((port) => {
          if (port.status === "error" && port.errorLevel) {
            errors.push({
              rackId: rack.id,
              rackName: `${rack.uHeight}U-${rack.id.slice(0, 4)}`,
              deviceId: device.id,
              deviceName: device.name,
              portNumber: port.portId,
              severity: port.errorLevel,
            });
          }
        });
      });
    });
    return errors;
  }, [racks]);

  // Handle error row click
  const handleErrorRowClick = (error: ErrorItem) => {
    // First select the rack
    selectRack(error.rackId);
    // Then open the device modal with highlighted port (use setTimeout to ensure state updates)
    setTimeout(() => {
      selectDevice(error.deviceId, error.portNumber);
    }, 50);
  };

  // Count errors by severity
  const errorCounts = useMemo(() => {
    const counts: Record<ErrorLevel, number> = {
      critical: 0,
      major: 0,
      minor: 0,
      warning: 0,
    };
    allErrors.forEach((err) => {
      counts[err.severity]++;
    });
    return counts;
  }, [allErrors]);

  // Filter errors by selected severity
  const filteredErrors = useMemo(() => {
    if (!selectedSeverity) return [];
    return allErrors.filter((err) => err.severity === selectedSeverity);
  }, [allErrors, selectedSeverity]);

  // Mock sensor data (in real app, this would come from a data source)
  const sensorData: SensorData = useMemo(() => {
    // Simulated sensor averages
    return {
      temperature: 22.5,
      humidity: 45.0,
    };
  }, []);

  return (
    <div
      style={{
        position: "absolute",
        top: "10px",
        right: "10px",
        zIndex: 15,
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        width: "320px",
      }}
    >
      {/* Widget 1: Error Summary */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.95)",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          padding: "16px",
          backdropFilter: "blur(10px)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <h3
          style={{
            margin: "0 0 12px 0",
            fontSize: "14px",
            fontWeight: 600,
            color: "#333",
          }}
        >
          🚨 Rack Error Summary
        </h3>
        {/* Severity Cards */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            marginBottom: "12px",
          }}
        >
          {(Object.keys(severityConfig) as ErrorLevel[]).map((level) => {
            const config = severityConfig[level];
            const count = errorCounts[level];
            const isSelected = selectedSeverity === level;

            return (
              <div
                key={level}
                onClick={() => setSelectedSeverity(level)}
                style={{
                  background: config.bgColor,
                  color: config.color,
                  padding: "10px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.2s",
                  transform: isSelected ? "scale(1.05)" : "scale(1)",
                  boxShadow: isSelected ? "0 4px 12px rgba(0,0,0,0.3)" : "none",
                  border: isSelected
                    ? "2px solid #333"
                    : "2px solid transparent",
                }}
              >
                <div style={{ fontSize: "20px", fontWeight: 700 }}>{count}</div>
                <div
                  style={{ fontSize: "11px", fontWeight: 500, opacity: 0.9 }}
                >
                  {config.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Drill-down Table - Always visible */}
        <div
          style={{
            borderTop: "1px solid #eee",
            paddingTop: "12px",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              marginBottom: "8px",
              color: "#555",
            }}
          >
            {selectedSeverity
              ? `${severityConfig[selectedSeverity].label} Errors (${filteredErrors.length})`
              : "Select a severity level"}
          </div>

          {/* Table Container with Fixed Height */}
          <div
            style={{
              height: "180px",
              border: "1px solid #eee",
              borderRadius: "6px",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Sticky Header */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 0.7fr",
                background: "#f5f5f5",
                fontSize: "11px",
                fontWeight: 600,
                borderBottom: "1px solid #ddd",
                flexShrink: 0,
              }}
            >
              <div style={{ padding: "8px" }}>Rack</div>
              <div style={{ padding: "8px" }}>Equipment</div>
              <div style={{ padding: "8px" }}>Port</div>
            </div>

            {/* Scrollable Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                fontSize: "11px",
              }}
            >
              {filteredErrors.length > 0 ? (
                filteredErrors.map((err, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleErrorRowClick(err)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 0.7fr",
                      background: idx % 2 === 0 ? "#fff" : "#fafafa",
                      borderBottom: "1px solid #eee",
                      cursor: "pointer",
                      transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "#e3f2fd";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background =
                        idx % 2 === 0 ? "#fff" : "#fafafa";
                    }}
                  >
                    <div
                      style={{
                        padding: "8px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {err.rackName}
                    </div>
                    <div
                      style={{
                        padding: "8px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {err.deviceName}
                    </div>
                    <div
                      style={{
                        padding: "8px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {err.portNumber}
                    </div>
                  </div>
                ))
              ) : (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "100%",
                    color: "#999",
                    fontSize: "12px",
                  }}
                >
                  {selectedSeverity
                    ? `No ${severityConfig[selectedSeverity].label.toLowerCase()} errors`
                    : "No data"}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Widget 2: Sensor Averages */}
      <div
        style={{
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          borderRadius: "12px",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.15)",
          padding: "16px",
          color: "#fff",
        }}
      >
        <h3 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: 600 }}>
          🌡️ Server Room Sensors
        </h3>

        <div style={{ display: "flex", gap: "12px" }}>
          {/* Temperature */}
          <div
            style={{
              flex: 1,
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "11px", opacity: 0.8, marginBottom: "4px" }}
            >
              Avg Temperature
            </div>
            {sensorData.temperature !== null ? (
              <div style={{ fontSize: "24px", fontWeight: 700 }}>
                {sensorData.temperature.toFixed(1)}
                <span style={{ fontSize: "14px", fontWeight: 400 }}>°C</span>
              </div>
            ) : (
              <div style={{ fontSize: "14px", opacity: 0.7 }}>No data</div>
            )}
          </div>

          {/* Humidity */}
          <div
            style={{
              flex: 1,
              background: "rgba(255, 255, 255, 0.15)",
              borderRadius: "8px",
              padding: "12px",
              textAlign: "center",
            }}
          >
            <div
              style={{ fontSize: "11px", opacity: 0.8, marginBottom: "4px" }}
            >
              Avg Humidity
            </div>
            {sensorData.humidity !== null ? (
              <div style={{ fontSize: "24px", fontWeight: 700 }}>
                {sensorData.humidity.toFixed(0)}
                <span style={{ fontSize: "14px", fontWeight: 400 }}>%</span>
              </div>
            ) : (
              <div style={{ fontSize: "14px", opacity: 0.7 }}>No data</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
