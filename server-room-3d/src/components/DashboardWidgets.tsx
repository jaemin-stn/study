import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { ErrorLevel } from "../types";
import { getNodeName, GWACHEON_NODE_ID, DAEJEON_NODE_ID } from "../utils/nodeUtils";
import { ExclamationCircleIcon, ChartBarIcon } from "./Icons";

// Error item for table display
interface ErrorItem {
  nodeId: string;
  nodeName: string;
  rackId: string;
  rackName: string;
  deviceId: string;
  deviceName: string;
  portNumber: string;
  severity: ErrorLevel;
}

// Severity config for display - Grafana style
const severityConfig: Record<
  ErrorLevel,
  {
    label: string;
    bgClass: string;
    badgeClass: string;
    statBg: string;
    statColor: string;
  }
> = {
  critical: {
    label: "Critical",
    bgClass: "severity-critical",
    badgeClass: "grafana-badge-critical",
    statBg: "var(--severity-critical-bg)",
    statColor: "var(--severity-critical)",
  },
  major: {
    label: "Major",
    bgClass: "severity-major",
    badgeClass: "grafana-badge-major",
    statBg: "var(--severity-major-bg)",
    statColor: "var(--severity-major)",
  },
  minor: {
    label: "Minor",
    bgClass: "severity-minor",
    badgeClass: "grafana-badge-minor",
    statBg: "var(--severity-minor-bg)",
    statColor: "var(--severity-minor)",
  },
  warning: {
    label: "Warning",
    bgClass: "severity-warning",
    badgeClass: "grafana-badge-warning",
    statBg: "var(--severity-warning-bg)",
    statColor: "var(--severity-warning)",
  },
};

// Sensor data type (mock for now)
interface SensorData {
  temperature: number | null;
  humidity: number | null;
}

// Mock sensor data per known node ID
const MOCK_SENSOR_DATA: Record<string, SensorData> = {
  [GWACHEON_NODE_ID]: { temperature: 22.5, humidity: 45.0 },
  [DAEJEON_NODE_ID]: { temperature: 23.8, humidity: 42.0 },
};

