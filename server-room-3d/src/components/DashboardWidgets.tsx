import { useState, useMemo } from "react";
import { useStore } from "../store/useStore";
import type { ErrorLevel } from "../types";
import { getNodeName, GWACHEON_NODE_ID, DAEJEON_NODE_ID } from "../utils/nodeUtils";
import { ExclamationCircleIcon, ChartBarIcon } from "./Icons";

// Responsive Water Drop SVG component
const WaterDropIcon = ({ percentage }: { percentage: number }) => {
  // Map 0-100% to fill level (SVG Y coordinates roughly from 22 down to 2)
  const fillY = 22 - (percentage / 100) * 20;
  
  return (
    <svg width="18" height="22" viewBox="0 0 24 24" fill="none" className="weather-drop-svg">
      <defs>
        <clipPath id={`drop-clip-${percentage.toFixed(0)}`}>
          <path d="M12 2.1C12 2.1 5 10 5 15.5C5 19.1 7.9 22 11.5 22C15.1 22 18 19.1 18 15.5C18 10 11 2.1 11 2.1H12Z" />
        </clipPath>
      </defs>
      {/* Background/Outline */}
      <path 
        d="M12 2.1C12 2.1 5 10 5 15.5C5 19.1 7.9 22 11.5 22C15.1 22 18 19.1 18 15.5C18 10 11 2.1 11 2.1H12Z" 
        stroke="var(--border-medium)" 
        strokeWidth="1.5" 
        strokeLinecap="round"
      />
      {/* Filling Rect */}
      <rect 
        x="0" 
        y={fillY} 
        width="24" 
        height="24" 
        fill="var(--theme-primary)" 
        clipPath={`url(#drop-clip-${percentage.toFixed(0)})`}
      />
    </svg>
  );
};

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

  // Collect sensor data for all nodes in the hierarchy
  const allNodeSensors = useMemo(() => {
    // Priority 1: Nodes that actually exist in hierarchy
    const sensorList = nodes
      .map(node => ({
        id: node.nodeId,
        name: node.name,
        data: MOCK_SENSOR_DATA[node.nodeId] || { 
          temperature: 20 + Math.random() * 5, 
          humidity: 30 + Math.random() * 40 
        }
      }))
      .filter(n => n.id !== "root"); // Skip root if needed

    // Return only nodes that exist in hierarchy
    return sensorList;
  }, [nodes]);

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

      {/* Widget 2: Global Sensor Overview - Refined Weather Style */}
      <div className="grafana-panel">
        <div className="grafana-panel-header">
          <h3 className="grafana-panel-title">
            <span style={{ fontSize: "16px", display: "flex", color: "#6366f1", alignSelf: "center", marginRight: "8px" }}>
              <ChartBarIcon style={{ width: 18, height: 18 }} />
            </span>
            System Environment Overview
          </h3>
        </div>
        <div className="grafana-sensor-widget">
          <div className="weather-list">
            {allNodeSensors.length > 0 ? (
              allNodeSensors.map((node) => {
                const isActive = node.id === activeNodeId;
                const temp = node.data.temperature || 0;
                const hum = node.data.humidity || 0;
                
                // Normalize temp for gauge bar (assuming 15°C - 35°C range)
                const tempPercent = Math.min(100, Math.max(0, ((temp - 15) / 20) * 100));
                
                return (
                  <div 
                    key={node.id} 
                    className={`weather-row ${isActive ? "active" : ""}`}
                    onClick={() => setActiveNode(node.id)}
                  >
                    <div className="weather-node-name" title={node.name}>
                      <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
                        <div className="weather-dot-container">
                          {isActive && <div className="weather-active-dot" />}
                        </div>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {node.name}
                        </span>
                      </div>
                    </div>
                    
                    {/* Temperature Info (Value & Gauge only) */}
                    <div className="weather-temp">
                      {temp.toFixed(1)}°
                    </div>
                    <div className="weather-bar-container" title={`Temperature: ${temp.toFixed(1)}°C`}>
                      <div className="weather-track">
                        <div 
                          className="weather-temp-gradient" 
                          style={{ width: `${tempPercent}%` }} 
                        />
                      </div>
                    </div>
  
                    {/* Humidity Info (Drop Icon & Percent) */}
                    <div className="weather-drop-wrap" title={`Humidity: ${hum.toFixed(0)}%`}>
                      <WaterDropIcon percentage={hum} />
                    </div>
                    <div className="weather-humidity-percent">
                      {hum.toFixed(0)}%
                    </div>
                  </div>
                );
              })
            ) : (
              <div 
                style={{ 
                  padding: "40px 20px", 
                  textAlign: "center", 
                  color: "var(--text-tertiary)",
                  fontSize: "var(--font-size-sm)"
                }}
              >
                No sensor nodes found
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
};
