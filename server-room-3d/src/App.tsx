import { useRef } from "react";
import { Scene } from "./components/Scene";
import { DevicePanel } from "./components/DevicePanel";
import { DeviceModal } from "./components/DeviceModal";
import { DashboardWidgets } from "./components/DashboardWidgets";
import { ThemeToggle } from "./components/ThemeToggle";
import { useStore } from "./store/useStore";
import { saveToJSON, loadFromJSON, sampleRacks } from "./utils/storage";

function App() {
  const { addRack, loadState, selectedRackId, racks, isEditMode, setEditMode } =
    useStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLoad = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const loadedRacks = await loadFromJSON(e.target.files[0]);
        loadState(loadedRacks);
      } catch (err) {
        alert("Failed to load JSON");
        console.error(err);
      }
    }
  };

  const loadSample = () => {
    loadState(sampleRacks);
  };

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      {/* 3D Scene Layer */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: 0,
        }}
      >
        <Scene />
      </div>

      {/* UI Overlay Layer (Toolbar) */}
      <div
        className="grafana-toolbar"
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 10,
        }}
      >
        {/* Theme Toggle */}
        <ThemeToggle />

        <div className="grafana-toolbar-divider" />

        {/* Edit Mode Toggle */}
        <div
          className={`grafana-mode-indicator ${isEditMode ? "active" : ""}`}
          onClick={() => setEditMode(!isEditMode)}
        >
          <div
            className={`grafana-status-dot ${isEditMode ? "grafana-status-dot-active" : "grafana-status-dot-inactive"}`}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: "var(--font-size-sm)",
              color: isEditMode
                ? "var(--severity-success-text)"
                : "var(--text-secondary)",
            }}
          >
            {isEditMode ? "Edit Mode: ON" : "Edit Mode: OFF"}
          </span>
        </div>

        <div className="grafana-toolbar-divider" />

        {/* Add Rack */}
        <div className="grafana-toolbar-group">
          <span className="grafana-toolbar-label">Add Rack:</span>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() =>
              addRack(24, [
                Math.round(Math.random() * 5 * 2) / 2,
                Math.round(Math.random() * 5 * 2) / 2,
              ])
            }
          >
            24U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() =>
              addRack(32, [
                Math.round(Math.random() * 5 * 2) / 2,
                Math.round(Math.random() * 5 * 2) / 2,
              ])
            }
          >
            32U
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() =>
              addRack(48, [
                Math.round(Math.random() * 5 * 2) / 2,
                Math.round(Math.random() * 5 * 2) / 2,
              ])
            }
          >
            48U
          </button>
        </div>

        <div className="grafana-toolbar-divider" />

        {/* File Operations */}
        <div className="grafana-toolbar-group">
          <button
            className="grafana-btn grafana-btn-primary"
            onClick={() => saveToJSON(racks)}
          >
            Save JSON
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={() => fileInputRef.current?.click()}
          >
            Load JSON
          </button>
          <button
            className="grafana-btn grafana-btn-secondary"
            onClick={loadSample}
          >
            Load Sample
          </button>
          <input
            type="file"
            ref={fileInputRef}
            style={{ display: "none" }}
            accept=".json"
            onChange={handleLoad}
          />
        </div>
      </div>

      {/* Dashboard Widgets (shown when no rack is selected) */}
      {!selectedRackId && <DashboardWidgets />}

      {/* Side Panel */}
      {selectedRackId && <DevicePanel />}

      {/* Global Device Modal */}
      <DeviceModal />
    </div>
  );
}

export default App;