export const DashboardWidgets = () => {
  const racks = useStore((state) => state.racks);
  const nodes = useStore((state) => state.nodes);
  const layouts = useStore((state) => state.layouts);
  const activeNodeId = useStore((state) => state.activeNodeId);
  const setActiveNode = useStore((state) => state.setActiveNode);
  const selectRack = useStore((state) => state.selectRack);
  const focusRack = useStore((state) => state.focusRack);
  const selectDevice = useStore((state) => state.selectDevice);
  const [selectedSeverity, setSelectedSeverity] = useState<ErrorLevel | null>(
    "critical",
  );

  const activeNodeName = useMemo(() => getNodeName(nodes, activeNodeId), [nodes, activeNodeId]);

  // Collect ALL racks from ALL nodes
  const allRacks = useMemo(() => {
    const result = [...racks]; // Current active node racks (including unsaved edits)
    Object.entries(layouts).forEach(([nid, layout]) => {
      if (nid !== activeNodeId) {
        result.push(...(layout.racks || []));
      }
    });
    return result;
  }, [racks, layouts, activeNodeId]);

  // Collect all errors from all racks
  const allErrors = useMemo<ErrorItem[]>(() => {
    const errors: ErrorItem[] = [];
    allRacks.forEach((rack) => {
      const nodeName = getNodeName(nodes, rack.mapId);
      rack.devices.forEach((device) => {
        device.portStates.forEach((port) => {
          if (port.status === "error" && port.errorLevel) {
            errors.push({
              nodeId: rack.mapId,
              nodeName: nodeName,
              rackId: rack.rackId,
              rackName: rack.rackTitle || `Rack ${rack.rackId.slice(0, 4)}`,
              deviceId: device.itemId,
              deviceName: device.title,
              portNumber: port.portId,
              severity: port.errorLevel,
            });
          }
        });
      });
    });
    return errors;
  }, [allRacks, nodes]);

  // Handle error row click
  const handleErrorRowClick = (error: ErrorItem) => {
    // If from another node, switch first
    if (activeNodeId !== error.nodeId) {
      setActiveNode(error.nodeId);
    }

    // First select and focus the rack
    selectRack(error.rackId);
    focusRack(error.rackId);
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

  // Mock sensor data per exact active node
  const sensorData: SensorData = useMemo(() => {
    if (activeNodeId && MOCK_SENSOR_DATA[activeNodeId]) return MOCK_SENSOR_DATA[activeNodeId];
    return { temperature: null, humidity: null };
  }, [activeNodeId]);

  return (
    <div className="dashboard-widgets-container">
      {/* Widget 1: Error Summary - Grafana Panel Style */}
      <div className="grafana-panel">
        <div className="grafana-panel-header">
          <h3 className="grafana-panel-title">
            <span style={{ fontSize: "18px", display: "flex", color: "var(--severity-critical)", alignSelf: "center", marginRight: "8px" }}>
              <ExclamationCircleIcon style={{ width: 20, height: 20 }} />
            </span>
            Overall Error Summary
          </h3>
        </div>
        <div className="grafana-panel-content">
          {/* Severity Stat Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "8px",
              marginBottom: "16px",
            }}
          >
            {(Object.keys(severityConfig) as ErrorLevel[]).map((level) => {
              const config = severityConfig[level];
              const count = errorCounts[level];
              const isSelected = selectedSeverity === level;

              return (
                <div
                  key={level}
                  className={`grafana-stat-card ${isSelected ? "selected" : ""}`}
                  onClick={() => setSelectedSeverity(level)}
                  style={{
                    background: config.statBg,
                    color: config.statColor,
                  }}
                >
                  <div className="grafana-stat-value">{count}</div>
                  <div className="grafana-stat-label">{config.label}</div>
                </div>
              );
            })}
          </div>

          {/* Drill-down Table */}
          <div
            style={{
              borderTop: "1px solid var(--border-weak)",
              paddingTop: "12px",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                marginBottom: "8px",
                color: "var(--text-secondary)",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {selectedSeverity && (
                <span
                  className={`grafana-badge ${severityConfig[selectedSeverity].badgeClass}`}
                >
                  {severityConfig[selectedSeverity].label}
                </span>
              )}
              <span>
                {selectedSeverity
                  ? `Errors (${filteredErrors.length})`
                  : "Select a severity level"}
              </span>
            </div>

            {/* Table Container with Fixed Height */}
            <div
              className="grafana-table-container"
              style={{ height: "180px" }}
            >
              {/* Sticky Header */}
              <div
                className="grafana-table-header"
                style={{ 
                  gridTemplateColumns: "1fr 1.3fr 0.8fr",
                  color: "var(--text-secondary)", // Slightly darker than the default table header text
                  fontWeight: 700 
                }}
              >
                <div className="grafana-table-cell">Node</div>
                <div className="grafana-table-cell">Equipment</div>
                <div className="grafana-table-cell" style={{ textAlign: "center" }}>Port</div>
              </div>

              {/* Scrollable Body */}
              <div style={{ height: "calc(100% - 32px)", overflowY: "auto" }}>
                {filteredErrors.length > 0 ? (
                  filteredErrors.map((err, idx) => (
                    <div
                      key={idx}
                      className="grafana-table-row"
                      style={{
                        gridTemplateColumns: "1fr 1.3fr 0.8fr",
                        fontSize: "var(--font-size-xs)",
                      }}
                      onClick={() => handleErrorRowClick(err)}
                    >
                      <div className="grafana-table-cell" title={err.nodeName}>{err.nodeName}</div>
                      <div className="grafana-table-cell" title={err.deviceName}>{err.deviceName}</div>
                      <div className="grafana-table-cell" style={{ textAlign: "center" }}>{err.portNumber}</div>
                    </div>
                  ))
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100%",
                      color: "var(--text-secondary)",
                      fontSize: "var(--font-size-sm)",
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
      </div>

      {/* Widget 2: Sensor Averages - Grafana Panel Style */}
      <div className="grafana-panel">
        <div className="grafana-panel-header">
          <h3 className="grafana-panel-title">
            <span style={{ fontSize: "16px", display: "flex", color: "#6366f1", alignSelf: "center", marginRight: "8px" }}>
              <ChartBarIcon style={{ width: 18, height: 18 }} />
            </span>
            {activeNodeName} Sensors
          </h3>
        </div>
        <div
          className="grafana-sensor-widget"
          style={{
            margin: "0",
            borderRadius: "0 0 var(--radius-lg) var(--radius-lg)",
          }}
        >
          <div style={{ display: "flex", gap: "12px" }}>
            {/* Temperature */}
            <div className="grafana-sensor-card">
              <div className="grafana-sensor-label">Avg Temperature</div>
              {sensorData.temperature !== null ? (
                <div className="grafana-sensor-value">
                  {sensorData.temperature.toFixed(1)}
                  <span className="grafana-sensor-unit">°C</span>
                </div>
              ) : (
                <div style={{ opacity: 0.7 }}>No data</div>
              )}
            </div>

            {/* Humidity */}
            <div className="grafana-sensor-card">
              <div className="grafana-sensor-label">Avg Humidity</div>
              {sensorData.humidity !== null ? (
                <div className="grafana-sensor-value">
                  {sensorData.humidity.toFixed(0)}
                  <span className="grafana-sensor-unit">%</span>
                </div>
              ) : (
                <div style={{ opacity: 0.7 }}>No data</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
